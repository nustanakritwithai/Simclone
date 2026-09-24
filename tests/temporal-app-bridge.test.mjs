import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const app=await readFile(new URL('../src/app.mjs',import.meta.url),'utf8');

test('app owns a TemporalHistory session around authoritative state',()=>{
  assert.match(app,/createTemporalHistory/);
  assert.match(app,/temporal\.checkpoint\('session-start'\)/);
  assert.match(app,/function resetTemporal\(/);
});

test('authoritative app commands use executeWorldCommand rather than command(state)',()=>{
  assert.doesNotMatch(app,/command\(state\s*,/);
  assert.match(app,/executeWorldCommand\('CLONE'/);
  assert.match(app,/executeWorldCommand\('BUILD'/);
  assert.match(app,/execute:\(type,data\)=>\{const result=executeWorldCommand\(type,data\)/);
});

test('simulation ticks advance through TemporalHistory rather than step(state)',()=>{
  assert.doesNotMatch(app,/step\(state\s*[,)]/);
  assert.match(app,/advanceWorld\(1\)/);
});

test('reset and import replace both app state and temporal session',()=>{
  assert.match(app,/resetTemporal\(createWorld\(seed\),'reset'\)/);
  assert.match(app,/resetTemporal\(candidate,'import'\)/);
});

test('preview remains isolated and is not journaled',()=>{
  assert.match(app,/preview:\(type,data\)=>\{const copy=JSON\.parse\(serialize\(state\)\),result=command\(copy,type,data\)/);
});
