import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as encounterApi from '../src/adventure-encounter.mjs';
import {
  ADVENTURE_MONSTER_ID_CONTRACT,
  ADVENTURE_ZONES,
  adventureZoneById,
  assertAdventureMonsterInZone,
  assertAdventureZoneAccess,
  canEnterAdventureZone,
  isCanonicalAdventureMonsterId,
  zoneContainsMonster
} from '../src/adventure-zones.mjs';
import {resolveAdventureEncounter} from '../src/adventure-encounter.mjs';

const expectedBands = [
  ['z1', 1, 15],
  ['z2', 16, 30],
  ['z3', 31, 45],
  ['z4', 46, 60]
];

test('ADV5 zone definitions preserve the four Khet level bands and walking contract', () => {
  assert.deepEqual(ADVENTURE_ZONES.map(zone => [zone.zoneId, zone.minLevel, zone.maxLevel]), expectedBands);
  for (const zone of ADVENTURE_ZONES) {
    assert.equal(zone.regionRequirements.presence, 'INSIDE_REGION');
    assert.equal(zone.regionRequirements.travelMode, 'WALK');
    assert.equal(zone.regionRequirements.pathAuthority, 'AGENT_H');
    assert.equal(zone.regionRequirements.pathfinding, 'REQUIRED_BEFORE_RUNTIME_WIRING');
    assert.ok(zone.regionRequirements.worldRegionId.startsWith('khet-sila:'));
  }
});

test('ADV5 uses a self-contained canonical monster id fixture and explicit per-zone rosters', () => {
  assert.equal(ADVENTURE_MONSTER_ID_CONTRACT.length, 36);
  assert.equal(new Set(ADVENTURE_MONSTER_ID_CONTRACT).size, 36);
  assert.equal(ADVENTURE_MONSTER_ID_CONTRACT[0], 'MON_001');
  assert.equal(ADVENTURE_MONSTER_ID_CONTRACT.at(-1), 'MON_036');
  for (const zone of ADVENTURE_ZONES) {
    assert.ok(zone.rosterIds.length > 0);
    for (const monsterId of zone.rosterIds) assert.equal(isCanonicalAdventureMonsterId(monsterId), true);
  }
  assert.equal(zoneContainsMonster('z2', 'MON_029'), false);
  assert.equal(zoneContainsMonster('z3', 'MON_029'), false);
  assert.equal(zoneContainsMonster('z4', 'MON_029'), true);
  assert.equal(zoneContainsMonster('z2', 'MON_023'), false);
  assert.equal(zoneContainsMonster('z3', 'MON_023'), true);
});

test('ADV5 level gate is enforced by zone authority while higher levels may revisit lower bands', () => {
  for (const [zoneId, minLevel] of expectedBands) {
    if (minLevel > 1) assert.equal(canEnterAdventureZone(zoneId, minLevel - 1), false);
    assert.equal(canEnterAdventureZone(zoneId, minLevel), true);
    assert.equal(canEnterAdventureZone(zoneId, 60), true);
  }
  assert.throws(() => assertAdventureZoneAccess('z4', 45), /zone_level_gate/);
  assert.equal(assertAdventureZoneAccess('z4', 46).zoneId, 'z4');
  assert.throws(() => adventureZoneById('nope'), /unknown_zone/);
  assert.throws(() => assertAdventureZoneAccess('z1', 0), /invalid_adventure_level/);
});

test('ADV5 roster authority rejects canonical monsters that belong to another zone', () => {
  assert.equal(assertAdventureMonsterInZone('z4', 'MON_029'), 'MON_029');
  assert.throws(() => assertAdventureMonsterInZone('z2', 'MON_029'), /monster_outside_zone/);
  assert.throws(() => assertAdventureMonsterInZone('z1', 'MON_999'), /unknown_monster_id/);
});

test('ADV5 encounter is deterministic, bounded by zone and does not mutate its input', () => {
  const input = {seed: 230926, tick: 720, agentId: 7, x: 18, y: -4, adventureLevel: 33, zoneId: 'z3'};
  const before = structuredClone(input);
  const first = resolveAdventureEncounter(input);
  const second = resolveAdventureEncounter({...input});
  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  assert.equal(first.zoneId, 'z3');
  assert.equal(adventureZoneById('z3').rosterIds.includes(first.monsterId), true);
  assert.equal(first.monsterLevel >= 31 && first.monsterLevel <= 33, true);
  assert.equal(first.rank, 'normal');
  assert.equal(Object.isFrozen(first), true);
});

test('ADV5 z4 encounter cannot leak into z2 or z3 and is capped to the z4 band', () => {
  const cave = resolveAdventureEncounter({seed: 42, tick: 1440, agentId: 9, x: 31, y: 12, adventureLevel: 70, zoneId: 'z4'});
  assert.equal(adventureZoneById('z4').rosterIds.includes(cave.monsterId), true);
  assert.equal(adventureZoneById('z2').rosterIds.includes(cave.monsterId), false);
  assert.equal(adventureZoneById('z3').rosterIds.includes(cave.monsterId), false);
  assert.equal(cave.monsterLevel >= 46 && cave.monsterLevel <= 60, true);
  assert.equal(cave.rank, 'elite');
});

test('ADV5 encounter rejects invalid zone, blocked level and malformed deterministic inputs', () => {
  const base = {seed: 1, tick: 1, agentId: 1, x: 0, y: 0, adventureLevel: 1, zoneId: 'z1'};
  assert.throws(() => resolveAdventureEncounter({...base, zoneId: 'nope'}), /unknown_zone/);
  assert.throws(() => resolveAdventureEncounter({...base, zoneId: 'z2'}), /zone_level_gate/);
  assert.throws(() => resolveAdventureEncounter({...base, tick: -1}), /invalid_tick/);
  assert.throws(() => resolveAdventureEncounter({...base, x: 0.5}), /invalid_x/);
});

test('ADV5 source has no random, wall-clock, world writer, UI, combat, loot or teleport API', () => {
  const zones = readFileSync(new URL('../src/adventure-zones.mjs', import.meta.url), 'utf8');
  const encounter = readFileSync(new URL('../src/adventure-encounter.mjs', import.meta.url), 'utf8');
  const source = `${zones}\n${encounter}`;
  for (const forbidden of ['Math.random', 'Date.now', 'localStorage', 'engine.mjs', 'app.mjs', 'combat.mjs', 'loot.mjs']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.equal(Object.keys(encounterApi).some(name => /teleport/i.test(name)), false);
});
