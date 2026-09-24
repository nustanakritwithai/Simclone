import test from 'node:test';
import assert from 'node:assert/strict';
import {RUST_CRAFTING_SLICE_VERSION,CRAFT_STATIONS,ITEM_CATALOG,RECIPE_CATALOG,
  validateCraftingCatalog,stationInventoryFromBuildings,craftability,listCraftable} from '../src/crafting-catalog.mjs';

const world=()=>({stock:{food:28,wood:24,stone:12},buildings:[{id:1,type:'camp',complete:true}]});
const bytes=v=>JSON.stringify(v);

test('catalog is a bounded five-item/five-recipe vertical slice',()=>{
  assert.equal(RUST_CRAFTING_SLICE_VERSION,'0.1.0');
  assert.equal(Object.keys(ITEM_CATALOG).length,5);
  assert.equal(Object.keys(RECIPE_CATALOG).length,5);
  assert.deepEqual(validateCraftingCatalog(),[]);
});

test('Rust Island station progression topology is preserved',()=>{
  assert.equal(RECIPE_CATALOG.STONE_AXE.station,CRAFT_STATIONS.HAND);
  assert.equal(RECIPE_CATALOG.STONE_PICKAXE.station,CRAFT_STATIONS.HAND);
  assert.equal(RECIPE_CATALOG.CRAFTING_TABLE_LV1.station,CRAFT_STATIONS.HAND);
  assert.equal(RECIPE_CATALOG.FURNACE.station,CRAFT_STATIONS.HAND);
  assert.equal(RECIPE_CATALOG.HAMMER.station,CRAFT_STATIONS.CRAFTING_TABLE_LV1);
  assert.equal(RECIPE_CATALOG.HAMMER.tier,1);
});

test('runtime materials stay inside current Simclone shared stock vocabulary',()=>{
  for(const recipe of Object.values(RECIPE_CATALOG))
    for(const key of Object.keys(recipe.materials))assert.ok(['wood','stone'].includes(key));
  assert.deepEqual(RECIPE_CATALOG.STONE_AXE.donor.cost,{wood:2,stone:3,rope:1});
  assert.equal(RECIPE_CATALOG.STONE_AXE.materials.wood,4);
});

test('catalog and nested donor metadata are immutable',()=>{
  assert.throws(()=>{RECIPE_CATALOG.STONE_AXE.materials.wood=0;},TypeError);
  assert.throws(()=>{RECIPE_CATALOG.STONE_AXE.donor.cost.rope=0;},TypeError);
});

test('hand recipes are available from baseline stock but hammer is station-gated',()=>{
  const s=world();
  assert.equal(craftability(s,'STONE_AXE').ok,true);
  assert.equal(craftability(s,'STONE_PICKAXE').ok,true);
  assert.equal(craftability(s,'CRAFTING_TABLE_LV1').ok,true);
  assert.equal(craftability(s,'FURNACE').ok,true);
  assert.deepEqual(craftability(s,'HAMMER'),{ok:false,reason:'station',station:'CRAFTING_TABLE_LV1',tier:1});
});

test('complete crafting table unlocks hammer; incomplete table does not',()=>{
  const incomplete=world();incomplete.buildings.push({id:2,type:'crafting_table',tier:1,complete:false});
  assert.equal(stationInventoryFromBuildings(incomplete.buildings).CRAFTING_TABLE_LV1,0);
  assert.equal(craftability(incomplete,'HAMMER').ok,false);
  const complete=world();complete.buildings.push({id:2,type:'crafting_table',tier:1,complete:true});
  assert.equal(craftability(complete,'HAMMER').ok,true);
});

test('missing materials return a deterministic deficit and never mutate state',()=>{
  const s=world();s.stock.wood=1;s.stock.stone=1;const before=bytes(s);
  assert.deepEqual(craftability(s,'STONE_PICKAXE'),{ok:false,reason:'materials',missing:{wood:2,stone:3}});
  assert.equal(bytes(s),before);
});

test('invalid or unknown inputs fail closed',()=>{
  assert.deepEqual(craftability(world(),'BOGUS'),{ok:false,reason:'unknown-recipe'});
  assert.deepEqual(craftability({stock:{wood:-1,stone:12}},'STONE_AXE'),{ok:false,reason:'invalid-stock'});
});

test('craftable listing is stable and pure',()=>{
  const s=world(),before=bytes(s);
  assert.deepEqual(listCraftable(s),['CRAFTING_TABLE_LV1','FURNACE','STONE_AXE','STONE_PICKAXE']);
  assert.equal(bytes(s),before);
});
