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
export const MERCHANT_TRANSACTION_RECEIPT_LIMIT=32;

const SAT='SAT',VIOL='VIOL',UNKNOWN='UNKNOWN';
const nonEmptyString=value=>typeof value==='string'&&value.length>0&&value.length<=120;
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

export function merchantProgressionSnapshot(agent){
  return {
    merchantTransactions:Number.isInteger(agent?.merchantTransactions)&&agent.merchantTransactions>=0?agent.merchantTransactions:0,
    merchantExperience:Number.isInteger(agent?.merchantExperience)&&agent.merchantExperience>=0?agent.merchantExperience:0,
  };
}

export function validateMerchantProgression(agent){
  if(agent?.merchantRealizedProfit!==undefined)return ['Merchant monetary duplicate'];
  const fields=['merchantTransactions','merchantExperience','merchantTransactionReceipts'];
  const present=fields.some(key=>agent?.[key]!==undefined);
  if(!present)return [];
  if(!Number.isInteger(agent?.merchantTransactions)||agent.merchantTransactions<0)return ['Merchant progression'];
  if(!Number.isInteger(agent?.merchantExperience)||agent.merchantExperience<0)return ['Merchant progression'];
  if(!Array.isArray(agent?.merchantTransactionReceipts)||agent.merchantTransactionReceipts.length>MERCHANT_TRANSACTION_RECEIPT_LIMIT)return ['Merchant progression'];
  const ids=new Set();
  for(const id of agent.merchantTransactionReceipts){
    if(!nonEmptyString(id)||ids.has(id))return ['Merchant progression'];
    ids.add(id);
  }
  return [];
}

/**
 * Progression hook only. It consumes already-authoritative transaction identity;
 * it does not consume or store Revenue/COGS/Profit and never becomes accounting authority.
 */
export function noteVerifiedCommittedMerchantTransaction(agent,fact){
  const before=merchantProgressionSnapshot(agent);
  const skip=(status,reason)=>({counted:false,status,reason,...before});
  if(!agent||typeof agent!=='object'||Array.isArray(agent))return skip(UNKNOWN,'agent');
  if(agent.profession!=='merchant')return skip(VIOL,'profession');
  if(validateMerchantProgression(agent).length)return skip(UNKNOWN,'progression-state');
  if(fact?.verified!==true)return skip(fact?.verified===false?VIOL:UNKNOWN,'verified');
  if(fact?.committed!==true)return skip(fact?.committed===false?VIOL:UNKNOWN,'committed');
  if(!nonEmptyString(fact?.transactionId))return skip(UNKNOWN,'transaction-id');

  if(Array.isArray(agent.merchantTransactionReceipts)&&agent.merchantTransactionReceipts.includes(fact.transactionId))
    return skip(SAT,'replay');

  if(agent.merchantTransactions===undefined){
    agent.merchantTransactions=0;
    agent.merchantExperience=0;
    agent.merchantTransactionReceipts=[];
  }
  agent.merchantTransactions+=1;
  agent.merchantExperience+=1;
  agent.merchantTransactionReceipts.push(fact.transactionId);
  while(agent.merchantTransactionReceipts.length>MERCHANT_TRANSACTION_RECEIPT_LIMIT)agent.merchantTransactionReceipts.shift();

  return {counted:true,status:SAT,reason:'verified-committed',...merchantProgressionSnapshot(agent)};
}
