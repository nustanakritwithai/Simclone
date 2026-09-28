import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { FAMILIES, FAMILY_MIN_TIER, GRADES, RULES, QUALITY_BANDS, familyProfile,
  promotionModel, tierGateModel, qualityRangeModel, sampleQualityModel,
  qualityOddsModel, qualityLabel } from '../docs/wip/rc5-crafter/model.mjs';
import { CRAFT_RECIPE_CATALOG, STARTER_RECIPE_IDS, recipeById,
  validateCraftingCatalog } from '../src/crafting-catalog.mjs?v=0.5.0';
import { createCraftSpec, resolveCraftOutcome,
  validateCraftedItem } from '../src/craft-outcome.mjs?v=0.5.0';

// Hypothetical completion counts ONLY. No fabricated production achievement.
const ZERO = [0, 0, 0, 0, 0, 0], CRAFTER = [0, 4, 2, 0, 0, 0];
const EXPERT = [0, 4, 4, 8, 0, 0], MASTER = [0, 8, 8, 8, 8, 0];
const promotion = (patch = {}) => promotionModel({ profession: 'builder', alive: true,
  productive: true, construction: 'PRESENT', family: 'HAMMER', counts: CRAFTER, ...patch });
const gate = (patch = {}) => tierGateModel({ tier: 5, known: true, productive: true,
  profession: 'crafter', family: 'HAMMER', counts: MASTER, ...patch });
const quality = (counts = MASTER, tier = 5, family = 'HAMMER') => ({ family, counts, tier });

for (const [counts, grade] of [[ZERO, 'APPRENTICE'], [CRAFTER, 'CRAFTER'],
  [EXPERT, 'EXPERT'], [MASTER, 'MASTER']]) {
  test(`RC5 model derives ${grade} without XP or a persisted level`, () => {
    assert.equal(familyProfile('HAMMER', counts).grade, grade);
    assert.equal(familyProfile('HAMMER', counts).rank, GRADES.indexOf(grade));
  });
}
test('RC5 no T5 completion prerequisite for MASTER', () => {
  assert.equal(MASTER[5], 0);
  assert.equal(gate().modelVerdict, 'SAT');
});
test('RC5 low-tier grinding never bypasses tier-specific evidence', () => {
  assert.equal(familyProfile('STONE_AXE', [65535, 0, 0, 0, 0, 0]).grade, 'APPRENTICE');
  assert.equal(familyProfile('HAMMER', [0, 65535, 2, 0, 0, 0]).grade, 'CRAFTER');
  assert.equal(familyProfile('HAMMER', [0, 65535, 2, 4, 0, 0]).grade, 'EXPERT');
});
for (const counts of [undefined, null, [], [0, 0], Array(6),
  [0, -1, 0, 0, 0, 0], [0, 1.5, 0, 0, 0, 0], [0, '6', 0, 0, 0, 0],
  [0, NaN, 0, 0, 0, 0], [0, Infinity, 0, 0, 0, 0], [0, 65536, 0, 0, 0, 0]]) {
  test(`RC5 rejects malformed counts ${String(counts)}`, () => {
    assert.throws(() => familyProfile('HAMMER', counts), TypeError);
    assert.equal(promotion({ counts }).modelVerdict, 'UNKNOWN');
  });
}
test('RC5 rejects nonexistent families and impossible tier-zero evidence', () => {
  assert.throws(() => familyProfile('SHOP_HAMMER', ZERO), TypeError);
  assert.throws(() => familyProfile('HAMMER', [1, 0, 0, 0, 0, 0]), TypeError);
  assert.throws(() => qualityRangeModel(quality(ZERO, 0)), TypeError);
});
test('RC5 caps derived family mastery at existing 65535 bound', () => {
  const p = familyProfile('STONE_AXE', Array(6).fill(65535));
  assert.equal(p.total, 65535);
});
for (const profession of ['merchant', 'adventurer']) {
  test(`RC5 does not propose replacing ${profession}`, () => {
    assert.equal(promotion({ profession }).modelVerdict, 'VIOL');
    assert.equal(gate({ profession }).modelVerdict, 'VIOL');
  });
}
for (const patch of [{ alive: false }, { productive: false }, { profession: 'miner' },
  { construction: 'ABSENT' }, { counts: ZERO }]) {
  test(`RC5 promotion blocks ${JSON.stringify(patch)}`, () => {
    assert.equal(promotion(patch).modelVerdict, 'VIOL');
  });
}
for (const patch of [{ alive: undefined }, { productive: undefined }, { profession: undefined },
  { construction: undefined }, { construction: 'UNKNOWN' }]) {
  test(`RC5 missing evidence is UNKNOWN ${Object.keys(patch)}`, () => {
    assert.equal(promotion(patch).modelVerdict, 'UNKNOWN');
  });
}
test('RC5 promotion is proposal only and already-crafter is a no-op', () => {
  assert.equal(promotion().transition, 'PROPOSE_CRAFTER');
  assert.equal(promotion({ profession: 'crafter' }).transition, null);
});
test('RC5 forged good-looking model inputs can never authorize production', () => {
  for (const result of [promotion(), gate(), promotion({ verified: true, committed: true })]) {
    assert.equal(result.productionVerdict, 'UNKNOWN');
    assert.equal(result.commitAllowed, false);
    assert.equal(result.scope, 'DESIGN_MODEL');
  }
});
test('RC5 knowledge alone does not grant new high-tier capability', () => {
  assert.equal(gate({ counts: ZERO }).modelVerdict, 'VIOL');
  assert.equal(gate({ known: false }).modelVerdict, 'VIOL');
  assert.equal(gate({ known: undefined }).modelVerdict, 'UNKNOWN');
});
test('RC5 family skill does not transfer between hammer and sword', () => {
  assert.equal(gate().modelVerdict, 'SAT');
  assert.equal(gate({ family: 'EMBER_BLADE', counts: ZERO }).modelVerdict, 'VIOL');
});
test('RC5 survival starters retain access in the NEW_WORLD model', () => {
  for (const id of STARTER_RECIPE_IDS) {
    assert.equal(gate({ tier: recipeById(id).tier, profession: 'miner', counts: ZERO }).modelVerdict, 'SAT');
  }
});
test('RC5 tier-2 bridge stays available to builders before promotion', () => {
  assert.equal(gate({ tier: 2, profession: 'builder', counts: ZERO }).modelVerdict, 'SAT');
  assert.equal(gate({ tier: 3, profession: 'builder' }).modelVerdict, 'VIOL');
});
test('RC5 legacy model remains UNKNOWN; no client grandfather bypass', () => {
  assert.equal(gate({ policy: 'LEGACY_UNMIGRATED' }).modelVerdict, 'UNKNOWN');
  assert.equal(gate({ policy: 'LEGACY_UNMIGRATED', legacyGrant: true }).modelVerdict, 'UNKNOWN');
});
test('RC5 family and tier map agrees with the actual canonical recipe catalog', () => {
  assert.deepEqual(validateCraftingCatalog(), []);
  for (const family of Object.keys(FAMILIES)) {
    const recipes = Object.values(CRAFT_RECIPE_CATALOG).filter(r => r.output === family);
    assert.equal(Math.min(...recipes.map(r => r.tier)), FAMILY_MIN_TIER[family]);
    assert.equal(Math.max(...recipes.map(r => r.tier)), 5);
    assert.equal(recipes.length, 6 - FAMILY_MIN_TIER[family]);
  }
});
test('RC5 HAMMER learning and grade model reaches first T5 without a circular lock', () => {
  const counts = [...ZERO], known = new Set(STARTER_RECIPE_IDS);
  let profession = 'builder', reached = false;
  for (let step = 0; step < 64; step++) {
    const promotable = promotion({ profession, counts }).transition === 'PROPOSE_CRAFTER';
    if (promotable) profession = 'crafter'; // Synthetic model actor, NOT engine state.
    const options = Object.values(CRAFT_RECIPE_CATALOG).filter(r => r.output === 'HAMMER' &&
      known.has(r.id) && gate({ tier: r.tier, counts, profession }).modelVerdict === 'SAT');
    const recipe = options.sort((a, b) => b.tier - a.tier)[0];
    assert.ok(recipe, 'the model must always have a permitted practice recipe');
    if (recipe.tier === 5) { reached = true; break; }
    counts[recipe.tier]++;
    for (const next of Object.values(CRAFT_RECIPE_CATALOG)) {
      if (next.unlock?.recipeId === recipe.id && counts[recipe.tier] >= next.unlock.completions) known.add(next.id);
    }
  }
  assert.equal(reached, true);
  assert.equal(counts[5], 0);
});
test('RC5 quality bands cover every integer exactly once', () => {
  for (let n = 30; n <= 100; n++) {
    assert.equal(QUALITY_BANDS.filter(b => n >= b.min && n <= b.max).length, 1);
    assert.ok(qualityLabel(n));
  }
  assert.equal(qualityLabel(90), 'MASTERWORK');
  assert.equal(qualityLabel(98), 'EXCEPTIONAL');
});
test('RC5 MASTER T5 quality model is 70..100, not guaranteed perfection', () => {
  const range = qualityRangeModel(quality());
  assert.equal(range.floor, 70);
  assert.equal(range.ceiling, 100);
  const samples = Array.from({ length: 31 }, (_, n) => sampleQualityModel(quality(), n));
  assert.equal(Math.min(...samples), 70);
  assert.equal(Math.max(...samples), 100);
  assert.equal(samples.filter(x => x >= 90).length, 11);
});
test('RC5 quality never uses a caller-supplied grade bonus', () => {
  const input = quality(ZERO, 3);
  assert.deepEqual(qualityRangeModel({ ...input, grade: 'MASTER' }), qualityRangeModel(input));
});
for (const roll of [-1, 0x100000000, 0.5, '1', NaN, Infinity, undefined]) {
  test(`RC5 rejects invalid roll ${String(roll)}`, () => {
    assert.throws(() => sampleQualityModel(quality(), roll), TypeError);
  });
}
test('RC5 model samples survive JSON round-trip without reroll', () => {
  const input = quality();
  for (const roll of [0, 1, 42, 230926, 0xffffffff]) {
    assert.equal(sampleQualityModel(input, roll), sampleQualityModel(JSON.parse(JSON.stringify(input)), roll));
  }
});
test('RC5 exact odds sum to 2^32 and explicitly state their assumption', () => {
  for (const counts of [ZERO, CRAFTER, EXPERT, MASTER]) {
    for (let tier = 1; tier <= 5; tier++) {
      const odds = qualityOddsModel(quality(counts, tier));
      assert.equal(odds.bands.reduce((n, b) => n + b.numerator, 0), 0x100000000);
      assert.equal(odds.bands.reduce((n, b) => n + b.probability, 0), 1);
      assert.equal(odds.assumption, 'UNIFORM_UINT32_MODEL_NOT_MEASURED_PRODUCTION');
    }
  }
});
test('RC5 increasing same-family evidence never reduces high-quality model odds', () => {
  for (let tier = 1; tier <= 5; tier++) {
    let previous = 0;
    for (let n = 0; n <= 80; n++) {
      const counts = [0, n, Math.max(0, n - 4), Math.max(0, n - 10), Math.max(0, n - 20), 0];
      const odds = qualityOddsModel(quality(counts, tier));
      const high = odds.bands.filter(b => b.min >= 90).reduce((s, b) => s + b.numerator, 0);
      assert.ok(high >= previous);
      previous = high;
    }
  }
});
test('RC5 models do not mutate or freeze caller-owned data', () => {
  const counts = [...MASTER], input = quality(counts), before = JSON.stringify(input);
  familyProfile('HAMMER', counts); qualityOddsModel(input); sampleQualityModel(input, 42);
  assert.equal(JSON.stringify(input), before);
  assert.equal(Object.isFrozen(input), false);
  assert.equal(Object.isFrozen(counts), false);
  assert.ok(Object.isFrozen(RULES));
  assert.ok(Object.isFrozen(familyProfile('HAMMER', counts).counts));
});
test('RC5 shadow calls leave actual RC2 outcome records and validation unchanged', () => {
  for (const seed of [42, 230926]) for (const recipeId of ['HAMMER', 'HAMMER_T5', 'EMBER_BLADE_T5']) {
    const args = { worldSeed: seed, orderId: 1, creatorId: 1, recipeId, mastery: 20 };
    const spec = createCraftSpec(args), craft = resolveCraftOutcome({ ...args, spec });
    const item = { id: 1, kind: recipeById(recipeId).output, createdBy: 1, craft };
    const before = JSON.stringify(item);
    qualityOddsModel(quality()); sampleQualityModel(quality(), 42); promotion(); gate();
    assert.equal(JSON.stringify(item), before);
    assert.equal(validateCraftedItem(JSON.parse(before), seed), true);
    assert.deepEqual(resolveCraftOutcome({ ...args, spec }), craft);
  }
});
test('RC5 old item without outcome remains unmodified, never assigned synthetic quality', () => {
  const item = { id: 1, kind: 'HAMMER', createdBy: 1 }, before = JSON.stringify(item);
  qualityRangeModel(quality());
  assert.equal(JSON.stringify(item), before);
  assert.equal(validateCraftedItem(item, 42), true);
  assert.equal(item.craft, undefined);
});
test('RC5 model is not imported by production and has no RNG, storage or DOM dependency', () => {
  const root = new URL('../src/', import.meta.url);
  for (const path of readdirSync(root, { recursive: true }).filter(p => p.endsWith('.mjs'))) {
    assert.doesNotMatch(readFileSync(new URL(path, root), 'utf8'), /rc5-crafter\/model\.mjs/);
  }
  const source = readFileSync(new URL('../docs/wip/rc5-crafter/model.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bimport\s|Math\.random\s*\(|Date\.now\s*\(|\blocalStorage\b|\bdocument\./);
});
