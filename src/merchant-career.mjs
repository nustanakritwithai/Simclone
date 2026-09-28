/**
 * RC4 Merchant Career V1.
 *
 * Scope: qualification, canonical profession adoption and progression hooks only.
 * No trade settlement, wallet, Rust inventory, pricing, market UI or runtime policy.
 */
import {adoptProfession} from './kingdom-utility.mjs?v=0.5.0';

export const MERCHANT_CAREER_VERSION='RC4-merchant-v1';
export const MERCHANT_QUALIFICATION_POLICY=Object.freeze({
  minOperatingCapital:1,
  minTradeEvidence:1,
});
export const MERCHANT_TRANSACTION_COMPAT=Object.freeze({maxQuantity:128,maxIdLength:80,eventPrefix:'TRADE:'});

const SAT='SAT',VIOL='VIOL',UNKNOWN='UNKNOWN';
const nonEmptyString=value=>typeof value==='string'&&value.length>0&&value.length<=120;
const transactionIdPattern=/^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const validTransactionRef=(value,max=MERCHANT_TRANSACTION_COMPAT.maxIdLength)=>typeof value==='string'&&value.length>0&&value.length<=max&&transactionIdPattern.test(value);
const positiveInt=value=>Number.isSafeInteger(value)&&value>0;
const stableItemIds=ids=>Array.isArray(ids)?ids.slice().sort((a,b)=>a-b):[];
function canonicalTradeFingerprint(r={}){
  return [r.transactionId,r.marketId,r.sellerId,r.buyerId,r.itemKind,r.itemInstanceId,r.quantity,r.unitPrice,r.totalPrice,r.listingId,r.reservationId]
    .map(value=>String(value)).join('|');
}
function canonicalReceiptIntegrityFingerprint(r={}){
  return canonicalTradeFingerprint(r)+'|ITEMS|'+stableItemIds(r.itemIds).join(',');
}
const pass=detail=>({status:SAT,detail});
const fail=detail=>({status:VIOL,detail});
const unknown=detail=>({status:UNKNOWN,detail});

function evidenceState(value,label){
  if(!value||typeof value!=='object'||Array.isArray(value))return unknown(label+' evidence missing');
  if(value.status==='CONFIRMED')return pass(label+' confirmed');
  if(value.status==='ABSENT'||value.status==='REJECTED')return fail(label+' not established');
  if(value.status==='UNKNOWN')return unknown(label+' unknown');
  return unknown(label+' evidence status invalid');
}
function aggregate(checks){
  const states=Object.values(checks).map(check=>check.status);
  if(states.includes(VIOL))return VIOL;
  if(states.includes(UNKNOWN))return UNKNOWN;
  return SAT;
}

/**
 * Pure Merchant qualification. The caller must project authoritative runtime
 * facts into this snapshot. Missing/ambiguous evidence is UNKNOWN, never PASS.
 *
 * Expected snapshot shape:
 * {
 *   alive: boolean,
 *   lifeStage: 'CHILD'|'ADULT'|'ELDER'|'DEAD',
 *   professionTransitionAllowed: boolean,
 *   homeControl: {status:'CONFIRMED'|'ABSENT'|'REJECTED'|'UNKNOWN', houseId?:string, evidenceId?:string},
 *   operatingCapital: {status:'CONFIRMED'|'ABSENT'|'REJECTED'|'UNKNOWN', amount:number},
 *   tradeKnowledge: {status:'CONFIRMED'|'ABSENT'|'REJECTED'|'UNKNOWN', evidenceCount:number},
 *   evidenceId: string
 * }
 */
export function evaluateMerchantQualification(snapshot){
  const life=snapshot?.lifeStage;
  const alive=snapshot?.alive===true?pass('alive'):snapshot?.alive===false?fail('dead'):unknown('alive unknown');
  const adult=(life==='ADULT'||life==='ELDER')?pass('adult-capable stage')
    :(life==='CHILD'||life==='DEAD')?fail('not adult-capable'):unknown('life stage unknown');
  const transition=snapshot?.professionTransitionAllowed===true?pass('profession transition allowed')
    :snapshot?.professionTransitionAllowed===false?fail('profession transition blocked'):unknown('profession transition unknown');

  const homeEvidence=evidenceState(snapshot?.homeControl,'home control');
  const home=homeEvidence.status!==SAT?homeEvidence:
    (nonEmptyString(snapshot.homeControl.houseId)||nonEmptyString(snapshot.homeControl.evidenceId))
      ?pass('home control confirmed')
      :unknown('home control lacks evidence reference');

  const capitalEvidence=evidenceState(snapshot?.operatingCapital,'operating capital');
  let capital=capitalEvidence;
  if(capitalEvidence.status===SAT){
    const amount=snapshot.operatingCapital.amount;
    capital=typeof amount==='number'&&Number.isFinite(amount)
      ?(amount>=MERCHANT_QUALIFICATION_POLICY.minOperatingCapital
        ?pass('operating capital threshold met')
        :fail('operating capital below threshold'))
      :unknown('operating capital amount unknown');
  }

  const tradeEvidence=evidenceState(snapshot?.tradeKnowledge,'trade knowledge');
  let tradeKnowledge=tradeEvidence;
  if(tradeEvidence.status===SAT){
    const count=snapshot.tradeKnowledge.evidenceCount;
    tradeKnowledge=Number.isInteger(count)&&count>=0
      ?(count>=MERCHANT_QUALIFICATION_POLICY.minTradeEvidence
        ?pass('trade evidence threshold met')
        :fail('trade evidence below threshold'))
      :unknown('trade evidence count unknown');
  }

  const qualificationEvidence=nonEmptyString(snapshot?.evidenceId)
    ?pass('qualification evidence id present')
    :unknown('qualification evidence id missing');

  const checks={alive,adult,transition,home,capital,tradeKnowledge,qualificationEvidence};
  const status=aggregate(checks);
  return {
    version:1,
    status,
    qualified:status===SAT,
    checks,
    policy:{...MERCHANT_QUALIFICATION_POLICY},
    evidenceId:nonEmptyString(snapshot?.evidenceId)?snapshot.evidenceId:null,
  };
}

/**
 * Merchant module never writes agent.profession itself. A SAT qualification is
 * routed into the existing profession authority with an explicit evidence token.
 */
export function adoptMerchantProfession(agent,snapshot,tick){
  const qualification=evaluateMerchantQualification(snapshot);
  if(!agent||typeof agent!=='object'||Array.isArray(agent))
    return {changed:false,status:UNKNOWN,reason:'agent',profession:undefined,qualification};
  if(!Number.isInteger(tick)||tick<0)
    return {changed:false,status:UNKNOWN,reason:'tick',profession:agent.profession,qualification};
  if(snapshot?.agentId!==undefined&&snapshot.agentId!==agent.id)
    return {changed:false,status:VIOL,reason:'agent-mismatch',profession:agent.profession,qualification};
  if(!qualification.qualified)
    return {changed:false,status:qualification.status,reason:'qualification',profession:agent.profession,qualification};

  const transition=adoptProfession(agent,'MERCHANT',tick,{
    qualifiedProfession:'merchant',
    qualification:'merchant-v1',
    evidenceId:qualification.evidenceId,
  });
  const status=agent.profession==='merchant'?SAT:transition.reason==='profession-locked'?VIOL:UNKNOWN;
  return {...transition,status,qualification};
}

/**
 * Read-only accounting bridge. Merchant Ledger remains the only writer of
 * Revenue / COGS / Realized Profit. Career only projects a validated ledger
 * total for progression/UI consumers and never stores it on the agent.
 */
export function projectMerchantRealizedProfit(agent,ledger){
  if(!agent||typeof agent!=='object'||Array.isArray(agent))return {status:UNKNOWN,reason:'agent',merchantRealizedProfit:null,authority:'merchant-ledger'};
  if(ledger===undefined||ledger===null)return {status:UNKNOWN,reason:'ledger-missing',merchantRealizedProfit:null,authority:'merchant-ledger'};
  if(!ledger||typeof ledger!=='object'||Array.isArray(ledger))return {status:VIOL,reason:'ledger-shape',merchantRealizedProfit:null,authority:'merchant-ledger'};
  if(!Number.isSafeInteger(ledger.merchantId)||ledger.merchantId<1||ledger.merchantId!==agent.id)
    return {status:VIOL,reason:'ledger-merchant',merchantRealizedProfit:null,authority:'merchant-ledger'};
  if(!Number.isSafeInteger(ledger.revenue)||ledger.revenue<0||!Number.isSafeInteger(ledger.costOfGoodsSold)||ledger.costOfGoodsSold<0||
    !Number.isSafeInteger(ledger.realizedProfit)||ledger.realizedProfit!==ledger.revenue-ledger.costOfGoodsSold)
    return {status:VIOL,reason:'ledger-totals',merchantRealizedProfit:null,authority:'merchant-ledger'};
  return {status:SAT,reason:'ledger-projection',merchantRealizedProfit:ledger.realizedProfit,authority:'merchant-ledger'};
}

export function merchantProgressionSnapshot(agent,{ledger=null}={}){
  const profit=projectMerchantRealizedProfit(agent,ledger);
  return {
    merchantTransactions:Number.isInteger(agent?.merchantTransactions)&&agent.merchantTransactions>=0?agent.merchantTransactions:0,
    merchantRealizedProfit:profit.status===SAT?profit.merchantRealizedProfit:null,
    merchantExperience:Number.isInteger(agent?.merchantExperience)&&agent.merchantExperience>=0?agent.merchantExperience:0,
  };
}

export function validateMerchantProgression(agent){
  if(agent?.merchantRealizedProfit!==undefined)return ['Merchant monetary duplicate'];
  const corePresent=agent?.merchantTransactions!==undefined||agent?.merchantExperience!==undefined;
  if(corePresent&&(!Number.isInteger(agent?.merchantTransactions)||agent.merchantTransactions<0||
    !Number.isInteger(agent?.merchantExperience)||agent.merchantExperience<0))return ['Merchant progression'];
  // Any legacy/recent transaction-id field is deliberately ignored here.
  // It is not progression state and has zero idempotency authority.
  return [];
}

function validateCanonicalCommittedReceipt(receipt){
  const errors=[];
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt))return ['receipt'];
  if(!validTransactionRef(receipt.transactionId))errors.push('transactionId');
  if(!validTransactionRef(receipt.eventId,MERCHANT_TRANSACTION_COMPAT.maxIdLength+MERCHANT_TRANSACTION_COMPAT.eventPrefix.length)||
    receipt.eventId!==MERCHANT_TRANSACTION_COMPAT.eventPrefix+receipt.transactionId)errors.push('eventId');
  for(const key of ['marketId','listingId','reservationId'])if(!validTransactionRef(receipt[key]))errors.push(key);
  if(!positiveInt(receipt.buyerId))errors.push('buyerId');
  if(!positiveInt(receipt.sellerId))errors.push('sellerId');
  if(receipt.buyerId===receipt.sellerId)errors.push('selfTrade');
  if(!validTransactionRef(receipt.itemKind))errors.push('itemKind');
  if(!positiveInt(receipt.itemInstanceId))errors.push('itemInstanceId');
  if(!Number.isSafeInteger(receipt.quantity)||receipt.quantity<1||receipt.quantity>MERCHANT_TRANSACTION_COMPAT.maxQuantity)errors.push('quantity');
  if(!positiveInt(receipt.unitPrice))errors.push('unitPrice');
  if(!positiveInt(receipt.totalPrice))errors.push('totalPrice');
  if(!Array.isArray(receipt.itemIds)||receipt.itemIds.length!==receipt.quantity||new Set(receipt.itemIds).size!==receipt.itemIds.length||
    receipt.itemIds.some(id=>!positiveInt(id))||receipt.itemIds.join(',')!==stableItemIds(receipt.itemIds).join(',')||
    (positiveInt(receipt.itemInstanceId)&&!receipt.itemIds.includes(receipt.itemInstanceId)))errors.push('itemIds');
  if(!errors.includes('unitPrice')&&!errors.includes('totalPrice')&&!errors.includes('quantity')&&
    (!Number.isSafeInteger(receipt.unitPrice*receipt.quantity)||receipt.totalPrice!==receipt.unitPrice*receipt.quantity))errors.push('totalPrice');
  const expectedFingerprint=canonicalTradeFingerprint(receipt);
  if(typeof receipt.fingerprint!=='string'||receipt.fingerprint!==expectedFingerprint)errors.push('fingerprint');
  if(typeof receipt.integrityFingerprint!=='string'||receipt.integrityFingerprint!==canonicalReceiptIntegrityFingerprint(receipt))
    errors.push('integrityFingerprint');
  return [...new Set(errors)];
}

/**
 * Consumes the exact canonical projection vocabulary emitted by
 * PR #179 merchant-ledger.mjs::assessTradeKernelResult().
 * Career never upgrades caller assertions into VERIFIED/COMMITTED evidence.
 */
export function assessMerchantCareerTransactionEvidence(agent,evidence){
  if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))return {status:UNKNOWN,reason:'transaction-evidence'};
  if(evidence.state!=='SAT'){
    if(evidence.state==='VIOL')return {status:VIOL,reason:evidence.reason??'transaction-evidence'};
    return {status:UNKNOWN,reason:'transaction-evidence'};
  }
  const receiptErrors=validateCanonicalCommittedReceipt(evidence.receipt);
  if(receiptErrors.length)return {status:VIOL,reason:'trade-receipt',errors:receiptErrors};
  const receipt=evidence.receipt;
  if(receipt.buyerId!==agent?.id&&receipt.sellerId!==agent?.id)
    return {status:VIOL,reason:'merchant-not-party',receipt};
  if(evidence.duplicate===true)return {status:SAT,reason:'canonical-duplicate',duplicate:true,receipt};
  if(evidence.duplicate!==false)return {status:UNKNOWN,reason:'duplicate-status',receipt};
  if(evidence.verification!=='VERIFIED')
    return {status:evidence.verification===undefined?UNKNOWN:VIOL,reason:'verification',receipt};
  if(evidence.commitStatus!=='COMMITTED')
    return {status:evidence.commitStatus===undefined?UNKNOWN:VIOL,reason:'commit-status',receipt};
  return {status:SAT,reason:'verified-committed',duplicate:false,receipt};
}

/**
 * Progression consumes canonical committed transaction projection only.
 * Trade Kernel/canonical transaction authority owns transaction identity,
 * commit/replay status and parties. Career never determines uniqueness itself.
 */
export function noteVerifiedCommittedMerchantTransaction(agent,evidence){
  const before=merchantProgressionSnapshot(agent);
  const skip=(status,reason,extra={})=>({counted:false,status,reason,...before,...extra});
  if(!agent||typeof agent!=='object'||Array.isArray(agent))return skip(UNKNOWN,'agent');
  if(agent.profession!=='merchant')return skip(VIOL,'profession');
  if(validateMerchantProgression(agent).length)return skip(UNKNOWN,'progression-state');

  const assessed=assessMerchantCareerTransactionEvidence(agent,evidence);
  if(assessed.status!==SAT)return skip(assessed.status,assessed.reason,{errors:assessed.errors});
  if(assessed.duplicate===true)return skip(SAT,'canonical-duplicate',{transactionId:assessed.receipt.transactionId});

  if(agent.merchantTransactions===undefined){
    agent.merchantTransactions=0;
    agent.merchantExperience=0;
  }
  agent.merchantTransactions+=1;
  agent.merchantExperience+=1;
  return {counted:true,status:SAT,reason:'verified-committed',transactionId:assessed.receipt.transactionId,...merchantProgressionSnapshot(agent)};
}
