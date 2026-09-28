import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,serialize,restore,validate,walkable,step} from '../src/engine.mjs';
import {advanceCraft,validateCraftOrder} from '../src/rust-possessions.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {recipeById} from '../src/crafting-catalog.mjs';
import {knowsCraftRecipe,recipeMastery,validateAllRecipeKnowledge} from '../src/craft-recipe-knowledge.mjs';

function fresh(){const s=createWorld(230926);for(const a of s.agents){Object.assign(resourceStock(s,a),{wood:999,stone:999});a.satiety=100;a.energy=100;}return s;}
function make(s,recipe='STONE_AXE',actorId=1,rate=1){
  const accepted=command(s,'CRAFT_ITEM',{agentId:actorId,recipeId:recipe});assert.equal(accepted.ok,true,JSON.stringify(accepted));
  let result;for(let tick=0;tick<Math.ceil(recipeById(recipe).work/rate);tick++){s.tick++;result=advanceCraft(s,actorId,{workRate:rate});}
  assert.equal(result.completed,true,JSON.stringify(result));return result;
}
function consumeFixtureOutput(s,id){
  // Absence models a later authoritative consumer; it is NOT a production disposal feature.
  s.rustPossessions.items=s.rustPossessions.items.filter(i=>i.id!==id);
}
function table(s){
  const a=s.agents[0],made=make(s,'CRAFTING_TABLE_LV1');
  const cell=[[0,-1],[-1,0],[1,0],[0,1]].map(([dx,dy])=>({x:a.x+dx,y:a.y+dy})).find(p=>walkable(s,p.x,p.y)&&!s.nodes.some(n=>n.x===p.x&&n.y===p.y)&&!s.buildings.some(b=>b.x===p.x&&b.y===p.y));
  assert.ok(cell);const placed=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:made.itemId,...cell});assert.equal(placed.ok,true);Object.assign(a,cell);return placed.stationId;
}
function forgedAdvanced(marked){
  const s=fresh(),stationId=table(s),a=s.agents[0];assert.equal(knowsCraftRecipe(s,a,'STONE_AXE_T1'),false);
  assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'}).ok,true);
  const o=s.rustPossessions.orders[0],r=recipeById('STONE_AXE_T1');Object.assign(o,{recipe:r.id,required:r.work,reserved:{...r.materials},stationId});
  if(!marked)delete o.recipeKnowledge;return s;
}
function rejectedUnchanged(s){
  assert.ok(validate(s).length);assert.throws(()=>restore(serialize(s)));
  s.tick++;const before=serialize(s);assert.equal(advanceCraft(s,1).ok,false);assert.equal(serialize(s),before);
}

test('RC2.1a rejects advanced recipes masquerading as pre-feature legacy orders',()=>rejectedUnchanged(forgedAdvanced(false)));
test('RC2.1a rejects unknown marked orders before restore or progress mutation',()=>rejectedUnchanged(forgedAdvanced(true)));

test('RC2.1a canonical pending work, escrow, station and clock cannot be shortened or forged',()=>{
  for(const mutate of [o=>o.required=1,o=>o.reserved.wood=0,o=>o.reserved.extra=1,o=>o.work=24,o=>o.work=1,o=>o.startedTick=-1,o=>o.lastWorkedTick=1,o=>o.stationId=9,o=>o.recipeKnowledge='UNKNOWN',o=>o.id=0]){
    const s=fresh();command(s,'CRAFT_ITEM',{agentId:1,recipeId:'STONE_AXE'});mutate(s.rustPossessions.orders[0]);rejectedUnchanged(s);
  }
});

test('RC2.1a old legitimate starter orders keep legacy completion and unchanged knowledge',()=>{
  const s=fresh();command(s,'CRAFT_ITEM',{agentId:1,recipeId:'STONE_AXE'});delete s.rustPossessions.orders[0].recipeKnowledge;
  // A genuine pre-outcome order had none of the new snapshot/escrow fields.
  delete s.rustPossessions.orders[0].craftSpec;delete s.rustPossessions.orders[0].reservedItems;
  const loaded=restore(serialize(s));for(let i=0;i<24;i++){loaded.tick++;advanceCraft(loaded,1);}
  assert.equal(loaded.rustPossessions.items.length,1);assert.equal(loaded.agents[0].knowledgeState.recipes,undefined);assert.deepEqual(validate(loaded),[]);
});

test('RC2.1a new receipts bind the actual crafter and block cross-person transplant',()=>{
  const s=fresh();make(s);make(s);const [a,b]=s.agents;
  assert.ok(a.knowledgeState.recipes.entries.find(e=>e.recipeId==='STONE_AXE').receipts.length===2&&a.knowledgeState.recipes.entries.find(e=>e.recipeId==='STONE_AXE').receipts.every(r=>r.crafterId===a.id));
  b.knowledgeState.recipes=structuredClone(a.knowledgeState.recipes);
  assert.equal(knowsCraftRecipe(s,b,'STONE_AXE_T1'),false);assert.throws(()=>restore(serialize(s)));
  const before=serialize(s);assert.equal(command(s,'CRAFT_ITEM',{agentId:b.id,recipeId:'STONE_AXE_T1'}).ok,false);assert.equal(serialize(s),before);
});

test('RC2.1a retained pre-hotfix receipts also reject cross-book duplicate identities',()=>{
  const s=fresh();make(s);make(s);for(const e of s.agents[0].knowledgeState.recipes.entries)for(const r of e.receipts)delete r.crafterId;
  s.agents[1].knowledgeState.recipes=structuredClone(s.agents[0].knowledgeState.recipes);
  assert.ok(validateAllRecipeKnowledge(s).includes('Recipe receipt identity'));assert.throws(()=>restore(serialize(s)));
});

test('RC2.1a surviving outputs must match completion creator, recipe kind and tick',()=>{
  for(const mutate of [i=>i.createdBy=2,i=>i.kind='STONE_PICKAXE',i=>i.createdTick--]){
    const s=fresh(),made=make(s);mutate(s.rustPossessions.items.find(i=>i.id===made.itemId));assert.throws(()=>restore(serialize(s)));
  }
});

test('RC2.1a consumed output absence does not erase a real completion or learned recipe',()=>{
  const s=fresh();consumeFixtureOutput(s,make(s).itemId);consumeFixtureOutput(s,make(s).itemId);
  assert.equal(knowsCraftRecipe(s,s.agents[0],'STONE_AXE_T1'),true);assert.deepEqual(validate(s),[]);assert.equal(serialize(restore(serialize(s))),serialize(s));
});

test('RC2.1a retained unlock source must match exact receipt, count and completion tick',()=>{
  for(const mutate of [l=>l.tick=0,l=>l.tick--,l=>l.sourceOrderId=1,l=>l.sourceCompletions=3]){
    const s=fresh();make(s);make(s);mutate(s.agents[0].knowledgeState.recipes.entries.find(e=>e.recipeId==='STONE_AXE_T1').learned);
    assert.equal(knowsCraftRecipe(s,s.agents[0],'STONE_AXE_T1'),false);assert.throws(()=>restore(serialize(s)));
  }
});

test('RC2.1a impossible retired totals cannot exceed the global order budget',()=>{
  const s=fresh();for(let i=0;i<8;i++)consumeFixtureOutput(s,make(s).itemId);
  const e=s.agents[0].knowledgeState.recipes.entries.find(e=>e.recipeId==='STONE_AXE');e.retiredCompletions=60000;
  assert.equal(s.rustPossessions.nextOrder,9);assert.throws(()=>restore(serialize(s)));assert.equal(knowsCraftRecipe(s,s.agents[0],'STONE_AXE_T1'),false);
});

test('RC2.1a pending IDs cannot reuse completed order identities',()=>{
  const s=fresh();make(s);command(s,'CRAFT_ITEM',{agentId:1,recipeId:'STONE_AXE'});s.rustPossessions.orders[0].id=1;rejectedUnchanged(s);
});

test('RC2.1a more than eight crafts retain a bounded monotonic retirement certificate',()=>{
  const s=fresh();for(let i=0;i<24;i++)consumeFixtureOutput(s,make(s).itemId);
  const a=s.agents[0],e=a.knowledgeState.recipes.entries.find(e=>e.recipeId==='STONE_AXE');
  assert.equal(e.retiredCompletions,16);assert.equal(e.receipts.length,8);assert.equal(e.retiredThrough.orderId,16);assert.equal(e.retiredThrough.crafterId,1);
  assert.equal(recipeMastery(a,'STONE_AXE'),24);assert.equal(knowsCraftRecipe(s,a,'STONE_AXE_T1'),true);assert.deepEqual(validate(s),[]);
  const serialized=serialize(s);assert.equal(serialize(restore(serialized)),serialized);
  for(const mutate of [r=>r.tick=999999,r=>r.orderId=17,r=>r.itemId=999999,r=>r.crafterId=2]){const bad=structuredClone(s);mutate(bad.agents[0].knowledgeState.recipes.entries.find(e=>e.recipeId==='STONE_AXE').retiredThrough);assert.throws(()=>restore(serialize(bad)));}
});

test('RC2.1a valid old compacted books remain byte-identical without invented certificate migration',()=>{
  const s=fresh();for(let i=0;i<12;i++)consumeFixtureOutput(s,make(s).itemId);
  const book=s.agents[0].knowledgeState.recipes;for(const e of book.entries){delete e.retiredThrough;for(const r of e.receipts)delete r.crafterId;}
  const saved=serialize(s),loaded=restore(saved);assert.equal(serialize(loaded),saved);assert.equal(knowsCraftRecipe(loaded,loaded.agents[0],'STONE_AXE_T1'),true);
  consumeFixtureOutput(loaded,make(loaded).itemId);assert.equal(loaded.agents[0].knowledgeState.recipes.entries.find(e=>e.recipeId==='STONE_AXE').retiredThrough.crafterId,1);assert.deepEqual(validate(loaded),[]);
});

test('RC2.1a fraction-rate work and duplicate same-tick advance keep exact restoration',()=>{
  const s=fresh();command(s,'CRAFT_ITEM',{agentId:1,recipeId:'STONE_AXE'});
  for(let i=0;i<8;i++){s.tick++;advanceCraft(s,1,{workRate:.75});const before=serialize(s);assert.equal(advanceCraft(s,1,{workRate:.75}).reason,'already-worked');assert.equal(serialize(s),before);}
  const loaded=restore(serialize(s));for(let i=0;i<24;i++){s.tick++;loaded.tick++;advanceCraft(s,1,{workRate:.75});advanceCraft(loaded,1,{workRate:.75});}
  assert.equal(serialize(loaded),serialize(s));assert.equal(recipeMastery(s.agents[0],'STONE_AXE'),1);assert.deepEqual(validate(s),[]);
});

test('RC2.1a two actual people can craft in parallel without false receipt conflicts',()=>{
  const s=fresh();for(const id of [1,2])assert.equal(command(s,'CRAFT_ITEM',{agentId:id,recipeId:'STONE_AXE'}).ok,true);
  for(let i=0;i<24;i++){s.tick++;advanceCraft(s,1);advanceCraft(s,2);}
  assert.equal(recipeMastery(s.agents[0],'STONE_AXE'),1);assert.equal(recipeMastery(s.agents[1],'STONE_AXE'),1);assert.deepEqual(validate(s),[]);
});

test('RC2.1a same-world autonomous housing/crafting remains valid after 4000 ticks',()=>{
  for(const seed of [230926,42]){const s=createWorld(seed,{mode:'independent',worldProfile:'same-world'});step(s,4000);assert.deepEqual(validate(s),[]);assert.equal(serialize(restore(serialize(s))),serialize(s));assert.ok(s.agents.some(a=>a.knowledgeState.recipes));}
});
