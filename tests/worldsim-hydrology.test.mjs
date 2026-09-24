import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorldMap} from '../src/worldsim-map.mjs';
import {createWorldHydrology,stepWorldHydrology,validateWorldHydrology,hydrologySummary} from '../src/worldsim-hydrology.mjs';

const total=m=>m.surfaceWater.reduce((s,v,i)=>s+v+m.soilMoisture[i]+m.groundwater[i],0);

test('hydrology state is deterministic and valid',()=>{
 const a=generateWorldMap(230926),b=generateWorldMap(230926),ha=createWorldHydrology(),hb=createWorldHydrology();
 stepWorldHydrology(a,ha,200);stepWorldHydrology(b,hb,200);assert.deepEqual(a,b);assert.deepEqual(ha,hb);assert.deepEqual(validateWorldHydrology(ha),[]);
});
test('internal flow and absorption conserve water apart from explicit rain/evaporation',()=>{
 const m=generateWorldMap(42),h=createWorldHydrology(),before=total(m);stepWorldHydrology(m,h,1);const after=total(m);
 assert.ok(Math.abs((after-before)-h.lastRainfall+h.lastEvaporation)<1e-9);assert.ok(h.lastConservationError<1e-9);
});
test('surface flow never drains ocean below base sea depth',()=>{
 const m=generateWorldMap(99),h=createWorldHydrology();stepWorldHydrology(m,h,500);
 for(let i=0;i<m.surfaceWater.length;i++)assert.ok(m.surfaceWater[i]+1e-12>=m.baseSeaDepth[i]);
});
test('rain and evaporation accounting are monotonic',()=>{
 const m=generateWorldMap(7),h=createWorldHydrology();stepWorldHydrology(m,h,100);
 assert.ok(h.totalRainfall>=h.lastRainfall);assert.ok(h.totalEvaporation>=h.lastEvaporation);assert.equal(h.tick,100);
});
test('hydrology summary is read-only',()=>{
 const m=generateWorldMap(17),h=createWorldHydrology();stepWorldHydrology(m,h,3);const before=JSON.stringify([m,h]);const s=hydrologySummary(m,h);
 assert.ok(s.surface>=0&&s.soil>=0&&s.groundwater>=0);assert.equal(JSON.stringify([m,h]),before);
});
