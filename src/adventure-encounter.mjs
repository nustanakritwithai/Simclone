import {
  assertAdventureMonsterInZone,
  assertAdventureZoneAccess
} from './adventure-zones.mjs?v=0.5.0';

export const ADVENTURE_ENCOUNTER_VERSION = 'ADV5-0.1';

const freeze = value => Object.freeze(value);
const RANK_BY_ZONE = freeze({z1: 'normal', z2: 'normal', z3: 'normal', z4: 'elite'});

function assertSafeInteger(value, name, {min = Number.MIN_SAFE_INTEGER} = {}) {
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`invalid_${name}`);
  return value;
}

function hash32(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function encounterKey(input, channel) {
  return `${input.seed}|${input.tick}|${input.agentId}|${input.x}|${input.y}|${input.adventureLevel}|${input.zoneId}|${channel}`;
}

export function resolveAdventureEncounter(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_encounter_input');

  const seed = assertSafeInteger(input.seed, 'seed');
  const tick = assertSafeInteger(input.tick, 'tick', {min: 0});
  const agentId = assertSafeInteger(input.agentId, 'agent_id', {min: 1});
  const x = assertSafeInteger(input.x, 'x');
  const y = assertSafeInteger(input.y, 'y');
  const adventureLevel = assertSafeInteger(input.adventureLevel, 'adventure_level', {min: 1});
  const zoneId = input.zoneId;

  const definition = assertAdventureZoneAccess(zoneId, adventureLevel);
  const normalized = {seed, tick, agentId, x, y, adventureLevel, zoneId};

  const monsterIndex = hash32(encounterKey(normalized, 'monster')) % definition.rosterIds.length;
  const monsterId = definition.rosterIds[monsterIndex];
  assertAdventureMonsterInZone(zoneId, monsterId);

  const levelCeiling = Math.min(definition.maxLevel, Math.max(definition.minLevel, adventureLevel));
  const levelSpan = levelCeiling - definition.minLevel + 1;
  const monsterLevel = definition.minLevel + (hash32(encounterKey(normalized, 'level')) % levelSpan);

  return freeze({
    zoneId,
    monsterId,
    monsterLevel,
    rank: RANK_BY_ZONE[zoneId]
  });
}
