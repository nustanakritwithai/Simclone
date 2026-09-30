import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {command,step,serialize,restore,validate} from '../src/engine.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {recipeMastery} from '../src/craft-recipe-knowledge.mjs';
import {CRAFT_TRAINING_RULES} from '../src/craft-training.mjs';
import {CRAFT_RECIPE_CATALOG} from '../src/crafting-catalog.mjs';
import {validateCraftedItem} from '../src/craft-outcome.mjs';
import {
  observeRc4Markets,knownRc4Markets,knownRc4BuyOffers
} from '../src/rc4-market-observation.mjs';
import {projectHomeMarketForTrade} from '../src/home-market.mjs';
import {ECONOMIC_DEMAND_TTL_TICKS} from '../src/economic-demand.mjs';
import {
  demandDrivenCrafterSnapshot,demandDrivenCrafterIntent,ER3_CRAFTER_DEMAND_VERSION
} from '../src/demand-driven-crafter.mjs';
import {rc2World,craftFixtureItem} from './fixtures/rc2-world.mjs';

function setProfession(a,profession,preference=a.preference){
  a.profession=profession;a.preference=preference;a.professionSinceTick=0;a.career=[{tick:0,profession}];
}

function freeBagSlot(s,a){
  const equipped=new Set((s.rustPossessions.equipment??[]).filter(e=>e.agentId===a.id).map(e=>e.itemId));
  const item=s.rustPossessions.items
    .filter(i=>i.location?.kind==='bag'&&i.location.agentId===a.id&&!equipped.has(i.id))
    .sort((x,y)=>x.id-y.id)[0];
  assert.ok(item,'fixture needs one unequipped item that can be dropped');
  item.location={kind:'drop',sourceAgentId:a.id,tick:s.tick,x:a.x,y:a.y};
  return item.id;
}

function qualifiedCrafterFixture({localNeed=true}={}){
  const s=rc2World(),consumer=s.agents[0],crafter=s.agents[1],stock=resourceStock(s,crafter);
  assert.equal(adoptProfession(crafter,'BUILD',s.tick).changed,true);
  Object.assign(stock,{food:900,wood:900,stone:900,ironIngot:120,steelIngot:90});
  crafter.hp=crafter.satiety=crafter.energy=100;crafter.task=null;

  // Build canonical completion evidence instead of fabricating Crafter qualification.
  craftFixtureItem(s,crafter,'HAMMER');
  craftFixtureItem(s,crafter,'HAMMER_T2');
  craftFixtureItem(s,crafter,'HAMMER');
  craftFixtureItem(s,crafter,'HAMMER_T2');
  craftFixtureItem(s,crafter,'HAMMER');
  assert.equal(recipeMastery(crafter,'HAMMER'),4);
  assert.equal(recipeMastery(crafter,'HAMMER_T2'),2);
  const promoted=command(s,'RC5_BECOME_CRAFTER',{agentId:crafter.id});
  assert.equal(promoted.ok,true,JSON.stringify(promoted));
  assert.equal(crafter.profession,'crafter');

  // Qualification leaves a full/near-full physical bag. A dropped fixture item is
  // still canonical Rust state and leaves one output slot for the ER3 proof.
  freeBagSlot(s,crafter);

  consumer.task=null;consumer.hp=consumer.satiety=consumer.energy=100;
  crafter.task=null;crafter.hp=crafter.satiety=crafter.energy=100;
  crafter.preference='BUILD'; // Crafter already carries HAMMER; no self-demand.
  consumer.preference=localNeed?'MINE':'FORAGE';
  consumer.x=crafter.x;consumer.y=crafter.y;

  if(localNeed){
    s.rustPossessions.items=s.rustPossessions.items.filter(i=>
      !(i.location?.kind==='bag'&&i.location.agentId===consumer.id&&i.kind==='STONE_PICKAXE'));
    s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>e.agentId!==consumer.id||
      s.rustPossessions.items.some(i=>i.id===e.itemId));
  }
  assert.deepEqual(validate(s),[]);
  return {s,consumer,crafter};
}

function addBuyOffer(s,crafter,{itemKind='STONE_PICKAXE',price=70,observe=true}={}){
  const merchant=s.agents.find(a=>a.id!==crafter.id);
  merchant.preference='FORAGE';merchant.task=null;merchant.hp=merchant.satiety=merchant.energy=100;
  const made=command(s,'RC4_CREATE_MARKET',{agentId:merchant.id});assert.equal(made.ok,true,JSON.stringify(made));
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,itemKind,unitPrice:price});assert.equal(offer.ok,true,JSON.stringify(offer));
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:merchant.id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  assert.equal(command(s,'RC4_OPEN_MARKET',{agentId:merchant.id,marketId:made.marketId}).ok,true);
  const projected=projectHomeMarketForTrade(s,s.homeMarkets,{marketId:made.marketId});assert.equal(projected.ok,true,JSON.stringify(projected));
  if(observe){
    crafter.x=projected.market.x;crafter.y=projected.market.y;crafter.task=null;
    observeRc4Markets(s);
    assert.ok(knownRc4BuyOffers(crafter).some(o=>o.offerId===offer.offerId));
  }
  return {merchant,offer,marketId:made.marketId,market:projected.market};
}

function er3Items(s,crafter,itemKind='STONE_PICKAXE'){
  return s.rustPossessions.items.filter(i=>i.createdBy===crafter.id&&i.kind===itemKind&&i.craft);
}

function runUntilOutput(s,crafter,{itemKind='STONE_PICKAXE',limit=240}={}){
  for(let i=0;i<limit;i++){
    step(s,1);
    const items=er3Items(s,crafter,itemKind);
    if(items.length)return items[items.length-1];
  }
  return null;
}

test('ER3 reads only ER1 actor-observed demand and proposes canonical CRAFT_ITEM data without mutation',()=>{
  const {s,crafter}=qualifiedCrafterFixture(),before=serialize(s);
  const snap=demandDrivenCrafterSnapshot(s,crafter),intent=demandDrivenCrafterIntent(s,crafter);
  assert.equal(ER3_CRAFTER_DEMAND_VERSION,'ER3-demand-crafter/1');
  assert.equal(snap.status,'READY_CRAFT');assert.equal(snap.reason,'observed-demand');
  assert.equal(snap.demand.itemKind,'STONE_PICKAXE');
  assert.equal(snap.recipeId,'STONE_PICKAXE');assert.equal(snap.tier,0);
  assert.deepEqual(intent,{agentId:crafter.id,recipeId:'STONE_PICKAXE'});
  assert.ok(Object.isFrozen(intent));
  assert.equal(serialize(s),before,'projection/intent must stay read-only');
});

test('ER3 hidden BuyOffer does not leak into Crafter production and stale observed offer expires',()=>{
  {
    const {s,crafter}=qualifiedCrafterFixture({localNeed:false});
    addBuyOffer(s,crafter,{itemKind:'EMBER_BLADE',observe:false});
    assert.equal(demandDrivenCrafterSnapshot(s,crafter).status,'IDLE','hidden offer must not become demand');
    assert.equal(demandDrivenCrafterIntent(s,crafter),null);
  }
  {
    const {s,crafter}=qualifiedCrafterFixture({localNeed:false});
    addBuyOffer(s,crafter,{itemKind:'EMBER_BLADE',observe:true});
    const knownMarket=knownRc4Markets(crafter)[0],knownOffer=knownRc4BuyOffers(crafter)[0];
    assert.ok(knownMarket&&knownOffer);
    const realMarket=crafter.rc4MarketKnowledge.knownMarkets.find(x=>x.marketId===knownMarket.marketId);
    const realOffer=crafter.rc4MarketKnowledge.knownBuyOffers.find(x=>x.offerId===knownOffer.offerId);
    realMarket.observedTick=s.tick-ECONOMIC_DEMAND_TTL_TICKS-1;
    realOffer.observedTick=s.tick-ECONOMIC_DEMAND_TTL_TICKS-1;
    const snap=demandDrivenCrafterSnapshot(s,crafter);
    assert.equal(snap.status,'IDLE');assert.equal(demandDrivenCrafterIntent(s,crafter),null);
  }
});

test('ER3 corrupt demand authority stays UNKNOWN instead of becoming idle PASS',()=>{
  const {s,crafter}=qualifiedCrafterFixture({localNeed:false});
  s.merchantBuyOffers={};
  const before=serialize(s),snap=demandDrivenCrafterSnapshot(s,crafter);
  assert.equal(snap.status,'UNKNOWN');assert.equal(snap.reason,'authority-invalid');
  assert.equal(demandDrivenCrafterIntent(s,crafter),null);
  assert.equal(serialize(s),before);
});

test('ER3 cannot craft an unknown demanded recipe and generic demand never jumps above real Crafter tier',()=>{
  {
    const {s,crafter}=qualifiedCrafterFixture({localNeed:false});
    addBuyOffer(s,crafter,{itemKind:'EMBER_BLADE',observe:true});
    const snap=demandDrivenCrafterSnapshot(s,crafter);
    assert.equal(snap.status,'BLOCKED');assert.equal(snap.reason,'recipe-unknown');
    assert.equal(demandDrivenCrafterIntent(s,crafter),null);
  }
  {
    const {s,consumer,crafter}=qualifiedCrafterFixture({localNeed:false});
    // Real T3 completions can unlock T4 knowledge while grade is still CRAFTER.
    for(let n=0;n<2;n++)craftFixtureItem(s,crafter,'HAMMER_T3');
    assert.ok(CRAFT_RECIPE_CATALOG.HAMMER_T4);assert.equal(crafter.profession,'crafter');
    consumer.preference='BUILD';
    consumer.x=crafter.x;consumer.y=crafter.y;
    s.rustPossessions.items=s.rustPossessions.items.filter(i=>
      !(i.location?.kind==='bag'&&i.location.agentId===consumer.id&&i.kind==='HAMMER'));
    s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>e.agentId!==consumer.id||
      s.rustPossessions.items.some(i=>i.id===e.itemId));
    freeBagSlot(s,crafter);
    const snap=demandDrivenCrafterSnapshot(s,crafter);
    assert.equal(snap.status,'READY_CRAFT');
    assert.equal(snap.demand.itemKind,'HAMMER');
    assert.equal(snap.recipeId,'HAMMER','generic demand must select the lowest known eligible tier');
    assert.notEqual(snap.recipeId,'HAMMER_T4','demand never overrides Crafter grade');
  }
});

test('ER3 missing station/materials/reserve fail closed and never mint inputs',()=>{
  {
    const {s,consumer,crafter}=qualifiedCrafterFixture({localNeed:false});
    consumer.preference='BUILD';consumer.x=crafter.x;consumer.y=crafter.y;
    s.rustPossessions.items=s.rustPossessions.items.filter(i=>
      !(i.location?.kind==='bag'&&i.location.agentId===consumer.id&&i.kind==='HAMMER'));
    s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>e.agentId!==consumer.id||
      s.rustPossessions.items.some(i=>i.id===e.itemId));
    s.rustStations.stations=s.rustStations.stations.filter(st=>st.kind!=='CRAFTING_TABLE_LV1');
    const snap=demandDrivenCrafterSnapshot(s,crafter);
    assert.equal(snap.status,'BLOCKED');assert.equal(snap.reason,'station');
  }
  {
    const {s,crafter}=qualifiedCrafterFixture(),stock=resourceStock(s,crafter);
    stock.wood=0;stock.stone=0;
    const before=serialize(s),snap=demandDrivenCrafterSnapshot(s,crafter);
    assert.equal(snap.status,'NEEDS_MATERIALS');assert.ok(Object.keys(snap.missing).length>0);
    assert.equal(snap.procurementRequired,true);assert.equal(demandDrivenCrafterIntent(s,crafter),null);
    assert.equal(serialize(s),before);
  }
  {
    const {s,crafter}=qualifiedCrafterFixture(),stock=resourceStock(s,crafter),r=CRAFT_RECIPE_CATALOG.STONE_PICKAXE;
    stock.wood=(r.materials.wood??0)+CRAFT_TRAINING_RULES.wood-1;stock.stone=900;stock.food=900;
    const before=serialize(s),snap=demandDrivenCrafterSnapshot(s,crafter);
    assert.equal(snap.status,'NEEDS_MATERIALS');assert.equal(snap.reason,'reserve');
    assert.equal(demandDrivenCrafterIntent(s,crafter),null);assert.equal(serialize(s),before);
  }
});

test('ER3 yields to survival, manual training, Adventure, current protected work and existing Rust work',()=>{
  const cases=[
    ['hunger',(s,a)=>a.satiety=CRAFT_TRAINING_RULES.satiety-1,'survival'],
    ['exhaustion',(s,a)=>a.energy=CRAFT_TRAINING_RULES.energy-1,'survival'],
    ['hp',(s,a)=>a.hp=CRAFT_TRAINING_RULES.hp-1,'survival'],
    ['manual',(s,a)=>a.craftTraining={version:'RC2-training/1',revision:1,enabled:true,recipeId:'HAMMER',startedTick:s.tick,startCompletions:recipeMastery(a,'HAMMER'),targetCompletions:recipeMastery(a,'HAMMER')+1},'manual-training'],
    ['adventure',(s,a)=>a.adventureEncounter={status:'READY'},'adventure'],
    ['task',(s,a)=>a.task={kind:'IDLE'},'task'],
  ];
  for(const [name,change,reason] of cases){
    const {s,crafter}=qualifiedCrafterFixture();change(s,crafter);
    const before=serialize(s),snap=demandDrivenCrafterSnapshot(s,crafter);
    assert.equal(snap.status,'BLOCKED',name);assert.equal(snap.reason,reason,name);
    assert.equal(demandDrivenCrafterIntent(s,crafter),null,name);assert.equal(serialize(s),before,name);
  }

  const {s,crafter}=qualifiedCrafterFixture();
  const intent=demandDrivenCrafterIntent(s,crafter);assert.ok(intent);
  assert.equal(command(s,'CRAFT_ITEM',intent).ok,true);
  const snap=demandDrivenCrafterSnapshot(s,crafter);
  assert.equal(snap.status,'BLOCKED');assert.equal(snap.reason,'craft-busy');
  assert.equal(demandDrivenCrafterIntent(s,crafter),null);
});

test('ER3 engine autonomously commits only through CRAFT_ITEM and creates one real physical deterministic item',()=>{
  const {s,crafter}=qualifiedCrafterFixture(),stock=resourceStock(s,crafter),r=CRAFT_RECIPE_CATALOG.STONE_PICKAXE;
  const beforeItems=s.rustPossessions.items.length,beforeWood=stock.wood,beforeStone=stock.stone,beforeOrder=s.rustPossessions.nextOrder;

  step(s,1);
  const order=s.rustPossessions.orders.find(o=>o.agentId===crafter.id);
  assert.ok(order,'engine must dispatch a canonical Rust craft order');
  assert.equal(order.id,beforeOrder);assert.equal(order.recipe,'STONE_PICKAXE');
  assert.equal(s.rustPossessions.items.length,beforeItems,'accepting CRAFT_ITEM must not mint output early');
  assert.equal(stock.wood,beforeWood-r.materials.wood);assert.equal(stock.stone,beforeStone-r.materials.stone);

  const item=runUntilOutput(s,crafter);
  assert.ok(item,'real work must complete to a physical output');
  assert.equal(item.kind,'STONE_PICKAXE');assert.equal(item.createdBy,crafter.id);
  assert.ok(Number.isSafeInteger(item.createdTick));assert.deepEqual(item.location,{kind:'bag',agentId:crafter.id});
  assert.equal(item.craft.orderId,order.id);assert.equal(item.craft.recipeId,'STONE_PICKAXE');
  assert.equal(validateCraftedItem(item,s.seed),true,'quality/provenance must validate through canonical craft authority');

  const itemCount=er3Items(s,crafter).length,nextOrder=s.rustPossessions.nextOrder;
  step(s,80);
  assert.equal(er3Items(s,crafter).length,itemCount,'owned physical supply covers the observed demand');
  assert.equal(s.rustPossessions.nextOrder,nextOrder,'same demand must not enqueue duplicate production');
  assert.deepEqual(validate(s),[]);
});

test('ER3 save/load mid-craft resumes one order and completed save/load never duplicates output',()=>{
  const {s,crafter}=qualifiedCrafterFixture();
  step(s,5);
  const order=s.rustPossessions.orders.find(o=>o.agentId===crafter.id);assert.ok(order);
  const orderId=order.id,nextOrder=s.rustPossessions.nextOrder;
  assert.equal(er3Items(s,crafter).filter(i=>i.craft?.orderId===orderId).length,0);

  const loaded=restore(serialize(s)),b=loaded.agents.find(a=>a.id===crafter.id);
  assert.equal(loaded.rustPossessions.orders.filter(o=>o.agentId===b.id).length,1);
  assert.equal(loaded.rustPossessions.nextOrder,nextOrder);
  const output=runUntilOutput(loaded,b);assert.ok(output);
  assert.equal(output.craft.orderId,orderId);
  assert.equal(er3Items(loaded,b).filter(i=>i.craft?.orderId===orderId).length,1);
  assert.equal(loaded.rustPossessions.orders.filter(o=>o.agentId===b.id).length,0);

  const completed=restore(serialize(loaded)),c=completed.agents.find(a=>a.id===b.id);
  const count=er3Items(completed,c).length,afterNext=completed.rustPossessions.nextOrder;
  step(completed,100);
  assert.equal(er3Items(completed,c).length,count);
  assert.equal(completed.rustPossessions.nextOrder,afterNext);
  assert.deepEqual(validate(completed),[]);
});

test('ER3 never overwrites Merchant/Adventurer profession and owns no money/market authority',()=>{
  for(const profession of ['merchant','adventurer']){
    const {s,crafter}=qualifiedCrafterFixture();
    setProfession(crafter,profession,profession==='adventurer'?'MINE':'FORAGE');
    const beforeWallet=JSON.stringify(s.currencyWallet),beforeListings=JSON.stringify(s.merchantListings),beforeOffers=JSON.stringify(s.merchantBuyOffers);
    const snap=demandDrivenCrafterSnapshot(s,crafter);
    assert.equal(snap.status,'INELIGIBLE',profession);assert.equal(demandDrivenCrafterIntent(s,crafter),null);
    assert.equal(crafter.profession,profession);
    assert.equal(JSON.stringify(s.currencyWallet),beforeWallet);
    assert.equal(JSON.stringify(s.merchantListings),beforeListings);
    assert.equal(JSON.stringify(s.merchantBuyOffers),beforeOffers);
  }
});

test('ER3 source is deterministic proposal-only and defines no second item/material/wallet/market/task authority',()=>{
  const source=fs.readFileSync(new URL('../src/demand-driven-crafter.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Math\.random|\bDate\b|document\.|window\.|fetch\(/);
  assert.doesNotMatch(source,/\.items\.push|\.orders\.push|addMaterialSet|consumeMaterialSet|currencyWallet\s*=|merchantListings\s*=|merchantBuyOffers\s*=|\.balance\s*[+\-]?=|profession\s*=(?!=)|\.task\s*=/);
  for(const token of ['crafterInventory','producerInventory','workshopInventory','factoryInventory','crafterMaterials','workshopMaterials','productionMaterials','crafterWallet','workshopWallet','productionWallet'])
    assert.equal(source.includes(token),false,token);
  assert.equal(source.includes("RC4_ACCEPT_BUY_OFFER"),false,'ER3 ends at production, not sale');
  assert.equal(source.includes("CRAFT_ITEM"),true,'policy documents the canonical commit boundary');
});
