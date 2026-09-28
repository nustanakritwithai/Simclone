/**
 * RC4 Merchant Ledger — accounting read model only.
 * It never commits a trade and never writes wallet or inventory authority.
 */
import {isCanonicalMoney,moneyToMinor,minorToMoney,multiplyMoney} from './merchant-pricing.mjs';

export const MERCHANT_LEDGER_VERSION='RC4-ledger/1';
const validId=v=>(Number.isSafeInteger(v)&&v>0)||(typeof v==='string'&&v.length>0&&v.length<=160);
const validKind=v=>typeof v==='string'&&v.length>0&&v.length<=128;
const clone=v=>JSON.parse(JSON.stringify(v));
const signedMoney=v=>{
  if(typeof v!=='number'||!Number.isFinite(v))return false;
  const n=Math.round(v*100);return Number.isSafeInteger(n)&&Math.abs(v*100-n)<1e-7;
};
const minorSigned=v=>{if(!signedMoney(v))throw new Error('signed-money');return Math.round(v*100);};

export function validateTradeProposal(tx){
  const e=[];
  if(!tx||typeof tx!=='object'||Array.isArray(tx))return ['transaction'];
  for(const key of ['transactionId','marketId','sellerId','buyerId','itemInstanceId','listingId','reservationId'])if(!validId(tx[key]))e.push(key);
  if(!validKind(tx.itemKind))e.push('itemKind');
  if(tx.buyerId===tx.sellerId)e.push('selfTrade');
  if(!Number.isSafeInteger(tx.quantity)||tx.quantity<1)e.push('quantity');
  if(!isCanonicalMoney(tx.unitPrice))e.push('unitPrice');
  if(!isCanonicalMoney(tx.totalPrice))e.push('totalPrice');
  if(!e.includes('unitPrice')&&!e.includes('totalPrice')&&!e.includes('quantity')){
    try{if(multiplyMoney(tx.unitPrice,tx.quantity)!==tx.totalPrice)e.push('totalPrice');}catch{e.push('totalPrice');}
  }
  return [...new Set(e)];
}

/** Wrapper decouples ledger accounting from the Trade Kernel's eventual receipt field names. */
export function assessLedgerEvidence(evidence){
  if(!evidence||typeof evidence!=='object')return {state:'UNKNOWN',reason:'evidence'};
  if(evidence.verification!=='VERIFIED'){
    if(['FAILED','VIOL','REJECTED'].includes(evidence.verification))return {state:'VIOL',reason:'verification'};
    return {state:'UNKNOWN',reason:'verification'};
  }
  if(evidence.commitStatus!=='COMMITTED'){
    if(['FAILED','CANCELED','CANCELLED','REJECTED'].includes(evidence.commitStatus))return {state:'VIOL',reason:'commit-status'};
    return {state:'UNKNOWN',reason:'commit-status'};
  }
  const errors=validateTradeProposal(evidence.transaction);
  return errors.length?{state:'VIOL',reason:'transaction',errors}:{state:'SAT',transaction:evidence.transaction};
}

export function createMerchantLedger(merchantId){
  if(!validId(merchantId))throw new Error('merchantId');
  return {merchantId,purchases:[],sales:[],revenue:0,costOfGoodsSold:0,realizedProfit:0};
}

function transactionIds(ledger){return new Set([...ledger.purchases,...ledger.sales].map(x=>x.transactionId));}

export function validateMerchantLedger(ledger){
  const e=[];
  if(!ledger||typeof ledger!=='object'||Array.isArray(ledger)||!validId(ledger.merchantId))return ['merchant-ledger'];
  if(!Array.isArray(ledger.purchases)||!Array.isArray(ledger.sales))return ['merchant-ledger-entries'];
  const ids=new Set();
  for(const p of ledger.purchases){
    if(!p||!validId(p.transactionId)||ids.has(p.transactionId)||!validId(p.itemInstanceId)||!validKind(p.itemKind)||
      !Number.isSafeInteger(p.quantity)||p.quantity<1||!Number.isSafeInteger(p.remainingQuantity)||p.remainingQuantity<0||p.remainingQuantity>p.quantity||
      !isCanonicalMoney(p.unitPrice)||!isCanonicalMoney(p.totalPrice))e.push('purchase');
    else {try{if(multiplyMoney(p.unitPrice,p.quantity)!==p.totalPrice)e.push('purchase-total');}catch{e.push('purchase-total');}}
    ids.add(p?.transactionId);
  }
  let revenueMinor=0,cogsMinor=0;
  for(const s of ledger.sales){
    if(!s||!validId(s.transactionId)||ids.has(s.transactionId)||!validId(s.itemInstanceId)||!validKind(s.itemKind)||
      !Number.isSafeInteger(s.quantity)||s.quantity<1||!isCanonicalMoney(s.unitPrice)||!isCanonicalMoney(s.totalPrice)||
      !isCanonicalMoney(s.cogs)||!signedMoney(s.profit)||!['purchase','production'].includes(s.costBasisSource))e.push('sale');
    else {
      try{
        if(multiplyMoney(s.unitPrice,s.quantity)!==s.totalPrice)e.push('sale-total');
        if(minorSigned(s.profit)!==moneyToMinor(s.totalPrice)-moneyToMinor(s.cogs))e.push('sale-profit');
      }catch{e.push('sale-total');}
    }
    ids.add(s?.transactionId);
    if(isCanonicalMoney(s?.totalPrice))revenueMinor+=moneyToMinor(s.totalPrice);
    if(isCanonicalMoney(s?.cogs))cogsMinor+=moneyToMinor(s.cogs);
  }
  if(!isCanonicalMoney(ledger.revenue)||!isCanonicalMoney(ledger.costOfGoodsSold)||!signedMoney(ledger.realizedProfit))e.push('totals');
  else if(moneyToMinor(ledger.revenue)!==revenueMinor||moneyToMinor(ledger.costOfGoodsSold)!==cogsMinor||
    minorSigned(ledger.realizedProfit)!==revenueMinor-cogsMinor)e.push('totals-drift');
  return [...new Set(e)];
}

function purchaseBasis(ledger,tx){
  const index=ledger.purchases.findIndex(p=>p.itemInstanceId===tx.itemInstanceId&&p.itemKind===tx.itemKind&&p.remainingQuantity>=tx.quantity);
  if(index<0)return null;
  const p=ledger.purchases[index];
  try{return {state:'SAT',source:'purchase',purchaseIndex:index,unitCost:p.unitPrice,totalCost:multiplyMoney(p.unitPrice,tx.quantity),sourceTransactionId:p.transactionId};}
  catch{return {state:'VIOL',reason:'purchase-cost'};}
}

function productionBasis(tx,evidence){
  if(evidence===undefined||evidence===null)return {state:'UNKNOWN',reason:'production-cost-evidence'};
  if(evidence.verification!=='VERIFIED')return evidence.verification==='UNKNOWN'?
    {state:'UNKNOWN',reason:'production-cost-evidence'}:{state:'VIOL',reason:'production-cost-evidence'};
  if(!validId(evidence.evidenceId)||evidence.itemInstanceId!==tx.itemInstanceId||!isCanonicalMoney(evidence.totalCost)||
    !Array.isArray(evidence.sourceEvidenceIds)||evidence.sourceEvidenceIds.length===0||evidence.sourceEvidenceIds.some(x=>!validId(x)))
    return {state:'VIOL',reason:'production-cost-evidence'};
  return {state:'SAT',source:'production',totalCost:evidence.totalCost,evidenceId:evidence.evidenceId};
}

export function resolveCostBasis(ledger,tx,{productionEvidence=null}={}){
  const purchase=purchaseBasis(ledger,tx);if(purchase)return purchase;
  return productionBasis(tx,productionEvidence);
}

export function applyCommittedTransactionToLedger(ledger,evidence,{productionEvidence=null}={}){
  const ledgerErrors=validateMerchantLedger(ledger);if(ledgerErrors.length)return {state:'VIOL',reason:'ledger',errors:ledgerErrors,ledger:clone(ledger)};
  const assessed=assessLedgerEvidence(evidence);if(assessed.state!=='SAT')return {...assessed,ledger:clone(ledger)};
  const tx=assessed.transaction;
  if(transactionIds(ledger).has(tx.transactionId))return {state:'SAT',duplicate:true,ledger:clone(ledger)};
  const next=clone(ledger);
  if(tx.buyerId===next.merchantId){
    next.purchases.push({transactionId:tx.transactionId,marketId:tx.marketId,itemInstanceId:tx.itemInstanceId,itemKind:tx.itemKind,
      quantity:tx.quantity,remainingQuantity:tx.quantity,unitPrice:tx.unitPrice,totalPrice:tx.totalPrice,listingId:tx.listingId,reservationId:tx.reservationId});
    const errors=validateMerchantLedger(next);return errors.length?{state:'VIOL',reason:'ledger-post',errors,ledger:clone(ledger)}:{state:'SAT',duplicate:false,ledger:next};
  }
  if(tx.sellerId!==next.merchantId)return {state:'VIOL',reason:'merchant-not-party',ledger:clone(ledger)};
  const basis=resolveCostBasis(next,tx,{productionEvidence});if(basis.state!=='SAT')return {...basis,ledger:clone(ledger)};
  if(basis.source==='purchase')next.purchases[basis.purchaseIndex].remainingQuantity-=tx.quantity;
  const revenueMinor=moneyToMinor(tx.totalPrice),cogsMinor=moneyToMinor(basis.totalCost),profitMinor=revenueMinor-cogsMinor;
  next.sales.push({transactionId:tx.transactionId,marketId:tx.marketId,itemInstanceId:tx.itemInstanceId,itemKind:tx.itemKind,
    quantity:tx.quantity,unitPrice:tx.unitPrice,totalPrice:tx.totalPrice,cogs:basis.totalCost,profit:profitMinor/100,
    costBasisSource:basis.source,costBasisRef:basis.source==='purchase'?basis.sourceTransactionId:basis.evidenceId,
    listingId:tx.listingId,reservationId:tx.reservationId});
  next.revenue=minorToMoney(moneyToMinor(next.revenue)+revenueMinor);
  next.costOfGoodsSold=minorToMoney(moneyToMinor(next.costOfGoodsSold)+cogsMinor);
  next.realizedProfit=(minorSigned(next.realizedProfit)+profitMinor)/100;
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
