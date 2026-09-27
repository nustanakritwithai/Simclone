/** VAL3 — deterministic read-only prediction shadow for the current authoritative task. */
import {isIndependent} from '../individual-resources.mjs?v=0.5.0';
import {executablePlanSnapshot} from './executable-plan-view.mjs';
import {actionPredictionEvidence} from '../action-prediction-evidence.mjs?v=0.5.0';

export const ACTION_PREDICTION_VERSION='VAL3-0.1';

const freeze=x=>Object.freeze(x);

function selectedTrace(agent){
  const task=agent?.task;if(!task)return null;
  const trace=Array.isArray(agent.trace)?agent.trace:[];
  const targetId=task.targetId??null;
  return trace.find(c=>c.status==='selected'&&c.kind===task.kind&&(c.targetId??null)===targetId)
    ??trace.find(c=>c.status==='selected'&&c.kind===task.kind)
    ??null;
}

export function actionPredictionSnapshot(state,agentId){
  if(!isIndependent(state))return null;
  const agent=state?.agents?.find(a=>a.id===Number(agentId)&&a.alive);if(!agent)return null;
  const task=agent.task??null,plan=executablePlanSnapshot(state,agent.id);
  if(!task)return freeze({
    version:ACTION_PREDICTION_VERSION,agentId:agent.id,evidence:'NO_TASK',
    prediction:null,planId:plan?.plan?.planId??null
  });
  const trace=selectedTrace(agent);
  return freeze({
    version:ACTION_PREDICTION_VERSION,
    agentId:agent.id,
    evidence:trace?'PREDICTABLE':'TRACE_UNKNOWN',
    planId:plan?.plan?.planId??null,
    prediction:actionPredictionEvidence(agent,task,trace)
  });
}
