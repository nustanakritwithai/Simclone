# Simclone — current release 0.3.2

Current implementation: **Autonomous Birth 0.3.2 + Stage Gameplay 0.3.1 + Survival Core 0.2.0 + Observation UI 0.3.2**. Save schema remains 0.2.0 with explicit migration from legacy 0.1.0.

## What works

The world can now create a new generation without the player pressing Clone.

Autonomous birth is an engine transition, separate from manual CLONE:

- evaluated on simulated-year boundaries;
- at most one autonomous birth per biological year;
- parent must be a living ADULT;
- same parent has a 4-year cooldown;
- living population must be below housing and hard population limits;
- historical agent cap remains 200;
- Food cost = 8 and Wood cost = 4;
- reserved EAT meals are excluded from spendable food;
- after paying Food 8, free food must still meet the next population's food target;
- after paying Wood 4, at least 12 wood must remain;
- food gathering automatically includes a birth reserve so the old soft stock target cannot deadlock reproduction;
- parent selection is deterministic and favors fewer autonomous children / older last birth / lower ID;
- child starts at age 0, keeps parentId, generation +1, permanent new appearance and 35% inherited Skill XP.

No separate mutable reproduction lock/cooldown registry exists. Birth pacing and parent cooldown are derived from persisted agent lineage and `bornTick`.

Lifecycle behavior remains:

- CHILD 0–15 cannot take FORAGE / WOODCUT / MINE / BUILD;
- ADULT 16–54 works at 100%;
- ELDER 55+ productive work rate is 75%;
- DEAD overrides age.

Observation UI now shows autonomous-birth count and the current blocking reason: housing, pacing, parent eligibility, food or wood.

## Latest evidence

Candidate commit `7b7fa0e9775b20c2f601fd878c033dc4b12d4660`, workflow `35921105182`: **SAT**.

- Unit/asset: **76/76 PASS**.
- Survival regression: **18/18 SAT**.
- Autonomous-birth long-run proof: **5/5 seeds SAT**, 30 simulated years each.
- Manual CLONE commands in the autonomous proof: **0** for every seed.
- Each seed created 6 autonomous children and reached max generation 2.
- At least 4 productive grown descendants were observed in every seed.
- Offline Chromium: **43 + 36 + 10 = 89 PASS**.

This is not V1.0 proof. The new proof does not include age death, post-death generation continuation, mentor/archive knowledge, social relationships, factions or replay.

## Save contract

Engine version: `0.3.2`.

Save schema: `0.2.0`.

Accepted legacy schema: `0.1.0`.

Storage key remains `simclone:world:v1`.

V0.3.2 does not add a cooldown field or birth registry to the save. Autonomous births are recognizable from persisted lifecycle/lineage data, so no schema bump was required.

## Verification limits

Offline Chromium uses an explicit Storage test double. Native browser localStorage persistence and physical Android performance remain UNKNOWN. GitHub Pages deployment must be verified against the exact `main` commit before release is called deployed.

## Next gate

**V0.3.3 — Age Death + Cleanup.**

Age death must be deterministic in the declared 78–92 year window. Death must clear tasks, release all derived reservations, stop actions, preserve identity/lineage/history and survive save/load. Only after this passes do we run V0.3.4 generation-continuity proof.
