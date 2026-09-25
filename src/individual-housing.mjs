/**
 * Independent Clone World IC1 — individual home identity.
 *
 * Pure projection/planning helpers only. No second building/item ledger and no
 * persistence change. Placement execution remains Rust PLACE_STATION.
 */
import {evaluateModularHouses,nextHousePiece} from './housing.mjs?v=0.5.0';
import {canPlaceStation,foundationAt} from './rust-stations.mjs?v=0.5.0';

export const INDIVIDUAL_HOME_VERSION='IC1-0.1';
export const INDIVIDUAL_HOME_RULES=Object.freeze({siteMinRadius:1,siteMaxRadius:8});
const DELTA=[[0,-1],[1,0],[0,1],[-1,0]];

const validOwner=id=>Number.isSafeInteger(id)&&id>0?id:null;
const houseFoundations=(s,h)=>h.cells.map(c=>foundationAt(s,c.x,c.y)).filter(Boolean).sort((a,b)=>a.id-b.id);

/**
 * Home ownership is evidence-derived from the first (lowest station id)
 * foundation in the connected modular house component.
 */
export function individualHouses(s){
  return evaluateModularHouses(s).houses.map(h=>{
    const foundations=houseFoundations(s,h),origin=foundations[0]??null;
    return {...h,ownerId:validOwner(origin?.placedBy),originStationId:origin?.id??null,
      origin:origin?{x:origin.x,y:origin.y}:h.cells[0]??null};
  });
}

export function homeOf(s,agentId,{completeOnly=false}={}){
  if(!Number.isSafeInteger(agentId))return null;
  return individualHouses(s)
    .filter(h=>h.ownerId===agentId&&(!completeOnly||h.complete))
    .sort((a,b)=>Number(b.complete)-Number(a.complete)||(a.originStationId??Infinity)-(b.originStationId??Infinity))[0]??null;
}

export const isHomeless=(s,agentId)=>homeOf(s,agentId,{completeOnly:true})===null;

function hasAdjacentFoundation(s,x,y){
  return DELTA.some(([dx,dy])=>foundationAt(s,x+dx,y+dy));
}

/**
 * Deterministic personal site search around the person, not around Camp.
 * IC1 intentionally uses only legal placement geometry. Resource preference,
 * risk and private spatial knowledge belong to later IC slices.
 */
export function personalHomeSite(s,a,isWalkable=()=>true){
  if(!a?.alive||!Number.isFinite(a.x)||!Number.isFinite(a.y))return null;
  const existing=homeOf(s,a.id);
  if(existing?.origin)return {houseId:existing.houseId,origin:{...existing.origin},existing:true};

  for(let r=INDIVIDUAL_HOME_RULES.siteMinRadius;r<=INDIVIDUAL_HOME_RULES.siteMaxRadius;r++){
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      if(Math.abs(dx)!==r&&Math.abs(dy)!==r)continue;
      const x=a.x+dx,y=a.y+dy;
      if(hasAdjacentFoundation(s,x,y))continue;
      const check=canPlaceStation(s,{pieceKind:'WOOD_FOUNDATION',socket:{type:'cell',x,y}},isWalkable,{actor:false});
      if(check.ok)return {houseId:null,origin:{x,y},existing:false};
    }
  }
  return null;
}

/** First piece still needed for this person's own home. */
export function nextPersonalHomePiece(s,a,isWalkable=()=>true){
  const owned=homeOf(s,a?.id);
  if(owned?.complete)return null;
  const site=personalHomeSite(s,a,isWalkable);
  if(!site)return null;
  return nextHousePiece(s,site);
}
