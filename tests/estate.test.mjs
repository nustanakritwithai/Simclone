import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,walkable} from '../src/engine.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {personalHomeSite,homeOf} from '../src/individual-housing.mjs';
import {materialStock} from '../src/individual-resources.mjs';
import {recordRelationshipEvidence} from '../src/relationships.mjs';
import {estateSnapshot,heirCandidates} from '../src/estate.mjs';

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
function qualify(s,subject,owner){
  assert.equal(recordRelationshipEvidence(s,{fromId:subject.id,toId:owner.id,kind:'fixture',key:'estate:'+subject.id+':'+owner.id+':from',delta:{trust:4,affinity:2}}).ok,true);
  assert.equal(recordRelationshipEvidence(s,{fromId:owner.id,toId:subject.id,kind:'fixture',key:'estate:'+subject.id+':'+owner.id+':to',delta:{affinity:2}}).ok,true);
}

function buildEstateWorld(){
  const s=createWorld(230926,{mode:'independent',population:4});
  const owner=s.agents[0],child=s.agents[1],grandchild=s.agents[2],unrelated=s.agents[3];
  child.parentId=owner.id;child.generation=owner.generation+1;child.bornTick=owner.bornTick+1;
  grandchild.parentId=child.id;grandchild.generation=child.generation+1;grandchild.bornTick=child.bornTick+1;
  unrelated.parentId=null;unrelated.generation=0;unrelated.bornTick=0;
  const home=completeHome(s,owner);
  const store=materialStock(s,owner);store.food=7;store.wood=9;store.stone=5;store.charcoal=2;
  const axe=give(s,owner,'STONE_AXE');
  qualify(s,unrelated,owner);
  assert.equal(command(s,'JOIN_HOUSEHOLD',{agentId:unrelated.id,ownerId:owner.id}).ok,true);
  owner.satiety=0;owner.hp=.1;owner.task=null;
  step(s,1);
  assert.equal(owner.alive,false);
  return {s,owner,child,grandchild,unrelated,home,axe};
}

test('IC7A estate snapshot preserves raw material attribution and construction provenance',()=>{
  const {s,owner,home,axe}=buildEstateWorld();
  const estate=estateSnapshot(s,owner.id);assert.ok(estate);
  assert.deepEqual(
    Object.fromEntries(['food','wood','stone','charcoal'].map(k=>[k,estate.personalMaterials[k]])),
    {food:7,wood:9,stone:5,charcoal:2}
  );
  assert.equal(estate.houses.length,1);
  assert.equal(estate.houses[0].houseId,home.houseId);
  assert.equal(estate.houses[0].constructionOwnerId,owner.id);
  assert.ok(estate.droppedItemIds.includes(axe));
  assert.equal(homeOf(s,owner.id,{completeOnly:true}).ownerId,owner.id);
});

test('IC7A heir candidates rank direct child before grandchild and exclude unrelated cohabitant',()=>{
  const {s,owner,child,grandchild,unrelated}=buildEstateWorld();
  const rows=heirCandidates(s,owner.id);
  assert.deepEqual(rows.map(r=>[r.agentId,r.lineageDistance]),[[child.id,1],[grandchild.id,2]]);
  assert.equal(rows.some(r=>r.agentId===unrelated.id),false);
});

test('IC7A estate projection is byte-read-only',()=>{
  const {s,owner}=buildEstateWorld();
  const before=serialize(s),estate=estateSnapshot(s,owner.id);
  assert.ok(estate);assert.equal(serialize(s),before);
});

test('IC7A unknown or living person has no dead-estate snapshot',()=>{
  const s=createWorld(230926,{mode:'independent'});
  assert.equal(estateSnapshot(s,s.agents[0].id),null);
  assert.equal(estateSnapshot(s,999999),null);
  assert.deepEqual(heirCandidates(s,s.agents[0].id),[]);
});

test('IC7A save/load recomputes the same estate facts',()=>{
  const {s,owner}=buildEstateWorld();
  const before=estateSnapshot(s,owner.id),loaded=restore(serialize(s)),after=estateSnapshot(loaded,owner.id);
  assert.deepEqual(after,before);
});
