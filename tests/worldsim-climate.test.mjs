import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorldMap} from '../src/worldsim-map.mjs';
import {createWorldHydrology,stepWorldHydrology} from '../src/worldsim-hydrology.mjs';
import {createWorldClimate,stepWorldClimate,validateWorldClimate,climateSummary} from '../src/worldsim-climate.mjs';

test('climate evolves deterministically from identical worlds',()=>{
 const a=generateWorldMap(42),b=generateWorldMap(42),ha=createWorldHydrology(),hb=createWorldHydrology(),ca=createWorldClimate(a),cb=createWorldClimate(b);
 for(let i=0;i<300;i++){stepWorldHydrology(a,ha,1,ca);stepWorldClimate(a,ca);stepWorldHydrology(b,hb,1,cb);stepWorldClimate(b,cb);}
 assert.deepEqual(a,b);assert.deepEqual(ca,cb);assert.deepEqual(validateWorldClimate(ca,a.width*a.height),[]);
});
test('hydrology evaporation enters climate atmosphere instead of disappearing',()=>{
 const m=generateWorldMap(9),h=createWorldHydrology(),c=createWorldClimate(m),before=c.atmosphericWater.reduce((s,v)=>s+v,0);
 stepWorldHydrology(m,h,1,c);const after=c.atmosphericWater.reduce((s,v)=>s+v,0);
 assert.ok(after>=before);assert.ok(c.totalEvaporationReceived>=0);
});
test('climate combined water closes across evaporation and rainfall',()=>{
 const m=generateWorldMap(77),h=createWorldHydrology(),c=createWorldClimate(m);
 for(let i=0;i<200;i++){stepWorldHydrology(m,h,1,c);stepWorldClimate(m,c);}
 assert.ok(c.lastCombinedWaterError<1e-8);
});
test('world time advances four game minutes per engine climate step',()=>{
 const m=generateWorldMap(1),c=createWorldClimate(m);stepWorldClimate(m,c,15);assert.equal(c.totalMinutes,540);assert.equal(climateSummary(m,c).hour,9);
});
test('rainfall and weather are derived fields, not random events',()=>{
 const m=generateWorldMap(123),c=createWorldClimate(m);for(let i=0;i<600;i++)stepWorldClimate(m,c);
 assert.ok(m.rainfall.every(v=>v>=0));assert.ok(m.weather.every(v=>Number.isInteger(v)&&v>=0&&v<=5));
});
