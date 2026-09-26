# Simclone — active agent guide

Read `GAME_PLAN.md`, `docs/STATUS.md`, `docs/NEXT_STEPS.md` and the exact current branch/PR before changing code. A plan is not proof of implementation.

## Active work

- Continue PR #88 / `feature/independent-clone-world-ic2-main`; do not open replacement PRs for ordinary repairs.
- Current rules: `docs/IC3_INDEPENDENT_START_SUCCESS_CONTRACT.md`. Work/evidence: `docs/IC3_WORK_STATE.md`.
- Independent saves use 0.6.0 plus explicit world-mode and personal-material versions. The legacy engine/import family remains 0.5.0. Never silently convert or discard an old world.
- New public bootstrap selects the independent profile. Legacy browser fixtures explicitly select legacy mode. Test both; never relabel a legacy fixture as independent gameplay proof.

## Authority and safety

- Engine simulation is deterministic: no DOM, Date/time, Math.random, per-tick LLM calls or external APIs.
- UI is observation plus validated `command` dispatch. Preview uses a copy and spends nothing. Do not rewrite the engine to fix UI.
- Rust commands/order acceptance commit materials once. Existing scheduler, task-derived reservations and PLACE_STATION remain the executors. No duplicate item, material, ownership or reproduction ledger.
- Skills retain exact floor(parent XP × 0.35) inheritance. Teaching/reading grants no XP; only real productive output records earned XP.
- Personal cognition consumes owned/observed evidence, never arbitrary hidden World Truth. Preserve bounded history, lineage, death facts, appearance and provenance through migration/archive.
- Independent balances live in the existing Rust material extension; shared stock is zero. World totals are read-only. Home ownership derives from the founding Foundation, not an extra UI record.
- Preserve corrupt-save recovery and explicit reset/import confirmation, mobile canvas/touch, inspector close controls and old saves.
- Re-read heads before writes. No force push, overwriting another agent branch or changing workflow gates to evade failures.

## Verification and CI handoff

- Define Success Contract, verification plan and SAT / VIOL / UNKNOWN. UNKNOWN is never PASS.
- Run unit/targeted browser checks; regenerate hashes with `node scripts/pin-assets.mjs` after runtime changes.
- After pushing, obtain the new Actions run URL once and send it immediately. **Do not poll, wait for completion, or create a CI watcher.** The user reports results or explicitly asks for a check before further diagnosis.
- Exact candidate checks, exact-main Pages deploy and public-release checks are separate gates. Local success or merge alone is not release proof.
- Offline Chromium uses an explicit Storage double; native HTTP/storage, public Pages, physical Android and GPU/performance are separate evidence scopes. Never bypass an administrator block or infer unavailable proof.

Historical contracts, provenance and earlier release guidance remain in `docs/AGENTS_LEGACY_REFERENCE.md`. They still apply to unchanged legacy systems; explicit independent-mode differences are owned by the current IC3 contract.
