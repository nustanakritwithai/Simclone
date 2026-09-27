import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createWorld,serialize,restore} from '../src/engine.mjs';
import {proveSwa7Population} from '../scripts/swa7-population-proof.mjs';

const fresh=seed=>createWorld(seed,{mode:'independent',worldProfile:'same-world',population:1});

for(const seed of [230926,42,2026]){
  test(`SWA7 population proof accepts authoritative seed ${seed} read-only`,()=>{
    const state=fresh(seed),before=serialize(state),result=proveSwa7Population(state);
    assert.equal(result.physicalInstances,24);
    assert.equal(result.distinctMonsterIds,12);
    assert.equal(result.zones.length,4);
    assert.ok(result.zones.every(z=>z.physicalInstances===6&&z.distinctMonsterIds===3&&z.copiesPerType===2));
    assert.equal(serialize(state),before);
    assert.deepEqual(proveSwa7Population(restore(before)),result);
  });
}

test('SWA7 proof rejects the obsolete 12-entity snapshot and accepts its real migration',()=>{
  const state=fresh(230926);
  state.wildMonsters.version='SWA2-0.1';
  state.wildMonsters.policy='three-per-zone-static-v1';
  state.wildMonsters.entities=state.wildMonsters.entities.filter(m=>m.spawnSlot<3);
  const originals=structuredClone(state.wildMonsters.entities);
  assert.throws(()=>proveSwa7Population(state),/physical instance count/);
  const migrated=restore(JSON.stringify(state));
  assert.equal(proveSwa7Population(migrated).physicalInstances,24);
  for(const original of originals){
    assert.deepEqual(migrated.wildMonsters.entities.find(m=>m.worldMonsterId===original.worldMonsterId),original);
  }
  const once=serialize(migrated);
  assert.equal(serialize(restore(once)),once);
});

test('SWA7 proof rejects malformed or absent authority instead of manufacturing entities',()=>{
  for(const state of [null,{}, {wildMonsters:{entities:null}}])assert.throws(()=>proveSwa7Population(state));
});

test('SWA7 proof rejects 24 entities with fewer than 12 distinct monsterIds',()=>{
  const state=fresh(42),rows=state.wildMonsters.entities;
  for(const row of rows)if(row.zoneId==='z1')row.monsterId=rows[0].monsterId;
  assert.throws(()=>proveSwa7Population(state),/distinct monsterId count/);
});

test('SWA7 proof rejects a 3/1/2 split even with 24 entities and 12 monsterIds',()=>{
  const state=fresh(42),rows=state.wildMonsters.entities.filter(m=>m.zoneId==='z1');
  rows[4].monsterId=rows[0].monsterId;
  assert.equal(state.wildMonsters.entities.length,24);
  assert.equal(new Set(state.wildMonsters.entities.map(m=>m.monsterId)).size,12);
  assert.throws(()=>proveSwa7Population(state));
});

test('SWA7 proof rejects wrong zones, duplicate identity, slot and physical position',()=>{
  for(const mutate of [
    rows=>{rows[0].zoneId='z2';},
    rows=>{rows[0].worldMonsterId=rows[1].worldMonsterId;},
    rows=>{rows[0].spawnSlot=rows[1].spawnSlot;},
    rows=>{rows[0].x=rows[1].x;rows[0].y=rows[1].y;},
  ]){
    const state=fresh(230926);mutate(state.wildMonsters.entities);
    assert.throws(()=>proveSwa7Population(state));
  }
});

test('SWA7 proof rejects pair rank drift without mutating the input',()=>{
  const state=fresh(42),row=state.wildMonsters.entities.find(m=>m.zoneId==='z1'&&m.spawnSlot===3);
  row.rank=row.rank==='elite'?'normal':'elite';
  const before=JSON.stringify(state);
  assert.throws(()=>proveSwa7Population(state),/paired rank/);
  assert.equal(JSON.stringify(state),before);
});

test('SWA7 public fixture passes the exact stdin CLI used by the browser smoke',()=>{
  const root=new URL('../',import.meta.url);
  const fixture=spawnSync(process.execPath,['scripts/swa7-public-fixture.mjs'],{cwd:root,encoding:'utf8'});
  assert.equal(fixture.status,0,fixture.stderr);
  const proof=spawnSync(process.execPath,['scripts/swa7-population-proof.mjs','--stdin'],{cwd:root,input:fixture.stdout,encoding:'utf8'});
  assert.equal(proof.status,0,proof.stderr);
  assert.equal(JSON.parse(proof.stdout).physicalInstances,24);
  const invalid=spawnSync(process.execPath,['scripts/swa7-population-proof.mjs','--stdin'],{cwd:root,input:'{}',encoding:'utf8'});
  assert.notEqual(invalid.status,0,'UNKNOWN must not pass');
});

test('SWA7 smoke retains the lifecycle and checks population before Hunt and after respawn',()=>{
  const source=readFileSync(new URL('./public-swa7-smoke.py',import.meta.url),'utf8');
  assert.ok(source.includes('population_before=population(initial)'));
  assert.ok(source.includes('population_after=population(final)'));
  assert.ok(source.includes("'populationBefore':population_before"));
  assert.ok(source.includes("'populationAfter':population_after"));
  assert.ok(!source.includes('len(monsters)==12'));
  for(const evidence of ['SWA7 public Hunt uses engine task without teleport','SWA7 public combat reaches VERIFIED Victory','SWA7 public Monster respawns as deterministic new incarnation'])assert.ok(source.includes(evidence));
});
