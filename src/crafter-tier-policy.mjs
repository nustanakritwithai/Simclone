/** RC5 G5 high-tier craft permission and one-time old-save grandfathering.
 * This module stores permission migration evidence only. It owns no recipe,
 * item, material, profession, mastery or order state.
 */
import {CRAFT_RECIPE_CATALOG,recipeById} from './crafting-catalog.mjs?v=0.5.0';
import {recipeKnowledgeSnapshot,validateRecipeKnowledge} from './craft-recipe-knowledge.mjs?v=0.5.0';
import {crafterFamilyProfile} from './crafter-career.mjs?v=0.5.0';

export const CRAFTER_TIER_POLICY_VERSION='RC5-tier-policy/1';
export const CRAFTER_TIER_POLICY_LIMITS=Object.freeze({agents:128,recipesPerAgent:32});
const SAT='SAT',VIOL='VIOL',UNKNOWN='UNKNOWN';
const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;};
const result=(status,reason,extra={})=>freeze({version:CRAFTER_TIER_POLICY_VERSION,status,allowed:status===SAT,reason,...extra});
const people=s=>[...(s?.agents??[]),...(s?.archive??[])];
const highTier=r=>r?.tier>=3&&r.tier<=5;

export const createCrafterTierPolicy=(tick=0)=>({version:CRAFTER_TIER_POLICY_VERSION,mode:'NATIVE',migratedTick:tick,agents:[]});

function grandfatherIds(s,a){
  if(validateRecipeKnowledge(s,a).length)return [];
  return recipeKnowledgeSnapshot(s,a).filter(row=>row.known&&row.tier>=3&&row.tier<=5&&
    Number.isInteger(row.learned?.tick)&&row.learned.tick>=0&&row.learned.tick<=s.tick)
    .map(row=>row.recipeId).sort();
}
/** Missing policy means exactly a pre-G5 save. Capture only knowledge that has a
 * canonical learned tick at or before the migration tick. This runs once.
 */
export function migrateCrafterTierPolicy(s){
  if(!s||s.crafterTierPolicy!==undefined)return s;
  const rows=[];
  for(const a of people(s).sort((x,y)=>x.id-y.id)){
    const recipeIds=grandfatherIds(s,a);
    if(recipeIds.length)rows.push({agentId:a.id,recipeIds});
  }
  s.crafterTierPolicy={version:CRAFTER_TIER_POLICY_VERSION,mode:'GRANDFATHERED',migratedTick:s.tick,agents:rows};
  return s;
}
export function ensureCrafterTierPolicy(s,{newWorld=false}={}){
  if(!s)return s;
  if(s.crafterTierPolicy===undefined){
    if(newWorld)s.crafterTierPolicy=createCrafterTierPolicy(Number.isInteger(s.tick)&&s.tick>=0?s.tick:0);
    else migrateCrafterTierPolicy(s);
  }
  return s;
}
function grandfatherRow(s,agentId){
  return s?.crafterTierPolicy?.mode==='GRANDFATHERED'?s.crafterTierPolicy.agents.find(x=>x.agentId===agentId)??null:null;
}
export function grandfatheredCrafterRecipe(s,agentId,recipeId){
  const row=grandfatherRow(s,agentId);
  return !!row?.recipeIds.includes(recipeId);
}
export function crafterTierPermission(s,a,recipeId){
  const r=recipeById(recipeId);
  if(!s||!a||!r)return result(UNKNOWN,'input');
  if(r.tier<=2)return result(SAT,'low-tier',{recipeId:r.id,tier:r.tier});
  if(validateCrafterTierPolicy(s).length)return result(UNKNOWN,'tier-policy',{recipeId:r.id,tier:r.tier});
  if(grandfatheredCrafterRecipe(s,a.id,r.id))return result(SAT,'grandfathered',{recipeId:r.id,tier:r.tier});
  if(a.profession!=='crafter')return result(VIOL,'crafter-required',{recipeId:r.id,tier:r.tier});
  const profile=crafterFamilyProfile(s,a,r.output);
  if(profile.status!=='SAT'||!profile.profile)return result(UNKNOWN,'career-evidence',{recipeId:r.id,tier:r.tier});
  if(r.tier>profile.profile.maxNewTier)return result(VIOL,'crafter-grade',{recipeId:r.id,tier:r.tier,grade:profile.profile.grade,maxTier:profile.profile.maxNewTier});
  return result(SAT,'crafter-grade',{recipeId:r.id,tier:r.tier,grade:profile.profile.grade,maxTier:profile.profile.maxNewTier});
}
export function validateCrafterTierPolicy(s){
  const p=s?.crafterTierPolicy,e=[];
  if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).sort().join('|')!=='agents|migratedTick|mode|version'||
    p.version!==CRAFTER_TIER_POLICY_VERSION||!['NATIVE','GRANDFATHERED'].includes(p.mode)||
    !Number.isInteger(p.migratedTick)||p.migratedTick<0||p.migratedTick>s.tick||
    !Array.isArray(p.agents)||p.agents.length>CRAFTER_TIER_POLICY_LIMITS.agents)return ['Crafter tier policy'];
  if(p.mode==='NATIVE'&&p.agents.length!==0)return ['Crafter tier policy'];
  const byId=new Map(people(s).map(a=>[a.id,a]));let last=0;
  for(const row of p.agents){
    if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).sort().join('|')!=='agentId|recipeIds'||
      !Number.isSafeInteger(row.agentId)||row.agentId<=last||!byId.has(row.agentId)||
      !Array.isArray(row.recipeIds)||row.recipeIds.length>CRAFTER_TIER_POLICY_LIMITS.recipesPerAgent||
      new Set(row.recipeIds).size!==row.recipeIds.length||row.recipeIds.some((id,i)=>typeof id!=='string'||i>0&&row.recipeIds[i-1]>=id)){
      e.push('Crafter tier policy');break;
    }
    last=row.agentId;const a=byId.get(row.agentId);
    if(validateRecipeKnowledge(s,a).length){e.push('Crafter tier policy evidence');continue;}
    const snapshots=new Map(recipeKnowledgeSnapshot(s,a).map(x=>[x.recipeId,x]));
    for(const id of row.recipeIds){
      const r=CRAFT_RECIPE_CATALOG[id],snap=snapshots.get(id);
      if(!highTier(r)||!snap?.known||!Number.isInteger(snap.learned?.tick)||snap.learned.tick<0||snap.learned.tick>p.migratedTick){
        e.push('Crafter tier policy evidence');break;
      }
    }
  }
  return [...new Set(e)];
}
