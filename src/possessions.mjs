/** G1-A: deterministic possessions domain. Not wired into the live engine yet.
 * Item locations are authoritative; equipment only references a held item.
 * Craft orders reserve shared materials without creating a second inventory.
 * Engine integration must supply lifecycle/readiness/path checks and call work
 * only for an assigned CRAFT task after movement. This module never moves agents.
 */
export const POSSESSIONS_VERSION = '0.1.0';
export const TOOL_LIMITS = Object.freeze({bag:4,items:128,camp:64,orders:12,stateChars:65536,interactionRange:1});
export const TOOL_RECIPES = Object.freeze({
  STONE_AXE:Object.freeze({name:'ขวานหิน',cost:Object.freeze({wood:4,stone:2}),work:24,action:'WOODCUT',multiplier:1.25})
});
export const TOOL_COMMANDS = Object.freeze(['CRAFT_TOOL','CANCEL_CRAFT','EQUIP_TOOL','UNEQUIP_TOOL','GIVE_TOOL','STORE_TOOL','TAKE_TOOL','PICKUP_TOOL']);
const copy = value => JSON.parse(JSON.stringify(value));
const integer = n => Number.isSafeInteger(n) && n >= 0;
const id = n => integer(n) && n > 0;
const number = n => typeof n === 'number' && Number.isFinite(n);
const record = o => o !== null && typeof o === 'object' && !Array.isArray(o);
const shape = (o,keys) => record(o) && Object.keys(o).length===keys.length && keys.every(k=>Object.hasOwn(o,k));
const near = (a,b) => number(a?.x)&&number(a?.y)&&number(b?.x)&&number(b?.y)&&Math.abs(a.x-b.x)+Math.abs(a.y-b.y)<=TOOL_LIMITS.interactionRange;
const person = (s,n) => s.agents?.find(a=>a.id===n) ?? s.archive?.find(a=>a.id===n);
const livingPerson = (s,n) => s.agents?.find(a=>a.id===n&&a.alive===true);
const camp = (s,n) => s.buildings?.find(b=>b.id===n&&b.type==='camp'&&b.complete===true);
const held = (p,n) => p.items.filter(i=>i.location.kind==='bag'&&i.location.agentId===n);
const pending = (p,n) => p.orders.filter(o=>o.agentId===n).length;
const bagFull = (p,n) => held(p,n).length+pending(p,n)>=TOOL_LIMITS.bag;
const unEquip = (p,n) => {p.equipment=p.equipment.filter(e=>e.itemId!==n);};
const fail = reason => ({ok:false,reason});

export function createPossessions(){
  return {version:POSSESSIONS_VERSION,nextItem:1,nextOrder:1,items:[],equipment:[],orders:[]};
}

/** Read-only; no inferred or silently initialized possessions. */
export function reservedToolMaterials(s){
  const total={wood:0,stone:0};
  for(const order of s.possessions?.orders??[]){
    const recipe=record(order)&&Object.hasOwn(TOOL_RECIPES,order.recipe)?TOOL_RECIPES[order.recipe]:null;
    if(recipe)for(const key of Object.keys(total))total[key]+=recipe.cost[key];
  }
  return total;
}
export function availableToolMaterials(s){
  const reserved=reservedToolMaterials(s);
  return {wood:s.stock.wood-reserved.wood,stone:s.stock.stone-reserved.stone};
}
export function possessionsSummary(s,agentId){
  const p=s.possessions;
  if(!p)return null;
  return copy({bag:held(p,agentId),bagCapacity:TOOL_LIMITS.bag,
    equippedItemId:p.equipment.find(e=>e.agentId===agentId)?.itemId??null,
    order:p.orders.find(o=>o.agentId===agentId)??null,reservedMaterials:reservedToolMaterials(s)});
}
export function toolWorkMultiplier(s,agentId,action){
  if(!livingPerson(s,agentId))return 1;
  const p=s.possessions,e=p?.equipment.find(x=>x.agentId===agentId);
  const item=e&&p.items.find(x=>x.id===e.itemId&&x.location.kind==='bag'&&x.location.agentId===agentId);
  const recipe=item&&TOOL_RECIPES[item.kind];
  return recipe?.action===action?Math.min(1.25,recipe.multiplier):1;
}

/** Validate only this sub-schema; the engine still validates the whole world.
 * walkable is supplied by the engine. Without it, only integer coordinates are
 * checked; integration MUST pass its canonical terrain validator.
 */
export function validatePossessions(s,{walkable}={}){
  const errors=new Set(),bad=x=>errors.add(x),p=s?.possessions;
  if(!shape(p,['version','nextItem','nextOrder','items','equipment','orders'])||p.version!==POSSESSIONS_VERSION||
    !Array.isArray(p.items)||!Array.isArray(p.equipment)||!Array.isArray(p.orders))return ['Possessions schema'];
  if(!integer(s.tick)||!id(p.nextItem)||!id(p.nextOrder))bad('Possessions counters');
  if(p.items.length+p.orders.length>TOOL_LIMITS.items||p.orders.length>TOOL_LIMITS.orders||p.equipment.length>TOOL_LIMITS.items)bad('Possessions bounds');
  const ids=new Set(),orderIds=new Set(),orderActors=new Set(),orderCamps=new Set(),equipmentActors=new Set(),equipmentItems=new Set();
  const bags=new Map(),camps=new Map();
  const coordinate=l=>integer(l.x)&&integer(l.y)&&(!walkable||walkable(s,l.x,l.y));
  for(const i of p.items){
    if(!shape(i,['id','kind','createdBy','createdTick','location'])||!id(i.id)||ids.has(i.id)||!Object.hasOwn(TOOL_RECIPES,i.kind)||
      !person(s,i.createdBy)||!integer(i.createdTick)||i.createdTick>s.tick){bad('Tool identity');continue;}
    ids.add(i.id);
    const l=i.location;
    if(l?.kind==='bag'){
      if(!shape(l,['kind','agentId'])||!livingPerson(s,l.agentId))bad('Tool holder');
      bags.set(l.agentId,(bags.get(l.agentId)??0)+1);
    }else if(l?.kind==='camp'){
      if(!shape(l,['kind','buildingId'])||!camp(s,l.buildingId))bad('Tool camp');
      camps.set(l.buildingId,(camps.get(l.buildingId)??0)+1);
    }else if(l?.kind==='drop'){
      const dead=person(s,l.agentId);
      if(!shape(l,['kind','agentId','tick','x','y'])||dead?.alive!==false||!coordinate(l)||!integer(l.tick)||l.tick>s.tick)bad('Tool drop');
    }else bad('Tool location');
  }
  for(const e of p.equipment){
    if(!shape(e,['agentId','itemId'])||!livingPerson(s,e.agentId)||equipmentActors.has(e.agentId)||equipmentItems.has(e.itemId)||
      !p.items.some(i=>i?.id===e.itemId&&i.location?.kind==='bag'&&i.location.agentId===e.agentId))bad('Tool equipment');
    equipmentActors.add(e?.agentId);equipmentItems.add(e?.itemId);
  }
  for(const o of p.orders){
    if(!shape(o,['id','agentId','campId','recipe','work','startedTick','lastWorkedTick'])||!id(o.id)||orderIds.has(o.id)||
      !livingPerson(s,o.agentId)||!camp(s,o.campId)||orderActors.has(o.agentId)||orderCamps.has(o.campId)||
      !Object.hasOwn(TOOL_RECIPES,o.recipe)||!number(o.work)||o.work<0||o.work>=(TOOL_RECIPES[o.recipe]?.work??0)||
      !integer(o.startedTick)||!integer(o.lastWorkedTick)||o.lastWorkedTick<o.startedTick||o.lastWorkedTick>s.tick)bad('Craft order');
    orderIds.add(o?.id);orderActors.add(o?.agentId);orderCamps.add(o?.campId);
    bags.set(o?.agentId,(bags.get(o?.agentId)??0)+1);
  }
  if([...bags.values()].some(n=>n>TOOL_LIMITS.bag)||[...camps.values()].some(n=>n>TOOL_LIMITS.camp))bad('Tool capacity');
  if(p.nextItem<=Math.max(0,...ids)||p.nextOrder<=Math.max(0,...orderIds))bad('Possessions counters');
  const reserved=reservedToolMaterials(s);
  if(!record(s.stock)||['wood','stone'].some(k=>!number(s.stock[k])||s.stock[k]<reserved[k]||s.stock[k]>999))bad('Craft materials');
  if(JSON.stringify(p).length>TOOL_LIMITS.stateChars)bad('Possessions storage');
  return [...errors];
}

function budget(s,p,stock,context,{creating=false}={}){
  if(JSON.stringify(p).length>TOOL_LIMITS.stateChars)return false;
  // No global limit is invented here: creation requires the engine's limit.
  if(!id(context?.maxSaveChars))return !creating;
  const projected={...s,possessions:p,stock};
  // Reserve room for pending outputs and death-location expansion, not resources.
  const allowance=p.orders.length*512+p.items.length*128;
  return JSON.stringify(projected).length+allowance<=context.maxSaveChars;
}
function prepared(s,command,data,context){
  if(!TOOL_COMMANDS.includes(command))return fail('unknown-command');
  if(!record(data)||validatePossessions(s,context).length)return fail('invalid-state-or-input');
  const a=livingPerson(s,data.agentId);
  if(!a)return fail('actor');
  const p=copy(s.possessions),stock={...s.stock};
  let item=p.items.find(i=>i.id===data.itemId),result={ok:true,command,agentId:a.id};
  if(command==='CRAFT_TOOL'){
    if(typeof context?.canCraft!=='function'||typeof context?.canReach!=='function'||!id(context?.maxSaveChars))return fail('missing-engine-context');
    if(!context.canCraft(s,a))return fail('stage');
    const recipe=TOOL_RECIPES[data.recipe],station=camp(s,data.campId);
    if(!Object.hasOwn(TOOL_RECIPES,data.recipe)||!station)return fail('recipe-or-camp');
    if(p.orders.some(o=>o.agentId===a.id||o.campId===station.id))return fail('craft-busy');
    if(p.items.length+p.orders.length>=TOOL_LIMITS.items||p.orders.length>=TOOL_LIMITS.orders||p.nextOrder===Number.MAX_SAFE_INTEGER||p.nextItem===Number.MAX_SAFE_INTEGER)return fail('registry-full');
    if(bagFull(p,a.id))return fail('bag-full');
    if(!context.canReach(s,a,station))return fail('no-path');
    const free=availableToolMaterials(s);
    if(Object.keys(recipe.cost).some(k=>free[k]<recipe.cost[k]))return fail('materials');
    const order={id:p.nextOrder++,agentId:a.id,campId:station.id,recipe:data.recipe,work:0,startedTick:s.tick,lastWorkedTick:s.tick};
    p.orders.push(order);result={...result,orderId:order.id,destination:{x:station.x,y:station.y},cost:{...recipe.cost},workRequired:recipe.work};
  }else if(command==='CANCEL_CRAFT'){
    const o=p.orders.find(o=>o.id===data.orderId&&o.agentId===a.id);
    if(!o)return fail('order');
    p.orders=p.orders.filter(x=>x!==o);result.orderId=o.id;
  }else if(command==='UNEQUIP_TOOL'){
    const e=p.equipment.find(e=>e.agentId===a.id&&e.itemId===data.itemId);
    if(!e)return fail('not-equipped');
    unEquip(p,e.itemId);result.itemId=e.itemId;
  }else{
    if(!item)return fail('item');
    const inBag=item.location.kind==='bag'&&item.location.agentId===a.id;
    if(['EQUIP_TOOL','GIVE_TOOL','STORE_TOOL'].includes(command)&&!inBag)return fail('not-holder');
    if(command==='EQUIP_TOOL'){
      p.equipment=p.equipment.filter(e=>e.agentId!==a.id);
      p.equipment.push({agentId:a.id,itemId:item.id});
    }else if(command==='GIVE_TOOL'){
      const receiver=livingPerson(s,data.toId);
      if(!receiver||receiver.id===a.id)return fail('recipient');
      if(!near(a,receiver))return fail('range');
      if(bagFull(p,receiver.id))return fail('bag-full');
      unEquip(p,item.id);item.location={kind:'bag',agentId:receiver.id};result.toId=receiver.id;
    }else if(command==='STORE_TOOL'){
      const station=camp(s,data.campId);
      if(!station||!near(a,station))return fail('range');
      if(p.items.filter(i=>i.location.kind==='camp'&&i.location.buildingId===station.id).length>=TOOL_LIMITS.camp)return fail('camp-full');
      unEquip(p,item.id);item.location={kind:'camp',buildingId:station.id};
    }else if(command==='TAKE_TOOL'){
      const station=camp(s,item.location.buildingId);
      if(item.location.kind!=='camp'||!station||!near(a,station))return fail('range');
      if(bagFull(p,a.id))return fail('bag-full');
      item.location={kind:'bag',agentId:a.id};
    }else if(command==='PICKUP_TOOL'){
      if(item.location.kind!=='drop'||!near(a,item.location))return fail('range');
      if(bagFull(p,a.id))return fail('bag-full');
      item.location={kind:'bag',agentId:a.id};
    }
    result.itemId=item.id;
  }
  if(!budget(s,p,stock,context,{creating:command==='CRAFT_TOOL'}))return fail('save-budget');
  return {result,possessions:p,stock};
}
export function previewPossessionCommand(s,command,data={},context={}){
  const plan=prepared(s,command,data,context);
  return copy(plan.result??plan);
}
export function possessionCommand(s,command,data={},context={}){
  const plan=prepared(s,command,data,context);
  if(!plan.result)return plan;
  s.possessions=plan.possessions;s.stock=plan.stock;
  return plan.result;
}

/** One work update per simulation tick; call only from the CRAFT task executor.
 * Progress survives hunger/rest interruption. No payment occurs until output.
 * Duplicate completion/cancellation cannot pay or create twice.
 */
export function advanceToolCraft(s,agentId,context={}){
  if(validatePossessions(s,context).length)return fail('invalid-state');
  const a=livingPerson(s,agentId),o=s.possessions.orders.find(o=>o.agentId===agentId);
  if(!a||!o)return fail('order');
  if(typeof context.canCraft!=='function'||typeof context.readyToCraft!=='function'||typeof context.workRate!=='function'||!id(context.maxSaveChars))return fail('missing-engine-context');
  if(!context.canCraft(s,a))return fail('stage');
  if(!context.readyToCraft(s,a))return fail('needs');
  const station=camp(s,o.campId);
  if(!station||a.x!==station.x||a.y!==station.y)return fail('not-at-camp');
  if(s.tick<=o.lastWorkedTick)return fail('already-worked');
  const rate=context.workRate(s,a);
  if(!number(rate)||rate<=0||rate>1)return fail('work-rate');
  const p=copy(s.possessions),stock={...s.stock},order=p.orders.find(x=>x.id===o.id),recipe=TOOL_RECIPES[o.recipe];
  order.lastWorkedTick=s.tick;order.work+=rate;
  let itemId=null;
  if(order.work>=recipe.work){
    if(p.nextItem===Number.MAX_SAFE_INTEGER)return fail('registry-full');
    itemId=p.nextItem++;
    p.items.push({id:itemId,kind:o.recipe,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
    for(const k of Object.keys(recipe.cost))stock[k]-=recipe.cost[k];
    p.orders=p.orders.filter(x=>x.id!==o.id);
    if(!budget(s,p,stock,context,{creating:true}))return fail('save-budget');
  }
  s.possessions=p;s.stock=stock;
  return {ok:true,orderId:o.id,completed:itemId!==null,itemId,work:Math.min(recipe.work,order.work)};
}

/** Death cleanup is mandatory even if creation budgets are exhausted.
 * Each deceased person's (id, death tick, x, y) is one implicit drop container;
 * no independent container inventory or copies of the physical item are kept.
 * Existing lifecycle code records death and calls this BEFORE archiving.
 */
export function releasePossessionsOnDeath(s,agentId){
  const a=person(s,agentId);
  if(!a||a.alive!==false||!integer(a.x)||!integer(a.y)||!integer(s.tick))return fail('not-dead');
  if(!s.possessions||s.possessions.version!==POSSESSIONS_VERSION)return fail('invalid-state');
  const tick=integer(a.death?.tick)?a.death.tick:s.tick;
  const p=copy(s.possessions),items=held(p,agentId);
  const orders=p.orders.filter(o=>o.agentId===agentId);
  const equipment=p.equipment.filter(e=>e.agentId===agentId);
  if(!items.length&&!orders.length&&!equipment.length)return {ok:true,dropped:0,cancelled:0};
  for(const i of items)i.location={kind:'drop',agentId,tick,x:a.x,y:a.y};
  p.equipment=p.equipment.filter(e=>e.agentId!==agentId);
  p.orders=p.orders.filter(o=>o.agentId!==agentId);
  s.possessions=p;
  return {ok:true,dropped:items.length,cancelled:orders.length};
}
