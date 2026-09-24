# Simclone V0.3 — Lifecycle + Autonomous Generation Contract

Historical contracts/evidence through V0.3.3. Current V0.3.4 rules and proof boundaries: [LIFECYCLE_0.3.4.md](LIFECYCLE_0.3.4.md). The former one-year global birth gap is superseded by four years; parent cooldown is still four years.

Status: **V0.3.3 Age Death verified candidate**. Lifecycle derivation, stage gameplay, autonomous birth and deterministic age death/cleanup are implemented. Post-death generation continuity remains the V0.3.4 gate.

## Product gate

Short-term gate:

```text
Existing world
→ deterministic age
→ Child / Adult / Elder
→ autonomous birth
→ child grows
→ adult works
→ parent ages
→ death releases work
→ later generation continues
```

This is a lifecycle proof only. It is not the V1.0 autonomous-world proof and does not claim mentor teaching, culture, social relationships, replay, local perception, factions or LLM behavior.

## Simulation clock contract

- Wall-clock time is forbidden. Lifecycle uses engine ticks only.
- **360 ticks = 1 simulated day = 1 biological year.**
- Age must be deterministic under save/load and seed replay.
- Stage is derived from authoritative simulation state; UI never owns age rules.

Life stages:

| Stage | Biological age | Contract |
| --- | ---: | --- |
| CHILD | 0–15 | Cannot take FORAGE / WOODCUT / MINE / BUILD; basic needs remain available. |
| ADULT | 16–54 | Full productive work rate (1.0). |
| ELDER | 55+ while alive | Productive work rate 0.75; later teaching value is still future work. |
| DEAD | any | `alive=false` overrides age. No action execution. |

Planned age-death window for V0.3.3 is 78–92 biological years, derived deterministically from world/agent identity. **Age death is not active in V0.3.0.**

## Save and migration contract

V0.3.0 changes persistent lifecycle semantics, so it does not pretend the old schema is unchanged.

- Engine version: `0.3.0`
- Save schema: `0.2.0`
- Legacy accepted schema: `0.1.0`
- Storage key remains `simclone:world:v1`.
- Each current agent persists `life.anchorTick` and `life.ageAtAnchorYears`.
- Existing 0.1.0 agents migrate at load to **age 18 at the migration tick**. This intentionally starts their V0.3 lifecycle clock at adoption instead of interpreting a long-running legacy world as instantly elderly.
- Migration preserves id, parentId, generation, appearance, skills, resources, position, needs, memories, events and in-flight job data. Legacy jobs still replan under Survival 0.2 policy as before.
- Corrupt/unreadable-save protection remains owned by `src/storage.mjs`; a failed migration must not authorize overwrite.

Manual CLONE remains an **Influence action** that creates an adult clone at age 18. Autonomous birth is a different transition and will create a child at age 0.

## V0.3.0 — Age + stage foundation

### Success Contract

1. Age is derived only from simulation tick + persistent lifecycle anchor.
2. Boundaries are exact: 15 CHILD, 16 ADULT, 54 ADULT, 55 ELDER; DEAD overrides.
3. Fresh worlds and manual clones begin as age-18 ADULT to preserve existing gameplay.
4. A real 0.1.0 fixture migrates deterministically to save 0.2.0.
5. Current-schema save/load continuation is byte-equivalent after restore and deterministic after further ticks.
6. No Child/Elder productivity effect, autonomous birth or age death is claimed in this milestone.

### Definition of Done

- deterministic unit tests PASS;
- all existing engine/survival tests PASS after explicit migration expectation changes;
- 100-day Survival Core proof remains green because V0.3.0 does not yet change work/death behavior;
- no UI feature is added before engine evidence exists.

## V0.3.1 — Stage gameplay

### Success Contract

- CHILD cannot take FORAGE / WOODCUT / MINE / BUILD jobs; basic EAT / REST / IDLE / safe movement remain available.
- ADULT retains current Survival Core productivity.
- ELDER productive work is reduced deterministically; no hidden random penalty.
- Candidate scoring and task validation reject stage-ineligible work before execution.
- A stage transition during an in-flight now-invalid task releases its derived reservation and replans.
- Manual CLONE remains adult; autonomous children are not enabled yet.

## V0.3.2 — Autonomous birth

### Implemented contract

Autonomous birth is a separate engine transition from manual CLONE and occurs only when all are true:

- at least one eligible living ADULT exists;
- housing has a free slot;
- free food excludes reserved meals;
- spending the birth cost does not push food below the next-population food target;
- wood remains above a deterministic safety floor after cost;
- eligible parent cooldown is clear;
- global birth pacing allows at most one autonomous birth evaluation winner per biological year;
- total historical agent cap remains respected.

Initial planned birth cost remains **Food 8 + Wood 4** so population is never spawned for free. The child starts at age 0, keeps `parentId`, uses `generation = parent.generation + 1`, inherits 35% Skill XP unless a later explicitly-versioned rule changes it, and receives a permanent new appearance.

Population pressure and cooldown must prevent runaway exponential growth. Reservations remain derived from tasks; reproduction must not create a second lock registry.

## V0.3.3 — Age death + cleanup

### Implemented contract

- Lifespan is deterministic in the declared 78–92 year window.
- Age death and starvation death share a single dead-state invariant: `alive=false`, `task=null`, no further decisions/actions.
- Derived task reservations disappear on the next reservation rebuild; no stale worker or meal claim survives death.
- Chronicle records cause-specific death.
- Dead identity/history remains inspectable and save/load valid.
- Death never deletes already-persisted lineage links.

## V0.3.4 — Generation continuity proof

### Success Contract

A dedicated proof, with **no player manual CLONE**, must demonstrate across multiple seeds:

```text
initial adults
→ autonomous child
→ child reaches ADULT
→ that generation performs productive work
→ original generation reaches ELDER
→ age death occurs
→ later generation still exists and continues
```

Evidence must report births, stage transitions, age deaths, max generation, living population, resource bounds and validation results. UNKNOWN is not PASS. This proof remains narrower than V1.0 because culture, relationships, knowledge transfer and replay are still separate gates.


## V0.3.1 verification evidence

Candidate commit: `b6cd1fc26408f34a08bf58db2344dc53f586c809`

Workflow run: `35887581535` — **SAT**

- `npm test`: 69/69 PASS.
- `npm run test:survival`: 18/18 SAT, including the five 100-day seed/population matrices and three 10-day empty-food crises.
- Observation UI offline Chromium: 43 checks PASS.
- Navigation/save recovery offline Chromium: 36 checks PASS.
- Survival UI offline Chromium: 10 checks PASS.
- Module-cache regression test forbids mixed versioned ES-module pins.
- The 100-day survival fixtures exercise elder work-rate reduction after lifecycle aging and still satisfy their declared survival contracts.

These browser suites use an explicit Storage test double. Native browser persistence and physical Android performance remain UNKNOWN until separately exercised. Autonomous generation continuity is not claimed by V0.3.1.


## V0.3.2 verification evidence

Candidate commit: `7b7fa0e9775b20c2f601fd878c033dc4b12d4660`

Workflow run: `35921105182` — **SAT**

- `npm test`: 76/76 PASS.
- Survival regression: 18/18 SAT.
- Autonomous-birth proof: 5/5 seeds SAT, 30 simulated years each, zero player/manual CLONE commands.
- Every proof seed produced 6 autonomous children and reached living population 12/12 housing without exceeding capacity.
- Every proof seed reached generation 2.
- Grown autonomous descendants: 6, 6, 6, 6, 5 across seeds 230926, 1, 42, 2026, 90001.
- Productive grown descendants: 6, 6, 5, 6, 4 respectively.
- Offline Chromium: 43 observation UI + 36 navigation/save + 10 survival/autonomous-birth UI checks PASS.

The proof demonstrates **autonomous birth → child growth → productive descendant**. It does not demonstrate age death or population continuity after the original generation dies; that remains V0.3.3/V0.3.4.


## V0.3.3 verification evidence

Candidate commit: `8dbbb2c16c4dba6920036028ec002419cefc51ee`

Workflow run: `35922444771` — **SAT**

- `npm test`: 81/81 PASS.
- Survival regression: 18/18 SAT.
- Autonomous-birth proof: 5/5 SAT.
- Age-death/cleanup proof: 5/5 seeds SAT over 90 simulated years.
- Age deaths observed by seed: 10, 11, 10, 10, 9.
- Starvation deaths in that proof: 0 for every seed.
- No dead agent retained a task or any node/build/meal reservation.
- Offline Chromium: 43 observation UI + 36 navigation/save + 10 survival/lifecycle UI checks PASS.

Living population after 90 years varied from 1 to 9. This is intentionally **not** counted as V0.3.4 continuity proof; the next gate must demonstrate later generations continue autonomously after the original generation has died, not merely that some agent remains alive.
