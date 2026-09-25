# Simclone handoff

Read `GAME_PLAN.md` and `docs/STATUS.md` first. Plan entries are intentions, not proof that features exist.

- `src/engine.mjs`: authoritative simulation. No DOM, Date, Math.random or external API calls.
- `src/app.mjs`: fixed-step runner, rendering, input and UI. UI actions go through `command`; never put new game rules in a button handler.
- `src/game.css`: responsive skin. Preserve mobile canvas, touch controls and inspector close button.
- `index.html`: playable game. `plan.html`: preserved original development page.
- Run `npm test` before changing a deployment branch. New requirements need success contracts and deterministic regression tests.
- Current skill inheritance copies 35% XP at manual cloning and autonomous birth. Mentorship/archive teaching transfers knowledge only and never grants Skill XP. The event list is not a replay system.
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


## Historical Identity 0.3.6 (historical release)

- Read docs/STATUS.md, docs/NEXT_STEPS.md and docs/HISTORY_LIMITS_0.3.5.md first. This is Phase 2 of that hardening plan, versioned 0.3.6 for unambiguous module cache pins.
- Save schema 0.3.0; explicit migrations from 0.1.0/0.2.0; archiveVersion/historyVersion both 0.1.0. Never let old schema silently carry an ignored archive.
- `src/history.mjs` owns retainedCount/allPeople/findPerson and atomic retention admission/compaction. Use the cross-array resolver for historical identity; all living workers stay in agents. Keep the living order and task-derived reservations.
- Retain lineage/bornTick/life/death/skills/source/memory; only archived transient decision traces are omitted and the UI discloses this. Reproduction must see archived autonomous children. Do not re-anchor their life data.
- Keep living cap 36, hot buffer 64, retained cap 1024 and documented character budgets distinct. Failure stops creation without spending or deleting ancestors; unlimited history is not claimed.
- `npm run test:continuity` runs both the original 120-year and the new five-seed 1800-year proofs. Synthetic capacity tests are separate from those untouched seeded worlds.
- Navigation smoke retains offline tests and then separately runs archive UI and native HTTP/storage/process-restart tests. Local HTTP policy blocks native testing; report UNKNOWN locally, inspect exact CI for CI-only evidence. No administrator-policy bypass and no physical Android inference.
- Publish only after exact candidate verification; recheck main, non-force update, verify exact main Pages test/upload/deploy. Do not edit workflows to evade a failing gate.


## Skill Provenance 0.4.0 (historical release)

- Read `docs/SKILL_PROVENANCE_0.4.0.md` and `docs/STATUS.md` before changing skills or persistence.
- Keep only FORAGE/WOODCUT/MINE/BUILD in this release. Existing XP/balance formulas remain authoritative.
- Every current skill XP total must equal initial + inherited + earned + legacy-unattributed XP.
- Inheritance remains exactly floor(parent XP × 0.35) and is not teaching. Record source parent + birth tick; never infer old inheritance from a parent's current XP.
- Work provenance is written only after the existing engine produces a real output. Zero output means zero XP and zero evidence.
- Evidence is bounded: preserve structural origin and latest work evidence while cumulative counters remain exact. Do not add unbounded per-action history to archived identities.
- Migration from save 0.3.0 marks existing XP legacy-unattributed. Missing provenance in a current 0.4.0 save is corruption, not silently repaired.
- Next knowledge work may borrow AstraLife's Observation/Memory/Belief contracts, but cognition may consume only Observation + owned memory/belief + delivered messages. No per-tick LLM calls and no hidden World Truth shortcut.


## Knowledge + Memory 0.5.0 (historical foundation)

- Read `docs/KNOWLEDGE_MEMORY_0.5.0.md`, `docs/STATUS.md` and `docs/NEXT_STEPS.md` before changing cognition/knowledge persistence.
- World truth remains authoritative. A person's cognition may contain only direct experienced evidence, owned knowledge/memory and explicitly delivered claims. Do not expose arbitrary `state.nodes` as personal knowledge.
- Productive FORAGE/WOODCUT/MINE output records a CONFIRMED resource claim only after non-zero output. Zero-output work writes neither XP nor knowledge.
- `SHARE_KNOWLEDGE` is an engine command. It transfers one selected confirmed claim, validates communication range and writes recipient provenance. Relayed claims start UNVERIFIED.
- Knowledge collections are bounded per retained person (4 beliefs, 8 evidence, 8 episodes). Do not add unbounded per-tick cognition logs to historical identities.
- Save 0.4.0 migration creates empty knowledge. Never reverse-engineer historical knowledge from current skill XP, position, old memory text or global world truth.
- Archive compaction must preserve `knowledgeState`; sourceAgentId must resolve through retained identity after the discoverer dies.
- AstraLife is a donor for boundary/evidence contracts only in this slice. Do not import provider/LLM calls, trust scoring, faction or autonomous free-form messaging yet.
- Release still requires exact candidate and exact main verification. UNKNOWN is not PASS.


## Knowledge Continuity 1

- Read `docs/KNOWLEDGE_CONTINUITY_1.md`, current STATUS and NEXT_STEPS first. The whole master game is not complete.
- Base engine/UI/save stay 0.5.0; optional personal planning and cultural archive have explicit extension versions. Legacy resource planning is preserved unless explicitly switched.
- `knowledge-revision.mjs` checks ownership/range before a local observation. Empty/time-old is STALE, not dishonesty; only actual local mismatch/absence refutes. Preserve original discovery/sender across later work.
- `personal-planning.mjs` never exposes remote resource amount/existence to a person's candidates. Memory produces visit-and-verify targets. Shared path terrain/stock remain public; full private terrain memory is unimplemented.
- Exploration must be able to beat idle. Keep the seed-230926 year-115 extinction regression and the five-seed 120-year policy proof. Never change birth/resource rules just to make that gate green.
- `cultural-archive.mjs` is a paid camp upgrade. Keep 16 entries, three historical revisions each, 32k character budget, range four and one successful auto operation per 120 ticks. Reading is unverified and grants no XP. No silent archive creation in old saves.
- Original survival/birth/death/120-year/1800-year gates remain mandatory. New personal-policy proof is a different scope.
- Run `node scripts/pin-assets.mjs` after any runtime module change. Content-hash import maps avoid mixed cached versions without rewriting old save versions.
- Browser fixtures use a deduplicated import-map/data-URL graph with an explicit Storage double. Keep all old UI assertions; `knowledge_ui.py` adds controls on a real earned-knowledge fixture. Never label offline tests as native HTTP, public Pages, or physical Android.
- K5 labor scoring is already authoritative. Other Kingdom economic projections and the ecology Formula Lab are not automatically active. Rust crafting is still a separate pending stack.


## Rust Survival RS1–RS4 integrated candidate

- Read `docs/RUST_SURVIVAL_RS1_RS4_INTEGRATED.md` before changing crafting, possessions or stations.
- `src/rust-runtime.mjs` is the engine bridge; UI must use engine commands, never mutate Rust ledgers directly.
- Material input is committed once at order acceptance. Do not also deduct it at completion and do not create a second reservation registry.
- Accepted orders survive hunger/energy task interruption. Death cancels unfinished work and drops finished bag items without duplicating committed input.
- Crafting Table and Furnace are physical stations. Hammer requires the table. Only Wood 2 -> Charcoal 1 has furnace authority; meat/water remain blocked.
- Stone Axe and Stone Pickaxe affect matching productive work rate; Hammer BUILD multiplier remains 1 until separately proven.
- Base save version stays 0.5.0; missing Rust extensions on an older valid 0.5.0 save migrate to empty bounded ledgers.
- Regenerate runtime source pins after any `src/*.mjs` change. Exact candidate and exact main workflows remain release authority.


## Production Planning RP1 candidate

- Read `docs/PRODUCTION_PLANNING_RP1.md` before changing autonomous production.
- RP1 coordinates existing Rust commands only; never create a second crafting executor or material ledger.
- Disabled must remain baseline-equivalent. Enablement is explicit and persisted.
- Keep plan history bounded; save/load must resume accepted orders without duplicate outputs.
- Hunger/energy/lifecycle and task validation retain priority over production goals.


## September 25, 2026 closeout

- Runtime release line after this closeout: Knowledge Continuity 1 + Rust RS1–RS4 + Production Planning RP1 + Mentorship KF1.
- Rust material commitment is exact-once at order acceptance; do not restore completion-time spending or a second reservation registry.
- RP1 is a coordinator only. It issues validated Rust commands and never completes work outside the engine scheduler.
- KF1 teaching is idempotent per Mentor-link + key, transfers CONFIRMED mentor knowledge as UNVERIFIED student knowledge, and grants no XP.
- WM4.4 is evidence-only. Its controlled-depletion scenario exists to compare candidate formulas; do not treat any candidate as active gameplay. WM4.1 remains the single regeneration writer.
- Old Rust/formula/roadmap/temporal PRs closed during closeout are stale reference branches. Re-port useful ideas from verified current main instead of merging those branches.
- Read `docs/HANDOFF_2026-09-25_CLOSEOUT.md` before beginning the next large gate.
