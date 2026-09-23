# Simclone handoff

Read `GAME_PLAN.md` and `docs/STATUS.md` first. Plan entries are intentions, not proof that features exist.

- `src/engine.mjs`: authoritative simulation. No DOM, Date, Math.random or external API calls.
- `src/app.mjs`: fixed-step runner, rendering, input and UI. UI actions go through `command`; never put new game rules in a button handler.
- `src/game.css`: responsive skin. Preserve mobile canvas, touch controls and inspector close button.
- `index.html`: playable game. `plan.html`: preserved original development page.
- Run `npm test` before changing a deployment branch. New requirements need success contracts and deterministic regression tests.
- Current skill transfer is manual cloning only, not mentor/archive/culture. The event list is not a replay system.
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

## Survival Core 0.2.0 (current)

- Read `docs/SURVIVAL_0.2.0.md`. Engine is now 0.2.0; earlier "engine unchanged" statements describe historical UI-only releases, not this one.
- `SAVE_VERSION=0.1.0` is independent of `VERSION=0.2.0`. Preserve the existing storage key. Old jobs are replanned on the next tick; do not erase the world.
- `src/survival.mjs` owns deterministic routing/claim helpers. Reservations are derived from active task contracts; never create a second mutable lock registry.
- Resource nodes: one worker. Buildings: two workers. Meals: one claimant per available unit. Reserved meals are not spendable by CLONE.
- Stock targets account for already-assigned output. On-site eating deducts one harvested item. Zero-output work earns no XP.
- Run `npm test`, `npm run test:survival`, `python tests/ui-smoke.py`, `python tests/navigation-smoke.py`, `python tests/survival-smoke.py`. No long-run survival fixture implies autonomous births or the complete V1.0 proof.
