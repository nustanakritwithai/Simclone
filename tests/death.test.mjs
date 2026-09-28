import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore,validate,adultLife,ageYears,lifeStage,LIFE_STAGES,lifespanYears,shouldDieOfAge} from '../src/engine.mjs';
import {RULES,routeField,routeTo,reservations} from '../src/survival.mjs';

function oneAgentWorld(seed){
  const s=createWorld(seed);s.agents=s.agents.slice(0,1);s.buildings=s.buildings.slice(0,1);
  const ids=new Set(s.agents.map(a=>a.id));
  if(s.currencyWallet){
    s.currencyWallet.accounts=s.currencyWallet.accounts.filter(a=>ids.has(a.agentId));
    s.currencyWallet.receipts=s.currencyWallet.receipts.filter(r=>
      (r.agentId==null||ids.has(r.agentId))&&(r.fromAgentId==null||ids.has(r.fromAgentId))&&(r.toAgentId==null||ids.has(r.toAgentId)));
    if(s.currencyWallet.bootstrap){
      s.currencyWallet.bootstrap.agentIds=s.currencyWallet.bootstrap.agentIds.filter(id=>ids.has(id));
      s.currencyWallet.bootstrap.totalGranted=s.currencyWallet.bootstrap.initialBalance*s.currencyWallet.bootstrap.agentIds.length;
    }
  }
  return s;
}
function assignResource(s,a){
  const n=s.nodes.find(n=>n.amount>0),field=routeField(s,a);
  a.task={policy:RULES.jobPolicy,kind:n.type==='food'?'FORAGE':n.type==='wood'?'WOODCUT':'MINE',targetId:n.id,x:n.x,y:n.y,
    path:routeTo(field,n),work:0,score:100,started:s.tick};
  return n;
}

test('derived lifespans are deterministic and bounded 78 through 92',()=>{
  const a=createWorld(42),b=createWorld(42);
  const xs=a.agents.map(x=>lifespanYears(a,x)),ys=b.agents.map(x=>lifespanYears(b,x));
  assert.deepEqual(xs,ys);assert.ok(xs.every(x=>x>=78&&x<=92));assert.ok(new Set(xs).size>1);
  assert.ok(a.agents.every(x=>!Object.hasOwn(x,'lifespan')));
});

test('age death occurs exactly when derived age reaches lifespan',()=>{
  const s=oneAgentWorld(7);
  const a=s.agents[0],limit=lifespanYears(s,a);a.life=adultLife(0,limit-1);s.tick=359;a.satiety=100;a.energy=100;
  assert.equal(ageYears(s,a),limit-1);assert.equal(shouldDieOfAge(s,a),false);
  step(s);assert.equal(ageYears(s,a),limit);assert.equal(a.alive,false);assert.equal(a.hp,0);assert.equal(lifeStage(s,a),LIFE_STAGES.DEAD);
  assert.ok(a.memory.at(-1).text.includes('เสียชีวิตตามวัย'));assert.deepEqual(validate(s),[]);
});

test('age death clears task and derived reservation before any further work',()=>{
  const s=oneAgentWorld(11);
  const a=s.agents[0],limit=lifespanYears(s,a);a.life=adultLife(0,limit-1);s.tick=359;a.satiety=100;a.energy=100;
  const n=assignResource(s,a);assert.equal(reservations(s).book.nodes.get(n.id),a.id);
  step(s);assert.equal(a.alive,false);assert.equal(a.task,null);assert.equal(a.moveTick,0);assert.equal(reservations(s).book.nodes.has(n.id),false);
});

test('starvation and age death share dead-state cleanup invariants',()=>{
  const s=oneAgentWorld(9);
  const a=s.agents[0];assignResource(s,a);a.satiety=0;a.hp=.1;a.moveTick=2;
  step(s);assert.equal(a.alive,false);assert.equal(a.hp,0);assert.equal(a.task,null);assert.equal(a.moveTick,0);
  assert.ok(a.memory.at(-1).text.includes('ขาดอาหาร'));assert.equal(reservations(s).book.nodes.size,0);
});

test('dead identity, lineage and derived lifespan survive save/load without new schema fields',()=>{
  const s=createWorld(13),a=s.agents[2],limit=lifespanYears(s,a);a.life=adultLife(0,limit);s.tick=1;step(s);
  assert.equal(a.alive,false);const id=[a.id,a.parentId,a.generation,a.appearance,limit];
  const restored=restore(serialize(s)),b=restored.agents.find(x=>x.id===a.id);
  assert.deepEqual([b.id,b.parentId,b.generation,b.appearance,lifespanYears(restored,b)],id);
  assert.equal(b.alive,false);assert.equal(b.task,null);
});
