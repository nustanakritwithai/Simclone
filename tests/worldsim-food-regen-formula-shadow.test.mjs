import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,step} from '../src/engine.mjs';
import {candidateFoodIncrement,createFoodFormulaShadow} from '../src/worldsim-food-regen-formula-shadow.mjs';

test('WM4.3 candidate formula is bounded and monotonic',()=>{
  assert.equal(candidateFoodIncrement(0,99),0);
  assert.equal(candidateFoodIncrement(.2499,99),0);
  assert.equal(candidateFoodIncrement(.25,99),1);
  assert.equal(candidateFoodIncrement(.5,99),2);
  assert.equal(candidateFoodIncrement(.75,99),3);
  assert.equal(candidateFoodIncrement(1,99),3);
  assert.equal(candidateFoodIncrement(1,2),2);
  let prev=-1;
  for(let i=0;i<=100;i++){const n=candidateFoodIncrement(i/100,99);assert.ok(n>=prev&&n<=3);prev=n;}
});

test('WM4.3 formula shadow is deterministic and read-only',()=>{
  const s=createWorld(230926),before=serialize(s);
  const a=createFoodFormulaShadow(s),b=createFoodFormulaShadow(s);
  assert.deepEqual(a,b);assert.equal(serialize(s),before);
  assert.equal(a.authority.mutation,false);
  assert.equal(a.authority.authoritativeWriter,'worldsim-wm4.1');
});

test('candidate never exceeds legacy +3 or node missing room',()=>{
  const x=createFoodFormulaShadow(createWorld(42));
  for(const r of x.rows){
    assert.ok(r.candidateIncrement>=0&&r.candidateIncrement<=3);
    assert.ok(r.candidateIncrement<=r.missing);
    assert.ok(r.candidateIncrement<=r.legacyIncrementAtBoundary);
  }
});

test('WM4.3 can only reduce legacy food regeneration in this gate',()=>{
  const x=createFoodFormulaShadow(createWorld(77));
  assert.ok(x.summary.candidateBoundaryUnits<=x.summary.legacyBoundaryUnits);
  assert.ok(x.summary.unitDelta<=0);
  assert.ok(x.summary.reductionRatio>=0&&x.summary.reductionRatio<=1);
});

test('observing formula shadow every tick cannot alter deterministic execution',()=>{
  const a=createWorld(9191),b=createWorld(9191);
  for(let i=0;i<240;i++){createFoodFormulaShadow(a);step(a);step(b);}
  assert.equal(serialize(a),serialize(b));
});
