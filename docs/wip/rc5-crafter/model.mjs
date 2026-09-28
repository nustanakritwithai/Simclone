/** RC5 DESIGN MODEL ONLY. No production imports, state writers or random source.
 * Inputs are hypothetical projections, NOT proof of a committed production root.
 * Integration must port approved rules into existing authorities after RC4 release.
 */
export const RC5_MODEL_VERSION = 'RC5-crafter-shadow/1';
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
export const FAMILIES = freeze({
  STONE_AXE: 'TOOLSMITH', STONE_PICKAXE: 'TOOLSMITH', HAMMER: 'TOOLSMITH',
  EMBER_BLADE: 'WEAPONSMITH', HIDE_ARMOR: 'ARMORSMITH', EMBER_CHARM: 'ARTIFICER'
});
export const FAMILY_MIN_TIER = freeze({
  STONE_AXE: 0, STONE_PICKAXE: 0, HAMMER: 1,
  EMBER_BLADE: 1, HIDE_ARMOR: 1, EMBER_CHARM: 1
});
export const GRADES = freeze(['APPRENTICE', 'CRAFTER', 'EXPERT', 'MASTER']);
export const RULES = freeze({
  crafter: { total: 6, tier2: 2 },
  expert: { total: 16, tier3: 4 },
  master: { total: 32, tier4: 6 },
  qualityBonus: { APPRENTICE: 0, CRAFTER: 5, EXPERT: 10, MASTER: 15 },
  qualityMin: 30, qualityMax: 100, masteryCap: 65535
});
export const QUALITY_BANDS = freeze([
  { name: 'ROUGH', min: 30, max: 49 },
  { name: 'STANDARD', min: 50, max: 64 },
  { name: 'FINE', min: 65, max: 79 },
  { name: 'SUPERIOR', min: 80, max: 89 },
  { name: 'MASTERWORK', min: 90, max: 97 },
  { name: 'EXCEPTIONAL', min: 98, max: 100 }
]);
const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
function tierCheck(tier) {
  if (!integer(tier, 0, 5)) throw new TypeError('RC5 tier must be 0..5');
}
function countsCheck(counts) {
  if (!Array.isArray(counts) || counts.length !== 6 ||
      Array.from(counts).some(n => !integer(n, 0, RULES.masteryCap))) {
    throw new TypeError('RC5 requires six explicit nonnegative completion counts');
  }
}
const decision = (modelVerdict, reason, extra = {}) => freeze({
  version: RC5_MODEL_VERSION, scope: 'DESIGN_MODEL', productionVerdict: 'UNKNOWN',
  commitAllowed: false, modelVerdict, reason, ...extra
});
/** Counts are per-recipe mastery aggregated by output family and tier upstream.
 * These are not XP, receipts, a persisted level, or an authority certificate.
 */
export function familyProfile(family, counts) {
  if (typeof family !== 'string' || !Object.hasOwn(FAMILIES, family)) throw new TypeError('RC5 unknown family');
  countsCheck(counts);
  if (FAMILY_MIN_TIER[family] === 1 && counts[0] !== 0) {
    throw new TypeError('RC5 impossible tier-zero family completions');
  }
  const total = Math.min(RULES.masteryCap, counts.reduce((a, b) => a + b, 0));
  let rank = 0;
  if (total >= RULES.crafter.total && counts[2] >= RULES.crafter.tier2) rank = 1;
  if (rank === 1 && total >= RULES.expert.total && counts[3] >= RULES.expert.tier3) rank = 2;
  if (rank === 2 && total >= RULES.master.total && counts[4] >= RULES.master.tier4) rank = 3;
  return freeze({ family, specialization: FAMILIES[family], counts: [...counts], total,
    rank, grade: GRADES[rank], maxNewTier: [2, 3, 4, 5][rank] });
}
export function promotionModel({ profession, alive, productive, construction, family, counts } = {}) {
  if (alive === false || productive === false) return decision('VIOL', 'actor-ineligible');
  if (alive !== true || productive !== true) return decision('UNKNOWN', 'actor-evidence');
  if (profession === 'adventurer' || profession === 'merchant') return decision('VIOL', 'special-profession-lock');
  if (profession === 'crafter') return decision('SAT', 'already-crafter', { transition: null });
  if (profession === undefined || profession === null) return decision('UNKNOWN', 'profession-evidence');
  if (profession !== 'builder') return decision('VIOL', 'builder-required');
  if (construction === 'ABSENT') return decision('VIOL', 'construction-required');
  if (construction !== 'PRESENT') return decision('UNKNOWN', 'construction-evidence');
  let profile;
  try { profile = familyProfile(family, counts); }
  catch { return decision('UNKNOWN', 'recipe-evidence'); }
  if (profile.rank < 1) return decision('VIOL', 'craft-completions-required', { profile });
  return decision('SAT', 'promotion-rule-satisfied', { profile, transition: 'PROPOSE_CRAFTER' });
}
/** NEW_WORLD is a balance model, not a switch that enables runtime restrictions.
 * Legacy worlds deliberately have no model authorization until migration is proven.
 */
export function tierGateModel({ tier, known, productive, profession, family, counts,
  policy = 'NEW_WORLD' } = {}) {
  if (policy !== 'NEW_WORLD') return decision('UNKNOWN', 'migration-contract-required');
  try { tierCheck(tier); } catch { return decision('UNKNOWN', 'recipe-tier'); }
  if (productive === false) return decision('VIOL', 'actor-ineligible');
  if (productive !== true) return decision('UNKNOWN', 'actor-evidence');
  if (known === false) return decision('VIOL', 'recipe-unknown');
  if (known !== true) return decision('UNKNOWN', 'recipe-knowledge-evidence');
  if (tier <= 1) return decision('SAT', 'starter-access-retained');
  if (profession === undefined || profession === null) return decision('UNKNOWN', 'profession-evidence');
  if (tier === 2) return ['builder', 'crafter'].includes(profession)
    ? decision('SAT', 'builder-tier') : decision('VIOL', 'builder-required');
  if (profession !== 'crafter') return decision('VIOL', 'crafter-profession-required');
  let profile;
  try { profile = familyProfile(family, counts); }
  catch { return decision('UNKNOWN', 'recipe-evidence'); }
  return tier <= profile.maxNewTier
    ? decision('SAT', 'family-tier-capability', { profile })
    : decision('VIOL', 'family-grade-required', { profile });
}
/** Proposed balance only. Production RC2-outcome/1 is deliberately unchanged.
 * Grade is derived here from counts; callers cannot supply a free MASTER bonus.
 */
export function qualityRangeModel({ family, counts, tier } = {}) {
  tierCheck(tier);
  const profile = familyProfile(family, counts);
  if (tier < FAMILY_MIN_TIER[family]) throw new TypeError('RC5 nonexistent family tier');
  const floor = Math.max(30, Math.min(80,
    30 + Math.min(40, 2 * profile.total) + RULES.qualityBonus[profile.grade] - 3 * tier));
  return freeze({ scope: 'DESIGN_MODEL', family, tier, grade: profile.grade,
    mastery: profile.total, floor, ceiling: Math.min(100, floor + 30) });
}
export function qualityLabel(quality) {
  if (!integer(quality, 30, 100)) throw new TypeError('RC5 quality must be 30..100');
  return QUALITY_BANDS.find(band => quality >= band.min && quality <= band.max).name;
}
/** Roll supplied by a test/model driver, not UI or a new RNG authority.
 * Future production must use the EXISTING versioned craft-outcome ticket channel.
 * Returns a scalar model sample, never an item, craftSpec, or mastery receipt.
 */
export function sampleQualityModel(input, rollUint32) {
  if (!integer(rollUint32, 0, 0xffffffff)) throw new TypeError('RC5 roll must be uint32');
  const { floor, ceiling } = qualityRangeModel(input);
  return floor + rollUint32 % (ceiling - floor + 1);
}
/** Exact modulo probabilities IF input roll is uniform across all 2^32 integers.
 * This is a mathematical assumption, NOT proof that a ticket hash is uniform.
 */
export function qualityOddsModel(input) {
  const range = qualityRangeModel(input), width = range.ceiling - range.floor + 1;
  const denominator = 0x100000000, quotient = Math.floor(denominator / width);
  const remainder = denominator % width;
  const bands = QUALITY_BANDS.map(band => {
    let numerator = 0;
    for (let quality = range.floor; quality <= range.ceiling; quality++) {
      if (quality >= band.min && quality <= band.max) {
        numerator += quotient + (quality - range.floor < remainder ? 1 : 0);
      }
    }
    return { ...band, numerator, denominator, probability: numerator / denominator };
  });
  return freeze({ ...range, assumption: 'UNIFORM_UINT32_MODEL_NOT_MEASURED_PRODUCTION', bands });
}
