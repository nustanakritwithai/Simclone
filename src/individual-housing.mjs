import {isIndependent,guardianOf} from './individual-resources.mjs?v=0.5.0';
/**
 * Independent Clone World IC1 — individual home identity.
 *
 * Pure projection/planning helpers only. No second building/item ledger and no
 * persistence change. Placement execution remains Rust PLACE_STATION.
 */
import {evaluateModularHouses,nextHousePiece} from './housing.mjs?v=0.5.0';
import {canPlaceStation,foundationAt} from './rust-stations.mjs?v=0.5.0';
import {worldBounds} from './world-bounds.mjs?v=0.5.0';

export const INDIVIDUAL_HOME_VERSION='IC1-0.1';
export const INDIVIDUAL_HOME_RULES=Object.freeze({siteMinRadius:1,siteMaxRadius:8});
const DELTA=[[0,-1],[1,0],[0,1],[-1,0]];

const validOwner=(s,id)=>Number.isSafeInteger(id)&&id>0&&[...(s.agents??[]),...(s.archive??[])].some(a=>a.id===id)?id:null;
const houseFoundations=(s,h)=>h.cells.map(c=>foundationAt(s,c.x,c.y)).filter(Boolean).sort((a,b)=>a.id-b.id);

/**
 * Home ownership is evidence-derived from the first (lowest station id)
 * foundation in the connected modular house component.
 */
// Exact-input memoization of a pure projection. Never serialized; fixtures editing
// a piece in the same tick invalidate it too. Returned data is detached from cache.
const projections=new WeakMap();
function projectedHouses(s){
 const stations=s.rustStations?.stations??[],people=[...(s.agents??[]),...(s.archive??[])];
 const signature=JSON.stringify([stations.map(st=>[st.id,st.kind,st.x,st.y,st.placedBy,st.socket]),(s.buildings??[]).map(b=>[b.id,b.type,b.x,b.y]),people.map(a=>a.id)]);
 const old=projections.get(s);if(old?.signature===signature)return old.houses;
 const origins=new Map(stations.filter(st=>st.kind==='WOOD_FOUNDATION').map(st=>[st.id,st]));
 const houses=evaluateModularHouses(s).houses.map(h=>{const origin=origins.get(Number(h.houseId.slice(1)))??null;
  return {...h,ownerId:validOwner(s,origin?.placedBy),originStationId:origin?.id??null,origin:origin?{x:origin.x,y:origin.y}:null};
 });
 projections.set(s,{signature,houses});return houses;
}
export function individualHouses(s){return structuredClone(projectedHouses(s));}
export function homeOf(s,agentId,{completeOnly=false}={}){
 if(!Number.isSafeInteger(agentId))return null;
 const h=projectedHouses(s).filter(h=>h.ownerId===agentId&&(!completeOnly||h.complete)).sort((a,b)=>Number(b.complete)-Number(a.complete)||(a.originStationId??Infinity)-(b.originStationId??Infinity))[0];
 return h?structuredClone(h):null;
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
function reachableCells(s,a,isWalkable){
 const bounds=worldBounds(s),seen=new Set(),queue=[];
 if(!isWalkable(s,a.x,a.y))return seen;
 seen.add(a.x+':'+a.y);queue.push({x:a.x,y:a.y});
 for(let i=0;i<queue.length;i++)for(const [dx,dy] of DELTA){
  const x=queue[i].x+dx,y=queue[i].y+dy,k=x+':'+y;
  if(x<0||x>=bounds.w||y<0||y>=bounds.h||seen.has(k)||!isWalkable(s,x,y))continue;
  seen.add(k);queue.push({x,y});
 }
 return seen;
}
export function personalHomeSite(s,a,isWalkable=()=>true){
 if(!a?.alive||!Number.isInteger(a.x)||!Number.isInteger(a.y))return null;
 const existing=homeOf(s,a.id);
 if(existing?.origin)return {houseId:existing.houseId,origin:{...existing.origin},existing:true};
 const reach=reachableCells(s,a,isWalkable);
 const legal=(x,y)=>{
  if(!reach.has(x+':'+y)||hasAdjacentFoundation(s,x,y))return false;
  if(isIndependent(s)&&s.agents.some(b=>b.alive&&b.id!==a.id&&b.homePlan&&Math.abs(b.homePlan.x-x)+Math.abs(b.homePlan.y-y)<=1))return false;
  return canPlaceStation(s,{pieceKind:'WOOD_FOUNDATION',socket:{type:'cell',x,y}},isWalkable,{actor:false}).ok;
 };
 if(isIndependent(s)&&a.homePlan&&legal(a.homePlan.x,a.homePlan.y))return {houseId:null,origin:{x:a.homePlan.x,y:a.homePlan.y},existing:false};
 for(let r=INDIVIDUAL_HOME_RULES.siteMinRadius;r<=INDIVIDUAL_HOME_RULES.siteMaxRadius;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  if(Math.abs(dx)!==r&&Math.abs(dy)!==r)continue;
  const x=a.x+dx,y=a.y+dy;if(legal(x,y))return {houseId:null,origin:{x,y},existing:false};
 }
 return null;
}
/** Owned homes, or an evidenced guardian's home for a child. No stranger's home by proximity. */
export function survivalHome(s,a){
 const subject=guardianOf(s,a)??a,h=homeOf(s,subject?.id,{completeOnly:true});
 return h?.origin?{id:h.houseId,houseId:h.houseId,ownerId:h.ownerId,x:h.origin.x,y:h.origin.y}:null;
}
/** Own local workbench site, outside every reserved foundation cell. */
export function personalTableSite(s,a,isWalkable){
 const home=personalHomeSite(s,a,isWalkable);if(!home)return null;
 const reach=reachableCells(s,a,isWalkable);
 for(let radius=1;radius<=3;radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
  if(Math.abs(dx)!==radius&&Math.abs(dy)!==radius)continue;
  const x=home.origin.x+dx,y=home.origin.y+dy;
  if(!reach.has(x+':'+y)||s.agents.some(b=>b.alive&&b.homePlan&&b.homePlan.x===x&&b.homePlan.y===y))continue;
  const check=canPlaceStation(s,{pieceKind:'CRAFTING_TABLE_LV1',x,y},isWalkable,{actor:false});
  if(check.ok)return {x,y};
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

/** Same BUILD executor; only the personal target differs. */
export function pendingPersonalPlacements(s,a,isWalkable=()=>true){
  if(!a?.alive)return [];
  const bag=(s.rustPossessions?.items??[]).filter(i=>i.location?.kind==='bag'&&i.location.agentId===a.id);
  let piece=nextPersonalHomePiece(s,a,isWalkable);
  if(isIndependent(s)&&bag.some(i=>i.kind==='CRAFTING_TABLE_LV1')&&!s.rustStations.stations.some(st=>st.kind==='CRAFTING_TABLE_LV1'&&st.placedBy===a.id)){
    const site=personalTableSite(s,a,isWalkable);piece=site?{pieceKind:'CRAFTING_TABLE_LV1',socket:{type:'cell',...site}}:null;
  }
  if(!piece?.pieceKind)return [];
  const item=bag.filter(i=>i.kind===piece.pieceKind).sort((x,y)=>x.id-y.id)[0];if(!item)return [];
  const check=canPlaceStation(s,{pieceKind:piece.pieceKind,socket:piece.socket},isWalkable,{actor:false});
  return check.ok?[{pieceKind:piece.pieceKind,itemInstanceId:item.id,socket:check.socket??piece.socket,anchor:check.anchor,ownerId:a.id}]:[];
}
