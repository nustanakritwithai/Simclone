import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore} from '../src/engine.mjs';
import {RULES} from '../src/survival.mjs';
import {actionPredictionSnapshot,ACTION_PREDICTION_VERSION} from '../src/read-models/action-prediction.mjs';

test('VAL3 legacy mode has no prediction shadow',()=>{
  const s=createWorld(42,{mode:'legacy'});
  assert.equal(actionPredictionSnapshot(s,s.agents[0].id),null);
});

test('VAL3 NO_TASK is explicit and byte-read-only',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  a.task=null;
  const before=serialize(s),view=actionPredictionSnapshot(s,a.id);
  assert.equal(serialize(s),before);
  assert.equal(view.version,ACTION_PREDICTION_VERSION);
  assert.equal(view.evidence,'NO_TASK');
  assert.equal(view.prediction,null);
});

test('VAL3 travel estimate derives from authoritative task path and exported moveTicks',()=>{
  const s=createWorld(230926,{mode:'independent'});step(s,1);
  const a=s.agents.find(a=>a.alive&&a.task&&a.task.path.length>0);assert.ok(a);
  a.moveTick=Math.min(1,RULES.moveTicks-1);
  const before=serialize(s),view=actionPredictionSnapshot(s,a.id);
  assert.equal(serialize(s),before);
  assert.equal(view.prediction.remainingRouteSteps,a.task.path.length);
  assert.equal(view.prediction.moveTicksPerStep,RULES.moveTicks);
  assert.equal(view.prediction.minimumTravelTicks,a.task.path.length*RULES.moveTicks-a.moveTick);
});

test('VAL3 revalidation contract follows task family without reading remote output',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  a.task={kind:'FORAGE',targetId:123,x:a.x,y:a.y,path:[],work:0,score:1,started:s.tick,policy:RULES.jobPolicy};
  a.trace=[{kind:'FORAGE',targetId:123,status:'selected',score:40,factors:{base:25,need:15}}];
  const view=actionPredictionSnapshot(s,a.id);
  assert.equal(view.evidence,'PREDICTABLE');
  assert.equal(view.prediction.revalidate,'RESOURCE_AT_TARGET');
  assert.equal(view.prediction.selectedScore,40);
  assert.equal(Object.hasOwn(view.prediction,'expectedAmount'),false);
  assert.equal(Object.hasOwn(view.prediction,'resourceAmount'),false);
});

test('VAL3 survival interruption is descriptive only',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  a.satiety=RULES.hungry-1;
  a.task={kind:'WOODCUT',targetId:1,x:a.x,y:a.y,path:[],work:0,score:1,started:s.tick,policy:RULES.jobPolicy};
  const before=serialize(s),view=actionPredictionSnapshot(s,a.id);
  assert.equal(view.prediction.interruptionNow,'HUNGER');
  assert.equal(serialize(s),before);
});

test('VAL3 save/load returns identical shadow for identical state',()=>{
  const s=createWorld(230926,{mode:'independent'});step(s,8);
  const a=s.agents.find(a=>a.alive&&a.task);assert.ok(a);
  const before=actionPredictionSnapshot(s,a.id),restored=restore(serialize(s));
  assert.deepEqual(actionPredictionSnapshot(restored,a.id),before);
});
