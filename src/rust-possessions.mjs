import {createCraftSpec,validateCraftSpec,resolveCraftOutcome,validateCraftedItem,craftedToolMultiplier} from './craft-outcome.mjs?v=0.5.0';
import {knowsCraftRecipe,validateRecipeKnowledge,recipeCompletionProposal,craftFamilyMastery,RECIPE_KNOWLEDGE_VERSION} from './craft-recipe-knowledge.mjs?v=0.5.0';
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {resourceStock,isIndependent} from './individual-resources.mjs?v=0.5.0';
import {ITEM_CATALOG,CRAFT_RECIPE_CATALOG as RECIPE_CATALOG,CRAFT_STATIONS,craftability} from './crafting-catalog.mjs?v=0.5.0';
import {availableStationKinds,stationForRecipe} from './rust-stations.mjs?v=0.5.0';
export const RUST_POSSESSIONS_VERSION='RS2-0.2';
export const RUST_POSSESSION_LIMITS=Object.freeze({bag:4,items:128,orders:12});
export const createRustPossessions=()=>({version:RUST_POSSESSIONS_VERSION,nextItem:1,nextOrder:1,items:[],equipment:[],orders:[]});
const living=(s,id)=>s.agents?.find(a=>a.id===id&&a.alive);
const bag=(p,id)=>p.items.filter(i=>i.location?.kind==='bag'&&i.location.agentId===id);
export const RUST_EQUIPMENT_SLOTS=Object.freeze(['hand','WEAPON','ARMOR','ACCESSORY']);
export const equipmentSlotOf=e=>e?.slot??'hand';
const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
const sameMaterials=(a,b)=>a&&b&&Object.keys(a).length===Object.keys(b).length&&Object.entries(b).every(([key,n])=>a[key]===n);
/** Read source ledgers, never create a second spendable ingredient inventory. */
function reservedLootItemIds(s){
  return new Set((s.agents??[]).flatMap(a=>a.adventureCombat?.lootClaim?.itemIds??[]));
}
function selectedCraftIngredients(s,a,r){
  const p=s.rustPossessions,equipped=new Set(p.equipment.map(e=>e.itemId)),held=reservedLootItemIds(s),selected=[],missing={};
  for(const [kind,quantity] of Object.entries(r.itemMaterials??{})){
    const available=p.items.filter(i=>i.kind===kind&&i.location?.kind==='bag'&&i.location.agentId===a.id&&
      !equipped.has(i.id)&&!held.has(i.id)).sort((x,y)=>x.id-y.id);
    const chosen=available.slice(0,quantity);selected.push(...chosen);
    if(chosen.length<quantity)missing[kind]=quantity-chosen.length;
  }
  return {selected,missing};
}
function checkCraft(s,{agentId,recipeId,stationId=null}={}){
  const p=s.rustPossessions,a=living(s,agentId),r=Object.hasOwn(RECIPE_CATALOG,recipeId??'')?RECIPE_CATALOG[recipeId]:null;
  if(a&&!canPerformProductiveWork(s,a))return {ok:false,reason:'stage'};
  if(!p||!a||!r)return {ok:false,reason:'actor-or-recipe'};
  if(validateRecipeKnowledge(s,a).length)return {ok:false,reason:'recipe-knowledge'};
  if(!knowsCraftRecipe(s,a,recipeId))return {ok:false,reason:'recipe-unknown'};
  if(a.adventureCombat?.status==='ACTIVE')return {ok:false,reason:'combat-active'};
  if(p.orders.some(o=>o.agentId===agentId))return {ok:false,reason:'craft-busy'};
  if(!integer(p.nextOrder,1)||p.nextOrder>=Number.MAX_SAFE_INTEGER||!integer(p.nextItem,1)||p.nextItem>=Number.MAX_SAFE_INTEGER)return {ok:false,reason:'capacity'};
  const {selected,missing}=selectedCraftIngredients(s,a,r);
  if(Object.keys(missing).length)return {ok:false,reason:'item-materials',missing};
  if(p.orders.length>=RUST_POSSESSION_LIMITS.orders||p.items.length-selected.length+p.orders.length>=RUST_POSSESSION_LIMITS.items)return {ok:false,reason:'capacity'};
  if(bag(p,agentId).length-selected.length>=RUST_POSSESSION_LIMITS.bag)return {ok:false,reason:'bag-full'};
  const station=stationForRecipe(s,recipeId,a,stationId);
  if(r.station!==CRAFT_STATIONS.HAND&&!station)return {ok:false,reason:'station',station:r.station};
  const stock=resourceStock(s,a),check=craftability({stock},recipeId,{stationKinds:availableStationKinds(s)});if(!check.ok)return check;
  if(selected.some(i=>!validateCraftedItem(i,s.seed)))return {ok:false,reason:'craft-item-invalid'};
  return {ok:true,p,a,r,station,stock,selected};
}
export function craftPreview(s,data={}){
  const check=checkCraft(s,data);if(!check.ok)return check;
  const {r,station,selected}=check;
  return {ok:true,recipeId:r.id,output:r.output,tier:r.tier,station:r.station,stationId:station?.id??null,
    materials:{...r.materials},itemMaterials:{...r.itemMaterials},ingredientIds:selected.map(i=>i.id),work:r.work};
}
export function queueCraft(s,data={}){
  const check=checkCraft(s,data);if(!check.ok)return check;
  const {p,a,r,station,stock,selected}=check;
  const id=p.nextOrder,craftSpec=createCraftSpec({worldSeed:s.seed,orderId:id,creatorId:a.id,recipeId:r.id,mastery:craftFamilyMastery(a,r.id)});
  // Only audit receipts survive escrow. Selected item IDs are no longer spendable.
  const reservedItems=selected.map(i=>({itemId:i.id,kind:i.kind,createdBy:i.createdBy}));
  const order={id,agentId:a.id,recipe:r.id,stationId:station?.id??null,work:0,required:r.work,startedTick:s.tick,lastWorkedTick:s.tick,
    reserved:{...r.materials},recipeKnowledge:RECIPE_KNOWLEDGE_VERSION,craftSpec,reservedItems};
  for(const [key,n] of Object.entries(r.materials))stock[key]-=n;
  const consumed=new Set(selected.map(i=>i.id));if(consumed.size)p.items=p.items.filter(i=>!consumed.has(i.id));
  p.nextOrder++;p.orders.push(order);
  return {ok:true,orderId:id,recipeId:r.id,stationId:order.stationId,reserved:{...order.reserved},ingredientIds:[...consumed],workRequired:r.work};
}
export function validateCraftOrder(s,o){
  const r=RECIPE_CATALOG[o?.recipe];if(!r)return false;
  // Pre-outcome orders retain their already committed costs and legacy output.
  if(o.craftSpec===undefined)return o.reservedItems===undefined;
  if(o.recipeKnowledge!==RECIPE_KNOWLEDGE_VERSION||!integer(o.id,1)||o.id>=s.rustPossessions.nextOrder||
    !integer(o.startedTick)||!integer(o.lastWorkedTick)||o.startedTick>o.lastWorkedTick||o.lastWorkedTick>s.tick||
    !Number.isFinite(o.work)||o.work<0||o.work>o.required||o.required!==r.work||!sameMaterials(o.reserved,r.materials)||
    !validateCraftSpec(o.craftSpec,{worldSeed:s.seed,orderId:o.id,creatorId:o.agentId,recipeId:o.recipe})||
    !Array.isArray(o.reservedItems)||o.reservedItems.length>4)return false;
  const counts={},ids=new Set(),people=new Set([...(s.agents??[]),...(s.archive??[])].map(a=>a.id));
  for(const i of o.reservedItems){
    if(!i||!integer(i.itemId,1)||i.itemId>=s.rustPossessions.nextItem||ids.has(i.itemId)||!people.has(i.createdBy)||
      !r.itemMaterials?.[i.kind]||s.rustPossessions.items.some(x=>x.id===i.itemId))return false;
    ids.add(i.itemId);counts[i.kind]=(counts[i.kind]??0)+1;
  }
  return sameMaterials(counts,r.itemMaterials??{});
}
export function advanceCraft(s,agentId,{workRate=1}={}){
  const p=s.rustPossessions,a=living(s,agentId),o=p?.orders.find(o=>o.agentId===agentId);
  if(!p||!a||!o)return {ok:false,reason:'order'};
  if(!canPerformProductiveWork(s,a))return {ok:false,reason:'stage'};
  const r=RECIPE_CATALOG[o.recipe];if(!r)return {ok:false,reason:'recipe'};
  if(!validateCraftOrder(s,o))return {ok:false,reason:'craft-order-invalid'};
  const st=stationForRecipe(s,o.recipe,a,o.stationId);
  if(r.station!==CRAFT_STATIONS.HAND&&(!st||a.x!==st.x||a.y!==st.y))return {ok:false,reason:'not-at-station'};
  if(s.tick<=o.lastWorkedTick)return {ok:false,reason:'already-worked'};
  if(!Number.isFinite(workRate)||workRate<=0||workRate>1)return {ok:false,reason:'work-rate'};
  const nextWork=Math.min(o.required,o.work+workRate);
  if(nextWork<o.required){o.lastWorkedTick=s.tick;o.work=nextWork;return {ok:true,completed:false,orderId:o.id,work:o.work,required:o.required};}
  // Capacity may change while the person is walking or working. Hold the same
  // order/snapshot; do not consume twice, lose output, reroll, or grant mastery.
  if(bag(p,agentId).length>=RUST_POSSESSION_LIMITS.bag||p.items.length>=RUST_POSSESSION_LIMITS.items||
    !integer(p.nextItem,1)||p.nextItem>=Number.MAX_SAFE_INTEGER)return {ok:false,reason:'output-capacity'};
  const itemId=p.nextItem;
  let craft,mastery;
  try{
    craft=o.craftSpec?resolveCraftOutcome({spec:o.craftSpec,orderId:o.id,creatorId:agentId,recipeId:o.recipe}):null;
    mastery=recipeCompletionProposal(s,a,o,itemId,nextWork);
  }catch{return {ok:false,reason:'craft-order-invalid'};}
  const item={id:itemId,kind:r.output,createdBy:agentId,createdTick:s.tick,
    ...(ITEM_CATALOG[r.output].category==='gear'?{upgradeLevel:0}:{}),...(craft?{craft}:{}),location:{kind:'bag',agentId}};
  p.nextItem++;p.items.push(item);
  if(mastery)a.knowledgeState.recipes=mastery.book;
  p.orders=p.orders.filter(x=>x.id!==o.id);
  return {ok:true,completed:true,orderId:o.id,itemId,kind:r.output,...(craft?{tier:craft.tier,quality:craft.quality}:{}),
    ...(mastery?{mastery:mastery.completed,unlockedRecipes:mastery.unlocked}:{})};
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
export function mintAdventureGear(s,{agentId,gearId,sourceKey}={}){
  const p=s.rustPossessions,a=living(s,agentId),def=ITEM_CATALOG[gearId];
  if(!p||!a||def?.category!=='gear'||typeof sourceKey!=='string'||sourceKey.length===0)return {ok:false,reason:'gear-input'};
  const existing=p.items.find(i=>i.sourceGearKey===sourceKey);
  if(existing){
    if(existing.kind!==gearId||existing.createdBy!==agentId)return {ok:false,reason:'gear-source-conflict'};
    return {ok:true,duplicate:true,itemId:existing.id,kind:existing.kind,slot:def.equipSlot};
  }
  if(p.items.length>=RUST_POSSESSION_LIMITS.items||bag(p,agentId).length>=RUST_POSSESSION_LIMITS.bag||p.nextItem>=Number.MAX_SAFE_INTEGER)return {ok:false,reason:'capacity'};
  const itemId=p.nextItem++;
  p.items.push({id:itemId,kind:gearId,createdBy:agentId,createdTick:s.tick,sourceGearKey:sourceKey,upgradeLevel:0,location:{kind:'bag',agentId}});
  return {ok:true,duplicate:false,itemId,kind:gearId,slot:def.equipSlot};
}
export function equipAdventureGear(s,agentId,itemId){
  const p=s.rustPossessions,a=living(s,agentId),item=p?.items.find(i=>i.id===itemId&&i.location?.kind==='bag'&&i.location.agentId===agentId),def=item&&ITEM_CATALOG[item.kind];
  if(!p||!a||!item||def?.category!=='gear'||!RUST_EQUIPMENT_SLOTS.includes(def.equipSlot)||def.equipSlot==='hand')return {ok:false,reason:'item'};
  if(a.adventureCombat?.status==='ACTIVE')return {ok:false,reason:'combat-active'};
  const slot=def.equipSlot;
  p.equipment=p.equipment.filter(e=>e.agentId!==agentId||equipmentSlotOf(e)!==slot);
  p.equipment.push({agentId,itemId,slot});
  return {ok:true,itemId,kind:item.kind,slot};
}
export function unequipAdventureGear(s,agentId,slot){
  const p=s.rustPossessions,a=living(s,agentId);
  if(!p||!a||!['WEAPON','ARMOR','ACCESSORY'].includes(slot))return {ok:false,reason:'gear-slot'};
  if(a.adventureCombat?.status==='ACTIVE')return {ok:false,reason:'combat-active'};
  const equipped=p.equipment.find(e=>e.agentId===agentId&&equipmentSlotOf(e)===slot);
  if(!equipped)return {ok:true,changed:false,itemId:null,slot};
  p.equipment=p.equipment.filter(e=>!(e.agentId===agentId&&equipmentSlotOf(e)===slot));
  return {ok:true,changed:true,itemId:equipped.itemId,slot};
}
export function equipTool(s,agentId,itemId){
  const p=s.rustPossessions,a=living(s,agentId),item=p?.items.find(i=>i.id===itemId&&i.location?.kind==='bag'&&i.location.agentId===agentId);
  if(!p||!a||!item||ITEM_CATALOG[item.kind]?.category!=='tool'||ITEM_CATALOG[item.kind]?.equipSlot!=='hand')return {ok:false,reason:'item'};
  p.equipment=p.equipment.filter(e=>e.agentId!==agentId||equipmentSlotOf(e)!=='hand');p.equipment.push({agentId,itemId});return {ok:true,itemId,kind:item.kind,slot:'hand'};
}
export function unequipTool(s,agentId){
  const p=s.rustPossessions,a=living(s,agentId);
  if(!p||!a)return {ok:false,reason:'item'};
  const equipped=p.equipment.find(e=>e.agentId===agentId&&equipmentSlotOf(e)==='hand');
  if(!equipped)return {ok:true,changed:false,itemId:null,slot:'hand'};
  p.equipment=p.equipment.filter(e=>e.agentId!==agentId||equipmentSlotOf(e)!=='hand');
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
  const p=s.rustPossessions,e=p?.equipment.find(e=>e.agentId===agentId&&equipmentSlotOf(e)==='hand'),item=e&&p.items.find(i=>i.id===e.itemId&&i.location?.kind==='bag'&&i.location.agentId===agentId),def=item&&ITEM_CATALOG[item.kind];
  return def?.workAction===action?craftedToolMultiplier(item,Number(def.workMultiplier)||1):1;
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
  const equipment={hand:null,WEAPON:null,ARMOR:null,ACCESSORY:null};
  for(const e of s.rustPossessions?.equipment??[])if(e.agentId===agentId&&Object.hasOwn(equipment,equipmentSlotOf(e)))equipment[equipmentSlotOf(e)]=e.itemId;
  return JSON.parse(JSON.stringify({bag:bag(s.rustPossessions,agentId),capacity:RUST_POSSESSION_LIMITS.bag,equippedItemId:equipment.hand,equipment,order:s.rustPossessions?.orders.find(o=>o.agentId===agentId)??null}));
};
