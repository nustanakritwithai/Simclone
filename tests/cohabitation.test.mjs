import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,serialize,walkable} from '../src/engine.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {personalHomeSite} from '../src/individual-housing.mjs';
import {recordRelationshipEvidence} from '../src/relationships.mjs';
import {cohabitationCandidates,cohabitationCandidate} from '../src/cohabitation.mjs';

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
  return command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'ic6b:'+s.tick+':'+a.id+':'+id});
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
function qualify(s,subject,owner,{trust=4,affinity=2,respect=0,ownerAffinity=2,fear=0,ownerFear=0,key='q'}={}){
  assert.equal(recordRelationshipEvidence(s,{fromId:subject.id,toId:owner.id,kind:'test',key:key+':from',delta:{trust,affinity,respect,fear}}).ok,true);
  assert.equal(recordRelationshipEvidence(s,{fromId:owner.id,toId:subject.id,kind:'test',key:key+':to',delta:{affinity:ownerAffinity,fear:ownerFear}}).ok,true);
}

test('IC6B nearby stranger never qualifies without relationship evidence',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],owner=s.agents[2];
  completeHome(s,owner);subject.x=owner.x;subject.y=owner.y;
  assert.equal(cohabitationCandidate(s,subject),null);
});

test('IC6B evidence thresholds produce one read-only share-home candidate',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],owner=s.agents[2];
  completeHome(s,owner);qualify(s,subject,owner);
  const before=serialize(s),row=cohabitationCandidate(s,subject);
  assert.ok(row);assert.equal(row.subjectId,subject.id);assert.equal(row.ownerId,owner.id);
  assert.match(row.houseId,/^H\d+$/);assert.equal(row.score,12);
  assert.equal(serialize(s),before,'cohabitation planner must be read-only');
});

test('IC6B subject with a complete own home never seeks cohabitation',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],owner=s.agents[2];
  completeHome(s,owner);qualify(s,subject,owner);completeHome(s,subject);
  assert.equal(cohabitationCandidate(s,subject),null);
});

test('IC6B direct adult parent-child does not auto-cohabit',()=>{
  const s=createWorld(230926,{mode:'independent'}),parent=s.agents[0],adultChild=s.agents[1];
  completeHome(s,parent);
  adultChild.parentId=parent.id;adultChild.generation=parent.generation+1;adultChild.bornTick=parent.bornTick;
  qualify(s,adultChild,parent);
  assert.equal(cohabitationCandidate(s,adultChild),null);
});

test('IC6B candidate ordering is deterministic by evidence score then owner id',()=>{
  const s=createWorld(230926,{mode:'independent'}),subject=s.agents[1],a=s.agents[2],b=s.agents[3];
  completeHome(s,a);completeHome(s,b);
  qualify(s,subject,a,{trust:4,affinity:2,respect:0,ownerAffinity:2,key:'a'});
  qualify(s,subject,b,{trust:5,affinity:2,respect:1,ownerAffinity:2,key:'b'});
  const rows=cohabitationCandidates(s,subject);
  assert.deepEqual(rows.map(r=>r.ownerId),[b.id,a.id]);
  assert.ok(rows[0].score>rows[1].score);
});
