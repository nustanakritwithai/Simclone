/**
 * Simclone · modular building visuals (runtime renderer).
 *
 * Pure ES module. No DOM access except the CanvasRenderingContext2D passed in as `c`.
 * No RNG, no clock reads, no state reads, no validity logic, no house evaluation.
 *
 * Coordinate contract (copied from src/app.mjs @ 9799a6ac L13-14):
 *   hw=27, hh=13.5, proj=(x,y)=>({x:(x-y)*hw, y:(x+y)*hh})
 *   Every draw* function draws in LOCAL coords: the caller has already done
 *   c.translate(proj(x,y).x, proj(x,y).y), so (0,0) is the tile centre and up is -y.
 *   Tile diamond around the centre: T(0,-13.5) R(27,0) B(0,13.5) L(-27,0).
 *
 * Edge encoding (SPEC_building_sockets_v1 §1.2, §3.4, §10.7): draw from the STORED socket.
 *   socket = {type:'edge', x, y, side:'N'|'W', level:1}  (field is `side`; saves hold ONLY N or W)
 *   canonicalEdge(x,y,'S') -> N of (x,y+1); canonicalEdge(x,y,'E') -> W of (x+1,y).
 *   N of (x,y) = corners (x-.5,y-.5)->(x+.5,y-.5)  => screen T->R  (upper-right edge, BACK)
 *   W of (x,y) = corners (x-.5,y-.5)->(x-.5,y+.5)  => screen T->L  (upper-left edge,  BACK)
 *   S of (x,y) = N of (x,y+1)                      => screen L->B  (lower-left edge,  FRONT)
 *   E of (x,y) = W of (x+1,y)                      => screen R->B  (lower-right edge, FRONT)
 *   drawWall/drawDoorway take a LOCAL edge relative to the tile the caller translated to.
 *   structureDrawInfo() always translates to the socket cell and passes socket.side (N/W), so a
 *   house's visible E/S walls come from canonical W/N sockets of the neighbouring cell; the
 *   pixels are identical to drawing E/S from the foundation cell (checked in check-geometry.mjs).
 *   Front/back (SPEC §10.7): foundation in the socket cell (x,y) -> the edge is the house's BACK
 *   side; foundation in (x,y-1) for N or (x-1,y) for W -> FRONT side; both -> 'interior'.
 *
 * Sizes: SPEC §10.1 fixes them; they live ONLY in the constants block below.
 *
 * DRAW ORDER (painter's algorithm, back to front)
 *   Inside one tile the correct order is:
 *     1. foundation (shadow ellipse, slab front sides, slab top, planks)
 *     2. BACK edges  N and W   (visible face = inner face of the house)
 *     3. foundation contents   (agents / items standing on the tile)
 *     4. roof                  (opaque: back-facing faces first, then front-facing faces;
 *                               translucent: front-facing faces only, so alpha never stacks)
 *     5. FRONT edges S and E   (visible face = outer face of the house)
 *   Across tiles the game sorts every drawable by a scalar depth (app.mjs ~L167).
 *   structureDepth() returns the depths from SPEC §8.3 that reproduce the order above:
 *     edge  = x+y of the edge midpoint  -> N/W of (x,y): x+y-0.5 (back), S/E: x+y+0.5 (front)
 *     foundation / legacy / table / furnace = x+y+0.15   (unchanged from app.mjs)
 *     agents on the tile                    = x+y+0.2    (unchanged from app.mjs)
 *     roof                                  = x+y+0.3
 *   Back edges sort before the foundation itself; that is safe because a back wall only
 *   occupies screen space ABOVE the slab's back edges (they share just the 0.7 px outline).
 *   Roof (+.3) vs front edges (+.5) never overlap except along the eave outline.
 *
 * Continuous multi-cell roofs (SPEC §10.2): the engine keeps one roof per cell. drawRoof takes
 *   opts.neighbours = the directions ('N','E','S','W','NE','SE','SW','NW') whose cell is in the
 *   SAME house (evaluateModularHouses) AND has a roof. The shared hip face is not drawn; a ridge
 *   runs to the shared edge instead, so adjacent roof cells form one surface with no valley.
 *   Build the set with roofNeighbours(cell, isSameHouseRoofed) — the caller supplies the predicate.
 *
 * X-ray (SPEC §10.3, §10.8): opts.xray draws the roof AND walls/doorways whose role is 'front' (or
 *   'interior', see README) at XRAY_ALPHA; back walls stay opaque. Default is fully opaque.
 *
 * Ghosts: drawGhost(c, piece, edge, ok) uses the SAME geometry as the solid pieces.
 *   Colour is chosen ONLY from the `ok` argument, which must be the `ok` field returned by
 *   the engine validator (canPlaceStation / validatePlacement via api.preview) for the SAME
 *   snapped socket. Anything other than `ok === true` is drawn as invalid (fail-closed, §10.4).
 *   This module never inspects state and never computes support/validity.
 */

// ==== SIZE CONSTANTS: the ONE place (SPEC §10.1). Everything below derives from these. ========
export const TILE = Object.freeze({hw: 27, hh: 13.5});   // app.mjs L13
export const FOUNDATION_H = 3;    // slab thickness, px
export const WALL_H = 28;         // wall / doorway height above the slab, px
export const ROOF_H = 16;         // roof pitch: ridge/apex height above the eave, px (> hh so back faces tuck away)
export const DOOR = Object.freeze({from: .3, to: .7, height: 19});  // opening along the edge (0..1) and its height, px
export const XRAY_ALPHA = .35;    // SPEC §10.3/§10.8: ONE alpha for x-ray roof AND front walls/doorways
export const WALL_BASE_Z = FOUNDATION_H;           // derived: z of wall base and slab top
export const WALL_TOP_Z = FOUNDATION_H + WALL_H;   // derived: z of wall top and roof eave
export const ROOF_TOP_Z = WALL_TOP_Z + ROOF_H;     // derived: z of ridge/apex
export const SIZES = Object.freeze({FOUNDATION_H, WALL_H, ROOF_H, DOOR, XRAY_ALPHA, WALL_BASE_Z, WALL_TOP_Z, ROOF_TOP_Z});
// ===============================================================================================

/** Palette. Values marked (derived) are the palette base shifted by a fixed amount (no gradients). */
export const PALETTE = Object.freeze({
  shadow: '#172a2355',
  foundation: {top: '#8f6d45', stroke: '#c09a63', plank: '#644b33',
    left: '#85633b' /* derived: top -10, lit side */, right: '#77552d' /* derived: top -24, shaded side */},
  wall: {left: '#8b6845', right: '#795633' /* derived: -18 */, stroke: '#c29b68', plank: '#64482f'},
  doorway: {post: '#7d5a39', lintel: '#9b7448', rail: '#6d4f35',
    opening: '#172a2355' /* station shadow colour reused to shade the door opening */},
  roof: {left: '#7f603f', right: '#6d4e2d' /* derived: -18 */, top: '#7f603f' /* flat top of 2x2 = lit tone */,
    stroke: '#b28b59', line: '#5e452f'},
  roofRejected: {left: '#756b5b', right: '#62594d', top: '#756b5b', stroke: '#9b917f', line: '#514a41'},
  ghost: {
    valid: {fill: '#c4d5a970', stroke: '#c4d5a9', glyph: '✓'},   // #c4d5a9 = .clone-validity (ux.css)
    invalid: {fill: '#d47f7f70', stroke: '#efb6a6', glyph: '×'},  // existing BUILD ghost red (app.mjs L170)
    glyphColor: '#fff4d5'
  }
});

export const PIECES = Object.freeze({
  WOOD_FOUNDATION: 'foundation', WOOD_WALL: 'wall', WOOD_DOORWAY: 'doorway', WOOD_ROOF: 'roof'
});
export const EDGES = Object.freeze(['N', 'E', 'S', 'W']);
export const BACK_EDGES = Object.freeze(['N', 'W']);
export const FRONT_EDGES = Object.freeze(['S', 'E']);
export const NEIGHBOUR_DIRS = Object.freeze(['N', 'E', 'S', 'W', 'NE', 'SE', 'SW', 'NW']);
/** Grid offset of each neighbour direction (N = y-1, matching the canonical N edge at y-.5). */
export const NEIGHBOUR_OFFSETS = Object.freeze({
  N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0], NE: [1, -1], SE: [1, 1], SW: [-1, 1], NW: [-1, -1]
});

// ---- helpers copied verbatim in behaviour from src/app.mjs L22-24 --------------------------
export function polygon(c, points, fill, stroke = null) {
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = .7; c.stroke(); }
}
export function ellipse(c, x, y, rx, ry, color) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}
export function line(c, points, color, width = 1) {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
}

// ---- geometry (pure data, shared by solid pieces and ghosts) ------------------------------
/** Local world offset (u,v in tile units, 0,0 = tile centre) + height z (px) -> screen point. */
const P = (u, v, z = 0) => [(u - v) * TILE.hw, (u + v) * TILE.hh - z];
const lerp = (a, b, t) => a.map((n, i) => n + (b[i] - n) * t);
const area2 = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a; };
/** Edge endpoints in local tile units, ordered screen-left -> screen-right. */
const EDGE_UV = Object.freeze({
  N: [[-.5, -.5], [.5, -.5]],  // T -> R
  E: [[.5, .5], [.5, -.5]],    // B -> R
  S: [[-.5, .5], [.5, .5]],    // L -> B
  W: [[-.5, .5], [-.5, -.5]]   // L -> T
});
/** Light from the upper-left: N/S walls show a lower-left-facing face (lit), E/W a lower-right one (shaded). */
const EDGE_TONE = Object.freeze({N: 'left', S: 'left', E: 'right', W: 'right'});
/** Roof slopes: facing W/S = lit (left tone), facing N/E = shaded (right tone). */
const SLOPE_TONE = Object.freeze({N: 'right', E: 'right', S: 'left', W: 'left'});
const edgePoint = (edge, t, z) => {
  const [a, b] = EDGE_UV[edge];
  return P(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z);
};
const panel = (edge, t0, t1, z0, z1) =>
  [edgePoint(edge, t0, z0), edgePoint(edge, t1, z0), edgePoint(edge, t1, z1), edgePoint(edge, t0, z1)];

function assertEdge(edge) {
  if (!EDGES.includes(edge)) throw new Error('edge must be N|E|S|W, got ' + edge);
}

// Roof topology. Corners are the tile-diamond vertices; each sits between two sides and one diagonal.
const CORNER_UV = Object.freeze({T: [-.5, -.5], R: [.5, -.5], B: [.5, .5], L: [-.5, .5]});
const SIDE_CORNERS = Object.freeze({N: ['T', 'R'], E: ['B', 'R'], S: ['L', 'B'], W: ['L', 'T']});
const CORNER_SIDES = Object.freeze({T: ['N', 'W'], R: ['N', 'E'], B: ['E', 'S'], L: ['S', 'W']});
const CORNER_DIAG = Object.freeze({T: 'NW', R: 'NE', B: 'SE', L: 'SW'});
const SIDE_MID = Object.freeze({N: [0, -.5], E: [.5, 0], S: [0, .5], W: [-.5, 0]});
const otherSide = (corner, side) => CORNER_SIDES[corner].find(s => s !== side);

/** Normalise opts.neighbours (Set | array | {N:true,...} | null) to a Set of direction strings. */
export function neighbourSet(n) {
  if (!n) return new Set();
  const list = n instanceof Set || Array.isArray(n) ? [...n] : Object.keys(n).filter(k => n[k]);
  for (const d of list) if (!NEIGHBOUR_DIRS.includes(d)) throw new Error('bad roof neighbour ' + d);
  return new Set(list);
}

/**
 * Pure: which neighbour directions of `cell` are roofed cells of the SAME house.
 * @param cell {x,y} roof cell
 * @param isSameHouseRoofed (x,y) => boolean, supplied by the game (see sameHouseRoofPredicate)
 */
export function roofNeighbours(cell, isSameHouseRoofed) {
  return new Set(NEIGHBOUR_DIRS.filter(d => {
    const [dx, dy] = NEIGHBOUR_OFFSETS[d];
    return isSameHouseRoofed(cell.x + dx, cell.y + dy) === true;
  }));
}

/**
 * Pure convenience: build the predicate from plain data the game already has.
 * @param houseCells the `cells` array of ONE house from evaluateModularHouses(s).houses (SPEC §5.1)
 * @param roofCells  [{x,y}] cells that hold a WOOD_ROOF with socket {type:'cell', level:2}
 * Returns (x,y) => true iff (x,y) is in that house AND roofed.
 */
export function sameHouseRoofPredicate(houseCells, roofCells) {
  const key = (x, y) => x + ':' + y, house = new Set(houseCells.map(p => key(p.x, p.y))),
    roofs = new Set(roofCells.map(p => key(p.x, p.y)));
  return (x, y) => house.has(key(x, y)) && roofs.has(key(x, y));
}

/**
 * Roof geometry for one cell given the set of same-house roofed neighbours.
 * - side not merged: sloped face from that eave up to the apex / ridge.
 * - side merged: no face (shared side); the ridge runs from the apex to that side's midpoint.
 * - corner whose two sides are merged: diagonal also merged -> flat top quad at ridge height
 *   (interior of a 2x2); diagonal not merged -> two valley triangles (inner corner of an L).
 * Faces tile the cell with no gap; faces of neighbouring cells are coplanar along shared sides.
 */
function roofGeometry(neighbours) {
  const m = neighbourSet(neighbours), merged = s => m.has(s), z0 = WALL_TOP_Z, h = ROOF_H;
  const C = k => [...CORNER_UV[k], 0], M = s => [...SIDE_MID[s], h], A = [0, 0, h];
  const faces3 = [], outlines3 = [], courses3 = [];
  // courses belong to a face (index) so only front-facing faces get them
  const course = (face, a1, b1, a2, b2) => { for (const f of [1 / 3, 2 / 3]) courses3.push({face, seg: [lerp(a1, b1, f), lerp(a2, b2, f)]}); };
  for (const s of EDGES) {
    if (merged(s)) { outlines3.push([A, M(s)]); continue; }   // ridge towards the shared side
    const [c1, c2] = SIDE_CORNERS[s], o1 = otherSide(c1, s), o2 = otherSide(c2, s);
    const top1 = merged(o1) ? M(o1) : A, top2 = merged(o2) ? M(o2) : A;
    const pts = [C(c1), C(c2)]; if (merged(o2)) pts.push(M(o2)); pts.push(A); if (merged(o1)) pts.push(M(o1));
    faces3.push({pts, tone: SLOPE_TONE[s]});
    outlines3.push([C(c1), C(c2)]);                            // eave
    course(faces3.length - 1, C(c1), top1, C(c2), top2);
  }
  for (const k of Object.keys(CORNER_UV)) {
    const [a, b] = CORNER_SIDES[k];
    if (!merged(a) && !merged(b)) outlines3.push([C(k), A]);   // hip
    else if (merged(a) && merged(b)) {
      if (m.has(CORNER_DIAG[k])) faces3.push({pts: [M(a), [...CORNER_UV[k], h], M(b), A], tone: 'top'});
      else {                                                     // valley at an inner corner
        faces3.push({pts: [C(k), M(a), A], tone: SLOPE_TONE[b]}, {pts: [C(k), M(b), A], tone: SLOPE_TONE[a]});
        outlines3.push([C(k), A]);
        course(faces3.length - 2, C(k), M(a), C(k), A); course(faces3.length - 1, C(k), M(b), C(k), A);
      }
    }
  }
  const proj3 = p => P(p[0], p[1], z0 + p[2]);
  const faces = faces3.map(f => {
    const points = f.pts.map(proj3), uv = f.pts.map(p => [p[0], p[1]]);
    return {points, uv3: f.pts, tone: f.tone, front: Math.sign(area2(points)) === Math.sign(area2(uv))};
  });
  return {
    faces,
    // an outline is drawn only if it borders at least one front-facing face (hidden back eaves/hips are skipped)
    outlines: outlines3.filter(seg => faces3.some((f, i) => faces[i].front &&
      seg.every(p => f.pts.some(q => q[0] === p[0] && q[1] === p[1] && q[2] === p[2])))).map(seg => seg.map(proj3)),
    details: courses3.filter(k => faces[k.face].front).map(k => ({points: k.seg.map(proj3), role: 'roofLine'})),
    roof: true
  };
}

/**
 * Geometry for one piece: {faces:[{points,tone,front?}], details:[{points,role}], outlines?, ghostLine?}.
 * tone: 'top'|'left'|'right'|'opening'. role maps to a palette stroke + width.
 * opts.neighbours is used by the roof only.
 */
export function pieceGeometry(piece, edge = null, opts = {}) {
  const z0 = WALL_BASE_Z, z1 = WALL_TOP_Z;
  if (piece === 'foundation') {
    const T = P(-.5, -.5, z0), R = P(.5, -.5, z0), B = P(.5, .5, z0), L = P(-.5, .5, z0);
    const planks = [-1 / 6, 1 / 6].map(v => ({points: [P(-.44, v, z0), P(.44, v, z0)], role: 'foundationPlank'}));
    return {
      faces: [
        {points: [P(-.5, .5, 0), P(.5, .5, 0), B, L], tone: 'left'},   // S slab side (lit)
        {points: [P(.5, .5, 0), P(.5, -.5, 0), R, B], tone: 'right'},  // E slab side (shaded)
        {points: [T, R, B, L], tone: 'top'}
      ],
      details: planks, shadow: true
    };
  }
  if (piece === 'wall') {
    assertEdge(edge);
    const tone = EDGE_TONE[edge];
    return {
      faces: [{points: panel(edge, 0, 1, z0, z1), tone}],
      details: [.25, .5, .75].map(t => ({points: [edgePoint(edge, t, z0 + 1), edgePoint(edge, t, z1 - 1)], role: 'wallPlank'})),
      ghostLine: [edgePoint(edge, 0, z0), edgePoint(edge, 1, z0)]
    };
  }
  if (piece === 'doorway') {
    assertEdge(edge);
    const tone = EDGE_TONE[edge], {from: d0, to: d1, height} = DOOR, zh = z0 + height;
    return {
      faces: [
        {points: panel(edge, d0, d1, z0, zh), tone: 'opening', ghost: false},  // shaded opening
        {points: panel(edge, 0, d0, z0, z1), tone},
        {points: panel(edge, d1, 1, z0, z1), tone},
        {points: panel(edge, d0, d1, zh, z1), tone}   // header above the opening
      ],
      details: [
        {points: [edgePoint(edge, .15, z0 + 1), edgePoint(edge, .15, z1 - 1)], role: 'wallPlank'},
        {points: [edgePoint(edge, .85, z0 + 1), edgePoint(edge, .85, z1 - 1)], role: 'wallPlank'},
        {points: [edgePoint(edge, d0 + .02, z0 + 2.5), edgePoint(edge, d1 - .02, z0 + 2.5)], role: 'rail'},
        {points: [edgePoint(edge, d0, z0), edgePoint(edge, d0, zh)], role: 'post'},
        {points: [edgePoint(edge, d1, z0), edgePoint(edge, d1, zh)], role: 'post'},
        {points: [edgePoint(edge, d0 - .03, zh), edgePoint(edge, d1 + .03, zh)], role: 'lintel'}
      ],
      ghostLine: [edgePoint(edge, 0, z0), edgePoint(edge, 1, z0)]
    };
  }
  if (piece === 'roof') return roofGeometry(opts.neighbours);
  throw new Error('unknown piece ' + piece);
}

const DETAIL_STYLE = Object.freeze({
  foundationPlank: [PALETTE.foundation.plank, 2],
  wallPlank: [PALETTE.wall.plank, 2],
  post: [PALETTE.doorway.post, 5],
  lintel: [PALETTE.doorway.lintel, 5],
  rail: [PALETTE.doorway.rail, 2],
  roofLine: [PALETTE.roof.line, 2]
});
const FACE_STYLE = Object.freeze({
  foundation: {top: [PALETTE.foundation.top, PALETTE.foundation.stroke],
    left: [PALETTE.foundation.left, PALETTE.foundation.stroke], right: [PALETTE.foundation.right, PALETTE.foundation.stroke]},
  wall: {left: [PALETTE.wall.left, PALETTE.wall.stroke], right: [PALETTE.wall.right, PALETTE.wall.stroke]},
  doorway: {left: [PALETTE.wall.left, PALETTE.wall.stroke], right: [PALETTE.wall.right, PALETTE.wall.stroke],
    opening: [PALETTE.doorway.opening, null]},
  roof: {left: [PALETTE.roof.left, PALETTE.roof.stroke], right: [PALETTE.roof.right, PALETTE.roof.stroke],
    top: [PALETTE.roof.top, PALETTE.roof.stroke]}
});

/** Roof alpha: opts.xray -> XRAY_ALPHA, else opaque (1). */
export function roofAlpha(opts = {}) { return opts.xray === true ? XRAY_ALPHA : 1; }
/**
 * Wall/doorway alpha (SPEC §10.8): opts.xray AND the edge is on the house's front (role 'front', or
 * 'interior' = foundations on both sides) -> XRAY_ALPHA. Back walls and unknown roles stay opaque.
 */
export function edgeAlpha(opts = {}) {
  return opts.xray === true && (opts.role === 'front' || opts.role === 'interior') ? XRAY_ALPHA : 1;
}

function fillFace(c, pts, fill) {
  c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  c.fillStyle = fill; c.fill();
}

function drawRoofSolid(c, g, alpha, rejected = false) {
  const palette = rejected ? PALETTE.roofRejected : PALETTE.roof;
  const style = {left:[palette.left,palette.stroke],right:[palette.right,palette.stroke],top:[palette.top,palette.stroke]};
  c.save(); c.globalAlpha = alpha;
  // Opaque: back-facing faces first (hidden anyway), then front-facing. Each face is also stroked with
  // its OWN fill colour (0.7 px) so coplanar faces of neighbouring cells meet with no anti-alias seam.
  // Translucent: front-facing faces only and no seal, so no area is painted twice (no alpha stacking).
  const faces = alpha < 1 ? g.faces.filter(f => f.front) : [...g.faces.filter(f => !f.front), ...g.faces.filter(f => f.front)];
  for (const f of faces) {
    const fill = style[f.tone][0]; fillFace(c, f.points, fill);
    if (alpha === 1) { c.strokeStyle = fill; c.lineWidth = .7; c.lineJoin = 'round'; c.stroke(); }
  }
  c.lineCap = 'round';
  for (const seg of g.outlines) line(c, seg, palette.stroke, .7);   // eaves, hips, ridges, valleys only
  c.lineCap = 'butt';
  for (const d of g.details) line(c, d.points, d.role === 'roofLine' ? palette.line : DETAIL_STYLE[d.role][0], d.role === 'roofLine' ? 2 : DETAIL_STYLE[d.role][1]);
  c.restore();
}

function drawSolid(c, piece, edge, opts = {}) {
  const g = pieceGeometry(piece, edge, opts);
  if (g.roof) { drawRoofSolid(c, g, roofAlpha(opts), opts.rejected === true); return; }
  const alpha = piece === 'wall' || piece === 'doorway' ? edgeAlpha(opts) : 1;
  c.save(); c.globalAlpha = alpha;
  if (g.shadow) ellipse(c, 0, 4, 20, 7, PALETTE.shadow);  // same station shadow as rustStation()
  // translucent doorway: leave the opening fully clear (no shade), so the interior reads through it
  const faces = alpha < 1 ? g.faces.filter(f => f.tone !== 'opening') : g.faces;
  for (const f of faces) { const [fill, stroke] = FACE_STYLE[piece][f.tone]; polygon(c, f.points, fill, stroke); }
  c.lineCap = 'butt';
  // translucent wall/doorway: drop the plank lines (keep outline + door frame) so they do not
  // cross the back door seen through it
  const details = alpha < 1 ? g.details.filter(d => d.role !== 'wallPlank') : g.details;
  for (const d of details) { const [color, width] = DETAIL_STYLE[d.role]; line(c, d.points, color, width); }
  c.restore();
}

/** Level 0, fills the whole tile. */
export function drawFoundation(c) { drawSolid(c, 'foundation'); }
/** Level 1 on local edge 'N'|'E'|'S'|'W' of the translated tile. opts {xray, role} -> edgeAlpha(). */
export function drawWall(c, edge, opts = {}) { drawSolid(c, 'wall', edge, opts); }
/** Level 1 on local edge 'N'|'E'|'S'|'W'; wall panels either side of a framed opening. opts as drawWall. */
export function drawDoorway(c, edge, opts = {}) { drawSolid(c, 'doorway', edge, opts); }
/**
 * Level 2, raised to wall-top height over the same foundation tile.
 * opts.neighbours: same-house roofed neighbour directions (Set/array), see roofNeighbours().
 * opts.xray: true -> alpha XRAY_ALPHA (Building Mode / hover). Default opaque.
 */
export function drawRoof(c, opts = {}) { drawSolid(c, 'roof', null, opts); }

/**
 * Translucent placement ghost.
 * @param piece 'foundation'|'wall'|'doorway'|'roof' (or the WOOD_* kind)
 * @param edge  local 'N'|'E'|'S'|'W' for wall/doorway, ignored otherwise
 * @param ok    the validator's `ok` for this exact snapped socket. Only `true` is green;
 *              false / undefined / anything else is red (fail-closed, SPEC §10.4).
 * @param opts  {neighbours} for a roof ghost that should join an existing same-house roof.
 */
export function drawGhost(c, piece, edge, ok, opts = {}) {
  const kind = PIECES[piece] ?? piece;
  const g = pieceGeometry(kind, edge, opts), style = ok === true ? PALETTE.ghost.valid : PALETTE.ghost.invalid;
  const faces = g.faces.filter(f => f.ghost !== false && f.front !== false);
  c.save();
  c.beginPath();
  for (const f of faces) {
    const pts = area2(f.points) < 0 ? [...f.points].reverse() : f.points;  // one winding -> no alpha stacking
    pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  }
  c.fillStyle = style.fill; c.fill('nonzero');
  c.strokeStyle = style.stroke; c.lineWidth = .7;
  if (g.outlines) for (const seg of g.outlines) line(c, seg, style.stroke, .7);
  else for (const f of faces) { c.beginPath(); f.points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.stroke(); }
  if (kind === 'doorway') for (const d of g.details) if (d.role === 'post' || d.role === 'lintel') line(c, d.points, style.stroke, 1.4);
  // Snapped socket marker (SPEC §3.4): the edge drawn as an iso line on the foundation surface.
  if (g.ghostLine) { c.lineCap = 'round'; line(c, g.ghostLine, style.stroke, 2); }
  // Glyph like the current BUILD ghost (✓ / ×), centred on the piece.
  const box = faces.flatMap(f => f.points), cx = box.reduce((s, p) => s + p[0], 0) / box.length,
    cy = box.reduce((s, p) => s + p[1], 0) / box.length;
  c.textAlign = 'center'; c.font = '12px system-ui'; c.fillStyle = PALETTE.ghost.glyphColor;
  c.fillText(style.glyph, cx, cy + 4);
  c.restore();
}

// ---- integration helpers (pure, read only the record passed in) ---------------------------
/** Mirror of the spec §1.2 helper (the game should import the real one from src/rust-stations.mjs). */
export function canonicalEdge(x, y, side) {
  if (side === 'N' || side === 'W') return {type: 'edge', x, y, side};
  if (side === 'S') return {type: 'edge', x, y: y + 1, side: 'N'};
  if (side === 'E') return {type: 'edge', x: x + 1, y, side: 'W'};
  throw new Error('side must be N|E|S|W, got ' + side);
}
const isCanonicalEdge = s => s?.type === 'edge' && (s.side === 'N' || s.side === 'W') && Number.isInteger(s.x) && Number.isInteger(s.y);
/**
 * Mirror of spec §1.2 edgeCells(): the two cells an edge separates, in a fixed order:
 * [0] = the socket cell (x,y)  -> this edge is that cell's N/W side (house BACK if the foundation is here)
 * [1] = (x,y-1) for N, (x-1,y) for W -> this edge is that cell's S/E side (house FRONT if the foundation is here)
 */
export function edgeCells(socket) {
  if (!isCanonicalEdge(socket)) throw new Error('edgeCells needs a canonical N/W edge socket');
  return socket.side === 'N' ? [{x: socket.x, y: socket.y}, {x: socket.x, y: socket.y - 1}]
    : [{x: socket.x, y: socket.y}, {x: socket.x - 1, y: socket.y}];
}

/**
 * Local edge of a canonical edge socket, seen from `cell`.
 * socket {side:'N'} of (x,y): from (x,y) it is 'N', from (x,y-1) it is 'S'.
 * socket {side:'W'} of (x,y): from (x,y) it is 'W', from (x-1,y) it is 'E'.
 * Returns null if `cell` does not touch that edge.
 */
export function localEdge(socket, cell) {
  if (!socket || socket.type !== 'edge') return null;
  if (socket.side === 'N' && cell.x === socket.x) return cell.y === socket.y ? 'N' : cell.y === socket.y - 1 ? 'S' : null;
  if (socket.side === 'W' && cell.y === socket.y) return cell.x === socket.x ? 'W' : cell.x === socket.x - 1 ? 'E' : null;
  return null;
}

/**
 * Front/back of a canonical edge relative to its house (SPEC §10.7).
 * @param socket canonical {type:'edge',x,y,side:'N'|'W'}
 * @param anchor the record's x,y (spec §1.3: the supporting foundation; lower station id if both sides)
 * @param hasFoundation optional (x,y)=>boolean from the game (e.g. foundation cells of evaluateModularHouses)
 * @returns {role:'back'|'front'|'interior'|'unknown', houseCell, houseEdge}
 *   back     = foundation only in the socket cell (x,y)            -> houseEdge N or W
 *   front    = foundation only in the across cell (x,y-1)/(x-1,y)  -> houseEdge S or E
 *   interior = foundations on BOTH sides (always one house, since adjacent foundations are one
 *              4-neighbour component). houseCell = anchor. Treated like front for x-ray (README UNKNOWN).
 *   unknown  = no foundation information matches (malformed record; drawn opaque)
 */
export function edgeRole(socket, anchor, hasFoundation = null) {
  const [own, across] = edgeCells(socket), same = (a, b) => a && b && a.x === b.x && a.y === b.y;
  let role = null;
  if (typeof hasFoundation === 'function') {
    const fo = hasFoundation(own.x, own.y) === true, fa = hasFoundation(across.x, across.y) === true;
    role = fo && fa ? 'interior' : fo ? 'back' : fa ? 'front' : null;
  }
  if (!role) role = same(anchor, own) ? 'back' : same(anchor, across) ? 'front' : 'unknown';
  const houseCell = role === 'back' ? own : role === 'front' ? across
    : same(anchor, own) || same(anchor, across) ? {x: anchor.x, y: anchor.y} : own;
  return {role, houseCell, houseEdge: localEdge(socket, houseCell)};
}

const EDGE_MID = Object.freeze({N: [0, -.5], E: [.5, 0], S: [0, .5], W: [-.5, 0]});
/**
 * Depth key for app.mjs render sort (SPEC §8.3). Reads only the record.
 * Edge = x+y of the edge midpoint, so canonical N of (x,y+1) == S of (x,y) == x+y+.5 and
 * canonical W of (x+1,y) == E of (x,y) == x+y+.5 (identical to the old per-foundation result).
 */
export function structureDepth(st) {
  const s = st.socket;
  if (s?.type === 'edge' && EDGE_MID[s.side]) return s.x + s.y + EDGE_MID[s.side][0] + EDGE_MID[s.side][1];
  if (s?.type === 'cell' && s.level === 2) return s.x + s.y + .3;
  return st.x + st.y + .15;  // foundation, legacy-inert, CRAFTING_TABLE_LV1, FURNACE (unchanged)
}

/**
 * Where/what to draw for an RS3-0.3 structure record, or null if this module does not own it
 * (non-structure stations and `socket.type:'legacy'` stay with rustStation(); non-canonical
 * E/S edge sockets are invalid in saves and are not drawn).
 * Edges: translate to the STORED socket cell (socket.x, socket.y) and draw local edge socket.side
 * (SPEC §10.7), never the anchor. `role` (front/back/interior) is for x-ray only.
 * @param ctx.hasFoundation optional (x,y)=>boolean; without it the role comes from the anchor.
 */
export function structureDrawInfo(st, ctx = {}) {
  const piece = PIECES[st?.kind], s = st?.socket;
  if (!piece || !s || s.type === 'legacy') return null;
  if ((piece === 'wall' || piece === 'doorway') && isCanonicalEdge(s)) {
    const {role, houseCell, houseEdge} = edgeRole(s, {x: st.x, y: st.y}, ctx.hasFoundation);
    return {piece, x: s.x, y: s.y, edge: s.side, depth: structureDepth(st), role, houseCell, houseEdge};
  }
  if (s.type === 'cell' && ((piece === 'foundation' && s.level === 0) || (piece === 'roof' && s.level === 2)))
    return {piece, x: s.x, y: s.y, edge: null, depth: structureDepth(st), role: null};
  return null;
}

/**
 * Draw one piece by name at the current (already translated) origin.
 * opts: {neighbours, xray} for roofs; {xray, role} for walls/doorways (role from structureDrawInfo).
 */
export function drawPiece(c, piece, edge = null, opts = {}) {
  if (piece === 'foundation') drawFoundation(c);
  else if (piece === 'wall') drawWall(c, edge, opts);
  else if (piece === 'doorway') drawDoorway(c, edge, opts);
  else if (piece === 'roof') drawRoof(c, opts);
  else throw new Error('unknown piece ' + piece);
}
