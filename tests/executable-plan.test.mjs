import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore} from '../src/engine.mjs';
import {rememberPlanSelection} from '../src/personal-planning.mjs';
import {
  EXECUTABLE_PLAN_LIMITS,
  acceptExecutablePlanChoice,
  executablePlanContinuationFactor,
  noteExecutablePlanInterruption,
  reconcileExecutablePlanChoices,
  syncExecutablePlan,
  validateExecutablePlans
} from '../src/executable-plan.mjs';

function productiveFixture(kind='WOODCUT'){
  const s=createWorld(230926,{mode:'independent',worldProfile:'large'}),a=s.agents[0];
  const type={FORAGE:'food',WOODCUT:'wood',MINE:'stone'}[kind]??'wood';
  const n=s.nodes.find(n=>n.type===type&&n.amount>0);assert.ok(n);
  const choice={kind,targetId:n.id,x:n.x,y:n.y,status:'candidate'};
  rememberPlanSelection(s,a,choice);
  acceptExecutablePlanChoice(s,a,choice);
  return {s,a,n,choice};
}

test('VAL2 never creates plans or continuation factors in Legacy mode',()=>{
  const s=createWorld(42,{mode:'legacy'}),a=s.agents[0],choice={kind:'WOODCUT',targetId:1,x:1,y:1,status:'candidate'};
  assert.equal(acceptExecutablePlanChoice(s,a,choice),null);
  assert.equal(executablePlanContinuationFactor(s,a,choice).bonus,0);
  assert.equal(a.executablePlan,undefined);
});

test('VAL2 creates a bounded plan from retained personal goal and gives exact continuation bonus',()=>{
  const {s,a,choice}=productiveFixture();
  assert.equal(a.executablePlan.goal,'collect-wood');
  assert.equal(a.executablePlan.status,'ACTIVE');
  assert.equal(a.executablePlan.steps.length,1);
  assert.equal(executablePlanContinuationFactor(s,a,choice).bonus,EXECUTABLE_PLAN_LIMITS.continuationBonus);
  assert.equal(executablePlanContinuationFactor(s,a,{...choice,targetId:choice.targetId+999}).bonus,0);
  assert.deepEqual(validateExecutablePlans(s),[]);
});

test('VAL2 survival interruption preserves plan and does not consume replan budget',()=>{
  const {s,a,choice}=productiveFixture();
  const before=a.executablePlan.replanCount;
  noteExecutablePlanInterruption(s,a,choice,'hunger');
  assert.equal(a.executablePlan.status,'ACTIVE');
  assert.equal(a.executablePlan.steps.at(-1).status,'INTERRUPTED');
  assert.equal(a.executablePlan.replanCount,before);
  assert.equal(executablePlanContinuationFactor(s,a,choice).bonus,18);
});

test('VAL2 unavailable step requests bounded replan and replacement choice reuses the plan',()=>{
  const {s,a,choice}=productiveFixture();
  reconcileExecutablePlanChoices(s,a,[]);
  assert.equal(a.executablePlan.status,'REPLAN_REQUESTED');
  assert.equal(a.executablePlan.replanCount,1);
  const replacement={...choice,targetId:choice.targetId+1,x:choice.x+1};
  rememberPlanSelection(s,a,replacement);
  acceptExecutablePlanChoice(s,a,replacement);
  assert.equal(a.executablePlan.status,'ACTIVE');
  assert.equal(a.executablePlan.replanCount,1);
  assert.equal(a.executablePlan.steps.length,2);
});

test('VAL2 completed step advances within the same goal without consuming replan budget',async()=>{
  const {s,a,choice}=productiveFixture();
  const mod=await import('../src/executable-plan.mjs');
  mod.completeExecutablePlanStep(s,a,choice,{goalComplete:false});
  assert.equal(a.executablePlan.steps.at(-1).status,'COMPLETED');
  assert.equal(a.executablePlan.replanCount,0);
  const next={...choice,targetId:choice.targetId+77,x:choice.x+1};
  rememberPlanSelection(s,a,next);
  acceptExecutablePlanChoice(s,a,next);
  assert.equal(a.executablePlan.status,'ACTIVE');
  assert.equal(a.executablePlan.replanCount,0);
  assert.equal(a.executablePlan.steps.length,2);
});

test('VAL2 replan budget is bounded and exhaustion aborts the plan',()=>{
  const {s,a,choice}=productiveFixture();
  for(let i=0;i<3;i++){
    reconcileExecutablePlanChoices(s,a,[]);
    if(a.executablePlan.status==='ABORTED')break;
    const replacement={...choice,targetId:choice.targetId+100+i,x:choice.x+i+1};
    rememberPlanSelection(s,a,replacement);
    acceptExecutablePlanChoice(s,a,replacement);
  }
  reconcileExecutablePlanChoices(s,a,[]);
  assert.equal(a.executablePlan.status,'ABORTED');
  assert.equal(a.executablePlan.replanCount,EXECUTABLE_PLAN_LIMITS.maxReplans);
  assert.ok(a.executablePlan.abortUntilTick>s.tick);
});

test('VAL2 closes plan when the retained personal goal completes',()=>{
  const {s,a}=productiveFixture();
  a.planning.goal={...a.planning.goal,status:'completed',updatedTick:s.tick,outcome:'SAT:productive-outcome'};
  syncExecutablePlan(s,a);
  assert.equal(a.executablePlan.status,'COMPLETED');
  assert.equal(a.executablePlan.steps.at(-1).status,'COMPLETED');
});

test('VAL2 engine state saves and restores deterministically',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'large'});
  step(s,1);
  assert.ok(s.agents.some(a=>a.executablePlan));
  assert.deepEqual(validateExecutablePlans(s),[]);
  const b=restore(serialize(s));
  assert.equal(serialize(b),serialize(s));
  for(let i=0;i<60;i++){step(s,1);step(b,1);}
  assert.equal(serialize(b),serialize(s));
});
