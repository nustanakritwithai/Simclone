import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {createWorld,command,step,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {personalHomeSite} from '../src/individual-housing.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {advanceCraft} from '../src/rust-possessions.mjs';
import {projectHomeMarketForTrade} from '../src/home-market.mjs';
import {observeRc4Markets,knownRc4Listings} from '../src/rc4-market-observation.mjs';
import {getBalance,totalCurrency} from '../src/currency-wallet.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {TRADE_ASSET_TYPES} from '../src/trade-assets.mjs';
import {verifyCanonicalMarketArrival} from '../src/navigation-arrival-evidence.mjs';
import {tradableRustItemIds} from '../src/rust-possessions.mjs';
import {ECONOMIC_DEMAND_TTL_TICKS,projectActorObservedDemand} from '../src/economic-demand.mjs';
import {
  ER5_MERCHANT_AUTONOMY_VERSION,merchantAutonomySnapshot,merchantAutonomyDecision
} from '../src/rc4-merchant-policy.mjs';

function actor(s,id){return s.agents.find(a=>a.id===id);}
function calm(...agents){for(const a of agents){a.hp=a.satiety=a.energy=100;a.task=null;a.moveTick=0;}}
function give(s,a,kind){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
}
function equip(s,a,itemId){s.rustPossessions.equipment.push({agentId:a.id,itemId});}
function completeHome(s,a,label){
  const planned=personalHomeSite(s,a,walkable);assert.ok(planned,'independent personal home site');
  const site=planned.origin;a.x=site.x;a.y=site.y;a.task=null;
  const hammer=give(s,a,'HAMMER');equip(s,a,hammer);
  const place=(kind,socket)=>{
    const id=give(s,a,kind);
    const r=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'er5-home:'+label+':'+id});
    assert.equal(r.ok,true,JSON.stringify(r));
  };
  const {x,y}=site;
  place('WOOD_FOUNDATION',{type:'cell',x,y});
  place('WOOD_WALL',canonicalEdge(x,y,'N'));
  place('WOOD_WALL',canonicalEdge(x,y,'E'));
  place('WOOD_WALL',canonicalEdge(x,y,'W'));
  place('WOOD_DOORWAY',canonicalEdge(x,y,'S'));
  place('WOOD_ROOF',{type:'cell',x,y});
}
function craftItem(s,a,recipeId='STONE_PICKAXE'){
  a.task=null;
  const order=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId});
  assert.equal(order.ok,true,JSON.stringify(order));
  let result=null;
  for(let i=0;i<40&&!result?.completed;i++){s.tick++;result=advanceCraft(s,a.id);}
  assert.equal(result?.completed,true,'canonical craft completes');
  return s.rustPossessions.items.find(i=>i.id===result.itemId);
}
function prepareMerchant(s,a,label,{open=false,qualificationItem='STONE_AXE'}={}){
  completeHome(s,a,label);give(s,a,qualificationItem);calm(a);
  const made=command(s,'RC4_CREATE_MARKET',{agentId:a.id});assert.equal(made.ok,true,JSON.stringify(made));
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:a.id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  assert.equal(actor(s,a.id).profession,'merchant');
  if(open)assert.equal(command(s,'RC4_OPEN_MARKET',{agentId:a.id,marketId:made.marketId}).ok,true);
  return made.marketId;
}
function marketPoint(s,marketId){
  const p=projectHomeMarketForTrade(s,s.homeMarkets,{marketId});assert.equal(p.ok,true,JSON.stringify(p));return p.market;
}
function arriveImmediately(s,agentId,marketId){
  const p=marketPoint(s,marketId),a=actor(s,agentId);
  a.task=null;a.x=p.x;a.y=p.y;
  const travel=command(s,'RC4_TRAVEL_TO_MARKET',{agentId,marketId});assert.equal(travel.ok,true,JSON.stringify(travel));
  assert.equal(actor(s,agentId).task?.path?.length,0);
  return p;
}
function removeNeedItem(s,a,itemKind){
  s.rustPossessions.items=s.rustPossessions.items.filter(i=>!(i.kind===itemKind&&i.location?.kind==='bag'&&i.location.agentId===a.id));
  s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>s.rustPossessions.items.some(i=>i.id===e.itemId));
}
function setupObservedResale(){
  const s=createWorld(925001,{mode:'independent',worldProfile:'same-world',population:4}),producer=s.agents[3],supplier=s.agents[0],merchant=s.agents[2],customer=s.agents[1];
  calm(producer,supplier,merchant,customer);
  Object.assign(resourceStock(s,producer),{food:500,wood:500,stone:500});
  const item=craftItem(s,producer,'STONE_AXE');
  const supplierMarket=prepareMerchant(s,supplier,'supplier',{open:false});
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{agentId:supplier.id,itemKind:item.kind,unitPrice:49});
  assert.equal(offer.ok,true,JSON.stringify(offer));
  assert.equal(command(s,'RC4_OPEN_MARKET',{agentId:supplier.id,marketId:supplierMarket}).ok,true);
  const accepted=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:producer.id,offerId:offer.offerId,itemId:item.id});
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  arriveImmediately(s,supplier.id,supplierMarket);
  const procurement=s.merchantListings.listings.find(l=>l.id===accepted.listingId);assert.ok(procurement);
  const bought=command(s,'RC4_BUY_LISTING',{buyerId:supplier.id,listingId:procurement.id,listingRevision:procurement.revision});
  assert.equal(bought.ok,true,JSON.stringify(bought));
  const resale=command(s,'RC4_CREATE_LISTING',{agentId:supplier.id,itemId:item.id,unitPrice:70,requestId:'er5-upstream-70'});
  assert.equal(resale.ok,true,JSON.stringify(resale));

  const merchantMarket=prepareMerchant(s,merchant,'merchant',{open:false,qualificationItem:'STONE_PICKAXE'});
  assert.equal(customer.profession,'woodcutter');assert.equal(customer.preference,'WOODCUT');removeNeedItem(s,customer,'STONE_AXE');calm(actor(s,merchant.id),customer);
  const supplyPoint=marketPoint(s,supplierMarket),m=actor(s,merchant.id),c=actor(s,customer.id);
  m.x=supplyPoint.x;m.y=supplyPoint.y;c.x=supplyPoint.x;c.y=supplyPoint.y;m.task=null;c.task=null;
  observeRc4Markets(s);
  return {s,producerId:producer.id,supplierId:supplier.id,merchantId:merchant.id,customerId:customer.id,itemId:item.id,
    supplierMarket,merchantMarket,resaleId:resale.listingId};
}

test('ER5 observed supply -> autonomous buy -> autonomous Listing -> canonical resale produces 100/70/30',()=>{
  const f=setupObservedResale();let {s}=f;
  let merchant=actor(s,f.merchantId),customer=actor(s,f.customerId);
  const beforeTotal=totalCurrency(s),before=serialize(s);
  const first=merchantAutonomySnapshot(s,merchant);
  assert.equal(ER5_MERCHANT_AUTONOMY_VERSION,'ER5-merchant-autonomy/1');
  assert.equal(first.status,'SAT');assert.equal(first.type,'TRAVEL_TO_MARKET');assert.equal(first.listingId,f.resaleId);
  assert.equal(serialize(s),before,'ER5 projection is read-only');

  step(s,1);
  merchant=actor(s,f.merchantId);assert.ok(merchant.task?.rc4MarketTravel);assert.equal(merchant.task.path.length,0);
  const ready=merchantAutonomyDecision(s,merchant);
  const currentListing=s.merchantListings.listings.find(l=>l.id===f.resaleId)??null;
  const projected=projectActorObservedDemand(s,merchant);
  const marketNow=projectHomeMarketForTrade(s,s.homeMarkets,{marketId:f.supplierMarket});
  const debug={
    ready,
    currentListing,
    knownListing:knownRc4Listings(merchant).find(l=>l.id===f.resaleId)??null,
    demand:projected.signals?.find(x=>x.itemKind==='STONE_AXE')??null,
    sellerTradable:tradableRustItemIds(s,{agentId:f.supplierId,itemKind:'STONE_AXE'}),
    arrival:marketNow.ok?verifyCanonicalMarketArrival(s,{agentId:merchant.id,market:marketNow.market}):marketNow
  };
  assert.equal(ready.type,'BUY_LISTING',JSON.stringify(debug));
  step(s,1);

  merchant=actor(s,f.merchantId);
  assert.deepEqual(s.rustPossessions.items.find(i=>i.id===f.itemId).location,{kind:'bag',agentId:merchant.id});
  assert.equal(getBalance(s,merchant.id),30);
  // Keep the upstream Merchant from opening a second competing BuyOffer while
  // this proof isolates the target Merchant's deterministic resale price.
  actor(s,f.supplierId).satiety=0;
  assert.equal(s.merchantLedgers.ledgers.find(l=>l.merchantId===merchant.id).purchases.at(-1).unitPrice,70);

  merchant.task=null;merchant.hp=merchant.satiety=merchant.energy=100;
  step(s,1);
  merchant=actor(s,f.merchantId);
  const resale=s.merchantListings.listings.find(l=>l.sellerId===merchant.id&&l.itemInstanceId===f.itemId&&l.status==='OPEN');
  assert.ok(resale,'Merchant must autonomously list acquired canonical stock');assert.equal(resale.unitPrice,100);

  merchant.task=null;merchant.hp=merchant.satiety=merchant.energy=100;
  step(s,1);
  assert.equal(s.homeMarkets.markets.find(m=>m.marketId===f.merchantMarket).status,'open');

  customer=actor(s,f.customerId);const ownPoint=marketPoint(s,f.merchantMarket);
  customer.x=ownPoint.x;customer.y=ownPoint.y;customer.task=null;customer.hp=customer.satiety=customer.energy=100;
  observeRc4Markets(s);
  const travel=command(s,'RC4_TRAVEL_TO_MARKET',{agentId:customer.id,marketId:f.merchantMarket});assert.equal(travel.ok,true,JSON.stringify(travel));
  assert.equal(actor(s,customer.id).task.path.length,0);
  const sold=command(s,'RC4_BUY_LISTING',{buyerId:customer.id,listingId:resale.id,listingRevision:resale.revision});
  assert.equal(sold.ok,true,JSON.stringify(sold));

  merchant=actor(s,f.merchantId);customer=actor(s,f.customerId);
  const ledger=s.merchantLedgers.ledgers.find(l=>l.merchantId===merchant.id);
  assert.equal(ledger.revenue,100);assert.equal(ledger.costOfGoodsSold,70);assert.equal(ledger.realizedProfit,30);
  assert.equal(getBalance(s,merchant.id),130);assert.equal(getBalance(s,customer.id),0);assert.equal(totalCurrency(s),beforeTotal);
  assert.deepEqual(s.rustPossessions.items.find(i=>i.id===f.itemId).location,{kind:'bag',agentId:customer.id});
  assert.deepEqual(validate(s),[]);
  const wire=serialize(s);s=restore(wire);assert.equal(serialize(s),wire);
});

test('ER5 unaffordable observed ask creates one funded BuyOffer and save/load does not duplicate it',()=>{
  let s=createWorld(925002,{mode:'independent',worldProfile:'same-world',population:4}),supplier=s.agents[0],merchant=s.agents[1],producer=s.agents[3],customer=s.agents[2];
  const supplierId=supplier.id,merchantId=merchant.id,producerId=producer.id,customerId=customer.id;
  calm(supplier,merchant,producer,customer);
  Object.assign(resourceStock(s,producer),{food:500,wood:500,stone:500});
  const producerItem=craftItem(s,producer,'STONE_PICKAXE');
  const supplierMarket=prepareMerchant(s,supplier,'bo-supplier',{open:true});
  const supplierStock=give(s,actor(s,supplierId),'STONE_PICKAXE');
  const high=command(s,'RC4_CREATE_LISTING',{agentId:supplierId,itemId:supplierStock,unitPrice:140,requestId:'er5-reference-140'});
  assert.equal(high.ok,true,JSON.stringify(high));
  const merchantMarket=prepareMerchant(s,merchant,'bo-merchant',{open:false});
  merchant=actor(s,merchantId);customer=actor(s,customerId);
  assert.equal(customer.profession,'miner');assert.equal(customer.preference,'MINE');removeNeedItem(s,customer,'STONE_PICKAXE');
  const point=marketPoint(s,supplierMarket);
  merchant.x=point.x;merchant.y=point.y;customer.x=point.x;customer.y=point.y;calm(merchant,customer);
  observeRc4Markets(s);

  const snap=merchantAutonomySnapshot(s,merchant);
  assert.equal(snap.status,'SAT');assert.equal(snap.type,'CREATE_BUY_OFFER');assert.equal(snap.unitPrice,98);
  step(s,1);
  const offers=s.merchantBuyOffers.buyOffers.filter(o=>o.buyerId===merchantId&&o.itemKind==='STONE_PICKAXE'&&o.status==='OPEN');
  assert.equal(offers.length,1);assert.equal(offers[0].unitPrice,98);assert.equal(offers[0].quantityWanted,1);

  actor(s,merchantId).task=null;const wire=serialize(s);s=restore(wire);
  merchant=actor(s,merchantId);merchant.task=null;merchant.hp=merchant.satiety=merchant.energy=100;
  step(s,1);
  assert.equal(s.homeMarkets.markets.find(m=>m.marketId===merchantMarket).status,'open');
  assert.equal(s.merchantBuyOffers.buyOffers.filter(o=>o.buyerId===merchantId&&o.itemKind==='STONE_PICKAXE'&&o.status==='OPEN').length,1);

  const offer=s.merchantBuyOffers.buyOffers.find(o=>o.buyerId===merchantId&&o.itemKind==='STONE_PICKAXE'&&o.status==='OPEN');
  const accepted=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId,offerId:offer.offerId,itemId:producerItem.id});
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  const home=marketPoint(s,merchantMarket);merchant=actor(s,merchantId);
  merchant.x=home.x;merchant.y=home.y;merchant.task=null;observeRc4Markets(s);
  step(s,1);
  merchant=actor(s,merchantId);assert.ok(merchant.task?.rc4MarketTravel);assert.equal(merchant.task.path.length,0);
  const buyIntent=merchantAutonomySnapshot(s,merchant);assert.equal(buyIntent.type,'BUY_LISTING');
  step(s,1);

  merchant=actor(s,merchantId);
  assert.deepEqual(s.rustPossessions.items.find(i=>i.id===producerItem.id).location,{kind:'bag',agentId:merchantId});
  assert.equal(getBalance(s,merchantId),2);
  assert.equal(s.merchantBuyOffers.buyOffers.find(o=>o.offerId===offer.offerId).status,'FILLED');
  const beforeReplay=serialize(s),replay=command(s,'RC4_BUY_LISTING',buyIntent.intent);
  assert.equal(replay.ok,false);assert.equal(serialize(s),beforeReplay,'completed procurement replay cannot charge or duplicate stock');
  assert.deepEqual(validate(s),[]);
  const saved=serialize(s);s=restore(saved);assert.equal(serialize(s),saved);
});

test('ER5 hidden/stale supply never authorizes remote buying and corrupt market knowledge remains UNKNOWN',()=>{
  {
    const f=setupObservedResale(),s=f.s,m=actor(s,f.merchantId),c=actor(s,f.customerId);
    m.rc4MarketKnowledge.knownListings=[];m.rc4MarketKnowledge.knownMarkets=m.rc4MarketKnowledge.knownMarkets.filter(x=>x.marketId!==f.supplierMarket);
    c.x=m.x;c.y=m.y;m.task=null;
    const before=serialize(s),snap=merchantAutonomySnapshot(s,m);
    assert.notEqual(snap.type,'TRAVEL_TO_MARKET');assert.notEqual(snap.type,'BUY_LISTING');assert.equal(serialize(s),before);
  }
  {
    const f=setupObservedResale(),s=f.s,m=actor(s,f.merchantId);
    s.tick+=ECONOMIC_DEMAND_TTL_TICKS+1;m.task=null;
    const snap=merchantAutonomySnapshot(s,m);
    assert.notEqual(snap.type,'TRAVEL_TO_MARKET');assert.notEqual(snap.type,'BUY_LISTING');
  }
  {
    const f=setupObservedResale(),s=f.s,m=actor(s,f.merchantId);
    m.rc4MarketKnowledge={};
    const snap=merchantAutonomySnapshot(s,m);assert.equal(snap.status,'UNKNOWN');
  }
});

test('ER5 command guards reject unfunded BuyOffers and bulk stock overcommit',()=>{
  const s=createWorld(925003,{mode:'independent',worldProfile:'same-world',population:4}),merchant=s.agents[0];calm(merchant);
  const market=prepareMerchant(s,merchant,'guards',{open:false});
  const first=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,itemKind:'STONE_PICKAXE',unitPrice:70});
  assert.equal(first.ok,true,JSON.stringify(first));
  s.tick++;
  const unfunded=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,itemKind:'HAMMER',unitPrice:40});
  assert.equal(unfunded.ok,false);assert.equal(unfunded.reason,'buy-offer-unfunded');

  // Close the BuyOffer commitment by using a fresh world for the stock-commitment proof.
  const t=createWorld(925004,{mode:'independent',worldProfile:'same-world',population:4}),seller=t.agents[0];calm(seller);prepareMerchant(t,seller,'bulk',{open:false});
  resourceStock(t,seller).wood=5;
  const a=command(t,'RC4_CREATE_LISTING',{agentId:seller.id,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,itemKind:'wood',quantity:4,unitPrice:1,requestId:'er5-bulk-a'});
  assert.equal(a.ok,true,JSON.stringify(a));
  const b=command(t,'RC4_CREATE_LISTING',{agentId:seller.id,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,itemKind:'wood',quantity:2,unitPrice:1,requestId:'er5-bulk-b'});
  assert.equal(b.ok,false);assert.equal(b.reason,'bulk-stock-committed');
  assert.equal(t.merchantListings.listings.filter(l=>l.sellerId===seller.id&&l.itemKind==='wood'&&l.status==='OPEN').length,1);
});

test('ER5 policy remains proposal-only and deterministic without forbidden clocks/RNG',()=>{
  const f=setupObservedResale(),s=f.s,m=actor(s,f.merchantId),before=serialize(s);
  const a=merchantAutonomyDecision(s,m),b=merchantAutonomyDecision(JSON.parse(serialize(s)),JSON.parse(serialize(s)).agents.find(x=>x.id===m.id));
  assert.equal(a.type,b.type);assert.equal(a.listingId,b.listingId);assert.equal(a.unitPrice,b.unitPrice);
  assert.equal(serialize(s),before);
  const src=fs.readFileSync(new URL('../src/rc4-merchant-policy.mjs',import.meta.url),'utf8');
  for(const token of ['Math.random','Date.now','new Date(','merchantInventory','shopInventory','merchantWallet','shopWallet'])
    assert.equal(src.includes(token),false,token);
});
