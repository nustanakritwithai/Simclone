import { JOBS, monsterById } from "./content.mjs";
import { battleExp, cumulativeExp, deriveStats, emptyTraining, statValue } from "./formula.mjs";
const pot = { hp: 15, atk: 15, def: 15, spAtk: 15, spDef: 15, spd: 15 };
function expectStats(label, actual, hp, atk, third, key) {
  if (actual.hp !== hp || actual.atk !== atk || actual[key] !== third) {
    throw new Error(`${label} \u0E44\u0E14\u0E49 ${actual.hp}/${actual.atk}/${actual[key]} \u0E41\u0E17\u0E19 ${hp}/${atk}/${third}`);
  }
}
function assertVectors() {
  const train = emptyTraining();
  const apprentice = deriveStats(JOBS.ranger.apprentice, 1, pot, train);
  expectStats("\u0E40\u0E14\u0E34\u0E19\u0E1B\u0E48\u0E32\u0E40\u0E25\u0E40\u0E27\u0E25 1", apprentice, 12, 6, 6, "spd");
  const atFifteen = deriveStats(JOBS.ranger.apprentice, 15, pot, train);
  expectStats("\u0E40\u0E14\u0E34\u0E19\u0E1B\u0E48\u0E32\u0E40\u0E25\u0E40\u0E27\u0E25 15 \u0E01\u0E48\u0E2D\u0E19\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E19", atFifteen, 41, 21, 24, "spd");
  const promoted = deriveStats(JOBS.ranger.advanced, 15, pot, train);
  expectStats("\u0E40\u0E14\u0E34\u0E19\u0E1B\u0E48\u0E32\u0E40\u0E25\u0E40\u0E27\u0E25 15 \u0E2B\u0E25\u0E31\u0E07\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E19", promoted, 54, 31, 37, "spd");
  const atFifty = deriveStats(JOBS.ranger.advanced, 50, pot, train);
  expectStats("\u0E40\u0E14\u0E34\u0E19\u0E1B\u0E48\u0E32\u0E40\u0E25\u0E40\u0E27\u0E25 50", atFifty, 157, 94, 112, "spd");
  const slime = monsterById("MON_002").bases;
  expectStats("\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E44\u0E1F\u0E40\u0E25\u0E40\u0E27\u0E25 10", deriveStats(slime, 10, pot, train), 30, 14, 17, "spAtk");
  expectStats("\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E44\u0E1F\u0E40\u0E25\u0E40\u0E27\u0E25 50", deriveStats(slime, 50, pot, train), 113, 50, 66, "spAtk");
  if (cumulativeExp(2) !== 7 || cumulativeExp(15) !== 3374) throw new Error("\u0E40\u0E2A\u0E49\u0E19\u0E1B\u0E23\u0E30\u0E2A\u0E1A\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E44\u0E21\u0E48\u0E15\u0E23\u0E07");
  if (statValue("hp", 46, 50, 15, 0) !== 113) throw new Error("\u0E2A\u0E39\u0E15\u0E23\u0E1E\u0E25\u0E31\u0E07\u0E44\u0E21\u0E48\u0E15\u0E23\u0E07");
  if (battleExp(35, 10, 10, 1) !== Math.floor(35 * 10 / 7)) throw new Error("\u0E1B\u0E23\u0E30\u0E2A\u0E1A\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E15\u0E48\u0E2D\u0E2A\u0E39\u0E49\u0E44\u0E21\u0E48\u0E15\u0E23\u0E07");
}
export {
  assertVectors
};
