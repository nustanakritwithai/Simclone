import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {command,serialize} from '../src/engine.mjs';
import {advanceCraft} from '../src/rust-possessions.mjs';
import {observeRc4Markets,knownRc4BuyOffers} from '../src/rc4-market-observation.mjs';
import {projectHomeMarketForTrade} from '../src/home-market.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {ECONOMIC_DEMAND_TTL_TICKS} from '../src/economic-demand.mjs';
import {rc2World} from './fixtures/rc2-world.mjs';
import {
  demandDrivenCrafterSnapshot,demandDrivenCrafterIntent,ER3_CRAFTER_MARKET_VERSION
} from '../docs/wip/career-economy/er3-demand-crafter.mjs';

function demandFixture(){
  const s=rc2World(),consumer=s.agents[0],crafter=s.agents[1];
  crafter.profession='crafter';consumer.preference='MINE';
  consumer.x=crafter.x;consumer.y=crafter.y;
  for(const a of [consumer,crafter]){a.task=null;a.hp=a.satiety=a.energy=100;}
  Object.assign(resourceStock(s,crafter),{food:900,wood:900,stone:900});
  s.rustPossessions.items=s.rustPossessions.items.filter(i=>!(i.location?.kind==='bag'&&i.location.agentId===consumer.id&&i.kind==='STONE_PICKAXE'));
  s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>e.agentId!==consumer.id);
  return {s,consumer,crafter};
}
function completePendingCraft(s,a){
  const order=s.rustPossessions.orders.find(o=>o.agentId===a.id);assert.ok(order);
  if(order.stationId!==null){const st=s.rustStations.stations.find(x=>x.id===order.stationId);assert.ok(st);a.x=st.x;a.y=st.y;}
  let done=null;
  for(let i=0;i<order.required+2&&!done?.completed;i++){s.tick++;done=advanceCraft(s,a.id);}
  assert.equal(done?.completed,true,JSON.stringify(done));
  return s.rustPossessions.items.find(i=>i.id===done.itemId);
}
function addObservedBuyOffer(s,crafter,{itemKind='STONE_PICKAXE',price=70}={}){
  const merchant=s.agents[0];merchant.preference='FORAGE';merchant.task=null;
  const made=command(s,'RC4_CREATE_MARKET',{agentId:merchant.id});assert.equal(made.ok,true,JSON.stringify(made));
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,itemKind,unitPrice:price});assert.equal(offer.ok,true,JSON.stringify(offer));
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:merchant.id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  assert.equal(command(s,'RC4_OPEN_MARKET',{agentId:merchant.id,marketId:made.marketId}).ok,true);
  const market=projectHomeMarketForTrade(s,s.homeMarkets,{marketId:made.marketId});assert.equal(market.ok,true);
  crafter.x=market.market.x;crafter.y=market.market.y;observeRc4Markets(s);
  assert.ok(knownRc4BuyOffers(crafter).some(o=>o.offerId===offer.offerId));
  return {merchant,offer,marketId:made.marketId};
}

test('ER3 reads ER1 local need and proposes ordinary CRAFT_ITEM without mutating state',()=>{
  const {s,crafter}=demandFixture(),before=serialize(s);
  const snap=demandDrivenCrafterSnapshot(s,crafter),intent=demandDrivenCrafterIntent(s,crafter);
  assert.equal(ER3_CRAFTER_MARKET_VERSION,'ER3-crafter-market/1');
  assert.equal(snap.status,'READY_CRAFT');assert.equal(snap.demand.itemKind,'STONE_PICKAXE');
  assert.equal(snap.recipeId,'STONE_PICKAXE');assert.equal(snap.tier,0);
  assert.deepEqual(intent,{type:'CRAFT_ITEM',data:{agentId:crafter.id,recipeId:'STONE_PICKAXE'}});
  assert.ok(Object.isFrozen(intent)&&Object.isFrozen(intent.data));
  assert.equal(serialize(s),before);
});

test('ER3 real craft becomes physical stock and prevents repeated overproduction without procurement',()=>{
  const {s,crafter}=demandFixture(),intent=demandDrivenCrafterIntent(s,crafter);
  const accepted=command(s,intent.type,intent.data);assert.equal(accepted.ok,true,JSON.stringify(accepted));
  const item=completePendingCraft(s,crafter);assert.equal(item.kind,'STONE_PICKAXE');assert.equal(item.createdBy,crafter.id);
  const after=demandDrivenCrafterSnapshot(s,crafter);
  assert.equal(after.status,'WAITING');assert.equal(after.reason,'stock-awaiting-procurement');assert.equal(after.itemId,item.id);
  assert.equal(demandDrivenCrafterIntent(s,crafter),null);
});

test('ER3 uses existing physical stock before crafting and can answer a fresh observed Merchant BuyOffer',()=>{
  const {s,crafter}=demandFixture();
  const crafted=command(s,'CRAFT_ITEM',{agentId:crafter.id,recipeId:'STONE_PICKAXE'});assert.equal(crafted.ok,true);
  const item=completePendingCraft(s,crafter);
  const {offer}=addObservedBuyOffer(s,crafter,{itemKind:'STONE_PICKAXE',price:70});
  const before=serialize(s),snap=demandDrivenCrafterSnapshot(s,crafter);
  assert.equal(snap.status,'READY_SELL');assert.equal(snap.itemId,item.id);assert.equal(snap.buyOfferId,offer.offerId);
  assert.deepEqual(snap.intent,{type:'RC4_ACCEPT_BUY_OFFER',data:{producerId:crafter.id,offerId:offer.offerId,itemId:item.id}});
  assert.equal(Object.hasOwn(snap.intent.data,'unitPrice'),false,'Merchant BuyOffer remains price authority');
  assert.equal(serialize(s),before);
});

test('ER3 expired BuyOffer knowledge cannot authorize sale even when same item demand exists locally',()=>{
  const {s,crafter}=demandFixture();
  assert.equal(command(s,'CRAFT_ITEM',{agentId:crafter.id,recipeId:'STONE_PICKAXE'}).ok,true);
  completePendingCraft(s,crafter);addObservedBuyOffer(s,crafter,{itemKind:'STONE_PICKAXE',price:70});
  const seen=crafter.rc4MarketKnowledge.knownBuyOffers[0],market=crafter.rc4MarketKnowledge.knownMarkets[0];
  seen.observedTick=s.tick-ECONOMIC_DEMAND_TTL_TICKS-1;market.observedTick=s.tick-ECONOMIC_DEMAND_TTL_TICKS-1;
  const snap=demandDrivenCrafterSnapshot(s,crafter);
  assert.equal(snap.status,'WAITING');assert.equal(snap.reason,'stock-awaiting-procurement');
  assert.equal(demandDrivenCrafterIntent(s,crafter),null);
});

test('ER3 dispatched sell intent remains canonical RC4 and creates one bound procurement Listing',()=>{
  const {s,crafter}=demandFixture();
  assert.equal(command(s,'CRAFT_ITEM',{agentId:crafter.id,recipeId:'STONE_PICKAXE'}).ok,true);
  const item=completePendingCraft(s,crafter),{offer}=addObservedBuyOffer(s,crafter,{itemKind:'STONE_PICKAXE',price:70});
  const intent=demandDrivenCrafterIntent(s,crafter),accepted=command(s,intent.type,intent.data);
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  const listing=s.merchantListings.listings.find(l=>l.id===accepted.listingId);assert.ok(listing);
  assert.equal(listing.itemInstanceId,item.id);assert.equal(listing.sellerId,crafter.id);
  assert.equal(listing.buyOfferId,offer.offerId);assert.equal(listing.unitPrice,offer.unitPrice);
  const wait=demandDrivenCrafterSnapshot(s,crafter);
  assert.equal(wait.status,'WAITING');assert.equal(wait.reason,'merchant-purchase-pending');
});

test('ER3 missing real inputs becomes explicit ER4 handoff instead of minting material',()=>{
  const {s,crafter}=demandFixture(),stock=resourceStock(s,crafter);
  stock.wood=0;stock.stone=0;
  const before=serialize(s),snap=demandDrivenCrafterSnapshot(s,crafter);
  assert.equal(snap.status,'NEEDS_MATERIALS');assert.equal(snap.procurementRequired,true);
  assert.equal(snap.recipeId,'STONE_PICKAXE');assert.ok(Object.keys(snap.missing).length>0);
  assert.equal(demandDrivenCrafterIntent(s,crafter),null);
  assert.equal(serialize(s),before);
});

test('ER3 generic item demand chooses lowest valid known tier and does not burn high-tier inputs',()=>{
  const {s,crafter}=demandFixture();
  Object.assign(resourceStock(s,crafter),{food:900,wood:900,stone:900,ironIngot:96,steelIngot:96});
  const snap=demandDrivenCrafterSnapshot(s,crafter);
  assert.equal(snap.status,'READY_CRAFT');assert.equal(snap.recipeId,'STONE_PICKAXE');assert.equal(snap.tier,0);
});

test('ER3 yields to career, survival, manual training, Adventure and existing work',()=>{
  for(const profession of ['builder','merchant','adventurer']){
    const {s,crafter}=demandFixture();crafter.profession=profession;
    assert.equal(demandDrivenCrafterSnapshot(s,crafter).status,'INELIGIBLE',profession);
  }
  for(const [name,change,reason] of [
    ['survival',(s,a)=>a.hp=69,'survival'],
    ['manual',(s,a)=>a.craftTraining={enabled:true},'manual-training'],
    ['adventure',(s,a)=>a.adventureEncounter={status:'READY'},'adventure'],
    ['task',(s,a)=>a.task={kind:'IDLE'},'task'],
  ]){
    const {s,crafter}=demandFixture();change(s,crafter);
    const before=serialize(s),snap=demandDrivenCrafterSnapshot(s,crafter);
    assert.equal(snap.status,'BLOCKED',name);assert.equal(snap.reason,reason,name);assert.equal(serialize(s),before,name);
  }
});

test('ER3 source is deterministic proposal-only and owns no economic writer',()=>{
  const source=fs.readFileSync(new URL('../docs/wip/career-economy/er3-demand-crafter.mjs',import.meta.url),'utf8');
  for(const token of ['Math.random','Date.now','document.','window.','.items.push','.orders.push','createListing','merchantLedgers','currencyWallet'])
    assert.equal(source.includes(token),false,token);
  assert.doesNotMatch(source,/profession\s*=(?!=)|\.balance\s*[+\-]?=|merchantListings\s*=|merchantBuyOffers\s*=/);
});
