import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {advanceCraft,toolMultiplier} from '../src/rust-possessions.mjs';
import {advanceProcessing} from '../src/rust-materials.mjs';
import {ITEM_CATALOG,RECIPE_CATALOG,validateCraftingCatalog} from '../src/crafting-catalog.mjs';

const finishCraft=(s,id,n)=>{let r;for(let i=0;i<n;i++){s.tick++;r=advanceCraft(s,id);}return r;};
const finishProcess=(s,id,n)=>{let r;for(let i=0;i<n;i++){s.tick++;r=advanceProcessing(s,id);}return r;};
function adjacentFree(s,a){
  for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
    const x=a.x+dx,y=a.y+dy;
    if(walkable(s,x,y)&&!s.nodes.some(n=>n.x===x&&n.y===y)&&!s.buildings.some(b=>b.x===x&&b.y===y)&&!s.rustStations.stations.some(st=>st.x===x&&st.y===y))return {x,y};
  }
  throw new Error('no adjacent station cell');
}

test('RS1 catalog is bounded and keeps station progression',()=>{
  assert.deepEqual(validateCraftingCatalog(),[]);
  assert.equal(Object.keys(ITEM_CATALOG).length,5);
  assert.equal(Object.keys(RECIPE_CATALOG).length,5);
  assert.equal(RECIPE_CATALOG.HAMMER.station,'CRAFTING_TABLE_LV1');
  assert.equal(RECIPE_CATALOG.FURNACE.station,'HAND');
});

test('new worlds own bounded Rust ledgers and validate',()=>{
  const s=createWorld(230926);
  assert.equal(s.rustPossessions.version,'RS2-0.2');
  assert.equal(s.rustStations.version,'RS3-0.2');
  assert.equal(s.rustMaterials.version,'RS4-0.2');
  assert.deepEqual(validate(s),[]);
});

test('same-version saves without Rust extensions migrate to empty ledgers',()=>{
  const s=createWorld(42);delete s.rustPossessions;delete s.rustStations;delete s.rustMaterials;
  const restored=restore(JSON.stringify(s));
  assert.equal(restored.rustPossessions.items.length,0);
  assert.equal(restored.rustStations.stations.length,0);
  assert.equal(restored.rustMaterials.charcoal,0);
  assert.deepEqual(validate(restored),[]);
});

test('CRAFT_ITEM commits materials once, survives save/load, then creates one physical item',()=>{
  let s=createWorld(101);
  const before={wood:s.stock.wood,stone:s.stock.stone};
  const q=command(s,'CRAFT_ITEM',{agentId:1,recipeId:'STONE_AXE'});
  assert.equal(q.ok,true);assert.equal(s.stock.wood,before.wood-4);assert.equal(s.stock.stone,before.stone-2);
  s=restore(serialize(s));assert.equal(s.rustPossessions.orders.length,1);
  const r=finishCraft(s,1,24);assert.equal(r.completed,true);
  assert.equal(s.rustPossessions.orders.length,0);assert.equal(s.rustPossessions.items.length,1);
  assert.equal(s.stock.wood,before.wood-4);assert.equal(s.stock.stone,before.stone-2);
  assert.equal(advanceCraft(s,1).reason,'order');
});

test('engine scheduler autonomously executes an accepted hand-craft order',()=>{
  const s=createWorld(2026);
  assert.equal(command(s,'CRAFT_ITEM',{agentId:1,recipeId:'STONE_AXE'}).ok,true);
  step(s,30);
  assert.equal(s.rustPossessions.orders.some(o=>o.agentId===1),false);
  assert.ok(s.rustPossessions.items.some(i=>i.kind==='STONE_AXE'&&i.location.kind==='bag'&&i.location.agentId===1));
  assert.ok(s.events.some(e=>e.type==='craft'&&e.agentId===1));
});

test('equipped tools expose action-specific multiplier only',()=>{
  const s=createWorld(77);
  command(s,'CRAFT_ITEM',{agentId:1,recipeId:'STONE_PICKAXE'});
  const r=finishCraft(s,1,24);
  assert.equal(command(s,'EQUIP_ITEM',{agentId:1,itemId:r.itemId}).ok,true);
  assert.equal(toolMultiplier(s,1,'MINE'),1.25);
  assert.equal(toolMultiplier(s,1,'WOODCUT'),1);
  assert.equal(toolMultiplier(s,1,'BUILD'),1);
});

test('equipped Stone Axe reduces authoritative WOODCUT completion ticks',()=>{
  const make=equipped=>{
    const s=createWorld(555),a=s.agents[1],n=s.nodes.find(n=>n.type==='wood'&&n.amount>0);
    a.x=n.x;a.y=n.y;a.satiety=100;a.energy=100;
    a.task={kind:'WOODCUT',targetId:n.id,x:n.x,y:n.y,path:[],work:0,score:1,started:s.tick,policy:'survival-0.2'};
    if(equipped){s.rustPossessions.items.push({id:1,kind:'STONE_AXE',createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});s.rustPossessions.nextItem=2;s.rustPossessions.equipment.push({agentId:a.id,itemId:1});}
    let ticks=0,start=a.workDone;while(a.workDone===start&&ticks<30){step(s);ticks++;}
    return ticks;
  };
  const bare=make(false),axe=make(true);
  assert.ok(axe<bare,{bare,axe});
});

test('crafting table is a physical crafted item, placement consumes it, and unlocks Hammer',()=>{
  const s=createWorld(31415),a=s.agents[0];
  const q=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'CRAFTING_TABLE_LV1'});assert.equal(q.ok,true);
  const made=finishCraft(s,a.id,36),cell=adjacentFree(s,a);
  const placed=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:made.itemId,...cell});
  assert.equal(placed.ok,true);assert.equal(s.rustPossessions.items.some(i=>i.id===made.itemId),false);
  assert.equal(s.rustStations.stations[0].kind,'CRAFTING_TABLE_LV1');
  assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'HAMMER',stationId:placed.stationId}).ok,true);
  assert.deepEqual(validate(s),[]);
});

test('furnace process is positional, timed, saveable and Wood 2 -> Charcoal 1 exact once',()=>{
  let s=createWorld(9001),a=s.agents[0];
  const q=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'FURNACE'});assert.equal(q.ok,true);
  const made=finishCraft(s,a.id,40),cell=adjacentFree(s,a);
  const placed=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:made.itemId,...cell});assert.equal(placed.ok,true);
  a.x=cell.x;a.y=cell.y;
  const wood=s.stock.wood,process=command(s,'PROCESS_CHARCOAL',{agentId:a.id,stationId:placed.stationId});
  assert.equal(process.ok,true);assert.equal(s.stock.wood,wood-2);assert.equal(s.rustMaterials.charcoal,0);
  s=restore(serialize(s));a=s.agents.find(x=>x.id===1);
  const done=finishProcess(s,a.id,12);assert.equal(done.completed,true);assert.equal(s.rustMaterials.charcoal,1);
  assert.equal(s.stock.wood,wood-2);assert.equal(advanceProcessing(s,a.id).reason,'order');
});

test('hunger interruption clears only the task contract, not accepted craft order',()=>{
  const s=createWorld(8080),a=s.agents[0];
  command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'});
  step(s,2);assert.equal(s.rustPossessions.orders.length,1);
  a.satiety=1;a.task=null;step(s,1);
  assert.equal(s.rustPossessions.orders.length,1);
  assert.notEqual(a.task?.kind,'CRAFT');
});

test('death drops finished possessions and cancels unfinished order without refund duplication',()=>{
  const s=createWorld(606),a=s.agents[0];
  command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'});const made=finishCraft(s,a.id,24);
  command(s,'EQUIP_ITEM',{agentId:a.id,itemId:made.itemId});
  const before=s.stock.wood;command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_PICKAXE'});const afterCommit=s.stock.wood;
  assert.ok(afterCommit<before);
  a.satiety=0;a.hp=.1;step(s,1);
  assert.equal(a.alive,false);assert.equal(s.rustPossessions.orders.some(o=>o.agentId===a.id),false);
  assert.equal(s.rustPossessions.equipment.some(e=>e.agentId===a.id),false);
  assert.equal(s.rustPossessions.items.find(i=>i.id===made.itemId).location.kind,'drop');
  assert.equal(s.stock.wood,afterCommit);
  assert.deepEqual(validate(s),[]);
});
