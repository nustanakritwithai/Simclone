import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,step} from '../src/engine.mjs';
import {createFoodRegenerationImpact} from '../src/worldsim-food-regen-impact.mjs';

test('WM4.2 impact report is deterministic and read-only',()=>{
  const s=createWorld(230926),before=serialize(s);
  const a=createFoodRegenerationImpact(s),b=createFoodRegenerationImpact(s);
  assert.deepEqual(a,b);assert.equal(serialize(s),before);
  assert.equal(a.authority.unitFormula,'none');
  assert.equal(a.authority.writer,'worldsim-wm4.1');
  assert.deepEqual(a.legacy,{periodTicks:120,amount:3});
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
