import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {resourceStock,isIndependent} from './individual-resources.mjs?v=0.5.0';
import {ITEM_CATALOG,RECIPE_CATALOG,CRAFT_STATIONS,craftability} from './crafting-catalog.mjs?v=0.5.0';
import {availableStationKinds,stationForRecipe} from './rust-stations.mjs?v=0.5.0';
export const RUST_POSSESSIONS_VERSION='RS2-0.2';
export const RUST_POSSESSION_LIMITS=Object.freeze({bag:4,items:128,orders:12});
export const createRustPossessions=()=>({version:RUST_POSSESSIONS_VERSION,nextItem:1,nextOrder:1,items:[],equipment:[],orders:[]});
const living=(s,id)=>s.agents?.find(a=>a.id===id&&a.alive);
const bag=(p,id)=>p.items.filter(i=>i.location?.kind==='bag'&&i.location.agentId===id);
export function queueCraft(s,{agentId,recipeId,stationId=null}={}){
  const p=s.rustPossessions,a=living(s,agentId),r=RECIPE_CATALOG[recipeId];
  if(isIndependent(s)&&a&&!canPerformProductiveWork(s,a))return {ok:false,reason:'stage'};
  if(!p||!a||!r)return {ok:false,reason:'actor-or-recipe'};
  if(p.orders.some(o=>o.agentId===agentId))return {ok:false,reason:'craft-busy'};
  if(p.orders.length>=RUST_POSSESSION_LIMITS.orders||p.items.length+p.orders.length>=RUST_POSSESSION_LIMITS.items)return {ok:false,reason:'capacity'};
  if(bag(p,agentId).length+p.orders.filter(o=>o.agentId===agentId).length>=RUST_POSSESSION_LIMITS.bag)return {ok:false,reason:'bag-full'};
  const station=stationForRecipe(s,recipeId,a,stationId);
  if(r.station!==CRAFT_STATIONS.HAND&&!station)return {ok:false,reason:'station',station:r.station};
  const stock=resourceStock(s,a);
  const check=craftability({stock},recipeId,{stationKinds:availableStationKinds(s)});if(!check.ok)return check;
  // Atomic escrow: remove materials once at acceptance. Completion never spends again.
  for(const [k,n] of Object.entries(r.materials))stock[k]-=n;
  const order={id:p.nextOrder++,agentId,recipe:recipeId,stationId:station?.id??null,work:0,required:r.work,startedTick:s.tick,lastWorkedTick:s.tick,reserved:{...r.materials}};
  p.orders.push(order);
  return {ok:true,orderId:order.id,recipeId,stationId:order.stationId,reserved:{...order.reserved},workRequired:r.work};
}
export function advanceCraft(s,agentId,{workRate=1}={}){
  const p=s.rustPossessions,a=living(s,agentId),o=p?.orders.find(o=>o.agentId===agentId);
  if(!p||!a||!o)return {ok:false,reason:'order'};
  const r=RECIPE_CATALOG[o.recipe];if(!r)return {ok:false,reason:'recipe'};
  const st=stationForRecipe(s,o.recipe,a,o.stationId);
  if(r.station!==CRAFT_STATIONS.HAND&&(!st||a.x!==st.x||a.y!==st.y))return {ok:false,reason:'not-at-station'};
  if(s.tick<=o.lastWorkedTick)return {ok:false,reason:'already-worked'};
  if(!Number.isFinite(workRate)||workRate<=0||workRate>1)return {ok:false,reason:'work-rate'};
  o.lastWorkedTick=s.tick;o.work+=workRate;
  if(o.work<o.required)return {ok:true,completed:false,orderId:o.id,work:o.work,required:o.required};
  const itemId=p.nextItem++;p.items.push({id:itemId,kind:r.output,createdBy:agentId,createdTick:s.tick,location:{kind:'bag',agentId}});
  p.orders=p.orders.filter(x=>x.id!==o.id);
  return {ok:true,completed:true,orderId:o.id,itemId,kind:r.output};
}
export function grantAdventureLoot(s,{agentId,claimKey,items}={}){
  const p=s.rustPossessions,a=living(s,agentId);
  if(!p||!a||typeof claimKey!=='string'||claimKey.length===0||!Array.isArray(items)||items.length===0)return {ok:false,reason:'loot-input'};
  let total=0;
  const expected=new Map();
  for(const row of items){
    if(!row||typeof row.itemKind!=='string'||!ITEM_CATALOG[row.itemKind]?.adventureLoot||!Number.isSafeInteger(row.quantity)||row.quantity<1)return {ok:false,reason:'loot-item'};
    if(typeof row.rarity!=='string'||ITEM_CATALOG[row.itemKind].rarity!==row.rarity)return {ok:false,reason:'loot-rarity'};
    total+=row.quantity;if(!Number.isSafeInteger(total))return {ok:false,reason:'capacity'};
    expected.set(row.itemKind,(expected.get(row.itemKind)??0)+row.quantity);
  }
  const existing=p.items.filter(i=>i.sourceClaimKey===claimKey).sort((x,y)=>x.id-y.id);
  if(existing.length){
    const actual=new Map();for(const item of existing)actual.set(item.kind,(actual.get(item.kind)??0)+1);
    if(existing.length!==total||[...expected].some(([kind,n])=>actual.get(kind)!==n))return {ok:false,reason:'loot-claim-conflict'};
    return {ok:true,duplicate:true,claimKey,itemIds:existing.map(i=>i.id),bagged:existing.filter(i=>i.location?.kind==='bag').length,dropped:existing.filter(i=>i.location?.kind==='drop').length};
  }
  if(!Number.isSafeInteger(p.nextItem)||p.items.length+total>RUST_POSSESSION_LIMITS.items||p.nextItem+total>Number.MAX_SAFE_INTEGER)return {ok:false,reason:'capacity'};
  const bagFree=Math.max(0,RUST_POSSESSION_LIMITS.bag-bag(p,agentId).length);
  const created=[];let bagged=0,dropped=0,index=0;
  for(const row of items)for(let q=0;q<row.quantity;q++){
    const itemId=p.nextItem++,toBag=index<bagFree;
    const location=toBag?{kind:'bag',agentId}:{kind:'drop',sourceAgentId:agentId,tick:s.tick,x:a.x,y:a.y};
    p.items.push({id:itemId,kind:row.itemKind,createdBy:agentId,createdTick:s.tick,sourceClaimKey:claimKey,location});
    created.push(itemId);if(toBag)bagged++;else dropped++;index++;
  }
  return {ok:true,duplicate:false,claimKey,itemIds:created,bagged,dropped};
}
export function equipTool(s,agentId,itemId){
  const p=s.rustPossessions,a=living(s,agentId),item=p?.items.find(i=>i.id===itemId&&i.location?.kind==='bag'&&i.location.agentId===agentId);
  if(!p||!a||!item||ITEM_CATALOG[item.kind]?.category!=='tool'||ITEM_CATALOG[item.kind]?.equipSlot!=='hand')return {ok:false,reason:'item'};
  p.equipment=p.equipment.filter(e=>e.agentId!==agentId);p.equipment.push({agentId,itemId});return {ok:true,itemId,kind:item.kind,slot:'hand'};
}
export function unequipTool(s,agentId){
  const p=s.rustPossessions,a=living(s,agentId);
  if(!p||!a)return {ok:false,reason:'item'};
  const equipped=p.equipment.find(e=>e.agentId===agentId);
  if(!equipped)return {ok:true,changed:false,itemId:null,slot:'hand'};
  p.equipment=p.equipment.filter(e=>e.agentId!==agentId);
  return {ok:true,changed:true,itemId:equipped.itemId,slot:'hand'};
}
export function pickupDroppedItem(s,agentId,itemId){
  const p=s.rustPossessions,a=living(s,agentId),item=p?.items.find(i=>i.id===itemId&&i.location?.kind==='drop');
  if(!p||!a||!item)return {ok:false,reason:'item'};
  if(Math.abs(a.x-item.location.x)+Math.abs(a.y-item.location.y)>1)return {ok:false,reason:'range'};
  if(bag(p,agentId).length>=RUST_POSSESSION_LIMITS.bag)return {ok:false,reason:'bag-full'};
  item.location={kind:'bag',agentId};return {ok:true,itemId,kind:item.kind};
}
export function toolMultiplier(s,agentId,action){
  const p=s.rustPossessions,e=p?.equipment.find(e=>e.agentId===agentId),item=e&&p.items.find(i=>i.id===e.itemId&&i.location?.kind==='bag'&&i.location.agentId===agentId),def=item&&ITEM_CATALOG[item.kind];
  return def?.workAction===action?(Number(def.workMultiplier)||1):1;
}
export function releaseRustPossessionsOnDeath(s,agentId){
  const p=s.rustPossessions,a=s.agents?.find(a=>a.id===agentId);
  if(!p||!a||a.alive!==false)return {ok:false,reason:'not-dead'};
  let dropped=0;for(const i of bag(p,agentId)){i.location={kind:'drop',sourceAgentId:agentId,tick:s.tick,x:a.x,y:a.y};dropped++;}
  const cancelled=p.orders.filter(o=>o.agentId===agentId).length;
  // Escrow was committed at acceptance; death cancels unfinished work without duplicating materials back into stock.
  p.orders=p.orders.filter(o=>o.agentId!==agentId);p.equipment=p.equipment.filter(e=>e.agentId!==agentId);
  return {ok:true,dropped,cancelled};
}
export const rustPossessionsSnapshot=(s,agentId)=>{
  const equippedItemId=s.rustPossessions?.equipment.find(e=>e.agentId===agentId)?.itemId??null;
  return JSON.parse(JSON.stringify({bag:bag(s.rustPossessions,agentId),capacity:RUST_POSSESSION_LIMITS.bag,equippedItemId,equipment:{hand:equippedItemId},order:s.rustPossessions?.orders.find(o=>o.agentId===agentId)??null}));
};
