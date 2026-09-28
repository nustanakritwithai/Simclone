import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,serialize,restore,validate} from '../src/engine.mjs';
import {advanceCraft} from '../src/rust-possessions.mjs';
function fresh(){const s=createWorld(230926);s.stock.wood=999;s.stock.stone=999;return s;}
function make(s){
  assert.equal(command(s,'CRAFT_ITEM',{agentId:1,recipeId:'STONE_AXE'}).ok,true);
  let result;for(let n=0;n<24;n++){s.tick++;result=advanceCraft(s,1);}
  assert.equal(result.completed,true);return result;
}
function consumeFixtureOutput(s,id){s.rustPossessions.items=s.rustPossessions.items.filter(i=>i.id!==id);}
function rejectedUnchanged(s){
  assert.ok(validate(s).length);assert.throws(()=>restore(serialize(s)));
  s.tick++;const before=serialize(s);assert.equal(advanceCraft(s,1).ok,false);assert.equal(serialize(s),before);
}


test('RC2.1a unused historical order IDs and pre-completion start ticks cannot bypass the watermark',()=>{
  for(const mutate of [o=>o.id=1,o=>o.startedTick=0]){
    const s=fresh();s.rustPossessions.nextOrder=2; // historical cancelled ID; no retained completion
    make(s);make(s);command(s,'CRAFT_ITEM',{agentId:1,recipeId:'STONE_AXE'});
    mutate(s.rustPossessions.orders[0]);rejectedUnchanged(s);
  }
});

test('RC2.1a retained compaction certificate also matches any surviving physical output',()=>{
  const s=fresh();for(let i=0;i<9;i++){const made=make(s);if(i>0)consumeFixtureOutput(s,made.itemId);}
  assert.equal(s.rustPossessions.items.length,1);assert.deepEqual(validate(s),[]);
  for(const mutate of [item=>item.createdBy=2,item=>item.createdTick=0,item=>item.kind='STONE_PICKAXE']){
    const bad=structuredClone(s);mutate(bad.rustPossessions.items[0]);assert.throws(()=>restore(serialize(bad)));
  }
});

test('RC2.1a retired counts must precede the first retained order even in old books',()=>{
  const s=fresh();for(let i=0;i<12;i++)consumeFixtureOutput(s,make(s).itemId);
  const e=s.agents[0].knowledgeState.recipes.entries.find(e=>e.recipeId==='STONE_AXE');
  delete e.retiredThrough;e.retiredCompletions=5;s.rustPossessions.nextOrder=15;
  assert.equal(e.receipts[0].orderId,5);assert.throws(()=>restore(serialize(s)));
});
