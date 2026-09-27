import test from 'node:test';
import assert from 'node:assert/strict';

import {createWorld,serialize,restore,validate} from '../src/engine.mjs';
import {
  LARGE_WORLD_BOUNDS,
  worldBounds
} from '../src/world-bounds.mjs';
import {
  regionalRiverCenter,
  worldRegionAt
} from '../src/world-regions.mjs';
import {createWorldMapView} from '../src/worldsim-map.mjs';
import {createResourceEcologyShadow} from '../src/worldsim-resource-shadow.mjs';

const CORE_WIDTH=60;
const CORE_HEIGHT=52;
const PROOF_SEEDS=[230926,42,2026];

const plain=value=>JSON.parse(JSON.stringify(value));

/**
 * SWA0 reference projection.
 *
 * Future 84x52 candidate tests reuse this shape and may exclude only
 * explicitly-approved Annex-only fields. Everything else remains Core truth.
 */
export function projectReleasedCore(state){
  const bounds=worldBounds(state);
  assert.ok(bounds.w>=CORE_WIDTH&&bounds.h>=CORE_HEIGHT,'state must contain the released 60x52 Core');

  const coreTiles=[];
  for(let y=0;y<CORE_HEIGHT;y++){
    const start=y*bounds.w;
    coreTiles.push(...state.tiles.slice(start,start+CORE_WIDTH));
  }

  const projected=plain(state);
  projected.tiles=coreTiles;
  delete projected.worldBounds;

  // Reserved future Annex-only fields. They are absent on released main.
  delete projected.adventureAnnex;
  delete projected.wildMonsters;
  delete projected.nextWorldMonster;

  return projected;
}

test('SWA0 freezes the released large profile as the 60x52 Core reference',()=>{
  assert.equal(LARGE_WORLD_BOUNDS.profile,'large');
  assert.equal(LARGE_WORLD_BOUNDS.w,CORE_WIDTH);
  assert.equal(LARGE_WORLD_BOUNDS.h,CORE_HEIGHT);

  for(const seed of PROOF_SEEDS){
    const state=createWorld(seed,{mode:'independent',worldProfile:'large'});
    assert.deepEqual(worldBounds(state),LARGE_WORLD_BOUNDS);
    assert.equal(state.tiles.length,CORE_WIDTH*CORE_HEIGHT);
    assert.equal(validate(state).length,0);
  }
});

test('SWA0 proves naive 84-wide normalization drifts released Core region evidence',()=>{
  const widened=Object.freeze({profile:'same-world-proof',w:84,h:52});
  const y=25;

  assert.notEqual(
    regionalRiverCenter(LARGE_WORLD_BOUNDS,y),
    regionalRiverCenter(widened,y),
    'river normalization must visibly differ when width changes'
  );

  let changed=false;
  for(const [x,cy] of [[1,1],[15,10],[30,25],[45,40],[59,50]]){
    const released=worldRegionAt(230926,LARGE_WORLD_BOUNDS,x,cy);
    const naive=worldRegionAt(230926,widened,x,cy);
    if(JSON.stringify(released)!==JSON.stringify(naive)){changed=true;break;}
  }
  assert.equal(changed,true,'at least one released Core cell must expose direct-resize drift');
});

test('SWA0 proves an in-place large save width change is invalid under released bounds authority',()=>{
  const state=createWorld(230926,{mode:'independent',worldProfile:'large'});
  state.worldBounds={...state.worldBounds,w:84};
  assert.ok(validate(state).includes('World bounds'));
});

test('SWA0 Core projection is deterministic across released save/load',()=>{
  for(const seed of PROOF_SEEDS){
    const before=createWorld(seed,{mode:'independent',worldProfile:'large'});
    const after=restore(serialize(before));
    assert.deepEqual(projectReleasedCore(after),projectReleasedCore(before));
  }
});

test('SWA0 anchors released WorldSim Core evidence to the 60x52 reference domain',()=>{
  for(const seed of PROOF_SEEDS){
    const state=createWorld(seed,{mode:'independent',worldProfile:'large'});
    const view=createWorldMapView(state);
    const ecology=createResourceEcologyShadow(state);

    assert.equal(view.width,CORE_WIDTH);
    assert.equal(view.height,CORE_HEIGHT);
    assert.equal(view.cells.length,CORE_WIDTH*CORE_HEIGHT);
    assert.equal(ecology.width,CORE_WIDTH);
    assert.equal(ecology.height,CORE_HEIGHT);
    assert.equal(ecology.cells.length,CORE_WIDTH*CORE_HEIGHT);

    for(const [x,y] of [[0,0],[11,12],[30,25],[59,51]]){
      const cell=view.cells[y*CORE_WIDTH+x];
      const reference=worldRegionAt(seed,LARGE_WORLD_BOUNDS,x,y);
      assert.equal(cell.x,x);
      assert.equal(cell.y,y);
      assert.equal(cell.region,reference.region);
    }
  }
});
