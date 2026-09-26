/** VAL2.1 — read-only adapter over the existing personal planning authority. */
import {isIndependent} from '../individual-resources.mjs?v=0.5.0';

export const EXECUTABLE_PLAN_VIEW_VERSION='VAL2.1-0.1';

const freeze=x=>Object.freeze(x);
const integerOrNull=v=>Number.isInteger(v)?v:null;

export function executablePlanSnapshot(state,agentId){
  if(!isIndependent(state))return null;
  const agent=state?.agents?.find(a=>a.id===Number(agentId)&&a.alive);
  if(!agent)return null;
  const goal=agent.planning?.goal??null;
  if(!goal)return freeze({
    version:EXECUTABLE_PLAN_VIEW_VERSION,
    agentId:agent.id,
    evidence:'NO_PLAN',
    plan:null
  });
  const isVal2=goal.planVersion==='VAL2-0.1'&&typeof goal.planId==='string'&&goal.step;
  return freeze({
    version:EXECUTABLE_PLAN_VIEW_VERSION,
    agentId:agent.id,
    evidence:isVal2?'VAL2':'LEGACY_PLAN',
    plan:freeze({
      goal:String(goal.goal??'UNKNOWN'),
      status:String(goal.status??'UNKNOWN'),
      outcome:String(goal.outcome??'UNKNOWN'),
      targetId:Number.isSafeInteger(goal.targetId)?goal.targetId:null,
      x:integerOrNull(goal.x),
      y:integerOrNull(goal.y),
      kind:String(goal.kind??'UNKNOWN'),
      phase:String(goal.phase??'UNKNOWN'),
      startedTick:integerOrNull(goal.startedTick),
      updatedTick:integerOrNull(goal.updatedTick),
      planId:isVal2?goal.planId:null,
      step:isVal2?freeze({kind:String(goal.step.kind),phase:String(goal.step.phase)}):null,
      attempt:isVal2?integerOrNull(goal.attempt):null,
      maxReplans:isVal2?integerOrNull(goal.maxReplans):null
    })
  });
}
