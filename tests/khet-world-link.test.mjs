import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const surfaces = ["index.html", "src/engine.mjs"];
const khetFiles = [
  "src/khet/formula.mjs",
  "src/khet/vectors.mjs",
  "src/khet/character.mjs",
  "src/khet/combat.mjs",
  "src/khet/content.mjs",
];
const bannedImports = ["engine.mjs", "skill-provenance.mjs", "individual-resources.mjs", "index.html"];

test("สัญญาเชื่อมโลกถูกแช่แข็ง และซิมยังไม่เรียกเขตศิลา", () => {
  const contract = read("docs/KHET_WORLD_LINK_SUCCESS_CONTRACT.md");
  assert.match(contract, /Status: PREPARED\. NOT APPROVED FOR WIRING\./);
  assert.match(contract, /encounterShadow/);
  assert.equal(contract.includes("export function encounterShadow"), false);

  for (const rel of surfaces) {
    const text = read(rel);
    assert.equal(text.includes("src/khet"), false, rel);
    assert.equal(text.includes("khet-sila"), false, rel);
    assert.equal(text.includes("encounterShadow"), false, rel);
  }

  for (const rel of khetFiles) {
    const text = read(rel);
    for (const name of bannedImports) assert.equal(text.includes(name), false, `${rel} imports ${name}`);
    assert.equal(text.includes("encounterShadow"), false, rel);
    assert.equal(text.includes("recordEarnedSkill"), false, rel);
  }
});
