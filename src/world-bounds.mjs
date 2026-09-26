/** MX0 — one authoritative world-bounds contract.
 * Legacy saves omit worldBounds and remain exactly 30×26.
 * New large worlds persist the profile explicitly so every runtime subsystem
 * can derive the same bounds without hard-coded grid constants.
 */
export const WORLD_BOUNDS_VERSION='MX0-0.1';
export const LEGACY_WORLD_BOUNDS=Object.freeze({profile:'legacy',w:30,h:26});
export const LARGE_WORLD_BOUNDS=Object.freeze({profile:'large',w:60,h:52});
export const WORLD_PROFILES=Object.freeze({
  legacy:LEGACY_WORLD_BOUNDS,
  large:LARGE_WORLD_BOUNDS
});
export const DEFAULT_WORLD_PROFILE='legacy';
export const PUBLIC_WORLD_PROFILE='large';

export function boundsForProfile(profile=DEFAULT_WORLD_PROFILE){
  const bounds=WORLD_PROFILES[profile];
  if(!bounds)throw new Error('Unsupported world profile');
  return bounds;
}
export function persistedWorldBounds(profile){
  const bounds=boundsForProfile(profile);
  if(profile==='legacy')return null;
  return {version:WORLD_BOUNDS_VERSION,profile:bounds.profile,w:bounds.w,h:bounds.h};
}
export function worldBounds(state){
  const raw=state?.worldBounds;
  if(raw===undefined||raw===null)return LEGACY_WORLD_BOUNDS;
  if(!raw||raw.version!==WORLD_BOUNDS_VERSION||!WORLD_PROFILES[raw.profile])throw new Error('Invalid world bounds');
  const canonical=WORLD_PROFILES[raw.profile];
  if(raw.w!==canonical.w||raw.h!==canonical.h)throw new Error('Invalid world bounds');
  return canonical;
}
export function validateWorldBoundsState(state){
  try{worldBounds(state);return [];}catch{return ['World bounds'];}
}
export function worldCellCount(state){const b=worldBounds(state);return b.w*b.h;}
export function inWorld(state,x,y){
  const b=worldBounds(state);
  return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<b.w&&y<b.h;
}
export const scaleLegacyX=(bounds,x)=>Math.max(0,Math.min(bounds.w-1,Math.round(x*(bounds.w-1)/(LEGACY_WORLD_BOUNDS.w-1))));
export const scaleLegacyY=(bounds,y)=>Math.max(0,Math.min(bounds.h-1,Math.round(y*(bounds.h-1)/(LEGACY_WORLD_BOUNDS.h-1))));
export const scaleLegacyPoint=(bounds,x,y)=>({x:scaleLegacyX(bounds,x),y:scaleLegacyY(bounds,y)});
