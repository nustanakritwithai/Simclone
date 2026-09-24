import test from 'node:test';
import assert from 'node:assert/strict';
import {createRustStations,availableStationKinds,placeStationFromItem,stationRequirementMet,RUST_PROCESSING_CATALOG,processingAvailability,rustStationsSnapshot} from '../src/rust-stations.mjs';
import {createRustPossessions} from '../src/rust-possessions.mjs';

const world=()=>({tick:10,stock:{food:28,wood:40,stone:30},buildings:[{id:1,type:'camp',x:1,y:1,complete:true}],
  agents:[{id:1,alive:true,x:2,y:2}],rustPossessions:createRustPossessions(),rustStations:createRustStations()});
function addBuildItem(s,kind){const id=s.rustPossessions.nextItem++;s.rustPossessions.items.push({id,kind,createdBy:1,createdTick:s.tick,location:{kind:'bag',agentId:1}});return id;}

test('starts with hand crafting only',()=>{assert.deepEqual(availableStationKinds(world()),{HAND:1,CRAFTING_TABLE_LV1:0,FURNACE:0});});
test('placing Crafting Table consumes exactly one physical item',()=>{
  const s=world();addBuildItem(s,'CRAFTING_TABLE_LV1');
  const r=placeStationFromItem(s,{agentId:1,itemId:'CRAFTING_TABLE_LV1',x:2,y:3});
  assert.equal(r.ok,true);assert.equal(s.rustPossessions.items.length,0);assert.equal(s.rustStations.stations.length,1);
  assert.equal(availableStationKinds(s).CRAFTING_TABLE_LV1,1);
});
test('placing Furnace creates furnace station and preserves stable station id',()=>{
  const s=world();addBuildItem(s,'FURNACE');const r=placeStationFromItem(s,{agentId:1,itemId:'FURNACE',x:3,y:2});
  assert.equal(r.stationId,1);assert.equal(r.kind,'FURNACE');assert.equal(s.rustStations.nextStation,2);
});
test('placement rejects occupied and distant positions without consuming item',()=>{
  const s=world();addBuildItem(s,'FURNACE');
  assert.equal(placeStationFromItem(s,{agentId:1,itemId:'FURNACE',x:1,y:1}).reason,'occupied');
  assert.equal(placeStationFromItem(s,{agentId:1,itemId:'FURNACE',x:8,y:8}).reason,'range');
  assert.equal(s.rustPossessions.items.length,1);
});
test('Hammer station requirement resolves placed crafting table',()=>{
  const s=world();addBuildItem(s,'CRAFTING_TABLE_LV1');placeStationFromItem(s,{agentId:1,itemId:'CRAFTING_TABLE_LV1',x:2,y:3});
  const r=stationRequirementMet(s,'HAMMER',1);assert.equal(r.ok,true);assert.equal(r.stationId,1);
});
test('processing catalog preserves Rust furnace progression but remains non-authoritative',()=>{
  assert.equal(RUST_PROCESSING_CATALOG.CHARCOAL.station,'FURNACE');assert.equal(RUST_PROCESSING_CATALOG.CHARCOAL.live,false);
  const s=world();addBuildItem(s,'FURNACE');placeStationFromItem(s,{agentId:1,itemId:'FURNACE',x:3,y:2});
  const r=processingAvailability(s,'CHARCOAL',1);assert.equal(r.reason,'not-authoritative');assert.equal(r.stationId,1);
});
test('station snapshot is detached',()=>{
  const s=world();addBuildItem(s,'FURNACE');placeStationFromItem(s,{agentId:1,itemId:'FURNACE',x:3,y:2});
  const snap=rustStationsSnapshot(s);snap.stations[0].x=99;assert.notEqual(s.rustStations.stations[0].x,99);
});
