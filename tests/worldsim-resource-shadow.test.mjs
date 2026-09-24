import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,step} from '../src/engine.mjs';
import {createWorldMapView} from '../src/worldsim-map.mjs';
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
