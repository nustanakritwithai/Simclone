/** RC3.1: versioned, pure Blueprint offers and provenance checks.
 * Neither an offer nor a payload grants an item or recipe permission.
 * The v1 pool is explicit: future catalog additions cannot reroll old offers.
 */
import {recipeById,STARTER_RECIPE_IDS} from './crafting-catalog.mjs?v=0.5.0';
import {monsterDefinition} from './adventure-monsters.mjs?v=0.5.0';
export const BLUEPRINT_VERSION='rc3.1-blueprint/v1';
export const BLUEPRINT_CATALOG_VERSION='rc3.1-recipes/v1';
export const BLUEPRINT_ITEM_KIND='RECIPE_BLUEPRINT';
export const BLUEPRINT_CHANCE_BP=Object.freeze({NORMAL:1250,ELITE:2500,BOSS:5000});
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;};
const integer=(x,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const record=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const text=(x,max=1024)=>typeof x==='string'&&x.length>0&&x.length<=max&&x===x.trim()&&!/[\u0000-\u001f\u007f]/.test(x);
const exact=(a,b)=>record(a)&&record(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(b).every(k=>a[k]===b[k]);
const pool=[];
for(const kind of ['STONE_AXE','STONE_PICKAXE','HAMMER'])for(let tier=kind==='HAMMER'?2:1;tier<=5;tier++)pool.push({recipeId:kind+'_T'+tier,tier});
for(const kind of ['HIDE_ARMOR','EMBER_BLADE','EMBER_CHARM'])for(let tier=1;tier<=5;tier++)pool.push({recipeId:tier===1?kind:kind+'_T'+tier,tier});
export const BLUEPRINT_RECIPE_POOL=freeze(pool.sort((a,b)=>a.recipeId<b.recipeId?-1:a.recipeId>b.recipeId?1:0));
function hash32(value){let h=0x811c9dc5;for(let n=0;n<value.length;n++){h^=value.charCodeAt(n);h=Math.imul(h,0x01000193);}return h>>>0;}
export function blueprintTierCap(level){
  if(!integer(level,1,60))throw new TypeError('blueprint-level');
  return Math.min(5,1+Math.floor((level-1)/12));
}
/** Called once at combat acceptance, before gameplay mutations. */
export function createBlueprintOffer({worldSeed,agentId,combatId,monsterId,monsterLevel,rank,acceptedTick}={}){
  if(!integer(acceptedTick)||!integer(worldSeed,0,0xffffffff)||!integer(agentId,1)||!text(combatId)||!combatId.startsWith('advcombat:')||
    !text(monsterId,192)||!monsterDefinition(monsterId)||!text(rank,16))throw new TypeError('blueprint-source');
  const normalizedRank=rank.toUpperCase(),tierCap=blueprintTierCap(monsterLevel);
  if(!Object.hasOwn(BLUEPRINT_CHANCE_BP,normalizedRank))throw new TypeError('blueprint-rank');
  const eligible=BLUEPRINT_RECIPE_POOL.filter(r=>r.tier<=tierCap);
  // Acceptance tick is provenance, not a roll input: UI latency cannot reroll.
  const key=JSON.stringify([BLUEPRINT_VERSION,BLUEPRINT_CATALOG_VERSION,worldSeed,agentId,combatId,monsterId,monsterLevel,normalizedRank]);
  const chanceRoll=hash32(JSON.stringify([key,'chance']))%10000;
  const selected=chanceRoll<BLUEPRINT_CHANCE_BP[normalizedRank]?eligible[hash32(JSON.stringify([key,'recipe']))%eligible.length]:null;
  return freeze({version:BLUEPRINT_VERSION,catalogVersion:BLUEPRINT_CATALOG_VERSION,worldSeed,agentId,combatId,monsterId,monsterLevel,
    acceptedTick,rank:normalizedRank,tierCap,chanceRoll,chanceBp:BLUEPRINT_CHANCE_BP[normalizedRank],recipeId:selected?.recipeId??null});
}
export function validBlueprintOffer(offer,context={}){
  try{
    if(!record(offer)||!exact(offer,createBlueprintOffer(offer)))return false;
    if(Object.entries(context).some(([k,v])=>offer[k]!==v))return false;
    const r=offer.recipeId===null?null:recipeById(offer.recipeId);
    return offer.recipeId===null||!!r&&!STARTER_RECIPE_IDS.includes(r.id)&&
      BLUEPRINT_RECIPE_POOL.some(p=>p.recipeId===r.id&&p.tier===r.tier);
  }catch{return false;}
}
export function blueprintSessionErrors(state,agent,session=agent?.adventureCombat){
  const offer=session?.blueprintOffer;if(offer===undefined)return [];
  return validBlueprintOffer(offer,{worldSeed:state.seed,agentId:agent.id,combatId:session.combatId,acceptedTick:session.startedTick,
    monsterId:session.monsterId,monsterLevel:session.monsterLevel,rank:String(session.rank).toUpperCase()})?[]:['Adventure Blueprint offer'];
}
export function blueprintPayload(offer,outcomeId,terminalTurn){
  const payload={version:BLUEPRINT_VERSION,offer,outcomeId,terminalTurn};
  if(!validBlueprintPayload(payload))throw new TypeError('blueprint-payload');
  return freeze(payload);
}
export function validBlueprintPayload(value,context={}){
  return record(value)&&Object.keys(value).length===4&&value.version===BLUEPRINT_VERSION&&
    validBlueprintOffer(value.offer,context)&&value.offer.recipeId!==null&&integer(value.terminalTurn,1)&&
    value.outcomeId==='advout:'+value.offer.combatId+':victory:'+value.terminalTurn;
}
export function sameBlueprintPayload(a,b){
  return validBlueprintPayload(a)&&validBlueprintPayload(b)&&a.version===b.version&&a.outcomeId===b.outcomeId&&
    a.terminalTurn===b.terminalTurn&&exact(a.offer,b.offer);
}
export function validBlueprintItem(state,item,{pending=false}={}){
  return !!state?.rustPossessions&&!!item&&item.kind===BLUEPRINT_ITEM_KIND&&item.craft===undefined&&item.upgradeLevel===undefined&&
    integer(item.id,1)&&integer(item.createdBy,1)&&integer(item.createdTick,0,state.tick)&&
    validBlueprintPayload(item.blueprint,{worldSeed:state.seed,agentId:item.createdBy})&&
    item.createdTick>=item.blueprint.offer.acceptedTick&&item.sourceClaimKey==='ADVENTURE_LOOT:'+item.blueprint.outcomeId&&
    (pending?item.id>=state.rustPossessions.nextItem:item.id<state.rustPossessions.nextItem);
}
/** Evidence already lives in personal knowledge; this is only a read projection. */
export function consumedBlueprintEvidence(state){
  return [...(state.agents??[]),...(state.archive??[])].flatMap(a=>
    (Array.isArray(a?.knowledgeState?.recipes?.entries)?a.knowledgeState.recipes.entries:[])
      .filter(e=>e?.learned?.method==='blueprint').map(e=>({agent:a,recipeId:e.recipeId,learned:e.learned})));
}
export function validBlueprintLearning(state,agent,recipeId,learned){
  if(!Array.isArray(state?.rustPossessions?.items)||!agent||!record(learned)||learned.method!=='blueprint'||!integer(learned.tick,agent.bornTick,state.tick)||
    !integer(learned.itemId,1)||!integer(learned.acquiredTick,0,learned.tick)||!integer(learned.createdBy,1)||
    !validBlueprintPayload(learned.blueprint,{worldSeed:state.seed,agentId:learned.createdBy})||
    learned.acquiredTick<learned.blueprint.offer.acceptedTick||learned.blueprint.offer.recipeId!==recipeId||learned.sourceClaimKey!=='ADVENTURE_LOOT:'+learned.blueprint.outcomeId||
    learned.itemId>=state.rustPossessions.nextItem||state.rustPossessions.items.some(i=>i.id===learned.itemId))return false;
  return true;
}
export function validateBlueprintEvidence(state){
  if(!Array.isArray(state?.agents)||!Array.isArray(state.archive)||!Array.isArray(state.rustPossessions?.items)||
    !Array.isArray(state.rustPossessions?.orders))return ['Blueprint state shape'];
  const ids=new Set(),claims=new Set();
  for(const {agent,recipeId,learned} of consumedBlueprintEvidence(state)){
    if(!validBlueprintLearning(state,agent,recipeId,learned)||ids.has(learned.itemId)||claims.has(learned.sourceClaimKey))return ['Blueprint learning evidence'];
    ids.add(learned.itemId);claims.add(learned.sourceClaimKey);
  }
  for(const item of state.rustPossessions?.items??[]){
    if(!record(item))return ['Blueprint item shape'];
    if(item.kind!==BLUEPRINT_ITEM_KIND){if(item.blueprint!==undefined)return ['Blueprint item kind'];continue;}
    if(!validBlueprintItem(state,item)||ids.has(item.id)||claims.has(item.sourceClaimKey))return ['Blueprint item evidence'];
    ids.add(item.id);claims.add(item.sourceClaimKey);
  }
  // A consumed Blueprint cannot also be claimed as a crafted output or escrow.
  const consumed=new Set(consumedBlueprintEvidence(state).map(x=>x.learned.itemId));
  for(const a of [...state.agents,...state.archive]){
    const entries=a?.knowledgeState?.recipes?.entries;if(entries===undefined)continue;
    if(!Array.isArray(entries))return ['Blueprint knowledge shape'];
    for(const e of entries){
      if(!record(e)||!Array.isArray(e.receipts))return ['Blueprint receipt shape'];
      for(const r of [...e.receipts,...(e.retiredThrough?[e.retiredThrough]:[])])
        if(!record(r)||consumed.has(r.itemId))return ['Blueprint receipt identity'];
    }
  }
  for(const o of state.rustPossessions.orders){
    if(!record(o))return ['Blueprint order shape'];
    if(o.reservedItems===undefined)continue;
    if(!Array.isArray(o.reservedItems)||o.reservedItems.some(i=>!record(i)||consumed.has(i.itemId)))return ['Blueprint escrow identity'];
  }
  return [];
}
