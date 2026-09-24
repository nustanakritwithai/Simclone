import test from 'node:test';
import assert from 'node:assert/strict';
import {KINGDOM_STORAGE_VERSION,kingdomStorageCaps,kingdomFoodDecayRate,kingdomStorageSnapshot} from '../src/kingdom-storage.mjs';
import {createWorld,step,serialize,survivalSummary,validate} from '../src/engine.mjs';

test('K6 preserves donor village storage capacities',()=>{
  assert.equal(KINGDOM_STORAGE_VERSION,'K6-shadow-0.1');
  assert.deepEqual(kingdomStorageCaps(),{food:400,wood:200,stone:200});
  assert.deepEqual(kingdomStorageCaps({granary:true,warehouse:true}),{food:720,wood:360,stone:360});
});

test('K6 preserves donor food decay rates',()=>{
  assert.equal(kingdomFoodDecayRate(),0.012);
  assert.equal(kingdomFoodDecayRate({granary:true}),0.004);
});

test('K6 reports overflow and building pressure without mutation',()=>{
  const stock={food:500,wood:170,stone:210};
  const before=JSON.stringify(stock),s=kingdomStorageSnapshot({stock});
  assert.equal(s.overflow.food,100);
  assert.equal(s.overflow.stone,10);
  assert.equal(s.needsGranary,true);
  assert.equal(s.needsWarehouse,true);
  assert.equal(JSON.stringify(stock),before);
});

test('Granary projection reduces spoilage and removes cap pressure',()=>{
  const a=kingdomStorageSnapshot({stock:{food:350,wood:0,stone:0}});
  const b=kingdomStorageSnapshot({stock:{food:350,wood:0,stone:0},granary:true});
  assert.ok(b.projectedFoodDecay<a.projectedFoodDecay);
  assert.ok(b.utilization.food<a.utilization.food);
});

test('survival summary exposes K6 without changing stock',()=>{
  const s=createWorld(42),before=serialize(s),v=survivalSummary(s);
  assert.equal(v.kingdomStorage.version,KINGDOM_STORAGE_VERSION);
  assert.equal(v.kingdomStorage.mode,'shadow');
  assert.equal(serialize(s),before);
});

test('continuous K6 observation cannot change deterministic execution',()=>{
  const a=createWorld(666),b=createWorld(666);
  for(let i=0;i<720;i++){survivalSummary(a);step(a);step(b);}
  assert.equal(serialize(a),serialize(b));
  assert.deepEqual(validate(a),[]);
});
