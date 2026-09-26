import test from 'node:test';
import assert from 'node:assert/strict';
import {RESOURCE_REGEN_AUTHORITY} from '../src/worldsim-resource-authority.mjs';
import {createWorld,serialize} from '../src/engine.mjs';
import {calibrateFoodEcology} from '../src/worldsim-food-regen-calibration.mjs';

test('food ecology calibration is deterministic and read-only',()=>{
  const s=createWorld(230926),before=serialize(s);
  const a=calibrateFoodEcology(s),b=calibrateFoodEcology(s);
  assert.deepEqual(a,b);assert.equal(serialize(s),before);
  assert.equal(a.authority.writer,RESOURCE_REGEN_AUTHORITY.writer);
  assert.equal(a.authority.mutatesNodes,false);
  assert.equal(a.authority.unitFormula,'none');
});

test('every calibrated food node has bounded rank and one relative band',()=>{
  const x=calibrateFoodEcology(createWorld(42));
  const count=Object.values(x.summary.relativeBands).reduce((a,b)=>a+b,0);
  assert.equal(count,x.summary.nodes);
  for(const r of x.rows){
    assert.ok(r.relativeRank>=0&&r.relativeRank<=1);
    assert.ok(['q1','q2','q3','q4'].includes(r.relativeBand));
  }
});

test('relative rank is monotonic with raw ecology potential',()=>{
  const rows=calibrateFoodEcology(createWorld(2026)).rows.slice()
    .sort((a,b)=>a.rawPotential-b.rawPotential||a.id-b.id);
  for(let i=1;i<rows.length;i++)assert.ok(rows[i].relativeRank>=rows[i-1].relativeRank);
});

test('equal raw potentials receive the same deterministic midpoint rank',()=>{
  const fakeImpact={
    authority:{writer:'worldsim-wm4.5'},
    summary:{p10:.1,p50:.1,p90:.1},
    rows:[
      {id:1,x:0,y:0,ecologyRegenerationPotential:.1,missing:3,legacyIncrement:3},
      {id:2,x:1,y:0,ecologyRegenerationPotential:.1,missing:3,legacyIncrement:3},
      {id:3,x:2,y:0,ecologyRegenerationPotential:.1,missing:3,legacyIncrement:3}
    ]
  };
  const x=calibrateFoodEcology({},fakeImpact);
  assert.ok(x.rows.every(r=>r.relativeRank===.5));
});

test('calibration preserves raw p10/p50/p90 evidence',()=>{
  const x=calibrateFoodEcology(createWorld(90001));
  assert.ok(x.summary.rawP10<=x.summary.rawP50);
  assert.ok(x.summary.rawP50<=x.summary.rawP90);
  assert.ok(x.summary.rawMin<=x.summary.rawP10);
  assert.ok(x.summary.rawP90<=x.summary.rawMax);
});
