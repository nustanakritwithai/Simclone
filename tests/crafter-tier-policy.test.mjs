import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,serialize,restore,validate} from '../src/engine.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {craftPreview} from '../src/rust-possessions.mjs';
import {recipeMastery,knowsCraftRecipe} from '../src/craft-recipe-knowledge.mjs';
import {crafterTierPermission,grandfatheredCrafterRecipe,CRAFTER_TIER_POLICY_VERSION} from '../src/crafter-tier-policy.mjs';
import {crafterFamilyProfile} from '../src/crafter-career.mjs';
import {rc2World,craftFixtureItem} from './fixtures/rc2-world.mjs';

function crafterFixture(){
  const s=rc2World(),a=s.agents[1],stock=resourceStock(s,a);
  assert.equal(adoptProfession(a,'BUILD',s.tick).changed,true);
  Object.assign(stock,{food:900,wood:900,stone:900,ironIngot:120,steelIngot:90});
  a.hp=a.satiety=a.energy=100;a.task=null;
  craftFixtureItem(s,a,'HAMMER');
  craftFixtureItem(s,a,'HAMMER_T2');
  craftFixtureItem(s,a,'HAMMER');
  craftFixtureItem(s,a,'HAMMER_T2');
  craftFixtureItem(s,a,'HAMMER');
  assert.equal(command(s,'RC5_BECOME_CRAFTER',{agentId:a.id}).ok,true);
  assert.equal(crafterFamilyProfile(s,a,'HAMMER').profile.grade,'CRAFTER');
  return {s,a};
}
function makeExpert(s,a){
  while(crafterFamilyProfile(s,a,'HAMMER').profile.grade==='CRAFTER')craftFixtureItem(s,a,'HAMMER_T3');
  assert.equal(crafterFamilyProfile(s,a,'HAMMER').profile.grade,'EXPERT');
}
function makeMaster(s,a){
  makeExpert(s,a);
  while(crafterFamilyProfile(s,a,'HAMMER').profile.grade==='EXPERT')craftFixtureItem(s,a,'HAMMER_T4');
  assert.equal(crafterFamilyProfile(s,a,'HAMMER').profile.grade,'MASTER');
}

test('G5 new worlds start NATIVE with no grandfather permission rows',()=>{
  const s=createWorld(42);
  assert.deepEqual(s.crafterTierPolicy,{version:CRAFTER_TIER_POLICY_VERSION,mode:'NATIVE',migratedTick:0,agents:[]});
  assert.deepEqual(validate(s),[]);
});
test('G5 T0-T2 remain knowledge/material gated but do not require Crafter profession',()=>{
  const s=rc2World(),a=s.agents[1];
  assert.equal(crafterTierPermission(s,a,'HAMMER_T2').status,'SAT');
});
test('G5 Crafter can craft T3 but cannot jump to known T4 before Expert',()=>{
  const {s,a}=crafterFixture();
  assert.equal(crafterTierPermission(s,a,'HAMMER_T3').status,'SAT');
  craftFixtureItem(s,a,'HAMMER_T3');craftFixtureItem(s,a,'HAMMER_T3');
  assert.equal(knowsCraftRecipe(s,a,'HAMMER_T4'),true);
  const blocked=crafterTierPermission(s,a,'HAMMER_T4');
  assert.equal(blocked.status,'VIOL');assert.equal(blocked.reason,'crafter-grade');assert.equal(blocked.grade,'CRAFTER');assert.equal(blocked.maxTier,3);
  assert.equal(craftPreview(s,{agentId:a.id,recipeId:'HAMMER_T4'}).reason,'crafter-tier');
});
test('G5 Expert unlocks actual T4 capability and Master unlocks T5 capability',()=>{
  const {s,a}=crafterFixture();makeExpert(s,a);
  assert.equal(crafterTierPermission(s,a,'HAMMER_T4').status,'SAT');
  makeMaster(s,a);
  assert.equal(knowsCraftRecipe(s,a,'HAMMER_T5'),true);
  assert.equal(crafterTierPermission(s,a,'HAMMER_T5').status,'SAT');
  const item=craftFixtureItem(s,a,'HAMMER_T5');
  assert.equal(item.craft.recipeId,'HAMMER_T5');assert.equal(item.craft.grade,'MASTER');assert.ok(item.craft.quality>=70&&item.craft.quality<=100);
  assert.deepEqual(validate(s),[]);
});
test('G5 known advanced recipe is not enough on a new-world native policy',()=>{
  const {s,a}=crafterFixture();
  craftFixtureItem(s,a,'HAMMER_T3');craftFixtureItem(s,a,'HAMMER_T3');
  assert.equal(knowsCraftRecipe(s,a,'HAMMER_T4'),true);
  a.profession='builder';
  const p=crafterTierPermission(s,a,'HAMMER_T4');
  assert.equal(p.status,'VIOL');assert.equal(p.reason,'crafter-required');
});
test('G5 one-time old-save migration grandfathers only already-known high-tier recipes',()=>{
  const {s,a}=crafterFixture();
  craftFixtureItem(s,a,'HAMMER_T3');craftFixtureItem(s,a,'HAMMER_T3');
  assert.equal(knowsCraftRecipe(s,a,'HAMMER_T4'),true);
  a.profession='builder';delete s.crafterTierPolicy;
  const migrated=restore(serialize(s)),b=migrated.agents.find(x=>x.id===a.id);
  assert.equal(migrated.crafterTierPolicy.mode,'GRANDFATHERED');
  assert.equal(grandfatheredCrafterRecipe(migrated,b.id,'HAMMER_T3'),true);
  assert.equal(grandfatheredCrafterRecipe(migrated,b.id,'HAMMER_T4'),true);
  assert.equal(grandfatheredCrafterRecipe(migrated,b.id,'HAMMER_T5'),false);
  assert.equal(crafterTierPermission(migrated,b,'HAMMER_T4').reason,'grandfathered');
  assert.equal(craftPreview(migrated,{agentId:b.id,recipeId:'HAMMER_T4'}).ok,true);
  assert.deepEqual(validate(migrated),[]);
});
test('G5 recipes learned after migration are never silently added to grandfather set',()=>{
  const {s,a}=crafterFixture();
  craftFixtureItem(s,a,'HAMMER_T3');craftFixtureItem(s,a,'HAMMER_T3');
  a.profession='builder';delete s.crafterTierPolicy;
  const migrated=restore(serialize(s)),b=migrated.agents.find(x=>x.id===a.id),migrationTick=migrated.crafterTierPolicy.migratedTick;
  assert.equal(grandfatheredCrafterRecipe(migrated,b.id,'HAMMER_T5'),false);
  craftFixtureItem(migrated,b,'HAMMER_T4');craftFixtureItem(migrated,b,'HAMMER_T4');
  assert.equal(knowsCraftRecipe(migrated,b,'HAMMER_T5'),true);
  assert.ok((b.knowledgeState.recipes.entries.find(e=>e.recipeId==='HAMMER_T5')?.learned?.tick??-1)>migrationTick);
  const p=crafterTierPermission(migrated,b,'HAMMER_T5');
  assert.equal(p.status,'VIOL');assert.equal(p.reason,'crafter-required');
  assert.equal(grandfatheredCrafterRecipe(migrated,b.id,'HAMMER_T5'),false);
});
test('G5 forged grandfather row for post-migration knowledge fails save validation',()=>{
  const {s,a}=crafterFixture();
  craftFixtureItem(s,a,'HAMMER_T3');craftFixtureItem(s,a,'HAMMER_T3');
  a.profession='builder';delete s.crafterTierPolicy;
  const migrated=restore(serialize(s)),b=migrated.agents.find(x=>x.id===a.id);
  craftFixtureItem(migrated,b,'HAMMER_T4');craftFixtureItem(migrated,b,'HAMMER_T4');
  const row=migrated.crafterTierPolicy.agents.find(x=>x.agentId===b.id);row.recipeIds.push('HAMMER_T5');row.recipeIds.sort();
  assert.ok(validate(migrated).includes('Crafter tier policy evidence'));
  assert.throws(()=>restore(serialize(migrated)));
});
test('G5 grandfather survives save/load exactly and does not grow on a second restore',()=>{
  const {s,a}=crafterFixture();
  craftFixtureItem(s,a,'HAMMER_T3');craftFixtureItem(s,a,'HAMMER_T3');a.profession='builder';delete s.crafterTierPolicy;
  const one=restore(serialize(s)),frozen=JSON.stringify(one.crafterTierPolicy),two=restore(serialize(one));
  assert.equal(JSON.stringify(two.crafterTierPolicy),frozen);
});
