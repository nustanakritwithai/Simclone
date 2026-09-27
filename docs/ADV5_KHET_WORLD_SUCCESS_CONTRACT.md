# ADV5 — Khet Sila World / Zone / Encounter Success Contract

Status: DRAFT CANDIDATE — WORLD DEFINITIONS ONLY, NOT WIRED TO RUNTIME  
Target branch: `feature/adventure-khet-world`  
Baseline: current Simclone `main` at branch creation  
Donor: PR #123 Khet Sila, **content direction only**

## Goal

Make เขตศิลา a future physical part of the Simclone world through pure zone and encounter definitions.

This gate does **not** create a separate game, panel travel flow, or teleport path. It does not wire pathfinding. Agent H will later map the declarative region requirements to authoritative Simclone world geometry and navigation.

## Owned files

Only these files are in scope:

- `src/adventure-zones.mjs`
- `src/adventure-encounter.mjs`
- `tests/adventure-zones.test.mjs`
- `docs/ADV5_KHET_WORLD_SUCCESS_CONTRACT.md`

No engine, navigation, UI, combat, loot, save, or monster-runtime module is changed by this gate.

## Authority boundaries

ADV5 owns only:

1. zone identity and level bands,
2. region-entry requirements as a declarative interface,
3. explicit monster rosters per zone,
4. deterministic encounter selection from an already-authoritative zone id,
5. zone-level access validation.

ADV5 must not write world state. It accepts plain values and returns frozen plain values.

Forbidden in this gate:

- `Math.random`
- wall-clock time as gameplay input
- world-state writes
- navigation/pathfinding mutation
- UI or panel logic
- combat resolution
- loot/reward resolution
- capture/taming/party/ranch/breeding systems
- teleport API

## Canonical monster ID fixture contract

Agent C files are intentionally **not imported** so this workstream remains independent.

ADV5 freezes the compatibility fixture:

`MON_001` ... `MON_036`

This is an ID seam only. It does not own species stats, stages, forms, types, combat profiles, capture data, or save instances. When Agent C is integrated, its monster definitions must map to these canonical IDs (or a later explicitly versioned migration must update both sides).

A monster being stage 1 or stage 2 is never sufficient for zone membership. The zone roster is authoritative for encounter eligibility.

## Zone definitions

Canonical shape:

```js
{
  zoneId,
  name,
  minLevel,
  maxLevel,
  regionRequirements,
  rosterIds
}
```

Baseline:

| Zone | Name | Content band | Explicit roster | Encounter rank |
| --- | --- | --- | --- | --- |
| `z1` | ขอบโคลน | Lv.1–15 | `MON_001,002,003,004,007` | normal |
| `z2` | ทุ่งร่างสอง | Lv.16–30 | `MON_019,020,021,022,028` | normal |
| `z3` | สันเขา | Lv.31–45 | `MON_023,024,025,027,034` | normal |
| `z4` | ปากถ้ำ | Lv.46–60 | `MON_026,029,030,035,036` | elite |

`minLevel` is the entry gate. A higher-level Adventurer may revisit a lower zone. `maxLevel` caps the monster-level band for that zone; it is not an upper-bound travel lock.

This preserves the useful PR #123 content separation while refusing its panel/game authority.

## Region requirement interface

Every zone exposes read-only requirements:

```js
{
  worldRegionId,
  entryTag,
  presence: 'INSIDE_REGION',
  travelMode: 'WALK',
  pathAuthority: 'AGENT_H',
  pathfinding: 'REQUIRED_BEFORE_RUNTIME_WIRING'
}
```

Meaning:

- runtime encounter wiring must come from physical world presence,
- travel is walking through Simclone navigation,
- ADV5 does not decide paths or move agents,
- Agent H must later prove that `zoneId` is derived from actual world geometry rather than caller invention.

Until that wiring exists, physical zone-membership proof is **UNKNOWN** and must not be called released gameplay.

## Level authority

`assertAdventureZoneAccess(zoneId, adventureLevel)` is the pure zone-level authority for this slice.

Rules:

- unknown zone → `unknown_zone`
- malformed/non-positive level → `invalid_adventure_level`
- level below `zone.minLevel` → `zone_level_gate`
- level at or above `zone.minLevel` → eligible for the zone definition

Encounter resolution must call this authority before choosing a monster.

## Roster authority

`assertAdventureMonsterInZone(zoneId, monsterId)` enforces the explicit roster.

Rules:

- non-canonical ID → `unknown_monster_id`
- canonical ID outside the zone roster → `monster_outside_zone`
- z4 roster members cannot appear through z2/z3 encounter resolution
- stage/form metadata alone can never grant zone membership

## Encounter contract

Input:

```js
{
  seed,
  tick,
  agentId,
  x,
  y,
  adventureLevel,
  zoneId
}
```

Output:

```js
{
  zoneId,
  monsterId,
  monsterLevel,
  rank
}
```

`resolveAdventureEncounter(input)` is pure and deterministic.

Selection rules:

1. validate deterministic scalar inputs,
2. validate the zone and level gate,
3. derive a stable 32-bit hash from `seed/tick/agentId/x/y/adventureLevel/zoneId`,
4. select only from `zone.rosterIds`,
5. re-validate the selected ID through roster authority,
6. select monster level deterministically from `zone.minLevel` through `min(adventureLevel, zone.maxLevel)`,
7. return `normal` for z1–z3 and `elite` for z4.

No hidden state, current time, global RNG, combat state, loot state, or world mutation participates.

## Success proof

`tests/adventure-zones.test.mjs` must prove:

- [x] z1–z4 baseline bands
- [x] walking/pathfinding requirement interface only
- [x] 36-ID canonical fixture exists without importing Agent C
- [x] explicit roster authority; stage alone is insufficient
- [x] level gates are enforced by zone authority
- [x] invalid zone is rejected
- [x] deterministic encounter for identical input
- [x] encounter result is inside the selected zone roster
- [x] z4 monsters cannot leak into z2/z3
- [x] monster level stays inside the zone band
- [x] input is not mutated and output is frozen
- [x] no random/wall-clock/world-writer/UI/combat/loot dependency
- [x] no teleport export/API

## Explicit UNKNOWN / deferred work

These are not failures of ADV5 because they belong to later owners, but they cannot be claimed complete:

- actual Khet world polygons/cells/terrain placement in Simclone
- deriving `zoneId` from authoritative physical coordinates
- walking/pathfinding integration
- encounter cadence / trigger frequency
- Agent C monster-definition binding beyond the ID seam
- combat, loot, progression rewards, UI, save/runtime integration
- browser/Pages/public gameplay proof

## Merge rule

Draft PR only. Do not merge from this workstream.

The later integration agent must re-read current `main`, Agent C output, Agent H pathfinding work, and this contract before wiring any runtime caller.
