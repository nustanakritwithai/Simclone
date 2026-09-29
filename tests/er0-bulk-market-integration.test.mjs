import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorld,command,step,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {houseSite} from '../src/housing.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {materialAmount} from '../src/material-economy.mjs';
import {getBalance,totalCurrency} from '../src/currency-wallet.mjs';
import {projectHomeMarketForTrade} from '../src/home-market.mjs';
import {verifyCanonicalMarketArrival} from '../src/navigation-arrival-evidence.mjs';

function give(s,a,kind){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
}
function equip(s,a,itemId){s.rustPossessions.equipment.push({agentId:a.id,itemId});}
function completeHome(s,a){
  const site=houseSite(s,walkable).origin;a.x=site.x;a.y=site.y;a.task=null;
  const hammer=give(s,a,'HAMMER');equip(s,a,hammer);
  const place=(kind,socket)=>{
    const id=give(s,a,kind);
    const r=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'bulk-home:'+s.tick+':'+a.id+':'+id});
    assert.equal(r.ok,true,JSON.stringify(r));return r;
  };
  const {x,y}=site;
  place('WOOD_FOUNDATION',{type:'cell',x,y});
  place('WOOD_WALL',canonicalEdge(x,y,'N'));
  place('WOOD_WALL',canonicalEdge(x,y,'E'));
  place('WOOD_WALL',canonicalEdge(x,y,'W'));
  place('WOOD_DOORWAY',canonicalEdge(x,y,'S'));
  place('WOOD_ROOF',{type:'cell',x,y});
  return site;
}
function actor(s,id){return s.agents.find(a=>a.id===id);}
function runToMarket(s,a,max=500){
  for(let i=0;i<max&&a.task?.path?.length;i++)step(s,1);
  assert.ok(a.task,'canonical market travel task retained at destination');
  assert.equal(a.task.path.length,0,'buyer reached canonical market destination');
}
function setupBulkMarket(){
  const s=createWorld(230926);
  let producer=s.agents[0],merchant=s.agents[1],customer=s.agents[2];
  const ids={producer:producer.id,merchant:merchant.id,customer:customer.id};
  for(const a of [producer,merchant,customer]){a.satiety=100;a.energy=100;a.task=null;a.moveTick=0;}
  completeHome(s,merchant);
  producer=actor(s,ids.producer);merchant=actor(s,ids.merchant);customer=actor(s,ids.customer);
  // Fixture discovery only: start the actors near the physical Home Market.
  for(const a of [producer,customer]){a.x=merchant.x;a.y=merchant.y;}
  resourceStock(s,producer).wood=100;
  resourceStock(s,merchant).wood=0;
  resourceStock(s,customer).wood=0;

  const market=command(s,'RC4_CREATE_MARKET',{agentId:merchant.id});
  assert.equal(market.ok,true,JSON.stringify(market));
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{
    agentId:merchant.id,itemKind:'wood',assetType:'BULK_RESOURCE',quantityWanted:10,unitPrice:3
  });
  assert.equal(offer.ok,true,JSON.stringify(offer));
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:merchant.id});
  assert.equal(promoted.ok,true,JSON.stringify(promoted));
  assert.equal(command(s,'RC4_OPEN_MARKET',{agentId:merchant.id,marketId:market.marketId}).ok,true);
  return {s,ids,market,offer};
}

test('ER0 bulk E2E: Producer -> Merchant -> shortage Customer conserves resources and money with FIFO accounting',()=>{
  let {s,ids,market,offer}=setupBulkMarket();
  let producer=actor(s,ids.producer),merchant=actor(s,ids.merchant),customer=actor(s,ids.customer);
  const itemCount=s.rustPossessions.items.length,beforeMoney=totalCurrency(s);
  const beforeProducer=getBalance(s,producer.id),beforeMerchant=getBalance(s,merchant.id),beforeCustomer=getBalance(s,customer.id);

  const accepted=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:producer.id,offerId:offer.offerId,quantity:10});
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  const procurement=s.merchantListings.listings.find(l=>l.id===accepted.listingId);
  assert.equal(procurement.assetType,'BULK_RESOURCE');assert.equal(procurement.itemKind,'wood');assert.equal(procurement.quantity,10);
  assert.equal(procurement.unitPrice,3);assert.equal(procurement.buyOfferId,offer.offerId);
  assert.equal('itemInstanceId' in procurement,false);

  const travel1=command(s,'RC4_TRAVEL_TO_MARKET',{agentId:merchant.id,marketId:market.marketId});
  assert.equal(travel1.ok,true,JSON.stringify(travel1));merchant=actor(s,ids.merchant);runToMarket(s,merchant);
  const projection=projectHomeMarketForTrade(s,s.homeMarkets,{marketId:market.marketId}).market;
  assert.equal(verifyCanonicalMarketArrival(s,{agentId:merchant.id,market:projection}).state,'SAT');

  const buy30=command(s,'RC4_BUY_LISTING',{buyerId:merchant.id,listingId:procurement.id,listingRevision:procurement.revision,quantity:10});
  assert.equal(buy30.ok,true,JSON.stringify(buy30));
  producer=actor(s,ids.producer);merchant=actor(s,ids.merchant);customer=actor(s,ids.customer);
  assert.equal(materialAmount(s,producer,'wood'),90);
  assert.equal(materialAmount(s,merchant,'wood'),10);
  assert.equal(getBalance(s,producer.id),beforeProducer+30);
  assert.equal(getBalance(s,merchant.id),beforeMerchant-30);
  assert.equal(s.rustPossessions.items.length,itemCount,'bulk settlement mints no Rust item');

  let ledger=s.merchantLedgers.ledgers.find(l=>l.merchantId===merchant.id);
  assert.equal(ledger.purchases.length,1);
  assert.equal(ledger.purchases[0].assetType,'BULK_RESOURCE');
  assert.equal(ledger.purchases[0].quantity,10);
  assert.equal(ledger.purchases[0].remainingQuantity,10);
  assert.equal(ledger.purchases[0].unitPrice,3);

  const resale=command(s,'RC4_CREATE_BULK_LISTING',{agentId:merchant.id,itemKind:'wood',quantity:6,unitPrice:5});
  assert.equal(resale.ok,true,JSON.stringify(resale));
  let listed=s.merchantListings.listings.find(l=>l.id===resale.listingId);
  assert.equal(listed.assetType,'BULK_RESOURCE');assert.equal(listed.quantity,6);assert.equal(listed.revision,1);

  // Canonical travel is still mandatory; a known market is not remote-purchase permission.
  const remote=command(s,'RC4_BUY_LISTING',{buyerId:customer.id,listingId:listed.id,listingRevision:listed.revision,quantity:4});
  assert.equal(remote.ok,false);assert.ok(['arrival-evidence','still-travelling','travel-task'].includes(remote.reason)||remote.reason,'remote purchase must fail');

  const travel2=command(s,'RC4_TRAVEL_TO_MARKET',{agentId:customer.id,marketId:market.marketId});
  assert.equal(travel2.ok,true,JSON.stringify(travel2));customer=actor(s,ids.customer);runToMarket(s,customer);
  const buy20=command(s,'RC4_BUY_LISTING',{buyerId:customer.id,listingId:listed.id,listingRevision:listed.revision,quantity:4});
  assert.equal(buy20.ok,true,JSON.stringify(buy20));

  producer=actor(s,ids.producer);merchant=actor(s,ids.merchant);customer=actor(s,ids.customer);
  assert.equal(materialAmount(s,merchant,'wood'),6);
  assert.equal(materialAmount(s,customer,'wood'),4);
  assert.equal(getBalance(s,merchant.id),beforeMerchant-30+20);
  assert.equal(getBalance(s,customer.id),beforeCustomer-20);
  assert.equal(totalCurrency(s),beforeMoney);
  assert.equal(s.rustPossessions.items.length,itemCount);

  listed=s.merchantListings.listings.find(l=>l.id===resale.listingId);
  assert.equal(listed.quantity,2);assert.equal(listed.revision,2);assert.equal(listed.status,'OPEN');

  ledger=s.merchantLedgers.ledgers.find(l=>l.merchantId===merchant.id);
  assert.equal(ledger.purchases[0].remainingQuantity,6);
  assert.equal(ledger.sales.length,1);
  assert.equal(ledger.sales[0].assetType,'BULK_RESOURCE');
  assert.equal(ledger.sales[0].quantity,4);
  assert.equal(ledger.sales[0].cogs,12);
  assert.equal(ledger.sales[0].profit,8);
  assert.equal(ledger.revenue,20);
  assert.equal(ledger.costOfGoodsSold,12);
  assert.equal(ledger.realizedProfit,8);
  assert.equal(merchant.merchantTransactions,2);
  assert.equal(merchant.merchantExperience,2);
  assert.deepEqual(validate(s),[]);

  const wire=serialize(s);s=restore(wire);
  assert.equal(serialize(s),wire,'bulk market state survives save/load byte-stably');
  assert.equal(materialAmount(s,actor(s,ids.merchant),'wood'),6);
  assert.equal(materialAmount(s,actor(s,ids.customer),'wood'),4);
  assert.deepEqual(validate(s),[]);
});

test('ER0 bulk stale seller quantity fails atomically without money/resource/reservation leakage',()=>{
  const {s,ids,market,offer}=setupBulkMarket();
  let producer=actor(s,ids.producer),merchant=actor(s,ids.merchant);
  const accepted=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:producer.id,offerId:offer.offerId,quantity:10});
  assert.equal(accepted.ok,true);
  const listing=s.merchantListings.listings.find(l=>l.id===accepted.listingId);
  resourceStock(s,producer).wood=4;
  const travel=command(s,'RC4_TRAVEL_TO_MARKET',{agentId:merchant.id,marketId:market.marketId});
  assert.equal(travel.ok,true);merchant=actor(s,ids.merchant);runToMarket(s,merchant);
  const before=serialize(s),money=totalCurrency(s);
  const result=command(s,'RC4_BUY_LISTING',{buyerId:merchant.id,listingId:listing.id,listingRevision:listing.revision,quantity:10});
  assert.equal(result.ok,false);assert.equal(result.reason,'seller-resource');
  assert.equal(serialize(s),before);
  assert.equal(totalCurrency(s),money);
  assert.equal(s.merchantReservations.reservations.filter(r=>r.status==='ACTIVE').length,0);
});

test('ER0 bulk buyer capacity failure is atomic and source bytes do not move',()=>{
  const {s,ids,market,offer}=setupBulkMarket();
  const producer=actor(s,ids.producer),merchant=actor(s,ids.merchant);
  const accepted=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:producer.id,offerId:offer.offerId,quantity:10});
  const listing=s.merchantListings.listings.find(l=>l.id===accepted.listingId);
  resourceStock(s,merchant).wood=995;
  const travel=command(s,'RC4_TRAVEL_TO_MARKET',{agentId:merchant.id,marketId:market.marketId});
  assert.equal(travel.ok,true);runToMarket(s,actor(s,ids.merchant));
  const before=serialize(s);
  const result=command(s,'RC4_BUY_LISTING',{buyerId:merchant.id,listingId:listing.id,listingRevision:listing.revision,quantity:10});
  assert.equal(result.ok,false);assert.equal(result.reason,'buyer-resource-capacity');
  assert.equal(serialize(s),before);
});

test('ER0 bulk implementation keeps one resource, wallet, market and trade authority',()=>{
  const files=['material-economy.mjs','trade-rust-adapter.mjs','trade-kernel.mjs','merchant-listing.mjs','merchant-buy-offer.mjs','merchant-reservation.mjs','merchant-ledger.mjs','rc4-market-runtime.mjs'];
  const source=files.map(rel=>fs.readFileSync(new URL('../src/'+rel,import.meta.url),'utf8')).join('\n');
  for(const forbidden of ['producerInventory','crafterInventory','merchantMaterials','shopWallet','merchantWallet','bulkWallet','bulkInventory'])
    assert.equal(source.includes(forbidden),false,forbidden);
  assert.doesNotMatch(source,/Math\.random|Date\.now|new Date\(/);
});
