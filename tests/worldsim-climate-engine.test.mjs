import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore,validate} from '../src/engine.mjs';
import {WORLD_CLIMATE_VERSION,climateSummary} from '../src/worldsim-climate.mjs';

test('engine world owns climate atmosphere separate from hydrology reservoirs',()=>{
 const s=createWorld(230926);
 assert.equal(s.worldClimate.version,WORLD_CLIMATE_VERSION);
 assert.ok(Array.isArray(s.worldClimate.atmosphericWater));
 assert.ok(Array.isArray(s.worldClimate.cloudWater));
 assert.equal('surfaceWater' in s.worldClimate,false);
});
test('engine tick advances hydrology then climate exactly once',()=>{
 const s=createWorld(42),h=s.worldHydrology.tick,c=s.worldClimate.tick;step(s);
 assert.equal(s.worldHydrology.tick,h+1);assert.equal(s.worldClimate.tick,c+1);
});
test('climate continuation survives save restore byte-identically',()=>{
 const a=createWorld(77);step(a,240);const b=restore(serialize(a));step(a,400);step(b,400);assert.equal(serialize(a),serialize(b));
});
test('dynamic climate fields survive an immediate save restore',()=>{
 const a=createWorld(99);step(a,180);const rain=[...a.worldMap.rainfall],dry=[...a.worldMap.droughtPressure],weather=[...a.worldMap.weather];
 const b=restore(serialize(a));assert.deepEqual(b.worldMap.rainfall,rain);assert.deepEqual(b.worldMap.droughtPressure,dry);assert.deepEqual(b.worldMap.weather,weather);
});
test('long climate run remains valid and conserves closed atmospheric transfers',()=>{
 const s=createWorld(123);step(s,3000);assert.deepEqual(validate(s),[]);
 const summary=climateSummary(s.worldMap,s.worldClimate);assert.ok(summary.conservationError<1e-8);
});
