/**
 * IC7A — deterministic Household recruitment authority.
 * Reuses Kingdom household recruitment shadow + existing JOIN_HOUSEHOLD mutation.
 */
import {isIndependent} from './individual-resources.mjs?v=0.5.0';
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {homeOf} from './individual-housing.mjs?v=0.5.0';
import {activeResidenceOf} from './relationships.mjs?v=0.5.0';
import {householdRecruitmentOffers} from './kingdom-household-organization.mjs?v=0.5.0';
import {joinHousehold} from './household-residence.mjs?v=0.5.0';

export const HOUSEHOLD_RECRUITMENT_VERSION='IC7A-recruitment-1';
export const HOUSEHOLD_RECRUITMENT_RULES=Object.freeze({
  intervalTicks:60,
  maxJoinsPerCycle:1,
});
const ROLE_ACTION=Object.freeze({
  forager:'FORAGE',
  woodcutter:'WOODCUT',
  miner:'MINE',
  builder:'BUILD',
});
const URGENCY_RANK=Object.freeze({normal:1,high:2,critical:3});

function eligibleCandidate(s,a){
  return !!a?.alive&&canPerformProductiveWork(s,a)&&!activeResidenceOf(s,a.id)&&!homeOf(s,a.id,{completeOnly:true});
}

export function recruitmentDecisionsForCandidate(s,a){
  if(!isIndependent(s)||!eligibleCandidate(s,a))return [];
  const rows=[];
  for(const owner of (s.agents??[]).filter(x=>x.alive).sort((x,y)=>x.id-y.id)){
    if(owner.id===a.id)continue;
    for(const offer of householdRecruitmentOffers(s,owner.id)){
      const candidate=offer.candidates?.find(c=>c.agentId===a.id);
      if(!candidate)continue;
      const preferenceMatch=a.preference===ROLE_ACTION[offer.role];
      const urgent=offer.urgency==='high'||offer.urgency==='critical';
      if(!preferenceMatch&&!urgent)continue;
      rows.push({
        version:HOUSEHOLD_RECRUITMENT_VERSION,
        candidateId:a.id,
        leaderId:offer.leaderId,
        houseId:offer.houseId,
        role:offer.role,
        urgency:offer.urgency,
        urgencyRank:URGENCY_RANK[offer.urgency]??0,
        priority:Number(offer.priority)||0,
        relationshipScore:Number(candidate.score)||0,
        preferenceMatch,
        accepted:true,
        authoritative:false,
      });
    }
  }
  return rows.sort((x,y)=>
    y.urgencyRank-x.urgencyRank||
    y.priority-x.priority||
    Number(y.preferenceMatch)-Number(x.preferenceMatch)||
    y.relationshipScore-x.relationshipScore||
    x.leaderId-y.leaderId||
    x.role.localeCompare(y.role)
  );
}

export function recruitmentDecision(s,a){
  return recruitmentDecisionsForCandidate(s,a)[0]??null;
}

export function stepHouseholdRecruitment(s){
  if(!isIndependent(s)||s.tick%HOUSEHOLD_RECRUITMENT_RULES.intervalTicks!==0)return null;
  const decisions=[];
  for(const a of (s.agents??[]).filter(x=>eligibleCandidate(s,x)).sort((x,y)=>x.id-y.id)){
    const row=recruitmentDecision(s,a);
    if(row)decisions.push(row);
  }
  decisions.sort((x,y)=>
    y.urgencyRank-x.urgencyRank||
    y.priority-x.priority||
    Number(y.preferenceMatch)-Number(x.preferenceMatch)||
    y.relationshipScore-x.relationshipScore||
    x.candidateId-y.candidateId||
    x.leaderId-y.leaderId||
    x.role.localeCompare(y.role)
  );
  const selected=decisions[0];
  if(!selected)return null;
  const result=joinHousehold(s,selected.candidateId,selected.leaderId);
  if(!result.ok||!result.changed)return {...result,decision:selected};
  const residence=s.social?.residences?.find(r=>r.agentId===selected.candidateId&&r.leftTick===null);
  if(residence)residence.joinReason='recruitment:'+selected.role;
  const candidate=s.agents.find(a=>a.id===selected.candidateId),leader=s.agents.find(a=>a.id===selected.leaderId);
  return {
    ...result,
    decision:selected,
    recruitmentVersion:HOUSEHOLD_RECRUITMENT_VERSION,
    message:(candidate?.name??'#'+selected.candidateId)+' รับข้อเสนอ '+selected.role+' และเข้าร่วมบ้านของ '+(leader?.name??'#'+selected.leaderId),
  };
}
