import {homeOf} from './individual-housing.mjs?v=0.5.0';
import {lifeStage} from './lifecycle.mjs?v=0.5.0';
import {pathTo} from './survival.mjs?v=0.5.0';
import {
  migrateHomeMarketState,validateHomeMarketState,createHomeMarket,openHomeMarket,closeHomeMarket,
  attachHomeMarketListingReference,attachHomeMarketBuyOfferReference,projectHomeMarketForTrade
} from './home-market.mjs?v=0.5.0';
import {
  migrateListingCollection,validateListingCollection,createListingInCollection,applyListingSettlementInCollection
} from './merchant-listing.mjs?v=0.5.0';
import {
  migrateBuyOfferCollection,validateBuyOfferCollection,createBuyOfferInCollection,proposeProducerBuyOfferMatch,
  applyBuyOfferSettlementInCollection
} from './merchant-buy-offer.mjs?v=0.5.0';
import {
  migrateReservationState,validateReservationState,createReservation,reservationById,globalActiveReservations,commitReservation
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
import {createCanonicalMarketTravelTask,verifyCanonicalMarketArrival,isCanonicalMarketTravelTask} from './navigation-arrival-evidence.mjs?v=0.5.0';

export const RC4_ECONOMY_ROOT_VERSION='RC4-economy-root/1';

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
  if(world.rc4EconomyVersion!==undefined&&world.rc4EconomyVersion!==RC4_ECONOMY_ROOT_VERSION)return {state:'VIOL',reason:'rc4-root-version'};
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
  const knownPeople=new Set([...(world?.agents??[]),...(world?.archive??[])].map(a=>a.id));
  if((world?.merchantLedgers?.ledgers??[]).some(l=>!knownPeople.has(l.merchantId)))e.push('Ledger:agent');
  for(const a of [...(world?.agents??[]),...(world?.archive??[])])for(const x of validateMerchantProgression(a))e.push('MerchantCareer:'+a.id+':'+x);
  return e;
}

export function ensureRc4AccountForAgent(world,agentId){
  if(validateCurrencyWallet(world).length)return {ok:false,reason:'wallet'};
  if(world.currencyWallet.accounts.some(x=>x.agentId===agentId))return {ok:true,duplicate:true,balance:getBalance(world,agentId)};
  return createCurrencyAccount(world,{agentId});
}

function merchantQualificationSnapshot(world,agent){
  const home=homeOf(world,agent.id,{completeOnly:true});
  const balance=getBalance(world,agent.id);
  const market=ownMarket(world,agent.id);
  const intentCount=(market?.listingIds?.length??0)+(market?.buyOfferIds?.length??0);
  const evidenceId='MERCHANT:'+agent.id+':'+(market?.marketId??'NOMARKET')+':'+intentCount;
  return {
    agentId:agent.id,
    alive:agent.alive===true,
    lifeStage:lifeStage(world,agent),
    professionTransitionAllowed:agent.profession!=='adventurer',
    homeControl:home?{status:'CONFIRMED',houseId:home.houseId,evidenceId:'HOME:'+home.houseId}:{status:'ABSENT'},
    operatingCapital:Number.isSafeInteger(balance)?{status:'CONFIRMED',amount:balance}:{status:'UNKNOWN'},
    tradeKnowledge:intentCount>0?{status:'CONFIRMED',evidenceCount:intentCount}:{status:'UNKNOWN',evidenceCount:0},
    evidenceId
  };
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
  const rows=(staged.merchantBuyOffers?.buyOffers??[]).filter(o=>o.status==='OPEN'&&o.marketId===receipt.marketId&&
    o.buyerId===receipt.buyerId&&o.itemKind===receipt.itemKind&&o.quantityWanted===receipt.quantity&&o.unitPrice===receipt.unitPrice);
  return rows.length===1?rows[0]:null;
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
  for(const key of Object.keys(live))delete live[key];
  Object.assign(live,next);
}

function createListingId(marketId,sellerId,itemId){
  return deterministicId('L:',{marketId,sellerId,itemId});
}

function txId(world,{listingId,buyerId,reservationId}){
  return deterministicId('TX:',{tick:world.tick,listingId,buyerId,reservationId});
}

export function prepareRc4MarketTravel(world,{agentId,marketId}={}){
  const marketResult=projectHomeMarketForTrade(world,world.homeMarkets,{marketId});
  if(!marketResult.ok||marketResult.market.open!==true)return fail('market-closed','ตลาดยังไม่เปิด');
  const agent=world.agents.find(a=>a.id===agentId&&a.alive);
  if(!agent)return fail('agent','ไม่พบ Clone');
  if(agent.task)return fail('busy','Clone กำลังทำงานอื่น');
  const path=pathTo(world,agent,marketResult.market);
  if(path===null)return fail('no-path','ไม่มีเส้นทางไปตลาด');
  const built=createCanonicalMarketTravelTask(world,agent,marketResult.market,path);
  if(built.state!=='SAT')return fail(built.reason,'สร้างเส้นทางตลาดไม่ได้');
  return {ok:true,agent,task:clone(built.task),market:marketResult.market};
}

function buyListing(world,{buyerId,listingId}={}){
  const listing=listingById(world,listingId);
  if(!listing||listing.status!=='OPEN')return fail('listing','Listing ไม่พร้อม');
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

export function rc4Command(world,type,data={}){
  if(typeof type!=='string'||!type.startsWith('RC4_'))return null;
  const stateErrors=validateRc4EconomyState(world);
  if(stateErrors.length)return fail('rc4-state','RC4 state ไม่พร้อม',{errors:stateErrors});

  if(type==='RC4_BECOME_MERCHANT'){
    const candidate=clone(world),agent=candidate.agents.find(a=>a.id===data.agentId&&a.alive);if(!agent)return fail('agent','ไม่พบ Clone');
    const qualification=merchantQualificationSnapshot(candidate,agent);
    const evaluated=evaluateMerchantQualification(qualification);
    if(evaluated.status!=='SAT')return fail('qualification','ยังไม่ผ่านคุณสมบัติ Merchant',{qualification:evaluated});
    const changed=adoptMerchantProfession(agent,qualification,candidate.tick);
    if(changed.status!=='SAT')return fail(changed.reason??'profession','เปลี่ยนอาชีพไม่ได้',{qualification:evaluated});
    const ledger=ensureLedger(candidate,agent.id);if(!ledger.ok)return fail(ledger.reason,'สร้าง Merchant Ledger ไม่ได้');
    const errors=validateRc4EconomyState(candidate);if(errors.length)return fail('rc4-postcondition','Merchant state ไม่ผ่าน postcondition',{errors});
    replaceWorldRoot(world,candidate);
    return {ok:true,agentId:agent.id,profession:'merchant',eventType:'career',eventText:agent.name+' เป็น Merchant แล้ว'};
  }

  if(type==='RC4_CREATE_MARKET'){
    const agent=world.agents.find(a=>a.id===data.agentId&&a.alive);if(!agent)return fail('agent','ไม่พบ Clone');
    if(agent.profession==='adventurer')return fail('profession-locked','Adventurer เปิดสาย Merchant ไม่ได้');
    const home=homeOf(world,agent.id,{completeOnly:true});if(!home)return fail('home','ต้องมีบ้านส่วนตัวที่สร้างเสร็จ');
    const made=createHomeMarket(world,world.homeMarkets,{ownerAgentId:agent.id,homeId:home.houseId});
    if(!made.ok)return fail(made.reason,made.message);
    world.homeMarkets=made.marketState;
    return {ok:true,marketId:made.market.marketId,eventType:'market',eventText:agent.name+' เตรียม Home Market'};
  }

  if(type==='RC4_OPEN_MARKET'||type==='RC4_CLOSE_MARKET'){
    const market=world.homeMarkets.markets.find(m=>m.marketId===data.marketId);if(!market)return fail('market','ไม่พบตลาด');
    const owner=world.agents.find(a=>a.id===market.ownerAgentId&&a.alive);
    if(!owner)return fail('owner','เจ้าของตลาดไม่พร้อม');
    if(type==='RC4_OPEN_MARKET'&&owner.profession!=='merchant')return fail('merchant','ต้องเป็น Merchant ก่อนเปิดร้าน');
    const changed=(type==='RC4_OPEN_MARKET'?openHomeMarket:closeHomeMarket)(world,world.homeMarkets,{marketId:data.marketId,ownerAgentId:market.ownerAgentId});
    if(!changed.ok)return fail(changed.reason,changed.message);
    world.homeMarkets=changed.marketState;
    return {ok:true,marketId:data.marketId,status:changed.market.status,eventType:'market',eventText:'ตลาด '+changed.market.status};
  }

  if(type==='RC4_CREATE_LISTING'){
    const agent=world.agents.find(a=>a.id===data.agentId&&a.alive&&a.profession==='merchant');if(!agent)return fail('merchant','ต้องเป็น Merchant');
    const market=ownMarket(world,agent.id);if(!market)return fail('market','Merchant ยังไม่มี Home Market');
    if(!validMoney(data.unitPrice))return fail('price','ราคาต้องเป็นจำนวนเต็มบวก');
    const item=world.rustPossessions?.items?.find(i=>i.id===data.itemId);
    if(!item||!tradableRustItemIds(world,{agentId:agent.id,itemKind:item.kind}).includes(item.id))return fail('item','item นี้ลงขายไม่ได้');
    const id=createListingId(market.marketId,agent.id,item.id);
    const made=createListingInCollection(world.merchantListings,{id,marketId:market.marketId,sellerId:agent.id,itemKind:item.kind,itemInstanceId:item.id,quantity:1,unitPrice:data.unitPrice,status:'OPEN'});
    if(made.state!=='SAT')return fail(made.reason,'สร้าง Listing ไม่ได้');
    const ref=attachHomeMarketListingReference(world,world.homeMarkets,{marketId:market.marketId,ownerAgentId:agent.id,referenceId:id});
    if(!ref.ok)return fail(ref.reason,'ผูก Listing เข้าตลาดไม่ได้');
    world.merchantListings=made.collection;world.homeMarkets=ref.marketState;
    return {ok:true,listingId:id,marketId:market.marketId,message:'ลงขาย '+item.kind+' แล้ว'};
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
    return {ok:true,offerId:made.offer.offerId,marketId:market.marketId,message:'สร้าง Buy Offer แล้ว'};
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
  const markets=(world.homeMarkets?.markets??[]).map(m=>{
    const projection=projectHomeMarketForTrade(world,world.homeMarkets,{marketId:m.marketId});
    const listings=(world.merchantListings?.listings??[]).filter(l=>l.marketId===m.marketId).map(l=>({...clone(l)}));
    const offers=(world.merchantBuyOffers?.buyOffers??[]).filter(o=>o.marketId===m.marketId).map(o=>({...clone(o)}));
    const owner=world.agents.find(a=>a.id===m.ownerAgentId);
    return {
      marketId:m.marketId,homeId:m.homeId,ownerAgentId:m.ownerAgentId,ownerName:owner?.name??'UNKNOWN',
      status:m.status,listingIds:[...m.listingIds],buyOfferIds:[...m.buyOfferIds],
      trade:projection.ok?clone(projection.market):null,listings,offers,
      ledger:owner?merchantLedgerFromCollection(world.merchantLedgers,owner.id):null
    };
  });
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
