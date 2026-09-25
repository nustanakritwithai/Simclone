# BM1 — Building Mode Success Contract

Base: `main@d2ea08bb7a4a888f39a2e2bf2762c74072b04757`

Status: implementation branch only. Do not merge until all gates below are SAT.

## Scope

BM1 adds only:
- Building Mode entry/exit UI
- modular piece selection for WOOD_FOUNDATION / WOOD_WALL / WOOD_DOORWAY / WOOD_ROOF
- read-only placement preview using the authoritative placement validator
- placement ghost using the BM0 renderer
- UI-only wall/doorway rotation
- validator-derived valid/invalid colours
- mobile interaction
- Building Mode x-ray for modular houses

BM1 does not add or change:
- housing/capacity semantics
- placement writer semantics
- structural snap rules
- station/material ledgers
- RP1
- P3 HP / repair / delete / refund
- WM4
- reproduction threshold
- Shelter creation

## Authority contract

1. Engine/Rust placement validator and writer remain authority.
2. Preview must be read-only and must not clone-and-execute the writer as its source of truth.
3. Confirm must execute the existing PLACE_STATION command; UI never writes Rust state directly.
4. Rotation is UI state only. Confirm sends the canonical socket accepted by the existing validator.
5. BM0 `src/building-visuals.mjs` is reused. No second renderer or socket-topology authority.
6. Runtime socket topology comes from `src/rust-stations.mjs`.

## Ghost contract

- Green only when validator result has `ok === true`.
- `ok === false`, missing `ok`, exceptions, or unresolved preview are red/fail-closed.
- Invalid wall/doorway without a supporting foundation is drawn at ground level; it must not inherit the 3 px foundation lift.
- Valid wall/doorway uses the normal foundation/wall vertical geometry.
- Roof ghost may visually join existing same-house roofs only when the exact preview is valid.
- Preview never mutates state, possessions, equipment, station records, stock, tasks, history, or placement counters.

## Interaction contract

Desktop:
- enter Building Mode explicitly
- choose piece
- hover/tap candidate
- rotate wall/doorway N -> E -> S -> W
- confirm only through existing command
- escape/cancel exits without mutation

Mobile:
- explicit Building Mode entry
- piece controls remain reachable without covering the target cell
- tap updates candidate before confirmation
- rotate and confirm are separate actions
- cancel/back leaves simulation state unchanged

## Visual contract

- Building Mode reuses BM0 solid geometry.
- Existing modular houses use x-ray while Building Mode is active: roof and front/interior walls/doorways alpha 0.35; back edges remain opaque.
- Legacy Shelter remains visually separate and is not made placeable.
- Missing/invalid preview never appears valid.

## Required deterministic tests

At minimum prove:
1. missing `ok` ghost is invalid/red
2. valid and invalid preview do not mutate state
3. rotation canonicalises E/S to stored N/W sockets
4. invalid unsupported wall ghost uses ground-level geometry
5. valid wall ghost uses foundation-level geometry
6. roof neighbour merge is supplied only for valid same-house preview
7. confirm routes through PLACE_STATION and existing writer
8. cancel/selection/rotation do not consume items
9. Shelter creation UI remains absent
10. existing BM0 renderer tests remain green

## Release gates

- branch starts exactly from the base SHA above
- scope review shows no unrelated WM4/RP1/P3 changes
- runtime pins regenerated after runtime module changes
- exact candidate push + PR Verify SUCCESS
- browser gates SUCCESS
- merge exact verified SHA only
- exact main Pages test/upload/deploy SUCCESS
- public runtime acceptance checked separately

Verification states are SAT / VIOL / UNKNOWN. UNKNOWN is never PASS.
