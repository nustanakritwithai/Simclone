export const ADVENTURE_COMBAT_PROFILE_VERSION = 'adventure-combat-profile/v1';
export const ADVENTURE_COMBAT_LEVEL_MIN = 1;
export const ADVENTURE_COMBAT_LEVEL_MAX = 60;
export const ADVENTURE_COMBAT_STAT_MAX = 10_000_000;

export const ADVENTURE_COMBAT_CORE6_VOCABULARY = Object.freeze([
  'HP',
  'ATK',
  'DEF',
  'SPATK',
  'SPDEF',
  'SPD',
]);

export const ADVENTURE_COMBAT_CORE6_SOURCE_KEYS = Object.freeze([
  'hp',
  'atk',
  'def',
  'spAtk',
  'spDef',
  'spd',
]);

export const ADVENTURE_COMBAT_RATING_KEYS = Object.freeze([
  'accuracy',
  'crit',
  'evasion',
  'resistance',
  'penetration',
]);

export const ADVENTURE_COMBAT_PROFILE_KEYS = Object.freeze([
  'level',
  'hpMax',
  'hpCurrent',
  'atk',
  'def',
  'spAtk',
  'spDef',
  'spd',
  ...ADVENTURE_COMBAT_RATING_KEYS,
]);

function result(ok, reason, detail = {}) {
  return Object.freeze({ ok, reason, ...detail });
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function canonicalProfile(profile) {
  return Object.freeze(Object.fromEntries(
    ADVENTURE_COMBAT_PROFILE_KEYS.map(key => [key, profile[key]]),
  ));
}

export function validateAdventurerCombatStats(profile) {
  if (!exactKeys(profile, ADVENTURE_COMBAT_PROFILE_KEYS)) {
    return result(false, 'invalid_profile_shape');
  }

  if (!Number.isSafeInteger(profile.level)
      || profile.level < ADVENTURE_COMBAT_LEVEL_MIN
      || profile.level > ADVENTURE_COMBAT_LEVEL_MAX) {
    return result(false, 'invalid_level', { field: 'level' });
  }

  for (const key of ['hpMax', 'hpCurrent', 'atk', 'def', 'spAtk', 'spDef', 'spd']) {
    if (!Number.isSafeInteger(profile[key])
        || profile[key] < 0
        || profile[key] > ADVENTURE_COMBAT_STAT_MAX) {
      return result(false, 'invalid_integer_stat', { field: key });
    }
  }

  if (profile.hpMax < 1) {
    return result(false, 'invalid_stat', { field: 'hpMax' });
  }
  if (profile.hpCurrent > profile.hpMax) {
    return result(false, 'hp_out_of_range', { field: 'hpCurrent' });
  }

  for (const key of ADVENTURE_COMBAT_RATING_KEYS) {
    if (!Number.isFinite(profile[key]) || profile[key] < 0 || profile[key] > 1) {
      return result(false, 'ratio_out_of_range', { field: key });
    }
  }

  return result(true, null, { profile: canonicalProfile(profile) });
}

export function createAdventurerCombatProfile(input) {
  return validateAdventurerCombatStats(input);
}
