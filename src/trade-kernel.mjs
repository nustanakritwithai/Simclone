import {TRADE_ASSET_TYPES,tradeAssetType,validBulkTradeResourceKey} from './trade-assets.mjs?v=0.5.0';

export const TRADE_KERNEL_VERSION='RC4-trade-kernel-1';
export const TRADE_REPLAY_VERSION='RC4-trade-replay-1';
const canonicalExecutionContexts=new WeakMap();
export const isCanonicalTradeExecutionContext=(context,state=null)=>{const active=context&&typeof context==='object'&&canonicalExecutionContexts.get(context);return !!active&&(state===null||active===state);};
export const TRADE_LIMITS=Object.freeze({maxReceipts:512,maxQuantity:128,maxIdLength:80});

const idPattern=/^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const safePositiveInt=n=>Number.isSafeInteger(n)&&n>0;
const validId=(v,max=TRADE_LIMITS.maxIdLength)=>typeof v==='string'&&v.length>0&&v.length<=max&&idPattern.test(v);
const clone=v=>structuredClone(v);
const stableItemIds=ids=>Array.isArray(ids)?ids.slice().sort((a,b)=>a-b):[];

export const createTradeReplayState=()=>({version:TRADE_REPLAY_VERSION,receipts:[]});
export function migrateTradeReplayState(raw){
  if(raw===undefined||raw===null)return {state:'SAT',migrated:true,duplicate:false,tradeReplay:createTradeReplayState()};
  const probe={tradeReplay:structuredClone(raw)};
  const errors=validateTradeReplayState(probe);
  if(errors.length)return {state:'VIOL',reason:'trade-replay',errors,tradeReplay:null};
  return {state:'SAT',migrated:false,duplicate:true,tradeReplay:structuredClone(raw)};
}

function normalizedProposal(p={}){
  return {
    transactionId:p.transactionId,marketId:p.marketId,sellerId:p.sellerId,buyerId:p.buyerId,
    itemKind:p.itemKind,itemInstanceId:p.itemInstanceId,quantity:p.quantity,unitPrice:p.unitPrice,
    totalPrice:p.totalPrice,listingId:p.listingId,reservationId:p.reservationId
  };
}

export function tradeProposalFingerprint(p={}){
  if(tradeAssetType(p)===TRADE_ASSET_TYPES.BULK_RESOURCE){
    return [TRADE_ASSET_TYPES.BULK_RESOURCE,p.transactionId,p.marketId,p.sellerId,p.buyerId,p.itemKind,p.quantity,p.unitPrice,p.totalPrice,p.listingId,p.reservationId]
      .map(v=>String(v)).join('|');
  }
  const x=normalizedProposal(p);
  return [x.transactionId,x.marketId,x.sellerId,x.buyerId,x.itemKind,x.itemInstanceId,x.quantity,x.unitPrice,x.totalPrice,x.listingId,x.reservationId]
    .map(v=>String(v)).join('|');
}

export function tradeReceiptFingerprint(r={}){
  return tradeProposalFingerprint(r);
}
export function tradeReceiptIntegrityFingerprint(r={}){
  return tradeAssetType(r)===TRADE_ASSET_TYPES.BULK_RESOURCE
    ?tradeReceiptFingerprint(r)+'|BULK|'+r.itemKind+'|'+r.quantity
    :tradeReceiptFingerprint(r)+'|ITEMS|'+stableItemIds(r.itemIds).join(',');
}

export function validateTradeReceiptShape(r){
  const e=[];
  if(!r||typeof r!=='object'||Array.isArray(r))return ['Trade replay receipt'];
  const type=tradeAssetType(r);
  if(type===null)e.push('asset-type');
  if(!validId(r.transactionId)||typeof r.fingerprint!=='string'||!r.fingerprint||
    typeof r.integrityFingerprint!=='string'||!r.integrityFingerprint||
    r.eventId!=='TRADE:'+r.transactionId||!validId(r.eventId,TRADE_LIMITS.maxIdLength+6)||
    !validId(r.marketId)||!validId(r.listingId)||!validId(r.reservationId)||!validId(r.itemKind)||
    !Number.isSafeInteger(r.buyerId)||!Number.isSafeInteger(r.sellerId)||r.buyerId===r.sellerId||
    !safePositiveInt(r.quantity)||!safePositiveInt(r.unitPrice)||!safePositiveInt(r.totalPrice)||
    r.totalPrice!==r.unitPrice*r.quantity)e.push('shape');
  if(type===TRADE_ASSET_TYPES.PHYSICAL_ITEM){
    if(!safePositiveInt(r.itemInstanceId)||!Array.isArray(r.itemIds)||r.itemIds.length!==r.quantity||
      new Set(r.itemIds).size!==r.itemIds.length||r.itemIds.some(id=>!safePositiveInt(id))||
      r.itemIds.join(',')!==stableItemIds(r.itemIds).join(',')||!r.itemIds.includes(r.itemInstanceId))e.push('item-shape');
  }else if(type===TRADE_ASSET_TYPES.BULK_RESOURCE){
    if(!validBulkTradeResourceKey(r.itemKind)||r.itemInstanceId!==null||!Array.isArray(r.itemIds)||r.itemIds.length!==0)e.push('bulk-shape');
  }
  if(r.fingerprint!==tradeReceiptFingerprint(r)||r.integrityFingerprint!==tradeReceiptIntegrityFingerprint(r))e.push('fingerprint');
  return [...new Set(e)];
}

export function validateTradeReplayState(state){
  const replay=state?.tradeReplay;
  if(!replay||replay.version!==TRADE_REPLAY_VERSION||!Array.isArray(replay.receipts)||replay.receipts.length>TRADE_LIMITS.maxReceipts)
    return ['Trade replay state'];
  const seen=new Set();
  for(const r of replay.receipts){
    if(validateTradeReceiptShape(r).length||seen.has(r?.transactionId))return ['Trade replay receipt'];
    seen.add(r.transactionId);
  }
  return [];
}

function adapterShape(wallet,item,market){
  if(!wallet||typeof wallet.balance!=='function'||typeof wallet.debit!=='function'||typeof wallet.credit!=='function')return 'wallet-authority';
  if(!item||typeof item.tradableItemIds!=='function'||typeof item.transfer!=='function')return 'item-authority';
  if(!market||typeof market.market!=='function'||typeof market.listing!=='function'||typeof market.reservation!=='function'||typeof market.activeReservations!=='function')return 'market-authority';
  return null;
}

function findReceipt(state,transactionId){
  return state?.tradeReplay?.receipts?.find(r=>r.transactionId===transactionId)??null;
}

function aliveAgent(state,id){return state?.agents?.find(a=>a?.id===id&&a.alive===true)??null;}
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

function resolveValidation(state,proposal,{wallet,item,market}={}){
  const p=normalizedProposal(proposal),errors=[];
  const fail=reason=>({ok:false,reason,errors:[...errors,reason]});
  const authority=adapterShape(wallet,item,market);if(authority)return fail(authority);
  if(validateTradeReplayState(state).length)return fail('replay-state');
  if(!validId(p.transactionId))return fail('transaction-id');
  const previous=findReceipt(state,p.transactionId);
  if(previous)return fail(previous.fingerprint===tradeProposalFingerprint(p)?'transaction-committed':'transaction-conflict');
  if(!Number.isSafeInteger(p.buyerId)||p.buyerId<1||!Number.isSafeInteger(p.sellerId)||p.sellerId<1)return fail('party');
  if(p.buyerId===p.sellerId)return fail('same-party');
  const buyer=aliveAgent(state,p.buyerId);if(!buyer)return fail('buyer-dead');
  const seller=aliveAgent(state,p.sellerId);if(!seller)return fail('seller-dead');
  if(!validId(p.itemKind))return fail('item-kind');
  if(!safePositiveInt(p.itemInstanceId))return fail('item-instance');
  if(!safePositiveInt(p.quantity)||p.quantity>TRADE_LIMITS.maxQuantity)return fail('quantity');
  if(!safePositiveInt(p.unitPrice))return fail('unit-price');
  if(!safePositiveInt(p.totalPrice)||!Number.isSafeInteger(p.unitPrice*p.quantity)||p.totalPrice!==p.unitPrice*p.quantity)return fail('total-price');
  if(!validId(p.marketId)||!validId(p.listingId)||!validId(p.reservationId))return fail('reference-id');

  const m=market.market(state,p.marketId);if(!m||m.id!==p.marketId)return fail('market-invalid');
  if(m.open!==true)return fail('market-closed');
  if(!Number.isInteger(m.x)||!Number.isInteger(m.y)||!safePositiveInt(m.tradeRange))return fail('market-invalid');
  if(!Number.isInteger(buyer.x)||!Number.isInteger(buyer.y)||distance(buyer,m)>m.tradeRange)return fail('trade-range');

  const l=market.listing(state,p.listingId);if(!l||l.id!==p.listingId||l.marketId!==p.marketId||tradeAssetType(l)!==TRADE_ASSET_TYPES.PHYSICAL_ITEM)return fail('listing-invalid');
  if(l.status==='CANCELED')return fail('listing-canceled');
  if(l.status!=='OPEN')return fail('listing-invalid');
  if(!Number.isSafeInteger(l.revision)||l.revision<1||l.sellerId!==p.sellerId||l.itemKind!==p.itemKind||
    !safePositiveInt(l.unitPrice)||l.unitPrice!==p.unitPrice||!safePositiveInt(l.quantity)||l.quantity<p.quantity)return fail('listing-invalid');

  const r=market.reservation(state,p.reservationId);if(!r||r.id!==p.reservationId||r.status!=='ACTIVE'||tradeAssetType(r)!==TRADE_ASSET_TYPES.PHYSICAL_ITEM||r.marketId!==p.marketId||
    r.listingId!==p.listingId||r.sellerId!==p.sellerId||r.buyerId!==p.buyerId||r.itemKind!==p.itemKind||
    r.unitPrice!==p.unitPrice||r.quantity!==p.quantity||!Array.isArray(r.itemIds)||r.itemIds.length!==p.quantity||
    new Set(r.itemIds).size!==r.itemIds.length||r.itemIds.some(id=>!safePositiveInt(id))||!r.itemIds.includes(p.itemInstanceId))return fail('reservation-invalid');
  if(r.listingRevision!==l.revision)return fail('listing-stale');
  const itemIds=stableItemIds(r.itemIds);

  // Global reservation view is required: item instances may not be reserved
  // by another market, not merely another listing in this market.
  const active=market.activeReservations(state);
  if(!Array.isArray(active))return fail('market-view-incomplete');
  const activeRows=active.filter(x=>x?.status==='ACTIVE'),activeIds=activeRows.map(x=>x?.id);
  const malformed=activeRows.some(x=>{
    const type=tradeAssetType(x);
    if(!validId(x.id)||!validId(x.marketId)||!validId(x.listingId)||!validId(x.itemKind)||
      !Number.isSafeInteger(x.sellerId)||x.sellerId<1||!Number.isSafeInteger(x.buyerId)||x.buyerId<1||
      !Number.isSafeInteger(x.listingRevision)||x.listingRevision<1||!safePositiveInt(x.unitPrice)||!safePositiveInt(x.quantity))return true;
    if(type===TRADE_ASSET_TYPES.PHYSICAL_ITEM)return !Array.isArray(x.itemIds)||x.itemIds.length!==x.quantity||
      new Set(x.itemIds).size!==x.itemIds.length||x.itemIds.some(id=>!safePositiveInt(id));
    if(type===TRADE_ASSET_TYPES.BULK_RESOURCE)return !validBulkTradeResourceKey(x.itemKind)||!Array.isArray(x.itemIds)||x.itemIds.length!==0;
    return true;
  });
  const currentRows=activeRows.filter(x=>x.id===p.reservationId),current=currentRows[0];
  const currentMismatch=currentRows.length!==1||!current||
    current.marketId!==r.marketId||current.listingId!==r.listingId||current.listingRevision!==r.listingRevision||
    current.sellerId!==r.sellerId||current.buyerId!==r.buyerId||current.itemKind!==r.itemKind||
    current.unitPrice!==r.unitPrice||current.quantity!==r.quantity||
    stableItemIds(current.itemIds).join(',')!==itemIds.join(',');
  if(malformed||new Set(activeIds).size!==activeIds.length||currentMismatch)return fail('market-view-incomplete');
  const reservedByOther=new Set(activeRows.filter(x=>x.id!==p.reservationId).flatMap(x=>x.itemIds));
  if(itemIds.some(id=>reservedByOther.has(id)))return fail('item-reserved');

  const tradable=item.tradableItemIds(state,{agentId:p.sellerId,itemKind:p.itemKind});
  if(!Array.isArray(tradable))return fail('item-authority');
  const owned=new Set(tradable);
  if(itemIds.some(id=>!owned.has(id)))return fail('seller-item');

  const buyerBalance=wallet.balance(state,p.buyerId),sellerBalance=wallet.balance(state,p.sellerId);
  if(!Number.isSafeInteger(buyerBalance)||buyerBalance<0||!Number.isSafeInteger(sellerBalance)||sellerBalance<0)return fail('wallet-invalid');
  if(buyerBalance<p.totalPrice)return fail('insufficient-funds');
  if(!Number.isSafeInteger(sellerBalance+p.totalPrice))return fail('wallet-overflow');
  return {ok:true,proposal:p,market:m,listing:l,reservation:r,itemIds,buyerBalance,sellerBalance};
}

export function validateTradeProposal(state,proposal,adapters={}){
  const r=resolveValidation(state,proposal,adapters);
  if(r.ok)return {ok:true,itemIds:r.itemIds.slice(),fingerprint:tradeProposalFingerprint(r.proposal)};
  return {ok:false,reason:r.reason};
}

export function buildTradeSettlementProposal(state,proposal,adapters={}){
  const r=resolveValidation(state,proposal,adapters);if(!r.ok)return {ok:false,reason:r.reason};
  const p=r.proposal;
  return {ok:true,settlement:Object.freeze({
    version:TRADE_KERNEL_VERSION,transactionId:p.transactionId,fingerprint:tradeProposalFingerprint(p),
    wallet:Object.freeze({debit:Object.freeze({agentId:p.buyerId,amount:p.totalPrice}),credit:Object.freeze({agentId:p.sellerId,amount:p.totalPrice})}),
    items:Object.freeze({fromAgentId:p.sellerId,toAgentId:p.buyerId,itemKind:p.itemKind,itemIds:Object.freeze(r.itemIds.slice())}),
    receipt:Object.freeze({transactionId:p.transactionId,fingerprint:tradeProposalFingerprint(p),
      integrityFingerprint:tradeProposalFingerprint(p)+'|ITEMS|'+r.itemIds.join(','),eventId:'TRADE:'+p.transactionId,
      marketId:p.marketId,listingId:p.listingId,reservationId:p.reservationId,buyerId:p.buyerId,sellerId:p.sellerId,
      itemKind:p.itemKind,itemInstanceId:p.itemInstanceId,itemIds:Object.freeze(r.itemIds.slice()),
      quantity:p.quantity,unitPrice:p.unitPrice,totalPrice:p.totalPrice})
  })};
}

function adapterResultOk(r){return r===true||r?.ok===true;}
function appendReceipt(state,receipt){
  if(state.tradeReplay.receipts.length>=TRADE_LIMITS.maxReceipts)return {ok:false,reason:'replay-capacity'};
  if(state.tradeReplay.receipts.some(r=>r.transactionId===receipt.transactionId))return {ok:false,reason:'transaction-committed'};
  state.tradeReplay.receipts.push(clone(receipt));return {ok:true};
}

/**
 * Pure atomic candidate. The input state is never mutated. A successful call returns
 * `state: nextState`; callers may replace their authoritative root in one integration step.
 * Adapters MUST be deterministic, state-local authorities: no external side effects.
 */
export function settleTradeAtomic(state,proposal,adapters={}){
  const txid=proposal?.transactionId;
  if(validId(txid)&&state?.tradeReplay?.receipts){
    if(validateTradeReplayState(state).length)return {ok:false,reason:'replay-state'};
    const prior=findReceipt(state,txid);
    if(prior){
      const fp=tradeProposalFingerprint(proposal);
      return prior.fingerprint===fp
        ?{ok:true,duplicate:true,receipt:clone(prior),state}
        :{ok:false,reason:'transaction-conflict'};
    }
  }
  const built=buildTradeSettlementProposal(state,proposal,adapters);if(!built.ok)return built;
  const {settlement}=built;
  const staged=clone(state);
  let context=null;
  try{
    const beforeBuyer=adapters.wallet.balance(staged,settlement.wallet.debit.agentId);
    const beforeSeller=adapters.wallet.balance(staged,settlement.wallet.credit.agentId);
    if(!adapterResultOk(adapters.wallet.debit(staged,settlement.wallet.debit.agentId,settlement.wallet.debit.amount)))return {ok:false,reason:'wallet-debit'};
    if(!adapterResultOk(adapters.wallet.credit(staged,settlement.wallet.credit.agentId,settlement.wallet.credit.amount)))return {ok:false,reason:'wallet-credit'};
    if(!adapterResultOk(adapters.item.transfer(staged,{fromAgentId:settlement.items.fromAgentId,toAgentId:settlement.items.toAgentId,itemIds:settlement.items.itemIds.slice()})))return {ok:false,reason:'item-transfer'};
    const receiptResult=appendReceipt(staged,settlement.receipt);if(!receiptResult.ok)return receiptResult;

    // B6 outer atomic boundary: every authoritative post-settlement mutation
    // (Ledger / Listing / Reservation as selected by integration) must happen
    // on this same staged root before any caller can replace the live root.
    const post=adapters.postSettlement;
    if(!post||typeof post.apply!=='function'||typeof post.verify!=='function')
      return {ok:false,reason:'post-settlement-authority'};
    context=Object.freeze({
      provenance:'CANONICAL_TRADE_SETTLEMENT_EXECUTION',
      proposal:Object.freeze(clone(normalizedProposal(proposal))),
      receipt:Object.freeze({...clone(settlement.receipt),itemIds:Object.freeze([...settlement.receipt.itemIds])})
    });
    canonicalExecutionContexts.set(context,staged);
    const applied=post.apply(staged,context);
    if(!adapterResultOk(applied))return {ok:false,reason:applied?.reason||'post-settlement-apply'};
    const verified=post.verify(staged,context);
    if(!adapterResultOk(verified))return {ok:false,reason:verified?.reason||'post-settlement-postcondition'};

    const afterBuyer=adapters.wallet.balance(staged,settlement.wallet.debit.agentId);
    const afterSeller=adapters.wallet.balance(staged,settlement.wallet.credit.agentId);
    if(afterBuyer!==beforeBuyer-settlement.wallet.debit.amount||afterSeller!==beforeSeller+settlement.wallet.credit.amount)return {ok:false,reason:'wallet-postcondition'};
    const buyerItems=new Set(adapters.item.tradableItemIds(staged,{agentId:settlement.items.toAgentId,itemKind:settlement.items.itemKind}));
    if(settlement.items.itemIds.some(id=>!buyerItems.has(id)))return {ok:false,reason:'item-postcondition'};
    if(staged.tradeReplay.receipts.filter(r=>r.transactionId===settlement.transactionId).length!==1)return {ok:false,reason:'replay-postcondition'};
    return {ok:true,duplicate:false,receipt:clone(settlement.receipt),state:staged};
  }catch{
    return {ok:false,reason:'settlement-exception'};
  }finally{
    // Contexts cannot escape a successful or failed settlement and be replayed elsewhere.
    if(context)canonicalExecutionContexts.delete(context);
  }
}


function bulkAdapterShape(wallet,resource,market){
  if(!wallet||typeof wallet.balance!=='function'||typeof wallet.debit!=='function'||typeof wallet.credit!=='function')return 'wallet-authority';
  if(!resource||typeof resource.tradableQuantity!=='function'||typeof resource.transfer!=='function')return 'resource-authority';
  if(!market||typeof market.market!=='function'||typeof market.listing!=='function'||typeof market.reservation!=='function'||typeof market.activeReservations!=='function')return 'market-authority';
  return null;
}
function normalizedBulkProposal(p={}){
  return {
    assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,transactionId:p.transactionId,marketId:p.marketId,
    sellerId:p.sellerId,buyerId:p.buyerId,itemKind:p.itemKind,quantity:p.quantity,
    unitPrice:p.unitPrice,totalPrice:p.totalPrice,listingId:p.listingId,reservationId:p.reservationId
  };
}
function resolveBulkValidation(state,proposal,{wallet,resource,market}={}){
  const p=normalizedBulkProposal(proposal),fail=reason=>({ok:false,reason});
  if(tradeAssetType(proposal)!==TRADE_ASSET_TYPES.BULK_RESOURCE)return fail('asset-type');
  const authority=bulkAdapterShape(wallet,resource,market);if(authority)return fail(authority);
  if(validateTradeReplayState(state).length)return fail('replay-state');
  if(!validId(p.transactionId))return fail('transaction-id');
  const previous=findReceipt(state,p.transactionId);
  if(previous)return fail(previous.fingerprint===tradeProposalFingerprint(p)?'transaction-committed':'transaction-conflict');
  if(!Number.isSafeInteger(p.buyerId)||p.buyerId<1||!Number.isSafeInteger(p.sellerId)||p.sellerId<1)return fail('party');
  if(p.buyerId===p.sellerId)return fail('same-party');
  const buyer=aliveAgent(state,p.buyerId);if(!buyer)return fail('buyer-dead');
  const seller=aliveAgent(state,p.sellerId);if(!seller)return fail('seller-dead');
  if(!validBulkTradeResourceKey(p.itemKind))return fail('resource-kind');
  if(!safePositiveInt(p.quantity)||p.quantity>TRADE_LIMITS.maxQuantity)return fail('quantity');
  if(!safePositiveInt(p.unitPrice))return fail('unit-price');
  if(!safePositiveInt(p.totalPrice)||!Number.isSafeInteger(p.unitPrice*p.quantity)||p.totalPrice!==p.unitPrice*p.quantity)return fail('total-price');
  if(!validId(p.marketId)||!validId(p.listingId)||!validId(p.reservationId))return fail('reference-id');

  const m=market.market(state,p.marketId);if(!m||m.id!==p.marketId)return fail('market-invalid');
  if(m.open!==true)return fail('market-closed');
  if(!Number.isInteger(m.x)||!Number.isInteger(m.y)||!safePositiveInt(m.tradeRange))return fail('market-invalid');
  if(!Number.isInteger(buyer.x)||!Number.isInteger(buyer.y)||distance(buyer,m)>m.tradeRange)return fail('trade-range');

  const l=market.listing(state,p.listingId);
  if(!l||l.id!==p.listingId||l.marketId!==p.marketId||tradeAssetType(l)!==TRADE_ASSET_TYPES.BULK_RESOURCE)return fail('listing-invalid');
  if(l.status==='CANCELED')return fail('listing-canceled');
  if(l.status!=='OPEN')return fail('listing-invalid');
  if(!Number.isSafeInteger(l.revision)||l.revision<1||l.sellerId!==p.sellerId||l.itemKind!==p.itemKind||
    l.unitPrice!==p.unitPrice||!safePositiveInt(l.quantity)||l.quantity<p.quantity)return fail('listing-invalid');

  const r=market.reservation(state,p.reservationId);
  if(!r||r.id!==p.reservationId||r.status!=='ACTIVE'||tradeAssetType(r)!==TRADE_ASSET_TYPES.BULK_RESOURCE||
    r.marketId!==p.marketId||r.listingId!==p.listingId||r.sellerId!==p.sellerId||r.buyerId!==p.buyerId||
    r.itemKind!==p.itemKind||r.unitPrice!==p.unitPrice||r.quantity!==p.quantity||
    !Array.isArray(r.itemIds)||r.itemIds.length!==0)return fail('reservation-invalid');
  if(r.listingRevision!==l.revision)return fail('listing-stale');

  const active=market.activeReservations(state);
  if(!Array.isArray(active))return fail('market-view-incomplete');
  const activeRows=active.filter(x=>x?.status==='ACTIVE'),activeIds=activeRows.map(x=>x?.id);
  if(new Set(activeIds).size!==activeIds.length)return fail('market-view-incomplete');
  const currentRows=activeRows.filter(x=>x.id===p.reservationId);
  if(currentRows.length!==1)return fail('market-view-incomplete');
  for(const x of activeRows){
    const t=tradeAssetType(x);
    if(!validId(x.id)||!validId(x.marketId)||!validId(x.listingId)||!validId(x.itemKind)||
      !Number.isSafeInteger(x.sellerId)||x.sellerId<1||!Number.isSafeInteger(x.buyerId)||x.buyerId<1||
      !Number.isSafeInteger(x.listingRevision)||x.listingRevision<1||!safePositiveInt(x.unitPrice)||!safePositiveInt(x.quantity)||
      (t===TRADE_ASSET_TYPES.PHYSICAL_ITEM&&(!Array.isArray(x.itemIds)||x.itemIds.length!==x.quantity||x.itemIds.some(id=>!safePositiveInt(id))))||
      (t===TRADE_ASSET_TYPES.BULK_RESOURCE&&(!validBulkTradeResourceKey(x.itemKind)||!Array.isArray(x.itemIds)||x.itemIds.length!==0))||
      t===null)return fail('market-view-incomplete');
  }
  const otherReserved=activeRows.filter(x=>x.id!==p.reservationId&&tradeAssetType(x)===TRADE_ASSET_TYPES.BULK_RESOURCE&&
    x.sellerId===p.sellerId&&x.itemKind===p.itemKind).reduce((sum,x)=>sum+x.quantity,0);
  const sellerQuantity=resource.tradableQuantity(state,{agentId:p.sellerId,itemKind:p.itemKind});
  const buyerQuantity=resource.tradableQuantity(state,{agentId:p.buyerId,itemKind:p.itemKind});
  if(!Number.isSafeInteger(sellerQuantity)||sellerQuantity<p.quantity+otherReserved)return fail('seller-resource');
  if(!Number.isSafeInteger(buyerQuantity)||buyerQuantity<0)return fail('buyer-resource');

  const buyerBalance=wallet.balance(state,p.buyerId),sellerBalance=wallet.balance(state,p.sellerId);
  if(!Number.isSafeInteger(buyerBalance)||buyerBalance<0||!Number.isSafeInteger(sellerBalance)||sellerBalance<0)return fail('wallet-invalid');
  if(buyerBalance<p.totalPrice)return fail('insufficient-funds');
  if(!Number.isSafeInteger(sellerBalance+p.totalPrice))return fail('wallet-overflow');
  return {ok:true,proposal:p,market:m,listing:l,reservation:r,sellerQuantity,buyerQuantity,buyerBalance,sellerBalance};
}

export function validateBulkTradeProposal(state,proposal,adapters={}){
  const r=resolveBulkValidation(state,proposal,adapters);
  return r.ok?{ok:true,quantity:r.proposal.quantity,fingerprint:tradeProposalFingerprint(r.proposal)}:{ok:false,reason:r.reason};
}

export function buildBulkTradeSettlementProposal(state,proposal,adapters={}){
  const r=resolveBulkValidation(state,proposal,adapters);if(!r.ok)return {ok:false,reason:r.reason};
  const p=r.proposal,fp=tradeProposalFingerprint(p);
  const receipt=Object.freeze({
    assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,transactionId:p.transactionId,fingerprint:fp,
    integrityFingerprint:fp+'|BULK|'+p.itemKind+'|'+p.quantity,eventId:'TRADE:'+p.transactionId,
    marketId:p.marketId,listingId:p.listingId,reservationId:p.reservationId,buyerId:p.buyerId,sellerId:p.sellerId,
    itemKind:p.itemKind,itemInstanceId:null,itemIds:Object.freeze([]),quantity:p.quantity,unitPrice:p.unitPrice,totalPrice:p.totalPrice
  });
  return {ok:true,settlement:Object.freeze({
    version:TRADE_KERNEL_VERSION,transactionId:p.transactionId,fingerprint:fp,
    wallet:Object.freeze({debit:Object.freeze({agentId:p.buyerId,amount:p.totalPrice}),credit:Object.freeze({agentId:p.sellerId,amount:p.totalPrice})}),
    bulk:Object.freeze({fromAgentId:p.sellerId,toAgentId:p.buyerId,itemKind:p.itemKind,quantity:p.quantity}),
    receipt
  })};
}

export function settleBulkTradeAtomic(state,proposal,adapters={}){
  const txid=proposal?.transactionId;
  if(validId(txid)&&state?.tradeReplay?.receipts){
    if(validateTradeReplayState(state).length)return {ok:false,reason:'replay-state'};
    const prior=findReceipt(state,txid);
    if(prior){
      const fp=tradeProposalFingerprint(proposal);
      return prior.fingerprint===fp?{ok:true,duplicate:true,receipt:clone(prior),state}:{ok:false,reason:'transaction-conflict'};
    }
  }
  const built=buildBulkTradeSettlementProposal(state,proposal,adapters);if(!built.ok)return built;
  const {settlement}=built,staged=clone(state);let context=null;
  try{
    const beforeBuyerBalance=adapters.wallet.balance(staged,settlement.wallet.debit.agentId);
    const beforeSellerBalance=adapters.wallet.balance(staged,settlement.wallet.credit.agentId);
    const beforeSellerResource=adapters.resource.tradableQuantity(staged,{agentId:settlement.bulk.fromAgentId,itemKind:settlement.bulk.itemKind});
    const beforeBuyerResource=adapters.resource.tradableQuantity(staged,{agentId:settlement.bulk.toAgentId,itemKind:settlement.bulk.itemKind});
    if(!adapterResultOk(adapters.wallet.debit(staged,settlement.wallet.debit.agentId,settlement.wallet.debit.amount)))return {ok:false,reason:'wallet-debit'};
    if(!adapterResultOk(adapters.wallet.credit(staged,settlement.wallet.credit.agentId,settlement.wallet.credit.amount)))return {ok:false,reason:'wallet-credit'};
    if(!adapterResultOk(adapters.resource.transfer(staged,{fromAgentId:settlement.bulk.fromAgentId,toAgentId:settlement.bulk.toAgentId,
      itemKind:settlement.bulk.itemKind,quantity:settlement.bulk.quantity})))return {ok:false,reason:'resource-transfer'};
    const receiptResult=appendReceipt(staged,settlement.receipt);if(!receiptResult.ok)return receiptResult;
    const post=adapters.postSettlement;
    if(!post||typeof post.apply!=='function'||typeof post.verify!=='function')return {ok:false,reason:'post-settlement-authority'};
    context=Object.freeze({
      provenance:'CANONICAL_TRADE_SETTLEMENT_EXECUTION',
      proposal:Object.freeze(clone(normalizedBulkProposal(proposal))),
      receipt:Object.freeze({...clone(settlement.receipt),itemIds:Object.freeze([])})
    });
    canonicalExecutionContexts.set(context,staged);
    const applied=post.apply(staged,context);if(!adapterResultOk(applied))return {ok:false,reason:applied?.reason||'post-settlement-apply'};
    const verified=post.verify(staged,context);if(!adapterResultOk(verified))return {ok:false,reason:verified?.reason||'post-settlement-postcondition'};
    const afterBuyerBalance=adapters.wallet.balance(staged,settlement.wallet.debit.agentId);
    const afterSellerBalance=adapters.wallet.balance(staged,settlement.wallet.credit.agentId);
    const afterSellerResource=adapters.resource.tradableQuantity(staged,{agentId:settlement.bulk.fromAgentId,itemKind:settlement.bulk.itemKind});
    const afterBuyerResource=adapters.resource.tradableQuantity(staged,{agentId:settlement.bulk.toAgentId,itemKind:settlement.bulk.itemKind});
    if(afterBuyerBalance!==beforeBuyerBalance-settlement.wallet.debit.amount||afterSellerBalance!==beforeSellerBalance+settlement.wallet.credit.amount)
      return {ok:false,reason:'wallet-postcondition'};
    if(afterSellerResource!==beforeSellerResource-settlement.bulk.quantity||afterBuyerResource!==beforeBuyerResource+settlement.bulk.quantity)
      return {ok:false,reason:'resource-postcondition'};
    if(staged.tradeReplay.receipts.filter(r=>r.transactionId===settlement.transactionId).length!==1)return {ok:false,reason:'replay-postcondition'};
    return {ok:true,duplicate:false,receipt:clone(settlement.receipt),state:staged};
  }catch{
    return {ok:false,reason:'settlement-exception'};
  }finally{
    if(context)canonicalExecutionContexts.delete(context);
  }
}
