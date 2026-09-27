# Adventure V1 Integration I2 — World Expedition Bridge

Status: CANDIDATE. MERGE NOT APPROVED.  
Parent: I1 exact head `bca2146b8e0b8e2eb3e179f306f4b6a4eb8e70b8` with Verify SUCCESS #1435.

## Goal

Make Khet Sila a real spatial expedition in the existing Simclone world.

```text
Adventurer
→ START_ADVENTURE_EXPEDITION
→ existing pathTo / EXPLORE task
→ physically walk to a derived Khet zone cell
→ finish the existing work threshold
→ deterministic encounter READY
```

No teleport and no combat state commit exist in I2.

## Spatial policy

Khet Sila is a derived eastward corridor, not a second mutable map:
- z1 uses x 55–65% of the world width,
- z2 66–76%,
- z3 77–87%,
- z4 88–98%,
- y uses the walkable interior.

The entry cell is the shortest reachable walkable cell in the requested zone, with deterministic ties. The region is derived from current world bounds and never persisted as a second world ledger.

## Start gate

The command requires:
- Independent world,
- living productive Clone,
- profession = adventurer,
- no current task,
- no pending encounter,
- satiety not below existing `RULES.hungry`,
- energy not below existing `RULES.exhausted`,
- canonical Adventure progression,
- ADV5 level gate,
- an existing path.

The command does not change coordinates. It assigns the existing EXPLORE task/path contract.

## Encounter state

Only after the Clone reaches the stored target and finishes the normal EXPLORE work threshold does I2 create one bounded `agent.adventureEncounter` snapshot with status `READY`.

It contains encounter identity, zone, monster ID/level/rank, Adventure level, ticks and the actual reached x/y.

I2 writes no HP, status, XP, loot, inventory or equipment.

A READY encounter prevents another expedition until a later combat gate resolves it.

## Authority locks

- position/movement = existing Simclone task + path authority,
- zone/roster/level = ADV5 modules,
- encounter choice = deterministic ADV5 resolver,
- profession = ADV0,
- level = I1,
- HP/combat/loot = untouched.

## Acceptance

1. Zone spatial bands are deterministic and non-overlapping.
2. Starting an expedition leaves agent coordinates byte-identical.
3. The Clone walks via the existing task path to a real zone cell.
4. z2–z4 level gates cannot be bypassed by the command.
5. Encounter monster is in the requested zone roster.
6. Save/load during travel produces the same final encounter.
7. Pending encounters block duplicate expeditions.
8. A tampered expedition target is cleared before encounter creation.
9. Existing I0/I1 and project regressions remain SAT.
10. Exact-head Verify succeeds. UNKNOWN is not PASS.
