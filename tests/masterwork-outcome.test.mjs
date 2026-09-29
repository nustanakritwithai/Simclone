import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate} from '../src/engine.mjs';
import {advanceCraft,validateCraftOrder} from '../src/rust-possessions.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {recipeMastery} from '../src/craft-recipe-knowledge.mjs';
import {craftFixtureItem,rc2World} from './fixtures/rc2-world.mjs';
import {renderCraftItemInfo} from '../src/crafting-ui.mjs';
import {
  createCraftSpec,createMasterworkCraftSpec,resolveCraftOutcome,validateCraftedItem,
  masterworkQualityRange,craftQualityLabel,CRAFT_ORDER_VERSION,CRAFT_OUTCOME_VERSION,
  MASTERWORK_ORDER_VERSION,MASTERWORK_OUTCOME_VERSION,
} from '../src/craft-outcome.mjs';

const copy=x=>JSON.parse(JSON.stringify(x));
function finishDirect(s,a){
  const o=s.rustPossessions.orders.find(o=>o.agentId===a.id);assert.ok(o);
  let r;for(let i=0;i<o.required+2;i++){s.tick++;r=advanceCraft(s,a.id);if(r.completed)break;}
  assert.equal(r?.completed,true,JSON.stringify(r));return s.rustPossessions.items.find(i=>i.id===r.itemId);
}
function finishByEngine(s,a,orderId){
  for(let i=0;i<1600&&s.rustPossessions.orders.some(o=>o.id===orderId);i++)step(s,1);
  assert.equal(s.rustPossessions.orders.some(o=>o.id===orderId),false,'engine craft must finish');
  return s.rustPossessions.items.find(i=>i.createdBy===a.id&&i.craft?.orderId===orderId);
}
function crafterAtFive(){
  const s=rc2World(),a=s.agents[1],stock=resourceStock(s,a);
  assert.equal(adoptProfession(a,'BUILD',s.tick).changed,true);
  Object.assign(stock,{food:500,wood:500,stone:500,ironIngot:30});a.hp=a.satiety=a.energy=100;a.task=null;
  craftFixtureItem(s,a,'HAMMER');
  craftFixtureItem(s,a,'HAMMER_T2');
  craftFixtureItem(s,a,'HAMMER');
  craftFixtureItem(s,a,'HAMMER_T2');
  assert.equal(recipeMastery(a,'HAMMER'),3);assert.equal(recipeMastery(a,'HAMMER_T2'),2);
  assert.equal(a.profession,'builder');
  return {s,a};
}

test('G3 pins the legacy RC2 evaluator for old accepted order and item bytes',()=>{
  const spec=createCraftSpec({worldSeed:42,orderId:1,creatorId:1,recipeId:'STONE_AXE',mastery:0});
  assert.deepEqual(spec,{version:CRAFT_ORDER_VERSION,worldSeed:42,mastery:0,ticket:'c461eac7'});
  const out=resolveCraftOutcome({spec,orderId:1,creatorId:1,recipeId:'STONE_AXE'});
  assert.deepEqual(out,{version:CRAFT_OUTCOME_VERSION,worldSeed:42,orderId:1,recipeId:'STONE_AXE',mastery:0,tier:0,quality:32,ticket:'c461eac7',abilities:[{kind:'WORK_SPEED_BPS',value:415}]});
  assert.equal(validateCraftedItem({id:1,kind:'STONE_AXE',createdBy:1,craft:out},42),true);
});

test('G3 Masterwork quality window is bounded, tier-aware and never guarantees perfect output',()=>{
  assert.deepEqual(masterworkQualityRange({mastery:32,tier:5,grade:'MASTER'}),{floor:70,ceiling:100});
  assert.deepEqual(masterworkQualityRange({mastery:0,tier:5,grade:'APPRENTICE'}),{floor:30,ceiling:60});
  assert.equal(craftQualityLabel(90),'MASTERWORK');assert.equal(craftQualityLabel(98),'EXCEPTIONAL');
  const values=[];
  for(let orderId=1;orderId<=128;orderId++){
    const spec=createMasterworkCraftSpec({worldSeed:42,orderId,creatorId:1,recipeId:'HAMMER_T5',mastery:32,grade:'MASTER'});
    values.push(resolveCraftOutcome({spec,orderId,creatorId:1,recipeId:'HAMMER_T5'}).quality);
  }
  assert.ok(Math.min(...values)>=70&&Math.max(...values)<=100);
  assert.ok(values.some(q=>q>=90));assert.ok(values.some(q=>q<100));
});

test('G3 all newly accepted live orders freeze RC5 order version and Apprentice grade before Crafter qualification',()=>{
  const s=createWorld(42),a=s.agents[0];
  const q=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'});assert.equal(q.ok,true);
  const o=s.rustPossessions.orders[0];
  assert.equal(o.craftSpec.version,MASTERWORK_ORDER_VERSION);
  assert.equal(o.craftSpec.grade,'APPRENTICE');
  assert.equal(o.craftSpec.mastery,0);
  const item=finishDirect(s,a);
  assert.equal(item.craft.version,MASTERWORK_OUTCOME_VERSION);
  assert.equal(item.craft.grade,'APPRENTICE');
  assert.equal(validateCraftedItem(item,s.seed),true);
  assert.deepEqual(validate(s),[]);
});

test('G3 a legacy RC2 order accepted before deployment still completes with RC2 outcome after deployment',()=>{
  const s=createWorld(43),a=s.agents[0];
  const q=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'});assert.equal(q.ok,true);
  const o=s.rustPossessions.orders[0];
  o.craftSpec=createCraftSpec({worldSeed:s.seed,orderId:o.id,creatorId:a.id,recipeId:o.recipe,mastery:0});
  assert.deepEqual(validateCraftOrder(s,o),[]);
  const saved=serialize(s),loaded=restore(saved),item=finishDirect(loaded,loaded.agents[0]);
  assert.equal(item.craft.version,CRAFT_OUTCOME_VERSION);
  assert.equal(item.craft.grade,undefined);
  assert.equal(validateCraftedItem(item,s.seed),true);
});

test('G3 accepted grade is bound to live mastery/profession and a recomputed MASTER ticket cannot escalate it',()=>{
  const s=createWorld(44),a=s.agents[0];
  command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'});const o=s.rustPossessions.orders[0];
  o.craftSpec=createMasterworkCraftSpec({worldSeed:s.seed,orderId:o.id,creatorId:a.id,recipeId:o.recipe,mastery:0,grade:'MASTER'});
  assert.deepEqual(validateCraftOrder(s,o),['Rust craft outcome snapshot']);
  s.tick++;const before=serialize(s);assert.equal(advanceCraft(s,a.id).reason,'craft-order-invalid');assert.equal(serialize(s),before);
  assert.throws(()=>restore(before));
});

test('G3 the qualifying Builder order stays Apprentice; the next accepted Crafter order freezes CRAFTER',()=>{
  const {s,a}=crafterAtFive();
  const q=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'HAMMER'});assert.equal(q.ok,true);
  const order=s.rustPossessions.orders.find(o=>o.id===q.orderId);
  assert.equal(order.craftSpec.grade,'APPRENTICE');assert.equal(order.craftSpec.mastery,5);
  const qualifying=finishByEngine(s,a,q.orderId);assert.ok(qualifying);
  assert.equal(qualifying.craft.grade,'APPRENTICE');
  assert.equal(a.profession,'crafter');assert.equal(recipeMastery(a,'HAMMER'),4);
  const next=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'HAMMER_T2'});assert.equal(next.ok,true,JSON.stringify(next));
  const nextOrder=s.rustPossessions.orders.find(o=>o.id===next.orderId);
  assert.equal(nextOrder.craftSpec.grade,'CRAFTER');assert.equal(nextOrder.craftSpec.mastery,6);
  assert.deepEqual(validate(s),[]);
});

test('G3 pending RC5 order survives save/load byte-identically and outcome does not reroll',()=>{
  const s=createWorld(45),a=s.agents[0];
  command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'});const frozen=copy(s.rustPossessions.orders[0].craftSpec);
  for(let i=0;i<8;i++){s.tick++;advanceCraft(s,a.id);}
  const loaded=restore(serialize(s));assert.deepEqual(loaded.rustPossessions.orders[0].craftSpec,frozen);
  const x=finishDirect(s,a),y=finishDirect(loaded,loaded.agents[0]);
  assert.deepEqual(x.craft,y.craft);assert.equal(x.craft.version,MASTERWORK_OUTCOME_VERSION);
});

test('G3 item tampering in quality, grade or ticket fails validation without retrofitting legacy items',()=>{
  const spec=createMasterworkCraftSpec({worldSeed:46,orderId:7,creatorId:1,recipeId:'STONE_AXE_T2',mastery:6,grade:'CRAFTER'});
  const craft=resolveCraftOutcome({spec,orderId:7,creatorId:1,recipeId:'STONE_AXE_T2'}),item={id:9,kind:'STONE_AXE',createdBy:1,craft};
  assert.equal(validateCraftedItem(item,46),true);
  for(const mutate of [x=>x.craft.quality++,x=>x.craft.grade='MASTER',x=>x.craft.ticket='00000000']){
    const bad=copy(item);mutate(bad);assert.equal(validateCraftedItem(bad,46),false);
  }
  const legacy={id:10,kind:'STONE_AXE',createdBy:1};
  assert.equal(validateCraftedItem(legacy,46),true);assert.equal(legacy.craft,undefined);
});

test('G3 Craft Item UI exposes quality band and frozen Crafter grade without becoming authority',()=>{
  const s=createWorld(47);let craft=null,orderId=1;
  for(;orderId<512;orderId++){
    const spec=createMasterworkCraftSpec({worldSeed:s.seed,orderId,creatorId:1,recipeId:'HAMMER_T5',mastery:32,grade:'MASTER'});
    const candidate=resolveCraftOutcome({spec,orderId,creatorId:1,recipeId:'HAMMER_T5'});
    if(candidate.quality>=90){craft=candidate;break;}
  }
  assert.ok(craft);const item={id:100,kind:'HAMMER',createdBy:1,createdTick:10,craft};
  const html=renderCraftItemInfo(s,item);
  assert.match(html,/data-craft-grade="MASTER"/);assert.match(html,/(Masterwork|Exceptional)/);assert.match(html,/ฝีมือขณะรับงาน 32 · MASTER/);
  const before=JSON.stringify(item);renderCraftItemInfo(s,item);assert.equal(JSON.stringify(item),before);
});
