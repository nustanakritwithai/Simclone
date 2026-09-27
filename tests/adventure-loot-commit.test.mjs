import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,serialize,restore,validate} from '../src/engine.mjs';
import {grantAdventureLoot} from '../src/rust-possessions.mjs';
import {validateCraftingCatalog,ITEM_CATALOG} from '../src/crafting-catalog.mjs';
import {monsterStatsAtLevel} from '../src/adventure-monster-stats.mjs';
import {commitVerifiedAdventureCombatReward} from '../src/adventure-combat-reward.mjs';
import {claimVerifiedAdventureLoot} from '../src/adventure-loot-commit.mjs';

function victorySession(monsterId='MON_002',combatId='advcombat:test-fire'){
  const monster=monsterStatsAtLevel(monsterId,1);assert.equal(monster.ok,true);
  const hp=monster.stats.hp;
  return {
    version:'adventure-combat-session/v1',
    combatId,encounterId:'advenc:'+combatId,expeditionId:'advexp:'+combatId,
    status:'VICTORY',zoneId:'z1',monsterId,monsterLevel:1,rank:'normal',adventureLevel:1,
    x:0,y:0,startedTick:0,turn:1,monsterHpMax:hp,monsterHpCurrent:0,
    lastTurn:{turn:0,status:'VICTORY',heroDamage:hp,heroHit:true,heroCritical:false,counterDamage:0,counterHit:false,counterCritical:false,monsterHpBefore:hp,monsterHpAfter:0,agentHpBefore:100,agentHpAfter:100}
  };
}
function prepared(monsterId='MON_002'){
  const s=createWorld(7101,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  a.profession='adventurer';a.professionSinceTick=s.tick;
  let session=victorySession(monsterId,'advcombat:test-'+monsterId.toLowerCase());
  session={...session,x:a.x,y:a.y};
  const reward=commitVerifiedAdventureCombatReward(a,session,s.tick);
  a.adventureCombat=reward.session;
  return {s,a};
}

test('I5 adds only the admitted Fire loot kinds to the existing Rust catalog',()=>{
  assert.deepEqual(validateCraftingCatalog(),[]);
  for(const [kind,rarity] of [['FIRE_CORE','UNCOMMON'],['HIDE','COMMON'],['EMBER_SHARD','RARE']]){
    assert.equal(ITEM_CATALOG[kind].adventureLoot,true);
    assert.equal(ITEM_CATALOG[kind].category,'material');
    assert.equal(ITEM_CATALOG[kind].rarity,rarity);
  }
});

test('I5 Rust authority mints loot atomically, fills bag first and drops overflow at the Clone position',()=>{
  const s=createWorld(7102,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  const rows=[{itemKind:'FIRE_CORE',quantity:2,rarity:'UNCOMMON'},{itemKind:'HIDE',quantity:2,rarity:'COMMON'},{itemKind:'EMBER_SHARD',quantity:1,rarity:'RARE'}];
  const r=grantAdventureLoot(s,{agentId:a.id,claimKey:'ADVENTURE_LOOT:test',items:rows});
  assert.equal(r.ok,true);assert.equal(r.duplicate,false);assert.equal(r.itemIds.length,5);assert.equal(r.bagged,4);assert.equal(r.dropped,1);
  const created=r.itemIds.map(id=>s.rustPossessions.items.find(i=>i.id===id));
  assert.ok(created.every(i=>i.sourceClaimKey==='ADVENTURE_LOOT:test'));
  const dropped=created.find(i=>i.location.kind==='drop');assert.equal(dropped.location.x,a.x);assert.equal(dropped.location.y,a.y);
  assert.deepEqual(validate(s),[]);
});

test('I5 Rust claimKey makes direct duplicate mint a no-op',()=>{
  const s=createWorld(7103,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  const rows=[{itemKind:'FIRE_CORE',quantity:1,rarity:'UNCOMMON'}];
  const first=grantAdventureLoot(s,{agentId:a.id,claimKey:'ADVENTURE_LOOT:dup',items:rows});
  const snapshot=serialize(s);
  const second=grantAdventureLoot(s,{agentId:a.id,claimKey:'ADVENTURE_LOOT:dup',items:rows});
  assert.equal(first.ok,true);assert.equal(second.ok,true);assert.equal(second.duplicate,true);
  assert.deepEqual(second.itemIds,first.itemIds);assert.equal(serialize(s),snapshot);
});

test('I5 VERIFIED Fire victory claims donor LootProposal into Rust possessions exactly once',()=>{
  const {s,a}=prepared(),before=s.rustPossessions.items.length;
  const r=command(s,'CLAIM_ADVENTURE_LOOT',{agentId:a.id});
  assert.equal(r.ok,true);assert.equal(r.changed,true);assert.ok(r.itemIds.length>=1);
  assert.equal(s.rustPossessions.items.length,before+r.itemIds.length);
  assert.equal(a.adventureCombat.lootClaim.claimKey,'ADVENTURE_LOOT:'+a.adventureCombat.reward.outcomeId);
  const snapshot=serialize(s);
  const replay=command(s,'CLAIM_ADVENTURE_LOOT',{agentId:a.id});
  assert.equal(replay.ok,true);assert.equal(replay.changed,false);assert.equal(replay.duplicate,true);
  assert.equal(serialize(s),snapshot);
  assert.deepEqual(validate(s),[]);
});

test('I5 unsupported non-Fire donor profile fails closed with no Rust mutation',()=>{
  const {s,a}=prepared('MON_001'),before=serialize(s);
  const r=command(s,'CLAIM_ADVENTURE_LOOT',{agentId:a.id});
  assert.equal(r.ok,false);assert.equal(r.reason,'unsupported_loot_profile');assert.equal(serialize(s),before);
});

test('I5 loot receipt and Rust items survive save/load byte-identically',()=>{
  const {s,a}=prepared();assert.equal(command(s,'CLAIM_ADVENTURE_LOOT',{agentId:a.id}).ok,true);
  const text=serialize(s),loaded=restore(text);assert.equal(serialize(loaded),text);assert.deepEqual(validate(loaded),[]);
});

test('I5 bridge itself cannot mint outside Rust authority',()=>{
  const {s,a}=prepared(),before=serialize(s);
  assert.throws(()=>claimVerifiedAdventureLoot(s,a,a.adventureCombat,{}),/loot_rust_authority/);
  assert.equal(serialize(s),before);
});
