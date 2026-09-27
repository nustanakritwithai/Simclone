import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');

test('D2 runtime imports one resolver and removes Monster-specific selection ledger',()=>{
  assert.match(source,/worldHitCandidate,resolveWorldHit,worldSelection,selectionFromWorldHit/);
  assert.equal(source.includes('selectedWorldMonsterId'),false);
  assert.match(source,/let state=.*activeAgentId=.*selection=activeAgentId\?worldSelection\('agent',activeAgentId\):null/);
});

test('D2 pointer-up routes through worldTargetAtScreen exactly once',()=>{
  const pointer=source.slice(source.indexOf("canvas.addEventListener('pointerup'"),source.indexOf("canvas.addEventListener('pointercancel'"));
  assert.match(pointer,/hit=worldTargetAtScreen\(sx,sy\)/);
  assert.equal(pointer.includes('structureTargetAtScreen(sx,sy)'),false);
  assert.equal(pointer.includes('worldObjectTargetAtScreen(sx,sy)'),false);
  assert.equal(pointer.includes('for(const a of living(state))'),false);
});

test('D2 compatibility hit helpers delegate to the unified candidate collection',()=>{
  assert.match(source,/function worldHitCandidatesAtScreen\(sx,sy\)/);
  assert.match(source,/function worldTargetAtScreen\(sx,sy\)\{return resolveWorldHit\(worldHitCandidatesAtScreen\(sx,sy\)\);\}/);
  assert.match(source,/function structureTargetAtScreen[\s\S]*worldHitCandidatesAtScreen/);
  assert.match(source,/function worldObjectTargetAtScreen[\s\S]*worldHitCandidatesAtScreen/);
});

test('D2 active Agent context is distinct from generic world selection',()=>{
  assert.match(source,/activeAgentId=id;selection=worldSelection\('agent',id\)/);
  assert.match(source,/selection=worldSelection\('monster',m\.worldMonsterId\)/);
  assert.match(source,/selectedWorldMonster:\(\)=>selection\?\.kind==='monster'/);
  assert.match(source,/worldSelection:\(\)=>selection\?\{\.\.\.selection\}:null/);
});

test('D2 runtime selection remains presentation-only',()=>{
  for(const forbidden of ['state.selection=','state.selected=','state.activeAgentId=']){
    assert.equal(source.includes(forbidden),false,forbidden);
  }
});
