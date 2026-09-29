/** RC5 G1 — read-only Crafter qualification projection.
 * Reads canonical construction and recipe evidence. It never changes profession,
 * crafts items, writes mastery, or accepts caller-provided proof as authority.
 */
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {validateSkillProvenance} from './skill-provenance.mjs?v=0.5.0';
import {CRAFT_RECIPE_CATALOG} from './crafting-catalog.mjs?v=0.5.0';
import {recipeMastery,validateRecipeKnowledge,RECIPE_KNOWLEDGE_LIMITS} from './craft-recipe-knowledge.mjs?v=0.5.0';
import {evaluateModularHouses} from './housing.mjs?v=0.5.0';
import {canonicalEdge,socketKey,validateRustStations} from './rust-stations.mjs?v=0.5.0';

export const CRAFTER_CAREER_VERSION='RC5-career-g1/1';
export const CRAFTER_SPECIALTY_OUTPUTS=Object.freeze([
  'STONE_AXE','STONE_PICKAXE','HAMMER','EMBER_BLADE','HIDE_ARMOR','EMBER_CHARM'
]);
export const CRAFTER_GRADES=Object.freeze(['APPRENTICE','CRAFTER','EXPERT','MASTER']);
export const CRAFTER_QUALIFICATION_POLICY=Object.freeze({
  minFamilyCompletions:6,
  minTier2Completions:2,
  expertFamilyCompletions:16,
  expertTier3Completions:4,
  masterFamilyCompletions:32,
  masterTier4Completions:6,
});
const specialties=new Set(CRAFTER_SPECIALTY_OUTPUTS);
const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);for(const child of Object.values(value))freeze(child);
  }
  return value;
};
const result=(state,reason,extra={})=>freeze({
  version:CRAFTER_CAREER_VERSION,state,reason,commitAllowed:false,...extra
});
const validAgentId=id=>Number.isSafeInteger(id)&&id>0;
const familyRank=(counts,total)=>{
  let rank=0;
  if(total>=CRAFTER_QUALIFICATION_POLICY.minFamilyCompletions&&counts[2]>=CRAFTER_QUALIFICATION_POLICY.minTier2Completions)rank=1;
  if(rank===1&&total>=CRAFTER_QUALIFICATION_POLICY.expertFamilyCompletions&&counts[3]>=CRAFTER_QUALIFICATION_POLICY.expertTier3Completions)rank=2;
  if(rank===2&&total>=CRAFTER_QUALIFICATION_POLICY.masterFamilyCompletions&&counts[4]>=CRAFTER_QUALIFICATION_POLICY.masterTier4Completions)rank=3;
  return rank;
};
function completedHouseSocketKeys(house){
  const keys=new Set(),inside=new Set(house.cells.map(c=>c.x+':'+c.y));
  for(const cell of house.cells){
    keys.add(socketKey({type:'cell',x:cell.x,y:cell.y,level:0}));
    keys.add(socketKey({type:'cell',x:cell.x,y:cell.y,level:2}));
    for(const [side,[dx,dy]] of Object.entries({N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]})){
      if(inside.has((cell.x+dx)+':'+(cell.y+dy)))continue;
      const edge=canonicalEdge(cell.x,cell.y,side);if(edge)keys.add(socketKey(edge));
    }
  }
  return keys;
}

/** Durable construction evidence uses only existing authorities:
 * - BUILD earnedXP validated by Skill Provenance, or
 * - a station record showing this actor physically placed a piece that belongs
 *   to a currently complete modular house.
 * Initial/inherited BUILD XP alone is never construction work.
 */
export function crafterConstructionEvidence(state,agent){
  if(!state||!agent||!validAgentId(agent.id))return result('UNKNOWN','actor-evidence');
  if(validateSkillProvenance(agent,['BUILD']).length)return result('UNKNOWN','build-provenance-invalid');
  try{if(validateRustStations(state).length)return result('UNKNOWN','construction-ledger-invalid');}
  catch{return result('UNKNOWN','construction-ledger-invalid');}
  let houses;
  try{houses=evaluateModularHouses(state).houses.filter(h=>h.complete);}
  catch{return result('UNKNOWN','construction-projection-invalid');}
  const covered=new Map();
  for(const house of houses)for(const key of completedHouseSocketKeys(house))if(!covered.has(key))covered.set(key,house.houseId);
  const placements=[];
  for(const st of state.rustStations?.stations??[]){
    if(st?.placedBy!==agent.id||!st.socket)continue;
    let key;try{key=socketKey(st.socket);}catch{continue;}
    const houseId=covered.get(key);if(!houseId)continue;
    placements.push({houseId,stationId:st.id,kind:st.kind,placedTick:st.placedTick});
  }
  placements.sort((a,b)=>a.stationId-b.stationId);
  const earnedXP=agent.skillProvenance.bySkill.BUILD.earnedXP;
  const confirmed=earnedXP>0||placements.length>0;
  return result(confirmed?'CONFIRMED':'ABSENT',confirmed?'construction-proven':'construction-required',{
    buildEarnedXP:earnedXP,
    completedHousePiecesPlaced:placements.length,
    evidence:placements.slice(-8),
  });
}

/** Per-output-family expertise is derived from validated recipe mastery receipts.
 * It is not a new XP ledger and includes existing compacted retired counts.
 */
export function crafterFamilyProfile(state,agent,outputKind){
  if(typeof outputKind!=='string'||!specialties.has(outputKind))return result('UNKNOWN','family');
  if(!state||!agent||!validAgentId(agent.id))return result('UNKNOWN','actor-evidence');
  if(validateRecipeKnowledge(state,agent).length)return result('UNKNOWN','recipe-evidence-invalid',{outputKind});
  const counts=[0,0,0,0,0,0];
  for(const recipe of Object.values(CRAFT_RECIPE_CATALOG)){
    if(recipe.output!==outputKind)continue;
    const count=recipeMastery(agent,recipe.id);
    if(!Number.isSafeInteger(count)||count<0||count>RECIPE_KNOWLEDGE_LIMITS.completions)return result('UNKNOWN','recipe-count-invalid',{outputKind});
    counts[recipe.tier]=Math.min(RECIPE_KNOWLEDGE_LIMITS.completions,counts[recipe.tier]+count);
  }
  const total=Math.min(RECIPE_KNOWLEDGE_LIMITS.completions,counts.reduce((n,x)=>n+x,0));
  const rank=familyRank(counts,total);
  return result('CONFIRMED','recipe-mastery-proven',{
    outputKind,counts,total,rank,grade:CRAFTER_GRADES[rank],maxNewTier:[2,3,4,5][rank]
  });
}

/** Canonical-root read model for G1. SAT proposes a future transition only.
 * No transition is performed here; G2 must re-read the live root and use the
 * existing profession authority instead of trusting a cached/UI copy.
 */
export function crafterQualificationProjection(state,agentId){
  if(!state||!validAgentId(agentId))return result('UNKNOWN','actor-evidence',{agentId:agentId??null});
  const agent=(state.agents??[]).find(a=>a.id===agentId);
  if(!agent){
    const archived=(state.archive??[]).some(a=>a.id===agentId);
    return result('VIOL',archived?'actor-dead':'actor-missing',{agentId});
  }
  if(agent.alive!==true)return result('VIOL','actor-dead',{agentId});
  if(!canPerformProductiveWork(state,agent))return result('VIOL','productive-stage-required',{agentId});
  if(typeof agent.profession!=='string')return result('UNKNOWN','profession-evidence',{agentId});
  if(agent.profession==='merchant'||agent.profession==='adventurer')return result('VIOL','special-profession-lock',{agentId,currentProfession:agent.profession});
  if(agent.profession!=='builder')return result('VIOL','builder-required',{agentId,currentProfession:agent.profession});

  const construction=crafterConstructionEvidence(state,agent);
  if(construction.state==='UNKNOWN')return result('UNKNOWN',construction.reason,{agentId,currentProfession:agent.profession,construction});
  if(construction.state!=='CONFIRMED')return result('VIOL','construction-required',{agentId,currentProfession:agent.profession,construction});

  const families=CRAFTER_SPECIALTY_OUTPUTS.map(output=>crafterFamilyProfile(state,agent,output));
  const unknown=families.find(x=>x.state!=='CONFIRMED');
  if(unknown)return result('UNKNOWN',unknown.reason,{agentId,currentProfession:agent.profession,construction});
  const best=[...families].sort((a,b)=>b.rank-a.rank||b.total-a.total||b.counts[2]-a.counts[2]||(a.outputKind<b.outputKind?-1:1))[0];
  if(!best||best.rank<1)return result('VIOL','craft-experience-required',{agentId,currentProfession:agent.profession,construction,families});

  return result('SAT','crafter-qualified',{
    agentId,currentProfession:agent.profession,proposedProfession:'crafter',
    construction,bestFamily:best,families
  });
}
