import test from 'node:test';
import assert from 'node:assert/strict';
import {command,step,serialize,restore,validate} from '../src/engine.mjs';
import {rc2World} from './fixtures/rc2-world.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {materialAmount} from '../src/material-economy.mjs';
import {getBalance,totalCurrency} from '../src/currency-wallet.mjs';
import {projectActorObservedDemand} from '../src/economic-demand.mjs';
import {observeRc4Markets} from '../src/rc4-market-observation.mjs';
import {projectHomeMarketForTrade} from '../src/home-market.mjs';
import {TRADE_ASSET_TYPES} from '../src/trade-assets.mjs';
import {settleBulkTradeAtomic} from '../src/trade-kernel.mjs';
import {createListingInCollection,bulkListingIdFor} from '../src/merchant-listing.mjs';
import {createReservation} from '../src/merchant-reservation.mjs';
import {resolveCostBasis,tradeReceiptFingerprint,tradeReceiptIntegrityFingerprint} from '../src/merchant-ledger.mjs';

function setupBulkProcurement({quantity=5,unitPrice=3,merchantAmount=0,producerAmount=20}={}){
  const s=rc2World(),merchant=s.agents[0],producer=s.agents[1];
  for(const a of [merchant,producer]){a.task=null;a.hp=a.satiety=a.energy=100;}
  resourceStock(s,merchant).ironOre=merchantAmount;
  resourceStock(s,producer).ironOre=producerAmount;
  const market=command(s,'RC4_CREATE_MARKET',{agentId:merchant.id});assert.equal(market.ok,true,JSON.stringify(market));
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{
    agentId:merchant.id,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,itemKind:'ironOre',quantityWanted:quantity,unitPrice
  });
  assert.equal(offer.ok,true,JSON.stringify(offer));
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:merchant.id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  assert.equal(command(s,'RC4_OPEN_MARKET',{agentId:merchant.id,marketId:market.marketId}).ok,true);
  const accepted=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:producer.id,offerId:offer.offerId,quantity});
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  const listing=s.merchantListings.listings.find(l=>l.id===accepted.listingId);assert.ok(listing);
  return {s,merchant,producer,market,offer,listing};
}
function arrive(s,agent,marketId){
  const travel=command(s,'RC4_TRAVEL_TO_MARKET',{agentId:agent.id,marketId});assert.equal(travel.ok,true,JSON.stringify(travel));
  for(let i=0;i<800&&agent.task?.path?.length;i++)step(s,1);
  assert.ok(agent.task?.rc4MarketTravel,'canonical market travel task retained');
  assert.equal(agent.task.path.length,0,'buyer reaches canonical market');
}

test('ER0B bulk BuyOffer -> procurement Listing keeps resource-counter identity and ER1 makes demand actionable',()=>{
  const {s,merchant,producer,offer,listing}=setupBulkProcurement();
  assert.equal(offer.assetType,TRADE_ASSET_TYPES.BULK_RESOURCE);
  assert.equal(listing.assetType,TRADE_ASSET_TYPES.BULK_RESOURCE);
  assert.equal(Object.hasOwn(listing,'itemInstanceId'),false);
  assert.equal(listing.itemKind,'ironOre');assert.equal(listing.quantity,5);assert.equal(listing.unitPrice,3);
  const projected=projectHomeMarketForTrade(s,s.homeMarkets,{marketId:offer.marketId});
  assert.equal(projected.ok,true,JSON.stringify(projected));
  producer.x=projected.market.x;producer.y=projected.market.y;
  observeRc4Markets(s);
  const demand=projectActorObservedDemand(s,producer);
  assert.equal(demand.status,'SAT');
  const iron=demand.signals.find(x=>x.itemKind==='ironOre');
  assert.ok(iron);assert.equal(iron.unit,'bulk-resource');assert.equal(iron.tradable,true);
  assert.equal(iron.liveDemandQuantity,5);assert.equal(iron.supplyQuantity,5);assert.equal(iron.shortageQuantity,0);
});

test('ER0B canonical Producer -> Merchant bulk settlement conserves money and exact resource quantity',()=>{
  let {s,merchant,producer,market,offer,listing}=setupBulkProcurement();
  const beforeMoney=totalCurrency(s),beforeMerchant=getBalance(s,merchant.id),beforeProducer=getBalance(s,producer.id);
  const beforeM=materialAmount(s,merchant,'ironOre'),beforeP=materialAmount(s,producer,'ironOre');
  arrive(s,merchant,market.marketId);
  const bought=command(s,'RC4_BUY_LISTING',{buyerId:merchant.id,listingId:listing.id,listingRevision:listing.revision});
  assert.equal(bought.ok,true,JSON.stringify(bought));
  assert.equal(bought.receipt.assetType,TRADE_ASSET_TYPES.BULK_RESOURCE);
  assert.equal(bought.receipt.itemInstanceId,null);assert.deepEqual(bought.receipt.itemIds,[]);
  assert.equal(bought.receipt.quantity,5);assert.equal(bought.receipt.totalPrice,15);
  assert.equal(materialAmount(s,merchant,'ironOre'),beforeM+5);
  assert.equal(materialAmount(s,producer,'ironOre'),beforeP-5);
  assert.equal(getBalance(s,merchant.id),beforeMerchant-15);
  assert.equal(getBalance(s,producer.id),beforeProducer+15);
  assert.equal(totalCurrency(s),beforeMoney);
  const afterListing=s.merchantListings.listings.find(l=>l.id===listing.id);
  const afterOffer=s.merchantBuyOffers.buyOffers.find(o=>o.offerId===offer.offerId);
  assert.equal(afterListing.status,'FILLED');assert.equal(afterListing.quantity,0);
  assert.equal(afterOffer.status,'FILLED');
  const reservation=s.merchantReservations.reservations.find(r=>r.transactionId===bought.transactionId);
  assert.equal(reservation.status,'COMMITTED');assert.equal(reservation.assetType,TRADE_ASSET_TYPES.BULK_RESOURCE);
  assert.deepEqual(reservation.itemIds,[]);
  const ledger=s.merchantLedgers.ledgers.find(l=>l.merchantId===merchant.id);
  assert.equal(ledger.purchases.length,1);
  assert.equal(ledger.purchases[0].assetType,TRADE_ASSET_TYPES.BULK_RESOURCE);
  assert.equal(ledger.purchases[0].remainingQuantity,5);
  assert.deepEqual(ledger.purchases[0].itemIds,[]);
  const liveMerchant=s.agents.find(a=>a.id===merchant.id);
  assert.equal(liveMerchant.merchantTransactions,1);assert.equal(liveMerchant.merchantExperience,1);
  assert.deepEqual(validate(s),[]);

  const wire=serialize(s);s=restore(wire);
  assert.equal(serialize(s),wire,'bulk trade roots persist byte-stably');
  assert.equal(materialAmount(s,s.agents.find(a=>a.id===merchant.id),'ironOre'),beforeM+5);
  assert.deepEqual(validate(s),[]);
});

test('ER0B exact replay is a no-op and cannot pay or transfer bulk quantity twice',()=>{
  const {s,merchant,producer,market,listing}=setupBulkProcurement();
  arrive(s,merchant,market.marketId);
  const bought=command(s,'RC4_BUY_LISTING',{buyerId:merchant.id,listingId:listing.id,listingRevision:listing.revision});
  assert.equal(bought.ok,true);
  const before=serialize(s),r=bought.receipt;
  const replay=settleBulkTradeAtomic(s,{
    assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,transactionId:r.transactionId,marketId:r.marketId,
    sellerId:r.sellerId,buyerId:r.buyerId,itemKind:r.itemKind,quantity:r.quantity,unitPrice:r.unitPrice,
    totalPrice:r.totalPrice,listingId:r.listingId,reservationId:r.reservationId
  });
  assert.equal(replay.ok,true);assert.equal(replay.duplicate,true);
  assert.equal(serialize(s),before);
  assert.equal(materialAmount(s,merchant,'ironOre'),5);
  assert.equal(materialAmount(s,producer,'ironOre'),15);
});

test('ER0B destination capacity failure rolls back wallet, resource, Listing and Reservation together',()=>{
  const {s,merchant,producer,market,listing}=setupBulkProcurement({quantity:2,unitPrice:4,merchantAmount:255,producerAmount:10});
  arrive(s,merchant,market.marketId);
  const before=serialize(s),money=totalCurrency(s);
  const result=command(s,'RC4_BUY_LISTING',{buyerId:merchant.id,listingId:listing.id,listingRevision:listing.revision});
  assert.equal(result.ok,false);assert.equal(result.reason,'resource-transfer');
  assert.equal(serialize(s),before,'failed staged settlement must not mutate live world');
  assert.equal(totalCurrency(s),money);
  assert.equal(materialAmount(s,merchant,'ironOre'),255);
  assert.equal(materialAmount(s,producer,'ironOre'),10);
  assert.equal(s.merchantReservations.reservations.length,0);
  assert.equal(s.merchantListings.listings.find(l=>l.id===listing.id).status,'OPEN');
});

test('ER0B Reservation prevents cross-listing bulk oversell from one canonical resource account',()=>{
  const s=rc2World(),seller=s.agents[1],buyer=s.agents[0];
  resourceStock(s,seller).ironOre=5;resourceStock(s,buyer).ironOre=0;
  const id1=bulkListingIdFor({marketId:'M:BULK',sellerId:seller.id,itemKind:'ironOre',requestId:'A'});
  const id2=bulkListingIdFor({marketId:'M:BULK',sellerId:seller.id,itemKind:'ironOre',requestId:'B'});
  const a=createListingInCollection(s.merchantListings,{id:id1,marketId:'M:BULK',sellerId:seller.id,itemKind:'ironOre',
    assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,quantity:3,unitPrice:2,status:'OPEN'});
  assert.equal(a.state,'SAT');
  const b=createListingInCollection(a.collection,{id:id2,marketId:'M:BULK',sellerId:seller.id,itemKind:'ironOre',
    assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,quantity:3,unitPrice:2,status:'OPEN'});
  assert.equal(b.state,'SAT');
  const r1=createReservation(s,s.merchantReservations,{listing:a.listing,listingRevision:1,buyerId:buyer.id,quantity:3,createdTick:s.tick});
  assert.equal(r1.state,'SAT');
  const r2=createReservation(s,r1.reservationState,{listing:b.listing,listingRevision:1,buyerId:buyer.id,quantity:3,createdTick:s.tick});
  assert.equal(r2.state,'VIOL');assert.equal(r2.reason,'resource-reserved');
  assert.equal(r1.reservationState.reservations.length,1);
  assert.equal(materialAmount(s,seller,'ironOre'),5,'reservation is a lock, not a resource writer');
});

test('ER0B Merchant bulk purchase creates deterministic FIFO cost basis without fake item ids',()=>{
  const {s,merchant,market,listing}=setupBulkProcurement({quantity:5,unitPrice:3});
  arrive(s,merchant,market.marketId);
  assert.equal(command(s,'RC4_BUY_LISTING',{buyerId:merchant.id,listingId:listing.id,listingRevision:listing.revision}).ok,true);
  const ledger=s.merchantLedgers.ledgers.find(l=>l.merchantId===merchant.id);
  const sale={
    assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,transactionId:'TX:BULK:SALE',eventId:'TRADE:TX:BULK:SALE',
    marketId:'M:BULK',listingId:'L:BULK',reservationId:'R:BULK',buyerId:99,sellerId:merchant.id,
    itemKind:'ironOre',itemInstanceId:null,itemIds:[],quantity:3,unitPrice:5,totalPrice:15
  };
  sale.fingerprint=tradeReceiptFingerprint(sale);sale.integrityFingerprint=tradeReceiptIntegrityFingerprint(sale);
  const basis=resolveCostBasis(ledger,sale);
  assert.equal(basis.state,'SAT');assert.equal(basis.source,'purchase');assert.equal(basis.cogs,9);
  assert.equal(basis.parts.reduce((n,p)=>n+p.quantity,0),3);
});

test('ER0B old physical item trade remains legacy asset semantics with no new required field',()=>{
  const s=rc2World();
  const legacy=s.merchantListings;
  assert.ok(legacy);
  for(const row of legacy.listings)assert.equal(row.assetType,undefined);
});
