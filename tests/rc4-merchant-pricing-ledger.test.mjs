import test from 'node:test';
import assert from 'node:assert/strict';
import {createListing,validateListing,transitionListing,LISTING_STATUS} from '../src/merchant-listing.mjs';
import {createBuyOffer,validateBuyOffer,transitionBuyOffer,BUY_OFFER_STATUS} from '../src/merchant-buy-offer.mjs';
import {quoteAskPrice,deriveScarcityAdjustmentBps} from '../src/merchant-pricing.mjs';
import {createMerchantLedger,applyCommittedTransactionToLedger,validateMerchantLedger,serializeMerchantLedger,restoreMerchantLedger,validateTradeProposal} from '../src/merchant-ledger.mjs';

const tx=overrides=>({
  transactionId:'tx-1',marketId:'market-1',sellerId:2,buyerId:1,itemKind:'STONE_PICKAXE',itemInstanceId:77,
  quantity:1,unitPrice:70,totalPrice:70,listingId:'listing-1',reservationId:'reservation-1',...overrides,
});
const committed=transaction=>({verification:'VERIFIED',commitStatus:'COMMITTED',transaction});

function buyPickaxe(){
  const base=createMerchantLedger(1);
  const result=applyCommittedTransactionToLedger(base,committed(tx()));
  assert.equal(result.state,'SAT');assert.equal(result.duplicate,false);
  return result.ledger;
}

test('canonical Listing is reference-only and rejects invalid prices',()=>{
  const made=createListing({listingId:'L1',marketId:'M1',sellerId:1,itemKind:'STONE_PICKAXE',itemInstanceId:77,quantity:1,unitPrice:100,createdTick:10});
  assert.equal(made.state,'SAT');assert.deepEqual(validateListing(made.listing),[]);
  assert.deepEqual(Object.keys(made.listing),['listingId','marketId','sellerId','itemKind','itemInstanceId','quantity','unitPrice','createdTick','status']);
  assert.equal(createListing({...made.listing,listingId:'L2',unitPrice:-1}).state,'VIOL');
  assert.equal(createListing({...made.listing,listingId:'L3',unitPrice:NaN}).state,'VIOL');
  assert.equal(createListing({...made.listing,listingId:'L4',unitPrice:Infinity}).state,'VIOL');
  const closed=transitionListing(made.listing,LISTING_STATUS.CLOSED);assert.equal(closed.state,'SAT');assert.equal(closed.listing.status,'CLOSED');
});

test('canonical BuyOffer is reference-only and lifecycle is bounded',()=>{
  const made=createBuyOffer({offerId:'O1',marketId:'M1',buyerId:1,itemKind:'STONE_PICKAXE',quantityWanted:2,unitPrice:65,createdTick:11});
  assert.equal(made.state,'SAT');assert.deepEqual(validateBuyOffer(made.offer),[]);
  assert.deepEqual(Object.keys(made.offer),['offerId','marketId','buyerId','itemKind','quantityWanted','unitPrice','createdTick','status']);
  const canceled=transitionBuyOffer(made.offer,BUY_OFFER_STATUS.CANCELED);assert.equal(canceled.state,'SAT');assert.equal(canceled.offer.status,'CANCELED');
  assert.equal(transitionBuyOffer(canceled.offer,BUY_OFFER_STATUS.FILLED).state,'VIOL');
});

test('Pricing V1 is deterministic and uses bounded merchant-local scarcity only',()=>{
  const input={acquisitionCost:70,marginBps:3000,scarcity:{localStock:1,targetStock:2,recentDemand:2}};
  const a=quoteAskPrice(input),b=quoteAskPrice(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(a,b);assert.equal(a.state,'SAT');assert.equal(a.askPrice,a.acquisitionCost+a.marginAmount+a.scarcityAdjustment);
  assert.ok(Math.abs(a.scarcityAdjustmentBps)<=2500);
  assert.equal(deriveScarcityAdjustmentBps({localStock:999,targetStock:1,recentDemand:0}),-2500);
  assert.equal(quoteAskPrice({marginBps:1000}).state,'UNKNOWN');
});

test('negative NaN and Infinity prices are rejected by pricing and transaction validation',()=>{
  for(const bad of [-1,NaN,Infinity])assert.equal(quoteAskPrice({acquisitionCost:bad,marginBps:1000}).state,'VIOL');
  for(const bad of [-1,NaN,Infinity])assert.ok(validateTradeProposal(tx({unitPrice:bad,totalPrice:bad})).length>0);
});

test('purchase transaction establishes exact acquisition cost basis',()=>{
  const ledger=buyPickaxe();assert.equal(ledger.purchases.length,1);assert.equal(ledger.purchases[0].unitPrice,70);
  assert.equal(ledger.purchases[0].totalPrice,70);assert.equal(ledger.purchases[0].remainingQuantity,1);
  assert.equal(ledger.revenue,0);assert.equal(ledger.costOfGoodsSold,0);assert.equal(ledger.realizedProfit,0);
  assert.deepEqual(validateMerchantLedger(ledger),[]);
});

test('Revenue != Profit: buy 70 then sell 100 records Revenue 100 COGS 70 Profit 30',()=>{
  const bought=buyPickaxe();
  const sale=tx({transactionId:'tx-2',sellerId:1,buyerId:3,unitPrice:100,totalPrice:100,listingId:'listing-2',reservationId:'reservation-2'});
  const result=applyCommittedTransactionToLedger(bought,committed(sale));assert.equal(result.state,'SAT');
  assert.equal(result.ledger.sales.length,1);assert.equal(result.ledger.revenue,100);assert.equal(result.ledger.costOfGoodsSold,70);assert.equal(result.ledger.realizedProfit,30);
  assert.equal(result.ledger.sales[0].costBasisSource,'purchase');assert.equal(result.ledger.purchases[0].remainingQuantity,0);
});

test('replay does not increase Merchant Ledger',()=>{
  const bought=buyPickaxe(),sale=tx({transactionId:'tx-2',sellerId:1,buyerId:3,unitPrice:100,totalPrice:100,listingId:'listing-2',reservationId:'reservation-2'});
  const once=applyCommittedTransactionToLedger(bought,committed(sale));const snapshot=JSON.stringify(once.ledger);
  const replay=applyCommittedTransactionToLedger(once.ledger,committed(sale));assert.equal(replay.state,'SAT');assert.equal(replay.duplicate,true);assert.equal(JSON.stringify(replay.ledger),snapshot);
});

test('failed transaction does not increase Merchant Ledger',()=>{
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger);
  const failed=applyCommittedTransactionToLedger(ledger,{verification:'VERIFIED',commitStatus:'FAILED',transaction:tx()});
  assert.equal(failed.state,'VIOL');assert.equal(JSON.stringify(failed.ledger),before);
});

test('UNKNOWN transaction/evidence does not increase Merchant Ledger',()=>{
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger);
  const unknown=applyCommittedTransactionToLedger(ledger,{verification:'UNKNOWN',commitStatus:'COMMITTED',transaction:tx()});
  assert.equal(unknown.state,'UNKNOWN');assert.equal(JSON.stringify(unknown.ledger),before);
  const selfProducedSale=tx({transactionId:'tx-self',sellerId:1,buyerId:3,unitPrice:100,totalPrice:100,itemInstanceId:999});
  const noBasis=applyCommittedTransactionToLedger(ledger,committed(selfProducedSale));
  assert.equal(noBasis.state,'UNKNOWN');assert.equal(noBasis.reason,'production-cost-evidence');assert.equal(JSON.stringify(noBasis.ledger),before);
});

test('verified production/material evidence can supply cost basis without inventing a second inventory',()=>{
  const ledger=createMerchantLedger(1),sale=tx({transactionId:'tx-prod-sale',sellerId:1,buyerId:3,itemInstanceId:500,unitPrice:100,totalPrice:100});
  const productionEvidence={verification:'VERIFIED',evidenceId:'production-cost:500',itemInstanceId:500,totalCost:55,sourceEvidenceIds:['craft-order:9','material-receipt:9']};
  const result=applyCommittedTransactionToLedger(ledger,committed(sale),{productionEvidence});
  assert.equal(result.state,'SAT');assert.equal(result.ledger.revenue,100);assert.equal(result.ledger.costOfGoodsSold,55);assert.equal(result.ledger.realizedProfit,45);assert.equal(result.ledger.sales[0].costBasisSource,'production');
});

test('self trade and mismatched total are VIOL and cannot update ledger',()=>{
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger);
  for(const bad of [tx({buyerId:2,sellerId:2}),tx({totalPrice:71})]){
    const r=applyCommittedTransactionToLedger(ledger,committed(bad));assert.equal(r.state,'VIOL');assert.equal(JSON.stringify(r.ledger),before);
  }
});

test('save/load preserves cost basis and realized totals byte-for-byte',()=>{
  const bought=buyPickaxe(),wire=serializeMerchantLedger(bought),restored=restoreMerchantLedger(wire);
  assert.equal(serializeMerchantLedger(restored),wire);
  const sale=tx({transactionId:'tx-2',sellerId:1,buyerId:3,unitPrice:100,totalPrice:100,listingId:'listing-2',reservationId:'reservation-2'});
  const sold=applyCommittedTransactionToLedger(restored,committed(sale));assert.equal(sold.state,'SAT');
  const soldWire=serializeMerchantLedger(sold.ledger),soldRestored=restoreMerchantLedger(soldWire);
  assert.equal(serializeMerchantLedger(soldRestored),soldWire);assert.equal(soldRestored.revenue,100);assert.equal(soldRestored.costOfGoodsSold,70);assert.equal(soldRestored.realizedProfit,30);
});

import fs from 'node:fs';

test('RC4 pricing/ledger modules stay pure and outside forbidden authorities',()=>{
  for(const rel of ['merchant-listing.mjs','merchant-buy-offer.mjs','merchant-pricing.mjs','merchant-ledger.mjs']){
    const src=fs.readFileSync(new URL('../src/'+rel,import.meta.url),'utf8');
    for(const token of ['Math.random','Date.now','new Date(','document.','window.','state.rng','s.rng',"from './engine", "from './rust-possessions", "from './individual-housing", "from './profession"])
      assert.equal(src.includes(token),false,rel+': '+token);
  }
});
