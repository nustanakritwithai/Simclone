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

test('D2 foundation exposes one persistent world selection vocabulary',()=>{
  assert.equal(WORLD_HIT_RESOLVER_VERSION,'display-d2-hit-resolver/v1');
  assert.deepEqual(WORLD_SELECTION_KINDS,['agent','monster','building','station','drop','resource']);
  assert.deepEqual(worldSelection('monster','wm:z1:0:0'),{kind:'monster',id:'wm:z1:0:0'});
  assert.equal(worldSelection('event',1),null);
  assert.equal(worldSelection('unknown',1),null);
});

test('D2 nearest valid hit wins before kind priority',()=>{
  const hit=resolveWorldHit([
    worldHitCandidate({kind:'agent',id:1,distance:20,hitRadius:30}),
    worldHitCandidate({kind:'monster',id:'wm:z1:0:0',distance:8,hitRadius:30}),
    worldHitCandidate({kind:'building',id:9,distance:12,hitRadius:30}),
  ]);
  assert.equal(hit.kind,'monster');
  assert.equal(hit.id,'wm:z1:0:0');
});

test('D2 exact-distance ties are deterministic independent of input order',()=>{
  const rows=[
    worldHitCandidate({kind:'resource',id:5,distance:10,hitRadius:30}),
    worldHitCandidate({kind:'monster',id:'wm:z1:0:0',distance:10,hitRadius:30}),
    worldHitCandidate({kind:'building',id:7,distance:10,hitRadius:30}),
    worldHitCandidate({kind:'agent',id:2,distance:10,hitRadius:30}),
  ];
  const a=resolveWorldHit(rows),b=resolveWorldHit([...rows].reverse());
  assert.deepEqual(a,b);
  assert.equal(a.kind,'agent');
  assert.ok(WORLD_HIT_KIND_PRIORITY.agent<WORLD_HIT_KIND_PRIORITY.building);
});

test('D2 hit radius rejects near-looking but out-of-contract targets',()=>{
  const hit=resolveWorldHit([
    worldHitCandidate({kind:'monster',id:'wm:z1:0:0',distance:31,hitRadius:30}),
    worldHitCandidate({kind:'resource',id:2,distance:14,hitRadius:16}),
  ]);
  assert.equal(hit.kind,'resource');
  assert.equal(resolveWorldHit([worldHitCandidate({kind:'agent',id:1,distance:25,hitRadius:20})]),null);
});

test('D2 event hit remains transient and cannot become persistent world selection',()=>{
  const event=resolveWorldHit([
    worldHitCandidate({kind:'event',id:42,distance:6,hitRadius:18}),
    worldHitCandidate({kind:'agent',id:3,distance:6,hitRadius:34}),
  ]);
  assert.equal(event.kind,'event');
  assert.equal(selectionFromWorldHit(event),null);
  const agent=resolveWorldHit([worldHitCandidate({kind:'agent',id:3,distance:5,hitRadius:34})]);
  assert.deepEqual(selectionFromWorldHit(agent),{kind:'agent',id:3});
});

test('D2 resolver rejects malformed candidates and has no gameplay/browser authority',()=>{
  assert.equal(worldHitCandidate({kind:'agent',id:1,distance:-1}),null);
  assert.equal(worldHitCandidate({kind:'bogus',id:1,distance:1}),null);
  assert.equal(worldHitCandidate({kind:'agent',id:{},distance:1}),null);
  const source=fs.readFileSync(new URL('../src/read-models/world-hit-resolver.mjs',import.meta.url),'utf8');
  for(const forbidden of ['document.','window.','Math.random','Date.now','new Date','command(','state.']){
    assert.equal(source.includes(forbidden),false,forbidden);
  }
});
