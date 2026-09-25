import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,step} from '../src/engine.mjs';
import {K6_RESOURCE_REGEN,createResourceRegenerationShadow} from '../src/worldsim-resource-regen-shadow.mjs';

test('WM4.0 captures exact K6 regeneration contract',()=>{
  assert.deepEqual(K6_RESOURCE_REGEN.food,{periodTicks:120,amount:3,renewable:true});
  assert.deepEqual(K6_RESOURCE_REGEN.wood,{periodTicks:720,amount:1,renewable:true});
  assert.deepEqual(K6_RESOURCE_REGEN.stone,{periodTicks:null,amount:0,renewable:false});
});

test('regeneration observer reports WorldSim writer and stays read-only',()=>{
  const s=createWorld(230926),before=serialize(s),x=createResourceRegenerationShadow(s);
  assert.equal(x.authority.writer,'worldsim-wm4.5');assert.equal(x.authority.worldsimMutation,false);
  assert.equal(serialize(s),before);
});

test('legacy boundary accounting matches current engine cadence',()=>{
  const s=createWorld(42);s.tick=119;
  let x=createResourceRegenerationShadow(s);
  assert.equal(x.byType.food.nextLegacyTick,120);
  assert.equal(x.rows.some(r=>r.boundaryTick),false);
  s.tick=120;x=createResourceRegenerationShadow(s);
  const food=x.rows.filter(r=>r.type==='food');
  assert.ok(food.every(r=>r.boundaryTick));
  assert.ok(food.every(r=>r.legacyIncrement<=3&&r.legacyIncrement<=r.missing));
  assert.equal(x.byType.food.nextLegacyTick,240);
});

test('stone has no regeneration proposal even when ecology is favorable',()=>{
  const s=createWorld(77),x=createResourceRegenerationShadow(s);
  for(const r of x.rows.filter(r=>r.type==='stone')){
    assert.equal(r.legacyPeriodTicks,null);assert.equal(r.legacyAmount,0);
    assert.equal(r.ecologyRegenerationPotential,0);assert.equal(r.nextLegacyTick,null);
  }
});

test('ecology evidence remains advisory and never changes node amounts',()=>{
  const s=createWorld(2026),before=s.nodes.map(n=>n.amount),x=createResourceRegenerationShadow(s);
  assert.ok(x.rows.some(r=>r.type==='food'&&r.ecologyRegenerationPotential>=0));
  assert.deepEqual(s.nodes.map(n=>n.amount),before);
});

test('observing WM4.0 every tick cannot change deterministic execution',()=>{
  const a=createWorld(9191),b=createWorld(9191);
  for(let i=0;i<360;i++){createResourceRegenerationShadow(a);step(a);step(b);}
  assert.equal(serialize(a),serialize(b));
});


test('wood boundary is exactly +1 at tick 720 and food remains +3',()=>{
  const s=createWorld(123);for(const n of s.nodes)n.amount=0;s.tick=720;
  const x=createResourceRegenerationShadow(s);
  const food=x.rows.filter(r=>r.type==='food'),wood=x.rows.filter(r=>r.type==='wood');
  assert.ok(food.every(r=>r.boundaryTick&&r.legacyIncrement===3));
  assert.ok(wood.every(r=>r.boundaryTick&&r.legacyIncrement===1));
});

test('full nodes propose zero increment even on a regeneration boundary',()=>{
  const s=createWorld(456);for(const n of s.nodes)n.amount=n.max;s.tick=720;
  const x=createResourceRegenerationShadow(s);
  assert.ok(x.rows.every(r=>r.legacyIncrement===0));
});


test('every regeneration observer row names the WM4.1 WorldSim writer',()=>{
  const x=createResourceRegenerationShadow(createWorld(8080));
  assert.ok(x.rows.length>0);
  assert.ok(x.rows.every(r=>r.authoritativeWriter==='worldsim-wm4.5'));
});
