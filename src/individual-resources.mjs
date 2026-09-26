/** IC3 resource routing. Each unit has ONE writer/store; world totals are read-only sums.
 * Legacy worlds keep s.stock. Independent saves keep balances in the existing Rust
 * material ledger, never in both places. This module owns the versioned extension.
 */
import {canPerformProductiveWork,lifeStage,LIFE_STAGES} from './lifecycle.mjs?v=0.5.0';
export const INDEPENDENT_SAVE_VERSION='0.6.0';
export const INDEPENDENT_MODE=Object.freeze({kind:'independent',version:'IC3-1'});
export const PERSONAL_MATERIAL_VERSION='IC3-materials-1';
export const HOUSEHOLD_MATERIAL_VERSION='IC6C-household-materials-1';
export const RESOURCE_KEYS=Object.freeze(['food','wood','stone']);
const EMPTY=Object.freeze({food:0,wood:0,stone:0,charcoal:0});
const MATERIAL_KEYS=Object.freeze(['food','wood','stone','charcoal']);
export const isIndependent=s=>s?.worldMode?.kind==='independent';
export const materialStock=(s,agentOrId)=>isIndependent(s)
 ?s.rustMaterials?.personalStores?.find(b=>b.ownerId===(typeof agentOrId==='object'?agentOrId?.id:agentOrId))??EMPTY:s.stock;

export function ensureHouseholdResourceState(s){
 if(!isIndependent(s))return s;
 if(s.rustMaterials.householdVersion===undefined)s.rustMaterials.householdVersion=HOUSEHOLD_MATERIAL_VERSION;
 if(s.rustMaterials.householdStores===undefined)s.rustMaterials.householdStores=[];
 return s;
}

export function householdStore(s,houseId){
 ensureHouseholdResourceState(s);
 return s.rustMaterials?.householdStores?.find(b=>b.houseId===houseId)??null;
}

export function activateHouseholdStore(s,houseId,ownerId){
 if(!isIndependent(s)||typeof houseId!=='string'||!Number.isSafeInteger(ownerId))return {ok:false,reason:'house'};
 ensureHouseholdResourceState(s);
 let store=householdStore(s,houseId);
 if(store)return {ok:true,changed:false,store};
 const personal=materialStock(s,ownerId);
 store={houseId,ownerId,food:personal.food??0,wood:personal.wood??0,stone:personal.stone??0,charcoal:personal.charcoal??0};
 for(const k of MATERIAL_KEYS)if(Object.prototype.hasOwnProperty.call(personal,k))personal[k]=0;
 s.rustMaterials.householdStores.push(store);
 s.rustMaterials.householdStores.sort((a,b)=>Number(a.houseId.slice(1))-Number(b.houseId.slice(1))||a.houseId.localeCompare(b.houseId));
 return {ok:true,changed:true,store};
}

function activeResidence(s,agentId){
 return s.social?.residences?.find(r=>r.agentId===agentId&&r.leftTick===null)??null;
}

function ownerHouseholdStore(s,ownerId){
 ensureHouseholdResourceState(s);
 return (s.rustMaterials.householdStores??[]).filter(b=>b.ownerId===ownerId)
   .sort((a,b)=>Number(a.houseId.slice(1))-Number(b.houseId.slice(1))||a.houseId.localeCompare(b.houseId))[0]??null;
}

export function resourceAccount(s,a){
 if(!isIndependent(s))return {kind:'world',ownerId:null,houseId:null};
 if(!a)return {kind:'personal',ownerId:null,houseId:null};
 const guardian=guardianOf(s,a),subject=guardian??a;
 const residence=activeResidence(s,subject.id);
 const shared=residence?householdStore(s,residence.houseId):ownerHouseholdStore(s,subject.id);
 return shared?{kind:'household',ownerId:shared.ownerId,houseId:shared.houseId}:{kind:'personal',ownerId:subject.id,houseId:null};
}

export function resourceStock(s,aOrId){
 if(!isIndependent(s))return s.stock;
 const a=typeof aOrId==='object'?aOrId:s.agents?.find(x=>x.id===aOrId&&x.alive);
 if(!a)return materialStock(s,aOrId);
 const account=resourceAccount(s,a);
 return account.kind==='household'?householdStore(s,account.houseId):materialStock(s,account.ownerId);
}

export function joinHouseholdResources(s,agentId,houseId){
 if(!isIndependent(s))return {ok:true,changed:false};
 const personal=materialStock(s,agentId),store=householdStore(s,houseId);
 if(!store)return {ok:false,reason:'household-store'};
 const next={};
 for(const k of MATERIAL_KEYS){
   const cap=k==='charcoal'?128:999;
   next[k]=(store[k]??0)+(personal[k]??0);
   if(next[k]>cap)return {ok:false,reason:'household-store-full',resource:k};
 }
 const moved={};
 for(const k of MATERIAL_KEYS){moved[k]=personal[k]??0;store[k]=next[k];personal[k]=0;}
 return {ok:true,changed:Object.values(moved).some(n=>n>0),moved,houseId};
}
export function addPersonalStore(s,a,grant=EMPTY){
 if(!isIndependent(s))return;
 if(s.rustMaterials.personalStores.some(b=>b.ownerId===a.id))throw new Error('Duplicate personal store');
 s.rustMaterials.personalStores.push({ownerId:a.id,food:grant.food??0,wood:grant.wood??0,stone:grant.stone??0,charcoal:0});
}
/** A child depends on an evidenced, living adult ancestor, never an invented stranger. */
export function guardianOf(s,a){
 if(!a?.alive||lifeStage(s,a)!==LIFE_STAGES.CHILD)return null;
 const people=[...(s.agents??[]),...(s.archive??[])],seen=new Set([a.id]);let id=a.parentId;
 while(Number.isSafeInteger(id)&&!seen.has(id)){
  seen.add(id);const p=people.find(x=>x.id===id);if(!p)return null;
  if(p.alive&&canPerformProductiveWork(s,p))return p;
  id=p.parentId;
 }
 return null;
}
export const mealOwnerId=(s,a)=>isIndependent(s)?resourceAccount(s,a).ownerId:null;
export const foodStock=(s,a)=>isIndependent(s)?resourceStock(s,a):s.stock;
export function reservedMealsFor(s,ownerId,mealIds){
 if(!isIndependent(s))return mealIds?.size??0;
 let n=0;for(const id of mealIds??[]){const a=s.agents.find(a=>a.id===id&&a.alive);if(a&&mealOwnerId(s,a)===ownerId)n++;}return n;
}
export function materialTotals(s,{livingOnly=false}={}){
 if(!isIndependent(s))return {...s.stock};
 const out={food:0,wood:0,stone:0};
 for(const b of s.rustMaterials.personalStores){
  if(livingOnly&&!s.agents.some(a=>a.id===b.ownerId&&a.alive))continue;
  for(const k of RESOURCE_KEYS)out[k]+=b[k];
 }
 for(const b of s.rustMaterials.householdStores??[]){
  if(livingOnly&&!s.agents.some(a=>a.id===b.ownerId&&a.alive)&&!(s.social?.residences??[]).some(r=>r.houseId===b.houseId&&r.leftTick===null&&s.agents.some(a=>a.id===r.agentId&&a.alive)))continue;
  for(const k of RESOURCE_KEYS)out[k]+=b[k];
 }
 return out;
}
export function personalTargets(s,a){
 const children=s.agents.filter(c=>guardianOf(s,c)?.id===a.id).length;
 return {food:canPerformProductiveWork(s,a)?Math.max(40,16+children*8):0,wood:24,stone:12};
}
export function validateIndependentWorld(s){
 const e=[],bad=x=>e.push(x);
 if(!isIndependent(s)){
  if(s.worldMode!==undefined||s.version===INDEPENDENT_SAVE_VERSION||s.rustMaterials?.personalStores!==undefined)bad('Independent mode/version');
  return e;
 }
 if(s.version!==INDEPENDENT_SAVE_VERSION||s.worldMode.version!==INDEPENDENT_MODE.version)bad('Independent mode/version');
 if(RESOURCE_KEYS.some(k=>s.stock?.[k]!==0)||s.rustMaterials?.charcoal!==0)bad('Independent world stock must be empty');
 if(s.rustMaterials?.personalVersion!==PERSONAL_MATERIAL_VERSION||!Array.isArray(s.rustMaterials?.personalStores))return [...e,'Personal material extension'];
 if(s.rustMaterials?.householdVersion!==HOUSEHOLD_MATERIAL_VERSION||!Array.isArray(s.rustMaterials?.householdStores))return [...e,'Household material extension'];
 if(!Array.isArray(s.agents)||!Array.isArray(s.archive)||s.agents.concat(s.archive).some(a=>!a||typeof a!=='object'))return [...e,'Independent people'];
 const people=[...s.agents,...s.archive],ids=new Set(people.map(a=>a.id)),seen=new Set();
 for(const b of s.rustMaterials.personalStores){
  if(!b||!ids.has(b.ownerId)||seen.has(b.ownerId)||RESOURCE_KEYS.some(k=>!Number.isFinite(b[k])||b[k]<0||b[k]>999)||!Number.isInteger(b?.charcoal)||b.charcoal<0||b.charcoal>128)bad('Personal material balance');
  seen.add(b?.ownerId);
 }
 if(seen.size!==ids.size||[...ids].some(id=>!seen.has(id)))bad('Missing personal material owner');
 const houses=new Set();
 for(const b of s.rustMaterials.householdStores){
  if(!b||typeof b.houseId!=='string'||!/^H\d+$/.test(b.houseId)||houses.has(b.houseId)||!ids.has(b.ownerId)||
    RESOURCE_KEYS.some(k=>!Number.isFinite(b[k])||b[k]<0||b[k]>999)||!Number.isInteger(b.charcoal)||b.charcoal<0||b.charcoal>128)bad('Household material balance');
  houses.add(b?.houseId);
 }
 for(const a of people){
  if(a.homePlan!==undefined){const p=a.homePlan;
   if(!p||p.version!=='home-plan-1'||!Number.isInteger(p.createdTick)||p.createdTick<0||p.createdTick>s.tick||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.x>=30||p.y<0||p.y>=26)bad('Personal home intention');
  }
 }
 return [...new Set(e)];
}
