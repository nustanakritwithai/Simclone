/**
 * IC6E — Kingdom OrganizationSystem / LaborMarket recruitment semantics
 * adapted to household scope. Pure read-only projection.
 */
import {householdForOwner} from './relationships.mjs?v=0.5.0';
import {leadershipProfile} from './leadership.mjs?v=0.5.0';
import {cohabitationCandidates} from './cohabitation.mjs?v=0.5.0';
import {householdEconomySnapshot} from './kingdom-household-economy.mjs?v=0.5.0';

export const KINGDOM_HOUSEHOLD_ORG_VERSION='K-org-household-shadow-0.1';

const adults=(s,ids)=>ids
  .map(id=>s.agents?.find(a=>a.id===id&&a.alive))
  .filter(Boolean)
  .map(a=>a.id)
  .sort((a,b)=>a-b);

export function householdOrganizationShadow(s,ownerId){
  const household=householdForOwner(s,ownerId),leadership=leadershipProfile(s,ownerId);
  if(!household||!leadership)return null;
  const economy=householdEconomySnapshot(s,ownerId);
  const adultMemberIds=adults(s,[ownerId,...(household.cohabitantIds??[])]);
  const topOffer=economy?.labor?.topOffer??null;
  return {
    version:KINGDOM_HOUSEHOLD_ORG_VERSION,
    houseId:household.houseId,
    leaderId:ownerId,
    adultMemberIds,
    dependentIds:[...(household.dependentIds??[])].sort((a,b)=>a-b),
    leadership:{
      level:leadership.level,
      xp:leadership.xp,
      followerCapacity:leadership.followerCapacity,
      activeFollowers:leadership.activeFollowers,
      availableFollowerSlots:leadership.availableFollowerSlots,
    },
    purpose:topOffer?.role??'household-survival',
    pressure:topOffer?{
      role:topOffer.role,
      urgency:topOffer.urgency,
      quantityNeeded:topOffer.quantityNeeded,
      priority:topOffer.priority,
    }:null,
    organizationReady:adultMemberIds.length>=2,
    authoritative:false,
  };
}

export function householdRecruitmentOffers(s,ownerId){
  const org=householdOrganizationShadow(s,ownerId);
  if(!org||org.leadership.availableFollowerSlots<=0)return [];
  const economy=householdEconomySnapshot(s,ownerId);
  const laborOffers=economy?.labor?.offers??[];
  const leader=s.agents?.find(a=>a.id===ownerId&&a.alive);
  if(!leader)return [];
  const candidates=[];
  for(const a of (s.agents??[]).filter(a=>a.alive).sort((a,b)=>a.id-b.id)){
    if(a.id===ownerId||org.adultMemberIds.includes(a.id))continue;
    const rows=cohabitationCandidates(s,a);
    const row=rows.find(x=>x.ownerId===ownerId);
    if(row)candidates.push({
      agentId:a.id,
      score:row.score,
      leadershipLevel:row.leadershipLevel,
      evidence:{
        subjectToOwner:[...(row.evidence?.subjectToOwner??[])],
        ownerToSubject:[...(row.evidence?.ownerToSubject??[])],
      }
    });
  }
  candidates.sort((a,b)=>b.score-a.score||a.agentId-b.agentId);
  return laborOffers.map(o=>{
    const quantity=Math.min(
      Number(o.quantityNeeded)||1,
      org.leadership.availableFollowerSlots
    );
    return {
      version:KINGDOM_HOUSEHOLD_ORG_VERSION,
      type:'household_recruitment_'+o.role,
      houseId:org.houseId,
      leaderId:ownerId,
      role:o.role,
      label:o.label,
      urgency:o.urgency,
      priority:o.priority,
      requested:quantity,
      availableFollowerSlots:org.leadership.availableFollowerSlots,
      candidateIds:candidates.slice(0,quantity).map(c=>c.agentId),
      candidates:candidates.slice(0,quantity),
      authoritative:false,
    };
  }).sort((a,b)=>b.priority-a.priority||a.role.localeCompare(b.role));
}

export function allHouseholdOrganizationShadows(s){
  const out=[],seen=new Set();
  for(const a of (s.agents??[]).filter(a=>a.alive).sort((a,b)=>a.id-b.id)){
    const row=householdOrganizationShadow(s,a.id);
    if(!row||seen.has(row.houseId))continue;
    seen.add(row.houseId);out.push(row);
  }
  return out.sort((a,b)=>a.houseId.localeCompare(b.houseId));
}
