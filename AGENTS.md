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
