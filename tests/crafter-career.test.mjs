import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {adoptProfession,professionLabel} from '../src/kingdom-utility.mjs';
import {craftFixtureItem,craftFixtureTable} from './fixtures/rc2-world.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {personalHomeSite} from '../src/individual-housing.mjs';
import {validateCraftOrder} from '../src/rust-possessions.mjs';
import {
  CRAFTER_GRADES,CRAFTER_RULES,createCrafterPolicy,migrateCrafterPolicy,validateCrafterPolicy,
  crafterFamilyProfile,crafterConstructionEvidence,evaluateCrafterQualification,
  adoptCrafterProfession,crafterCraftAccess,
} from '../src/crafter-career.mjs';

function bookAgent(counts){
  const entries=[];
  for(let tier=0;tier<=5;tier++)if(counts[tier]>0){
    const recipeId=tier===1?'HAMMER':'HAMMER_T'+tier;
    entries.push({recipeId,retiredCompletions:counts[tier],receipts:[]});
  }
  return {knowledgeState:{recipes:{entries}}};
}
function dropFixture(s,a,item){item.location={kind:'drop',sourceAgentId:a.id,tick:s.tick,x:a.x,y:a.y};}
function preparedBuilder(){
  const s=createWorld(551901,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0],stock=resourceStock(s,a);
  Object.assign(stock,{wood:500,stone:500,food:500,ironIngot:30,steelIngot:30});
  a.hp=a.satiety=a.energy=100;a.task=null;
  adoptProfession(a,'BUILD',s.tick);
  assert.equal(a.profession,'builder');
  craftFixtureTable(s,a);
  for(let i=0;i<4;i++)craftFixtureItem(s,a,'HAMMER');
  for(let i=0;i<2;i++)dropFixture(s,a,craftFixtureItem(s,a,'HAMMER_T2'));
  assert.equal(crafterFamilyProfile(a,'HAMMER').grade,'CRAFTER');
  return {s,a};
}
function placeFoundation(s,a){
  const hammer=s.rustPossessions.items.filter(i=>i.kind==='HAMMER'&&i.location?.kind==='bag'&&i.location.agentId===a.id).sort((x,y)=>x.id-y.id)[0];
  assert.ok(hammer,'hammer in bag');
  assert.equal(command(s,'EQUIP_ITEM',{agentId:a.id,itemId:hammer.id}).ok,true);
  const site=personalHomeSite(s,a,walkable);assert.ok(site,'home site');
  const item=craftFixtureItem(s,a,'WOOD_FOUNDATION');a.x=site.origin.x;a.y=site.origin.y;
  const r=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:item.id,socket:{type:'cell',x:a.x,y:a.y},placementId:'rc5-test:'+a.id+':'+item.id});
  assert.equal(r.ok,true,JSON.stringify(r));return r;
}

test('RC5 family grade is derived from per-recipe completion counts, never a new XP level',()=>{
  assert.equal(crafterFamilyProfile(bookAgent([0,4,2,0,0,0]),'HAMMER').grade,'CRAFTER');
  assert.equal(crafterFamilyProfile(bookAgent([0,4,4,8,0,0]),'HAMMER').grade,'EXPERT');
  assert.equal(crafterFamilyProfile(bookAgent([0,8,8,8,8,0]),'HAMMER').grade,'MASTER');
  assert.equal(crafterFamilyProfile(bookAgent([0,8,8,8,8,0]),'HAMMER').maxTier,5);
  assert.equal(CRAFTER_GRADES.length,4);assert.equal(CRAFTER_RULES.master.tier4,6);
});

test('RC5 new worlds start with enforced policy and no grandfather bypass',()=>{
  const s=createWorld(551902),a=s.agents[0];
  assert.deepEqual(s.crafterPolicy,createCrafterPolicy());
  assert.equal(crafterCraftAccess(s,a,'HAMMER_T2').ok,false);
  assert.equal(crafterCraftAccess(s,a,'HAMMER_T2').reason,'crafter-builder-required');
  assert.deepEqual(validateCrafterPolicy(s),[]);assert.deepEqual(validate(s),[]);
});

test('RC5 capability rejection happens before any material or item escrow',()=>{
  const s=createWorld(551903),a=s.agents[0];s.stock.wood=500;s.stock.stone=500;s.rustMaterials.ironIngot=20;
  a.hp=a.satiety=a.energy=100;craftFixtureTable(s,a);
  craftFixtureItem(s,a,'HAMMER');craftFixtureItem(s,a,'HAMMER');
  assert.equal(a.profession,'forager');assert.equal(crafterCraftAccess(s,a,'HAMMER_T2').ok,false);
  const before=serialize(s),r=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'HAMMER_T2'});
  assert.equal(r.ok,false);assert.equal(r.reason,'crafter-builder-required');assert.equal(serialize(s),before);
});

test('RC5 owning somebody else\'s crafted item never creates family mastery',()=>{
  const s=createWorld(551904),a=s.agents[0],b=s.agents[1],before=crafterFamilyProfile(b,'HAMMER');
  s.rustPossessions.items.push({id:s.rustPossessions.nextItem++,kind:'HAMMER',createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:b.id}});
  const after=crafterFamilyProfile(b,'HAMMER');assert.deepEqual(after,before);assert.equal(after.total,0);
});

test('RC5 Builder can reach T2 but T3 waits for canonical Crafter qualification',()=>{
  const {s,a}=preparedBuilder();
  assert.equal(crafterCraftAccess(s,a,'HAMMER_T2').ok,true);
  assert.equal(crafterCraftAccess(s,a,'HAMMER_T3').ok,false);
  assert.equal(crafterCraftAccess(s,a,'HAMMER_T3').reason,'crafter-profession-required');
  const q=evaluateCrafterQualification(s,a);assert.equal(q.status,'VIOL');assert.equal(q.reason,'construction-required');
  assert.equal(crafterConstructionEvidence(s,a).status,'ABSENT');
  placeFoundation(s,a);
  assert.equal(a.profession,'crafter','trusted PLACE_STATION orchestration promotes once both evidence families exist');
  assert.equal(professionLabel(a.profession),'ช่างประดิษฐ์');
  assert.equal(crafterConstructionEvidence(s,a).status,'CONFIRMED');
  assert.equal(crafterCraftAccess(s,a,'HAMMER_T3').ok,true);
  assert.deepEqual(validate(s),[]);
});

test('RC5 direct Crafter adoption is replay-safe and special professions are locked',()=>{
  const {s,a}=preparedBuilder();placeFoundation(s,a);
  const again=adoptCrafterProfession(s,a);assert.equal(again.changed,false);assert.equal(again.status,'SAT');
  const rows=a.career.filter(x=>x.profession==='crafter');assert.equal(rows.length,1);
  const merchant={id:99,preference:'BUILD',skills:{BUILD:100},profession:'merchant',professionSinceTick:0,career:[{tick:0,profession:'merchant'}]};
  const blocked=adoptProfession(merchant,'CRAFTER',10,{qualifiedProfession:'crafter',qualification:'crafter-v1',evidenceId:'x'});
  assert.equal(blocked.changed,false);assert.equal(blocked.reason,'profession-locked');assert.equal(merchant.profession,'merchant');
});

test('RC5 old save migration grandfathers only recipes already known before activation',()=>{
  const {s,a}=preparedBuilder();
  assert.equal(crafterCraftAccess(s,a,'HAMMER_T3').reason,'crafter-profession-required');
  const raw=JSON.parse(serialize(s));delete raw.crafterPolicy;raw.agents[0].profession='forager';
  const old=restore(JSON.stringify(raw)),oldA=old.agents[0];
  assert.equal(old.crafterPolicy.migratedFromLegacy,true);
  assert.equal(crafterCraftAccess(old,oldA,'HAMMER_T3').ok,true);
  assert.equal(crafterCraftAccess(old,oldA,'HAMMER_T3').reason,'legacy-grandfathered');
  const row=old.crafterPolicy.grandfathered.find(x=>x.agentId===oldA.id);assert.ok(row.recipeIds.includes('HAMMER_T3'));
  const current=JSON.parse(serialize(s));current.agents[0].profession='forager';
  const currentRestored=restore(JSON.stringify(current)),currentA=currentRestored.agents[0];
  assert.equal(currentRestored.crafterPolicy.migratedFromLegacy,false);
  assert.equal(crafterCraftAccess(currentRestored,currentA,'HAMMER_T3').ok,false);
});

test('RC5 migration is one-shot and malformed policy fails validation',()=>{
  const state={tick:40,agents:[{id:1,knowledgeState:{recipes:{entries:[{recipeId:'HAMMER_T3'},{recipeId:'HAMMER_T2'}]}}}],archive:[]};
  const first=migrateCrafterPolicy(state);assert.equal(first.state,'SAT');assert.equal(first.changed,true);
  const frozen=JSON.stringify(state.crafterPolicy),second=migrateCrafterPolicy(state);assert.equal(second.changed,false);assert.equal(JSON.stringify(state.crafterPolicy),frozen);
  state.crafterPolicy.grandfathered[0].recipeIds.reverse();assert.deepEqual(validateCrafterPolicy(state),['Crafter policy']);
});

test('RC5 accepted high-tier craft order is not invalidated by later career state changes',()=>{
  const {s,a}=preparedBuilder();placeFoundation(s,a);
  assert.equal(a.profession,'crafter');
  const accepted=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'HAMMER_T3'});assert.equal(accepted.ok,true,JSON.stringify(accepted));
  const order=s.rustPossessions.orders.find(o=>o.id===accepted.orderId);assert.ok(order);
  a.profession='builder';
  assert.deepEqual(validateCraftOrder(s,order),[],'permission is frozen at queue acceptance; accepted escrow keeps running');
});
