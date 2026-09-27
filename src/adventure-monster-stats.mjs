import {
  CORE6_STAT_KEYS,
  POCKET_MONSTER_WILD_SOURCE,
  monsterDefinition,
} from './adventure-monsters.mjs';

export const WILD_MONSTER_LEVEL_MIN = 1;
export const WILD_MONSTER_LEVEL_MAX = 60;
export const WILD_MONSTER_DEFAULT_POTENTIAL = 15;
export const WILD_MONSTER_DEFAULT_TRAINING = 0;
export const WILD_MONSTER_STAT_FORMULA_VERSION = POCKET_MONSTER_WILD_SOURCE.formulaVersion;

function failure(reason, field, value = null) {
  return Object.freeze({ ok: false, reason, field, value });
}

function statValue(baseStat, level, isHp) {
  const subtotal = (2 * baseStat) + WILD_MONSTER_DEFAULT_POTENTIAL
    + (WILD_MONSTER_DEFAULT_TRAINING / 4);
  const levelScaled = Math.floor((subtotal * level) / 100);
  return levelScaled + (isHp ? level + 10 : 5);
}

export function monsterStatsAtLevel(id, level) {
  const definition = monsterDefinition(id);
  if (!definition) return failure('unknown_monster_id', 'id', id ?? null);
  if (!Number.isSafeInteger(level)) return failure('invalid_level', 'level', level ?? null);
  if (level < WILD_MONSTER_LEVEL_MIN || level > WILD_MONSTER_LEVEL_MAX) {
    return failure('level_out_of_range', 'level', level);
  }

  const stats = {};
  for (const key of CORE6_STAT_KEYS) {
    stats[key] = statValue(definition.baseStats[key], level, key === 'hp');
  }

  return Object.freeze({
    ok: true,
    reason: null,
    monsterId: definition.monsterId,
    speciesId: definition.speciesId,
    formId: definition.formId,
    level,
    stats: Object.freeze(stats),
    formulaVersion: WILD_MONSTER_STAT_FORMULA_VERSION,
  });
}
