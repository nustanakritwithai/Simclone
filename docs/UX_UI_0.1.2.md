# Observation UI 0.1.2 — navigation and recoverable startup

Base: 22ca20a5609e3505c6c150d3414355e1b21bb91b (UI 0.1.1).

## Delivered

- Collapsible, read-only top-down minimap: real terrain, resources, structures, living people, selected-person marker and camera outline. Clicking or using arrow keys moves the camera, not agents and not world state.
- Camera centers on the space between the visible HUD, inspector, building panel and portrait rail. Mobile expanded sheets reserve room for the selected person. Choosing a different person stops the previous follow target.
- Explicit loading screen and failed-start retry path. Loading styles/modules must succeed before it disappears. Retry reloads the page; it never clears saves.
- Browser storage status is visible in the time bar and menu. Empty/new, loaded, saved, unavailable and protected saves are distinct. A successful write is required before showing Saved.
- Corrupt saves are never overwritten by manual or automatic saves. The menu can export the exact original damaged text before a deliberate reset. Failed reads also block automatic writes to avoid overwriting an unknown existing save, even when writes happen to be permitted.
- An explicit reset/import confirmation is required to release that protection. No cloud synchronization or offline simulation is implied.
- Added a unit/asset test gate before GitHub Pages deployment.

## Architecture and compatibility

The authoritative `src/engine.mjs` is byte-for-byte unchanged. Engine/save version remains 0.1.0; UI version is 0.1.2. The existing `simclone:world:v1` key is preserved.

`storage.mjs` is a dependency-injected browser storage adapter, not part of the simulation. `navigation.mjs` reads state and invokes camera-only callbacks. `boot.mjs` handles startup errors. `app.mjs` integrates these adapters and removes obsolete fallback copies of the old inspector. The existing world art and gameplay contracts are retained.

## Evidence

- `npm test`: 28/28 PASS, including the original 15 engine tests, storage-protection cases, camera/map helpers and local import/asset resolution.
- `python tests/ui-smoke.py`: 42/42 existing presentation checks PASS after the update.
- `python tests/navigation-smoke.py`: 36/36 new checks PASS, including no-mutation minimap navigation, visible selected character with compact/expanded panels, old-save restoration, exact-byte damaged-save recovery, denied-read/write cases and an injected startup failure.
- No uncaught JavaScript page errors in either browser fixture.
- Layouts: 320x740, 360x800, 390x844, 768x1024, 844x390 and 1440x1000. Screenshots were inspected for desktop, mobile map and expanded-camera layout.

These browser fixtures load the exact modules in memory and use an explicit Storage test double. They are not a live website or native browser-storage test. A direct attempt to open the public game in this runner returned `net::ERR_BLOCKED_BY_ADMINISTRATOR`; the web tool could not access the URL either. Live public HTTP delivery and performance/persistence on a physical Android device remain UNKNOWN. The Pages workflow result must be verified separately for the released commit.

No V1.0 autonomy proof, aging, automatic generations, social/faction systems, replay, LLM usage or balance expansion is claimed.
