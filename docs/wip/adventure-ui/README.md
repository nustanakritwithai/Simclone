# Adventure UX/UI Prototype

Docs-only prototype for a Clone entering Adventure/MMORPG mode.

## Scope lock

This branch is intentionally isolated under `docs/wip/adventure-ui/**`.

It does not modify production runtime, `index.html`, `src/**`, engine, app, boot, production CSS, save, or gameplay authority.

The prototype is fixture-driven and read-only. Buttons demonstrate navigation and intent only; they do not dispatch gameplay commands or write world state.

## Files

- `preview.html` — interactive prototype shell
- `prototype.css` — mobile-first responsive prototype styling
- `prototype.js` — fixture renderer and UI-only navigation
- `fixtures/adventure-ui-fixture.json` — static illustrative data
- `UX_FLOW.md` — surface hierarchy and interaction flow
- `FIXTURE_SCHEMA.md` — handoff contract for Agent H
- `ACCEPTANCE_CHECKLIST.md` — prototype acceptance gates

## Preview

Serve this directory with any static HTTP server and open `preview.html`.

The preview intentionally fetches only the local fixture JSON. It has no production imports and no external API calls.

## Design principles

1. World remains the primary surface.
2. Adventure controls stay compact and contextual.
3. Inspector, regions, and equipment use temporary sheets instead of a permanent dashboard.
4. Encounter temporarily increases focus but does not become a second game shell.
5. Unknown regions remain unknown; the prototype never fabricates unlock state.
6. UI consumes snapshots. Simulation/runtime remains authoritative elsewhere.
