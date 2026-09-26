import {isIndependent,resourceAccount} from './individual-resources.mjs?v=0.5.0';
import {CRAFT_STATIONS,ITEM_CATALOG,RECIPE_CATALOG,PLACEABLE_KINDS} from './crafting-catalog.mjs?v=0.5.0';
export const RUST_STATIONS_VERSION='RS3-0.3';
export const STATION_LIMITS=Object.freeze({maxStations:64,independentMaxStations:512,interactionRange:1});
export const stationLimit=s=>isIndependent(s)?STATION_LIMITS.independentMaxStations:STATION_LIMITS.maxStations;
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export const createRustStations=()=>({version:RUST_STATIONS_VERSION,nextStation:1,stations:[],placements:[]});
export const stationAt=(s,id)=>s.rustStations?.stations.find(x=>x.id===id)??null;
export function availableStationKinds(s){
  const out={HAND:1,CRAFTING_TABLE_LV1:0,FURNACE:0};
  for(const st of s.rustStations?.stations??[])if(st.complete)out[st.kind]=(out[st.kind]??0)+1;
  return out;
}
export function stationForRecipe(s,recipeId,agent,preferredId=null){
  const r=RECIPE_CATALOG[recipeId];if(!r)return null;
  if(r.station===CRAFT_STATIONS.HAND)return {id:null,kind:'HAND',x:agent.x,y:agent.y,complete:true};
  const account=isIndependent(s)?resourceAccount(s,agent):null;
  const xs=(s.rustStations?.stations??[]).filter(st=>st.complete&&st.kind===r.station&&
    (!isIndependent(s)||st.placedBy===agent.id||account?.kind==='household'&&st.placedBy===account.ownerId)&&
    (preferredId===null||st.id===preferredId));
  return xs.sort((a,b)=>dist(agent,a)-dist(agent,b)||a.id-b.id)[0]??null;
}
const equippedHammer=(s,agentId)=>{
  const e=s.rustPossessions?.equipment?.find(e=>e.agentId===agentId),item=e&&s.rustPossessions?.items.find(i=>i.id===e.itemId);
  return item?.kind==='HAMMER';
};
const STRUCTURE_KINDS=new Set(['WOOD_FOUNDATION','WOOD_WALL','WOOD_DOORWAY','WOOD_ROOF']);
const GRID=Object.freeze({w:30,h:26});
/** Building Sockets v1: every structure piece occupies exactly one socket. The
 * level is always derived from the piece kind; clients never choose it.
 * Edge sockets are stored canonically as N or W only (S of (x,y) is N of
 * (x,y+1); E of (x,y) is W of (x+1,y)).
 */
export const SOCKET_RULES=Object.freeze({
  WOOD_FOUNDATION:Object.freeze({type:'cell',level:0}),
  WOOD_WALL:Object.freeze({type:'edge',level:1}),
  WOOD_DOORWAY:Object.freeze({type:'edge',level:1}),
  WOOD_ROOF:Object.freeze({type:'cell',level:2})
});
export const SIDES=Object.freeze(['N','E','S','W']);
export const PLACEMENT_LIMITS=Object.freeze({log:64,idLength:96});
export function canonicalEdge(x,y,side){
  if(side==='N'||side==='W')return {type:'edge',x,y,side,level:1};
  if(side==='S')return {type:'edge',x,y:y+1,side:'N',level:1};
  if(side==='E')return {type:'edge',x:x+1,y,side:'W',level:1};
  return null;
}
export const edgeCells=e=>e.side==='N'?[{x:e.x,y:e.y-1},{x:e.x,y:e.y}]:[{x:e.x-1,y:e.y},{x:e.x,y:e.y}];
export const cellEdges=(x,y)=>SIDES.map(side=>canonicalEdge(x,y,side));
export const socketKey=k=>k.type==='edge'?`e1:${k.x}:${k.y}:${k.side}`:k.type==='cell'?`c${k.level}:${k.x}:${k.y}`:`legacy:${k.x}:${k.y}`;
const inGrid=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<GRID.w&&y<GRID.h;
const isStructureKind=kind=>STRUCTURE_KINDS.has(kind);
const socketStations=s=>(s.rustStations?.stations??[]).filter(st=>st?.socket&&(st.socket.type==='cell'||st.socket.type==='edge'));
const pieceAt=(s,key)=>socketStations(s).find(st=>socketKey(st.socket)===key)??null;
export const foundationAt=(s,x,y)=>{const st=pieceAt(s,`c0:${x}:${y}`);return st?.kind==='WOOD_FOUNDATION'?st:null;};
/** Shape-only check of a socket for a piece kind. Returns the canonical socket or a reason. */
export function socketShape(kind,socket){
  const rule=SOCKET_RULES[kind];if(!rule)return {ok:false,reason:'socket-shape'};
  if(!socket||typeof socket!=='object')return {ok:false,reason:'socket-required'};
  if(socket.type!==rule.type)return {ok:false,reason:'socket-shape'};
  if(socket.level!==undefined&&socket.level!==rule.level)return {ok:false,reason:'socket-shape'};
  const {x,y}=socket;if(!Number.isInteger(x)||!Number.isInteger(y))return {ok:false,reason:'position'};
  if(rule.type==='cell'){
    if(socket.side!==undefined)return {ok:false,reason:'socket-shape'};
    if(!inGrid(x,y))return {ok:false,reason:'position'};
    return {ok:true,socket:{type:'cell',x,y,level:rule.level}};
  }
  // Non-canonical edges are rejected, never silently rewritten, so preview and placement cannot diverge.
  if(socket.side!=='N'&&socket.side!=='W')return {ok:false,reason:'socket-shape'};
  if(socket.side==='N'?(x<0||x>=GRID.w||y<0||y>GRID.h):(x<0||x>GRID.w||y<0||y>=GRID.h))return {ok:false,reason:'position'};
  return {ok:true,socket:{type:'edge',x,y,side:socket.side,level:1}};
}
const actorRange=(a,socket,anchor)=>{
  if(socket?.type!=='edge')return dist(a,anchor);
  return Math.min(...edgeCells(socket).filter(c=>inGrid(c.x,c.y)).map(c=>dist(a,c)));
};
/** The single read-only placement validator used by preview, planning and the executor.
 * Never writes state. `actor:false` is planning-only and must never be used to place.
 */
export function canPlaceStation(s,{agentId=null,itemInstanceId=null,pieceKind=null,socket=null,x,y,placementId=null}={},isWalkable=()=>true,{actor=true}={}){
  // Stage 1: shape.
  const item=itemInstanceId===null||itemInstanceId===undefined?null:(s.rustPossessions?.items??[]).find(i=>i.id===itemInstanceId)??null;
  if(actor&&!item)return {ok:false,reason:'actor-or-item',stage:'actor'};
  const kind=item?.kind??pieceKind;
  if(item&&pieceKind!==null&&pieceKind!==undefined&&pieceKind!==item.kind)return {ok:false,reason:'actor-or-item',stage:'shape'};
  const def=kind&&ITEM_CATALOG[kind];
  if(!def?.stationProvided)return {ok:false,reason:'actor-or-item',stage:'shape'};
  const structure=isStructureKind(def.stationProvided);
  let target,anchor;
  if(structure){
    // Legacy callers may still send a bare foundation cell; every other structure piece needs a socket.
    const raw=socket??(def.stationProvided==='WOOD_FOUNDATION'&&x!==undefined&&y!==undefined?{type:'cell',x,y}:null);
    const shape=socketShape(def.stationProvided,raw);if(!shape.ok)return {...shape,stage:'shape'};
    target=shape.socket;
  }else{
    const cx=socket?.x??x,cy=socket?.y??y;
    if(!inGrid(cx,cy))return {ok:false,reason:'position',stage:'shape'};
    anchor={x:cx,y:cy};
  }
  // Stage 2: structure.
  const stations=s.rustStations?.stations??[];
  const anchoredAt=(cx,cy)=>(s.buildings??[]).some(b=>b.x===cx&&b.y===cy)||(s.nodes??[]).some(n=>n.x===cx&&n.y===cy)||stations.some(st=>st.x===cx&&st.y===cy);
  if(!structure||def.stationProvided==='WOOD_FOUNDATION'){
    const c=anchor??{x:target.x,y:target.y};anchor=c;
    if(!isWalkable(s,c.x,c.y))return {ok:false,reason:'terrain',stage:'structure'};
    if(def.placementRule==='ground'&&s.tiles?.[c.y*GRID.w+c.x]!=='grass')return {ok:false,reason:'foundation-ground',stage:'structure'};
    if(anchoredAt(c.x,c.y))return {ok:false,reason:'occupied',stage:'structure'};
  }else if(target.type==='edge'){
    const supports=edgeCells(target).map(c=>inGrid(c.x,c.y)?foundationAt(s,c.x,c.y):null).filter(Boolean).sort((p,q)=>p.id-q.id);
    if(!supports.length)return {ok:false,reason:'support-foundation',stage:'structure'};
    if(pieceAt(s,socketKey(target)))return {ok:false,reason:'socket-occupied',stage:'structure'};
    anchor={x:supports[0].x,y:supports[0].y};
  }else{
    const walls=cellEdges(target.x,target.y).some(e=>['WOOD_WALL','WOOD_DOORWAY'].includes(pieceAt(s,socketKey(e))?.kind));
    if(!foundationAt(s,target.x,target.y)||!walls)return {ok:false,reason:'support-roof',stage:'structure'};
    if(pieceAt(s,socketKey(target)))return {ok:false,reason:'socket-occupied',stage:'structure'};
    anchor={x:target.x,y:target.y};
  }
  if(stations.length>=stationLimit(s))return {ok:false,reason:'capacity',stage:'structure'};
  // Stage 3: actor (only for real placement and actor-bound preview).
  if(actor){
    const a=s.agents?.find(a=>a.id===agentId&&a.alive);
    if(!a||item.location?.kind!=='bag'||item.location.agentId!==agentId)return {ok:false,reason:'actor-or-item',stage:'actor'};
    if(structure&&!equippedHammer(s,agentId))return {ok:false,reason:'hammer',stage:'actor'};
    if(isIndependent(s)&&kind==='WOOD_FOUNDATION'&&[[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>{const f=foundationAt(s,anchor.x+dx,anchor.y+dy);return f&&f.placedBy!==agentId;}))return {ok:false,reason:'ownership-boundary',stage:'actor'};
    if(actorRange(a,target,anchor)>STATION_LIMITS.interactionRange)return {ok:false,reason:'range',stage:'actor'};
    if(placementId!==null&&placementId!==undefined&&(typeof placementId!=='string'||!placementId.length||placementId.length>PLACEMENT_LIMITS.idLength))return {ok:false,reason:'placement-id',stage:'actor'};
    if(structure&&typeof placementId!=='string')return {ok:false,reason:'placement-id',stage:'actor'};
    if(placementId&&(s.rustStations?.placements??[]).some(p=>p.id===placementId))return {ok:false,reason:'placement-id-conflict',stage:'actor'};
  }
  return {ok:true,agentId,itemInstanceId,kind:def.stationProvided,buildingType:def.buildingType,structurePiece:structure,
    socket:target??null,anchor:{...anchor},level:target?.level??null,x:anchor.x,y:anchor.y,placementId:placementId??null};
}
export const validatePlacement=canPlaceStation;
/** Deterministic placement command id: no Date, Math.random or UUID. Side is never part of it. */
export const placementIdFor=(tick,agentId,itemInstanceId)=>'pl:'+tick+':'+agentId+':'+itemInstanceId;
const sameRequest=(st,data)=>{
  if(!st)return false;
  if(data.socket&&st.socket)return socketKey({level:SOCKET_RULES[st.kind]?.level,...data.socket})===socketKey(st.socket);
  return (data.x===undefined||data.x===st.x)&&(data.y===undefined||data.y===st.y);
};
/** Single writer of rustStations.stations. Consumes the item and creates the record atomically. */
export function placeStationFromItem(s,data={},isWalkable){
  const rs=s.rustStations,pid=data?.placementId;
  if(typeof pid==='string'){
    const row=(rs.placements??[]).find(p=>p.id===pid);
    if(row){
      const st=stationAt(s,row.stationId);
      return row.itemInstanceId===data.itemInstanceId&&sameRequest(st,data)?{ok:true,duplicate:true,stationId:row.stationId,kind:st?.kind??null}:{ok:false,reason:'placement-id-conflict'};
    }
  }
  // Permanent guard that does not depend on the bounded log: an item instance is placed at most once.
  if(Number.isSafeInteger(data?.itemInstanceId)&&rs.stations.some(st=>st.sourceItemId===data.itemInstanceId))return {ok:false,reason:'duplicate-item'};
  const item=(s.rustPossessions?.items??[]).find(i=>i.id===data?.itemInstanceId);
  // Tables/furnaces keep their old API; they receive the same deterministic id when the caller omits one.
  const request=pid===undefined||pid===null?(item&&!isStructureKind(ITEM_CATALOG[item.kind]?.stationProvided)?{...data,placementId:placementIdFor(s.tick,data.agentId,data.itemInstanceId)}:data):data;
  const check=canPlaceStation(s,request,isWalkable,{actor:true});if(!check.ok)return check;
  const p=s.rustPossessions;
  p.items=p.items.filter(i=>i.id!==check.itemInstanceId);p.equipment=p.equipment.filter(e=>e.itemId!==check.itemInstanceId);
  const id=rs.nextStation++;
  const record={id,kind:check.kind,buildingType:check.buildingType,x:check.x,y:check.y,complete:true,placedBy:check.agentId,placedTick:s.tick,structurePiece:check.structurePiece,
    ...(check.socket?{socket:{...check.socket}}:{}),sourceItemId:check.itemInstanceId,placementId:check.placementId};
  rs.stations.push(record);
  rs.placements.push({id:check.placementId,tick:s.tick,stationId:id,itemInstanceId:check.itemInstanceId});
  if(rs.placements.length>PLACEMENT_LIMITS.log)rs.placements.splice(0,rs.placements.length-PLACEMENT_LIMITS.log);
  return {ok:true,stationId:id,kind:check.kind,x:check.x,y:check.y,socket:check.socket,placementId:check.placementId};
}
/** The only RS3-0.2 -> RS3-0.3 migration. Deterministic and idempotent (RS3-0.3 is never touched).
 * Old full-cell wall/doorway/roof pieces become legacy-inert: they keep their cell and occupancy
 * but are neither support nor part of a house, and nothing is refunded.
 */
export function migrateRustStations(rs){
  if(!rs||rs.version!=='RS3-0.2'||!Array.isArray(rs.stations))return rs;
  for(const st of rs.stations){
    if(!st||typeof st!=='object')continue;
    if(st.kind==='WOOD_FOUNDATION')st.socket={type:'cell',x:st.x,y:st.y,level:0};
    else if(isStructureKind(st.kind))st.socket={type:'legacy',x:st.x,y:st.y,level:null};
    st.structurePiece=isStructureKind(st.kind);
    st.sourceItemId=null;st.placementId='legacy:'+st.id;
  }
  rs.placements=[];rs.version=RUST_STATIONS_VERSION;
  return rs;
}
/** Save validation for socket records: malformed new metadata is corruption, never repaired. */
export function validateRustStations(s){
  const rs=s.rustStations,e=[];
  if(!Array.isArray(rs.placements)||rs.placements.length>PLACEMENT_LIMITS.log||rs.placements.some(p=>!p||typeof p.id!=='string'||!Number.isInteger(p.tick)||p.tick<0||p.tick>s.tick||!Number.isSafeInteger(p.stationId)||!Number.isSafeInteger(p.itemInstanceId)))e.push('Rust placements');
  else if(new Set(rs.placements.map(p=>p.id)).size!==rs.placements.length)e.push('Rust placements');
  const keys=new Set(),items=new Set(),ids=new Set();
  for(const st of rs.stations){
    if(!st)continue;
    const structure=isStructureKind(st.kind);
    // Structure pieces always carry placement metadata; RS3 table/furnace records written before sockets may omit it.
    if(structure||st.placementId!==undefined){if(typeof st.placementId!=='string'||!st.placementId.length||st.placementId.length>PLACEMENT_LIMITS.idLength||ids.has(st.placementId))e.push('Rust placement id');ids.add(st.placementId);}
    if(structure&&st.sourceItemId===undefined)e.push('Rust station source');
    if(st.sourceItemId!==undefined&&st.sourceItemId!==null){if(!Number.isSafeInteger(st.sourceItemId)||items.has(st.sourceItemId))e.push('Rust station source');items.add(st.sourceItemId);}
    if(!structure){if(st.socket!==undefined)e.push('Rust station socket');continue;}
    const k=st.socket;
    if(!k||typeof k!=='object'){e.push('Rust station socket');continue;}
    if(k.type==='legacy'){
      if(st.kind==='WOOD_FOUNDATION'||k.level!==null||k.x!==st.x||k.y!==st.y||st.sourceItemId!==null)e.push('Rust station socket');
      continue;
    }
    const shape=socketShape(st.kind,k);
    if(!shape.ok||JSON.stringify(shape.socket)!==JSON.stringify(k)){e.push('Rust station socket');continue;}
    if(keys.has(socketKey(k)))e.push('Rust station socket');keys.add(socketKey(k));
    if(k.type==='cell'&&(st.x!==k.x||st.y!==k.y))e.push('Rust station anchor');
    if(k.type==='edge'&&!edgeCells(k).some(c=>c.x===st.x&&c.y===st.y))e.push('Rust station anchor');
  }
  return e;
}
export const RUST_PROCESSING_CATALOG=Object.freeze({
  CHARCOAL:Object.freeze({id:'CHARCOAL',station:'FURNACE',input:Object.freeze({wood:2}),output:Object.freeze({charcoal:1}),work:12,live:true}),
  COOKED_MEAT:Object.freeze({id:'COOKED_MEAT',station:'FURNACE',input:Object.freeze({raw_meat:1}),output:Object.freeze({cooked_meat:1}),work:12,live:false,reason:'meat-ledger-not-authoritative'}),
  CLEAN_WATER:Object.freeze({id:'CLEAN_WATER',station:'FURNACE',input:Object.freeze({dirty_water:1}),output:Object.freeze({clean_water:1}),work:12,live:false,reason:'water-ledger-not-authoritative'})
});
