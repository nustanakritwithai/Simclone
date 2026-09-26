import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore} from '../src/engine.mjs';
import {rememberPlanSelection} from '../src/personal-planning.mjs';
import {executablePlanSnapshot,EXECUTABLE_PLAN_VIEW_VERSION} from '../src/read-models/executable-plan-view.mjs';

test('VAL2.1 legacy mode has no plan projection',()=>{
  const s=createWorld(42,{mode:'legacy'});
  assert.equal(executablePlanSnapshot(s,s.agents[0].id),null);
});

test('VAL2.1 reports NO_PLAN without inventing a plan',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  a.planning.goal=null;
  const before=serialize(s),view=executablePlanSnapshot(s,a.id);
  assert.equal(serialize(s),before);
  assert.equal(view.version,EXECUTABLE_PLAN_VIEW_VERSION);
  assert.equal(view.evidence,'NO_PLAN');
  assert.equal(view.plan,null);
});

test('VAL2.1 exactly projects authoritative VAL2 identity, step and budget',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  rememberPlanSelection(s,a,{kind:'FORAGE',targetId:77,x:8,y:9});
  const g=a.planning.goal,before=serialize(s),view=executablePlanSnapshot(s,a.id);
  assert.equal(serialize(s),before);
  assert.equal(view.evidence,'VAL2');
  assert.equal(view.plan.planId,g.planId);
  assert.deepEqual(view.plan.step,g.step);
  assert.equal(view.plan.attempt,g.attempt);
  assert.equal(view.plan.maxReplans,g.maxReplans);
  assert.equal(view.plan.startedTick,g.startedTick);
  assert.equal(view.plan.updatedTick,g.updatedTick);
  assert.equal(view.plan.targetId,g.targetId);
});

test('VAL2.1 old personal goal is explicit LEGACY_PLAN with no fabricated VAL2 fields',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  a.planning.goal={goal:'secure-food',targetId:12,x:5,y:6,kind:'FORAGE',phase:'work',status:'active',startedTick:s.tick,updatedTick:s.tick,outcome:'UNKNOWN'};
  const view=executablePlanSnapshot(s,a.id);
  assert.equal(view.evidence,'LEGACY_PLAN');
  assert.equal(view.plan.planId,null);
  assert.equal(view.plan.step,null);
  assert.equal(view.plan.attempt,null);
  assert.equal(view.plan.maxReplans,null);
});

test('VAL2.1 save/load returns identical plan projection',()=>{
  const s=createWorld(230926,{mode:'independent'});step(s,12);
  const a=s.agents.find(a=>a.alive&&a.planning?.goal);assert.ok(a);
  const before=executablePlanSnapshot(s,a.id);
  const restored=restore(serialize(s));
  assert.deepEqual(executablePlanSnapshot(restored,a.id),before);
});
