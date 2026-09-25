/** RP1 — deterministic autonomous Rust production coordinator.
 * It never completes work itself. It only issues existing validated Rust commands.
 */
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {rustCommand} from './rust-runtime.mjs?v=0.5.0';
import {ITEM_CATALOG,RECIPE_CATALOG} from './crafting-catalog.mjs?v=0.5.0';
import {housingCapacity,evaluateModularHouses,houseSite,nextHousePiece} from './housing.mjs?v=0.5.0';
import {canonicalEdge,placementIdFor} from './rust-stations.mjs?v=0.5.0';
import {BIRTH_RULES} from './reproduction.mjs?v=0.5.0';

export const PRODUCTION_PLAN_VERSION='RP1-0.2';
export const PRODUCTION_POLICY='rust-production-2';
export const PRODUCTION_RULES=Object.freeze({attemptPeriod:12,charcoalTarget:4,history:12,housePopulationBuffer:6});

export const createProductionPlan=()=>({version:PRODUCTION_PLAN_VERSION,enabled:false,goal:null,lastAttemptTick:-1,history:[]});
export function ensureProductionPlan(s){
  if(s.productionPlan===undefined)s.productionPlan=createProductionPlan();
  if(s.productionPlan?.version==='RP1-0.1')s.productionPlan.version=PRODUCTION_PLAN_VERSION;
  return s.productionPlan;
}

const eligible=s=>s.agents.filter(a=>a.alive&&canPerformProductiveWork(s,a)).sort((a,b)=>a.id-b.id);
const itemDef=(s,item)=>item&&ITEM_CATALOG[item.kind];
const bagItems=(s,kind=null)=>s.rustPossessions.items.filter(i=>i.location?.kind==='bag'&&(!kind||i.kind===kind));
const hasKind=(s,kind)=>s.rustPossessions.items.some(i=>i.kind===kind)||s.rustPossessions.orders.some(o=>o.recipe===kind);
const stationKind=(s,kind)=>s.rustStations.stations.some(st=>st.complete&&st.kind===kind);
const activeOrders=s=>s.rustPossessions.orders.length+s.rustMaterials.orders.length;
// Housing need reads the single capacity definition in housing.mjs; RP1 never derives capacity itself.
const openHouse=s=>evaluateModularHouses(s).houses.some(h=>!h.complete);
const needsHouse=s=>{
  const cap=housingCapacity(s);
  return s.buildings.every(b=>b.complete)&&!openHouse(s)&&cap<BIRTH_RULES.maxPopulation&&cap-eligible(s).length<=PRODUCTION_RULES.housePopulationBuffer;
};
// Even with full RP1 disabled, settlement housing is autonomous once population pressure is visible.
// Starting six-person worlds stay baseline-equivalent; at population 7+ the coordinator uses only
// the existing Rust commands needed for Table -> Hammer -> modular house, then becomes idle again.
const autonomousHousingNeeded=s=>{
  const population=(s.agents??[]).filter(a=>a.alive).length,cap=housingCapacity(s);
  return population>6&&cap<BIRTH_RULES.maxPopulation&&cap-population<PRODUCTION_RULES.housePopulationBuffer;
};
const HOUSE_GOALS=new Set(['equip-HAMMER-house','craft-WOOD_FOUNDATION','craft-WOOD_WALL','craft-WOOD_DOORWAY','craft-WOOD_ROOF','place-house-piece']);
const roleAgent=(s,profession)=>{
  const xs=eligible(s),preferred=xs.filter(a=>a.profession===profession);
  return (preferred.length?preferred:xs)[0]??null;
};
const record=(p,tick,goal,outcome,agentId=null)=>{
  p.goal={goal,outcome,agentId,tick};p.history.push({...p.goal});
  if(p.history.length>PRODUCTION_RULES.history)p.history.splice(0,p.history.length-PRODUCTION_RULES.history);
};
const freeNeighbor=(s,a,isWalkable)=>{
  for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
    const x=a.x+dx,y=a.y+dy;
    if(!isWalkable(s,x,y))continue;
    if(s.buildings.some(b=>b.x===x&&b.y===y)||s.nodes.some(n=>n.x===x&&n.y===y)||s.rustStations.stations.some(st=>st.x===x&&st.y===y))continue;
    return {x,y};
  }return null;
};
/** Choose one hand tool per worker, not one competing choice per item kind.
 * Keep the current tool when no productive task needs a different one. An
 * equipment change must never consume the production coordinator's turn.
 */
function equipForWork(s,isWalkable){
  for(const a of eligible(s)){
    const tools=bagItems(s).filter(i=>i.location.agentId===a.id&&ITEM_CATALOG[i.kind]?.category==='tool').sort((x,y)=>x.id-y.id);
    if(!tools.length)continue;
    const equipped=s.rustPossessions.equipment.find(e=>e.agentId===a.id);
    const current=tools.find(i=>i.id===equipped?.itemId);
    const desired=tools.find(i=>ITEM_CATALOG[i.kind].workAction===a.task?.kind)??current??tools[0];
    if(current?.id===desired.id)continue;
    const r=rustCommand(s,'EQUIP_ITEM',{agentId:a.id,itemId:desired.id},isWalkable);
    if(r?.ok)return {...r,agentId:a.id,kind:desired.kind};
  }
  return null;
}
function placeOwnedStation(s,kind,isWalkable){
  const item=bagItems(s,kind)[0];if(!item)return null;
  const a=s.agents.find(a=>a.id===item.location.agentId&&a.alive);if(!a)return null;
  const cell=freeNeighbor(s,a,isWalkable);if(!cell)return {ok:false,reason:'no-placement-cell'};
  return rustCommand(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:item.id,...cell,placementId:placementIdFor(s.tick,a.id,item.id)},isWalkable);
}
function queueRecipe(s,recipeId,profession,isWalkable){
  const a=roleAgent(s,profession);if(!a)return {ok:false,reason:'no-worker'};
  return rustCommand(s,'CRAFT_ITEM',{agentId:a.id,recipeId},isWalkable);
}
function queueCharcoal(s,isWalkable){
  const furnace=s.rustStations.stations.filter(st=>st.complete&&st.kind==='FURNACE').sort((a,b)=>a.id-b.id)[0];
  if(!furnace)return {ok:false,reason:'station'};
  const a=eligible(s).sort((x,y)=>(Math.abs(x.x-furnace.x)+Math.abs(x.y-furnace.y))-(Math.abs(y.x-furnace.x)+Math.abs(y.y-furnace.y))||x.id-y.id)[0];
  if(!a)return {ok:false,reason:'no-worker'};
  return rustCommand(s,'PROCESS_CHARCOAL',{agentId:a.id,stationId:furnace.id},isWalkable);
}
/** Modular house after the tool chain and charcoal target. RP1 only orders pieces through the
 * existing CRAFT_ITEM/EQUIP_ITEM authorities; the BUILD task places them via PLACE_STATION.
 * The plan is derived from state each time (housing.mjs), so it is never persisted twice.
 */
function stepHousePlan(s,p,isWalkable){
  const open=openHouse(s),last=[...p.history].reverse().find(h=>HOUSE_GOALS.has(h.goal)||h.goal==='house-complete');
  // Blocked outcomes are recorded once, not every attempt period, so bounded history keeps its signal.
  const note=(goal,outcome,agentId=null)=>{if(p.goal?.goal!==goal||p.goal?.outcome!==outcome)record(p,s.tick,goal,outcome,agentId);};
  if(!open&&last&&last.goal!=='house-complete'){record(p,s.tick,'house-complete','completed');return {ok:true,houseComplete:true};}
  if(!open&&!needsHouse(s))return null;
  const builder=eligible(s).find(a=>bagItems(s,'HAMMER').some(i=>i.location.agentId===a.id));
  if(!builder){note('house-site','no-builder');return {ok:false,reason:'no-builder'};}
  const site=houseSite(s,isWalkable);
  if(!site){note('house-site','no-site');return {ok:false,reason:'no-site'};}
  const raw=nextHousePiece(s,site);
  if(!raw?.pieceKind){note('house-site',raw?.reason??'blocked');return {ok:false,reason:raw?.reason??'blocked'};}
  // Any E/S edge is canonicalized to N/W before it is compared, checked or used.
  const piece=raw.socket.type==='edge'?{...raw,socket:canonicalEdge(raw.socket.x,raw.socket.y,raw.socket.side)}:raw;
  const carrying=bagItems(s,piece.pieceKind).some(i=>i.location.agentId===builder.id);
  if(carrying){note('place-house-piece','waiting',builder.id);return {ok:true,waiting:true};}
  const equipped=s.rustPossessions.equipment.find(e=>e.agentId===builder.id),hammer=bagItems(s,'HAMMER').find(i=>i.location.agentId===builder.id);
  if(equipped?.itemId!==hammer.id){
    const r=rustCommand(s,'EQUIP_ITEM',{agentId:builder.id,itemId:hammer.id},isWalkable);
    record(p,s.tick,'equip-HAMMER-house',r?.ok?'completed':(r?.reason??'blocked'),builder.id);if(!r?.ok)return r;
  }
  const wood=RECIPE_CATALOG[piece.pieceKind].materials.wood??0;
  if(s.stock.wood<wood+BIRTH_RULES.woodSafetyFloor){note('craft-'+piece.pieceKind,'materials');return {ok:false,reason:'materials'};}
  const r=rustCommand(s,'CRAFT_ITEM',{agentId:builder.id,recipeId:piece.pieceKind},isWalkable);
  record(p,s.tick,'craft-'+piece.pieceKind,r?.ok?'accepted':(r?.reason??'blocked'),r?.ok?builder.id:null);
  return r;
}
export function productionCommand(s,type,data={}){
  if(type!=='SET_PRODUCTION_POLICY')return null;
  const p=ensureProductionPlan(s),enabled=data.enabled===true;
  p.enabled=enabled;p.goal={goal:'policy',outcome:enabled?'enabled':'disabled',agentId:null,tick:s.tick};
  return {ok:true,enabled,message:enabled?'เปิดแผนผลิตอัตโนมัติแล้ว':'หยุดแผนผลิตอัตโนมัติแล้ว'};
}
export function stepProductionPlanning(s,isWalkable,dispatch=null){
  const p=ensureProductionPlan(s),housingOnly=p.enabled!==true&&autonomousHousingNeeded(s);
  if(!p.enabled&&!housingOnly)return null;
  if(activeOrders(s)>0)return null;
  // Resolve completed physical outputs before starting the next chain step.
  const equipped=equipForWork(s,isWalkable);
  if(equipped?.ok)record(p,s.tick,'equip-'+equipped.kind,'completed',equipped.agentId);
  if(!stationKind(s,'CRAFTING_TABLE_LV1')){
    const placed=placeOwnedStation(s,'CRAFTING_TABLE_LV1',isWalkable);
    if(placed){if(placed.ok)record(p,s.tick,'place-crafting-table','completed');return placed.ok?placed:null;}
  }
  if(housingOnly){
    if(s.tick-p.lastAttemptTick<PRODUCTION_RULES.attemptPeriod)return null;p.lastAttemptTick=s.tick;
    if(!stationKind(s,'CRAFTING_TABLE_LV1')&&!hasKind(s,'CRAFTING_TABLE_LV1')){
      const r=queueRecipe(s,'CRAFTING_TABLE_LV1','builder',isWalkable);record(p,s.tick,'craft-CRAFTING_TABLE_LV1',r?.ok?'accepted':(r?.reason??'blocked'),r?.ok?roleAgent(s,'builder')?.id??null:null);return r?.ok?r:null;
    }
    if(stationKind(s,'CRAFTING_TABLE_LV1')&&!hasKind(s,'HAMMER')){
      const r=queueRecipe(s,'HAMMER','builder',isWalkable);record(p,s.tick,'craft-HAMMER',r?.ok?'accepted':(r?.reason??'blocked'),r?.ok?roleAgent(s,'builder')?.id??null:null);return r?.ok?r:null;
    }
    const house=stepHousePlan(s,p,isWalkable);
    return house?.ok?house:null;
  }
  if(!stationKind(s,'FURNACE')){
    const placed=placeOwnedStation(s,'FURNACE',isWalkable);
    if(placed){if(placed.ok)record(p,s.tick,'place-furnace','completed');return placed.ok?placed:null;}
  }
  if(s.tick-p.lastAttemptTick<PRODUCTION_RULES.attemptPeriod)return null;p.lastAttemptTick=s.tick;
  const goals=[
    ['STONE_AXE','woodcutter',()=>!hasKind(s,'STONE_AXE')],
    ['STONE_PICKAXE','miner',()=>!hasKind(s,'STONE_PICKAXE')],
    ['CRAFTING_TABLE_LV1','builder',()=>!stationKind(s,'CRAFTING_TABLE_LV1')&&!hasKind(s,'CRAFTING_TABLE_LV1')],
    ['HAMMER','builder',()=>stationKind(s,'CRAFTING_TABLE_LV1')&&!hasKind(s,'HAMMER')],
    ['FURNACE','builder',()=>!stationKind(s,'FURNACE')&&!hasKind(s,'FURNACE')]
  ];
  for(const [recipe,profession,needed] of goals)if(needed()){
    const r=queueRecipe(s,recipe,profession,isWalkable);record(p,s.tick,'craft-'+recipe,r?.ok?'accepted':(r?.reason??'blocked'),r?.ok?roleAgent(s,profession)?.id??null:null);return r?.ok?r:null;
  }
  if(s.rustMaterials.charcoal<PRODUCTION_RULES.charcoalTarget){
    const r=queueCharcoal(s,isWalkable);record(p,s.tick,'charcoal',r?.ok?'accepted':(r?.reason??'blocked'));return r?.ok?r:null;
  }
  // Shelter BUILD is gone; settlement growth is one modular house at a time, after Hammer and charcoal.
  const house=stepHousePlan(s,p,isWalkable);
  if(house)return house.ok?house:null;
  if(p.goal?.goal!=='stable')record(p,s.tick,'stable','target-met');
  return null;
}
export function validateProductionPlan(s){
  const p=s.productionPlan;if(!p)return ['Production plan'];
  const e=[];if(p.version!==PRODUCTION_PLAN_VERSION||typeof p.enabled!=='boolean'||!Number.isInteger(p.lastAttemptTick)||p.lastAttemptTick>s.tick||!Array.isArray(p.history)||p.history.length>PRODUCTION_RULES.history)e.push('Production plan');
  const valid=row=>row===null||row&&typeof row.goal==='string'&&typeof row.outcome==='string'&&Number.isInteger(row.tick)&&row.tick>=0&&row.tick<=s.tick&&(row.agentId===null||Number.isSafeInteger(row.agentId));
  if(!valid(p.goal)||p.history.some(x=>!valid(x)))e.push('Production plan history');
  return [...new Set(e)];
}
