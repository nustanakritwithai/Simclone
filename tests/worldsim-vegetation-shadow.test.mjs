import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,step} from '../src/engine.mjs';
import {createWorldMapView} from '../src/worldsim-map.mjs';
import {createClimateShadow} from '../src/worldsim-climate-shadow.mjs';
import {createSoilShadow,soilShadowForCell} from '../src/worldsim-soil-shadow.mjs';
import {createHydrologyShadow,hydrologyShadowForCell} from '../src/worldsim-hydrology-shadow.mjs';
import {VEGETATION_SHADOW_VERSION,vegetationShadowForCell,createVegetationShadow} from '../src/worldsim-vegetation-shadow.mjs';

test('vegetation shadow is deterministic, bounded and read-only',()=>{
  const s=createWorld(230926),before=serialize(s),view=createWorldMapView(s);
  const a=createVegetationShadow(s,view),b=createVegetationShadow(s,view);
  assert.equal(a.version,VEGETATION_SHADOW_VERSION);assert.deepEqual(a,b);assert.equal(serialize(s),before);assert.equal(a.cells.length,780);
  for(const c of a.cells)for(const k of ['groundCoverPotential','woodyBiomassPotential','wetlandBiomassPotential','livingBiomassPotential','deadBiomassPotential','litterPotential','foodYieldPotential','woodYieldPotential','regenerationPotential','disturbanceStress','carryingCapacity'])assert.ok(c[k]>=0&&c[k]<=1,k);
});

test('forest favors woody yield while healthy grass favors food yield',()=>{
  const climate={vegetationClimateFactor:.9,solar:.8,droughtPressure:.05,temperatureComfort:.95,humidity:.65};
  const hydro={soilWaterComfort:.85,waterAvailability:.82,floodRisk:.08};
  const forestCell={terrainType:'forest',walkable:true};
  const grassCell={terrainType:'grass',walkable:true};
  const soil={active:true,fertility:.85,health:.88,nutrient:.82,organicMatter:.72,depth:.8};
  const forest=vegetationShadowForCell(forestCell,soil,climate,hydro),grass=vegetationShadowForCell(grassCell,soil,climate,hydro);
  assert.ok(forest.woodYieldPotential>forest.foodYieldPotential);
  assert.ok(grass.foodYieldPotential>grass.woodYieldPotential);
});

test('drought lowers living biomass and regeneration',()=>{
  const cell={terrainType:'grass',walkable:true},soil={active:true,fertility:.8,health:.85,nutrient:.8,organicMatter:.6,depth:.75};
  const hydro={soilWaterComfort:.72,waterAvailability:.68,floodRisk:.05};
  const wet={vegetationClimateFactor:.9,solar:.7,droughtPressure:.05,temperatureComfort:.92,humidity:.7};
  const dry={...wet,droughtPressure:.95,vegetationClimateFactor:.55};
  const a=vegetationShadowForCell(cell,soil,wet,hydro),b=vegetationShadowForCell(cell,soil,dry,hydro);
  assert.ok(b.livingBiomassPotential<a.livingBiomassPotential);
  assert.ok(b.regenerationPotential<a.regenerationPotential);
});

test('blocked water carries no normal vegetation biomass potential',()=>{
  const s=createWorld(77),view=createWorldMapView(s),climate=createClimateShadow(s,view),soil=createSoilShadow(s,view,climate),hydro=createHydrologyShadow(s,view,climate,soil),veg=createVegetationShadow(s,view,climate,soil,hydro);
  const deep=view.cells.find(c=>c.terrainType==='deepWater');assert.ok(deep);
  const v=veg.cells[deep.index];assert.equal(v.livingBiomassPotential,0);assert.equal(v.foodYieldPotential,0);assert.equal(v.woodYieldPotential,0);
});

test('hotspots are bounded and deterministically ordered',()=>{
  const v=createVegetationShadow(createWorld(2026));
  for(const type of ['food','wood','regeneration']){
    assert.ok(v.hotspots[type].length<=12);
    for(let i=1;i<v.hotspots[type].length;i++)assert.ok(v.hotspots[type][i-1].value>=v.hotspots[type][i].value);
  }
});

test('observing vegetation every tick cannot alter deterministic execution',()=>{
  const a=createWorld(9191),b=createWorld(9191);
  for(let i=0;i<360;i++){createVegetationShadow(a);step(a);step(b);}
  assert.equal(serialize(a),serialize(b));
});
