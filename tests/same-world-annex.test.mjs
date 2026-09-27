import test from 'node:test';
import assert from 'node:assert/strict';

import {createWorld,serialize,restore,validate,step} from '../src/engine.mjs';
import {routeField,routeDistance} from '../src/survival.mjs';
import {personalExplorationTarget} from '../src/personal-planning.mjs';
import {createWorldMapView} from '../src/worldsim-map.mjs';
import {createResourceEcologyShadow} from '../src/worldsim-resource-shadow.mjs';
import {applyWorldResourceRegeneration} from '../src/worldsim-resource-authority.mjs';
import {adventureZoneSpatialBounds} from '../src/adventure-expedition.mjs';
import {
  LARGE_WORLD_BOUNDS,SAME_WORLD_BOUNDS,worldBounds,worldCellCount
} from '../src/world-bounds.mjs';
import {
  ADVENTURE_ANNEX_X_MIN,ADVENTURE_ANNEX_X_MAX,ADVENTURE_ANNEX_ZONES
} from '../src/adventure-annex.mjs';

const SEEDS=[230926,42,2026];

function coreTiles(state){
  const b=worldBounds(state),out=[];
  for(let y=0;y<LARGE_WORLD_BOUNDS.h;y++)out.push(...state.tiles.slice(y*b.w,y*b.w+LARGE_WORLD_BOUNDS.w));
  return out;
}
function coreProjection(state){
  const p=JSON.parse(JSON.stringify(state));
  p.tiles=coreTiles(state);
  delete p.worldBounds;
  delete p.adventureAnnex;
  delete p.wildMonsters;
  delete p.nextWorldMonster;
  return p;
}
const withoutIndex=cell=>{const {index,...rest}=cell;return rest;};

test('SWA1 fresh Same-World is 84x52 while its Core state equals released Large',()=>{
  for(const seed of SEEDS){
    const reference=createWorld(seed,{mode:'independent',worldProfile:'large'});
    const candidate=createWorld(seed,{mode:'independent',worldProfile:'same-world'});
    assert.deepEqual(worldBounds(reference),LARGE_WORLD_BOUNDS);
    assert.deepEqual(worldBounds(candidate),SAME_WORLD_BOUNDS);
    assert.equal(worldCellCount(candidate),84*52);
    assert.equal(candidate.tiles.length,84*52);
    assert.deepEqual(coreProjection(candidate),coreProjection(reference));
    assert.equal(validate(candidate).length,0);
    assert.ok(candidate.agents.every(a=>a.x<ADVENTURE_ANNEX_X_MIN));
    assert.ok(candidate.nodes.every(n=>n.x<ADVENTURE_ANNEX_X_MIN));
  }
});

test('SWA1 migrates released Large saves row-by-row without relocating Core',()=>{
  for(const seed of SEEDS){
    const reference=createWorld(seed,{mode:'independent',worldProfile:'large'});
    step(reference,40);
    const oldRows=Array.from({length:52},(_,y)=>reference.tiles.slice(y*60,y*60+60));
    const migrated=restore(serialize(reference));
    assert.deepEqual(worldBounds(migrated),SAME_WORLD_BOUNDS);
    for(let y=0;y<52;y++)assert.deepEqual(migrated.tiles.slice(y*84,y*84+60),oldRows[y]);
    assert.deepEqual(coreProjection(migrated),coreProjection(reference));
    assert.equal(validate(migrated).length,0);
  }
});

test('SWA1 migration is idempotent and Same-World continuation is deterministic',()=>{
  const a=restore(serialize(createWorld(230926,{mode:'independent',worldProfile:'large'})));
  const once=serialize(a),b=restore(once);
  assert.equal(serialize(b),once);
  step(a,120);step(b,120);
  assert.equal(serialize(b),serialize(a));
});

test('SWA1 Core WorldSim map and ecology evidence equal the released 60x52 reference',()=>{
  for(const seed of SEEDS){
    const reference=createWorld(seed,{mode:'independent',worldProfile:'large'});
    const candidate=createWorld(seed,{mode:'independent',worldProfile:'same-world'});
    const rv=createWorldMapView(reference),cv=createWorldMapView(candidate);
    const re=createResourceEcologyShadow(reference),ce=createResourceEcologyShadow(candidate);
    for(let y=0;y<52;y++)for(let x=0;x<60;x++){
      assert.deepEqual(withoutIndex(cv.cells[y*84+x]),withoutIndex(rv.cells[y*60+x]));
      assert.deepEqual(withoutIndex(ce.cells[y*84+x]),withoutIndex(re.cells[y*60+x]));
    }
  }
});

test('SWA1 WM4.7 regeneration produces identical results for existing Core nodes',()=>{
  for(const seed of SEEDS){
    const reference=createWorld(seed,{mode:'independent',worldProfile:'large'});
    const candidate=createWorld(seed,{mode:'independent',worldProfile:'same-world'});
    reference.tick=720;candidate.tick=720;
    applyWorldResourceRegeneration(reference);
    applyWorldResourceRegeneration(candidate);
    assert.deepEqual(candidate.nodes,reference.nodes);
  }
});

test('SWA1 Annex owns z1-z4 terrain but no ordinary resource nodes',()=>{
  const state=createWorld(230926,{mode:'independent',worldProfile:'same-world'});
  assert.equal(ADVENTURE_ANNEX_X_MIN,60);
  assert.equal(ADVENTURE_ANNEX_X_MAX,83);
  assert.deepEqual(ADVENTURE_ANNEX_ZONES.map(z=>[z.zoneId,z.minX,z.maxX]),[
    ['z1',60,65],['z2',66,71],['z3',72,77],['z4',78,83]
  ]);
  assert.equal(state.nodes.some(n=>n.x>=60),false);
  for(const zone of ADVENTURE_ANNEX_ZONES){
    const b=adventureZoneSpatialBounds(state,zone.zoneId);
    assert.deepEqual([b.minX,b.maxX],[zone.minX,zone.maxX]);
  }
});

test('SWA1 one path authority reaches the Annex corridor and generic exploration stays Core-bounded',()=>{
  const state=createWorld(230926,{mode:'independent',worldProfile:'same-world'}),agent=state.agents[0];
  const field=routeField(state,agent);
  assert.equal(field.width,84);assert.equal(field.height,52);
  assert.ok(routeDistance(field,{x:60,y:25})>=0);
  assert.ok(routeDistance(field,{x:80,y:25})>=0);
  const target=personalExplorationTarget(state,agent,()=>true);
  assert.ok(target.x<60);
});
