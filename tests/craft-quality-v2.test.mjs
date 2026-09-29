import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,serialize,restore,validate} from '../src/engine.mjs';
import {advanceCraft,validateCraftOrder} from '../src/rust-possessions.mjs';
import {renderCraftItemInfo} from '../src/crafting-ui.mjs';
import {
  CRAFT_OUTCOME_VERSION,CRAFT_ORDER_VERSION,CRAFTER_CRAFT_OUTCOME_VERSION,CRAFTER_CRAFT_ORDER_VERSION,
  createCraftSpec,createCrafterCraftSpec,resolveCraftOutcome,validateCraftedItem,
  craftQualityRange,craftQualityBand
} from '../src/craft-outcome.mjs';

function prep(seed=8801){
  const s=createWorld(seed),a=s.agents[0];s.stock.wood=500;s.stock.stone=500;a.hp=a.satiety=a.energy=100;return {s,a};
}
function finish(s,a){
  const o=s.rustPossessions.orders.find(x=>x.agentId===a.id);assert.ok(o);let r;
  for(let i=0;i<o.required+2;i++){s.tick++;r=advanceCraft(s,a.id);if(r.completed)break;}
  assert.equal(r?.completed,true,JSON.stringify(r));return s.rustPossessions.items.find(x=>x.id===r.itemId);
}

test('RC5.2 new accepted orders freeze canonical V2 grade and produce V2 items',()=>{
  const {s,a}=prep(),q=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'});assert.equal(q.ok,true,JSON.stringify(q));
  const o=s.rustPossessions.orders.find(x=>x.id===q.orderId);assert.equal(o.craftSpec.version,CRAFTER_CRAFT_ORDER_VERSION);
  assert.equal(o.craftSpec.mastery,0);assert.equal(o.craftSpec.grade,'APPRENTICE');assert.deepEqual(validateCraftOrder(s,o),[]);
  const item=finish(s,a);assert.equal(item.craft.version,CRAFTER_CRAFT_OUTCOME_VERSION);assert.equal(item.craft.grade,'APPRENTICE');
  assert.ok(craftQualityBand(item.craft.quality));assert.equal(validateCraftedItem(item,s.seed),true);assert.deepEqual(validate(s),[]);
  const html=renderCraftItemInfo(s,item);assert.ok(html.includes('data-craft-band="'+craftQualityBand(item.craft.quality)+'"'));assert.ok(html.includes('คุณภาพ '+item.craft.quality+'/100'));
});

test('RC5.2 quality ranges make high tier difficult and Master T5 genuinely high-quality capable',()=>{
  const legacy=craftQualityRange({recipeId:'STONE_AXE',mastery:0,version:CRAFT_ORDER_VERSION});
  assert.deepEqual({floor:legacy.floor,ceiling:legacy.ceiling},{floor:30,ceiling:60});
  const expert=craftQualityRange({recipeId:'HAMMER_T4',mastery:16,grade:'EXPERT',version:CRAFTER_CRAFT_ORDER_VERSION});
  assert.deepEqual({floor:expert.floor,ceiling:expert.ceiling},{floor:60,ceiling:90});
  const master=craftQualityRange({recipeId:'HAMMER_T5',mastery:32,grade:'MASTER',version:CRAFTER_CRAFT_ORDER_VERSION});
  assert.deepEqual({floor:master.floor,ceiling:master.ceiling},{floor:70,ceiling:100});
  assert.equal(craftQualityBand(90),'MASTERWORK');assert.equal(craftQualityBand(98),'EXCEPTIONAL');
});

test('RC5.2 deterministic Master T5 rolls include high quality without guaranteeing 100',()=>{
  const qualities=[];
  for(let orderId=1;orderId<=256;orderId++){
    const spec=createCrafterCraftSpec({worldSeed:230926,orderId,creatorId:1,recipeId:'HAMMER_T5',mastery:32,grade:'MASTER'});
    const a=resolveCraftOutcome({spec,orderId,creatorId:1,recipeId:'HAMMER_T5'});
    const b=resolveCraftOutcome({spec,orderId,creatorId:1,recipeId:'HAMMER_T5'});
    assert.deepEqual(a,b);qualities.push(a.quality);
  }
  assert.ok(qualities.every(q=>q>=70&&q<=100));assert.ok(qualities.some(q=>q>=90));assert.ok(qualities.some(q=>q>=98));assert.ok(qualities.some(q=>q<100));
});

test('RC5.2 Rust order validation rejects a caller-forged higher grade even with a matching deterministic ticket',()=>{
  const {s,a}=prep(8802),q=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'});assert.equal(q.ok,true);
  const o=s.rustPossessions.orders.find(x=>x.id===q.orderId);
  o.craftSpec=createCrafterCraftSpec({worldSeed:s.seed,orderId:o.id,creatorId:a.id,recipeId:o.recipe,mastery:0,grade:'MASTER'});
  assert.deepEqual(validateCraftOrder(s,o),['Rust craft outcome snapshot']);
});

test('RC5.2 accepted V2 order survives save/load without reroll',()=>{
  const {s,a}=prep(8803);assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'}).ok,true);
  for(let i=0;i<5;i++){s.tick++;advanceCraft(s,a.id);}
  const loaded=restore(serialize(s)),left=finish(s,a),right=finish(loaded,loaded.agents[0]);
  assert.deepEqual(left.craft,right.craft);assert.equal(left.craft.version,CRAFTER_CRAFT_OUTCOME_VERSION);
});

test('RC5.2 old accepted RC2 order still restores and completes with original V1 formula',()=>{
  const {s,a}=prep(8804);assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'}).ok,true);
  const o=s.rustPossessions.orders[0];
  o.craftSpec=createCraftSpec({worldSeed:s.seed,orderId:o.id,creatorId:a.id,recipeId:o.recipe,mastery:0});
  assert.equal(o.craftSpec.version,CRAFT_ORDER_VERSION);assert.deepEqual(validateCraftOrder(s,o),[]);
  const loaded=restore(serialize(s));assert.deepEqual(validateCraftOrder(loaded,loaded.rustPossessions.orders[0]),[]);
  const item=finish(loaded,loaded.agents[0]);assert.equal(item.craft.version,CRAFT_OUTCOME_VERSION);
  assert.ok(item.craft.quality>=30&&item.craft.quality<=60);assert.equal(validateCraftedItem(item,loaded.seed),true);
});

test('RC5.2 existing V1 item validation is retained while malformed V2 grade is rejected',()=>{
  const legacySpec=createCraftSpec({worldSeed:42,orderId:1,creatorId:1,recipeId:'STONE_AXE',mastery:20});
  const legacy={id:1,kind:'STONE_AXE',createdBy:1,craft:resolveCraftOutcome({spec:legacySpec,orderId:1,creatorId:1,recipeId:'STONE_AXE'})};
  assert.equal(validateCraftedItem(legacy,42),true);assert.equal(legacy.craft.version,CRAFT_OUTCOME_VERSION);
  assert.throws(()=>createCrafterCraftSpec({worldSeed:42,orderId:2,creatorId:1,recipeId:'STONE_AXE',mastery:20,grade:'GOD'}));
  const spec=createCrafterCraftSpec({worldSeed:42,orderId:2,creatorId:1,recipeId:'STONE_AXE',mastery:20,grade:'CRAFTER'});
  const item={id:2,kind:'STONE_AXE',createdBy:1,craft:resolveCraftOutcome({spec,orderId:2,creatorId:1,recipeId:'STONE_AXE'})};
  item.craft={...item.craft,grade:'MASTER'};assert.equal(validateCraftedItem(item,42),false);
});
