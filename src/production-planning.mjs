import {craftPreview,equipmentSlotOf} from './rust-possessions.mjs?v=0.5.0';
import {isIndependent,resourceStock} from './individual-resources.mjs?v=0.5.0';
import {personalHomeSite,homeOf} from './individual-housing.mjs?v=0.5.0';
/** RP1 — deterministic autonomous Rust production coordinator.
 * It never completes work itself. It only issues existing validated Rust commands.
 */
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {rustCommand} from './rust-runtime.mjs?v=0.5.0';
import {ITEM_CATALOG,RECIPE_CATALOG,recipeById} from './crafting-catalog.mjs?v=0.5.0';
import {housingCapacity,evaluateModularHouses,houseSite,nextHousePiece} from './housing.mjs?v=0.5.0';
import {canonicalEdge,placementIdFor} from './rust-stations.mjs?v=0.5.0';
import {personalHomeIntent} from './individual-home-planning.mjs?v=0.5.0';
import {activeResidenceOf} from './relationships.mjs?v=0.5.0';
import {BIRTH_RULES} from './reproduction.mjs?v=0.5.0';
import {crafterProgressionIntent} from './crafter-autonomy.mjs?v=0.5.0';
import {crafterFamilyProfile,evaluateCrafterQualification} from './crafter-career.mjs?v=0.5.0';
import {knowsCraftRecipe} from './craft-recipe-knowledge.mjs?v=0.5.0';
import {CRAFT_TRAINING_RULES} from './craft-training.mjs?v=0.5.0';
import {materialAmount} from './material-economy.mjs?v=0.5.0';

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
    const equipped=s.rustPossessions.equipment.find(e=>e.agentId===a.id&&equipmentSlotOf(e)==='hand');
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
  const equipped=s.rustPossessions.equipment.find(e=>e.agentId===builder.id&&equipmentSlotOf(e)==='hand'),hammer=bagItems(s,'HAMMER').find(i=>i.location.agentId===builder.id);
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
function stepPersonalHomePlan(s,p,isWalkable){
 const rows=eligible(s).map(a=>({a,intent:personalHomeIntent(s,a,isWalkable)})).filter(x=>!['HOME_COMPLETE','INELIGIBLE','COHABITING'].includes(x.intent.kind));
 if(!rows.length)return null;
 const {a,intent}=rows.find(x=>x.intent.kind!=='NO_SITE')??rows[0];
 const note=(goal,outcome)=>{if(p.goal?.goal!==goal||p.goal?.outcome!==outcome||p.goal?.agentId!==a.id)record(p,s.tick,goal,outcome,a.id);};
 if(intent.kind==='NO_SITE'){note('personal-home-site','no-site');return {ok:false,reason:'no-site',agentId:a.id};}
 if(intent.kind==='PLACE_PIECE'){note('personal-home-place-'+intent.pieceKind,'waiting');return {ok:true,waiting:true,agentId:a.id};}
 if(intent.kind==='EQUIP_HAMMER'){
  const r=rustCommand(s,'EQUIP_ITEM',{agentId:a.id,itemId:intent.itemId},isWalkable);note('personal-home-equip-hammer',r.ok?'completed':r.reason);return r;
 }
 const recipeId=intent.kind==='NEED_HAMMER'?'HAMMER':intent.recipeId;
 const goal=intent.kind==='NEED_HAMMER'?'personal-home-hammer':'personal-home-craft-'+intent.pieceKind;
 if(!recipeId||s.stock.wood<(RECIPE_CATALOG[recipeId].materials.wood??0)+BIRTH_RULES.woodSafetyFloor){note(goal,'materials');return {ok:false,reason:'materials'};}
 const r=rustCommand(s,'CRAFT_ITEM',{agentId:a.id,recipeId},isWalkable);note(goal,r.ok?'accepted':r.reason);return r;
}

export const BUILDER_CRAFTER_APPRENTICESHIP_VERSION='RC5-builder-apprenticeship/1';
const APPRENTICE_FAMILY='HAMMER';
const apprenticeView=(status,reason,extra={})=>Object.freeze({version:BUILDER_CRAFTER_APPRENTICESHIP_VERSION,status,reason,...extra});

function apprenticeBag(s,a,kind=null){
  return (s.rustPossessions?.items??[]).filter(i=>i.location?.kind==='bag'&&i.location.agentId===a.id&&(!kind||i.kind===kind)).sort((x,y)=>x.id-y.id);
}
function apprenticeStation(s,a,kind){
  return (s.rustStations?.stations??[]).filter(st=>st.complete&&st.kind===kind&&st.placedBy===a.id).sort((x,y)=>x.id-y.id)[0]??null;
}
function apprenticeGatherNeed(s,a,requirements={}){
  const stock=resourceStock(s,a);
  if(!stock)return apprenticeView('UNKNOWN','resource-stock',{agentId:a.id});
  if(stock.food<CRAFT_TRAINING_RULES.food)
    return apprenticeView('SAT','apprentice-food-reserve',{type:'GATHER',careerLock:true,agentId:a.id,action:'FORAGE',itemKind:'food',missing:Math.ceil(CRAFT_TRAINING_RULES.food-stock.food)});
  for(const key of ['wood','stone']){
    const required=Number(requirements[key]??0)+CRAFT_TRAINING_RULES[key];
    if(stock[key]<required){
      const action=key==='wood'?'WOODCUT':'MINE';
      return apprenticeView('SAT','apprentice-'+key+'-reserve',{type:'GATHER',careerLock:true,agentId:a.id,action,itemKind:key,missing:Math.ceil(required-stock[key])});
    }
  }
  return null;
}
function apprenticeCraftPlan(s,a,recipeId){
  const recipe=recipeById(recipeId);
  if(!recipe)return apprenticeView('UNKNOWN','recipe',{agentId:a.id,recipeId});
  const reserves=apprenticeGatherNeed(s,a,recipe.materials);
  if(reserves)return reserves;
  const preview=craftPreview(s,{agentId:a.id,recipeId});
  if(preview.ok)return apprenticeView('SAT','apprentice-craft',{type:'CRAFT',careerLock:true,agentId:a.id,recipeId});
  if(preview.reason==='materials'&&preview.missing){
    if(Object.keys(preview.missing).some(k=>['wood','stone'].includes(k))){
      const raw=apprenticeGatherNeed(s,a,recipe.materials);if(raw)return raw;
    }
    if(Object.hasOwn(preview.missing,'ironIngot'))return apprenticeMetalPlan(s,a,2);
  }
  return apprenticeView(preview.reason==='recipe-knowledge'||preview.reason==='crafter-tier-evidence'?'UNKNOWN':'BLOCKED',preview.reason??'craft-preview',{careerLock:true,agentId:a.id,recipeId,missing:{...(preview.missing??{})}});
}
function apprenticeMetalPlan(s,a,ingotsNeeded){
  const furnace=apprenticeStation(s,a,'FURNACE');
  if(!furnace){
    const carried=apprenticeBag(s,a,'FURNACE')[0];
    if(carried)return apprenticeView('SAT','place-apprentice-furnace',{type:'PLACE_STATION',careerLock:true,agentId:a.id,itemId:carried.id,kind:'FURNACE'});
    const recipe=RECIPE_CATALOG.FURNACE;
    const reserves=apprenticeGatherNeed(s,a,recipe.materials);if(reserves)return reserves;
    const preview=craftPreview(s,{agentId:a.id,recipeId:'FURNACE'});
    if(preview.ok)return apprenticeView('SAT','craft-apprentice-furnace',{type:'CRAFT',careerLock:true,agentId:a.id,recipeId:'FURNACE'});
    return apprenticeView(preview.reason==='recipe-knowledge'?'UNKNOWN':'BLOCKED',preview.reason??'furnace',{careerLock:true,agentId:a.id,recipeId:'FURNACE'});
  }
  const have=Math.floor(materialAmount(s,a,'ironIngot'));
  if(have>=ingotsNeeded)return apprenticeView('SAT','metal-ready',{type:'WAIT',careerLock:true,agentId:a.id});
  const charcoal=Math.floor(materialAmount(s,a,'charcoal')),ore=Math.floor(materialAmount(s,a,'ironOre'));
  if(ore<2){
    return apprenticeView('SAT','gather-apprentice-iron-ore',{type:'GATHER',careerLock:true,agentId:a.id,action:'MINE',itemKind:'ironOre',missing:2-ore});
  }
  if(charcoal<1){
    const wood=apprenticeGatherNeed(s,a,{wood:2});if(wood)return wood;
    return apprenticeView('SAT','process-apprentice-charcoal',{type:'PROCESS',careerLock:true,agentId:a.id,processType:'PROCESS_CHARCOAL',stationId:furnace.id});
  }
  return apprenticeView('SAT','process-apprentice-iron',{type:'PROCESS',careerLock:true,agentId:a.id,processType:'PROCESS_IRON',stationId:furnace.id});
}

/** Read-only apprenticeship state. It creates no XP/profession/material authority.
 * A completed-home Builder remains on the Builder->Crafter path while existing
 * Rust/metal authorities produce the exact 6-total / 2x-T2 evidence.
 */
export function builderCrafterApprenticeshipState(s,a){
  if(!isIndependent(s)||!a?.alive||a.profession!=='builder'||!canPerformProductiveWork(s,a))
    return apprenticeView('INELIGIBLE','builder-required',{active:false,agentId:a?.id??null});
  const home=homeOf(s,a.id,{completeOnly:true});
  if(!home||home.ownerId!==a.id)return apprenticeView('INELIGIBLE','construction-required',{active:false,agentId:a.id});
  const qualification=evaluateCrafterQualification(s,a.id);
  if(qualification.status==='UNKNOWN')return apprenticeView('UNKNOWN',qualification.reason,{active:false,agentId:a.id});
  if(qualification.status==='SAT')return apprenticeView('SAT','qualification-ready',{active:true,type:'PROMOTE',careerLock:true,agentId:a.id,homeId:home.houseId,profile:qualification.profile});
  if(qualification.reason!=='craft-mastery-required')
    return apprenticeView('INELIGIBLE',qualification.reason,{active:false,agentId:a.id,homeId:home.houseId});
  const family=crafterFamilyProfile(s,a,APPRENTICE_FAMILY);
  if(family.status!=='SAT'||!family.profile)return apprenticeView('UNKNOWN',family.reason??'career-evidence',{active:false,agentId:a.id});
  return apprenticeView('SAT','apprenticeship-active',{active:true,type:'APPRENTICE',careerLock:true,agentId:a.id,homeId:home.houseId,profile:family.profile});
}

export function builderCrafterApprenticeshipIntent(s,a){
  const state=builderCrafterApprenticeshipState(s,a);
  if(state.status!=='SAT'||state.active!==true)return state;
  if(state.type==='PROMOTE')return state;
  if(a.craftTraining?.enabled===true)return apprenticeView('BLOCKED','manual-training',{active:true,careerLock:true,agentId:a.id});
  if(a.adventureCombat?.status==='ACTIVE'||a.adventureEncounter)return apprenticeView('BLOCKED','adventure',{active:true,careerLock:true,agentId:a.id});
  if((s.rustPossessions?.orders??[]).some(o=>o.agentId===a.id)||(s.rustMaterials?.orders??[]).some(o=>o.agentId===a.id))
    return apprenticeView('SAT','apprentice-work-pending',{type:'WAIT',active:true,careerLock:true,agentId:a.id});
  if(a.hp<CRAFT_TRAINING_RULES.hp||a.satiety<CRAFT_TRAINING_RULES.satiety||a.energy<CRAFT_TRAINING_RULES.energy)
    return apprenticeView('BLOCKED','survival',{active:true,careerLock:true,agentId:a.id});
  if(a.task)return apprenticeView('SAT','apprentice-task-pending',{type:'WAIT',active:true,careerLock:true,agentId:a.id});

  const table=apprenticeStation(s,a,'CRAFTING_TABLE_LV1');
  if(!table){
    const carried=apprenticeBag(s,a,'CRAFTING_TABLE_LV1')[0];
    if(carried)return apprenticeView('SAT','place-apprentice-table',{type:'PLACE_STATION',active:true,careerLock:true,agentId:a.id,itemId:carried.id,kind:'CRAFTING_TABLE_LV1'});
    const need=apprenticeGatherNeed(s,a,RECIPE_CATALOG.CRAFTING_TABLE_LV1.materials);if(need)return need;
    return apprenticeCraftPlan(s,a,'CRAFTING_TABLE_LV1');
  }

  const profile=state.profile;
  if(profile.counts[2]>=2&&profile.total>=6)return apprenticeView('SAT','qualification-ready',{type:'PROMOTE',active:true,careerLock:true,agentId:a.id,profile});
  if(!knowsCraftRecipe(s,a,'HAMMER_T2'))return apprenticeCraftPlan(s,a,'HAMMER');
  if(profile.counts[2]<2){
    const t2Recipe=recipeById('HAMMER_T2'),reserve=apprenticeGatherNeed(s,a,t2Recipe.materials);
    if(reserve)return reserve;
    const t2=craftPreview(s,{agentId:a.id,recipeId:'HAMMER_T2'});
    if(t2.ok)return apprenticeView('SAT','apprentice-tier2',{type:'CRAFT',active:true,careerLock:true,agentId:a.id,recipeId:'HAMMER_T2'});
    if(t2.reason==='item-materials')return apprenticeCraftPlan(s,a,'HAMMER');
    if(t2.reason==='materials'&&t2.missing){
      if(Object.keys(t2.missing).some(k=>['wood','stone'].includes(k))){
        const need=apprenticeGatherNeed(s,a,recipeById('HAMMER_T2').materials);if(need)return need;
      }
      if(Object.hasOwn(t2.missing,'ironIngot'))return apprenticeMetalPlan(s,a,2);
    }
    return apprenticeView(t2.reason==='recipe-knowledge'||t2.reason==='crafter-tier-evidence'?'UNKNOWN':'BLOCKED',t2.reason??'tier2',{active:true,careerLock:true,agentId:a.id,recipeId:'HAMMER_T2',missing:{...(t2.missing??{})}});
  }
  return apprenticeCraftPlan(s,a,'HAMMER');
}

function stepBuilderCrafterApprenticeship(s,p,isWalkable,dispatch){
  const builders=eligible(s).filter(a=>builderCrafterApprenticeshipState(s,a).active).sort((a,b)=>a.id-b.id);
  if(!builders.length)return null;
  const offset=Math.floor(s.tick/PRODUCTION_RULES.attemptPeriod)%builders.length;
  for(let i=0;i<builders.length;i++){
    const a=builders[(i+offset)%builders.length],intent=builderCrafterApprenticeshipIntent(s,a);
    if(intent.status!=='SAT'||['WAIT','GATHER'].includes(intent.type))continue;
    let r=null;
    if(intent.type==='PROMOTE')r=dispatch?.('RC5_BECOME_CRAFTER',{agentId:a.id})??null;
    else if(intent.type==='CRAFT')r=rustCommand(s,'CRAFT_ITEM',{agentId:a.id,recipeId:intent.recipeId},isWalkable);
    else if(intent.type==='PROCESS')r=rustCommand(s,intent.processType,{agentId:a.id,stationId:intent.stationId},isWalkable);
    else if(intent.type==='PLACE_STATION'){
      const cell=freeNeighbor(s,a,isWalkable);
      if(!cell)continue;
      r=rustCommand(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:intent.itemId,...cell,placementId:placementIdFor(s.tick,a.id,intent.itemId)},isWalkable);
    }
    if(r?.ok){
      record(p,s.tick,'builder-apprentice-'+intent.type.toLowerCase(),r.changed===false?'already':(r.completed?'completed':'accepted'),a.id);
      return {...r,builderApprenticeship:true,agentId:a.id};
    }
  }
  return null;
}

export function productionCommand(s,type,data={}){
  if(type!=='SET_PRODUCTION_POLICY')return null;
  const p=ensureProductionPlan(s),enabled=data.enabled===true;
  p.enabled=enabled;p.goal={goal:'policy',outcome:enabled?'enabled':'disabled',agentId:null,tick:s.tick};
  return {ok:true,enabled,message:enabled?'เปิดแผนผลิตอัตโนมัติแล้ว':'หยุดแผนผลิตอัตโนมัติแล้ว'};
}
/** IC3 runs the same Rust orders per person. No colony-wide head-of-line lock. */
function stepCrafterProgression(s,p,isWalkable){
 const crafters=eligible(s).filter(a=>a.profession==='crafter');
 if(!crafters.length)return null;
 const offset=Math.floor(s.tick/PRODUCTION_RULES.attemptPeriod)%crafters.length;
 for(let i=0;i<crafters.length;i++){
  const a=crafters[(i+offset)%crafters.length],intent=crafterProgressionIntent(s,a);
  if(!intent)continue;
  const r=rustCommand(s,'CRAFT_ITEM',intent,isWalkable);
  record(p,s.tick,'crafter-progress-'+intent.recipeId,r?.ok?'accepted':(r?.reason??'blocked'),a.id);
  if(r?.ok)return {...r,crafterProgression:true};
 }
 return null;
}
function stepIndependentHomePlans(s,p,isWalkable){
 if(s.tick-p.lastAttemptTick<PRODUCTION_RULES.attemptPeriod)return null;
 p.lastAttemptTick=s.tick;
 const agents=eligible(s);if(!agents.length)return null;
 const offset=Math.floor(s.tick/PRODUCTION_RULES.attemptPeriod)%agents.length;
 for(let i=0;i<agents.length;i++){
  const a=agents[(i+offset)%agents.length];
  if(a.satiety<35||a.energy<12||homeOf(s,a.id,{completeOnly:true})||activeResidenceOf(s,a.id))continue;
  if(s.rustPossessions.orders.some(o=>o.agentId===a.id)||s.rustMaterials.orders.some(o=>o.agentId===a.id))continue;
  const site=personalHomeSite(s,a,isWalkable);if(!site)continue;
  if(!a.homePlan||a.homePlan.x!==site.origin.x||a.homePlan.y!==site.origin.y)a.homePlan={version:'home-plan-1',x:site.origin.x,y:site.origin.y,createdTick:s.tick};
  const bag=s.rustPossessions.items.filter(i=>i.location?.kind==='bag'&&i.location.agentId===a.id);
  const table=s.rustStations.stations.find(st=>st.complete&&st.kind==='CRAFTING_TABLE_LV1'&&st.placedBy===a.id);
  let recipeId=null;
  if(!table){if(bag.some(i=>i.kind==='CRAFTING_TABLE_LV1'))continue;recipeId='CRAFTING_TABLE_LV1';}
  else{
   const intent=personalHomeIntent(s,a,isWalkable);
   if(intent.kind==='EQUIP_HAMMER'){
    const r=rustCommand(s,'EQUIP_ITEM',{agentId:a.id,itemId:intent.itemId},isWalkable);
    if(r.ok){record(p,s.tick,'personal-home-equip-hammer','completed',a.id);return r;}continue;
   }
   if(intent.kind==='NEED_HAMMER')recipeId='HAMMER';
   else if(intent.kind==='CRAFT_PIECE')recipeId=intent.recipeId;
   else continue;
  }
  const stock=resourceStock(s,a),recipe=RECIPE_CATALOG[recipeId];
  if(!recipe||Object.entries(recipe.materials).some(([k,n])=>stock[k]<n))continue;
  const r=rustCommand(s,'CRAFT_ITEM',{agentId:a.id,recipeId,stationId:recipeId==='HAMMER'?table.id:null},isWalkable);
  if(r.ok){record(p,s.tick,'personal-home-craft-'+recipeId,'accepted',a.id);return r;}
 }
 return null;
}
export function stepProductionPlanning(s,isWalkable,dispatch=null){
  const p=ensureProductionPlan(s);
  if(isIndependent(s)){
    const home=stepIndependentHomePlans(s,p,isWalkable);
    if(home)return home;
    const apprentice=stepBuilderCrafterApprenticeship(s,p,isWalkable,dispatch);
    if(apprentice)return apprentice;
    return p.enabled===true?stepCrafterProgression(s,p,isWalkable):null;
  }
  const housingOnly=p.enabled!==true&&autonomousHousingNeeded(s);
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
  const house=stepPersonalHomePlan(s,p,isWalkable);
  if(house)return house.ok?house:null;
  const crafter=stepCrafterProgression(s,p,isWalkable);
  if(crafter)return crafter;
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
