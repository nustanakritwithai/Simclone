import test from 'node:test';
import assert from 'node:assert/strict';
import {createRustPossessions,queueToolCraft} from '../src/rust-possessions.mjs';
import {createRustStations} from '../src/rust-stations.mjs';
import {createRustMaterials,reservedProcessingMaterials,queueProcessing,advanceProcessing,rustMaterialsSnapshot} from '../src/rust-materials.mjs';

const world=()=>({tick:0,stock:{food:28,wood:20,stone:20},agents:[{id:1,alive:true,x:2,y:2},{id:2,alive:true,x:2,y:2}],
  buildings:[{id:1,type:'camp',x:1,y:1,complete:true}],rustPossessions:createRustPossessions(),
  rustStations:{...createRustStations(),stations:[{id:1,kind:'FURNACE',buildingType:'furnace',x:2,y:2,complete:true,placedBy:1,placedTick:0}],nextStation:2},
  rustMaterials:createRustMaterials()});
const work=(s,n,id=1)=>{let r;for(let i=0;i<n;i++){s.tick++;r=advanceProcessing(s,id);}return r;};

test('charcoal is first authoritative furnace process',()=>{
  const s=world(),q=queueProcessing(s,{agentId:1,processId:'CHARCOAL',stationId:1});
  assert.equal(q.ok,true);assert.deepEqual(q.input,{wood:2});assert.equal(s.stock.wood,20);
});
test('processing reserves wood before payment',()=>{
  const s=world();queueProcessing(s,{agentId:1,processId:'CHARCOAL',stationId:1});
  assert.deepEqual(reservedProcessingMaterials(s),{wood:2,stone:0});assert.equal(s.rustMaterials.charcoal,0);
});
test('charcoal pays wood exactly once on completion',()=>{
  const s=world();queueProcessing(s,{agentId:1,processId:'CHARCOAL',stationId:1});
  const r=work(s,12);assert.equal(r.completed,true);assert.equal(s.stock.wood,18);assert.equal(s.rustMaterials.charcoal,1);
  const before=JSON.stringify(s);assert.equal(advanceProcessing(s,1).reason,'order');assert.equal(JSON.stringify(s),before);
});
test('meat and water processing remain blocked',()=>{
  const s=world();
  assert.equal(queueProcessing(s,{agentId:1,processId:'COOKED_MEAT',stationId:1}).reason,'not-authoritative');
  assert.equal(queueProcessing(s,{agentId:1,processId:'CLEAN_WATER',stationId:1}).reason,'not-authoritative');
});
test('worker must stand at furnace',()=>{
  const s=world();queueProcessing(s,{agentId:1,processId:'CHARCOAL',stationId:1});s.agents[0].x=3;s.tick++;
  assert.equal(advanceProcessing(s,1).reason,'not-at-station');
});
test('same tick cannot process twice',()=>{
  const s=world();queueProcessing(s,{agentId:1,processId:'CHARCOAL',stationId:1});s.tick++;
  assert.equal(advanceProcessing(s,1).ok,true);assert.equal(advanceProcessing(s,1).reason,'already-worked');
});
test('processing reservation blocks tool overcommit',()=>{
  const s=world();s.stock.wood=5;s.stock.stone=4;
  queueProcessing(s,{agentId:1,processId:'CHARCOAL',stationId:1});
  const q=queueToolCraft(s,{agentId:2,recipeId:'STONE_AXE'});
  assert.equal(q.reason,'materials');
});
test('snapshot is detached',()=>{
  const s=world();queueProcessing(s,{agentId:1,processId:'CHARCOAL',stationId:1});
  const snap=rustMaterialsSnapshot(s);snap.orders[0].work=99;assert.notEqual(s.rustMaterials.orders[0].work,99);
});

test('tool reservation also blocks furnace overcommit',()=>{
  const s=world();s.stock.wood=5;s.stock.stone=4;
  assert.equal(queueToolCraft(s,{agentId:1,recipeId:'STONE_AXE'}).ok,true);
  const q=queueProcessing(s,{agentId:2,processId:'CHARCOAL',stationId:1});
  assert.equal(q.reason,'materials');
});
