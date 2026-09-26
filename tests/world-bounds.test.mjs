import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,restore,validate,step,walkable} from '../src/engine.mjs';
import {routeField,routeDistance} from '../src/survival.mjs';
import {canPlaceStation} from '../src/rust-stations.mjs';
import {createWorldMapView} from '../src/worldsim-map.mjs';
import {createResourceZonesShadow} from '../src/worldsim-resource-zones.mjs';
import {
  WORLD_BOUNDS_VERSION,
  LEGACY_WORLD_BOUNDS,
  LARGE_WORLD_BOUNDS,
  boundsForProfile,
  worldBounds,
  worldCellCount
} from '../src/world-bounds.mjs';

test('MX0 legacy worlds keep the historical 30x26 save shape without a bounds field',()=>{
  const s=createWorld(230926);
  assert.deepEqual(worldBounds(s),LEGACY_WORLD_BOUNDS);
  assert.equal(worldCellCount(s),780);
  assert.equal(s.tiles.length,780);
  assert.equal('worldBounds' in s,false);
  assert.equal(validate(s).length,0);
  const text=serialize(s),loaded=restore(text);
  assert.equal(serialize(loaded),text);
  assert.equal('worldBounds' in loaded,false);
});

test('MX1 large independent world is 60x52 and validates with six separated starters',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'large'});
  assert.deepEqual(worldBounds(s),LARGE_WORLD_BOUNDS);
  assert.equal(s.worldBounds.version,WORLD_BOUNDS_VERSION);
  assert.equal(s.worldBounds.profile,'large');
  assert.equal(worldCellCount(s),3120);
  assert.equal(s.tiles.length,3120);
  assert.equal(s.agents.filter(a=>a.alive).length,6);
  assert.ok(s.agents.every(a=>a.x>=0&&a.x<60&&a.y>=0&&a.y<52));
  assert.equal(validate(s).length,0);
});

test('MX1 large world generation is byte-deterministic for the same seed and profile',()=>{
  const a=createWorld(424242,{mode:'independent',worldProfile:'large'});
  const b=createWorld(424242,{mode:'independent',worldProfile:'large'});
  assert.equal(serialize(a),serialize(b));
  step(a,120);step(b,120);
  assert.equal(serialize(a),serialize(b));
});

test('MX1 large save/load preserves explicit bounds and deterministic continuation',()=>{
  const a=createWorld(99,{mode:'independent',worldProfile:'large'});
  step(a,40);const text=serialize(a),b=restore(text);
  assert.deepEqual(worldBounds(b),LARGE_WORLD_BOUNDS);
  assert.equal(serialize(b),text);
  step(a,80);step(b,80);
  assert.equal(serialize(a),serialize(b));
});

test('WorldSim map and WM4.8 zones cover all 3120 large-world cells',()=>{
  const s=createWorld(2026,{mode:'independent',worldProfile:'large'});
  const view=createWorldMapView(s),zones=createResourceZonesShadow(s);
  assert.equal(view.width,60);assert.equal(view.height,52);assert.equal(view.cells.length,3120);
  assert.equal(zones.width,60);assert.equal(zones.height,52);
  assert.ok(zones.zones.length>0);
  for(const type of ['food','wood','stone'])assert.ok(zones.byType[type].zones>=0);
  assert.equal(validate(s).length,0);
});

test('route fields allocate from runtime bounds instead of the legacy grid',()=>{
  const s=createWorld(31337,{mode:'independent',worldProfile:'large'}),a=s.agents[0],field=routeField(s,a);
  assert.equal(field.width,60);assert.equal(field.height,52);assert.equal(field.dist.length,3120);
  assert.equal(routeDistance(field,{x:a.x,y:a.y}),0);
  assert.equal(routeDistance(field,{x:60,y:0}),-1);
});

test('Rust planning accepts a legal large-world foundation cell beyond x=29',()=>{
  const s=createWorld(5150,{worldProfile:'large'}),b=worldBounds(s);
  let target=null;
  for(let y=1;y<b.h-1&&!target;y++)for(let x=30;x<b.w-1;x++){
    if(s.tiles[y*b.w+x]!=='grass')continue;
    if(s.nodes.some(n=>n.x===x&&n.y===y)||s.buildings.some(v=>v.x===x&&v.y===y))continue;
    const r=canPlaceStation(s,{pieceKind:'WOOD_FOUNDATION',socket:{type:'cell',x,y}},walkable,{actor:false});
    if(r.ok){target={x,y,result:r};break;}
  }
  assert.ok(target,'expected at least one legal build cell beyond the old 30-column edge');
  assert.ok(target.x>=30);
  assert.equal(target.result.ok,true);
});

test('unsupported world profiles are rejected before generation',()=>{
  assert.throws(()=>boundsForProfile('giant'));
  assert.throws(()=>createWorld(1,{worldProfile:'giant'}));
});
