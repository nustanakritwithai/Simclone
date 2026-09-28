import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorld,command,serialize,restore,step,validate,walkable} from '../src/engine.mjs';
import {CRAFT_RECIPE_CATALOG} from '../src/crafting-catalog.mjs';
import {craftBookSnapshot,renderCraftRecipeBook,renderCraftItemInfo,renderCraftItemActions,renderCraftTeaching,renderCraftTraining} from '../src/crafting-ui.mjs';
import {rc2World,craftFixtureItem,craftFixtureTable} from './fixtures/rc2-world.mjs';
import {mintAdventureGear} from '../src/rust-possessions.mjs';
import {personalHomeIntent} from '../src/individual-home-planning.mjs';
import {personalHomeSite} from '../src/individual-housing.mjs';
import {recipeMastery} from '../src/craft-recipe-knowledge.mjs';

test('RC2 book reads all 38 recipes and exactly nine legacy permissions without writes',()=>{
  const s=createWorld(42),a=s.agents[0],before=serialize(s),rows=craftBookSnapshot(s,a);assert.equal(rows.length,38);assert.equal(rows.filter(r=>r.known).length,9);assert.deepEqual(rows.map(r=>r.recipeId),Object.keys(CRAFT_RECIPE_CATALOG));
  const html=renderCraftRecipeBook(s,a);assert.equal((html.match(/data-ux="craft-item"/g)??[]).length,38);assert.equal((html.match(/data-craft-tier=/g)??[]).length,6);
  assert.equal(serialize(s),before);assert.ok(Object.isFrozen(rows)&&rows.every(Object.isFrozen));
});
test('RC2 actual fixture preserves personal recipes, item outcomes and household authority',()=>{
  const s=rc2World(),[a,b]=s.agents,one=craftBookSnapshot(s,a),two=craftBookSnapshot(s,b),before=serialize(s);
  assert.equal(one.find(r=>r.recipeId==='STONE_AXE_T1').known,true);assert.equal(two.find(r=>r.recipeId==='STONE_AXE_T1').known,false);
  for(const person of s.agents){renderCraftRecipeBook(s,person);renderCraftTraining(s,person);renderCraftTeaching(s,person);}
  assert.equal(serialize(s),before);assert.deepEqual(validate(s),[]);assert.equal(serialize(restore(serialize(s))),serialize(s));
});
test('RC2 station book contains only the 30 actual table recipes and pins manual station selection',()=>{
  const s=rc2World(),a=s.agents[0],st=s.rustStations.stations.find(x=>x.placedBy===a.id&&x.kind==='CRAFTING_TABLE_LV1');
  const html=renderCraftRecipeBook(s,a,{stationKind:st.kind,stationId:st.id});assert.equal((html.match(/data-ux="craft-item"/g)??[]).length,30);
  assert.ok(!html.includes('data-recipe-id="STONE_AXE"'));assert.ok(html.includes('data-recipe-id="STONE_AXE_T1"'));assert.equal((html.match(new RegExp('data-station="'+st.id+'"','g'))??[]).length,30);
});
test('RC2 item presentation uses stored outcomes and createdBy, never rerolls',()=>{
  const s=rc2World(),item=s.rustPossessions.items.find(i=>i.kind==='HIDE_ARMOR'),before=serialize(s),html=renderCraftItemInfo(s,item);
  assert.ok(html.includes('data-craft-quality="'+item.craft.quality+'"'));assert.ok(html.includes('สร้างโดย '+s.agents[0].name));assert.ok(html.includes('Order #'+item.craft.orderId));
  for(const a of item.craft.abilities)assert.ok(html.includes(a.kind+' +'+a.value));assert.equal(renderCraftItemInfo(s,item),html);assert.equal(serialize(s),before);
  const legacy={...item};delete legacy.craft;assert.ok(renderCraftItemInfo(s,legacy).includes('data-craft-quality="legacy"'));
  const corrupt=structuredClone(item);corrupt.craft.quality++;assert.ok(renderCraftItemInfo(s,corrupt).includes('data-craft-quality="invalid"'));
});
test('RC2 names and provenance are escaped, never treated as HTML',()=>{
  const s=rc2World(),a=s.agents[0];a.name='<img src=x onerror=alert(1)>"';const item=s.rustPossessions.items.find(i=>i.createdBy===a.id);
  for(const html of [renderCraftRecipeBook(s,a),renderCraftItemInfo(s,item),renderCraftTeaching(s,s.agents[1])]){assert.ok(!html.includes('<img'));assert.ok(!html.includes('value="<'));}
  assert.ok(renderCraftItemInfo(s,item).includes('&lt;img'));
});
test('RC2 gear and materials never get structure placement actions',()=>{
  const s=rc2World(),a=s.agents[0];
  assert.match(renderCraftItemActions(s,a,s.rustPossessions.items.find(i=>i.kind==='HIDE_ARMOR')),/equip-craft-gear/);
  assert.doesNotMatch(renderCraftItemActions(s,a,{id:99,kind:'HIDE'}),/place-station|equip/);
  assert.match(renderCraftItemActions(s,a,{id:99,kind:'WOOD_WALL'}),/place-station/);
  assert.match(renderCraftItemActions(s,a,s.rustPossessions.items.find(i=>i.kind==='HAMMER'&&i.createdBy===a.id)),/unequip-item/);
});
test('RC2 equip actions use the shared equipment ledger and keep the hand slot',()=>{
  const s=rc2World(),a=s.agents[0],armor=s.rustPossessions.items.find(i=>i.kind==='HIDE_ARMOR'),hand=s.rustPossessions.equipment.find(e=>e.agentId===a.id);
  const result=command(s,'EQUIP_ADVENTURE_GEAR',{agentId:a.id,itemId:armor.id});assert.equal(result.ok,true);assert.match(result.message,/ผจญภัย/);assert.doesNotMatch(result.message,/ถ่าน/);
  assert.deepEqual(s.rustPossessions.equipment.find(e=>e.agentId===a.id&&(e.slot??'hand')==='hand'),hand);
  assert.match(renderCraftItemActions(s,a,armor),/unequip-craft-gear/);assert.deepEqual(validate(s),[]);
});
test('RC2 real teaching UI model includes only known recipes and nearby students',()=>{
  const s=rc2World(),[a,b]=s.agents,html=renderCraftTeaching(s,a);assert.match(html,/id="rc2-teach-student"/);assert.ok(html.includes('value="'+b.id+'"'));
  assert.ok(html.includes('value="STONE_AXE_T1"'));assert.ok(!html.includes('value="STONE_AXE_T5"'));
  assert.equal(command(s,'TEACH_CRAFT_RECIPE',{teacherId:a.id,studentId:b.id,recipeId:'STONE_AXE_T1'}).ok,true);
  assert.ok(renderCraftRecipeBook(s,b).includes('เรียนจาก '+a.name));assert.equal(recipeMastery(b,'STONE_AXE_T1'),0);
  b.x=a.x+9;assert.ok(!renderCraftTeaching(s,a).includes('id="rc2-teach-student"'));
});
test('RC2 hand-slot regression: armor first must not hide equipped hammer from housing',()=>{
  const s=createWorld(230926),a=s.agents[0];s.stock.wood=s.stock.stone=500;craftFixtureTable(s,a);
  const gear=mintAdventureGear(s,{agentId:a.id,gearId:'HIDE_ARMOR',sourceKey:'rc2-hand-regression'});assert.equal(gear.ok,true);
  assert.equal(command(s,'EQUIP_ADVENTURE_GEAR',{agentId:a.id,itemId:gear.itemId}).ok,true);
  const hammer=craftFixtureItem(s,a,'HAMMER');assert.equal(command(s,'EQUIP_ITEM',{agentId:a.id,itemId:hammer.id}).ok,true);
  const site=personalHomeSite(s,a,walkable);a.x=site.origin.x;a.y=site.origin.y;
  const foundation=craftFixtureItem(s,a,'WOOD_FOUNDATION');
  assert.equal(personalHomeIntent(s,a,walkable).kind,'PLACE_PIECE');
  const placed=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:foundation.id,socket:{type:'cell',...site.origin},placementId:'rc2-hand:'+foundation.id});assert.equal(placed.ok,true,JSON.stringify(placed));
  assert.deepEqual(validate(s),[]);
});
test('RC2 presentation contains no gameplay writer or hidden random output generator',()=>{
  const source=fs.readFileSync(new URL('../src/crafting-ui.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/Math\.random|\bDate\b|\.items\.push|\.orders\.push|resolveCraftOutcome|createCraftSpec/);
});
