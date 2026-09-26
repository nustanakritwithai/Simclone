/** VAL3 — deterministic read-only prediction shadow for the current authoritative task. */
import {isIndependent} from '../individual-resources.mjs?v=0.5.0';
import {RULES,RESOURCE_ACTIONS} from '../survival.mjs?v=0.5.0';
import {executablePlanSnapshot} from './executable-plan-view.mjs';

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

function revalidationFor(task){
  if(!task)return 'NONE';
  if(RESOURCE_ACTIONS[task.kind])return 'RESOURCE_AT_TARGET';
  if(task.kind==='BUILD'&&task.placement)return 'BUILD_PLACEMENT';
  if(task.kind==='BUILD')return 'BUILD_TARGET';
  if(task.kind==='CRAFT'||task.kind==='PROCESS')return 'RUST_ORDER';
  if(task.kind==='EAT'||task.kind==='REST')return 'SURVIVAL_ACTION';
  if(task.kind==='EXPLORE')return 'EXPLORE';
  return 'NONE';
}

function interruptionNow(agent,task){
  if(!task)return null;
  if(agent.satiety<RULES.hungry&&!['EAT','FORAGE'].includes(task.kind))return 'HUNGER';
  if(agent.energy<RULES.exhausted&&agent.satiety>=RULES.hungry&&task.kind!=='REST')return 'ENERGY';
  return null;
}

export function actionPredictionSnapshot(state,agentId){
  if(!isIndependent(state))return null;
  const agent=state?.agents?.find(a=>a.id===Number(agentId)&&a.alive);if(!agent)return null;
  const task=agent.task??null,plan=executablePlanSnapshot(state,agent.id);
  if(!task)return freeze({
    version:ACTION_PREDICTION_VERSION,agentId:agent.id,evidence:'NO_TASK',
    prediction:null,planId:plan?.plan?.planId??null
  });
  const trace=selectedTrace(agent),remainingSteps=Array.isArray(task.path)?task.path.length:0;
  const currentMoveProgress=remainingSteps>0?Math.max(0,Math.min(RULES.moveTicks-1,Number(agent.moveTick)||0)):0;
  const minimumTravelTicks=Math.max(0,remainingSteps*RULES.moveTicks-currentMoveProgress);
  return freeze({
    version:ACTION_PREDICTION_VERSION,
    agentId:agent.id,
    evidence:trace?'PREDICTABLE':'TRACE_UNKNOWN',
    planId:plan?.plan?.planId??null,
    prediction:freeze({
      taskKind:String(task.kind),
      targetId:Number.isSafeInteger(task.targetId)?task.targetId:null,
      remainingRouteSteps:remainingSteps,
      moveTicksPerStep:RULES.moveTicks,
      currentMoveProgress,
      minimumTravelTicks,
      revalidate:revalidationFor(task),
      interruptionNow:interruptionNow(agent,task),
      selectedScore:trace&&Number.isFinite(trace.score)?trace.score:null,
      traceSource:trace?'agent.trace:selected':'UNKNOWN'
    })
  });
}
