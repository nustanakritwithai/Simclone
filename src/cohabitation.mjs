/**
 * IC6B preparation — pure adult cohabitation candidate selection.
 * No residency mutation, no resource sharing, no ownership transfer.
 */
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {homeOf} from './individual-housing.mjs?v=0.5.0';
import {relationshipOf} from './relationships.mjs?v=0.5.0';

export const COHABITATION_VERSION='IC6B-0.1';
export const COHABITATION_RULES=Object.freeze({
  trustMin:4,
  affinityMin:2,
  reciprocalAffinityMin:2,
  fearMax:20,
});

const directLineage=(a,b)=>a?.parentId===b?.id||b?.parentId===a?.id;

function eligibleSubject(s,a){
  return !!a?.alive&&canPerformProductiveWork(s,a)&&!homeOf(s,a.id,{completeOnly:true});
}

function eligibleOwner(s,subject,owner){
  return !!owner?.alive&&owner.id!==subject.id&&canPerformProductiveWork(s,owner)&&
    !!homeOf(s,owner.id,{completeOnly:true})&&!directLineage(subject,owner);
}

function passesGate(from,to){
  return from.trust>=COHABITATION_RULES.trustMin&&
    from.affinity>=COHABITATION_RULES.affinityMin&&
    from.fear<=COHABITATION_RULES.fearMax&&
    to.affinity>=COHABITATION_RULES.reciprocalAffinityMin&&
    to.fear<=COHABITATION_RULES.fearMax;
}

function evidenceIds(row){
  return (row.evidence??[]).map(e=>e.id).filter(Number.isSafeInteger).sort((a,b)=>a-b);
}

export function cohabitationCandidates(s,subject){
  if(!eligibleSubject(s,subject))return [];
  const rows=[];
  for(const owner of (s.agents??[]).filter(a=>eligibleOwner(s,subject,a))){
    const from=relationshipOf(s,subject.id,owner.id),to=relationshipOf(s,owner.id,subject.id);
    if(!passesGate(from,to))continue;
    const home=homeOf(s,owner.id,{completeOnly:true});
    const score=from.trust*2+from.affinity+from.respect+to.affinity-from.fear*2-to.fear*2;
    rows.push({
      version:COHABITATION_VERSION,
      subjectId:subject.id,
      ownerId:owner.id,
      houseId:home.houseId,
      score,
      evidence:{subjectToOwner:evidenceIds(from),ownerToSubject:evidenceIds(to)}
    });
  }
  return rows.sort((a,b)=>b.score-a.score||a.ownerId-b.ownerId);
}

export function cohabitationCandidate(s,subject){
  return cohabitationCandidates(s,subject)[0]??null;
}
