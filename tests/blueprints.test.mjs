import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorld,command,step,serialize,restore,validate} from '../src/engine.mjs';
import {BLUEPRINT_VERSION,BLUEPRINT_RECIPE_POOL,BLUEPRINT_ITEM_KIND,createBlueprintOffer,validBlueprintOffer,blueprintPayload,validBlueprintItem,validateBlueprintEvidence} from '../src/craft-blueprints.mjs';
import {knowsCraftRecipe,recipeMastery,validateRecipeKnowledge} from '../src/craft-recipe-knowledge.mjs';
import {grantAdventureLoot,advanceCraft,blueprintLearningPreview,releaseRustPossessionsOnDeath} from '../src/rust-possessions.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {recipeById,STARTER_RECIPE_IDS} from '../src/crafting-catalog.mjs';
import {renderCraftItemInfo,renderCraftItemActions,renderCraftRecipeBook} from '../src/crafting-ui.mjs';
import {verifiedAdventureLootProposal} from '../src/adventure-loot-commit.mjs';
import {blueprintWorld,reachBlueprintCombat,winBlueprintCombat} from './fixtures/blueprint-world.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
function completed(){const s=blueprintWorld(3);reachBlueprintCombat(s);winBlueprintCombat(s);return {s,a:s.agents[0]};}
function claimed(){const {s,a}=completed();const result=command(s,'CLAIM_ADVENTURE_LOOT',{agentId:a.id});assert.equal(result.ok,true);const item=s.rustPossessions.items.find(i=>i.kind===BLUEPRINT_ITEM_KIND);assert.ok(item);return {s,a,item,result};}
function ready(){const r=claimed();assert.equal(command(r.s,'FINISH_ADVENTURE_RESULT',{agentId:r.a.id}).ok,true);return r;}
function learn(s,a,item){return command(s,'LEARN_RECIPE_BLUEPRINT',{agentId:a.id,itemId:item.id});}
function unchanged(s,fn,reason){const before=serialize(s);const result=fn();assert.equal(result.ok,false);if(reason)assert.equal(result.reason,reason);assert.equal(serialize(s),before);return result;}
const offerSource={acceptedTick:0,worldSeed:230926,agentId:1,combatId:'advcombat:golden',monsterId:'MON_002',monsterLevel:1,rank:'normal'};

test('RC3.1 explicit v1 pool has all 29 existing non-starter recipes and pinned no-drop vector',()=>{
 assert.equal(BLUEPRINT_RECIPE_POOL.length,29);assert.equal(new Set(BLUEPRINT_RECIPE_POOL.map(r=>r.recipeId)).size,29);
 for(const r of BLUEPRINT_RECIPE_POOL){assert.equal(STARTER_RECIPE_IDS.includes(r.recipeId),false);assert.equal(recipeById(r.recipeId).tier,r.tier);}
 const before=clone(offerSource),offer=createBlueprintOffer(offerSource);
 assert.deepEqual(offerSource,before);assert.equal(Object.isFrozen(offerSource),false);assert.equal(Object.isFrozen(offer),true);
 assert.equal(offer.version,BLUEPRINT_VERSION);assert.equal(offer.chanceRoll,9603);assert.equal(offer.recipeId,null);assert.equal(validBlueprintOffer(offer),true);
});
test('RC3.1 deterministic offers respect all 60 level caps and ranks without mutable RNG',()=>{
 for(let level=1;level<=60;level++)for(const rank of ['normal','elite','boss'])for(let n=0;n<30;n++){
  const input={...offerSource,combatId:'advcombat:vector-'+n,monsterLevel:level,rank};const offer=createBlueprintOffer(input);
  assert.deepEqual(createBlueprintOffer(input),offer);assert.equal(validBlueprintOffer(clone(offer)),true);
  if(offer.recipeId)assert.ok(recipeById(offer.recipeId).tier<=Math.min(5,1+Math.floor((level-1)/12)));
 }
});
test('RC3.1 invalid sources and changed offers fail closed',()=>{
 for(const patch of [{acceptedTick:-1},{acceptedTick:NaN},{worldSeed:-1},{agentId:0},{monsterId:'FAKE'},{monsterLevel:0},{monsterLevel:61},{rank:'legend'},{combatId:'advcombat:\ninvalid'}])
  assert.throws(()=>createBlueprintOffer({...offerSource,...patch}));
 const offer=createBlueprintOffer(offerSource);
 for(const patch of [{chanceRoll:1},{catalogVersion:'future'},{recipeId:'STONE_AXE_T5'},{extra:true},{rank:'boss'}])assert.equal(validBlueprintOffer({...offer,...patch}),false);
});
test('RC3.1 real path/start freezes a Blueprint proposal but grants no item or knowledge',()=>{
 const s=blueprintWorld(3),{a,hunt}=reachBlueprintCombat(s);
 assert.ok(hunt.pathLength>0);assert.equal(a.adventureCombat.blueprintOffer.recipeId,'EMBER_CHARM');
 assert.equal(s.rustPossessions.items.some(i=>i.kind===BLUEPRINT_ITEM_KIND),false);
 assert.equal(knowsCraftRecipe(s,a,'EMBER_CHARM'),false);
 assert.throws(()=>verifiedAdventureLootProposal(s,a,a.adventureCombat),/victory_required/);
 assert.deepEqual(validate(s),[]);
});
test('RC3.1 accepted offer and real combat replay survive save/load without reroll',()=>{
 const s=blueprintWorld(3);reachBlueprintCombat(s);const saved=serialize(s),copy=restore(saved);
 assert.equal(serialize(copy),saved);
 const before=clone(s.agents[0].adventureCombat.blueprintOffer);winBlueprintCombat(s);winBlueprintCombat(copy);
 assert.equal(serialize(copy),serialize(s));assert.deepEqual(s.agents[0].adventureCombat.blueprintOffer,before);
});
test('RC3.1 VERIFIED non-Fire victory claims a real Blueprint with exact evidence once',()=>{
 const {s,a,item}=claimed();assert.equal(item.blueprint.offer.recipeId,'EMBER_CHARM');assert.equal(validBlueprintItem(s,item),true);
 const snapshot=serialize(s),r=command(s,'CLAIM_ADVENTURE_LOOT',{agentId:a.id});assert.equal(r.duplicate,true);assert.equal(serialize(s),snapshot);
 assert.equal(item.sourceClaimKey,a.adventureCombat.lootClaim.claimKey);assert.deepEqual(validate(s),[]);
});
test('RC3.1 open result blocks use; Continue then Learn consumes one physical item without mastery/XP',()=>{
 const {s,a,item}=claimed();unchanged(s,()=>learn(s,a,item),'loot-result-open');
 assert.equal(command(s,'FINISH_ADVENTURE_RESULT',{agentId:a.id}).ok,true);
 const xp=clone(a.skills),nextItem=s.rustPossessions.nextItem,nextOrder=s.rustPossessions.nextOrder;
 const result=learn(s,a,item);assert.equal(result.ok,true);assert.equal(result.recipeId,'EMBER_CHARM');
 assert.equal(s.rustPossessions.items.some(i=>i.id===item.id),false);assert.equal(knowsCraftRecipe(s,a,result.recipeId),true);
 assert.equal(recipeMastery(a,result.recipeId),0);assert.deepEqual(a.skills,xp);
 assert.equal(s.rustPossessions.nextItem,nextItem);assert.equal(s.rustPossessions.nextOrder,nextOrder);
 const entry=a.knowledgeState.recipes.entries.find(e=>e.recipeId===result.recipeId);assert.equal(entry.learned.itemId,item.id);assert.equal(entry.learned.method,'blueprint');
 unchanged(s,()=>learn(s,a,item),'item');assert.deepEqual(validate(s),[]);
});
test('RC3.1 consumed provenance and recipe survive exact save/load',()=>{
 const {s,a,item}=ready();assert.equal(learn(s,a,item).ok,true);const saved=serialize(s),loaded=restore(saved);
 assert.equal(serialize(loaded),saved);assert.deepEqual(validate(loaded),[]);assert.equal(knowsCraftRecipe(loaded,loaded.agents[0],'EMBER_CHARM'),true);
});
test('RC3.1 direct regrant cannot recreate a consumed Blueprint even if all other loot is absent',()=>{
 const {s,a,item}=ready(),rows=[{itemKind:BLUEPRINT_ITEM_KIND,quantity:1,rarity:'RARE',blueprint:clone(item.blueprint)}];
 assert.equal(learn(s,a,item).ok,true);
 unchanged(s,()=>grantAdventureLoot(s,{agentId:a.id,claimKey:item.sourceClaimKey,items:rows}),'loot-claim-consumed');
});
test('RC3.1 known recipe preserves the held Blueprint and grants no progress',()=>{
 const {s,a,item}=ready();a.task=null;
 // Prepared materials only; real accepted/completed orders unlock this recipe.
 Object.assign(resourceStock(s,a),{wood:20,stone:20});
 // Finish already accepted HAND work; never erase an escrowed order.
 for(let n=0;s.rustPossessions.orders.some(o=>o.agentId===a.id)&&n<200;n++){s.tick++;assert.equal(advanceCraft(s,a.id).ok,true);}
 assert.equal(s.rustPossessions.orders.some(o=>o.agentId===a.id),false);
 for(let n=0;n<2;n++){
   assert.equal(command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:'STONE_PICKAXE'}).ok,true);
   for(let work=0;work<recipeById('STONE_PICKAXE').work;work++){s.tick++;assert.equal(advanceCraft(s,a.id).ok,true);}
 }
 assert.equal(knowsCraftRecipe(s,a,'EMBER_CHARM'),true);assert.equal(recipeMastery(a,'STONE_PICKAXE'),2);
 unchanged(s,()=>learn(s,a,item),'recipe-known');step(s);assert.deepEqual(validate(s),[]);
});
test('RC3.1 wrong owner, dropped item, child and active combat cannot consume a Blueprint',()=>{
 const {s,a,item}=ready(),other=s.agents[1];unchanged(s,()=>learn(s,other,item),'item');
 item.location={kind:'drop',sourceAgentId:a.id,tick:s.tick,x:a.x,y:a.y};unchanged(s,()=>learn(s,a,item),'item');
 item.location={kind:'bag',agentId:a.id};a.life={anchorTick:s.tick,ageAtAnchorYears:0};unchanged(s,()=>learn(s,a,item),'stage');
 a.life={anchorTick:s.tick,ageAtAnchorYears:20};a.adventureCombat={status:'ACTIVE'};unchanged(s,()=>learn(s,a,item),'combat-active');
 a.adventureCombat=null;a.alive=false;unchanged(s,()=>learn(s,a,item),'item');
});
test('RC3.1 other owner open loot receipt blocks use after a physical pickup',()=>{
 const {s,a,item}=claimed(),b=s.agents[1];item.location={kind:'drop',sourceAgentId:a.id,tick:s.tick,x:b.x,y:b.y};
 assert.equal(command(s,'PICKUP_ITEM',{agentId:b.id,itemId:item.id}).ok,true);unchanged(s,()=>learn(s,b,item),'loot-result-open');
 assert.equal(command(s,'FINISH_ADVENTURE_RESULT',{agentId:a.id}).ok,true);assert.equal(learn(s,b,item).ok,true);
 assert.equal(knowsCraftRecipe(s,b,'EMBER_CHARM'),true);assert.equal(knowsCraftRecipe(s,a,'EMBER_CHARM'),false);assert.deepEqual(validate(s),[]);
});
test('RC3.1 learned Blueprint recipe teaches through the existing authority with zero mastery',()=>{
 const {s,a,item}=ready(),b=s.agents[1];assert.equal(learn(s,a,item).ok,true);b.task=null;b.x=a.x;b.y=a.y;
 const r=command(s,'TEACH_CRAFT_RECIPE',{teacherId:a.id,studentId:b.id,recipeId:'EMBER_CHARM'});assert.equal(r.ok,true);
 assert.equal(knowsCraftRecipe(s,b,'EMBER_CHARM'),true);assert.equal(recipeMastery(b,'EMBER_CHARM'),0);assert.deepEqual(validateRecipeKnowledge(s,b),[]);
 const saved=serialize(s);assert.equal(serialize(restore(saved)),saved);
});
test('RC3.1 forged Blueprint payload or learning receipt fails closed',()=>{
 for(const tamper of [x=>x.blueprint.offer.recipeId='STONE_AXE_T5',x=>x.sourceClaimKey+='x',x=>x.blueprint.terminalTurn++,x=>x.createdBy=999,x=>x.createdTick=0]){
  const {s,a,item}=ready();tamper(item);assert.ok(validate(s).length);unchanged(s,()=>learn(s,a,item));
 }
 const {s,a,item}=ready();assert.equal(learn(s,a,item).ok,true);a.knowledgeState.recipes.entries.find(e=>e.recipeId==='EMBER_CHARM').learned.blueprint.offer.chanceRoll++;
 assert.ok(validate(s).length);assert.equal(knowsCraftRecipe(s,a,'EMBER_CHARM'),false);
});
test('RC3.1 duplicate consumed evidence and live-plus-consumed resurrection fail closed',()=>{
 const {s,a,item}=ready(),physical=clone(item);assert.equal(learn(s,a,item).ok,true);s.rustPossessions.items.push(physical);
 assert.ok(validateBlueprintEvidence(s).length);assert.ok(validate(s).length);s.rustPossessions.items.pop();
 s.agents[1].knowledgeState.recipes=clone(a.knowledgeState.recipes);assert.ok(validateBlueprintEvidence(s).length);
});
test('RC3.1 malformed receipt manifest is not accepted as a completed claim',()=>{
 const {s,a}=claimed();a.adventureCombat=clone(a.adventureCombat);a.adventureCombat.lootClaim.items=[];
 assert.ok(validate(s).length);unchanged(s,()=>command(s,'CLAIM_ADVENTURE_LOOT',{agentId:a.id}),'loot_claim_conflict');
});
test('RC3.1 capacity rejection is atomic and includes pending craft outputs',()=>{
 const {s,a}=completed(),p=s.rustPossessions;
 while(p.items.length<127)p.items.push({id:p.nextItem++,kind:'HIDE',createdBy:a.id,createdTick:s.tick,location:{kind:'drop',sourceAgentId:a.id,tick:s.tick,x:a.x,y:a.y}});
 // Isolated capacity projection: pending slot must not be stolen by loot.
 p.orders.push({id:p.nextOrder++,agentId:s.agents[1].id});
 unchanged(s,()=>command(s,'CLAIM_ADVENTURE_LOOT',{agentId:a.id}),'loot_rust_capacity');
 p.orders=[];assert.equal(command(s,'CLAIM_ADVENTURE_LOOT',{agentId:a.id}).ok,true);assert.equal(p.items.length,128);
});
test('RC3.1 full bag drops Blueprint at owner position, then ordinary pickup is required',()=>{
 const {s,a}=completed(),p=s.rustPossessions;
 while(p.items.filter(i=>i.location.kind==='bag'&&i.location.agentId===a.id).length<4)p.items.push({id:p.nextItem++,kind:'HIDE',createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
 const r=command(s,'CLAIM_ADVENTURE_LOOT',{agentId:a.id});assert.equal(r.ok,true);
 const item=p.items.find(i=>i.kind===BLUEPRINT_ITEM_KIND);assert.equal(item.location.kind,'drop');assert.equal(item.location.x,a.x);assert.equal(item.location.y,a.y);
 assert.deepEqual(validate(s),[]);
});
test('RC3.1 empty non-Fire result commits an empty receipt without a placeholder item',()=>{
 let done;
 for(let seed=1;seed<8;seed++){const s=blueprintWorld(seed);reachBlueprintCombat(s);winBlueprintCombat(s);const a=s.agents[0];if(verifiedAdventureLootProposal(s,a,a.adventureCombat).items.length===0){done={s,a};break;}}
 assert.ok(done);const {s,a}=done,n=s.rustPossessions.nextItem,count=s.rustPossessions.items.length;
 assert.equal(command(s,'CLAIM_ADVENTURE_LOOT',{agentId:a.id}).ok,true);assert.equal(s.rustPossessions.nextItem,n);assert.equal(s.rustPossessions.items.length,count);
 assert.deepEqual(a.adventureCombat.lootClaim.itemIds,[]);const saved=serialize(s);assert.equal(serialize(restore(saved)),saved);assert.deepEqual(validate(s),[]);
});
test('RC3.1 Blueprint UI reads real recipe, blocked cause and source; does not mislabel it legacy',()=>{
 const {s,a,item}=claimed(),info=renderCraftItemInfo(s,item),actions=renderCraftItemActions(s,a,item);
 assert.match(info,/data-blueprint-recipe="EMBER_CHARM"/);assert.match(info,/เครื่องรางเพลิง/);assert.doesNotMatch(info,/Legacy/);
 assert.match(actions,/disabled/);assert.match(actions,/Continue/);command(s,'FINISH_ADVENTURE_RESULT',{agentId:a.id});
 assert.equal(blueprintLearningPreview(s,{agentId:a.id,itemId:item.id}).ok,true);assert.doesNotMatch(renderCraftItemActions(s,a,item),/disabled/);
 assert.equal(learn(s,a,item).ok,true);assert.match(renderCraftRecipeBook(s,a),/เรียนจากพิมพ์เขียว/);
});
test('RC3.1 pure offer module has no hidden RNG, DOM, clock or inventory writer',()=>{
 const source=fs.readFileSync(new URL('../src/craft-blueprints.mjs',import.meta.url),'utf8');
 for(const forbidden of ['Math.random','Date.now','document.','window.','.items.push(','.nextItem++'])assert.equal(source.includes(forbidden),false,forbidden);
});

test('RC3.1 pending offers, forged sessions and no session cannot mint physical Blueprints',()=>{
 const s=blueprintWorld(3),{a}=reachBlueprintCombat(s),offer=a.adventureCombat.blueprintOffer;
 const payload=blueprintPayload(offer,'advout:'+offer.combatId+':victory:1',1);
 const args={agentId:a.id,claimKey:'ADVENTURE_LOOT:'+payload.outcomeId,items:[{itemKind:BLUEPRINT_ITEM_KIND,quantity:1,rarity:'RARE',blueprint:payload}]};
 unchanged(s,()=>grantAdventureLoot(s,args),'blueprint-unverified');
 a.adventureCombat={...clone(a.adventureCombat),status:'VICTORY'};
 unchanged(s,()=>grantAdventureLoot(s,args),'blueprint-unverified');
 a.adventureCombat=null;unchanged(s,()=>grantAdventureLoot(s,args),'blueprint-unverified');
});
test('RC3.1 UI acceptance latency does not influence the roll; acquisition predating acceptance is invalid',()=>{
 const first=createBlueprintOffer({...offerSource,acceptedTick:2}),later=createBlueprintOffer({...offerSource,acceptedTick:2000});
 assert.equal(first.chanceRoll,later.chanceRoll);assert.equal(first.recipeId,later.recipeId);assert.notEqual(first.acceptedTick,later.acceptedTick);
 const {s,a,item}=ready();assert.equal(learn(s,a,item).ok,true);
 const e=a.knowledgeState.recipes.entries.find(e=>e.recipeId==='EMBER_CHARM');e.learned.acquiredTick=0;
 assert.ok(validate(s).length);assert.equal(knowsCraftRecipe(s,a,'EMBER_CHARM'),false);
});
test('RC3.1 malformed nested knowledge or item collections fail closed without throwing',()=>{
 for(const mutation of [s=>s.rustPossessions.items.push(null),s=>s.rustPossessions.orders.push(null),
   s=>s.agents[1].knowledgeState.recipes={entries:{}},s=>s.agents[1].knowledgeState.recipes={entries:[null]},
   s=>s.agents[1].knowledgeState.recipes={entries:[{receipts:3}]},s=>s.rustPossessions.orders.push({reservedItems:{}})]){
   const {s}=ready();mutation(s);assert.ok(validateBlueprintEvidence(s).length);
 }
});
test('RC3.1 real death drops the physical Blueprint and another owner can learn after ordinary pickup',()=>{
 const {s,a,item}=ready(),b=s.agents[1];a.satiety=0;a.hp=.1;a.task=null;step(s);
 assert.equal(a.alive,false);assert.equal(item.location.kind,'drop');assert.deepEqual(validate(s),[]);
 // Place the test student next to the drop; pickup still uses the normal command/range validator.
 b.task=null;b.x=item.location.x;b.y=item.location.y;
 assert.equal(command(s,'PICKUP_ITEM',{agentId:b.id,itemId:item.id}).ok,true);assert.equal(learn(s,b,item).ok,true);
 assert.equal(b.knowledgeState.recipes.entries.find(e=>e.recipeId==='EMBER_CHARM').learned.createdBy,a.id);
 assert.equal(knowsCraftRecipe(s,b,'EMBER_CHARM'),true);assert.deepEqual(validate(s),[]);
 const saved=serialize(s);assert.equal(serialize(restore(saved)),saved);
});
test('RC3.1 legacy combat offers stay absent on load, not retroactively rolled',()=>{
 const s=blueprintWorld(3);reachBlueprintCombat(s);s.agents[0].adventureCombat=clone(s.agents[0].adventureCombat);
 delete s.agents[0].adventureCombat.blueprintOffer;const saved=serialize(s),loaded=restore(saved);
 assert.equal(serialize(loaded),saved);assert.equal(loaded.agents[0].adventureCombat.blueprintOffer,undefined);
 winBlueprintCombat(loaded);assert.throws(()=>verifiedAdventureLootProposal(loaded,loaded.agents[0],loaded.agents[0].adventureCombat),/unsupported_loot_profile/);
});

test('RC3.1 preserves existing release gates and adds native/public Blueprint proof',()=>{
 const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const verify=read('.github/workflows/verify.yml'),pages=read('.github/workflows/pages.yml');
 for(const text of [verify,pages]){
   assert.ok(text.includes('run: npm test'));assert.ok(text.includes('python tests/ui-smoke.py'));
   assert.ok(text.includes('python tests/rc2-crafting-smoke.py --native'));
   assert.ok(text.includes('python tests/blueprint-smoke.py --native'));
 }
 assert.ok(verify.includes('python tests/adventure-autonomy-smoke.py'));
 assert.ok(pages.includes('python tests/public-swa7-smoke.py'));
 assert.ok(pages.includes('python tests/rc2-crafting-smoke.py --public'));
 assert.ok(pages.includes('python tests/blueprint-smoke.py --public'));
 assert.ok(pages.indexOf('python tests/blueprint-smoke.py --native')<pages.indexOf('      - name: Setup Pages'));
 assert.ok(pages.includes('timeout-minutes: 12'));assert.ok(verify.includes('timeout-minutes: 10'));
});
