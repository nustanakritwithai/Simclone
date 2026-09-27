import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {createWorld,serialize,restore,validate,step} from '../src/engine.mjs';
import {worldBounds} from '../src/world-bounds.mjs';
import {adventureZoneById} from '../src/adventure-zones.mjs';
import {monsterStatsAtLevel} from '../src/adventure-monster-stats.mjs';
import {
  WILD_MONSTER_WORLD_VERSION,
  WILD_MONSTER_INITIAL_COUNT,
  WILD_MONSTER_INITIAL_PER_ZONE,
  createInitialWildMonsterWorld,
  ensureWildMonsterWorld,
  validateWildMonsterWorld,
  wildMonsterById,
} from '../src/adventure-world-monsters.mjs';

const SEEDS=[230926,42,2026];

function clone(value){return JSON.parse(JSON.stringify(value));}

test('SWA2 fresh Same-World creates exactly 12 deterministic physical monsters',()=>{
  for(const seed of SEEDS){
    const a=createWorld(seed,{mode:'independent',worldProfile:'same-world'});
    const b=createWorld(seed,{mode:'independent',worldProfile:'same-world'});
    assert.equal(a.wildMonsters.version,WILD_MONSTER_WORLD_VERSION);
    assert.equal(a.wildMonsters.entities.length,WILD_MONSTER_INITIAL_COUNT);
    assert.equal(WILD_MONSTER_INITIAL_COUNT,12);
    assert.deepEqual(b.wildMonsters,a.wildMonsters);
    assert.equal(validateWildMonsterWorld(a).length,0);
    assert.equal(validate(a).length,0);

    const ids=new Set(a.wildMonsters.entities.map(m=>m.worldMonsterId));
    const forms=new Set(a.wildMonsters.entities.map(m=>m.monsterId));
    assert.equal(ids.size,12);
    assert.equal(forms.size,12);

    for(const zoneId of ['z1','z2','z3','z4']){
      const rows=a.wildMonsters.entities.filter(m=>m.zoneId===zoneId);
      assert.equal(rows.length,WILD_MONSTER_INITIAL_PER_ZONE);
      assert.equal(new Set(rows.map(m=>m.spawnSlot)).size,3);
    }
  }
});

test('SWA2 every monster is inside its zone, on grass, collision-free and uses canonical HP',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world'}),b=worldBounds(s);
  const positions=new Set();
  for(const m of s.wildMonsters.entities){
    const zone=adventureZoneById(m.zoneId);
    assert.ok(zone.rosterIds.includes(m.monsterId));
    assert.ok(m.level>=zone.minLevel&&m.level<=zone.maxLevel);
    assert.ok(m.x>=60&&m.x<=83&&m.y>=1&&m.y<=50);
    assert.equal(s.tiles[m.y*b.w+m.x],'grass');
    assert.equal(s.nodes.some(n=>n.x===m.x&&n.y===m.y),false);
    assert.equal(s.buildings.some(x=>x.x===m.x&&x.y===m.y),false);
    assert.equal((s.rustStations?.stations??[]).some(x=>x.x===m.x&&x.y===m.y),false);
    assert.equal(s.agents.some(a=>a.alive&&a.x===m.x&&a.y===m.y),false);
    assert.equal((s.rustPossessions?.items??[]).some(i=>i.location?.kind==='drop'&&i.location.x===m.x&&i.location.y===m.y),false);
    const pos=m.x+':'+m.y;assert.equal(positions.has(pos),false);positions.add(pos);
    const stats=monsterStatsAtLevel(m.monsterId,m.level);
    assert.equal(stats.ok,true);
    assert.equal(m.hpMax,stats.stats.hp);
    assert.equal(m.hpCurrent,m.hpMax);
    assert.equal(m.status,'IDLE');
    assert.equal(m.spawnEpoch,0);
    assert.equal(m.defeatedTick,null);
    assert.equal(m.respawnTick,null);
    assert.equal(m.engagedByAgentId,null);
    assert.equal(wildMonsterById(s,m.worldMonsterId)?.monsterId,m.monsterId);
  }
});

test('SWA2 Large and legacy worlds remain free of Wild Monster world state',()=>{
  for(const state of [
    createWorld(230926),
    createWorld(230926,{mode:'independent',worldProfile:'large'})
  ]){
    assert.equal(state.wildMonsters,undefined);
    assert.deepEqual(validateWildMonsterWorld(state),[]);
    assert.equal(validate(state).length,0);
  }
});

test('SWA2 Same-World monster authority survives save/load byte-identically',()=>{
  const a=createWorld(42,{mode:'independent',worldProfile:'same-world'});
  step(a,40);
  const text=serialize(a),b=restore(text);
  assert.equal(serialize(b),text);
  assert.deepEqual(b.wildMonsters,a.wildMonsters);
  step(a,80);step(b,80);
  assert.equal(serialize(b),serialize(a));
});

test('SWA2 public migration adds monsters once to released Large and SWA1 Same-World saves',()=>{
  const large=createWorld(2026,{mode:'independent',worldProfile:'large'});
  step(large,37);
  const migrated=restore(serialize(large),{sameWorld:true});
  assert.equal(worldBounds(migrated).profile,'same-world');
  assert.equal(migrated.wildMonsters.entities.length,12);
  assert.ok(migrated.wildMonsters.entities.every(m=>m.spawnedTick===37));
  const once=serialize(migrated),again=restore(once,{sameWorld:true});
  assert.equal(serialize(again),once);

  const swa1=clone(migrated);
  delete swa1.wildMonsters;
  const upgraded=restore(JSON.stringify(swa1),{sameWorld:true});
  assert.equal(upgraded.wildMonsters.entities.length,12);
  const upgradedText=serialize(upgraded);
  assert.equal(serialize(restore(upgradedText,{sameWorld:true})),upgradedText);
});

test('SWA2 ensure is idempotent and direct creation is deterministic',()=>{
  const state=createWorld(99,{mode:'independent',worldProfile:'same-world'});
  const before=serialize(state);
  assert.deepEqual(ensureWildMonsterWorld(state),{ok:true,changed:false});
  assert.equal(serialize(state),before);

  const shell=clone(state);delete shell.wildMonsters;
  const first=createInitialWildMonsterWorld(shell),second=createInitialWildMonsterWorld(shell);
  assert.deepEqual(second,first);
});

test('SWA2 validation fails closed on duplicate ID, wrong zone, overlap and HP drift',()=>{
  const base=createWorld(230926,{mode:'independent',worldProfile:'same-world'});

  const duplicate=clone(base);
  duplicate.wildMonsters.entities[1].worldMonsterId=duplicate.wildMonsters.entities[0].worldMonsterId;
  assert.ok(validate(duplicate).includes('Wild monsters'));

  const wrongZone=clone(base);
  wrongZone.wildMonsters.entities[0].zoneId='z4';
  assert.ok(validate(wrongZone).includes('Wild monsters'));

  const overlap=clone(base);
  overlap.wildMonsters.entities[1].x=overlap.wildMonsters.entities[0].x;
  overlap.wildMonsters.entities[1].y=overlap.wildMonsters.entities[0].y;
  assert.ok(validate(overlap).includes('Wild monsters'));

  const hp=clone(base);
  hp.wildMonsters.entities[0].hpCurrent--;
  assert.ok(validate(hp).includes('Wild monsters'));
});

test('SWA2 world authority source has no random, wall-clock or DOM gameplay rule',()=>{
  const source=fs.readFileSync(new URL('../src/adventure-world-monsters.mjs',import.meta.url),'utf8');
  for(const forbidden of ['Math.random','Date.now','new Date','document.','window.']){
    assert.equal(source.includes(forbidden),false,forbidden);
  }
});
