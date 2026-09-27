# ADV1 — Adventure Combat Stats Success Contract

Status: CANDIDATE CONTRACT + PURE ADAPTER. DRAFT PR ONLY. DO NOT MERGE.

## Scope

This gate owns only the read-only projection from a Simclone Clone/Adventurer snapshot into the Pocket-shaped combat vocabulary.

Owned files:

- `src/adventure-combat-stats.mjs`
- `src/adventure-combat-profile.mjs`
- `tests/adventure-combat-stats.test.mjs`
- `docs/ADV1_COMBAT_STATS_SUCCESS_CONTRACT.md`

Explicitly out of scope: monster catalog, combat damage, encounter, loot, zone, UI, profession, combat save, adventure character creation, inventory writes and any `engine.mjs` edit.

## Donor evidence used

Pocket Monster donor `main@f7f243d21906d9fa26127529313b441b4b938ce0` was checked before implementation.

Relevant donor contracts:

- `combat-v91-contract.mjs`
  - Pocket-shaped profile stats are `hpMax`, `hpCurrent`, `atk`, `def`, `spAtk`, `spDef`, `spd`, plus five ratios.
  - integer Core/profile stats are non-negative, `hpMax >= 1`, and `hpCurrent <= hpMax`.
  - shared combat level maximum is 60.
- `combat-v91-stat-projection.mjs`
  - Core6 vocabulary maps `hp → hpMax`, then `atk/def/spAtk/spDef/spd` directly.
  - proficiency/equipment is action-scoped and must not silently rewrite Core6 or HP.
- `monster-stat-contract.mjs` / `monster-stat-formula.mjs`
  - monster stat source level is 1–60.
  - the monster formula is monster-owned.
- `docs/combat-v91-client-handoff.md`
  - Human and Monster share the vocabulary but their progression owners calculate their own Core6.
  - Human Core6 must not be manufactured from unrelated proficiency/equipment values.

Therefore this Simclone adapter intentionally does **not** apply the Pocket monster formula to a human Clone. It accepts Core6 and ratings as explicit progression-owner input (or an explicit test fixture) until Simclone has an authoritative combat progression owner.

## Canonical output

```js
{
  level,
  hpMax,
  hpCurrent,
  atk,
  def,
  spAtk,
  spDef,
  spd,
  accuracy,
  crit,
  evasion,
  resistance,
  penetration
}
```

Canonical vocabulary:

```text
HP / ATK / DEF / SPATK / SPDEF / SPD
```

Rules:

- `level` is a safe integer in `1..60`.
- `hpMax`, `hpCurrent`, `atk`, `def`, `spAtk`, `spDef`, `spd` are safe integers.
- `hpMax >= 1`.
- `0 <= hpCurrent <= hpMax`.
- `accuracy`, `crit`, `evasion`, `resistance`, `penetration` are finite ratios in `0..1`.
- output profile is immutable and exact-schema.

## Deterministic derivation

Input snapshot:

```js
{
  agent: {
    hp // existing Simclone 0..100 health ratio; may be fractional
  },
  adventureProgression: {
    combatLevel, // explicit authority/fixture input, 1..60
    coreStats: {
      hp, atk, def, spAtk, spDef, spd
    }
  },
  ratings: {
    accuracy, crit, evasion, resistance, penetration
  }
}
```

Projection:

```text
level     = explicit adventureProgression.combatLevel
hpMax     = explicit adventureProgression.coreStats.hp
hpCurrent = floor((agent.hp / 100) × hpMax)
ATK       = explicit coreStats.atk
DEF       = explicit coreStats.def
SPATK     = explicit coreStats.spAtk
SPDEF     = explicit coreStats.spDef
SPD       = explicit coreStats.spd
ratings   = explicit ratings input
```

This is intentionally an adapter, not a stat writer.

The following are **not** inferred into Core6:

- `FORAGE`, `WOODCUT`, `MINE`, `BUILD` skill XP
- EXPLORE qualification count
- profession
- inventory/equipment
- Khet prototype stats
- loot
- monster stats

If those values should affect combat later, their authoritative owner must provide an explicit combat progression snapshot. This module must not guess their weights.

## HP bridge

Current Simclone `agent.hp` is a `0..100` ratio and is an existing world-state field. ADV1 reads it only.

```js
combatHpFromAgentHp(agentHp, hpMax)
```

uses floor rounding so the projection never overstates current HP.

```js
agentHpFromCombatRatio(hpCurrent, hpMax)
```

returns a `0..100` ratio for read-only reconciliation/display. It does not authorize writing `agent.hp`.

No function in this gate writes:

- `agent.hp`
- `agent.skills`
- inventory
- combat save
- adventure character

## API examples

```js
import {
  projectAdventurerCombatStats,
  combatHpFromAgentHp,
  agentHpFromCombatRatio,
} from './src/adventure-combat-stats.mjs';
import {
  validateAdventurerCombatStats,
} from './src/adventure-combat-profile.mjs';

const result = projectAdventurerCombatStats({
  agent: { hp: 75.5 },
  adventureProgression: {
    combatLevel: 12,
    coreStats: {
      hp: 160,
      atk: 44,
      def: 38,
      spAtk: 31,
      spDef: 35,
      spd: 47,
    },
  },
  ratings: {
    accuracy: 0.92,
    crit: 0.08,
    evasion: 0.07,
    resistance: 0.12,
    penetration: 0.04,
  },
});

if (!result.ok) throw new Error(result.reason);

console.log(result.profile.hpCurrent); // 120
console.log(validateAdventurerCombatStats(result.profile).ok); // true
console.log(combatHpFromAgentHp(50, 101)); // 50
console.log(agentHpFromCombatRatio(1, 3)); // 33.333333
```

## Acceptance / VIP

1. **SAT** — canonical Core6 vocabulary is exactly HP/ATK/DEF/SPATK/SPDEF/SPD.
2. **SAT** — output supports all 13 required profile fields.
3. **SAT** — level is fail-closed outside integer `1..60`.
4. **SAT** — `agent.hp` bridge is deterministic and read-only.
5. **SAT** — explicit Core6/rating input is copied into the profile without hidden skill/profession/inventory weighting.
6. **SAT** — no import of `engine.mjs`.
7. **SAT** — no edits to `engine.mjs` or `index.html`.
8. **SAT** — no monster catalog/damage/encounter/loot/zone/UI/profession implementation.
9. **SAT** — tests prove deterministic output, immutable input/output boundary, validation and forbidden-writer guard.
10. **UNKNOWN until GitHub reports it** — exact Draft PR Actions status.

UNKNOWN is not PASS. This PR must remain Draft and must not be merged in this gate.
