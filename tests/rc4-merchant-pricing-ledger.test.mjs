import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createListing,validateListing,transitionListing,LISTING_STATUS} from '../src/merchant-listing.mjs';
import {createBuyOffer,validateBuyOffer,transitionBuyOffer,BUY_OFFER_STATUS} from '../src/merchant-buy-offer.mjs';
import {quoteAskPrice,deriveScarcityAdjustmentBps} from '../src/merchant-pricing.mjs';
import {createMerchantLedger,applyTradeKernelCommitToLedger,assessTradeKernelResult,validateCommittedTradeReceipt,validateMerchantLedger,serializeMerchantLedger,restoreMerchantLedger} from '../src/merchant-ledger.mjs';

const receipt=overrides=>({
  transactionId:'tx-1',fingerprint:'fp:tx-1',eventId:'TRADE:tx-1',marketId:'M1',listingId:'L1',reservationId:'R1',
  buyerId:1,sellerId:2,itemKind:'STONE_PICKAXE',itemIds:[77],quantity:1,unitPrice:70,totalPrice:70,...overrides,
});
const committed=r=>({ok:true,duplicate:false,receipt:r});
const failed=(reason='rejected')=>({ok:false,reason});
function saleReceipt(overrides={}){
  return receipt({transactionId:'tx-2',fingerprint:'fp:tx-2',eventId:'TRADE:tx-2',listingId:'L2',reservationId:'R2',sellerId:1,buyerId:3,unitPrice:100,totalPrice:100,...overrides});
}
function buyPickaxe(){
  const result=applyTradeKernelCommitToLedger(createMerchantLedger(1),committed(receipt()));
  assert.equal(result.state,'SAT');assert.equal(result.duplicate,false);return result.ledger;
}

test('canonical Listing matches RC4 Trade Kernel integer price/id boundaries',()=>{
  const made=createListing({listingId:'L1',marketId:'M1',sellerId:1,itemKind:'STONE_PICKAXE',itemInstanceId:77,quantity:1,unitPrice:100,createdTick:10});
  assert.equal(made.state,'SAT');assert.deepEqual(validateListing(made.listing),[]);
  assert.deepEqual(Object.keys(made.listing),['listingId','marketId','sellerId','itemKind','itemInstanceId','quantity','unitPrice','createdTick','status']);
  for(const bad of [-1,0,1.5,NaN,Infinity])assert.equal(createListing({...made.listing,listingId:'L2',unitPrice:bad}).state,'VIOL');
  const closed=transitionListing(made.listing,LISTING_STATUS.CLOSED);assert.equal(closed.state,'SAT');assert.equal(closed.listing.status,'CLOSED');
});

test('canonical BuyOffer is reference-only and uses Trade Kernel-compatible integer prices',()=>{
  const made=createBuyOffer({offerId:'O1',marketId:'M1',buyerId:1,itemKind:'STONE_PICKAXE',quantityWanted:2,unitPrice:65,createdTick:11});
  assert.equal(made.state,'SAT');assert.deepEqual(validateBuyOffer(made.offer),[]);
  assert.deepEqual(Object.keys(made.offer),['offerId','marketId','buyerId','itemKind','quantityWanted','unitPrice','createdTick','status']);
  assert.equal(createBuyOffer({...made.offer,offerId:'O2',unitPrice:65.5}).state,'VIOL');
  const canceled=transitionBuyOffer(made.offer,BUY_OFFER_STATUS.CANCELED);assert.equal(canceled.state,'SAT');assert.equal(canceled.offer.status,'CANCELED');
  assert.equal(transitionBuyOffer(canceled.offer,BUY_OFFER_STATUS.FILLED).state,'VIOL');
});

test('Pricing V1 is deterministic, integer-currency, and bounded by merchant-local scarcity only',()=>{
  const input={acquisitionCost:70,marginBps:3000,scarcity:{localStock:1,targetStock:2,recentDemand:2}};
  const a=quoteAskPrice(input),b=quoteAskPrice(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(a,b);assert.equal(a.state,'SAT');assert.equal(a.askPrice,a.acquisitionCost+a.marginAmount+a.scarcityAdjustment);assert.ok(Number.isSafeInteger(a.askPrice));
  assert.ok(Math.abs(a.scarcityAdjustmentBps)<=2500);assert.equal(deriveScarcityAdjustmentBps({localStock:999,targetStock:1,recentDemand:0}),-2500);
  assert.equal(quoteAskPrice({marginBps:1000}).state,'UNKNOWN');
});

test('negative fractional NaN and Infinity prices are rejected',()=>{
  for(const bad of [-1,1.5,NaN,Infinity])assert.equal(quoteAskPrice({acquisitionCost:bad,marginBps:1000}).state,'VIOL');
  for(const bad of [-1,0,1.5,NaN,Infinity])assert.ok(validateCommittedTradeReceipt(receipt({unitPrice:bad,totalPrice:bad})).length>0);
});

test('raw proposal, failed result, UNKNOWN result and duplicate result never update ledger',()=>{
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger);
  assert.equal(applyTradeKernelCommitToLedger(ledger,{transactionId:'proposal-only'}).state,'UNKNOWN');
  assert.equal(applyTradeKernelCommitToLedger(ledger,failed('insufficient-funds')).state,'VIOL');
  assert.equal(applyTradeKernelCommitToLedger(ledger,{}).state,'UNKNOWN');
  const duplicate={ok:true,duplicate:true,receipt:receipt()};const dup=applyTradeKernelCommitToLedger(ledger,duplicate);
  assert.equal(dup.state,'SAT');assert.equal(dup.duplicate,true);assert.equal(JSON.stringify(dup.ledger),before);
});

test('Trade Kernel success is normalized to VERIFIED + COMMITTED accounting evidence',()=>{
  const assessed=assessTradeKernelResult(committed(receipt()));
  assert.equal(assessed.state,'SAT');assert.equal(assessed.verification,'VERIFIED');assert.equal(assessed.commitStatus,'COMMITTED');assert.equal(assessed.duplicate,false);
});

test('purchase transaction establishes exact acquisition cost basis per item instance',()=>{
  const ledger=buyPickaxe();assert.equal(ledger.purchases.length,1);assert.equal(ledger.purchases[0].unitPrice,70);assert.deepEqual(ledger.purchases[0].itemIds,[77]);assert.deepEqual(ledger.purchases[0].remainingItemIds,[77]);
  assert.equal(ledger.revenue,0);assert.equal(ledger.costOfGoodsSold,0);assert.equal(ledger.realizedProfit,0);assert.deepEqual(validateMerchantLedger(ledger),[]);
});

test('Revenue != Profit: buy Pickaxe 70 then sell 100 => Revenue 100 COGS 70 Profit 30',()=>{
  const result=applyTradeKernelCommitToLedger(buyPickaxe(),committed(saleReceipt()));assert.equal(result.state,'SAT');
  assert.equal(result.ledger.revenue,100);assert.equal(result.ledger.costOfGoodsSold,70);assert.equal(result.ledger.realizedProfit,30);
  assert.equal(result.ledger.sales[0].costBasisSource,'purchase');assert.deepEqual(result.ledger.purchases[0].remainingItemIds,[]);
});

test('replay of the same committed result does not increase Merchant Ledger',()=>{
  const once=applyTradeKernelCommitToLedger(buyPickaxe(),committed(saleReceipt())),snapshot=JSON.stringify(once.ledger);
  const replay=applyTradeKernelCommitToLedger(once.ledger,committed(saleReceipt()));assert.equal(replay.state,'SAT');assert.equal(replay.duplicate,true);assert.equal(JSON.stringify(replay.ledger),snapshot);
});

test('self trade, malformed receipt and total mismatch are VIOL and immutable',()=>{
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger);
  for(const bad of [receipt({buyerId:2,sellerId:2}),receipt({totalPrice:71}),receipt({eventId:'wrong'})]){
    const r=applyTradeKernelCommitToLedger(ledger,committed(bad));assert.equal(r.state,'VIOL');assert.equal(JSON.stringify(r.ledger),before);
  }
});

test('self-produced sale without verified production/material evidence stays UNKNOWN and immutable',()=>{
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger),sale=saleReceipt({itemIds:[999]});
  const noBasis=applyTradeKernelCommitToLedger(ledger,committed(sale));
  assert.equal(noBasis.state,'UNKNOWN');assert.equal(noBasis.reason,'production-cost-evidence');assert.equal(JSON.stringify(noBasis.ledger),before);
});

test('verified production/material evidence supplies real self-produced cost basis',()=>{
  const ledger=createMerchantLedger(1),sale=saleReceipt({itemIds:[500]});
  const productionEvidence={verification:'VERIFIED',evidenceId:'production-cost:500',itemInstanceId:500,totalCost:55,sourceEvidenceIds:['craft-order:9','material-receipt:9']};
  const result=applyTradeKernelCommitToLedger(ledger,committed(sale),{productionEvidence});
  assert.equal(result.state,'SAT');assert.equal(result.ledger.revenue,100);assert.equal(result.ledger.costOfGoodsSold,55);assert.equal(result.ledger.realizedProfit,45);assert.equal(result.ledger.sales[0].costBasisSource,'production');
});

test('multi-item purchase preserves item-level cost basis and exact COGS',()=>{
  const buy=receipt({itemIds:[77,78],quantity:2,unitPrice:70,totalPrice:140});
  const purchased=applyTradeKernelCommitToLedger(createMerchantLedger(1),committed(buy));assert.equal(purchased.state,'SAT');
  const sell=saleReceipt({itemIds:[78],quantity:1,unitPrice:100,totalPrice:100});
  const sold=applyTradeKernelCommitToLedger(purchased.ledger,committed(sell));assert.equal(sold.state,'SAT');assert.equal(sold.ledger.costOfGoodsSold,70);assert.deepEqual(sold.ledger.purchases[0].remainingItemIds,[77]);
});

test('save/load preserves item-level cost basis and totals byte-for-byte',()=>{
  const bought=buyPickaxe(),wire=serializeMerchantLedger(bought),restored=restoreMerchantLedger(wire);assert.equal(serializeMerchantLedger(restored),wire);
  const sold=applyTradeKernelCommitToLedger(restored,committed(saleReceipt()));assert.equal(sold.state,'SAT');
  const soldWire=serializeMerchantLedger(sold.ledger),soldRestored=restoreMerchantLedger(soldWire);assert.equal(serializeMerchantLedger(soldRestored),soldWire);assert.equal(soldRestored.realizedProfit,30);
});

test('RC4 pricing/ledger modules stay pure and outside forbidden authorities',()=>{
  for(const rel of ['merchant-listing.mjs','merchant-buy-offer.mjs','merchant-pricing.mjs','merchant-ledger.mjs']){
    const src=fs.readFileSync(new URL('../src/'+rel,import.meta.url),'utf8');
    for(const token of ['Math.random','Date.now','new Date(','document.','window.','state.rng','s.rng',"from './engine", "from './rust-possessions", "from './individual-housing", "from './profession", "kingdom-market", "kingdom-household", 'wallet.', 'rustPossessions'])
      assert.equal(src.includes(token),false,rel+': '+token);
  }
});
