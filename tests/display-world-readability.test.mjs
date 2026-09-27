import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {createWorld,serialize} from '../src/engine.mjs';
import {worldReadabilityRegions,DISPLAY_WORLD_READABILITY_VERSION} from '../src/display-world-readability.mjs';

test('D1 Same-World exposes one Core region and four visually distinct Adventure zones',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world'});
  const before=serialize(s),rows=worldReadabilityRegions(s);
  assert.equal(serialize(s),before);
  assert.equal(DISPLAY_WORLD_READABILITY_VERSION,'display-d1/v1');
  assert.deepEqual(rows.map(r=>r.id),['core','z1','z2','z3','z4']);
  assert.deepEqual(rows.slice(1).map(r=>r.shortLabel),['Z1 · GRASSLAND','Z2 · WOODLAND','Z3 · UPLANDS','Z4 · STONE RIDGE']);
  assert.deepEqual(rows.slice(1).map(r=>r.levelLabel),['Lv.1–15','Lv.16–30','Lv.31–45','Lv.46–60']);
  assert.equal(new Set(rows.slice(1).map(r=>r.accent)).size,4);
  assert.equal(new Set(rows.slice(1).map(r=>r.wash)).size,4);
  for(const r of rows.slice(1)){
    assert.equal(r.adventure,true);
    assert.ok(r.markerX>=r.minX&&r.markerX<=r.maxX);
    assert.equal(r.gateX,r.minX);
    assert.equal(r.gateY,25);
    assert.ok(Object.isFrozen(r));
  }
  assert.ok(Object.isFrozen(rows));
});

test('D1 legacy world has no Adventure presentation zones',()=>{
  const s=createWorld(42);
  const rows=worldReadabilityRegions(s);
  assert.deepEqual(rows.map(r=>r.id),['core']);
  assert.equal(rows[0].adventure,false);
});

test('D1 app consumes the read-only region presentation instead of duplicating zone authority',()=>{
  const source=fs.readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
  assert.match(source,/worldReadabilityRegions\(state\)/);
  assert.match(source,/ADVENTURE ANNEX/);
  for(const forbidden of ['ADVENTURE_ANNEX_ZONES','minX:60','maxX:83'])assert.equal(source.includes(forbidden),false,forbidden);
});

test('D1 readability module has no DOM, random, wall-clock or command authority',()=>{
  const source=fs.readFileSync(new URL('../src/display-world-readability.mjs',import.meta.url),'utf8');
  for(const forbidden of ['document.','window.','Math.random','Date.now','new Date','command('])assert.equal(source.includes(forbidden),false,forbidden);
});
