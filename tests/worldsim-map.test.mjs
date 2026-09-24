import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize} from '../src/engine.mjs';
import {WORLD_MAP_VERSION,MAP_AUTHORITY,WORLD_TERRAIN,createWorldMapView,visualCellAt,visualNoise} from '../src/worldsim-map.mjs';

test('WorldSim presentation map is deterministic and bounded',()=>{
  const s=createWorld(230926),before=serialize(s);
  const a=createWorldMapView(s),b=createWorldMapView(s);
  assert.equal(a.version,WORLD_MAP_VERSION);
  assert.equal(a.cells.length,30*26);
  assert.deepEqual(a,b);
  assert.equal(serialize(s),before);
});

test('presentation authority is explicit and gameplay remains K6-owned',()=>{
  assert.equal(MAP_AUTHORITY.mode,'presentation-only');
  assert.equal(MAP_AUTHORITY.path,'simclone-k6');
  assert.equal(MAP_AUTHORITY.resources,'simclone-k6');
  assert.equal(MAP_AUTHORITY.save,'simclone-0.5.0');
});

test('visual terrain includes WorldSim biome families without mutating gameplay tiles',()=>{
  const s=createWorld(230926),tiles=[...s.tiles],view=createWorldMapView(s);
  const types=new Set(view.cells.map(c=>c.terrainType));
  for(const t of ['deepWater','shallowWater','sand','grass','forest','rock'])assert.ok(types.has(t),t);
  assert.deepEqual(s.tiles,tiles);
});

test('water presentation follows gameplay water and path/bridge identity is preserved',()=>{
  const s=createWorld(77),view=createWorldMapView(s);
  for(const c of view.cells){
    if(c.gameplayTile==='water')assert.ok(['deepWater','shallowWater'].includes(c.terrainType));
    if(c.gameplayTile==='path')assert.equal(c.terrainType,'path');
    if(c.gameplayTile==='bridge')assert.equal(c.terrainType,'bridge');
    assert.equal(c.walkable,c.gameplayTile!=='water');
  }
});

test('visualCellAt is bounded and detached records are immutable',()=>{
  const view=createWorldMapView(createWorld(9));
  assert.equal(visualCellAt(view,-1,0),null);
  assert.equal(visualCellAt(view,30,0),null);
  const c=visualCellAt(view,11,12);
  assert.equal(c.x,11);assert.equal(c.y,12);assert.equal(Object.isFrozen(c),true);
});

test('visual noise stays deterministic in unit interval',()=>{
  for(const seed of [0,1,42,230926,4294967295]){
    const a=visualNoise(seed,7,13,99),b=visualNoise(seed,7,13,99);
    assert.equal(a,b);assert.ok(a>=0&&a<1);
  }
});

test('all visual terrain colors are valid shipped terrain categories',()=>{
  const view=createWorldMapView(createWorld(2026));
  for(const c of view.cells)assert.ok(WORLD_TERRAIN.includes(c.terrainType));
});
