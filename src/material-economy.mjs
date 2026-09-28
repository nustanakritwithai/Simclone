/** RC3.2 one-route bulk material authority. No inventory duplication and no global RNG. */
import {isIndependent,resourceStock} from './individual-resources.mjs?v=0.5.0';
import {BULK_MATERIAL_KEYS,BULK_MATERIAL_CAPS,BULK_MATERIAL_LABELS} from './material-schema.mjs?v=0.5.0';
export const METAL_ECONOMY_VERSION='RC3.2-metal/1';
const bulk=new Set(BULK_MATERIAL_KEYS),base=new Set(['food','wood','stone']),integer=(x,min=0)=>Number.isSafeInteger(x)&&x>=min;
function ledger(s,a,key){if(base.has(key))return resourceStock(s,a);if(!bulk.has(key))return null;return isIndependent(s)?resourceStock(s,a):s.rustMaterials;}
export function materialAmount(s,a,key){const store=ledger(s,a,key),value=store?.[key];return Number.isFinite(value)&&value>=0?value:0;}
export function materialSnapshot(s,a){return Object.freeze(Object.fromEntries(['food','wood','stone',...BULK_MATERIAL_KEYS].map(key=>[key,materialAmount(s,a,key)])));}
const cap=key=>BULK_MATERIAL_CAPS[key]??999;
function validSet(set){return !!set&&typeof set==='object'&&!Array.isArray(set)&&Object.entries(set).every(([key,x])=>(base.has(key)||bulk.has(key))&&integer(x,1));}
export function materialMissing(s,a,set={}){if(!validSet(set)&&Object.keys(set).length)return null;const missing={};for(const [key,x] of Object.entries(set)){const have=materialAmount(s,a,key);if(have<x)missing[key]=x-have;}return missing;}
export function consumeMaterialSet(s,a,set={}){const missing=materialMissing(s,a,set);if(missing===null)return {ok:false,reason:'materials'};if(Object.keys(missing).length)return {ok:false,reason:'materials',missing};for(const [key,x] of Object.entries(set)){const store=ledger(s,a,key);if(store[key]===undefined)store[key]=0;store[key]-=x;}return {ok:true,consumed:{...set}};}
export function addMaterialSet(s,a,set={}){if(!validSet(set)&&Object.keys(set).length)return {ok:false,reason:'materials'};for(const [key,x] of Object.entries(set))if(materialAmount(s,a,key)+x>cap(key))return {ok:false,reason:'output-capacity',material:key};for(const [key,x] of Object.entries(set)){const store=ledger(s,a,key);if(store[key]===undefined)store[key]=0;store[key]+=x;}return {ok:true,added:{...set}};}
function hash(text){let x=2166136261;for(let i=0;i<text.length;i++){x^=text.charCodeAt(i);x=Math.imul(x,16777619)>>>0;}x^=x>>>16;x=Math.imul(x,0x85ebca6b);x^=x>>>13;return x>>>0;}
export function ironOreYieldForMining({worldSeed,nodeId,extractedBefore,amount}={}){if(!integer(worldSeed)||worldSeed>0xffffffff||!integer(nodeId,1)||!integer(extractedBefore)||!integer(amount,1)||amount>16)throw new Error('iron_ore_yield_input');let out=0;for(let i=0;i<amount;i++)if(hash([METAL_ECONOMY_VERSION,worldSeed,nodeId,extractedBefore+i].join('|'))%4===0)out++;return out;}
export {BULK_MATERIAL_KEYS,BULK_MATERIAL_CAPS,BULK_MATERIAL_LABELS};
