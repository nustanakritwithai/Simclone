/** RC2 pure, versioned item generation. No simulation/global RNG consumption. */
import {recipeById,ITEM_CATALOG} from './crafting-catalog.mjs?v=0.5.0';
export const CRAFT_OUTCOME_VERSION='RC2-outcome/1';
export const CRAFT_ORDER_VERSION='RC2-order/1';
export const CRAFT_ABILITY_BOUNDS=Object.freeze({WORK_SPEED_BPS:6000,ATK:24,DEF:24,SPATK:24,SPDEF:24,SPD:10,HP:80});
const pools=Object.freeze({WEAPON:['ATK','SPATK','SPD'],ARMOR:['DEF','SPDEF','HP'],ACCESSORY:['SPATK','SPD','HP']});
const int=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const keys=(v,expected)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...expected].sort().join('|');
const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;};
function hash(text){let x=2166136261;for(let i=0;i<text.length;i++){x^=text.charCodeAt(i);x=Math.imul(x,16777619)>>>0;}x^=x>>>16;x=Math.imul(x,0x85ebca6b);x^=x>>>13;return x>>>0;}
function ticketFor(seed,orderId,creatorId,recipeId,mastery){return hash([CRAFT_OUTCOME_VERSION,seed,orderId,creatorId,recipeId,mastery].join('|')).toString(16).padStart(8,'0');}
export function createCraftSpec({worldSeed,orderId,creatorId,recipeId,mastery}){
  if(!int(worldSeed,0,0xffffffff)||!int(orderId,1)||!int(creatorId,1)||!recipeById(recipeId)||!int(mastery,0,65535))throw new Error('craft_spec_input');
  return freeze({version:CRAFT_ORDER_VERSION,worldSeed,mastery,ticket:ticketFor(worldSeed,orderId,creatorId,recipeId,mastery)});
}
export function validateCraftSpec(spec,{worldSeed,orderId,creatorId,recipeId}){
  if(!keys(spec,['version','worldSeed','mastery','ticket']))return false;
  try{return spec.version===CRAFT_ORDER_VERSION&&spec.worldSeed===worldSeed&&
    spec.ticket===createCraftSpec({worldSeed,orderId,creatorId,recipeId,mastery:spec.mastery}).ticket;}catch{return false;}
}
export function resolveCraftOutcome({spec,orderId,creatorId,recipeId}){
  if(!validateCraftSpec(spec,{worldSeed:spec?.worldSeed,orderId,creatorId,recipeId}))throw new Error('craft_spec_invalid');
  const r=recipeById(recipeId),def=ITEM_CATALOG[r.output],roll=channel=>hash(spec.ticket+'|'+channel);
  const floor=30+Math.min(40,2*spec.mastery),ceiling=Math.min(100,floor+30);
  const quality=floor+roll('quality')%(ceiling-floor+1),abilities=[];
  if(def.category==='tool')abilities.push({kind:'WORK_SPEED_BPS',value:Math.min(CRAFT_ABILITY_BOUNDS.WORK_SPEED_BPS,quality*10+r.tier*400+roll('work-speed')%151)});
  if(def.category==='gear'){
    const pool=[...pools[def.equipSlot]].sort((a,b)=>roll('pick:'+a)-roll('pick:'+b)||(a<b?-1:1));
    const count=Math.min(pool.length,1+(r.tier>=3?1:0)+(quality>=90?1:0));
    for(const kind of pool.slice(0,count)){
      const base=1+r.tier+Math.floor(quality/25)+roll('magnitude:'+kind)%3;
      const value=Math.min(CRAFT_ABILITY_BOUNDS[kind],kind==='HP'?base*4:kind==='SPD'?Math.max(1,Math.floor(base/2)):base);
      abilities.push({kind,value});
    }
  }
  return freeze({version:CRAFT_OUTCOME_VERSION,worldSeed:spec.worldSeed,orderId,recipeId,mastery:spec.mastery,
    tier:r.tier,quality,ticket:spec.ticket,abilities});
}
/** Old items are intentionally not retrofitted. A present malformed craft is corruption. */
export function validateCraftedItem(item,worldSeed=null){
  if(item?.craft===undefined)return true;
  const c=item.craft;
  if(!keys(c,['version','worldSeed','orderId','recipeId','mastery','tier','quality','ticket','abilities'])||
    c.version!==CRAFT_OUTCOME_VERSION||!int(item.createdBy,1)||!int(item.id??item.itemId,1)||
    (worldSeed!==null&&c.worldSeed!==worldSeed)||recipeById(c.recipeId)?.output!==(item.kind??item.gearId))return false;
  try{
    const expected=resolveCraftOutcome({spec:{version:CRAFT_ORDER_VERSION,worldSeed:c.worldSeed,mastery:c.mastery,ticket:c.ticket},
      orderId:c.orderId,creatorId:item.createdBy,recipeId:c.recipeId});
    return c.tier===expected.tier&&c.quality===expected.quality&&Array.isArray(c.abilities)&&
      c.abilities.length===expected.abilities.length&&c.abilities.every((a,i)=>keys(a,['kind','value'])&&
        a.kind===expected.abilities[i].kind&&a.value===expected.abilities[i].value);
  }catch{return false;}
}
export function craftedToolMultiplier(item,base=1){
  if(!validateCraftedItem(item))throw new Error('invalid_crafted_tool');
  const bonus=item?.craft?.abilities.find(a=>a.kind==='WORK_SPEED_BPS')?.value??0;
  return Math.min(2.25,base*(10000+bonus)/10000);
}
export function craftedGearBaseModifiers(item,base){
  if(!validateCraftedItem(item))throw new Error('invalid_crafted_gear');
  const out={...base};
  for(const a of item?.craft?.abilities??[]){if(a.kind==='WORK_SPEED_BPS')throw new Error('invalid_gear_ability');out[a.kind]=(out[a.kind]??0)+a.value;}
  return out;
}
