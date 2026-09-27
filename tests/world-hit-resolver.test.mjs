import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORLD_HIT_RESOLVER_VERSION,
  WORLD_SELECTION_KINDS,
  WORLD_HIT_KIND_PRIORITY,
  worldSelection,
  worldHitCandidate,
  resolveWorldHit,
  selectionFromWorldHit,
} from '../src/read-models/world-hit-resolver.mjs';

test('D2 exposes one persistent {kind,id} vocabulary',()=>{
  assert.equal(WORLD_HIT_RESOLVER_VERSION,'display-d2/v1');
  assert.deepEqual(WORLD_SELECTION_KINDS,['agent','monster','drop','station','building','resource']);
  assert.deepEqual(worldSelection('monster','wm:z1:0:0'),{kind:'monster',id:'wm:z1:0:0'});
  assert.equal(worldSelection('event',1),null);
  assert.equal(worldSelection('unknown',1),null);
});

test('D2 nearest valid screen-space hit wins',()=>{
  const hit=resolveWorldHit([
    worldHitCandidate({kind:'agent',id:1,distance:20,hitRadius:34}),
    worldHitCandidate({kind:'monster',id:'wm:z1:0:0',distance:8,hitRadius:30}),
    worldHitCandidate({kind:'building',id:9,distance:12,hitRadius:30}),
  ]);
  assert.equal(hit.kind,'monster');
  assert.equal(hit.id,'wm:z1:0:0');
});

test('D2 exact-distance priority is explicit and input-order independent',()=>{
  const rows=[
    worldHitCandidate({kind:'resource',id:5,distance:10,hitRadius:30}),
    worldHitCandidate({kind:'building',id:7,distance:10,hitRadius:30}),
    worldHitCandidate({kind:'station',id:3,distance:10,hitRadius:30}),
    worldHitCandidate({kind:'drop',id:8,distance:10,hitRadius:30}),
    worldHitCandidate({kind:'monster',id:'wm:z1:0:0',distance:10,hitRadius:30}),
    worldHitCandidate({kind:'agent',id:2,distance:10,hitRadius:30}),
  ];
  assert.deepEqual(resolveWorldHit(rows),resolveWorldHit([...rows].reverse()));
  assert.equal(resolveWorldHit(rows).kind,'agent');
  assert.ok(WORLD_HIT_KIND_PRIORITY.monster<WORLD_HIT_KIND_PRIORITY.drop);
  assert.ok(WORLD_HIT_KIND_PRIORITY.station<WORLD_HIT_KIND_PRIORITY.building);
});

test('D2 transient event wins exact tie but never becomes persistent selection',()=>{
  const hit=resolveWorldHit([
    worldHitCandidate({kind:'agent',id:3,distance:6,hitRadius:34}),
    worldHitCandidate({kind:'event',id:42,distance:6,hitRadius:18}),
  ]);
  assert.equal(hit.kind,'event');
  assert.equal(selectionFromWorldHit(hit),null);
});

test('D2 hit radius fails closed',()=>{
  assert.equal(resolveWorldHit([
    worldHitCandidate({kind:'monster',id:'wm:z1:0:0',distance:31,hitRadius:30})
  ]),null);
  const hit=resolveWorldHit([
    worldHitCandidate({kind:'resource',id:2,distance:14,hitRadius:16}),
    worldHitCandidate({kind:'drop',id:5,distance:18,hitRadius:17}),
  ]);
  assert.equal(hit.kind,'resource');
});

test('D2 same-kind ties use stable id ordering',()=>{
  const a=worldHitCandidate({kind:'monster',id:'wm:z1:2:0',distance:12,hitRadius:30});
  const b=worldHitCandidate({kind:'monster',id:'wm:z1:1:0',distance:12,hitRadius:30});
  assert.equal(resolveWorldHit([a,b]).id,'wm:z1:1:0');
  assert.equal(resolveWorldHit([b,a]).id,'wm:z1:1:0');
});

test('D2 source has no gameplay/browser authority',()=>{
  const source=fs.readFileSync(new URL('../src/read-models/world-hit-resolver.mjs',import.meta.url),'utf8');
  for(const forbidden of ['document.','window.','Math.random','Date.now','new Date','command(']){
    assert.equal(source.includes(forbidden),false,forbidden);
  }
});
