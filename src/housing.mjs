/** Modular housing — the ONLY definition of a complete house and of housing capacity.
 * Pure and deterministic: reads state, never writes it, never stores a derived "complete" flag.
 * RP1, the engine, survival summaries and UI must call these functions instead of re-deriving capacity.
 */
import {canPlaceStation,canonicalEdge,cellEdges,socketKey,foundationAt} from './rust-stations.mjs?v=0.5.0';

export const MODULAR_HOUSE_RULES=Object.freeze({
  minFoundations:1,maxFoundations:4, // 4-neighbour foundation component of 1..4 cells
  doorways:1,                        // exactly one DOORWAY on the perimeter; every other perimeter edge is a WALL
  roofOnEveryCell:true,
  capacityPerHouse:6,                // same as the removed Shelter so population balance is unchanged
  campCapacity:12,
  siteMinRadius:2,siteMaxRadius:8
});
const WALLISH=new Set(['WOOD_WALL','WOOD_DOORWAY']);
const DELTA={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]};
const pieceIndex=s=>{
  const m=new Map();
  for(const st of s.rustStations?.stations??[])if(st?.socket&&(st.socket.type==='cell'||st.socket.type==='edge'))m.set(socketKey(st.socket),st);
  return m;
};
const campOf=s=>(s.buildings??[]).find(b=>b.type==='camp')??(s.buildings??[])[0]??null;
// Doubled coordinates keep the edge midpoint distance integral (no floats reach state or ids).
const doorRank=(camp,cell,side)=>{
  if(!camp)return 0;
  const [dx,dy]=DELTA[side];
  return Math.abs(cell.x*2+dx-camp.x*2)+Math.abs(cell.y*2+dy-camp.y*2);
};
/** Houses = foundation components ordered by lowest foundation station id. */
export function evaluateModularHouses(s){
  const idx=pieceIndex(s),camp=campOf(s);
  const foundations=[...idx.values()].filter(st=>st.kind==='WOOD_FOUNDATION'&&st.socket.type==='cell'&&st.socket.level===0).sort((a,b)=>a.id-b.id);
  const byCell=new Map(foundations.map(f=>[f.x+':'+f.y,f])),seen=new Set(),houses=[];
  for(const f of foundations){
    if(seen.has(f.id))continue;
    const queue=[f],members=[];seen.add(f.id);
    while(queue.length){
      const c=queue.shift();members.push(c);
      for(const [dx,dy] of Object.values(DELTA)){const n=byCell.get((c.x+dx)+':'+(c.y+dy));if(n&&!seen.has(n.id)){seen.add(n.id);queue.push(n);}}
    }
    const cells=members.map(m=>({x:m.x,y:m.y})).sort((a,b)=>a.y-b.y||a.x-b.x),inside=new Set(cells.map(c=>c.x+':'+c.y));
    const perimeter=[];
    for(const c of cells)for(const side of ['N','E','S','W']){
      const [dx,dy]=DELTA[side];if(inside.has((c.x+dx)+':'+(c.y+dy)))continue;
      const socket=canonicalEdge(c.x,c.y,side);perimeter.push({cell:c,side,socket,piece:idx.get(socketKey(socket))??null});
    }
    const doorways=perimeter.filter(p=>p.piece?.kind==='WOOD_DOORWAY').length;
    const walled=perimeter.every(p=>WALLISH.has(p.piece?.kind));
    const roofs=cells.filter(c=>idx.get(`c2:${c.x}:${c.y}`)?.kind==='WOOD_ROOF').length;
    const tooLarge=cells.length>MODULAR_HOUSE_RULES.maxFoundations;
    const complete=!tooLarge&&cells.length>=MODULAR_HOUSE_RULES.minFoundations&&walled&&doorways===MODULAR_HOUSE_RULES.doorways&&roofs===cells.length;
    // Missing pieces in deterministic order: walls N,E,S,W per cell (skipping the door edge) -> doorway -> roofs.
    const empty=perimeter.filter(p=>!p.piece);
    const door=doorways>0?null:[...empty].sort((a,b)=>doorRank(camp,a.cell,a.side)-doorRank(camp,b.cell,b.side))[0]??null;
    const missing=tooLarge||doorways>MODULAR_HOUSE_RULES.doorways?[]:[
      ...empty.filter(p=>p!==door).map(p=>({pieceKind:'WOOD_WALL',socket:p.socket})),
      ...(door?[{pieceKind:'WOOD_DOORWAY',socket:door.socket}]:[]),
      ...cells.filter(c=>idx.get(`c2:${c.x}:${c.y}`)?.kind!=='WOOD_ROOF').map(c=>({pieceKind:'WOOD_ROOF',socket:{type:'cell',x:c.x,y:c.y,level:2}}))
    ];
    houses.push({houseId:'H'+f.id,cells,complete,doorways,missing:complete?[]:missing,capacity:complete?MODULAR_HOUSE_RULES.capacityPerHouse:0,
      ...(tooLarge?{reason:'too-large'}:doorways>MODULAR_HOUSE_RULES.doorways?{reason:'doorways'}:{})});
  }
  return {houses,capacity:houses.reduce((n,h)=>n+h.capacity,0)};
}
/** Housing capacity comes only from the completed camp and complete modular houses. Legacy Shelter is retired. */
export function housingCapacity(s){
  const camp=(s.buildings??[]).some(b=>b.type==='camp'&&b.complete)?MODULAR_HOUSE_RULES.campCapacity:0;
  return camp+evaluateModularHouses(s).capacity;
}
/** Unfinished housing work is modular-only; retired Shelter records never create work. */
export const unfinishedHousing=s=>evaluateModularHouses(s).houses.filter(h=>!h.complete).length;
export const completedHouseIds=s=>new Set(evaluateModularHouses(s).houses.filter(h=>h.complete).map(h=>h.houseId));
const reachableFromCamp=(s,camp,isWalkable)=>{
  const seen=new Set([camp.x+':'+camp.y]),queue=[camp];
  while(queue.length){const c=queue.shift();for(const [dx,dy] of Object.values(DELTA)){const x=c.x+dx,y=c.y+dy,k=x+':'+y;if(!seen.has(k)&&isWalkable(s,x,y)){seen.add(k);queue.push({x,y});}}}
  return seen;
};
/** Derived house plan (never persisted): an unfinished house first, otherwise a new 1x1 site
 * in the original camp-ring order. A new site must pass the shared validator (actor:false),
 * stay reachable, keep 2 cells from camp/shelters, and never touch another foundation.
 */
export function houseSite(s,isWalkable=()=>true){
  const open=evaluateModularHouses(s).houses.find(h=>!h.complete&&h.missing.length);
  if(open)return {houseId:open.houseId,origin:{...open.cells[0]},footprint:open.cells.length===1?'1x1':'component',existing:true};
  const camp=campOf(s);if(!camp)return null;
  let reach=null;
  for(let r=MODULAR_HOUSE_RULES.siteMinRadius;r<=MODULAR_HOUSE_RULES.siteMaxRadius;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    if(Math.abs(dx)!==r&&Math.abs(dy)!==r)continue;
    const x=camp.x+dx,y=camp.y+dy;
    if((s.buildings??[]).some(b=>Math.abs(b.x-x)+Math.abs(b.y-y)<2))continue;
    if(Object.values(DELTA).some(([ex,ey])=>foundationAt(s,x+ex,y+ey)))continue;
    if(cellEdges(x,y).some(e=>(s.rustStations?.stations??[]).some(st=>st.socket&&socketKey(st.socket)===socketKey(e))))continue;
    if(!canPlaceStation(s,{pieceKind:'WOOD_FOUNDATION',socket:{type:'cell',x,y}},isWalkable,{actor:false}).ok)continue;
    reach??=reachableFromCamp(s,camp,isWalkable);if(!reach.has(x+':'+y))continue;
    return {houseId:null,origin:{x,y},footprint:'1x1',existing:false};
  }
  return null;
}
/** First missing piece for a site: foundation -> walls (N,E,S,W, skipping the door) -> doorway -> roof. */
export function nextHousePiece(s,site){
  if(!site)return null;
  const {x,y}=site.origin;
  if(!foundationAt(s,x,y))return {pieceKind:'WOOD_FOUNDATION',socket:{type:'cell',x,y,level:0}};
  const house=evaluateModularHouses(s).houses.find(h=>h.cells.some(c=>c.x===x&&c.y===y));
  if(!house||house.complete)return null;
  return house.missing[0]??{blocked:true,reason:house.reason??'shape'};
}
/** BUILD targets for one person: only while RP1 is enabled, only the next missing piece, only if they carry it. */
export function pendingPlacements(s,a,isWalkable=()=>true){
  if(!a?.alive)return [];
  const bag=(s.rustPossessions?.items??[]).filter(i=>i.location?.kind==='bag'&&i.location.agentId===a.id&&['WOOD_FOUNDATION','WOOD_WALL','WOOD_DOORWAY','WOOD_ROOF'].includes(i.kind));
  if(!bag.length)return [];
  const piece=nextHousePiece(s,houseSite(s,isWalkable));if(!piece?.pieceKind)return [];
  const item=bag.filter(i=>i.kind===piece.pieceKind).sort((p,q)=>p.id-q.id)[0];if(!item)return [];
  const check=canPlaceStation(s,{pieceKind:piece.pieceKind,socket:piece.socket},isWalkable,{actor:false});
  if(!check.ok)return [];
  return [{pieceKind:piece.pieceKind,itemInstanceId:item.id,socket:check.socket,anchor:check.anchor}];
}
