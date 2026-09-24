import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,step} from '../src/engine.mjs';
import {createWorldMapView} from '../src/worldsim-map.mjs';
import {createClimateShadow} from '../src/worldsim-climate-shadow.mjs';
import {createSoilShadow,soilShadowForCell} from '../src/worldsim-soil-shadow.mjs';
import {HYDROLOGY_SHADOW_VERSION,downhillEvidence,hydrologyShadowForCell,createHydrologyShadow} from '../src/worldsim-hydrology-shadow.mjs';

test('hydrology shadow is deterministic, bounded and read-only',()=>{
  const s=createWorld(230926),before=serialize(s),view=createWorldMapView(s);
  const a=createHydrologyShadow(s,view),b=createHydrologyShadow(s,view);
  assert.equal(a.version,HYDROLOGY_SHADOW_VERSION);assert.deepEqual(a,b);assert.equal(serialize(s),before);assert.equal(a.cells.length,780);
  for(const c of a.cells)for(const k of ['surfaceWaterPotential','infiltrationPotential','runoffPotential','drainagePotential','groundwaterRechargePotential','evaporationPotential','floodRisk','soilWaterComfort','waterAvailability'])assert.ok(c[k]>=0&&c[k]<=1,k);
});

test('downhill evidence selects only a lower cardinal neighbor with deterministic tie-break',()=>{
  const s=createWorld(42),view=createWorldMapView(s);
  const candidate=view.cells.find(c=>downhillEvidence(view,c).targetIndex!==null);
  assert.ok(candidate);
  const flow=downhillEvidence(view,candidate),target=view.cells[flow.targetIndex];
  assert.ok(target.elevation<candidate.elevation);
  assert.deepEqual(flow,downhillEvidence(view,candidate));
});

test('greater compaction lowers infiltration and can raise runoff',()=>{
  const cell={terrainType:'grass',moisture:.55,elevation:.35};
  const climate={rainPotential:.7,solar:.5,humidity:.6,temperatureNorm:.6,temperatureC:25};
  const flow={targetIndex:2,gradient:.2,slope:.25};
  const loose=soilShadowForCell(cell,{occupied:false,climate:{temperatureComfort:.9}});
  const compact=Object.freeze({...loose,compaction:.9});
  const a=hydrologyShadowForCell(cell,loose,climate,flow),b=hydrologyShadowForCell(cell,compact,climate,flow);
  assert.ok(b.infiltrationPotential<a.infiltrationPotential);
  assert.ok(b.runoffPotential>=a.runoffPotential);
});

test('ocean cells expose water and flood evidence without creating reservoirs',()=>{
  const s=createWorld(77),view=createWorldMapView(s),climate=createClimateShadow(s,view),soil=createSoilShadow(s,view,climate),hydro=createHydrologyShadow(s,view,climate,soil);
  const water=view.cells.find(c=>c.terrainType==='deepWater'||c.terrainType==='shallowWater');assert.ok(water);
  const h=hydro.cells[water.index];assert.equal(h.waterAvailability,1);assert.equal(h.floodRisk,1);
  assert.equal('surfaceWater' in hydro,false);assert.equal('groundwater' in hydro,false);
  assert.equal(hydro.authority.surfaceWater,'not-owned');
});

test('recharge remains bounded by infiltration evidence',()=>{
  const s=createWorld(2026),h=createHydrologyShadow(s);
  for(const c of h.cells)assert.ok(c.groundwaterRechargePotential<=c.infiltrationPotential+1e-9);
});

test('observing hydrology every tick cannot alter deterministic execution',()=>{
  const a=createWorld(9191),b=createWorld(9191);
  for(let i=0;i<360;i++){createHydrologyShadow(a);step(a);step(b);}
  assert.equal(serialize(a),serialize(b));
});
