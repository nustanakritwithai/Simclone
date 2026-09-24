import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,restore,serialize,walkable} from '../src/engine.mjs';
import {WORLD_MAP_VERSION,terrainWalkable} from '../src/worldsim-map.mjs';

test('createWorld now boots on full WorldSim map authority',()=>{
  const s=createWorld(230926);
  assert.equal(s.worldMapVersion,WORLD_MAP_VERSION);
  assert.equal(s.worldMap.cells.length,30*26);
  assert.equal(s.tiles.length,30*26);
  assert.ok(s.worldMap.cells.some(c=>c.terrainType==='deepWater'));
  assert.ok(s.worldMap.cells.some(c=>c.terrainType==='forest'));
  assert.ok(s.worldMap.cells.some(c=>c.terrainType==='rock'));
});

test('engine walkability is owned by canonical WorldSim terrain',()=>{
  const s=createWorld(230926);
  for(const c of s.worldMap.cells){
    assert.equal(walkable(s,c.x,c.y),terrainWalkable(c.terrainType));
  }
});

test('resources are placed on canonical walkable terrain',()=>{
  const s=createWorld(230926);
  for(const n of s.nodes){
    const c=s.worldMap.cells[n.y*30+n.x];
    assert.equal(terrainWalkable(c.terrainType),true);
    assert.equal(n.worldTerrain,c.terrainType);
  }
});

test('same seed creates byte-identical physical map and resources',()=>{
  const a=createWorld(777),b=createWorld(777);
  assert.deepEqual(a.worldMap,b.worldMap);
  assert.deepEqual(a.nodes,b.nodes);
});

test('current 0.5 save without worldMap migrates onto physical map',()=>{
  const s=createWorld(230926);
  const water=s.worldMap.cells.find(c=>!terrainWalkable(c.terrainType));
  s.agents[0].x=water.x;s.agents[0].y=water.y;s.agents[0].task=null;
  delete s.worldMap;delete s.worldMapVersion;
  // Emulate pre-map compatibility terrain rather than preserving the generated map.
  s.tiles=Array(30*26).fill('grass');
  const migrated=restore(JSON.stringify(s));
  assert.equal(migrated.worldMapVersion,WORLD_MAP_VERSION);
  assert.equal(walkable(migrated,migrated.agents[0].x,migrated.agents[0].y),true);
  assert.ok(migrated.events.some(e=>e.type==='world'&&e.text.includes('WorldSim physical map')));
});

test('new WorldSim world remains serializable and restorable',()=>{
  const s=createWorld(918273);
  const text=serialize(s),r=restore(text);
  assert.deepEqual(r.worldMap,s.worldMap);
  assert.deepEqual(r.nodes,s.nodes);
});
