import {
  ADVENTURE_COMBAT_CORE6_SOURCE_KEYS,
  ADVENTURE_COMBAT_LEVEL_MAX,
  ADVENTURE_COMBAT_LEVEL_MIN,
  ADVENTURE_COMBAT_RATING_KEYS,
  ADVENTURE_COMBAT_STAT_MAX,
  createAdventurerCombatProfile,
} from './adventure-combat-profile.mjs?v=0.5.0';

export const ADVENTURE_COMBAT_STATS_VERSION = 'adventure-combat-stats/v1';
export const ADVENTURE_COMBAT_AGENT_HP_MAX = 100;
export const ADVENTURE_COMBAT_CORE_POLICY =
  'explicit-owner-core6-input/no-inferred-skill-balance/v1';

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

function boundedNumber(value, minimum, maximum) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function validateCoreStats(coreStats) {
  if (!exactKeys(coreStats, ADVENTURE_COMBAT_CORE6_SOURCE_KEYS)) {
    return result(false, 'invalid_core6_shape');
  }
  for (const key of ADVENTURE_COMBAT_CORE6_SOURCE_KEYS) {
    const minimum = key === 'hp' ? 1 : 0;
    if (!Number.isSafeInteger(coreStats[key])
        || coreStats[key] < minimum
        || coreStats[key] > ADVENTURE_COMBAT_STAT_MAX) {
      return result(false, 'invalid_core6_stat', { field: key });
    }
  }
  return result(true, null);
}

function validateRatings(ratings) {
  if (!exactKeys(ratings, ADVENTURE_COMBAT_RATING_KEYS)) {
    return result(false, 'invalid_ratings_shape');
  }
  for (const key of ADVENTURE_COMBAT_RATING_KEYS) {
    if (!boundedNumber(ratings[key], 0, 1)) {
      return result(false, 'invalid_rating', { field: key });
    }
  }
  return result(true, null);
}

/**
 * Combat level is a projection-only value. The adapter never writes it back.
 * Qualification counts, profession, and ordinary Simclone skill XP are not
 * silently converted into combat level.
 */
export function normalizeAdventureCombatLevel(value) {
  if (!Number.isSafeInteger(value)) return null;
  if (value < ADVENTURE_COMBAT_LEVEL_MIN || value > ADVENTURE_COMBAT_LEVEL_MAX) return null;
  return value;
}

/**
 * Simclone agent.hp is a 0..100 health ratio today. Convert that ratio to the
 * Pocket-shaped integer HP owned by the combat snapshot without mutating agent.hp.
 */
export function combatHpFromAgentHp(agentHp, hpMax) {
  if (!boundedNumber(agentHp, 0, ADVENTURE_COMBAT_AGENT_HP_MAX)) {
    throw new RangeError('agentHp must be a finite number in 0..100');
  }
  if (!Number.isSafeInteger(hpMax) || hpMax < 1 || hpMax > ADVENTURE_COMBAT_STAT_MAX) {
    throw new RangeError('hpMax must be a safe integer in 1..10000000');
  }
  return Math.floor((agentHp * hpMax) / ADVENTURE_COMBAT_AGENT_HP_MAX);
}

/**
 * Reverse helper for read-only reconciliation/display. This does not authorize
 * a write to agent.hp.
 */
export function agentHpFromCombatRatio(hpCurrent, hpMax) {
  if (!Number.isSafeInteger(hpMax) || hpMax < 1 || hpMax > ADVENTURE_COMBAT_STAT_MAX) {
    throw new RangeError('hpMax must be a safe integer in 1..10000000');
  }
  if (!Number.isSafeInteger(hpCurrent) || hpCurrent < 0 || hpCurrent > hpMax) {
    throw new RangeError('hpCurrent must be a safe integer in 0..hpMax');
  }
  return Math.round((hpCurrent / hpMax) * ADVENTURE_COMBAT_AGENT_HP_MAX * 1_000_000) / 1_000_000;
}

/**
 * Project one Clone/Adventurer snapshot into the shared Pocket-shaped profile.
 *
 * Expected input:
 * {
 *   agent: { hp },
 *   adventureProgression: {
 *     combatLevel,
 *     coreStats: { hp, atk, def, spAtk, spDef, spd }
 *   },
 *   ratings: { accuracy, crit, evasion, resistance, penetration }
 * }
 *
 * `coreStats` and `ratings` are explicit owner/fixture input because Simclone
 * does not yet have a combat-stat writer. Existing FORAGE/WOODCUT/MINE/BUILD
 * XP, EXPLORE qualification, profession, equipment and inventory are not
 * inferred into Core6 by this adapter.
 */
export function projectAdventurerCombatStats(snapshot = {}) {
  if (!isRecord(snapshot) || !isRecord(snapshot.agent)
      || !isRecord(snapshot.adventureProgression)) {
    return result(false, 'invalid_snapshot_shape');
  }

  const combatLevel = normalizeAdventureCombatLevel(
    snapshot.adventureProgression.combatLevel,
  );
  if (combatLevel === null) {
    return result(false, 'invalid_combat_level');
  }

  const coreValidation = validateCoreStats(snapshot.adventureProgression.coreStats);
  if (!coreValidation.ok) return coreValidation;
  const ratingValidation = validateRatings(snapshot.ratings);
  if (!ratingValidation.ok) return ratingValidation;

  const agentHp = snapshot.agent.hp;
  if (!boundedNumber(agentHp, 0, ADVENTURE_COMBAT_AGENT_HP_MAX)) {
    return result(false, 'invalid_agent_hp');
  }

  const core = snapshot.adventureProgression.coreStats;
  const profileResult = createAdventurerCombatProfile({
    level: combatLevel,
    hpMax: core.hp,
    hpCurrent: combatHpFromAgentHp(agentHp, core.hp),
    atk: core.atk,
    def: core.def,
    spAtk: core.spAtk,
    spDef: core.spDef,
    spd: core.spd,
    accuracy: snapshot.ratings.accuracy,
    crit: snapshot.ratings.crit,
    evasion: snapshot.ratings.evasion,
    resistance: snapshot.ratings.resistance,
    penetration: snapshot.ratings.penetration,
  });
  if (!profileResult.ok) return profileResult;

  return result(true, null, {
    profile: profileResult.profile,
    provenance: Object.freeze({
      adapterVersion: ADVENTURE_COMBAT_STATS_VERSION,
      corePolicy: ADVENTURE_COMBAT_CORE_POLICY,
      hpSource: 'agent.hp_ratio_0_100',
      levelSource: 'adventureProgression.combatLevel',
      coreSource: 'adventureProgression.coreStats_explicit_input',
      ratingsSource: 'ratings_explicit_input',
    }),
  });
}
