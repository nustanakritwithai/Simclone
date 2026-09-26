import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {personalHomeSite,homeOf} from '../src/individual-housing.mjs';
import {
  materialStock,resourceStock,resourceAccount,householdStore
} from '../src/individual-resources.mjs';
import {recordRelationshipEvidence} from '../src/relationships.mjs';
import {leadershipProfile,LEADERSHIP_SKILL,canAcceptFollower} from '../src/leadership.mjs';
import {householdEconomySnapshot} from '../src/kingdom-household-economy.mjs';
import {advanceCraft} from '../src/rust-possessions.mjs';

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
  const data={agentId:a.id,itemInstanceId:id,placementId:'kh:'+s.tick+':'+a.id+':'+id};
  if(socket?.type)data.socket=socket;else Object.assign(data,socket);
  return command(s,'PLACE_STATION',data);
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
function adjacentFree(s,a){
  for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
    const x=a.x+dx,y=a.y+dy;
    if(walkable(s,x,y)&&!s.nodes.some(n=>n.x===x&&n.y===y)&&!s.rustStations.stations.some(st=>st.x===x&&st.y===y))return {x,y};
  }
  throw new Error('no adjacent free cell');
}

test('Kingdom adaptation: fresh Clone has Leadership skill with provenance but it is not an action preference',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[0];
  assert.equal(a.skills[LEADERSHIP_SKILL],0);
  assert.ok(a.skillProvenance.bySkill[LEADERSHIP_SKILL]);
  assert.notEqual(a.preference,LEADERSHIP_SKILL);
  assert.deepEqual(validate(s),[]);
});

test('IC6C completing a home atomically moves founder raw balance into one household store',()=>{
  const s=createWorld(230926,{mode:'independent'}),owner=s.agents[2];
  const before={...materialStock(s,owner)},home=completeHome(s,owner);
  const store=householdStore(s,home.houseId);assert.ok(store);
  for(const k of ['food','wood','stone','charcoal']){
    assert.equal(store[k],before[k]??0);
    assert.equal(materialStock(s,owner)[k],0);
  }
  assert.strictEqual(resourceStock(s,owner),store);
  assert.equal(resourceAccount(s,owner).houseId,home.houseId);
  assert.deepEqual(validate(s),[]);
});

test('IC6C JOIN merges temporary raw resources into household while physical ownership stays personal',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],owner=s.agents[2];
  const home=completeHome(s,owner);qualify(s,subject,owner,'merge');
  const personalBefore={...materialStock(s,subject)},pool=resourceStock(s,owner),poolBefore={...pool};
  const personalItem=give(s,subject,'STONE_AXE');
  const r=command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:owner.id});
  assert.equal(r.ok,true);
  assert.strictEqual(resourceStock(s,subject),resourceStock(s,owner));
  for(const k of ['food','wood','stone','charcoal']){
    assert.equal(materialStock(s,subject)[k],0);
    assert.equal(pool[k],(poolBefore[k]??0)+(personalBefore[k]??0));
  }
  assert.deepEqual(s.rustPossessions.items.find(i=>i.id===personalItem).location,{kind:'bag',agentId:subject.id});
  assert.equal(resourceAccount(s,subject).houseId,home.houseId);
  assert.deepEqual(validate(s),[]);
});

test('IC6C LEAVE returns to an empty temporary store and never splits household resources',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],owner=s.agents[2];
  completeHome(s,owner);qualify(s,subject,owner,'leave');
  assert.equal(command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:owner.id}).ok,true);
  const pool=resourceStock(s,owner),before={...pool};
  assert.equal(command(s,'LEAVE_HOUSEHOLD',{agentId:subject.id}).ok,true);
  assert.equal(resourceAccount(s,subject).kind,'personal');
  assert.deepEqual(materialStock(s,subject),{ownerId:subject.id,food:0,wood:0,stone:0,charcoal:0});
  assert.deepEqual({...resourceStock(s,owner)},before);
});

test('Kingdom leadership: first unique follower awards provenance-backed XP and rejoin cannot farm XP',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],owner=s.agents[2];
  completeHome(s,owner);qualify(s,subject,owner,'lead');
  const before=leadershipProfile(s,owner.id);assert.equal(before.level,0);assert.equal(before.followerCapacity,1);
  const first=command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:owner.id});assert.equal(first.ok,true);
  assert.equal(owner.skills.LEADERSHIP,10);
  assert.equal(leadershipProfile(s,owner.id).followerCapacity,2);
  assert.equal(command(s,'LEAVE_HOUSEHOLD',{agentId:subject.id}).ok,true);
  assert.equal(command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:owner.id}).ok,true);
  assert.equal(owner.skills.LEADERSHIP,10,'same follower does not award Leadership twice');
  const bucket=owner.skillProvenance.bySkill.LEADERSHIP;
  assert.equal(bucket.earnedXP,10);
  assert.equal(bucket.evidence.filter(e=>e.action==='FOLLOWER_JOIN').length,1);
});

test('Kingdom leadership capacity independently blocks a follower when current followers fill available slots',()=>{
  const s=createWorld(230926,{mode:'independent'}),owner=s.agents[2],follower=s.agents[1];
  completeHome(s,owner);
  // Valid low-leadership state with one already-active follower: no second slot exists.
  s.social.residences.push({
    agentId:follower.id,ownerId:owner.id,houseId:homeOf(s,owner.id,{completeOnly:true}).houseId,
    joinedTick:s.tick,leftTick:null,joinReason:'relationship-evidence',leaveReason:null,
    evidence:{subjectToOwner:[],ownerToSubject:[]}
  });
  const gate=canAcceptFollower(s,owner.id);
  assert.equal(gate.ok,false);assert.equal(gate.profile.followerCapacity,1);assert.equal(gate.profile.activeFollowers,1);
});

test('IC6C household resident can craft at host station while spending shared household pool',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],owner=s.agents[2];
  completeHome(s,owner);
  const cell=adjacentFree(s,owner),tableItem=give(s,owner,'CRAFTING_TABLE_LV1');
  const placed=command(s,'PLACE_STATION',{agentId:owner.id,itemInstanceId:tableItem,...cell});assert.equal(placed.ok,true);
  qualify(s,subject,owner,'craft');
  assert.equal(command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:owner.id}).ok,true);
  const pool=resourceStock(s,owner);pool.wood=30;pool.stone=10;
  const before=pool.wood;
  const q=command(s,'CRAFT_ITEM',{agentId:subject.id,recipeId:'HAMMER',stationId:placed.stationId});
  assert.equal(q.ok,true);assert.ok(pool.wood<before);
  subject.x=cell.x;subject.y=cell.y;
  let done=null;for(let i=0;i<35&&!done?.completed;i++){s.tick++;done=advanceCraft(s,subject.id);}
  assert.equal(done.completed,true);
  assert.ok(s.rustPossessions.items.some(i=>i.kind==='HAMMER'&&i.location?.kind==='bag'&&i.location.agentId===subject.id));
});

test('Kingdom K2-K6 household economy shadow reads one home instead of world settlement stock',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],owner=s.agents[2];
  const home=completeHome(s,owner);qualify(s,subject,owner,'econ');
  assert.equal(command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:owner.id}).ok,true);
  const pool=resourceStock(s,owner);pool.food=12;pool.wood=4;pool.stone=2;
  const before=serialize(s),snap=householdEconomySnapshot(s,owner.id);
  assert.equal(snap.houseId,home.houseId);
  assert.deepEqual(snap.memberIds.sort((a,b)=>a-b),[subject.id,owner.id].sort((a,b)=>a-b));
  assert.equal(snap.economy.population,2);
  assert.ok(snap.economy.scarcity.wood>=1);
  assert.ok(snap.production.roles);
  assert.ok(Array.isArray(snap.labor.offers));
  assert.ok(snap.market.prices.food>0);
  assert.equal(serialize(s),before,'Kingdom household economy is read-only');
});

test('IC6C old independent save migrates owner and resident balances into one household store without duplication',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],owner=s.agents[2];
  const home=completeHome(s,owner);qualify(s,subject,owner,'migrate');
  assert.equal(command(s,'JOIN_HOUSEHOLD',{agentId:subject.id,ownerId:owner.id}).ok,true);
  // Reconstruct old IC6 layout: raw balances live per person; household store extension absent.
  const old=JSON.parse(serialize(s)),store=old.rustMaterials.householdStores.find(b=>b.houseId===home.houseId);
  const ownerPersonal=old.rustMaterials.personalStores.find(b=>b.ownerId===owner.id);
  const subjectPersonal=old.rustMaterials.personalStores.find(b=>b.ownerId===subject.id);
  Object.assign(ownerPersonal,{food:store.food,wood:store.wood,stone:store.stone,charcoal:store.charcoal});
  Object.assign(subjectPersonal,{food:3,wood:2,stone:1,charcoal:0});
  delete old.rustMaterials.householdVersion;delete old.rustMaterials.householdStores;
  delete old.agents.find(a=>a.id===owner.id).skills.LEADERSHIP;
  delete old.agents.find(a=>a.id===owner.id).skillProvenance.bySkill.LEADERSHIP;
  const expected={food:ownerPersonal.food+subjectPersonal.food,wood:ownerPersonal.wood+subjectPersonal.wood,stone:ownerPersonal.stone+subjectPersonal.stone,charcoal:ownerPersonal.charcoal+subjectPersonal.charcoal};
  const migrated=restore(JSON.stringify(old)),m=householdStore(migrated,home.houseId);
  assert.deepEqual(Object.fromEntries(['food','wood','stone','charcoal'].map(k=>[k,m[k]])),expected);
  assert.equal(materialStock(migrated,owner.id).food,0);
  assert.equal(materialStock(migrated,subject.id).food,0);
  assert.equal(migrated.agents.find(a=>a.id===owner.id).skills.LEADERSHIP,0);
  assert.deepEqual(validate(migrated),[]);
});
