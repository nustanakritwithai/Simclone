import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {personalHomeSite,homeOf} from '../src/individual-housing.mjs';
import {personalHomeIntent} from '../src/individual-home-planning.mjs';
import {materialStock} from '../src/individual-resources.mjs';
import {
  relationshipOf,recordRelationshipEvidence,householdOf,
  activeResidenceOf,SOCIAL_VERSION
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
  return command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'ic6b-live:'+s.tick+':'+a.id+':'+id});
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
function qualify(s,subject,owner){
  assert.equal(recordRelationshipEvidence(s,{fromId:subject.id,toId:owner.id,kind:'test',key:'join:'+subject.id+':'+owner.id+':from',delta:{trust:4,affinity:2}}).ok,true);
  assert.equal(recordRelationshipEvidence(s,{fromId:owner.id,toId:subject.id,kind:'test',key:'join:'+subject.id+':'+owner.id+':to',delta:{affinity:2}}).ok,true);
}

test('IC6B JOIN_HOUSEHOLD adds explicit residency without transferring home ownership',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],owner=s.agents[2];
  const home=completeHome(s,owner);qualify(s,subject,owner);
  const beforeSubject={...materialStock(s,subject)},beforeOwner={...materialStock(s,owner)};
  const r=command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:owner.id});
  assert.equal(r.ok,true);assert.equal(r.changed,true);assert.equal(r.houseId,home.houseId);
  assert.equal(homeOf(s,subject.id,{completeOnly:true}),null);
  assert.equal(homeOf(s,owner.id,{completeOnly:true}).ownerId,owner.id);
  assert.equal(activeResidenceOf(s,subject.id).ownerId,owner.id);
  assert.deepEqual(householdOf(s,subject.id).cohabitantIds,[subject.id]);
  assert.deepEqual({...materialStock(s,subject)},beforeSubject);
  assert.deepEqual({...materialStock(s,owner)},beforeOwner);
  assert.deepEqual(validate(s),[]);
});

test('IC6B JOIN_HOUSEHOLD is idempotent and blocks switching without explicit leave',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],a=s.agents[2],b=s.agents[3];
  completeHome(s,a);completeHome(s,b);qualify(s,subject,a);qualify(s,subject,b);
  const first=command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:a.id});
  assert.equal(first.ok,true);assert.equal(first.changed,true);
  const again=command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:a.id});
  assert.equal(again.ok,true);assert.equal(again.changed,false);
  const switchTry=command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:b.id});
  assert.equal(switchTry.ok,false);assert.equal(switchTry.reason,'resident-busy');
});

test('IC6B cohabitant REST targets shared home while personal resources stay personal',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],owner=s.agents[2];
  const home=completeHome(s,owner);qualify(s,subject,owner);
  assert.equal(command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:owner.id}).ok,true);
  subject.x=home.origin.x;subject.y=home.origin.y;subject.energy=1;subject.satiety=100;subject.task=null;
  step(s,1);
  assert.equal(subject.task?.kind,'REST');
  assert.equal(subject.task?.x,home.origin.x);
  assert.equal(subject.task?.y,home.origin.y);
});

test('IC6B cohabitant EAT uses own food at shared home, not owners food',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],owner=s.agents[2];
  const home=completeHome(s,owner);qualify(s,subject,owner);
  assert.equal(command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:owner.id}).ok,true);
  subject.x=home.origin.x;subject.y=home.origin.y;subject.energy=100;subject.satiety=10;subject.task=null;
  const mine=materialStock(s,subject),theirs=materialStock(s,owner);mine.food=10;theirs.food=11;
  const myBefore=mine.food,theirBefore=theirs.food;
  let sawEat=false;
  for(let i=0;i<40&&mine.food===myBefore;i++){
    step(s,1);
    if(subject.task?.kind==='EAT')sawEat=true;
  }
  assert.equal(sawEat,true,'cohabitant should enter EAT task at shared home');
  assert.equal(mine.food,myBefore-1,'completed EAT consumes the cohabitant own food');
  assert.equal(theirs.food,theirBefore,'owner food remains untouched');
});

test('IC6B cohabitation pauses own-home goal and leaving resumes it',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],owner=s.agents[2];
  completeHome(s,owner);qualify(s,subject,owner);
  assert.equal(command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:owner.id}).ok,true);
  const joined=personalHomeIntent(s,subject,walkable);
  assert.equal(joined.kind,'COHABITING');assert.equal(joined.ownerId,owner.id);
  assert.equal(command(s,'LEAVE_HOUSEHOLD',{agentId:subject.id}).ok,true);
  const left=personalHomeIntent(s,subject,walkable);
  assert.notEqual(left.kind,'COHABITING');
  assert.notEqual(left.kind,'HOME_COMPLETE');
});

test('IC6B LEAVE_HOUSEHOLD ends residency without changing relationship or ownership',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],owner=s.agents[2];
  completeHome(s,owner);qualify(s,subject,owner);
  assert.equal(command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:owner.id}).ok,true);
  const relBefore=relationshipOf(s,subject.id,owner.id);
  const r=command(s,'LEAVE_HOUSEHOLD',{agentId:subject.id});
  assert.equal(r.ok,true);assert.equal(r.changed,true);
  assert.equal(activeResidenceOf(s,subject.id),null);
  assert.equal(householdOf(s,subject.id),null);
  assert.equal(homeOf(s,owner.id,{completeOnly:true}).ownerId,owner.id);
  assert.deepEqual(relationshipOf(s,subject.id,owner.id),relBefore);
});

test('IC6B owner death closes hosted residences deterministically',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],owner=s.agents[2];
  completeHome(s,owner);qualify(s,subject,owner);
  assert.equal(command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:owner.id}).ok,true);
  owner.satiety=0;owner.hp=.1;owner.task=null;
  step(s,1);
  assert.equal(owner.alive,false);
  assert.equal(activeResidenceOf(s,subject.id),null);
  const row=s.social.residences.find(r=>r.agentId===subject.id);
  assert.equal(row.leaveReason,'owner-death');
  assert.deepEqual(validate(s),[]);
});

test('IC6B save/load preserves active residence and migrates IC6-social-1 to v2',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],owner=s.agents[2];
  completeHome(s,owner);qualify(s,subject,owner);
  assert.equal(command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:owner.id}).ok,true);
  const loaded=restore(serialize(s));
  assert.equal(activeResidenceOf(loaded,subject.id).ownerId,owner.id);
  assert.equal(loaded.social.version,SOCIAL_VERSION);

  const old=JSON.parse(serialize(s));
  old.social.version='IC6-social-1';delete old.social.residences;
  const migrated=restore(JSON.stringify(old));
  assert.equal(migrated.social.version,SOCIAL_VERSION);
  assert.deepEqual(migrated.social.residences,[]);
});
