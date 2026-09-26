import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,walkable} from '../src/engine.mjs';
import {stepProductionPlanning} from '../src/production-planning.mjs';
import {homeOf,pendingPersonalPlacements} from '../src/individual-housing.mjs';

function give(s,a,kind){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
}
function equip(s,a,itemId){
  s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>e.agentId!==a.id);
  s.rustPossessions.equipment.push({agentId:a.id,itemId});
}
function installFullPolicyFixture(s){
  const [a,b]=s.agents;
  s.stock.wood=999;s.stock.stone=999;s.rustMaterials.charcoal=4;
  s.rustStations.stations.push(
    {id:900,kind:'CRAFTING_TABLE_LV1',buildingType:'crafting_table',x:1,y:1,complete:true,placedBy:a.id,placedTick:0,structurePiece:false},
    {id:901,kind:'FURNACE',buildingType:'furnace',x:2,y:1,complete:true,placedBy:a.id,placedTick:0,structurePiece:false}
  );
  s.rustStations.nextStation=Math.max(s.rustStations.nextStation,902);
  give(s,b,'STONE_AXE');give(s,b,'STONE_PICKAXE');
  command(s,'SET_PRODUCTION_POLICY',{enabled:true});
  s.productionPlan.lastAttemptTick=-1;s.tick=12;
  return {a,b};
}

test('IC2 coordinator: another Clone having the only Hammer does not satisfy the founders personal Hammer need',()=>{
  const s=createWorld(230926),{a,b}=installFullPolicyFixture(s);
  give(s,b,'HAMMER');
  const r=stepProductionPlanning(s,walkable);
  assert.equal(r?.ok,true);
  const order=s.rustPossessions.orders[0];
  assert.ok(order);
  assert.equal(order.agentId,a.id);
  assert.equal(order.recipe,'HAMMER');
  assert.equal(s.productionPlan.goal.agentId,a.id);
  assert.equal(s.productionPlan.goal.goal,'personal-home-hammer');
});

test('IC2 coordinator: equipped personal Hammer queues the next house piece for that same Clone',()=>{
  const s=createWorld(230926),{a}=installFullPolicyFixture(s);
  const hammer=give(s,a,'HAMMER');equip(s,a,hammer);
  const r=stepProductionPlanning(s,walkable);
  assert.equal(r?.ok,true);
  const order=s.rustPossessions.orders[0];
  assert.ok(order);
  assert.equal(order.agentId,a.id);
  assert.equal(order.recipe,'WOOD_FOUNDATION');
  assert.equal(s.productionPlan.goal.goal,'personal-home-craft-WOOD_FOUNDATION');
});

test('IC2 placement projection uses only the owners carried next piece',()=>{
  const s=createWorld(230926),a=s.agents[0],b=s.agents[1];
  const hammer=give(s,a,'HAMMER');equip(s,a,hammer);
  const otherPiece=give(s,b,'WOOD_FOUNDATION');
  assert.deepEqual(pendingPersonalPlacements(s,a,walkable),[],'another bag never satisfies this owner');
  const ownPiece=give(s,a,'WOOD_FOUNDATION');
  const rows=pendingPersonalPlacements(s,a,walkable);
  assert.equal(rows.length,1);
  assert.equal(rows[0].itemInstanceId,ownPiece);
  assert.equal(rows[0].ownerId,a.id);
  assert.notEqual(rows[0].itemInstanceId,otherPiece);
});

test('IC2 engine: full RP1 BUILD task places the founding Foundation for the same personal owner',()=>{
  const s=createWorld(230926),{a}=installFullPolicyFixture(s);
  const hammer=give(s,a,'HAMMER');equip(s,a,hammer);
  const foundation=give(s,a,'WOOD_FOUNDATION');
  a.preference='BUILD';a.satiety=100;a.energy=100;a.task=null;
  let founded=null;
  for(let i=0;i<80&&!founded;i++){
    step(s,1);
    founded=homeOf(s,a.id);
  }
  assert.ok(founded,'personal foundation should be placed through engine BUILD execution');
  assert.equal(founded.ownerId,a.id);
  assert.equal(founded.originStationId!==null,true);
  const station=s.rustStations.stations.find(st=>st.id===founded.originStationId);
  assert.equal(station.placedBy,a.id);
  assert.equal(station.sourceItemId,foundation);
});
