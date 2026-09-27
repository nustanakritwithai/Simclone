/** VAL5 — deterministic read-only outcome learning evidence shadow. */
import {isIndependent} from '../individual-resources.mjs?v=0.5.0';
import {actionPredictionSnapshot} from './action-prediction.mjs';
import {actionOutcomeVerificationSnapshot} from './action-outcome-verification.mjs';

export const OUTCOME_LEARNING_SHADOW_VERSION='VAL5-0.1';
export const PREDICTION_HISTORY_EVIDENCE='NOT_RETAINED';

const PRODUCTIVE_KINDS=Object.freeze(['FORAGE','WOODCUT','MINE','BUILD']);
const PRODUCTIVE_SET=new Set(PRODUCTIVE_KINDS);
const freeze=x=>Object.freeze(x);

function retainedOutcomes(agent){
  const lessons=Array.isArray(agent?.planning?.lessons)?agent.planning.lessons:[];
  return freeze(lessons
    .filter(l=>PRODUCTIVE_SET.has(l?.kind))
    .map(l=>freeze({
      tick:Number.isSafeInteger(l.tick)?l.tick:null,
      kind:String(l.kind),
      targetId:Number.isSafeInteger(l.targetId)?l.targetId:null,
      outcome:String(l.outcome??'UNKNOWN'),
      amount:Number.isFinite(l.amount)?l.amount:null
    })));
}

function aggregate(samples){
  const result=[];
  for(const kind of PRODUCTIVE_KINDS){
    const xs=samples.filter(x=>x.kind===kind);
    if(!xs.length)continue;
    result.push(freeze({
      kind,
      sampleCount:xs.length,
      satCount:xs.filter(x=>x.outcome==='SAT').length,
      violCount:xs.filter(x=>x.outcome==='VIOL').length,
      unknownCount:xs.filter(x=>!['SAT','VIOL'].includes(x.outcome)).length,
      totalAmount:xs.reduce((sum,x)=>sum+(Number.isFinite(x.amount)?x.amount:0),0),
      lastTick:xs.reduce((max,x)=>Number.isSafeInteger(x.tick)?Math.max(max,x.tick):max,-1)
    }));
  }
  return freeze(result);
}

function livePredictionContext(view){
  if(!view)return null;
  return freeze({
    evidence:String(view.evidence??'UNKNOWN'),
    planId:view.planId??null,
    taskKind:view.prediction?.taskKind??null,
    targetId:view.prediction?.targetId??null,
    minimumTravelTicks:Number.isFinite(view.prediction?.minimumTravelTicks)?view.prediction.minimumTravelTicks:null,
    revalidate:view.prediction?.revalidate??null
  });
}

function currentOutcomeContext(view){
  if(!view)return null;
  return freeze({
    evidence:String(view.evidence??'UNKNOWN'),
    planId:view.verification?.planId??null,
    taskKind:view.verification?.taskKind??null,
    targetId:view.verification?.targetId??null,
    result:view.verification?.result??null,
    updatedTick:Number.isSafeInteger(view.verification?.updatedTick)?view.verification.updatedTick:null
  });
}

export function outcomeLearningShadowSnapshot(state,agentId){
  if(!isIndependent(state))return null;
  const agent=state?.agents?.find(a=>a.id===Number(agentId)&&a.alive);
  if(!agent)return null;

  const samples=retainedOutcomes(agent);
  const prediction=actionPredictionSnapshot(state,agent.id);
  const verification=actionOutcomeVerificationSnapshot(state,agent.id);
  const evidence=verification?.evidence==='EVIDENCE_CONFLICT'
    ?'EVIDENCE_CONFLICT'
    :(samples.length?'OUTCOME_EVIDENCE':'NO_OUTCOME_EVIDENCE');

  return freeze({
    version:OUTCOME_LEARNING_SHADOW_VERSION,
    agentId:agent.id,
    evidence,
    predictionHistory:PREDICTION_HISTORY_EVIDENCE,
    livePrediction:livePredictionContext(prediction),
    currentOutcome:currentOutcomeContext(verification),
    outcomes:samples,
    byKind:aggregate(samples)
  });
}
