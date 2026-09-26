import {
  JOB_CAP,
  LEVEL_CAP,
  STAT_KEYS,
  TRAINING_PER_STAT,
  TRAINING_TOTAL,
  battleExp,
  cumulativeExp,
  deriveStats,
  emptyTraining,
  expIntoLevel,
  expToNext,
  levelFromExp,
  rollPotential
} from "./formula.mjs";
import { JOBS, SKILLS } from "./content.mjs";
const SAVE_KEY = "khet-sila-v1";
function emptyClears() {
  return { z1: 0, z2: 0, z3: 0, z4: 0 };
}
function blankRanks() {
  return {
    aim: 0,
    weak: 0,
    pace: 0,
    mark: 0,
    slam: 0,
    guard: 0,
    plate: 0,
    smash: 0,
    spark: 0,
    mend: 0,
    veil: 0,
    purge: 0
  };
}
function spentPoints(ranks) {
  return Object.values(ranks).reduce((sum, rank) => sum + rank * (rank + 1) / 2, 0);
}
function jobLevel(level) {
  return Math.min(JOB_CAP, level);
}
function pointsLeft(character) {
  return jobLevel(levelFromExp(character.exp)) - spentPoints(character.ranks);
}
function createCharacter(name, job) {
  const clean = name.trim().slice(0, 16) || "\u0E1C\u0E39\u0E49\u0E40\u0E14\u0E34\u0E19";
  const seed = `${clean}:${job}:${hashStamp(clean, job)}`;
  const draft = {
    version: 1,
    name: clean,
    job,
    seed,
    exp: 0,
    form: "apprentice",
    potential: rollPotential(seed),
    training: emptyTraining(),
    trainingPoints: 0,
    shards: 0,
    gear: { weapon: 0, armor: 0, charm: 0 },
    hp: 1,
    clears: emptyClears(),
    ranks: blankRanks(),
    fights: 0
  };
  return { ...draft, hp: statsOf(draft).hp };
}
function hashStamp(name, job) {
  let h = 2166136261;
  const text = `${name}:${job}`;
  for (const ch of text) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
function characterLevel(character) {
  return levelFromExp(character.exp);
}
function basesOf(character) {
  const job = JOBS[character.job];
  return character.form === "advanced" ? job.advanced : job.apprentice;
}
function statsOf(character) {
  const raw = deriveStats(basesOf(character), characterLevel(character), character.potential, character.training);
  const gear = character.gear ?? { weapon: 0, armor: 0, charm: 0 };
  const job = JOBS[character.job];
  const attackKey = job.channel === "special" ? "spAtk" : "atk";
  const bonus = emptyTraining();
  bonus[attackKey] = gear.weapon * 3;
  bonus.def = gear.armor * 3;
  bonus.spd = gear.charm * 2;
  const stats = { ...raw };
  for (const key of STAT_KEYS) {
    const cap = Math.floor(raw[key] * 0.25);
    stats[key] = raw[key] + Math.min(cap, bonus[key]);
  }
  return stats;
}
function carryHp(before, after) {
  const previous = statsOf(before).hp;
  const nextMax = statsOf(after).hp;
  const current = after.hp ?? previous;
  const bonus = Math.max(0, nextMax - previous);
  return { ...after, hp: Math.min(nextMax, Math.max(0, current + bonus)) };
}
const ZONE_MARK = 5;
function noteZoneWin(character, zone) {
  const clears = character.clears ?? emptyClears();
  const count = (clears[zone] ?? 0) + 1;
  const bounty = count === ZONE_MARK;
  return {
    bounty,
    character: {
      ...character,
      shards: (character.shards ?? 0) + (bounty ? 1 : 0),
      clears: { ...clears, [zone]: count }
    }
  };
}
function rest(character) {
  return { ...character, hp: statsOf(character).hp };
}
function gearCost(tier) {
  return (tier + 1) * 4;
}
function forgeGear(character, slot) {
  const gear = character.gear ?? { weapon: 0, armor: 0, charm: 0 };
  const tier = gear[slot];
  if (tier >= 5) return null;
  const cost = gearCost(tier);
  if ((character.shards ?? 0) < cost) return null;
  return carryHp(character, { ...character, shards: character.shards - cost, gear: { ...gear, [slot]: tier + 1 } });
}
function progressOf(character) {
  const level = characterLevel(character);
  return {
    level,
    jobLevel: jobLevel(level),
    into: expIntoLevel(character.exp, level),
    next: level >= LEVEL_CAP ? 0 : expToNext(character.exp, level),
    span: level >= LEVEL_CAP ? 1 : cumulativeExp(level + 1) - cumulativeExp(level)
  };
}
function addExp(character, amount) {
  const before = characterLevel(character);
  const next = { ...character, exp: character.exp + Math.max(0, Math.floor(amount)) };
  const after = characterLevel(next);
  let promoted = false;
  if (next.form === "apprentice" && after >= 15 && jobLevel(after) >= 10) {
    next.form = "advanced";
    promoted = true;
  }
  if (after > before) next.trainingPoints += (after - before) * 2;
  return { character: carryHp(character, next), levels: after - before, promoted };
}
function awardBattle(character, baseYield, enemyLevel, variant = 1) {
  const reward = battleExp(baseYield, enemyLevel, characterLevel(character), variant);
  return { reward, ...addExp(character, reward) };
}
function trainStat(character, stat) {
  if (character.trainingPoints <= 0) return null;
  if (character.training[stat] >= TRAINING_PER_STAT) return null;
  const used = STAT_KEYS.reduce((sum, key) => sum + character.training[key], 0);
  if (used >= TRAINING_TOTAL) return null;
  return carryHp(character, {
    ...character,
    trainingPoints: character.trainingPoints - 1,
    training: { ...character.training, [stat]: character.training[stat] + 1 }
  });
}
function buySkill(character, skill) {
  const job = JOBS[character.job];
  if (!job.skills.includes(skill)) return null;
  const rank = character.ranks[skill];
  if (rank >= 5) return null;
  if (pointsLeft(character) < rank + 1) return null;
  return { ...character, ranks: { ...character.ranks, [skill]: rank + 1 } };
}
function respec(character) {
  return { ...character, ranks: blankRanks() };
}
function skillPower(skill, rank) {
  if (rank <= 0) return 0;
  if (skill === "weak") return 28 + rank * 8;
  if (skill === "mark") return 22 + rank * 6;
  if (skill === "slam") return 26 + rank * 7;
  if (skill === "smash") return 30 + rank * 8;
  if (skill === "spark") return 28 + rank * 8;
  if (skill === "purge") return 24 + rank * 7;
  return 0;
}
function saveCharacter(character) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(character));
}
function loadCharacter() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !JOBS[parsed.job] || !parsed.potential || !parsed.ranks) return null;
    parsed.shards ??= 0;
    parsed.gear ??= { weapon: 0, armor: 0, charm: 0 };
    parsed.trainingPoints ??= 0;
    if (typeof parsed.hp !== "number") parsed.hp = statsOf(parsed).hp;
    parsed.hp = Math.min(statsOf(parsed).hp, Math.max(0, parsed.hp));
    parsed.clears = { ...emptyClears(), ...parsed.clears ?? {} };
    for (const skill of Object.keys(SKILLS)) {
      if (typeof parsed.ranks[skill] !== "number") return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function clearCharacter() {
  localStorage.removeItem(SAVE_KEY);
}
export {
  ZONE_MARK,
  addExp,
  awardBattle,
  basesOf,
  blankRanks,
  buySkill,
  characterLevel,
  clearCharacter,
  createCharacter,
  emptyClears,
  forgeGear,
  gearCost,
  jobLevel,
  loadCharacter,
  noteZoneWin,
  pointsLeft,
  progressOf,
  respec,
  rest,
  saveCharacter,
  skillPower,
  spentPoints,
  statsOf,
  trainStat
};
