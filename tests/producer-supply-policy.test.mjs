import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {command,serialize} from '../src/engine.mjs';
import {advanceCraft} from '../src/rust-possessions.mjs';
import {projectHomeMarketForTrade} from '../src/home-market.mjs';
import {observeRc4Markets,knownRc4BuyOffers} from '../src/rc4-market-observation.mjs';
import {transitionBuyOfferInCollection} from '../src/merchant-buy-offer.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {rc2World} from './fixtures/rc2-world.mjs';
import {producerSupplySnapshot,producerSupplyIntent,PRODUCER_SUPPLY_VERSION} from '../docs/wip/rc5-producer/producer-supply-policy.mjs';

function openDemand({price=70,observe=true,secondPrice=null,itemKind='STONE_PICKAXE'}={}){
  const s=rc2World(),merchant=s.agents[0],producer=s.agents[1];
  for(const a of [merchant,producer]){a.hp=a.satiety=a.energy=100;a.task=null;}
  const made=command(s,'RC4_CREATE_MARKET',{agentId:merchant.id});assert.equal(made.ok,true,JSON.stringify(made));
  const first=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,itemKind,unitPrice:price});assert.equal(first.ok,true,JSON.stringify(first));
  let second=null;
  if(secondPrice!==null){second=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,itemKind,unitPrice:secondPrice});assert.equal(second.ok,true,JSON.stringify(second));}
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:merchant.id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  assert.equal(command(s,'RC4_OPEN_MARKET',{agentId:merchant.id,marketId:made.marketId}).ok,true);
  producer.profession='crafter';s.productionPlan.enabled=true;
  if(observe){
    const market=projectHomeMarketForTrade(s,s.homeMarkets,{marketId:made.marketId});assert.equal(market.ok,true);
    producer.x=market.market.x;producer.y=market.market.y;observeRc4Markets(s);
    assert.ok(knownRc4BuyOffers(producer).some(o=>o.offerId===first.offerId));
  }
  return {s,producer,merchant,marketId:made.marketId,first,second};
}
function completePendingCraft(s,a){
  const order=s.rustPossessions.orders.find(o=>o.agentId===a.id);assert.ok(order);
  if(order.stationId!==null){const st=s.rustStations.stations.find(x=>x.id===order.stationId);assert.ok(st);a.x=st.x;a.y=st.y;}
  let done=null;
  for(let i=0;i<order.required+2&&!done?.completed;i++){s.tick++;done=advanceCraft(s,a.id);}
  assert.equal(done?.completed,true,JSON.stringify(done));
  return s.rustPossessions.items.find(i=>i.id===done.itemId);
}

test('Producer policy is off by default and never discovers global demand',()=>{
  const {s,producer}=openDemand({observe:false});s.productionPlan.enabled=false;
  assert.equal(PRODUCER_SUPPLY_VERSION,'RC5-producer-supply/1');
  assert.equal(producerSupplySnapshot(s,producer).status,'OFF');
  s.productionPlan.enabled=true;
  const snap=producerSupplySnapshot(s,producer);
  assert.equal(snap.status,'IDLE');assert.equal(snap.reason,'no-observed-demand');
  assert.equal(producerSupplyIntent(s,producer),null);
});

test('Crafter reads observed canonical BuyOffer and proposes cheapest physical recipe first',()=>{
  const {s,producer,first}=openDemand(),before=serialize(s);
  const snap=producerSupplySnapshot(s,producer),intent=producerSupplyIntent(s,producer);
  assert.equal(snap.status,'READY_CRAFT');assert.equal(snap.demand.offerId,first.offerId);
  assert.equal(snap.recipeId,'STONE_PICKAXE');assert.equal(snap.tier,0);
  assert.deepEqual(intent,{type:'CRAFT_ITEM',data:{agentId:producer.id,recipeId:'STONE_PICKAXE'}});
  assert.ok(Object.isFrozen(intent)&&Object.isFrozen(intent.data));
  assert.equal(serialize(s),before,'policy reads never spend, list or create an order');
});

test('Producer chooses the best currently observed bid but cannot set its price',()=>{
  const {s,producer,second}=openDemand({price:40,secondPrice:90});
  const snap=producerSupplySnapshot(s,producer);
  assert.equal(snap.status,'READY_CRAFT');assert.equal(snap.demand.offerId,second.offerId);assert.equal(snap.demand.unitPrice,90);
  assert.deepEqual(Object.keys(snap.intent.data).sort(),['agentId','recipeId']);
});

test('Actual craft becomes exact physical stock, then Producer proposes existing BuyOffer acceptance',()=>{
  const {s,producer,first}=openDemand(),craftIntent=producerSupplyIntent(s,producer);
  const accepted=command(s,craftIntent.type,craftIntent.data);assert.equal(accepted.ok,true,JSON.stringify(accepted));
  const item=completePendingCraft(s,producer);assert.equal(item.kind,'STONE_PICKAXE');assert.equal(item.createdBy,producer.id);
  const sell=producerSupplySnapshot(s,producer);
  assert.equal(sell.status,'READY_SELL');assert.equal(sell.demand.offerId,first.offerId);assert.equal(sell.itemId,item.id);
  assert.deepEqual(sell.intent,{type:'RC4_ACCEPT_BUY_OFFER',data:{producerId:producer.id,offerId:first.offerId,itemId:item.id}});
  assert.equal(Object.hasOwn(sell.intent.data,'unitPrice'),false,'Merchant BuyOffer owns price');
});

test('Dispatching Producer sell intent uses existing RC4 authority and creates one bound procurement Listing',()=>{
  const {s,producer,first}=openDemand(),craftIntent=producerSupplyIntent(s,producer);
  assert.equal(command(s,craftIntent.type,craftIntent.data).ok,true);const item=completePendingCraft(s,producer);
  const sell=producerSupplyIntent(s,producer),accepted=command(s,sell.type,sell.data);
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  const listing=s.merchantListings.listings.find(l=>l.id===accepted.listingId);assert.ok(listing);
  assert.equal(listing.sellerId,producer.id);assert.equal(listing.itemInstanceId,item.id);
  assert.equal(listing.buyOfferId,first.offerId);assert.equal(listing.unitPrice,first.unitPrice);
  const waiting=producerSupplySnapshot(s,producer);
  assert.equal(waiting.status,'WAITING');assert.equal(waiting.reason,'merchant-purchase-pending');
});

test('Stale observed offer is ignored after canonical offer closes',()=>{
  const {s,producer,first}=openDemand();
  const closed=transitionBuyOfferInCollection(s.merchantBuyOffers,first.offerId,'CLOSED');assert.equal(closed.state,'SAT');
  s.merchantBuyOffers=closed.collection;
  const snap=producerSupplySnapshot(s,producer);
  assert.equal(snap.status,'IDLE');assert.equal(snap.reason,'no-observed-demand');
});

test('Producer role is Crafter-only and yields to survival/manual/adventure/current work',()=>{
  for(const profession of ['builder','merchant','adventurer']){
    const {s,producer}=openDemand();producer.profession=profession;
    assert.equal(producerSupplySnapshot(s,producer).status,'INELIGIBLE',profession);
  }
  for(const [name,change,reason] of [
    ['survival',(s,a)=>a.hp=69,'survival'],
    ['manual',(s,a)=>a.craftTraining={enabled:true},'manual-training'],
    ['adventure',(s,a)=>a.adventureEncounter={status:'READY'},'adventure'],
    ['task',(s,a)=>a.task={kind:'IDLE'},'task'],
  ]){
    const {s,producer}=openDemand();change(s,producer);
    const before=serialize(s),snap=producerSupplySnapshot(s,producer);
    assert.equal(snap.status,'BLOCKED',name);assert.equal(snap.reason,reason,name);assert.equal(serialize(s),before,name);
  }
});

test('Generic demand never spends scarce high-tier inputs when a lower-tier route satisfies the same itemKind',()=>{
  const {s,producer}=openDemand({itemKind:'STONE_PICKAXE'});
  Object.assign(resourceStock(s,producer),{wood:900,stone:900,food:900});
  s.rustMaterials.ironIngot=96;s.rustMaterials.steelIngot=96;
  const snap=producerSupplySnapshot(s,producer);
  assert.equal(snap.recipeId,'STONE_PICKAXE');assert.equal(snap.tier,0);
});

test('Policy source has no price/listing/accounting/item/profession writer',()=>{
  const source=fs.readFileSync(new URL('../docs/wip/rc5-producer/producer-supply-policy.mjs',import.meta.url),'utf8');
  for(const token of ['Math.random','Date.now','document.','window.','.items.push','.orders.push','createListing','applyCanonicalTrade','merchantLedgers','currencyWallet'])
    assert.equal(source.includes(token),false,token);
  assert.doesNotMatch(source,/profession\s*=(?!=)|unitPrice\s*[:=].*intent/);
});
