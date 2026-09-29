import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorld} from '../src/engine.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {ITEM_CATALOG} from '../src/crafting-catalog.mjs';
import {tradableRustItemIds} from '../src/rust-possessions.mjs';
import {createBuyOfferCollection,createBuyOfferInCollection} from '../src/merchant-buy-offer.mjs';
import {createListingCollection,createListingInCollection} from '../src/merchant-listing.mjs';
import {createReservation,commitReservation} from '../src/merchant-reservation.mjs';
import {transfer} from '../src/currency-wallet.mjs';
import {tradeProposalFingerprint} from '../src/trade-kernel.mjs';
import {RC4_MARKET_KNOWLEDGE_VERSION} from '../src/rc4-market-observation.mjs';
import {
  projectActorObservedDemand,observedDemandFor,ECONOMIC_DEMAND_VERSION,ECONOMIC_DEMAND_TTL_TICKS
} from '../src/economic-demand.mjs';

function give(s,a,kind){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
}
function marketRow({marketId,ownerAgentId,listingIds=[],buyOfferIds=[]}){
  return {
    marketId,homeId:'H-ER1-'+marketId.replace(/[^A-Za-z0-9]/g,''),ownerAgentId,status:'open',
    listingIds:[...listingIds],buyOfferIds:[...buyOfferIds],
    storefrontSocket:{type:'edge',x:2,y:2,side:'N',level:1,facing:'S',doorwayStationId:9000+ownerAgentId},
    reputation:0
  };
}
function knownMarket(row,tick){
  return {
    marketId:row.marketId,homeId:row.homeId,ownerAgentId:row.ownerAgentId,ownerName:'Known Merchant',
    status:row.status,position:{x:2,y:1},tradeRange:1,observedTick:tick,source:'local-observation'
  };
}
function fixture(){
  const s=createWorld(230926);s.tick=1000;
  const observer=s.agents[0],buyer=s.agents[1],seller=s.agents[2];
  for(const a of [observer,buyer,seller]){a.alive=true;a.task=null;a.satiety=100;a.energy=100;}
  const itemId=give(s,seller,'HIDE');

  let offers=createBuyOfferCollection();
  const knownOffer=createBuyOfferInCollection(offers,{marketId:'M:KNOWN',buyerId:buyer.id,itemKind:'HIDE',quantityWanted:1,unitPrice:10,createdTick:990});
  assert.equal(knownOffer.state,'SAT');offers=knownOffer.collection;
  const hiddenOffer=createBuyOfferInCollection(offers,{marketId:'M:HIDDEN',buyerId:buyer.id,itemKind:'FIRE_CORE',quantityWanted:1,unitPrice:11,createdTick:991});
  assert.equal(hiddenOffer.state,'SAT');offers=hiddenOffer.collection;

  let listings=createListingCollection();
  const listed=createListingInCollection(listings,{id:'L:KNOWN',marketId:'M:KNOWN',sellerId:seller.id,itemKind:'HIDE',itemInstanceId:itemId,quantity:1,unitPrice:12,status:'OPEN'});
  assert.equal(listed.state,'SAT');listings=listed.collection;

  const known=marketRow({marketId:'M:KNOWN',ownerAgentId:buyer.id,listingIds:[listed.listing.id],buyOfferIds:[knownOffer.offer.offerId]});
  const hidden=marketRow({marketId:'M:HIDDEN',ownerAgentId:buyer.id,buyOfferIds:[hiddenOffer.offer.offerId]});
  s.homeMarkets={version:s.homeMarkets.version,markets:[known,hidden]};
  s.merchantBuyOffers=offers;s.merchantListings=listings;
  observer.rc4MarketKnowledge={
    version:RC4_MARKET_KNOWLEDGE_VERSION,
    knownMarkets:[knownMarket(known,995)],
    knownListings:[{...listed.listing,observedTick:995,source:'local-observation'}],
    knownBuyOffers:[{...knownOffer.offer,observedTick:995,source:'local-observation'}]
  };
  return {s,observer,buyer,seller,itemId,knownOffer,listed};
}

test('ER0 freezes bulk resource representation: counters are not fake Rust item instances',()=>{
  const s=createWorld(230926),a=s.agents[0],stock=resourceStock(s,a);
  stock.food=90;stock.wood=70;stock.stone=50;stock.ironOre=20;stock.ironIngot=10;stock.steelIngot=5;
  for(const key of ['food','wood','stone','ironOre','ironIngot','steelIngot']){
    assert.equal(Object.hasOwn(ITEM_CATALOG,key),false,key+' must not be silently materialized as an item kind');
    assert.deepEqual(tradableRustItemIds(s,{agentId:a.id,itemKind:key}),[],key+' cannot enter the item-instance Trade Kernel');
  }
});

test('ER1 household shortage is current, actor-scoped, non-tradable and read-only',()=>{
  const s=createWorld(230926),a=s.agents[0],stock=resourceStock(s,a);
  stock.food=0;stock.wood=0;stock.stone=0;
  const before=JSON.stringify(s),out=projectActorObservedDemand(s,a);
  assert.equal(out.version,ECONOMIC_DEMAND_VERSION);assert.equal(out.status,'SAT');
  for(const key of ['food','wood','stone']){
    const row=out.signals.find(x=>x.itemKind===key);
    assert.ok(row,key);assert.equal(row.unit,'bulk-resource');assert.equal(row.tradable,false);
    assert.equal(row.actionable,false);assert.ok(row.shortageQuantity>0);
    assert.equal(row.sources.some(x=>x.kind==='HOUSEHOLD_SHORTAGE'),true);
  }
  assert.equal(JSON.stringify(s),before,'projection must not mutate world state');
});

test('ER1 observes nearby supported tool/equipment needs without reading distant actors',()=>{
  const s=createWorld(230926),observer=s.agents[0],near=s.agents[1],far=s.agents[2];
  observer.x=near.x=2;observer.y=near.y=2;observer.preference='FORAGE';
  far.x=50;far.y=50;far.preference='WOODCUT';
  near.preference='MINE';near.profession='adventurer';
  s.rustPossessions.items=s.rustPossessions.items.filter(i=>![near.id,far.id].includes(i.location?.agentId));
  s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>![near.id,far.id].includes(e.agentId));
  const out=projectActorObservedDemand(s,observer);
  assert.equal(out.status,'SAT');
  assert.ok(out.signals.find(x=>x.itemKind==='STONE_PICKAXE')?.sources.some(x=>x.kind==='LOCAL_ITEM_NEED'&&x.subjectAgentId===near.id));
  assert.ok(out.signals.find(x=>x.itemKind==='EMBER_BLADE')?.sources.some(x=>x.kind==='LOCAL_ITEM_NEED'&&x.subjectAgentId===near.id));
  assert.ok(out.signals.find(x=>x.itemKind==='HIDE_ARMOR')?.sources.some(x=>x.kind==='LOCAL_ITEM_NEED'&&x.subjectAgentId===near.id));
  assert.equal(out.signals.find(x=>x.itemKind==='STONE_AXE')?.sources.some(x=>x.subjectAgentId===far.id)??false,false);
});

test('ER1 counts only fresh observed canonical market rows and subtracts physical supply',()=>{
  const {s,observer,itemId,seller,buyer}=fixture(),before=JSON.stringify(s);
  const out=projectActorObservedDemand(s,observer);
  assert.equal(out.status,'SAT');
  const hide=out.signals.find(x=>x.itemKind==='HIDE');
  assert.ok(hide);assert.equal(hide.demandQuantity,1);assert.equal(hide.supplyQuantity,1);assert.equal(hide.shortageQuantity,0);
  assert.equal(hide.actionable,false);
  assert.equal(out.signals.some(x=>x.itemKind==='FIRE_CORE'),false,'unobserved global offer must not leak into actor knowledge');

  const physical=s.rustPossessions.items.find(i=>i.id===itemId);
  physical.location={kind:'bag',agentId:buyer.id};
  const staleSupply=projectActorObservedDemand(s,observer).signals.find(x=>x.itemKind==='HIDE');
  assert.equal(staleSupply.demandQuantity,1);assert.equal(staleSupply.supplyQuantity,0);assert.equal(staleSupply.shortageQuantity,1);
  assert.equal(staleSupply.actionable,true);
  physical.location={kind:'bag',agentId:seller.id};
  assert.equal(JSON.stringify(s),before,'test repair returns fixture to exact pre-projection state');
});

test('ER1 stale observations expire instead of being refreshed from hidden world truth',()=>{
  const {s,observer}=fixture();
  observer.rc4MarketKnowledge.knownMarkets[0].observedTick=s.tick-ECONOMIC_DEMAND_TTL_TICKS-1;
  observer.rc4MarketKnowledge.knownListings[0].observedTick=s.tick-ECONOMIC_DEMAND_TTL_TICKS-1;
  observer.rc4MarketKnowledge.knownBuyOffers[0].observedTick=s.tick-ECONOMIC_DEMAND_TTL_TICKS-1;
  const out=projectActorObservedDemand(s,observer);
  assert.equal(out.status,'SAT');
  assert.equal(out.signals.some(x=>x.itemKind==='HIDE'),false);
});

test('ER1 verified trade is bounded historical demand, not additive double demand',()=>{
  const {s,observer,buyer,seller,itemId,listed}=fixture();
  const reserved=createReservation(s,s.merchantReservations,{
    listing:listed.listing,listingRevision:listed.listing.revision,buyerId:buyer.id,itemIds:[itemId],createdTick:s.tick
  });
  assert.equal(reserved.state,'SAT');s.merchantReservations=reserved.reservationState;
  const transactionId='TX:ER1:1';
  const committed=commitReservation(s.merchantReservations,{reservationId:reserved.reservation.id,transactionId,terminalTick:s.tick});
  assert.equal(committed.state,'SAT');s.merchantReservations=committed.reservationState;
  const paid=transfer(s,{
    transactionId,fromAgentId:buyer.id,toAgentId:seller.id,amount:12,
    evidence:{operation:'TRADE_TRANSFER',marketId:'M:KNOWN',listingId:listed.listing.id,reservationId:reserved.reservation.id}
  });
  assert.equal(paid.ok,true);

  const proposal={
    transactionId,marketId:'M:KNOWN',sellerId:seller.id,buyerId:buyer.id,
    itemKind:'HIDE',itemInstanceId:itemId,quantity:1,unitPrice:12,totalPrice:12,
    listingId:listed.listing.id,reservationId:reserved.reservation.id
  };
  const fingerprint=tradeProposalFingerprint(proposal);
  s.tradeReplay.receipts.push({
    ...proposal,itemIds:[itemId],eventId:'TRADE:'+transactionId,
    fingerprint,integrityFingerprint:fingerprint+'|ITEMS|'+itemId
  });

  const out=projectActorObservedDemand(s,observer);
  assert.equal(out.status,'SAT');
  const hide=out.signals.find(x=>x.itemKind==='HIDE');
  assert.equal(hide.verifiedTradeCount,1);assert.equal(hide.verifiedTradeQuantity,1);
  assert.equal(hide.historicalDemandQuantity,1);
  assert.equal(hide.sources.some(x=>x.kind==='VERIFIED_TRADE'),true);
  assert.equal(hide.demandQuantity,1,'history and current BuyOffer use max, not invented additive demand');
});

test('ER1 invalid canonical roots fail UNKNOWN and observedDemandFor never upgrades UNKNOWN to PASS',()=>{
  const {s,observer}=fixture();s.merchantBuyOffers={};
  const before=JSON.stringify(s),out=projectActorObservedDemand(s,observer);
  assert.equal(out.status,'UNKNOWN');assert.equal(out.reason,'authority-invalid');assert.deepEqual(out.signals,[]);
  const one=observedDemandFor(s,observer,'HIDE');
  assert.equal(one.status,'UNKNOWN');assert.equal(one.signal,null);
  assert.equal(JSON.stringify(s),before);
});

test('ER1 source is deterministic read-only policy with no economic or career writer',()=>{
  const source=fs.readFileSync(new URL('../src/economic-demand.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Math\.random|\bDate\b|document\.|window\.|fetch\(/);
  assert.doesNotMatch(source,/\.items\.push|\.orders\.push|profession\s*=(?!=)|command\s*\(|\.balance\s*[+\-]?=|currencyWallet\s*=|merchantListings\s*=|merchantBuyOffers\s*=/);
});
