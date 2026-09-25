import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {stepProductionPlanning} from '../src/production-planning.mjs';

/** Synthetic reachable colony matching the public failure's inventory conflict.
 * Three complete shelters avoid the separate housing goal. Axe and Hammer
 * deliberately share one owner and one hand slot; no output is pre-completed
 * by the coordinator under test.
 */
function sharedHandFixture(){
  const s=createWorld(230926);
  s.buildings.push({id:s.nextBuilding++,type:'shelter',x:14,y:11,complete:true,progress:30});
  s.stock.wood=100;s.stock.stone=100;
  s.rustPossessions.items=[
    {id:1,kind:'STONE_AXE',createdBy:1,createdTick:0,location:{kind:'bag',agentId:1}},
    {id:2,kind:'STONE_PICKAXE',createdBy:3,createdTick:0,location:{kind:'bag',agentId:3}},
    {id:3,kind:'HAMMER',createdBy:1,createdTick:0,location:{kind:'bag',agentId:1}}
  ];
  s.rustPossessions.nextItem=4;
  s.rustPossessions.equipment=[{agentId:1,itemId:1},{agentId:3,itemId:2}];
  s.rustStations.stations=[{id:1,kind:'CRAFTING_TABLE_LV1',buildingType:'crafting_table',x:12,y:11,complete:true,placedBy:1,placedTick:0}];
  s.rustStations.nextStation=2;
  command(s,'SET_PRODUCTION_POLICY',{enabled:true});
  assert.deepEqual(validate(s),[]);
  return s;
}

const completedChain=s=>['STONE_AXE','STONE_PICKAXE','HAMMER'].every(k=>s.rustPossessions.items.some(i=>i.kind===k))&&
  ['CRAFTING_TABLE_LV1','FURNACE'].every(k=>s.rustStations.stations.some(st=>st.kind===k))&&s.rustMaterials.charcoal>=4;

test('shared Axe/Hammer hand cannot starve the next furnace order',()=>{
  const s=sharedHandFixture();
  for(let i=0;i<24;i++){
    s.tick++;
    stepProductionPlanning(s,walkable,(type,data)=>command(s,type,data));
  }
  assert.equal(s.rustPossessions.orders.length,1);
  assert.equal(s.rustPossessions.orders[0].recipe,'FURNACE');
  assert.equal(s.stock.stone,88,'the furnace commits Stone 12 exactly once');
  assert.equal(s.rustPossessions.orders[0].work,0,'coordinator never executes craft work');
  assert.equal(s.rustPossessions.equipment.find(e=>e.agentId===1).itemId,1,'idle worker keeps the current Axe instead of oscillating');
  assert.deepEqual(validate(s),[]);
});

test('actual BUILD work selects Hammer once without monopolizing coordinator ticks',()=>{
  const s=sharedHandFixture(),a=s.agents[0];
  // This unit fixture exercises the gear selector only, not task execution.
  a.task={kind:'BUILD'};
  s.tick=12;
  stepProductionPlanning(s,walkable,(type,data)=>command(s,type,data));
  assert.equal(s.rustPossessions.equipment.find(e=>e.agentId===1).itemId,3);
  assert.equal(s.rustPossessions.orders[0]?.recipe,'FURNACE','gear selection and the next eligible order can both progress');
  assert.ok(s.productionPlan.history.some(h=>h.goal==='equip-HAMMER'&&h.agentId===1));
});

for(const delay of [0,1,2,5,12,30])test(`public default seed completes the chain after enabling at tick ${delay}`,()=>{
  const s=createWorld(230926);step(s,delay);
  command(s,'SET_PRODUCTION_POLICY',{enabled:true});
  step(s,3200);
  assert.ok(completedChain(s),JSON.stringify({goal:s.productionPlan.goal,items:s.rustPossessions.items,stations:s.rustStations.stations}));
  assert.ok(s.stats.built>=1);
  assert.equal(s.rustStations.stations.filter(st=>st.kind==='FURNACE').length,1);
  assert.deepEqual(validate(s),[]);
});

test('same-schema shared-hand save recovers without reset or duplicate outputs',()=>{
  const continuous=sharedHandFixture();step(continuous,96);
  const resumed=restore(serialize(continuous));
  step(continuous,1600);step(resumed,1600);
  assert.equal(serialize(continuous),serialize(resumed));
  assert.ok(completedChain(resumed));
  assert.equal(resumed.rustPossessions.items.filter(i=>i.kind==='STONE_AXE').length,1);
  assert.equal(resumed.rustPossessions.items.filter(i=>i.kind==='HAMMER').length,1);
  assert.equal(resumed.rustStations.stations.filter(st=>st.kind==='FURNACE').length,1);
  assert.deepEqual(validate(resumed),[]);
});

test('disabled coordinator does not change gear, stock, goals or orders',()=>{
  const s=sharedHandFixture();command(s,'SET_PRODUCTION_POLICY',{enabled:false});
  const before=serialize(s);
  for(let i=0;i<24;i++)stepProductionPlanning(s,walkable,(type,data)=>command(s,type,data));
  assert.equal(serialize(s),before);
});
