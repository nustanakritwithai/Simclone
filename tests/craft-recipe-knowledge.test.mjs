import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {advanceCraft} from '../src/rust-possessions.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {CRAFT_RECIPE_CATALOG,RECIPE_CATALOG,STARTER_RECIPE_IDS,recipeById,validateCraftingCatalog} from '../src/crafting-catalog.mjs';
import {knowsCraftRecipe,recipeKnowledgeSnapshot,recipeMastery,validateRecipeKnowledge,RECIPE_KNOWLEDGE_LIMITS,RECIPE_KNOWLEDGE_VERSION} from '../src/craft-recipe-knowledge.mjs';

const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(seed=230926,independent=false){
  const s=createWorld(seed,independent?{mode:'independent',population:2}:{});
  for(const a of s.agents){Object.assign(resourceStock(s,a),{wood:300,stone:300});a.satiety=100;a.energy=100;}
  return s;
}
function make(s,a,id='STONE_AXE'){
  const result=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:id});assert.equal(result.ok,true,JSON.stringify(result));
  let done;
  for(let i=0;i<recipeById(id).work;i++){s.tick++;done=advanceCraft(s,a.id);}
  assert.equal(done.completed,true,JSON.stringify(done));return done;
}
function learn(s,a){make(s,a);make(s,a);assert.equal(knowsCraftRecipe(s,a,'STONE_AXE_T1'),true);}
function table(s,a){
  const made=make(s,a,'CRAFTING_TABLE_LV1');
  const cell=[[0,-1],[-1,0],[1,0],[0,1]].map(([dx,dy])=>({x:a.x+dx,y:a.y+dy})).find(p=>walkable(s,p.x,p.y)&&
    !s.nodes.some(n=>n.x===p.x&&n.y===p.y)&&!s.buildings.some(b=>b.x===p.x&&b.y===p.y));
  assert.ok(cell);const placed=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:made.itemId,...cell});
  assert.equal(placed.ok,true,JSON.stringify(placed));a.x=cell.x;a.y=cell.y;return placed.stationId;
}

test('RC2 recipe catalog keeps the released nine-recipe view and bounded tier chains',()=>{
  assert.deepEqual(validateCraftingCatalog(),[]);
  assert.equal(Object.keys(RECIPE_CATALOG).length,9);
  assert.equal(Object.keys(CRAFT_RECIPE_CATALOG).length,38);
  assert.ok(Object.values(CRAFT_RECIPE_CATALOG).every(r=>r.tier>=0&&r.tier<=5));
  assert.equal(recipeById('constructor'),null);assert.equal(recipeById('__proto__'),null);
  for(const kind of ['STONE_AXE','STONE_PICKAXE','HAMMER'])assert.equal(recipeById(kind+'_T5').tier,5);
});

test('RC2 read-only knowledge uses only the nine starter permissions for old and fresh worlds',()=>{
  const s=fresh(),a=s.agents[0],before=serialize(s),snap=recipeKnowledgeSnapshot(s,a);
  assert.equal(a.knowledgeState.recipes,undefined);
  assert.deepEqual(snap.filter(x=>x.known).map(x=>x.recipeId),STARTER_RECIPE_IDS);
  assert.equal(knowsCraftRecipe(s,a,'STONE_AXE_T1'),false);
  assert.ok(Object.isFrozen(snap)&&snap.every(Object.isFrozen));
  assert.equal(serialize(s),before);assert.equal(serialize(restore(before)),before);
});

test('RC2 unknown personal recipe is denied before station/material/counter mutation',()=>{
  const s=fresh(),a=s.agents[0],before=serialize(s);
  const r=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE_T1'});
  assert.equal(r.reason,'recipe-unknown');assert.equal(serialize(s),before);
});

test('RC2 two verified crafts teach one person an advanced recipe without global knowledge leakage',()=>{
  const s=fresh(),[a,b]=s.agents;
  make(s,a);assert.equal(recipeMastery(a,'STONE_AXE'),1);assert.equal(knowsCraftRecipe(s,a,'STONE_AXE_T1'),false);
  const done=make(s,a);assert.equal(recipeMastery(a,'STONE_AXE'),2);
  assert.deepEqual(done.unlockedRecipes,['STONE_AXE_T1','EMBER_BLADE']);
  assert.equal(knowsCraftRecipe(s,a,'STONE_AXE_T1'),true);assert.equal(knowsCraftRecipe(s,b,'STONE_AXE_T1'),false);
  assert.equal(a.knowledgeState.recipes.entries.find(e=>e.recipeId==='STONE_AXE_T1').learned.method,'mastery');
  assert.deepEqual(validate(s),[]);
});

test('RC2 station requirement survives recipe learning; the owner really creates the output',()=>{
  const s=fresh(),a=s.agents[0];learn(s,a);
  let before=serialize(s);assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE_T1'}).reason,'station');assert.equal(serialize(s),before);
  table(s,a);const done=make(s,a,'STONE_AXE_T1'),item=s.rustPossessions.items.find(x=>x.id===done.itemId);
  assert.equal(item.createdBy,a.id);assert.equal(item.kind,'STONE_AXE');assert.equal(recipeMastery(a,'STONE_AXE_T1'),1);
  assert.deepEqual(validate(s),[]);
});

test('RC2 acceptance and unfinished work never grant mastery or recipe permission',()=>{
  const s=fresh(),a=s.agents[0];command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'});
  assert.equal(recipeMastery(a,'STONE_AXE'),0);assert.equal(a.knowledgeState.recipes,undefined);
  for(let i=0;i<23;i++){s.tick++;advanceCraft(s,a.id);}
  assert.equal(recipeMastery(a,'STONE_AXE'),0);assert.equal(knowsCraftRecipe(s,a,'STONE_AXE_T1'),false);
});

test('RC2 completion is one item and one mastery receipt; replay cannot award again',()=>{
  const s=fresh(),a=s.agents[0];make(s,a);
  const before=serialize(s);assert.equal(advanceCraft(s,a.id).reason,'order');assert.equal(serialize(s),before);
  assert.equal(recipeMastery(a,'STONE_AXE'),1);assert.equal(s.rustPossessions.items.length,1);
});

test('RC2 pending craft and mastery continue byte-identically through save/load',()=>{
  const s=fresh(),a=s.agents[0];make(s,a);command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'});
  for(let i=0;i<11;i++){s.tick++;advanceCraft(s,a.id);}
  const copy=restore(serialize(s));
  for(let i=0;i<13;i++){s.tick++;copy.tick++;advanceCraft(s,a.id);advanceCraft(copy,a.id);}
  assert.equal(serialize(copy),serialize(s));assert.equal(knowsCraftRecipe(copy,copy.agents[0],'STONE_AXE_T1'),true);
});

test('RC2 pre-feature in-flight order completes without inventing retrospective mastery',()=>{
  const s=fresh(),a=s.agents[0];command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'});
  delete s.rustPossessions.orders[0].recipeKnowledge;
  delete s.rustPossessions.orders[0].craftSpec;delete s.rustPossessions.orders[0].reservedItems;
  const loaded=restore(serialize(s));for(let i=0;i<24;i++){loaded.tick++;advanceCraft(loaded,a.id);}
  assert.equal(loaded.agents[0].knowledgeState.recipes,undefined);assert.equal(loaded.rustPossessions.items.length,1);
  assert.deepEqual(validate(loaded),[]);
});

test('RC2 nearby real teacher transfers only known recipe; replay is read-only',()=>{
  const s=fresh(),[a,b]=s.agents;learn(s,a);b.x=a.x+1;b.y=a.y;
  const resourceBefore=clone(b.knowledgeState),stockBefore=clone(s.stock),rng=s.rng;
  const taught=command(s,'TEACH_CRAFT_RECIPE',{teacherId:a.id,studentId:b.id,recipeId:'STONE_AXE_T1'});
  assert.equal(taught.changed,true);assert.equal(knowsCraftRecipe(s,b,'STONE_AXE_T1'),true);
  for(const key of ['evidence','beliefs','episodes'])assert.deepEqual(b.knowledgeState[key],resourceBefore[key]);
  assert.deepEqual(s.stock,stockBefore);assert.equal(s.rng,rng);assert.equal(recipeMastery(b,'STONE_AXE_T1'),0);
  const before=serialize(s),again=command(s,'TEACH_CRAFT_RECIPE',{teacherId:a.id,studentId:b.id,recipeId:'STONE_AXE_T1'});
  assert.equal(again.changed,false);assert.equal(serialize(s),before);assert.deepEqual(validate(s),[]);
});

test('RC2 teaching rejects unknown recipe, distance, child, death and self atomically',()=>{
  for(const mode of ['unknown','distance','child','dead','self']){
    const s=fresh(),[a,b]=s.agents;learn(s,a);b.x=a.x+1;b.y=a.y;
    let recipeId='STONE_AXE_T1',studentId=b.id;
    if(mode==='unknown')recipeId='STONE_AXE_T2';
    if(mode==='distance')b.x=a.x+10;
    if(mode==='child')b.life={anchorTick:s.tick,ageAtAnchorYears:8};
    if(mode==='dead')b.alive=false;
    if(mode==='self')studentId=a.id;
    const before=serialize(s),r=command(s,'TEACH_CRAFT_RECIPE',{teacherId:a.id,studentId,recipeId});
    assert.equal(r.ok,false,mode);assert.equal(serialize(s),before,mode);
  }
});

test('RC2 unknown/corrupt evidence never becomes crafting permission',()=>{
  const s=fresh(),a=s.agents[0];learn(s,a);
  for(const mutate of [
    a=>a.knowledgeState.recipes=null,
    a=>a.knowledgeState.recipes.version='forged',
    a=>a.knowledgeState.recipes.entries.find(e=>e.recipeId==='STONE_AXE_T1').learned.sourceCompletions=999,
    a=>a.knowledgeState.recipes.entries.find(e=>e.recipeId==='STONE_AXE').receipts[1].orderId=1,
    a=>a.knowledgeState.recipes.entries.push(clone(a.knowledgeState.recipes.entries[0])),
  ]){
    const copy=clone(s);mutate(copy.agents[0]);
    assert.ok(validateRecipeKnowledge(copy,copy.agents[0]).length);assert.throws(()=>restore(serialize(copy)));
    const before=serialize(copy);assert.equal(command(copy,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE_T1'}).ok,false);assert.equal(serialize(copy),before);
  }
});

test('RC2 cyclic teacher evidence fails closed instead of fabricating permission',()=>{
  const s=fresh(),[a,b]=s.agents;learn(s,a);b.x=a.x+1;b.y=a.y;
  command(s,'TEACH_CRAFT_RECIPE',{teacherId:a.id,studentId:b.id,recipeId:'STONE_AXE_T1'});
  a.knowledgeState.recipes.entries.find(e=>e.recipeId==='STONE_AXE_T1').learned={method:'teaching',tick:s.tick,teacherId:b.id};
  assert.equal(knowsCraftRecipe(s,a,'STONE_AXE_T1'),false);assert.equal(knowsCraftRecipe(s,b,'STONE_AXE_T1'),false);
  assert.throws(()=>restore(serialize(s)));
});

test('RC2 receipt retention is bounded without losing earned count or replay protection',()=>{
  const s=fresh(),a=s.agents[0];
  for(let i=0;i<12;i++){
    // Test fixture consumes the finished item as a later game system would.
    const made=make(s,a);s.rustPossessions.items=s.rustPossessions.items.filter(x=>x.id!==made.itemId);
  }
  const e=a.knowledgeState.recipes.entries.find(e=>e.recipeId==='STONE_AXE');
  assert.equal(e.receipts.length,RECIPE_KNOWLEDGE_LIMITS.receipts);assert.equal(e.retiredCompletions,4);
  assert.equal(recipeMastery(a,'STONE_AXE'),12);assert.equal(knowsCraftRecipe(s,a,'STONE_AXE_T1'),true);
  assert.equal(serialize(restore(serialize(s))),serialize(s));
});

test('RC2 owned recipe does not bypass personal material ownership',()=>{
  const s=fresh(230926,true),[a,b]=s.agents;learn(s,a);Object.assign(resourceStock(s,a),{wood:0,stone:0});
  Object.assign(resourceStock(s,b),{wood:100,stone:100});const before=serialize(s);
  assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_PICKAXE'}).reason,'materials');assert.equal(serialize(s),before);
});

test('RC2 knowledge source has no simulation random, browser, wall-clock or inventory writer',()=>{
  const source=fs.readFileSync(new URL('../src/craft-recipe-knowledge.mjs',import.meta.url),'utf8');
  for(const token of ['Math.random','Date.now','new Date','document.','window.','.items.push(','.equipment.push('])assert.equal(source.includes(token),false,token);
});
