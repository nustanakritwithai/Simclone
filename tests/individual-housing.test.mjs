import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,walkable,validate,SIZE} from '../src/engine.mjs';
import {individualHouses,homeOf,isHomeless,personalHomeSite,nextPersonalHomePiece} from '../src/individual-housing.mjs';

function farWalkablePair(s){
  const cells=[];
  for(let y=0;y<SIZE.h;y++)for(let x=0;x<SIZE.w;x++)if(walkable(s,x,y))cells.push({x,y});
  let best=[cells[0],cells.at(-1)],distance=-1;
  for(const a of cells)for(const b of cells){const d=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);if(d>distance){distance=d;best=[a,b];}}
  return best;
}
function equipHammer(s,a){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind:'HAMMER',createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>e.agentId!==a.id);
  s.rustPossessions.equipment.push({agentId:a.id,itemId:id});
}
function giveFoundation(s,a){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind:'WOOD_FOUNDATION',createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
}
function placeFoundation(s,a,site){
  const id=giveFoundation(s,a);
  return command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket:{type:'cell',...site.origin},placementId:'ic1:'+s.tick+':'+a.id+':'+id});
}

test('IC1: fresh Clones are individually homeless before they own a complete modular home',()=>{
  const s=createWorld(230926);
  assert.equal(homeOf(s,s.agents[0].id),null);
  assert.equal(isHomeless(s,s.agents[0].id),true);
  assert.deepEqual(individualHouses(s),[]);
});

test('IC1: personal home-site selection originates from the Clone, not Camp',()=>{
  const s=createWorld(230926),a=s.agents[0],[origin]=farWalkablePair(s);
  a.x=origin.x;a.y=origin.y;
  const site=personalHomeSite(s,a,walkable);
  assert.ok(site);
  assert.ok(Math.abs(site.origin.x-a.x)<=8&&Math.abs(site.origin.y-a.y)<=8);
  const camp=s.buildings.find(b=>b.type==='camp');
  assert.notDeepEqual(site.origin,{x:camp.x,y:camp.y});
  assert.deepEqual(nextPersonalHomePiece(s,a,walkable),{pieceKind:'WOOD_FOUNDATION',socket:{type:'cell',x:site.origin.x,y:site.origin.y,level:0}});
});

test('IC1: two Clones can found distinct houses with distinct evidence-derived owners',()=>{
  const s=createWorld(230926),a=s.agents[0],b=s.agents[1],[pa,pb]=farWalkablePair(s);
  a.x=pa.x;a.y=pa.y;b.x=pb.x;b.y=pb.y;a.task=null;b.task=null;
  equipHammer(s,a);equipHammer(s,b);
  const sa=personalHomeSite(s,a,walkable),sb=personalHomeSite(s,b,walkable);
  assert.ok(sa&&sb);
  assert.notDeepEqual(sa.origin,sb.origin);
  const ra=placeFoundation(s,a,sa),rb=placeFoundation(s,b,sb);
  assert.equal(ra.ok,true);assert.equal(rb.ok,true);
  const homes=individualHouses(s).sort((x,y)=>x.ownerId-y.ownerId);
  assert.equal(homes.length,2);
  assert.deepEqual(homes.map(h=>h.ownerId),[a.id,b.id]);
  assert.equal(homeOf(s,a.id).ownerId,a.id);
  assert.equal(homeOf(s,b.id).ownerId,b.id);
  assert.notEqual(homeOf(s,a.id).houseId,homeOf(s,b.id).houseId);
  assert.deepEqual(validate(s),[]);
});

test('IC1: ownership stays with founding foundation even when another Clone later assists',()=>{
  const s=createWorld(230926),owner=s.agents[0],helper=s.agents[1],[pa]=farWalkablePair(s);
  owner.x=pa.x;owner.y=pa.y;helper.x=pa.x;helper.y=pa.y;owner.task=null;helper.task=null;
  equipHammer(s,owner);equipHammer(s,helper);
  const site=personalHomeSite(s,owner,walkable),foundation=placeFoundation(s,owner,site);
  assert.equal(foundation.ok,true);
  const h=homeOf(s,owner.id);
  assert.ok(h);assert.equal(h.ownerId,owner.id);
  assert.equal(homeOf(s,helper.id),null);
});
