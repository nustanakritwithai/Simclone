import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore} from '../src/engine.mjs';
import {K6_RESOURCE_REGEN} from '../src/worldsim-resource-policy.mjs?v=0.5.0';
import {createResourceEcologyShadow} from '../src/worldsim-resource-shadow.mjs?v=0.5.0';
import {
  RESOURCE_REGEN_AUTHORITY,
  FOOD_ECOLOGY_POLICY,
  foodEcologyIncrement,
  applyWorldResourceRegeneration
} from '../src/worldsim-resource-authority.mjs';

function legacyOracle(s){
  if(s.tick%120===0)for(const n of s.nodes)if(n.type==='food')n.amount=Math.min(n.max,n.amount+3);
  if(s.tick%720===0)for(const n of s.nodes)if(n.type==='wood')n.amount=Math.min(n.max,n.amount+1);
}
function fixture(tick){
  const s=createWorld(230926);s.tick=tick;
  for(const n of s.nodes)n.amount=Math.max(0,Math.min(n.max,(n.id*7+tick)%Math.max(1,n.max)));
  return s;
}

test('WM4.5 keeps one WorldSim writer and changes food policy only',()=>{
  assert.equal(RESOURCE_REGEN_AUTHORITY.writer,'worldsim-wm4.5');
  assert.equal(RESOURCE_REGEN_AUTHORITY.behavior,'ecology-food-v1');
  assert.equal(RESOURCE_REGEN_AUTHORITY.food,K6_RESOURCE_REGEN.food);
  assert.equal(RESOURCE_REGEN_AUTHORITY.wood,K6_RESOURCE_REGEN.wood);
  assert.equal(RESOURCE_REGEN_AUTHORITY.stone,K6_RESOURCE_REGEN.stone);
  assert.equal(RESOURCE_REGEN_AUTHORITY.foodPolicy,FOOD_ECOLOGY_POLICY);
  assert.equal(RESOURCE_REGEN_AUTHORITY.wood.amount,1);
  assert.equal(RESOURCE_REGEN_AUTHORITY.stone.amount,0);
});

test('selected conservative formula has locked absolute thresholds',()=>{
  const samples=[
    [0,0],[.0029,0],[.003,1],[.0099,1],[.01,2],[.0249,2],[.025,3],[1,3]
  ];
  for(const [potential,expected] of samples)assert.equal(foodEcologyIncrement(potential),expected);
  for(const bad of [-.01,1.01,NaN,Infinity,null])assert.throws(()=>foodEcologyIncrement(bad));
});

test('legacy reference mode still matches historical K6 oracle',()=>{
  for(const tick of [1,119,120,239,240,719,720,721,1439,1440]){
    const a=fixture(tick),b=structuredClone(a);
    applyWorldResourceRegeneration(a,{foodMode:'legacy'});legacyOracle(b);
    assert.deepEqual(a.nodes,b.nodes,'tick '+tick);
  }
});

test('ecology mode maps each depleted food node from authoritative vegetation evidence',()=>{
  const s=createWorld(42);s.tick=120;for(const n of s.nodes)n.amount=0;
  const ecology=createResourceEcologyShadow(s);
  const expected=new Map(s.nodes.filter(n=>n.type==='food').map(n=>[
    n.id,foodEcologyIncrement(ecology.cells[n.y*30+n.x].vegetationRegenerationPotential)
  ]));
  applyWorldResourceRegeneration(s);
  const food=s.nodes.filter(n=>n.type==='food');
  assert.ok(food.length>0);
  for(const n of food)assert.equal(n.amount,expected.get(n.id));
  assert.ok(food.some(n=>n.amount<3),'candidate must create real ecology pressure');
  assert.ok(food.some(n=>n.amount>0),'candidate must retain renewable food');
});

test('wood stays +1/720 and stone stays finite under WM4.5',()=>{
  const s=createWorld(77);s.tick=720;for(const n of s.nodes)n.amount=0;
  applyWorldResourceRegeneration(s);
  assert.ok(s.nodes.filter(n=>n.type==='wood').every(n=>n.amount===1));
  assert.ok(s.nodes.filter(n=>n.type==='stone').every(n=>n.amount===0));
});

test('engine defaults to ecology authority while legacy mode is test-only A/B reference',()=>{
  const ecology=createWorld(2026),legacy=createWorld(2026);
  ecology.tick=legacy.tick=119;
  ecology.stock.food=ecology.stock.wood=ecology.stock.stone=999;
  legacy.stock.food=legacy.stock.wood=legacy.stock.stone=999;
  for(const s of [ecology,legacy])for(const n of s.nodes)n.amount=0;
  step(ecology,1);step(legacy,1,{resourceRegenerationMode:'legacy'});
  const ecoFood=ecology.nodes.filter(n=>n.type==='food').map(n=>n.amount);
  const legacyFood=legacy.nodes.filter(n=>n.type==='food').map(n=>n.amount);
  assert.ok(legacyFood.every(n=>n===3));
  assert.ok(ecoFood.every(n=>Number.isInteger(n)&&n>=0&&n<=3));
  assert.notDeepEqual(ecoFood,legacyFood);
});

test('WM4.5 adds no save fields and save/load continuation remains deterministic',()=>{
  const a=createWorld(9),keys=Object.keys(JSON.parse(serialize(a))).sort();
  step(a,180);
  const b=restore(serialize(a));
  step(a,540);step(b,540);
  assert.equal(serialize(a),serialize(b));
  assert.deepEqual(Object.keys(JSON.parse(serialize(a))).sort(),keys);
});

test('same seed and same regeneration mode replay byte-identically',()=>{
  for(const mode of ['ecology','legacy']){
    const a=createWorld(31415),b=createWorld(31415);
    step(a,1440,{resourceRegenerationMode:mode});
    for(let i=0;i<12;i++)step(b,120,{resourceRegenerationMode:mode});
    assert.equal(serialize(a),serialize(b),mode);
  }
});

test('invalid regeneration mode is rejected before advancing the world',()=>{
  const s=createWorld(5),before=serialize(s);
  assert.throws(()=>step(s,1,{resourceRegenerationMode:'other'}));
  assert.equal(serialize(s),before);
});
