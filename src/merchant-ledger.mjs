/**
 * RC4 Merchant Ledger — deterministic accounting read model only.
 *
 * IMPORTANT PROVENANCE BOUNDARY:
 * A plain JavaScript object cannot prove it was produced by the canonical Trade Kernel.
 * This donor therefore validates receipt shape/integrity but never promotes a caller-supplied
 * non-duplicate Trade Kernel result to VERIFIED/COMMITTED accounting evidence by itself.
 * Trusted commit provenance must be supplied by the later Integration Contract / canonical
 * Trade Kernel path. Until then, non-duplicate commit ingestion fails closed as UNKNOWN.
 */
import {isCanonicalMoney,multiplyMoney} from './merchant-pricing.mjs?v=0.5.0';
import {isCanonicalTradeExecutionContext} from './trade-kernel.mjs?v=0.5.0';

export const MERCHANT_LEDGER_VERSION='RC4-ledger/4';
export const MERCHANT_LEDGER_COLLECTION_VERSION='RC4-ledger-collection/1';
export const MERCHANT_LEDGER_ROOT_KEY='merchantLedgers';
export const BULK_RESOURCE_ASSET_TYPE='BULK_RESOURCE';
export const TRADE_KERNEL_COMPAT=Object.freeze({
  maxQuantity:128,
  maxIdLength:80,
  maxReceipts:512,
  eventPrefix:'TRADE:',
  replayVersion:'RC4-trade-replay-1',
});
const idPattern=/^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const validRefId=(v,max=TRADE_KERNEL_COMPAT.maxIdLength)=>typeof v==='string'&&v.length>0&&v.length<=max&&idPattern.test(v);
const positiveInt=v=>Number.isSafeInteger(v)&&v>0;
const clone=v=>structuredClone(v);
const progressionGrants=new WeakMap();
const signedMoney=v=>Number.isSafeInteger(v);
const stableIds=ids=>ids.slice().sort((a,b)=>a-b);

export function tradeReceiptFingerprint(r={}){
  if(r.assetType===BULK_RESOURCE_ASSET_TYPE)return [
    r.assetType,r.transactionId,r.marketId,r.sellerId,r.buyerId,r.itemKind,r.quantity,r.unitPrice,r.totalPrice,r.listingId,r.reservationId
  ].map(v=>String(v)).join('|');
  return [r.transactionId,r.marketId,r.sellerId,r.buyerId,r.itemKind,r.itemInstanceId,r.quantity,r.unitPrice,r.totalPrice,r.listingId,r.reservationId]
    .map(v=>String(v)).join('|');
}

export function tradeReceiptIntegrityFingerprint(r={}){
  if(r.assetType===BULK_RESOURCE_ASSET_TYPE)return tradeReceiptFingerprint(r)+'|BULK|'+r.itemKind+'|'+r.quantity;
  const ids=Array.isArray(r.itemIds)?stableIds(r.itemIds):[];
  return tradeReceiptFingerprint(r)+'|ITEMS|'+ids.join(',');
}

export function validateCommittedTradeReceipt(r){
  const e=[];
  if(!r||typeof r!=='object'||Array.isArray(r))return ['receipt'];
  if(!validRefId(r.transactionId))e.push('transactionId');
  if(!validRefId(r.eventId,TRADE_KERNEL_COMPAT.maxIdLength+TRADE_KERNEL_COMPAT.eventPrefix.length)||
    r.eventId!==TRADE_KERNEL_COMPAT.eventPrefix+r.transactionId)e.push('eventId');
  for(const key of ['marketId','listingId','reservationId'])if(!validRefId(r[key]))e.push(key);
  if(!positiveInt(r.buyerId))e.push('buyerId');
  if(!positiveInt(r.sellerId))e.push('sellerId');
  if(r.buyerId===r.sellerId)e.push('selfTrade');
  if(!validRefId(r.itemKind))e.push('itemKind');
  const bulk=r.assetType===BULK_RESOURCE_ASSET_TYPE;
  if(r.assetType!==undefined&&!bulk)e.push('assetType');
  if(!Number.isSafeInteger(r.quantity)||r.quantity<1||r.quantity>TRADE_KERNEL_COMPAT.maxQuantity)e.push('quantity');
  if(!isCanonicalMoney(r.unitPrice,{allowZero:false}))e.push('unitPrice');
  if(!isCanonicalMoney(r.totalPrice,{allowZero:false}))e.push('totalPrice');
  if(bulk){
    if(r.itemInstanceId!==undefined)e.push('itemInstanceId');
    if(r.itemIds!==undefined)e.push('itemIds');
  }else{
    if(!positiveInt(r.itemInstanceId))e.push('itemInstanceId');
    if(!Array.isArray(r.itemIds)||r.itemIds.length!==r.quantity||new Set(r.itemIds).size!==r.itemIds.length||r.itemIds.some(id=>!positiveInt(id)))e.push('itemIds');
    else {
      if(r.itemIds.join(',')!==stableIds(r.itemIds).join(','))e.push('itemIds-order');
      if(!r.itemIds.includes(r.itemInstanceId))e.push('itemInstanceId');
    }
  }
  if(!e.includes('unitPrice')&&!e.includes('totalPrice')&&!e.includes('quantity')){
    try{if(multiplyMoney(r.unitPrice,r.quantity)!==r.totalPrice)e.push('totalPrice');}catch{e.push('totalPrice');}
  }
  if(typeof r.fingerprint!=='string'||r.fingerprint!==tradeReceiptFingerprint(r))e.push('fingerprint');
  if(typeof r.integrityFingerprint!=='string'||r.integrityFingerprint!==tradeReceiptIntegrityFingerprint(r))e.push('integrityFingerprint');
  return [...new Set(e)];
}

function validateReplayShape(state,receipt){
  const replay=state?.tradeReplay;
  if(!replay||replay.version!==TRADE_KERNEL_COMPAT.replayVersion||!Array.isArray(replay.receipts)||replay.receipts.length>TRADE_KERNEL_COMPAT.maxReceipts)
    return {state:'UNKNOWN',reason:'committed-state-evidence'};
  const seen=new Set();
  for(const row of replay.receipts){
    const errors=validateCommittedTradeReceipt(row);
    if(errors.length||seen.has(row.transactionId))return {state:'VIOL',reason:'committed-state-evidence',errors};
    seen.add(row.transactionId);
  }
  const matches=replay.receipts.filter(row=>row.transactionId===receipt.transactionId);
  if(matches.length!==1)return {state:'VIOL',reason:'committed-state-evidence'};
  const row=matches[0];
  const sameBase=row.fingerprint===receipt.fingerprint&&row.integrityFingerprint===receipt.integrityFingerprint&&
    row.eventId===receipt.eventId&&row.marketId===receipt.marketId&&row.listingId===receipt.listingId&&
    row.reservationId===receipt.reservationId&&row.buyerId===receipt.buyerId&&row.sellerId===receipt.sellerId&&
    row.itemKind===receipt.itemKind&&row.assetType===receipt.assetType&&row.quantity===receipt.quantity&&
    row.unitPrice===receipt.unitPrice&&row.totalPrice===receipt.totalPrice;
  const same=receipt.assetType===BULK_RESOURCE_ASSET_TYPE
    ?sameBase
    :sameBase&&row.itemInstanceId===receipt.itemInstanceId&&row.itemIds.length===receipt.itemIds.length&&row.itemIds.every((id,i)=>id===receipt.itemIds[i]);
  return same?{state:'SAT'}:{state:'VIOL',reason:'committed-state-evidence'};
}

/**
 * Structural assessment only.
 *
 * duplicate:true is a harmless no-op after structural validation.
 * A non-duplicate plain result is NEVER promoted to VERIFIED/COMMITTED here because the caller
 * can forge both receipt and matching tradeReplay state. Canonical provenance must come from
 * the Integration Contract / Trade Kernel authority, which this isolated donor does not own.
 */
export function assessTradeKernelResult(result){
  if(!result||typeof result!=='object'||Array.isArray(result))return {state:'UNKNOWN',reason:'trade-result'};
  if(result.ok!==true)return result.ok===false?{state:'VIOL',reason:result.reason??'trade-not-committed'}:{state:'UNKNOWN',reason:'trade-result'};
  if(result.duplicate!==true&&result.duplicate!==false)return {state:'UNKNOWN',reason:'commit-status'};
  const errors=validateCommittedTradeReceipt(result.receipt);
  if(errors.length)return {state:'VIOL',reason:'trade-receipt',errors};
  const replayShape=validateReplayShape(result.state,result.receipt);
  if(replayShape.state!=='SAT')return replayShape;
  if(result.duplicate===true)return {state:'SAT',duplicate:true,receipt:result.receipt};
  return {state:'UNKNOWN',reason:'trade-commit-provenance',duplicate:false,receipt:result.receipt};
}

export function createMerchantLedger(merchantId){
  if(!positiveInt(merchantId))throw new Error('merchantId');
  return {merchantId,purchases:[],sales:[],revenue:0,costOfGoodsSold:0,realizedProfit:0};
}

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
  const ledgerErrors=validateMerchantLedger(ledger);if(ledgerErrors.length)return {state:'VIOL',reason:'ledger',errors:ledgerErrors};
  const receiptErrors=validateCommittedTradeReceipt(receipt);if(receiptErrors.length)return {state:'VIOL',reason:'trade-receipt',errors:receiptErrors};
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

/** Pure arithmetic only. This function does not mutate or authorize a transaction. */
export function calculateSaleAccounting({revenueBefore=0,costOfGoodsSoldBefore=0,totalPrice,cogs}={}){
  if(!isCanonicalMoney(revenueBefore)||!isCanonicalMoney(costOfGoodsSoldBefore)||
    !isCanonicalMoney(totalPrice,{allowZero:false})||!isCanonicalMoney(cogs))return {state:'VIOL',reason:'accounting-input'};
  const revenue=revenueBefore+totalPrice,costOfGoodsSold=costOfGoodsSoldBefore+cogs;
  if(!Number.isSafeInteger(revenue)||!Number.isSafeInteger(costOfGoodsSold))return {state:'VIOL',reason:'accounting-overflow'};
  const realizedProfit=revenue-costOfGoodsSold;
  if(!Number.isSafeInteger(realizedProfit))return {state:'VIOL',reason:'accounting-overflow'};
  return Object.freeze({state:'SAT',revenue,costOfGoodsSold,realizedProfit});
}

/**
 * Fail-closed ingestion boundary for the isolated donor.
 * Until Integration supplies canonical, unforgeable Trade Kernel commit provenance,
 * no non-duplicate caller-supplied result may mutate Merchant Ledger.
 */
export function applyTradeKernelCommitToLedger(ledger,result){
  const ledgerErrors=validateMerchantLedger(ledger);
  if(ledgerErrors.length)return {state:'VIOL',reason:'ledger',errors:ledgerErrors,ledger:clone(ledger)};
  const assessed=assessTradeKernelResult(result);
  return {...assessed,ledger:clone(ledger)};
}

/**
 * Domain-owned trusted ingestion path. The context carries a module-private Trade Kernel
 * provenance token that cannot be reconstructed from JSON/plain objects.
 */
export function applyCanonicalTradeExecutionToLedger(ledger,stagedState,context,{productionEvidence=null}={}){
  const ledgerErrors=validateMerchantLedger(ledger);
  if(ledgerErrors.length)return {state:'VIOL',reason:'ledger',errors:ledgerErrors,ledger:clone(ledger)};
  if(!isCanonicalTradeExecutionContext(context,stagedState))return {state:'UNKNOWN',reason:'trade-commit-provenance',ledger:clone(ledger)};
  const r=context?.receipt,receiptErrors=validateCommittedTradeReceipt(r);
  if(receiptErrors.length)return {state:'VIOL',reason:'trade-receipt',errors:receiptErrors,ledger:clone(ledger)};
  const replayShape=validateReplayShape(stagedState,r);
  if(replayShape.state!=='SAT')return {...replayShape,ledger:clone(ledger)};
  const txids=new Set([...ledger.purchases,...ledger.sales].map(x=>x.transactionId));
  if(txids.has(r.transactionId))return {state:'SAT',duplicate:true,verification:'VERIFIED',commitStatus:'COMMITTED',receipt:r,ledger:clone(ledger)};
  const next=clone(ledger);
  if(r.buyerId===next.merchantId){
    next.purchases.push({transactionId:r.transactionId,marketId:r.marketId,itemKind:r.itemKind,itemIds:stableIds(r.itemIds),remainingItemIds:stableIds(r.itemIds),
      quantity:r.quantity,unitPrice:r.unitPrice,totalPrice:r.totalPrice,listingId:r.listingId,reservationId:r.reservationId});
  }else if(r.sellerId===next.merchantId){
    const basis=resolveCostBasis(next,r,{productionEvidence});if(basis.state!=='SAT')return {...basis,ledger:clone(ledger)};
    for(const part of basis.parts)if(part.source==='purchase')next.purchases[part.purchaseIndex].remainingItemIds=next.purchases[part.purchaseIndex].remainingItemIds.filter(id=>id!==part.itemId);
    const profit=r.totalPrice-basis.cogs;
    next.sales.push({transactionId:r.transactionId,marketId:r.marketId,itemKind:r.itemKind,itemIds:stableIds(r.itemIds),quantity:r.quantity,
      unitPrice:r.unitPrice,totalPrice:r.totalPrice,cogs:basis.cogs,profit,costBasisSource:basis.source,costBasisRefs:basis.parts.map(p=>p.ref),listingId:r.listingId,reservationId:r.reservationId});
    next.revenue+=r.totalPrice;next.costOfGoodsSold+=basis.cogs;next.realizedProfit=next.revenue-next.costOfGoodsSold;
  }else return {state:'VIOL',reason:'merchant-not-party',ledger:clone(ledger)};
  const post=validateMerchantLedger(next);
  if(post.length)return {state:'VIOL',reason:'ledger-post',errors:post,ledger:clone(ledger)};
  const result=Object.freeze({state:'SAT',duplicate:false,verification:'VERIFIED',commitStatus:'COMMITTED',receipt:r,ledger:next});
  progressionGrants.set(result,{context,stagedState,merchantId:next.merchantId,consumed:false});
  return result;
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


export function createMerchantLedgerCollection(){
  return {version:MERCHANT_LEDGER_COLLECTION_VERSION,ledgers:[]};
}

export function validateMerchantLedgerCollection(collection){
  if(!collection||collection.version!==MERCHANT_LEDGER_COLLECTION_VERSION||!Array.isArray(collection.ledgers))return ['merchant-ledger-collection'];
  const ids=new Set();
  for(const row of collection.ledgers){
    const errors=validateMerchantLedger(row);
    if(errors.length||ids.has(row?.merchantId))return ['merchant-ledger-collection'];
    ids.add(row.merchantId);
  }
  return [];
}

export function migrateMerchantLedgerCollection(raw){
  if(raw===undefined||raw===null)return {state:'SAT',migrated:true,duplicate:false,collection:createMerchantLedgerCollection()};
  const errors=validateMerchantLedgerCollection(raw);
  if(errors.length)return {state:'VIOL',reason:'merchant-ledger-collection',errors,collection:null};
  return {state:'SAT',migrated:false,duplicate:true,collection:clone(raw)};
}

export function serializeMerchantLedgerCollection(collection){
  const errors=validateMerchantLedgerCollection(collection);
  if(errors.length)throw new Error('merchant-ledger-collection-invalid:'+errors.join(','));
  return JSON.stringify(collection);
}

export function restoreMerchantLedgerCollection(serialized){
  const collection=JSON.parse(serialized),errors=validateMerchantLedgerCollection(collection);
  if(errors.length)throw new Error('merchant-ledger-collection-invalid:'+errors.join(','));
  return collection;
}


export function merchantLedgerFromCollection(collection,merchantId){
  const errors=validateMerchantLedgerCollection(collection);
  if(errors.length||!positiveInt(merchantId))return null;
  const row=collection.ledgers.find(x=>x.merchantId===merchantId);
  return row?clone(row):null;
}

export function ensureMerchantLedgerInCollection(collection,merchantId){
  const errors=validateMerchantLedgerCollection(collection);
  if(errors.length)return {state:'VIOL',reason:'merchant-ledger-collection',errors,collection:null};
  if(!positiveInt(merchantId))return {state:'VIOL',reason:'merchantId',collection:clone(collection)};
  const existing=collection.ledgers.find(x=>x.merchantId===merchantId);
  if(existing)return {state:'SAT',duplicate:true,ledger:clone(existing),collection:clone(collection)};
  const next=clone(collection),ledger=createMerchantLedger(merchantId);
  next.ledgers.push(ledger);next.ledgers.sort((a,b)=>a.merchantId-b.merchantId);
  return {state:'SAT',duplicate:false,ledger:clone(ledger),collection:next};
}

export function replaceMerchantLedgerInCollection(collection,ledger){
  const errors=validateMerchantLedgerCollection(collection),ledgerErrors=validateMerchantLedger(ledger);
  if(errors.length||ledgerErrors.length)return {state:'VIOL',reason:'merchant-ledger',errors:[...errors,...ledgerErrors],collection:clone(collection)};
  const index=collection.ledgers.findIndex(x=>x.merchantId===ledger.merchantId);
  if(index<0)return {state:'VIOL',reason:'merchant-ledger-missing',collection:clone(collection)};
  const next=clone(collection);next.ledgers[index]=clone(ledger);
  const post=validateMerchantLedgerCollection(next);
  if(post.length)return {state:'VIOL',reason:'merchant-ledger-collection',errors:post,collection:clone(collection)};
  return {state:'SAT',duplicate:false,ledger:clone(ledger),collection:next};
}

/** Career consumes a Ledger-issued grant once, within this exact staged Trade call. */
export function consumeCanonicalMerchantProgressionGrant(agent,result){
  const grant=result&&typeof result==='object'?progressionGrants.get(result):null;
  if(!grant||!isCanonicalTradeExecutionContext(grant.context,grant.stagedState)||
    grant.merchantId!==agent?.id||grant.stagedState.agents?.find(a=>a.id===agent.id)!==agent||
    result.receipt!==grant.context.receipt)return {state:'UNKNOWN',reason:'trade-commit-provenance'};
  if(grant.consumed)return {state:'SAT',duplicate:true};
  grant.consumed=true;
  return {state:'SAT',duplicate:false};
}
