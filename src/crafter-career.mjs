/** RC5 Crafter Career V1.
 * Career qualification is derived from the live canonical state. The caller
 * supplies only an agent id; home and recipe evidence are never accepted from UI.
 */
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {homeOf} from './individual-housing.mjs?v=0.5.0';
import {CRAFT_RECIPE_CATALOG} from './crafting-catalog.mjs?v=0.5.0';
import {recipeMastery,validateRecipeKnowledge} from './craft-recipe-knowledge.mjs?v=0.5.0';
import {adoptProfession} from './kingdom-utility.mjs?v=0.5.0';

export const CRAFTER_CAREER_VERSION='RC5-crafter-v1';
export const BUILDER_RECOVERY_VERSION='RC5-builder-recovery/1';
export const CRAFTER_FAMILIES=Object.freeze({
  STONE_AXE:'TOOLSMITH',
  STONE_PICKAXE:'TOOLSMITH',
  HAMMER:'TOOLSMITH',
  EMBER_BLADE:'WEAPONSMITH',
  HIDE_ARMOR:'ARMORSMITH',
  EMBER_CHARM:'ARTIFICER',
});
export const CRAFTER_GRADES=Object.freeze(['APPRENTICE','CRAFTER','EXPERT','MASTER']);
export const CRAFTER_QUALIFICATION_POLICY=Object.freeze({
  crafter:Object.freeze({total:6,tier2:2}),
  expert:Object.freeze({total:16,tier3:4}),
  master:Object.freeze({total:32,tier4:6}),
});
const SAT='SAT',VIOL='VIOL',UNKNOWN='UNKNOWN';
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
const result=(status,reason,extra={})=>freeze({version:CRAFTER_CAREER_VERSION,status,qualified:status===SAT,reason,...extra});
const validFamily=family=>typeof family==='string'&&Object.hasOwn(CRAFTER_FAMILIES,family);

function familyCounts(agent,family){
  const counts=[0,0,0,0,0,0];
  for(const recipe of Object.values(CRAFT_RECIPE_CATALOG)){
    if(recipe.output!==family)continue;
    counts[recipe.tier]=Math.min(65535,counts[recipe.tier]+recipeMastery(agent,recipe.id));
  }
  return counts;
}
function profileFromCounts(family,counts){
  const total=Math.min(65535,counts.reduce((sum,n)=>sum+n,0));let rank=0;
  if(total>=CRAFTER_QUALIFICATION_POLICY.crafter.total&&counts[2]>=CRAFTER_QUALIFICATION_POLICY.crafter.tier2)rank=1;
  if(rank===1&&total>=CRAFTER_QUALIFICATION_POLICY.expert.total&&counts[3]>=CRAFTER_QUALIFICATION_POLICY.expert.tier3)rank=2;
  if(rank===2&&total>=CRAFTER_QUALIFICATION_POLICY.master.total&&counts[4]>=CRAFTER_QUALIFICATION_POLICY.master.tier4)rank=3;
  return freeze({family,specialization:CRAFTER_FAMILIES[family],counts:[...counts],total,rank,grade:CRAFTER_GRADES[rank],maxNewTier:[2,3,4,5][rank]});
}
function allProfiles(agent){
  return Object.keys(CRAFTER_FAMILIES).map(family=>profileFromCounts(family,familyCounts(agent,family)));
}
function bestProfile(profiles){
  return [...profiles].sort((a,b)=>b.rank-a.rank||b.total-a.total||(a.family<b.family?-1:a.family>b.family?1:0))[0]??null;
}

export function crafterFamilyProfile(state,agent,family){
  if(!state||!agent||!validFamily(family))return result(UNKNOWN,'profile-input',{profile:null});
  if(validateRecipeKnowledge(state,agent).length)return result(UNKNOWN,'recipe-evidence',{profile:null});
  return result(SAT,'profile',{profile:profileFromCounts(family,familyCounts(agent,family))});
}
export function crafterCareerSnapshot(state,agent){
  if(!state||!agent)return result(UNKNOWN,'profile-input',{profiles:[],best:null});
  if(validateRecipeKnowledge(state,agent).length)return result(UNKNOWN,'recipe-evidence',{profiles:[],best:null});
  const profiles=allProfiles(agent),best=bestProfile(profiles);
  return result(SAT,'profile',{profiles,best});
}

const BUILDER_RECOVERY_ORDINARY=new Set(['forager','woodcutter','miner']);

/** Old-save recovery is evidence-gated. A current ordinary profession is not
 * enough: the actor must own a completed home, have earned BUILD XP from real
 * work, and already have real HAMMER-family recipe completion evidence.
 */
export function evaluateBuilderRecovery(state,agentId){
  if(!state||!Number.isSafeInteger(agentId)||agentId<1)return result(UNKNOWN,'agent');
  const agent=(state.agents??[]).find(a=>a.id===agentId)??null;
  if(!agent)return result(UNKNOWN,'agent');
  if(agent.alive!==true||!canPerformProductiveWork(state,agent))return result(VIOL,'actor-ineligible',{agentId});
  if(agent.profession==='builder')return result(SAT,'already-builder',{agentId,evidenceId:null});
  if(agent.profession==='merchant'||agent.profession==='adventurer'||agent.profession==='crafter')
    return result(VIOL,'special-profession-lock',{agentId});
  if(!BUILDER_RECOVERY_ORDINARY.has(agent.profession))
    return result(VIOL,'ordinary-profession-required',{agentId});
  const home=homeOf(state,agentId,{completeOnly:true});
  if(!home||home.ownerId!==agentId)return result(VIOL,'construction-required',{agentId});
  const build=agent.skillProvenance?.bySkill?.BUILD;
  if(!build||typeof build.earnedXP!=='number'||!Number.isFinite(build.earnedXP)||build.earnedXP<0)
    return result(UNKNOWN,'build-evidence',{agentId,homeId:home.houseId});
  if(build.earnedXP<=0)return result(VIOL,'build-work-required',{agentId,homeId:home.houseId});
  const family=crafterFamilyProfile(state,agent,'HAMMER');
  if(family.status!==SAT||!family.profile)return result(UNKNOWN,family.reason??'recipe-evidence',{agentId,homeId:home.houseId});
  if(family.profile.total<1)return result(VIOL,'craft-foundation-required',{agentId,homeId:home.houseId,profile:family.profile});
  const evidenceId=['RC5R',agentId,home.houseId,build.earnedXP,family.profile.total,family.profile.counts[2]].join(':');
  return result(SAT,'builder-recovery-satisfied',{agentId,homeId:home.houseId,buildEarnedXP:build.earnedXP,profile:family.profile,evidenceId,recoveryVersion:BUILDER_RECOVERY_VERSION});
}

export function recoverBuilderProfessionFromState(state,agentId,tick=state?.tick){
  const qualification=evaluateBuilderRecovery(state,agentId);
  const agent=state?.agents?.find(a=>a.id===agentId)??null;
  if(!agent)return {ok:false,changed:false,status:qualification.status,reason:qualification.reason,profession:undefined,qualification};
  if(!Number.isInteger(tick)||tick<0||tick!==state.tick)return {ok:false,changed:false,status:UNKNOWN,reason:'tick',profession:agent.profession,qualification};
  if(!qualification.qualified)return {ok:false,changed:false,status:qualification.status,reason:qualification.reason,profession:agent.profession,qualification};
  if(agent.profession==='builder')return {ok:true,changed:false,status:SAT,reason:'already-builder',profession:'builder',qualification};
  const transition=adoptProfession(agent,'BUILD',tick);
  const status=agent.profession==='builder'?SAT:UNKNOWN;
  return {...transition,ok:status===SAT,status,qualification};
}

/** Qualification reads current-root authorities directly:
 * - canonical profession
 * - productive lifecycle
 * - evidence-derived completed personal home
 * - validated bounded recipe completion history
 */
export function evaluateCrafterQualification(state,agentId){
  if(!state||!Number.isSafeInteger(agentId)||agentId<1)return result(UNKNOWN,'agent');
  const agent=(state.agents??[]).find(a=>a.id===agentId)??(state.archive??[]).find(a=>a.id===agentId)??null;
  if(!agent)return result(UNKNOWN,'agent');
  if(agent.alive!==true)return result(VIOL,'actor-ineligible',{agentId});
  if(!canPerformProductiveWork(state,agent))return result(VIOL,'actor-ineligible',{agentId});
  if(agent.profession==='crafter'){
    const snapshot=crafterCareerSnapshot(state,agent);
    return snapshot.status===SAT?result(SAT,'already-crafter',{agentId,profile:snapshot.best,evidenceId:null}):snapshot;
  }
  if(agent.profession==='merchant'||agent.profession==='adventurer')return result(VIOL,'special-profession-lock',{agentId});
  if(agent.profession!=='builder')return result(VIOL,'builder-required',{agentId});
  const home=homeOf(state,agentId,{completeOnly:true});
  if(!home||home.ownerId!==agentId)return result(VIOL,'construction-required',{agentId});
  const snapshot=crafterCareerSnapshot(state,agent);
  if(snapshot.status!==SAT)return result(UNKNOWN,snapshot.reason,{agentId});
  if(!snapshot.best||snapshot.best.rank<1)return result(VIOL,'craft-mastery-required',{agentId,homeId:home.houseId,profile:snapshot.best});
  const p=snapshot.best,evidenceId=['RC5',agentId,home.houseId,p.family,...p.counts].join(':');
  return result(SAT,'qualification-satisfied',{agentId,homeId:home.houseId,profile:p,evidenceId});
}

/** The only RC5 transition helper. No caller-supplied home/mastery/evidence object. */
export function adoptCrafterProfessionFromState(state,agentId,tick=state?.tick){
  const qualification=evaluateCrafterQualification(state,agentId);
  const agent=state?.agents?.find(a=>a.id===agentId)??null;
  if(!agent)return {ok:false,changed:false,status:qualification.status,reason:qualification.reason,profession:undefined,qualification};
  if(!Number.isInteger(tick)||tick<0||tick!==state.tick)return {ok:false,changed:false,status:UNKNOWN,reason:'tick',profession:agent.profession,qualification};
  if(!qualification.qualified)return {ok:false,changed:false,status:qualification.status,reason:qualification.reason,profession:agent.profession,qualification};
  if(agent.profession==='crafter')return {ok:true,changed:false,status:SAT,reason:'already-crafter',profession:'crafter',qualification};
  const transition=adoptProfession(agent,'CRAFTER',tick,{
    qualifiedProfession:'crafter',
    qualification:'crafter-v1',
    evidenceId:qualification.evidenceId,
  });
  const status=agent.profession==='crafter'?SAT:transition.reason==='profession-locked'||transition.reason==='builder-required'?VIOL:UNKNOWN;
  return {...transition,ok:status===SAT,status,qualification};
}

/** Command accepts identity only. Extra evidence-like fields fail closed. */
export function crafterCareerCommand(state,type,data={}){
  if(type!=='RC5_BECOME_CRAFTER'&&type!=='RC5_RECOVER_BUILDER')return null;
  if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).sort().join('|')!=='agentId'||!Number.isSafeInteger(data.agentId)||data.agentId<1)
    return {ok:false,changed:false,status:UNKNOWN,reason:'input',message:'ข้อมูลเส้นทางอาชีพช่างไม่ถูกต้อง'};
  if(type==='RC5_RECOVER_BUILDER'){
    const out=recoverBuilderProfessionFromState(state,data.agentId,state.tick);
    const message=out.ok?(out.changed?'กลับเข้าสู่เส้นทางช่างก่อสร้างจากหลักฐานเดิมแล้ว':'อยู่ในเส้นทางช่างก่อสร้างแล้ว'):
      out.reason==='construction-required'?'ต้องมีบ้านของตัวเองที่สร้างเสร็จก่อน':
      out.reason==='build-work-required'?'ยังไม่มี BUILD XP ที่ได้จากงานก่อสร้างจริง':
      out.reason==='craft-foundation-required'?'ยังไม่มีหลักฐานผลิตตระกูล HAMMER จริง':
      out.reason==='special-profession-lock'?'อาชีพพิเศษปัจจุบันถูกล็อกอยู่':
      out.reason==='ordinary-profession-required'?'อาชีพปัจจุบันไม่อยู่ในกลุ่มที่กู้เส้นทาง Builder ได้':
      out.reason==='actor-ineligible'?'ช่วงวัยหรือสถานะนี้ยังกู้เส้นทางอาชีพไม่ได้':'ยังยืนยันหลักฐานกู้เส้นทาง Builder ไม่ได้';
    return {...out,agentId:data.agentId,message};
  }
  const out=adoptCrafterProfessionFromState(state,data.agentId,state.tick);
  const message=out.ok?(out.changed?'เลื่อนอาชีพเป็นช่างประดิษฐ์แล้ว':'เป็นช่างประดิษฐ์อยู่แล้ว'):
    out.reason==='builder-required'?'ต้องเป็นช่างก่อสร้างก่อน':
    out.reason==='construction-required'?'ต้องมีบ้านที่สร้างเสร็จจากหลักฐานก่อสร้างจริง':
    out.reason==='craft-mastery-required'?'ต้องฝึกผลิตของจริงให้ถึงเกณฑ์ก่อน':
    out.reason==='special-profession-lock'?'อาชีพพิเศษปัจจุบันถูกล็อกอยู่':
    out.reason==='actor-ineligible'?'ช่วงวัยหรือสถานะนี้ยังเลื่อนอาชีพไม่ได้':'ยังยืนยันหลักฐานช่างประดิษฐ์ไม่ได้';
  return {...out,agentId:data.agentId,message};
}
