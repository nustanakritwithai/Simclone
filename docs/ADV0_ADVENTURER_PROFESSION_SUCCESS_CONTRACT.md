# ADV0 — Adventurer profession

Status: CONTRACT FROZEN. RUNTIME NOT STARTED. MERGE NOT APPROVED.  
Base: `main@388ddaf32f81429edcb24ba6b6f62ef6135734c7` (VAL5 merge).  
Exact-main Pages for this SHA is UNKNOWN. The deploy is still running: [run 36302102186](https://github.com/nustanakritwithai/Simclone/actions/runs/36302102186). The previous Pages SAT is `bb7070b` / [run 36301249344](https://github.com/nustanakritwithai/Simclone/actions/runs/36301249344). UNKNOWN is not SAT.

This file is the source of truth for the direction change. It does not implement it. PR descriptions and the stale side-game branch are not authority.

## What was checked

- `main` is the VAL5 merge above. VAL4 is its parent line. `docs/STATUS.md` and `docs/NEXT_STEPS.md` on that tree still describe the Governor closeout. They are behind the merges. This contract follows the tree, not those two files.
- Draft [PR #123](https://github.com/nustanakritwithai/Simclone/pull/123) `feature/khet-sila-rules` @ `c8eaea7` is CONFLICTING with `main`. Its verify run succeeded for the side module. That is not permission to merge.
- VAL5 is merged. Its files are `docs/VAL5_OUTCOME_LEARNING_SHADOW_SUCCESS_CONTRACT.md`, `src/read-models/outcome-learning-shadow.mjs`, and `tests/outcome-learning-shadow.test.mjs`. Do not edit them in an Adventurer patch.
- Other open work that this gate must not touch: PR #102, #84, #74, #73.

No force push. No commit onto another agent's branch.

## Goal

One Clone in `state.agents` can become the profession `adventurer` (`นักผจญภัย`) only after that same Clone finishes a real `EXPLORE` task.

```text
existing EXPLORE candidate
→ existing path
→ existing execute step
→ task finished on the reached cell
→ adoptProfession
```

Opening a panel, creating a name, or selecting the task is not that evidence.

## Authority that already exists

- Professions are `KINGDOM_PROFESSIONS` in `src/kingdom-utility.mjs`. Today: forager, woodcutter, miner, builder. `professionForAction` maps only `FORAGE`, `WOODCUT`, `MINE`, `BUILD`.
- `decide()` calls `adoptProfession(agent, choice.kind, tick)` when a candidate is selected. `professionForAction("EXPLORE")` is null, so selecting `EXPLORE` does not change profession. That null must stay. Adoption on selection would violate this contract.
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

## This gate may change later

Only these, and only in a candidate that starts from the `main` named above:

- Add `adventurer` to `KINGDOM_PROFESSIONS` with label `นักผจญภัย`.
- Call the existing `adoptProfession` from the existing `EXPLORE` completion path, after the path is empty and the work threshold has been met.
- Pass a kind that maps to `adventurer` only at that completion call. `professionForAction("EXPLORE")` stays null so `decide()` still does not adopt on selection.
- Refuse that call when the agent is dead or `canPerformProductiveWork` is false.
- Record the career fact with the existing bounded `agent.career` tail and the existing career event. Do not invent a second chronicle.

Governor stays an office. It is not this profession.

## Still forbidden in ADV0

- Do not merge PR #123.
- Do not add `EXPLORE` to `SKILLS`, `ALL_SKILLS`, birth maps, or `recordEarnedSkill` inputs. A parallel `adventureXP`, `khetXP`, or `jobXP` is forbidden. Skill XP for exploration is a later contract.
- Do not add a zone, POI, teleport, encounter, combat function, loot grant, or knowledge unlock.
- Do not write `agent.hp` from adventure code. Damage, down, and rest-after-combat are a later contract and must use this same `agent.hp`.
- Do not add Ranger, Guardian, or Ritual as professions. Specialization is a later derived field on an Adventurer, with its own contract.
- Do not add a scheduler, scorer, or executor. Do not retune survival, household, or governor priority in this gate.
- Do not let a UI button create an adventurer or write world state. A region viewer, if any, is a later contract.
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

1. This file is the only new behavior authority. No runtime file changes ride along with the contract commit.
2. A productive adult Clone who finishes an `EXPLORE` task becomes `adventurer` through `adoptProfession`.
3. Selecting `EXPLORE`, opening UI, or failing the task does not change profession.
4. A child or a dead agent does not become `adventurer`.
5. `SKILLS`, skill provenance, `agent.hp`, regions, resources, knowledge, households, and VAL4/VAL5 outputs are unchanged.
6. `src/engine.mjs` on `main` still does not import `src/khet/` or `khet-panel`.
7. Save and load keep the same profession and career tail.
8. Tests prove those points. No skill-XP test is edited to hide a new ledger.

## Not SAT

- Browser, Pages, and the public site do not show this flow. The live site is `main`, which has no ศิลา button and no Adventurer profession.
- PR #123's unit success is not this gate.
- The full walk from home through เขตศิลา and back is UNKNOWN until the later gates exist and have their own proof.
