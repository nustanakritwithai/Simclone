const RARITIES = Object.freeze(['COMMON', 'UNCOMMON', 'RARE', 'EPIC']);

export const ADVENTURE_LOOT_RANKS = Object.freeze({
  NORMAL: Object.freeze({ guaranteedCoreQty: 1, hideChanceBp: 7000, shardChanceBp: 3000, quantityCap: 2 }),
  ELITE: Object.freeze({ guaranteedCoreQty: 2, hideChanceBp: 8500, shardChanceBp: 6000, quantityCap: 3 }),
  BOSS: Object.freeze({ guaranteedCoreQty: 3, hideChanceBp: 10000, shardChanceBp: 9000, quantityCap: 4 }),
});

export const ADVENTURE_LOOT_PROFILES = Object.freeze({
  FIRE: Object.freeze({
    guaranteed: Object.freeze({ itemKind: 'FIRE_CORE', rarity: 'UNCOMMON' }),
    hide: Object.freeze({ itemKind: 'HIDE', rarity: 'COMMON' }),
    shard: Object.freeze({ itemKind: 'EMBER_SHARD', rarity: 'RARE' }),
  }),
});

function invariant(condition, message) {
  if (!condition) throw new TypeError(message);
}

function normalizeNonEmpty(value, label) {
  invariant(typeof value === 'string' || Number.isInteger(value), `${label} must be a non-empty string or integer`);
  const normalized = String(value).trim();
  invariant(normalized.length > 0, `${label} must be non-empty`);
  return normalized;
}

function normalizeRank(rank) {
  const normalized = normalizeNonEmpty(rank, 'rank').toUpperCase();
  invariant(Object.hasOwn(ADVENTURE_LOOT_RANKS, normalized), `unsupported rank: ${normalized}`);
  return normalized;
}

function normalizeProfileId(monster) {
  invariant(monster && typeof monster === 'object' && !Array.isArray(monster), 'monster must be an object');
  const raw = monster.lootProfileId ?? monster.primaryType;
  const profileId = normalizeNonEmpty(raw, 'monster.lootProfileId or monster.primaryType').toUpperCase();
  invariant(Object.hasOwn(ADVENTURE_LOOT_PROFILES, profileId), `unsupported loot profile: ${profileId}`);
  return profileId;
}

function normalizeOutcome(outcome) {
  invariant(outcome && typeof outcome === 'object' && !Array.isArray(outcome), 'outcome must be an object');
  const outcomeId = normalizeNonEmpty(outcome.outcomeId, 'outcome.outcomeId');
  invariant(outcome.verified === true, 'outcome must be verified');
  invariant(outcome.defeated === true, 'outcome must prove the source monster was defeated');
  return outcomeId;
}

function hash32(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function rollBasisPoints(key) {
  return hash32(key) % 10000;
}

function boundedQuantity(key, min, max) {
  invariant(Number.isInteger(min) && Number.isInteger(max) && min >= 0 && max >= min, 'invalid quantity bounds');
  if (min === max) return min;
  return min + (hash32(key) % (max - min + 1));
}

function makeItem(itemKind, quantity, rarity) {
  invariant(Number.isInteger(quantity) && quantity >= 0, 'loot quantity cannot be negative');
  invariant(RARITIES.includes(rarity), `unsupported rarity: ${rarity}`);
  return Object.freeze({ itemKind, quantity, rarity });
}

export function makeLootClaimKey(outcomeId) {
  return `ADVENTURE_LOOT:${normalizeNonEmpty(outcomeId, 'outcomeId')}`;
}

/**
 * Stateless reward proposal. This module never checks or writes inventory.
 * The integration authority must commit at most once per claimKey.
 */
export function proposeAdventureLoot({ monster, rank, outcome, rngTicket }) {
  const sourceMonsterId = normalizeNonEmpty(monster?.monsterId, 'monster.monsterId');
  const profileId = normalizeProfileId(monster);
  const normalizedRank = normalizeRank(rank);
  const outcomeId = normalizeOutcome(outcome);
  const ticket = normalizeNonEmpty(rngTicket, 'rngTicket');
  const rankRule = ADVENTURE_LOOT_RANKS[normalizedRank];
  const profile = ADVENTURE_LOOT_PROFILES[profileId];
  const seedBase = `${sourceMonsterId}|${normalizedRank}|${outcomeId}|${ticket}`;

  const items = [
    makeItem(profile.guaranteed.itemKind, rankRule.guaranteedCoreQty, profile.guaranteed.rarity),
  ];

  if (rollBasisPoints(`${seedBase}|hide|chance`) < rankRule.hideChanceBp) {
    items.push(makeItem(
      profile.hide.itemKind,
      boundedQuantity(`${seedBase}|hide|quantity`, 1, rankRule.quantityCap),
      profile.hide.rarity,
    ));
  }

  if (rollBasisPoints(`${seedBase}|shard|chance`) < rankRule.shardChanceBp) {
    items.push(makeItem(
      profile.shard.itemKind,
      boundedQuantity(`${seedBase}|shard|quantity`, 1, rankRule.quantityCap),
      profile.shard.rarity,
    ));
  }

  return Object.freeze({
    sourceMonsterId,
    outcomeId,
    claimKey: makeLootClaimKey(outcomeId),
    items: Object.freeze(items),
  });
}
