import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,step,command,serialize,restore,validate,walkable,birthPlan,capacity} from '../src/engine.mjs';
import {materialStock,materialTotals,guardianOf,isIndependent} from '../src/individual-resources.mjs';
import {individualHouses,homeOf,personalHomeSite,survivalHome} from '../src/individual-housing.mjs';
import {canPlaceStation,stationForRecipe,stationLimit} from '../src/rust-stations.mjs';
import {taskValid,pathTo,RULES} from '../src/survival.mjs';
const fresh=(seed=230926,population=6)=>createWorld(seed,{mode:'independent',population});
let builtText;
function earnedWorld(){if(!builtText){const s=fresh();step(s,2400);assert.equal(individualHouses(s).filter(h=>h.complete).length,6);builtText=serialize(s);}return restore(builtText);}

test('IC3 fresh world has no central Camp, no shared stock, and separated living founders',()=>{
 const s=fresh();assert.equal(s.version,'0.6.0');assert.equal(s.worldMode.kind,'independent');assert.deepEqual(s.buildings,[]);assert.equal(capacity(s),0);
 assert.deepEqual(s.stock,{food:0,wood:0,stone:0});assert.deepEqual(materialTotals(s),{food:28,wood:24,stone:12});
 assert.equal(s.rustPossessions.items.length,0);assert.equal(s.rustStations.stations.length,0);
 for(const a of s.agents)for(const b of s.agents)if(a.id!==b.id)assert.ok(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)>=5);
 assert.equal(s.planningPolicy,'personal-knowledge-1');assert.deepEqual(validate(s),[]);
});
test('IC3 exact same-seed start and invalid mode/population contracts',()=>{
 assert.equal(serialize(fresh()),serialize(fresh()));
 assert.throws(()=>createWorld(1,{mode:'unknown'}));assert.throws(()=>fresh(1,0));assert.throws(()=>fresh(1,7));
});
for(const seed of [230926,1,42,7,9191])test(`IC3 real no-command six-owner housing loop: seed ${seed}`,()=>{
 const s=fresh(seed),founders=s.agents.map(a=>a.id);step(s,2400);
 const homes=individualHouses(s).filter(h=>h.complete);
 assert.equal(homes.length,6,JSON.stringify({seed,homes,goal:s.productionPlan.goal}));
 assert.deepEqual(homes.map(h=>h.ownerId).sort((a,b)=>a-b),founders);
 assert.ok(s.agents.filter(a=>founders.includes(a.id)).every(a=>a.alive));
 assert.equal(s.productionPlan.enabled,false,'no opt-in RP1 needed in independent mode');
 assert.equal(new Set(s.rustStations.stations.map(st=>st.sourceItemId)).size,s.rustStations.stations.length);
 for(const id of founders){assert.equal(s.rustStations.stations.filter(st=>st.placedBy===id&&st.kind==='CRAFTING_TABLE_LV1').length,1);assert.equal(s.rustPossessions.items.filter(i=>i.kind==='HAMMER'&&i.createdBy===id).length,1);}
 assert.deepEqual(s.stock,{food:0,wood:0,stone:0});assert.deepEqual(validate(s),[]);
});
test('IC3 one Original can survive, bootstrap a workbench and complete own home',()=>{
 const s=fresh(230926,1);step(s,2400);assert.equal(homeOf(s,1).complete,true);assert.equal(s.agents[0].alive,true);assert.deepEqual(validate(s),[]);
});
test('IC3 inventory is private: one rich Clone cannot pay another persons craft',()=>{
 const s=fresh(),a=s.agents[0],b=s.agents[1];Object.assign(materialStock(s,a),{wood:0,stone:0});Object.assign(materialStock(s,b),{wood:100,stone:100});
 const before=serialize(s);assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_AXE'}).reason,'materials');assert.equal(serialize(s),before);
 assert.equal(command(s,'CRAFT_ITEM',{agentId:b.id,recipeId:'STONE_AXE'}).ok,true);assert.equal(materialStock(s,b).wood,96);assert.equal(materialStock(s,a).wood,0);assert.equal(s.stock.wood,0);
});
test('IC3 pending order acceptance commits materials exactly once and retry cannot duplicate',()=>{
 const s=fresh(),a=s.agents[0];Object.assign(materialStock(s,a),{wood:20,stone:10});
 const r=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'CRAFTING_TABLE_LV1'});assert.equal(r.ok,true);
 const snapshot=serialize(s);assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'CRAFTING_TABLE_LV1'}).reason,'craft-busy');assert.equal(serialize(s),snapshot);assert.equal(materialStock(s,a).wood,10);
});
test('IC3 another persons workbench does not satisfy personal Hammer crafting',()=>{
 const s=earnedWorld(),a=s.agents[0],other=s.rustStations.stations.find(st=>st.kind==='CRAFTING_TABLE_LV1'&&st.placedBy!==a.id);
 assert.equal(stationForRecipe(s,'HAMMER',a,other.id),null);
 assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'HAMMER',stationId:other.id}).reason,'station');
});
test('IC3 unfinished personal plan stays at same site while actor moves and after save/load',()=>{
 const s=fresh();step(s,100);const a=s.agents.find(a=>a.homePlan);assert.ok(a);
 const remembered={x:a.homePlan.x,y:a.homePlan.y};a.x+=walkable(s,a.x+1,a.y)?1:0;
 assert.deepEqual(personalHomeSite(s,a,walkable).origin,remembered);
 const copy=restore(serialize(s));assert.deepEqual(personalHomeSite(copy,copy.agents.find(x=>x.id===a.id),walkable).origin,remembered);
});
test('IC3 mid-craft save/load continues byte-identically in single and batched ticks',()=>{
 const s=fresh();step(s,180);assert.ok(s.rustPossessions.orders.length>0);
 const a=restore(serialize(s)),b=restore(serialize(s));step(a,650);for(let i=0;i<650;i++)step(b);assert.equal(serialize(a),serialize(b));assert.deepEqual(validate(a),[]);
});
test('IC3 completed personal house is the owners real REST/EAT target, not a stranger home',()=>{
 const s=earnedWorld(),a=s.agents[0],home=survivalHome(s,a);assert.equal(home.ownerId,a.id);
 const stranger=homeOf(s,s.agents[1].id);assert.notEqual(home.houseId,stranger.houseId);
 a.x=home.x;a.y=home.y;a.task=null;a.energy=0;a.satiety=100;step(s);
 assert.equal(a.task.kind,'REST');assert.equal(a.task.homeId,home.houseId);assert.equal(a.task.fieldRest,false);assert.equal(taskValid(s,a),true);
 a.task=null;a.satiety=30;a.energy=100;materialStock(s,a).food=10;const f=materialStock(s,a).food;step(s,4);assert.ok(materialStock(s,a).food<f);assert.ok(a.satiety>30);
});
test('IC3 birth is allowed without ANY global house capacity, charged only to a ready parent',()=>{
 const s=fresh();s.tick=360;const a=s.agents[0];Object.assign(materialStock(s,a),{food:40,wood:20});
 const before=serialize(s),plan=birthPlan(s,0);assert.equal(capacity(s),0);assert.equal(plan.ok,true);assert.equal(plan.parentId,a.id);assert.equal(plan.capacityKind,'safety-limit');assert.equal(serialize(s),before);
 materialStock(s,a).food=0;assert.equal(birthPlan(s,999999).ok,false,'global free-food argument cannot fund personal birth');
});
test('IC3 autonomous child uses evidence-based guardian and never performs construction',()=>{
 const s=earnedWorld(),child=s.agents.find(a=>a.life.ageAtAnchorYears===0);assert.ok(child);
 const g=guardianOf(s,child);assert.equal(g.id,child.parentId);assert.equal(survivalHome(s,child).ownerId,g.id);
 const before=serialize(s);assert.equal(command(s,'CRAFT_ITEM',{agentId:child.id,recipeId:'WOOD_FOUNDATION'}).reason,'stage');assert.equal(serialize(s),before);
 for(let i=0;i<40;i++){step(s);assert.ok(!['BUILD','CRAFT','FORAGE','WOODCUT','MINE'].includes(child.task?.kind));}
});
test('IC3 child food access requires actual guardian position, not remote inventory teleportation',()=>{
 const s=earnedWorld(),child=s.agents.find(a=>a.life.ageAtAnchorYears===0),g=guardianOf(s,child);
 child.task={kind:'EAT',targetId:g.id,x:g.x,y:g.y,path:pathTo(s,child,g),work:0,policy:RULES.jobPolicy,started:s.tick,mealOwnerId:g.id,guardianId:g.id,fieldEat:false};
 materialStock(s,g).food=20;assert.equal(taskValid(s,child),true);
 g.x+=walkable(s,g.x+1,g.y)?1:-1;assert.equal(taskValid(s,child),false,'moved guardian requires replanning');
});
test('IC3 private material state missing, negative, duplicated or mixed with old schema is rejected',()=>{
 const s=fresh();for(const breakIt of [x=>delete x.rustMaterials.personalStores,x=>x.rustMaterials.personalStores[0].wood=-1,x=>x.rustMaterials.personalStores.push({...x.rustMaterials.personalStores[0]}),x=>x.version='0.5.0',x=>x.stock.food=10,x=>delete x.worldMode]){
  const copy=JSON.parse(serialize(s));breakIt(copy);assert.throws(()=>restore(JSON.stringify(copy)));
 }
});
test('IC3 legacy save migration and baseline construction remain separate and unchanged',()=>{
 const legacy=createWorld();assert.equal(legacy.version,'0.5.0');assert.equal(isIndependent(legacy),false);assert.equal(capacity(legacy),12);
 const copy=restore(serialize(legacy));assert.equal(serialize(legacy),serialize(copy));assert.equal(copy.rustMaterials.personalStores,undefined);
});
test('IC3 read-only housing projection cache invalidates same-tick structural edits',()=>{
 const s=earnedWorld(),h=homeOf(s,1);assert.ok(h.complete);const before=serialize(s);h.cells[0].x=-999;assert.equal(serialize(s),before);
 const roof=s.rustStations.stations.find(st=>st.kind==='WOOD_ROOF'&&st.placedBy===1);roof.kind='WOOD_FOUNDATION';assert.equal(homeOf(s,1).complete,false);
});
test('IC3 optional archive can be hosted at an owned home without Camp and survive reload',()=>{
 const s=earnedWorld(),a=s.agents[0],h=homeOf(s,a.id);a.x=h.origin.x;a.y=h.origin.y;a.task=null;Object.assign(materialStock(s,a),{wood:30,stone:10});
 const before=serialize(s);assert.equal(command(s,'CREATE_ARCHIVE',{agentId:2,houseId:h.houseId}).ok,false);assert.equal(serialize(s),before);
 assert.equal(command(s,'CREATE_ARCHIVE',{agentId:a.id,houseId:h.houseId}).ok,true);assert.equal(materialStock(s,a).wood,24);assert.equal(s.culture.houseId,h.houseId);assert.equal(s.culture.ownerId,a.id);
 const once=serialize(s);assert.equal(command(s,'CREATE_ARCHIVE',{agentId:a.id,houseId:h.houseId}).changed,false);assert.equal(serialize(s),once);assert.deepEqual(validate(s),[]);assert.equal(serialize(restore(once)),once);
});
test('IC3 distinct-owner foundations cannot be fused by an unauthorized adjacent placement',()=>{
 const s=earnedWorld(),a=s.agents[0],b=s.agents[1],h=homeOf(s,a.id);
 const sockets=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({type:'cell',x:h.origin.x+dx,y:h.origin.y+dy}));
 const socket=sockets.find(socket=>canPlaceStation(s,{pieceKind:'WOOD_FOUNDATION',socket},walkable,{actor:false}).ok);assert.ok(socket);
 b.x=socket.x;b.y=socket.y;b.task=null;const itemId=s.rustPossessions.nextItem++;
 s.rustPossessions.items.push({id:itemId,kind:'WOOD_FOUNDATION',createdBy:b.id,createdTick:s.tick,location:{kind:'bag',agentId:b.id}});
 const before=serialize(s),r=command(s,'PLACE_STATION',{agentId:b.id,itemInstanceId:itemId,socket,placementId:'test-boundary'});
 assert.equal(r.reason,'ownership-boundary');assert.equal(serialize(s),before);
});
test('IC3 bounded station capacity scales for private homes without changing legacy cap',()=>{
 assert.equal(stationLimit(createWorld()),64);assert.equal(stationLimit(fresh()),512);
});
