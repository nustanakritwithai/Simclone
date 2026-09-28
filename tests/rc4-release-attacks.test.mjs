import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore} from '../src/engine.mjs';
import {productionMarketFixture,commitRealTrades,travelAndBuy} from './fixtures/rc4-production-world.mjs';
import {createListingCollection,createListingInCollection,updateListingInCollection,transitionListingInCollection,serializeListingCollection,restoreListingCollection} from '../src/merchant-listing.mjs';
import {createReservation,reservationById,globalActiveReservations} from '../src/merchant-reservation.mjs';
import {projectHomeMarketForTrade} from '../src/home-market.mjs';
import {createTradeWalletAdapter} from '../src/trade-wallet-adapter.mjs?v=0.5.0';
import {rustTradeItemAdapter} from '../src/trade-rust-adapter.mjs?v=0.5.0';
import {settleTradeAtomic,isCanonicalTradeExecutionContext} from '../src/trade-kernel.mjs?v=0.5.0';
import {createMerchantLedger,applyCanonicalTradeExecutionToLedger,applyTradeKernelCommitToLedger} from '../src/merchant-ledger.mjs?v=0.5.0';
import {noteVerifiedCommittedMerchantTransaction} from '../src/merchant-career.mjs?v=0.5.0';
import {rc4MarketReadModel} from '../src/rc4-market-runtime.mjs?v=0.5.0';
import {observeRc4Markets,hasRc4PurchaseNeed} from '../src/rc4-market-observation.mjs?v=0.5.0';
const bytes=serialize;
const must=r=>{assert.equal(r.ok,true,JSON.stringify(r));return r;};
const original={id:'L:request',marketId:'M1',sellerId:1,itemKind:'STONE_PICKAXE',itemInstanceId:1,quantity:1,unitPrice:100,status:'OPEN'};

for(const patch of [{unitPrice:101},{quantity:2},{status:'CLOSED'},{buyOfferId:'another-offer'}])test('Listing create same ID conflicting payload rejected '+JSON.stringify(patch),()=>{
  const initial=createListingInCollection(createListingCollection(),original).collection,before=JSON.stringify(initial);
  const result=createListingInCollection(initial,{...original,...patch});
  assert.equal(result.state,'VIOL');assert.equal(result.reason,'listing-id-conflict');assert.equal(JSON.stringify(initial),before);
});
test('Listing create receipt survives mutation, close and load without accepting a changed create payload',()=>{
  let c=createListingInCollection(createListingCollection(),original).collection;
  c=updateListingInCollection(c,original.id,{unitPrice:110}).collection;
  c=transitionListingInCollection(c,original.id,'CLOSED').collection;
  c=restoreListingCollection(serializeListingCollection(c));const before=JSON.stringify(c);
  const replay=createListingInCollection(c,original);assert.equal(replay.state,'SAT');assert.equal(replay.duplicate,true);
  assert.equal(JSON.stringify(replay.collection),before);
  assert.equal(createListingInCollection(c,{...original,unitPrice:110}).state,'VIOL');
});

test('Actual 33 committed transactions then immediate and post-load first-transaction replay are full-root no-ops',()=>{
  const f=productionMarketFixture();const {first}=commitRealTrades(f,33);
  assert.equal(f.world.tradeReplay.receipts.length,33);
  for(const world of [f.world,restore(bytes(f.world))]){
    const before=bytes(world),r=settleTradeAtomic(world,first.receipt,{});
    assert.equal(r.ok,true);assert.equal(r.duplicate,true);assert.equal(r.state,world);assert.equal(bytes(world),before);
    const merchant=world.agents.find(a=>a.id===f.merchantId),ledger=world.merchantLedgers.ledgers.find(l=>l.merchantId===f.merchantId);
    const evidence={state:'SAT',duplicate:true,verification:'VERIFIED',commitStatus:'COMMITTED',receipt:first.receipt};
    assert.equal(noteVerifiedCommittedMerchantTransaction(merchant,evidence).counted,false);
    assert.equal(applyTradeKernelCommitToLedger(ledger,r).duplicate,true);assert.equal(bytes(world),before);
  }
});

for(const field of ['buyerId','sellerId','itemInstanceId','quantity','unitPrice','totalPrice','marketId','listingId','reservationId'])test('Committed transaction ID with changed '+field+' is rejected without mutation',()=>{
  const f=productionMarketFixture(),{first}=commitRealTrades(f,1),world=f.world,before=bytes(world);
  const proposal={...first.receipt,[field]:typeof first.receipt[field]==='number'?first.receipt[field]+1:first.receipt[field]+':changed'};
  const r=settleTradeAtomic(world,proposal,{});assert.equal(r.ok,false);assert.equal(r.reason,'transaction-conflict');assert.equal(bytes(world),before);
});
for(const field of ['fingerprint','integrityFingerprint','itemIds','eventId','buyerId','sellerId','quantity','unitPrice','marketId','listingId','reservationId'])test('Tampered persisted receipt '+field+' is rejected without fresh replay state',()=>{
  const f=productionMarketFixture();commitRealTrades(f,1);const raw=JSON.parse(bytes(f.world)),r=raw.tradeReplay.receipts[0];
  r[field]=field==='itemIds'?[999999]:typeof r[field]==='number'?r[field]+1:r[field]+':tampered';
  assert.throws(()=>restore(JSON.stringify(raw)),/RC4 migration failed|Invalid restored world|บันทึกไม่ถูกต้อง/);
});
for(const mutate of ['tradeReplay','walletReceipts','ledgerEntries','careerReceipts','reservationReceipts'])test('Modern committed history cannot silently reset '+mutate,()=>{
  const f=productionMarketFixture();commitRealTrades(f,1);const raw=JSON.parse(bytes(f.world));
  if(mutate==='tradeReplay')raw.tradeReplay.receipts=[];
  if(mutate==='walletReceipts')raw.currencyWallet.receipts=raw.currencyWallet.receipts.filter(r=>r.evidence?.operation!=='TRADE_TRANSFER');
  if(mutate==='ledgerEntries')raw.merchantLedgers.ledgers=[];
  if(mutate==='careerReceipts'){const a=raw.agents.find(a=>a.id===f.merchantId);a.merchantTransactionIds=[];a.merchantTransactions=0;a.merchantExperience=0;}
  if(mutate==='reservationReceipts')raw.merchantReservations.reservations=[];
  assert.throws(()=>restore(JSON.stringify(raw)),/RC4 migration failed|Invalid restored world|บันทึกไม่ถูกต้อง/);
});

function stagedFixture(){
  const f=productionMarketFixture(),world=f.world;
  must(command(world,'RC4_TRAVEL_TO_MARKET',{agentId:f.merchantId,marketId:f.marketId}));
  for(let i=0;i<500&&world.agents.find(a=>a.id===f.merchantId).task?.path.length;i++)step(world,1);
  const listing=world.merchantListings.listings.find(l=>l.id===f.listingId);
  const r=createReservation(world,world.merchantReservations,{listing,listingRevision:listing.revision,buyerId:f.merchantId,itemIds:[f.itemId],createdTick:world.tick});
  assert.equal(r.state,'SAT');world.merchantReservations=r.reservationState;
  const proposal={transactionId:'TX:injected',marketId:f.marketId,listingId:f.listingId,reservationId:r.reservation.id,buyerId:f.merchantId,sellerId:f.producerId,itemKind:listing.itemKind,itemInstanceId:f.itemId,quantity:1,unitPrice:1,totalPrice:1};
  const adapters={wallet:createTradeWalletAdapter({transactionId:proposal.transactionId,fromAgentId:proposal.buyerId,toAgentId:proposal.sellerId,amount:1,evidence:{marketId:f.marketId,listingId:f.listingId,reservationId:r.reservation.id}}),item:rustTradeItemAdapter,
    market:{market:(s,id)=>projectHomeMarketForTrade(s,s.homeMarkets,{marketId:id}).market,listing:(s,id)=>s.merchantListings.listings.find(l=>l.id===id),reservation:(s,id)=>reservationById(s.merchantReservations,id),activeReservations:s=>globalActiveReservations(s.merchantReservations)}};
  return {...f,proposal,adapters};
}
for(const stage of ['wallet-credit','item-transfer','ledger','career','postcondition'])test('Injected '+stage+' failure after staged work leaves complete canonical root unchanged',()=>{
  const f=stagedFixture(),before=bytes(f.world);let called=false;
  if(stage==='wallet-credit')f.adapters.wallet={...f.adapters.wallet,credit:()=>({ok:false})};
  if(stage==='item-transfer')f.adapters.item={...f.adapters.item,transfer:()=>({ok:false})};
  f.adapters.postSettlement={apply:(s,context)=>{
    called=true;assert.equal(s.rustPossessions.items.find(i=>i.id===f.itemId).location.agentId,f.merchantId);
    assert.equal(s.tradeReplay.receipts.length,1);assert.equal(isCanonicalTradeExecutionContext(context,s),true);
    const ledger=s.merchantLedgers.ledgers.find(l=>l.merchantId===f.merchantId);
    const applied=applyCanonicalTradeExecutionToLedger(ledger,s,context);assert.equal(applied.state,'SAT');
    if(stage==='ledger')return {ok:false,reason:'injected-ledger'};
    const a=s.agents.find(a=>a.id===f.merchantId),progress=noteVerifiedCommittedMerchantTransaction(a,applied);
    assert.equal(progress.changed,true);if(stage==='career')return {ok:false,reason:'injected-career'};
    return {ok:true};
  },verify:()=>({ok:false,reason:'injected-postcondition'})};
  const result=settleTradeAtomic(f.world,f.proposal,f.adapters);assert.equal(result.ok,false);assert.equal(bytes(f.world),before);
  if(!['wallet-credit','item-transfer'].includes(stage))assert.equal(called,true);
});

test('Canonical Trade context is bound to its staged world, revokes after failure, and Career grant cannot be forged or reused',()=>{
  const f=stagedFixture(),before=bytes(f.world);let escaped,staged,granted;
  f.adapters.postSettlement={apply:(s,context)=>{
    escaped=context;staged=s;
    assert.equal(applyCanonicalTradeExecutionToLedger(createMerchantLedger(f.merchantId),structuredClone(s),context).state,'UNKNOWN');
    granted=applyCanonicalTradeExecutionToLedger(createMerchantLedger(f.merchantId),s,context);assert.equal(granted.state,'SAT');
    const a=s.agents.find(a=>a.id===f.merchantId),initial=JSON.stringify(a);
    assert.equal(noteVerifiedCommittedMerchantTransaction(a,structuredClone(granted)).changed,false);assert.equal(JSON.stringify(a),initial);
    assert.equal(noteVerifiedCommittedMerchantTransaction(a,granted).changed,true);
    const once=JSON.stringify(a);assert.equal(noteVerifiedCommittedMerchantTransaction(a,granted).changed,false);assert.equal(JSON.stringify(a),once);
    return {ok:false,reason:'intentional-abort'};
  },verify:()=>({ok:true})};
  assert.equal(settleTradeAtomic(f.world,f.proposal,f.adapters).ok,false);assert.equal(bytes(f.world),before);
  assert.equal(isCanonicalTradeExecutionContext(escaped),false);
  assert.equal(applyCanonicalTradeExecutionToLedger(createMerchantLedger(f.merchantId),staged,escaped).state,'UNKNOWN');
});

test('Missing or stale UI Listing revision is rejected before reservation or money mutation',()=>{
  const f=productionMarketFixture(),before=bytes(f.world);
  for(const listingRevision of [undefined,0,2]){
    const r=command(f.world,'RC4_BUY_LISTING',{buyerId:f.merchantId,listingId:f.listingId,listingRevision});
    assert.equal(r.ok,false);assert.equal(bytes(f.world),before);
  }
});
test('Producer BuyOffer listing is bound to intended Merchant, not a third-party purchaser',()=>{
  const f=productionMarketFixture(),before=bytes(f.world),listing=f.world.merchantListings.listings.find(l=>l.id===f.listingId);
  const r=command(f.world,'RC4_BUY_LISTING',{buyerId:f.customerId,listingId:f.listingId,listingRevision:listing.revision});
  assert.equal(r.ok,false);assert.equal(bytes(f.world),before);
});
test('Unknown remote markets/prices never enter a Clone read model or permit a travel intent',()=>{
  const f=productionMarketFixture(),a=f.world.agents.find(a=>a.id===f.customerId);
  delete a.rc4MarketKnowledge;a.x=29;a.y=25;a.task=null;
  const before=bytes(f.world),model=rc4MarketReadModel(f.world,a.id);
  assert.deepEqual(model.markets,[]);assert.equal(bytes(f.world),before);
  const r=command(f.world,'RC4_TRAVEL_TO_MARKET',{agentId:a.id,marketId:f.marketId});assert.equal(r.ok,false);assert.equal(bytes(f.world),before);
  observeRc4Markets(f.world);assert.deepEqual(rc4MarketReadModel(f.world,a.id).markets,[]);
});
test('Real Customer work-tool need comes from productive goal and bag, not caller need flags',()=>{
  const f=productionMarketFixture(),a=f.world.agents.find(a=>a.id===f.customerId);
  const listing={itemKind:'STONE_PICKAXE'};assert.equal(hasRc4PurchaseNeed(f.world,a,listing),true);
  assert.equal(hasRc4PurchaseNeed(f.world,a,{itemKind:'STONE_AXE',need:true}),false);
  commitRealTrades(f,2);
  assert.equal(hasRc4PurchaseNeed(f.world,f.world.agents.find(a=>a.id===f.customerId),listing),false);
});
