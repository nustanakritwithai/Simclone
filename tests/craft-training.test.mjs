import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorld,command,step,serialize,restore,validate} from '../src/engine.mjs';
import {craftTrainingCommand,craftTrainingIntent,craftTrainingSnapshot,validateCraftTraining} from '../src/craft-training.mjs';
import {recipeMastery,knowsCraftRecipe} from '../src/craft-recipe-knowledge.mjs';
import {advanceCraft,grantAdventureLoot} from '../src/rust-possessions.mjs';
const fresh=()=>{const s=createWorld(230926);s.stock={wood:500,stone:500,food:500};const a=s.agents[0];a.hp=a.satiety=a.energy=100;a.task=null;return {s,a};};
const arm=(s,a,extra={})=>command(s,'SET_CRAFT_TRAINING',{agentId:a.id,enabled:true,recipeId:'STONE_AXE',expectedRevision:a.craftTraining?.revision??0,...extra});
const copy=x=>JSON.parse(JSON.stringify(x));
function finish(s,a){const o=s.rustPossessions.orders.find(x=>x.agentId===a.id);assert.ok(o);for(let i=0;i<o.required+2;i++){s.tick++;const r=advanceCraft(s,a.id);if(r.completed)return r;}assert.fail('order did not complete');}

test('RC2 practice is OFF and non-mutating for released saves',()=>{
  const {s,a}=fresh(),before=JSON.stringify(s);
  assert.equal(craftTrainingIntent(s,a),null);assert.equal(craftTrainingSnapshot(s,a).status,'OFF');assert.deepEqual(validateCraftTraining(s,a),[]);
  assert.equal(JSON.stringify(s),before);step(s,80);assert.ok(s.agents.every(x=>x.craftTraining===undefined));
  const loaded=restore(serialize(s));assert.ok(loaded.agents.every(x=>x.craftTraining===undefined));
});
test('RC2 arm stores a preference only; no resources, item, order, XP or profession mutation',()=>{
  const {s,a}=fresh(),before=copy(s);assert.equal(arm(s,a).ok,true);const after=copy(s);delete after.agents[0].craftTraining;assert.deepEqual(after,before);
  assert.equal(a.craftTraining.targetCompletions,2);assert.equal(craftTrainingSnapshot(s,a).status,'READY');assert.deepEqual(validate(s),[]);
});
test('RC2 practice is exactly two real completed orders and does not auto-arm next tier',()=>{
  const {s,a}=fresh();arm(s,a);step(s,60);
  const made=s.rustPossessions.items.filter(i=>i.createdBy===a.id&&i.kind==='STONE_AXE');assert.equal(made.length,2);
  assert.equal(recipeMastery(a,'STONE_AXE'),2);assert.equal(knowsCraftRecipe(s,a,'STONE_AXE_T1'),true);
  assert.equal(craftTrainingSnapshot(s,a).status,'COMPLETE');const count=s.rustPossessions.nextOrder;step(s,180);
  assert.equal(recipeMastery(a,'STONE_AXE'),2);assert.equal(s.rustPossessions.nextOrder,count);assert.deepEqual(validate(s),[]);
});
test('RC2 stale command cannot restart practice after completion or explicit stop',()=>{
  const {s,a}=fresh(),request={agentId:a.id,enabled:true,recipeId:'STONE_AXE',expectedRevision:0};command(s,'SET_CRAFT_TRAINING',request);step(s,60);
  let before=serialize(s);assert.equal(command(s,'SET_CRAFT_TRAINING',request).reason,'training-revision');assert.equal(serialize(s),before);
  assert.equal(command(s,'SET_CRAFT_TRAINING',{agentId:a.id,enabled:false,expectedRevision:1}).ok,true);before=serialize(s);
  assert.equal(arm(s,a,{expectedRevision:1}).reason,'training-revision');assert.equal(serialize(s),before);
});
test('RC2 stopped practice retains accepted order, frozen roll and materials escrow',()=>{
  const {s,a}=fresh();arm(s,a);step(s,8);const order=copy(s.rustPossessions.orders[0]),stock=copy(s.stock);
  assert.equal(command(s,'SET_CRAFT_TRAINING',{agentId:a.id,enabled:false,expectedRevision:1}).ok,true);
  assert.deepEqual(s.rustPossessions.orders[0],order);assert.deepEqual(s.stock,stock);step(s,70);
  assert.equal(recipeMastery(a,'STONE_AXE'),1);assert.equal(craftTrainingSnapshot(s,a).status,'OFF');assert.equal(s.rustPossessions.orders.length,0);
});
test('RC2 manual completion counts toward the same practice quota, no parallel ledger',()=>{
  const {s,a}=fresh();arm(s,a,{count:1});assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'}).ok,true);finish(s,a);
  assert.equal(craftTrainingIntent(s,a),null);assert.equal(craftTrainingSnapshot(s,a).completed,1);assert.equal(craftTrainingSnapshot(s,a).status,'COMPLETE');
});
test('RC2 safety blocks intent without spending or writing preferences',()=>{
  for(const [name,change,reason] of [
    ['low hp',a=>a.hp=69,'survival'],['hunger',a=>a.satiety=69,'survival'],['energy',a=>a.energy=64,'survival'],
    ['active combat',a=>a.adventureCombat={status:'ACTIVE'},'adventure'],['encounter',a=>a.adventureEncounter={zoneId:'z1'},'adventure'],
    ['current task',a=>a.task={kind:'FORAGE'},'task'],['dead',a=>a.alive=false,'stage']
  ]){const {s,a}=fresh();arm(s,a);change(a);const before=JSON.stringify(s);assert.equal(craftTrainingSnapshot(s,a).reason,reason,name);assert.equal(craftTrainingIntent(s,a),null);assert.equal(JSON.stringify(s),before);}
});
test('RC2 food, wood and stone safety floors protect stock independently of craft costs',()=>{
  for(const [resource,value] of [['food',35],['wood',15],['stone',9]]){const {s,a}=fresh();arm(s,a);s.stock[resource]=value;const before=JSON.stringify(s);assert.equal(craftTrainingSnapshot(s,a).reason,'reserve',resource);assert.equal(craftTrainingIntent(s,a),null);assert.equal(JSON.stringify(s),before);}
});
test('RC2 practice does not displace unfinished housing or homeless Independent work',()=>{
  const {s,a}=fresh();arm(s,a);s.buildings.push({type:'shelter',complete:false,x:1,y:1});assert.equal(craftTrainingSnapshot(s,a).reason,'housing');
  const other=createWorld(42,{mode:'independent',population:1}),b=other.agents[0];b.hp=b.satiety=b.energy=100;assert.equal(arm(other,b).ok,true);
  assert.equal(craftTrainingSnapshot(other,b).reason,'housing');assert.equal(craftTrainingIntent(other,b),null);
});
test('RC2 bag full pauses practice and never discards, duplicates or grants items',()=>{
  const {s,a}=fresh();arm(s,a);assert.equal(grantAdventureLoot(s,{agentId:a.id,claimKey:'fixture-bag',items:[{itemKind:'HIDE',quantity:4,rarity:'COMMON'}]}).ok,true);
  const before=JSON.stringify(s);assert.equal(craftTrainingSnapshot(s,a).reason,'bag-full');assert.equal(craftTrainingIntent(s,a),null);assert.equal(JSON.stringify(s),before);
});
test('RC2 invalid recipes, unbounded quotas and malformed commands fail atomically',()=>{
  for(const data of [{recipeId:'STONE_AXE_T5'},{count:0},{count:3},{count:1.5},{count:65535},{enabled:'yes'},{expectedRevision:-1},{expectedRevision:NaN}]){
    const {s,a}=fresh(),before=serialize(s);assert.equal(arm(s,a,data).ok,false);assert.equal(serialize(s),before);
  }
  const {s,a}=fresh();assert.equal(craftTrainingCommand(s,'OTHER',{}),null);a.alive=false;assert.equal(arm(s,a).reason,'actor');
});
test('RC2 invalid saved practice preferences are rejected rather than repaired into progress',()=>{
  for(const change of [p=>p.version='future',p=>p.revision=0,p=>p.enabled='yes',p=>p.targetCompletions=5,p=>p.startedTick=99,p=>p.startCompletions=1,p=>p.extra=1,p=>p.recipeId='constructor']){
    const {s,a}=fresh();arm(s,a);change(a.craftTraining);assert.ok(validateCraftTraining(s,a).length);assert.ok(validate(s).includes('Craft training'));assert.throws(()=>restore(JSON.stringify(s)));
  }
});
test('RC2 pending practice save/load gives identical outputs, receipt progress and future world',()=>{
  const {s,a}=fresh();arm(s,a);step(s,17);const loaded=restore(serialize(s));step(s,120);step(loaded,120);
  assert.equal(serialize(s),serialize(loaded));assert.equal(recipeMastery(a,'STONE_AXE'),2);assert.deepEqual(validate(s),[]);
});
test('RC2 intent is immutable, uses the existing command vocabulary and has no nondeterminism',()=>{
  const {s,a}=fresh();arm(s,a);const before=JSON.stringify(s),intent=craftTrainingIntent(s,a);assert.ok(Object.isFrozen(intent));assert.deepEqual(intent,{agentId:a.id,recipeId:'STONE_AXE'});assert.equal(JSON.stringify(s),before);
  const source=fs.readFileSync(new URL('../src/craft-training.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Math\.random|\bDate\b|document\.|window\.|fetch\(/);assert.doesNotMatch(source,/\.items\.push|\.orders\.push|\.skills\s*=|\.hp\s*=/);
});
