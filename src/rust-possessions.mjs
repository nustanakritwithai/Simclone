import {CRAFT_STATIONS,ITEM_CATALOG,RECIPE_CATALOG,craftability} from './crafting-catalog.mjs';
import {reservedProcessingMaterials} from './rust-materials.mjs';

export const RUST_POSSESSIONS_VERSION='RS2-0.1';
export const RUST_POSSESSION_LIMITS=Object.freeze({bag:4,items:128,orders:12});
const copy=v=>JSON.parse(JSON.stringify(v));
const toolRecipe=id=>RECIPE_CATALOG[id]?.category==='tool'?RECIPE_CATALOG[id]:null;
const living=(s,id)=>s.agents?.find(a=>a.id===id&&a.alive===true);
const held=(p,id)=>p.items.filter(i=>i.location.kind==='bag'&&i.location.agentId===id);
const stationBuilding=(s,recipe,stationId)=>{
  if(recipe.station===CRAFT_STATIONS.HAND)return null;
  const physical=s.rustStations?.stations?.find(st=>st.id===stationId&&st.complete===true&&st.kind===recipe.station);
  if(physical)return physical;
  if(recipe.station===CRAFT_STATIONS.CRAFTING_TABLE_LV1)
    return s.buildings?.find(b=>b.id===stationId&&b.complete===true&&b.type==='crafting_table'&&(b.tier??1)>=1)??null;
  return null;
};

export function createRustPossessions(){
  return {version:RUST_POSSESSIONS_VERSION,nextItem:1,nextOrder:1,items:[],equipment:[],orders:[]};
}
export function reservedCraftMaterials(s){
  const total={wood:0,stone:0};
  for(const o of s.rustPossessions?.orders??[]){
    const r=toolRecipe(o.recipe);if(!r)continue;
    for(const [k,n] of Object.entries(r.materials))total[k]=(total[k]??0)+n;
  }
  return total;
}
export function availableCraftMaterials(s){
  const reserved=reservedCraftMaterials(s),processing=reservedProcessingMaterials(s);
  return {wood:(s.stock?.wood??0)-reserved.wood-(processing.wood??0),
    stone:(s.stock?.stone??0)-reserved.stone-(processing.stone??0)};
}
export function queueToolCraft(s,{agentId,recipeId,stationId=null}={}){
  const a=living(s,agentId),p=s.rustPossessions,r=toolRecipe(recipeId);
  if(!a||!p||!r)return {ok:false,reason:'actor-or-recipe'};
  if(p.orders.length>=RUST_POSSESSION_LIMITS.orders||p.items.length+p.orders.length>=RUST_POSSESSION_LIMITS.items)return {ok:false,reason:'capacity'};
  if(held(p,agentId).length+p.orders.filter(o=>o.agentId===agentId).length>=RUST_POSSESSION_LIMITS.bag)return {ok:false,reason:'bag-full'};
  if(p.orders.some(o=>o.agentId===agentId))return {ok:false,reason:'craft-busy'};
  let station=null;
  if(r.station!==CRAFT_STATIONS.HAND){
    station=stationBuilding(s,r,stationId);
    if(!station)return {ok:false,reason:'station'};
  }
  const check=craftability(s,recipeId,{stations:{
    [CRAFT_STATIONS.HAND]:1,
    [CRAFT_STATIONS.CRAFTING_TABLE_LV1]:station?1:0,
    [CRAFT_STATIONS.FURNACE]:0
  }});
  if(!check.ok)return check;
  const free=availableCraftMaterials(s);
  const missing={};
  for(const [k,n] of Object.entries(r.materials))if((free[k]??0)<n)missing[k]=n-(free[k]??0);
  if(Object.keys(missing).length)return {ok:false,reason:'materials',missing};
  const order={id:p.nextOrder++,agentId,recipe:recipeId,stationId:station?.id??null,work:0,startedTick:s.tick,lastWorkedTick:s.tick};
  p.orders.push(order);
  return {ok:true,orderId:order.id,recipeId,station:r.station,materials:{...r.materials},workRequired:r.work};
}
export function advanceToolCraft(s,agentId,{workRate=1}={}){
  const p=s.rustPossessions,a=living(s,agentId),o=p?.orders.find(o=>o.agentId===agentId);
  if(!p||!a||!o)return {ok:false,reason:'order'};
  const r=toolRecipe(o.recipe);if(!r)return {ok:false,reason:'recipe'};
  if(s.tick<=o.lastWorkedTick)return {ok:false,reason:'already-worked'};
  if(typeof workRate!=='number'||!Number.isFinite(workRate)||workRate<=0||workRate>1)return {ok:false,reason:'work-rate'};
  if(r.station!==CRAFT_STATIONS.HAND){
    const b=stationBuilding(s,r,o.stationId);
    if(!b||a.x!==b.x||a.y!==b.y)return {ok:false,reason:'not-at-station'};
  }
  o.lastWorkedTick=s.tick;o.work+=workRate;
  if(o.work<r.work)return {ok:true,completed:false,orderId:o.id,work:o.work};
  const free=availableCraftMaterials(s);
  for(const [k,n] of Object.entries(r.materials))if((free[k]??0)<0)return {ok:false,reason:'materials'};
  for(const [k,n] of Object.entries(r.materials))s.stock[k]-=n;
  const itemId=p.nextItem++;
  p.items.push({id:itemId,kind:r.output,createdBy:agentId,createdTick:s.tick,location:{kind:'bag',agentId}});
  p.orders=p.orders.filter(x=>x.id!==o.id);
  return {ok:true,completed:true,orderId:o.id,itemId,kind:r.output};
}
export function equipTool(s,agentId,itemId){
  const p=s.rustPossessions,a=living(s,agentId);
  const item=p?.items.find(i=>i.id===itemId&&i.location.kind==='bag'&&i.location.agentId===agentId);
  if(!a||!item||ITEM_CATALOG[item.kind]?.category!=='tool')return {ok:false,reason:'item'};
  p.equipment=p.equipment.filter(e=>e.agentId!==agentId);
  p.equipment.push({agentId,itemId});return {ok:true,itemId};
}
export function toolMultiplier(s,agentId,action){
  const p=s.rustPossessions,e=p?.equipment.find(e=>e.agentId===agentId);
  const item=e&&p.items.find(i=>i.id===e.itemId&&i.location.kind==='bag'&&i.location.agentId===agentId);
  const def=item&&ITEM_CATALOG[item.kind];
  return def?.workAction===action?Number(def.workMultiplier)||1:1;
}
export function releaseRustPossessionsOnDeath(s,agentId){
  const p=s.rustPossessions,a=s.agents?.find(a=>a.id===agentId);
  if(!p||!a||a.alive!==false)return {ok:false,reason:'not-dead'};
  let dropped=0;
  for(const i of held(p,agentId)){i.location={kind:'drop',agentId,tick:s.tick,x:a.x,y:a.y};dropped++;}
  const cancelled=p.orders.filter(o=>o.agentId===agentId).length;
  p.orders=p.orders.filter(o=>o.agentId!==agentId);p.equipment=p.equipment.filter(e=>e.agentId!==agentId);
  return {ok:true,dropped,cancelled};
}
export function rustPossessionsSnapshot(s,agentId){
  const p=s.rustPossessions;if(!p)return null;
  return copy({bag:held(p,agentId),equippedItemId:p.equipment.find(e=>e.agentId===agentId)?.itemId??null,
    order:p.orders.find(o=>o.agentId===agentId)??null,reserved:reservedCraftMaterials(s)});
}
