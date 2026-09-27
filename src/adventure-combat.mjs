// ADV6 Adventure Combat Resolver
// Pure deterministic proposal resolver derived from Pocket Monster Combat V9.1.2.
// This module never commits HP, status, XP, inventory, profession, or world state.

export const ADVENTURE_COMBAT_RULES_VERSION = 'adventure-combat/pocket-v9.1.2-adapter-v1';
export const ADVENTURE_COMBAT_OUTCOME_SCHEMA = 'adventure-combat-outcome/v1';

export const ADVENTURE_COMBAT_RULES = Object.freeze({
  levelMin: 1,
  levelMax: 60,
  statMax: 10_000_000,
  actionPowerMax: 10_000,
  hitCountMax: 16,
  worldMultiplierMin: 0,
  worldMultiplierMax: 4,
  levelScaleDivisor: 5,
  baseFormulaDivisor: 50,
  baseDamageFlat: 2,
  stab: 1.5,
  criticalMultiplier: 1.5,
  varianceMin: 0.9,
  varianceMax: 1,
  minimumSuccessfulDamage: 1,
  maximumCombinedPenetration: 0.95,
  rngOrder: Object.freeze(['hit', 'critical', 'variance', 'status_in_definition_order']),
});

export const ADVENTURE_COMBAT_TYPES = Object.freeze([
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
]);

const TYPE_SET = new Set(ADVENTURE_COMBAT_TYPES);
const RAW_TYPE_CHART = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying: { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug: { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5 },
  Rock: { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy: { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 },
};
const TYPE_CHART = Object.freeze(Object.fromEntries(
  Object.entries(RAW_TYPE_CHART).map(([type, row]) => [type, Object.freeze({ ...row })]),
));

const STAT_KEYS = Object.freeze([
  'hpMax', 'hpCurrent', 'atk', 'def', 'spAtk', 'spDef', 'spd',
  'accuracy', 'crit', 'evasion', 'resistance', 'penetration',
]);
const INTEGER_STAT_KEYS = new Set(['hpMax', 'hpCurrent', 'atk', 'def', 'spAtk', 'spDef', 'spd']);
const RATIO_KEYS = new Set(['accuracy', 'crit', 'evasion', 'resistance', 'penetration']);
const WORLD_MULTIPLIER_KEYS = Object.freeze([
  'atk', 'def', 'spAtk', 'spDef', 'spd', 'accuracy', 'crit', 'evasion', 'resistance', 'penetration',
]);
const WORLD_MULTIPLIER_SET = new Set(WORLD_MULTIPLIER_KEYS);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

// Deterministic non-cryptographic stream. Seed/ticket are context, not security credentials.
function seed32(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function createDeterministicRng(context) {
  let state = seed32(stableJson(context)) || 0x6d2b79f5;
  let counter = 0;
  return label => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    value = ((value ^ (value >>> 14)) >>> 0);
    const normalized = value / 4294967296;
    const draw = Object.freeze({ index: counter, label, value: normalized });
    counter += 1;
    return draw;
  };
}

function normalizeProfile(profile, label) {
  if (!isRecord(profile)) throw new TypeError(`${label}: invalid profile`);
  const source = isRecord(profile.stats) ? profile.stats : profile;
  const level = profile.level;
  if (!Number.isInteger(level)
    || level < ADVENTURE_COMBAT_RULES.levelMin
    || level > ADVENTURE_COMBAT_RULES.levelMax) {
    throw new RangeError(`${label}: level must be 1..60`);
  }
  const types = profile.types ?? [];
  if (!Array.isArray(types) || types.length > 2 || new Set(types).size !== types.length
    || types.some(type => !TYPE_SET.has(type))) {
    throw new TypeError(`${label}: invalid types`);
  }

  const stats = {};
  for (const key of STAT_KEYS) {
    const value = source[key];
    if (!Number.isFinite(value) || value < 0 || value > ADVENTURE_COMBAT_RULES.statMax) {
      throw new TypeError(`${label}: invalid ${key}`);
    }
    if (INTEGER_STAT_KEYS.has(key) && !Number.isSafeInteger(value)) {
      throw new TypeError(`${label}: ${key} must be a safe integer`);
    }
    if (RATIO_KEYS.has(key) && value > 1) {
      throw new RangeError(`${label}: ${key} must be 0..1`);
    }
    stats[key] = value;
  }
  if (stats.hpMax < 1) throw new RangeError(`${label}: hpMax must be >= 1`);
  if (stats.hpCurrent > stats.hpMax) throw new RangeError(`${label}: hpCurrent exceeds hpMax`);
  return Object.freeze({ level, types: Object.freeze([...types]), stats: Object.freeze(stats) });
}

function normalizeAction(action) {
  if (!isRecord(action)) throw new TypeError('action: invalid action');
  const actionId = action.actionId ?? action.id;
  if (typeof actionId !== 'string' || actionId.length === 0) throw new TypeError('action: invalid actionId');
  if (action.channel !== 'physical' && action.channel !== 'special') throw new TypeError('action: invalid channel');
  if (!Number.isFinite(action.power) || action.power < 0 || action.power > ADVENTURE_COMBAT_RULES.actionPowerMax) {
    throw new RangeError('action: invalid power');
  }
  if (!Number.isFinite(action.accuracy) || action.accuracy < 0 || action.accuracy > 1) {
    throw new RangeError('action: invalid accuracy');
  }
  const element = action.element ?? action.type ?? null;
  if (element !== null && !TYPE_SET.has(element)) throw new TypeError('action: invalid element');
  const criticalAllowed = action.criticalAllowed ?? true;
  if (typeof criticalAllowed !== 'boolean') throw new TypeError('action: invalid criticalAllowed');
  const armorPierce = action.armorPierce ?? action.penetration ?? 0;
  if (!Number.isFinite(armorPierce) || armorPierce < 0 || armorPierce > 1) {
    throw new RangeError('action: invalid armorPierce');
  }
  const hitCount = action.hitCount ?? 1;
  if (!Number.isInteger(hitCount) || hitCount < 1 || hitCount > ADVENTURE_COMBAT_RULES.hitCountMax) {
    throw new RangeError('action: invalid hitCount');
  }
  const rawStatuses = action.statusApplications ?? action.statusProposals ?? [];
  if (!Array.isArray(rawStatuses)) throw new TypeError('action: invalid status applications');
  const statusApplications = rawStatuses.map((entry, index) => {
    if (!isRecord(entry)) throw new TypeError(`action: invalid status application ${index}`);
    const statusId = entry.statusId ?? entry.linkId;
    const target = entry.target === 'target' ? 'defender' : entry.target === 'actor' ? 'attacker' : entry.target;
    const chance = entry.chance ?? 1;
    if (typeof statusId !== 'string' || statusId.length === 0) {
      throw new TypeError(`action: invalid statusId ${index}`);
    }
    if (target !== 'attacker' && target !== 'defender') {
      throw new TypeError(`action: invalid status target ${index}`);
    }
    if (!Number.isFinite(chance) || chance < 0 || chance > 1) {
      throw new RangeError(`action: invalid status chance ${index}`);
    }
    return Object.freeze({
      statusId,
      target,
      chance,
      resistible: entry.resistible !== false,
    });
  });
  return Object.freeze({
    actionId,
    channel: action.channel,
    power: action.power,
    accuracy: action.accuracy,
    element,
    criticalAllowed,
    armorPierce,
    hitCount,
    statusApplications: Object.freeze(statusApplications),
  });
}

function normalizeRng(rng) {
  if (!isRecord(rng)) throw new TypeError('rng: seed/ticket required');
  const seed = rng.seed;
  const ticket = rng.ticket ?? rng.ticketId;
  if ((typeof seed !== 'string' && typeof seed !== 'number') || String(seed).length === 0) {
    throw new TypeError('rng: invalid seed');
  }
  if ((typeof ticket !== 'string' && typeof ticket !== 'number') || String(ticket).length === 0) {
    throw new TypeError('rng: invalid ticket');
  }
  const sequence = rng.sequence ?? 0;
  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new RangeError('rng: invalid sequence');
  return Object.freeze({ seed: String(seed), ticket: String(ticket), sequence });
}

function normalizeWorldModifiers(worldModifiers) {
  if (worldModifiers === undefined || worldModifiers === null) {
    return Object.freeze({ attacker: Object.freeze({}), defender: Object.freeze({}) });
  }
  if (!isRecord(worldModifiers)) throw new TypeError('worldModifiers: invalid object');
  const result = {};
  for (const role of ['attacker', 'defender']) {
    const input = worldModifiers[role] ?? {};
    if (!isRecord(input)) throw new TypeError(`worldModifiers.${role}: invalid object`);
    const unknown = Object.keys(input).find(key => !WORLD_MULTIPLIER_SET.has(key));
    if (unknown) throw new TypeError(`worldModifiers.${role}: unknown ${unknown}`);
    const multipliers = {};
    for (const [key, value] of Object.entries(input)) {
      if (!Number.isFinite(value)
        || value < ADVENTURE_COMBAT_RULES.worldMultiplierMin
        || value > ADVENTURE_COMBAT_RULES.worldMultiplierMax) {
        throw new RangeError(`worldModifiers.${role}.${key}: invalid multiplier`);
      }
      multipliers[key] = value;
    }
    result[role] = Object.freeze(multipliers);
  }
  const unknownRole = Object.keys(worldModifiers).find(key => key !== 'attacker' && key !== 'defender');
  if (unknownRole) throw new TypeError(`worldModifiers: unknown ${unknownRole}`);
  return Object.freeze(result);
}

function effectiveStats(profile, multipliers) {
  const values = { ...profile.stats };
  for (const key of WORLD_MULTIPLIER_KEYS) {
    if (multipliers[key] !== undefined) values[key] *= multipliers[key];
  }
  for (const key of RATIO_KEYS) values[key] = clamp(values[key], 0, 1);
  return Object.freeze(values);
}

function typeEffectiveness(attackingType, defendingTypes) {
  if (attackingType === null) return 1;
  const row = TYPE_CHART[attackingType];
  return defendingTypes.reduce((multiplier, defendingType) => multiplier * (row[defendingType] ?? 1), 1);
}

function splitDamageBudget(totalDamage, hitCount) {
  const perHit = Math.floor(totalDamage / hitCount);
  const remainder = totalDamage % hitCount;
  return Object.freeze(Array.from(
    { length: hitCount },
    (_, index) => perHit + (index < remainder ? 1 : 0),
  ));
}

function speedOrder(attackerSpd, defenderSpd) {
  return Object.freeze({
    attackerSpd,
    defenderSpd,
    relation: attackerSpd === defenderSpd ? 'tie' : attackerSpd > defenderSpd ? 'attacker_faster' : 'defender_faster',
  });
}

/**
 * Resolve exactly one deterministic Adventure combat action.
 *
 * Returns a CombatOutcome proposal only. No writes are performed.
 * Invalid inputs are rejected by throwing TypeError/RangeError before resolution.
 */
export function resolveAdventureCombat({
  attacker,
  defender,
  action,
  rng,
  worldModifiers = null,
} = {}) {
  const actor = normalizeProfile(attacker, 'attacker');
  const target = normalizeProfile(defender, 'defender');
  if (actor.stats.hpCurrent === 0) throw new RangeError('attacker: not combat capable');
  if (target.stats.hpCurrent === 0) throw new RangeError('defender: already terminal');

  const canonicalAction = normalizeAction(action);
  const rngContext = normalizeRng(rng);
  const modifiers = normalizeWorldModifiers(worldModifiers);
  const actorStats = effectiveStats(actor, modifiers.attacker);
  const targetStats = effectiveStats(target, modifiers.defender);

  const nextRng = createDeterministicRng({
    version: ADVENTURE_COMBAT_RULES_VERSION,
    seed: rngContext.seed,
    ticket: rngContext.ticket,
    sequence: rngContext.sequence,
    actorEntityId: typeof attacker?.entityId === 'string' ? attacker.entityId : 'attacker',
    targetEntityId: typeof defender?.entityId === 'string' ? defender.entityId : 'defender',
    action: canonicalAction,
    worldModifiers: modifiers,
  });
  const rngTrace = [];
  const draw = label => {
    const next = nextRng(label);
    rngTrace.push(next);
    return next.value;
  };

  // Pocket V9.1.2 draw order is fixed even when the eventual result misses/is immune.
  const hitRoll = draw('hit');
  const criticalRoll = draw('critical');
  const varianceRoll = draw('variance');

  const hitChance = clamp(
    canonicalAction.accuracy * actorStats.accuracy * (1 - targetStats.evasion),
    0,
    1,
  );
  const hit = hitRoll < hitChance;
  const criticalChance = canonicalAction.criticalAllowed ? actorStats.crit : 0;
  const critical = hit && criticalRoll < criticalChance;

  const attackStat = canonicalAction.channel === 'physical' ? actorStats.atk : actorStats.spAtk;
  const defenseStat = canonicalAction.channel === 'physical' ? targetStats.def : targetStats.spDef;
  const combinedPenetration = clamp(
    canonicalAction.armorPierce + actorStats.penetration,
    0,
    ADVENTURE_COMBAT_RULES.maximumCombinedPenetration,
  );
  const effectiveDefense = Math.max(1, defenseStat * (1 - combinedPenetration));
  const typeMultiplier = typeEffectiveness(canonicalAction.element, target.types);
  const stabMultiplier = canonicalAction.element !== null && actor.types.includes(canonicalAction.element)
    ? ADVENTURE_COMBAT_RULES.stab
    : 1;
  const criticalMultiplier = critical ? ADVENTURE_COMBAT_RULES.criticalMultiplier : 1;
  const varianceMultiplier = ADVENTURE_COMBAT_RULES.varianceMin
    + (ADVENTURE_COMBAT_RULES.varianceMax - ADVENTURE_COMBAT_RULES.varianceMin) * varianceRoll;

  const baseDamage = canonicalAction.power > 0
    ? Math.floor(
      ((((2 * actor.level / ADVENTURE_COMBAT_RULES.levelScaleDivisor) + 2)
        * canonicalAction.power * attackStat / effectiveDefense)
        / ADVENTURE_COMBAT_RULES.baseFormulaDivisor)
      + ADVENTURE_COMBAT_RULES.baseDamageFlat,
    )
    : 0;
  const unresolvedDamage = baseDamage * stabMultiplier * typeMultiplier
    * criticalMultiplier * varianceMultiplier;
  const damage = hit && canonicalAction.power > 0 && typeMultiplier > 0
    ? Math.max(ADVENTURE_COMBAT_RULES.minimumSuccessfulDamage, Math.floor(unresolvedDamage))
    : 0;
  const hpBefore = target.stats.hpCurrent;
  const hpAfter = Math.max(0, hpBefore - damage);
  const appliedDamage = hpBefore - hpAfter;
  const hitDamages = splitDamageBudget(appliedDamage, canonicalAction.hitCount);

  const statusProposals = [];
  const statusEligible = hit && (canonicalAction.power === 0 || appliedDamage > 0);
  if (statusEligible) {
    for (const application of canonicalAction.statusApplications) {
      if (application.target === 'defender' && hpAfter === 0) continue;
      const recipientStats = application.target === 'attacker' ? actorStats : targetStats;
      const resistance = application.resistible ? recipientStats.resistance : 0;
      const finalChance = clamp(application.chance * (1 - resistance), 0, 1);
      const roll = draw(`status:${application.statusId}`);
      statusProposals.push(Object.freeze({
        statusId: application.statusId,
        target: application.target,
        applied: roll < finalChance,
        baseChance: application.chance,
        finalChance,
        roll,
      }));
    }
  }

  return deepFreeze({
    schemaVersion: ADVENTURE_COMBAT_OUTCOME_SCHEMA,
    rulesVersion: ADVENTURE_COMBAT_RULES_VERSION,
    committed: false,
    actionId: canonicalAction.actionId,
    channel: canonicalAction.channel,
    hit,
    hitChance,
    critical,
    criticalChance,
    damage: appliedDamage,
    hpBefore,
    hpAfter,
    typeMultiplier,
    stabMultiplier,
    varianceMultiplier,
    attackStat,
    defenseStat,
    effectiveDefense,
    combinedPenetration,
    hitDamages,
    speedOrder: speedOrder(actorStats.spd, targetStats.spd),
    statusProposals: Object.freeze(statusProposals),
    rngTrace: Object.freeze(rngTrace),
  });
}
