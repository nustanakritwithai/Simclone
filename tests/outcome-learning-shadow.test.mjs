import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore} from '../src/engine.mjs';
import {rememberPlanSelection,recordPlanProduction} from '../src/personal-planning.mjs';
import {
  outcomeLearningShadowSnapshot,
  OUTCOME_LEARNING_SHADOW_VERSION,
  PREDICTION_HISTORY_EVIDENCE
} from '../src/read-models/outcome-learning-shadow.mjs';

test('VAL5 legacy mode has no learning shadow',()=>{
  const s=createWorld(42,{mode:'legacy'});
  assert.equal(outcomeLearningShadowSnapshot(s,s.agents[0].id),null);
});

test('VAL5 empty outcome evidence is explicit and byte-read-only',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  a.planning.lessons=[];
  const before=serialize(s),view=outcomeLearningShadowSnapshot(s,a.id);
  assert.equal(serialize(s),before);
  assert.equal(view.version,OUTCOME_LEARNING_SHADOW_VERSION);
  assert.equal(view.evidence,'NO_OUTCOME_EVIDENCE');
  assert.equal(view.predictionHistory,PREDICTION_HISTORY_EVIDENCE);
  assert.deepEqual(view.outcomes,[]);
  assert.deepEqual(view.byKind,[]);
});

test('VAL5 aggregates only retained productive outcome evidence exactly',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  a.planning.lessons=[
    {tick:s.tick,kind:'FORAGE',targetId:1,outcome:'SAT',amount:2},
    {tick:s.tick,kind:'FORAGE',targetId:2,outcome:'VIOL',amount:0},
    {tick:s.tick,kind:'EXPLORE',targetId:null,outcome:'SAT',amount:9},
    {tick:s.tick,kind:'MINE',targetId:3,outcome:'SAT',amount:4}
  ];
  const view=outcomeLearningShadowSnapshot(s,a.id);
  assert.equal(view.evidence,'OUTCOME_EVIDENCE');
  assert.deepEqual(view.outcomes.map(x=>x.kind),['FORAGE','FORAGE','MINE']);
  assert.deepEqual(view.byKind,[
    {kind:'FORAGE',sampleCount:2,satCount:1,violCount:1,unknownCount:0,totalAmount:2,lastTick:s.tick},
    {kind:'MINE',sampleCount:1,satCount:1,violCount:0,unknownCount:0,totalAmount:4,lastTick:s.tick}
  ]);
});

test('VAL5 surfaces VAL4 verified outcome but creates no learning authority',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  rememberPlanSelection(s,a,{kind:'MINE',targetId:30,x:3,y:3});
  s.tick+=2;
  recordPlanProduction(s,a,{kind:'MINE',targetId:30},2);
  const view=outcomeLearningShadowSnapshot(s,a.id);
  assert.equal(view.currentOutcome.evidence,'VERIFIED');
  assert.equal(view.currentOutcome.result,'SAT');
  assert.equal(view.evidence,'OUTCOME_EVIDENCE');
  assert.equal(view.predictionHistory,'NOT_RETAINED');
  assert.equal(Object.hasOwn(view,'predictionAccuracy'),false);
  assert.equal(Object.hasOwn(view,'scoreAdjustment'),false);
  assert.equal(Object.hasOwn(view,'preference'),false);
  assert.equal(Object.hasOwn(view,'learnedRule'),false);
});

test('VAL5 keeps current VAL3 prediction live-only instead of fabricating history',()=>{
  const s=createWorld(230926,{mode:'independent'});
  step(s,1);
  const a=s.agents.find(a=>a.alive&&a.task);assert.ok(a);
  const before=serialize(s),view=outcomeLearningShadowSnapshot(s,a.id);
  assert.equal(serialize(s),before);
  assert.ok(view.livePrediction);
  assert.equal(view.predictionHistory,'NOT_RETAINED');
  assert.equal(Object.hasOwn(view.livePrediction,'accuracy'),false);
});

test('VAL5 conflicting terminal evidence never promotes to learned knowledge',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  rememberPlanSelection(s,a,{kind:'FORAGE',targetId:61,x:4,y:4});
  s.tick+=1;
  recordPlanProduction(s,a,{kind:'FORAGE',targetId:61},3);
  const lesson=a.planning.lessons.at(-1);
  lesson.outcome='VIOL';
  lesson.amount=0;
  const view=outcomeLearningShadowSnapshot(s,a.id);
  assert.equal(view.currentOutcome.evidence,'EVIDENCE_CONFLICT');
  assert.equal(view.evidence,'EVIDENCE_CONFLICT');
  assert.equal(Object.hasOwn(view,'learnedRule'),false);
});

test('VAL5 preserves unknown retained outcomes as unknown evidence',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  a.planning.lessons=[{tick:s.tick,kind:'BUILD',targetId:70,outcome:'UNKNOWN',amount:0}];
  const view=outcomeLearningShadowSnapshot(s,a.id);
  assert.deepEqual(view.byKind,[
    {kind:'BUILD',sampleCount:1,satCount:0,violCount:0,unknownCount:1,totalAmount:0,lastTick:s.tick}
  ]);
});

test('VAL5 save/load returns identical learning shadow for identical state',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  rememberPlanSelection(s,a,{kind:'WOODCUT',targetId:80,x:8,y:8});
  s.tick+=3;
  recordPlanProduction(s,a,{kind:'WOODCUT',targetId:80},1);
  const before=outcomeLearningShadowSnapshot(s,a.id);
  const restored=restore(serialize(s));
  assert.deepEqual(outcomeLearningShadowSnapshot(restored,a.id),before);
});
