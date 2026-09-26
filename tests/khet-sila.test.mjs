import assert from "node:assert/strict";
import test from "node:test";
import { assertVectors } from "../src/khet/vectors.mjs";
import { damageOf } from "../src/khet/formula.mjs";
import { typeMultiplier } from "../src/khet/content.mjs";
import { createCharacter, buySkill, addExp, forgeGear, statsOf, rest, pointsLeft } from "../src/khet/character.mjs";
import { startFight, playerStrike, canEnter, bossReadyAfter } from "../src/khet/combat.mjs";

test("เวกเตอร์สูตรตรงแผน", () => {
  assert.doesNotThrow(() => assertVectors());
});

test("ดาเมจเลเวล 1 พลังท่า 40", () => {
  assert.equal(damageOf({ level: 1, power: 40, attack: 6, defense: 5, variance: 1 }), 4);
});

test("โจมตีธรรมดาไม่เป็นศูนย์แม้ธาตุจะไม่มีผล และของสวมไม่เกินหนึ่งในสี่", () => {
  const ranger = createCharacter("ทดสอบ", "ranger");
  const slime = startFight(ranger, "MON_002", "z1");
  const hit = playerStrike(slime, ranger);
  assert.ok(hit.fight.enemy.hp < hit.fight.enemy.maxHp);
  const guardian = createCharacter("การ์ด", "guardian");
  const ghost = startFight({ ...guardian, exp: 200000 }, "MON_036", "z4");
  const swing = playerStrike(ghost, guardian);
  assert.ok(swing.fight.enemy.hp < swing.fight.enemy.maxHp);
  assert.equal(typeMultiplier("GRASS", "FIRE"), 0.5);
  assert.equal(typeMultiplier("FIGHTING", "GHOST"), 0);
  let geared = { ...ranger, shards: 20 };
  geared = forgeGear(geared, "weapon") ?? geared;
  const rawAtk = ranger.potential.atk;
  assert.ok(rawAtk >= 0);
  const worn = statsOf(geared);
  const bare = statsOf(ranger);
  assert.ok(worn.atk - bare.atk <= Math.floor(bare.atk * 0.25));
  assert.ok(worn.atk >= bare.atk);
});

test("พลังคงอยู่หลังสู้ และค่ายฟื้นจนเต็ม", () => {
  const hero = createCharacter("ทดสอบ", "ranger");
  const fight = startFight(hero, "MON_002", "z1");
  const hit = playerStrike(fight, hero);
  assert.ok(hit.character.hp < statsOf(hero).hp);
  const again = startFight(hit.character, "MON_001", "z1");
  assert.equal(again.player.hp, hit.character.hp);
  assert.equal(rest(hit.character).hp, statsOf(hit.character).hp);
});

test("เลเวล 15 เลื่อนฐานและสู้โซน 1 ได้", () => {
  let hero = createCharacter("ทดสอบ", "ranger");
  hero = addExp(hero, 3374).character;
  assert.equal(hero.form, "advanced");
  hero = buySkill(hero, "aim") ?? hero;
  const fight = startFight(hero, "MON_002", "z1");
  const hit = playerStrike(fight, hero);
  assert.ok(hit.fight.log.length > 1);
  const aimed = playerStrike(hit.fight, hit.character, "aim");
  assert.match(aimed.fight.log.join(" "), /เล็งแม่น/);
});

function dealt(log, name) {
  const line = [...log].reverse().find((item) => item.startsWith(name) && item.includes("ทำ "));
  return Number(line?.match(/ทำ (\d+)/)?.[1] ?? 0);
}

test("สกิลต่างจากท่าธรรมดา และสถานะหมดเอง", () => {
  let ranger = createCharacter("ป่า", "ranger");
  ranger = { ...ranger, ranks: { ...ranger.ranks, aim: 1, mark: 5 } };
  const aimed = playerStrike(playerStrike(startFight(ranger, "MON_002", "z1"), ranger, "aim").fight, ranger);
  assert.match(aimed.fight.log.join(" "), /คริติคัล/);

  const healthy = startFight(ranger, "MON_002", "z1");
  const wounded = startFight(ranger, "MON_002", "z1");
  wounded.enemy.hp = Math.max(1, Math.floor(wounded.enemy.maxHp * 0.2));
  const soft = playerStrike(healthy, ranger, "mark");
  const low = playerStrike(wounded, ranger, "mark");
  assert.ok(dealt(low.fight.log, ranger.name) > dealt(soft.fight.log, ranger.name));

  let ritual = createCharacter("พิธี", "ritual");
  ritual = { ...ritual, ranks: { ...ritual.ranks, mend: 2, purge: 1 } };
  const hurt = startFight(ritual, "MON_001", "z1");
  hurt.player.hp = 4;
  const healed = playerStrike(hurt, ritual, "mend");
  assert.match(healed.fight.log.join(" "), /ฟื้น/);
  assert.equal(healed.fight.player.maxHp, hurt.player.maxHp);

  const burned = startFight(ritual, "MON_001", "z1");
  burned.playerAilment = "burn";
  burned.ailmentTurns = 2;
  const cleansed = playerStrike(burned, ritual, "purge");
  assert.equal(cleansed.fight.playerAilment, null);

  const fading = startFight(ranger, "MON_001", "z1");
  fading.playerAilment = "burn";
  fading.ailmentTurns = 1;
  const gone = playerStrike(fading, ranger);
  assert.equal(gone.fight.playerAilment, null);
  assert.match(gone.fight.log.join(" "), /ไหม้ กัดกิน/);

  let guardian = createCharacter("การ์ด", "guardian");
  guardian = { ...guardian, ranks: { ...guardian.ranks, guard: 5, smash: 5 } };
  const open = playerStrike(startFight(guardian, "MON_001", "z1"), guardian);
  const held = playerStrike(startFight(guardian, "MON_001", "z1"), guardian, "guard");
  assert.ok(dealt(held.fight.log, "สไลม์ปกติ") < dealt(open.fight.log, "สไลม์ปกติ"));
  const broken = playerStrike(startFight(guardian, "MON_001", "z1"), guardian, "smash");
  assert.ok(broken.fight.breakTurns > 0);
});

test("โซนสองรับเฉพาะร่างสอง และผู้พิทักษ์ท้าได้ครั้งเดียวต่อการเข้า", () => {
  assert.equal(canEnter("z2", 15), false);
  assert.equal(canEnter("z2", 16), true);
  const hero = addExp(createCharacter("โซน", "ranger"), 5000).character;
  assert.throws(() => startFight(hero, "MON_002", "z2"));
  const fox = startFight(hero, "MON_020", "z2");
  assert.equal(fox.enemy.level >= 16, true);
  assert.equal(bossReadyAfter("z3", "z4", false), true);
  assert.equal(bossReadyAfter("z4", "z4", false), false);
  assert.equal(canEnter("z3", 30), false);
  assert.equal(canEnter("z3", 31), true);
  assert.equal(canEnter("z4", 45), false);
  assert.equal(canEnter("z4", 46), true);
  const ridge = addExp(createCharacter("เขา", "ranger"), 31 ** 3).character;
  assert.throws(() => startFight(ridge, "MON_002", "z3"));
  assert.equal(startFight(ridge, "MON_027", "z3").variantName, "normal");
  const cave = addExp(createCharacter("ถ้ำ", "ranger"), 46 ** 3).character;
  assert.equal(startFight(cave, "MON_029", "z4").variantName, "elite");
});

test("เลื่อนฐานไม่เติมพลังที่หาย และเป้าห้าตัวให้เศษครั้งเดียว", () => {
  let hero = createCharacter("ฐาน", "ranger");
  const missing = statsOf(hero).hp - 3;
  hero = { ...hero, hp: 3 };
  const raised = addExp(hero, 3374);
  assert.equal(raised.promoted, true);
  assert.equal(statsOf(raised.character).hp - raised.character.hp, missing);
  assert.ok(pointsLeft(raised.character) >= 15);
  const fight = startFight(hero, "MON_001", "z1");
  fight.enemy.hp = 1;
  const shown = playerStrike(fight, { ...hero, exp: 3374 });
  assert.ok(shown.fight.promotion);
  assert.ok(shown.fight.promotion.after.hp > shown.fight.promotion.before.hp);

  let hunter = createCharacter("เป้า", "ranger");
  for (let i = 0; i < 5; i += 1) {
    const bout = startFight(hunter, "MON_001", "z1");
    bout.enemy.hp = 1;
    hunter = playerStrike(bout, hunter).character;
  }
  assert.equal(hunter.clears.z1, 5);
  assert.equal(hunter.shards, 6);
  const extra = startFight(hunter, "MON_001", "z1");
  extra.enemy.hp = 1;
  hunter = playerStrike(extra, hunter).character;
  assert.equal(hunter.shards, 7);
});
