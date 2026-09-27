import test from 'node:test';
import assert from 'node:assert/strict';

import {createWorld,command,step,serialize,restore,validate} from '../src/engine.mjs';
import {recordEarnedSkill} from '../src/skill-provenance.mjs';
import {adventureXpForLevel} from '../src/adventure-progression.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {
  WILD_MONSTER_RESPAWN_TICKS,
  validateWildMonsterWorld,
  wildMonsterById,
} from '../src/adventure-world-monsters.mjs';

function makeAdventurer(s,a,level=60){
  a.adventurerQualification={version:1,accepted:3,recent:[
    {id:'0:1:1',tick:0,x:1,y:1},{id:'1:1:2',tick:1,x:1,y:2},{id:'2:2:2',tick:2,x:2,y:2}
  ]};
  const changed=adoptProfession(a,'EXPLORE',Math.max(2,s.tick),{qualifiedProfession:'adventurer',qualification:'explore-3'});
  if(changed.changed&&s.tick<2)s.tick=2;
  const targetXp=adventureXpForLevel(level),delta=targetXp-a.skills.ADVENTURE;
  if(delta>0){
    a.skills.ADVENTURE+=delta;
    assert.equal(recordEarnedSkill(a,'ADVENTURE',delta,s.tick,{action:'TEST_SWA6'}),true);
  }
  a.task=null;a.adventureEncounter=null;a.adventureCombat=null;a.satiety=100;a.energy=100;a.hp=100;
}
function z1(s){return s.wildMonsters.entities.filter(m=>m.zoneId==='z1').sort((a,b)=>a.worldMonsterId.localeCompare(b.worldMonsterId));}
function hunt(s,a){
  for(const m of z1(s)){
    const r=command(s,'START_ADVENTURE_HUNT',{agentId:a.id,worldMonsterId:m.worldMonsterId});
    if(r.ok)return m;
  }
  assert.fail('expected reachable z1 monster');
}
function untilEncounter(s,a,max=1800){
  for(let i=0;i<max&&!a.adventureEncounter;i++)step(s,1);
  assert.ok(a.adventureEncounter);
}
function untilVictory(s,a,max=100){
  for(let i=0;i<max&&a.adventureCombat?.status==='ACTIVE';i++){
    const r=command(s,'ADVENTURE_COMBAT_ACTION',{agentId:a.id,action:'BASIC_ATTACK',expectedTurn:a.adventureCombat.turn});
    assert.equal(r.ok,true);
  }
  assert.equal(a.adventureCombat?.status,'VICTORY');
}
function preparedVictory(seed=230926){
  const s=createWorld(seed,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
  makeAdventurer(s,a,60);
  const m=hunt(s,a);
  untilEncounter(s,a);
  assert.equal(command(s,'START_ADVENTURE_COMBAT',{agentId:a.id}).ok,true);
  untilVictory(s,a);
  return {s,a,m};
}

test('SWA6 verified victory immediately despawns the physical Monster into DEFEATED',()=>{
  const {s,a,m}=preparedVictory();
  assert.equal(m.status,'DEFEATED');
  assert.equal(m.hpCurrent,0);
  assert.equal(m.engagedByAgentId,null);
  assert.equal(m.defeatedTick,s.tick);
  assert.equal(m.respawnTick,m.defeatedTick+WILD_MONSTER_RESPAWN_TICKS);
  assert.equal(a.adventureCombat.worldMonsterId,m.worldMonsterId);
  assert.equal(a.adventureCombat.reward?.status,'COMMITTED');
  assert.deepEqual(validate(s),[]);
});

test('SWA6 defeated Monster no longer occupies its old tile in world collision validation',()=>{
  const {s,a,m}=preparedVictory(42);
  a.x=m.x;a.y=m.y;
  assert.deepEqual(validateWildMonsterWorld(s),[]);
});

test('SWA6 terminal result can close without undoing committed XP or Rust state',()=>{
  const {s,a,m}=preparedVictory(2026);
  const xp=a.skills.ADVENTURE,items=s.rustPossessions.items.length,combatId=a.adventureCombat.combatId;
  const r=command(s,'FINISH_ADVENTURE_RESULT',{agentId:a.id});
  assert.equal(r.ok,true);
  assert.equal(r.combatId,combatId);
  assert.equal(r.status,'VICTORY');
  assert.equal(a.adventureCombat,null);
  assert.equal(a.skills.ADVENTURE,xp);
  assert.equal(s.rustPossessions.items.length,items);
  assert.equal(m.status,'DEFEATED');
  assert.deepEqual(validate(s),[]);
});


test('SWA6 fast respawn is exactly five simulation ticks after a closed victory',()=>{
  assert.equal(WILD_MONSTER_RESPAWN_TICKS,5);
  const {s,a,m}=preparedVictory(230926);
  const oldId=m.worldMonsterId,oldEpoch=m.spawnEpoch,defeated=m.defeatedTick;
  assert.equal(command(s,'FINISH_ADVENTURE_RESULT',{agentId:a.id}).ok,true);
  step(s,4);
  assert.equal(s.tick,defeated+4);
  assert.equal(m.status,'DEFEATED');
  assert.equal(m.worldMonsterId,oldId);
  step(s,1);
  assert.equal(s.tick,defeated+5);
  assert.equal(m.status,'IDLE');
  assert.equal(m.spawnEpoch,oldEpoch+1);
  assert.notEqual(m.worldMonsterId,oldId);
  assert.equal(m.hpCurrent,m.hpMax);
  assert.deepEqual(validate(s),[]);
});

test('SWA6 respawn waits while terminal combat still references the defeated incarnation',()=>{
  const {s,a,m}=preparedVictory(230926);
  const oldId=m.worldMonsterId,oldEpoch=m.spawnEpoch,due=m.respawnTick;
  step(s,due-s.tick);
  assert.equal(s.tick,due);
  assert.equal(m.status,'RESPAWNING');
  assert.equal(m.worldMonsterId,oldId);
  assert.equal(m.spawnEpoch,oldEpoch);
  assert.equal(m.hpCurrent,0);
  assert.deepEqual(validate(s),[]);

  assert.equal(command(s,'FINISH_ADVENTURE_RESULT',{agentId:a.id}).ok,true);
  step(s,1);
  assert.equal(m.status,'IDLE');
  assert.equal(m.spawnEpoch,oldEpoch+1);
  assert.equal(m.worldMonsterId,'wm:'+m.zoneId+':'+m.spawnSlot+':'+(oldEpoch+1));
  assert.notEqual(m.worldMonsterId,oldId);
  assert.equal(m.hpCurrent,m.hpMax);
  assert.equal(m.spawnedTick,s.tick);
  assert.equal(m.defeatedTick,null);
  assert.equal(m.respawnTick,null);
  assert.deepEqual(validate(s),[]);
});

test('SWA6 closed terminal result respawns deterministically at the due simulation tick',()=>{
  const {s,a,m}=preparedVictory(42);
  const oldId=m.worldMonsterId,due=m.respawnTick;
  assert.equal(command(s,'FINISH_ADVENTURE_RESULT',{agentId:a.id}).ok,true);
  const before=serialize(s),left=due-s.tick;
  const copy=restore(before),cm=wildMonsterById(copy,oldId);
  step(s,left);step(copy,left);
  assert.equal(m.status,'IDLE');
  assert.equal(cm.status,'IDLE');
  assert.notEqual(m.worldMonsterId,oldId);
  assert.deepEqual({id:cm.worldMonsterId,x:cm.x,y:cm.y,hp:cm.hpCurrent,epoch:cm.spawnEpoch},
    {id:m.worldMonsterId,x:m.x,y:m.y,hp:m.hpCurrent,epoch:m.spawnEpoch});
  assert.equal(serialize(copy),serialize(s));
});

test('SWA6 stale defeated-incarnation ID cannot be hunted after deterministic respawn',()=>{
  const {s,a,m}=preparedVictory(2026),oldId=m.worldMonsterId,due=m.respawnTick;
  assert.equal(command(s,'FINISH_ADVENTURE_RESULT',{agentId:a.id}).ok,true);
  step(s,due-s.tick);
  assert.notEqual(m.worldMonsterId,oldId);
  a.satiety=100;a.energy=100;a.hp=100;a.task=null;a.adventureEncounter=null;
  const denied=command(s,'START_ADVENTURE_HUNT',{agentId:a.id,worldMonsterId:oldId});
  assert.equal(denied.ok,false);
  assert.equal(denied.reason,'monster-unavailable');
});

test('SWA6 DEFEATED save/load is byte-stable before respawn',()=>{
  const {s}=preparedVictory(230926);
  const text=serialize(s),loaded=restore(text);
  assert.equal(serialize(loaded),text);
  assert.deepEqual(validate(loaded),[]);
});

test('SWA6 migrates an SWA5 terminal victory from ENGAGED/0 into DEFEATED lifecycle',()=>{
  const {s,a,m}=preparedVictory(42);
  // Reconstruct the released SWA5 terminal representation.
  m.status='ENGAGED';m.engagedByAgentId=a.id;m.defeatedTick=null;m.respawnTick=null;
  const legacy=JSON.stringify(s),loaded=restore(legacy);
  const la=loaded.agents.find(x=>x.id===a.id),lm=wildMonsterById(loaded,m.worldMonsterId);
  assert.equal(la.adventureCombat.status,'VICTORY');
  assert.ok(['DEFEATED','RESPAWNING'].includes(lm.status));
  assert.equal(lm.hpCurrent,0);
  assert.equal(lm.engagedByAgentId,null);
  assert.ok(Number.isSafeInteger(lm.defeatedTick));
  assert.equal(lm.respawnTick,lm.defeatedTick+WILD_MONSTER_RESPAWN_TICKS);
  assert.deepEqual(validate(loaded),[]);
});


test('SWA6 owner death releases an ACTIVE engaged Monster instead of leaving a stale lock',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
  makeAdventurer(s,a,60);
  const m=hunt(s,a);
  untilEncounter(s,a);
  assert.equal(command(s,'START_ADVENTURE_COMBAT',{agentId:a.id}).ok,true);
  assert.equal(m.status,'ENGAGED');
  a.satiety=0;a.hp=.1;
  step(s,1);
  assert.equal(a.alive,false);
  assert.equal(a.adventureCombat,null);
  assert.equal(m.status,'IDLE');
  assert.equal(m.engagedByAgentId,null);
  assert.ok(m.hpCurrent>0);
  assert.deepEqual(validateWildMonsterWorld(s),[]);
});
