import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize} from '../src/engine.mjs';
import {createNeighborhoodShadow,neighborhoodOfOwner,NEIGHBORHOOD_RULES} from '../src/neighborhood-shadow.mjs';
import {recordRelationshipEvidence} from '../src/relationships.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';

function completedHouse(state,id,ownerId,x,y){
  const houseId='H'+id;
  state.rustStations.stations.push(
    {id,kind:'WOOD_FOUNDATION',x,y,placedBy:ownerId,socket:{type:'cell',x,y,level:0}},
    {id:id+1,kind:'WOOD_WALL',x,y,socket:canonicalEdge(x,y,'N')},
    {id:id+2,kind:'WOOD_WALL',x,y,socket:canonicalEdge(x,y,'E')},
    {id:id+3,kind:'WOOD_WALL',x,y,socket:canonicalEdge(x,y,'S')},
    {id:id+4,kind:'WOOD_DOORWAY',x,y,socket:canonicalEdge(x,y,'W')},
    {id:id+5,kind:'WOOD_ROOF',x,y,socket:{type:'cell',x,y,level:2}}
  );
  state.rustMaterials.householdStores.push({houseId,ownerId,food:0,wood:0,stone:0,charcoal:0});
  return houseId;
}

test('MX4 neighborhood projection is deterministic, read-only and adds no save fields',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'large',population:2}),before=serialize(s);
  const a=createNeighborhoodShadow(s),b=createNeighborhoodShadow(s);
  assert.deepEqual(a,b);assert.equal(serialize(s),before);
  assert.equal(a.authority.mode,'shadow-only');
  assert.equal(a.authority.settlementWriter,false);
  assert.equal(a.authority.householdWriter,false);
  assert.equal(a.authority.saveFields,0);
});

test('two nearby completed household homes form one spatial neighborhood',()=>{
  const s=createWorld(42,{mode:'independent',worldProfile:'large',population:2});
  const [a,b]=s.agents;a.x=5;a.y=5;b.x=8;b.y=5;
  completedHouse(s,1001,a.id,5,5);completedHouse(s,1101,b.id,8,5);
  const p=createNeighborhoodShadow(s);
  assert.equal(p.summary.completedHouseholds,2);
  assert.equal(p.summary.neighborhoods,1);
  assert.equal(p.neighborhoods[0].households,2);
  assert.deepEqual(p.neighborhoods[0].ownerIds,[a.id,b.id]);
  assert.equal(p.neighborhoods[0].spatialLinks,1);
});

test('distant homes remain isolated and do not invent a settlement',()=>{
  const s=createWorld(77,{mode:'independent',worldProfile:'large',population:2});
  const [a,b]=s.agents;
  completedHouse(s,2001,a.id,3,3);completedHouse(s,2101,b.id,50,45);
  const p=createNeighborhoodShadow(s);
  assert.equal(p.neighborhoods.length,0);
  assert.deepEqual(p.isolatedHouseholdOwnerIds,[a.id,b.id]);
});

test('relationship evidence changes social cohesion but not spatial membership',()=>{
  const s=createWorld(9,{mode:'independent',worldProfile:'large',population:2});
  const [a,b]=s.agents;
  completedHouse(s,3001,a.id,6,6);completedHouse(s,3101,b.id,9,6);
  const before=createNeighborhoodShadow(s);
  assert.equal(before.neighborhoods[0].socialLinks,0);
  recordRelationshipEvidence(s,{fromId:a.id,toId:b.id,kind:'cooperation',key:'mx4:a-b',delta:{trust:3,affinity:2}});
  const after=createNeighborhoodShadow(s);
  assert.deepEqual(after.neighborhoods[0].ownerIds,before.neighborhoods[0].ownerIds);
  assert.equal(after.neighborhoods[0].socialLinks,1);
  assert.ok(after.neighborhoods[0].relationshipEvidence.evidenceCount>0);
});

test('neighborhood components are transitive through nearby homes',()=>{
  const s=createWorld(5150,{mode:'independent',worldProfile:'large',population:3});
  const [a,b,c]=s.agents;
  completedHouse(s,4001,a.id,4,4);
  completedHouse(s,4101,b.id,4+NEIGHBORHOOD_RULES.linkDistance,4);
  completedHouse(s,4201,c.id,4+NEIGHBORHOOD_RULES.linkDistance*2,4);
  const p=createNeighborhoodShadow(s);
  assert.equal(p.neighborhoods.length,1);
  assert.deepEqual(p.neighborhoods[0].ownerIds,[a.id,b.id,c.id]);
  assert.equal(p.neighborhoods[0].households,3);
  assert.equal(neighborhoodOfOwner(p,b.id)?.id,p.neighborhoods[0].id);
});

test('projection ignores unfinished/no-home agents rather than inventing households',()=>{
  const s=createWorld(2026,{mode:'independent',worldProfile:'large',population:3});
  const p=createNeighborhoodShadow(s);
  assert.equal(p.summary.completedHouseholds,0);
  assert.equal(p.summary.neighborhoods,0);
  assert.equal(p.homes.length,0);
});
