import test from 'node:test';
import assert from 'node:assert/strict';
import {createPossessions,POSSESSIONS_VERSION,TOOL_LIMITS,TOOL_RECIPES,validatePossessions,
  reservedToolMaterials,availableToolMaterials,possessionsSummary,toolWorkMultiplier,
  previewPossessionCommand, possessionCommand,advanceToolCraft,releasePossessionsOnDeath
} from '../src/possessions.mjs';

// Minimal domain fixtures, NOT the Simclone engine/scheduler/browser.
const copy=s=>JSON.parse(JSON.stringify(s));
const bytes=s=>JSON.stringify(s);
const context={
  canCraft:(_s,a)=>a.stage==='ADULT'||a.stage==='ELDER',
  readyToCraft:(_s,a)=>a.satiety>=35&&a.energy>=12,
  workRate:(_s,a)=>a.stage==='ELDER'?.75:1,
  canReach:()=>true,
  walkable:(_s,x,y)=>x>=0&&x<30&&y>=0&&y<26,
  maxSaveChars:2_000_000
};
function world(){
  return {tick:0,seed:42,rng:7,stock:{food:28,wood:100,stone:100},archive:[],
    buildings:[{id:1,type:'camp',x:11,y:12,complete:true}],
    agents:[1,2,3].map(id=>({id,x:11,y:12,alive:true,stage:'ADULT',satiety:100,energy:100,skills:{WOODCUT:60}})),
    possessions:createPossessions()};
}
function cmd(s,command,data={},ctx=context){return possessionCommand(s,command,{agentId:1,...data},ctx);}
function queue(s,agentId=1,campId=1){
  const r=cmd(s,'CRAFT_TOOL',{agentId,campId,recipe:'STONE_AXE'});assert.equal(r.ok,true,JSON.stringify(r));return r.orderId;
}
function work(s,n=24,agentId=1,ctx=context){let r;for(let i=0;i<n;i++){s.tick++;r=advanceToolCraft(s,agentId,ctx);}return r;}
function craft(s,agentId=1){queue(s,agentId);const r=work(s,24,agentId);assert.equal(r.completed,true);return r.itemId;}
function addItem(s,location={kind:'bag',agentId:1}){
  const id=s.possessions.nextItem++;s.possessions.items.push({id,kind:'STONE_AXE',createdBy:1,createdTick:0,location});return id;
}
function unchangedFailure(s,command,data,reason,ctx=context){
  const before=bytes(s),r=cmd(s,command,data,ctx);assert.equal(r.ok,false);assert.equal(r.reason,reason);assert.equal(bytes(s),before);return r;
}
function valid(s){assert.deepEqual(validatePossessions(s,context),[]);}

test('empty state has a separate schema and makes no physical property',()=>{
  const s=world();assert.equal(s.possessions.version,POSSESSIONS_VERSION);valid(s);
  assert.equal(s.possessions.items.length,0);assert.equal(toolWorkMultiplier(s,1,'WOODCUT'),1);
});
test('recipe and capacity definitions cannot be mutated',()=>{
  assert.equal(TOOL_LIMITS.bag,4);assert.equal(TOOL_RECIPES.STONE_AXE.work,24);
  assert.throws(()=>{TOOL_RECIPES.STONE_AXE.cost.wood=0;},TypeError);
});
test('successful preview is byte-identical including counters and shared stock',()=>{
  const s=world(),before=bytes(s);
  const r=previewPossessionCommand(s,'CRAFT_TOOL',{agentId:1,campId:1,recipe:'STONE_AXE'},context);
  assert.equal(r.ok,true);assert.deepEqual(r.cost,{wood:4,stone:2});assert.equal(bytes(s),before);
});
test('craft command reserves inputs, does not spend, and produces no instant axe',()=>{
  const s=world();queue(s);assert.deepEqual(reservedToolMaterials(s),{wood:4,stone:2});
  assert.deepEqual(availableToolMaterials(s),{wood:96,stone:98});assert.equal(s.stock.food,28);
  assert.equal(s.stock.wood,100);assert.equal(s.possessions.items.length,0);valid(s);
});
test('24 actual work ticks produce exactly one axe and debit recipe exactly once',()=>{
  const s=world();queue(s);work(s,23);assert.equal(s.possessions.items.length,0);assert.equal(s.stock.wood,100);
  const r=work(s,1);assert.equal(r.completed,true);assert.equal(s.stock.wood,96);assert.equal(s.stock.stone,98);
  assert.equal(s.stock.food,28);assert.equal(s.possessions.items.length,1);assert.equal(s.possessions.orders.length,0);valid(s);
  const before=bytes(s);assert.equal(advanceToolCraft(s,1,context).ok,false);assert.equal(bytes(s),before);
});
test('same-tick executor replay cannot advance or complete a craft twice',()=>{
  const s=world();queue(s);const start=bytes(s);
  assert.equal(advanceToolCraft(s,1,context).reason,'already-worked');assert.equal(bytes(s),start);
  work(s,1);const before=bytes(s);assert.equal(advanceToolCraft(s,1,context).reason,'already-worked');assert.equal(bytes(s),before);
});
test('queue requires canonical engine context rather than silently assuming eligibility',()=>{
  const s=world();unchangedFailure(s,'CRAFT_TOOL',{campId:1,recipe:'STONE_AXE'},'missing-engine-context',{});
});
test('craft does not progress while worker has not arrived at camp',()=>{
  const s=world();s.agents[0].x=3;queue(s);s.tick++;const before=bytes(s);
  assert.equal(advanceToolCraft(s,1,context).reason,'not-at-camp');assert.equal(bytes(s),before);assert.equal(s.agents[0].x,3);
});
test('unreachable camp rejects atomically without reserving materials',()=>{
  unchangedFailure(world(),'CRAFT_TOOL',{campId:1,recipe:'STONE_AXE'},'no-path',{...context,canReach:()=>false});
});
test('child craft rejected with no state or XP mutation',()=>{
  const s=world();s.agents[0].stage='CHILD';unchangedFailure(s,'CRAFT_TOOL',{campId:1,recipe:'STONE_AXE'},'stage');
});
test('dead actors cannot order or equip tools',()=>{
  const s=world();s.agents[0].alive=false;unchangedFailure(s,'CRAFT_TOOL',{campId:1,recipe:'STONE_AXE'},'actor');
});
test('insufficient inputs reject before counters and reservations change',()=>{
  const s=world();s.stock.wood=3;unchangedFailure(s,'CRAFT_TOOL',{campId:1,recipe:'STONE_AXE'},'materials');
});
test('unknown and prototype recipe names cannot create free tools',()=>{
  for(const recipe of ['BOGUS','__proto__','toString',null])unchangedFailure(world(),'CRAFT_TOOL',{campId:1,recipe},'recipe-or-camp');
});
test('station slot and worker slot are exclusive',()=>{
  const s=world();queue(s);unchangedFailure(s,'CRAFT_TOOL',{campId:1,recipe:'STONE_AXE'},'craft-busy');
  unchangedFailure(s,'CRAFT_TOOL',{agentId:2,campId:1,recipe:'STONE_AXE'},'craft-busy');
});
test('two camps reserve shared inputs without double allocation',()=>{
  const s=world();s.buildings.push({id:2,type:'camp',x:15,y:12,complete:true});s.stock.wood=7;queue(s);
  unchangedFailure(s,'CRAFT_TOOL',{agentId:2,campId:2,recipe:'STONE_AXE'},'materials');
});
test('cancelling partial work releases reservations; no stock refund overflow',()=>{
  const s=world(),oid=queue(s);work(s,12);s.stock.wood=999;s.stock.stone=999;
  assert.equal(cmd(s,'CANCEL_CRAFT',{orderId:oid}).ok,true);
  assert.equal(s.stock.wood,999);assert.equal(s.stock.stone,999);assert.equal(s.possessions.items.length,0);
  assert.deepEqual(reservedToolMaterials(s),{wood:0,stone:0});
  unchangedFailure(s,'CANCEL_CRAFT',{orderId:oid},'order');
});
test('another person cannot cancel a reserved crafting order',()=>{
  const s=world(),oid=queue(s);unchangedFailure(s,'CANCEL_CRAFT',{agentId:2,orderId:oid},'order');
});
test('hunger pauses work and keeps progress, then crafting can resume',()=>{
  const s=world();queue(s);work(s,10);s.agents[0].satiety=10;s.tick++;const before=bytes(s);
  assert.equal(advanceToolCraft(s,1,context).reason,'needs');assert.equal(bytes(s),before);
  s.agents[0].satiety=100;assert.equal(work(s,14).completed,true);valid(s);
});
test('exhaustion pauses crafting without consuming reserved inputs',()=>{
  const s=world();queue(s);s.agents[0].energy=0;s.tick++;const before=bytes(s);
  assert.equal(advanceToolCraft(s,1,context).reason,'needs');assert.equal(bytes(s),before);
});
test('elder crafting preserves the supplied 0.75 productive rate',()=>{
  const s=world();s.agents[0].stage='ELDER';queue(s);work(s,31);
  assert.equal(s.possessions.items.length,0);assert.equal(work(s,1).completed,true);
});
test('untrusted invalid work rate cannot speed up crafting',()=>{
  const s=world();queue(s);s.tick++;const before=bytes(s);
  for(const rate of [2,0,-1,Infinity,NaN]){assert.equal(advanceToolCraft(s,1,{...context,workRate:()=>rate}).reason,'work-rate');assert.equal(bytes(s),before);}
});
test('a full bag rejects order without spending or replacing possessions',()=>{
  const s=world();for(let i=0;i<4;i++)addItem(s);valid(s);
  unchangedFailure(s,'CRAFT_TOOL',{campId:1,recipe:'STONE_AXE'},'bag-full');
});
test('pending craft reserves one bag slot against incoming gifts',()=>{
  const s=world();for(let i=0;i<3;i++)addItem(s);const gift=addItem(s,{kind:'bag',agentId:2});queue(s);
  unchangedFailure(s,'GIVE_TOOL',{agentId:2,toId:1,itemId:gift},'bag-full');valid(s);
});
test('equipment references held item and never adds to item count',()=>{
  const s=world(),itemId=craft(s);assert.equal(cmd(s,'EQUIP_TOOL',{itemId}).ok,true);
  assert.equal(s.possessions.items.length,1);assert.deepEqual(s.possessions.equipment,[{agentId:1,itemId}]);
  assert.equal(cmd(s,'UNEQUIP_TOOL',{itemId}).ok,true);assert.equal(s.possessions.items.length,1);valid(s);
});
test('another holder cannot equip the same physical axe',()=>{
  const s=world(),itemId=craft(s);unchangedFailure(s,'EQUIP_TOOL',{agentId:2,itemId},'not-holder');
});
test('equipping a second tool replaces one slot without duplicating either item',()=>{
  const s=world(),one=addItem(s),two=addItem(s);cmd(s,'EQUIP_TOOL',{itemId:one});cmd(s,'EQUIP_TOOL',{itemId:two});
  assert.deepEqual(s.possessions.equipment,[{agentId:1,itemId:two}]);assert.equal(s.possessions.items.length,2);valid(s);
});
test('stone axe changes only WOODCUT rate, never needs, XP, stock or other jobs',()=>{
  const s=world(),itemId=addItem(s);cmd(s,'EQUIP_TOOL',{itemId});const before=bytes(s);
  assert.equal(toolWorkMultiplier(s,1,'WOODCUT'),1.25);
  for(const kind of ['FORAGE','MINE','BUILD','CRAFT','REST','EAT'])assert.equal(toolWorkMultiplier(s,1,kind),1);
  assert.equal(bytes(s),before);assert.equal(.75*toolWorkMultiplier(s,1,'WOODCUT'),.9375);
});
test('unequipped axe confers no work bonus',()=>{
  const s=world();addItem(s);assert.equal(toolWorkMultiplier(s,1,'WOODCUT'),1);
});
test('adjacent give moves one existing tool and clears sender equipment',()=>{
  const s=world(),itemId=addItem(s);cmd(s,'EQUIP_TOOL',{itemId});s.agents[1].x++;
  const original=copy(s.possessions.items[0]);assert.equal(cmd(s,'GIVE_TOOL',{itemId,toId:2}).ok,true);
  assert.equal(s.possessions.items.length,1);assert.equal(s.possessions.equipment.length,0);
  assert.equal(s.possessions.items[0].createdBy,original.createdBy);assert.deepEqual(s.possessions.items[0].location,{kind:'bag',agentId:2});valid(s);
});
test('replayed give and stale unequip commands cannot steal or duplicate a tool',()=>{
  const s=world(),itemId=addItem(s);cmd(s,'GIVE_TOOL',{itemId,toId:2});
  unchangedFailure(s,'GIVE_TOOL',{itemId,toId:2},'not-holder');unchangedFailure(s,'UNEQUIP_TOOL',{itemId},'not-equipped');
});
test('distant and self gifts are atomic rejections',()=>{
  const s=world(),itemId=addItem(s);s.agents[1].x+=2;
  unchangedFailure(s,'GIVE_TOOL',{itemId,toId:2},'range');unchangedFailure(s,'GIVE_TOOL',{itemId,toId:1},'recipient');
});
test('dead recipients cannot receive items',()=>{
  const s=world(),itemId=addItem(s);s.agents[1].alive=false;unchangedFailure(s,'GIVE_TOOL',{itemId,toId:2},'recipient');
});
test('store then take preserves identity; camp is not a second inventory',()=>{
  const s=world(),itemId=addItem(s);cmd(s,'EQUIP_TOOL',{itemId});assert.equal(cmd(s,'STORE_TOOL',{itemId,campId:1}).ok,true);
  assert.equal(s.possessions.equipment.length,0);assert.equal(cmd(s,'TAKE_TOOL',{agentId:2,itemId}).ok,true);
  assert.equal(s.possessions.items.length,1);assert.deepEqual(s.possessions.items[0].location,{kind:'bag',agentId:2});valid(s);
});
test('remote camp operations reject without teleporting the item',()=>{
  const s=world(),itemId=addItem(s);s.agents[0].x=2;
  unchangedFailure(s,'STORE_TOOL',{itemId,campId:1},'range');s.possessions.items[0].location={kind:'camp',buildingId:1};
  unchangedFailure(s,'TAKE_TOOL',{itemId},'range');
});
test('camp storage capacity is bounded',()=>{
  const s=world();for(let i=0;i<64;i++)addItem(s,{kind:'camp',buildingId:1});const itemId=addItem(s);valid(s);
  unchangedFailure(s,'STORE_TOOL',{itemId,campId:1},'camp-full');
});
test('new identity has empty derived bag, not parent possessions',()=>{
  const s=world(),itemId=addItem(s);cmd(s,'EQUIP_TOOL',{itemId});s.agents.push({...s.agents[0],id:4,parentId:1});
  const summary=possessionsSummary(s,4);assert.equal(summary.bag.length,0);assert.equal(summary.equippedItemId,null);assert.equal(s.possessions.items.length,1);
});
test('death drops exactly one container location and frees order and equipment',()=>{
  const s=world(),itemId=addItem(s);cmd(s,'EQUIP_TOOL',{itemId});queue(s);work(s,6);
  const stock=copy(s.stock),a=s.agents[0];a.alive=false;a.death={tick:s.tick};
  assert.deepEqual(releasePossessionsOnDeath(s,1),{ok:true,dropped:1,cancelled:1});
  assert.deepEqual(s.possessions.items[0].location,{kind:'drop',agentId:1,tick:6,x:11,y:12});
  assert.equal(s.possessions.equipment.length,0);assert.equal(s.possessions.orders.length,0);assert.deepEqual(s.stock,stock);valid(s);
});
test('death cleanup is idempotent and frozen drop coordinates do not drift',()=>{
  const s=world();addItem(s);s.agents[0].alive=false;s.agents[0].death={tick:0};releasePossessionsOnDeath(s,1);
  s.tick=100;const before=bytes(s);assert.deepEqual(releasePossessionsOnDeath(s,1),{ok:true,dropped:0,cancelled:0});assert.equal(bytes(s),before);
});
test('all carried tools share the same dropped container without duplicating inventory',()=>{
  const s=world();for(let i=0;i<4;i++)addItem(s);s.agents[0].alive=false;releasePossessionsOnDeath(s,1);
  assert.equal(s.possessions.items.length,4);assert.ok(s.possessions.items.every(i=>bytes(i.location)===bytes(s.possessions.items[0].location)));valid(s);
});
test('nearby survivor recovers dropped tool exactly once',()=>{
  const s=world(),itemId=addItem(s);s.agents[0].alive=false;releasePossessionsOnDeath(s,1);
  assert.equal(cmd(s,'PICKUP_TOOL',{agentId:2,itemId}).ok,true);
  unchangedFailure(s,'PICKUP_TOOL',{agentId:3,itemId},'range');assert.equal(s.possessions.items.length,1);valid(s);
});
test('distant pickup cannot teleport dropped equipment',()=>{
  const s=world(),itemId=addItem(s);s.agents[0].alive=false;releasePossessionsOnDeath(s,1);s.agents[1].x=2;
  unchangedFailure(s,'PICKUP_TOOL',{agentId:2,itemId},'range');
});
test('archived creator/deceased identity remains resolvable for physical drops',()=>{
  const s=world();addItem(s);s.agents[0].alive=false;releasePossessionsOnDeath(s,1);s.archive.push(s.agents.shift());valid(s);
});
test('death cleanup still works at item capacity without deleting property',()=>{
  const s=world();for(let i=0;i<64;i++)addItem(s,{kind:'camp',buildingId:1});
  s.buildings.push({id:2,type:'camp',x:12,y:12,complete:true});for(let i=0;i<60;i++)addItem(s,{kind:'camp',buildingId:2});
  for(let i=0;i<4;i++)addItem(s);valid(s);s.agents[0].alive=false;assert.equal(releasePossessionsOnDeath(s,1).dropped,4);
  assert.equal(s.possessions.items.length,128);valid(s);
});
test('full global registry rejects creation even when bag has room',()=>{
  const s=world();s.buildings.push({id:2,type:'camp',x:12,y:12,complete:true});
  for(let i=0;i<128;i++)addItem(s,{kind:'camp',buildingId:i<64?1:2});valid(s);
  unchangedFailure(s,'CRAFT_TOOL',{campId:1,recipe:'STONE_AXE'},'registry-full');
});
test('global save-size preflight rejects before reservation or payment',()=>{
  const s=world();unchangedFailure(s,'CRAFT_TOOL',{campId:1,recipe:'STONE_AXE'},'save-budget',{...context,maxSaveChars:bytes(s).length+1});
});
test('completion blocked by later save growth preserves order, stock and item counter',()=>{
  const s=world();queue(s);work(s,23);s.tick++;const before=bytes(s);
  assert.equal(advanceToolCraft(s,1,{...context,maxSaveChars:1}).reason,'save-budget');assert.equal(bytes(s),before);
  assert.equal(advanceToolCraft(s,1,context).completed,true);valid(s);
});
test('mid-craft JSON restore and subsequent item transfers remain deterministic',()=>{
  const a=world();queue(a);work(a,9);const b=copy(a);work(a,15);work(b,15);assert.equal(bytes(a),bytes(b));
  const itemId=a.possessions.items[0].id;
  for(const s of [a,b]){cmd(s,'EQUIP_TOOL',{itemId});cmd(s,'GIVE_TOOL',{itemId,toId:2});}
  assert.equal(bytes(a),bytes(b));valid(a);valid(b);
});
test('summary and preview do not expose mutable aliases into the domain',()=>{
  const s=world(),itemId=addItem(s);const before=bytes(s),summary=possessionsSummary(s,1);
  summary.bag[0].location.agentId=99;
  const preview=previewPossessionCommand(s,'EQUIP_TOOL',{agentId:1,itemId},context);preview.agentId=99;
  assert.equal(bytes(s),before);
});
test('schema rejects duplicate physical IDs, dangling holders and dangling equipment',()=>{
  for(const corrupt of [s=>s.possessions.items.push(copy(s.possessions.items[0])),s=>s.possessions.items[0].location.agentId=99,
    s=>s.possessions.equipment.push({agentId:1,itemId:999}),s=>s.possessions.nextItem=1]){
    const s=world();addItem(s);corrupt(s);assert.ok(validatePossessions(s,context).length);
  }
});
test('schema rejects runtime tool references on a dead actor until death cleanup',()=>{
  const s=world(),itemId=addItem(s);cmd(s,'EQUIP_TOOL',{itemId});s.agents[0].alive=false;
  assert.ok(validatePossessions(s,context).length);releasePossessionsOnDeath(s,1);valid(s);
});
test('schema rejects impossible order work, future ticks, oversubscription and extra fields',()=>{
  for(const corrupt of [s=>s.possessions.orders[0].work=24,s=>s.possessions.orders[0].lastWorkedTick=999,
    s=>s.stock.wood=0,s=>s.possessions.orders[0].freeOutput=true]){
    const s=world();queue(s);corrupt(s);assert.ok(validatePossessions(s,context).length);
  }
});
test('malformed collection members return validation errors rather than exceptions',()=>{
  for(const field of ['items','equipment','orders'])for(const entry of [null,{},[],1,'bad']){
    const s=world();s.possessions[field].push(entry);assert.ok(validatePossessions(s,context).length);
  }
});
test('unknown command and malformed command payload leave state untouched',()=>{
  const s=world(),before=bytes(s);assert.equal(possessionCommand(s,'BOGUS',{},context).ok,false);
  assert.equal(possessionCommand(s,'EQUIP_TOOL',null,context).ok,false);assert.equal(bytes(s),before);
});
test('maximum item prototype state stays inside declared 64 KiB character budget',()=>{
  const s=world();s.agents[0].alive=false;
  for(let i=0;i<128;i++)addItem(s,{kind:'drop',agentId:1,tick:0,x:11,y:12});valid(s);
  assert.ok(bytes(s.possessions).length<TOOL_LIMITS.stateChars);
});
test('1000 give/equip/store/take cycles conserve every physical item and stay bounded',()=>{
  const s=world(),itemId=addItem(s),stock=copy(s.stock);
  for(let n=0;n<1000;n++){
    assert.equal(cmd(s,'EQUIP_TOOL',{itemId}).ok,true);
    assert.equal(cmd(s,'GIVE_TOOL',{itemId,toId:2}).ok,true);
    assert.equal(cmd(s,'STORE_TOOL',{agentId:2,itemId,campId:1}).ok,true);
    assert.equal(cmd(s,'TAKE_TOOL',{itemId}).ok,true);valid(s);
  }
  assert.equal(s.possessions.items.length,1);assert.equal(s.possessions.nextItem,2);assert.deepEqual(s.stock,stock);
});
