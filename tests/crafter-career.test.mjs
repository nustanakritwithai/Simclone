import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {command,step,serialize,restore,validate} from '../src/engine.mjs';
import {adoptProfession,professionLabel} from '../src/kingdom-utility.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {homeOf} from '../src/individual-housing.mjs';
import {recipeMastery,knowsCraftRecipe} from '../src/craft-recipe-knowledge.mjs';
import {rc2World} from './fixtures/rc2-world.mjs';
import {
  CRAFTER_CAREER_VERSION,CRAFTER_QUALIFICATION_POLICY,crafterCareerSnapshot,
  evaluateCrafterQualification,adoptCrafterProfessionFromState,
} from '../src/crafter-career.mjs';

function builderFixture(){
  const s=rc2World(),a=s.agents[1];
  const changed=adoptProfession(a,'BUILD',s.tick);
  assert.equal(changed.changed,true);
  assert.equal(a.profession,'builder');
  const stock=resourceStock(s,a);
  Object.assign(stock,{food:500,wood:500,stone:500,ironIngot:30});
  a.hp=a.satiety=a.energy=100;a.task=null;a.moveTick=0;
  assert.ok(homeOf(s,a.id,{completeOnly:true}));
  assert.equal(recipeMastery(a,'HAMMER'),1,'fixture home uses one real crafted Hammer');
  assert.deepEqual(validate(s),[]);
  return {s,a};
}
function engineCraft(s,a,recipeId){
  const accepted=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId});
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  const orderId=accepted.orderId;
  for(let i=0;i<1200&&s.rustPossessions.orders.some(o=>o.id===orderId);i++)step(s,1);
  assert.equal(s.rustPossessions.orders.some(o=>o.id===orderId),false,'craft order must finish');
  const item=s.rustPossessions.items.filter(i=>i.createdBy===a.id&&i.craft?.orderId===orderId)[0];
  assert.ok(item,'completed canonical item');
  return item;
}

test('RC5 starts from exact existing evidence: Builder + own completed home + real recipe mastery',()=>{
  const {s,a}=builderFixture();
  const q=evaluateCrafterQualification(s,a.id);
  assert.equal(q.version,CRAFTER_CAREER_VERSION);
  assert.equal(q.status,'VIOL');
  assert.equal(q.reason,'craft-mastery-required');
  assert.equal(q.homeId,homeOf(s,a.id,{completeOnly:true}).houseId);
  assert.equal(q.profile.family,'HAMMER');
});

test('RC5 command accepts only agent identity and cannot accept forged qualification evidence',()=>{
  const {s,a}=builderFixture(),before=serialize(s);
  const forged=command(s,'RC5_BECOME_CRAFTER',{agentId:a.id,evidenceId:'forged',verified:true});
  assert.equal(forged.ok,false);
  assert.equal(forged.reason,'input');
  assert.equal(serialize(s),before);
});

test('RC5 real engine crafting promotes Builder automatically after six same-family completions including two T2',()=>{
  const {s,a}=builderFixture(),careerBefore=a.career.length;
  engineCraft(s,a,'HAMMER');
  assert.equal(recipeMastery(a,'HAMMER'),2);
  assert.equal(knowsCraftRecipe(s,a,'HAMMER_T2'),true);
  engineCraft(s,a,'HAMMER_T2');
  engineCraft(s,a,'HAMMER');
  engineCraft(s,a,'HAMMER_T2');
  assert.equal(a.profession,'builder');
  let q=evaluateCrafterQualification(s,a.id);
  assert.equal(q.status,'VIOL');
  assert.equal(q.reason,'craft-mastery-required');
  engineCraft(s,a,'HAMMER');
  assert.equal(recipeMastery(a,'HAMMER'),4);
  assert.equal(recipeMastery(a,'HAMMER_T2'),2);
  assert.equal(a.profession,'crafter');
  assert.equal(professionLabel(a.profession),'ช่างประดิษฐ์');
  assert.equal(a.career.length,careerBefore+1);
  assert.equal(a.career.at(-1).profession,'crafter');
  const snap=crafterCareerSnapshot(s,a);
  assert.equal(snap.status,'SAT');
  assert.equal(snap.best.family,'HAMMER');
  assert.equal(snap.best.grade,'CRAFTER');
  assert.equal(snap.best.maxNewTier,3);
  assert.ok(s.events.some(e=>e.type==='career'&&e.agentId===a.id));
  assert.deepEqual(validate(s),[]);
});

test('RC5 promotion replay is idempotent and save/load keeps canonical profession without a new XP ledger',()=>{
  const {s,a}=builderFixture();
  engineCraft(s,a,'HAMMER');engineCraft(s,a,'HAMMER_T2');engineCraft(s,a,'HAMMER');engineCraft(s,a,'HAMMER_T2');engineCraft(s,a,'HAMMER');
  assert.equal(a.profession,'crafter');
  const history=JSON.stringify(a.career);
  const replay=command(s,'RC5_BECOME_CRAFTER',{agentId:a.id});
  assert.equal(replay.ok,true);assert.equal(replay.changed,false);
  assert.equal(JSON.stringify(a.career),history);
  assert.equal(Object.hasOwn(a,'craftXP'),false);
  assert.equal(Object.hasOwn(a,'craftLevel'),false);
  const loaded=restore(serialize(s)),b=loaded.agents.find(x=>x.id===a.id);
  assert.equal(b.profession,'crafter');
  assert.equal(JSON.stringify(b.career),history);
  assert.deepEqual(validate(loaded),[]);
});

test('RC5 qualification fails closed for non-builders, missing construction and special professions',()=>{
  const {s,a}=builderFixture();
  const original=a.profession;
  a.profession='miner';assert.equal(evaluateCrafterQualification(s,a.id).reason,'builder-required');
  a.profession='merchant';assert.equal(evaluateCrafterQualification(s,a.id).reason,'special-profession-lock');
  a.profession='adventurer';assert.equal(evaluateCrafterQualification(s,a.id).reason,'special-profession-lock');
  a.profession=original;
  const house=homeOf(s,a.id,{completeOnly:true});
  const foundation=s.rustStations.stations.find(st=>st.id===house.originStationId);
  foundation.placedBy=s.agents[0].id;
  assert.equal(evaluateCrafterQualification(s,a.id).reason,'construction-required');
});

test('RC5 Crafter is a locked special profession against ordinary work, Merchant and Adventurer transitions',()=>{
  const {s,a}=builderFixture();
  engineCraft(s,a,'HAMMER');engineCraft(s,a,'HAMMER_T2');engineCraft(s,a,'HAMMER');engineCraft(s,a,'HAMMER_T2');engineCraft(s,a,'HAMMER');
  assert.equal(a.profession,'crafter');const history=JSON.stringify(a.career);
  for(const kind of ['FORAGE','WOODCUT','MINE','BUILD'])assert.equal(adoptProfession(a,kind,s.tick+1).changed,false);
  const merchant=adoptProfession(a,'MERCHANT',s.tick+1,{qualifiedProfession:'merchant',qualification:'merchant-v1',evidenceId:'m'});
  assert.equal(merchant.changed,false);assert.equal(merchant.reason,'profession-locked');
  a.adventurerQualification={version:1,accepted:3,recent:[
    {id:'0:1:1',tick:0,x:1,y:1},{id:'1:1:2',tick:1,x:1,y:2},{id:'2:2:2',tick:2,x:2,y:2},
  ]};
  const adv=adoptProfession(a,'EXPLORE',s.tick+1,{qualifiedProfession:'adventurer',qualification:'explore-3'});
  assert.equal(adv.changed,false);assert.equal(adv.reason,'profession-locked');
  assert.equal(a.profession,'crafter');assert.equal(JSON.stringify(a.career),history);
});

test('RC5 Merchant and Adventurer cannot be overwritten by Crafter adoption',()=>{
  for(const profession of ['merchant','adventurer']){
    const {s,a}=builderFixture();a.profession=profession;a.career=[{tick:0,profession}];
    const before=serialize(s),r=adoptCrafterProfessionFromState(s,a.id,s.tick);
    assert.equal(r.ok,false);assert.equal(r.reason,'special-profession-lock');
    assert.equal(a.profession,profession);assert.equal(serialize(s),before);
  }
});

test('RC5 recipe corruption is UNKNOWN and never a qualification pass',()=>{
  const {s,a}=builderFixture();
  a.knowledgeState.recipes={version:'forged',entries:[]};
  const q=evaluateCrafterQualification(s,a.id);
  assert.equal(q.status,'UNKNOWN');assert.equal(q.qualified,false);
});

test('RC5 thresholds are derived from bounded recipe receipts, not held items',()=>{
  const {s,a}=builderFixture();
  const q=evaluateCrafterQualification(s,a.id);
  assert.equal(q.status,'VIOL');assert.equal(q.reason,'craft-mastery-required');
  assert.equal(q.profile.total,1);
  assert.deepEqual(CRAFTER_QUALIFICATION_POLICY.crafter,{total:6,tier2:2});
});

test('RC5 source has no parallel inventory, random source, DOM, wall-clock or direct profession writer',()=>{
  const source=fs.readFileSync(new URL('../src/crafter-career.mjs',import.meta.url),'utf8');
  for(const token of ['Math.random','Date.now','new Date','document.','window.','.items.push(','.equipment.push('])
    assert.equal(source.includes(token),false,token);
  assert.doesNotMatch(source,/agent\.profession\s*=(?!=)/,'direct profession assignment');
});
