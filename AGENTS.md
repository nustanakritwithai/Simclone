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
