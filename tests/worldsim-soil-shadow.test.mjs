import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,step} from '../src/engine.mjs';
import {createWorldMapView} from '../src/worldsim-map.mjs';
import {SOIL_TYPES,SOIL_PROFILE_PROXY,classifySoilShadow,soilShadowForCell,createSoilShadow} from '../src/worldsim-soil-shadow.mjs';

test('soil shadow is deterministic, bounded and read-only',()=>{
  const s=createWorld(230926),before=serialize(s),view=createWorldMapView(s);
  const a=createSoilShadow(s,view),b=createSoilShadow(s,view);
  assert.deepEqual(a,b);assert.equal(serialize(s),before);assert.equal(a.cells.length,780);
  for(const c of a.cells)for(const k of ['health','fertility','nutrient','organicMatter','compaction','salinity','acidityStress','temperatureComfort'])assert.ok(c[k]>=0&&c[k]<=1,k);
});

test('soil classification follows physical terrain rules',()=>{
  assert.equal(classifySoilShadow({terrainType:'deepWater',moisture:1,elevation:0}),'none');
  assert.equal(classifySoilShadow({terrainType:'shallowWater',moisture:1,elevation:0}),'coastal');
  assert.equal(classifySoilShadow({terrainType:'rock',moisture:.3,elevation:.7}),'rocky');
  assert.equal(classifySoilShadow({terrainType:'sand',moisture:.2,elevation:.2}),'sand');
  assert.equal(classifySoilShadow({terrainType:'forest',moisture:.9,elevation:.3}),'peat');
  assert.equal(classifySoilShadow({terrainType:'grass',moisture:.7,elevation:.5}),'clay');
  assert.equal(classifySoilShadow({terrainType:'grass',moisture:.5,elevation:.5}),'loam');
});

test('all soil profiles are normalized integration proxies',()=>{
  assert.deepEqual(Object.keys(SOIL_PROFILE_PROXY),SOIL_TYPES);
  for(const p of Object.values(SOIL_PROFILE_PROXY))for(const v of Object.values(p))assert.ok(v>=0&&v<=1);
});

test('path and occupied ground carry stronger compaction pressure',()=>{
  const base={terrainType:'grass',moisture:.55,elevation:.45};
  const grass=soilShadowForCell(base),occupied=soilShadowForCell(base,{occupied:true});
  const path=soilShadowForCell({...base,terrainType:'path'});
  assert.ok(occupied.compaction>grass.compaction);assert.ok(path.compaction>grass.compaction);
  assert.ok(path.health<=grass.health);
});

test('healthy loam outperforms rocky soil in fertility',()=>{
  const loam=soilShadowForCell({terrainType:'grass',moisture:.56,elevation:.4});
  const rocky=soilShadowForCell({terrainType:'rock',moisture:.32,elevation:.72});
  assert.equal(loam.soilType,'loam');assert.equal(rocky.soilType,'rocky');assert.ok(loam.fertility>rocky.fertility);
});

test('observing soil every tick cannot change deterministic execution',()=>{
  const a=createWorld(9191),b=createWorld(9191);
  for(let i=0;i<360;i++){createSoilShadow(a);step(a);step(b);}
  assert.equal(serialize(a),serialize(b));
});

test('soil summary carries WM3.2 climate evidence without owning climate state',()=>{
  const s=createWorld(42),shadow=createSoilShadow(s);
  assert.equal(typeof shadow.climateSummary.averageTemperatureC,'number');
  assert.equal(typeof shadow.summary.averageTemperatureComfort,'number');
  assert.equal(shadow.authority.water,'not-owned');
});
