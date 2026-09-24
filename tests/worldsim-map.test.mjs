import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_MAP_VERSION,MAP_AUTHORITY,createWorldMapView,visualCellAt,visualNoise,isVisualWater} from '../src/worldsim-map.mjs';
import {createWorld,serialize} from '../src/engine.mjs';

test('WorldSim map view is deterministic and bounded',()=>{
 const s=createWorld(230926),a=createWorldMapView(s),b=createWorldMapView(s);
 assert.equal(a.version,WORLD_MAP_VERSION);assert.equal(a.cells.length,30*26);assert.deepEqual(a,b);
});
test('presentation map exposes expected visual terrain families without changing gameplay tiles',()=>{
 const s=createWorld(230926),before=serialize(s),view=createWorldMapView(s),types=new Set(view.cells.map(c=>c.terrainType));
 for(const t of ['deepWater','shallowWater','sand','grass','forest','rock'])assert.ok(types.has(t),t);
 assert.equal(serialize(s),before);assert.deepEqual(view.authority,MAP_AUTHORITY);
});
test('visual water mirrors gameplay water and path/bridge remain explicit',()=>{
 const s=createWorld(230926),view=createWorldMapView(s);
 for(const c of view.cells){
   assert.equal(c.walkable,c.gameplayTile!=='water');
   if(isVisualWater(c.terrainType))assert.equal(c.gameplayTile,'water');
 }
 assert.ok(view.cells.some(c=>c.terrainType==='path'));
 assert.ok(view.cells.some(c=>c.terrainType==='bridge'));
});
test('visual cell lookup is bounded and stable',()=>{
 const view=createWorldMapView(createWorld(7));
 assert.equal(visualCellAt(view,0,0).index,0);assert.equal(visualCellAt(view,29,25).index,779);
 assert.equal(visualCellAt(view,-1,0),null);assert.equal(visualCellAt(view,30,0),null);
});
test('visual noise is deterministic and unsigned',()=>{
 const a=visualNoise(42,7,9,3);assert.equal(a,visualNoise(42,7,9,3));assert.ok(a>=0&&a<1);
});
test('different seeds produce different presentation maps while gameplay save stays authoritative',()=>{
 const a=createWorld(1),b=createWorld(2);
 assert.notDeepEqual(createWorldMapView(a).cells.map(c=>c.color),createWorldMapView(b).cells.map(c=>c.color));
});
