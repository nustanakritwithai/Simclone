import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,command,serialize,restore,walkable} from '../src/engine.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {personalHomeSite,homeOf} from '../src/individual-housing.mjs';
import {materialStock,resourceStock} from '../src/individual-resources.mjs';
import {recordRelationshipEvidence,relationshipOf,activeResidenceOf} from '../src/relationships.mjs';
import {householdRecruitmentOffers} from '../src/kingdom-household-organization.mjs';
import {kingdomLaborMarketSnapshot} from '../src/kingdom-labor-market.mjs';
import {recruitmentDecision,stepHouseholdRecruitment} from '../src/household-recruitment-authority.mjs';
import {RULES} from '../src/survival.mjs';

function give(s,a,kind){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
}
function equipHammer(s,a){
  const id=give(s,a,'HAMMER');
  s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>e.agentId!==a.id);
  s.rustPossessions.equipment.push({agentId:a.id,itemId:id});
}
function place(s,a,kind,socket){
  const id=give(s,a,kind);
  return command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'ic7a:'+s.tick+':'+a.id+':'+id});
}
function completeHome(s,a){
  const site=personalHomeSite(s,a,walkable);assert.ok(site);
  a.x=site.origin.x;a.y=site.origin.y;a.task=null;equipHammer(s,a);
  const {x,y}=site.origin;
  const rows=[
    place(s,a,'WOOD_FOUNDATION',{type:'cell',x,y}),
    place(s,a,'WOOD_WALL',canonicalEdge(x,y,'N')),
    place(s,a,'WOOD_WALL',canonicalEdge(x,y,'E')),
    place(s,a,'WOOD_WALL',canonicalEdge(x,y,'W')),
    place(s,a,'WOOD_DOORWAY',canonicalEdge(x,y,'S')),
    place(s,a,'WOOD_ROOF',{type:'cell',x,y})
  ];
  assert.ok(rows.every(r=>r.ok),JSON.stringify(rows));
  return homeOf(s,a.id,{completeOnly:true});
}
function qualify(s,subject,owner,key='q'){
  assert.equal(recordRelationshipEvidence(s,{fromId:subject.id,toId:owner.id,kind:'test',key:key+':from',delta:{trust:4,affinity:2}}).ok,true);
  assert.equal(recordRelationshipEvidence(s,{fromId:owner.id,toId:subject.id,kind:'test',key:key+':to',delta:{affinity:2}}).ok,true);
}
function foodPoorHouse(){
  const s=createWorld(230926,{mode:'independent'});
  const owner=s.agents[2],candidate=s.agents[4]; // siblings; candidate preference cycles to FORAGE.
  const home=completeHome(s,owner);qualify(s,candidate,owner,'food-recruit');
  const pool=resourceStock(s,owner);pool.food=0;pool.wood=30;pool.stone=20;
  return {s,owner,candidate,home,pool};
}

test('IC7A food scarcity emits a relationship-backed forager recruitment offer',()=>{
  const {s,owner,candidate}=foodPoorHouse();
  const offers=householdRecruitmentOffers(s,owner.id);
  const offer=offers.find(o=>o.role==='forager');
  assert.ok(offer);
  assert.ok(['high','critical'].includes(offer.urgency));
  assert.ok(offer.candidateIds.includes(candidate.id));
  const d=recruitmentDecision(s,candidate);
  assert.equal(d.role,'forager');
  assert.equal(d.preferenceMatch,true);
  assert.equal(d.accepted,true);
});

test('IC7A high or critical need can recruit a relationship-backed off-preference candidate',()=>{
  const {s,candidate}=foodPoorHouse();
  candidate.preference='WOODCUT';
  const d=recruitmentDecision(s,candidate);
  assert.equal(d.role,'forager');
  assert.ok(['high','critical'].includes(d.urgency));
  assert.equal(d.preferenceMatch,false);
  assert.equal(d.accepted,true);
});

test('IC7A K4 labor pressure exposes all required household recruitment roles',()=>{
  const economy={
    scarcity:{food:2,wood:2,stone:2},
    premium:{forager:1,woodcutter:1,miner:1,builder:1}
  };
  const production={roles:{
    forager:{workers:0,ideal:8,laborGap:8},
    woodcutter:{workers:0,ideal:6,laborGap:6},
    miner:{workers:0,ideal:6,laborGap:6},
    builder:{workers:0,ideal:5,laborGap:5}
  }};
  const roles=kingdomLaborMarketSnapshot({economy,production}).offers.map(o=>o.role).sort();
  assert.deepEqual(roles,['builder','forager','miner','woodcutter']);
});

test('IC7A stranger proximity alone never produces an autonomous recruitment decision',()=>{
  const {s,owner,home}=foodPoorHouse(),stranger=s.agents[3];
  stranger.x=home.origin.x;stranger.y=home.origin.y;
  assert.equal(recruitmentDecision(s,stranger),null);
  assert.equal(activeResidenceOf(s,stranger.id),null);
  assert.equal(owner.alive,true);
});

test('IC7A cycle executes at most one JOIN and frozen ranking prefers stronger relationship over work preference',()=>{
  const {s,owner,candidate}=foodPoorHouse(),other=s.agents[1];
  // Give the leader two available slots so both relationship-backed candidates appear in the offer.
  owner.skills.LEADERSHIP=10;
  qualify(s,other,owner,'other-recruit');
  candidate.preference='WOODCUT';
  other.preference='FORAGE';
  assert.equal(recordRelationshipEvidence(s,{fromId:candidate.id,toId:owner.id,kind:'test',key:'ranking:respect',delta:{respect:2}}).ok,true);
  s.tick=60;
  const beforeCandidate={...materialStock(s,candidate)};
  const r=stepHouseholdRecruitment(s);
  assert.equal(r.ok,true);assert.equal(r.changed,true);
  const active=s.social.residences.filter(x=>x.leftTick===null&&x.ownerId===owner.id);
  assert.equal(active.length,1,'max one autonomous JOIN per recruitment cycle');
  assert.equal(active[0].agentId,candidate.id,'relationship score outranks preference match after urgency and offer priority');
  assert.equal(active[0].joinReason,'recruitment:forager');
  assert.equal(materialStock(s,candidate).food,0);
  assert.ok(resourceStock(s,owner).food>=beforeCandidate.food);
});

test('IC7A engine step activates recruitment exactly on the bounded 60-tick cadence',()=>{
  const {s,owner,candidate}=foodPoorHouse();
  s.tick=58;step(s,1);
  assert.equal(activeResidenceOf(s,candidate.id),null);
  step(s,1);
  assert.equal(activeResidenceOf(s,candidate.id)?.ownerId,owner.id);
  assert.equal(activeResidenceOf(s,candidate.id)?.joinReason,'recruitment:forager');
  assert.ok(s.events.some(e=>e.type==='household'&&e.agentId===candidate.id&&e.text.includes('รับข้อเสนอ')));
});

test('IC7A full Leadership follower capacity blocks autonomous recruitment',()=>{
  const {s,owner,candidate,home}=foodPoorHouse(),follower=s.agents[1];
  s.social.residences.push({
    agentId:follower.id,ownerId:owner.id,houseId:home.houseId,
    joinedTick:s.tick,leftTick:null,joinReason:'relationship-evidence',leaveReason:null,
    evidence:{subjectToOwner:[],ownerToSubject:[]}
  });
  assert.equal(recruitmentDecision(s,candidate),null);
  s.tick=60;assert.equal(stepHouseholdRecruitment(s),null);
  assert.equal(activeResidenceOf(s,candidate.id),null);
});

test('IC7A real follower resource work writes bounded owner-to-worker cooperation evidence',()=>{
  const {s,owner,candidate}=foodPoorHouse();
  s.tick=60;assert.equal(stepHouseholdRecruitment(s).ok,true);
  const node=s.nodes.find(n=>n.type==='food'&&n.amount>=10);assert.ok(node);
  candidate.x=node.x;candidate.y=node.y;candidate.satiety=100;candidate.energy=100;candidate.task={
    kind:'FORAGE',targetId:node.id,x:node.x,y:node.y,path:[],work:0,score:1,started:s.tick,policy:RULES.jobPolicy
  };
  const before=relationshipOf(s,owner.id,candidate.id);
  const workDone=candidate.workDone;
  for(let i=0;i<30&&candidate.workDone===workDone;i++)step(s,1);
  assert.ok(candidate.workDone>workDone,'expected productive FORAGE completion');
  const after=relationshipOf(s,owner.id,candidate.id);
  assert.equal(after.trust,before.trust+1);
  assert.equal(after.respect,before.respect+1);
  const evidence=after.evidence.filter(e=>e.kind==='household-contribution'&&e.ref?.endsWith(':food'));
  assert.equal(evidence.length,1);

  // A second FORAGE in the same simulation year cannot farm social evidence.
  node.amount=Math.max(node.amount,10);
  candidate.x=node.x;candidate.y=node.y;candidate.task={
    kind:'FORAGE',targetId:node.id,x:node.x,y:node.y,path:[],work:0,score:1,started:s.tick,policy:RULES.jobPolicy
  };
  const againWork=candidate.workDone;
  for(let i=0;i<30&&candidate.workDone===againWork;i++)step(s,1);
  const again=relationshipOf(s,owner.id,candidate.id);
  assert.equal(again.trust,after.trust);
  assert.equal(again.respect,after.respect);
});

test('IC7A recruitment uses existing persisted residence authority and save/load remains deterministic',()=>{
  const {s,owner,candidate}=foodPoorHouse();
  s.tick=60;assert.equal(stepHouseholdRecruitment(s).ok,true);
  const before=serialize(s),loaded=restore(before);
  assert.equal(activeResidenceOf(loaded,candidate.id)?.ownerId,owner.id);
  assert.equal(activeResidenceOf(loaded,candidate.id)?.joinReason,'recruitment:forager');
  assert.equal(serialize(loaded),before);
});
