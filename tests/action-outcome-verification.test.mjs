import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,restore} from '../src/engine.mjs';
import {rememberPlanSelection,recordPlanProduction,EXECUTABLE_PLAN_RULES} from '../src/personal-planning.mjs';
import {actionOutcomeVerificationSnapshot,ACTION_OUTCOME_VERIFICATION_VERSION} from '../src/read-models/action-outcome-verification.mjs';

const choice=(kind,targetId,x=5,y=5)=>({kind,targetId,x,y});

test('VAL4 legacy mode has no outcome verification shadow',()=>{
  const s=createWorld(42,{mode:'legacy'});
  assert.equal(actionOutcomeVerificationSnapshot(s,s.agents[0].id),null);
});

test('VAL4 NO_PLAN is explicit and byte-read-only',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  a.planning.goal=null;
  const before=serialize(s),view=actionOutcomeVerificationSnapshot(s,a.id);
  assert.equal(serialize(s),before);
  assert.equal(view.version,ACTION_OUTCOME_VERIFICATION_VERSION);
  assert.equal(view.evidence,'NO_PLAN');
  assert.equal(view.verification,null);
});

test('VAL4 productive active plan remains PENDING',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  rememberPlanSelection(s,a,choice('WOODCUT',21,6,6));
  const before=serialize(s),view=actionOutcomeVerificationSnapshot(s,a.id);
  assert.equal(serialize(s),before);
  assert.equal(view.evidence,'PENDING');
  assert.equal(view.verification.planId,a.planning.goal.planId);
  assert.equal(view.verification.result,'UNKNOWN');
  assert.equal(view.verification.lesson,null);
});

test('VAL4 verifies productive SAT from exact terminal plan and lesson evidence',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  rememberPlanSelection(s,a,choice('MINE',30,3,3));
  const planId=a.planning.goal.planId;
  s.tick+=2;
  recordPlanProduction(s,a,{kind:'MINE',targetId:30},2);
  const before=serialize(s),view=actionOutcomeVerificationSnapshot(s,a.id);
  assert.equal(serialize(s),before);
  assert.equal(view.evidence,'VERIFIED');
  assert.equal(view.verification.result,'SAT');
  assert.equal(view.verification.planId,planId);
  assert.equal(view.verification.lesson.tick,a.planning.goal.updatedTick);
  assert.equal(view.verification.lesson.kind,'MINE');
  assert.equal(view.verification.lesson.targetId,30);
  assert.equal(view.verification.lesson.amount,2);
});

test('VAL4 verifies bounded terminal VIOL after replan budget exhaustion',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  rememberPlanSelection(s,a,choice('FORAGE',40,3,3));
  const planId=a.planning.goal.planId;
  for(let i=1;i<=EXECUTABLE_PLAN_RULES.maxReplans;i++){
    s.tick+=1;
    recordPlanProduction(s,a,{kind:'FORAGE',targetId:40},0);
    if(i<EXECUTABLE_PLAN_RULES.maxReplans){
      s.tick+=1;
      rememberPlanSelection(s,a,choice('FORAGE',40,3,3));
    }
  }
  const view=actionOutcomeVerificationSnapshot(s,a.id);
  assert.equal(view.evidence,'VERIFIED');
  assert.equal(view.verification.result,'VIOL');
  assert.equal(view.verification.planId,planId);
  assert.equal(view.verification.attempt,EXECUTABLE_PLAN_RULES.maxReplans);
  assert.equal(view.verification.lesson.outcome,'VIOL');
  assert.equal(view.verification.lesson.amount,0);
});

test('VAL4 missing exact terminal lesson remains OUTCOME_UNKNOWN',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  rememberPlanSelection(s,a,choice('BUILD',51,7,7));
  s.tick+=1;
  recordPlanProduction(s,a,{kind:'BUILD',targetId:51},1);
  a.planning.lessons=[];
  const view=actionOutcomeVerificationSnapshot(s,a.id);
  assert.equal(view.evidence,'OUTCOME_UNKNOWN');
  assert.equal(view.verification.result,'UNKNOWN');
  assert.equal(view.verification.lesson,null);
});

test('VAL4 contradictory retained lesson is explicit EVIDENCE_CONFLICT',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  rememberPlanSelection(s,a,choice('FORAGE',61,4,4));
  s.tick+=1;
  recordPlanProduction(s,a,{kind:'FORAGE',targetId:61},3);
  const lesson=a.planning.lessons.at(-1);
  lesson.outcome='VIOL';
  lesson.amount=0;
  const view=actionOutcomeVerificationSnapshot(s,a.id);
  assert.equal(view.evidence,'EVIDENCE_CONFLICT');
  assert.equal(view.verification.result,'UNKNOWN');
  assert.equal(view.verification.lesson.outcome,'VIOL');
});

test('VAL4 out-of-scope VAL2 plan does not infer an outcome',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  rememberPlanSelection(s,a,{kind:'EXPLORE',targetId:null,x:8,y:8});
  const view=actionOutcomeVerificationSnapshot(s,a.id);
  assert.equal(view.evidence,'OUT_OF_SCOPE');
  assert.equal(view.verification.taskKind,'EXPLORE');
  assert.equal(view.verification.result,'UNKNOWN');
});

test('VAL4 save/load returns identical verification for identical state',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  rememberPlanSelection(s,a,choice('WOODCUT',70,8,8));
  s.tick+=3;
  recordPlanProduction(s,a,{kind:'WOODCUT',targetId:70},1);
  const before=actionOutcomeVerificationSnapshot(s,a.id);
  const restored=restore(serialize(s));
  assert.deepEqual(actionOutcomeVerificationSnapshot(restored,a.id),before);
});
