import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createListing,validateListing,updateListing,transitionListing,LISTING_STATUS,
  createListingCollection,validateListingCollection,createListingInCollection,updateListingInCollection,transitionListingInCollection,
  freezeListingReservationSnapshot,assessListingReservationRevision,serializeListingCollection,restoreListingCollection
} from '../src/merchant-listing.mjs';
import {createBuyOffer,validateBuyOffer,transitionBuyOffer,BUY_OFFER_STATUS} from '../src/merchant-buy-offer.mjs';
import {quoteAskPrice,deriveScarcityAdjustmentBps} from '../src/merchant-pricing.mjs';
import {
  createMerchantLedger,applyTradeKernelCommitToLedger,assessTradeKernelResult,validateCommittedTradeReceipt,
  validateMerchantLedger,serializeMerchantLedger,restoreMerchantLedger,tradeReceiptFingerprint,tradeReceiptIntegrityFingerprint
} from '../src/merchant-ledger.mjs';

function canonicalReceipt(overrides={}){
  const row={
    transactionId:'tx-1',eventId:'TRADE:tx-1',marketId:'M1',listingId:'L1',reservationId:'R1',
    buyerId:1,sellerId:2,itemKind:'STONE_PICKAXE',itemInstanceId:77,itemIds:[77],quantity:1,unitPrice:70,totalPrice:70,
    ...overrides,
  };
  if(!('eventId' in overrides))row.eventId='TRADE:'+row.transactionId;
  row.itemIds=row.itemIds.slice().sort((a,b)=>a-b);
  row.fingerprint=tradeReceiptFingerprint(row);
  row.integrityFingerprint=tradeReceiptIntegrityFingerprint(row);
  return row;
}
const committed=(r,{duplicate=false,stateReceipt=r}={})=>({
  ok:true,duplicate,receipt:r,
  state:{tradeReplay:{version:'RC4-trade-replay-1',receipts:[structuredClone(stateReceipt)]}},
});
const failed=(reason='rejected')=>({ok:false,reason});
function saleReceipt(overrides={}){
  return canonicalReceipt({transactionId:'tx-2',listingId:'L2',reservationId:'R2',sellerId:1,buyerId:3,unitPrice:100,totalPrice:100,...overrides});
}
function buyPickaxe(){
  const result=applyTradeKernelCommitToLedger(createMerchantLedger(1),committed(canonicalReceipt()));
  assert.equal(result.state,'SAT');assert.equal(result.duplicate,false);return result.ledger;
}
function openListing(id='L1',itemInstanceId=77){
  return {id,marketId:'M1',sellerId:2,itemKind:'STONE_PICKAXE',itemInstanceId,quantity:1,unitPrice:100};
}

test('canonical Listing vocabulary is directly compatible with RC4 Trade Kernel',()=>{
  const made=createListing(openListing());
  assert.equal(made.state,'SAT');assert.deepEqual(validateListing(made.listing),[]);
  assert.deepEqual(Object.keys(made.listing),['id','marketId','sellerId','itemKind','itemInstanceId','quantity','unitPrice','revision','status']);
  assert.equal(made.listing.id,'L1');assert.equal(made.listing.revision,1);assert.equal(made.listing.status,'OPEN');
  assert.equal(createListing({...openListing(),id:undefined}).state,'VIOL');
  assert.equal(createListing({listingId:'L-legacy',marketId:'M1',sellerId:2,itemKind:'STONE_PICKAXE',itemInstanceId:77,quantity:1,unitPrice:100}).state,'VIOL');
});

test('listing revision starts >=1 and authoritative mutations increment it deterministically',()=>{
  const made=createListing(openListing()).listing;
  const repriced=updateListing(made,{unitPrice:110});assert.equal(repriced.state,'SAT');assert.equal(repriced.listing.revision,2);
  const resized=updateListing(repriced.listing,{quantity:2});assert.equal(resized.listing.revision,3);
  const duplicate=updateListing(resized.listing,{quantity:2});assert.equal(duplicate.duplicate,true);assert.equal(duplicate.listing.revision,3);
  const closed=transitionListing(resized.listing,LISTING_STATUS.CLOSED);assert.equal(closed.state,'SAT');assert.equal(closed.listing.revision,4);
});

test('reservation freezes listingRevision; stale revision is rejected and matching revision is accepted',()=>{
  const listing=createListing(openListing()).listing;
  const frozen=freezeListingReservationSnapshot(listing);assert.equal(frozen.state,'SAT');assert.deepEqual(frozen.snapshot,{listingId:'L1',listingRevision:1});
  assert.equal(assessListingReservationRevision(listing,{...frozen.snapshot}).state,'SAT');
  const updated=updateListing(listing,{unitPrice:101}).listing;
  const stale=assessListingReservationRevision(updated,{...frozen.snapshot});assert.equal(stale.state,'VIOL');assert.equal(stale.reason,'listing-stale');
  assert.equal(assessListingReservationRevision(updated,{listingId:'L1',listingRevision:2}).state,'SAT');
});

test('collection authority rejects duplicate OPEN listing for same physical itemInstanceId',()=>{
  let collection=createListingCollection();
  const first=createListingInCollection(collection,openListing('L1',77));assert.equal(first.state,'SAT');collection=first.collection;
  const duplicateItem=createListingInCollection(collection,openListing('L2',77));assert.equal(duplicateItem.state,'VIOL');assert.equal(duplicateItem.reason,'item-already-listed');
  assert.equal(collection.listings.length,1);assert.deepEqual(validateListingCollection(collection),[]);
});

test('duplicate create replay is idempotent and cannot reset listing revision or status',()=>{
  let collection=createListingCollection();
  collection=createListingInCollection(collection,openListing('L1',77)).collection;
  collection=updateListingInCollection(collection,'L1',{unitPrice:120}).collection;
  const before=JSON.stringify(collection),replay=createListingInCollection(collection,openListing('L1',77));
  assert.equal(replay.state,'SAT');assert.equal(replay.duplicate,true);assert.equal(JSON.stringify(replay.collection),before);assert.equal(replay.listing.revision,2);
  const conflict=createListingInCollection(collection,openListing('L1',88));assert.equal(conflict.state,'VIOL');assert.equal(conflict.reason,'listing-id-conflict');
});

test('CLOSED listing releases physical listing lock; reopen rechecks lock; CANCELED/FILLED are terminal',()=>{
  let collection=createListingCollection();collection=createListingInCollection(collection,openListing('L1',77)).collection;
  const closed=transitionListingInCollection(collection,'L1',LISTING_STATUS.CLOSED);assert.equal(closed.state,'SAT');collection=closed.collection;
  const second=createListingInCollection(collection,openListing('L2',77));assert.equal(second.state,'SAT');collection=second.collection;
  const blocked=transitionListingInCollection(collection,'L1',LISTING_STATUS.OPEN);assert.equal(blocked.state,'VIOL');assert.equal(blocked.reason,'item-already-listed');
  collection=transitionListingInCollection(collection,'L2',LISTING_STATUS.CANCELED).collection;
  const reopened=transitionListingInCollection(collection,'L1',LISTING_STATUS.OPEN);assert.equal(reopened.state,'SAT');assert.equal(reopened.listing.revision,3);
  assert.equal(transitionListingInCollection(collection,'L2',LISTING_STATUS.OPEN).state,'VIOL');
});

test('save/load preserves listing revision and duplicate-item invariant',()=>{
  let collection=createListingCollection();collection=createListingInCollection(collection,openListing('L1',77)).collection;
  collection=updateListingInCollection(collection,'L1',{unitPrice:125}).collection;
  const wire=serializeListingCollection(collection),restored=restoreListingCollection(wire);
  assert.equal(restored.listings[0].revision,2);assert.equal(serializeListingCollection(restored),wire);assert.deepEqual(validateListingCollection(restored),[]);
  const corrupt=structuredClone(restored);corrupt.listings.push({...corrupt.listings[0],id:'L2'});
  assert.throws(()=>restoreListingCollection(JSON.stringify(corrupt)),/listing-collection-invalid/);
});

test('canonical BuyOffer remains reference-only and uses integer prices',()=>{
  const made=createBuyOffer({offerId:'O1',marketId:'M1',buyerId:1,itemKind:'STONE_PICKAXE',quantityWanted:2,unitPrice:65,createdTick:11});
  assert.equal(made.state,'SAT');assert.deepEqual(validateBuyOffer(made.offer),[]);assert.equal(createBuyOffer({...made.offer,offerId:'O2',unitPrice:65.5}).state,'VIOL');
  const canceled=transitionBuyOffer(made.offer,BUY_OFFER_STATUS.CANCELED);assert.equal(canceled.state,'SAT');assert.equal(transitionBuyOffer(canceled.offer,BUY_OFFER_STATUS.FILLED).state,'VIOL');
});

test('Pricing V1 is deterministic, integer-currency, and bounded by merchant-local scarcity only',()=>{
  const input={acquisitionCost:70,marginBps:3000,scarcity:{localStock:1,targetStock:2,recentDemand:2}};
  const a=quoteAskPrice(input),b=quoteAskPrice(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(a,b);assert.equal(a.state,'SAT');assert.equal(a.askPrice,a.acquisitionCost+a.marginAmount+a.scarcityAdjustment);assert.ok(Number.isSafeInteger(a.askPrice));
  assert.ok(Math.abs(a.scarcityAdjustmentBps)<=2500);assert.equal(deriveScarcityAdjustmentBps({localStock:999,targetStock:1,recentDemand:0}),-2500);assert.equal(quoteAskPrice({marginBps:1000}).state,'UNKNOWN');
});

test('canonical committed receipt validates exact fingerprint, integrity fingerprint and item identity',()=>{
  const r=canonicalReceipt();assert.deepEqual(validateCommittedTradeReceipt(r),[]);
  assert.equal(r.fingerprint,'tx-1|M1|2|1|STONE_PICKAXE|77|1|70|70|L1|R1');
  assert.equal(r.integrityFingerprint,r.fingerprint+'|ITEMS|77');
});

test('forged committed object without canonical Trade Kernel replay state cannot change Ledger',()=>{
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger),r=canonicalReceipt();
  const forged={ok:true,duplicate:false,verification:'VERIFIED',commitStatus:'COMMITTED',receipt:r};
  const out=applyTradeKernelCommitToLedger(ledger,forged);assert.notEqual(out.state,'SAT');assert.equal(JSON.stringify(out.ledger),before);
});

test('tampered fingerprint cannot change Ledger',()=>{
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger),r=canonicalReceipt();r.fingerprint='tampered';
  const out=applyTradeKernelCommitToLedger(ledger,committed(r));assert.equal(out.state,'VIOL');assert.equal(JSON.stringify(out.ledger),before);
});

test('tampered integrityFingerprint cannot change Ledger',()=>{
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger),r=canonicalReceipt();r.integrityFingerprint='tampered';
  const out=applyTradeKernelCommitToLedger(ledger,committed(r));assert.equal(out.state,'VIOL');assert.equal(JSON.stringify(out.ledger),before);
});

test('changed party/item/quantity/price fields fail closed even when receipt fingerprints are recomputed but replay evidence is original',()=>{
  const original=canonicalReceipt(),ledger=createMerchantLedger(1),before=JSON.stringify(ledger);
  const variants=[
    {buyerId:3},{sellerId:3},{itemInstanceId:78,itemIds:[78]},{quantity:2,itemIds:[77,78],totalPrice:140},{unitPrice:71,totalPrice:71},
  ];
  for(const patch of variants){
    const tampered=canonicalReceipt(patch),out=applyTradeKernelCommitToLedger(ledger,committed(tampered,{stateReceipt:original}));
    assert.equal(out.state,'VIOL');assert.equal(JSON.stringify(out.ledger),before);
  }
});

test('raw proposal, failed result, UNKNOWN result and canonical duplicate replay never increment accounting',()=>{
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger);
  assert.equal(applyTradeKernelCommitToLedger(ledger,{transactionId:'proposal-only'}).state,'UNKNOWN');
  assert.equal(applyTradeKernelCommitToLedger(ledger,failed('insufficient-funds')).state,'VIOL');
  assert.equal(applyTradeKernelCommitToLedger(ledger,{}).state,'UNKNOWN');
  const r=canonicalReceipt(),dup=applyTradeKernelCommitToLedger(ledger,committed(r,{duplicate:true}));
  assert.equal(dup.state,'SAT');assert.equal(dup.duplicate,true);assert.equal(JSON.stringify(dup.ledger),before);
});

test('Trade Kernel success is normalized to VERIFIED + COMMITTED accounting evidence',()=>{
  const assessed=assessTradeKernelResult(committed(canonicalReceipt()));
  assert.equal(assessed.state,'SAT');assert.equal(assessed.verification,'VERIFIED');assert.equal(assessed.commitStatus,'COMMITTED');assert.equal(assessed.duplicate,false);
});

test('Revenue != Profit regression: buy Pickaxe 70 then sell 100 => Revenue 100 COGS 70 Profit 30',()=>{
  const result=applyTradeKernelCommitToLedger(buyPickaxe(),committed(saleReceipt()));assert.equal(result.state,'SAT');
  assert.equal(result.ledger.revenue,100);assert.equal(result.ledger.costOfGoodsSold,70);assert.equal(result.ledger.realizedProfit,30);
  assert.equal(result.ledger.sales[0].costBasisSource,'purchase');assert.deepEqual(result.ledger.purchases[0].remainingItemIds,[]);
});

test('same committed transaction cannot increment accounting twice',()=>{
  const sold=applyTradeKernelCommitToLedger(buyPickaxe(),committed(saleReceipt()));const snapshot=JSON.stringify(sold.ledger);
  const replay=applyTradeKernelCommitToLedger(sold.ledger,committed(saleReceipt()));assert.equal(replay.state,'SAT');assert.equal(replay.duplicate,true);assert.equal(JSON.stringify(replay.ledger),snapshot);
});

test('self-produced sale without verified cost stays UNKNOWN; verified evidence preserves Revenue/COGS/Profit',()=>{
  const sale=saleReceipt({itemInstanceId:500,itemIds:[500]});
  const noBasis=applyTradeKernelCommitToLedger(createMerchantLedger(1),committed(sale));assert.equal(noBasis.state,'UNKNOWN');
  const productionEvidence={verification:'VERIFIED',evidenceId:'production-cost:500',itemInstanceId:500,totalCost:55,sourceEvidenceIds:['craft-order:9','material-receipt:9']};
  const result=applyTradeKernelCommitToLedger(createMerchantLedger(1),committed(sale),{productionEvidence});
  assert.equal(result.state,'SAT');assert.equal(result.ledger.revenue,100);assert.equal(result.ledger.costOfGoodsSold,55);assert.equal(result.ledger.realizedProfit,45);
});

test('multi-item purchase preserves item-level cost basis and exact COGS',()=>{
  const buy=canonicalReceipt({itemIds:[77,78],quantity:2,unitPrice:70,totalPrice:140});
  const purchased=applyTradeKernelCommitToLedger(createMerchantLedger(1),committed(buy));assert.equal(purchased.state,'SAT');
  const sell=saleReceipt({itemInstanceId:78,itemIds:[78],quantity:1,unitPrice:100,totalPrice:100});
  const sold=applyTradeKernelCommitToLedger(purchased.ledger,committed(sell));assert.equal(sold.state,'SAT');assert.equal(sold.ledger.costOfGoodsSold,70);assert.deepEqual(sold.ledger.purchases[0].remainingItemIds,[77]);
});

test('merchant ledger save/load preserves item-level cost basis and totals byte-for-byte',()=>{
  const bought=buyPickaxe(),wire=serializeMerchantLedger(bought),restored=restoreMerchantLedger(wire);assert.equal(serializeMerchantLedger(restored),wire);
  const sold=applyTradeKernelCommitToLedger(restored,committed(saleReceipt()));assert.equal(sold.state,'SAT');
  const soldWire=serializeMerchantLedger(sold.ledger),soldRestored=restoreMerchantLedger(soldWire);assert.equal(serializeMerchantLedger(soldRestored),soldWire);assert.equal(soldRestored.realizedProfit,30);assert.deepEqual(validateMerchantLedger(soldRestored),[]);
});

test('RC4 pricing/ledger modules stay pure and outside forbidden authorities',()=>{
  for(const rel of ['merchant-listing.mjs','merchant-buy-offer.mjs','merchant-pricing.mjs','merchant-ledger.mjs']){
    const src=fs.readFileSync(new URL('../src/'+rel,import.meta.url),'utf8');
    for(const token of ['Math.random','Date.now','new Date(','document.','window.','state.rng','s.rng',"from './engine", "from './rust-possessions", "from './individual-housing", "from './profession", "kingdom-market", "kingdom-household", 'wallet.', 'rustPossessions'])
      assert.equal(src.includes(token),false,rel+': '+token);
  }
});
