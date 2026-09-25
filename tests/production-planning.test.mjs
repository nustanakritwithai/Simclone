import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate} from '../src/engine.mjs';
import {PRODUCTION_POLICY,PRODUCTION_RULES} from '../src/production-planning.mjs';

const itemKinds=s=>new Set(s.rustPossessions.items.map(i=>i.kind));
const stationKinds=s=>new Set(s.rustStations.stations.map(st=>st.kind));

test('RP1 is explicit opt-in and disabled baseline remains deterministic',()=>{
  const a=createWorld(230926),b=createWorld(230926);
  assert.equal(a.productionPlan.enabled,false);
  step(a,240);step(b,240);
  assert.equal(serialize(a),serialize(b));
  assert.equal(a.rustPossessions.orders.length,0);
  assert.equal(a.rustStations.stations.length,0);
});

test('SET_PRODUCTION_POLICY is engine-mediated and persisted',()=>{
  let s=createWorld(42),r=command(s,'SET_PRODUCTION_POLICY',{enabled:true});
  assert.equal(r.ok,true);assert.equal(s.productionPlan.enabled,true);
  s=restore(serialize(s));assert.equal(s.productionPlan.enabled,true);
  assert.equal(s.productionPlan.version,'RP1-0.2');
});

test('RP1 autonomously completes tools, physical stations and charcoal target',()=>{
  const s=createWorld(2026);
  command(s,'SET_PRODUCTION_POLICY',{enabled:true});
  step(s,3200);
  const items=itemKinds(s),stations=stationKinds(s);
  assert.ok(items.has('STONE_AXE'));
  assert.ok(items.has('STONE_PICKAXE'));
  assert.ok(items.has('HAMMER'));
  assert.ok(stations.has('CRAFTING_TABLE_LV1'));
  assert.ok(stations.has('FURNACE'));
  assert.ok(s.rustMaterials.charcoal>=PRODUCTION_RULES.charcoalTarget);
  assert.equal(s.rustPossessions.orders.length,0);
  assert.equal(s.rustMaterials.orders.length,0);
  assert.equal(s.productionPlan.goal.goal,'stable');
  assert.deepEqual(validate(s),[]);
});

test('RP1 save/load mid-chain resumes without duplicate station or recipe outputs',()=>{
  let s=createWorld(9191);
  command(s,'SET_PRODUCTION_POLICY',{enabled:true});
  step(s,80);
  const before={history:s.productionPlan.history.length,table:s.rustStations.stations.filter(x=>x.kind==='CRAFTING_TABLE_LV1').length};
  s=restore(serialize(s));
  step(s,3200);
  assert.equal(s.rustStations.stations.filter(x=>x.kind==='CRAFTING_TABLE_LV1').length,1);
  assert.equal(s.rustStations.stations.filter(x=>x.kind==='FURNACE').length,1);
  assert.equal(s.rustPossessions.items.filter(x=>x.kind==='STONE_AXE').length,1);
  assert.equal(s.rustPossessions.items.filter(x=>x.kind==='STONE_PICKAXE').length,1);
  assert.equal(s.rustPossessions.items.filter(x=>x.kind==='HAMMER').length,1);
  assert.ok(s.productionPlan.history.length>=Math.min(before.history,PRODUCTION_RULES.history));
  assert.deepEqual(validate(s),[]);
});

test('older valid 0.5.0 save gains disabled RP1 extension without inventing work',()=>{
  const s=createWorld(7);delete s.productionPlan;
  const loaded=restore(JSON.stringify(s));
  assert.equal(loaded.productionPlan.enabled,false);
  assert.equal(loaded.productionPlan.history.length,0);
  assert.equal(loaded.rustPossessions.orders.length,0);
});


test('RP1 visibly grows the settlement when housing is nearly full',()=>{
  const s=createWorld(230926);
  command(s,'SET_PRODUCTION_POLICY',{enabled:true});
  // Initial capacity is 12 for six people. Fill the colony to the bounded
  // trigger without manual BUILD; RP1 must place one real unfinished shelter.
  while(s.agents.filter(a=>a.alive).length<10){
    const parent=s.agents.find(a=>a.alive);
    const r=command(s,'CLONE',{parentId:parent.id});
    assert.equal(r.ok,true);
  }
  // Restore enough construction materials after clone costs.
  s.stock.wood=Math.max(s.stock.wood,60);s.stock.stone=Math.max(s.stock.stone,30);
  const before=s.buildings.length;
  step(s,1);
  assert.equal(s.buildings.length,before+1);
  const house=s.buildings.at(-1);
  assert.equal(house.type,'shelter');assert.equal(house.complete,false);
  assert.equal(s.productionPlan.goal.goal,'build-shelter');
  step(s,600);
  assert.equal(house.complete,true);
  assert.ok(s.stats.built>=1);
  assert.deepEqual(validate(s),[]);
});

test('RP1 house placement is deterministic and does not duplicate an unfinished plan',()=>{
  const make=()=>{
    const s=createWorld(99);command(s,'SET_PRODUCTION_POLICY',{enabled:true});
    while(s.agents.filter(a=>a.alive).length<10){const r=command(s,'CLONE',{parentId:s.agents[0].id});assert.equal(r.ok,true);}
    s.stock.wood=60;s.stock.stone=30;step(s,1);return s;
  };
  const a=make(),b=make();
  assert.deepEqual(a.buildings,b.buildings);
  const count=a.buildings.length;step(a,20);assert.equal(a.buildings.length,count);
  assert.equal(a.buildings.filter(x=>!x.complete).length,1);
});
