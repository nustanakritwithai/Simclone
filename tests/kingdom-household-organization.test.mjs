import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,serialize,walkable} from '../src/engine.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {personalHomeSite,homeOf} from '../src/individual-housing.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {recordRelationshipEvidence} from '../src/relationships.mjs';
import {householdOrganizationShadow,householdRecruitmentOffers} from '../src/kingdom-household-organization.mjs';

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
  return command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'org:'+s.tick+':'+a.id+':'+id});
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

test('Kingdom organization shadow exposes household leader and explicit adult members only',()=>{
  const s=createWorld(230926,{mode:'independent'}),follower=s.agents[1],owner=s.agents[2];
  completeHome(s,owner);qualify(s,follower,owner,'member');
  assert.equal(command(s,'JOIN_HOUSEHOLD',{agentId:follower.id,ownerId:owner.id}).ok,true);
  const row=householdOrganizationShadow(s,owner.id);assert.ok(row);
  assert.equal(row.leaderId,owner.id);
  assert.deepEqual(row.adultMemberIds.sort((a,b)=>a-b),[owner.id,follower.id].sort((a,b)=>a-b));
  assert.equal(row.organizationReady,true);
  assert.equal(row.authoritative,false);
});

test('Kingdom recruitment requires relationship-backed cohabitation candidate, not proximity',()=>{
  const s=createWorld(230926,{mode:'independent'}),candidate=s.agents[1],owner=s.agents[2],stranger=s.agents[3];
  const home=completeHome(s,owner);
  candidate.x=home.origin.x;candidate.y=home.origin.y;stranger.x=home.origin.x;stranger.y=home.origin.y;
  qualify(s,candidate,owner,'candidate');
  const stock=resourceStock(s,owner);stock.food=1;stock.wood=0;stock.stone=0;
  const offers=householdRecruitmentOffers(s,owner.id);
  assert.ok(offers.length>0,'scarce household should emit labor recruitment shadow');
  const ids=new Set(offers.flatMap(o=>o.candidateIds));
  assert.equal(ids.has(candidate.id),true);
  assert.equal(ids.has(stranger.id),false,'nearby stranger without relationship evidence is excluded');
});

test('Kingdom recruitment suppresses all offers when Leadership follower capacity is full',()=>{
  const s=createWorld(230926,{mode:'independent'}),follower=s.agents[1],owner=s.agents[2],candidate=s.agents[3];
  completeHome(s,owner);qualify(s,follower,owner,'first');qualify(s,candidate,owner,'second');
  assert.equal(command(s,'JOIN_HOUSEHOLD',{agentId:follower.id,ownerId:owner.id}).ok,true);
  // First unique follower awards 10 Leadership XP => capacity 2, so fill the second slot explicitly.
  assert.equal(command(s,'JOIN_HOUSEHOLD',{agentId:candidate.id,ownerId:owner.id}).ok,true);
  const third=s.agents[4];qualify(s,third,owner,'third');
  const stock=resourceStock(s,owner);stock.food=1;stock.wood=0;stock.stone=0;
  const row=householdOrganizationShadow(s,owner.id);assert.equal(row.leadership.availableFollowerSlots,0);
  assert.deepEqual(householdRecruitmentOffers(s,owner.id),[]);
});

test('Kingdom household organization/recruitment shadow is byte-read-only and deterministic after save/load',()=>{
  const s=createWorld(230926,{mode:'independent'}),candidate=s.agents[1],owner=s.agents[2];
  completeHome(s,owner);qualify(s,candidate,owner,'stable');
  const stock=resourceStock(s,owner);stock.food=1;stock.wood=0;stock.stone=0;
  const before=serialize(s),a=householdRecruitmentOffers(s,owner.id);
  assert.equal(serialize(s),before);
  const copy=JSON.parse(before);
  const restored=(await import('../src/engine.mjs')).restore(JSON.stringify(copy));
  const b=householdRecruitmentOffers(restored,owner.id);
  assert.deepEqual(b,a);
});
