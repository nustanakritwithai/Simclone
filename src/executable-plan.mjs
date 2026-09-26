/** VAL2 — bounded executable-plan continuity over the existing scheduler/executor. */
import {isIndependent} from './individual-resources.mjs?v=0.5.0';

export const EXECUTABLE_PLAN_VERSION='VAL2-0.1';
export const EXECUTABLE_PLAN_LIMITS=Object.freeze({
  maxReplans:3,
  maxSteps:4,
  timeoutTicks:180,
  abortCooldownTicks:60,
  continuationBonus:18
});

const PLAN_ACTIONS=new Set(['FORAGE','WOODCUT','MINE','BUILD','EXPLORE']);
const PLAN_STATUS=new Set(['ACTIVE','REPLAN_REQUESTED','COMPLETED','ABORTED']);
const STEP_STATUS=new Set(['ACTIVE','INTERRUPTED','COMPLETED','INVALIDATED','TIMEOUT']);
const TERMINAL_PLAN=new Set(['COMPLETED','ABORTED']);
const GOAL_BY_KIND=Object.freeze({
  FORAGE:'secure-food',
  WOODCUT:'collect-wood',
  MINE:'collect-stone',
  BUILD:'finish-shelter',
  EXPLORE:'explore'
});
const GOALS=new Set(['secure-food','collect-wood','collect-stone','finish-shelter','explore']);
const clone=x=>JSON.parse(JSON.stringify(x));

const choiceAction=choice=>String(choice?.kind??'');
const choicePurpose=choice=>choice?.purposeKind??null;
const choiceTarget=choice=>choice?.targetId??null;
const planEligible=choice=>PLAN_ACTIONS.has(choiceAction(choice));

function goalFor(agent,choice){
  const retained=agent?.planning?.goal;
  const effective=choicePurpose(choice)??choiceAction(choice);
  if(retained&&GOALS.has(retained.goal)&&retained.kind===effective)return retained.goal;
  return GOAL_BY_KIND[effective]??GOAL_BY_KIND[choiceAction(choice)]??'explore';
}
function stepMatches(step,choice){
  if(!step||!choice)return false;
  return step.actionType===choiceAction(choice)&&
    (step.purposeKind??null)===(choicePurpose(choice)??null)&&
    (step.targetId??null)===(choiceTarget(choice)??null);
}
function currentStep(plan){
  return plan?.steps?.find(s=>s.stepId===plan.currentStepId)??null;
}
function boundedPush(plan,step){
  plan.steps.push(step);
  while(plan.steps.length>EXECUTABLE_PLAN_LIMITS.maxSteps)plan.steps.shift();
}
function makeStep(state,agent,choice,index){
  return {
    stepId:'val2-step:'+agent.id+':'+state.tick+':'+index,
    actionType:choiceAction(choice),
    purposeKind:choicePurpose(choice),
    targetId:choiceTarget(choice),
    x:Number.isInteger(choice?.x)?choice.x:null,
    y:Number.isInteger(choice?.y)?choice.y:null,
    status:'ACTIVE',
    attemptCount:1,
    createdTick:state.tick,
    lastValidatedTick:state.tick,
    timeoutTick:state.tick+EXECUTABLE_PLAN_LIMITS.timeoutTicks,
    lastFailureReason:null
  };
}
function makePlan(state,agent,choice){
  const goal=goalFor(agent,choice),step=makeStep(state,agent,choice,1);
  return {
    version:EXECUTABLE_PLAN_VERSION,
    planId:'val2:'+agent.id+':'+state.tick+':'+goal,
    goal,
    status:'ACTIVE',
    createdTick:state.tick,
    updatedTick:state.tick,
    replanCount:0,
    maxReplans:EXECUTABLE_PLAN_LIMITS.maxReplans,
    abortUntilTick:null,
    currentStepId:step.stepId,
    steps:[step]
  };
}
function invalidate(state,agent,reason,{timeout=false}={}){
  const plan=agent?.executablePlan;
  if(!plan||TERMINAL_PLAN.has(plan.status))return {changed:false,plan};
  const step=currentStep(plan);
  if(step&&!['INVALIDATED','TIMEOUT','COMPLETED'].includes(step.status)){
    step.status=timeout?'TIMEOUT':'INVALIDATED';
    step.lastValidatedTick=state.tick;
    step.lastFailureReason=String(reason||'planned-step-invalid').slice(0,96);
  }
  if(plan.replanCount>=plan.maxReplans){
    plan.status='ABORTED';
    plan.abortUntilTick=state.tick+EXECUTABLE_PLAN_LIMITS.abortCooldownTicks;
  }else{
    plan.replanCount++;
    plan.status=plan.replanCount>=plan.maxReplans?'ABORTED':'REPLAN_REQUESTED';
    if(plan.status==='ABORTED')plan.abortUntilTick=state.tick+EXECUTABLE_PLAN_LIMITS.abortCooldownTicks;
  }
  plan.updatedTick=state.tick;
  return {changed:true,plan};
}

export function executablePlanFor(agent){
  return agent?.executablePlan??null;
}

export function syncExecutablePlan(state,agent){
  if(!isIndependent(state)||!agent?.alive)return null;
  const plan=agent.executablePlan;
  if(!plan||TERMINAL_PLAN.has(plan.status))return plan??null;
  const step=currentStep(plan);
  if(!step)return invalidate(state,agent,'missing-current-step').plan;
  if(state.tick>step.timeoutTick)return invalidate(state,agent,'step-timeout',{timeout:true}).plan;
  const retained=agent.planning?.goal;
  if(retained&&retained.goal===plan.goal){
    if(retained.status==='completed'){
      step.status='COMPLETED';step.lastValidatedTick=state.tick;step.lastFailureReason=null;
      plan.status='COMPLETED';plan.updatedTick=state.tick;return plan;
    }
    if(retained.status==='failed')return invalidate(state,agent,retained.outcome||'personal-goal-failed').plan;
    if(retained.status==='interrupted'&&step.status==='ACTIVE'){
      step.status='INTERRUPTED';step.lastFailureReason=retained.outcome||'survival-interruption';plan.updatedTick=state.tick;
    }
  }
  return plan;
}

export function executablePlanContinuationFactor(state,agent,choice){
  if(!isIndependent(state)||!agent?.alive||!planEligible(choice))return {bonus:0,reason:'ineligible'};
  const plan=agent.executablePlan,step=currentStep(plan);
  if(!plan||!['ACTIVE','REPLAN_REQUESTED'].includes(plan.status)||!step||!['ACTIVE','INTERRUPTED'].includes(step.status))
    return {bonus:0,reason:'no-active-plan'};
  if(state.tick>step.timeoutTick)return {bonus:0,reason:'timeout'};
  if(!stepMatches(step,choice))return {bonus:0,reason:'different-step'};
  return {bonus:EXECUTABLE_PLAN_LIMITS.continuationBonus,reason:'continue-plan',planId:plan.planId,stepId:step.stepId};
}

export function reconcileExecutablePlanChoices(state,agent,choices=[]){
  if(!isIndependent(state)||!agent?.alive)return null;
  const plan=syncExecutablePlan(state,agent),step=currentStep(plan);
  if(!plan||TERMINAL_PLAN.has(plan.status)||!step)return plan??null;
  if(plan.status==='REPLAN_REQUESTED')return plan;
  const match=choices.find(c=>stepMatches(step,c)&&['candidate','reserved'].includes(c.status));
  if(match){
    step.lastValidatedTick=state.tick;
    if(step.status==='INTERRUPTED')step.status='ACTIVE';
    plan.updatedTick=state.tick;
    return plan;
  }
  return invalidate(state,agent,'planned-step-unavailable').plan;
}

export function acceptExecutablePlanChoice(state,agent,choice){
  if(!isIndependent(state)||!agent?.alive||!planEligible(choice))return agent?.executablePlan??null;
  const goal=goalFor(agent,choice),prior=agent.executablePlan;
  if(!prior){
    agent.executablePlan=makePlan(state,agent,choice);return agent.executablePlan;
  }
  if(prior.status==='ABORTED'&&prior.goal===goal&&Number(prior.abortUntilTick??0)>state.tick)return prior;
  if(TERMINAL_PLAN.has(prior.status)||prior.goal!==goal){
    agent.executablePlan=makePlan(state,agent,choice);return agent.executablePlan;
  }
  const step=currentStep(prior);
  if(stepMatches(step,choice)){
    step.status='ACTIVE';step.lastValidatedTick=state.tick;step.attemptCount++;
    prior.status='ACTIVE';prior.updatedTick=state.tick;return prior;
  }
  if(prior.status!=='REPLAN_REQUESTED')invalidate(state,agent,'selected-different-productive-step');
  if(prior.status==='ABORTED')return prior;
  const next=makeStep(state,agent,choice,prior.steps.length+1);
  boundedPush(prior,next);prior.currentStepId=next.stepId;prior.status='ACTIVE';prior.updatedTick=state.tick;
  return prior;
}

export function noteExecutablePlanInterruption(state,agent,task,reason='survival-interruption'){
  if(!isIndependent(state)||!agent?.executablePlan||!task)return null;
  const plan=agent.executablePlan,step=currentStep(plan);
  if(!step||TERMINAL_PLAN.has(plan.status)||!stepMatches(step,task))return plan;
  step.status='INTERRUPTED';step.lastValidatedTick=state.tick;step.lastFailureReason=String(reason).slice(0,96);
  plan.updatedTick=state.tick;return plan;
}

export function invalidateExecutablePlanTask(state,agent,task,reason='task-invalid'){
  if(!isIndependent(state)||!agent?.executablePlan||!task)return null;
  const step=currentStep(agent.executablePlan);
  if(!step||!stepMatches(step,task))return agent.executablePlan;
  return invalidate(state,agent,reason).plan;
}

export function abortExecutablePlan(state,agent,reason='aborted'){
  const plan=agent?.executablePlan;if(!plan||TERMINAL_PLAN.has(plan.status))return plan??null;
  const step=currentStep(plan);
  if(step&&!['COMPLETED','INVALIDATED','TIMEOUT'].includes(step.status)){
    step.status='INVALIDATED';step.lastValidatedTick=state.tick;step.lastFailureReason=String(reason).slice(0,96);
  }
  plan.status='ABORTED';plan.updatedTick=state.tick;plan.abortUntilTick=state.tick+EXECUTABLE_PLAN_LIMITS.abortCooldownTicks;
  return plan;
}

export function validateExecutablePlans(state){
  const errors=[];
  const tick=t=>Number.isSafeInteger(t)&&t>=0&&t<=state.tick;
  for(const agent of [...(state.agents??[]),...(state.archive??[])]){
    const p=agent?.executablePlan;if(p===undefined)continue;
    if(!p||p.version!==EXECUTABLE_PLAN_VERSION||typeof p.planId!=='string'||p.planId.length>160||
      !GOALS.has(p.goal)||!PLAN_STATUS.has(p.status)||!tick(p.createdTick)||!tick(p.updatedTick)||p.createdTick>p.updatedTick||
      !Number.isInteger(p.replanCount)||p.replanCount<0||p.replanCount>EXECUTABLE_PLAN_LIMITS.maxReplans||
      p.maxReplans!==EXECUTABLE_PLAN_LIMITS.maxReplans||
      !(p.abortUntilTick===null||(Number.isSafeInteger(p.abortUntilTick)&&p.abortUntilTick>=p.updatedTick))||
      !Array.isArray(p.steps)||p.steps.length<1||p.steps.length>EXECUTABLE_PLAN_LIMITS.maxSteps||
      typeof p.currentStepId!=='string'||!p.steps.some(s=>s.stepId===p.currentStepId)){
      errors.push('Executable plan');continue;
    }
    const ids=new Set();
    for(const s of p.steps){
      if(!s||typeof s.stepId!=='string'||s.stepId.length>180||ids.has(s.stepId)||!PLAN_ACTIONS.has(s.actionType)||
        !(s.purposeKind===null||['FORAGE','WOODCUT','MINE','BUILD'].includes(s.purposeKind))||
        !(s.targetId===null||Number.isSafeInteger(s.targetId))||
        !(s.x===null||Number.isInteger(s.x))||!(s.y===null||Number.isInteger(s.y))||
        !STEP_STATUS.has(s.status)||!Number.isInteger(s.attemptCount)||s.attemptCount<1||s.attemptCount>1000||
        !tick(s.createdTick)||!tick(s.lastValidatedTick)||!Number.isSafeInteger(s.timeoutTick)||s.timeoutTick<s.createdTick||
        !(s.lastFailureReason===null||(typeof s.lastFailureReason==='string'&&s.lastFailureReason.length<=96)))
        errors.push('Executable plan step');
      ids.add(s?.stepId);
    }
  }
  return [...new Set(errors)];
}

export function cloneExecutablePlan(agent){
  return agent?.executablePlan?clone(agent.executablePlan):null;
}
