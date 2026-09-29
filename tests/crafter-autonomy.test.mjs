import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {command,step,serialize,restore,validate} from '../src/engine.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {recipeMastery} from '../src/craft-recipe-knowledge.mjs';
import {crafterProgressionSnapshot,crafterProgressionIntent,CRAFTER_AUTONOMY_POLICY} from '../src/crafter-autonomy.mjs';
import {rc2World,craftFixtureItem} from './fixtures/rc2-world.mjs';

function crafterFixture(){
  const s=rc2World(),a=s.agents[1],stock=resourceStock(s,a);
  assert.equal(adoptProfession(a,'BUILD',s.tick).changed,true);
  Object.assign(stock,{food:900,wood:900,stone:900,ironIngot:120,steelIngot:120});
  a.hp=a.satiety=a.energy=100;a.task=null;
  // Existing home fixture contributed HAMMER mastery 1.
  craftFixtureItem(s,a,'HAMMER');
  craftFixtureItem(s,a,'HAMMER_T2');
  craftFixtureItem(s,a,'HAMMER');
  craftFixtureItem(s,a,'HAMMER_T2');
  craftFixtureItem(s,a,'HAMMER');
  assert.equal(recipeMastery(a,'HAMMER'),4);
  assert.equal(recipeMastery(a,'HAMMER_T2'),2);
  const promoted=command(s,'RC5_BECOME_CRAFTER',{agentId:a.id});
  assert.equal(promoted.ok,true);assert.equal(promoted.changed,true);assert.equal(a.profession,'crafter');
  return {s,a};
}
test('G4 is OFF by default and read-only',()=>{
  const {s,a}=crafterFixture(),before=serialize(s);
  const snap=crafterProgressionSnapshot(s,a);
  assert.equal(snap.status,'OFF');assert.equal(snap.reason,'policy-off');
  assert.equal(crafterProgressionIntent(s,a),null);assert.equal(serialize(s),before);
});
test('G4 full RP1 opt-in chooses the highest allowed same-family progression tier',()=>{
  const {s,a}=crafterFixture();assert.equal(command(s,'SET_PRODUCTION_POLICY',{enabled:true}).ok,true);
  const snap=crafterProgressionSnapshot(s,a),intent=crafterProgressionIntent(s,a);
  assert.equal(snap.policy,CRAFTER_AUTONOMY_POLICY);
  assert.equal(snap.status,'READY');assert.equal(snap.family,'HAMMER');assert.equal(snap.grade,'CRAFTER');assert.equal(snap.targetTier,3);
  assert.deepEqual(intent,{agentId:a.id,recipeId:'HAMMER_T3'});assert.ok(Object.isFrozen(intent));
});
test('G4 policy proposes only; intent generation never spends or creates an order',()=>{
  const {s,a}=crafterFixture();command(s,'SET_PRODUCTION_POLICY',{enabled:true});
  const before=serialize(s),intent=crafterProgressionIntent(s,a);
  assert.deepEqual(intent,{agentId:a.id,recipeId:'HAMMER_T3'});
  assert.equal(serialize(s),before);assert.equal(s.rustPossessions.orders.length,0);
});
test('G4 respects survival, current work, manual practice, adventure, housing and reserve gates',()=>{
  const cases=[
    ['survival',(s,a)=>a.hp=69,'survival'],
    ['task',(s,a)=>a.task={kind:'IDLE'},'task'],
    ['manual',(s,a)=>a.craftTraining={version:'RC2-training/1',revision:1,enabled:true,recipeId:'HAMMER',startedTick:s.tick,startCompletions:recipeMastery(a,'HAMMER'),targetCompletions:recipeMastery(a,'HAMMER')+1},'manual-training'],
    ['adventure',(s,a)=>a.adventureEncounter={status:'READY'},'adventure'],
    ['reserve',(s,a)=>resourceStock(s,a).food=0,'reserve'],
  ];
  for(const [name,change,reason] of cases){
    const {s,a}=crafterFixture();command(s,'SET_PRODUCTION_POLICY',{enabled:true});change(s,a);
    const before=serialize(s),snap=crafterProgressionSnapshot(s,a);
    assert.equal(snap.status,'BLOCKED',name);assert.equal(snap.reason,reason,name);assert.equal(crafterProgressionIntent(s,a),null);assert.equal(serialize(s),before);
  }
});
test('G4 cannot run for Builder, Merchant or Adventurer',()=>{
  for(const profession of ['builder','merchant','adventurer']){
    const {s,a}=crafterFixture();a.profession=profession;command(s,'SET_PRODUCTION_POLICY',{enabled:true});
    const snap=crafterProgressionSnapshot(s,a);assert.equal(snap.status,'INELIGIBLE');assert.equal(crafterProgressionIntent(s,a),null);
  }
});
test('G4 engine dispatches the existing CRAFT_ITEM path and freezes canonical CRAFTER quality grade',()=>{
  const {s,a}=crafterFixture();command(s,'SET_PRODUCTION_POLICY',{enabled:true});
  const beforeOrder=s.rustPossessions.nextOrder;step(s,1);
  const order=s.rustPossessions.orders.find(o=>o.agentId===a.id);
  assert.ok(order);assert.equal(order.id,beforeOrder);assert.equal(order.recipe,'HAMMER_T3');
  assert.equal(order.craftSpec.grade,'CRAFTER');assert.equal(order.craftSpec.mastery,6);
  assert.ok(s.productionPlan.history.some(h=>h.goal==='crafter-progress-HAMMER_T3'&&h.outcome==='accepted'&&h.agentId===a.id));
  assert.deepEqual(validate(s),[]);
});
test('G4 save/load resumes an accepted progression order without duplicate dispatch',()=>{
  const {s,a}=crafterFixture();command(s,'SET_PRODUCTION_POLICY',{enabled:true});step(s,5);
  assert.equal(s.rustPossessions.orders.filter(o=>o.agentId===a.id).length,1);
  const frozen=JSON.parse(JSON.stringify(s.rustPossessions.orders.find(o=>o.agentId===a.id).craftSpec));
  const loaded=restore(serialize(s)),b=loaded.agents.find(x=>x.id===a.id);
  assert.deepEqual(loaded.rustPossessions.orders.find(o=>o.agentId===b.id).craftSpec,frozen);
  const next=loaded.rustPossessions.nextOrder;step(loaded,1);
  assert.equal(loaded.rustPossessions.orders.filter(o=>o.agentId===b.id).length,1);
  assert.equal(loaded.rustPossessions.nextOrder,next);
  assert.deepEqual(validate(loaded),[]);
});
test('G4 autonomously advances Crafter to Expert through real T3 completions',()=>{
  const {s,a}=crafterFixture();command(s,'SET_PRODUCTION_POLICY',{enabled:true});
  for(let i=0;i<5000;i++){
    step(s,1);
    const snap=crafterProgressionSnapshot(s,a);
    if(snap.grade==='EXPERT')break;
  }
  const snap=crafterProgressionSnapshot(s,a);
  assert.equal(a.profession,'crafter');assert.equal(snap.grade,'EXPERT');assert.ok(recipeMastery(a,'HAMMER_T3')>=4);
  assert.ok(s.rustPossessions.items.some(i=>i.createdBy===a.id&&i.craft?.recipeId==='HAMMER_T3'));
  assert.deepEqual(validate(s),[]);
});
test('G4 Master stops after one real T5 showcase instead of infinitely consuming stock',()=>{
  const {s,a}=crafterFixture();command(s,'SET_PRODUCTION_POLICY',{enabled:true});
  for(let i=0;i<22000;i++){
    step(s,1);
    const snap=crafterProgressionSnapshot(s,a);
    if(snap.status==='COMPLETE')break;
  }
  const snap=crafterProgressionSnapshot(s,a);
  assert.equal(snap.status,'COMPLETE');assert.equal(snap.grade,'MASTER');assert.ok(recipeMastery(a,'HAMMER_T5')>=1);
  const done=recipeMastery(a,'HAMMER_T5'),next=s.rustPossessions.nextOrder;
  step(s,600);assert.equal(recipeMastery(a,'HAMMER_T5'),done);assert.equal(s.rustPossessions.nextOrder,next);
  assert.deepEqual(validate(s),[]);
});
test('G4 source is deterministic policy only and has no item/profession/mastery writer',()=>{
  const source=fs.readFileSync(new URL('../src/crafter-autonomy.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Math\.random|\bDate\b|document\.|window\.|fetch\(/);
  assert.doesNotMatch(source,/\.items\.push|\.orders\.push|profession\s*=(?!=)|knowledgeState\s*=|\.skills\s*=/);
});
