/** VAL5 — deterministic read-only outcome learning evidence shadow. */
import {isIndependent} from '../individual-resources.mjs?v=0.5.0';
import {actionPredictionSnapshot} from './action-prediction.mjs';
import {actionOutcomeVerificationSnapshot} from './action-outcome-verification.mjs';
import {productiveOutcomeEvidenceSnapshot} from '../outcome-learning-evidence.mjs?v=0.5.0';

export const OUTCOME_LEARNING_SHADOW_VERSION='VAL5-0.2';
export const PREDICTION_HISTORY_EVIDENCE='RETAINED_VAL9';

const freeze=x=>Object.freeze(x);

function retainedPredictionContext(agent){
  const rows=Array.isArray(agent?.planning?.predictions)?agent.planning.predictions:[];
  const latest=rows.at(-1)??null;
  return freeze({
    count:rows.length,
    latestReceiptId:latest?.receiptId??null,
    latestTick:Number.isSafeInteger(latest?.tick)?latest.tick:null
  });
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

  const retained=productiveOutcomeEvidenceSnapshot(agent),samples=retained.outcomes;
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
    predictionReceipts:retainedPredictionContext(agent),
    livePrediction:livePredictionContext(prediction),
    currentOutcome:currentOutcomeContext(verification),
    outcomes:samples,
    byKind:retained.byKind
  });
}
