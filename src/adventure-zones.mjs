export const ADVENTURE_ZONE_VERSION = 'ADV5-0.1';
export const ADVENTURE_MONSTER_ID_CONTRACT_VERSION = 'ADV5-MONSTER-ID-FIXTURE-1';

const freeze = value => Object.freeze(value);

export const ADVENTURE_MONSTER_ID_CONTRACT = freeze(
  Array.from({length: 36}, (_, index) => `MON_${String(index + 1).padStart(3, '0')}`)
);

const CANONICAL_MONSTER_IDS = new Set(ADVENTURE_MONSTER_ID_CONTRACT);

const regionRequirement = (worldRegionId, entryTag) => freeze({
  worldRegionId,
  entryTag,
  presence: 'INSIDE_REGION',
  travelMode: 'WALK',
  pathAuthority: 'AGENT_H',
  pathfinding: 'REQUIRED_BEFORE_RUNTIME_WIRING'
});

const zone = (zoneId, name, minLevel, maxLevel, worldRegionId, entryTag, rosterIds) => {
  for (const monsterId of rosterIds) {
    if (!CANONICAL_MONSTER_IDS.has(monsterId)) throw new Error('noncanonical_monster_id');
  }
  return freeze({
    zoneId,
    name,
    minLevel,
    maxLevel,
    regionRequirements: regionRequirement(worldRegionId, entryTag),
    rosterIds: freeze([...rosterIds])
  });
};

export const ADVENTURE_ZONES = freeze([
  zone('z1', 'ขอบโคลน', 1, 15, 'khet-sila:z1', 'khet-sila:z1:edge', [
    'MON_001', 'MON_002', 'MON_003', 'MON_004', 'MON_007'
  ]),
  zone('z2', 'ทุ่งร่างสอง', 16, 30, 'khet-sila:z2', 'khet-sila:z2:edge', [
    'MON_019', 'MON_020', 'MON_021', 'MON_022', 'MON_028'
  ]),
  zone('z3', 'สันเขา', 31, 45, 'khet-sila:z3', 'khet-sila:z3:edge', [
    'MON_023', 'MON_024', 'MON_025', 'MON_027', 'MON_034'
  ]),
  zone('z4', 'ปากถ้ำ', 46, 60, 'khet-sila:z4', 'khet-sila:z4:edge', [
    'MON_026', 'MON_029', 'MON_030', 'MON_035', 'MON_036'
  ])
]);

const ZONE_BY_ID = new Map(ADVENTURE_ZONES.map(definition => [definition.zoneId, definition]));

export function adventureZoneById(zoneId) {
  const found = ZONE_BY_ID.get(zoneId);
  if (!found) throw new Error('unknown_zone');
  return found;
}

export function isCanonicalAdventureMonsterId(monsterId) {
  return CANONICAL_MONSTER_IDS.has(monsterId);
}

export function canEnterAdventureZone(zoneId, adventureLevel) {
  const definition = adventureZoneById(zoneId);
  if (!Number.isSafeInteger(adventureLevel) || adventureLevel < 1) return false;
  return adventureLevel >= definition.minLevel;
}

export function assertAdventureZoneAccess(zoneId, adventureLevel) {
  const definition = adventureZoneById(zoneId);
  if (!Number.isSafeInteger(adventureLevel) || adventureLevel < 1) throw new Error('invalid_adventure_level');
  if (adventureLevel < definition.minLevel) throw new Error('zone_level_gate');
  return definition;
}

export function zoneContainsMonster(zoneId, monsterId) {
  return adventureZoneById(zoneId).rosterIds.includes(monsterId);
}

export function assertAdventureMonsterInZone(zoneId, monsterId) {
  const definition = adventureZoneById(zoneId);
  if (!isCanonicalAdventureMonsterId(monsterId)) throw new Error('unknown_monster_id');
  if (!definition.rosterIds.includes(monsterId)) throw new Error('monster_outside_zone');
  return monsterId;
}
