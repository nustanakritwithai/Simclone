# Knowledge Continuity 1 — success contract

## Goal

Close the first useful learning loop: direct productive experience -> personal claim -> deliberate transfer/publication -> a different person's unverified claim -> local verification -> personal resource planning -> actual outcome. Written knowledge can persist after its author dies. Preserve the existing Survival/lifecycle/history baseline.

## Authority and invariants

Only the engine changes game state. No DOM, real-time clock, random API or per-tick external model calls enter simulation modules. Resource truth stays in the world; a person's planner receives only resource observations within Manhattan distance four plus owned beliefs. Navigation terrain and shared stock remain explicitly public. A remembered resource uses an investigation marker, not its unseen actual amount or existence.

A verification checks actor, ownership and range before reading one local cell. Multiple IDs can share that cell. CONFIRMED requires the claimed identity/type with positive amount; depleted is STALE; local absence/mismatch is REFUTED. Time can produce STALE after 720 ticks, never REFUTED. Dead historical beliefs do not age. Neither verification nor archive reading grants XP, stock or productive-work evidence. Re-observation preserves original provenance.

Existing inheritance remains floor(parent XP * 0.35). Productive XP continues to require a real output. New goal evidence records building/resource completion, not success merely because a plan or button exists.

## Commands

- `VERIFY_KNOWLEDGE {agentId,key}`: inspect one owned local claim; repeat in the same tick is idempotent.
- `SET_PLANNING_POLICY {policy:"local"|"legacy"}`: explicit switch, releases task-derived claims by clearing living tasks; never spends resources or deletes knowledge.
- `CREATE_ARCHIVE`: completed camp upgrade, wood 6 + stone 2 exactly once; insufficient materials reject atomically.
- `PUBLISH_KNOWLEDGE {agentId,key}`: within four camp cells, direct confirmed recent claim only; retain first discovery, current author and bounded revisions.
- `READ_ARCHIVE {agentId,key}`: within four camp cells, existing publication only; learn as UNVERIFIED with original author evidence, including a dead author.
- `SET_CULTURE_AUTOMATION {enabled:boolean}`: only after construction; a paused archive retains all records.

Automation attempts at most one successful publication/read every 120 ticks. It does not create the archive or mint resources. Re-reading the same revision does not continually refresh its age. Publication of unchanged values is idempotent. A full archive rejects new entries without deleting older ones.

## Persistence bounds

Base engine/UI/save family: `0.5.0`. Optional `planningPolicy` / person `planning.version`: `personal-knowledge-1`; optional `culture.version`: `cultural-archive-1`. Legacy saves have neither behavior enabled. New optional metadata is validated on restore; source persons resolve across living and retained dead identities.

Personal limits remain 4 beliefs / 8 evidence / 8 episodes. Planning retains 4 outcome lessons. Archive retains 16 publications with 3 prior revisions each and a 32,000-character budget. Existing total-save and ancestry limits still apply. Do not continue an extension-bearing world in an older engine that does not implement the extension.

## Regression discovered and repaired

The first five-seed local-policy proof had four successes and one failure: seed 230926 became extinct in year 115. Diagnosis: generic exploration's unbounded negative distance score lost to IDLE, leaving people stuck around insufficient familiar food while births stopped for lack of reserve. This was age/demographic collapse, not evidence of starvation.

Repair: only opt-in information-seeking uses base 8 and a soft distance penalty capped at eight path steps. Thus reaching new information can beat doing nothing. Actual movement still follows and pays the entire validated route, and urgent hunger/energy interrupts still apply. Legacy exploration and lifecycle/resource formulas were not relaxed. A focused regression asserts exploration outranks idle when basic needs are safe and productive tasks are unavailable.

## Verification plan

`npm test` contains focused ownership, range, revision, idempotency, migration, boundedness, co-location, build completion, corruption, source retention, no-free-XP and deterministic continuation checks. It includes **five 120-year worlds** with local planning and a paid archive: seeds 230926, 1, 42, 2026, 90001. No food, XP, age or population is injected during this proof. It checks annual validity, continuing population, actual age deaths, published knowledge outliving an author, real archive reading, and save/load single-step versus batch continuations.

The existing Survival, autonomous birth, age death, original 120-year and five-seed 1800-year history proofs remain separate mandatory gates. A new policy proof is not a replacement for them.

`tests/ui-smoke.py` retains its existing checks and adds `knowledge_ui.py`: real simulation-earned knowledge fixture, mobile command buttons, exact construction costs, opt-in persistence, publication/verification/reading and an explicit Storage double. Navigation/native tests retain their separate scope. A blocked native environment remains UNKNOWN, never an offline substitute for native proof.

## Loading contract

All runtime modules keep the source version family while `index.html` contains a source-hash import map. Every module URL maps to its current SHA-256 suffix; the entry URL is pinned too. Regenerate with `node scripts/pin-assets.mjs`. A deterministic test fails if any source hash and entry mapping disagree. The offline fixture recreates the same source graph once per module, with explicit data URLs instead of HTTP cache keys.

## Not claimed

No full private terrain map, arbitrary long-horizon planning, physical return-hauling, mentor skill grants, social/faction systems, currency, technological invention, external LLM execution, complete replay, unlimited history, physical-device test, or full Original-only V1.0 proof. The roadmap must keep these visible rather than treating this feature pack as the finished entire game.

A loaded-machine browser regression also exposed delayed save-failure presentation: the storage adapter had returned failure while the badge still awaited the periodic render. The browser app now refreshes navigation/save status synchronously after a save attempt. The quota-failure assertion remains intact; this is a UI feedback fix, not a relaxation of storage protection.
