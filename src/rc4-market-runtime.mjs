import {observeRc4Markets,validateRc4MarketKnowledge,knownRc4Markets,knownRc4Listings,knownRc4BuyOffers,knowsRc4Market,hasRc4PurchaseNeed} from './rc4-market-observation.mjs?v=0.5.0';
import {homeOf} from './individual-housing.mjs?v=0.5.0';
import {lifeStage} from './lifecycle.mjs?v=0.5.0';
import {pathTo} from './survival.mjs?v=0.5.0';
import {
  migrateHomeMarketState,validateHomeMarketState,createHomeMarket,openHomeMarket,closeHomeMarket,reconcileHomeMarkets,
  attachHomeMarketListingReference,attachHomeMarketBuyOfferReference,projectHomeMarketForTrade
} from './home-market.mjs?v=0.5.0';
import {
  migrateListingCollection,validateListingCollection,createListingInCollection,applyListingSettlementInCollection,listingIdFor
} from './merchant-listing.mjs?v=0.5.0';
import {
  migrateBuyOfferCollection,validateBuyOfferCollection,createBuyOfferInCollection,proposeProducerBuyOfferMatch,
  applyBuyOfferSettlementInCollection
} from './merchant-buy-offer.mjs?v=0.5.0';
import {
  migrateReservationState,validateReservationState,createReservation,reservationById,globalActiveReservations,commitReservation,reconcileReservations
} from './merchant-reservation.mjs?v=0.5.0';
import {migrateLegacyCurrencyWallet,validateCurrencyWallet,getBalance,createCurrencyAccount} from './currency-wallet.mjs?v=0.5.0';
import {createTradeWalletAdapter} from './trade-wallet-adapter.mjs?v=0.5.0';
import {rustTradeItemAdapter} from './trade-rust-adapter.mjs?v=0.5.0';
import {migrateTradeReplayState,validateTradeReplayState,settleTradeAtomic} from './trade-kernel.mjs?v=0.5.0';
import {tradableRustItemIds} from './rust-possessions.mjs?v=0.5.0';
import {
  validateMerchantLedgerCollection,migrateMerchantLedgerCollection,applyCanonicalTradeExecutionToLedger,
  ensureMerchantLedgerInCollection,replaceMerchantLedgerInCollection,merchantLedgerFromCollection
} from './merchant-ledger.mjs?v=0.5.0';
import {
  evaluateMerchantQualification,adoptMerchantProfession,noteVerifiedCommittedMerchantTransaction,validateMerchantProgression
} from './merchant-career.mjs?v=0.5.0';
import {createCanonicalMarketTravelTask,verifyCanonicalMarketArrival,isCanonicalMarketTravelTask,canPreemptForCanonicalMarketTravel,retainCanonicalMarketTravelOnCommit} from './navigation-arrival-evidence.mjs?v=0.5.0';

export const RC4_ECONOMY_ROOT_VERSION='RC4-economy-root/1';
export const RC4_MERCHANT_AUTONOMY_RULES=Object.freeze({
  cadenceTicks:1,
  peoplePerMerchant:6,
  maxPromotionsPerStep:1,
});
const RC4_ROOT_FIELDS=Object.freeze(['homeMarkets','merchantListings','merchantBuyOffers','merchantReservations','currencyWallet','tradeReplay','merchantLedgers']);

const clone=v=>structuredClone(v);
const validMoney=v=>Number.isSafeInteger(v)&&v>0;
const positive=v=>Number.isSafeInteger(v)&&v>0;
const stableText=value=>{
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(stableText).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableText(value[k])).join(',')+'}';
};
function hash32(text,seed=0x811c9dc5){
  let h=seed>>>0;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}
  return h.toString(16).padStart(8,'0');
}
const deterministicId=(prefix,payload)=>prefix+hash32(stableText(payload))+hash32(stableText(payload),0x9e3779b9);
const fail=(reason,message=reason,extra={})=>({ok:false,reason,message,...extra});

function ledgerIndex(world,merchantId){return world.merchantLedgers?.ledgers?.findIndex(x=>x.merchantId===merchantId)??-1;}
function ensureLedger(world,merchantId){
  const ensured=ensureMerchantLedgerInCollection(world.merchantLedgers,merchantId);
  if(ensured.state!=='SAT')return {ok:false,reason:ensured.reason??'ledger-root',detail:ensured};
  world.merchantLedgers=ensured.collection;
  return {ok:true,index:ledgerIndex(world,merchantId),ledger:ensured.ledger};
}

export function migrateRc4EconomyState(world){
  if(!world||typeof world!=='object'||!Array.isArray(world.agents))return {state:'VIOL',reason:'world'};
  // Only a wholly pre-RC4 world may bootstrap. A damaged modern save is not an old save.
  const hasRc4=Object.hasOwn(world,'rc4EconomyVersion')||RC4_ROOT_FIELDS.some(k=>Object.hasOwn(world,k));
  if(hasRc4){
    if(world.rc4EconomyVersion!==RC4_ECONOMY_ROOT_VERSION)return {state:'VIOL',reason:'rc4-root-version'};
    const missing=RC4_ROOT_FIELDS.filter(k=>!Object.hasOwn(world,k)||world[k]===null||world[k]===undefined);
    if(missing.length)return {state:'VIOL',reason:'rc4-root-missing',errors:missing};
  }else if([...(world.agents??[]),...(world.archive??[])].some(a=>a.profession==='merchant'||a.merchantTransactions>0||a.merchantExperience>0)){
    return {state:'VIOL',reason:'rc4-history-without-roots'};
  }
  const hm=migrateHomeMarketState(world.homeMarkets);
  if(hm.state!=='SAT')return {state:'VIOL',reason:'home-markets',detail:hm};
  world.homeMarkets=hm.marketState;

  const listings=migrateListingCollection(world.merchantListings);
  if(listings.state!=='SAT')return {state:'VIOL',reason:'listings',detail:listings};
  world.merchantListings=listings.collection;

  const offers=migrateBuyOfferCollection(world.merchantBuyOffers);
  if(offers.state!=='SAT')return {state:'VIOL',reason:'buy-offers',detail:offers};
  world.merchantBuyOffers=offers.collection;

  const reservations=migrateReservationState(world.merchantReservations);
  if(reservations.state!=='SAT')return {state:'VIOL',reason:'reservations',detail:reservations};
  world.merchantReservations=clone(reservations.reservationState);

  const replay=migrateTradeReplayState(world.tradeReplay);
  if(replay.state!=='SAT')return {state:'VIOL',reason:'trade-replay',detail:replay};
  world.tradeReplay=replay.tradeReplay;

  const wallet=migrateLegacyCurrencyWallet(world);
  if(!wallet.ok)return {state:'VIOL',reason:'wallet',detail:wallet};

  const ledgers=migrateMerchantLedgerCollection(world.merchantLedgers);
  if(ledgers.state!=='SAT')return {state:'VIOL',reason:'ledger-root',detail:ledgers};
  world.merchantLedgers=ledgers.collection;
  const knownPeople=new Set([...(world.agents??[]),...(world.archive??[])].map(a=>a.id));
  if(world.merchantLedgers.ledgers.some(l=>!knownPeople.has(l.merchantId)))return {state:'VIOL',reason:'ledger-agent'};
  for(const a of [...(world.agents??[]),...(world.archive??[])])if(validateMerchantProgression(a).length)return {state:'VIOL',reason:'merchant-progression',agentId:a.id};
  // Navigation arrival provenance is runtime-ephemeral. A JSON-restored lookalike
  // is not in the Navigation module's private identity set and must never survive as proof.
  for(const a of world.agents??[])if(a?.task?.rc4MarketTravel&&!isCanonicalMarketTravelTask(a.task)){a.task=null;a.moveTick=0;}
  world.rc4EconomyVersion=RC4_ECONOMY_ROOT_VERSION;
  return {state:'SAT',migrated:true};
}

export function validateRc4EconomyState(world){
  const e=[];
  if(world?.rc4EconomyVersion!==RC4_ECONOMY_ROOT_VERSION)e.push('RC4 root version');
  e.push(...validateHomeMarketState(world?.homeMarkets).map(x=>'HomeMarket:'+x));
  e.push(...validateListingCollection(world?.merchantListings).map(x=>'Listing:'+x));
  e.push(...validateBuyOfferCollection(world?.merchantBuyOffers).map(x=>'BuyOffer:'+x));
  e.push(...validateReservationState(world?.merchantReservations).map(x=>'Reservation:'+x));
  e.push(...validateCurrencyWallet(world).map(x=>'Wallet:'+x));
  e.push(...validateTradeReplayState(world).map(x=>'Trade:'+x));
  e.push(...validateMerchantLedgerCollection(world?.merchantLedgers).map(x=>'Ledger:'+x));
  if(e.length)return e;
  const marketById=new Map((world?.homeMarkets?.markets??[]).map(m=>[m.marketId,m]));
  const listingByRef=new Map((world?.merchantListings?.listings??[]).map(l=>[l.id,l]));
  const offerByRef=new Map((world?.merchantBuyOffers?.buyOffers??[]).map(o=>[o.offerId,o]));
  for(const m of world?.homeMarkets?.markets??[]){
    for(const id of m.listingIds??[]){const row=listingByRef.get(id);if(!row||row.marketId!==m.marketId)e.push('HomeMarket:listing-reference');}
    for(const id of m.buyOfferIds??[]){const row=offerByRef.get(id);if(!row||row.marketId!==m.marketId)e.push('HomeMarket:buy-offer-reference');}
  }
  for(const l of world?.merchantListings?.listings??[]){const m=marketById.get(l.marketId);if(!m||!m.listingIds.includes(l.id))e.push('Listing:market-reference');}
  for(const o of world?.merchantBuyOffers?.buyOffers??[]){const m=marketById.get(o.marketId);if(!m||!m.buyOfferIds.includes(o.offerId))e.push('BuyOffer:market-reference');}
  const accountIds=new Set((world?.currencyWallet?.accounts??[]).map(a=>a.agentId));
  for(const a of world?.agents??[])if(a.alive&&!accountIds.has(a.id))e.push('Wallet:missing-live-account');
  const knownPeople=new Set([...(world?.agents??[]),...(world?.archive??[])].map(a=>a.id));
  if((world?.merchantLedgers?.ledgers??[]).some(l=>!knownPeople.has(l.merchantId)))e.push('Ledger:agent');
  for(const a of [...(world?.agents??[]),...(world?.archive??[])])for(const x of validateMerchantProgression(a))e.push('MerchantCareer:'+a.id+':'+x);
  const tradeReceipts=new Map(world.tradeReplay.receipts.map(r=>[r.transactionId,r]));
  for(const r of world.tradeReplay.receipts){
    const payment=world.currencyWallet.receipts.find(x=>x.transactionId===r.transactionId);
    if(!payment||payment.kind!=='TRANSFER'||payment.fromAgentId!==r.buyerId||payment.toAgentId!==r.sellerId||payment.amount!==r.totalPrice||
      payment.evidence?.operation!=='TRADE_TRANSFER'||payment.evidence.marketId!==r.marketId||payment.evidence.listingId!==r.listingId||payment.evidence.reservationId!==r.reservationId)e.push('Trade:wallet-receipt');
    const reservation=world.merchantReservations.reservations.find(x=>x.id===r.reservationId);
    if(!reservation||reservation.status!=='COMMITTED'||reservation.transactionId!==r.transactionId)e.push('Trade:reservation-receipt');
    const listing=listingByRef.get(r.listingId);
    if(!listing||listing.marketId!==r.marketId||listing.sellerId!==r.sellerId||listing.itemKind!==r.itemKind||listing.revision<=reservation?.listingRevision)e.push('Trade:listing-receipt');
  }
  for(const r of world.merchantReservations.reservations)if(r.status==='COMMITTED'&&!tradeReceipts.has(r.transactionId))e.push('Reservation:lost-trade-replay');
  for(const r of world.currencyWallet.receipts)if(r.evidence?.operation==='TRADE_TRANSFER'&&!tradeReceipts.has(r.transactionId))e.push('Wallet:lost-trade-replay');
  const people=[...(world.agents??[]),...(world.archive??[])];
  for(const ledger of world.merchantLedgers.ledgers){
    const agent=people.find(a=>a.id===ledger.merchantId),count=ledger.purchases.length+ledger.sales.length;
    if(!agent||(agent.merchantTransactions??0)!==count||(agent.merchantExperience??0)!==count)e.push('Career:ledger-continuity');
    for(const [side,rows] of [['buyerId',ledger.purchases],['sellerId',ledger.sales]])for(const row of rows){
      const r=tradeReceipts.get(row.transactionId);
      if(!r||r[side]!==ledger.merchantId||r.quantity!==row.quantity||r.totalPrice!==row.totalPrice||r.itemIds.join(',')!==row.itemIds.join(','))e.push('Ledger:trade-receipt');
    }
  }
  for(const a of people)if((a.merchantTransactions??0)>0&&!world.merchantLedgers.ledgers.some(l=>l.merchantId===a.id))e.push('Career:missing-ledger');

  for(const a of people)e.push(...validateRc4MarketKnowledge(a));
  return e;
}

export function ensureRc4AccountForAgent(world,agentId){
  if(validateCurrencyWallet(world).length)return {ok:false,reason:'wallet'};
  if(world.currencyWallet.accounts.some(x=>x.agentId===agentId))return {ok:true,duplicate:true,balance:getBalance(world,agentId)};
  return createCurrencyAccount(world,{agentId});
}

function ownedTradeEvidence(world,agent){
  if(!agent?.alive)return [];
  const rows=[],seen=new Set();
  for(const item of world.rustPossessions?.items??[]){
    if(item?.location?.kind!=='bag'||item.location.agentId!==agent.id||typeof item.kind!=='string')continue;
    if(seen.has(item.kind))continue;
    const tradable=tradableRustItemIds(world,{agentId:agent.id,itemKind:item.kind});
    if(!tradable.includes(item.id))continue;
    seen.add(item.kind);rows.push({itemKind:item.kind,itemInstanceId:item.id,selfProduced:item.createdBy===agent.id});
  }
  return rows.sort((a,b)=>Number(b.selfProduced)-Number(a.selfProduced)||a.itemKind.localeCompare(b.itemKind)||a.itemInstanceId-b.itemInstanceId);
}

function merchantQualificationSnapshot(world,agent){
  const home=homeOf(world,agent.id,{completeOnly:true});
  const balance=getBalance(world,agent.id);
  const market=ownMarket(world,agent.id);
  const listingEvidence=(market?.listingIds??[]).filter(id=>world.merchantListings?.listings?.some(l=>l.id===id&&l.marketId===market.marketId)).length;
  const offerEvidence=(market?.buyOfferIds??[]).filter(id=>world.merchantBuyOffers?.buyOffers?.some(o=>o.offerId===id&&o.marketId===market.marketId)).length;
  const physicalEvidence=ownedTradeEvidence(world,agent).length;
  const evidenceCount=listingEvidence+offerEvidence+physicalEvidence;
  const evidenceId='MERCHANT:'+agent.id+':'+(market?.marketId??'NOMARKET')+':'+evidenceCount;
  return {
    agentId:agent.id,
    alive:agent.alive===true,
    lifeStage:lifeStage(world,agent),
    professionTransitionAllowed:agent.profession!=='adventurer'&&agent.profession!=='crafter',
    homeControl:home?{status:'CONFIRMED',houseId:home.houseId,evidenceId:'HOME:'+home.houseId}:{status:'ABSENT'},
    operatingCapital:Number.isSafeInteger(balance)?{status:'CONFIRMED',amount:balance}:{status:'UNKNOWN'},
    tradeKnowledge:evidenceCount>0?{status:'CONFIRMED',evidenceCount}:{status:'UNKNOWN',evidenceCount:0},
    evidenceId
  };
}

function autonomousMerchantTarget(world){
  const homeOwners=(world.agents??[]).filter(a=>a?.alive&&['ADULT','ELDER'].includes(lifeStage(world,a))&&homeOf(world,a.id,{completeOnly:true}));
  if(homeOwners.length===0)return 0;
  return Math.max(1,Math.ceil(homeOwners.length/RC4_MERCHANT_AUTONOMY_RULES.peoplePerMerchant));
}

export function autonomousMerchantEntryCandidate(world){
  if(!Number.isInteger(world?.tick)||world.tick<0||world.tick%RC4_MERCHANT_AUTONOMY_RULES.cadenceTicks!==0)return null;
  const target=autonomousMerchantTarget(world);
  const merchants=(world.agents??[]).filter(a=>a?.alive&&a.profession==='merchant').length;
  if(target===0||merchants>=target)return null;
  const candidates=[];
  for(const a of world.agents??[]){
    if(!a?.alive||a.profession==='merchant'||a.profession==='adventurer'||a.profession==='crafter')continue;
    if(!['ADULT','ELDER'].includes(lifeStage(world,a)))continue;
    const home=homeOf(world,a.id,{completeOnly:true});if(!home)continue;
    const balance=getBalance(world,a.id);if(!Number.isSafeInteger(balance)||balance<1)continue;
    const evidence=ownedTradeEvidence(world,a);if(!evidence.length)continue;
    const qualification=evaluateMerchantQualification(merchantQualificationSnapshot(world,a));
    if(qualification.status!=='SAT')continue;
    candidates.push({agentId:a.id,homeId:home.houseId,evidenceCount:evidence.length,selfProducedCount:evidence.filter(x=>x.selfProduced).length,balance});
  }
  candidates.sort((a,b)=>b.selfProducedCount-a.selfProducedCount||b.evidenceCount-a.evidenceCount||b.balance-a.balance||a.agentId-b.agentId);
  return candidates[0]??null;
}

function ownMarket(world,ownerId){
  return world.homeMarkets?.markets?.find(m=>m.ownerAgentId===ownerId&&['closed','open'].includes(m.status))??null;
}
function listingById(world,id){return world.merchantListings?.listings?.find(x=>x.id===id)??null;}
function offerById(world,id){return world.merchantBuyOffers?.buyOffers?.find(x=>x.offerId===id)??null;}

function canonicalMarketAdapter(){
  return Object.freeze({
    market:(state,marketId)=>{
      const r=projectHomeMarketForTrade(state,state.homeMarkets,{marketId});
      return r.ok?r.market:null;
    },
    listing:(state,listingId)=>listingById(state,listingId),
    reservation:(state,reservationId)=>reservationById(state.merchantReservations,reservationId),
    activeReservations:state=>globalActiveReservations(state.merchantReservations)
  });
}

function applyMerchantAccounting(staged,context){
  const receipt=context.receipt;
  const parties=[receipt.buyerId,receipt.sellerId];
  for(const merchantId of parties){
    const agent=staged.agents.find(a=>a.id===merchantId&&a.alive&&a.profession==='merchant');
    if(!agent)continue;
    const ensured=ensureLedger(staged,merchantId);if(!ensured.ok)return ensured;
    const index=ledgerIndex(staged,merchantId),ledger=staged.merchantLedgers.ledgers[index];
    const applied=applyCanonicalTradeExecutionToLedger(ledger,staged,context);
    if(applied.state!=='SAT')return {ok:false,reason:'ledger-'+applied.reason,detail:applied};
    const replaced=replaceMerchantLedgerInCollection(staged.merchantLedgers,applied.ledger);
    if(replaced.state!=='SAT')return {ok:false,reason:replaced.reason??'ledger-replace',detail:replaced};
    staged.merchantLedgers=replaced.collection;
    const progress=noteVerifiedCommittedMerchantTransaction(agent,applied);
    if(progress.status!=='SAT')return {ok:false,reason:'career-'+progress.reason,detail:progress};
  }
  return {ok:true};
}

function matchingBuyOffer(staged,receipt){
  const listing=listingById(staged,receipt.listingId);
  if(!listing?.buyOfferId)return null;
  const offer=offerById(staged,listing.buyOfferId);
  return offer&&offer.buyerId===receipt.buyerId?offer:null;
}

function postSettlementAdapter(){
  return Object.freeze({
    apply:(staged,context)=>{
      const r=context.receipt,res=reservationById(staged.merchantReservations,r.reservationId);
      if(!res)return {ok:false,reason:'reservation-missing'};
      const listing=applyListingSettlementInCollection(staged.merchantListings,r.listingId,{
        expectedRevision:res.listingRevision,quantity:r.quantity,unitPrice:r.unitPrice
      });
      if(listing.state!=='SAT')return {ok:false,reason:listing.reason};
      staged.merchantListings=listing.collection;

      const committed=commitReservation(staged.merchantReservations,{reservationId:r.reservationId,transactionId:r.transactionId,terminalTick:staged.tick});
      if(committed.state!=='SAT')return {ok:false,reason:committed.reason};
      staged.merchantReservations=committed.reservationState;

      const offer=matchingBuyOffer(staged,r);
      if(offer){
        const filled=applyBuyOfferSettlementInCollection(staged.merchantBuyOffers,offer.offerId,{quantity:r.quantity,unitPrice:r.unitPrice});
        if(filled.state!=='SAT')return {ok:false,reason:filled.reason};
        staged.merchantBuyOffers=filled.collection;
      }

      const accounting=applyMerchantAccounting(staged,context);
      if(!accounting.ok)return accounting;

      const buyer=staged.agents.find(a=>a.id===r.buyerId);
      // Arrival was proven on the live canonical task before settlement. The staged
      // clone intentionally does not inherit WeakSet identity, so clear by RC4 metadata here.
      if(buyer?.task?.rc4MarketTravel){buyer.task=null;buyer.moveTick=0;}
      return {ok:true};
    },
    verify:(staged,context)=>{
      const r=context.receipt,listing=listingById(staged,r.listingId),reservation=reservationById(staged.merchantReservations,r.reservationId);
      if(!listing||!reservation||reservation.status!=='COMMITTED'||reservation.transactionId!==r.transactionId)
        return {ok:false,reason:'market-postcondition'};
      if(listing.quantity<0||!['OPEN','FILLED'].includes(listing.status))return {ok:false,reason:'listing-postcondition'};
      const errors=validateRc4EconomyState(staged);
      return errors.length?{ok:false,reason:'rc4-postcondition',errors}:{ok:true};
    }
  });
}

function replaceWorldRoot(live,next){
  retainCanonicalMarketTravelOnCommit(live,next);
  for(const key of Object.keys(live))delete live[key];
  Object.assign(live,next);
}

function txId(world,{listingId,buyerId,reservationId}){
  return deterministicId('TX:',{tick:world.tick,listingId,buyerId,reservationId});
}

export function prepareRc4MarketTravel(world,{agentId,marketId}={}){
  const marketResult=projectHomeMarketForTrade(world,world.homeMarkets,{marketId});
  if(!marketResult.ok||marketResult.market.open!==true)return fail('market-closed','ตลาดยังไม่เปิด');
  const agent=world.agents.find(a=>a.id===agentId&&a.alive);
  if(!agent)return fail('agent','ไม่พบ Clone');
  if(!knowsRc4Market(agent,marketId))return fail('market-unknown','Clone ยังไม่เคยพบตลาดนี้');
  if(!canPreemptForCanonicalMarketTravel(agent.task,agent))return fail('busy','Clone กำลังทำงานที่หยุดไม่ได้');
  const path=pathTo(world,agent,marketResult.market);
  if(path===null)return fail('no-path','ไม่มีเส้นทางไปตลาด');
  const built=createCanonicalMarketTravelTask(world,agent,marketResult.market,path);
  if(built.state!=='SAT')return fail(built.reason,'สร้างเส้นทางตลาดไม่ได้');
  return {ok:true,agent,task:built.task,market:marketResult.market};
}

function buyListing(world,{buyerId,listingId,listingRevision}={}){
  const listing=listingById(world,listingId);
  if(!listing||listing.status!=='OPEN')return fail('listing','Listing ไม่พร้อม');
  if(!positive(listingRevision)||listingRevision!==listing.revision)return fail('listing-stale','Listing เปลี่ยนแล้ว กรุณาดูข้อมูลใหม่');
  if(listing.buyOfferId){const offer=offerById(world,listing.buyOfferId);if(!offer||offer.status!=='OPEN'||offer.buyerId!==buyerId||offer.unitPrice!==listing.unitPrice||offer.quantityWanted!==listing.quantity)return fail('buy-offer-binding','รายการรับซื้อนี้เป็นของผู้ซื้อที่ระบุเท่านั้น');}
  const buyer=world.agents.find(a=>a.id===buyerId&&a.alive);
  if(!knowsRc4Market(buyer,listing.marketId))return fail('market-unknown','ไม่รู้จักตลาดนี้');
  if(!hasRc4PurchaseNeed(world,buyer,listing))return fail('item-not-needed','ไม่มีความต้องการสินค้านี้จากงานหรือ BuyOffer จริง');
  const marketResult=projectHomeMarketForTrade(world,world.homeMarkets,{marketId:listing.marketId});
  if(!marketResult.ok||marketResult.market.open!==true)return fail('market','ตลาดปิด');
  const arrival=verifyCanonicalMarketArrival(world,{agentId:buyerId,market:marketResult.market});
  if(arrival.state!=='SAT')return fail(arrival.reason,arrival.reason==='still-travelling'?'ยังเดินไม่ถึงตลาด':'ต้องเดินมาถึงตลาดก่อน');

  const itemIds=tradableRustItemIds(world,{agentId:listing.sellerId,itemKind:listing.itemKind});
  if(!itemIds.includes(listing.itemInstanceId))return fail('seller-item','สินค้านี้ไม่อยู่กับผู้ขายแล้ว');

  const prepared=clone(world);
  const preparedListing=listingById(prepared,listingId);
  const reserved=createReservation(prepared,prepared.merchantReservations,{
    listing:preparedListing,listingRevision:preparedListing.revision,buyerId,itemIds:[preparedListing.itemInstanceId],createdTick:prepared.tick
  });
  if(reserved.state!=='SAT')return fail(reserved.reason,'จองสินค้าไม่ได้');
  prepared.merchantReservations=reserved.reservationState;
  const totalPrice=preparedListing.unitPrice;
  const transactionId=txId(prepared,{listingId,buyerId,reservationId:reserved.reservation.id});
  const proposal={
    transactionId,marketId:preparedListing.marketId,sellerId:preparedListing.sellerId,buyerId,
    itemKind:preparedListing.itemKind,itemInstanceId:preparedListing.itemInstanceId,quantity:1,
    unitPrice:preparedListing.unitPrice,totalPrice,listingId,reservationId:reserved.reservation.id
  };
  const wallet=createTradeWalletAdapter({
    transactionId,fromAgentId:buyerId,toAgentId:preparedListing.sellerId,amount:totalPrice,
    evidence:{marketId:preparedListing.marketId,listingId,reservationId:reserved.reservation.id}
  });
  const result=settleTradeAtomic(prepared,proposal,{
    wallet,item:rustTradeItemAdapter,market:canonicalMarketAdapter(),postSettlement:postSettlementAdapter()
  });
  if(!result.ok)return fail(result.reason,'ซื้อขายไม่สำเร็จ',{detail:result});
  if(result.duplicate)return {ok:true,duplicate:true,transactionId,receipt:result.receipt};
  replaceWorldRoot(world,result.state);
  return {ok:true,duplicate:false,transactionId,receipt:result.receipt,message:'ซื้อขายสำเร็จ'};
}

function acceptBuyOffer(world,{producerId,offerId,itemId}={}){
  const offer=offerById(world,offerId);
  if(!offer||offer.status!=='OPEN')return fail('buy-offer','Buy Offer ไม่พร้อม');
  const item=world.rustPossessions?.items?.find(i=>i.id===itemId);
  if(!item||item.kind!==offer.itemKind||!tradableRustItemIds(world,{agentId:producerId,itemKind:offer.itemKind}).includes(itemId))
    return fail('item','ผู้ผลิตไม่มี item นี้ในกระเป๋า');
  const matched=proposeProducerBuyOfferMatch(offer,{producerId,itemInstanceIds:[itemId]});
  if(matched.state!=='SAT')return fail(matched.reason,'จับคู่ Buy Offer ไม่ได้');
  const p=matched.proposal;
  const made=createListingInCollection(world.merchantListings,p.listingRequest);
  if(made.state!=='SAT')return fail(made.reason,'สร้าง Listing ฝั่งผู้ผลิตไม่ได้');
  const ref=attachHomeMarketListingReference(world,world.homeMarkets,p.homeMarketListingReferenceRequest);
  if(!ref.ok)return fail(ref.reason,'ผูก Listing เข้าตลาดไม่ได้');
  world.merchantListings=made.collection;
  world.homeMarkets=ref.marketState;
  return {ok:true,listingId:made.listing.id,marketId:offer.marketId,message:'ผู้ผลิตตอบรับ Buy Offer แล้ว'};
}

function rc4CommandInternal(world,type,data={}){
  if(typeof type!=='string'||!type.startsWith('RC4_'))return null;
  const stateErrors=validateRc4EconomyState(world);
  if(stateErrors.length)return fail('rc4-state','RC4 state ไม่พร้อม',{errors:stateErrors});

  if(type==='RC4_BECOME_MERCHANT'){
    const liveAgent=world.agents.find(a=>a.id===data.agentId&&a.alive);if(!liveAgent)return fail('agent','ไม่พบ Clone');
    const qualification=merchantQualificationSnapshot(world,liveAgent);
    const evaluated=evaluateMerchantQualification(qualification);
    if(evaluated.status!=='SAT')return fail('qualification','ยังไม่ผ่านคุณสมบัติ Merchant',{qualification:evaluated});

    const stagedAgent=clone(liveAgent);
    const changed=adoptMerchantProfession(stagedAgent,qualification,world.tick);
    if(changed.status!=='SAT')return fail(changed.reason??'profession','เปลี่ยนอาชีพไม่ได้',{qualification:evaluated});

    const ensured=ensureMerchantLedgerInCollection(world.merchantLedgers,stagedAgent.id);
    if(ensured.state!=='SAT')return fail(ensured.reason??'merchant-ledger','สร้าง Merchant Ledger ไม่ได้',{detail:ensured});

    const probe={
      ...world,
      agents:world.agents.map(a=>a.id===stagedAgent.id?stagedAgent:a),
      merchantLedgers:ensured.collection
    };
    const errors=validateRc4EconomyState(probe);
    if(errors.length)return fail('rc4-postcondition','Merchant state ไม่ผ่าน postcondition',{errors});

    liveAgent.profession=stagedAgent.profession;
    liveAgent.professionSinceTick=stagedAgent.professionSinceTick;
    liveAgent.career=clone(stagedAgent.career);
    world.merchantLedgers=ensured.collection;
    return {ok:true,agentId:liveAgent.id,profession:'merchant',eventType:'career',eventText:liveAgent.name+' เป็น Merchant แล้ว'};
  }

  if(type==='RC4_CREATE_MARKET'){
    const agent=world.agents.find(a=>a.id===data.agentId&&a.alive);if(!agent)return fail('agent','ไม่พบ Clone');
    if(agent.profession==='adventurer'||agent.profession==='crafter')return fail('profession-locked','อาชีพพิเศษปัจจุบันเปิดสาย Merchant ไม่ได้');
    const home=homeOf(world,agent.id,{completeOnly:true});if(!home)return fail('home','ต้องมีบ้านส่วนตัวที่สร้างเสร็จ');
    const made=createHomeMarket(world,world.homeMarkets,{ownerAgentId:agent.id,homeId:home.houseId});
    if(!made.ok)return fail(made.reason,made.message);
    world.homeMarkets=made.marketState;
    return {ok:true,duplicate:made.duplicate,marketId:made.market.marketId,eventType:'market',...(made.duplicate?{}:{eventText:agent.name+' เตรียม Home Market'})};
  }

  if(type==='RC4_OPEN_MARKET'||type==='RC4_CLOSE_MARKET'){
    const market=world.homeMarkets.markets.find(m=>m.marketId===data.marketId);if(!market)return fail('market','ไม่พบตลาด');
    if(!positive(data.agentId)||data.agentId!==market.ownerAgentId)return fail('owner','เฉพาะเจ้าของ Home Market เท่านั้น');
    const owner=world.agents.find(a=>a.id===data.agentId&&a.alive);
    if(!owner)return fail('owner','เจ้าของตลาดไม่พร้อม');
    if(type==='RC4_OPEN_MARKET'&&owner.profession!=='merchant')return fail('merchant','ต้องเป็น Merchant ก่อนเปิดร้าน');
    const changed=(type==='RC4_OPEN_MARKET'?openHomeMarket:closeHomeMarket)(world,world.homeMarkets,{marketId:data.marketId,ownerAgentId:data.agentId});
    if(!changed.ok)return fail(changed.reason,changed.message);
    world.homeMarkets=changed.marketState;
    return {ok:true,duplicate:changed.duplicate,marketId:data.marketId,status:changed.market.status,eventType:'market',...(changed.duplicate?{}:{eventText:'ตลาด '+changed.market.status})};
  }

  if(type==='RC4_CREATE_LISTING'){
    const agent=world.agents.find(a=>a.id===data.agentId&&a.alive&&a.profession==='merchant');if(!agent)return fail('merchant','ต้องเป็น Merchant');
    const market=ownMarket(world,agent.id);if(!market)return fail('market','Merchant ยังไม่มี Home Market');
    if(!validMoney(data.unitPrice))return fail('price','ราคาต้องเป็นจำนวนเต็มบวก');
    const item=world.rustPossessions?.items?.find(i=>i.id===data.itemId);
    if(!item||!tradableRustItemIds(world,{agentId:agent.id,itemKind:item.kind}).includes(item.id))return fail('item','item นี้ลงขายไม่ได้');
    const id=listingIdFor({marketId:market.marketId,sellerId:agent.id,itemInstanceId:item.id,requestId:data.requestId??null});
    const made=createListingInCollection(world.merchantListings,{id,marketId:market.marketId,sellerId:agent.id,itemKind:item.kind,itemInstanceId:item.id,quantity:1,unitPrice:data.unitPrice,status:'OPEN'});
    if(made.state!=='SAT')return fail(made.reason,'สร้าง Listing ไม่ได้');
    const ref=attachHomeMarketListingReference(world,world.homeMarkets,{marketId:market.marketId,ownerAgentId:agent.id,referenceId:id});
    if(!ref.ok)return fail(ref.reason,'ผูก Listing เข้าตลาดไม่ได้');
    world.merchantListings=made.collection;world.homeMarkets=ref.marketState;
    return {ok:true,duplicate:made.duplicate,listingId:id,marketId:market.marketId,message:'ลงขาย '+item.kind+' แล้ว'};
  }

  if(type==='RC4_CREATE_BUY_OFFER'){
    const agent=world.agents.find(a=>a.id===data.agentId&&a.alive);if(!agent)return fail('agent','ไม่พบ Clone');
    const market=ownMarket(world,agent.id);if(!market)return fail('market','ยังไม่มี Home Market');
    if(agent.profession!=='merchant'&&market.status!=='closed')return fail('merchant','ตลาดเตรียมการต้องปิดก่อนเป็น Merchant');
    if(typeof data.itemKind!=='string'||!data.itemKind||!validMoney(data.unitPrice))return fail('offer','ข้อมูล Buy Offer ไม่ถูกต้อง');
    const made=createBuyOfferInCollection(world.merchantBuyOffers,{marketId:market.marketId,buyerId:agent.id,itemKind:data.itemKind,quantityWanted:1,unitPrice:data.unitPrice,createdTick:world.tick});
    if(made.state!=='SAT')return fail(made.reason,'สร้าง Buy Offer ไม่ได้');
    const ref=attachHomeMarketBuyOfferReference(world,world.homeMarkets,made.referenceRequest);
    if(!ref.ok)return fail(ref.reason,'ผูก Buy Offer เข้าตลาดไม่ได้');
    world.merchantBuyOffers=made.collection;world.homeMarkets=ref.marketState;
    return {ok:true,duplicate:made.duplicate,offerId:made.offer.offerId,marketId:market.marketId,message:'สร้าง Buy Offer แล้ว'};
  }

  if(type==='RC4_ACCEPT_BUY_OFFER')return acceptBuyOffer(world,data);

  if(type==='RC4_TRAVEL_TO_MARKET'){
    const prepared=prepareRc4MarketTravel(world,data);if(!prepared.ok)return prepared;
    prepared.agent.task=prepared.task;prepared.agent.moveTick=0;
    return {ok:true,agentId:prepared.agent.id,marketId:data.marketId,pathLength:prepared.task.path.length,message:'กำลังเดินไปตลาด'};
  }

  if(type==='RC4_CANCEL_MARKET_TRAVEL'){
    const agent=world.agents.find(a=>a.id===data.agentId&&a.alive);
    if(!agent||!isCanonicalMarketTravelTask(agent.task))return fail('travel','ไม่มีการเดินทางไปตลาด');
    agent.task=null;agent.moveTick=0;return {ok:true,message:'ยกเลิกการเดินทางไปตลาด'};
  }

  if(type==='RC4_BUY_LISTING')return buyListing(world,data);
  return fail('command','ไม่รู้จักคำสั่ง RC4');
}

export function rc4MarketReadModel(world,selectedAgentId=null){
  const selected=world.agents?.find(a=>a.id===selectedAgentId)??null;
  const home=selected?homeOf(world,selected.id,{completeOnly:true}):null;
  const balance=selected?getBalance(world,selected.id):null;
  const own=selected?ownMarket(world,selected.id):null;
  const ledger=selected?merchantLedgerFromCollection(world.merchantLedgers,selected.id):null;
  const bag=(world.rustPossessions?.items??[]).filter(i=>selected&&i.location?.kind==='bag'&&i.location.agentId===selected.id)
    .map(i=>({id:i.id,kind:i.kind,createdBy:i.createdBy,tradable:tradableRustItemIds(world,{agentId:selected.id,itemKind:i.kind}).includes(i.id)}));
  const markets=knownRc4Markets(selected).map(m=>({
    ...m,
    trade:Number.isSafeInteger(m.tradeRange)?{id:m.marketId,open:m.status==='open',...m.position,tradeRange:m.tradeRange}:null,
    listings:knownRc4Listings(selected).filter(l=>l.marketId===m.marketId).map(l=>({...l,needed:hasRc4PurchaseNeed(world,selected,l)})),
    offers:knownRc4BuyOffers(selected).filter(o=>o.marketId===m.marketId),
    ledger:merchantLedgerFromCollection(world.merchantLedgers,m.ownerAgentId)
  }));
  let arrival=null;
  if(selected&&isCanonicalMarketTravelTask(selected.task)){
    const market=markets.find(m=>m.marketId===selected.task.rc4MarketTravel.marketId);
    if(market?.trade)arrival=verifyCanonicalMarketArrival(world,{agentId:selected.id,market:market.trade});
  }
  const qualification=selected?evaluateMerchantQualification(merchantQualificationSnapshot(world,selected)):null;
  return clone({
    version:RC4_ECONOMY_ROOT_VERSION,
    selected:selected?{id:selected.id,name:selected.name,profession:selected.profession??null,balance,homeId:home?.houseId??null}:null,
    qualification,
    ownMarket:own?clone(own):null,
    ledger:ledger?clone(ledger):null,
    bag,
    markets,
    arrival
  });
}

export function rc4WorldMarketMarkers(world){
  const rows=[];
  for(const m of world.homeMarkets?.markets??[]){
    const p=projectHomeMarketForTrade(world,world.homeMarkets,{marketId:m.marketId});
    if(!p.ok)continue;
    const owner=world.agents.find(a=>a.id===m.ownerAgentId);
    rows.push({marketId:m.marketId,ownerAgentId:m.ownerAgentId,ownerName:owner?.name??'UNKNOWN',status:m.status,...p.market});
  }
  return rows;
}

export function rc4Command(world,type,data={}){
  const result=rc4CommandInternal(world,type,data);
  if(result?.ok&&!result.duplicate)observeRc4Markets(world);
  return result;
}
/** Tick maintenance delegates lifecycle writes to Home Market and Reservation owners.
 * Autonomous Merchant entry is bounded and routes all writes through canonical RC4 commands.
 */
export function stepRc4Economy(world){
  let stepResult=null;
  const entry=autonomousMerchantEntryCandidate(world);
  if(entry){
    let market=ownMarket(world,entry.agentId);
    if(!market){
      const prepared=rc4Command(world,'RC4_CREATE_MARKET',{agentId:entry.agentId});
      if(prepared?.ok)market=ownMarket(world,entry.agentId);
    }
    if(market){
      const promoted=rc4Command(world,'RC4_BECOME_MERCHANT',{agentId:entry.agentId});
      if(promoted?.ok)stepResult={changed:true,kind:'merchant-entry',agentId:entry.agentId,marketId:market.marketId,eventType:promoted.eventType??'career',eventText:promoted.eventText??null};
    }
  }
  if(!world.homeMarkets?.markets?.length)return stepResult;
  const homes=reconcileHomeMarkets(world,world.homeMarkets);
  if(!homes.ok)throw new Error('RC4 Home Market lifecycle invalid');
  if(homes.changed)world.homeMarkets=homes.marketState;
  if(world.merchantReservations.reservations.some(r=>r.status==='ACTIVE')){
    const reservations=reconcileReservations(world,world.merchantReservations,{listings:world.merchantListings.listings});
    if(reservations.state!=='SAT')throw new Error('RC4 Reservation lifecycle invalid');
    world.merchantReservations=reservations.reservationState;
  }
  observeRc4Markets(world);
  return stepResult;
}
