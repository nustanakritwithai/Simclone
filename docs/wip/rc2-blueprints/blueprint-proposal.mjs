/**
 * RC2 Blueprint donor: PURE proposal only. Not imported by production.
 * Recipe/monster/outcome snapshots must come from their existing authorities.
 * A proposal is neither a loot grant nor evidence that a person knows a recipe.
 */
export const BLUEPRINT_PROPOSAL_VERSION='blueprint-proposal/v1';
export const BLUEPRINT_LIMITS=Object.freeze({catalog:256,maxTier:5,minLevel:1,maxLevel:60});
export const BLUEPRINT_CHANCE_BP=Object.freeze({NORMAL:1250,ELITE:2500,BOSS:5000});
const fail=message=>{throw new TypeError(message);};
const requireValue=(ok,message)=>{if(!ok)fail(message);};
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
function text(value,label,max=192){
  requireValue(typeof value==='string'&&value.length>0&&value.length<=max&&value===value.trim(),label);
  requireValue(!/[\u0000-\u001f\u007f]/.test(value),label);return value;
}
function hash32(value){
  let hash=0x811c9dc5;
  for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,0x01000193);}
  return hash>>>0;
}
const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);for(const child of Object.values(value))freeze(child);
  }return value;
};
const compareText=(a,b)=>a<b?-1:a>b?1:0; // No locale/host-dependent ordering.
export function maxBlueprintTier(monsterLevel){
  requireValue(integer(monsterLevel,1,60),'monster level must be integer 1..60');
  return Math.min(BLUEPRINT_LIMITS.maxTier,1+Math.floor((monsterLevel-1)/12));
}
function normalizeCatalog(recipes){
  requireValue(Array.isArray(recipes)&&recipes.length<=BLUEPRINT_LIMITS.catalog,'bounded recipe catalog required');
  const recipeIds=new Set(),kinds=new Set();
  const rows=recipes.map(row=>{
    requireValue(plain(row),'recipe entry required');
    const recipeId=text(row.recipeId,'recipeId'),itemKind=text(row.itemKind,'itemKind');
    requireValue(integer(row.tier,1,5),'blueprints admit only non-starter tiers 1..5');
    requireValue(row.starter===false,'starter formulas cannot become loot');
    requireValue(!recipeIds.has(recipeId)&&!kinds.has(itemKind),'duplicate recipe or item kind');
    recipeIds.add(recipeId);kinds.add(itemKind);
    return {recipeId,itemKind,tier:row.tier};
  });
  return rows.sort((a,b)=>compareText(a.recipeId,b.recipeId));
}
/**
 * Input recipe rows are a finite catalog snapshot, not a person's known recipes.
 * Knowledge changes therefore cannot reselect or reroll an earned Blueprint.
 * Stable recipe order is normalized; no input is frozen or changed.
 */
export function proposeBlueprintLoot(input){
  requireValue(plain(input),'input required');
  requireValue(integer(input.worldSeed,0,0xffffffff),'worldSeed must be uint32');
  const catalogVersion=text(input.catalogVersion,'catalogVersion',96);
  const ticket=text(input.rngTicket,'rngTicket',512);
  const monster=input.monster;
  requireValue(plain(monster),'monster snapshot required');
  const monsterId=text(monster.monsterId,'monsterId');
  const tierCap=maxBlueprintTier(monster.level);
  const rank=text(monster.rank,'rank',16).toUpperCase();
  requireValue(Object.hasOwn(BLUEPRINT_CHANCE_BP,rank),'unsupported monster rank');
  const outcome=input.outcome;
  requireValue(plain(outcome)&&outcome.verified===true&&outcome.defeated===true,'verified defeated outcome required');
  const outcomeId=text(outcome.outcomeId,'outcomeId',512);
  const catalog=normalizeCatalog(input.recipes),eligible=catalog.filter(row=>row.tier<=tierCap);
  // JSON tuple prevents delimiter collisions (unlike concatenating free strings).
  const key=JSON.stringify([BLUEPRINT_PROPOSAL_VERSION,input.worldSeed,catalogVersion,monsterId,monster.level,rank,outcomeId,ticket]);
  const chanceRoll=hash32(JSON.stringify([key,'chance']))%10000;
  const selected=eligible.length&&chanceRoll<BLUEPRINT_CHANCE_BP[rank]
    ?eligible[hash32(JSON.stringify([key,'recipe']))%eligible.length]:null;
  const catalogDigest=hash32(JSON.stringify(catalog)).toString(16).padStart(8,'0');
  return freeze({
    version:BLUEPRINT_PROPOSAL_VERSION,committed:false,outcomeId,
    claimKey:`ADVENTURE_LOOT:${outcomeId}`,sourceMonsterId:monsterId,
    catalogVersion,catalogDigest,tierCap,
    items:selected?[{itemKind:selected.itemKind,quantity:1,rarity:'RARE'}]:[],
    recipeId:selected?.recipeId??null,
    trace:{chanceBp:BLUEPRINT_CHANCE_BP[rank],chanceRoll,eligibleCount:eligible.length},
  });
}
