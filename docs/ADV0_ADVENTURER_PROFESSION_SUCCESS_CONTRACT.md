# ADV0 — Adventurer profession

Status: CANDIDATE IMPLEMENTED ON PR #130. MERGE NOT APPROVED.  
Base: `main@65bfcfb241e1971a4cb06b8e7c7ac32110f7d1da` (CV0–CV2 calibration baseline).  
Prior candidate `b04fb2c251f6e358e7f11834f024dbbf3ae594b5` passed Verify run [#1376](https://github.com/nustanakritwithai/Simclone/actions/runs/36305292636). The bounded-history repair after that head requires its own exact-head CI; until then that newer head is UNKNOWN, never PASS.

This file is the source of truth for the direction change. PR #130 now carries the candidate implementation on the current base. Exact candidate CI is still required; PR descriptions and the stale side-game branch are not authority.

## What was checked

- `main` is the VAL7–VAL10 merge `5ddb4e00062100f025847ad0cbd0d14e01c421ff`. `docs/STATUS.md` and `docs/NEXT_STEPS.md` still describe the older Governor closeout, so this contract follows the current tree and PR base rather than those stale summaries.
- Draft [PR #123](https://github.com/nustanakritwithai/Simclone/pull/123) `feature/khet-sila-rules` @ `c8eaea7` is CONFLICTING with `main`. Its verify run succeeded for the side module. That is not permission to merge.
- VAL5 is merged. Its files are `docs/VAL5_OUTCOME_LEARNING_SHADOW_SUCCESS_CONTRACT.md`, `src/read-models/outcome-learning-shadow.mjs`, and `tests/outcome-learning-shadow.test.mjs`. Do not edit them in an Adventurer patch.
- Other open work that this gate must not touch: PR #102, #84, #74, #73.

No force push. No commit onto another agent's branch.

## Goal

One Clone in `state.agents` becomes the profession `adventurer` (`นักผจญภัย`) only after that same Clone has a bounded run of real `EXPLORE` completions.

```text
existing EXPLORE candidate
→ existing path
→ existing execute step
→ task finished on the reached cell
→ append one qualification fact
→ at 3 accepted facts, adoptProfession
```

One success is not enough. Pressing explore, starting to walk, failing, or an UNKNOWN result stores nothing and does not change profession.

Profession continuity is not decided here. `adoptProfession` today rewrites profession from the next productive selection. Calling it for `adventurer` before [ADV0B](ADV0B_PROFESSION_CONTINUITY_SUCCESS_CONTRACT.md) would let one `FORAGE`, `WOODCUT`, `MINE`, or `BUILD` erase the profession. ADV0 must not make that call until ADV0B is the authority for the edit. No second profession writer.

## Authority that already exists

- Professions are `KINGDOM_PROFESSIONS` in `src/kingdom-utility.mjs`. Today: forager, woodcutter, miner, builder. `professionForAction` maps only `FORAGE`, `WOODCUT`, `MINE`, `BUILD`.
- `decide()` calls `adoptProfession(agent, choice.kind, tick)` when a candidate is selected. `professionForAction("EXPLORE")` is null, so selecting `EXPLORE` does not change profession. That null must stay.
- The career tail already drops until 8 entries remain. Qualification history uses that same cap. It is not a new XP ledger.
- `execute()` walks `task.path` one step at a time, then works. There is no teleport API in that loop.
- `SKILLS` is `FORAGE`, `WOODCUT`, `MINE`, `BUILD`. `EXPLORE` is a task label in `LABELS` and a candidate kind. It is not a skill. `gain()` ignores keys outside `SKILLS`. Birth XP is `floor(parent.skills[key] * 0.35)` and `recordEarnedSkill` records earned skill XP only.
- `agent.hp` already exists. Starvation is the runtime writer that reaches `hp === 0`. There is no second HP ledger on `main`.
- Regions are the derived MX2 field in `src/world-regions.mjs` (`WORLD_REGION_TYPES`). They are not a mutable map.
- The only scheduler is `candidates() → decide() → claim() → execute()`. Hunger and exhaustion already interrupt through the existing rules. Children are not productive workers.
- VAL4 verifies only `FORAGE`, `WOODCUT`, `MINE`, `BUILD`. `EXPLORE` is outside that gate. VAL5 learns only those same four kinds and does not score or replan. An adventure result is not `VERIFIED` just because VAL4 or VAL5 exists.
- `scripts/pin-assets.mjs` on this base hashes `src/*.mjs` only. It does not hash `src/**/*.mjs`.

## Donor, not production

`src/khet/` on PR #123 is a prototype. Later gates may copy pure data or pure functions only:

- one stat formula
- one damage formula
- monster and zone rosters
- ranger, guardian, and ritual as specialization ideas

Production must not import or keep:

- a Khet character that is not `state.agents[]`
- `khet-sila-v1` or any second gameplay save
- a Khet HP, XP, job, shard, or gear ledger
- a second profession writer
- a panel that calls `createCharacter`

The donor combat check `monster.stage === zone.stage` is not the production rule. It is recorded here so it is not copied.

## Qualification evidence

Constants, both explicit:

- `ADVENTURER_QUALIFICATION = 3` accepted completions before a profession change is even eligible
- history cap `8`, the existing career-tail cap

Store them on the agent, inside the world save, never in `khet-sila-v1` or `localStorage`:

```text
adventurerQualification = {
  version: 1,
  accepted: 0..3,
  recent: [{ id, tick, x, y }]  // length 0..8, oldest dropped
}
```

`id` is `String(task.started) + ':' + x + ':' + y`. Dedup is against every retained id, not only the newest tick and cell. A missing `task.started` does not count. Replaying the same completion does not increment `accepted`.

`accepted` increments by one only for a counted completion until it reaches 3, then stays at 3 forever. It is not skill XP, not spendable, and not a level. `recent` continues to record later distinct accepted completion evidence as a bounded audit tail of at most 8 rows; the oldest retained row drops first and dropping it never decrements `accepted`.

A completion counts only when the executor, not the UI, already did all of these:

- the agent is alive and `canPerformProductiveWork` is true at that tick
- `task.kind` is `EXPLORE`
- `task.path` is empty because `execute()` walked it
- the existing work threshold was met
- `finishPersonalExploration` ran for that task
- `tick`, `x`, and `y` are the agent's own integers
- `task.started` is an integer `>= 0`
- the identity `task.started + ':' + x + ':' + y` is not already in `recent`

These do not count and do not change profession:

- selecting `EXPLORE`, or only starting to walk
- interrupt, death, or a cleared task before finish
- a child, or an agent who is not productive
- a task that carried `knowledgeKey` whose retained verification is not `CONFIRMED` (`UNKNOWN` is not a count)
- a missing tick or coordinates
- any write from a button or panel

A roam with no `knowledgeKey` can count, because the executor finish is the retained fact. Do not invent a knowledge requirement that would make every roam `UNKNOWN`.

At `accepted === 3` the Clone is eligible. Eligibility is not itself the profession write. The write still waits on ADV0B.

## What a later ADV0 patch may change

Only these, and only from the `main` named above, and only together with ADV0B when the patch touches `adoptProfession`:

- Add the qualification object above. No other ledger.
- Add `adventurer` to `KINGDOM_PROFESSIONS` with label `นักผจญภัย` only in the same patch that obeys ADV0B.
- Call the existing `adoptProfession` once, from the completion path, when `accepted` reaches 3, using only the ADV0B object `{qualifiedProfession:'adventurer', qualification:'explore-3'}`. Not on selection, not on the first or second count.
- Keep `professionForAction("EXPLORE")` null.
- Refuse the call when the agent is dead or not productive.
- Record the career fact with the existing tail and the existing career event.

Governor stays an office. It is not this profession.

No combat, เขตศิลา region, loot, specialization, or `EXPLORE` skill XP in this gate.

## Still forbidden in ADV0

- Do not merge PR #123.
- Do not add `EXPLORE` to `SKILLS`, `ALL_SKILLS`, birth maps, or `recordEarnedSkill` inputs. A parallel `adventureXP`, `khetXP`, or `jobXP` is forbidden. Skill XP for exploration is a later contract.
- Do not add a zone, POI, teleport, encounter, combat function, loot grant, or knowledge unlock.
- Do not write `agent.hp` from adventure code. Damage, down, and rest-after-combat are a later contract and must use this same `agent.hp`.
- Do not add Ranger, Guardian, or Ritual as professions. Specialization is a later derived field on an Adventurer, with its own contract.
- Do not add a scheduler, scorer, or executor. Do not retune survival, household, or governor priority in this gate.
- Do not let a UI button create an adventurer, push qualification facts, or write world state.
- Do not edit VAL4 or VAL5 files, Governor files, or `src/engine.mjs` beyond the one completion call site named above. If that call site cannot be reached without a wider engine edit, stop and report VIOL. Do not widen the gate inside the patch.
- Do not load `src/khet/` from `index.html`. Nested modules stay unpinned until a contract that ships them also extends `pin-assets.mjs` and `tests/cache-pins.test.mjs` to the nested graph.
- No LLM decides the outcome. UNKNOWN is not success and grants nothing.

## Later gates this file does not approve

1. `EXPLORE` as a skill under `agent.skills` and `recordEarnedSkill`, with the existing inheritance rule.
2. A derived เขตศิลา region the Clone can reach only by the existing path. No teleport. Arrival is the Clone's own `x,y`.
3. Combat on the Clone snapshot. `startFight` must require `zone.roster.includes(monster.id)` and `canEnter`. A monster outside the roster throws `monster_outside_zone`. A failed level gate throws inside combat authority, not only in a shadow or a button. Outcome HP writes `agent.hp` only.
4. Specialization evidence for ranger, guardian, or ritual, without a new profession writer.
5. Scorer changes so survival emergency and household critical need outrank adventure, using the existing candidate list. Low `agent.hp`, critical hunger, low energy, a child, or `no-path` must not start an expedition. Thresholds must be the existing rules, not new numbers, unless that later contract names them.
6. VAL outcome evidence for the expedition. VAL4 must not be relabeled to cover it. No XP, knowledge, or loot from `OUTCOME_UNKNOWN`.
7. Loot through the existing item or resource account, one atomic write, no second bag. Knowledge only for the Clone who reached the cell, then the existing share path. No global unlock.
8. Chronicle lines only for events the executor already committed: left, arrived, met, won, lost, returned. No invented motive or dialogue.
9. Inspector read model and a non-authoritative region button. Browser proof of the full walk is a separate gate. Until that proof exists the full flow is UNKNOWN.

## Acceptance of the future ADV0 patch

1. One finished `EXPLORE` stores one fact and leaves profession unchanged.
2. The third accepted fact is the first tick at which profession may become `adventurer`, and only through `adoptProfession` under ADV0B.
3. A failed task, an interrupted walk, and an `UNKNOWN` knowledge result add nothing.
4. A child or a dead agent adds nothing and does not become `adventurer`.
5. Save and load restore the same `accepted`, the same `recent` rows, and the same profession.
6. One `FORAGE`, `WOODCUT`, `MINE`, or `BUILD` does not remove `adventurer`. That assertion is owned by ADV0B. If the patch cannot meet it without a second writer, the patch is VIOL and must stop.
7. `agent.career` still drops to at most 8. `recent` never exceeds 8. `accepted` never exceeds 3.
8. After `createAgent` initialization and `ensureProfession` repair, a runtime profession change goes through `adoptProfession` only. `professionForAction("EXPLORE")` stays null.
9. `SKILLS`, skill provenance, `agent.hp`, regions, resources, knowledge, households, and VAL4/VAL5 outputs are unchanged.
10. `src/engine.mjs` on `main` still does not import `src/khet/` or `khet-panel`. No skill-XP test is edited to hide a new ledger.

## Not SAT

- Qualification behavior and the profession write are implemented only as PR #130 candidate code. The pre-repair head `b04fb2c251f6e358e7f11834f024dbbf3ae594b5` passed Verify run #1376; any newer repair head remains UNKNOWN until its own exact-head Verify result exists.
- Browser and the public site do not show this flow. The live site is `main`, which has no ศิลา button and no Adventurer profession.
- PR #123's unit success is not this gate.
- Verify SUCCESS on `b04fb2c251f6e358e7f11834f024dbbf3ae594b5` covered the pre-bounded-history-repair candidate only.
- The full walk from home through เขตศิลา and back is UNKNOWN until the later gates exist and have their own proof.
