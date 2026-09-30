import test from 'node:test';
import assert from 'node:assert/strict';

import {createWorld,command,step,serialize,restore,validate,walkable,pathTo} from '../src/engine.mjs';
import {personalHomeSite} from '../src/individual-housing.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {getBalance,totalCurrency} from '../src/currency-wallet.mjs';
import {TRADE_ASSET_TYPES} from '../src/trade-assets.mjs';
import {CRAFT_RECIPE_CATALOG} from '../src/crafting-catalog.mjs';
import {CRAFT_TRAINING_RULES} from '../src/craft-training.mjs';
import {adoptProfession,noteExploreCompletion} from '../src/kingdom-utility.mjs';
import {recipeMastery} from '../src/craft-recipe-knowledge.mjs';
import {projectHomeMarketForTrade} from '../src/home-market.mjs';
import {observeRc4Markets} from '../src/rc4-market-observation.mjs';
import {projectActorObservedDemand} from '../src/economic-demand.mjs';
import {merchantAutonomySnapshot} from '../src/rc4-merchant-policy.mjs';
import {producerSurplusSnapshot} from '../src/raw-producer-autonomy.mjs';
import {RULES} from '../src/survival.mjs';
import {craftFixtureItem,craftFixtureTable,craftFixtureHome} from './fixtures/rc2-world.mjs';

const actor=(s,id)=>s.agents.find(a=>a.id===id);
const calm=(...agents)=>{for(const a of agents){a.hp=a.satiety=a.energy=100;a.task=null;a.moveTick=0;}};

function give(s,a,kind){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
}
function dropItem(s,a,item){
  s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>e.itemId!==item.id);
  item.location={kind:'drop',sourceAgentId:a.id,tick:s.tick,x:a.x,y:a.y};
}
function completeHomeFixture(s,a,label){
  const planned=personalHomeSite(s,a,walkable);assert.ok(planned,'home site');
  const {x,y}=planned.origin;a.x=x;a.y=y;a.task=null;
  const hammer=give(s,a,'HAMMER');
  assert.equal(command(s,'EQUIP_ITEM',{agentId:a.id,itemId:hammer}).ok,true);
  const place=(kind,socket)=>{
    const id=give(s,a,kind);
    const r=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'er6-final-home:'+label+':'+id});
    assert.equal(r.ok,true,JSON.stringify(r));
  };
  place('WOOD_FOUNDATION',{type:'cell',x,y});
  place('WOOD_WALL',canonicalEdge(x,y,'N'));
  place('WOOD_WALL',canonicalEdge(x,y,'E'));
  place('WOOD_WALL',canonicalEdge(x,y,'W'));
  place('WOOD_DOORWAY',canonicalEdge(x,y,'S'));
  place('WOOD_ROOF',{type:'cell',x,y});
}
function prepareMerchant(s,id){
  let a=actor(s,id);
  a.preference='WOODCUT';Object.assign(resourceStock(s,a),{food:500,wood:50,stone:500});
  completeHomeFixture(s,a,'merchant');
  const axe=give(s,a,'STONE_AXE');assert.equal(command(s,'EQUIP_ITEM',{agentId:id,itemId:axe}).ok,true);
  calm(a);
  const market=command(s,'RC4_CREATE_MARKET',{agentId:id});assert.equal(market.ok,true,JSON.stringify(market));
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  assert.equal(command(s,'RC4_OPEN_MARKET',{agentId:id,marketId:market.marketId}).ok,true);
  return market.marketId;
}
function qualifyAdventurer(s,id){
  let a=actor(s,id);
  for(let i=0;i<3;i++){
    s.tick++;
    const r=noteExploreCompletion(a,{kind:'EXPLORE',tick:s.tick,x:a.x,y:a.y,started:s.tick,alive:true,productive:true,knowledge:'none'});
    assert.equal(r.counted,true);
  }
  assert.equal(a.profession,'adventurer');
  a.preference='MINE';
  const pick=give(s,a,'STONE_PICKAXE');assert.equal(command(s,'EQUIP_ITEM',{agentId:id,itemId:pick}).ok,true);
  calm(a);
}
function normalizeCrafterBag(s,id){
  const a=actor(s,id);
  s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>e.agentId!==id);
  const bag=s.rustPossessions.items.filter(i=>i.location?.kind==='bag'&&i.location.agentId===id).sort((x,y)=>x.id-y.id);
  let hammer=bag.find(i=>i.kind==='HAMMER')??null;
  if(!hammer)hammer=s.rustPossessions.items.find(i=>i.id===give(s,a,'HAMMER'));
  for(const item of s.rustPossessions.items.filter(i=>i.location?.kind==='bag'&&i.location.agentId===id))
    if(item.id!==hammer.id)dropItem(s,a,item);
  assert.equal(command(s,'EQUIP_ITEM',{agentId:id,itemId:hammer.id}).ok,true);
}
function prepareCrafter(s,id){
  let a=actor(s,id);a.preference='BUILD';
  Object.assign(resourceStock(s,a),{food:900,wood:900,stone:900,ironIngot:120,steelIngot:90});
  assert.equal(adoptProfession(a,'BUILD',s.tick).changed,true);
  craftFixtureTable(s,a);craftFixtureHome(s,a);
  craftFixtureItem(s,a,'HAMMER');
  craftFixtureItem(s,a,'HAMMER_T2');
  craftFixtureItem(s,a,'HAMMER');
  craftFixtureItem(s,a,'HAMMER_T2');
  craftFixtureItem(s,a,'HAMMER');
  assert.equal(recipeMastery(a,'HAMMER'),4);
  assert.equal(recipeMastery(a,'HAMMER_T2'),2);
  const promoted=command(s,'RC5_BECOME_CRAFTER',{agentId:id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  normalizeCrafterBag(s,id);
  for(let i=0;i<2;i++){
    const item=craftFixtureItem(s,actor(s,id),'STONE_AXE');
    dropItem(s,actor(s,id),item);
  }
  normalizeCrafterBag(s,id);
  a=actor(s,id);
  give(s,a,'FIRE_CORE');give(s,a,'EMBER_SHARD');give(s,a,'HIDE');
  assert.equal(s.rustPossessions.items.filter(i=>i.location?.kind==='bag'&&i.location.agentId===id).length,4);
  calm(a);
}
function marketPoint(s,marketId){
  const p=projectHomeMarketForTrade(s,s.homeMarkets,{marketId});assert.equal(p.ok,true,JSON.stringify(p));return p.market;
}
function moveFixtureToMarket(s,id,marketId){
  const p=marketPoint(s,marketId),a=actor(s,id);
  a.x=p.x;a.y=p.y;a.task=null;a.moveTick=0;observeRc4Markets(s);
  const travel=command(s,'RC4_TRAVEL_TO_MARKET',{agentId:id,marketId});
  assert.equal(travel.ok,true,JSON.stringify(travel));
  assert.equal(actor(s,id).task.path.length,0);
}
function clearFixtureTravel(s,id){
  const a=actor(s,id);
  if(a.task?.rc4MarketTravel){
    const r=command(s,'RC4_CANCEL_MARKET_TRAVEL',{agentId:id});
    assert.equal(r.ok,true,JSON.stringify(r));
  }
}
function physicalPriceCalibration(s,{sellerId,merchantId,buyerId,marketId,itemKind,bid=1,ask=1,label}){
  const seller=actor(s,sellerId),itemId=give(s,seller,itemKind);
  moveFixtureToMarket(s,sellerId,marketId);
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchantId,itemKind,unitPrice:bid});
  assert.equal(offer.ok,true,JSON.stringify(offer));
  observeRc4Markets(s);
  const accepted=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:sellerId,offerId:offer.offerId,itemId});
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  clearFixtureTravel(s,sellerId);
  moveFixtureToMarket(s,merchantId,marketId);
  const procurement=s.merchantListings.listings.find(l=>l.id===accepted.listingId);assert.ok(procurement);
  const bought=command(s,'RC4_BUY_LISTING',{buyerId:merchantId,listingId:procurement.id,listingRevision:procurement.revision});
  assert.equal(bought.ok,true,JSON.stringify(bought));
  const listed=command(s,'RC4_CREATE_LISTING',{agentId:merchantId,itemId,unitPrice:ask,requestId:'er6-final-price-'+label});
  assert.equal(listed.ok,true,JSON.stringify(listed));
  moveFixtureToMarket(s,buyerId,marketId);
  const liveListing=s.merchantListings.listings.find(l=>l.id===listed.listingId);assert.ok(liveListing);
  const sale=command(s,'RC4_BUY_LISTING',{buyerId,listingId:liveListing.id,listingRevision:liveListing.revision});
  assert.equal(sale.ok,true,JSON.stringify(sale));
  assert.equal(command(s,'EQUIP_ITEM',{agentId:buyerId,itemId}).ok,true);
  clearFixtureTravel(s,buyerId);
  return itemId;
}
function placeNear(s,id,p,min=1,max=5){
  const a=actor(s,id);
  for(let r=min;r<=max;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    if(Math.abs(dx)+Math.abs(dy)!==r)continue;
    const x=p.x+dx,y=p.y+dy;if(!walkable(s,x,y))continue;
    a.x=x;a.y=y;a.task=null;a.moveTick=0;return {x,y};
  }
  throw new Error('nearby walkable cell');
}
function placeFar(s,id,p,min=18){
  const a=actor(s,id);
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){
    if(Math.abs(x-p.x)+Math.abs(y-p.y)<min||!walkable(s,x,y))continue;
    a.x=x;a.y=y;a.task=null;a.moveTick=0;return {x,y};
  }
  throw new Error('far walkable cell');
}
function bootstrapWoodPrice(s,{producerId,merchantId,crafterId,marketId}){
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{
    agentId:merchantId,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,itemKind:'wood',quantityWanted:1,unitPrice:4
  });assert.equal(offer.ok,true,JSON.stringify(offer));
  moveFixtureToMarket(s,producerId,marketId);observeRc4Markets(s);
  const accepted=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId,offerId:offer.offerId,quantity:1});
  assert.equal(accepted.ok,true,JSON.stringify(accepted));clearFixtureTravel(s,producerId);
  moveFixtureToMarket(s,merchantId,marketId);
  const procurement=s.merchantListings.listings.find(l=>l.id===accepted.listingId);assert.ok(procurement);
  const bought=command(s,'RC4_BUY_LISTING',{buyerId:merchantId,listingId:procurement.id,listingRevision:procurement.revision,quantity:1});
  assert.equal(bought.ok,true,JSON.stringify(bought));
  const resale=command(s,'RC4_CREATE_LISTING',{
    agentId:merchantId,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,itemKind:'wood',quantity:1,unitPrice:5,requestId:'er6-final-wood-price'
  });assert.equal(resale.ok,true,JSON.stringify(resale));
  moveFixtureToMarket(s,crafterId,marketId);observeRc4Markets(s);
  const listing=s.merchantListings.listings.find(l=>l.id===resale.listingId);assert.ok(listing);
  const purchased=command(s,'RC4_BUY_LISTING',{buyerId:crafterId,listingId:listing.id,listingRevision:listing.revision,quantity:1});
  assert.equal(purchased.ok,true,JSON.stringify(purchased));clearFixtureTravel(s,crafterId);
}
function equippedKind(s,id,slot){
  const e=s.rustPossessions.equipment.find(x=>x.agentId===id&&(x.slot??'hand')===slot);
  return e?s.rustPossessions.items.find(i=>i.id===e.itemId)?.kind??null:null;
}
function newReceipt(s,startTx,pred){
  return s.tradeReplay.receipts.find(r=>!startTx.has(r.transactionId)&&pred(r))??null;
}
function craftedBy(s,id,kind){
  return s.rustPossessions.items.filter(i=>i.createdBy===id&&i.kind===kind&&i.craft).sort((a,b)=>a.id-b.id);
}

function setupClosedLoop(){
  const s=createWorld(926006,{mode:'independent',worldProfile:'same-world',population:4});
  const merchantId=s.agents[0].id,crafterId=s.agents[1].id,consumerId=s.agents[2].id,producerId=s.agents[3].id;
  const producer=actor(s,producerId);producer.preference='WOODCUT';Object.assign(resourceStock(s,producer),{food:500,wood:500,stone:500});
  assert.equal(adoptProfession(producer,'WOODCUT',s.tick).profession,'woodcutter');
  const producerAxe=give(s,producer,'STONE_AXE');assert.equal(command(s,'EQUIP_ITEM',{agentId:producerId,itemId:producerAxe}).ok,true);

  const marketId=prepareMerchant(s,merchantId);
  qualifyAdventurer(s,consumerId);
  const calibrationBladeId=physicalPriceCalibration(s,{sellerId:producerId,merchantId,buyerId:consumerId,marketId,itemKind:'EMBER_BLADE',label:'blade'});
  const calibrationArmorId=physicalPriceCalibration(s,{sellerId:producerId,merchantId,buyerId:consumerId,marketId,itemKind:'HIDE_ARMOR',label:'armor'});
  assert.equal(equippedKind(s,consumerId,'WEAPON'),'EMBER_BLADE');
  assert.equal(equippedKind(s,consumerId,'ARMOR'),'HIDE_ARMOR');
  dropItem(s,actor(s,consumerId),s.rustPossessions.items.find(i=>i.id===calibrationBladeId));
  dropItem(s,actor(s,consumerId),s.rustPossessions.items.find(i=>i.id===calibrationArmorId));

  prepareCrafter(s,crafterId);
  const blade=CRAFT_RECIPE_CATALOG.EMBER_BLADE;
  const firstWoodNeed=(blade.materials?.wood??0)+CRAFT_TRAINING_RULES.wood;
  Object.assign(resourceStock(s,actor(s,crafterId)),{food:900,wood:firstWoodNeed-2,stone:900});
  const p=marketPoint(s,marketId);
  actor(s,merchantId).x=p.x;actor(s,merchantId).y=p.y;calm(actor(s,merchantId));
  placeNear(s,crafterId,p,1,2);placeNear(s,consumerId,p,1,2);placeNear(s,producerId,p,3,5);
  observeRc4Markets(s);

  bootstrapWoodPrice(s,{producerId,merchantId,crafterId,marketId});
  assert.equal(resourceStock(s,actor(s,crafterId)).wood,firstWoodNeed-1,'bootstrap leaves exactly one missing wood');
  const producerReserve=producerSurplusSnapshot(s,actor(s,producerId),'wood');
  assert.equal(producerReserve.status,'SAT',JSON.stringify(producerReserve));
  resourceStock(s,actor(s,producerId)).wood=producerReserve.protectedReserve;
  actor(s,merchantId).x=p.x;actor(s,merchantId).y=p.y;calm(actor(s,merchantId));
  placeNear(s,crafterId,p,1,2);placeNear(s,consumerId,p,1,2);placeNear(s,producerId,p,3,5);
  calm(actor(s,producerId),actor(s,crafterId),actor(s,consumerId),actor(s,merchantId));
  observeRc4Markets(s);
  assert.deepEqual(validate(s),[]);

  const initialMerchant=merchantAutonomySnapshot(s,actor(s,merchantId));
  assert.equal(initialMerchant.status,'SAT',JSON.stringify(initialMerchant));
  assert.equal(initialMerchant.type,'CREATE_BUY_OFFER',JSON.stringify(initialMerchant));
  assert.equal(initialMerchant.itemKind,'wood','material brokerage must precede finished-goods procurement');
  return {s,merchantId,crafterId,consumerId,producerId,marketId,firstWoodNeed,producerReserve:producerReserve.protectedReserve};
}

test('ER6 final assembled four-role loop closes two autonomous cycles with conservation, save/load and long-horizon stability',()=>{
  const f=setupClosedLoop();let s=f.s;
  const startTick=s.tick,startCurrency=totalCurrency(s),startTx=new Set(s.tradeReplay.receipts.map(r=>r.transactionId));
  const startProducerWork=actor(s,f.producerId).workDone;
  const checkpoints=new Set();

  // START: no fixture mutation or player trade command occurs below this line.
  s=restore(serialize(s));checkpoints.add('before-material-procurement');
  let firstConsumerReceipt=null,secondConsumerReceipt=null,firstProducerReceipt=null,firstCrafterReceipt=null;
  let firstBladeId=null,secondCycleStarted=false;
  for(let i=0;i<2400&&!secondConsumerReceipt;i++){
    step(s,1);

    const d=actor(s,f.consumerId);
    if(!firstConsumerReceipt){
      assert.equal(!!d.task?.adventureHunt,false,'Adventurer must not hunt while required gear is unresolved');
      assert.equal(!!d.adventureEncounter,false,'Adventurer readiness need must outrank autonomous encounter');
    }

    const postStartWoodOffer=s.merchantBuyOffers.buyOffers.find(o=>o.buyerId===f.merchantId&&o.itemKind==='wood'&&o.createdTick>startTick);
    if(postStartWoodOffer&&!checkpoints.has('after-buy-offer')){
      s=restore(serialize(s));checkpoints.add('after-buy-offer');continue;
    }
    const producer=actor(s,f.producerId);
    if(producer.task?.rc4MarketTravel&&producer.task.path.length>0&&!checkpoints.has('during-canonical-travel')){
      s=restore(serialize(s));checkpoints.add('during-canonical-travel');continue;
    }

    firstProducerReceipt??=newReceipt(s,startTx,r=>r.sellerId===f.producerId&&r.buyerId===f.merchantId&&r.itemKind==='wood');
    if(firstProducerReceipt&&!checkpoints.has('after-resource-settlement')){
      s=restore(serialize(s));checkpoints.add('after-resource-settlement');continue;
    }

    const blades=craftedBy(s,f.crafterId,'EMBER_BLADE');
    if(blades.length&&!firstBladeId)firstBladeId=blades[0].id;
    if(firstBladeId&&!checkpoints.has('after-craft-completion')){
      s=restore(serialize(s));checkpoints.add('after-craft-completion');continue;
    }

    firstCrafterReceipt??=newReceipt(s,startTx,r=>r.sellerId===f.crafterId&&r.buyerId===f.merchantId&&r.itemKind==='EMBER_BLADE'&&r.itemIds?.includes(firstBladeId));
    if(firstCrafterReceipt&&!checkpoints.has('after-merchant-purchase')){
      s=restore(serialize(s));checkpoints.add('after-merchant-purchase');continue;
    }

    const resale=s.merchantListings.listings.find(l=>l.sellerId===f.merchantId&&l.itemKind==='EMBER_BLADE'&&l.itemInstanceId===firstBladeId&&l.status==='OPEN');
    if(resale&&!checkpoints.has('after-listing-creation')){
      s=restore(serialize(s));checkpoints.add('after-listing-creation');continue;
    }

    firstConsumerReceipt??=newReceipt(s,startTx,r=>r.sellerId===f.merchantId&&r.buyerId===f.consumerId&&r.itemKind==='EMBER_BLADE'&&r.itemIds?.includes(firstBladeId));
    if(firstConsumerReceipt&&!checkpoints.has('after-consumer-purchase')){
      s=restore(serialize(s));checkpoints.add('after-consumer-purchase');continue;
    }

    if(firstConsumerReceipt&&equippedKind(s,f.consumerId,'WEAPON')==='EMBER_BLADE'&&!secondCycleStarted){
      const demand=projectActorObservedDemand(s,actor(s,f.consumerId));
      const armor=demand.signals.find(x=>x.itemKind==='HIDE_ARMOR'&&x.sources.some(src=>src.kind==='PERSONAL_ITEM_NEED'&&src.subjectAgentId===f.consumerId));
      assert.ok(armor,'fulfilled WEAPON need must expose the remaining ARMOR need');
      secondCycleStarted=true;
    }
    if(secondCycleStarted){
      secondConsumerReceipt??=newReceipt(s,startTx,r=>r.sellerId===f.merchantId&&r.buyerId===f.consumerId&&r.itemKind==='HIDE_ARMOR');
    }
  }

  assert.deepEqual([...checkpoints].sort(),[
    'after-buy-offer','after-consumer-purchase','after-craft-completion','after-listing-creation',
    'after-merchant-purchase','after-resource-settlement','before-material-procurement','during-canonical-travel'
  ].sort());
  assert.ok(firstProducerReceipt,'Producer-origin raw material must settle to Merchant after START');
  assert.ok(firstCrafterReceipt,'Crafter exact physical output must settle to Merchant');
  assert.ok(firstConsumerReceipt,'Consumer must buy the exact first-cycle item');
  assert.ok(secondCycleStarted,'second economic cycle must begin from remaining released need');
  assert.ok(secondConsumerReceipt,'second economic cycle must complete through canonical resale');
  assert.equal(equippedKind(s,f.consumerId,'WEAPON'),'EMBER_BLADE');
  assert.equal(equippedKind(s,f.consumerId,'ARMOR'),'HIDE_ARMOR');
  assert.equal(s.rustPossessions.items.filter(i=>i.id===firstBladeId).length,1,'exact first-cycle item cannot duplicate');
  assert.equal(s.rustPossessions.items.find(i=>i.id===firstBladeId)?.location?.agentId,f.consumerId);
  assert.equal(totalCurrency(s),startCurrency,'currency is conserved across both cycles');
  assert.ok(actor(s,f.producerId).workDone>startProducerWork,'Producer must gather canonical wood after START');
  const reserve=producerSurplusSnapshot(s,actor(s,f.producerId),'wood');
  assert.equal(reserve.status,'SAT');assert.ok(reserve.owned>=reserve.protectedReserve);assert.equal(reserve.protectedReserve,f.producerReserve);

  const txIds=s.tradeReplay.receipts.map(r=>r.transactionId);
  assert.equal(new Set(txIds).size,txIds.length,'trade replay ids remain unique');
  assert.deepEqual(validate(s),[]);

  // Deterministic unattended continuation from the exact same canonical state.
  const stableWire=serialize(s),left=restore(stableWire),right=restore(stableWire);
  step(left,360);step(right,360);
  assert.equal(serialize(left),serialize(right),'long-horizon continuation must be deterministic');
  s=left;
  step(s,900);
  const bladeCountA=craftedBy(s,f.crafterId,'EMBER_BLADE').length,armorCountA=craftedBy(s,f.crafterId,'HIDE_ARMOR').length,receiptsA=s.tradeReplay.receipts.length;
  step(s,360);
  assert.equal(craftedBy(s,f.crafterId,'EMBER_BLADE').length,bladeCountA,'no unbounded weapon overproduction');
  assert.equal(craftedBy(s,f.crafterId,'HIDE_ARMOR').length,armorCountA,'no unbounded armor overproduction');
  assert.equal(s.tradeReplay.receipts.length,receiptsA,'settled economy becomes quiescent after historical demand expires');
  assert.ok(s.merchantListings.listings.filter(l=>l.sellerId===f.merchantId&&l.itemKind==='EMBER_BLADE'&&l.status==='OPEN').length<=1);
  assert.ok(s.merchantListings.listings.filter(l=>l.sellerId===f.merchantId&&l.itemKind==='HIDE_ARMOR'&&l.status==='OPEN').length<=1);
  assert.ok(s.merchantBuyOffers.buyOffers.filter(o=>o.buyerId===f.merchantId&&o.status==='OPEN').length<=2);
  assert.equal(totalCurrency(s),startCurrency);
  assert.deepEqual(validate(s),[]);
});
