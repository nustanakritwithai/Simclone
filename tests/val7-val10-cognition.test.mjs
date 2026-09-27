import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore,validate} from '../src/engine.mjs';
import {
  rememberPlanSelection,recordPlanProduction,recordPredictionReceipt,
  MULTI_STEP_SEQUENCE_VERSION,PREDICTION_RECEIPT_VERSION,PLANNING_LIMITS
} from '../src/personal-planning.mjs';
import {outcomeLearningSignal,MAX_NEGATIVE_OUTCOME_LEARNING_PENALTY} from '../src/outcome-learning-authority.mjs';
import {autonomousLifeSnapshot} from '../src/autonomous-life-view.mjs';

const independent=()=>createWorld(230926,{mode:'independent'});
const prediction=(kind,targetId,score=90)=>({
  taskKind:kind,targetId,remainingRouteSteps:3,moveTicksPerStep:3,currentMoveProgress:0,
  minimumTravelTicks:9,revalidate:'RESOURCE_AT_TARGET',interruptionNow:null,
  selectedScore:score,traceSource:'agent.trace:selected'
});

test('VAL7 productive plan carries a bounded deterministic step sequence',()=>{
  const s=independent(),a=s.agents[0];
  rememberPlanSelection(s,a,{kind:'WOODCUT',targetId:10,x:2,y:2,perception:'memory'});
  const g=a.planning.goal;
  assert.equal(g.sequenceVersion,MULTI_STEP_SEQUENCE_VERSION);
  assert.equal(g.steps.length,3);
  assert.equal(g.stepIndex,0);
  assert.deepEqual(g.steps.map(x=>x.status),['active','pending','pending']);

  rememberPlanSelection(s,a,{kind:'WOODCUT',targetId:10,x:2,y:2,perception:'vision'});
  assert.equal(a.planning.goal.planId,g.planId);
  assert.equal(a.planning.goal.stepIndex,1);
  assert.deepEqual(a.planning.goal.steps.map(x=>x.status),['completed','active','pending']);

  s.tick++;
  recordPlanProduction(s,a,{kind:'WOODCUT',targetId:10},2);
  assert.equal(a.planning.goal.status,'completed');
  assert.equal(a.planning.goal.stepIndex,2);
  assert.deepEqual(a.planning.goal.steps.map(x=>x.status),['completed','completed','completed']);
});

test('VAL7 bounded terminal failure preserves failed sequence evidence',()=>{
  const s=independent(),a=s.agents[0];
  rememberPlanSelection(s,a,{kind:'MINE',targetId:20,x:3,y:3,perception:'vision'});
  for(let i=0;i<3;i++){s.tick++;recordPlanProduction(s,a,{kind:'MINE',targetId:20},0);}
  assert.equal(a.planning.goal.status,'failed');
  assert.equal(a.planning.goal.outcome,'VIOL:replan-budget-exhausted');
  assert.equal(a.planning.goal.stepIndex,2);
  assert.deepEqual(a.planning.goal.steps.map(x=>x.status),['completed','failed','failed']);
  const restored=restore(serialize(s));
  assert.deepEqual(restored.agents[0].planning.goal,a.planning.goal);
});

test('VAL9 retains only productive selected prediction receipts and caps them',()=>{
  const s=independent(),a=s.agents[0];
  rememberPlanSelection(s,a,{kind:'FORAGE',targetId:30,x:4,y:4,perception:'vision'});
  assert.equal(recordPredictionReceipt(s,a,{...prediction('EAT',null),revalidate:'SURVIVAL_ACTION'}),null);
  for(let i=0;i<6;i++){
    s.tick++;
    const row=recordPredictionReceipt(s,a,prediction('FORAGE',30,80+i));
    assert.equal(row.version,PREDICTION_RECEIPT_VERSION);
  }
  assert.equal(a.planning.predictions.length,PLANNING_LIMITS.predictions);
  assert.equal(a.planning.predictions[0].selectedScore,82);
  assert.equal(a.planning.predictions.at(-1).selectedScore,85);
  const restored=restore(serialize(s));
  assert.deepEqual(restored.agents[0].planning.predictions,a.planning.predictions);
});

test('VAL9 engine writes a receipt only after a productive task is selected',()=>{
  const s=independent();
  for(const a of s.agents){a.satiety=95;a.energy=100;}
  for(let i=0;i<24&&!s.agents.some(a=>a.planning?.predictions?.length);i++)step(s,1);
  const agent=s.agents.find(a=>a.planning?.predictions?.length);
  assert.ok(agent,'expected at least one productive selected task');
  const receipt=agent.planning.predictions.at(-1);
  assert.ok(['FORAGE','WOODCUT','MINE','BUILD'].includes(receipt.taskKind));
  assert.equal(receipt.traceSource,'agent.trace:selected');
  assert.ok(receipt.minimumTravelTicks>=0);
  assert.equal(typeof receipt.planId,'string');
});

test('VAL9 validator rejects malformed receipt evidence',()=>{
  const s=independent(),a=s.agents[0];
  a.planning.predictions=[{version:'bad'}];
  assert.ok(validate(s).includes('Prediction receipts'));
});

test('VAL10 receipt-backed terminal VIOL gives exactly minus one',()=>{
  const s=independent(),a=s.agents[0];
  rememberPlanSelection(s,a,{kind:'FORAGE',targetId:40,x:5,y:5,perception:'vision'});
  recordPredictionReceipt(s,a,prediction('FORAGE',40));
  for(let i=0;i<3;i++){s.tick++;recordPlanProduction(s,a,{kind:'FORAGE',targetId:40},0);}
  const signal=outcomeLearningSignal(s,a,'FORAGE');
  assert.equal(signal.reason,'receipt-backed-terminal-viol');
  assert.equal(signal.bonus,MAX_NEGATIVE_OUTCOME_LEARNING_PENALTY);
  assert.equal(signal.bonus,-1);
  assert.equal(signal.active,true);
});

test('VAL10 never penalizes a terminal VIOL without a matching receipt',()=>{
  const s=independent(),a=s.agents[0];
  rememberPlanSelection(s,a,{kind:'FORAGE',targetId:41,x:5,y:5,perception:'vision'});
  for(let i=0;i<3;i++){s.tick++;recordPlanProduction(s,a,{kind:'FORAGE',targetId:41},0);}
  const signal=outcomeLearningSignal(s,a,'FORAGE');
  assert.equal(signal.bonus,0);
  assert.equal(signal.active,false);
});

test('VAL10 survival emergency suppresses even receipt-backed negative learning',()=>{
  const s=independent(),a=s.agents[0];
  rememberPlanSelection(s,a,{kind:'WOODCUT',targetId:50,x:6,y:6,perception:'vision'});
  recordPredictionReceipt(s,a,prediction('WOODCUT',50));
  for(let i=0;i<3;i++){s.tick++;recordPlanProduction(s,a,{kind:'WOODCUT',targetId:50},0);}
  assert.equal(outcomeLearningSignal(s,a,'WOODCUT',{emergency:true}).bonus,0);
});

test('VAL8 autonomous life projection exposes factual plan receipt outcome and learning read-only',()=>{
  const s=independent(),a=s.agents[0];
  rememberPlanSelection(s,a,{kind:'MINE',targetId:60,x:7,y:7,perception:'vision'});
  recordPredictionReceipt(s,a,prediction('MINE',60,77));
  s.tick++;
  recordPlanProduction(s,a,{kind:'MINE',targetId:60},2);
  a.task={kind:'MINE',targetId:60,x:7,y:7,path:[],work:0,score:76,started:s.tick,policy:'survival-v3'};
  a.trace=[{kind:'MINE',targetId:60,x:7,y:7,score:76,factors:{base:77,outcomeLearning:-1},status:'selected'}];
  const before=serialize(s),view=autonomousLifeSnapshot(s,a.id);
  assert.equal(serialize(s),before);
  assert.equal(view.reasoning.plan.sequenceVersion,MULTI_STEP_SEQUENCE_VERSION);
  assert.equal(view.reasoning.plan.steps.length,3);
  assert.equal(view.reasoning.prediction.planId,a.planning.goal.planId);
  assert.equal(view.reasoning.outcome.planId,a.planning.goal.planId);
  assert.equal(view.reasoning.outcome.result,'SAT');
  assert.equal(view.reasoning.learningFactor,-1);
  assert.equal(view.decision.score,view.decision.factorSum);
});
