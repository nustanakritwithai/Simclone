import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {houseSite,nextHousePiece,evaluateModularHouses} from '../src/housing.mjs';
import {PRODUCTION_POLICY,PRODUCTION_RULES} from '../src/production-planning.mjs';

const itemKinds=s=>new Set(s.rustPossessions.items.map(i=>i.kind));
const stationKinds=s=>new Set(s.rustStations.stations.map(st=>st.kind));

test('RP1 remains opt-in and disabled baseline stays deterministic',()=>{
  const a=createWorld(230926),b=createWorld(230926);
  assert.equal(a.productionPlan.enabled,false);
  step(a,240);step(b,240);
  assert.equal(serialize(a),serialize(b));
  assert.equal(a.rustPossessions.orders.length,0);
  assert.equal(a.rustStations.stations.length,0);
  assert.equal(a.buildings.length,1);
  assert.equal(a.buildings.some(x=>x.type==='shelter'),false);
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

test('population pressure builds a modular house even while full RP1 remains disabled',()=>{
  const s=createWorld(230926);
  assert.equal(s.productionPlan.enabled,false);
  s.stock.food=999;s.stock.wood=999;
  assert.equal(command(s,'CLONE',{parentId:1}).ok,true);
  assert.equal(s.agents.filter(a=>a.alive).length,7);
  step(s,3200);
  assert.ok(evaluateModularHouses(s).houses.some(h=>h.complete),'expected autonomous modular house');
  assert.equal(s.rustStations.stations.some(st=>st.kind==='FURNACE'),false,'housing-only autonomy must not start furnace chain');
  assert.equal(s.productionPlan.enabled,false,'housing pressure must not silently enable full RP1');
  assert.deepEqual(validate(s),[]);
});

test('restored seven-person legacy-Shelter world retires Shelter and continues with modular housing',()=>{
  const old=createWorld(2026);old.stock.food=999;old.stock.wood=999;
  assert.equal(command(old,'CLONE',{parentId:1}).ok,true);
  old.buildings.push({id:2,type:'shelter',x:8,y:9,complete:true,progress:30});
  let s=restore(JSON.stringify(old));
  assert.equal(s.buildings.some(b=>b.type==='shelter'),false);
  assert.equal(s.productionPlan.enabled,false);
  step(s,3200);
  assert.ok(evaluateModularHouses(s).houses.some(h=>h.complete));
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


test('RP1 never dispatches a shelter: enabling autonomy adds no building and spends no stone',()=>{
  const s=createWorld(230926);
  assert.equal(command(s,'SET_PRODUCTION_POLICY',{enabled:true}).ok,true);
  const before={buildings:s.buildings.length,stone:s.stock.stone};
  step(s,1);
  assert.equal(s.buildings.length,before.buildings);
  assert.equal(s.stock.stone,before.stone);
  assert.ok(!s.productionPlan.history.some(h=>h.goal==='build-shelter'));
  assert.deepEqual(validate(s),[]);
});

test('modular house site is deterministic, passes the shared validator and keeps clear of other homes',()=>{
  const a=createWorld(99),b=createWorld(99);
  const sa=houseSite(a,walkable),sb=houseSite(b,walkable);
  assert.deepEqual(sa,sb);assert.equal(sa.footprint,'1x1');
  assert.ok(a.buildings.every(x=>Math.abs(x.x-sa.origin.x)+Math.abs(x.y-sa.origin.y)>=2));
  assert.deepEqual(nextHousePiece(a,sa),{pieceKind:'WOOD_FOUNDATION',socket:{type:'cell',...sa.origin,level:0}});
});

test('RP1-0.1 saves migrate schema without silently changing enable choice',()=>{
  const old=createWorld(123);
  old.productionPlan={version:'RP1-0.1',enabled:false,goal:null,lastAttemptTick:-1,history:[]};
  const migrated=restore(JSON.stringify(old));
  assert.equal(migrated.productionPlan.version,'RP1-0.2');
  assert.equal(migrated.productionPlan.enabled,false);
});
