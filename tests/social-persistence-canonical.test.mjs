import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {createWorld,command,step,serialize,restore,validate} from '../src/engine.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {materialAmount} from '../src/material-economy.mjs';
import {getBalance,totalCurrency} from '../src/currency-wallet.mjs';
import {recipeMastery} from '../src/craft-recipe-knowledge.mjs';
import {TRADE_ASSET_TYPES} from '../src/trade-assets.mjs';
import {observeRc4Markets} from '../src/rc4-market-observation.mjs';
import {projectHomeMarketForTrade} from '../src/home-market.mjs';
import {rawProducerDecision} from '../src/raw-producer-autonomy.mjs';
import {crafterMaterialProcurementDecision} from '../src/crafter-material-procurement.mjs';
import {demandDrivenCrafterSnapshot,demandDrivenCrafterIntent} from '../src/demand-driven-crafter.mjs';
import {craftFixtureTable,craftFixtureHome,craftFixtureItem} from './fixtures/rc2-world.mjs';
import {
  SOCIAL_PERSISTENCE_VERSION,projectPersistentSocialGroups,persistentSocialCandidateOrder,persistenceRetention
} from '../research/social-persistence.mjs';

const live=(s,id)=>s.agents.find(a=>a.id===id&&a.alive);

function setProfession(a,profession,preference){
  a.profession=profession;a.preference=preference;a.professionSinceTick=0;a.career=[{tick:0,profession}];
}
function freeBagSlot(s,a){
  const equipped=new Set((s.rustPossessions.equipment??[]).filter(e=>e.agentId===a.id).map(e=>e.itemId));
  const item=s.rustPossessions.items
    .filter(i=>i.location?.kind==='bag'&&i.location.agentId===a.id&&!equipped.has(i.id))
    .sort((x,y)=>x.id-y.id)[0];
  assert.ok(item,'fixture needs a free physical output slot');
  item.location={kind:'drop',sourceAgentId:a.id,tick:s.tick,x:a.x,y:a.y};
}
function qualifyCrafter(s,a){
  Object.assign(resourceStock(s,a),{food:900,wood:900,stone:900,ironOre:120,ironIngot:120,steelIngot:90});
  a.hp=a.satiety=a.energy=100;a.task=null;
  assert.equal(adoptProfession(a,'BUILD',s.tick).changed,true);
  craftFixtureTable(s,a);
  craftFixtureHome(s,a);
  craftFixtureItem(s,a,'HAMMER');
  craftFixtureItem(s,a,'HAMMER_T2');
  craftFixtureItem(s,a,'HAMMER');
  craftFixtureItem(s,a,'HAMMER_T2');
  craftFixtureItem(s,a,'HAMMER');
  assert.equal(recipeMastery(a,'HAMMER'),4);
  assert.equal(recipeMastery(a,'HAMMER_T2'),2);
  const promoted=command(s,'RC5_BECOME_CRAFTER',{agentId:a.id});
  assert.equal(promoted.ok,true,JSON.stringify(promoted));
  assert.equal(a.profession,'crafter');
  freeBagSlot(s,a);
}
function seededOrder(ids,seed){
  let x=seed>>>0;
  const next=()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296;};
  const a=[...ids];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function arriveAtMarket(s,agentId,market){
  const a=live(s,agentId);a.x=market.x;a.y=market.y;a.task=null;
  observeRc4Markets(s);
  const r=command(s,'RC4_TRAVEL_TO_MARKET',{agentId,marketId:market.marketId});
  assert.equal(r.ok,true,JSON.stringify(r));
  assert.ok(live(s,agentId).task?.rc4MarketTravel);
  assert.equal(live(s,agentId).task.path.length,0);
}
function setupCanonicalResearchWorld(){
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:6});
  for(const a of s.agents){a.task=null;a.hp=a.satiety=a.energy=100;}
  const merchant=s.agents[0],crafter=s.agents[1],producers=s.agents.slice(2,6);
  Object.assign(resourceStock(s,merchant),{food:900,wood:900,stone:900,ironOre:120,ironIngot:120,steelIngot:90});
  merchant.hp=merchant.satiety=merchant.energy=100;merchant.task=null;
  craftFixtureTable(s,merchant);
  craftFixtureHome(s,merchant);
  qualifyCrafter(s,crafter);

  const marketMade=command(s,'RC4_CREATE_MARKET',{agentId:merchant.id});assert.equal(marketMade.ok,true,JSON.stringify(marketMade));
  const productOffer=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,itemKind:'STONE_PICKAXE',unitPrice:70});
  assert.equal(productOffer.ok,true,JSON.stringify(productOffer));
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:merchant.id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  assert.equal(command(s,'RC4_OPEN_MARKET',{agentId:merchant.id,marketId:marketMade.marketId}).ok,true);
  const bulkOffer=command(s,'RC4_CREATE_BUY_OFFER',{
    agentId:merchant.id,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,itemKind:'wood',quantityWanted:8,unitPrice:1
  });
  assert.equal(bulkOffer.ok,true,JSON.stringify(bulkOffer));
  const projected=projectHomeMarketForTrade(s,s.homeMarkets,{marketId:marketMade.marketId});assert.equal(projected.ok,true,JSON.stringify(projected));
  const market={...projected.market,marketId:marketMade.marketId};

  setProfession(producers[0],'miner','FORAGE');
  setProfession(producers[1],'woodcutter','FORAGE');
  setProfession(producers[2],'miner','FORAGE');
  setProfession(producers[3],'woodcutter','FORAGE');
  merchant.preference='FORAGE';
  Object.assign(resourceStock(s,producers[0]),{wood:0,stone:900,ironOre:120});
  Object.assign(resourceStock(s,producers[1]),{wood:0,stone:0});
  Object.assign(resourceStock(s,producers[2]),{wood:0,stone:900,ironOre:120});
  Object.assign(resourceStock(s,producers[3]),{wood:900,stone:0});

  resourceStock(s,crafter).wood=0;
  resourceStock(s,crafter).stone=900;
  crafter.preference='BUILD';

  arriveAtMarket(s,merchant.id,market);
  for(const p of producers)arriveAtMarket(s,p.id,market);
  const currentCrafter=live(s,crafter.id);
  currentCrafter.x=market.x;currentCrafter.y=market.y;currentCrafter.task=null;
  observeRc4Markets(s);

  const snap=demandDrivenCrafterSnapshot(s,currentCrafter);
  assert.equal(snap.status,'NEEDS_MATERIALS',JSON.stringify(snap));
  assert.equal(snap.recipeId,'STONE_PICKAXE');
  assert.ok((snap.missing?.wood??0)>0);
  assert.deepEqual(validate(s),[]);
  return {s,merchantId:merchant.id,crafterId:crafter.id,producerIds:producers.map(p=>p.id),market,bulkOfferId:bulkOffer.offerId};
}
function findAcceptableProducer(s,order){
  let probes=0;
  for(const id of order){
    probes++;
    const d=rawProducerDecision(s,live(s,id));
    if(d.status==='SAT'&&d.type==='ACCEPT_BUY_OFFER')return {id,decision:d,probes};
  }
  return null;
}
function runCanonicalChain(){
  const {s,merchantId,crafterId,producerIds,market}=setupCanonicalResearchWorld();
  const beforeProjection=serialize(s);

  const social=projectPersistentSocialGroups(s.agents.map(a=>a.id),{
    seed:230926,tick:s.tick,groupSize:3,epochTicks:120,turnoverDivisor:4
  });
  assert.equal(social.status,'SAT');
  const socialOrder=persistentSocialCandidateOrder(social,crafterId,producerIds,{fallback:true,tieSeed:1901});
  assert.equal(socialOrder.status,'SAT');
  const normalOrder=seededOrder(producerIds,1901);

  const socialPick=findAcceptableProducer(s,socialOrder.candidates);
  const normalPick=findAcceptableProducer(s,normalOrder);
  assert.ok(socialPick,'persistent grouping must eventually find a canonically valid producer');
  assert.ok(normalPick,'control search must eventually find a canonically valid producer');
  assert.equal(socialPick.id,normalPick.id,'candidate order may change discovery cost, never supplier validity');
  assert.equal(serialize(s),beforeProjection,'social projection + raw-producer decisions are read-only');

  const supplierId=socialPick.id,supplierBefore=materialAmount(s,live(s,supplierId),'wood');
  const merchantBefore=materialAmount(s,live(s,merchantId),'wood'),moneyBefore=totalCurrency(s);
  const accepted=command(s,'RC4_ACCEPT_BUY_OFFER',{
    producerId:supplierId,offerId:socialPick.decision.offerId,quantity:socialPick.decision.quantity
  });
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  const procurement=s.merchantListings.listings.find(l=>l.id===accepted.listingId);assert.ok(procurement);

  const merchantTravel=live(s,merchantId).task?.rc4MarketTravel;
  assert.ok(merchantTravel&&merchantTravel.marketId===market.marketId);
  const merchantBuy=command(s,'RC4_BUY_LISTING',{
    buyerId:merchantId,listingId:procurement.id,listingRevision:procurement.revision
  });
  assert.equal(merchantBuy.ok,true,JSON.stringify(merchantBuy));
  assert.equal(materialAmount(s,live(s,supplierId),'wood'),supplierBefore-socialPick.decision.quantity);
  assert.equal(materialAmount(s,live(s,merchantId),'wood'),merchantBefore+socialPick.decision.quantity);
  assert.equal(totalCurrency(s),moneyBefore);

  const sale=command(s,'RC4_CREATE_LISTING',{
    agentId:merchantId,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,itemKind:'wood',
    quantity:3,unitPrice:2,requestId:'fa-r3-persistence-canonical'
  });
  assert.equal(sale.ok,true,JSON.stringify(sale));
  const listing=s.merchantListings.listings.find(l=>l.id===sale.listingId);assert.ok(listing);

  observeRc4Markets(s);
  const crafter=live(s,crafterId);
  const travelIntent=crafterMaterialProcurementDecision(s,crafter);
  assert.equal(travelIntent.status,'SAT',JSON.stringify(travelIntent));
  assert.equal(travelIntent.type,'TRAVEL_TO_MARKET',JSON.stringify(travelIntent));
  const travel=command(s,'RC4_TRAVEL_TO_MARKET',{agentId:crafterId,marketId:travelIntent.marketId});
  assert.equal(travel.ok,true,JSON.stringify(travel));
  const procure=crafterMaterialProcurementDecision(s,live(s,crafterId));
  assert.equal(procure.status,'SAT',JSON.stringify(procure));
  assert.equal(procure.type,'BUY_LISTING',JSON.stringify(procure));
  assert.equal(procure.itemKind,'wood');
  const crafterMoneyBefore=getBalance(s,crafterId),merchantMoneyBefore=getBalance(s,merchantId);
  const crafterBuy=command(s,'RC4_BUY_LISTING',procure.intent);
  assert.equal(crafterBuy.ok,true,JSON.stringify(crafterBuy));
  assert.equal(crafterBuy.receipt.sellerId,merchantId);
  assert.equal(crafterBuy.receipt.buyerId,crafterId);
  assert.equal(crafterBuy.receipt.itemKind,'wood');
  assert.equal(getBalance(s,crafterId),crafterMoneyBefore-crafterBuy.receipt.totalPrice);
  assert.equal(getBalance(s,merchantId),merchantMoneyBefore+crafterBuy.receipt.totalPrice);
  assert.equal(totalCurrency(s),moneyBefore);

  const ready=demandDrivenCrafterSnapshot(s,live(s,crafterId));
  assert.equal(ready.status,'READY_CRAFT',JSON.stringify(ready));
  const intent=demandDrivenCrafterIntent(s,live(s,crafterId));
  assert.deepEqual(intent,{agentId:crafterId,recipeId:'STONE_PICKAXE'});
  const craft=command(s,'CRAFT_ITEM',intent);assert.equal(craft.ok,true,JSON.stringify(craft));
  let output=null;
  for(let i=0;i<320&&!output;i++){
    step(s,1);
    output=s.rustPossessions.items.find(x=>x.createdBy===crafterId&&x.kind==='STONE_PICKAXE'&&x.craft)??null;
  }
  assert.ok(output,'canonical Crafter must consume procured material and produce a physical item');
  assert.equal(output.craft.recipeId,'STONE_PICKAXE');

  const receipts=s.tradeReplay.receipts.filter(r=>r.itemKind==='wood');
  const producerReceipt=receipts.find(r=>r.sellerId===supplierId&&r.buyerId===merchantId);
  const crafterReceipt=receipts.find(r=>r.sellerId===merchantId&&r.buyerId===crafterId);
  assert.ok(producerReceipt,'resource provenance must include Producer -> Merchant receipt');
  assert.ok(crafterReceipt,'resource provenance must include Merchant -> Crafter receipt');
  assert.deepEqual(validate(s),[]);

  const wire=serialize(s),loaded=restore(wire);
  assert.equal(serialize(loaded),wire,'canonical chain must save/load byte-stably');
  assert.deepEqual(validate(loaded),[]);

  return {
    socialProbeCount:socialPick.probes,
    controlProbeCount:normalPick.probes,
    supplierId,crafterId,merchantId,
    producerTransactionId:producerReceipt.transactionId,
    crafterTransactionId:crafterReceipt.transactionId,
    outputId:output.id
  };
}

test('FA-R3 persistent grouping is deterministic, bounded-turnover and read-only',()=>{
  assert.equal(SOCIAL_PERSISTENCE_VERSION,'FA-R3-social-persistence/1');
  const ids=Array.from({length:64},(_,i)=>i+1);
  const a=projectPersistentSocialGroups(ids,{seed:230926,tick:0,groupSize:8,epochTicks:120,turnoverDivisor:4});
  const b=projectPersistentSocialGroups(ids,{seed:230926,tick:0,groupSize:8,epochTicks:120,turnoverDivisor:4});
  const next=projectPersistentSocialGroups(ids,{seed:230926,tick:120,groupSize:8,epochTicks:120,turnoverDivisor:4});
  assert.deepEqual(a,b);
  assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.groups[0]));
  const retention=persistenceRetention(a,next);
  assert.equal(retention.status,'SAT');
  assert.equal(retention.agentRetention,0.75,'one of four deterministic cohorts turns over each epoch');
  assert.ok(retention.pairRetention>0&&retention.pairRetention<1);
  const ordered=persistentSocialCandidateOrder(a,1,[2,3,4,5,6],{fallback:true,tieSeed:77});
  assert.equal(ordered.status,'SAT');
  assert.deepEqual(new Set(ordered.candidates),new Set([2,3,4,5,6]));
});

test('FA-R3 persistence candidate selection stays read-only and canonical Producer -> Merchant -> Crafter -> physical craft closes',()=>{
  const result=runCanonicalChain();
  assert.ok(result.socialProbeCount>=1&&result.controlProbeCount>=1);
  assert.ok(result.producerTransactionId);
  assert.ok(result.crafterTransactionId);
  assert.ok(Number.isSafeInteger(result.outputId));
});

test('FA-R3 source owns no gameplay authority or hidden world access',()=>{
  const source=fs.readFileSync(new URL('../research/social-persistence.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Math\.random|\bDate\b|document\.|window\.|fetch\(/);
  assert.doesNotMatch(source,/\.stock\s*=|\.balance\s*=|\.profession\s*=|\.task\s*=|\.items\.push|\.orders\.push|command\(|rustCommand\(/);
  for(const token of ['currencyWallet','rustPossessions','merchantListings','merchantBuyOffers','resourceStock','CRAFT_ITEM','RC4_BUY_LISTING'])
    assert.equal(source.includes(token),false,token);
});
