/**
 * GOV1 — read-only Governor candidate projection.
 *
 * Governor is a social office candidate, never a productive profession or an
 * ownership writer. All evidence is derived from existing Settlement,
 * Household, Leadership, Lifecycle and Relationship authorities.
 */
import {isIndependent} from './individual-resources.mjs?v=0.5.0';
import {settlementSnapshot} from './settlement-authority.mjs?v=0.5.0';
import {relationshipOf,householdOf} from './relationships.mjs?v=0.5.0';
import {leadershipLevel,LEADERSHIP_SKILL} from './leadership.mjs?v=0.5.0';
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';

export const GOVERNOR_CANDIDATE_VERSION='GOV1-0.1';
export const GOVERNOR_CANDIDATE_RULES=Object.freeze({
  minimumLeadershipLevel:1,
  supportTrustMin:4,
  supportRespectMin:2,
  supportFearMax:20,
  minimumEvidencePerSupportingHousehold:1
});

const frozenArray=a=>Object.freeze(a.slice());

function supportFromOwner(state,ownerId,candidateId){
  if(ownerId===candidateId)return null;
  const row=relationshipOf(state,ownerId,candidateId);
  const evidence=(row.evidence??[]).filter(e=>Number.isInteger(e?.tick)&&e.tick>=0&&e.tick<=state.tick);
  if(row.trust<GOVERNOR_CANDIDATE_RULES.supportTrustMin||
    row.respect<GOVERNOR_CANDIDATE_RULES.supportRespectMin||
    row.fear>GOVERNOR_CANDIDATE_RULES.supportFearMax||
    evidence.length<GOVERNOR_CANDIDATE_RULES.minimumEvidencePerSupportingHousehold)return null;
  const earliest=evidence.reduce((m,e)=>m===null?e.tick:Math.min(m,e.tick),null);
  return Object.freeze({
    ownerId,
    trust:row.trust,
    respect:row.respect,
    fear:row.fear,
    evidenceCount:evidence.length,
    earliestEvidenceTick:earliest,
    continuityTicks:earliest===null?0:Math.max(0,state.tick-earliest)
  });
}

function candidateForSettlement(state,snapshot,agent){
  if(!agent?.alive||!canPerformProductiveWork(state,agent))return null;
  const current=snapshot.current;
  if(!current?.residentIds?.includes(agent.id))return null;
  const level=leadershipLevel(agent);
  if(level<GOVERNOR_CANDIDATE_RULES.minimumLeadershipLevel)return null;

  const ownHousehold=householdOf(state,agent.id);
  const ownHouseholdOwnerId=ownHousehold?.ownerId??null;
  const support=[];
  for(const ownerId of current.ownerIds){
    if(ownerId===ownHouseholdOwnerId)continue;
    const row=supportFromOwner(state,ownerId,agent.id);
    if(row)support.push(row);
  }
  support.sort((a,b)=>a.ownerId-b.ownerId);

  const requiredSupport=Math.ceil(current.households/2);
  if(support.length<requiredSupport)return null;

  const supportTrust=support.reduce((n,r)=>n+r.trust,0);
  const supportRespect=support.reduce((n,r)=>n+r.respect,0);
  const supportEvidenceCount=support.reduce((n,r)=>n+r.evidenceCount,0);
  const supportContinuityTicks=support.reduce((m,r)=>Math.max(m,r.continuityTicks),0);

  return Object.freeze({
    version:GOVERNOR_CANDIDATE_VERSION,
    settlementId:snapshot.id,
    agentId:agent.id,
    profession:agent.profession??null,
    leadershipSkill:LEADERSHIP_SKILL,
    leadershipXP:Number(agent.skills?.[LEADERSHIP_SKILL]??0),
    leadershipLevel:level,
    requiredSupport,
    supportOwnerIds:frozenArray(support.map(r=>r.ownerId)),
    supportHouseholds:support.length,
    supportTrust,
    supportRespect,
    supportEvidenceCount,
    supportContinuityTicks,
    support:frozenArray(support),
    qualified:true
  });
}

function compareCandidates(a,b){
  return b.supportHouseholds-a.supportHouseholds||
    b.supportRespect-a.supportRespect||
    b.supportTrust-a.supportTrust||
    b.leadershipLevel-a.leadershipLevel||
    b.supportEvidenceCount-a.supportEvidenceCount||
    b.supportContinuityTicks-a.supportContinuityTicks||
    a.agentId-b.agentId;
}

export function createGovernorCandidates(state){
  const authority=Object.freeze({
    mode:'shadow-only',
    governanceWriter:false,
    professionWriter:false,
    settlementWriter:false,
    householdWriter:false,
    relationshipWriter:false,
    resourceWriter:false,
    taskWriter:false,
    saveFields:0
  });
  if(!isIndependent(state)||!Array.isArray(state?.settlementState?.records)){
    return Object.freeze({
      version:GOVERNOR_CANDIDATE_VERSION,
      authority,
      rules:GOVERNOR_CANDIDATE_RULES,
      settlements:Object.freeze([]),
      candidates:Object.freeze([])
    });
  }

  const settlements=[],all=[];
  const records=state.settlementState.records.filter(r=>r?.status==='active')
    .slice().sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));
  for(const record of records){
    const snapshot=settlementSnapshot(state,record);
    if(!snapshot?.current)continue;
    const rows=[];
    for(const agentId of snapshot.current.residentIds){
      const agent=state.agents?.find(a=>a.id===agentId);
      const candidate=candidateForSettlement(state,snapshot,agent);
      if(candidate)rows.push(candidate);
    }
    rows.sort(compareCandidates);
    const frozenRows=frozenArray(rows);
    settlements.push(Object.freeze({
      settlementId:snapshot.id,
      households:snapshot.current.households,
      residents:snapshot.current.residents,
      requiredSupport:Math.ceil(snapshot.current.households/2),
      candidateIds:frozenArray(rows.map(r=>r.agentId)),
      candidates:frozenRows,
      topCandidateId:rows[0]?.agentId??null
    }));
    all.push(...rows);
  }

  all.sort((a,b)=>String(a.settlementId).localeCompare(String(b.settlementId),undefined,{numeric:true})||compareCandidates(a,b));
  return Object.freeze({
    version:GOVERNOR_CANDIDATE_VERSION,
    authority,
    rules:GOVERNOR_CANDIDATE_RULES,
    settlements:frozenArray(settlements),
    candidates:frozenArray(all)
  });
}

export function governorCandidatesForSettlement(state,settlementId){
  return createGovernorCandidates(state).settlements.find(s=>s.settlementId===settlementId)?.candidates??Object.freeze([]);
}

export function topGovernorCandidate(state,settlementId){
  return governorCandidatesForSettlement(state,settlementId)[0]??null;
}
