/**
 * RC4 Merchant Ledger — accounting read model only.
 * Consumes successful RC4 Trade Kernel settlement results; never commits trade or writes wallet/inventory.
 */
import {isCanonicalMoney,multiplyMoney} from './merchant-pricing.mjs';

export const MERCHANT_LEDGER_VERSION='RC4-ledger/2';
export const TRADE_KERNEL_COMPAT=Object.freeze({maxQuantity:128,maxIdLength:80,eventPrefix:'TRADE:'});
const idPattern=/^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const validRefId=(v,max=TRADE_KERNEL_COMPAT.maxIdLength)=>typeof v==='string'&&v.length>0&&v.length<=max&&idPattern.test(v);
const positiveInt=v=>Number.isSafeInteger(v)&&v>0;
const clone=v=>JSON.parse(JSON.stringify(v));
const signedMoney=v=>Number.isSafeInteger(v);
const stableIds=ids=>ids.slice().sort((a,b)=>a-b);
const sameIds=(a,b)=>a.length===b.length&&stableIds(a).every((id,i)=>id===stableIds(b)[i]);

export function validateCommittedTradeReceipt(r){
  const e=[];
  if(!r||typeof r!=='object'||Array.isArray(r))return ['receipt'];
  if(!validRefId(r.transactionId))e.push('transactionId');
  if(typeof r.fingerprint!=='string'||r.fingerprint.length===0)e.push('fingerprint');
  if(!validRefId(r.eventId,TRADE_KERNEL_COMPAT.maxIdLength+TRADE_KERNEL_COMPAT.eventPrefix.length)||
    r.eventId!==TRADE_KERNEL_COMPAT.eventPrefix+r.transactionId)e.push('eventId');
  for(const key of ['marketId','listingId','reservationId'])if(!validRefId(r[key]))e.push(key);
  if(!positiveInt(r.buyerId))e.push('buyerId');
  if(!positiveInt(r.sellerId))e.push('sellerId');
  if(r.buyerId===r.sellerId)e.push('selfTrade');
  if(!validRefId(r.itemKind))e.push('itemKind');
  if(!Number.isSafeInteger(r.quantity)||r.quantity<1||r.quantity>TRADE_KERNEL_COMPAT.maxQuantity)e.push('quantity');
  if(!isCanonicalMoney(r.unitPrice,{allowZero:false}))e.push('unitPrice');
  if(!isCanonicalMoney(r.totalPrice,{allowZero:false}))e.push('totalPrice');
  if(!Array.isArray(r.itemIds)||r.itemIds.length!==r.quantity||new Set(r.itemIds).size!==r.itemIds.length||r.itemIds.some(id=>!positiveInt(id)))e.push('itemIds');
  if(!e.includes('unitPrice')&&!e.includes('totalPrice')&&!e.includes('quantity')){
    try{if(multiplyMoney(r.unitPrice,r.quantity)!==r.totalPrice)e.push('totalPrice');}catch{e.push('totalPrice');}
  }
  return [...new Set(e)];
}

/** Raw proposal / failed / UNKNOWN is not accounting evidence. */
export function assessTradeKernelResult(result){
  if(!result||typeof result!=='object')return {state:'UNKNOWN',reason:'trade-result'};
  if(result.ok!==true)return result.ok===false?{state:'VIOL',reason:result.reason??'trade-not-committed'}:{state:'UNKNOWN',reason:'trade-result'};
  const errors=validateCommittedTradeReceipt(result.receipt);
  if(errors.length)return {state:'VIOL',reason:'trade-receipt',errors};
  if(result.duplicate===true)return {state:'SAT',duplicate:true,receipt:result.receipt};
  if(result.duplicate!==false)return {state:'UNKNOWN',reason:'commit-status'};
  return {state:'SAT',duplicate:false,verification:'VERIFIED',commitStatus:'COMMITTED',receipt:result.receipt};
}

export function createMerchantLedger(merchantId){
  if(!positiveInt(merchantId))throw new Error('merchantId');
  return {merchantId,purchases:[],sales:[],revenue:0,costOfGoodsSold:0,realizedProfit:0};
}

const transactionIds=ledger=>new Set([...ledger.purchases,...ledger.sales].map(x=>x.transactionId));

export function validateMerchantLedger(ledger){
  const e=[];
  if(!ledger||typeof ledger!=='object'||Array.isArray(ledger)||!positiveInt(ledger.merchantId))return ['merchant-ledger'];
  if(!Array.isArray(ledger.purchases)||!Array.isArray(ledger.sales))return ['merchant-ledger-entries'];
  const txids=new Set();let revenue=0,cogs=0;
  for(const p of ledger.purchases){
    if(!p||!validRefId(p.transactionId)||txids.has(p.transactionId)||!validRefId(p.marketId)||!validRefId(p.itemKind)||
      !Array.isArray(p.itemIds)||p.itemIds.length!==p.quantity||new Set(p.itemIds).size!==p.itemIds.length||p.itemIds.some(id=>!positiveInt(id))||
      !Array.isArray(p.remainingItemIds)||new Set(p.remainingItemIds).size!==p.remainingItemIds.length||p.remainingItemIds.some(id=>!p.itemIds.includes(id))||
      !Number.isSafeInteger(p.quantity)||p.quantity<1||!isCanonicalMoney(p.unitPrice,{allowZero:false})||!isCanonicalMoney(p.totalPrice,{allowZero:false})||
      !validRefId(p.listingId)||!validRefId(p.reservationId))e.push('purchase');
    else {try{if(multiplyMoney(p.unitPrice,p.quantity)!==p.totalPrice)e.push('purchase-total');}catch{e.push('purchase-total');}}
    txids.add(p?.transactionId);
  }
  for(const s of ledger.sales){
    if(!s||!validRefId(s.transactionId)||txids.has(s.transactionId)||!validRefId(s.marketId)||!validRefId(s.itemKind)||
      !Array.isArray(s.itemIds)||s.itemIds.length!==s.quantity||new Set(s.itemIds).size!==s.itemIds.length||s.itemIds.some(id=>!positiveInt(id))||
      !Number.isSafeInteger(s.quantity)||s.quantity<1||!isCanonicalMoney(s.unitPrice,{allowZero:false})||!isCanonicalMoney(s.totalPrice,{allowZero:false})||
      !isCanonicalMoney(s.cogs)||!signedMoney(s.profit)||!['purchase','production','mixed'].includes(s.costBasisSource)||
      !Array.isArray(s.costBasisRefs)||s.costBasisRefs.length<1||s.costBasisRefs.some(ref=>!validRefId(ref))||!validRefId(s.listingId)||!validRefId(s.reservationId))e.push('sale');
    else {try{if(multiplyMoney(s.unitPrice,s.quantity)!==s.totalPrice||s.profit!==s.totalPrice-s.cogs)e.push('sale-total');}catch{e.push('sale-total');}}
    txids.add(s?.transactionId);
    if(isCanonicalMoney(s?.totalPrice))revenue+=s.totalPrice;
    if(isCanonicalMoney(s?.cogs))cogs+=s.cogs;
    if(!Number.isSafeInteger(revenue)||!Number.isSafeInteger(cogs))e.push('totals-overflow');
  }
  if(!isCanonicalMoney(ledger.revenue)||!isCanonicalMoney(ledger.costOfGoodsSold)||!signedMoney(ledger.realizedProfit))e.push('totals');
  else if(ledger.revenue!==revenue||ledger.costOfGoodsSold!==cogs||ledger.realizedProfit!==revenue-cogs)e.push('totals-drift');
  return [...new Set(e)];
}

function purchasedItemBasis(ledger,itemId,itemKind){
  for(let i=0;i<ledger.purchases.length;i++){
    const p=ledger.purchases[i];
    if(p.itemKind===itemKind&&p.remainingItemIds.includes(itemId))return {source:'purchase',purchaseIndex:i,itemId,cost:p.unitPrice,ref:p.transactionId};
  }
  return null;
}

function productionItemBasis(itemId,evidence){
  const rows=Array.isArray(evidence)?evidence:evidence?[evidence]:[];
  const x=rows.find(row=>row?.itemInstanceId===itemId);
  if(!x)return {state:'UNKNOWN',reason:'production-cost-evidence',itemId};
  if(x.verification!=='VERIFIED')return x.verification==='UNKNOWN'?{state:'UNKNOWN',reason:'production-cost-evidence',itemId}:{state:'VIOL',reason:'production-cost-evidence',itemId};
  if(!validRefId(x.evidenceId)||!isCanonicalMoney(x.totalCost)||!Array.isArray(x.sourceEvidenceIds)||x.sourceEvidenceIds.length===0||x.sourceEvidenceIds.some(id=>!validRefId(id)))
    return {state:'VIOL',reason:'production-cost-evidence',itemId};
  return {state:'SAT',source:'production',itemId,cost:x.totalCost,ref:x.evidenceId};
}

export function resolveCostBasis(ledger,receipt,{productionEvidence=null}={}){
  const parts=[];
  for(const itemId of receipt.itemIds){
    const purchased=purchasedItemBasis(ledger,itemId,receipt.itemKind);
    if(purchased){parts.push({state:'SAT',...purchased});continue;}
    const produced=productionItemBasis(itemId,productionEvidence);if(produced.state!=='SAT')return produced;parts.push(produced);
  }
  const cogs=parts.reduce((sum,p)=>sum+p.cost,0);
  if(!Number.isSafeInteger(cogs))return {state:'VIOL',reason:'cost-overflow'};
  const sources=new Set(parts.map(p=>p.source));
  return {state:'SAT',cogs,source:sources.size===1?[...sources][0]:'mixed',parts};
}

export function applyTradeKernelCommitToLedger(ledger,result,{productionEvidence=null}={}){
  const ledgerErrors=validateMerchantLedger(ledger);if(ledgerErrors.length)return {state:'VIOL',reason:'ledger',errors:ledgerErrors,ledger:clone(ledger)};
  const assessed=assessTradeKernelResult(result);if(assessed.state!=='SAT'||assessed.duplicate)return {...assessed,ledger:clone(ledger)};
  const r=assessed.receipt;
  if(transactionIds(ledger).has(r.transactionId))return {state:'SAT',duplicate:true,ledger:clone(ledger)};
  const next=clone(ledger);
  if(r.buyerId===next.merchantId){
    next.purchases.push({transactionId:r.transactionId,marketId:r.marketId,itemKind:r.itemKind,itemIds:stableIds(r.itemIds),remainingItemIds:stableIds(r.itemIds),
      quantity:r.quantity,unitPrice:r.unitPrice,totalPrice:r.totalPrice,listingId:r.listingId,reservationId:r.reservationId});
    const errors=validateMerchantLedger(next);return errors.length?{state:'VIOL',reason:'ledger-post',errors,ledger:clone(ledger)}:{state:'SAT',duplicate:false,ledger:next};
  }
  if(r.sellerId!==next.merchantId)return {state:'VIOL',reason:'merchant-not-party',ledger:clone(ledger)};
  const basis=resolveCostBasis(next,r,{productionEvidence});if(basis.state!=='SAT')return {...basis,ledger:clone(ledger)};
  for(const part of basis.parts)if(part.source==='purchase')next.purchases[part.purchaseIndex].remainingItemIds=next.purchases[part.purchaseIndex].remainingItemIds.filter(id=>id!==part.itemId);
  const profit=r.totalPrice-basis.cogs;
  next.sales.push({transactionId:r.transactionId,marketId:r.marketId,itemKind:r.itemKind,itemIds:stableIds(r.itemIds),quantity:r.quantity,
    unitPrice:r.unitPrice,totalPrice:r.totalPrice,cogs:basis.cogs,profit,costBasisSource:basis.source,costBasisRefs:basis.parts.map(p=>p.ref),
    listingId:r.listingId,reservationId:r.reservationId});
  next.revenue+=r.totalPrice;next.costOfGoodsSold+=basis.cogs;next.realizedProfit=next.revenue-next.costOfGoodsSold;
  if(!Number.isSafeInteger(next.revenue)||!Number.isSafeInteger(next.costOfGoodsSold)||!Number.isSafeInteger(next.realizedProfit))return {state:'VIOL',reason:'ledger-overflow',ledger:clone(ledger)};
  const errors=validateMerchantLedger(next);return errors.length?{state:'VIOL',reason:'ledger-post',errors,ledger:clone(ledger)}:{state:'SAT',duplicate:false,ledger:next};
}

export function serializeMerchantLedger(ledger){
  const errors=validateMerchantLedger(ledger);if(errors.length)throw new Error('merchant-ledger-invalid:'+errors.join(','));
  return JSON.stringify(ledger);
}

export function restoreMerchantLedger(serialized){
  const ledger=JSON.parse(serialized),errors=validateMerchantLedger(ledger);
  if(errors.length)throw new Error('merchant-ledger-invalid:'+errors.join(','));
  return ledger;
}
