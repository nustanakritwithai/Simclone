import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_MAP_VERSION,generateWorldMap,cellAt,terrainWalkable,compatibilityTiles,nearestWalkable,resourceNodesFromWorldMap,worldMapSummary} from '../src/worldsim-map.mjs';

test('full WorldSim map is deterministic and bounded',()=>{
 const a=generateWorldMap(230926),b=generateWorldMap(230926);assert.equal(a.version,WORLD_MAP_VERSION);
 assert.equal(a.cells.length,780);assert.deepEqual(a,b);
});
test('map exposes all WorldSim terrain families needed by Simclone',()=>{
 const m=generateWorldMap(230926),types=new Set(m.cells.map(c=>c.terrainType));
 for(const t of ['deepWater','shallowWater','sand','grass','forest','rock'])assert.ok(types.has(t),t);
});
test('central settlement basin is always walkable',()=>{
 const m=generateWorldMap(1);for(let y=10;y<=14;y++)for(let x=9;x<=13;x++)
  if(Math.abs(x-11)+Math.abs(y-12)<=3)assert.equal(terrainWalkable(cellAt(m,x,y).terrainType),true);
});
test('compatibility tiles preserve one-cell-per-world-cell mapping',()=>{
 const m=generateWorldMap(9),tiles=compatibilityTiles(m);assert.equal(tiles.length,780);
 assert.ok(tiles.every(t=>t==='grass'||t==='water'));
});
test('nearest walkable relocation is deterministic',()=>{
 const m=generateWorldMap(123),water=m.cells.find(c=>!terrainWalkable(c.terrainType));
 assert.deepEqual(nearestWalkable(m,{x:water.x,y:water.y}),nearestWalkable(m,{x:water.x,y:water.y}));
});
test('resource generation follows terrain and is deterministic',()=>{
 const m=generateWorldMap(230926),a=resourceNodesFromWorldMap(m),b=resourceNodesFromWorldMap(m);assert.deepEqual(a,b);
 assert.ok(a.some(n=>n.type==='wood'));assert.ok(a.some(n=>n.type==='food'));assert.ok(a.some(n=>n.type==='stone'));
 for(const n of a)assert.equal(terrainWalkable(cellAt(m,n.x,n.y).terrainType),true);
});
test('summary exposes physical world metrics',()=>{
 const s=worldMapSummary(generateWorldMap(230926));assert.equal(s.version,WORLD_MAP_VERSION);
 assert.ok(s.averageElevation>=0&&s.averageElevation<=1);assert.ok(s.averageHumidity>=0&&s.averageHumidity<=1);
});
