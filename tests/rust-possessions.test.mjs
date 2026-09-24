import test from 'node:test';
import assert from 'node:assert/strict';
import {createRustPossessions,reservedCraftMaterials,queueToolCraft,advanceToolCraft,equipTool,toolMultiplier,releaseRustPossessionsOnDeath,rustPossessionsSnapshot} from '../src/rust-possessions.mjs';

const world=()=>({tick:0,stock:{food:28,wood:40,stone:30},buildings:[{id:1,type:'camp',x:1,y:1,complete:true}],agents:[{id:1,alive:true,x:1,y:1},{id:2,alive:true,x:1,y:1}],rustPossessions:createRustPossessions()});
const work=(s,n,id=1)=>{let r;for(let i=0;i<n;i++){s.tick++;r=advanceToolCraft(s,id);}return r;};

test('Stone Axe hand craft reserves then pays exactly once',()=>{
  const s=world(),q=queueToolCraft(s,{agentId:1,recipeId:'STONE_AXE'});
  assert.equal(q.ok,true);assert.deepEqual(reservedCraftMaterials(s),{wood:4,stone:2});
  assert.equal(s.stock.wood,40);assert.equal(work(s,24).completed,true);
  assert.equal(s.stock.wood,36);assert.equal(s.stock.stone,28);assert.equal(s.rustPossessions.items.length,1);
});
test('Stone Pickaxe gives only MINE multiplier after equip',()=>{
  const s=world();queueToolCraft(s,{agentId:1,recipeId:'STONE_PICKAXE'});const r=work(s,24);
  assert.equal(equipTool(s,1,r.itemId).ok,true);assert.equal(toolMultiplier(s,1,'MINE'),1.25);assert.equal(toolMultiplier(s,1,'WOODCUT'),1);
});
test('Hammer requires completed Crafting Table Lv1',()=>{
  const s=world();assert.equal(queueToolCraft(s,{agentId:1,recipeId:'HAMMER',stationId:2}).reason,'station');
  s.buildings.push({id:2,type:'crafting_table',tier:1,x:1,y:1,complete:true});
  assert.equal(queueToolCraft(s,{agentId:1,recipeId:'HAMMER',stationId:2}).ok,true);
});
test('Hammer confers no BUILD authority bonus',()=>{
  const s=world();s.buildings.push({id:2,type:'crafting_table',tier:1,x:1,y:1,complete:true});
  queueToolCraft(s,{agentId:1,recipeId:'HAMMER',stationId:2});const r=work(s,28);equipTool(s,1,r.itemId);
  assert.equal(toolMultiplier(s,1,'BUILD'),1);
});
test('two orders cannot reserve the same materials',()=>{
  const s=world();s.stock.wood=6;s.stock.stone=4;
  assert.equal(queueToolCraft(s,{agentId:1,recipeId:'STONE_AXE'}).ok,true);
  const r=queueToolCraft(s,{agentId:2,recipeId:'STONE_PICKAXE'});assert.equal(r.reason,'materials');
});
test('same tick cannot advance twice',()=>{
  const s=world();queueToolCraft(s,{agentId:1,recipeId:'STONE_AXE'});s.tick++;
  assert.equal(advanceToolCraft(s,1).ok,true);assert.equal(advanceToolCraft(s,1).reason,'already-worked');
});
test('death drops physical tool and cancels order without refund duplication',()=>{
  const s=world();queueToolCraft(s,{agentId:1,recipeId:'STONE_AXE'});const r=work(s,24);
  queueToolCraft(s,{agentId:1,recipeId:'STONE_PICKAXE'});s.agents[0].alive=false;
  const before={...s.stock},out=releaseRustPossessionsOnDeath(s,1);
  assert.deepEqual(out,{ok:true,dropped:1,cancelled:1});assert.deepEqual(s.stock,before);
  assert.equal(s.rustPossessions.items.find(i=>i.id===r.itemId).location.kind,'drop');
});
test('snapshot is detached from authoritative state',()=>{
  const s=world();queueToolCraft(s,{agentId:1,recipeId:'STONE_AXE'});const snap=rustPossessionsSnapshot(s,1);
  snap.order.work=999;assert.notEqual(s.rustPossessions.orders[0].work,999);
});
