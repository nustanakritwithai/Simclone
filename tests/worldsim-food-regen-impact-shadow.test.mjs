import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,step} from '../src/engine.mjs';
import {createFoodRegenerationImpact} from '../src/worldsim-food-regen-impact-shadow.mjs';

test('WM4.2 impact report is deterministic and read-only',()=>{
  const s=createWorld(230926),before=serialize(s);
  const a=createFoodRegenerationImpact(s),b=createFoodRegenerationImpact(s);
  assert.deepEqual(a,b);assert.equal(serialize(s),before);
  assert.equal(a.authority.formula,'not-defined');
});

test('impact report preserves exact legacy food policy',()=>{
  const x=createFoodRegenerationImpact(createWorld(42));
  assert.deepEqual(x.legacyPolicy,{periodTicks:120,amount:3,renewable:true});
});

test('food potential distribution is ordered and bounded',()=>{
  const x=createFoodRegenerationImpact(createWorld(77)),s=x.stats;
  assert.ok(0<=s.min&&s.min<=s.p25&&s.p25<=s.median&&s.median<=s.p75&&s.p75<=s.max&&s.max<=1);
  for(const r of x.rows){assert.ok(r.ecologyPotential>=0&&r.ecologyPotential<=1);assert.ok(['low','middle','high'].includes(r.relativeClass));}
});

test('depletion counts reflect node state without creating a candidate unit rate',()=>{
  const s=createWorld(2026),food=s.nodes.filter(n=>n.type==='food');food[0].amount=0;
  const x=createFoodRegenerationImpact(s);
  assert.ok(x.stats.emptyNodes>=1);assert.ok(x.stats.depletedNodes>=1);
  assert.equal('candidateAmount' in x,false);
  assert.equal(x.rows.some(r=>'candidateAmount' in r),false);
});

test('observing impact every tick cannot alter deterministic execution',()=>{
  const a=createWorld(9191),b=createWorld(9191);
  for(let i=0;i<360;i++){createFoodRegenerationImpact(a);step(a);step(b);}
  assert.equal(serialize(a),serialize(b));
});
