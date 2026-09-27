/** Display V1 / D2 — deterministic world hit resolution.
 * Pure presentation helper. No DOM, camera, simulation state, commands, RNG or wall clock.
 */
export const WORLD_HIT_RESOLVER_VERSION='display-d2/v1';
export const WORLD_SELECTION_KINDS=Object.freeze(['agent','monster','drop','station','building','resource']);
export const WORLD_HIT_KINDS=Object.freeze(['event',...WORLD_SELECTION_KINDS]);

// Only used after screen-space distance ties exactly.
// Direct transient feedback wins first; actors/hostiles beat passive scenery.
export const WORLD_HIT_KIND_PRIORITY=Object.freeze({
  event:0,
  agent:1,
  monster:2,
  drop:3,
  station:4,
  building:5,
  resource:6
});

const HIT_KIND_SET=new Set(WORLD_HIT_KINDS);
const SELECTION_KIND_SET=new Set(WORLD_SELECTION_KINDS);
const validId=id=>typeof id==='string'||Number.isSafeInteger(id);
const frozen=value=>value&&typeof value==='object'?Object.freeze(value):value;

export function worldSelection(kind,id){
  if(!SELECTION_KIND_SET.has(kind)||!validId(id))return null;
  return frozen({kind,id});
}

export function worldHitCandidate({kind,id,distance,hitRadius=Infinity,source='world'}={}){
  if(!HIT_KIND_SET.has(kind)||!validId(id))return null;
  if(!Number.isFinite(distance)||distance<0)return null;
  if(!(hitRadius===Infinity||Number.isFinite(hitRadius))||hitRadius<0)return null;
  if(typeof source!=='string'||source.length===0)return null;
  return frozen({kind,id,distance,hitRadius,source});
}

export function resolveWorldHit(candidates=[]){
  if(!Array.isArray(candidates))return null;
  const rows=candidates.filter(Boolean).filter(row=>{
    if(!HIT_KIND_SET.has(row.kind)||!validId(row.id)||!Number.isFinite(row.distance)||row.distance<0)return false;
    const radius=row.hitRadius===undefined?Infinity:row.hitRadius;
    return radius===Infinity||(Number.isFinite(radius)&&radius>=0&&row.distance<=radius);
  }).map(row=>({
    kind:row.kind,id:row.id,distance:row.distance,
    hitRadius:row.hitRadius===undefined?Infinity:row.hitRadius,
    source:typeof row.source==='string'&&row.source.length?row.source:'world'
  })).sort((a,b)=>
    a.distance-b.distance||
    WORLD_HIT_KIND_PRIORITY[a.kind]-WORLD_HIT_KIND_PRIORITY[b.kind]||
    String(a.id).localeCompare(String(b.id))||
    a.source.localeCompare(b.source)
  );
  return rows.length?frozen(rows[0]):null;
}

export function selectionFromWorldHit(hit){
  return hit?worldSelection(hit.kind,hit.id):null;
}
