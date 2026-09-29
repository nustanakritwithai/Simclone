/** RC3.2 one-route bulk material authority. No inventory duplication and no global RNG. */
import {isIndependent,resourceStock,sameResourceAccount} from './individual-resources.mjs?v=0.5.0';
import {BULK_MATERIAL_KEYS,BULK_MATERIAL_CAPS,BULK_MATERIAL_LABELS} from './material-schema.mjs?v=0.5.0';
export const METAL_ECONOMY_VERSION='RC3.2-metal/1';
const bulk=new Set(BULK_MATERIAL_KEYS),base=new Set(['food','wood','stone']),integer=(x,min=0)=>Number.isSafeInteger(x)&&x>=min;
function ledger(s,a,key){if(base.has(key))return resourceStock(s,a);if(!bulk.has(key))return null;return isIndependent(s)?resourceStock(s,a):s.rustMaterials;}
export function materialAmount(s,a,key){const store=ledger(s,a,key),value=store?.[key];return Number.isFinite(value)&&value>=0?value:0;}
export function materialSnapshot(s,a){return Object.freeze(Object.fromEntries(['food','wood','stone',...BULK_MATERIAL_KEYS].map(key=>[key,materialAmount(s,a,key)])));}
const cap=key=>BULK_MATERIAL_CAPS[key]??999;
export const TRADEABLE_MATERIAL_KEYS=Object.freeze(['food','wood','stone',...BULK_MATERIAL_KEYS]);
export const materialCapacity=key=>TRADEABLE_MATERIAL_KEYS.includes(key)?cap(key):null;
function validSet(set){return !!set&&typeof set==='object'&&!Array.isArray(set)&&Object.entries(set).every(([key,x])=>(base.has(key)||bulk.has(key))&&integer(x,1));}
export function materialMissing(s,a,set={}){if(!validSet(set)&&Object.keys(set).length)return null;const missing={};for(const [key,x] of Object.entries(set)){const have=materialAmount(s,a,key);if(have<x)missing[key]=x-have;}return missing;}
export function consumeMaterialSet(s,a,set={}){const missing=materialMissing(s,a,set);if(missing===null)return {ok:false,reason:'materials'};if(Object.keys(missing).length)return {ok:false,reason:'materials',missing};for(const [key,x] of Object.entries(set)){const store=ledger(s,a,key);if(store[key]===undefined)store[key]=0;store[key]-=x;}return {ok:true,consumed:{...set}};}
export function addMaterialSet(s,a,set={}){if(!validSet(set)&&Object.keys(set).length)return {ok:false,reason:'materials'};for(const [key,x] of Object.entries(set))if(materialAmount(s,a,key)+x>cap(key))return {ok:false,reason:'output-capacity',material:key};for(const [key,x] of Object.entries(set)){const store=ledger(s,a,key);if(store[key]===undefined)store[key]=0;store[key]+=x;}return {ok:true,added:{...set}};}
/** ER0 canonical bulk-resource ownership transfer.
 * Mutates only the existing personal/household/material resource account.
 * It is atomic at this authority boundary and creates no item instance or second ledger.
 */
export function transferMaterialQuantity(s,{fromAgentId,toAgentId,itemKind,quantity}={}){
  if(!isIndependent(s))return {ok:false,reason:'mode'};
  if(!integer(fromAgentId,1)||!integer(toAgentId,1)||fromAgentId===toAgentId)return {ok:false,reason:'actor'};
  if(!TRADEABLE_MATERIAL_KEYS.includes(itemKind)||!integer(quantity,1))return {ok:false,reason:'materials'};
  const from=s.agents?.find(a=>a.id===fromAgentId&&a.alive),to=s.agents?.find(a=>a.id===toAgentId&&a.alive);
  if(!from||!to)return {ok:false,reason:'actor'};
  if(sameResourceAccount(s,from,to))return {ok:false,reason:'shared-account'};
  const fromStore=resourceStock(s,from),toStore=resourceStock(s,to);
  if(!fromStore||!toStore||fromStore===toStore)return {ok:false,reason:'resource-account'};
  const fromBefore=materialAmount(s,from,itemKind),toBefore=materialAmount(s,to,itemKind),limit=cap(itemKind);
  if(fromBefore<quantity)return {ok:false,reason:'insufficient-material',available:fromBefore};
  if(toBefore+quantity>limit)return {ok:false,reason:'output-capacity',material:itemKind,capacity:limit};
  const totalBefore=fromBefore+toBefore;
  fromStore[itemKind]=fromBefore-quantity;toStore[itemKind]=toBefore+quantity;
  const fromAfter=materialAmount(s,from,itemKind),toAfter=materialAmount(s,to,itemKind);
  if(fromAfter!==fromBefore-quantity||toAfter!==toBefore+quantity||fromAfter+toAfter!==totalBefore){
    fromStore[itemKind]=fromBefore;toStore[itemKind]=toBefore;
    return {ok:false,reason:'conservation'};
  }
  return {ok:true,itemKind,quantity,fromAgentId,toAgentId,fromBefore,fromAfter,toBefore,toAfter,totalBefore,totalAfter:fromAfter+toAfter};
}
function hash(text){let x=2166136261;for(let i=0;i<text.length;i++){x^=text.charCodeAt(i);x=Math.imul(x,16777619)>>>0;}x^=x>>>16;x=Math.imul(x,0x85ebca6b);x^=x>>>13;return x>>>0;}
export function ironOreYieldForMining({worldSeed,nodeId,extractedBefore,amount}={}){if(!integer(worldSeed)||worldSeed>0xffffffff||!integer(nodeId,1)||!integer(extractedBefore)||!integer(amount,1)||amount>16)throw new Error('iron_ore_yield_input');let out=0;for(let i=0;i<amount;i++)if(hash([METAL_ECONOMY_VERSION,worldSeed,nodeId,extractedBefore+i].join('|'))%4===0)out++;return out;}
export {BULK_MATERIAL_KEYS,BULK_MATERIAL_CAPS,BULK_MATERIAL_LABELS};
