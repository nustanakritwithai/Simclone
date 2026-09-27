/** Shared pure action prediction evidence for VAL3 read model and VAL9 receipts. */
import {RULES,RESOURCE_ACTIONS} from './survival.mjs?v=0.5.0';

const freeze=x=>Object.freeze(x);

export function predictionRevalidation(task){
  if(!task)return 'NONE';
  if(RESOURCE_ACTIONS[task.kind])return 'RESOURCE_AT_TARGET';
  if(task.kind==='BUILD'&&task.placement)return 'BUILD_PLACEMENT';
  if(task.kind==='BUILD')return 'BUILD_TARGET';
  if(task.kind==='CRAFT'||task.kind==='PROCESS')return 'RUST_ORDER';
  if(task.kind==='EAT'||task.kind==='REST')return 'SURVIVAL_ACTION';
  if(task.kind==='EXPLORE')return 'EXPLORE';
  return 'NONE';
}

export function predictionInterruptionNow(agent,task){
  if(!task)return null;
  if(agent.satiety<RULES.hungry&&!['EAT','FORAGE'].includes(task.kind))return 'HUNGER';
  if(agent.energy<RULES.exhausted&&agent.satiety>=RULES.hungry&&task.kind!=='REST')return 'ENERGY';
  return null;
}

export function actionPredictionEvidence(agent,task,selectedTrace=null){
  if(!task)return null;
  const remainingRouteSteps=Array.isArray(task.path)?task.path.length:0;
  const currentMoveProgress=remainingRouteSteps>0?Math.max(0,Math.min(RULES.moveTicks-1,Number(agent?.moveTick)||0)):0;
  const minimumTravelTicks=Math.max(0,remainingRouteSteps*RULES.moveTicks-currentMoveProgress);
  return freeze({
    taskKind:String(task.kind),
    targetId:Number.isSafeInteger(task.targetId)?task.targetId:null,
    remainingRouteSteps,
    moveTicksPerStep:RULES.moveTicks,
    currentMoveProgress,
    minimumTravelTicks,
    revalidate:predictionRevalidation(task),
    interruptionNow:predictionInterruptionNow(agent,task),
    selectedScore:selectedTrace&&Number.isFinite(selectedTrace.score)?selectedTrace.score:null,
    traceSource:selectedTrace?'agent.trace:selected':'UNKNOWN'
  });
}
