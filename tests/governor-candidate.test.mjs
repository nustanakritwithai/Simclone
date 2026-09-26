import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,restore,validate} from '../src/engine.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {activateHouseholdStore} from '../src/individual-resources.mjs';
import {recordRelationshipEvidence} from '../src/relationships.mjs';
import {recordEarnedSkill} from '../src/skill-provenance.mjs';
import {stepSettlementAuthority} from '../src/settlement-authority.mjs';
import {
  GOVERNOR_CANDIDATE_VERSION,
  GOVERNOR_CANDIDATE_RULES,
  createGovernorCandidates,
  governorCandidatesForSettlement,
  topGovernorCandidate
} from '../src/governor-candidate.mjs';

function completedHouse(state,id,ownerId,x,y){
  state.rustStations.stations.push(
    {id,kind:'WOOD_FOUNDATION',x,y,placedBy:ownerId,socket:{type:'cell',x,y,level:0}},
    {id:id+1,kind:'WOOD_WALL',x,y,socket:canonicalEdge(x,y,'N')},
    {id:id+2,kind:'WOOD_WALL',x,y,socket:canonicalEdge(x,y,'E')},
    {id:id+3,kind:'WOOD_WALL',x,y,socket:canonicalEdge(x,y,'S')},
    {id:id+4,kind:'WOOD_DOORWAY',x,y,socket:canonicalEdge(x,y,'W')},
    {id:id+5,kind:'WOOD_ROOF',x,y,socket:{type:'cell',x,y,level:2}}
  );
  const houseId='H'+id;
  const activated=activateHouseholdStore(state,houseId,ownerId);
  assert.equal(activated.ok,true);
  return houseId;
}

function leadership(state,agent,xp=10){
  agent.skills.LEADERSHIP+=xp;
  assert.equal(recordEarnedSkill(agent,'LEADERSHIP',xp,state.tick,{action:'GOV1_TEST'}),true);
}

function promoteSettlement({seed=230926,households=3,population=5}={}){
  const s=createWorld(seed,{mode:'independent',worldProfile:'large',population});
  const owners=s.agents.slice(0,households);
  owners.forEach((a,i)=>{
    a.x=5+i*3;a.y=5;
    completedHouse(s,1001+i*100,a.id,a.x,a.y);
  });
  s.tick=120;
  // Two retained social evidence records are enough for MX5 continuity. Direction
  // is owner[0] -> owner[1], so owner[0] receives no incoming GOV1 support.
  assert.equal(recordRelationshipEvidence(s,{
    fromId:owners[0].id,toId:owners[1].id,kind:'cooperation',
    key:'gov1:community:1',tick:0,delta:{trust:2,affinity:1}
  }).ok,true);
  assert.equal(recordRelationshipEvidence(s,{
    fromId:owners[0].id,toId:owners[1].id,kind:'knowledge-share',
    key:'gov1:community:2',tick:30,delta:{}
  }).ok,true);
  s.tick=360;
  const promoted=stepSettlementAuthority(s,{force:true});
  assert.deepEqual(promoted.createdIds,['S1']);
  assert.equal(s.settlementState.records[0].status,'active');
  return {s,owners,outsider:s.agents[households]};
}

function support(state,from,to,{trust=4,respect=2,fear=0,tick=60,key='support'}={}){
  return recordRelationshipEvidence(state,{
    fromId:from.id,toId:to.id,kind:'governance-support',
    key:key+':'+from.id+':'+to.id+':'+tick,tick,
    delta:{trust,respect,fear}
  });
}

test('GOV1 legacy worlds and Independent worlds without an active Settlement expose zero candidates',()=>{
  const legacy=createWorld(1,{mode:'legacy'});
  const a=createGovernorCandidates(legacy);
  assert.equal(a.version,GOVERNOR_CANDIDATE_VERSION);
  assert.deepEqual(a.candidates,[]);
  assert.equal(a.authority.governanceWriter,false);
  assert.equal(a.authority.saveFields,0);

  const independent=createWorld(2,{mode:'independent',worldProfile:'large'});
  leadership(independent,independent.agents[0]);
  assert.deepEqual(createGovernorCandidates(independent).candidates,[]);
});

test('GOV1 proximity and Leadership alone never create a Governor candidate',()=>{
  const {s,owners}=promoteSettlement({seed:11,households:3});
  const candidate=owners[0];leadership(s,candidate);
  // All homes are deliberately close enough to form one Neighborhood/Settlement.
  assert.equal(createGovernorCandidates(s).candidates.some(c=>c.agentId===candidate.id),false);
});

test('GOV1 requires exactly ceil(households/2) distinct supporting households and excludes own household',()=>{
  const {s,owners}=promoteSettlement({seed:12,households:3});
  const [candidate,b,c]=owners;leadership(s,candidate);
  assert.equal(GOVERNOR_CANDIDATE_RULES.minimumLeadershipLevel,1);

  assert.equal(support(s,b,candidate,{tick:60,key:'half'}).ok,true);
  assert.equal(createGovernorCandidates(s).candidates.some(x=>x.agentId===candidate.id),false,'one of three households is below ceil(3/2)');

  assert.equal(support(s,c,candidate,{tick:90,key:'majority'}).ok,true);
  const row=topGovernorCandidate(s,'S1');
  assert.ok(row);
  assert.equal(row.agentId,candidate.id);
  assert.equal(row.requiredSupport,2);
  assert.equal(row.supportHouseholds,2);
  assert.deepEqual(row.supportOwnerIds,[b.id,c.id]);
  assert.equal(row.supportOwnerIds.includes(candidate.id),false,'candidate own household cannot support itself');
  assert.equal(row.profession,candidate.profession,'productive profession remains a read-only field');
});

test('GOV1 relationship gates reject missing Trust, Respect, evidence and excessive Fear',()=>{
  const cases=[
    {name:'trust-low',delta:{trust:3,respect:2,fear:0}},
    {name:'respect-low',delta:{trust:4,respect:1,fear:0}},
    {name:'fear-high',delta:{trust:4,respect:2,fear:21}}
  ];
  for(let i=0;i<cases.length;i++){
    const {s,owners}=promoteSettlement({seed:30+i,households:2,population:4});
    const [candidate,sponsor]=owners;leadership(s,candidate);
    const x=cases[i];
    assert.equal(support(s,sponsor,candidate,{...x.delta,tick:60,key:x.name}).ok,true);
    assert.equal(createGovernorCandidates(s).candidates.some(c=>c.agentId===candidate.id),false,x.name);
  }

  const {s,owners}=promoteSettlement({seed:39,households:2,population:4});
  const [candidate,sponsor]=owners;leadership(s,candidate);
  assert.equal(support(s,sponsor,candidate,{tick:60,key:'evidence-strip'}).ok,true);
  const rel=s.social.relations.find(r=>r.fromId===sponsor.id&&r.toId===candidate.id);
  rel.evidence=[];
  assert.equal(createGovernorCandidates(s).candidates.some(c=>c.agentId===candidate.id),false,'scores without evidence do not count');
});

test('GOV1 rejects non-residents and Leadership level zero even when support exists',()=>{
  const {s,owners,outsider}=promoteSettlement({seed:50,households:3,population:5});
  const [a,b,c]=owners;

  // Resident with support but no Leadership.
  assert.equal(support(s,b,a,{tick:60,key:'no-lead-1'}).ok,true);
  assert.equal(support(s,c,a,{tick:90,key:'no-lead-2'}).ok,true);
  assert.equal(createGovernorCandidates(s).candidates.some(x=>x.agentId===a.id),false);

  // Outsider has Leadership and strong support but is not a current Settlement resident.
  leadership(s,outsider,20);
  assert.equal(support(s,a,outsider,{trust:8,respect:6,tick:60,key:'outsider-1'}).ok,true);
  assert.equal(support(s,b,outsider,{trust:8,respect:6,tick:90,key:'outsider-2'}).ok,true);
  assert.equal(createGovernorCandidates(s).candidates.some(x=>x.agentId===outsider.id),false);
});

test('GOV1 frozen rank prefers support count then Respect before Trust and Leadership',()=>{
  const {s,owners}=promoteSettlement({seed:61,households:3,population:5});
  const [a,b,c]=owners;
  leadership(s,a,10);
  leadership(s,b,20);

  // A: same two supporting households, more Respect but less Trust and lower Leadership.
  assert.equal(support(s,b,a,{trust:4,respect:4,tick:60,key:'rank-a1'}).ok,true);
  assert.equal(support(s,c,a,{trust:4,respect:4,tick:90,key:'rank-a2'}).ok,true);

  // B: same support count, higher Trust and Leadership, lower Respect.
  assert.equal(support(s,a,b,{trust:4,respect:2,tick:60,key:'rank-b1'}).ok,true);
  assert.equal(support(s,c,b,{trust:8,respect:2,tick:90,key:'rank-b2'}).ok,true);

  const rows=governorCandidatesForSettlement(s,'S1');
  assert.deepEqual(rows.slice(0,2).map(x=>x.agentId),[a.id,b.id]);
  assert.equal(rows[0].supportHouseholds,rows[1].supportHouseholds);
  assert.ok(rows[0].supportRespect>rows[1].supportRespect);
  assert.ok(rows[0].supportTrust<rows[1].supportTrust);
  assert.ok(rows[0].leadershipLevel<rows[1].leadershipLevel);
});

test('GOV1 exact tie uses lower agent ID only after all evidence keys tie',()=>{
  const {s,owners}=promoteSettlement({seed:62,households:3,population:5});
  const [a,b,c]=owners;leadership(s,a);leadership(s,b);

  // Candidate A: b->a and c->a total trust 8/respect 4/evidence 4, oldest tick 0.
  assert.equal(support(s,b,a,{tick:0,key:'tie-a1'}).ok,true);
  assert.equal(recordRelationshipEvidence(s,{fromId:b.id,toId:a.id,kind:'governance-support',key:'tie-a1b',tick:30,delta:{}}).ok,true);
  assert.equal(support(s,c,a,{tick:30,key:'tie-a2'}).ok,true);
  assert.equal(recordRelationshipEvidence(s,{fromId:c.id,toId:a.id,kind:'governance-support',key:'tie-a2b',tick:60,delta:{}}).ok,true);

  // Candidate B reuses the two baseline a->b evidence records, then reaches the
  // same totals/evidence count with one added a->b record and one c->b record.
  assert.equal(support(s,a,b,{trust:2,respect:2,tick:60,key:'tie-b1'}).ok,true);
  assert.equal(support(s,c,b,{tick:30,key:'tie-b2'}).ok,true);

  const rows=governorCandidatesForSettlement(s,'S1');
  const ra=rows.find(x=>x.agentId===a.id),rb=rows.find(x=>x.agentId===b.id);
  assert.ok(ra&&rb);
  assert.deepEqual(
    [ra.supportHouseholds,ra.supportRespect,ra.supportTrust,ra.leadershipLevel,ra.supportEvidenceCount,ra.supportContinuityTicks],
    [rb.supportHouseholds,rb.supportRespect,rb.supportTrust,rb.leadershipLevel,rb.supportEvidenceCount,rb.supportContinuityTicks]
  );
  assert.equal(rows[0].agentId,Math.min(a.id,b.id));
});

test('GOV1 projection is read-only and survives save/load byte-deterministically',()=>{
  const {s,owners}=promoteSettlement({seed:77,households:3,population:5});
  const [candidate,b,c]=owners;leadership(s,candidate);
  support(s,b,candidate,{tick:60,key:'persist-1'});
  support(s,c,candidate,{tick:90,key:'persist-2'});
  const profession=candidate.profession;
  const before=serialize(s);
  const projection=createGovernorCandidates(s);
  assert.equal(serialize(s),before);
  assert.equal(candidate.profession,profession);
  assert.equal(projection.authority.professionWriter,false);
  assert.equal(projection.authority.settlementWriter,false);
  assert.equal(projection.authority.relationshipWriter,false);
  assert.equal(projection.authority.resourceWriter,false);
  assert.equal(projection.authority.taskWriter,false);
  assert.equal(validate(s).length,0);

  const loaded=restore(before);
  assert.deepEqual(createGovernorCandidates(loaded),projection);
  assert.equal(serialize(loaded),before);
});

test('GOV1 dormant Settlements expose no Governor candidates',()=>{
  const {s,owners}=promoteSettlement({seed:88,households:3,population:5});
  const [candidate,b,c]=owners;leadership(s,candidate);
  support(s,b,candidate,{tick:60,key:'dormant-1'});
  support(s,c,candidate,{tick:90,key:'dormant-2'});
  assert.ok(topGovernorCandidate(s,'S1'));
  s.settlementState.records[0].status='dormant';
  assert.deepEqual(createGovernorCandidates(s).candidates,[]);
});
