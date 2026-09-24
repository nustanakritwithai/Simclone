# Historical Identity / Limits — V0.3.5 Phase 2, implementation 0.3.6

Status: implementation candidate. Local evidence is not exact-candidate CI or a release.

## Baseline measured before design

Frozen engine 0.3.5 at `f2edda01af049ca8090f651d84376c29a8f32490` stores every person in `agents` and blocks creation at 200. The original 1200-year probe did NOT reach this limit (162–167 retained people): UNKNOWN, not a pass. Extending the untouched worlds reached 200 at years 1448 / 1456 / 1444 / 1459 / 1480 for seeds 230926 / 1 / 42 / 2026 / 90001. Only 10–11 people were alive; no births occurred in the following 20 years. See `verification/history-baseline-0.3.5.json`.

At the boundary old saves occupied 394716–397709 UTF-8 bytes. Removing only temporary decision traces from dead records was measured as a size-only projection before implementation, not a gameplay proof. The implemented buffered archive subsequently measured 269828–271833 bytes at the same boundary (about 31–32% smaller). Runtime figures have different horizons/verification overhead and must not be used as a speedup comparison. Node clone-heap estimates are noisy; V8 serialization is not live memory, and neither is Android memory.

## Storage decision and limits

`src/history.mjs` owns pure data access/admission/compaction helpers. No duplicate mutable identity/lineage/lock registry is added.

- `agents`: living agents plus a bounded buffer of recent dead. Compaction occurs before an admitted birth/clone when this array has at least 64 records. All living agents remain in their original order; only dead people move. Fresh tested worlds never exceed 64 hot records. Old saves with up to 200 hot records are accepted unchanged until this transition.
- `archive`: dead identity records, sorted by ID. Preserve name, parent/generation, permanent appearance, bornTick/life, death history, XP/source/preference/workDone, retained memory and last recorded needs/location. Only the transient decision-score trace is replaced with an empty array; `archived:true` marks this explicit projection. This is NOT a cultural archive or replay.
- `allPeople()` and `findPerson()` resolve identities across both arrays. Reproduction queries historical autonomous children across both, so cooldown/parent ordering cannot change just because a child was archived.
- Living gameplay capacity remains min(housing, 36). Retained capacity is 1024 total identities; archive JSON budget is 1000000 JavaScript string code units. Whole-save serialize/restore budget is 2000000 code units. These are not UTF-8 bytes or a promise about browser quota.
- Count or archive-capacity rejection blocks creation before spending or compaction. No ancestor is dropped to make room. Worlds can eventually stop reproducing at these explicit limits; unlimited continuation is not claimed.
- Whole-save oversize/quota/serialization failures are not successful saves. The storage adapter preserves previously saved bytes. File import uses a conservative UTF-8 byte precheck of three times the character budget, then authoritative restore validates the actual string budget.

Arrays were chosen over a second persistent index to minimize migration and stale-cache risks. With at most 1024 identities, linear historical lookup is bounded. This does not claim constant-cost reproduction at arbitrary population/history sizes. Moving every dead agent immediately was rejected for this slice: the buffered transition preserves old short-run structural expectations and reduces routine array churn.

## Explicit migration

Engine/UI 0.3.6 use a new cache-pinned runtime graph. Save schema is **0.3.0**, archiveVersion **0.1.0**, historyVersion **0.1.0**, storage key unchanged (`simclone:world:v1`). Old engines reject the new save version instead of silently ignoring archives.

Restore accepts old 0.1.0 and 0.2.0 via explicit migration. 0.2.0 lifecycle anchors, identities, resources and lineage are not rewritten. 0.1.0 retains the documented age-18 adoption at load; this is not evidence of historical death age. Legacy dead agents with hp=0 have stale execution-only task/moveTick cleared explicitly (old 0.1.0 could retain movement on starvation). Identity and death evidence are not changed. The existing evidence-based death migration remains; unknown facts stay unknown. Old-schema data unexpectedly containing archives is rejected rather than silently dropping it. Current-schema saves missing archive/version metadata are corrupt, not silently repaired.

## Success contract

A valid 201st birth or clone succeeds with ancestry intact. Preview and all rejected commands remain read-only. New identity inherits real parent XP once and pays only once. Archived children still constrain pacing; archived parents are resolvable after save/load. Dead records never run, hold reservations, drift in death age, or become living again. Duplicate IDs, live archive records, runtime work in archives, missing/dangling/cyclic lineage and malformed version metadata are rejected. Existing survival, birth, death and 120-year continuity criteria are not weakened.

The roster searches all retained people and renders pages of 80. The inspector resolves archived parents, labels historical needs, disables cloning/following dead identities and explicitly discloses missing transient scores rather than inventing them.

## Verification and scope

`npm test` includes synthetic 200/1024/budget boundaries and UTF-8/oversize safety. `npm run test:continuity` retains the old 120-year proof AND runs five untouched 1800-year worlds. The latter reports population minima, extinction, deaths/starvation, lineage, stable historical facts, save size and runtime; seven save continuations and two single/batch comparisons per seed. Structural invariants are checked yearly, not every tick. Reaching 1024 is tested synthetically, not claimed as a fresh-world long-run proof.

`python tests/navigation-smoke.py` retains the original offline checks, then separately runs archive observation and real HTTP/native-storage checks. Local native HTTP was blocked by administrator policy: UNKNOWN locally. The native test uses an authorized loopback origin, actual localStorage, on-disk Chromium profile and process restart; it must pass in CI before that environment is claimed. Neither emulated mobile viewport nor CI is physical Android or public Pages browser proof.

Remaining gates: imported-age cohort behavior, platform/device performance, capacity-exhaustion UX and future history export strategies. Knowledge transfer/mentoring, skill provenance and full replay are not implemented here. Release still requires exact candidate and exact main Pages verification with no force updates.
