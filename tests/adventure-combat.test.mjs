import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ADVENTURE_COMBAT_OUTCOME_SCHEMA,
  ADVENTURE_COMBAT_RULES_VERSION,
  resolveAdventureCombat,
} from '../src/adventure-combat.mjs';

function profile(overrides = {}) {
  return {
    level: 20,
    types: ['Fire'],
    hpMax: 120,
    hpCurrent: 120,
    atk: 80,
    def: 60,
    spAtk: 70,
    spDef: 55,
    spd: 50,
    accuracy: 1,
    crit: 0,
    evasion: 0,
    resistance: 0,
    penetration: 0,
    ...overrides,
  };
}

function action(overrides = {}) {
  return {
    actionId: 'ADV_TEST_STRIKE',
    channel: 'physical',
    power: 60,
    accuracy: 1,
    element: 'Fire',
    criticalAllowed: true,
    armorPierce: 0,
    hitCount: 1,
    statusApplications: [],
    ...overrides,
  };
}

const rng = Object.freeze({ seed: 'adv6-seed-a', ticket: 'ticket-0001', sequence: 7 });

function resolve(input = {}) {
  return resolveAdventureCombat({
    attacker: profile(),
    defender: profile({ types: ['Grass'] }),
    action: action(),
    rng,
    ...input,
  });
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

test('same seed and byte-identical input produce the same CombatOutcome', () => {
  const input = {
    attacker: profile(),
    defender: profile({ types: ['Grass'] }),
    action: action(),
    rng: { ...rng },
    worldModifiers: {
      attacker: { atk: 1.1, spd: 0.95 },
      defender: { def: 1.05 },
    },
  };
  const first = resolveAdventureCombat(input);
  const second = resolveAdventureCombat(deepClone(input));
  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, ADVENTURE_COMBAT_OUTCOME_SCHEMA);
  assert.equal(first.rulesVersion, ADVENTURE_COMBAT_RULES_VERSION);
  assert.equal(first.committed, false);
  assert.deepEqual(first.rngTrace.map(entry => entry.label), ['hit', 'critical', 'variance']);
});

test('physical channel reads ATK against DEF and ignores SPATK/SPDEF for direct damage', () => {
  const baseline = resolve({
    attacker: profile({ atk: 90, spAtk: 1 }),
    defender: profile({ types: ['Grass'], def: 75, spDef: 1 }),
  });
  const changedSpecialOnly = resolve({
    attacker: profile({ atk: 90, spAtk: 9999 }),
    defender: profile({ types: ['Grass'], def: 75, spDef: 9999 }),
  });
  const changedPhysical = resolve({
    attacker: profile({ atk: 180, spAtk: 1 }),
    defender: profile({ types: ['Grass'], def: 30, spDef: 1 }),
  });

  assert.equal(baseline.attackStat, 90);
  assert.equal(baseline.defenseStat, 75);
  assert.equal(changedSpecialOnly.damage, baseline.damage);
  assert.ok(changedPhysical.damage > baseline.damage);
});

test('special channel reads SPATK against SPDEF and ignores ATK/DEF for direct damage', () => {
  const special = action({ channel: 'special', actionId: 'ADV_TEST_SPECIAL' });
  const baseline = resolve({
    attacker: profile({ atk: 1, spAtk: 90 }),
    defender: profile({ types: ['Grass'], def: 1, spDef: 75 }),
    action: special,
  });
  const changedPhysicalOnly = resolve({
    attacker: profile({ atk: 9999, spAtk: 90 }),
    defender: profile({ types: ['Grass'], def: 9999, spDef: 75 }),
    action: special,
  });
  const changedSpecial = resolve({
    attacker: profile({ atk: 1, spAtk: 180 }),
    defender: profile({ types: ['Grass'], def: 1, spDef: 30 }),
    action: special,
  });

  assert.equal(baseline.attackStat, 90);
  assert.equal(baseline.defenseStat, 75);
  assert.equal(changedPhysicalOnly.damage, baseline.damage);
  assert.ok(changedSpecial.damage > baseline.damage);
});

test('type immunity produces zero damage and leaves HP unchanged', () => {
  const outcome = resolve({
    attacker: profile({ types: ['Electric'] }),
    defender: profile({ types: ['Ground'], hpCurrent: 77 }),
    action: action({ actionId: 'ADV_TEST_ELECTRIC', element: 'Electric' }),
  });
  assert.equal(outcome.hit, true);
  assert.equal(outcome.typeMultiplier, 0);
  assert.equal(outcome.damage, 0);
  assert.equal(outcome.hpBefore, 77);
  assert.equal(outcome.hpAfter, 77);
});

test('level bounds are 1..60 inclusive', () => {
  assert.doesNotThrow(() => resolve({ attacker: profile({ level: 1 }) }));
  assert.doesNotThrow(() => resolve({ attacker: profile({ level: 60 }) }));
  assert.throws(() => resolve({ attacker: profile({ level: 0 }) }), /level must be 1\.\.60/);
  assert.throws(() => resolve({ attacker: profile({ level: 61 }) }), /level must be 1\.\.60/);
});

test('HP is lethal-clamped and cannot go below zero', () => {
  const outcome = resolve({
    attacker: profile({ level: 60, atk: 10_000 }),
    defender: profile({ types: ['Grass'], hpMax: 10, hpCurrent: 10, def: 1 }),
    action: action({ power: 10_000 }),
  });
  assert.equal(outcome.hpBefore, 10);
  assert.equal(outcome.hpAfter, 0);
  assert.equal(outcome.damage, 10);
  assert.ok(outcome.hitDamages.every(value => value >= 0));
});

test('invalid CombatProfile is rejected before resolution', () => {
  assert.throws(() => resolve({ attacker: { ...profile(), accuracy: 1.2 } }), /accuracy must be 0\.\.1/);
  const missing = profile();
  delete missing.spDef;
  assert.throws(() => resolve({ defender: missing }), /invalid spDef/);
});

test('resolver leaves caller input byte-identical and works with deeply frozen fixtures', () => {
  const input = {
    attacker: profile(),
    defender: profile({ types: ['Grass'] }),
    action: action({
      statusApplications: [{ statusId: 'ST_BURN', target: 'defender', chance: 0.75 }],
    }),
    rng: { ...rng },
    worldModifiers: {
      attacker: { atk: 1.1, crit: 1 },
      defender: { def: 0.9, resistance: 0.8 },
    },
  };
  const before = JSON.stringify(input);
  deepFreeze(input);
  const outcome = resolveAdventureCombat(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(outcome.committed, false);
  assert.ok(Object.isFrozen(outcome));
  assert.ok(Object.isFrozen(outcome.rngTrace));
});

test('accuracy/evasion, crit, penetration, world modifiers and SPD are deterministic inputs', () => {
  const miss = resolve({
    attacker: profile({ accuracy: 0 }),
    defender: profile({ types: ['Grass'], evasion: 0 }),
  });
  assert.equal(miss.hit, false);
  assert.equal(miss.damage, 0);

  const crit = resolve({
    attacker: profile({ crit: 1, penetration: 0.2, spd: 40 }),
    defender: profile({ types: ['Grass'], def: 120, spd: 60 }),
    action: action({ armorPierce: 0.3 }),
    worldModifiers: {
      attacker: { spd: 2 },
      defender: { spd: 1 },
    },
  });
  assert.equal(crit.critical, true);
  assert.equal(crit.combinedPenetration, 0.5);
  assert.deepEqual(crit.speedOrder, {
    attackerSpd: 80,
    defenderSpd: 60,
    relation: 'attacker_faster',
  });
});

test('status resolution emits proposals only and consumes RNG in definition order', () => {
  const outcome = resolve({
    attacker: profile({ crit: 0 }),
    defender: profile({ types: ['Grass'], resistance: 0.25 }),
    action: action({
      statusApplications: [
        { statusId: 'ST_BURN', target: 'defender', chance: 1 },
        { statusId: 'ST_FOCUS', target: 'attacker', chance: 1, resistible: false },
      ],
    }),
  });
  assert.equal(outcome.statusProposals.length, 2);
  assert.equal(outcome.statusProposals[0].finalChance, 0.75);
  assert.equal(outcome.statusProposals[1].finalChance, 1);
  assert.deepEqual(outcome.rngTrace.map(entry => entry.label), [
    'hit', 'critical', 'variance', 'status:ST_BURN', 'status:ST_FOCUS',
  ]);
  assert.equal(outcome.committed, false);
});
