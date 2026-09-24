/** Kingdom Sandbox production/labor extraction K3.
 * Read-only shadow projection. Mirrors donor skill, hunger and crowding multipliers
 * without mutating Simclone production, tasks, stock or profession authority.
 */
export const KINGDOM_PRODUCTION_VERSION='K3-shadow-0.1';

const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export const PRODUCTION_ROLES=Object.freeze({
  forager:{action:'FORAGE',ideal:8,label:'หาอาหาร'},
  woodcutter:{action:'WOODCUT',ideal:6,label:'ตัดไม้'},
  miner:{action:'MINE',ideal:6,label:'ขุดหิน'},
  builder:{action:'BUILD',ideal:5,label:'ก่อสร้าง'},
});
const ACTION_TO_ROLE=Object.freeze(Object.fromEntries(Object.entries(PRODUCTION_ROLES).map(([role,v])=>[v.action,role])));

export function inferredProductionRole(agent){
  if(PRODUCTION_ROLES[agent?.profession])return agent.profession;
  return ACTION_TO_ROLE[agent?.preference]??null;
}

/** Donor WorkSystem uses 1 + skill * 0.15. */
export function kingdomSkillMultiplier(skillLevel){
  return +(1+clamp(Number(skillLevel)||0,0,10)*0.15).toFixed(3);
}

/** Simclone satiety is the inverse-facing analogue of Kingdom hunger state. */
export function kingdomHungerPenalty(satiety){
  const s=Number(satiety)||0;
  return s<30?0.5:s<55?0.8:1;
}

/** Donor crowding: ideal/current, bounded 0.2..1, times housing crowding. */
export function kingdomJobCrowding(workerCount,ideal,housingRatio=1){
  const n=Math.max(1,Number(workerCount)||0);
  const jobCrowd=clamp((Number(ideal)||1)/n,0.2,1);
  const housingCrowd=clamp(1-Math.max(0,(Number(housingRatio)||0)-1)*0.25,0.35,1);
  return +(jobCrowd*housingCrowd).toFixed(3);
}

export function kingdomAgentEfficiency(agent,{role,workerCount,housingRatio=1,skillLevel=()=>1,ageRate=()=>1}={}){
  const spec=PRODUCTION_ROLES[role];
  if(!spec)return null;
  const skill=clamp(Number(skillLevel(agent,spec.action))||0,0,10);
  const factors={
    skill:kingdomSkillMultiplier(skill),
    hunger:kingdomHungerPenalty(agent?.satiety),
    crowding:kingdomJobCrowding(workerCount,spec.ideal,housingRatio),
    age:clamp(Number(ageRate(agent))||0,0,1),
    tool:1,
  };
  const efficiency=+Object.values(factors).reduce((v,x)=>v*x,1).toFixed(3);
  return {role,action:spec.action,skillLevel:skill,factors,efficiency};
}

export function kingdomProductionSnapshot({agents=[],capacity=0,economy=null,skillLevel=()=>1,ageRate=()=>1}={}){
  const living=agents.filter(a=>a?.alive);
  const housingRatio=capacity>0?living.length/capacity:1;
  const groups=Object.fromEntries(Object.keys(PRODUCTION_ROLES).map(r=>[r,[]]));
  for(const a of living){
    const role=inferredProductionRole(a);
    if(role)groups[role].push(a);
  }
  const roles={};
  for(const [role,spec] of Object.entries(PRODUCTION_ROLES)){
    const workers=groups[role],rows=workers.map(a=>kingdomAgentEfficiency(a,{
      role,workerCount:workers.length,housingRatio,skillLevel,ageRate
    }));
    const totalEfficiency=+rows.reduce((n,r)=>n+r.efficiency,0).toFixed(3);
    roles[role]={
      label:spec.label,workers:workers.length,ideal:spec.ideal,
      crowding:kingdomJobCrowding(workers.length,spec.ideal,housingRatio),
      totalEfficiency,
      averageEfficiency:workers.length?+(totalEfficiency/workers.length).toFixed(3):0,
      laborGap:Math.max(0,spec.ideal-workers.length),
    };
  }
  const premium=economy?.premium??{};
  const pressure=Object.entries(roles).map(([role,row])=>{
    const p=Number(premium[role]??1);
    const shortage=Math.max(0,p-1);
    const gapWeight=row.workers===0?1.5:1+row.laborGap/Math.max(row.ideal,1);
    return {role,label:row.label,workers:row.workers,ideal:row.ideal,premium:p,score:+(shortage*100*gapWeight).toFixed(2)};
  }).sort((a,b)=>b.score-a.score||a.role.localeCompare(b.role));
  return {
    version:KINGDOM_PRODUCTION_VERSION,mode:'shadow',population:living.length,capacity,housingRatio:+housingRatio.toFixed(3),
    roles,
    effectiveWorkerUnits:+Object.values(roles).reduce((n,r)=>n+r.totalEfficiency,0).toFixed(3),
    recommendedRole:pressure[0]?.score>0?pressure[0]:null,
    pressure,
  };
}
