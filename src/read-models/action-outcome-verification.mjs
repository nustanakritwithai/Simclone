/** VAL4 — deterministic read-only verification shadow over retained productive plan outcomes. */
import {isIndependent} from '../individual-resources.mjs?v=0.5.0';
import {executablePlanSnapshot} from './executable-plan-view.mjs';

export const ACTION_OUTCOME_VERIFICATION_VERSION='VAL4-0.1';

const PRODUCTIVE_KINDS=new Set(['FORAGE','WOODCUT','MINE','BUILD']);
const freeze=x=>Object.freeze(x);
const sameTarget=(a,b)=>(a??null)===(b??null);

function matchingLesson(agent,plan){
  const lessons=Array.isArray(agent?.planning?.lessons)?agent.planning.lessons:[];
  for(let i=lessons.length-1;i>=0;i--){
    const lesson=lessons[i];
    if(lesson?.tick===plan.updatedTick&&lesson?.kind===plan.kind&&sameTarget(lesson?.targetId,plan.targetId))return lesson;
  }
  return null;
}

function frozenLesson(lesson){
  if(!lesson)return null;
  return freeze({
    tick:Number.isSafeInteger(lesson.tick)?lesson.tick:null,
    kind:String(lesson.kind??'UNKNOWN'),
    targetId:Number.isSafeInteger(lesson.targetId)?lesson.targetId:null,
    outcome:String(lesson.outcome??'UNKNOWN'),
    amount:Number.isFinite(lesson.amount)?lesson.amount:null
  });
}

function snapshot(plan,result='UNKNOWN',lesson=null){
  return freeze({
    planId:plan.planId,
    taskKind:plan.kind,
    targetId:plan.targetId,
    status:plan.status,
    outcome:plan.outcome,
    attempt:plan.attempt,
    maxReplans:plan.maxReplans,
    updatedTick:plan.updatedTick,
    result,
    lesson:frozenLesson(lesson)
  });
}

export function actionOutcomeVerificationSnapshot(state,agentId){
  if(!isIndependent(state))return null;
  const agent=state?.agents?.find(a=>a.id===Number(agentId)&&a.alive);
  if(!agent)return null;

  const planView=executablePlanSnapshot(state,agent.id);
  if(planView?.evidence==='NO_PLAN')return freeze({
    version:ACTION_OUTCOME_VERIFICATION_VERSION,
    agentId:agent.id,
    evidence:'NO_PLAN',
    verification:null
  });
  if(planView?.evidence!=='VAL2')return freeze({
    version:ACTION_OUTCOME_VERIFICATION_VERSION,
    agentId:agent.id,
    evidence:'LEGACY_PLAN',
    verification:null
  });

  const plan=planView.plan;
  if(!PRODUCTIVE_KINDS.has(plan.kind))return freeze({
    version:ACTION_OUTCOME_VERIFICATION_VERSION,
    agentId:agent.id,
    evidence:'OUT_OF_SCOPE',
    verification:snapshot(plan)
  });

  if(plan.status==='active'||plan.status==='interrupted')return freeze({
    version:ACTION_OUTCOME_VERIFICATION_VERSION,
    agentId:agent.id,
    evidence:'PENDING',
    verification:snapshot(plan)
  });

  const lesson=matchingLesson(agent,plan);
  if(!lesson)return freeze({
    version:ACTION_OUTCOME_VERIFICATION_VERSION,
    agentId:agent.id,
    evidence:'OUTCOME_UNKNOWN',
    verification:snapshot(plan)
  });

  const verifiedSat=plan.status==='completed'&&
    plan.outcome==='SAT:productive-outcome'&&
    lesson.outcome==='SAT'&&
    Number.isFinite(lesson.amount)&&lesson.amount>0;

  const verifiedViol=plan.status==='failed'&&
    plan.outcome==='VIOL:replan-budget-exhausted'&&
    Number.isInteger(plan.attempt)&&plan.attempt===plan.maxReplans&&
    lesson.outcome==='VIOL'&&
    lesson.amount===0;

  if(verifiedSat||verifiedViol)return freeze({
    version:ACTION_OUTCOME_VERIFICATION_VERSION,
    agentId:agent.id,
    evidence:'VERIFIED',
    verification:snapshot(plan,verifiedSat?'SAT':'VIOL',lesson)
  });

  return freeze({
    version:ACTION_OUTCOME_VERIFICATION_VERSION,
    agentId:agent.id,
    evidence:'EVIDENCE_CONFLICT',
    verification:snapshot(plan,'UNKNOWN',lesson)
  });
}
