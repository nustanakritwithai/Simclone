# Observation UI 0.1.1 — implementation and evidence

## Goal / success contract

Make the existing Simclone simulation easier to observe and operate on a phone. Keep the authoritative engine, seed, saved-world schema, parent inheritance and world rendering unchanged except for presentation-only hit testing and placement highlights.

## Delivered

- Consistent inline SVG icons and larger primary touch controls; mobile time controls have their own row instead of squeezing the header.
- Quick portrait rail selects and focuses real characters. Identity portraits remain separate from role labels.
- Compact mobile character sheet with explicit expand/collapse, a one-tap Why shortcut and persistent close control. Expanded tabs use keyboard arrow navigation and ARIA relationships.
- Stable inspector shell: tabs and controls are no longer rebuilt every 300 ms. Needs and content update only where necessary; details/scroll state are retained.
- Real decision scores with a plain-language summary and optional numeric breakdown. These are CPU rule scores, not fabricated private thoughts or LLM output.
- Searchable roster; filters for satiety below 25 and generation 2+. Generation filters do not claim autonomous births.
- House placement is now preview → validate → confirm. Both preview and execution use the existing engine command; preview runs on a disposable state copy. It cannot spend resources. Confirmation validates current authoritative state again. Cancel discards the candidate. Keyboard-accessible grid selection complements map taps.
- Clone dialog shows the selected parent, projected skill XP, exact costs and engine-derived blocking reason. Choosing another parent opens the real roster.
- Searchable/filterable recent Chronicle, explicitly labeled as an event list rather than replay.
- In-game three-step guide with no account or AI API requirement.

## Architecture

`src/ux.mjs` owns observation UI. `src/app.mjs` provides narrow callbacks to read state, select/focus, open dialogs and execute/preview commands. `src/ux.css` extends the existing visual theme. `src/engine.mjs` is byte-for-byte unchanged, and saved-world version remains `0.1.0`; UI version is independently `0.1.1`.

## Verification actually run

- Existing `npm test`: 15/15 engine tests PASS.
- `python tests/browser-smoke.py` (delegates to `tests/ui-smoke.py`): 42 assertions PASS, zero JavaScript page errors.
- Desktop 1440×1000; mobile 390×844, 360×800, 320×740; landscape 844×390; tablet 768×1024.
- Checks include real tick/pause, stable DOM tabs, keyboard tabs, searchable empty state, selected-parent cloning, unchanged state during clone preview, storage-adapter reload, compact sheet coverage below 40% of world area, sheet close restoring camera controls, placement preview/cancel without mutation, water rejection, one-time resource deduction and autonomous completion after confirmation, Chronicle filtering and invalid import rejection.
- Screenshots inspected for desktop world, mobile world, selected character, decision detail and placement.

## Verification limits

The browser runner blocks network navigation, including localhost. This fixture loads the exact source modules in memory and uses an explicit in-memory Storage test double. Native localStorage, live asset delivery, device font rendering and physical Android performance remain UNKNOWN. Successful Pages deployment must be checked separately via its workflow run, not inferred from these tests. No claim of passing the V1.0 100-day proof.

## Not included

No changes to balance, lifecycles, autonomous births, mentor/cultural learning, social/faction/economy systems, replay or LLM integration. Closing/hiding the game still stops simulation. The guide and UI do not imply otherwise.
