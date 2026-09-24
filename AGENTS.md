# Simclone handoff

Read `GAME_PLAN.md` and `docs/STATUS.md` first. Plan entries are intentions, not proof that features exist.

- `src/engine.mjs`: authoritative simulation. No DOM, Date, Math.random or external API calls.
- `src/app.mjs`: fixed-step runner, rendering, input and UI. UI actions go through `command`; never put new game rules in a button handler.
- `src/game.css`: responsive skin. Preserve mobile canvas, touch controls and inspector close button.
- `index.html`: playable game. `plan.html`: preserved original development page.
- Run `npm test` before changing a deployment branch. New requirements need success contracts and deterministic regression tests.
- Current skill transfer copies 35% XP at manual cloning and autonomous birth, not mentor/archive/culture. The event list is not a replay system.
- Known verification limitations are in `docs/STATUS.md`; UNKNOWN is never PASS.
- Preserve seed, parent identity, save compatibility and permanent appearance. Save version changes require a migration or explicit rejection.
- Do not rewrite the engine just to change UI. Do not add LLM calls to every tick.
- GitHub Pages previously used `gh-pages`; keep source and deployment revisions aligned with non-forced updates, and confirm the actual Pages build separately.

## UI 0.1.1

- `src/ux.mjs` + `src/ux.css` implement the upgraded observation layer through an explicit bridge in `src/app.mjs`.
- Preview commands run on copies; confirm commands validate and mutate authoritative state. Do not deduct resources while selecting a build location.
- UI version 0.1.1 is independent of engine/save version 0.1.0. Never invalidate old saves for a stylesheet change.
- Current browser fixture: `python tests/browser-smoke.py` delegates to `tests/ui-smoke.py`. It is offline with a Storage test double; do not report it as live HTTP or native storage proof.
- Pages now deploys from `main` via `.github/workflows/pages.yml`. The earlier `gh-pages` note is historical; verify the workflow for the exact released commit.

## UI 0.1.2

- Startup entry is now `src/boot.mjs`; it loads `src/app.mjs` after stylesheet readiness and keeps a retry screen on failure.
- `src/navigation.mjs` measures real overlay bounds for the camera and draws a read-only minimap. No movement or resource commands belong here.
- `src/storage.mjs` preserves damaged/unreadable original saves. Do not release protection except after an explicit reset/import confirmation. Storage failure is not successful saving.
- Tests: `npm test`, `python tests/ui-smoke.py`, `python tests/navigation-smoke.py`. Browser fixtures share `tests/browser_fixture.py`; they are offline and use a Storage double.
- Details and limitations: `docs/UX_UI_0.1.2.md`. Pages now gates deployment on unit and local asset tests, not on physical-device or public-browser tests.

## Survival Core 0.2.0 (historical release)

- Read `docs/SURVIVAL_0.2.0.md`. Engine is now 0.2.0; earlier "engine unchanged" statements describe historical UI-only releases, not this one.
- `SAVE_VERSION=0.1.0` is independent of `VERSION=0.2.0`. Preserve the existing storage key. Old jobs are replanned on the next tick; do not erase the world.
- `src/survival.mjs` owns deterministic routing/claim helpers. Reservations are derived from active task contracts; never create a second mutable lock registry.
- Resource nodes: one worker. Buildings: two workers. Meals: one claimant per available unit. Reserved meals are not spendable by CLONE.
- Stock targets account for already-assigned output. On-site eating deducts one harvested item. Zero-output work earns no XP.
- Run `npm test`, `npm run test:survival`, `python tests/ui-smoke.py`, `python tests/navigation-smoke.py`, `python tests/survival-smoke.py`. No long-run survival fixture implies autonomous births or the complete V1.0 proof.


## Age Death 0.3.3 (historical release)

- Read `docs/LIFECYCLE_0.3.0.md` before changing age, stage, birth or death behavior.
- Engine `VERSION=0.3.3`; save schema `SAVE_VERSION=0.2.0`; `restore()` explicitly migrates legacy 0.1.0 saves.
- Lifecycle is simulation-time only: 360 ticks = 1 biological year. No Date/time or Math.random belongs in lifecycle rules.
- Stage boundaries are CHILD 0–15, ADULT 16–54, ELDER 55+, with DEAD overriding age.
- Existing worlds and manual CLONE start lifecycle at age 18. Manual CLONE is an Influence action; it is not autonomous birth.
- CHILD cannot take productive resource/build jobs; ADULT work rate is 1.0; ELDER productive work rate is 0.75. Stage-ineligible saved tasks must replan through task validation.
- Autonomous birth is separate from manual CLONE: max one/year, parent cooldown four years, Food 8 + Wood 4, next-population food reserve and Wood 12 safety floor.
- Birth pacing/cooldown are derived from lineage + bornTick; do not add a second mutable reproduction registry.
- Autonomous children start age 0 and inherit 35% Skill XP. Manual CLONE remains age 18.
- Lifespan is derived deterministically at 78–92 years from seed + identity/generation; do not persist a duplicate lifespan field.
- Starvation and age death share cleanup: alive=false, hp=0, task=null, moveTick=0; reservations remain task-derived.
- Candidate evidence: 81/81 unit/asset, 18/18 Survival, 5/5 autonomous-birth, 5/5 age-death seeds and 89 offline Chromium assertions passed on `8dbbb2c16c4dba6920036028ec002419cefc51ee`.
- V0.3.4 continuity is still unproven; surviving agents after 90 years is not enough.
- Candidate branches are verified by `.github/workflows/verify.yml`; Pages deployment remains gated on exact `main` workflow success.


## Generation Continuity 0.3.4 (historical release)

- Read docs/LIFECYCLE_0.3.4.md and docs/NEXT_STEPS.md first.
- Engine/UI are 0.3.4. Save schema stays 0.2.0; storage key stays simclone:world:v1. Never reset ages on load.
- Global autonomous birth gap is FOUR simulated years; parent cooldown is also four. One/year was the older policy. UI reads BIRTH_RULES, not duplicate literals.
- Run npm test, npm run test:survival, npm run test:lifecycle, npm run test:death, npm run test:continuity and all three Python UI suites before release.
- The continuity proof runs unmodified fresh worlds for 120 years with real aging/death, no manual CLONE, and save/load plus single/batch continuation checks. The survival-only fixture still caps biological age; never call it continuity proof.
- Final evidence is tied to source SHA-256 manifest. Verify exact candidate and Pages commits separately. UNKNOWN is not PASS.
- Existing saves preserve their demographic structure; previously collapsed colonies are not silently repopulated. Historical agent cap 200 still prevents unlimited continuation.
- No mentor/archive, social relationship or V1.0 proof is claimed.


## Death History 0.3.5 (historical release)

- Read `docs/LIFECYCLE_0.3.5.md` and `docs/NEXT_STEPS.md` before changing lifecycle persistence.
- Engine/UI are 0.3.5. World save schema remains 0.2.0; historical-lifecycle sub-schema is `historyVersion=0.1.0`; storage key remains `simclone:world:v1`.
- New deaths persist immutable tick, cause and age-at-death. `ageYears()` for a dead agent must use recorded death age or UNKNOWN; never advance with the world clock and never substitute deterministic lifespan.
- Old 0.2.0 saves may recover death facts only from retained event/memory + existing lifecycle evidence. Legacy 0.1.0 deaths must not derive historical age from the load-time age-18 migration anchor.
- Missing evidence is `legacy-unknown`, not a guessed age/cause/tick. Corrupt/unreadable save protection remains unchanged.
- This slice does not remove the 200 retained-agent cap or prove native HTTP storage/physical Android. Historical identity limits and bounded performance remain the next V0.3.5 gate.
- Release requires npm test, all four proof scripts, and all three offline Chromium suites on the exact candidate SHA. UNKNOWN is not PASS.


## Historical Identity 0.3.6 (current candidate)

- Read docs/STATUS.md, docs/NEXT_STEPS.md and docs/HISTORY_LIMITS_0.3.5.md first. This is Phase 2 of that hardening plan, versioned 0.3.6 for unambiguous module cache pins.
- Save schema 0.3.0; explicit migrations from 0.1.0/0.2.0; archiveVersion/historyVersion both 0.1.0. Never let old schema silently carry an ignored archive.
- `src/history.mjs` owns retainedCount/allPeople/findPerson and atomic retention admission/compaction. Use the cross-array resolver for historical identity; all living workers stay in agents. Keep the living order and task-derived reservations.
- Retain lineage/bornTick/life/death/skills/source/memory; only archived transient decision traces are omitted and the UI discloses this. Reproduction must see archived autonomous children. Do not re-anchor their life data.
- Keep living cap 36, hot buffer 64, retained cap 1024 and documented character budgets distinct. Failure stops creation without spending or deleting ancestors; unlimited history is not claimed.
- `npm run test:continuity` runs both the original 120-year and the new five-seed 1800-year proofs. Synthetic capacity tests are separate from those untouched seeded worlds.
- Navigation smoke retains offline tests and then separately runs archive UI and native HTTP/storage/process-restart tests. Local HTTP policy blocks native testing; report UNKNOWN locally, inspect exact CI for CI-only evidence. No administrator-policy bypass and no physical Android inference.
- Publish only after exact candidate verification; recheck main, non-force update, verify exact main Pages test/upload/deploy. Do not edit workflows to evade a failing gate.
