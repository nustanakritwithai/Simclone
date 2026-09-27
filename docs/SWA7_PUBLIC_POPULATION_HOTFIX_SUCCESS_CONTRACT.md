# SWA7 Public Population Hotfix

Date: 2026-09-28
Base: c4a52ac77a50edfb61256b6476abec534cdee2f5
Status: candidate; release validation UNKNOWN

## Failure

Pages #104 / run 36356842131 failed at the public Same-World lifecycle step.
The public smoke still expected 12 physical entities after PR #163 released
24 physical entities with 12 distinct monsterIds.

## Success contract

Read the actual public `simclone.snapshot()` without rebuilding or repairing it.
Use `src/adventure-world-monsters.mjs` and `src/adventure-annex.mjs` as the existing
world authorities. Independently pin the approved population contract:

- 4 zones, 3 existing types per zone, 2 copies per type.
- 6 physical instances per zone, 24 total, 12 distinct monsterIds.
- Canonical validation must reject invalid IDs, slots, positions and rosters.
- Each same-type pair keeps its level and rank.
- Check population before Hunt and after deterministic respawn.
- Retain tap -> real-path Hunt -> READY -> world-bound Combat -> verified Victory
  -> defeated hit-target removal -> Continue -> new respawn incarnation.
- Write before/after population evidence into the existing results.json.
- Failed, absent or malformed evidence is not PASS.

## Scope

Only:
- tests/public-swa7-smoke.py
- scripts/swa7-population-proof.mjs
- tests/swa7-population-proof.test.mjs
- this document

No production, workflow, fixture, import-map, donor-branch, spawn, AI, HP, XP,
inventory or equipment changes. Rust Crafting V2 remains blocked on public release.

## Local evidence

Source artifact: github-pages 10943843014 from the exact base SHA.
Archive SHA-256: 63c67d9f592740ba9c48fc0730eea35269de7bab1ce07cbcb260932aab24fee9.

- New proof tests: 11/11 PASS.
- `node --test tests/swa7-population-proof.test.mjs tests/same-world-*.test.mjs`:
  56/56 PASS, 0 failed, 0 skipped.
- Python syntax compile: PASS.
- Full `npm test`: UNKNOWN; local execution exceeded the 120-second tool limit
  before a final result. Do not relabel partial output as a full pass.
- Local Chromium lifecycle: UNKNOWN; navigation was blocked by the execution
  environment with ERR_BLOCKED_BY_ADMINISTRATOR before game boot.

## Release gate

Draft only until exact-head Verify succeeds and candidate browser evidence is SAT.
Then re-read main/head, merge only the proven head, and require exact merged-main
Pages (including the complete public SWA7 lifecycle) to succeed.
A passing unit suite is not a public release. UNKNOWN is not PASS.
