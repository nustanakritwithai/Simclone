import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore,validate} from '../src/engine.mjs';
import {WORLD_HYDROLOGY_VERSION} from '../src/worldsim-hydrology.mjs';

test('engine world owns hydrology metadata with no duplicate reservoirs',()=>{
 const s=createWorld(230926);
 assert.equal(s.worldHydrology.version,WORLD_HYDROLOGY_VERSION);
 assert.ok(Array.isArray(s.worldMap.surfaceWater));
 assert.equal('surfaceWater' in s.worldHydrology,false);
 assert.equal('soilMoisture' in s.worldHydrology,false);
 assert.equal('groundwater' in s.worldHydrology,false);
});
test('one engine tick advances one deterministic hydrology tick',()=>{
 const s=createWorld(230926),before=s.worldHydrology.tick;step(s);assert.equal(s.worldHydrology.tick,before+1);
});
test('hydrology continuation survives save restore byte-identically',()=>{
 const a=createWorld(77);step(a,120);const b=restore(serialize(a));step(a,200);step(b,200);assert.equal(serialize(a),serialize(b));
});
test('hydrology remains valid during long engine simulation',()=>{
 const s=createWorld(42);step(s,5000);assert.deepEqual(validate(s),[]);assert.ok(s.worldHydrology.lastConservationError<1e-8);
});
test('current map save missing hydrology metadata migrates without map regeneration',()=>{
 const s=createWorld(999),map=JSON.stringify(s.worldMap);delete s.worldHydrology;
 const r=restore(JSON.stringify(s));assert.equal(JSON.stringify(r.worldMap),map);assert.equal(r.worldHydrology.version,WORLD_HYDROLOGY_VERSION);
});
