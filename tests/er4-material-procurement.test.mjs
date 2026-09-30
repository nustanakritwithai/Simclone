import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {command,step,serialize,restore,validate,pathTo,walkable} from '../src/engine.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {materialAmount} from '../src/material-economy.mjs';
import {getBalance,totalCurrency} from '../src/currency-wallet.mjs';
import {recipeMastery,knowsCraftRecipe} from '../src/craft-recipe-knowledge.mjs';
import {CRAFT_TRAINING_RULES} from '../src/craft-training.mjs';
import {grantAdventureLoot} from '../src/rust-possessions.mjs';
import {TRADE_ASSET_TYPES} from '../src/trade-assets.mjs';
import {observeRc4Markets,knownRc4Listings} from '../src/rc4-market-observation.mjs';
import {projectHomeMarketForTrade} from '../src/home-market.mjs';
import {ECONOMIC_DEMAND_TTL_TICKS} from '../src/economic-demand.mjs';
import {demandDrivenCrafterSnapshot} from '../src/demand-driven-crafter.mjs';
import {
  ER4_MATERIAL_PROCUREMENT_VERSION,crafterMaterialProcurementSnapshot,crafterMaterialProcurementDecision
} from '../src/crafter-material-procurement.mjs';
import {rc2World,craftFixtureItem} from './fixtures/rc2-world.mjs';

function freeBagSlot(s,a){
  const equipped=new Set((s.rustPossessions.equipment??[]).filter(e=>e.agentId===a.id).map(e=>e.itemId));
  const item=s.rustPossessions.items
    .filter(i=>i.location?.kind==='bag'&&i.location.agentId===a.id&&!equipped.has(i.id))
    .sort((x,y)=>x.id-y.id)[0];
  assert.ok(item,'fixture needs one unequipped item');
  item.location={kind:'drop',sourceAgentId:a.id,tick:s.tick,x:a.x,y:a.y};
  return item.id;
}

function qualifiedCrafterFixture(){
  const s=rc2World(),merchant=s.agents[0],crafter=s.agents[1],stock=resourceStock(s,crafter);
  assert.equal(adoptProfession(crafter,'BUILD',s.tick).changed,true);
  Object.assign(stock,{food:900,wood:900,stone:900,ironIngot:120,steelIngot:90});
  crafter.hp=crafter.satiety=crafter.energy=100;crafter.task=null;

  craftFixtureItem(s,crafter,'HAMMER');
  craftFixtureItem(s,crafter,'HAMMER_T2');
  craftFixtureItem(s,crafter,'HAMMER');
  craftFixtureItem(s,crafter,'HAMMER_T2');
  craftFixtureItem(s,crafter,'HAMMER');
  assert.equal(recipeMastery(crafter,'HAMMER'),4);
  assert.equal(recipeMastery(crafter,'HAMMER_T2'),2);
  const promoted=command(s,'RC5_BECOME_CRAFTER',{agentId:crafter.id});
  assert.equal(promoted.ok,true,JSON.stringify(promoted));
  assert.equal(crafter.profession,'crafter');
  freeBagSlot(s,crafter);

  merchant.task=null;crafter.task=null;
  merchant.hp=merchant.satiety=merchant.energy=100;
  crafter.hp=crafter.satiety=crafter.energy=100;
  return {s,merchant,crafter};
}

function setupMerchantMarket(s,merchant,{productDemand='STONE_PICKAXE',productPrice=70}={}){
  const made=command(s,'RC4_CREATE_MARKET',{agentId:merchant.id});assert.equal(made.ok,true,JSON.stringify(made));
  // The product BuyOffer is real observed demand for ER3 and also gives the existing
  // RC4 qualification path its canonical market evidence.
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,itemKind:productDemand,unitPrice:productPrice});
  assert.equal(offer.ok,true,JSON.stringify(offer));
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:merchant.id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  assert.equal(command(s,'RC4_OPEN_MARKET',{agentId:merchant.id,marketId:made.marketId}).ok,true);
  const market=projectHomeMarketForTrade(s,s.homeMarkets,{marketId:made.marketId});assert.equal(market.ok,true,JSON.stringify(market));
  return {marketId:made.marketId,offerId:offer.offerId,tradePoint:market.market};
}

function arriveImmediately(s,agentId,marketId){
  const projected=projectHomeMarketForTrade(s,s.homeMarkets,{marketId});assert.equal(projected.ok,true,JSON.stringify(projected));
  const a=live(s,agentId);a.task=null;a.x=projected.market.x;a.y=projected.market.y;
  const travel=command(s,'RC4_TRAVEL_TO_MARKET',{agentId,marketId});assert.equal(travel.ok,true,JSON.stringify(travel));
  const current=live(s,agentId);assert.ok(current.task?.rc4MarketTravel);assert.equal(current.task.path.length,0);
  return projected.market;
}

function merchantAcquireBulkBasis(s,{merchantId,supplierId,marketId,itemKind='wood',quantity=10,unitPrice=1}={}){
  const supplier=live(s,supplierId);
  resourceStock(s,supplier)[itemKind]=Math.max(resourceStock(s,supplier)[itemKind]??0,900);
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{
    agentId:merchantId,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,itemKind,quantityWanted:quantity,unitPrice
  });
  assert.equal(offer.ok,true,JSON.stringify(offer));
  const accepted=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:supplierId,offerId:offer.offerId,quantity});
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  const procurement=s.merchantListings.listings.find(l=>l.id===accepted.listingId);assert.ok(procurement);
  arriveImmediately(s,merchantId,marketId);
  const bought=command(s,'RC4_BUY_LISTING',{buyerId:merchantId,listingId:procurement.id,listingRevision:procurement.revision});
  assert.equal(bought.ok,true,JSON.stringify(bought));
  const ledger=s.merchantLedgers.ledgers.find(l=>l.merchantId===merchantId);assert.ok(ledger);
  const basis=ledger.purchases.find(p=>p.transactionId===bought.transactionId);assert.ok(basis);
  assert.equal(basis.assetType,TRADE_ASSET_TYPES.BULK_RESOURCE);assert.equal(basis.remainingQuantity,quantity);
  return {transactionId:bought.transactionId,offerId:offer.offerId,quantity};
}

function merchantAcquirePhysicalBasis(s,{merchantId,supplierId,marketId,itemId,itemKind,unitPrice=2}={}){
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchantId,itemKind,unitPrice});
  assert.equal(offer.ok,true,JSON.stringify(offer));
  const accepted=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:supplierId,offerId:offer.offerId,itemId});
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  const procurement=s.merchantListings.listings.find(l=>l.id===accepted.listingId);assert.ok(procurement);
  arriveImmediately(s,merchantId,marketId);
  const bought=command(s,'RC4_BUY_LISTING',{buyerId:merchantId,listingId:procurement.id,listingRevision:procurement.revision});
  assert.equal(bought.ok,true,JSON.stringify(bought));
  const ledger=s.merchantLedgers.ledgers.find(l=>l.merchantId===merchantId);assert.ok(ledger);
  const basis=ledger.purchases.find(p=>p.transactionId===bought.transactionId);assert.ok(basis);
  assert.deepEqual(basis.remainingItemIds,[itemId]);
  assert.deepEqual(s.rustPossessions.items.find(i=>i.id===itemId)?.location,{kind:'bag',agentId:merchantId});
  return {transactionId:bought.transactionId,offerId:offer.offerId,itemId};
}

function addBulkListing(s,merchant,{itemKind='wood',quantity=10,unitPrice=1,requestId='er4-bulk'}={}){
  const listed=command(s,'RC4_CREATE_LISTING',{
    agentId:merchant.id,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,itemKind,quantity,unitPrice,requestId
  });
  assert.equal(listed.ok,true,JSON.stringify(listed));
  return listed;
}

function observeMarket(s,crafter,marketId){
  const market=projectHomeMarketForTrade(s,s.homeMarkets,{marketId});assert.equal(market.ok,true);
  crafter.x=market.market.x;crafter.y=market.market.y;crafter.task=null;
  observeRc4Markets(s);
  assert.ok(knownRc4Listings(crafter).some(l=>l.marketId===marketId));
  return market.market;
}

function nearbyReachable(s,target,minDistance=2){
  for(let r=minDistance;r<10;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    const p={x:target.x+dx,y:target.y+dy};
    if(Math.abs(dx)+Math.abs(dy)<minDistance||!walkable(s,p.x,p.y))continue;
    const path=pathTo(s,p,target);
    if(Array.isArray(path)&&path.length>=minDistance)return p;
  }
  return null;
}

function farWalkable(s,from,minDistance=18){
  return (s.nodes??[]).filter(n=>walkable(s,n.x,n.y)&&Math.abs(n.x-from.x)+Math.abs(n.y-from.y)>=minDistance)
    .sort((a,b)=>(Math.abs(b.x-from.x)+Math.abs(b.y-from.y))-(Math.abs(a.x-from.x)+Math.abs(a.y-from.y))||a.id-b.id)[0]??null;
}

function live(s,id){return s.agents.find(a=>a.id===id);}

function setupBulkProcurement({observe=true,price=1,listingQuantity=10}={}){
  const {s,merchant,crafter}=qualifiedCrafterFixture(),merchantId=merchant.id,crafterId=crafter.id;
  merchant.preference='MINE';crafter.preference='BUILD';
  // RC4 commands automatically publish observations only to nearby actors. Keep
  // Crafter physically outside knowledge range while market/listing truth is created.
  const far=farWalkable(s,merchant);assert.ok(far,'far observation-safe fixture point');
  crafter.x=far.x;crafter.y=far.y;crafter.task=null;
  const market=setupMerchantMarket(s,merchant,{productDemand:'STONE_PICKAXE',productPrice:70});

  // Merchant resale must have canonical COGS provenance. Acquire the exact bulk
  // stock from the future ER4 buyer first through the released BuyOffer/Trade path.
  merchantAcquireBulkBasis(s,{merchantId,supplierId:crafterId,marketId:market.marketId,itemKind:'wood',quantity:listingQuantity,unitPrice:1});
  const currentMerchant=live(s,merchantId),currentCrafter=live(s,crafterId);
  currentMerchant.preference='MINE';currentCrafter.preference='BUILD';currentMerchant.task=null;currentCrafter.task=null;
  // Move Crafter back out of observation range before the Merchant creates resale supply.
  const hidden=farWalkable(s,currentMerchant);assert.ok(hidden);currentCrafter.x=hidden.x;currentCrafter.y=hidden.y;
  const listing=addBulkListing(s,currentMerchant,{itemKind:'wood',quantity:listingQuantity,unitPrice:price,requestId:'er4-wood'});
  const stock=resourceStock(s,currentCrafter);
  stock.food=900;stock.stone=900;stock.wood=CRAFT_TRAINING_RULES.wood;
  if(observe){
    const point=observeMarket(s,currentCrafter,market.marketId);
    const seller=live(s,merchantId);seller.x=point.x;seller.y=point.y;
    const buyer=live(s,crafterId),start=nearbyReachable(s,point);assert.ok(start,'reachable market start');
    buyer.x=start.x;buyer.y=start.y;buyer.task=null;
  }else{
    // Local productive need is visible, but no market observation is refreshed.
    const seller=live(s,merchantId),buyer=live(s,crafterId);buyer.x=seller.x;buyer.y=seller.y;buyer.task=null;
  }
  return {s,merchantId,crafterId,market,listingId:listing.listingId};
}

test('ER4 exposes only read-only procurement intents from an ER3 material shortage',()=>{
  const {s,crafterId}=setupBulkProcurement(),a=live(s,crafterId),before=serialize(s);
  const craft=demandDrivenCrafterSnapshot(s,a);
  assert.equal(craft.status,'NEEDS_MATERIALS');assert.equal(craft.reason,'reserve');assert.equal(craft.missing.wood,3);
  const snap=crafterMaterialProcurementSnapshot(s,a);
  assert.equal(ER4_MATERIAL_PROCUREMENT_VERSION,'ER4-material-procurement/1');
  assert.equal(snap.status,'SAT');assert.equal(snap.type,'TRAVEL_TO_MARKET');
  assert.equal(snap.itemKind,'wood');assert.equal(snap.quantity,3);
  assert.equal(snap.assetType,TRADE_ASSET_TYPES.BULK_RESOURCE);
  assert.deepEqual(snap.intent,{agentId:a.id,marketId:snap.marketId});
  assert.equal(serialize(s),before,'ER4 projection must not mutate world');
});

test('ER4 hidden and stale Listings cannot authorize procurement; corrupt roots remain UNKNOWN',()=>{
  {
    const {s,crafterId}=setupBulkProcurement({observe:false}),a=live(s,crafterId),before=serialize(s);
    const snap=crafterMaterialProcurementSnapshot(s,a);
    assert.equal(snap.status,'NEEDS_SUPPLY');assert.equal(snap.reason,'no-observed-listing');
    assert.equal(serialize(s),before);
  }
  {
    const {s,crafterId}=setupBulkProcurement(),a=live(s,crafterId);
    s.tick+=ECONOMIC_DEMAND_TTL_TICKS+1;
    const snap=crafterMaterialProcurementSnapshot(s,a);
    assert.notEqual(snap.type,'BUY_LISTING');assert.notEqual(snap.type,'TRAVEL_TO_MARKET');
  }
  {
    const {s,crafterId}=setupBulkProcurement(),a=live(s,crafterId);
    s.merchantListings={};
    const snap=crafterMaterialProcurementSnapshot(s,a);
    assert.equal(snap.status,'UNKNOWN');
  }
});

test('ER4 insufficient Wallet funds never creates credit or mutates market/material state',()=>{
  const {s,crafterId}=setupBulkProcurement({price:1000}),a=live(s,crafterId);
  const beforeWallet=JSON.stringify(s.currencyWallet),beforeListings=JSON.stringify(s.merchantListings),beforeMaterial=materialAmount(s,a,'wood');
  const snap=crafterMaterialProcurementSnapshot(s,a);
  assert.equal(snap.status,'NEEDS_FUNDS');assert.ok(snap.required>snap.balance);
  assert.equal(JSON.stringify(s.currencyWallet),beforeWallet);
  assert.equal(JSON.stringify(s.merchantListings),beforeListings);
  assert.equal(materialAmount(s,a,'wood'),beforeMaterial);
});

test('ER4 canonical partial bulk purchase transfers exactly current missing quantity and stale replay cannot double-charge',()=>{
  const {s,merchantId,crafterId,market,listingId}=setupBulkProcurement();
  let a=live(s,crafterId),m=live(s,merchantId);
  // Produce a zero-length canonical journey at the observed market so the purchase
  // proof is isolated from scheduler timing.
  const point=projectHomeMarketForTrade(s,s.homeMarkets,{marketId:market.marketId}).market;
  a.x=point.x;a.y=point.y;a.task=null;
  const travel=command(s,'RC4_TRAVEL_TO_MARKET',{agentId:a.id,marketId:market.marketId});assert.equal(travel.ok,true,JSON.stringify(travel));
  const decision=crafterMaterialProcurementDecision(s,a);
  assert.equal(decision.status,'SAT');assert.equal(decision.type,'BUY_LISTING');assert.equal(decision.quantity,3);

  const buyerMoney=getBalance(s,a.id),sellerMoney=getBalance(s,m.id),currency=totalCurrency(s);
  const buyerWood=materialAmount(s,a,'wood'),sellerWood=materialAmount(s,m,'wood');
  const listingBefore=s.merchantListings.listings.find(l=>l.id===listingId);assert.equal(listingBefore.quantity,10);
  const intent={...decision.intent};
  const bought=command(s,'RC4_BUY_LISTING',intent);assert.equal(bought.ok,true,JSON.stringify(bought));

  a=live(s,crafterId);m=live(s,merchantId);
  const listingAfter=s.merchantListings.listings.find(l=>l.id===listingId);
  assert.equal(bought.receipt.quantity,3);assert.equal(bought.receipt.assetType,TRADE_ASSET_TYPES.BULK_RESOURCE);
  assert.equal(listingAfter.quantity,7);assert.equal(listingAfter.revision,listingBefore.revision+1);assert.equal(listingAfter.status,'OPEN');
  assert.equal(materialAmount(s,a,'wood'),buyerWood+3);assert.equal(materialAmount(s,m,'wood'),sellerWood-3);
  assert.equal(getBalance(s,a.id),buyerMoney-3);assert.equal(getBalance(s,m.id),sellerMoney+3);assert.equal(totalCurrency(s),currency);
  assert.equal(s.rustPossessions.items.some(i=>i.kind==='wood'),false,'bulk purchase must not mint fake Rust items');

  const beforeReplay=serialize(s);
  const replay=command(s,'RC4_BUY_LISTING',intent);
  assert.equal(replay.ok,false);assert.equal(replay.reason,'listing-stale');
  assert.equal(serialize(s),beforeReplay,'stale exact replay cannot debit or transfer again');
  assert.equal(a.profession,'crafter');
  assert.deepEqual(validate(s),[]);
});

test('ER4 forged remote arrival is rejected and market closure during a real journey cancels procurement',()=>{
  {
    const {s,crafterId,listingId}=setupBulkProcurement(),a=live(s,crafterId),listing=s.merchantListings.listings.find(l=>l.id===listingId);
    const before=serialize(s);
    const remote=command(s,'RC4_BUY_LISTING',{buyerId:a.id,listingId,listingRevision:listing.revision,quantity:3});
    assert.equal(remote.ok,false);assert.equal(remote.reason,'canonical-task');
    assert.equal(serialize(s),before);
  }
  {
    const {s,merchantId,crafterId,market}=setupBulkProcurement(),a=live(s,crafterId);
    const d=crafterMaterialProcurementDecision(s,a);assert.equal(d.type,'TRAVEL_TO_MARKET');
    assert.equal(command(s,'RC4_TRAVEL_TO_MARKET',d.intent).ok,true);
    assert.ok(live(s,crafterId).task?.rc4MarketTravel);
    assert.equal(command(s,'RC4_CLOSE_MARKET',{agentId:merchantId,marketId:market.marketId}).ok,true);
    const next=crafterMaterialProcurementDecision(s,live(s,crafterId));
    assert.equal(next.status,'SAT');assert.equal(next.type,'CANCEL_TRAVEL');
  }
});

test('ER4 save/load during travel discards ephemeral arrival proof and replans canonical travel',()=>{
  const {s,crafterId}=setupBulkProcurement(),a=live(s,crafterId);
  const d=crafterMaterialProcurementDecision(s,a);assert.equal(d.type,'TRAVEL_TO_MARKET');
  assert.equal(command(s,'RC4_TRAVEL_TO_MARKET',d.intent).ok,true);
  assert.ok(live(s,crafterId).task?.rc4MarketTravel);
  const loaded=restore(serialize(s)),b=live(loaded,crafterId);
  assert.equal(b.task,null,'restore cannot retain WeakMap navigation authority');
  const replanned=crafterMaterialProcurementDecision(loaded,b);
  assert.equal(replanned.status,'SAT');assert.equal(replanned.type,'TRAVEL_TO_MARKET');
  assert.deepEqual(validate(loaded),[]);
});

test('ER4 autonomous observed Listing -> travel -> partial purchase -> ER3 craft creates real physical output',()=>{
  const {s,crafterId,listingId}=setupBulkProcurement();
  const startReceipts=s.tradeReplay.receipts.length;
  let purchase=null;
  for(let i=0;i<240&&!purchase;i++){
    step(s,1);
    purchase=s.tradeReplay.receipts.slice(startReceipts).find(r=>r.buyerId===crafterId&&r.itemKind==='wood')??null;
  }
  assert.ok(purchase,'Crafter must autonomously procure observed missing wood');
  assert.equal(purchase.quantity,3);
  assert.equal(s.merchantListings.listings.find(l=>l.id===listingId).quantity,7);

  let output=null;
  for(let i=0;i<320&&!output;i++){
    step(s,1);
    output=s.rustPossessions.items.find(item=>item.createdBy===crafterId&&item.kind==='STONE_PICKAXE'&&item.craft)??null;
  }
  assert.ok(output,'ER3 must resume through canonical CRAFT_ITEM after ER4 procurement');
  assert.equal(output.createdBy,crafterId);assert.equal(output.craft.recipeId,'STONE_PICKAXE');
  assert.equal(live(s,crafterId).profession,'crafter');
  assert.deepEqual(validate(s),[]);
});

test('ER4 buys an observed physical Rust ingredient then ER3 crafts the demanded product',()=>{
  const {s,merchant,crafter}=qualifiedCrafterFixture(),merchantId=merchant.id,crafterId=crafter.id;
  assert.equal(knowsCraftRecipe(s,crafter,'HIDE_ARMOR'),true,'home construction should canonically unlock HIDE_ARMOR');
  merchant.preference='FORAGE';crafter.preference='BUILD';
  const far=farWalkable(s,merchant);assert.ok(far);crafter.x=far.x;crafter.y=far.y;crafter.task=null;
  const market=setupMerchantMarket(s,merchant,{productDemand:'HIDE_ARMOR',productPrice:70});
  freeBagSlot(s,live(s,merchantId));

  // The exact HIDE is first owned by Crafter, then acquired by Merchant through
  // canonical Trade so Merchant Ledger has a purchase cost basis before resale.
  const supplier=live(s,crafterId);
  const loot=grantAdventureLoot(s,{agentId:crafterId,claimKey:'er4-hide-supply',items:[{itemKind:'HIDE',quantity:1,rarity:'COMMON'}]});
  assert.equal(loot.ok,true,JSON.stringify(loot));
  const hideId=loot.itemIds[0];
  merchantAcquirePhysicalBasis(s,{merchantId,supplierId:crafterId,marketId:market.marketId,itemId:hideId,itemKind:'HIDE',unitPrice:2});

  const currentMerchant=live(s,merchantId),currentCrafter=live(s,crafterId);
  const hidden=farWalkable(s,currentMerchant);assert.ok(hidden);currentCrafter.x=hidden.x;currentCrafter.y=hidden.y;currentCrafter.task=null;
  const listed=command(s,'RC4_CREATE_LISTING',{agentId:merchantId,itemId:hideId,unitPrice:5,requestId:'er4-hide'});
  assert.equal(listed.ok,true,JSON.stringify(listed));
  Object.assign(resourceStock(s,currentCrafter),{food:900,wood:900,stone:900});
  const point=observeMarket(s,currentCrafter,market.marketId);
  live(s,merchantId).x=point.x;live(s,merchantId).y=point.y;
  const buyer=live(s,crafterId),start=nearbyReachable(s,point);assert.ok(start);buyer.x=start.x;buyer.y=start.y;buyer.task=null;

  const initial=demandDrivenCrafterSnapshot(s,buyer);
  assert.equal(initial.status,'NEEDS_MATERIALS');assert.equal(initial.reason,'item-materials');assert.equal(initial.missing.HIDE,1);

  const startReceipts=s.tradeReplay.receipts.length;
  let purchase=null;
  for(let i=0;i<240&&!purchase;i++){
    step(s,1);
    purchase=s.tradeReplay.receipts.slice(startReceipts).find(r=>r.buyerId===crafterId&&r.itemKind==='HIDE')??null;
  }
  assert.ok(purchase);assert.equal(purchase.itemInstanceId,hideId);assert.equal(purchase.quantity,1);
  const ownedHide=s.rustPossessions.items.find(i=>i.id===hideId)??null;
  // ER3 may already have escrowed the HIDE into a craft order in the same tick.
  assert.ok(ownedHide?.location?.agentId===crafterId||
    s.rustPossessions.orders.some(o=>o.agentId===crafterId&&o.reservedItems?.some(r=>r.itemId===hideId)));

  let armor=null;
  for(let i=0;i<320&&!armor;i++){
    step(s,1);
    armor=s.rustPossessions.items.find(i=>i.createdBy===crafterId&&i.kind==='HIDE_ARMOR'&&i.craft)??null;
  }
  assert.ok(armor);assert.equal(armor.craft.recipeId,'HIDE_ARMOR');
  assert.deepEqual(validate(s),[]);
});

test('ER4 source remains deterministic policy-only with no second economic authority',()=>{
  const source=fs.readFileSync(new URL('../src/crafter-material-procurement.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Math\.random|\bDate\b|document\.|window\.|fetch\(/);
  assert.doesNotMatch(source,/\.items\.push|\.orders\.push|addMaterialSet|consumeMaterialSet|currencyWallet\s*=|merchantListings\s*=|merchantBuyOffers\s*=|\.balance\s*[+\-]?=|profession\s*=(?!=)|\.task\s*=/);
  for(const token of ['crafterInventory','workshopInventory','factoryInventory','crafterMaterials','workshopMaterials','productionMaterials','crafterWallet','workshopWallet','productionWallet'])
    assert.equal(source.includes(token),false,token);
  assert.equal(source.includes('RC4_CREATE_BUY_OFFER'),false);
  assert.equal(source.includes('RC4_CREATE_LISTING'),false);
});
