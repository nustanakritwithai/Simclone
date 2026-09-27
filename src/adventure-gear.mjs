export const ADVENTURE_GEAR_SLOTS = Object.freeze(['WEAPON', 'ARMOR', 'ACCESSORY']);
export const ADVENTURE_COMBAT_MODIFIERS = Object.freeze(['ATK', 'DEF', 'SPATK', 'SPDEF', 'SPD', 'HP']);

export const ADVENTURE_GEAR_STAT_BOUNDS = Object.freeze({
  ATK: 60,
  DEF: 60,
  SPATK: 60,
  SPDEF: 60,
  SPD: 20,
  HP: 180,
});

export const ADVENTURE_LOADOUT_STAT_BOUNDS = Object.freeze({
  ATK: 100,
  DEF: 100,
  SPATK: 100,
  SPDEF: 100,
  SPD: 30,
  HP: 300,
});

export const ADVENTURE_GEAR_EXAMPLES = Object.freeze({
  EMBER_BLADE: Object.freeze({
    gearId: 'EMBER_BLADE',
    slot: 'WEAPON',
    rarity: 'RARE',
    baseModifiers: Object.freeze({ ATK: 8, SPATK: 4 }),
    upgradeMaterialKind: 'EMBER_SHARD',
  }),
  HIDE_ARMOR: Object.freeze({
    gearId: 'HIDE_ARMOR',
    slot: 'ARMOR',
    rarity: 'COMMON',
    baseModifiers: Object.freeze({ DEF: 6, SPDEF: 3, HP: 12 }),
    upgradeMaterialKind: 'HIDE',
  }),
  EMBER_CHARM: Object.freeze({
    gearId: 'EMBER_CHARM',
    slot: 'ACCESSORY',
    rarity: 'UNCOMMON',
    baseModifiers: Object.freeze({ SPATK: 5, SPD: 2 }),
    upgradeMaterialKind: 'FIRE_CORE',
  }),
});

function invariant(condition, message) {
  if (!condition) throw new TypeError(message);
}

function assertPlainObject(value, label) {
  invariant(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

export function boundCombatModifiers(modifiers, bounds = ADVENTURE_GEAR_STAT_BOUNDS) {
  assertPlainObject(modifiers, 'modifiers');
  const result = {};

  for (const [stat, rawValue] of Object.entries(modifiers)) {
    invariant(ADVENTURE_COMBAT_MODIFIERS.includes(stat), `unsupported combat modifier: ${stat}`);
    invariant(Number.isFinite(rawValue), `${stat} modifier must be finite`);
    invariant(rawValue >= 0, `${stat} modifier cannot be negative`);
    invariant(Number.isInteger(rawValue), `${stat} modifier must be an integer`);
    const cap = bounds[stat];
    invariant(Number.isInteger(cap) && cap >= 0, `missing stat bound for ${stat}`);
    result[stat] = Math.min(rawValue, cap);
  }

  return Object.freeze(result);
}

export function normalizeGearDefinition(gear) {
  assertPlainObject(gear, 'gear');
  invariant(typeof gear.gearId === 'string' && gear.gearId.trim().length > 0, 'gear.gearId must be non-empty');
  invariant(ADVENTURE_GEAR_SLOTS.includes(gear.slot), `unsupported gear slot: ${gear.slot}`);
  invariant(typeof gear.rarity === 'string' && gear.rarity.trim().length > 0, 'gear.rarity must be non-empty');
  invariant(typeof gear.upgradeMaterialKind === 'string' && gear.upgradeMaterialKind.trim().length > 0, 'gear.upgradeMaterialKind must be non-empty');

  return Object.freeze({
    gearId: gear.gearId,
    slot: gear.slot,
    rarity: gear.rarity,
    baseModifiers: boundCombatModifiers(gear.baseModifiers ?? {}),
    upgradeMaterialKind: gear.upgradeMaterialKind,
  });
}

/**
 * Read-only loadout calculation. Entries are proposals/snapshots, not inventory records.
 */
export function calculateLoadoutModifiers(equipment) {
  invariant(Array.isArray(equipment), 'equipment must be an array');
  const seenSlots = new Set();
  const totals = Object.fromEntries(ADVENTURE_COMBAT_MODIFIERS.map((stat) => [stat, 0]));

  for (const entry of equipment) {
    assertPlainObject(entry, 'equipment entry');
    invariant(ADVENTURE_GEAR_SLOTS.includes(entry.slot), `unsupported gear slot: ${entry.slot}`);
    invariant(!seenSlots.has(entry.slot), `duplicate equipment slot: ${entry.slot}`);
    seenSlots.add(entry.slot);
    const modifiers = boundCombatModifiers(entry.modifiers ?? {});
    for (const stat of ADVENTURE_COMBAT_MODIFIERS) {
      totals[stat] += modifiers[stat] ?? 0;
    }
  }

  return boundCombatModifiers(totals, ADVENTURE_LOADOUT_STAT_BOUNDS);
}
