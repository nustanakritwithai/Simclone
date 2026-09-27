/** Display V1 / D2 foundation — deterministic world hit resolution.
 * Pure presentation helper. It owns no DOM, camera, simulation or selection state.
 */

export const WORLD_HIT_RESOLVER_VERSION='display-d2-hit-resolver/v1';
export const WORLD_SELECTION_KINDS=Object.freeze([
  'agent','monster','building','station','drop','resource'
]);
export const WORLD_HIT_KINDS=Object.freeze([
  'event',...WORLD_SELECTION_KINDS
]);

// Current interaction semantics encoded explicitly for exact-distance ties.
// Event remains transient and never becomes persistent selection.
export const WORLD_HIT_KIND_PRIORITY=Object.freeze({
  event:0,
  agent:1,
  building:2,
  station:3,
  drop:4,
  monster:5,
  resource:6
});

const VALID_KIND=new Set(WORLD_HIT_KINDS);
const SELECTABLE_KIND=new Set(WORLD_SELECTION_KINDS);

const validId=id=>typeof id==='string'||Number.isSafeInteger(id);

function freeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value))Object.freeze(value);
  return value;
}

export function worldSelection(kind,id){
  if(!SELECTABLE_KIND.has(kind)||!validId(id))return null;
  return freeze({kind,id});
}

export function worldHitCandidate({kind,id,distance,hitRadius=Infinity,source='world'}={}){
  if(!VALID_KIND.has(kind)||!validId(id))return null;
  if(!Number.isFinite(distance)||distance<0)return null;
  if(!(hitRadius===Infinity||Number.isFinite(hitRadius))||hitRadius<0)return null;
  if(typeof source!=='string'||source.length===0)return null;
  return freeze({kind,id,distance,hitRadius,source});
}

export function resolveWorldHit(candidates=[]){
  if(!Array.isArray(candidates))return null;
  const rows=candidates
    .filter(Boolean)
    .filter(row=>VALID_KIND.has(row.kind)&&validId(row.id)&&Number.isFinite(row.distance)&&row.distance>=0)
    .filter(row=>{
      const radius=row.hitRadius===undefined?Infinity:row.hitRadius;
      return radius===Infinity||(Number.isFinite(radius)&&radius>=0&&row.distance<=radius);
    })
    .map(row=>({
      kind:row.kind,
      id:row.id,
      distance:row.distance,
      hitRadius:row.hitRadius===undefined?Infinity:row.hitRadius,
      source:typeof row.source==='string'&&row.source.length?row.source:'world'
    }))
    .sort((a,b)=>
      a.distance-b.distance||
      WORLD_HIT_KIND_PRIORITY[a.kind]-WORLD_HIT_KIND_PRIORITY[b.kind]||
      String(a.id).localeCompare(String(b.id))||
      a.source.localeCompare(b.source)
    );
  return rows.length?freeze(rows[0]):null;
}

export function selectionFromWorldHit(hit){
  if(!hit||!SELECTABLE_KIND.has(hit.kind)||!validId(hit.id))return null;
  return worldSelection(hit.kind,hit.id);
}
