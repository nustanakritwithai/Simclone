import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ADVENTURE_LOOT_RANKS,
  makeLootClaimKey,
  proposeAdventureLoot,
} from '../src/adventure-loot.mjs';
import {
  ADVENTURE_GEAR_EXAMPLES,
  ADVENTURE_GEAR_STAT_BOUNDS,
  ADVENTURE_LOADOUT_STAT_BOUNDS,
  calculateLoadoutModifiers,
} from '../src/adventure-gear.mjs';
import {
  ADVENTURE_MAX_UPGRADE_LEVEL,
  ADVENTURE_UPGRADE_MATERIAL_CAP,
  calculateUpgradeModifiers,
  proposeGearUpgrade,
} from '../src/adventure-upgrade.mjs';

function fireLootInput(overrides = {}) {
  return {
    monster: { monsterId: 'fire-slime-l1', primaryType: 'FIRE' },
    rank: 'NORMAL',
    outcome: { outcomeId: 'outcome-001', verified: true, defeated: true },
    rngTicket: 'ticket-001',
    ...overrides,
  };
}

test('loot proposal is deterministic for identical monster/rank/outcome/ticket input', () => {
  const input = fireLootInput();
  assert.deepEqual(proposeAdventureLoot(input), proposeAdventureLoot(input));
});

test('loot quantities are integer, non-negative, and bounded for every supported rank', () => {
  for (const rank of Object.keys(ADVENTURE_LOOT_RANKS)) {
    const cap = ADVENTURE_LOOT_RANKS[rank].quantityCap;
    for (let i = 0; i < 128; i += 1) {
      const proposal = proposeAdventureLoot(fireLootInput({
        rank,
        outcome: { outcomeId: `outcome-${rank}-${i}`, verified: true, defeated: true },
        rngTicket: `ticket-${i}`,
      }));
      for (const item of proposal.items) {
        assert.equal(Number.isInteger(item.quantity), true);
        assert.ok(item.quantity >= 0);
        assert.ok(item.quantity <= Math.max(cap, ADVENTURE_LOOT_RANKS[rank].guaranteedCoreQty));
      }
    }
  }
});

test('unverified or non-defeat outcomes cannot create reward proposals', () => {
  assert.throws(() => proposeAdventureLoot(fireLootInput({ outcome: { outcomeId: 'x', verified: false, defeated: true } })), /verified/);
  assert.throws(() => proposeAdventureLoot(fireLootInput({ outcome: { outcomeId: 'x', verified: true, defeated: false } })), /defeated/);
});

test('duplicate outcome ID always maps to the same integration claim key', () => {
  const first = proposeAdventureLoot(fireLootInput({ rngTicket: 'ticket-a' }));
  const second = proposeAdventureLoot(fireLootInput({ rngTicket: 'ticket-b' }));
  assert.equal(first.claimKey, second.claimKey);
  assert.equal(first.claimKey, makeLootClaimKey('outcome-001'));
});

test('loot proposal does not mutate input', () => {
  const input = fireLootInput();
  const before = structuredClone(input);
  proposeAdventureLoot(input);
  assert.deepEqual(input, before);
});

test('gear loadout calculation uses only Weapon/Armor/Accessory snapshots and bounded combat vocabulary', () => {
  const result = calculateLoadoutModifiers([
    { slot: 'WEAPON', modifiers: { ATK: 60, SPATK: 60 } },
    { slot: 'ARMOR', modifiers: { DEF: 60, SPDEF: 60, HP: 180 } },
    { slot: 'ACCESSORY', modifiers: { ATK: 60, SPD: 20, HP: 180 } },
  ]);
  assert.deepEqual(result, {
    ATK: ADVENTURE_LOADOUT_STAT_BOUNDS.ATK,
    DEF: 60,
    SPATK: 60,
    SPDEF: 60,
    SPD: 20,
    HP: ADVENTURE_LOADOUT_STAT_BOUNDS.HP,
  });
});

test('negative gear modifiers are rejected and single-item modifiers stay bounded', () => {
  assert.throws(() => calculateLoadoutModifiers([{ slot: 'WEAPON', modifiers: { ATK: -1 } }]), /negative/);
  const capped = calculateUpgradeModifiers({ ATK: ADVENTURE_GEAR_STAT_BOUNDS.ATK }, ADVENTURE_MAX_UPGRADE_LEVEL);
  assert.ok(capped.ATK <= ADVENTURE_GEAR_STAT_BOUNDS.ATK);
});

test('upgrade proposal is deterministic, bounded, and advances exactly one level', () => {
  for (let level = 0; level < ADVENTURE_MAX_UPGRADE_LEVEL; level += 1) {
    const input = { gear: ADVENTURE_GEAR_EXAMPLES.EMBER_BLADE, fromLevel: level };
    const before = structuredClone(input);
    const first = proposeGearUpgrade(input);
    const second = proposeGearUpgrade(input);
    assert.deepEqual(first, second);
    assert.equal(first.toLevel, level + 1);
    assert.ok(first.materialProposal[0].quantity >= 1);
    assert.ok(first.materialProposal[0].quantity <= ADVENTURE_UPGRADE_MATERIAL_CAP);
    for (const [stat, value] of Object.entries(first.modifiersAfter)) {
      assert.ok(value >= 0);
      assert.ok(value <= ADVENTURE_GEAR_STAT_BOUNDS[stat]);
    }
    assert.deepEqual(input, before);
  }
});

test('upgrade past the contract maximum is rejected', () => {
  assert.throws(
    () => proposeGearUpgrade({ gear: ADVENTURE_GEAR_EXAMPLES.EMBER_BLADE, fromLevel: ADVENTURE_MAX_UPGRADE_LEVEL }),
    /fromLevel/,
  );
});
