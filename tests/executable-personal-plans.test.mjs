import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore} from '../src/engine.mjs';
import {rememberPlanSelection,recordPlanProduction,EXECUTABLE_PLAN_VERSION,EXECUTABLE_PLAN_RULES} from '../src/personal-planning.mjs';

const choice=(kind,targetId,x=5,y=5,extra={})=>({kind,targetId,x,y,...extra});

test('VAL2 same goal and target preserves deterministic plan identity',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  rememberPlanSelection(s,a,choice('FORAGE',101,7,8));
  const first=structuredClone(a.planning.goal);
  s.tick+=5;rememberPlanSelection(s,a,choice('FORAGE',101,7,8));
  const second=a.planning.goal;
  assert.equal(second.planVersion,EXECUTABLE_PLAN_VERSION);
  assert.equal(second.planId,first.planId);
  assert.equal(second.startedTick,first.startedTick);
  assert.equal(second.updatedTick,s.tick);
  assert.deepEqual(second.step,{kind:'FORAGE',phase:'work'});
});

test('VAL2 changed target creates a new plan id without another scheduler',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  rememberPlanSelection(s,a,choice('WOODCUT',20,4,4));
  const first=a.planning.goal.planId;
  s.tick+=1;rememberPlanSelection(s,a,choice('WOODCUT',21,5,4));
  assert.notEqual(a.planning.goal.planId,first);
  assert.equal(a.planning.goal.planId,'val2:'+a.id+':collect-wood:21:'+s.tick);
  assert.equal(a.task,null,'personal planner never writes the authoritative task');
});

test('VAL2 productive outcome completes the existing plan',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  rememberPlanSelection(s,a,choice('MINE',30,3,3));
  recordPlanProduction(s,a,{kind:'MINE',targetId:30},2);
  assert.equal(a.planning.goal.status,'completed');
  assert.equal(a.planning.goal.outcome,'SAT:productive-outcome');
  assert.equal(a.planning.goal.attempt,0);
});

test('VAL2 failed productive outcomes exhaust a bounded replan budget',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  rememberPlanSelection(s,a,choice('FORAGE',40,3,3));
  const id=a.planning.goal.planId;
  for(let i=1;i<=EXECUTABLE_PLAN_RULES.maxReplans;i++){
    s.tick+=1;recordPlanProduction(s,a,{kind:'FORAGE',targetId:40},0);
    assert.equal(a.planning.goal.attempt,i);
    assert.equal(a.planning.goal.status,i===EXECUTABLE_PLAN_RULES.maxReplans?'failed':'interrupted');
    if(i<EXECUTABLE_PLAN_RULES.maxReplans){
      s.tick+=1;rememberPlanSelection(s,a,choice('FORAGE',40,3,3));
      assert.equal(a.planning.goal.planId,id);
    }
  }
  assert.equal(a.planning.goal.outcome,'VIOL:replan-budget-exhausted');
});

test('VAL2 save/load continuation stays byte deterministic',()=>{
  const a=createWorld(230926,{mode:'independent'});
  step(a,20);
  const b=restore(serialize(a));
  for(let i=0;i<180;i++){step(a,1);step(b,1);}
  assert.equal(serialize(a),serialize(b));
});
