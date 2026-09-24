# V0.3.4 — Generation Continuity

## Success Contract / Definition of Done

Keep the existing engine and save schema. Finish the proof-first candidate from `20eda5bb3b1611c103cdb43a3e92f8ee170763d3`; do not weaken a failing gate just to publish.

A fresh world must run 120 simulated years on each of seeds 230926, 1, 42, 2026 and 90001 without any manual CLONE, resource injection, age resets, extra housing or resurrection. All initial six must die naturally, later autonomous births must occur, and at least one living post-death descendant must grow into a productive worker. The living population must still contain an ADULT and a generation of at least 3. No starvation deaths are permitted in these baseline scenarios.

Identity, appearance, parent links and generation remain permanent. Every observed autonomous newborn must inherit exactly floor(parent XP × 0.35) and start age zero without completed work. Death clears tasks/movement and all reservations remain derived from tasks. Validate population, inventory, lineage and dead-owner reservations at each year boundary. Compare checkpoint continuation after years 20, 60 and 90; the middle comparison also checks single ticks against a batched year. These are sampled invariants, not a claim that every intermediate tick has a complete structural validation.

## Birth pacing change

The global minimum interval between autonomous births is now **4 simulated years**, not the former 1. The same-parent cooldown remains **4 years**. Birth is still evaluated once per simulated year; the interval and resource gates can delay it further. This spreads age cohorts instead of filling all housing with same-aged children immediately.

Costs remain Food 8 + Wood 4. Reserved meals are not spendable. After birth, free food must meet the next-population target and wood must remain at least 12. The soft food target includes the birth reserve. Housing, population cap 36 and historical agent cap 200 still apply. Pacing is derived from existing lineage/bornTick data, not an extra mutable lock registry.

## Presentation and asset contract

Engine, UI, boot and asset pins must agree on 0.3.4. Every transitive local ES-module import is pinned, including lifecycle and reproduction helpers. Boot rejects either engine or UI version mismatch without touching saves. The birth panel reads the interval/cooldown directly from BIRTH_RULES. Manual Clone explicitly creates an age-18 adult; autonomous birth creates an age-zero child. No statement that automatic births are absent may remain in that preview.

## Save contract

Save schema remains 0.2.0 and storage key remains `simclone:world:v1`. The existing 0.1.0 migration is unchanged. No lifecycle field, clock or age is reset by the release. A fixture produced by the actual V0.3.3 engine at commit `d88c1d3ba8ddf3cc61b187086954732fd8935fa0` must restore byte-for-byte and continue identically under single/batched stepping; its source blobs and save hash are retained beside it.

An existing world can already have only elders or synchronized age cohorts. Loading V0.3.4 does not invent younger adults, undo deaths, or retroactively spread prior births. The fresh-world continuity proof is not proof that every old colony can recover.

## Verification and release

Run `npm test`, `npm run test:survival`, `npm run test:lifecycle`, `npm run test:death`, `npm run test:continuity`, and the three offline Chromium suites. The preparation report records real outputs and source SHA-256 hashes; final candidate and exact main Pages workflows must independently succeed. Pages now also gates upload/deployment on all three browser suites.

The survival-only 100-day regression deliberately caps age below death threshold; it measures survival mechanics, not continuity. The separate 120-year continuity proof must NEVER use that cap.

## Boundaries

This is a limited multi-generation lifecycle proof, not V1.0. There is no mentor teaching, cultural archive, social relationship system, faction or full replay. History holds at most 200 agents; new births stop at that cap, so unlimited continuation is not claimed. Native browser storage and physical Android performance remain UNKNOWN; offline tests use a Storage double. See `NEXT_STEPS.md` for the next gates.
