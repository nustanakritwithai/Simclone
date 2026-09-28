import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createListing,validateListing,updateListing,transitionListing,LISTING_STATUS,
  createListingCollection,validateListingCollection,createListingInCollection,updateListingInCollection,transitionListingInCollection,
  applyListingSettlementInCollection,
  freezeListingReservationSnapshot,assessListingReservationRevision,migrateListingCollection,serializeListingCollection,restoreListingCollection
} from '../src/merchant-listing.mjs';
import {
  createBuyOffer,validateBuyOffer,transitionBuyOffer,BUY_OFFER_STATUS,
  createBuyOfferCollection,validateBuyOfferCollection,createBuyOfferInCollection,transitionBuyOfferInCollection,
  proposeProducerBuyOfferMatch,applyBuyOfferSettlementInCollection,migrateBuyOfferCollection,serializeBuyOfferCollection,restoreBuyOfferCollection
} from '../src/merchant-buy-offer.mjs';
import {quoteAskPrice,deriveScarcityAdjustmentBps} from '../src/merchant-pricing.mjs';
import {
  createMerchantLedger,applyTradeKernelCommitToLedger,assessTradeKernelResult,validateCommittedTradeReceipt,
  validateMerchantLedger,serializeMerchantLedger,restoreMerchantLedger,tradeReceiptFingerprint,tradeReceiptIntegrityFingerprint,
  resolveCostBasis,calculateSaleAccounting
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
function openListing(id='L1',itemInstanceId=77){
  return {id,marketId:'M1',sellerId:2,itemKind:'STONE_PICKAXE',itemInstanceId,quantity:1,unitPrice:100};
}
function ledgerWithPurchase({itemIds=[77],unitPrice=70}={}){
  const quantity=itemIds.length,totalPrice=unitPrice*quantity;
  const ledger={
    merchantId:1,
    purchases:[{
      transactionId:'tx-buy',marketId:'M1',itemKind:'STONE_PICKAXE',
      itemIds:[...itemIds],remainingItemIds:[...itemIds],quantity,unitPrice,totalPrice,
      listingId:'L-buy',reservationId:'R-buy'
    }],
    sales:[],
    revenue:0,costOfGoodsSold:0,realizedProfit:0
  };
  assert.deepEqual(validateMerchantLedger(ledger),[]);
  return ledger;
}
function completedLedger(){
  return {
    merchantId:1,
    purchases:[{
      transactionId:'tx-buy',marketId:'M1',itemKind:'STONE_PICKAXE',
      itemIds:[77],remainingItemIds:[],quantity:1,unitPrice:70,totalPrice:70,
      listingId:'L-buy',reservationId:'R-buy'
    }],
    sales:[{
      transactionId:'tx-sell',marketId:'M1',itemKind:'STONE_PICKAXE',
      itemIds:[77],quantity:1,unitPrice:100,totalPrice:100,cogs:70,profit:30,
      costBasisSource:'purchase',costBasisRefs:['tx-buy'],listingId:'L-sell',reservationId:'R-sell'
    }],
    revenue:100,costOfGoodsSold:70,realizedProfit:30
  };
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
  collection=transitionListingInCollection(collection,'L1',LISTING_STATUS.CLOSED).collection;
  collection=createListingInCollection(collection,openListing('L2',77)).collection;
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

test('canonical receipt shape validates exact fingerprint, integrity fingerprint and item identity',()=>{
  const r=canonicalReceipt();assert.deepEqual(validateCommittedTradeReceipt(r),[]);
  assert.equal(r.fingerprint,'tx-1|M1|2|1|STONE_PICKAXE|77|1|70|70|L1|R1');
  assert.equal(r.integrityFingerprint,r.fingerprint+'|ITEMS|77');
});

test('fully forged matching receipt + replay state cannot become committed accounting evidence',()=>{
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger),forged=committed(canonicalReceipt());
  const assessed=assessTradeKernelResult(forged);
  assert.equal(assessed.state,'UNKNOWN');assert.equal(assessed.reason,'trade-commit-provenance');
  assert.equal(assessed.verification,undefined);assert.equal(assessed.commitStatus,undefined);
  const out=applyTradeKernelCommitToLedger(ledger,forged);
  assert.equal(out.state,'UNKNOWN');assert.equal(out.reason,'trade-commit-provenance');assert.equal(JSON.stringify(out.ledger),before);
});

test('forged purchase followed by forged sale cannot create Revenue, COGS or Profit',()=>{
  const empty=createMerchantLedger(1),snapshot=JSON.stringify(empty);
  const fakeBuy=applyTradeKernelCommitToLedger(empty,committed(canonicalReceipt()));
  assert.equal(fakeBuy.state,'UNKNOWN');assert.equal(JSON.stringify(fakeBuy.ledger),snapshot);
  const fakeSale=applyTradeKernelCommitToLedger(fakeBuy.ledger,committed(saleReceipt()));
  assert.equal(fakeSale.state,'UNKNOWN');assert.equal(JSON.stringify(fakeSale.ledger),snapshot);
  assert.equal(fakeSale.ledger.revenue,0);assert.equal(fakeSale.ledger.costOfGoodsSold,0);assert.equal(fakeSale.ledger.realizedProfit,0);
});

test('changed buyer/seller with recomputed hashes and matching forged replay still cannot change Ledger',()=>{
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger);
  for(const patch of [{buyerId:4},{sellerId:4}]){
    const forged=canonicalReceipt(patch),out=applyTradeKernelCommitToLedger(ledger,committed(forged));
    assert.equal(out.state,'UNKNOWN');assert.equal(out.reason,'trade-commit-provenance');assert.equal(JSON.stringify(out.ledger),before);
  }
});

test('changed item identity with recomputed hashes and matching forged replay still cannot change Ledger',()=>{
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger);
  for(const patch of [{itemInstanceId:88,itemIds:[88]},{itemInstanceId:88,itemIds:[88,89],quantity:2,totalPrice:140}]){
    const forged=canonicalReceipt(patch),out=applyTradeKernelCommitToLedger(ledger,committed(forged));
    assert.equal(out.state,'UNKNOWN');assert.equal(out.reason,'trade-commit-provenance');assert.equal(JSON.stringify(out.ledger),before);
  }
});

test('tampered fingerprint and integrityFingerprint remain structural VIOL and immutable',()=>{
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger);
  const badFp=canonicalReceipt();badFp.fingerprint='tampered';
  const a=applyTradeKernelCommitToLedger(ledger,committed(badFp));assert.equal(a.state,'VIOL');assert.equal(JSON.stringify(a.ledger),before);
  const badIntegrity=canonicalReceipt();badIntegrity.integrityFingerprint='tampered';
  const b=applyTradeKernelCommitToLedger(ledger,committed(badIntegrity));assert.equal(b.state,'VIOL');assert.equal(JSON.stringify(b.ledger),before);
});

test('raw proposal, failed result, UNKNOWN result and canonical duplicate replay never increment accounting',()=>{
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger);
  assert.equal(applyTradeKernelCommitToLedger(ledger,{transactionId:'proposal-only'}).state,'UNKNOWN');
  assert.equal(applyTradeKernelCommitToLedger(ledger,failed('insufficient-funds')).state,'VIOL');
  assert.equal(applyTradeKernelCommitToLedger(ledger,{}).state,'UNKNOWN');
  const r=canonicalReceipt(),dup=applyTradeKernelCommitToLedger(ledger,committed(r,{duplicate:true}));
  assert.equal(dup.state,'SAT');assert.equal(dup.duplicate,true);assert.equal(JSON.stringify(dup.ledger),before);
});

test('self-trade, malformed receipt, unsafe integer and total mismatch are VIOL',()=>{
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger);
  const badRows=[
    canonicalReceipt({buyerId:2,sellerId:2}),
    canonicalReceipt({unitPrice:Number.MAX_SAFE_INTEGER,totalPrice:Number.MAX_SAFE_INTEGER,quantity:2,itemIds:[77,78]}),
    canonicalReceipt({totalPrice:71}),
  ];
  for(const r of badRows){
    const out=applyTradeKernelCommitToLedger(ledger,committed(r));assert.equal(out.state,'VIOL');assert.equal(JSON.stringify(out.ledger),before);
  }
});

test('Revenue/COGS/Profit math remains SAT without treating a plain Trade result as authority',()=>{
  const ledger=ledgerWithPurchase(),sale=saleReceipt(),basis=resolveCostBasis(ledger,sale);
  assert.equal(basis.state,'SAT');assert.equal(basis.cogs,70);assert.equal(basis.source,'purchase');
  const accounting=calculateSaleAccounting({revenueBefore:ledger.revenue,costOfGoodsSoldBefore:ledger.costOfGoodsSold,totalPrice:sale.totalPrice,cogs:basis.cogs});
  assert.deepEqual(accounting,{state:'SAT',revenue:100,costOfGoodsSold:70,realizedProfit:30});
});

test('verified production cost evidence still produces deterministic cost basis and accounting math',()=>{
  const ledger=createMerchantLedger(1),sale=saleReceipt({itemInstanceId:500,itemIds:[500]});
  const missing=resolveCostBasis(ledger,sale);assert.equal(missing.state,'UNKNOWN');
  const productionEvidence={verification:'VERIFIED',evidenceId:'production-cost:500',itemInstanceId:500,totalCost:55,sourceEvidenceIds:['craft-order:9','material-receipt:9']};
  const basis=resolveCostBasis(ledger,sale,{productionEvidence});assert.equal(basis.state,'SAT');assert.equal(basis.cogs,55);assert.equal(basis.source,'production');
  const accounting=calculateSaleAccounting({totalPrice:100,cogs:55});assert.deepEqual(accounting,{state:'SAT',revenue:100,costOfGoodsSold:55,realizedProfit:45});
});

test('multi-item purchase preserves exact item-level cost basis',()=>{
  const ledger=ledgerWithPurchase({itemIds:[77,78],unitPrice:70});
  const sale=saleReceipt({itemInstanceId:78,itemIds:[78],quantity:1,unitPrice:100,totalPrice:100});
  const basis=resolveCostBasis(ledger,sale);assert.equal(basis.state,'SAT');assert.equal(basis.cogs,70);assert.equal(basis.parts.length,1);assert.equal(basis.parts[0].itemId,78);
});

test('Merchant Ledger save/load preserves acquisition basis and completed accounting byte-for-byte',()=>{
  const bought=ledgerWithPurchase(),wire=serializeMerchantLedger(bought),restored=restoreMerchantLedger(wire);
  assert.equal(serializeMerchantLedger(restored),wire);assert.deepEqual(validateMerchantLedger(restored),[]);
  const sold=completedLedger();assert.deepEqual(validateMerchantLedger(sold),[]);
  const soldWire=serializeMerchantLedger(sold),soldRestored=restoreMerchantLedger(soldWire);
  assert.equal(serializeMerchantLedger(soldRestored),soldWire);assert.equal(soldRestored.realizedProfit,30);
});

test('accounting arithmetic rejects unsafe overflow',()=>{
  assert.equal(calculateSaleAccounting({revenueBefore:Number.MAX_SAFE_INTEGER,totalPrice:1,cogs:0}).state,'VIOL');
  assert.equal(calculateSaleAccounting({costOfGoodsSoldBefore:Number.MAX_SAFE_INTEGER,totalPrice:1,cogs:1}).state,'VIOL');
});

test('RC4 pricing/ledger modules stay pure and outside forbidden authorities',()=>{
  for(const rel of ['merchant-listing.mjs','merchant-buy-offer.mjs','merchant-pricing.mjs','merchant-ledger.mjs']){
    const src=fs.readFileSync(new URL('../src/'+rel,import.meta.url),'utf8');
    for(const token of ['Math.random','Date.now','new Date(','document.','window.','state.rng','s.rng',"from './engine", "from './rust-possessions", "from './individual-housing", "from './profession", "kingdom-market", "kingdom-household", 'wallet.', 'rustPossessions'])
      assert.equal(src.includes(token),false,rel+': '+token);
  }
});


test('RC4 B5: canonical BuyOffer collection creates deterministic ids, replays idempotently and persists',()=>{
  let collection=createBuyOfferCollection();
  const input={marketId:'M1',buyerId:2,itemKind:'STONE_PICKAXE',quantityWanted:2,unitPrice:70,createdTick:50};
  const first=createBuyOfferInCollection(collection,input);assert.equal(first.state,'SAT');assert.equal(first.duplicate,false);collection=first.collection;
  assert.ok(first.offer.offerId.startsWith('BO:'));
  assert.equal(first.referenceRequest.writer,'attachHomeMarketBuyOfferReference');
  assert.equal(first.referenceRequest.referenceId,first.offer.offerId);
  const replay=createBuyOfferInCollection(collection,input);
  assert.equal(replay.state,'SAT');assert.equal(replay.duplicate,true);assert.equal(replay.offer.offerId,first.offer.offerId);
  assert.equal(JSON.stringify(replay.collection),JSON.stringify(collection));
  const conflict=createBuyOfferInCollection(collection,{...input,offerId:first.offer.offerId,itemKind:'HAMMER'});
  assert.equal(conflict.state,'VIOL');assert.equal(conflict.reason,'offer-id');
  const wire=serializeBuyOfferCollection(collection),restored=restoreBuyOfferCollection(wire);
  assert.equal(serializeBuyOfferCollection(restored),wire);assert.deepEqual(validateBuyOfferCollection(restored),[]);
});

test('RC4 B5: Producer match is proposal-only and names Listing -> B1 ref -> Reservation -> Trade authorities',()=>{
  const created=createBuyOfferInCollection(createBuyOfferCollection(),{marketId:'M1',buyerId:2,itemKind:'STONE_PICKAXE',quantityWanted:2,unitPrice:70,createdTick:50});
  const matched=proposeProducerBuyOfferMatch(created.offer,{producerId:1,itemInstanceIds:[102,101]});
  assert.equal(matched.state,'SAT');
  const p=matched.proposal;
  assert.equal(p.authoritative,false);assert.deepEqual(p.itemIds,[101,102]);
  assert.equal(p.listingRequest.authority,'MERCHANT_LISTING');
  assert.equal(p.homeMarketListingReferenceRequest.writer,'attachHomeMarketListingReference');
  assert.equal(p.reservationRequest.authority,'CANONICAL_RESERVATION');
  assert.equal(p.tradeProposalOwner,'RC4_TRADE_KERNEL');
  for(const forbidden of ['wallet','money','transfer','commit','reservationState','inventory'])assert.equal(forbidden in p,false);
  assert.equal(proposeProducerBuyOfferMatch(created.offer,{producerId:1,itemInstanceIds:[101]}).reason,'itemIds');
});

test('RC4 B5: BuyOffer settlement lifecycle changes only the staged collection and exact fill',()=>{
  const created=createBuyOfferInCollection(createBuyOfferCollection(),{marketId:'M1',buyerId:2,itemKind:'STONE_PICKAXE',quantityWanted:2,unitPrice:70,createdTick:50});
  const before=JSON.stringify(created.collection);
  const bad=applyBuyOfferSettlementInCollection(created.collection,created.offer.offerId,{quantity:1,unitPrice:70});
  assert.equal(bad.state,'VIOL');assert.equal(JSON.stringify(created.collection),before);
  const filled=applyBuyOfferSettlementInCollection(created.collection,created.offer.offerId,{quantity:2,unitPrice:70});
  assert.equal(filled.state,'SAT');assert.equal(filled.offer.status,BUY_OFFER_STATUS.FILLED);
  assert.equal(JSON.stringify(created.collection),before);
  assert.equal(transitionBuyOfferInCollection(filled.collection,created.offer.offerId,BUY_OFFER_STATUS.CANCELED).state,'VIOL');
});

test('RC4 B6: Listing partial/full settlement decrements quantity and revision in one pure mutation',()=>{
  let collection=createListingCollection();
  collection=createListingInCollection(collection,{id:'SETTLE-L1',marketId:'M1',sellerId:2,itemKind:'STONE_PICKAXE',itemInstanceId:77,quantity:3,unitPrice:100}).collection;
  const source=JSON.stringify(collection);
  const partial=applyListingSettlementInCollection(collection,'SETTLE-L1',{expectedRevision:1,quantity:1,unitPrice:100});
  assert.equal(partial.state,'SAT');assert.equal(partial.listing.quantity,2);assert.equal(partial.listing.revision,2);assert.equal(partial.listing.status,LISTING_STATUS.OPEN);
  assert.equal(JSON.stringify(collection),source,'source collection is immutable');
  const full=applyListingSettlementInCollection(partial.collection,'SETTLE-L1',{expectedRevision:2,quantity:2,unitPrice:100});
  assert.equal(full.state,'SAT');assert.equal(full.listing.quantity,0);assert.equal(full.listing.revision,3);assert.equal(full.listing.status,LISTING_STATUS.FILLED);
  assert.deepEqual(validateListingCollection(full.collection),[]);
});

test('RC4 B6: stale/price/overfill failures leave Listing bytes unchanged and generic lifecycle cannot fabricate FILLED',()=>{
  let collection=createListingCollection();
  collection=createListingInCollection(collection,{id:'SETTLE-L2',marketId:'M1',sellerId:2,itemKind:'HAMMER',itemInstanceId:88,quantity:2,unitPrice:90}).collection;
  const before=JSON.stringify(collection);
  for(const req of [
    {expectedRevision:2,quantity:1,unitPrice:90},
    {expectedRevision:1,quantity:1,unitPrice:91},
    {expectedRevision:1,quantity:3,unitPrice:90}
  ]){
    const r=applyListingSettlementInCollection(collection,'SETTLE-L2',req);
    assert.equal(r.state,'VIOL');assert.equal(JSON.stringify(r.collection),before);assert.equal(JSON.stringify(collection),before);
  }
  assert.equal(transitionListing(collection.listings[0],LISTING_STATUS.FILLED).state,'VIOL');
});


test('RC4 B7: Listing collection old-save migration is one-shot and corrupt present state fails closed',()=>{
  const missing=migrateListingCollection(undefined);
  assert.equal(missing.state,'SAT');assert.equal(missing.migrated,true);assert.equal(missing.duplicate,false);
  assert.deepEqual(missing.collection,createListingCollection());
  const replay=migrateListingCollection(missing.collection);
  assert.equal(replay.state,'SAT');assert.equal(replay.migrated,false);assert.equal(replay.duplicate,true);
  assert.equal(serializeListingCollection(replay.collection),serializeListingCollection(missing.collection));
  const corrupt={...createListingCollection(),listings:[{id:'broken'}]};
  const bad=migrateListingCollection(corrupt);
  assert.equal(bad.state,'VIOL');assert.equal(bad.collection,null);
});

test('RC4 B7: BuyOffer collection old-save migration is one-shot and corrupt present state fails closed',()=>{
  const missing=migrateBuyOfferCollection(null);
  assert.equal(missing.state,'SAT');assert.equal(missing.migrated,true);assert.equal(missing.duplicate,false);
  assert.deepEqual(missing.collection,createBuyOfferCollection());
  const replay=migrateBuyOfferCollection(missing.collection);
  assert.equal(replay.state,'SAT');assert.equal(replay.migrated,false);assert.equal(replay.duplicate,true);
  assert.equal(serializeBuyOfferCollection(replay.collection),serializeBuyOfferCollection(missing.collection));
  const corrupt={...createBuyOfferCollection(),buyOffers:[{offerId:'broken'}]};
  const bad=migrateBuyOfferCollection(corrupt);
  assert.equal(bad.state,'VIOL');assert.equal(bad.collection,null);
});
