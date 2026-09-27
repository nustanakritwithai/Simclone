import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ADVENTURE_COMBAT_CORE6_VOCABULARY,
  ADVENTURE_COMBAT_PROFILE_KEYS,
  validateAdventurerCombatStats,
} from '../src/adventure-combat-profile.mjs';
import {
  ADVENTURE_COMBAT_CORE_POLICY,
  agentHpFromCombatRatio,
  combatHpFromAgentHp,
  normalizeAdventureCombatLevel,
  projectAdventurerCombatStats,
} from '../src/adventure-combat-stats.mjs';

const FIXTURE = Object.freeze({
  agent: Object.freeze({
    id: 7,
    hp: 75.5,
    profession: 'adventurer',
    skills: Object.freeze({ FORAGE: 80, WOODCUT: 40, MINE: 20, BUILD: 60 }),
    inventory: Object.freeze([{ id: 'ignored-item' }]),
  }),
  adventureProgression: Object.freeze({
    combatLevel: 12,
    coreStats: Object.freeze({
      hp: 160,
      atk: 44,
      def: 38,
      spAtk: 31,
      spDef: 35,
      spd: 47,
    }),
    qualificationAccepted: 3,
  }),
  ratings: Object.freeze({
    accuracy: 0.92,
    crit: 0.08,
    evasion: 0.07,
    resistance: 0.12,
    penetration: 0.04,
  }),
});

test('canonical vocabulary and profile surface stay Pocket-shaped', () => {
  assert.deepEqual(ADVENTURE_COMBAT_CORE6_VOCABULARY, ['HP', 'ATK', 'DEF', 'SPATK', 'SPDEF', 'SPD']);
  assert.deepEqual(ADVENTURE_COMBAT_PROFILE_KEYS, [
    'level', 'hpMax', 'hpCurrent', 'atk', 'def', 'spAtk', 'spDef', 'spd',
    'accuracy', 'crit', 'evasion', 'resistance', 'penetration',
  ]);
});

test('combat level accepts only explicit safe integers in 1..60', () => {
  assert.equal(normalizeAdventureCombatLevel(1), 1);
  assert.equal(normalizeAdventureCombatLevel(60), 60);
  for (const value of [0, 61, 1.5, NaN, Infinity, '12', null, undefined]) {
    assert.equal(normalizeAdventureCombatLevel(value), null);
  }
});

test('agent HP ratio converts deterministically to integer combat HP', () => {
  assert.equal(combatHpFromAgentHp(100, 160), 160);
  assert.equal(combatHpFromAgentHp(75.5, 160), 120);
  assert.equal(combatHpFromAgentHp(50, 101), 50);
  assert.equal(combatHpFromAgentHp(0, 160), 0);
});

test('combat HP ratio can be projected back to Simclone 0..100 scale without a write', () => {
  assert.equal(agentHpFromCombatRatio(160, 160), 100);
  assert.equal(agentHpFromCombatRatio(120, 160), 75);
  assert.equal(agentHpFromCombatRatio(0, 160), 0);
  assert.equal(agentHpFromCombatRatio(1, 3), 33.333333);
});

test('projection maps explicit owner Core6 and ratings without inventing skill balance', () => {
  const out = projectAdventurerCombatStats(FIXTURE);
  assert.equal(out.ok, true);
  assert.equal(out.provenance.corePolicy, ADVENTURE_COMBAT_CORE_POLICY);
  assert.deepEqual(out.profile, {
    level: 12,
    hpMax: 160,
    hpCurrent: 120,
    atk: 44,
    def: 38,
    spAtk: 31,
    spDef: 35,
    spd: 47,
    accuracy: 0.92,
    crit: 0.08,
    evasion: 0.07,
    resistance: 0.12,
    penetration: 0.04,
  });
});

test('projection is deterministic and does not mutate Clone/Adventurer input', () => {
  const before = JSON.stringify(FIXTURE);
  const a = projectAdventurerCombatStats(FIXTURE);
  const b = projectAdventurerCombatStats(FIXTURE);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(FIXTURE), before);
  assert.equal(Object.isFrozen(a.profile), true);
  assert.equal(Object.isFrozen(a.provenance), true);
});

test('ordinary Clone skills, inventory, profession and qualification do not silently change Core6', () => {
  const variant = {
    ...FIXTURE,
    agent: {
      ...FIXTURE.agent,
      profession: 'miner',
      skills: { FORAGE: 999999, WOODCUT: 999999, MINE: 999999, BUILD: 999999 },
      inventory: [{ id: 'different-item' }],
    },
    adventureProgression: {
      ...FIXTURE.adventureProgression,
      qualificationAccepted: 0,
    },
  };
  const base = projectAdventurerCombatStats(FIXTURE);
  const changed = projectAdventurerCombatStats(variant);
  assert.equal(changed.ok, true);
  assert.deepEqual(changed.profile, base.profile);
});

test('projection fails closed when combat level is absent or out of range', () => {
  assert.equal(projectAdventurerCombatStats({
    ...FIXTURE,
    adventureProgression: { ...FIXTURE.adventureProgression, combatLevel: undefined },
  }).reason, 'invalid_combat_level');
  assert.equal(projectAdventurerCombatStats({
    ...FIXTURE,
    adventureProgression: { ...FIXTURE.adventureProgression, combatLevel: 61 },
  }).reason, 'invalid_combat_level');
});

test('projection requires exact explicit Core6 input and bounded ratings', () => {
  assert.equal(projectAdventurerCombatStats({
    ...FIXTURE,
    adventureProgression: {
      ...FIXTURE.adventureProgression,
      coreStats: { ...FIXTURE.adventureProgression.coreStats, luck: 9 },
    },
  }).reason, 'invalid_core6_shape');
  assert.equal(projectAdventurerCombatStats({
    ...FIXTURE,
    ratings: { ...FIXTURE.ratings, crit: 1.01 },
  }).reason, 'invalid_rating');
});

test('profile validator rejects non-canonical shape and HP overflow', () => {
  const good = projectAdventurerCombatStats(FIXTURE).profile;
  assert.equal(validateAdventurerCombatStats(good).ok, true);
  assert.equal(validateAdventurerCombatStats({ ...good, extra: true }).reason, 'invalid_profile_shape');
  assert.equal(validateAdventurerCombatStats({ ...good, hpCurrent: good.hpMax + 1 }).reason, 'hp_out_of_range');
});

test('HP conversion helpers reject corrupt or non-Pocket-safe inputs', () => {
  assert.throws(() => combatHpFromAgentHp(-1, 10), /agentHp/);
  assert.throws(() => combatHpFromAgentHp(101, 10), /agentHp/);
  assert.throws(() => combatHpFromAgentHp(50, 0), /hpMax/);
  assert.throws(() => agentHpFromCombatRatio(11, 10), /hpCurrent/);
});

test('source boundary contains no engine import or world-state writer', () => {
  const statsSource = fs.readFileSync(new URL('../src/adventure-combat-stats.mjs', import.meta.url), 'utf8');
  const profileSource = fs.readFileSync(new URL('../src/adventure-combat-profile.mjs', import.meta.url), 'utf8');
  const source = `${statsSource}\n${profileSource}`;
  assert.equal(source.includes("engine.mjs"), false);
  assert.equal(/\bagent\.hp\s*=/.test(source), false);
  assert.equal(/\bagent\.skills\s*=/.test(source), false);
  assert.equal(/\binventory\s*=/.test(source), false);
  assert.equal(/\blocalStorage\b/.test(source), false);
  assert.equal(/\bcombatSave\b/.test(source), false);
});
