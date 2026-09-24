import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,validate,serialize,restore,command} from '../src/engine.mjs';
import {createTemporalHistory,temporalStateHash} from '../src/temporal-history.mjs';

function history(world=createWorld(8),options={}){
  return createTemporalHistory({world,serialize,restore,validate,step,command,...options});
}

test('TemporalHistory checkpoint restores the complete canonical Simclone world',()=>{
  const h=history();
  h.advance(321);
  const before=serialize(h.world);
  const cp=h.checkpoint('before-work');
  h.advance(500);
  assert.notEqual(serialize(h.world),before);
  const restored=h.restore(cp.id);
  assert.equal(restored.tick,321);
  assert.equal(serialize(h.world),before);
  assert.equal(restored.hash,temporalStateHash(before));
  assert.deepEqual(validate(h.world),[]);
});

test('TemporalHistory autonomous rollback/replay round-trip is exact',()=>{
  const h=history(createWorld(77));
  h.advance(250);
  const cp=h.checkpoint('round-trip');
  h.advance(700);
  const expected=serialize(h.world);
  const result=h.verifyRoundTrip(cp.id);
  assert.equal(result.ok,true);
  assert.equal(serialize(h.world),expected);
  assert.equal(result.beforeHash,result.afterHash);
});

test('TemporalHistory replays successful manual commands at original tick and sequence',()=>{
  const h=history(createWorld(13));
  const cp=h.checkpoint('before-influence');
  const first=h.executeCommand('CLONE',{parentId:1});
  assert.equal(first.ok,true);
  h.advance(90);
  const expected=serialize(h.world);
  const expectedPeople=h.world.agents.length;
  const expectedCloned=h.world.stats.cloned;

  const replay=h.replayFrom(cp.id,90);
  assert.equal(replay.tick,90);
  assert.equal(replay.commandsReplayed,1);
  assert.equal(h.world.agents.length,expectedPeople);
  assert.equal(h.world.stats.cloned,expectedCloned);
  assert.equal(serialize(h.world),expected);
});

test('TemporalHistory does not journal rejected commands',()=>{
  const h=history();
  h.world.stock.food=0;
  const result=h.executeCommand('CLONE',{parentId:1});
  assert.equal(result.ok,false);
  assert.equal(h.listJournal().length,0);
});

test('TemporalHistory bounds checkpoints and keeps state metadata immutable to callers',()=>{
  const h=history(createWorld(9),{maxCheckpoints:2});
  const a=h.checkpoint('a');
  h.advance(2);
  h.checkpoint('b');
  h.advance(2);
  h.checkpoint('c');
  const rows=h.listCheckpoints();
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(x=>x.label),['b','c']);
  assert.equal(rows.some(x=>'state' in x),false);
  assert.throws(()=>h.restore(a.id),/checkpoint not found/);
});

test('TemporalHistory fails closed on invalid replay target',()=>{
  const h=history();
  const cp=h.checkpoint('origin');
  assert.throws(()=>h.replayFrom(cp.id,-1),/Invalid replay targetTick/);
});
