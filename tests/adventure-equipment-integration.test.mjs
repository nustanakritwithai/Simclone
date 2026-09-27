import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,serialize,restore,validate} from '../src/engine.mjs';
import {mintAdventureGear,rustPossessionsSnapshot} from '../src/rust-possessions.mjs';
import {adventureCombatLoadoutSnapshot,validateAdventureCombatLoadoutSnapshot} from '../src/adventure-equipment-bridge.mjs';
import {neutralAdventurerCombatProfile,neutralAdventurerCoreStatsAtLevel} from '../src/adventure-human-combat.mjs';
import {startAdventureCombatSession} from '../src/adventure-combat-session.mjs';

function mintThree(s,a){
  const ids={};
  for(const gearId of ['EMBER_BLADE','HIDE_ARMOR','EMBER_CHARM']){
    const r=mintAdventureGear(s,{agentId:a.id,gearId,sourceKey:'i6:'+a.id+':'+gearId});
    assert.equal(r.ok,true);ids[gearId]=r.itemId;
  }
  return ids;
}
function equipThree(s,a,ids){
  for(const gearId of ['EMBER_BLADE','HIDE_ARMOR','EMBER_CHARM']){
    const r=command(s,'EQUIP_ADVENTURE_GEAR',{agentId:a.id,itemId:ids[gearId]});
    assert.equal(r.ok,true);
  }
}
function readyEncounter(a,level=20){
  return {status:'READY',encounterId:'i6-enc',expeditionId:'i6-exp',zoneId:'z1',monsterId:'MON_002',monsterLevel:1,rank:'normal',adventureLevel:level,x:a.x,y:a.y};
}

test('I6 uses the one Rust equipment array for hand + WEAPON + ARMOR + ACCESSORY',()=>{
  const s=createWorld(8101,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  const ids=mintThree(s,a);
  const toolId=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id:toolId,kind:'STONE_AXE',createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  assert.equal(command(s,'EQUIP_ITEM',{agentId:a.id,itemId:toolId}).ok,true);
  equipThree(s,a,ids);
  const snap=rustPossessionsSnapshot(s,a.id);
  assert.equal(snap.equipment.hand,toolId);
  assert.equal(snap.equipment.WEAPON,ids.EMBER_BLADE);
  assert.equal(snap.equipment.ARMOR,ids.HIDE_ARMOR);
  assert.equal(snap.equipment.ACCESSORY,ids.EMBER_CHARM);
  assert.equal('adventureEquipment' in a,false);
  assert.deepEqual(validate(s),[]);
});

test('I6 donor gear projects exact bounded base modifiers into one CombatStats loadout',()=>{
  const s=createWorld(8102,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0],ids=mintThree(s,a);
  equipThree(s,a,ids);
  const loadout=adventureCombatLoadoutSnapshot(s,a.id);
  assert.deepEqual(loadout.modifiers,{ATK:8,DEF:6,SPATK:9,SPDEF:3,SPD:2,HP:12});
  assert.deepEqual(loadout.items.map(i=>[i.gearId,i.slot,i.upgradeLevel]),[
    ['EMBER_BLADE','WEAPON',0],['HIDE_ARMOR','ARMOR',0],['EMBER_CHARM','ACCESSORY',0]
  ]);
  assert.deepEqual(validateAdventureCombatLoadoutSnapshot(loadout),[]);
});

test('I6 HP gear changes projected hpMax but preserves canonical agent.hp ratio and never heals on equip',()=>{
  const s=createWorld(8103,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  a.hp=50;
  const armor=mintAdventureGear(s,{agentId:a.id,gearId:'HIDE_ARMOR',sourceKey:'i6:armor'});
  assert.equal(armor.ok,true);assert.equal(command(s,'EQUIP_ADVENTURE_GEAR',{agentId:a.id,itemId:armor.itemId}).ok,true);
  const base=neutralAdventurerCoreStatsAtLevel(20),loadout=adventureCombatLoadoutSnapshot(s,a.id);
  const profile=neutralAdventurerCombatProfile(a,20,loadout.modifiers);
  assert.equal(a.hp,50);
  assert.equal(profile.hpMax,base.hp+12);
  assert.equal(profile.hpCurrent,Math.floor(profile.hpMax*.5));
  assert.equal(profile.def,base.def+6);
  assert.equal(profile.spDef,base.spDef+3);
});

test('I6 combat snapshots equipped loadout at start and blocks equipment mutation while ACTIVE',()=>{
  const s=createWorld(8104,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0],ids=mintThree(s,a);
  assert.equal(command(s,'EQUIP_ADVENTURE_GEAR',{agentId:a.id,itemId:ids.EMBER_BLADE}).ok,true);
  a.profession='adventurer';
  const session=startAdventureCombatSession(s,a,readyEncounter(a,20));
  a.adventureCombat=session;
  assert.equal(session.loadout.modifiers.ATK,8);
  const denied=command(s,'EQUIP_ADVENTURE_GEAR',{agentId:a.id,itemId:ids.HIDE_ARMOR});
  assert.equal(denied.ok,false);assert.equal(denied.reason,'combat-active');
  assert.equal(a.adventureCombat.loadout.modifiers.ATK,8);
  assert.equal(a.adventureCombat.loadout.modifiers.DEF,0);
  assert.deepEqual(validate(s),[]);
});

test('I6 Rust equipment and loadout survive save/load byte-identically',()=>{
  const s=createWorld(8105,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0],ids=mintThree(s,a);
  equipThree(s,a,ids);
  const before=adventureCombatLoadoutSnapshot(s,a.id),text=serialize(s),loaded=restore(text),b=loaded.agents[0];
  assert.equal(serialize(loaded),text);
  assert.deepEqual(adventureCombatLoadoutSnapshot(loaded,b.id),before);
  assert.deepEqual(validate(loaded),[]);
});

test('I6 rejects forged upgrade levels because upgrade material commit is not authoritative yet',()=>{
  const s=createWorld(8106,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  const gear=mintAdventureGear(s,{agentId:a.id,gearId:'EMBER_BLADE',sourceKey:'i6:forged'});
  assert.equal(gear.ok,true);
  s.rustPossessions.items.find(i=>i.id===gear.itemId).upgradeLevel=1;
  assert.ok(validate(s).includes('Rust gear'));
  assert.throws(()=>adventureCombatLoadoutSnapshot(s,a.id),/invalid_adventure_equipment/);
});
