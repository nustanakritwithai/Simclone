import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,step} from '../src/engine.mjs';
import {K6_RESOURCE_REGEN} from '../src/worldsim-resource-policy.mjs?v=0.5.0';
import {createFoodRegenerationImpact} from '../src/worldsim-food-regen-impact.mjs';

test('WM4.2 impact report is deterministic and read-only',()=>{
  const s=createWorld(230926),before=serialize(s);
  const a=createFoodRegenerationImpact(s),b=createFoodRegenerationImpact(s);
  assert.deepEqual(a,b);assert.equal(serialize(s),before);
  assert.equal(a.authority.unitFormula,'none');
  assert.equal(a.authority.writer,'worldsim-wm4.1');
  assert.equal(a.legacy,K6_RESOURCE_REGEN.food);
  assert.equal(a.legacy.periodTicks,120);assert.equal(a.legacy.amount,3);assert.equal(a.legacy.renewable,true);
});

test('every food node is classified into exactly one ecology band',()=>{
  const x=createFoodRegenerationImpact(createWorld(42));
  const total=Object.values(x.summary.bands).reduce((a,b)=>a+b,0);
  assert.equal(total,x.summary.nodes);
  assert.equal(x.rows.length,x.summary.nodes);
});

test('impact report never proposes a replacement unit increment',()=>{
  const x=createFoodRegenerationImpact(createWorld(77));
  for(const r of x.rows){
    assert.equal('candidateIncrement' in r,false);
    assert.equal(r.legacyAmount,3);
    assert.equal(r.legacyPeriodTicks,120);
    assert.equal(r.authoritativeWriter,'worldsim-wm4.1');
  }
});

test('highest and lowest lists are deterministic by ecology potential then id',()=>{
  const x=createFoodRegenerationImpact(createWorld(2026));
  for(const list of [x.highest,x.lowest]){
    assert.ok(list.length<=8);
  }
  for(let i=1;i<x.highest.length;i++){
    const a=x.highest[i-1],b=x.highest[i];
    assert.ok(a.ecologyRegenerationPotential>b.ecologyRegenerationPotential||
      a.ecologyRegenerationPotential===b.ecologyRegenerationPotential&&a.id<b.id);
  }
});

test('observing food impact every tick cannot alter deterministic execution',()=>{
  const a=createWorld(9191),b=createWorld(9191);
  for(let i=0;i<240;i++){createFoodRegenerationImpact(a);step(a);step(b);}
  assert.equal(serialize(a),serialize(b));
});


test('WM4.2 reports bounded ecology percentiles and depletion counts',()=>{
  const x=createFoodRegenerationImpact(createWorld(5150));
  assert.ok(x.summary.p10>=0&&x.summary.p10<=x.summary.p50);
  assert.ok(x.summary.p50<=x.summary.p90&&x.summary.p90<=1);
  assert.ok(x.summary.depletedNodes>=0&&x.summary.depletedNodes<=x.summary.nodes);
  assert.ok(x.summary.lowPotentialDepletedNodes>=0&&x.summary.lowPotentialDepletedNodes<=x.summary.depletedNodes);
});


test('WM4.2 quantifies legacy boundary units without proposing ecology units',()=>{
  const x=createFoodRegenerationImpact(createWorld(6161));
  assert.ok(x.summary.projectedLegacyBoundaryUnits>=0);
  assert.ok(x.summary.projectedLowEcologyBoundaryUnits>=0);
  assert.ok(x.summary.projectedLowEcologyBoundaryUnits<=x.summary.projectedLegacyBoundaryUnits);
  assert.equal(x.authority.unitFormula,'none');
});
