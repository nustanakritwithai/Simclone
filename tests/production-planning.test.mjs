import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate} from '../src/engine.mjs';
import {PRODUCTION_POLICY,PRODUCTION_RULES} from '../src/production-planning.mjs';

const itemKinds=s=>new Set(s.rustPossessions.items.map(i=>i.kind));
const stationKinds=s=>new Set(s.rustStations.stations.map(st=>st.kind));

test('new worlds start visible autonomy, while explicit disable remains deterministic',()=>{
  const a=createWorld(230926),b=createWorld(230926);
  assert.equal(a.productionPlan.enabled,true);
  assert.equal(b.productionPlan.enabled,true);
  command(a,'SET_PRODUCTION_POLICY',{enabled:false});
  command(b,'SET_PRODUCTION_POLICY',{enabled:false});
  step(a,240);step(b,240);
  assert.equal(serialize(a),serialize(b));
  assert.equal(a.rustPossessions.orders.length,0);
  assert.equal(a.rustStations.stations.length,0);
  assert.equal(a.buildings.length,2);
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


test('RP1 visibly grows the settlement from a fresh world',()=>{
  const s=createWorld(230926);
  assert.equal(s.productionPlan.enabled,true);
  const before={buildings:s.buildings.length,wood:s.stock.wood,stone:s.stock.stone};
  step(s,1);
  assert.equal(s.buildings.length,before.buildings+1);
  const house=s.buildings.at(-1);
  assert.equal(house.type,'shelter');assert.equal(house.complete,false);
  assert.equal(s.stock.wood,before.wood-PRODUCTION_RULES.houseWood);
  assert.equal(s.stock.stone,before.stone-PRODUCTION_RULES.houseStone);
  assert.equal(s.productionPlan.goal.goal,'build-shelter');
  step(s,1000);
  assert.equal(house.complete,true);
  assert.ok(s.stats.built>=1);
  assert.deepEqual(validate(s),[]);
});

test('RP1 house placement is deterministic and does not duplicate the initial plan',()=>{
  const make=()=>{const s=createWorld(99);step(s,1);return s;};
  const a=make(),b=make();
  assert.deepEqual(a.buildings,b.buildings);
  assert.equal(a.buildings.length,3);
  const count=a.buildings.length;step(a,20);assert.equal(a.buildings.length,count);
  assert.equal(a.buildings.filter(x=>!x.complete).length,1);
});


test('untouched RP1-0.1 saves migrate into visible autonomy but explicit old disable is preserved',()=>{
  const untouched=createWorld(123);
  untouched.productionPlan={version:'RP1-0.1',enabled:false,goal:null,lastAttemptTick:-1,history:[]};
  const migrated=restore(JSON.stringify(untouched));
  assert.equal(migrated.productionPlan.version,'RP1-0.2');
  assert.equal(migrated.productionPlan.enabled,true);

  const disabled=createWorld(124);
  disabled.productionPlan={version:'RP1-0.1',enabled:false,goal:{goal:'policy',outcome:'disabled',agentId:null,tick:0},lastAttemptTick:-1,history:[]};
  const preserved=restore(JSON.stringify(disabled));
  assert.equal(preserved.productionPlan.version,'RP1-0.2');
  assert.equal(preserved.productionPlan.enabled,false);
});
