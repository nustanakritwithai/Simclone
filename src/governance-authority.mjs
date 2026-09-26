/**
 * GOV2 + GOV5 — persistent Governor office authority.
 *
 * The office owns only political provenance. Productive profession, Settlement
 * truth, Household membership, homes, relationships and resources stay with
 * their existing authorities.
 */
import {isIndependent} from './individual-resources.mjs?v=0.5.0';
import {allSettlementSnapshots} from './settlement-authority.mjs?v=0.5.0';
import {createGovernorCandidates,governorCandidatesForSettlement} from './governor-candidate.mjs?v=0.5.0';

export const GOVERNANCE_AUTHORITY_VERSION='GOV2-GOV5-authority-1';
export const GOVERNANCE_STATE_VERSION='GOV2-state-1';
export const GOVERNANCE_RULES=Object.freeze({
  intervalTicks:360,
  qualificationGraceTicks:360,
  maxOffices:64,
  maxHistoryPerOffice:16,
  maxPolicies:128
});

const OFFICE_STATUS=new Set(['active','vacant']);
const POLICY_STATUS=new Set(['active','resolved','cancelled']);
const VACANCY_REASONS=new Set(['none','no-candidate','death','left-settlement','support-lost','settlement-dormant']);

export function ensureGovernanceState(state){
  if(!isIndependent(state))return state;
  if(state.governanceState===undefined)state.governanceState={
    version:GOVERNANCE_STATE_VERSION,
    nextTerm:1,
    nextPolicy:1,
    offices:[],
    policies:[]
  };
  return state;
}

const validId=n=>Number.isSafeInteger(n)&&n>0;
const validTick=(n,state)=>Number.isInteger(n)&&n>=0&&n<=state.tick;

function validAppointment(a){
  if(!a||!validId(a.agentId)||!Number.isInteger(a.requiredSupport)||a.requiredSupport<1||
    !Number.isInteger(a.supportHouseholds)||a.supportHouseholds<a.requiredSupport||
    !Array.isArray(a.supportOwnerIds)||a.supportOwnerIds.some(id=>!validId(id))||
    new Set(a.supportOwnerIds).size!==a.supportOwnerIds.length||
    !Number.isFinite(a.supportTrust)||!Number.isFinite(a.supportRespect)||
    !Number.isInteger(a.supportEvidenceCount)||a.supportEvidenceCount<1||
    !Number.isInteger(a.supportContinuityTicks)||a.supportContinuityTicks<0||
    !Number.isInteger(a.leadershipLevel)||a.leadershipLevel<1||
    typeof a.professionAtAppointment!=='string')return false;
  return true;
}

export function validateGovernanceState(state,{required=isIndependent(state)}={}){
  const g=state?.governanceState;
  if(g===undefined)return required?['Governance state']:[];
  if(!g||g.version!==GOVERNANCE_STATE_VERSION||!Number.isSafeInteger(g.nextTerm)||g.nextTerm<1||
    !Number.isSafeInteger(g.nextPolicy)||g.nextPolicy<1||
    !Array.isArray(g.offices)||g.offices.length>GOVERNANCE_RULES.maxOffices||
    !Array.isArray(g.policies)||g.policies.length>GOVERNANCE_RULES.maxPolicies)return ['Governance state'];

  const errors=[],settlements=new Set(),termIds=new Set(),policyIds=new Set();
  let maxTerm=0,maxPolicy=0;
  for(const o of g.offices){
    if(!o||typeof o.settlementId!=='string'||!/^S\d+$/.test(o.settlementId)||settlements.has(o.settlementId)||
      !OFFICE_STATUS.has(o.status)||!validTick(o.lastTransitionTick,state)||
      !Array.isArray(o.history)||o.history.length>GOVERNANCE_RULES.maxHistoryPerOffice||
      !VACANCY_REASONS.has(o.vacancyReason)||
      ['ownerIds','residentIds','houseIds','resources','stock','inventory','boundary'].some(k=>Object.prototype.hasOwnProperty.call(o,k))){
      errors.push('Governance office');continue;
    }
    settlements.add(o.settlementId);
    if(o.status==='active'){
      if(!validId(o.governorId)||typeof o.termId!=='string'||!/^GT\d+$/.test(o.termId)||
        !validTick(o.appointedTick,state)||!validTick(o.lastQualifiedTick,state)||
        o.lastQualifiedTick<o.appointedTick||!validAppointment(o.appointment)||o.appointment.agentId!==o.governorId||
        o.vacancyReason!=='none')errors.push('Governance office');
    }else{
      if(o.governorId!==null||o.termId!==null||o.appointedTick!==null||o.lastQualifiedTick!==null||
        o.appointment!==null||o.vacancyReason==='none')errors.push('Governance office');
    }
    if(o.termId){
      if(termIds.has(o.termId))errors.push('Governance term');termIds.add(o.termId);
      maxTerm=Math.max(maxTerm,Number(o.termId.slice(2)));
    }
    for(const h of o.history){
      if(!h||typeof h.termId!=='string'||!/^GT\d+$/.test(h.termId)||termIds.has(h.termId)||
        !validId(h.governorId)||!validTick(h.appointedTick,state)||!validTick(h.endedTick,state)||
        h.endedTick<h.appointedTick||!VACANCY_REASONS.has(h.reason)||h.reason==='none')errors.push('Governance history');
      termIds.add(h?.termId);maxTerm=Math.max(maxTerm,Number(h?.termId?.slice?.(2)??0));
    }
  }

  for(const p of g.policies){
    if(!p||typeof p.id!=='string'||!/^GP\d+$/.test(p.id)||policyIds.has(p.id)||
      typeof p.settlementId!=='string'||!/^S\d+$/.test(p.settlementId)||!validId(p.governorId)||
      !['food','wood','stone'].includes(p.good)||!['FORAGE','WOODCUT','MINE'].includes(p.action)||
      !POLICY_STATUS.has(p.status)||!validTick(p.createdTick,state)||
      ![6,9,12].includes(p.bonus)||!p.baseline||
      !Number.isInteger(p.baseline.households)||p.baseline.households<1||
      !Number.isInteger(p.baseline.requiredAffected)||p.baseline.requiredAffected<1||
      !Number.isInteger(p.baseline.affectedHouseholds)||p.baseline.affectedHouseholds<p.baseline.requiredAffected||
      !Number.isFinite(p.baseline.averageScarcity)||!Number.isFinite(p.baseline.maxScarcity)||
      ['resources','stock','inventory','ownerIds','residentIds','houseIds'].some(k=>Object.prototype.hasOwnProperty.call(p,k))){
      errors.push('Governance policy');continue;
    }
    if(p.status==='active'){
      if(p.resolvedTick!==null||p.final!==null||p.resolutionReason!==null)errors.push('Governance policy');
    }else{
      if(!validTick(p.resolvedTick,state)||!p.final||!Number.isFinite(p.final.averageScarcity)||
        !Number.isInteger(p.final.affectedHouseholds)||typeof p.resolutionReason!=='string'||!p.resolutionReason)
        errors.push('Governance policy');
    }
    policyIds.add(p.id);maxPolicy=Math.max(maxPolicy,Number(p.id.slice(2)));
  }
  if(g.nextTerm<=maxTerm)errors.push('Governance term counter');
  if(g.nextPolicy<=maxPolicy)errors.push('Governance policy counter');
  return [...new Set(errors)];
}

function appointmentFromCandidate(c){
  return {
    agentId:c.agentId,
    requiredSupport:c.requiredSupport,
    supportOwnerIds:[...c.supportOwnerIds],
    supportHouseholds:c.supportHouseholds,
    supportTrust:c.supportTrust,
    supportRespect:c.supportRespect,
    supportEvidenceCount:c.supportEvidenceCount,
    supportContinuityTicks:c.supportContinuityTicks,
    leadershipLevel:c.leadershipLevel,
    professionAtAppointment:String(c.profession??'unknown')
  };
}

function vacantOffice(settlementId,tick){
  return {
    settlementId,status:'vacant',governorId:null,termId:null,appointedTick:null,lastQualifiedTick:null,
    lastTransitionTick:tick,appointment:null,vacancyReason:'no-candidate',history:[]
  };
}

function closeTerm(state,office,reason){
  if(office.status!=='active')return false;
  office.history.push({
    termId:office.termId,
    governorId:office.governorId,
    appointedTick:office.appointedTick,
    endedTick:state.tick,
    reason
  });
  while(office.history.length>GOVERNANCE_RULES.maxHistoryPerOffice)office.history.shift();
  office.status='vacant';office.governorId=null;office.termId=null;office.appointedTick=null;
  office.lastQualifiedTick=null;office.lastTransitionTick=state.tick;office.appointment=null;office.vacancyReason=reason;
  return true;
}

function appoint(state,office,candidate){
  const termId='GT'+state.governanceState.nextTerm++;
  office.status='active';office.governorId=candidate.agentId;office.termId=termId;
  office.appointedTick=state.tick;office.lastQualifiedTick=state.tick;office.lastTransitionTick=state.tick;
  office.appointment=appointmentFromCandidate(candidate);office.vacancyReason='none';
  return termId;
}

export function stepGovernanceAuthority(state,{force=false}={}){
  if(!isIndependent(state))return null;
  ensureGovernanceState(state);
  if(!force&&state.tick%GOVERNANCE_RULES.intervalTicks!==0)return null;

  const settlements=allSettlementSnapshots(state),active=settlements.filter(s=>s.status==='active'&&s.current);
  const activeById=new Map(active.map(s=>[s.id,s]));
  const projection=createGovernorCandidates(state);
  const candidatesBySettlement=new Map(projection.settlements.map(s=>[s.settlementId,s.candidates]));
  const createdOffices=[],appointed=[],vacated=[];

  for(const s of active){
    let office=state.governanceState.offices.find(o=>o.settlementId===s.id);
    if(!office){
      office=vacantOffice(s.id,state.tick);
      state.governanceState.offices.push(office);
      createdOffices.push(s.id);
    }
  }

  for(const office of state.governanceState.offices){
    const settlement=activeById.get(office.settlementId);
    if(!settlement){
      if(closeTerm(state,office,'settlement-dormant'))vacated.push({settlementId:office.settlementId,reason:'settlement-dormant'});
      else if(office.status==='vacant'){office.vacancyReason='settlement-dormant';office.lastTransitionTick=state.tick;}
      continue;
    }

    const rows=candidatesBySettlement.get(office.settlementId)??[];
    if(office.status==='active'){
      const governor=state.agents?.find(a=>a.id===office.governorId&&a.alive);
      if(!governor){
        closeTerm(state,office,'death');vacated.push({settlementId:office.settlementId,reason:'death'});
      }else if(!settlement.current.residentIds.includes(governor.id)){
        closeTerm(state,office,'left-settlement');vacated.push({settlementId:office.settlementId,reason:'left-settlement'});
      }else{
        const current=rows.find(c=>c.agentId===governor.id);
        if(current){
          office.lastQualifiedTick=state.tick;
        }else if(state.tick-office.lastQualifiedTick>GOVERNANCE_RULES.qualificationGraceTicks){
          closeTerm(state,office,'support-lost');vacated.push({settlementId:office.settlementId,reason:'support-lost'});
        }
      }
    }

    if(office.status==='vacant'){
      const top=rows[0]??null;
      if(top){
        const termId=appoint(state,office,top);
        appointed.push({settlementId:office.settlementId,governorId:top.agentId,termId});
      }else if(office.vacancyReason!=='settlement-dormant'){
        office.vacancyReason='no-candidate';
      }
    }
  }

  state.governanceState.offices.sort((a,b)=>a.settlementId.localeCompare(b.settlementId,undefined,{numeric:true}));
  return {
    version:GOVERNANCE_AUTHORITY_VERSION,
    changed:createdOffices.length+appointed.length+vacated.length>0,
    createdOffices:Object.freeze(createdOffices),
    appointed:Object.freeze(appointed.map(Object.freeze)),
    vacated:Object.freeze(vacated.map(Object.freeze))
  };
}

export function governanceOffice(state,settlementId){
  ensureGovernanceState(state);
  const row=state.governanceState?.offices?.find(o=>o.settlementId===settlementId);
  return row?structuredClone(row):null;
}

export function governanceOfficeForAgent(state,agentId){
  if(!isIndependent(state))return null;
  ensureGovernanceState(state);
  const row=state.governanceState.offices.find(o=>o.status==='active'&&o.governorId===agentId);
  return row?structuredClone(row):null;
}

export function allGovernanceOffices(state){
  if(!isIndependent(state))return [];
  ensureGovernanceState(state);
  return state.governanceState.offices.map(structuredClone);
}
