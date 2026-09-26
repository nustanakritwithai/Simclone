import { damageOf, deriveStats, emptyTraining, hash32, varianceOf } from "./formula.mjs";
import { JOBS, SKILLS, ZONES, monsterById, stabOf, typeMultiplier } from "./content.mjs";
import { awardBattle, characterLevel, noteZoneWin, skillPower, statsOf } from "./character.mjs";
const RANK_MULT = {
  normal: { hp: 1, atk: 1, def: 1, spAtk: 1, spDef: 1, spd: 1 },
  elite: { hp: 1.3, atk: 1.12, def: 1.1, spAtk: 1.12, spDef: 1.1, spd: 1 },
  boss: { hp: 2, atk: 1.35, def: 1.3, spAtk: 1.35, spDef: 1.3, spd: 1 }
};
function scale(stats, rank) {
  const mult = RANK_MULT[rank];
  return {
    hp: Math.max(1, Math.round(stats.hp * mult.hp)),
    atk: Math.max(1, Math.round(stats.atk * mult.atk)),
    def: Math.max(1, Math.round(stats.def * mult.def)),
    spAtk: Math.max(1, Math.round(stats.spAtk * mult.spAtk)),
    spDef: Math.max(1, Math.round(stats.spDef * mult.spDef)),
    spd: Math.max(1, Math.round(stats.spd * mult.spd))
  };
}
function zoneLevel(zone, playerLevel) {
  const band = ZONES.find((item) => item.id === zone);
  if (!band) throw new Error("unknown_zone");
  return Math.min(band.max, Math.max(band.min, playerLevel));
}
function canEnter(zone, playerLevel) {
  const band = ZONES.find((item) => item.id === zone);
  return !!band && playerLevel >= band.need;
}
function push(log, line) {
  return [...log, line].slice(-8);
}
function startFight(character, monsterId, zone, boss = false) {
  const band = ZONES.find((item) => item.id === zone);
  const monster = monsterById(monsterId);
  if (!band || monster.stage !== band.stage) throw new Error("monster_outside_zone");
  const playerLevel = characterLevel(character);
  const level = zoneLevel(zone, playerLevel);
  const rank = boss ? "boss" : band.rank;
  const neutral = { hp: 15, atk: 15, def: 15, spAtk: 15, spDef: 15, spd: 15 };
  const wild = scale(deriveStats(monster.bases, level, neutral, emptyTraining()), rank);
  const self = statsOf(character);
  const hp = Math.min(self.hp, Math.max(0, character.hp ?? self.hp));
  if (hp <= 0) throw new Error("exhausted");
  const job = JOBS[character.job];
  const player = {
    name: character.name,
    element: job.element,
    level: playerLevel,
    maxHp: self.hp,
    hp,
    stats: self,
    channel: job.channel
  };
  const enemy = {
    name: boss ? `${monster.name}\u0E1C\u0E39\u0E49\u0E1E\u0E34\u0E17\u0E31\u0E01\u0E29\u0E4C` : monster.name,
    element: monster.element,
    level,
    maxHp: wild.hp,
    hp: wild.hp,
    stats: wild,
    channel: wild.spAtk > wild.atk ? "special" : "physical"
  };
  return {
    zone,
    monsterId,
    enemyLevel: level,
    variant: rank === "boss" ? 2.5 : rank === "elite" ? 1.4 : 1,
    variantName: rank,
    seed: `${character.seed}:${character.fights}`,
    turn: 1,
    player,
    enemy,
    aim: false,
    dodge: false,
    guard: 0,
    plateTurns: 0,
    platePct: 0,
    veilTurns: 0,
    veilPct: 0,
    enemySkip: false,
    enemyPlate: 0,
    breakTurns: 0,
    playerAilment: null,
    ailmentTurns: 0,
    log: [`\u0E1E\u0E1A${enemy.name} \u0E40\u0E25\u0E40\u0E27\u0E25 ${level}`],
    promotion: null,
    done: null
  };
}
function playerStrike(fight, character, skill) {
  if (fight.done) return { fight, character };
  if (skill && character.ranks[skill] <= 0) return { fight, character };
  const next = {
    ...fight,
    player: { ...fight.player },
    enemy: { ...fight.enemy },
    log: [...fight.log]
  };
  next.log = push(next.log, applyPlayer(next, character, skill));
  if (next.enemy.hp <= 0) {
    next.done = "win";
    next.log = push(next.log, `${next.enemy.name} \u0E25\u0E49\u0E21`);
    const monster = monsterById(fight.monsterId);
    const beforeStats = statsOf(character);
    const award = awardBattle(
      {
        ...character,
        hp: next.player.hp,
        fights: character.fights + 1,
        shards: (character.shards ?? 0) + 1
      },
      monster.exp,
      fight.enemyLevel,
      fight.variant
    );
    const marked = noteZoneWin(award.character, fight.zone);
    const gained = award.promoted ? " \u0E40\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E10\u0E32\u0E19\u0E2D\u0E32\u0E0A\u0E35\u0E1E\u0E41\u0E25\u0E49\u0E27 \u0E41\u0E15\u0E49\u0E21\u0E2A\u0E01\u0E34\u0E25\u0E43\u0E0A\u0E49\u0E44\u0E14\u0E49\u0E17\u0E35\u0E48\u0E04\u0E48\u0E32\u0E22" : award.levels > 0 ? ` \u0E02\u0E36\u0E49\u0E19\u0E40\u0E25\u0E40\u0E27\u0E25 ${characterLevel(award.character)}` : "";
    const bountyNote = marked.bounty ? " \u0E40\u0E1B\u0E49\u0E32\u0E42\u0E0B\u0E19\u0E04\u0E23\u0E1A \u0E44\u0E14\u0E49\u0E40\u0E28\u0E29\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2B\u0E19\u0E36\u0E48\u0E07" : "";
    next.promotion = award.promoted ? { before: beforeStats, after: statsOf(marked.character) } : null;
    next.log = push(next.log, `\u0E44\u0E14\u0E49 ${award.reward} \u0E1B\u0E23\u0E30\u0E2A\u0E1A\u0E01\u0E32\u0E23\u0E13\u0E4C${gained}${bountyNote}`);
    return { fight: next, character: marked.character };
  }
  enemyTurn(next);
  next.turn += 1;
  if (next.player.hp <= 0) {
    next.done = "down";
    next.player.hp = 0;
    next.log = push(next.log, "\u0E25\u0E49\u0E21\u0E43\u0E19\u0E2A\u0E19\u0E32\u0E21 \u0E1E\u0E25\u0E31\u0E07\u0E2B\u0E21\u0E14 \u0E01\u0E25\u0E31\u0E1A\u0E04\u0E48\u0E32\u0E22\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E1F\u0E37\u0E49\u0E19 \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E1B\u0E23\u0E30\u0E2A\u0E1A\u0E01\u0E32\u0E23\u0E13\u0E4C");
    return { fight: next, character: { ...character, fights: character.fights + 1, hp: 0 } };
  }
  return { fight: next, character: { ...character, hp: next.player.hp } };
}
function applyPlayer(fight, character, skill) {
  const job = JOBS[character.job];
  if (!skill) return hitEnemy(fight, character, job.channel, null, 40, 0, fight.aim);
  const rank = character.ranks[skill];
  const def = SKILLS[skill];
  if (skill === "aim") {
    fight.aim = true;
    return `${def.name} \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E31\u0E25\u0E17\u0E48\u0E32\u0E16\u0E31\u0E14\u0E44\u0E1B`;
  }
  if (skill === "pace") {
    fight.dodge = true;
    return `${def.name} \u0E08\u0E30\u0E2B\u0E25\u0E1A\u0E04\u0E23\u0E31\u0E49\u0E07\u0E16\u0E31\u0E14\u0E44\u0E1B`;
  }
  if (skill === "guard") {
    fight.guard = Math.min(0.6, 0.1 * rank);
    return `${def.name} \u0E25\u0E14\u0E14\u0E32\u0E40\u0E21\u0E08\u0E04\u0E23\u0E31\u0E49\u0E07\u0E16\u0E31\u0E14\u0E44\u0E1B ${Math.round(fight.guard * 100)}%`;
  }
  if (skill === "plate") {
    fight.plateTurns = 3;
    fight.platePct = 0.04 * rank;
    return `${def.name} \u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E01\u0E23\u0E32\u0E30 ${Math.round(fight.platePct * 100)}% \u0E2A\u0E32\u0E21\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30`;
  }
  if (skill === "veil") {
    fight.veilTurns = 2;
    fight.veilPct = 0.05 * rank;
    return `${def.name} \u0E25\u0E14\u0E14\u0E32\u0E40\u0E21\u0E08 ${Math.round(fight.veilPct * 100)}% \u0E2A\u0E2D\u0E07\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30`;
  }
  if (skill === "mend") {
    const heal = 8 + 4 * rank;
    const before = fight.player.hp;
    fight.player.hp = Math.min(fight.player.maxHp, fight.player.hp + heal);
    return `${def.name} \u0E1F\u0E37\u0E49\u0E19 ${fight.player.hp - before}`;
  }
  if (skill === "purge") {
    fight.enemyPlate = 0;
    fight.playerAilment = null;
    fight.ailmentTurns = 0;
  }
  let power = skillPower(skill, rank);
  if (skill === "mark" && fight.enemy.hp / fight.enemy.maxHp < 0.4) power = 40 + rank * 10;
  const penetration = skill === "smash" ? Math.min(0.95, 0.05 * rank) : 0;
  if (skill === "smash") fight.breakTurns = 3;
  const channel = def.channel === "special" ? "special" : "physical";
  const line = hitEnemy(fight, character, channel, def.element, power, penetration, fight.aim);
  if (skill === "slam") {
    const roll = hash32(`${fight.seed}:slam:${fight.turn}`) % 1e3 / 1e3;
    if (roll < Math.min(0.5, 0.08 * rank)) {
      fight.enemySkip = true;
      return `${line} \u0E28\u0E31\u0E15\u0E23\u0E39\u0E40\u0E2A\u0E35\u0E22\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30`;
    }
  }
  return line;
}
function hitEnemy(fight, character, channel, element, power, penetration, aimed) {
  const attack = channel === "special" ? fight.player.stats.spAtk : fight.player.stats.atk;
  let defense = channel === "special" ? fight.enemy.stats.spDef : fight.enemy.stats.def;
  if (fight.breakTurns > 0) defense = Math.round(defense * 0.85);
  defense = Math.round(defense * (1 + fight.enemyPlate));
  const typeMult = typeMultiplier(element, fight.enemy.element);
  const amount = damageOf({
    level: fight.player.level,
    power,
    attack,
    defense,
    stab: stabOf(element, fight.player.element),
    typeMult,
    variance: varianceOf(`${fight.seed}:p:${fight.turn}`),
    crit: aimed,
    penetration
  });
  fight.aim = false;
  fight.enemy.hp = Math.max(0, fight.enemy.hp - amount);
  const mark = typeMult === 0 ? "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1C\u0E25" : typeMult > 1 ? "\u0E44\u0E14\u0E49\u0E40\u0E1B\u0E23\u0E35\u0E22\u0E1A" : typeMult < 1 ? "\u0E40\u0E2A\u0E35\u0E22\u0E40\u0E1B\u0E23\u0E35\u0E22\u0E1A" : "";
  return `${character.name}${aimed ? " \u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E31\u0E25" : ""}\u0E17\u0E33 ${amount}${mark ? ` ${mark}` : ""}`;
}
function afflict(fight) {
  if (fight.playerAilment) return null;
  const roll = hash32(`${fight.seed}:ail:${fight.turn}`) % 1e3 / 1e3;
  if (fight.enemy.element === "FIRE" && roll < 0.35) {
    fight.playerAilment = "burn";
    fight.ailmentTurns = 3;
    return "\u0E15\u0E34\u0E14\u0E44\u0E2B\u0E21\u0E49";
  }
  if (fight.enemy.element === "POISON" && roll < 0.4) {
    fight.playerAilment = "poison";
    fight.ailmentTurns = 3;
    return "\u0E15\u0E34\u0E14\u0E1E\u0E34\u0E29";
  }
  return null;
}
function tickAilment(fight) {
  if (!fight.playerAilment || fight.player.hp <= 0) return null;
  const name = fight.playerAilment === "poison" ? "\u0E1E\u0E34\u0E29" : "\u0E44\u0E2B\u0E21\u0E49";
  const chip = Math.max(1, Math.floor(fight.player.maxHp / (fight.playerAilment === "poison" ? 12 : 16)));
  fight.player.hp = Math.max(0, fight.player.hp - chip);
  fight.ailmentTurns -= 1;
  if (fight.ailmentTurns <= 0) fight.playerAilment = null;
  return `${name} \u0E01\u0E31\u0E14\u0E01\u0E34\u0E19 ${chip}`;
}
function enemyTurn(fight) {
  if (fight.enemySkip) {
    fight.enemySkip = false;
    fight.log = push(fight.log, `${fight.enemy.name} \u0E40\u0E2A\u0E35\u0E22\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30`);
    const chip = tickAilment(fight);
    if (chip) fight.log = push(fight.log, chip);
    tickBuffs(fight);
    return;
  }
  if (fight.dodge) {
    fight.dodge = false;
    fight.log = push(fight.log, `\u0E2B\u0E25\u0E1A\u0E01\u0E32\u0E23\u0E42\u0E08\u0E21\u0E15\u0E35\u0E02\u0E2D\u0E07${fight.enemy.name}`);
    const chip = tickAilment(fight);
    if (chip) fight.log = push(fight.log, chip);
    tickBuffs(fight);
    return;
  }
  const channel = fight.enemy.channel;
  const attack = channel === "special" ? fight.enemy.stats.spAtk : fight.enemy.stats.atk;
  let defense = channel === "special" ? fight.player.stats.spDef : fight.player.stats.def;
  if (fight.plateTurns > 0) defense = Math.round(defense * (1 + fight.platePct));
  const typeMult = typeMultiplier(fight.enemy.element, fight.player.element);
  let amount = damageOf({
    level: fight.enemy.level,
    power: 40,
    attack,
    defense,
    stab: stabOf(fight.enemy.element, fight.enemy.element),
    typeMult,
    variance: varianceOf(`${fight.seed}:e:${fight.turn}`)
  });
  let reduced = 1;
  if (fight.guard > 0) {
    reduced *= 1 - fight.guard;
    fight.guard = 0;
  }
  if (fight.veilTurns > 0) reduced *= 1 - fight.veilPct;
  amount = typeMult === 0 ? 0 : Math.max(1, Math.floor(amount * reduced));
  fight.player.hp = Math.max(0, fight.player.hp - amount);
  fight.log = push(fight.log, `${fight.enemy.name} \u0E17\u0E33 ${amount}`);
  const prior = fight.playerAilment;
  const caught = afflict(fight);
  if (caught) fight.log = push(fight.log, caught);
  if (prior) {
    const chip = tickAilment(fight);
    if (chip) fight.log = push(fight.log, chip);
  }
  tickBuffs(fight);
}
function tickBuffs(fight) {
  if (fight.plateTurns > 0) fight.plateTurns -= 1;
  if (fight.veilTurns > 0) fight.veilTurns -= 1;
  if (fight.breakTurns > 0) fight.breakTurns -= 1;
}
function bossUnlocked(level) {
  return level >= 46;
}
function bossReadyAfter(current, next, ready) {
  if (next === "z4" && current !== "z4") return true;
  return ready;
}
function encounterShadow(input) {
  if (!input || typeof input !== "object") return null;
  const band = ZONES.find((item) => item.id === input.zone);
  if (!band) throw new Error("unknown_zone");
  if (!input.adventurer || typeof input.adventurer.exp !== "number") return null;
  const level = characterLevel(input.adventurer);
  let monsterId = null;
  if (input.monsterId != null) {
    const monster = monsterById(input.monsterId);
    if (monster.stage !== band.stage) throw new Error("monster_outside_zone");
    monsterId = monster.id;
  }
  return {
    zone: band.id,
    monsterId,
    enemyLevel: zoneLevel(band.id, level),
    rank: band.rank,
    allowed: canEnter(band.id, level)
  };
}
export {
  bossReadyAfter,
  bossUnlocked,
  canEnter,
  encounterShadow,
  playerStrike,
  startFight,
  zoneLevel
};
