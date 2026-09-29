/** RC5.1 Crafter career + tier capability.
 * Derived from canonical construction placement and recipe completion evidence.
 * No Craft XP, inventory, item, money, RNG or duplicate profession writer.
 */
import {CRAFT_RECIPE_CATALOG,recipeById} from './crafting-catalog.mjs?v=0.5.0';
import {recipeMastery,validateRecipeKnowledge,RECIPE_KNOWLEDGE_LIMITS} from './craft-recipe-knowledge.mjs?v=0.5.0';
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {adoptProfession} from './kingdom-utility.mjs?v=0.5.0';

export const CRAFTER_CAREER_VERSION='RC5.1-crafter/1';
export const CRAFTER_POLICY_VERSION='RC5.1-tier/1';
export const CRAFTER_GRADES=Object.freeze(['APPRENTICE','CRAFTER','EXPERT','MASTER']);
export const CRAFTER_RULES=Object.freeze({
  crafter:Object.freeze({total:6,tier2:2}),
  expert:Object.freeze({total:16,tier3:4}),
  master:Object.freeze({total:32,tier4:6}),
  grandfatherMaxAgents:512,
  grandfatherMaxRecipes:64,
});
const OUTPUTS=Object.freeze([...new Set(Object.values(CRAFT_RECIPE_CATALOG).map(r=>r.output))].sort());
const ADVANCED_IDS=Object.freeze(Object.values(CRAFT_RECIPE_CATALOG).filter(r=>r.tier>=2).map(r=>r.id).sort());
const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;};
const copy=v=>JSON.parse(JSON.stringify(v));

function outputFor(value){
  if(typeof value!=='string')return null;
  const r=recipeById(value);if(r)return r.output;
  return OUTPUTS.includes(value)?value:null;
}
function countsFor(agent,output){
  const counts=[0,0,0,0,0,0];
  for(const r of Object.values(CRAFT_RECIPE_CATALOG))if(r.output===output)counts[r.tier]+=recipeMastery(agent,r.id);
  return counts;
}
export function crafterFamilyProfile(agent,recipeOrOutput){
  const output=outputFor(recipeOrOutput);if(!output)return null;
  const counts=countsFor(agent,output),total=Math.min(RECIPE_KNOWLEDGE_LIMITS.completions,counts.reduce((a,b)=>a+b,0));
  let rank=0;
  if(total>=CRAFTER_RULES.crafter.total&&counts[2]>=CRAFTER_RULES.crafter.tier2)rank=1;
  if(rank===1&&total>=CRAFTER_RULES.expert.total&&counts[3]>=CRAFTER_RULES.expert.tier3)rank=2;
  if(rank===2&&total>=CRAFTER_RULES.master.total&&counts[4]>=CRAFTER_RULES.master.tier4)rank=3;
  return freeze({version:CRAFTER_CAREER_VERSION,output,counts,total,rank,grade:CRAFTER_GRADES[rank],maxTier:[2,3,4,5][rank]});
}
export function crafterConstructionEvidence(state,agent){
  if(!state||!agent||!integer(agent.id,1))return freeze({status:'UNKNOWN',count:0,firstStationId:null,evidenceId:null});
  const rows=(state.rustStations?.stations??[]).filter(st=>st?.complete===true&&st.structurePiece===true&&st.placedBy===agent.id&&integer(st.id,1)&&typeof st.placementId==='string'&&st.placementId.length>0).sort((a,b)=>a.id-b.id);
  if(!rows.length)return freeze({status:'ABSENT',count:0,firstStationId:null,evidenceId:null});
  return freeze({status:'CONFIRMED',count:rows.length,firstStationId:rows[0].id,evidenceId:'station:'+rows[0].id});
}
function bestProfile(agent){
  return OUTPUTS.map(output=>crafterFamilyProfile(agent,output)).sort((a,b)=>b.rank-a.rank||b.total-a.total||(a.output<b.output?-1:1))[0]??null;
}
export function evaluateCrafterQualification(state,agent){
  const fail=(status,reason,extra={})=>freeze({version:CRAFTER_CAREER_VERSION,status,qualified:false,reason,...extra});
  if(!state||!agent||!integer(agent.id,1))return fail('UNKNOWN','actor');
  if(agent.alive!==true||!canPerformProductiveWork(state,agent))return fail('VIOL','actor-ineligible');
  if(agent.profession==='adventurer'||agent.profession==='merchant')return fail('VIOL','special-profession-lock');
  if(agent.profession==='crafter')return freeze({version:CRAFTER_CAREER_VERSION,status:'SAT',qualified:true,reason:'already-crafter',profile:bestProfile(agent),construction:crafterConstructionEvidence(state,agent),evidenceId:null});
  if(agent.profession!=='builder')return fail('VIOL','builder-required');
  if(validateRecipeKnowledge(state,agent).length)return fail('UNKNOWN','recipe-evidence');
  const construction=crafterConstructionEvidence(state,agent);
  if(construction.status==='UNKNOWN')return fail('UNKNOWN','construction-evidence',{construction});
  if(construction.status!=='CONFIRMED')return fail('VIOL','construction-required',{construction});
  const profile=bestProfile(agent);
  if(!profile)return fail('UNKNOWN','family-profile',{construction});
  if(profile.rank<1)return fail('VIOL','craft-mastery-required',{construction,profile});
  const evidenceId=['crafter-v1',agent.id,construction.firstStationId,profile.output,profile.total,profile.counts[2]].join(':');
  return freeze({version:CRAFTER_CAREER_VERSION,status:'SAT',qualified:true,reason:'qualified',construction,profile,evidenceId});
}
export function adoptCrafterProfession(state,agent){
  const qualification=evaluateCrafterQualification(state,agent);
  if(!qualification.qualified)return {changed:false,status:qualification.status,reason:qualification.reason,profession:agent?.profession,qualification};
  if(agent.profession==='crafter')return {changed:false,status:'SAT',profession:'crafter',qualification};
  const transition=adoptProfession(agent,'CRAFTER',state.tick,{qualifiedProfession:'crafter',qualification:'crafter-v1',evidenceId:qualification.evidenceId});
  const status=agent.profession==='crafter'?'SAT':transition.reason==='profession-locked'||transition.reason==='profession-source'?'VIOL':'UNKNOWN';
  return {...transition,status,qualification};
}

export function createCrafterPolicy(){return {version:CRAFTER_POLICY_VERSION,migratedFromLegacy:false,activatedTick:0,grandfathered:[]};}
export function initializeCrafterPolicy(state){
  if(state?.crafterPolicy!==undefined)return validateCrafterPolicy(state).length?{state:'VIOL',reason:'crafter-policy'}:{state:'SAT',changed:false};
  if(!state||!integer(state.tick))return {state:'UNKNOWN',reason:'world'};
  state.crafterPolicy=createCrafterPolicy();state.crafterPolicy.activatedTick=state.tick;
  return {state:'SAT',changed:true};
}
/** One-time old-save compatibility: only recipes already explicit in personal
 * knowledge at migration are grandfathered. Future learning still uses RC5 gates.
 */
export function migrateCrafterPolicy(state){
  if(state?.crafterPolicy!==undefined)return validateCrafterPolicy(state).length?{state:'VIOL',reason:'crafter-policy'}:{state:'SAT',changed:false};
  if(!state||!integer(state.tick)||!Array.isArray(state.agents)||!Array.isArray(state.archive))return {state:'UNKNOWN',reason:'world'};
  const grandfathered=[];
  for(const agent of [...state.agents,...state.archive]){
    if(!integer(agent?.id,1))continue;
    const ids=(agent.knowledgeState?.recipes?.entries??[]).map(e=>e?.recipeId).filter(id=>ADVANCED_IDS.includes(id));
    const recipeIds=[...new Set(ids)].sort();
    if(recipeIds.length)grandfathered.push({agentId:agent.id,recipeIds});
  }
  state.crafterPolicy={version:CRAFTER_POLICY_VERSION,migratedFromLegacy:true,activatedTick:state.tick,grandfathered};
  return validateCrafterPolicy(state).length?{state:'VIOL',reason:'crafter-policy'}:{state:'SAT',changed:true,grandfathered:grandfathered.length};
}
export function validateCrafterPolicy(state){
  const p=state?.crafterPolicy;
  if(!p||p.version!==CRAFTER_POLICY_VERSION||typeof p.migratedFromLegacy!=='boolean'||!integer(p.activatedTick)||p.activatedTick>state.tick||!Array.isArray(p.grandfathered)||p.grandfathered.length>CRAFTER_RULES.grandfatherMaxAgents)return ['Crafter policy'];
  const people=new Set([...(state.agents??[]),...(state.archive??[])].map(a=>a?.id)),seen=new Set();
  for(const row of p.grandfathered){
    if(!row||!integer(row.agentId,1)||!people.has(row.agentId)||seen.has(row.agentId)||!Array.isArray(row.recipeIds)||row.recipeIds.length>CRAFTER_RULES.grandfatherMaxRecipes)return ['Crafter policy'];
    seen.add(row.agentId);
    if(row.recipeIds.some((id,i)=>!ADVANCED_IDS.includes(id)||(i>0&&row.recipeIds[i-1]>=id)))return ['Crafter policy'];
  }
  if(!p.migratedFromLegacy&&p.grandfathered.length)return ['Crafter policy'];
  return [];
}
function isGrandfathered(state,agentId,recipeId){return state?.crafterPolicy?.grandfathered?.find(row=>row.agentId===agentId)?.recipeIds.includes(recipeId)===true;}
export function crafterCraftAccess(state,agent,recipeId){
  const r=recipeById(recipeId);
  if(!r||!agent||!integer(agent.id,1))return freeze({ok:false,reason:'crafter-input'});
  if(validateCrafterPolicy(state).length)return freeze({ok:false,reason:'crafter-policy'});
  if(r.tier<=1)return freeze({ok:true,reason:'starter-access',tier:r.tier});
  if(isGrandfathered(state,agent.id,r.id))return freeze({ok:true,reason:'legacy-grandfathered',tier:r.tier});
  if(r.tier===2){
    const ok=agent.profession==='builder'||agent.profession==='crafter';
    return freeze({ok,reason:ok?'builder-tier':'crafter-builder-required',tier:r.tier,requiredProfession:'builder'});
  }
  if(agent.profession!=='crafter')return freeze({ok:false,reason:'crafter-profession-required',tier:r.tier,requiredProfession:'crafter'});
  const profile=crafterFamilyProfile(agent,r.id);if(!profile)return freeze({ok:false,reason:'crafter-evidence'});
  const requiredRank=r.tier-2,ok=profile.rank>=requiredRank;
  return freeze({ok,reason:ok?'crafter-tier':'crafter-grade-required',tier:r.tier,profile,requiredGrade:CRAFTER_GRADES[requiredRank]});
}
export function crafterPolicySnapshot(state){return state?.crafterPolicy?freeze(copy(state.crafterPolicy)):null;}
