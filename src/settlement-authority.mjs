/** MX7 — the single persistent Settlement promotion authority.
 * Persistent records store provenance only. Current homes, residents, population,
 * boundaries and resources remain owned by their existing authorities.
 */
import {isIndependent} from './individual-resources.mjs?v=0.5.0';
import {createSettlementCandidates} from './settlement-candidate.mjs?v=0.5.0';

export const SETTLEMENT_AUTHORITY_VERSION='MX7-authority-1';
export const SETTLEMENT_STATE_VERSION='MX7-state-1';
export const SETTLEMENT_RULES=Object.freeze({
  intervalTicks:360,
  maxRecords:64
});
const STATUS=new Set(['active','dormant']);

export function ensureSettlementState(state){
  if(!isIndependent(state))return state;
  if(state.settlementState===undefined)state.settlementState={version:SETTLEMENT_STATE_VERSION,nextId:1,records:[]};
  return state;
}

export function validateSettlementState(state,{required=isIndependent(state)}={}){
  const s=state?.settlementState;
  if(s===undefined)return required?['Settlement state']:[];
  if(!s||s.version!==SETTLEMENT_STATE_VERSION||!Number.isSafeInteger(s.nextId)||s.nextId<1||
    !Array.isArray(s.records)||s.records.length>SETTLEMENT_RULES.maxRecords)return ['Settlement state'];
  const ids=new Set(),sources=new Set();let maxId=0;
  for(const r of s.records){
    const numeric=typeof r?.id==='string'&&/^S\d+$/.test(r.id)?Number(r.id.slice(1)):NaN;
    if(!r||!Number.isSafeInteger(numeric)||numeric<1||ids.has(r.id)||
      typeof r.sourceCandidateId!=='string'||!r.sourceCandidateId.startsWith('SC:')||sources.has(r.sourceCandidateId)||
      typeof r.sourceCommunityId!=='string'||!r.sourceCommunityId.startsWith('C:')||
      typeof r.sourceNeighborhoodId!=='string'||!r.sourceNeighborhoodId.startsWith('N:')||
      !Number.isSafeInteger(r.anchorOwnerId)||r.anchorOwnerId<1||
      !Number.isInteger(r.createdTick)||r.createdTick<0||r.createdTick>state.tick||
      !Number.isInteger(r.lastQualifiedTick)||r.lastQualifiedTick<r.createdTick||r.lastQualifiedTick>state.tick||
      !STATUS.has(r.status)||
      ['ownerIds','residentIds','houseIds','resources','stock','inventory'].some(k=>Object.prototype.hasOwnProperty.call(r,k)))
      return ['Settlement record'];
    ids.add(r.id);sources.add(r.sourceCandidateId);maxId=Math.max(maxId,numeric);
  }
  if(s.nextId<=maxId)return ['Settlement counter'];
  return [];
}

export function stepSettlementAuthority(state,{force=false}={}){
  if(!isIndependent(state))return null;
  ensureSettlementState(state);
  if(!force&&state.tick%SETTLEMENT_RULES.intervalTicks!==0)return null;
  const projection=createSettlementCandidates(state),byId=new Map(projection.candidates.map(c=>[c.id,c]));
  const createdIds=[],activatedIds=[],dormantIds=[];
  for(const r of state.settlementState.records){
    const candidate=byId.get(r.sourceCandidateId);
    if(candidate){
      r.lastQualifiedTick=state.tick;
      if(r.status!=='active'){r.status='active';activatedIds.push(r.id);}
    }else if(r.status!=='dormant'){r.status='dormant';dormantIds.push(r.id);}
  }
  const existing=new Set(state.settlementState.records.map(r=>r.sourceCandidateId));
  for(const c of projection.candidates){
    if(existing.has(c.id)||state.settlementState.records.length>=SETTLEMENT_RULES.maxRecords)continue;
    const id='S'+state.settlementState.nextId++;
    state.settlementState.records.push({
      id,
      sourceCandidateId:c.id,
      sourceCommunityId:c.communityId,
      sourceNeighborhoodId:c.neighborhoodId,
      anchorOwnerId:c.ownerIds[0],
      createdTick:state.tick,
      lastQualifiedTick:state.tick,
      status:'active'
    });
    existing.add(c.id);createdIds.push(id);
  }
  return {
    version:SETTLEMENT_AUTHORITY_VERSION,
    changed:createdIds.length+activatedIds.length+dormantIds.length>0,
    createdIds:Object.freeze(createdIds),
    activatedIds:Object.freeze(activatedIds),
    dormantIds:Object.freeze(dormantIds),
    candidateCount:projection.candidates.length
  };
}

export function settlementSnapshot(state,recordOrId){
  ensureSettlementState(state);
  const record=typeof recordOrId==='string'
    ?state.settlementState.records.find(r=>r.id===recordOrId)
    :recordOrId;
  if(!record)return null;
  const projection=createSettlementCandidates(state);
  const c=projection.candidates.find(x=>x.id===record.sourceCandidateId)??null;
  return Object.freeze({
    id:record.id,
    status:record.status,
    createdTick:record.createdTick,
    lastQualifiedTick:record.lastQualifiedTick,
    sourceCandidateId:record.sourceCandidateId,
    sourceCommunityId:record.sourceCommunityId,
    sourceNeighborhoodId:record.sourceNeighborhoodId,
    anchorOwnerId:record.anchorOwnerId,
    current:c?Object.freeze({
      ownerIds:c.ownerIds,residentIds:c.residentIds,
      households:c.households,residents:c.residents,
      center:c.center,region:c.region,boundary:c.boundary,
      socialLinks:c.socialLinks,evidenceCount:c.evidenceCount,continuityTicks:c.continuityTicks
    }):null
  });
}

export function allSettlementSnapshots(state){
  if(!isIndependent(state))return [];
  ensureSettlementState(state);
  return state.settlementState.records.map(r=>settlementSnapshot(state,r));
}
