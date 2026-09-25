/**
 * Simclone · modular building UI icons (DRAFT).
 * Same format and style as `paths` in src/ux.mjs L15-35 @ 9799a6ac:
 *   inner SVG markup for <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
 *   stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">.
 * Integration: merge BUILDING_ICON_PATHS into `paths` in ux.mjs, then icon('foundation') etc.
 * Iso shapes follow the in-game 2:1 diamond so the icons match the pieces on the map.
 */
export const BUILDING_ICON_PATHS = Object.freeze({
 // 2:1 diamond slab with a short front thickness and two planks
 foundation:'<path d="M12 6 22 11 12 16 2 11Z"/><path d="M2 11v2.5l10 5 10-5V11M12 16v2.5M8 9l8 4"/>',
 // upright panel along the iso axis with two planks
 wall:'<path d="M5 20V9l14-6v11Z"/><path d="M9.7 18V7M14.3 16V5"/>',
 // same panel with a framed opening
 doorway:'<path d="M5 20V9l14-6v11Z"/><path d="M9.5 18V12l5-2.1V16"/>',
 // low hip roof over a diamond footprint (front faces + hip line)
 roof:'<path d="M2 14 12 4l10 10-10 5Z"/><path d="M12 4v15M7 11.7l5 2.4 5-2.4"/>',
 // rotate edge / piece clockwise
 rotate:'<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4.5h-4.5"/>',
 // remove / demolish piece
 remove:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>'
});

/** Just the `d` attribute strings, for callers that build <path> elements themselves. */
export const BUILDING_ICON_D = Object.freeze(Object.fromEntries(Object.entries(BUILDING_ICON_PATHS)
 .map(([k,v])=>[k,[...v.matchAll(/ d="([^"]+)"/g)].map(m=>m[1])])));

/** Same wrapper as ux.mjs icon(). */
export const buildingIcon=name=>`<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${BUILDING_ICON_PATHS[name]||BUILDING_ICON_PATHS.foundation}</svg>`;
