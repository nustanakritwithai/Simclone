# IC3 — Candidate work state

Branch: `feature/independent-clone-world-ic2-main` / PR #88.
Base being repaired: PR88 head `9246f38e6f2e202caeb0de8c4b2ed9353577b612`; main `3139e979b4446fd3f9873bb8b6fbbfae5ee6248d`.
Status: implementation complete for the bounded independent-start slice; local evidence recorded; exact candidate CI and deployment pending.
Canonical rules: [IC3 contract](IC3_INDEPENDENT_START_SUCCESS_CONTRACT.md).

## Changes

- Fixed old global-Hammer assertions without weakening ownership or replay checks.
- Personal materials/charcoal in the existing Rust ledger; no spendable global stock.
- Independent default home planner, owned stations/tools, stable reachable personal site intention, actual BUILD placement.
- Personal REST/EAT, evidenced guardian support, birth without global house slots, separated adult cloning.
- No-Camp fresh world, separated viable initial lives and budget-preserving private starting balances.
- Explicit 0.6.0 independent save schema; legacy 0.5.0 worlds preserved.
- Optional house-hosted archive with private cost and existing knowledge provenance.
- Personal world/inspector/home/station surfaces, direct resource/drop/event interaction and responsive layout.
- Existing offline compatibility fixtures explicitly exercise legacy mode; independent smoke exercises the new public profile.
- Existing CI gates retained; independent continuity/offline/native smoke steps added.

## Local evidence

- Unit/asset/regression suite: 404/404 passed, no skipped tests.
- New independent simulation tests: 23, including five-seed 2,400-tick construction and solo Original.
- Independent Chromium smoke: current machine-readable results and screenshots under `evidence-ui/independent/`; offline DOM with explicit Storage double. Native HTTP was blocked by environment policy and remains UNKNOWN locally.
- Untouched seed230926, 120 years: 20 living, generation6, 32 complete homes, 26 descendant homes. All initial six founders housed by year3. Original died of age84 at tick23760. Save/load and 600-tick single/batch continuation matched.
- Full legacy observation-browser gate remains required on the exact candidate. Do not infer its completion from independent UI results.

## Current candidate repair

PR #88 run #36202368404 passed the IC2/IC3 unit and offline independent browser scopes, but the native HTTP/storage smoke timed out while restoring the earned six-home fixture. Runtime audit identified a test-harness defect: the test wrote the fixture to localStorage and then reloaded, while the game correctly saves the current world on `pagehide`, overwriting that fixture before reload. The native harness now stages the fixture in sessionStorage and injects it into localStorage at document init before app modules execute. This preserves the real pagehide autosave contract rather than disabling it.

## Remaining release gate

Run exact candidate CI on the repaired native harness. Do not wait/poll in chat. Do not merge/release a queued/running/failed candidate. After exact candidate success, merge and hand off the exact-main Pages run in the same way.

Deferred: automatic inheritance/transfer of dead owners' raw materials; relationship-driven households/cooperation/trade/neighborhoods; unlimited terrain/history; physical Android and GPU performance.
