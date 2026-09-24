/** Skill provenance 0.4.0 — bounded evidence with exact XP accounting. */
export const SKILL_PROVENANCE_VERSION='0.4.0';
export const SKILL_EVIDENCE_LIMIT=2;

const finiteNonNegative=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const makeBucket=()=>({initialXP:0,inheritedXP:0,earnedXP:0,legacyUnattributedXP:0,evidence:[]});
const clone=v=>JSON.parse(JSON.stringify(v));

function trimEvidence(bucket){
  if(bucket.evidence.length<=SKILL_EVIDENCE_LIMIT)return;
  const structural=bucket.evidence.find(e=>e.kind==='initial'||e.kind==='inheritance')??null;
  const room=SKILL_EVIDENCE_LIMIT-(structural?1:0);
  const work=bucket.evidence.filter(e=>e.kind==='work').slice(-Math.max(0,room));
  bucket.evidence.splice(0,bucket.evidence.length,...(structural?[structural]:[]),...work);
}
function addEvidence(agentId,skill,bucket,{kind,xp,tick,sourceAgentId=null,action=null,targetId=null}){
  const id=`skill:${agentId}:${skill}:${kind}:${tick}:${bucket.initialXP+bucket.inheritedXP+bucket.earnedXP+bucket.legacyUnattributedXP}`;
  bucket.evidence.push({id,kind,xp,tick,sourceAgentId,action,targetId});
  trimEvidence(bucket);
}
export function createSkillProvenance(agentId,skills,{kind='initial',sourceAgentId=null,tick=0}={}){
  const bySkill={};
  for(const [skill,xp] of Object.entries(skills)){
    const bucket=makeBucket();
    if(kind==='inheritance'){bucket.inheritedXP=xp;if(xp>0)addEvidence(agentId,skill,bucket,{kind:'inheritance',xp,tick,sourceAgentId});}
    else{bucket.initialXP=xp;if(xp>0)addEvidence(agentId,skill,bucket,{kind:'initial',xp,tick});}
    bySkill[skill]=bucket;
  }
  return {version:SKILL_PROVENANCE_VERSION,bySkill};
}
export function createLegacySkillProvenance(skills){
  const bySkill={};
  for(const [skill,xp] of Object.entries(skills)){
    const bucket=makeBucket();bucket.legacyUnattributedXP=xp;bySkill[skill]=bucket;
  }
  return {version:SKILL_PROVENANCE_VERSION,bySkill};
}
export function recordEarnedSkill(agent,skill,xp,tick,{action=skill,targetId=null}={}){
  if(!agent?.skillProvenance?.bySkill?.[skill]||!finiteNonNegative(xp)||xp<=0||!Number.isInteger(tick)||tick<0)return false;
  const bucket=agent.skillProvenance.bySkill[skill];
  bucket.earnedXP+=xp;
  addEvidence(agent.id,skill,bucket,{kind:'work',xp,tick,action,targetId});
  return true;
}
export function provenanceTotal(bucket){
  return bucket.initialXP+bucket.inheritedXP+bucket.earnedXP+bucket.legacyUnattributedXP;
}
export function validateSkillProvenance(agent,skillKeys){
  const errors=[],p=agent?.skillProvenance;
  if(!p||p.version!==SKILL_PROVENANCE_VERSION||!p.bySkill)return ['Skill provenance'];
  for(const skill of skillKeys){
    const b=p.bySkill[skill];
    if(!b||!['initialXP','inheritedXP','earnedXP','legacyUnattributedXP'].every(k=>finiteNonNegative(b[k]))){errors.push('Skill provenance');continue;}
    if(provenanceTotal(b)!==agent.skills?.[skill])errors.push('Skill provenance total');
    if(!Array.isArray(b.evidence)||b.evidence.length>SKILL_EVIDENCE_LIMIT){errors.push('Skill provenance evidence');continue;}
    const ids=new Set();
    for(const e of b.evidence){
      if(!e||typeof e.id!=='string'||ids.has(e.id)||!['initial','inheritance','work'].includes(e.kind)||!finiteNonNegative(e.xp)||e.xp<=0||
        !Number.isInteger(e.tick)||e.tick<0||(e.sourceAgentId!==null&&!Number.isInteger(e.sourceAgentId))||
        (e.targetId!==null&&!Number.isInteger(e.targetId))||(e.action!==null&&typeof e.action!=='string'))errors.push('Skill provenance evidence');
      ids.add(e?.id);
    }
  }
  return [...new Set(errors)];
}
export function cloneSkillProvenance(p){return clone(p);}
