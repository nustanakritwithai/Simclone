import {lifeStage} from './lifecycle.mjs?v=0.5.0';
import {
  migrateHomeMarketState,validateHomeMarketState,createHomeMarket,openHomeMarket,closeHomeMarket,
  attachHomeMarketListingReference,attachHomeMarketBuyOfferReference,projectHomeMarketForTrade
} from './home-market.mjs?v=0.5.0';
import {
  migrateListingCollection,validateListingCollection,createListingInCollection,applyListingSettlementInCollection,
  listingIdFor
} from './merchant-listing.mjs?v=0.5.0';
import {
  migrateBuyOfferCollection,validateBuyOfferCollection,createBuyOfferInCollection,proposeProducerBuyOfferMatch,
  applyBuyOfferSettlementInCollection
} from './merchant-buy-offer.mjs?v=0.5.0';
import {
  migrateReservationState,validateReservationState,createReservation,reservationById,globalActiveReservations,commitReservation
} from './merchant-reservation.mjs?v=0.5.0';
import {
  migrateLegacyCurrencyWallet,validateCurrencyWallet,getBalance,createCurrencyAccount
} from './currency-wallet.mjs?v=0.5.0';
import {createTradeWalletAdapter} from './trade-wallet-adapter.mjs?v=0.5.0';
import {rustTradeItemAdapter} from './trade-rust-adapter.mjs?v=0.5.0';
import {createTradeReplayState,validateTradeReplayState,settleTradeAtomic} from './trade-kernel.mjs?v=0.5.0';
import {
  migrateMerchantLedgerCollection,validateMerchantLedgerCollection,merchantLedgerFromCollection,
  ensureMerchantLedgerInCollection,replaceMerchantLedgerInCollection,applyCanonicalTradeExecutionToLedger
} from './merchant-ledger.mjs?v=0.5.0';
import {
  adoptMerchantProfession,noteVerifiedCommittedMerchantTransaction,validateMerchantProgression
} from './merchant-career.mjs?v=0.5.0';
import {verifyCanonicalMarketArrival} from './rc4-market-arrival.mjs?v=0.5.0';

export const RC4_MERCHANT_RUNTIME_VERSION='RC4-merchant-runtime/1';
const clone=v=>structuredClone(v);
const validAgentId=v=>Number.isSafeInteger(v)&&v>0;
const validMoney=v=>Number.isSafeInteger(v)&&v>0;
const validId=v=>typeof v==='string'&&v.length>0&&v.length<=160;
const fail=(reason,extra={})=>({ok:false,reason,...extra});
const marketRow=(s,id)=>s.homeMarkets?.markets?.find(m=>m.marketId===id)??null;
const listingRow=(s,id)=>s.merchantListings?.listings?.find(l=>l.id===id)??null;
const offerRow=(s,id)=>s.merchantBuyOffers?.buyOffers?.find(o=>o.offerId===id)??null;
const agentById=(s,id)=>s.agents?.find(a=>a.id===id&&a.alive===true)??null;

function hash32(text){
  let h=0x811c9dc5;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}
  return h.toString(16).padStart(8,'0');
}
const txid=(s,buyerId,listingId)=>'TX:'+s.tick+':'+buyerId+':'+hash32(listingId+'|'+buyerId+'|'+s.tick);

export function migrateRc4MerchantState(s){
  if(!s||typeof s!=='object'||Array.isArray(s)||!Array.isArray(s.agents))return fail('world');

  const hm=migrateHomeMarketState(s.homeMarkets);
  if(hm.state!=='SAT')return fail('home-markets',{detail:hm});
  s.homeMarkets=hm.marketState;

  const listings=migrateListingCollection(s.merchantListings);
  if(listings.state!=='SAT')return fail('merchant-listings',{detail:listings});
  s.merchantListings=listings.collection;

  const offers=migrateBuyOfferCollection(s.merchantBuyOffers);
  if(offers.state!=='SAT')return fail('merchant-buy-offers',{detail:offers});
  s.merchantBuyOffers=offers.collection;

  const reservations=migrateReservationState(s.merchantReservations);
  if(reservations.state!=='SAT')return fail('merchant-reservations',{detail:reservations});
  s.merchantReservations=reservations.reservationState;

  const ledgers=migrateMerchantLedgerCollection(s.merchantLedgers);
  if(ledgers.state!=='SAT')return fail('merchant-ledgers',{detail:ledgers});
  s.merchantLedgers=ledgers.collection;

  if(s.tradeReplay===undefined)s.tradeReplay=createTradeReplayState();
  if(validateTradeReplayState(s).length)return fail('trade-replay');

  const wallet=migrateLegacyCurrencyWallet(s);
  if(!wallet.ok)return fail('currency-wallet',{detail:wallet});

  for(const a of s.agents){
    const errors=validateMerchantProgression(a);
    if(errors.length)return fail('merchant-career',{agentId:a.id,errors});
  }
  return {ok:true,migrated:true};
}

export function validateRc4MerchantState(s){
  const e=[];
  if(validateHomeMarketState(s?.homeMarkets).length)e.push('homeMarkets');
  if(validateListingCollection(s?.merchantListings).length)e.push('merchantListings');
  if(validateBuyOfferCollection(s?.merchantBuyOffers).length)e.push('merchantBuyOffers');
  if(validateReservationState(s?.merchantReservations).length)e.push('merchantReservations');
  if(validateMerchantLedgerCollection(s?.merchantLedgers).length)e.push('merchantLedgers');
  if(validateTradeReplayState(s).length)e.push('tradeReplay');
  if(validateCurrencyWallet(s).length)e.push('currencyWallet');
  for(const a of s?.agents??[])if(validateMerchantProgression(a).length)e.push('merchantCareer:'+a.id);
  return e;
}

export function ensureRc4AgentAccount(s,agentId){
  if(!s?.currencyWallet)return {ok:true,changed:false};
  if(!validAgentId(agentId))return fail('agent');
  if(s.currencyWallet.accounts.some(a=>a.agentId===agentId))return {ok:true,changed:false};
  const r=createCurrencyAccount(s,{agentId});
  return r.ok?{ok:true,changed:true,agentId}:r;
}

function commitCandidate(live,next){
  const errors=validateRc4MerchantState(next);
  if(errors.length)return fail('rc4-postcondition',{errors});
  const replacement=clone(next);
  for(const key of Object.keys(live))delete live[key];
  Object.assign(live,replacement);
  return {ok:true};
}

function projectMarket(s,marketId){
  const p=projectHomeMarketForTrade(s,s.homeMarkets,{marketId});
  return p.ok?p:null;
}
function marketAdapter(){
  return Object.freeze({
    market:(state,id)=>projectMarket(state,id)?.market??null,
    listing:(state,id)=>listingRow(state,id)?clone(listingRow(state,id)):null,
    reservation:(state,id)=>reservationById(state.merchantReservations,id),
    activeReservations:state=>globalActiveReservations(state.merchantReservations)
  });
}
function ensureLedgerForMerchant(staged,merchantId){
  const ensured=ensureMerchantLedgerInCollection(staged.merchantLedgers,merchantId);
  if(ensured.state!=='SAT')return ensured;
  staged.merchantLedgers=ensured.collection;
  return {state:'SAT',ledger:ensured.ledger};
}
function applyMerchantLedgerAndCareer(staged,context,merchantId){
  const a=agentById(staged,merchantId);
  if(!a||a.profession!=='merchant')return {ok:true,skipped:true};
  const ensured=ensureLedgerForMerchant(staged,merchantId);
  if(ensured.state!=='SAT')return {ok:false,reason:ensured.reason??'ledger'};
  const applied=applyCanonicalTradeExecutionToLedger(ensured.ledger,staged,context);
  if(applied.state!=='SAT')return {ok:false,reason:applied.reason??'ledger-ingest',state:applied.state};
  const replaced=replaceMerchantLedgerInCollection(staged.merchantLedgers,applied.ledger);
  if(replaced.state!=='SAT')return {ok:false,reason:replaced.reason??'ledger-replace'};
  staged.merchantLedgers=replaced.collection;
  const progress=noteVerifiedCommittedMerchantTransaction(a,applied);
  if(progress.status!=='SAT')return {ok:false,reason:progress.reason??'merchant-career'};
  return {ok:true,progress};
}
function postSettlementAdapter({buyOfferId=null}={}){
  return Object.freeze({
    apply:(staged,context)=>{
      const r=context.receipt;
      const listing=applyListingSettlementInCollection(staged.merchantListings,r.listingId,{
        expectedRevision:staged.merchantReservations.reservations.find(x=>x.id===r.reservationId)?.listingRevision,
        quantity:r.quantity,unitPrice:r.unitPrice
      });
      if(listing.state!=='SAT')return {ok:false,reason:listing.reason??'listing-settlement'};
      staged.merchantListings=listing.collection;

      const reservation=commitReservation(staged.merchantReservations,{
        reservationId:r.reservationId,transactionId:r.transactionId,terminalTick:staged.tick
      });
      if(reservation.state!=='SAT')return {ok:false,reason:reservation.reason??'reservation-settlement'};
      staged.merchantReservations=reservation.reservationState;

      if(buyOfferId){
        const offer=applyBuyOfferSettlementInCollection(staged.merchantBuyOffers,buyOfferId,{quantity:r.quantity,unitPrice:r.unitPrice});
        if(offer.state!=='SAT')return {ok:false,reason:offer.reason??'buy-offer-settlement'};
        staged.merchantBuyOffers=offer.collection;
      }

      for(const id of [...new Set([r.buyerId,r.sellerId])]){
        const a=agentById(staged,id);
        if(a?.profession!=='merchant')continue;
        const accounted=applyMerchantLedgerAndCareer(staged,context,id);
        if(!accounted.ok)return accounted;
      }
      return {ok:true};
    },
    verify:(staged,context)=>{
      const r=context.receipt;
      const listing=listingRow(staged,r.listingId);
      const reservation=reservationById(staged.merchantReservations,r.reservationId);
      if(!listing||listing.revision<2)return {ok:false,reason:'listing-postcondition'};
      if(!reservation||reservation.status!=='COMMITTED'||reservation.transactionId!==r.transactionId)return {ok:false,reason:'reservation-postcondition'};
      const errors=validateRc4MerchantState(staged);
      return errors.length?{ok:false,reason:'rc4-postcondition',errors}:{ok:true};
    }
  });
}

function settleOnCandidate(candidate,{proposal,buyOfferId=null}){
  const wallet=createTradeWalletAdapter({
    transactionId:proposal.transactionId,fromAgentId:proposal.buyerId,toAgentId:proposal.sellerId,amount:proposal.totalPrice,
    evidence:{marketId:proposal.marketId,listingId:proposal.listingId,reservationId:proposal.reservationId}
  });
  return settleTradeAtomic(candidate,proposal,{
    wallet,item:rustTradeItemAdapter,market:marketAdapter(),postSettlement:postSettlementAdapter({buyOfferId})
  });
}

function ownedMarket(s,marketId,ownerAgentId){
  const m=marketRow(s,marketId);
  return m&&m.ownerAgentId===ownerAgentId?m:null;
}

function createListingCandidate(candidate,{marketId,sellerId,itemInstanceId,unitPrice}){
  if(!validMoney(unitPrice))return fail('unit-price');
  const market=ownedMarket(candidate,marketId,sellerId);if(!market)return fail('market-owner');
  const item=candidate.rustPossessions?.items?.find(i=>i.id===itemInstanceId);
  if(!item||item.location?.kind!=='bag'||item.location.agentId!==sellerId)return fail('item');
  const tradable=rustTradeItemAdapter.tradableItemIds(candidate,{agentId:sellerId,itemKind:item.kind});
  if(!tradable.includes(itemInstanceId))return fail('item-not-tradable');
  const id=listingIdFor({marketId,sellerId,itemInstanceId});if(!id)return fail('listing-id');
  const made=createListingInCollection(candidate.merchantListings,{
    id,marketId,sellerId,itemKind:item.kind,itemInstanceId,quantity:1,unitPrice,status:'OPEN'
  });
  if(made.state!=='SAT')return fail(made.reason??'listing',{detail:made});
  candidate.merchantListings=made.collection;
  const attached=attachHomeMarketListingReference(candidate,candidate.homeMarkets,{marketId,ownerAgentId:market.ownerAgentId,referenceId:id});
  if(!attached.ok)return fail(attached.reason??'market-reference');
  candidate.homeMarkets=attached.marketState;
  return {ok:true,listing:made.listing};
}

export function rc4MerchantCommand(s,type,data={}){
  if(!type?.startsWith('RC4_'))return null;
  if(validateRc4MerchantState(s).length)return fail('rc4-state');

  if(type==='RC4_CREATE_HOME_MARKET'){
    const candidate=clone(s);
    const r=createHomeMarket(candidate,candidate.homeMarkets,{ownerAgentId:data.agentId,homeId:data.homeId??null});
    if(!r.ok)return r;candidate.homeMarkets=r.marketState;
    const committed=commitCandidate(s,candidate);return committed.ok?{ok:true,market:r.market,duplicate:r.duplicate}:committed;
  }

  if(type==='RC4_CREATE_BUY_OFFER'){
    const candidate=clone(s),market=ownedMarket(candidate,data.marketId,data.agentId);
    if(!market)return fail('market-owner');
    const made=createBuyOfferInCollection(candidate.merchantBuyOffers,{
      marketId:data.marketId,buyerId:data.agentId,itemKind:data.itemKind,quantityWanted:data.quantityWanted??1,
      unitPrice:data.unitPrice,createdTick:candidate.tick
    });
    if(made.state!=='SAT')return fail(made.reason??'buy-offer',{detail:made});
    candidate.merchantBuyOffers=made.collection;
    const attached=attachHomeMarketBuyOfferReference(candidate,candidate.homeMarkets,{
      marketId:data.marketId,ownerAgentId:data.agentId,referenceId:made.offer.offerId
    });
    if(!attached.ok)return fail(attached.reason??'market-reference');
    candidate.homeMarkets=attached.marketState;
    const committed=commitCandidate(s,candidate);return committed.ok?{ok:true,offer:made.offer,duplicate:made.duplicate}:committed;
  }

  if(type==='RC4_QUALIFY_MERCHANT'){
    const candidate=clone(s),a=agentById(candidate,data.agentId),market=ownedMarket(candidate,data.marketId,data.agentId);
    if(!a||!market)return fail('merchant-candidate');
    const intents=(market.listingIds?.length??0)+(market.buyOfferIds?.length??0);
    const balance=getBalance(candidate,a.id);
    const q={
      agentId:a.id,alive:true,lifeStage:lifeStage(candidate,a),
      professionTransitionAllowed:a.profession!=='adventurer',
      homeControl:{status:'CONFIRMED',houseId:market.homeId,evidenceId:'HOME:'+market.homeId},
      operatingCapital:Number.isSafeInteger(balance)?{status:'CONFIRMED',amount:balance}:{status:'UNKNOWN',amount:null},
      tradeKnowledge:intents>0?{status:'CONFIRMED',evidenceCount:intents}:{status:'UNKNOWN',evidenceCount:0},
      evidenceId:'MERCHANT:'+market.marketId+':'+candidate.tick
    };
    const adopted=adoptMerchantProfession(a,q,candidate.tick);
    if(adopted.status!=='SAT'||a.profession!=='merchant')return fail('merchant-qualification',{detail:adopted});
    const ensured=ensureLedgerForMerchant(candidate,a.id);if(ensured.state!=='SAT')return fail('merchant-ledger');
    const committed=commitCandidate(s,candidate);return committed.ok?{ok:true,agentId:a.id,profession:a.profession,qualification:adopted.qualification}:committed;
  }

  if(type==='RC4_OPEN_HOME_MARKET'||type==='RC4_CLOSE_HOME_MARKET'){
    const candidate=clone(s),a=agentById(candidate,data.agentId);
    if(!a||a.profession!=='merchant')return fail('merchant-profession');
    const r=type==='RC4_OPEN_HOME_MARKET'
      ?openHomeMarket(candidate,candidate.homeMarkets,{marketId:data.marketId,ownerAgentId:data.agentId})
      :closeHomeMarket(candidate,candidate.homeMarkets,{marketId:data.marketId,ownerAgentId:data.agentId});
    if(!r.ok)return r;candidate.homeMarkets=r.marketState;
    const committed=commitCandidate(s,candidate);return committed.ok?{ok:true,market:r.market,duplicate:r.duplicate}:committed;
  }

  if(type==='RC4_CREATE_LISTING'){
    const candidate=clone(s),market=ownedMarket(candidate,data.marketId,data.agentId),a=agentById(candidate,data.agentId);
    if(!market||!a)return fail('market-owner');
    if(market.status==='open'&&a.profession!=='merchant')return fail('merchant-profession');
    const made=createListingCandidate(candidate,{
      marketId:data.marketId,sellerId:data.agentId,itemInstanceId:data.itemInstanceId,unitPrice:data.unitPrice
    });
    if(!made.ok)return made;
    const committed=commitCandidate(s,candidate);return committed.ok?{ok:true,listing:made.listing}:committed;
  }

  if(type==='RC4_PROCURE_BUY_OFFER'){
    const candidate=clone(s),offer=offerRow(candidate,data.offerId),buyer=agentById(candidate,offer?.buyerId);
    if(!offer||!buyer||buyer.profession!=='merchant')return fail('buy-offer');
    const market=ownedMarket(candidate,offer.marketId,buyer.id);if(!market||market.status!=='open')return fail('market-closed');
    const match=proposeProducerBuyOfferMatch(offer,{producerId:data.producerId,itemInstanceIds:data.itemInstanceIds});
    if(match.state!=='SAT')return fail(match.reason??'producer-match');
    const req=match.proposal.listingRequest;
    const made=createListingInCollection(candidate.merchantListings,req);
    if(made.state!=='SAT')return fail(made.reason??'procurement-listing');
    candidate.merchantListings=made.collection;
    const attached=attachHomeMarketListingReference(candidate,candidate.homeMarkets,{
      marketId:offer.marketId,ownerAgentId:buyer.id,referenceId:made.listing.id
    });
    if(!attached.ok)return fail(attached.reason??'market-reference');
    candidate.homeMarkets=attached.marketState;

    const reservation=createReservation(candidate,candidate.merchantReservations,{
      listing:made.listing,listingRevision:made.listing.revision,buyerId:buyer.id,itemIds:[...match.proposal.itemIds],createdTick:candidate.tick
    });
    if(reservation.state!=='SAT')return fail(reservation.reason??'reservation');
    candidate.merchantReservations=reservation.reservationState;
    const proposal={
      transactionId:txid(candidate,buyer.id,made.listing.id),marketId:offer.marketId,sellerId:data.producerId,buyerId:buyer.id,
      itemKind:offer.itemKind,itemInstanceId:match.proposal.itemInstanceId,quantity:offer.quantityWanted,unitPrice:offer.unitPrice,
      totalPrice:offer.unitPrice*offer.quantityWanted,listingId:made.listing.id,reservationId:reservation.reservation.id
    };
    const settled=settleOnCandidate(candidate,{proposal,buyOfferId:offer.offerId});
    if(!settled.ok)return settled;
    const committed=commitCandidate(s,settled.state);
    return committed.ok?{ok:true,receipt:settled.receipt,itemIds:settled.receipt.itemIds,offerId:offer.offerId}:committed;
  }

  if(type==='RC4_PURCHASE_LISTING'){
    const marketProjection=projectMarket(s,data.marketId);if(!marketProjection)return fail('market');
    const arrival=verifyCanonicalMarketArrival(s,{agentId:data.buyerId,market:marketProjection.market});
    if(arrival.state!=='SAT')return fail('arrival',{detail:arrival});
    const candidate=clone(s),listing=listingRow(candidate,data.listingId);
    if(!listing||listing.marketId!==data.marketId||listing.status!=='OPEN')return fail('listing');
    const itemIds=rustTradeItemAdapter.tradableItemIds(candidate,{agentId:listing.sellerId,itemKind:listing.itemKind})
      .filter(id=>id===listing.itemInstanceId).slice(0,1);
    if(itemIds.length!==1)return fail('seller-item');
    const reservation=createReservation(candidate,candidate.merchantReservations,{
      listing,listingRevision:listing.revision,buyerId:data.buyerId,itemIds,createdTick:candidate.tick
    });
    if(reservation.state!=='SAT')return fail(reservation.reason??'reservation');
    candidate.merchantReservations=reservation.reservationState;
    const proposal={
      transactionId:txid(candidate,data.buyerId,listing.id),marketId:listing.marketId,sellerId:listing.sellerId,buyerId:data.buyerId,
      itemKind:listing.itemKind,itemInstanceId:itemIds[0],quantity:1,unitPrice:listing.unitPrice,totalPrice:listing.unitPrice,
      listingId:listing.id,reservationId:reservation.reservation.id
    };
    const settled=settleOnCandidate(candidate,{proposal});
    if(!settled.ok)return settled;
    const buyer=agentById(settled.state,data.buyerId);
    if(buyer?.task?.rc4MarketTravel)buyer.task=null,buyer.moveTick=0;
    const committed=commitCandidate(s,settled.state);
    return committed.ok?{ok:true,receipt:settled.receipt,itemIds:settled.receipt.itemIds}:committed;
  }

  return fail('rc4-command');
}

export function rc4MerchantReadModel(s){
  const markets=(s.homeMarkets?.markets??[]).map(m=>{
    const owner=s.agents?.find(a=>a.id===m.ownerAgentId);
    const listings=(s.merchantListings?.listings??[]).filter(l=>m.listingIds.includes(l.id));
    const buyOffers=(s.merchantBuyOffers?.buyOffers??[]).filter(o=>m.buyOfferIds.includes(o.offerId));
    const ledger=merchantLedgerFromCollection(s.merchantLedgers,m.ownerAgentId);
    const projection=projectMarket(s,m.marketId);
    return {
      marketId:m.marketId,homeId:m.homeId,ownerAgentId:m.ownerAgentId,ownerName:owner?.name??'UNKNOWN',
      profession:owner?.profession??null,status:m.status,trade:projection?.market??null,
      listingIds:[...m.listingIds],buyOfferIds:[...m.buyOfferIds],listings:clone(listings),buyOffers:clone(buyOffers),
      walletBalance:getBalance(s,m.ownerAgentId),ledger
    };
  });
  const producerItems=[];
  for(const a of s.agents??[])if(a.alive)for(const item of s.rustPossessions?.items??[])
    if(item.location?.kind==='bag'&&item.location.agentId===a.id&&rustTradeItemAdapter.tradableItemIds(s,{agentId:a.id,itemKind:item.kind}).includes(item.id))
      producerItems.push({agentId:a.id,agentName:a.name,itemInstanceId:item.id,itemKind:item.kind});
  return {version:RC4_MERCHANT_RUNTIME_VERSION,markets,producerItems};
}
