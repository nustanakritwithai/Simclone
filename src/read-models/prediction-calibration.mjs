/** CV1 — read-only calibration of retained VAL9 prediction receipts against retained outcomes. */
import {isIndependent} from '../individual-resources.mjs?v=0.5.0';
import {PRODUCTIVE_OUTCOME_KINDS} from '../outcome-learning-evidence.mjs?v=0.5.0';

export const PREDICTION_CALIBRATION_VERSION='CV1-0.1';
export const PREDICTION_CALIBRATION_METRIC='LATENCY_OVER_MINIMUM_TRAVEL';

const PRODUCTIVE_SET=new Set(PRODUCTIVE_OUTCOME_KINDS);
const freeze=x=>Object.freeze(x);
const sameTarget=(a,b)=>(a??null)===(b??null);
const mean=xs=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:0;

function linkedSample(lesson,receipts){
  if(!lesson||!PRODUCTIVE_SET.has(lesson.kind)||typeof lesson.planId!=='string')return null;
  let receipt=null;
  for(let i=receipts.length-1;i>=0;i--){
    const row=receipts[i];
    if(row?.planId===lesson.planId&&row?.taskKind===lesson.kind&&sameTarget(row?.targetId,lesson.targetId)&&
      Number.isSafeInteger(row.tick)&&Number.isSafeInteger(lesson.tick)&&row.tick<=lesson.tick){
      receipt=row;break;
    }
  }
  if(!receipt)return null;
  const elapsedTicks=lesson.tick-receipt.tick;
  const minimumTravelTicks=Number(receipt.minimumTravelTicks);
  const latencySlackTicks=elapsedTicks-minimumTravelTicks;
  return freeze({
    planId:lesson.planId,
    receiptId:String(receipt.receiptId??'UNKNOWN'),
    receiptTick:receipt.tick,
    outcomeTick:lesson.tick,
    kind:String(lesson.kind),
    targetId:Number.isSafeInteger(lesson.targetId)?lesson.targetId:null,
    outcome:String(lesson.outcome??'UNKNOWN'),
    amount:Number.isFinite(lesson.amount)?lesson.amount:null,
    elapsedTicks,
    minimumTravelTicks,
    latencySlackTicks,
    interruptionNow:receipt.interruptionNow??null,
    evidence:latencySlackTicks<0?'EVIDENCE_CONFLICT':'LINKED'
  });
}

function aggregate(samples){
  const rows=[];
  for(const kind of PRODUCTIVE_OUTCOME_KINDS){
    const xs=samples.filter(x=>x.kind===kind);
    if(!xs.length)continue;
    const elapsed=xs.map(x=>x.elapsedTicks),minimum=xs.map(x=>x.minimumTravelTicks),slack=xs.map(x=>x.latencySlackTicks);
    rows.push(freeze({
      kind,
      sampleCount:xs.length,
      satCount:xs.filter(x=>x.outcome==='SAT').length,
      violCount:xs.filter(x=>x.outcome==='VIOL').length,
      unknownCount:xs.filter(x=>!['SAT','VIOL'].includes(x.outcome)).length,
      conflictCount:xs.filter(x=>x.evidence==='EVIDENCE_CONFLICT').length,
      interruptedAtSelectionCount:xs.filter(x=>x.interruptionNow!==null).length,
      meanElapsedTicks:mean(elapsed),
      meanMinimumTravelTicks:mean(minimum),
      meanLatencySlackTicks:mean(slack),
      maxLatencySlackTicks:Math.max(...slack)
    }));
  }
  return freeze(rows);
}

export function predictionCalibrationSnapshot(state,agentId){
  if(!isIndependent(state))return null;
  const agent=state?.agents?.find(a=>a.id===Number(agentId)&&a.alive);if(!agent)return null;
  const lessons=(Array.isArray(agent.planning?.lessons)?agent.planning.lessons:[])
    .filter(l=>PRODUCTIVE_SET.has(l?.kind)&&typeof l?.planId==='string');
  const receipts=Array.isArray(agent.planning?.predictions)?agent.planning.predictions:[];
  const linked=[],unlinked=[];
  for(const lesson of lessons){
    const sample=linkedSample(lesson,receipts);
    if(sample)linked.push(sample);
    else unlinked.push(freeze({
      planId:lesson.planId,kind:String(lesson.kind),targetId:Number.isSafeInteger(lesson.targetId)?lesson.targetId:null,
      tick:Number.isSafeInteger(lesson.tick)?lesson.tick:null,outcome:String(lesson.outcome??'UNKNOWN')
    }));
  }
  const conflictCount=linked.filter(x=>x.evidence==='EVIDENCE_CONFLICT').length;
  const evidence=conflictCount>0?'EVIDENCE_CONFLICT'
    :lessons.length===0?'NO_OUTCOME_EVIDENCE'
    :linked.length===0?'RECEIPTS_MISSING'
    :'CALIBRATION_EVIDENCE';
  return freeze({
    version:PREDICTION_CALIBRATION_VERSION,
    agentId:agent.id,
    evidence,
    metric:PREDICTION_CALIBRATION_METRIC,
    accuracy:'NOT_ESTIMATED',
    linked:freeze(linked),
    unlinked:freeze(unlinked),
    linkedSampleCount:linked.length,
    unlinkedOutcomeCount:unlinked.length,
    conflictCount,
    byKind:aggregate(linked)
  });
}
