import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,restore} from '../src/engine.mjs';
import {rememberPlanSelection,recordPredictionReceipt,recordPlanProduction} from '../src/personal-planning.mjs';
import {predictionCalibrationSnapshot} from '../src/read-models/prediction-calibration.mjs';
import {learningQualitySnapshot} from '../src/read-models/learning-quality-gate.mjs';

const independent=()=>createWorld(230926,{mode:'independent'});
const receipt=(kind,targetId,minimumTravelTicks=2,score=80)=>({
  taskKind:kind,targetId,remainingRouteSteps:minimumTravelTicks/2,moveTicksPerStep:2,currentMoveProgress:0,
  minimumTravelTicks,revalidate:'RESOURCE_AT_TARGET',interruptionNow:null,
  selectedScore:score,traceSource:'agent.trace:selected'
});

function completedSample(s,a,{kind,targetId,x=3,y=3,minimumTravelTicks=2,elapsed=3,amount=1}){
  rememberPlanSelection(s,a,{kind,targetId,x,y,perception:'vision'});
  recordPredictionReceipt(s,a,receipt(kind,targetId,minimumTravelTicks));
  s.tick+=elapsed;
  recordPlanProduction(s,a,{kind,targetId},amount);
  return a.planning.goal.planId;
}

test('CV1 legacy mode has no calibration shadow',()=>{
  const s=createWorld(42,{mode:'legacy'});
  assert.equal(predictionCalibrationSnapshot(s,s.agents[0].id),null);
  assert.equal(learningQualitySnapshot(s,s.agents[0].id),null);
});

test('CV1 is byte-read-only and one clean sample stays quality UNKNOWN',()=>{
  const s=independent(),a=s.agents[0];
  completedSample(s,a,{kind:'FORAGE',targetId:10,minimumTravelTicks:2,elapsed:4,amount:2});
  const before=serialize(s),view=predictionCalibrationSnapshot(s,a.id),gate=learningQualitySnapshot(s,a.id);
  assert.equal(serialize(s),before);
  assert.equal(view.evidence,'CALIBRATION_EVIDENCE');
  assert.equal(view.accuracy,'NOT_ESTIMATED');
  assert.equal(view.linkedSampleCount,1);
  assert.equal(view.linked[0].elapsedTicks,4);
  assert.equal(view.linked[0].minimumTravelTicks,2);
  assert.equal(view.linked[0].latencySlackTicks,2);
  assert.equal(gate.status,'UNKNOWN');
  assert.equal(gate.reason,'insufficient-linked-samples');
});

test('CV1 exact plan kind target linkage uses newest matching receipt',()=>{
  const s=independent(),a=s.agents[0];
  rememberPlanSelection(s,a,{kind:'WOODCUT',targetId:20,x:4,y:4,perception:'vision'});
  recordPredictionReceipt(s,a,receipt('WOODCUT',20,8,70));
  s.tick+=1;
  recordPredictionReceipt(s,a,receipt('WOODCUT',20,3,75));
  const planId=a.planning.goal.planId;
  s.tick+=5;
  recordPlanProduction(s,a,{kind:'WOODCUT',targetId:20},2);
  const view=predictionCalibrationSnapshot(s,a.id);
  assert.equal(view.linkedSampleCount,1);
  assert.equal(view.linked[0].planId,planId);
  assert.equal(view.linked[0].receiptTick,1);
  assert.equal(view.linked[0].minimumTravelTicks,3);
  assert.equal(view.linked[0].elapsedTicks,5);
  assert.equal(view.linked[0].latencySlackTicks,2);
});

test('CV1 leaves unmatched productive outcomes explicitly unlinked',()=>{
  const s=independent(),a=s.agents[0];
  rememberPlanSelection(s,a,{kind:'MINE',targetId:30,x:5,y:5,perception:'vision'});
  s.tick+=2;
  recordPlanProduction(s,a,{kind:'MINE',targetId:30},1);
  const view=predictionCalibrationSnapshot(s,a.id);
  assert.equal(view.evidence,'RECEIPTS_MISSING');
  assert.equal(view.linkedSampleCount,0);
  assert.equal(view.unlinkedOutcomeCount,1);
  assert.equal(view.unlinked[0].kind,'MINE');
});

test('CV1 impossible negative latency slack is EVIDENCE_CONFLICT and CV2 is VIOL',()=>{
  const s=independent(),a=s.agents[0];
  rememberPlanSelection(s,a,{kind:'FORAGE',targetId:40,x:6,y:6,perception:'vision'});
  recordPredictionReceipt(s,a,receipt('FORAGE',40,8));
  s.tick+=3;
  recordPlanProduction(s,a,{kind:'FORAGE',targetId:40},1);
  const view=predictionCalibrationSnapshot(s,a.id),gate=learningQualitySnapshot(s,a.id);
  assert.equal(view.evidence,'EVIDENCE_CONFLICT');
  assert.equal(view.conflictCount,1);
  assert.equal(view.linked[0].latencySlackTicks,-5);
  assert.equal(gate.status,'VIOL');
  assert.equal(gate.reason,'evidence-conflict');
});

test('CV2 two clean linked samples are SAT and per-kind aggregate is exact',()=>{
  const s=independent(),a=s.agents[0];
  completedSample(s,a,{kind:'FORAGE',targetId:50,minimumTravelTicks:2,elapsed:4,amount:2});
  completedSample(s,a,{kind:'WOODCUT',targetId:51,x:7,y:7,minimumTravelTicks:3,elapsed:5,amount:1});
  const view=predictionCalibrationSnapshot(s,a.id),gate=learningQualitySnapshot(s,a.id);
  assert.equal(view.linkedSampleCount,2);
  assert.equal(view.conflictCount,0);
  assert.deepEqual(view.byKind,[
    {
      kind:'FORAGE',sampleCount:1,satCount:1,violCount:0,unknownCount:0,conflictCount:0,
      interruptedAtSelectionCount:0,meanElapsedTicks:4,meanMinimumTravelTicks:2,meanLatencySlackTicks:2,maxLatencySlackTicks:2
    },
    {
      kind:'WOODCUT',sampleCount:1,satCount:1,violCount:0,unknownCount:0,conflictCount:0,
      interruptedAtSelectionCount:0,meanElapsedTicks:5,meanMinimumTravelTicks:3,meanLatencySlackTicks:2,maxLatencySlackTicks:2
    }
  ]);
  assert.equal(gate.status,'SAT');
  assert.equal(gate.reason,'clean-linked-evidence');
});

test('CV2 linked UNKNOWN keeps readiness UNKNOWN',()=>{
  const s=independent(),a=s.agents[0];
  completedSample(s,a,{kind:'FORAGE',targetId:60,minimumTravelTicks:1,elapsed:2,amount:1});
  rememberPlanSelection(s,a,{kind:'MINE',targetId:61,x:8,y:8,perception:'vision'});
  recordPredictionReceipt(s,a,receipt('MINE',61,1));
  const planId=a.planning.goal.planId;
  s.tick+=2;
  a.planning.lessons.push({tick:s.tick,kind:'MINE',targetId:61,outcome:'UNKNOWN',amount:0,planId});
  while(a.planning.lessons.length>4)a.planning.lessons.shift();
  const gate=learningQualitySnapshot(s,a.id);
  assert.equal(gate.linkedSampleCount,2);
  assert.equal(gate.linkedUnknownCount,1);
  assert.equal(gate.status,'UNKNOWN');
  assert.equal(gate.reason,'unresolved-linked-outcome');
});

test('CV1/CV2 save load outputs are identical',()=>{
  const s=independent(),a=s.agents[0];
  completedSample(s,a,{kind:'FORAGE',targetId:70,minimumTravelTicks:2,elapsed:3,amount:1});
  completedSample(s,a,{kind:'MINE',targetId:71,x:9,y:9,minimumTravelTicks:2,elapsed:4,amount:2});
  const before1=predictionCalibrationSnapshot(s,a.id),before2=learningQualitySnapshot(s,a.id);
  const restored=restore(serialize(s));
  assert.deepEqual(predictionCalibrationSnapshot(restored,a.id),before1);
  assert.deepEqual(learningQualitySnapshot(restored,a.id),before2);
});
