const STAT_KEYS = ["hp", "atk", "def", "spAtk", "spDef", "spd"];
const LEVEL_CAP = 60;
const JOB_CAP = 50;
const POTENTIAL_MAX = 31;
const TRAINING_PER_STAT = 200;
const TRAINING_TOTAL = 600;
function cumulativeExp(level) {
  const target = Math.max(1, Math.min(LEVEL_CAP, Math.floor(level)));
  return Math.round(target ** 3 - 1);
}
function levelFromExp(totalExp) {
  const total = Math.max(0, Math.floor(totalExp));
  let level = 1;
  while (level < LEVEL_CAP && cumulativeExp(level + 1) <= total) level += 1;
  return level;
}
function expIntoLevel(totalExp, level = levelFromExp(totalExp)) {
  return Math.max(0, Math.floor(totalExp) - cumulativeExp(level));
}
function expToNext(totalExp, level = levelFromExp(totalExp)) {
  if (level >= LEVEL_CAP) return 0;
  return cumulativeExp(level + 1) - Math.floor(totalExp);
}
function statValue(stat, base, level, potential, training) {
  if (!Number.isInteger(base) || base < 1) throw new Error("invalid_base");
  if (!Number.isInteger(level) || level < 1 || level > LEVEL_CAP) throw new Error("invalid_level");
  if (!Number.isInteger(potential) || potential < 0 || potential > POTENTIAL_MAX) throw new Error("invalid_potential");
  if (!Number.isInteger(training) || training < 0 || training > TRAINING_PER_STAT) throw new Error("invalid_training");
  const subtotal = 2 * base + potential + training / 4;
  const scaled = Math.floor(subtotal * level / 100);
  const flat = stat === "hp" ? level + 10 : 5;
  return scaled + flat;
}
function deriveStats(bases, level, potential, training) {
  const total = STAT_KEYS.reduce((sum, key) => sum + training[key], 0);
  if (total > TRAINING_TOTAL) throw new Error("training_total");
  const stats = {};
  for (const key of STAT_KEYS) stats[key] = statValue(key, bases[key], level, potential[key], training[key]);
  return stats;
}
function emptyTraining() {
  return { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0 };
}
function hash32(text) {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rollPotential(seed) {
  const potential = {};
  for (const key of STAT_KEYS) potential[key] = hash32(`${seed}:${key}`) % (POTENTIAL_MAX + 1);
  return potential;
}
function battleExp(baseYield, enemyLevel, monsterLevel, variant = 1) {
  const gap = Math.floor(enemyLevel) - Math.floor(monsterLevel);
  const gapMult = gap >= 5 ? 1.4 : gap >= 2 ? 1.15 : gap >= -2 ? 1 : gap >= -5 ? 0.75 : 0.5;
  return Math.floor(Math.max(0, baseYield) * enemyLevel / 7 * gapMult * variant);
}
function damageOf(input) {
  const stab = input.stab ?? 1;
  const typeMult = input.typeMult ?? 1;
  const variance = input.variance ?? 1;
  const pen = Math.min(0.95, Math.max(0, input.penetration ?? 0));
  const defense = Math.max(1, input.defense * (1 - pen));
  if (input.power <= 0 || typeMult <= 0) return 0;
  const base = Math.floor((2 * input.level / 5 + 2) * input.power * input.attack / defense / 50 + 2);
  const crit = input.crit ? 1.5 : 1;
  return Math.max(1, Math.floor(base * stab * typeMult * crit * variance));
}
function varianceOf(seed) {
  return 0.9 + 0.1 * (hash32(seed) % 10001 / 1e4);
}
export {
  JOB_CAP,
  LEVEL_CAP,
  POTENTIAL_MAX,
  STAT_KEYS,
  TRAINING_PER_STAT,
  TRAINING_TOTAL,
  battleExp,
  cumulativeExp,
  damageOf,
  deriveStats,
  emptyTraining,
  expIntoLevel,
  expToNext,
  hash32,
  levelFromExp,
  rollPotential,
  statValue,
  varianceOf
};
