/** RP1 — deterministic autonomous Rust production coordinator.
 * It never completes work itself. It only issues existing validated Rust commands.
 */
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {rustCommand} from './rust-runtime.mjs?v=0.5.0';
import {ITEM_CATALOG} from './crafting-catalog.mjs?v=0.5.0';

export const PRODUCTION_PLAN_VERSION='RP1-0.2';
export const PRODUCTION_POLICY='rust-production-2';
export const PRODUCTION_RULES=Object.freeze({attemptPeriod:12,charcoalTarget:4,history:12,housePopulationBuffer:2,houseWood:12,houseStone:6,maxBuildings:12});

export const createProductionPlan=()=>({version:PRODUCTION_PLAN_VERSION,enabled:false,goal:null,lastAttemptTick:-1,history:[]});
export function ensureProductionPlan(s){if(s.productionPlan===undefined)s.productionPlan=createProductionPlan();return s.productionPlan;}

const eligible=s=>s.agents.filter(a=>a.alive&&canPerformProductiveWork(s,a)).sort((a,b)=>a.id-b.id);
const itemDef=(s,item)=>item&&ITEM_CATALOG[item.kind];
const bagItems=(s,kind=null)=>s.rustPossessions.items.filter(i=>i.location?.kind==='bag'&&(!kind||i.kind===kind));
const hasKind=(s,kind)=>s.rustPossessions.items.some(i=>i.kind===kind)||s.rustPossessions.orders.some(o=>o.recipe===kind);
const stationKind=(s,kind)=>s.rustStations.stations.some(st=>st.complete&&st.kind===kind);
const activeOrders=s=>s.rustPossessions.orders.length+s.rustMaterials.orders.length;
const completedHousing=s=>s.buildings.filter(b=>b.complete).length*6;
const needsHouse=s=>s.buildings.every(b=>b.complete)&&s.buildings.length<PRODUCTION_RULES.maxBuildings&&completedHousing(s)-eligible(s).length<=PRODUCTION_RULES.housePopulationBuffer;
const settlementCell=(s,isWalkable)=>{
  const camp=s.buildings.find(b=>b.type==='camp')??s.buildings[0];if(!camp)return null;
  const occupied=(x,y)=>s.buildings.some(b=>Math.abs(b.x-x)+Math.abs(b.y-y)<2)||s.nodes.some(n=>n.x===x&&n.y===y)||s.rustStations.stations.some(st=>st.x===x&&st.y===y);
  for(let radius=2;radius<=8;radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
    if(Math.abs(dx)!==radius&&Math.abs(dy)!==radius)continue;
    const x=camp.x+dx,y=camp.y+dy;
    if(!isWalkable(s,x,y)||s.tiles[y*30+x]!=='grass'||occupied(x,y))continue;
    return {x,y};
  }
  return null;
};
function queueHouse(s,isWalkable){
  if(!needsHouse(s))return null;
  if(s.stock.wood<PRODUCTION_RULES.houseWood||s.stock.stone<PRODUCTION_RULES.houseStone)return {ok:false,reason:'materials'};
  const cell=settlementCell(s,isWalkable);if(!cell)return {ok:false,reason:'no-placement-cell'};
  // Mirror the existing BUILD command contract here without a second work executor:
  // materials commit once, then normal BUILD candidates/workers finish the structure.
  s.stock.wood-=PRODUCTION_RULES.houseWood;s.stock.stone-=PRODUCTION_RULES.houseStone;
  const building={id:s.nextBuilding++,type:'shelter',x:cell.x,y:cell.y,complete:false,progress:0};
  s.buildings.push(building);
  return {ok:true,buildingId:building.id,x:cell.x,y:cell.y};
}
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
const equippedKind=(s,agentId,kind)=>{
  const e=s.rustPossessions.equipment.find(e=>e.agentId===agentId),item=e&&s.rustPossessions.items.find(i=>i.id===e.itemId);
  return item?.kind===kind;
};
function equipOwned(s,kind,profession,isWalkable){
  const items=bagItems(s,kind);if(!items.length)return null;
  const preferred=items.map(item=>({item,agent:s.agents.find(a=>a.id===item.location.agentId&&a.alive)})).filter(x=>x.agent).sort((a,b)=>(a.agent.profession===profession?-1:0)-(b.agent.profession===profession?-1:0)||a.agent.id-b.agent.id)[0];
  if(!preferred||equippedKind(s,preferred.agent.id,kind))return null;
  return rustCommand(s,'EQUIP_ITEM',{agentId:preferred.agent.id,itemId:preferred.item.id},isWalkable);
}
function placeOwnedStation(s,kind,isWalkable){
  const item=bagItems(s,kind)[0];if(!item)return null;
  const a=s.agents.find(a=>a.id===item.location.agentId&&a.alive);if(!a)return null;
  const cell=freeNeighbor(s,a,isWalkable);if(!cell)return {ok:false,reason:'no-placement-cell'};
  return rustCommand(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:item.id,...cell},isWalkable);
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
export function productionCommand(s,type,data={}){
  if(type!=='SET_PRODUCTION_POLICY')return null;
  const p=ensureProductionPlan(s),enabled=data.enabled===true;
  p.enabled=enabled;p.goal={goal:'policy',outcome:enabled?'enabled':'disabled',agentId:null,tick:s.tick};
  return {ok:true,enabled,message:enabled?'เปิดแผนผลิตอัตโนมัติแล้ว':'หยุดแผนผลิตอัตโนมัติแล้ว'};
}
export function stepProductionPlanning(s,isWalkable){
  const p=ensureProductionPlan(s);if(!p.enabled)return null;
  if(activeOrders(s)>0)return null;
  // Settlement growth is visible gameplay: RP1 may reserve one house plan when
  // capacity is nearly full. Existing BUILD workers remain the only executor.
  if(needsHouse(s)){
    const house=queueHouse(s,isWalkable);
    if(house?.ok){record(p,s.tick,'build-shelter','accepted');return house;}
  }
  // Resolve completed physical outputs before starting the next chain step.
  for(const [kind,profession] of [['STONE_AXE','woodcutter'],['STONE_PICKAXE','miner'],['HAMMER','builder']]){
    const r=equipOwned(s,kind,profession,isWalkable);if(r?.ok){record(p,s.tick,'equip-'+kind,'completed',r.agentId??null);return r;}
  }
  if(!stationKind(s,'CRAFTING_TABLE_LV1')){
    const placed=placeOwnedStation(s,'CRAFTING_TABLE_LV1',isWalkable);
    if(placed){if(placed.ok)record(p,s.tick,'place-crafting-table','completed');return placed.ok?placed:null;}
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
