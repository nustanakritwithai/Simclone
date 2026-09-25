import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,serialize,walkable,SIZE} from '../src/engine.mjs';
import {childLife} from '../src/lifecycle.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {personalHomeSite} from '../src/individual-housing.mjs';
import {personalHomeIntent} from '../src/individual-home-planning.mjs';

function farWalkablePair(s){
  const cells=[];
  for(let y=0;y<SIZE.h;y++)for(let x=0;x<SIZE.w;x++)if(walkable(s,x,y))cells.push({x,y});
  let best=[cells[0],cells.at(-1)],distance=-1;
  for(const a of cells)for(const b of cells){
    const d=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
    if(d>distance){distance=d;best=[a,b];}
  }
  return best;
}
function give(s,a,kind){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
}
function equipHammer(s,a){
  const id=give(s,a,'HAMMER');
  s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>e.agentId!==a.id);
  s.rustPossessions.equipment.push({agentId:a.id,itemId:id});
  return id;
}
function place(s,a,kind,socket){
  const id=give(s,a,kind);
  return command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'ic2:'+s.tick+':'+a.id+':'+id});
}
function completeOwnedHouse(s,a){
  const site=personalHomeSite(s,a,walkable);
  assert.ok(site);
  a.x=site.origin.x;a.y=site.origin.y;a.task=null;
  if(!(s.rustPossessions.equipment??[]).some(e=>e.agentId===a.id))equipHammer(s,a);
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
  return site;
}

test('IC2 planner: homeless productive adult without Hammer needs Hammer',()=>{
  const s=createWorld(230926),a=s.agents[0];
  const before=serialize(s),intent=personalHomeIntent(s,a,walkable);
  assert.equal(intent.kind,'NEED_HAMMER');
  assert.equal(intent.agentId,a.id);
  assert.equal(intent.station,'CRAFTING_TABLE_LV1');
  assert.equal(serialize(s),before,'planner is read-only');
});

test('IC2 planner: personal Hammer in bag but not equipped yields EQUIP_HAMMER',()=>{
  const s=createWorld(230926),a=s.agents[0],hammer=give(s,a,'HAMMER');
  const intent=personalHomeIntent(s,a,walkable);
  assert.equal(intent.kind,'EQUIP_HAMMER');
  assert.equal(intent.itemId,hammer);
});

test('IC2 planner: equipped Hammer and enough materials yields CRAFT_PIECE',()=>{
  const s=createWorld(230926),a=s.agents[0];equipHammer(s,a);
  const intent=personalHomeIntent(s,a,walkable);
  assert.equal(intent.kind,'CRAFT_PIECE');
  assert.equal(intent.pieceKind,'WOOD_FOUNDATION');
  assert.equal(intent.recipeId,'WOOD_FOUNDATION');
  assert.deepEqual(intent.materials,{wood:8});
});

test('IC2 planner: own carried piece yields PLACE_PIECE',()=>{
  const s=createWorld(230926),a=s.agents[0];equipHammer(s,a);
  const foundation=give(s,a,'WOOD_FOUNDATION');
  const intent=personalHomeIntent(s,a,walkable);
  assert.equal(intent.kind,'PLACE_PIECE');
  assert.equal(intent.itemInstanceId,foundation);
  assert.equal(intent.pieceKind,'WOOD_FOUNDATION');
});

test('IC2 planner: another Clone bag never satisfies this persons place intent',()=>{
  const s=createWorld(230926),a=s.agents[0],other=s.agents[1];equipHammer(s,a);
  give(s,other,'WOOD_FOUNDATION');
  const intent=personalHomeIntent(s,a,walkable);
  assert.equal(intent.kind,'CRAFT_PIECE');
  assert.equal(intent.agentId,a.id);
});

test('IC2 planner: insufficient current shared stock yields NEED_MATERIALS without spending',()=>{
  const s=createWorld(230926),a=s.agents[0];equipHammer(s,a);s.stock.wood=0;
  const before=serialize(s),intent=personalHomeIntent(s,a,walkable);
  assert.equal(intent.kind,'NEED_MATERIALS');
  assert.equal(intent.missing.wood,8);
  assert.equal(serialize(s),before);
});

test('IC2 planner: complete personally founded house yields HOME_COMPLETE',()=>{
  const s=createWorld(230926),a=s.agents[0];completeOwnedHouse(s,a);
  const intent=personalHomeIntent(s,a,walkable);
  assert.equal(intent.kind,'HOME_COMPLETE');
  assert.equal(intent.agentId,a.id);
  assert.match(intent.houseId,/^H\d+$/);
});

test('IC2 planner: two productive adults resolve independent personal sites',()=>{
  const s=createWorld(230926),a=s.agents[0],b=s.agents[1],[pa,pb]=farWalkablePair(s);
  a.x=pa.x;a.y=pa.y;b.x=pb.x;b.y=pb.y;a.task=null;b.task=null;
  const ia=personalHomeIntent(s,a,walkable),ib=personalHomeIntent(s,b,walkable);
  assert.equal(ia.kind,'NEED_HAMMER');assert.equal(ib.kind,'NEED_HAMMER');
  assert.notDeepEqual(ia.site,ib.site);
});

test('IC2 planner: child is stage-ineligible for independent home execution',()=>{
  const s=createWorld(230926),a=s.agents[0];a.life=childLife(s.tick);
  const intent=personalHomeIntent(s,a,walkable);
  assert.equal(intent.kind,'INELIGIBLE');
});
