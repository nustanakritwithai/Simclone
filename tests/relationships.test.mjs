import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,command,step,serialize,restore,validate,walkable
} from '../src/engine.mjs';
import {childLife} from '../src/lifecycle.mjs';
import {recordResourceDiscovery} from '../src/knowledge.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {personalHomeSite} from '../src/individual-housing.mjs';
import {
  SOCIAL_VERSION,relationshipOf,recordRelationshipEvidence,
  householdForOwner,householdOf,validateSocialState
} from '../src/relationships.mjs';

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
  return command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'ic6:'+s.tick+':'+a.id+':'+id});
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
}

test('IC6 new independent world starts with valid empty social authority',()=>{
  const s=createWorld(230926,{mode:'independent'});
  assert.equal(s.social.version,SOCIAL_VERSION);
  assert.deepEqual(s.social.relations,[]);
  assert.deepEqual(validateSocialState(s,{required:true}),[]);
  assert.deepEqual(validate(s),[]);
});

test('IC6 successful knowledge share adds mutual affinity but not trust',()=>{
  const s=createWorld(230926,{mode:'independent'}),sender=s.agents[0],receiver=s.agents[1];
  receiver.x=sender.x;receiver.y=sender.y;
  const node=s.nodes.find(n=>n.amount>0);assert.ok(node);
  const belief=recordResourceDiscovery(sender,node,s.tick,{action:'FORAGE',amount:1});assert.ok(belief);
  const r=command(s,'SHARE_KNOWLEDGE',{fromId:sender.id,toId:receiver.id,key:belief.key});
  assert.equal(r.ok,true);
  assert.equal(relationshipOf(s,sender.id,receiver.id).affinity,1);
  assert.equal(relationshipOf(s,receiver.id,sender.id).affinity,1);
  assert.equal(relationshipOf(s,receiver.id,sender.id).trust,0);
});

test('IC6 verified received knowledge raises verifier to source trust exactly once',()=>{
  const s=createWorld(230926,{mode:'independent'}),sender=s.agents[0],receiver=s.agents[1];
  receiver.x=sender.x;receiver.y=sender.y;
  const node=s.nodes.find(n=>n.amount>0);assert.ok(node);
  const belief=recordResourceDiscovery(sender,node,s.tick,{action:'FORAGE',amount:1});assert.ok(belief);
  assert.equal(command(s,'SHARE_KNOWLEDGE',{fromId:sender.id,toId:receiver.id,key:belief.key}).ok,true);
  receiver.x=node.x;receiver.y=node.y;
  const first=command(s,'VERIFY_KNOWLEDGE',{agentId:receiver.id,key:belief.key});
  assert.equal(first.ok,true);assert.equal(first.reason,'locally-observed');
  assert.equal(relationshipOf(s,receiver.id,sender.id).trust,4);
  const second=command(s,'VERIFY_KNOWLEDGE',{agentId:receiver.id,key:belief.key});
  assert.equal(second.ok,true);
  assert.equal(relationshipOf(s,receiver.id,sender.id).trust,4,'same verified claim is idempotent');
});

test('IC6 depleted/stale verification never penalizes source trust',()=>{
  const s=createWorld(230926,{mode:'independent'}),sender=s.agents[0],receiver=s.agents[1];
  receiver.x=sender.x;receiver.y=sender.y;
  const node=s.nodes.find(n=>n.amount>0);assert.ok(node);
  const belief=recordResourceDiscovery(sender,node,s.tick,{action:'FORAGE',amount:1});assert.ok(belief);
  assert.equal(command(s,'SHARE_KNOWLEDGE',{fromId:sender.id,toId:receiver.id,key:belief.key}).ok,true);
  node.amount=0;receiver.x=node.x;receiver.y=node.y;
  const r=command(s,'VERIFY_KNOWLEDGE',{agentId:receiver.id,key:belief.key});
  assert.equal(r.ok,true);assert.equal(r.reason,'temporarily-depleted');
  assert.equal(relationshipOf(s,receiver.id,sender.id).trust,0);
});

test('IC6 mentor link writes directed respect/trust/affinity once',()=>{
  const s=createWorld(230926,{mode:'independent'}),mentor=s.agents[0],student=s.agents[1];
  student.x=mentor.x;student.y=mentor.y;
  const r=command(s,'CREATE_MENTOR_LINK',{mentorId:mentor.id,studentId:student.id});
  assert.equal(r.ok,true);assert.equal(r.changed,true);
  assert.deepEqual(
    Object.fromEntries(['trust','affinity','respect'].map(k=>[k,relationshipOf(s,student.id,mentor.id)[k]])),
    {trust:2,affinity:0,respect:8}
  );
  assert.equal(relationshipOf(s,mentor.id,student.id).affinity,2);
  const again=command(s,'CREATE_MENTOR_LINK',{mentorId:mentor.id,studentId:student.id});
  assert.equal(again.ok,true);assert.equal(again.changed,false);
  assert.equal(relationshipOf(s,student.id,mentor.id).respect,8);
});

test('IC6 guardian meal creates bounded yearly support evidence',()=>{
  const s=createWorld(230926,{mode:'independent'}),guardian=s.agents[0],child=s.agents[1];
  child.parentId=guardian.id;child.generation=guardian.generation+1;child.life=childLife(s.tick);child.bornTick=s.tick;
  child.x=guardian.x;child.y=guardian.y;child.satiety=10;child.energy=95;child.task=null;
  const parentStore=s.rustMaterials.personalStores.find(x=>x.ownerId===guardian.id);parentStore.food=20;
  for(let i=0;i<30&&relationshipOf(s,child.id,guardian.id).trust===0;i++)step(s,1);
  const rel=relationshipOf(s,child.id,guardian.id);
  assert.equal(rel.trust,1);assert.equal(rel.affinity,1);
  assert.equal(rel.evidence.filter(e=>e.kind==='guardian-support').length,1);
});

test('IC6 save/load preserves relationships and old independent 0.6 save gains empty extension',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0],b=s.agents[1];
  assert.equal(recordRelationshipEvidence(s,{fromId:a.id,toId:b.id,kind:'test',key:'test:1',delta:{trust:3}}).ok,true);
  const loaded=restore(serialize(s));
  assert.equal(relationshipOf(loaded,a.id,b.id).trust,3);
  const old=JSON.parse(serialize(s));delete old.social;
  const migrated=restore(JSON.stringify(old));
  assert.equal(migrated.social.version,SOCIAL_VERSION);
  assert.deepEqual(migrated.social.relations,[]);
});

test('IC6 invalid actors are rejected and validator catches duplicate directed pairs',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0],b=s.agents[1];
  assert.deepEqual(recordRelationshipEvidence(s,{fromId:a.id,toId:999999,kind:'x',key:'x',delta:{trust:1}}),{ok:false,reason:'actor'});
  assert.equal(recordRelationshipEvidence(s,{fromId:a.id,toId:b.id,kind:'x',key:'x1',delta:{trust:1}}).ok,true);
  s.social.relations.push(structuredClone(s.social.relations[0]));
  assert.ok(validateSocialState(s,{required:true}).includes('Social relation'));
});

test('IC6 household projection is owner plus evidenced guardian dependents, never nearby strangers',()=>{
  const s=createWorld(230926,{mode:'independent'}),owner=s.agents[0],child=s.agents[1],stranger=s.agents[2];
  completeHome(s,owner);
  child.parentId=owner.id;child.generation=owner.generation+1;child.life=childLife(s.tick);child.bornTick=s.tick;
  child.x=owner.x;child.y=owner.y;stranger.x=owner.x;stranger.y=owner.y;
  const h=householdForOwner(s,owner.id);assert.ok(h);
  assert.deepEqual(h.residentIds,[owner.id,child.id]);
  assert.deepEqual(h.dependentIds,[child.id]);
  assert.equal(h.residentIds.includes(stranger.id),false);
  assert.equal(householdOf(s,child.id).ownerId,owner.id);
  assert.equal(householdOf(s,stranger.id),null);
});
