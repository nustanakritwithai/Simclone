/** IC3 resource routing. Each unit has ONE writer/store; world totals are read-only sums.
 * Legacy worlds keep s.stock. Independent saves keep balances in the existing Rust
 * material ledger, never in both places. This module owns the versioned extension.
 */
import {canPerformProductiveWork,lifeStage,LIFE_STAGES} from './lifecycle.mjs?v=0.5.0';
export const INDEPENDENT_SAVE_VERSION='0.6.0';
export const INDEPENDENT_MODE=Object.freeze({kind:'independent',version:'IC3-1'});
export const PERSONAL_MATERIAL_VERSION='IC3-materials-1';
export const RESOURCE_KEYS=Object.freeze(['food','wood','stone']);
const EMPTY=Object.freeze({food:0,wood:0,stone:0});
export const isIndependent=s=>s?.worldMode?.kind==='independent';
export const materialStock=(s,agentOrId)=>isIndependent(s)
 ?s.rustMaterials?.personalStores?.find(b=>b.ownerId===(typeof agentOrId==='object'?agentOrId?.id:agentOrId))??EMPTY:s.stock;
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
export const mealOwnerId=(s,a)=>isIndependent(s)?(guardianOf(s,a)?.id??a.id):null;
export const foodStock=(s,a)=>isIndependent(s)?materialStock(s,mealOwnerId(s,a)):s.stock;
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
 if(!Array.isArray(s.agents)||!Array.isArray(s.archive)||s.agents.concat(s.archive).some(a=>!a||typeof a!=='object'))return [...e,'Independent people'];
 const people=[...s.agents,...s.archive],ids=new Set(people.map(a=>a.id)),seen=new Set();
 for(const b of s.rustMaterials.personalStores){
  if(!b||!ids.has(b.ownerId)||seen.has(b.ownerId)||RESOURCE_KEYS.some(k=>!Number.isFinite(b[k])||b[k]<0||b[k]>999)||!Number.isInteger(b?.charcoal)||b.charcoal<0||b.charcoal>128)bad('Personal material balance');
  seen.add(b?.ownerId);
 }
 if(seen.size!==ids.size||[...ids].some(id=>!seen.has(id)))bad('Missing personal material owner');
 for(const a of people){
  if(a.homePlan!==undefined){const p=a.homePlan;
   if(!p||p.version!=='home-plan-1'||!Number.isInteger(p.createdTick)||p.createdTick<0||p.createdTick>s.tick||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.x>=30||p.y<0||p.y>=26)bad('Personal home intention');
  }
 }
 return [...new Set(e)];
}
