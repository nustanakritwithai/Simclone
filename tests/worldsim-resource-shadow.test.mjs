import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,step} from '../src/engine.mjs';
import {createWorldMapView} from '../src/worldsim-map.mjs';
import {createSoilShadow} from '../src/worldsim-soil-shadow.mjs';
import {createClimateShadow} from '../src/worldsim-climate-shadow.mjs';
import {createHydrologyShadow} from '../src/worldsim-hydrology-shadow.mjs';
import {createVegetationShadow} from '../src/worldsim-vegetation-shadow.mjs';
import {RESOURCE_ECOLOGY_SHADOW_VERSION,resourceSuitabilityForCell,createResourceEcologyShadow,shadowExistingResourcePressure} from '../src/worldsim-resource-shadow.mjs';

test('resource ecology shadow is deterministic and read-only',()=>{
  const s=createWorld(230926),before=serialize(s);
  const a=createResourceEcologyShadow(s),b=createResourceEcologyShadow(s);
  assert.equal(a.version,RESOURCE_ECOLOGY_SHADOW_VERSION);assert.deepEqual(a,b);assert.equal(serialize(s),before);
});
test('forest favors wood, grass favors food, rock favors stone',()=>{
  const view=createWorldMapView(createWorld(42));
  const forest=view.cells.find(c=>c.terrainType==='forest'),grass=view.cells.find(c=>c.terrainType==='grass'),rock=view.cells.find(c=>c.terrainType==='rock');
  assert.ok(forest&&grass&&rock);
  assert.ok(resourceSuitabilityForCell(forest).wood>=resourceSuitabilityForCell(forest).food);
  assert.ok(resourceSuitabilityForCell(grass).food>=resourceSuitabilityForCell(grass).wood);
  assert.ok(resourceSuitabilityForCell(rock).stone>=resourceSuitabilityForCell(rock).food);
});
test('water has zero resource suitability',()=>{
  const view=createWorldMapView(createWorld(77)),water=view.cells.find(c=>c.gameplayTile==='water');assert.ok(water);
  assert.deepEqual(resourceSuitabilityForCell(water),{food:0,wood:0,stone:0});
});
test('hotspots are bounded and sorted deterministically',()=>{
  const s=createWorld(2026),x=createResourceEcologyShadow(s);
  for(const type of ['food','wood','stone']){
    assert.ok(x.hotspots[type].length<=12);
    for(let i=1;i<x.hotspots[type].length;i++)assert.ok(x.hotspots[type][i-1].suitability>=x.hotspots[type][i].suitability);
  }
});
test('existing-node regeneration pressure rises with depletion without mutating resources',()=>{
  const s=createWorld(9),n=s.nodes.find(x=>x.type==='food'),before=serialize(s);
  n.amount=n.max;const full=shadowExistingResourcePressure(s).rows.find(x=>x.id===n.id);
  n.amount=0;const depleted=shadowExistingResourcePressure(s).rows.find(x=>x.id===n.id);
  assert.equal(full.regenerationPressure,0);assert.ok(depleted.regenerationPressure>=full.regenerationPressure);
  n.amount=n.max;assert.equal(serialize(s),before);
});
test('observing ecology shadow every tick cannot change deterministic execution',()=>{
  const a=createWorld(9191),b=createWorld(9191);
  for(let i=0;i<360;i++){shadowExistingResourcePressure(a);step(a);step(b);}
  assert.equal(serialize(a),serialize(b));
});

test('resource ecology consumes WM3.1 soil evidence without moving resource authority',()=>{
  const s=createWorld(230926),view=createWorldMapView(s),soil=createSoilShadow(s,view),shadow=createResourceEcologyShadow(s);
  assert.deepEqual(shadow.soilSummary,soil.summary);
  const fertile=soil.cells.filter(c=>c.active).sort((a,b)=>b.fertility-a.fertility||a.index-b.index)[0];
  const resourceCell=shadow.cells[fertile.index];
  assert.equal(resourceCell.soilType,fertile.soilType);
  assert.equal(resourceCell.soilHealth,fertile.health);
  assert.equal(resourceCell.soilFertility,fertile.fertility);
  assert.equal(shadow.authority.resources,'simclone-k6');
});


test('resource ecology consumes WM3.4 vegetation evidence without moving resource authority',()=>{
  const s=createWorld(230926),view=createWorldMapView(s),climate=createClimateShadow(s,view),
    soil=createSoilShadow(s,view,climate),hydro=createHydrologyShadow(s,view,climate,soil),
    vegetation=createVegetationShadow(s,view,climate,soil,hydro),shadow=createResourceEcologyShadow(s);
  assert.deepEqual(shadow.vegetationSummary,vegetation.summary);
  assert.deepEqual(shadow.hydrologySummary,hydro.summary);
  const best=vegetation.cells.slice().sort((a,b)=>b.regenerationPotential-a.regenerationPotential||a.index-b.index)[0];
  assert.equal(shadow.cells[best.index].vegetationRegenerationPotential,best.regenerationPotential);
  assert.equal(shadow.authority.resources,'simclone-k6');
});

test('vegetation evidence scales food and wood but does not hijack geology',()=>{
  const grass={terrainType:'grass',walkable:true,moisture:.58,elevation:.35},
    rock={terrainType:'rock',walkable:true,moisture:.3,elevation:.8},
    soil={active:true,fertility:.85,health:.88,soilType:'loam'};
  const low={foodYieldPotential:0,woodYieldPotential:0,regenerationPotential:0},
    high={foodYieldPotential:1,woodYieldPotential:1,regenerationPotential:1};
  const gLow=resourceSuitabilityForCell(grass,soil,low),gHigh=resourceSuitabilityForCell(grass,soil,high);
  const rLow=resourceSuitabilityForCell(rock,{...soil,soilType:'rocky'},low),rHigh=resourceSuitabilityForCell(rock,{...soil,soilType:'rocky'},high);
  assert.ok(gHigh.food>gLow.food);assert.ok(gHigh.wood>gLow.wood);
  assert.equal(rHigh.stone,rLow.stone);
});
