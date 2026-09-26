/**
 * GOV3 + GOV4 — bounded Governor policy signal and evidence-backed legitimacy.
 *
 * Policies never write stock or tasks. They publish a small score signal into
 * the existing task scorer. Successful resolution writes bounded relationship
 * evidence through the existing social authority.
 */
import {isIndependent} from './individual-resources.mjs?v=0.5.0';
import {allSettlementSnapshots} from './settlement-authority.mjs?v=0.5.0';
import {householdEconomySnapshot} from './kingdom-household-economy.mjs?v=0.5.0';
import {recordRelationshipEvidence} from './relationships.mjs?v=0.5.0';
import {ensureGovernanceState,governanceOffice,GOVERNANCE_RULES} from './governance-authority.mjs?v=0.5.0';
import {governorCandidateEvaluation} from './governor-candidate.mjs?v=0.5.0';

export const GOVERNANCE_POLICY_VERSION='GOV3-GOV4-policy-1';
export const GOVERNANCE_POLICY_RULES=Object.freeze({
  intervalTicks:60,
  scarcityThreshold:1.2,
  maxBonus:12
});

const GOODS=Object.freeze([
  Object.freeze({good:'food',action:'FORAGE',order:0,label:'Food Security'}),
  Object.freeze({good:'wood',action:'WOODCUT',order:1,label:'Wood Mobilization'}),
  Object.freeze({good:'stone',action:'MINE',order:2,label:'Stone Mobilization'})
]);

const round3=n=>+Number(n||0).toFixed(3);

function severityBonus(avg){
  return avg>=2.5?12:avg>=1.8?9:6;
}

function settlementById(state,id){
  return allSettlementSnapshots(state).find(s=>s.id===id&&s.status==='active'&&s.current)??null;
}

export function governanceNeeds(state,settlementId){
  const settlement=settlementById(state,settlementId);
  if(!settlement)return Object.freeze([]);
  const rows=[];
  for(const spec of GOODS){
    const values=[];
    for(const ownerId of settlement.current.ownerIds){
      const economy=householdEconomySnapshot(state,ownerId);
      const scarcity=Number(economy?.economy?.scarcity?.[spec.good]??0);
      values.push({ownerId,scarcity:Number.isFinite(scarcity)?scarcity:0});
    }
    const affected=values.filter(v=>v.scarcity>GOVERNANCE_POLICY_RULES.scarcityThreshold);
    const average=values.length?values.reduce((n,v)=>n+v.scarcity,0)/values.length:0;
    const max=values.length?Math.max(...values.map(v=>v.scarcity)):0;
    const requiredAffected=Math.ceil(settlement.current.households/2);
    rows.push(Object.freeze({
      settlementId,
      good:spec.good,action:spec.action,label:spec.label,order:spec.order,
      households:settlement.current.households,
      requiredAffected,
      affectedHouseholds:affected.length,
      affectedOwnerIds:Object.freeze(affected.map(v=>v.ownerId).sort((a,b)=>a-b)),
      averageScarcity:round3(average),
      maxScarcity:round3(max),
      qualified:affected.length>=requiredAffected
    }));
  }
  rows.sort((a,b)=>
    Number(b.qualified)-Number(a.qualified)||
    b.affectedHouseholds-a.affectedHouseholds||
    b.averageScarcity-a.averageScarcity||
    b.maxScarcity-a.maxScarcity||
    a.order-b.order
  );
  return Object.freeze(rows);
}

function statsForPolicy(state,p){
  const row=governanceNeeds(state,p.settlementId).find(x=>x.good===p.good);
  return row??Object.freeze({
    settlementId:p.settlementId,good:p.good,action:p.action,label:p.good,order:99,
    households:0,requiredAffected:1,affectedHouseholds:0,affectedOwnerIds:Object.freeze([]),
    averageScarcity:0,maxScarcity:0,qualified:false
  });
}

function finishPolicy(state,p,status,reason,stats){
  if(p.status!=='active')return false;
  p.status=status;
  p.resolvedTick=state.tick;
  p.final={
    affectedHouseholds:stats.affectedHouseholds,
    averageScarcity:stats.averageScarcity,
    maxScarcity:stats.maxScarcity
  };
  p.resolutionReason=reason;
  return true;
}

function recordPolicyOutcomeEvidence(state,p,settlement){
  let writes=0;
  for(const ownerId of settlement?.current?.ownerIds??[]){
    if(ownerId===p.governorId)continue;
    const r=recordRelationshipEvidence(state,{
      fromId:ownerId,toId:p.governorId,kind:'governance-outcome',
      key:'governance-policy-resolved:'+p.id+':'+ownerId,
      delta:{trust:1,respect:1},ref:p.id+':'+p.good
    });
    if(r.ok&&r.changed)writes++;
  }
  return writes;
}

export function stepGovernancePolicy(state,{force=false}={}){
  if(!isIndependent(state))return null;
  ensureGovernanceState(state);
  if(!force&&state.tick%GOVERNANCE_POLICY_RULES.intervalTicks!==0)return null;

  const resolved=[],cancelled=[],created=[];
  const activeSettlements=new Map(allSettlementSnapshots(state)
    .filter(s=>s.status==='active'&&s.current).map(s=>[s.id,s]));

  for(const p of state.governanceState.policies.filter(p=>p.status==='active')){
    const office=state.governanceState.offices.find(o=>o.settlementId===p.settlementId);
    const settlement=activeSettlements.get(p.settlementId)??null;
    const stats=statsForPolicy(state,p);
    if(!office||office.status!=='active'||office.governorId!==p.governorId||!settlement){
      if(finishPolicy(state,p,'cancelled','governor-transition',stats))
        cancelled.push({policyId:p.id,settlementId:p.settlementId});
      continue;
    }
    if(!stats.qualified){
      if(finishPolicy(state,p,'resolved','shortage-resolved',stats)){
        const evidenceWrites=recordPolicyOutcomeEvidence(state,p,settlement);
        resolved.push({policyId:p.id,settlementId:p.settlementId,evidenceWrites});
      }
    }
  }

  for(const office of state.governanceState.offices.filter(o=>o.status==='active')){
    if(!activeSettlements.has(office.settlementId))continue;
    if(state.governanceState.policies.some(p=>p.settlementId===office.settlementId&&p.status==='active'))continue;
    const need=governanceNeeds(state,office.settlementId).find(n=>n.qualified)??null;
    if(!need)continue;
    const id='GP'+state.governanceState.nextPolicy++;
    const p={
      id,settlementId:office.settlementId,governorId:office.governorId,
      good:need.good,action:need.action,createdTick:state.tick,status:'active',
      bonus:severityBonus(need.averageScarcity),
      baseline:{
        households:need.households,
        requiredAffected:need.requiredAffected,
        affectedHouseholds:need.affectedHouseholds,
        averageScarcity:need.averageScarcity,
        maxScarcity:need.maxScarcity
      },
      resolvedTick:null,final:null,resolutionReason:null
    };
    state.governanceState.policies.push(p);
    created.push({policyId:id,settlementId:p.settlementId,governorId:p.governorId,good:p.good,bonus:p.bonus});
  }

  return {
    version:GOVERNANCE_POLICY_VERSION,
    changed:created.length+resolved.length+cancelled.length>0,
    created:Object.freeze(created.map(Object.freeze)),
    resolved:Object.freeze(resolved.map(Object.freeze)),
    cancelled:Object.freeze(cancelled.map(Object.freeze))
  };
}

export function activeGovernancePolicy(state,settlementId){
  if(!isIndependent(state))return null;
  ensureGovernanceState(state);
  const p=state.governanceState.policies.find(p=>p.settlementId===settlementId&&p.status==='active');
  return p?structuredClone(p):null;
}

export function governorPolicySignal(state,agent,kind,{emergency=false}={}){
  if(!isIndependent(state))return {version:GOVERNANCE_POLICY_VERSION,active:false,bonus:0,reason:'legacy'};
  if(emergency)return {version:GOVERNANCE_POLICY_VERSION,active:false,bonus:0,reason:'survival-emergency'};
  if(!agent?.alive)return {version:GOVERNANCE_POLICY_VERSION,active:false,bonus:0,reason:'actor'};
  const settlement=allSettlementSnapshots(state).find(s=>s.status==='active'&&s.current?.residentIds?.includes(agent.id));
  if(!settlement)return {version:GOVERNANCE_POLICY_VERSION,active:false,bonus:0,reason:'no-settlement'};
  const policy=activeGovernancePolicy(state,settlement.id);
  if(!policy||policy.action!==kind)return {
    version:GOVERNANCE_POLICY_VERSION,active:false,bonus:0,reason:policy?'different-policy':'no-policy',
    settlementId:settlement.id
  };
  return {
    version:GOVERNANCE_POLICY_VERSION,active:true,bonus:Math.min(GOVERNANCE_POLICY_RULES.maxBonus,policy.bonus),
    reason:'governor-policy',settlementId:settlement.id,policyId:policy.id,governorId:policy.governorId,
    good:policy.good,action:policy.action
  };
}

export function governanceSupportSnapshot(state,settlementId){
  if(!isIndependent(state))return null;
  const office=governanceOffice(state,settlementId);
  if(!office)return null;
  const activePolicy=activeGovernancePolicy(state,settlementId);
  const resolvedPolicies=state.governanceState?.policies?.filter(p=>
    p.settlementId===settlementId&&p.status==='resolved'&&
    (office.governorId===null||p.governorId===office.governorId)
  ).length??0;
  if(office.status!=='active')return Object.freeze({
    settlementId,status:'vacant',governorId:null,termId:null,
    supportHouseholds:0,requiredSupport:0,supportTrust:0,supportRespect:0,
    leadershipLevel:0,qualification:'vacant',resolvedPolicies,activePolicy
  });
  const evaluation=governorCandidateEvaluation(state,settlementId,office.governorId);
  return Object.freeze({
    settlementId,status:'active',governorId:office.governorId,termId:office.termId,
    supportHouseholds:evaluation?.supportHouseholds??0,
    requiredSupport:evaluation?.requiredSupport??office.appointment.requiredSupport,
    supportTrust:evaluation?.supportTrust??0,
    supportRespect:evaluation?.supportRespect??0,
    leadershipLevel:evaluation?.leadershipLevel??office.appointment.leadershipLevel,
    qualification:evaluation?.qualified?'qualified':'grace',
    resolvedPolicies,
    activePolicy
  });
}
