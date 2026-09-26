import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,serialize,restore,validate,step} from '../src/engine.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {activateHouseholdStore,resourceStock} from '../src/individual-resources.mjs';
import {recordRelationshipEvidence,relationshipOf} from '../src/relationships.mjs';
import {recordEarnedSkill} from '../src/skill-provenance.mjs';
import {stepSettlementAuthority} from '../src/settlement-authority.mjs';
import {
  GOVERNANCE_STATE_VERSION,GOVERNANCE_RULES,ensureGovernanceState,validateGovernanceState,
  stepGovernanceAuthority,governanceOffice,governanceOfficeForAgent
} from '../src/governance-authority.mjs';
import {
  GOVERNANCE_POLICY_RULES,governanceNeeds,stepGovernancePolicy,activeGovernancePolicy,
  governorPolicySignal,governanceSupportSnapshot
} from '../src/governance-policy.mjs';
import {MAX_HOUSEHOLD_COOPERATION_BONUS} from '../src/household-cooperation.mjs';

function completedHouse(state,id,ownerId,x,y){
  const specs=[
    ['WOOD_FOUNDATION',{type:'cell',x,y,level:0}],
    ['WOOD_WALL',canonicalEdge(x,y,'N')],
    ['WOOD_WALL',canonicalEdge(x,y,'E')],
    ['WOOD_WALL',canonicalEdge(x,y,'S')],
    ['WOOD_DOORWAY',canonicalEdge(x,y,'W')],
    ['WOOD_ROOF',{type:'cell',x,y,level:2}]
  ];
  for(let i=0;i<specs.length;i++){
    const [kind,socket]=specs[i],stationId=id+i,itemInstanceId=200000+stationId,placementId='gov:'+stationId;
    state.rustStations.stations.push({
      id:stationId,kind,x,y,complete:true,placedBy:ownerId,placedTick:0,structurePiece:true,
      socket,sourceItemId:itemInstanceId,placementId
    });
    state.rustStations.placements.push({id:placementId,tick:0,stationId,itemInstanceId});
  }
  state.rustStations.nextStation=Math.max(state.rustStations.nextStation,id+6);
  const houseId='H'+id;
  assert.equal(activateHouseholdStore(state,houseId,ownerId).ok,true);
  return houseId;
}

function leadership(state,agent,xp){
  agent.skills.LEADERSHIP+=xp;
  assert.equal(recordEarnedSkill(agent,'LEADERSHIP',xp,state.tick,{action:'GOV_TEST'}),true);
}

function evidence(state,from,to,{trust=4,respect=2,affinity=1,fear=0,tick=60,key='e'}={}){
  const r=recordRelationshipEvidence(state,{
    fromId:from.id,toId:to.id,kind:'governance-support',
    key:key+':'+from.id+':'+to.id+':'+tick,tick,delta:{trust,respect,affinity,fear}
  });
  assert.equal(r.ok,true,JSON.stringify(r));
}

function settlementOnly(seed=9001){
  const s=createWorld(seed,{mode:'independent',worldProfile:'large',population:6});
  const owners=[s.agents[1],s.agents[2],s.agents[3]];
  owners.forEach((a,i)=>completedHouse(s,3001+i*100,a.id,5+i*3,5));
  s.tick=120;
  // Community evidence among owners; no GOV candidate is implied by this alone.
  evidence(s,owners[0],owners[1],{trust:2,respect:0,affinity:1,tick:0,key:'community-a'});
  evidence(s,owners[2],owners[1],{trust:2,respect:0,affinity:1,tick:30,key:'community-b'});
  s.tick=360;
  const promoted=stepSettlementAuthority(s,{force:true});
  assert.deepEqual(promoted.createdIds,['S1']);
  return {s,owners,guest:s.agents[4]};
}

function governanceWorld(seed=9100){
  const {s,owners,guest:governor}=settlementOnly(seed);
  const [a,b,c]=owners;
  // The future Governor lives in A's household, so A is its own household and
  // cannot count toward GOV1 support.
  evidence(s,governor,a,{trust:4,respect:0,affinity:2,tick:60,key:'join-from'});
  evidence(s,a,governor,{trust:0,respect:0,affinity:2,tick:60,key:'join-to'});
  const join=command(s,'JOIN_HOUSEHOLD',{agentId:governor.id,ownerId:a.id});
  assert.equal(join.ok,true,JSON.stringify(join));

  leadership(s,governor,20);
  leadership(s,b,10);

  // Governor wins over B by Respect, while B remains a valid successor.
  evidence(s,b,governor,{trust:4,respect:5,affinity:1,tick:60,key:'gov-b'});
  evidence(s,c,governor,{trust:4,respect:5,affinity:1,tick:90,key:'gov-c'});
  evidence(s,a,b,{trust:4,respect:2,affinity:1,tick:60,key:'succ-a'});
  evidence(s,c,b,{trust:4,respect:2,affinity:1,tick:90,key:'succ-c'});

  const beforeProfession=governor.profession,beforeCareer=structuredClone(governor.career);
  const officeStep=stepGovernanceAuthority(s,{force:true});
  assert.equal(officeStep.appointed.length,1);
  assert.equal(officeStep.appointed[0].governorId,governor.id);
  assert.equal(governor.profession,beforeProfession);
  assert.deepEqual(governor.career,beforeCareer);
  return {s,owners,governor,successor:b};
}

function loseSupportTo(state,candidateId,ownerIds){
  for(const row of state.social.relations){
    if(!ownerIds.includes(row.fromId)||row.toId!==candidateId)continue;
    const removed=row.evidence.filter(e=>e.kind==='governance-support');
    for(const e of removed){
      row.trust-=e.delta.trust??0;
      row.affinity-=e.delta.affinity??0;
      row.respect-=e.delta.respect??0;
      row.fear-=e.delta.fear??0;
      row.debt-=e.delta.debt??0;
    }
    row.evidence=row.evidence.filter(e=>e.kind!=='governance-support');
  }
}

test('GOV2 fresh Independent world owns empty governance state; Legacy owns none',()=>{
  const independent=createWorld(1,{mode:'independent'});
  assert.deepEqual(independent.governanceState,{version:GOVERNANCE_STATE_VERSION,nextTerm:1,nextPolicy:1,offices:[],policies:[]});
  assert.deepEqual(validateGovernanceState(independent),[]);
  const legacy=createWorld(1,{mode:'legacy'});
  assert.equal(legacy.governanceState,undefined);
  assert.deepEqual(validateGovernanceState(legacy),[]);
});

test('GOV2 active Settlement without candidate creates one VACANT office',()=>{
  const {s}=settlementOnly(2);
  const r=stepGovernanceAuthority(s,{force:true});
  assert.equal(r.changed,true);
  const o=governanceOffice(s,'S1');
  assert.equal(o.status,'vacant');assert.equal(o.governorId,null);assert.equal(o.vacancyReason,'no-candidate');
  assert.equal(s.governanceState.offices.length,1);
});

test('GOV2 appoints deterministic top candidate without changing profession or Settlement provenance',()=>{
  const {s,governor}=governanceWorld(3);
  const o=governanceOffice(s,'S1');
  assert.equal(o.status,'active');assert.equal(o.governorId,governor.id);
  assert.equal(governanceOfficeForAgent(s,governor.id)?.settlementId,'S1');
  assert.equal(o.appointment.professionAtAppointment,governor.profession);
  const settlementRecord=s.settlementState.records[0];
  assert.equal(Object.prototype.hasOwnProperty.call(settlementRecord,'governorId'),false);
  for(const forbidden of ['stock','resources','ownerIds','residentIds','houseIds'])assert.equal(Object.prototype.hasOwnProperty.call(o,forbidden),false);
});

test('GOV5 support loss keeps one full governance-cycle grace then vacates',()=>{
  const {s,owners,governor,successor}=governanceWorld(4);
  loseSupportTo(s,governor.id,owners.map(x=>x.id));
  loseSupportTo(s,successor.id,owners.map(x=>x.id));
  s.tick=720;
  stepGovernanceAuthority(s,{force:true});
  assert.equal(governanceOffice(s,'S1').status,'active','first missed qualification cycle is grace');
  s.tick=1080;
  stepGovernanceAuthority(s,{force:true});
  const o=governanceOffice(s,'S1');
  assert.equal(o.status,'vacant');assert.equal(o.vacancyReason,'no-candidate');
  assert.equal(o.history.at(-1).reason,'support-lost');
  assert.equal(o.history.at(-1).governorId,governor.id);
});

test('GOV5 Governor death vacates immediately and appoints next valid candidate without ownership transfer',()=>{
  const {s,owners,governor,successor}=governanceWorld(5);
  const ownerIds=s.settlementState.records.map(r=>r.anchorOwnerId);
  const ownerProfessions=owners.map(x=>x.profession),successorProfession=successor.profession;
  governor.alive=false;governor.hp=0;governor.task=null;governor.moveTick=0;
  governor.death={status:'recorded',tick:s.tick,cause:'age',ageYears:30};
  const residence=s.social.residences.find(r=>r.agentId===governor.id&&r.leftTick===null);
  residence.leftTick=s.tick;residence.leaveReason='resident-death';

  s.tick=720;
  const r=stepGovernanceAuthority(s,{force:true});
  assert.ok(r.vacated.some(x=>x.reason==='death'));
  assert.ok(r.appointed.some(x=>x.governorId===successor.id));
  const o=governanceOffice(s,'S1');
  assert.equal(o.governorId,successor.id);
  assert.equal(o.history.at(-1).governorId,governor.id);
  assert.deepEqual(s.settlementState.records.map(x=>x.anchorOwnerId),ownerIds);
  assert.deepEqual(owners.map(x=>x.profession),ownerProfessions);
  assert.equal(successor.profession,successorProfession);
});

test('GOV3 broad food shortage creates one bounded Food Security policy',()=>{
  const {s,owners}=governanceWorld(6);
  for(const [i,o] of owners.entries()){
    const stock=resourceStock(s,o);stock.food=i===0?999:0;stock.wood=999;stock.stone=999;
  }
  const needs=governanceNeeds(s,'S1');
  const food=needs.find(n=>n.good==='food');
  assert.equal(food.requiredAffected,2);assert.equal(food.affectedHouseholds,2);assert.equal(food.qualified,true);
  const r=stepGovernancePolicy(s,{force:true});
  assert.equal(r.created.length,1);
  const p=activeGovernancePolicy(s,'S1');
  assert.equal(p.good,'food');assert.equal(p.action,'FORAGE');assert.ok([6,9,12].includes(p.bonus));
  assert.ok(p.bonus<=GOVERNANCE_POLICY_RULES.maxBonus);
  assert.equal(s.governanceState.policies.filter(x=>x.status==='active').length,1);
});

test('GOV3 narrow shortage below household majority creates no policy',()=>{
  const {s,owners}=governanceWorld(7);
  for(const [i,o] of owners.entries()){
    const stock=resourceStock(s,o);stock.food=i===2?0:999;stock.wood=999;stock.stone=999;
  }
  assert.equal(governanceNeeds(s,'S1').find(n=>n.good==='food').qualified,false);
  assert.equal(stepGovernancePolicy(s,{force:true}).created.length,0);
  assert.equal(activeGovernancePolicy(s,'S1'),null);
});

test('GOV3 policy signal is below Household Cooperation and survival emergency suppresses it',()=>{
  const {s,owners}=governanceWorld(8);
  for(const [i,o] of owners.entries()){
    const stock=resourceStock(s,o);stock.food=i===0?999:0;stock.wood=999;stock.stone=999;
  }
  stepGovernancePolicy(s,{force:true});
  const actor=owners[0],normal=governorPolicySignal(s,actor,'FORAGE');
  assert.equal(normal.active,true);assert.ok(normal.bonus>0&&normal.bonus<=12);
  assert.ok(normal.bonus<MAX_HOUSEHOLD_COOPERATION_BONUS);
  assert.deepEqual(governorPolicySignal(s,actor,'FORAGE',{emergency:true}).bonus,0);
});

test('GOV3 policy reopens satisfied FORAGE candidate but still uses existing scorer/task executor',()=>{
  const {s,owners}=governanceWorld(9);
  for(const [i,o] of owners.entries()){
    const stock=resourceStock(s,o);stock.food=i===0?999:0;stock.wood=999;stock.stone=999;
  }
  stepGovernancePolicy(s,{force:true});
  const actor=owners[0],node=s.nodes.find(n=>n.type==='food'&&n.amount>0);assert.ok(node);
  actor.x=node.x;actor.y=node.y;actor.satiety=100;actor.energy=100;actor.task=null;
  step(s,1);
  const forage=actor.trace.find(c=>c.kind==='FORAGE'||c.purposeKind==='FORAGE');
  assert.ok(forage);assert.ok((forage.factors.governorPolicy??0)>0);
  assert.equal(forage.factors.householdCooperation??0,0,'actor own household is adequately stocked');
  assert.equal(forage.score,Object.values(forage.factors).reduce((n,v)=>n+v,0));
  assert.equal(actor.task?.kind,'FORAGE');
});

test('GOV4 resolved policy records bounded outcome evidence once and exposes read-only legitimacy',()=>{
  const {s,owners,governor}=governanceWorld(10);
  for(const [i,o] of owners.entries()){
    const stock=resourceStock(s,o);stock.food=i===0?999:0;stock.wood=999;stock.stone=999;
  }
  stepGovernancePolicy(s,{force:true});
  const p=activeGovernancePolicy(s,'S1');assert.ok(p);
  const sponsor=owners[1],before=relationshipOf(s,sponsor.id,governor.id);
  for(const o of owners)resourceStock(s,o).food=999;
  s.tick=420;
  const r=stepGovernancePolicy(s,{force:true});
  assert.equal(r.resolved.length,1);
  const after=relationshipOf(s,sponsor.id,governor.id);
  assert.equal(after.trust,before.trust+1);assert.equal(after.respect,before.respect+1);
  const count=after.evidence.filter(e=>e.key==='governance-policy-resolved:'+p.id+':'+sponsor.id).length;
  assert.equal(count,1);
  stepGovernancePolicy(s,{force:true});
  assert.equal(relationshipOf(s,sponsor.id,governor.id).evidence.filter(e=>e.key==='governance-policy-resolved:'+p.id+':'+sponsor.id).length,1);

  const bytes=serialize(s),support=governanceSupportSnapshot(s,'S1');
  assert.equal(support.governorId,governor.id);assert.equal(support.status,'active');
  assert.equal(support.resolvedPolicies,1);
  assert.equal(serialize(s),bytes,'legitimacy projection is read-only');
});

test('Governor v1 governance state and policies survive deterministic save/load',()=>{
  const {s,owners}=governanceWorld(11);
  for(const [i,o] of owners.entries()){
    const stock=resourceStock(s,o);stock.food=i===0?999:0;stock.wood=999;stock.stone=999;
  }
  stepGovernancePolicy(s,{force:true});
  const before=serialize(s);
  assert.deepEqual(validate(s),[]);
  const a=restore(before),b=restore(before);
  assert.equal(serialize(a),before);assert.equal(serialize(b),before);
  step(a,120);step(b,120);
  assert.equal(serialize(a),serialize(b));
});

test('Governor v1 migration adds empty governance state and validator rejects copied resource authority',()=>{
  const s=createWorld(12,{mode:'independent'});
  delete s.governanceState;
  const loaded=restore(JSON.stringify(s));
  assert.deepEqual(loaded.governanceState,{version:GOVERNANCE_STATE_VERSION,nextTerm:1,nextPolicy:1,offices:[],policies:[]});
  assert.deepEqual(validateGovernanceState(loaded),[]);
  loaded.governanceState.offices.push({
    settlementId:'S1',status:'vacant',governorId:null,termId:null,appointedTick:null,lastQualifiedTick:null,
    lastTransitionTick:0,appointment:null,vacancyReason:'no-candidate',history:[],stock:{food:1}
  });
  assert.deepEqual(validateGovernanceState(loaded),['Governance office']);
});
