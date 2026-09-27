import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore} from '../src/engine.mjs';
import {outcomeLearningSignal,MAX_OUTCOME_LEARNING_BONUS} from '../src/outcome-learning-authority.mjs';

function independent(){return createWorld(230926,{mode:'independent'});}
function setLessons(a,kind,outcomes){
  a.planning.lessons=outcomes.map((outcome,i)=>({
    tick:i,
    kind,
    targetId:100+i,
    outcome,
    amount:outcome==='SAT'?1:0
  }));
}

test('VAL6 legacy and unsupported actions stay inactive',()=>{
  const legacy=createWorld(42,{mode:'legacy'}),a=legacy.agents[0];
  assert.deepEqual(outcomeLearningSignal(legacy,a,'FORAGE'),{
    version:'VAL6-0.1',active:false,bonus:0,reason:'legacy',kind:'FORAGE',
    sampleCount:0,satCount:0,violCount:0,unknownCount:0,totalAmount:0
  });
  const s=independent(),b=s.agents[0];
  setLessons(b,'FORAGE',['SAT','SAT']);
  assert.equal(outcomeLearningSignal(s,b,'EXPLORE').bonus,0);
  assert.equal(outcomeLearningSignal(s,b,'EXPLORE').reason,'unsupported-kind');
});

test('VAL6 needs two clean SAT samples and is capped at four',()=>{
  const s=independent(),a=s.agents[0];
  setLessons(a,'WOODCUT',['SAT']);
  assert.equal(outcomeLearningSignal(s,a,'WOODCUT').bonus,0);
  setLessons(a,'WOODCUT',['SAT','SAT']);
  assert.equal(outcomeLearningSignal(s,a,'WOODCUT').bonus,2);
  setLessons(a,'WOODCUT',['SAT','SAT','SAT']);
  assert.equal(outcomeLearningSignal(s,a,'WOODCUT').bonus,3);
  setLessons(a,'WOODCUT',['SAT','SAT','SAT','SAT']);
  const four=outcomeLearningSignal(s,a,'WOODCUT');
  assert.equal(four.bonus,4);
  assert.equal(four.bonus,MAX_OUTCOME_LEARNING_BONUS);
});

test('VAL6 any VIOL or UNKNOWN suppresses positive learning',()=>{
  const s=independent(),a=s.agents[0];
  setLessons(a,'MINE',['SAT','VIOL']);
  assert.equal(outcomeLearningSignal(s,a,'MINE').bonus,0);
  assert.equal(outcomeLearningSignal(s,a,'MINE').reason,'violation-evidence');
  setLessons(a,'MINE',['SAT','UNKNOWN']);
  assert.equal(outcomeLearningSignal(s,a,'MINE').bonus,0);
  assert.equal(outcomeLearningSignal(s,a,'MINE').reason,'unknown-evidence');
});

test('VAL6 survival emergency suppresses learning',()=>{
  const s=independent(),a=s.agents[0];
  setLessons(a,'FORAGE',['SAT','SAT']);
  const view=outcomeLearningSignal(s,a,'FORAGE',{emergency:true});
  assert.equal(view.active,false);
  assert.equal(view.bonus,0);
  assert.equal(view.reason,'survival-emergency');
});

test('VAL6 conflicting terminal evidence suppresses learning',()=>{
  const s=independent(),a=s.agents[0];
  a.planning.goal={
    goal:'secure-food',targetId:61,x:4,y:4,kind:'FORAGE',phase:'work',
    status:'completed',startedTick:0,updatedTick:2,outcome:'SAT:productive-outcome',
    planVersion:'VAL2-0.1',planId:'val2:'+a.id+':secure-food:61:0',
    step:{kind:'FORAGE',phase:'work'},attempt:0,maxReplans:3
  };
  a.planning.lessons=[
    {tick:0,kind:'FORAGE',targetId:1,outcome:'SAT',amount:1},
    {tick:1,kind:'FORAGE',targetId:2,outcome:'SAT',amount:1},
    {tick:2,kind:'FORAGE',targetId:61,outcome:'VIOL',amount:0}
  ];
  s.tick=2;
  const view=outcomeLearningSignal(s,a,'FORAGE');
  assert.equal(view.active,false);
  assert.equal(view.bonus,0);
  assert.equal(view.reason,'evidence-conflict');
});

test('VAL6 candidate score uses one bounded outcomeLearning factor and preserves exact sum',()=>{
  const s=independent(),a=s.agents[0];
  const food=s.nodes.find(n=>n.type==='food');assert.ok(food);
  a.x=food.x;a.y=food.y;a.satiety=60;a.energy=100;a.task=null;
  setLessons(a,'FORAGE',['SAT','SAT']);
  const before=serialize(s);
  const restored=restore(before);
  step(s,1);step(restored,1);
  assert.equal(serialize(s),serialize(restored));
  const trace=s.agents.find(x=>x.id===a.id).trace;
  const forage=trace.find(c=>c.kind==='FORAGE');assert.ok(forage);
  assert.equal(forage.factors.outcomeLearning,2);
  assert.equal(forage.score,Object.values(forage.factors).reduce((sum,v)=>sum+v,0));
  const explore=trace.find(c=>c.kind==='EXPLORE');
  if(explore)assert.equal(Object.hasOwn(explore.factors,'outcomeLearning'),false);
});
