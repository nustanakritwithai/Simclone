import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOOD_ECOLOGY_REFERENCE_SEEDS,
  FOOD_ECOLOGY_REFERENCE_TICKS,
  buildFoodEcologyReference
} from '../scripts/worldsim-food-ecology-reference.mjs';

test('food ecology reference covers locked seeds and regeneration boundaries',()=>{
  const x=buildFoodEcologyReference();
  assert.equal(x.rows.length,FOOD_ECOLOGY_REFERENCE_SEEDS.length*FOOD_ECOLOGY_REFERENCE_TICKS.length);
  for(const seed of FOOD_ECOLOGY_REFERENCE_SEEDS)for(const tick of FOOD_ECOLOGY_REFERENCE_TICKS)
    assert.ok(x.rows.some(r=>r.seed===seed&&r.tick===tick));
});

test('reference raw ecology evidence is bounded and percentile ordered',()=>{
  const x=buildFoodEcologyReference();
  for(const r of x.rows){
    assert.ok(r.nodes>0);
    assert.ok(r.rawMin>=0&&r.rawMax<=1);
    assert.ok(r.rawMin<=r.p10&&r.p10<=r.p50&&r.p50<=r.p90&&r.p90<=r.rawMax);
  }
});

test('relative bands classify every reference food node',()=>{
  const x=buildFoodEcologyReference();
  for(const r of x.rows){
    const total=Object.values(r.relativeBands).reduce((a,b)=>a+b,0);
    assert.equal(total,r.nodes);
  }
});

test('reference captures deterministic seasonal variation rather than assuming static ecology',()=>{
  const x=buildFoodEcologyReference();
  assert.ok(FOOD_ECOLOGY_REFERENCE_SEEDS.some(seed=>{
    const rows=x.rows.filter(r=>r.seed===seed);
    return new Set(rows.map(r=>r.average)).size>1;
  }));
});

test('reference report is deterministic',()=>{
  assert.deepEqual(buildFoodEcologyReference(),buildFoodEcologyReference());
});


test('reference matrix is emitted for formula selection evidence',()=>{console.log('WM4_REFERENCE_EVIDENCE '+JSON.stringify(buildFoodEcologyReference()));});
