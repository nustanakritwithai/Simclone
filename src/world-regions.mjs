/** MX2 — deterministic large-world regional generation field.
 * Regions are derived from seed + bounds + coordinates and are never a second
 * mutable world ledger. Engine generation and WorldSim presentation consume
 * the same pure regional evidence.
 */
import {worldBounds} from './world-bounds.mjs?v=0.5.0';

export const WORLD_REGION_VERSION='MX2-0.1';
export const WORLD_REGION_TYPES=Object.freeze([
  'riverlands','wetland','grassland','woodland','uplands','stone-ridge'
]);

export const REGION_RESOURCE_POLICY=Object.freeze({
  riverlands:Object.freeze({chance:.075,food:.60,wood:.25,stone:.15}),
  wetland:Object.freeze({chance:.095,food:.52,wood:.38,stone:.10}),
  grassland:Object.freeze({chance:.105,food:.48,wood:.30,stone:.22}),
  woodland:Object.freeze({chance:.14,food:.20,wood:.67,stone:.13}),
  uplands:Object.freeze({chance:.09,food:.14,wood:.28,stone:.58}),
  'stone-ridge':Object.freeze({chance:.115,food:.07,wood:.13,stone:.80})
});

const clamp=n=>Math.max(0,Math.min(1,n));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);

export function regionNoise(seed,x,y,salt=0){
  let n=(seed^Math.imul((x|0)+101+salt,374761393)^Math.imul((y|0)+313+salt,668265263))>>>0;
  n^=n>>>13;n=Math.imul(n,1274126177)>>>0;n^=n>>>16;
  return (n>>>0)/4294967296;
}

function field(seed,x,y,salt){
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=smooth(fx),v=smooth(fy);
  const a=regionNoise(seed,ix,iy,salt),b=regionNoise(seed,ix+1,iy,salt);
  const c=regionNoise(seed,ix,iy+1,salt),d=regionNoise(seed,ix+1,iy+1,salt);
  return lerp(lerp(a,b,u),lerp(c,d,u),v);
}

function validBounds(bounds){
  return bounds&&Number.isInteger(bounds.w)&&Number.isInteger(bounds.h)&&bounds.w>=2&&bounds.h>=2;
}

export function regionalRiverCenter(bounds,y){
  if(!validBounds(bounds)||!Number.isInteger(y)||y<0||y>=bounds.h)throw new Error('Invalid regional river input');
  const ny=y/(bounds.h-1);
  const base=(bounds.w-1)*.69,wave=(bounds.w-1)*.055;
  return Math.max(1,Math.min(bounds.w-2,Math.round(base+Math.sin(ny*Math.PI*3.1)*wave)));
}

export function worldRegionAt(seed,bounds,x,y){
  if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295||!validBounds(bounds)||
    !Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=bounds.w||y>=bounds.h)
    throw new Error('Invalid world region input');
  const nx=x/(bounds.w-1),ny=y/(bounds.h-1);
  const moisture=clamp(field(seed,nx*4.1,ny*3.6,211));
  const relief=clamp(field(seed,nx*3.4,ny*3.1,307));
  const canopy=clamp(field(seed,nx*4.7,ny*4.2,401));
  const riverCenter=regionalRiverCenter(bounds,y),riverDistance=Math.abs(x-riverCenter);
  const riverScale=Math.max(1,bounds.w/30);
  let region;
  if(riverDistance<=1.6*riverScale)region='riverlands';
  else if(riverDistance<=4.2*riverScale&&moisture>.40)region='wetland';
  else if(relief>.73&&canopy<.58)region='stone-ridge';
  else if(moisture>.59&&canopy>.47)region='woodland';
  else if(relief>.57)region='uplands';
  else region='grassland';
  return Object.freeze({
    region,
    moisture:+moisture.toFixed(4),
    relief:+relief.toFixed(4),
    canopy:+canopy.toFixed(4),
    riverCenter,
    riverDistance
  });
}

export function resourcePolicyForRegion(region){
  const policy=REGION_RESOURCE_POLICY[region];
  if(!policy)throw new Error('Invalid world region');
  return policy;
}

export function regionalResourceDecision(seed,bounds,x,y,{blocked=false}={}){
  const evidence=worldRegionAt(seed,bounds,x,y),policy=resourcePolicyForRegion(evidence.region);
  if(blocked)return Object.freeze({...evidence,spawn:false,type:null,chance:policy.chance});
  const spawnRoll=regionNoise(seed,x,y,503),typeRoll=regionNoise(seed,x,y,607);
  if(spawnRoll>=policy.chance)return Object.freeze({...evidence,spawn:false,type:null,chance:policy.chance});
  const type=typeRoll<policy.food?'food':typeRoll<policy.food+policy.wood?'wood':'stone';
  return Object.freeze({...evidence,spawn:true,type,chance:policy.chance});
}

export function createWorldRegionView(state){
  const bounds=worldBounds(state),counts=Object.fromEntries(WORLD_REGION_TYPES.map(k=>[k,0])),cells=[];
  for(let y=0;y<bounds.h;y++)for(let x=0;x<bounds.w;x++){
    const evidence=worldRegionAt(state.seed,bounds,x,y);counts[evidence.region]++;
    cells.push(Object.freeze({index:y*bounds.w+x,x,y,...evidence}));
  }
  return Object.freeze({
    version:WORLD_REGION_VERSION,
    width:bounds.w,height:bounds.h,
    cells:Object.freeze(cells),
    counts:Object.freeze(counts)
  });
}
