# Simclone — current release 0.3.3

Current implementation: **Age Death 0.3.3 + Autonomous Birth 0.3.2 + Stage Gameplay 0.3.1 + Survival Core 0.2.0**. Save schema remains 0.2.0 with explicit migration from 0.1.0.

## What works

The lifecycle loop now includes deterministic death by age.

- Biological time remains simulation-only: 360 ticks = 1 biological year.
- Lifespan is derived deterministically from world seed + agent identity/generation.
- Lifespan range is 78–92 years inclusive.
- No `lifespan` field is stored and no save-schema bump was required.
- When derived age reaches lifespan, the agent dies.
- Starvation and age death use the same dead-state invariant: `alive=false`, `hp=0`, `task=null`, `moveTick=0`.
- Death occurs before reservation reconstruction, so dead agents cannot retain node/build/meal claims.
- Chronicle/personal memory records cause-specific death; age-death text records age at death.
- Identity, lineage, appearance and derived lifespan remain valid through save/load.
- Inspector exposes derived current age/lifespan for living agents and lifespan for dead agents.

Autonomous birth remains active with max one birth/year, four-year same-parent cooldown, Food 8 + Wood 4 cost, next-population food reserve and Wood 12 safety floor.

## Latest evidence

Candidate commit `8dbbb2c16c4dba6920036028ec002419cefc51ee`, workflow `35922444771`: **SAT**.

- Unit/asset: **81/81 PASS**.
- Survival regression: **18/18 SAT**.
- Autonomous birth proof: **5/5 SAT**.
- Age-death/cleanup proof: **5/5 SAT**, 90 simulated years per seed.
- Age deaths: 10 / 11 / 10 / 10 / 9 across seeds 230926 / 1 / 42 / 2026 / 90001.
- Starvation deaths in age-death proof: **0** for all seeds.
- Offline Chromium: **89 PASS**.

After 90 years, living population ranged from 1 to 9 depending on seed. That is evidence the death system is active, but it is not sufficient to claim autonomous population continuity.

## Save contract

Engine version: `0.3.3`.

Save schema: `0.2.0`.

Legacy accepted: `0.1.0`.

Storage key: `simclone:world:v1`.

Lifespan is derived, not persisted. Birth cooldown remains derived from lineage and `bornTick`. No new mutable lifecycle registry was introduced.

## Verification limits

The historical Survival Core 100-day regression deliberately freezes agents below the minimum age-death threshold once they reach late elder age; this keeps that fixture measuring survival/resource mechanics rather than the new death gate while retaining Elder 75% productivity. Age death is verified separately by `npm run test:death`.

Offline Chromium uses an explicit Storage test double. Native browser localStorage and physical Android performance remain UNKNOWN.

## Next gate

**V0.3.4 — Generation Continuity Proof.**

The proof must use no player manual CLONE and demonstrate:

```text
initial adults
→ autonomous child
→ child grows and works
→ original generation ages and dies
→ later generation produces another generation
→ world remains valid and inhabited
```

across multiple seeds. V1.0 is still not claimed.
