import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {advanceCraft,craftPreview,toolMultiplier,grantAdventureLoot} from '../src/rust-possessions.mjs';
import {recipeById,ITEM_CATALOG} from '../src/crafting-catalog.mjs';
import {recipeMastery,knowsCraftRecipe,craftFamilyMastery} from '../src/craft-recipe-knowledge.mjs';
import {createCraftSpec,resolveCraftOutcome,validateCraftedItem,CRAFT_ABILITY_BOUNDS,craftedToolMultiplier} from '../src/craft-outcome.mjs';
import {adventureCombatLoadoutSnapshot,validateAdventureCombatLoadoutSnapshot} from '../src/adventure-equipment-bridge.mjs';
import {neutralAdventurerCombatProfile,neutralAdventurerCoreStatsAtLevel} from '../src/adventure-human-combat.mjs';
import {startAdventureCombatSession} from '../src/adventure-combat-session.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
function fresh(seed=230926){const s=createWorld(seed);s.stock.wood=500;s.stock.stone=500;s.rustMaterials.charcoal=100;s.rustMaterials.ironOre=100;s.rustMaterials.ironIngot=100;s.rustMaterials.steelIngot=90;return s;}
function finish(s,a){let result;const o=s.rustPossessions.orders.find(o=>o.agentId===a.id);assert.ok(o);for(let i=0;i<o.required+2;i++){s.tick++;result=advanceCraft(s,a.id);if(result.completed)break;}assert.equal(result.completed,true,JSON.stringify(result));return s.rustPossessions.items.find(x=>x.id===result.itemId);}
function craft(s,a,recipeId){const q=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId});assert.equal(q.ok,true,JSON.stringify(q));return finish(s,a);}
function stow(s,item){item.location={kind:'drop',sourceAgentId:item.createdBy,tick:s.tick,x:s.agents[0].x,y:s.agents[0].y};}
function table(s,a){const i=craft(s,a,'CRAFTING_TABLE_LV1');const pos=[[0,-1],[-1,0],[1,0],[0,1]].map(([dx,dy])=>({x:a.x+dx,y:a.y+dy})).find(p=>walkable(s,p.x,p.y)&&!s.nodes.some(n=>n.x===p.x&&n.y===p.y)&&!s.buildings.some(b=>b.x===p.x&&b.y===p.y));assert.ok(pos);assert.equal(command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:i.id,...pos}).ok,true);a.x=pos.x;a.y=pos.y;}
function materials(s,a,kind,quantity=1){const r=grantAdventureLoot(s,{agentId:a.id,claimKey:'fixture:'+s.rustPossessions.nextItem,items:[{itemKind:kind,quantity,rarity:ITEM_CATALOG[kind].rarity}]});assert.equal(r.ok,true);return r.itemIds;}
function learnArmor(s,a){stow(s,craft(s,a,'WOOD_WALL'));stow(s,craft(s,a,'WOOD_WALL'));assert.equal(knowsCraftRecipe(s,a,'HIDE_ARMOR'),true);}
function generated({orderId=1,recipeId='STONE_AXE',mastery=0,creatorId=1,worldSeed=42}={}){const spec=createCraftSpec({worldSeed,orderId,creatorId,recipeId,mastery});return resolveCraftOutcome({spec,orderId,creatorId,recipeId});}

test('RC2 outcome is frozen and deterministic for the same accepted ticket',()=>{
  const c=generated();assert.deepEqual(generated(),c);assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.abilities));
  assert.equal(c.tier,0);assert.ok(c.quality>=30&&c.quality<=60);
  assert.equal(validateCraftedItem({id:1,kind:'STONE_AXE',createdBy:1,craft:c},42),true);
});
test('RC2 independent orders vary while invalid tickets never resolve',()=>{
  const rows=Array.from({length:32},(_,i)=>generated({orderId:i+1}));
  assert.ok(new Set(rows.map(x=>x.quality)).size>10);assert.equal(new Set(rows.map(x=>x.ticket)).size,32);
  for(const input of [{mastery:-1},{mastery:65536},{worldSeed:-1},{orderId:0},{creatorId:0},{recipeId:'constructor'}])assert.throws(()=>generated(input));
});
test('RC2 expertise improves the quality distribution without guaranteeing perfect output',()=>{
  const novice=[],expert=[];for(let i=1;i<=100;i++){novice.push(generated({orderId:i}).quality);expert.push(generated({orderId:i,mastery:40}).quality);}
  assert.ok(Math.max(...novice)<=60&&Math.min(...expert)>=70);
  assert.ok(expert.some(x=>x<100));assert.ok(expert.reduce((a,b)=>a+b,0)>novice.reduce((a,b)=>a+b,0));
});
test('RC2 tier and abilities obey real category consumers and explicit bounds',()=>{
  for(const recipeId of ['STONE_AXE','STONE_AXE_T5','HAMMER_T5','WOOD_WALL','HIDE_ARMOR_T5','EMBER_BLADE_T5','EMBER_CHARM_T5'])for(let orderId=1;orderId<=40;orderId++){
    const r=recipeById(recipeId),c=generated({recipeId,orderId,mastery:30});assert.equal(c.tier,r.tier);
    const allowed=r.category==='tool'?['WORK_SPEED_BPS']:r.category==='build'?[]:r.output==='HIDE_ARMOR'?['DEF','SPDEF','HP']:r.output==='EMBER_BLADE'?['ATK','SPATK','SPD']:['SPATK','SPD','HP'];
    assert.ok(c.abilities.every(a=>allowed.includes(a.kind)&&Number.isInteger(a.value)&&a.value>0&&a.value<=CRAFT_ABILITY_BOUNDS[a.kind]));
    assert.equal(new Set(c.abilities.map(a=>a.kind)).size,c.abilities.length);
    if(r.category==='build')assert.deepEqual(c.abilities,[]);
  }
});
test('RC2 changing creator, recipe, quality, trait, tier or seed invalidates a crafted item',()=>{
  const item={id:1,kind:'STONE_AXE',createdBy:1,craft:generated()};
  for(const fn of [x=>x.createdBy=2,x=>x.kind='HAMMER',x=>x.craft.quality++,x=>x.craft.tier++,x=>x.craft.worldSeed++,x=>x.craft.abilities[0].value++,x=>x.craft.abilities.push(x.craft.abilities[0]),x=>x.craft.extra=1]){
    const changed=copy(item);fn(changed);assert.equal(validateCraftedItem(changed,42),false);
  }
});
test('RC2 accepted work freezes mastery and never touches the shared simulation RNG',()=>{
  const s=fresh(),a=s.agents[0],rng=s.rng;
  const q=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'});assert.equal(q.ok,true);
  const o=s.rustPossessions.orders[0];assert.equal(o.craftSpec.mastery,0);assert.ok(Object.isFrozen(o.craftSpec));
  const item=finish(s,a);assert.equal(item.craft.mastery,0);assert.equal(recipeMastery(a,'STONE_AXE'),1);assert.equal(s.rng,rng);
});
test('RC2 save-load and unrelated RNG/time/item-allocation changes never reroll accepted output',()=>{
  const s=fresh(),a=s.agents[0];command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'});
  for(let i=0;i<10;i++){s.tick++;advanceCraft(s,a.id);}
  const other=restore(serialize(s));other.rng=12345;other.tick+=17;
  materials(other,other.agents[1],'HIDE');
  const x=finish(s,a),y=finish(other,other.agents[0]);assert.notEqual(x.id,y.id);assert.notEqual(x.createdTick,y.createdTick);assert.deepEqual(x.craft,y.craft);
});
test('RC2 real tool quality reaches toolMultiplier and authoritative work progress',()=>{
  const s=fresh(),a=s.agents[1],tool=craft(s,a,'STONE_AXE');
  assert.equal(command(s,'EQUIP_ITEM',{agentId:a.id,itemId:tool.id}).ok,true);
  const bps=tool.craft.abilities[0].value;assert.equal(toolMultiplier(s,a.id,'WOODCUT'),1.25*(10000+bps)/10000);
  assert.equal(toolMultiplier(s,a.id,'MINE'),1);
  const legacy=copy(tool);delete legacy.craft;assert.equal(craftedToolMultiplier(legacy,1.25),1.25);
  assert.deepEqual(validate(s),[]);
  const legacyWorld=restore(serialize(s)),generatedWorld=restore(serialize(s));
  delete legacyWorld.rustPossessions.items.find(i=>i.id===tool.id).craft;
  const progress=[];
  for(const world of [legacyWorld,generatedWorld]){
    const actor=world.agents[1],node=world.nodes.find(n=>n.type==='wood'&&n.amount>0);
    actor.x=node.x;actor.y=node.y;actor.satiety=100;actor.energy=100;
    actor.task={kind:'WOODCUT',targetId:node.id,x:node.x,y:node.y,path:[],work:0,score:1,started:world.tick,policy:'survival-0.2'};
    step(world,1);progress.push(actor.task.work);
  }
  assert.ok(progress[1]>progress[0]);assert.equal(progress[1],progress[0]*(10000+bps)/10000);
});
test('RC2 upgrading consumes one owned unequipped tool once; forged ownership cannot spend',()=>{
  const s=fresh(),a=s.agents[0],b=s.agents[1];const one=craft(s,a,'STONE_AXE'),two=craft(s,a,'STONE_AXE');table(s,a);
  one.location={kind:'bag',agentId:b.id};command(s,'EQUIP_ITEM',{agentId:a.id,itemId:two.id});
  let before=serialize(s);assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE_T1'}).reason,'item-materials');assert.equal(serialize(s),before);
  command(s,'UNEQUIP_ITEM',{agentId:a.id});const wood=s.stock.wood,stone=s.stock.stone;
  const q=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE_T1'});assert.equal(q.ok,true);assert.deepEqual(q.ingredientIds,[two.id]);
  assert.equal(s.rustPossessions.items.some(i=>i.id===two.id),false);assert.ok(s.rustPossessions.items.some(i=>i.id===one.id));
  const costs=recipeById('STONE_AXE_T1').materials;assert.equal(s.stock.wood,wood-costs.wood);assert.equal(s.stock.stone,stone-costs.stone);
  before=serialize(s);assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE_T1'}).reason,'craft-busy');assert.equal(serialize(s),before);
  const item=finish(s,a);assert.equal(item.craft.tier,1);assert.equal(item.createdBy,a.id);assert.equal(s.stock.wood,wood-costs.wood);assert.deepEqual(validate(s),[]);
});
test('RC2 missing or pending loot-result ingredients cannot be consumed',()=>{
  const s=fresh(),a=s.agents[0];learnArmor(s,a);table(s,a);
  let before=serialize(s);assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'HIDE_ARMOR'}).reason,'item-materials');assert.equal(serialize(s),before);
  const [id]=materials(s,a,'HIDE');a.adventureCombat={status:'VICTORY',lootClaim:{itemIds:[id]}};
  before=serialize(s);assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'HIDE_ARMOR'}).reason,'item-materials');assert.equal(serialize(s),before);
  a.adventureCombat=null;assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'HIDE_ARMOR'}).ok,true);
  assert.equal(s.rustPossessions.items.some(i=>i.id===id),false);
});
test('RC2 full bag at completion holds original order, costs, ticket and mastery until a slot exists',()=>{
  const s=fresh(),a=s.agents[0];command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'});const spec=copy(s.rustPossessions.orders[0].craftSpec),stock=copy(s.stock);
  for(let i=0;i<23;i++){s.tick++;advanceCraft(s,a.id);}
  materials(s,a,'HIDE',4);s.tick++;let before=serialize(s);
  assert.equal(advanceCraft(s,a.id).reason,'output-capacity');assert.equal(serialize(s),before);assert.equal(recipeMastery(a,'STONE_AXE'),0);
  stow(s,s.rustPossessions.items[0]);const done=advanceCraft(s,a.id);assert.equal(done.completed,true);
  const item=s.rustPossessions.items.find(i=>i.id===done.itemId);assert.equal(item.craft.ticket,spec.ticket);assert.equal(recipeMastery(a,'STONE_AXE'),1);assert.deepEqual(s.stock,stock);
  before=serialize(s);assert.equal(advanceCraft(s,a.id).reason,'order');assert.equal(serialize(s),before);assert.deepEqual(validate(s),[]);
});
test('RC2 ingredient escrow survives reload and never appears in active inventory twice',()=>{
  const s=fresh(),a=s.agents[0];craft(s,a,'STONE_AXE');craft(s,a,'STONE_AXE');table(s,a);
  command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE_T1'});const loaded=restore(serialize(s));assert.equal(serialize(loaded),serialize(s));
  const reserved=loaded.rustPossessions.orders[0].reservedItems[0];assert.equal(loaded.rustPossessions.items.some(i=>i.id===reserved.itemId),false);
  finish(s,a);finish(loaded,loaded.agents[0]);assert.equal(serialize(s),serialize(loaded));
});
test('RC2 corrupt order spec/escrow fails without partial completion or output',()=>{
  const s=fresh(),a=s.agents[0];command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'});
  for(const fn of [o=>o.craftSpec.ticket='00000000',o=>o.reserved.wood=0,o=>o.required=1,o=>o.reservedItems.push({itemId:999,kind:'HIDE',createdBy:1})]){
    const changed=copy(s);fn(changed.rustPossessions.orders[0]);changed.tick++;
    const before=serialize(changed);assert.equal(advanceCraft(changed,a.id).ok,false);assert.equal(serialize(changed),before);assert.throws(()=>restore(before));
  }
});
test('RC2 crafted item metadata is validated at restore, including duplicate completion identity',()=>{
  const s=fresh(),a=s.agents[0];craft(s,a,'STONE_AXE');
  for(const fn of [x=>x.rustPossessions.items[0].craft.quality++,x=>x.rustPossessions.items[0].craft.worldSeed++,x=>{const i=copy(x.rustPossessions.items[0]);i.id=x.rustPossessions.nextItem++;x.rustPossessions.items.push(i);}]){
    const changed=copy(s);fn(changed);assert.throws(()=>restore(serialize(changed)));
  }
});
test('RC2 old items and old in-flight orders keep legacy stats without retrospective rolls',()=>{
  const s=fresh(),a=s.agents[0];command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'});
  const o=s.rustPossessions.orders[0];delete o.craftSpec;delete o.reservedItems;
  const item=finish(s,a);assert.equal(item.craft,undefined);assert.equal(recipeMastery(a,'STONE_AXE'),1);
  command(s,'EQUIP_ITEM',{agentId:a.id,itemId:item.id});assert.equal(toolMultiplier(s,a.id,'WOODCUT'),1.25);
  const once=serialize(s);assert.equal(serialize(restore(once)),once);
});
test('RC2 real crafted armor uses bounded abilities in the existing gear bridge without healing',()=>{
  const s=fresh(),a=s.agents[0];learnArmor(s,a);table(s,a);materials(s,a,'HIDE');const armor=craft(s,a,'HIDE_ARMOR');
  assert.equal(armor.upgradeLevel,0);assert.equal(armor.craft.tier,1);a.hp=50;
  assert.equal(command(s,'EQUIP_ADVENTURE_GEAR',{agentId:a.id,itemId:armor.id}).ok,true);
  const expected={ATK:0,DEF:6,SPATK:0,SPDEF:3,SPD:0,HP:12};for(const b of armor.craft.abilities)expected[b.kind]+=b.value;
  const loadout=adventureCombatLoadoutSnapshot(s,a.id);assert.deepEqual(loadout.modifiers,expected);assert.deepEqual(validateAdventureCombatLoadoutSnapshot(loadout),[]);
  const profile=neutralAdventurerCombatProfile(a,20,loadout.modifiers),base=neutralAdventurerCoreStatsAtLevel(20);
  assert.equal(profile.hpMax,base.hp+expected.HP);assert.equal(profile.hpCurrent,Math.floor(profile.hpMax/2));assert.equal(a.hp,50);
  assert.deepEqual(validate(s),[]);assert.equal(serialize(restore(serialize(s))),serialize(s));
});
test('RC2 active combat retains frozen crafted loadout and cannot change or consume equipped armor',()=>{
  const s=fresh(),a=s.agents[0];learnArmor(s,a);table(s,a);materials(s,a,'HIDE');const armor=craft(s,a,'HIDE_ARMOR');
  command(s,'EQUIP_ADVENTURE_GEAR',{agentId:a.id,itemId:armor.id});a.profession='adventurer';a.task=null;
  const e={status:'READY',encounterId:'rc2-fixture',expeditionId:'rc2-exp',zoneId:'z1',monsterId:'MON_002',monsterLevel:1,rank:'normal',adventureLevel:20,x:a.x,y:a.y};
  a.adventureCombat=startAdventureCombatSession(s,a,e);const before=JSON.stringify(a.adventureCombat.loadout);
  assert.ok(Object.isFrozen(a.adventureCombat.loadout.items[0].craft));
  assert.equal(command(s,'UNEQUIP_ADVENTURE_GEAR',{agentId:a.id,slot:'ARMOR'}).reason,'combat-active');
  assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'}).reason,'combat-active');assert.equal(JSON.stringify(a.adventureCombat.loadout),before);
});
test('RC2 preview is read-only, including selected ingredient IDs and missing requirements',()=>{
  const s=fresh(),a=s.agents[0];craft(s,a,'STONE_AXE');craft(s,a,'STONE_AXE');table(s,a);const before=serialize(s);
  const p=craftPreview(s,{agentId:a.id,recipeId:'STONE_AXE_T1'});assert.equal(p.ok,true);assert.equal(p.ingredientIds.length,1);
  p.materials.wood=999;p.ingredientIds.push(999);assert.equal(serialize(s),before);
});
test('RC2 full tier chain uses existing materials/items and verifies earned mastery at each tier',()=>{
  const s=fresh(),a=s.agents[0];craft(s,a,'STONE_AXE');craft(s,a,'STONE_AXE');table(s,a);
  for(let tier=1;tier<=5;tier++){
    assert.equal(knowsCraftRecipe(s,a,'STONE_AXE_T'+tier),true);
    for(let n=0;n<2;n++){const item=craft(s,a,'STONE_AXE_T'+tier);assert.equal(item.craft.tier,tier);assert.ok(item.craft.quality>=30);}
    assert.equal(recipeMastery(a,'STONE_AXE_T'+tier),2);assert.deepEqual(validate(s),[]);
  }
  assert.equal(craftFamilyMastery(a,'STONE_AXE_T5'),12);assert.equal(s.rustPossessions.items.filter(i=>i.kind==='STONE_AXE').length,2);
});
test('RC2 output module has no external clock, browser or global RNG writes',()=>{
  const src=fs.readFileSync(new URL('../src/craft-outcome.mjs',import.meta.url),'utf8');
  for(const token of ['Math.random','Date.now','new Date','document.','window.','state.rng','s.rng'])assert.equal(src.includes(token),false,token);
});


test('RC2 children cannot queue or advance a crafted output even outside Independent mode',()=>{
  const s=fresh(),a=s.agents[0];a.life={anchorTick:0,ageAtAnchorYears:8};const before=serialize(s);
  assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'}).reason,'stage');assert.equal(serialize(s),before);
});
