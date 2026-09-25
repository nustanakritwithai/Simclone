# Simclone: modular building visuals (DRAFT)

This package is parked on the draft branch `wip/building-mode-prep` (PR #69, **DO NOT MERGE**) under
`docs/wip/building-mode-prep/visuals/` so the team can pick it up. Nothing here is wired into `src/`. The repo was read through the GitHub MCP `get_file_contents` tool at
`main` = `9799a6ac54cb587384475ba9be7389e72f05b525` (`src/app.mjs`, `src/ux.mjs`, `src/ux.css`, `src/game.css`,
`src/worldsim-map.mjs`, `index.html`, `scripts/`). The design source is `../SPEC_building_sockets_v1.md` (read-only),
including **§10**, which settles the visual questions.

| File | What it is |
|---|---|
| `building-visuals.mjs` | Pure ES module. It exports `drawFoundation(c)`, `drawWall(c, edge, opts)`, `drawDoorway(c, edge, opts)`, `drawRoof(c, opts)`, and `drawGhost(c, piece, edge, ok, opts)`. It also has the roof-merge helpers `roofNeighbours(cell, isSameHouseRoofed)` and `sameHouseRoofPredicate(houseCells, roofCells)`, the edge helpers `canonicalEdge(x,y,side)`, `edgeCells(socket)`, `localEdge(socket, cell)`, and `edgeRole(socket, anchor, hasFoundation)`, the integration helpers `structureDrawInfo(st, {hasFoundation})`, `structureDepth(st)`, and `drawPiece(c, piece, edge, opts)`, the alpha helpers `roofAlpha(opts)` and `edgeAlpha(opts)`, and the constants `SIZES`, `XRAY_ALPHA`, and `PALETTE`. The only outside thing it touches is the ctx you pass in. |
| `building-icons.mjs` | `BUILDING_ICON_PATHS` holds the foundation, wall, doorway, roof, rotate, and remove icons as inner SVG markup in the same format as `paths` in `ux.mjs`. `BUILDING_ICON_D` holds just the `d` strings. `buildingIcon(name)` uses the same wrapper as `ux.mjs icon()`. |
| `preview-scene.mjs` | Pure scene **data** used by both `preview.html` and `check-geometry.mjs`. It holds RS3-0.3-shaped records where **every edge socket is canonical N/W**: a house's E/S side goes through `canonicalEdge()` and is stored as W of (x+1,y) / N of (x,y+1), with the anchor on the foundation. Ghost sockets are canonical too. It also has a *preview-only* stand-in for `evaluateModularHouses` (4-neighbour foundation components), `hasFoundation`, the x-ray house cells, and the draw list, sorted with `structureDepth()` the same way `app.mjs render()` sorts objects. |
| `preview.html` | Test scene. Query parameters: `?zoom=1.25&dpr=2&grid=0\|1`. It draws the `preview-scene.mjs` draw list, then the ghosts, labels, and icon strip. |
| `render_preview.py` | Renders `preview.html` headless with local Playwright Chromium and a throwaway localhost server, then writes the canvas's real backing pixels to PNG. |
| `preview_scene.png` | **Main render**: zoom 1.25, DPR 2 (2000×1760), on grass `#738f58` (`TERRAIN_COLORS.grass`). |
| `preview_scene_grid.png` | The same scene with the tile diamonds outlined, for checking alignment. |
| `preview_debug_zoom4.png` | Zoom 4 with the grid, for checking seams, the ridge, and corners. |
| `check-geometry.mjs` | `node check-geometry.mjs` checks: wall bases on the diamond edges; walls meeting the roof eave; the §10.1 constants; the canonical-edge helpers (`canonicalEdge` E→W(x+1), S→N(y+1), `edgeCells`, `edgeRole` back/front/interior); depth order; no RNG, clock, or DOM calls. For §10.8 it uses a recording 2D context to check the `globalAlpha` of every fill and stroke: roof and front walls/doorways at `XRAY_ALPHA`, back walls at 1. **Canonical preview data (§10.7):** every stored edge side is N/W. Every visible E/S wall or doorway (31 in the scene) comes from a W/N socket. Each edge's polygons, drawn from the stored socket cell + `side`, equal the old path's (anchor + house-relative side). Depths equal the old anchor + edge-midpoint formula, and the sorted draw order is identical. Interior edges give the same position, depth, and role whichever foundation is the anchor. It also checks roof merging on **all 511 roof shapes that fit in a 3×3 block**: in every one, each cell's roof faces tile the cell exactly, and every shared vertex has a single height, so there are no gaps, overlaps, or valleys on shared sides. |

Re-render: `python3 render_preview.py`. The output is deterministic: two renders give byte-identical PNGs.

What the scene shows:
- **Row 1:** a 1×1 house (door S, clone beside it), a **2×1 house with a continuous roof**, an open 1×1 (door E, clone inside), an open 2×1, and back walls only.
- **Row 2:**
  - a **1×1 house with a door on N, opaque roof**
  - the **same house in x-ray** (§10.8): roof and front S/E walls at α 0.35, back N/W walls and the N door opaque
  - a 2×1 house with a door on W, in x-ray
  - an L-shaped 3-cell house (continuous roof, with a real valley only at the inner corner)
  - a 2×2 house (continuous hip roof with a flat top)
- **Row 3:** a wall on each house side N/E/S/W. E and S are stored as W of x+1 / N of y+1.
- **Row 4:** a doorway on each of N/E/S/W.
- **Row 5:** green and red ghosts.
- **Bottom strip:** the icons.

## Resolved by spec §10

| # | Decision (spec §10) | How this package implements it |
|---|---|---|
| 10.1 | Pixel sizes: 3 px slab, 28 px wall, 16 px roof pitch, kept in one place in the renderer | One exported constants block at the top of `building-visuals.mjs`: `FOUNDATION_H=3`, `WALL_H=28`, `ROOF_H=16`, `DOOR`, `XRAY_ALPHA=.35`. The derived `WALL_BASE_Z=3`, `WALL_TOP_Z=31`, and `ROOF_TOP_Z=47` are computed from those, and everything is also bundled as `SIZES`. All geometry, and `check-geometry.mjs`, reads these constants. |
| 10.2 | One roof record per cell in the engine. When drawing, skip the hip/gable face on a side shared with a roofed cell of the same house, so the roof has no groove. | `drawRoof(c, {neighbours})`. `neighbours` is a Set (or array) of `'N','E','S','W','NE','SE','SW','NW'` naming neighbours that are **in the same house and roofed**. A merged side gets no face; instead the ridge runs from the apex to that side's midpoint, and the faces of neighbouring cells are coplanar. Where two merged sides meet at a corner: if the diagonal cell is also merged, the corner is a flat top at ridge height (2×2); if not, it gets two valley triangles (inner corner of an L). Only one face on each side of a shared edge is drawn, and each is sealed with its own fill colour, so there is no anti-alias hairline. A pixel sample along the 2×1 shared edge differs by ≤1/255 from the face beside it, except where the course lines deliberately cross. |
| 10.3 | In Building Mode, or while hovering a house, draw roofs at alpha 0.35 so N/W doorways and back walls show | `drawRoof(c, {xray:true})` draws at `XRAY_ALPHA` (0.35). The default is opaque. There is no per-call alpha override any more. When translucent, only front-facing roof faces are drawn and there is no seal stroke, so no area is painted twice. |
| 10.4 | A ghost with no `ok` is red (fail-closed), for both the new and the old ghost, and P2 needs a test | `drawGhost` is green only when `ok === true`; `undefined`, `false`, or anything else is red. **The legacy BUILD ghost in `app.mjs` L170 still does the opposite** (`v.ok===false ? red : gold`, so a missing `ok` shows gold). It must change to `v.ok===true ? … : red` too. **P2 / Building Mode needs a test for the missing-`ok` case** on both ghosts. |
| 10.5 | Rotation is UI only, done in Building Mode together with the ghost, with no engine command | The `rotate` icon is meant for the Building Mode UI, where it cycles the ghost's local edge N→E→S→W before confirming. The confirm then sends the snapped canonical socket as usual. This package has no rotate logic. |
| 10.6 | Delete moves to P3 (with HP/repair). Keep the icon, but don't bind it to a command. | The **`remove` icon is kept but is NOT bound to any command.** Any delete command that appears before P3 is out of scope. |
| 10.7 | Draw edge pieces at the **stored socket's** `x`/`y`/`side` (field `side`; `'edge'` is the `type`), never at the anchor. Saves hold only N/W. Front/back is decided by which of the edge's two cells has the foundation. Every E/S input goes through `canonicalEdge`. | `structureDrawInfo(st, {hasFoundation})` returns `{piece, x:socket.x, y:socket.y, edge:socket.side, depth, role, houseCell, houseEdge}`. It never uses `st.x/st.y` for position. A non-canonical E/S socket returns `null` (it is not drawn, because it is invalid in a save). `edgeRole` works like this: foundation only in (x,y) → `back` (house side N/W); foundation only in (x,y−1) for N or (x−1,y) for W → `front` (house side S/E); both → `interior` (see UNKNOWN 1). With no `hasFoundation`, it falls back to the anchor cell. `structureDepth` uses the edge midpoint, so N of (x,y+1) = S of (x,y) = `x+y+.5`. Position, depth, and order equal the old non-canonical results (checked). The preview data and ghosts use only canonical N/W sockets. The old field-name UNKNOWN is closed. |
| 10.8 | `{xray:true}` draws the roof **and** the walls/doorways on the house's front edges (S/E seen from the house) at alpha 0.35. Back walls stay opaque. One alpha constant. | One constant, `XRAY_ALPHA=.35`. `roofAlpha({xray})` gives the roof alpha. `edgeAlpha({xray, role})` is `XRAY_ALPHA` for role `front` (and `interior`), and 1 for `back`, `unknown`, or no x-ray. A translucent doorway skips its opening shade, and translucent walls/doorways skip their plank lines (the outline and door frame stay), so the back door behind them reads cleanly. In the render, the N door (1×1) and the W door (2×1) show clearly through the roof and front walls, and the back walls stay opaque. Pixel sample at zoom 4: door opening vs. back wall ΔRGB sum ≈ 50 in x-ray, vs. 13 (plank noise only, door hidden) on the opaque twin. |
| 10.9 | The renderer picks the roof shape from the same-house neighbour mask. The 2×2 flat top and the L inner-corner valley are accepted, visual only. The engine keeps one roof per cell. | `roofGeometry(neighbours)`: a diagonal-merged interior corner gives a flat top at ridge height; a missing diagonal gives valley triangles. Checked on all 511 3×3 shapes. |

**Work stages (spec §10):**
- **(a) Shelter-removal PR**, including RP1 planning modular houses: no ghost, no rotate, no delete; the engine accepts edge sockets. Only the solid pieces (`structureDrawInfo`, `drawPiece`, `structureDepth`, and the roof merge) are needed here.
- **(b) Building Mode**: ghost and rotate. This adds `drawGhost`, x-ray (`xray:true` on the roof and front walls/doorways while Building Mode is on or a house is hovered), the rotate icon, and the fail-closed legacy ghost with its test.
- **(c) Structural Snap.** No renderer change is expected; ghosts keep drawing whatever snapped socket the engine returns.
- **(d) P3**: HP, repair, and delete. This is where the `remove` icon gets bound, and where HP/damage visuals would be added (not designed yet).

## Geometry and draw order

- `hw=27, hh=13.5`, `proj=(x,y)=>({x:(x-y)*hw, y:(x+y)*hh})`. Pieces are drawn in local coordinates with the tile centre as origin and up as −y.
- Spec §1.2 and §3.4 map edges to the screen like this:
  - `N` = T→R (upper-right, **back**)
  - `W` = T→L (upper-left, **back**)
  - `S` = L→B (lower-left, front)
  - `E` = R→B (lower-right, front)
- Order inside one tile: foundation → back edges N, W → tile contents (agents) → roof → front edges S, E.
- Across tiles, `structureDepth()` gives the depths from spec §8.3:
  - Edge: x+y of the edge midpoint, computed from the canonical socket. N or W of (x,y) is `x+y-.5`. A house's S side is stored as N of (x,y+1) and its E side as W of (x+1,y), both `x+y+.5`, which is the same as the old S/E-of-(x,y) value.
  - Foundation: `+.15`, the same as today.
  - Agents: `+.2`, the same as today.
  - Roof: `+.3`.
- Merged roof faces of neighbouring cells never overlap on screen, so the per-cell depth sort still works. An opaque roof draws its back-facing faces first; outlines and course lines are drawn only where they border a front-facing face.
- Light comes from the upper left. N and S walls show a lit face; E and W walls show a shaded one. Roof slopes facing W or S are lit; slopes facing N or E are shaded. There are no gradients.

## Colours

| Use | Hex |
|---|---|
| Foundation top / outline / planks (w2) | `#8f6d45` / `#c09a63` / `#644b33` |
| Foundation slab side, lit (S) / shaded (E), *derived* | `#85633b` (top −10) / `#77552d` (top −24) |
| Wall lit face (N, S) / shaded face (E, W) / outline / planks (w2) | `#8b6845` / `#795633` (*derived*, −18) / `#c29b68` / `#64482f` |
| Doorway posts (w5) / lintel (w5) / threshold rail (w2) | `#7d5a39` / `#9b7448` / `#6d4f35` |
| Doorway side panels and header | the wall colours above |
| Doorway opening shade | `#172a2355` (the station shadow colour, reused) |
| Roof lit slopes (W, S) and 2×2 flat top / shaded slopes (N, E) / outline / course lines (w2) | `#7f603f` / `#6d4e2d` (*derived*, −18) / `#b28b59` / `#5e452f` |
| X-ray (roof + front walls/doorways) | the same colours at `globalAlpha` `XRAY_ALPHA` 0.35. Front walls drop the plank lines; the doorway drops the opening shade. |
| Foundation contact shadow | `#172a2355`, ellipse (0,4) 20×7, the same as `rustStation()` |
| Outline width | 0.7 px |
| **Ghost valid** fill / stroke | `#c4d5a970` / `#c4d5a9` (`.clone-validity` in `ux.css`) |
| **Ghost invalid** fill / stroke (also used when `ok` is missing) | `#d47f7f70` / `#efb6a6` (the current ghost red, `app.mjs` L170) |
| Ghost glyph | `✓` / `×` in `#fff4d5` |

## Integration notes (for a later PR, not done here)

**Rechecked against `main` = `4b3585c` (after PR #67 merged, 2026-09-25).** Still true there: `src/app.mjs` imports are L1-5, `rustStation(c, st)` is L101-126 with the `WOOD_*` branches at L113-124, and the depth sort is L167. `paths` in `src/ux.mjs` is L15-35 and `icon()` is L35. `canonicalEdge` (L37), `edgeCells` (L43), `cellEdges` (L44) and `socketKey` (L45) are exported from `src/rust-stations.mjs`. `evaluateModularHouses` is exported from `src/housing.mjs` (L31) and re-exported by `src/engine.mjs` (L21). **Changed by #67:** the Shelter panel, `#build` button, mobile build tab, tap-to-BUILD and the gold ghost at old L170 are gone, and `app.mjs` has no ghost and no `api.preview` call at all. Item 5 below is therefore new code for Building Mode, not a replacement, and Building Mode also needs a new entry point (the icons here are ready for it). Always re-check line numbers against the base you branch from.

1. **Move the module.** Copy `building-visuals.mjs` to `src/` and add `import {drawPiece,drawGhost,structureDrawInfo,structureDepth,roofNeighbours,sameHouseRoofPredicate} from './building-visuals.mjs?v=0.5.0';`. Replace this module's local `canonicalEdge`/`edgeCells` mirrors with imports of the real spec §1.2 helpers from `src/rust-stations.mjs`, so there is one implementation to the imports in `src/app.mjs` (L1-5). Put `building-icons.mjs` in `src/` too, or merge `BUILDING_ICON_PATHS` into `paths` in `src/ux.mjs` L15-35. Rotate and remove are UI-only or unbound (§10.5, §10.6).
2. **`rustStation(c, st)`, `src/app.mjs` L101-126.** *Stage (a).*
   - Add an early branch at the top of the function, **before** it translates to `proj(st.x,st.y)`: `const info=structureDrawInfo(st,{hasFoundation}); if(info){const p=proj(info.x,info.y);c.save();c.translate(p.x,p.y);drawPiece(c,info.piece,info.edge,optsFor(info));c.restore();return;}`
   - `hasFoundation(x,y)` is true when there is a `WOOD_FOUNDATION` at `c0:x:y`. Build it once per frame, e.g. from the foundation cells of `evaluateModularHouses` or a Set of foundation socket keys. Pass it so front/back comes from the foundation cell (§10.7) and does not depend on the anchor.
   - `optsFor(info)`: roofs get `{neighbours, xray}` (item 3). Walls/doorways get `{role: info.role, xray}`, where `xray` is true if Building Mode is on or the house containing `info.houseCell` is hovered. The house is keyed by `houseCell` (the foundation), not by the socket cell. For a front edge the socket cell is *outside* the house.
   - This replaces what the `WOOD_*` branches (L113-124) do for RS3-0.3 records.
   - Keep those old branches for `socket.type:'legacy'` pieces and for `CRAFTING_TABLE_LV1`/`FURNACE`.
3. **Roof neighbours (`roofOptsFor`), which the game computes, not the renderer.** Once per frame, in `render()` before the object loop (memoised by the spec §5.1 key `(rustStations.nextStation, stations.length)`):
   - Call `houses = evaluateModularHouses(state).houses` from `src/housing.mjs`, exported via the engine (spec §5.1 and §5.2).
   - Collect `roofCells` = the `{x,y}` of every `WOOD_ROOF` whose `socket` is `{type:'cell', level:2}`.
   - Map each cell to its house.
   - For a roof cell in house `h`, use `roofNeighbours(cell, sameHouseRoofPredicate(h.cells, roofCells))`.
   - "Same house" means both cells are in the **same entry's `cells`** from `evaluateModularHouses`, i.e. the same 4-neighbour foundation component (spec §5.1 and §10.2). A roof on a cell of another house never merges.
   - `xray:true` when Building Mode is active or when the hovered cell belongs to `h` (§10.3, §10.8). Use the same flag for that house's walls/doorways; `edgeAlpha` makes only the front ones translucent.
   - `preview-scene.mjs` shows the same wiring with a local stand-in for `evaluateModularHouses`.
4. **Depth sort, `src/app.mjs` L167.** Replace `depth:st.x+st.y+.15` with `depth:structureDepth(st)`. *Stage (a).*
5. **Ghost (new in Building Mode; the old L170 ghost was removed by #67).** *Stage (b).*
   - Canonicalise first (§10.7): the rotated house-relative side goes through `canonicalEdge(x,y,side)`. Then translate to `proj(socket.x, socket.y)` of that snapped canonical socket and call `drawGhost(ctx, pieceKind, socket.side, previewResult.ok, {neighbours})`. The picture is identical to drawing the house-relative side from the foundation cell.
   - `previewResult` = `api.preview('PLACE_STATION', {..., socket})` for that exact socket (L268, which becomes `previewPlacement`).
   - Rotate only changes which local edge the UI asks `snapSocket` for.
   - The legacy Shelter ghost no longer exists after #67, so the §10.4 fail-closed rule and its missing-`ok` test apply to the new ghost only.
6. **Spec fields read (RS3-0.3, spec §1.3):**
   - `kind`
   - `socket.type` (`'cell'|'edge'|'legacy'`), `socket.x`, `socket.y`, `socket.side` (`'N'|'W'`), `socket.level` (`0` or `2`)
   - anchor `x`, `y`: used for the depth of pieces with no socket or a legacy socket, and, for edges, as the front/back fallback when no `hasFoundation` is passed
   
   From outside the record, the roof merge also uses `evaluateModularHouses(s).houses[].cells`, supplied by the game. The ghost reads only the validator's `ok`. Not read: `id`, `buildingType`, `complete`, `placedBy`, `placedTick`, `structurePiece`, `sourceItemId`, `placementId`, `rustStations.version`.
7. **Pin the assets:** after **any** change to `src/*.mjs`, including adding `src/building-visuals.mjs`, run **`node scripts/pin-assets.mjs`**. This is enforced by `tests/cache-pins.test.mjs`, which counts every `src/*.mjs` (spec §8.3).

## Remaining UNKNOWNs

1. **UNKNOWN: interior edge (foundations on both sides).** Two cells with foundations are always in the same 4-neighbour component, so they are always the **same house** (spec §1.4/§5.1); two houses cannot share an edge. §10.7 only defines "foundation at (x,y)" vs. "foundation across", and §10.8 only defines "front of the house". **My deterministic rule:** role `interior`. It is drawn from the stored socket like any edge; its position and depth do not depend on the anchor. In x-ray it is translucent like a front edge (so a partition never hides the back door). `houseCell` is the anchor, which only picks the house for x-ray membership, and both sides are the same house anyway. I deliberately did **not** derive front/back from the anchor, because §1.3 makes the anchor the lower station id, so the look would depend on build order. The game should pass `hasFoundation` to `structureDrawInfo`. The preview has no interior wall; it is covered in `check-geometry.mjs`.
2. **UNKNOWN: which houses merge roofs.** Roofs merge within any house `evaluateModularHouses` lists, including incomplete ones and `too-large` components. §10.2 only says "the same house per `evaluateModularHouses`".
3. **UNKNOWN: roof ghost next to existing roofs.** Can a roof ghost join an existing roof before it is placed? It is supported through `drawGhost(..., {neighbours})`, but Building Mode would have to compute the neighbours for a cell that doesn't have a roof yet. Using the foundation's house works.
4. **UNKNOWN: legacy-inert pieces** (`socket.type:'legacy'`). There is still no decision on whether they should look different; they stay on the old `rustStation()` branches.
5. **UNKNOWN: invalid wall ghost over bare ground.** It is still lifted 3 px as if a slab were there. Knowing the ground height would mean reading state.
6. **UNKNOWN: performance** of calling `evaluateModularHouses` every frame on mobile (the spec's own UNKNOWN 8). The roof merge, `hasFoundation`, and x-ray membership all use it, so memoise it once per frame.
7. **Not covered:** walls don't block walking in v1 (spec §1.4). The minimap (`navigation.mjs` L57) doesn't show structures. The night overlay, the mobile zoom of 1.12, and HP/damage visuals (P3) were not rendered or designed.
