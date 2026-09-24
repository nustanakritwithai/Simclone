import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,step} from '../src/engine.mjs';
import {createFoodRegenerationImpact} from '../src/worldsim-food-regen-impact.mjs';

test('WM4.2 impact report is deterministic and read-only',()=>{
  const s=createWorld(230926),before=serialize(s);
  const a=createFoodRegenerationImpact(s),b=createFoodRegenerationImpact(s);
  assert.deepEqual(a,b);assert.equal(serialize(s),before);
  assert.equal(a.authority.unitFormula,'none');
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


test('impact distribution summary is bounded and ordered',()=>{
  const x=createFoodRegenerationImpact(createWorld(31415)),s=x.summary;
  for(const k of ['averageEcologyPotential','medianEcologyPotential','minEcologyPotential','maxEcologyPotential','missingWeightedEcologyPotential'])
    assert.ok(s[k]>=0&&s[k]<=1,k);
  assert.ok(s.minEcologyPotential<=s.medianEcologyPotential);
  assert.ok(s.medianEcologyPotential<=s.maxEcologyPotential);
});


test('canonical seeds emit bounded WM4.2 food-boundary ecology evidence',()=>{
  const report=[];
  for(const seed of [1,42,2026,230926,90001]){
    const phases=[];
    for(const tick of [120,240,360]){
      const world=createWorld(seed);world.tick=tick;for(const n of world.nodes)if(n.type==='food')n.amount=0;
      const x=createFoodRegenerationImpact(world),s=x.summary;
      phases.push({
        tick,nodes:s.nodes,avg:s.averageEcologyPotential,median:s.medianEcologyPotential,
        min:s.minEcologyPotential,max:s.maxEcologyPotential,weighted:s.missingWeightedEcologyPotential,
        bands:s.bands
      });
      assert.ok(s.nodes>0);
      assert.ok(s.minEcologyPotential>=0&&s.maxEcologyPotential<=1);
      assert.ok(s.minEcologyPotential<=s.averageEcologyPotential&&s.averageEcologyPotential<=s.maxEcologyPotential);
    }
    report.push({seed,phases});
  }
  console.log('WM4.2_CANONICAL_DEPLETED_FOOD_BOUNDARY_IMPACT '+JSON.stringify(report));
});


test('WM4.2 diagnostic bands match the observed ecology scale but are not a unit formula',()=>{
  const s=createWorld(5150);for(const n of s.nodes)if(n.type==='food')n.amount=0;
  const x=createFoodRegenerationImpact(s);
  assert.equal(x.authority.writer,'worldsim-wm4.1');
  assert.equal(x.authority.unitFormula,'none');
  for(const r of x.rows){
    const expected=r.ecologyRegenerationPotential<.04?'very-low':
      r.ecologyRegenerationPotential<.08?'low':
      r.ecologyRegenerationPotential<.12?'medium':'high';
    assert.equal(r.ecologyBand,expected);
  }
});
