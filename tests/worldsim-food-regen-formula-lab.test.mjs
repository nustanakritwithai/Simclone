import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize} from '../src/engine.mjs';
import {evaluateFoodRegenerationFormula} from '../src/worldsim-food-regen-formula-lab.mjs';

test('formula lab is read-only and preserves current writer metadata',()=>{
  const s=createWorld(230926),before=serialize(s);
  const x=evaluateFoodRegenerationFormula(s,()=>3);
  assert.equal(serialize(s),before);
  assert.equal(x.authority.writer,'worldsim-wm4.5');
  assert.equal(x.authority.cadenceTicks,120);
  assert.equal(x.authority.mutatesNodes,false);
});

test('legacy-equivalent formula produces zero aggregate delta',()=>{
  const x=evaluateFoodRegenerationFormula(createWorld(42),()=>3);
  assert.equal(x.summary.deltaUnits,0);
  assert.equal(x.summary.suppressedUnits,0);
  assert.equal(x.summary.changedNodes,0);
});

test('formula lab rejects non-integer or out-of-range increments',()=>{
  for(const bad of [-1,4,1.5,NaN,null]){
    assert.throws(()=>evaluateFoodRegenerationFormula(createWorld(77),()=>bad));
  }
});

test('zero candidate can only suppress legacy units and never exceed missing capacity',()=>{
  const x=evaluateFoodRegenerationFormula(createWorld(2026),()=>0);
  assert.ok(x.summary.candidateUnits<=x.summary.legacyUnits);
  assert.ok(x.summary.suppressedUnits>=0);
  for(const r of x.rows){
    assert.equal(r.candidateIncrement,0);
    assert.ok(r.candidateIncrement<=r.missing);
  }
});

test('candidate callback receives frozen evidence row',()=>{
  let saw=false;
  evaluateFoodRegenerationFormula(createWorld(9),row=>{
    saw=true;assert.equal(Object.isFrozen(row),true);return 3;
  });
  assert.equal(saw,true);
});
