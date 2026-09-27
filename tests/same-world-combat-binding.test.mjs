import test from 'node:test';
import assert from 'node:assert/strict';

import {createWorld,command,step,serialize,restore,validate} from '../src/engine.mjs';
import {recordEarnedSkill} from '../src/skill-provenance.mjs';
import {adventureXpForLevel} from '../src/adventure-progression.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {
  commitWildMonsterCombatHp,
  releaseWildMonsterEngagement,
  wildMonsterById,
} from '../src/adventure-world-monsters.mjs';

function makeAdventurer(s,a,level=1){
  a.adventurerQualification={version:1,accepted:3,recent:[
    {id:'0:1:1',tick:0,x:1,y:1},{id:'1:1:2',tick:1,x:1,y:2},{id:'2:2:2',tick:2,x:2,y:2}
  ]};
  const changed=adoptProfession(a,'EXPLORE',Math.max(2,s.tick),{qualifiedProfession:'adventurer',qualification:'explore-3'});
  if(changed.changed&&s.tick<2)s.tick=2;
  const targetXp=adventureXpForLevel(level),delta=targetXp-a.skills.ADVENTURE;
  if(delta>0){
    a.skills.ADVENTURE+=delta;
    assert.equal(recordEarnedSkill(a,'ADVENTURE',delta,s.tick,{action:'TEST_SWA5'}),true);
  }
  a.task=null;a.adventureEncounter=null;a.adventureCombat=null;a.satiety=100;a.energy=100;a.hp=100;
}
function monstersIn(s,zoneId){
  return s.wildMonsters.entities.filter(m=>m.zoneId===zoneId).sort((a,b)=>a.worldMonsterId.localeCompare(b.worldMonsterId));
}
function startHunt(s,a,zoneId='z1'){
  for(const m of monstersIn(s,zoneId)){
    const r=command(s,'START_ADVENTURE_HUNT',{agentId:a.id,worldMonsterId:m.worldMonsterId});
    if(r.ok)return m;
  }
  assert.fail('expected reachable monster in '+zoneId);
}
function runUntilEncounter(s,a,max=1600){
  for(let i=0;i<max&&!a.adventureEncounter;i++)step(s,1);
  assert.ok(a.adventureEncounter,'expected READY encounter');
}
function prepareCombat(seed=230926,zoneId='z1',level=1,population=1){
  const s=createWorld(seed,{mode:'independent',worldProfile:'same-world',population}),a=s.agents[0];
  makeAdventurer(s,a,level);
  const m=startHunt(s,a,zoneId);
  runUntilEncounter(s,a);
  assert.equal(a.adventureEncounter.worldMonsterId,m.worldMonsterId);
  const start=command(s,'START_ADVENTURE_COMBAT',{agentId:a.id});
  assert.equal(start.ok,true);
  return {s,a,m,start};
}

test('SWA5 start combat binds the READY encounter to the exact world Monster',()=>{
  const {s,a,m,start}=prepareCombat();
  assert.equal(start.worldMonsterId,m.worldMonsterId);
  assert.equal(a.adventureCombat.worldMonsterId,m.worldMonsterId);
  assert.equal(Object.hasOwn(a.adventureCombat,'monsterHpCurrent'),false);
  assert.equal(m.status,'ENGAGED');
  assert.equal(m.engagedByAgentId,a.id);
  assert.equal(start.monsterHpCurrent,m.hpCurrent);
  assert.equal(Math.abs(a.x-m.x)+Math.abs(a.y-m.y),1);
  assert.deepEqual(validate(s),[]);
});

test('SWA5 BASIC_ATTACK commits Monster HP only through world entity authority',()=>{
  const {s,a,m}=prepareCombat(42);
  const before=m.hpCurrent,turn=a.adventureCombat.turn;
  const r=command(s,'ADVENTURE_COMBAT_ACTION',{agentId:a.id,action:'BASIC_ATTACK',expectedTurn:turn});
  assert.equal(r.ok,true);
  assert.equal(Object.hasOwn(a.adventureCombat,'monsterHpCurrent'),false);
  assert.equal(a.adventureCombat.lastTurn.monsterHpBefore,before);
  assert.equal(a.adventureCombat.lastTurn.monsterHpAfter,m.hpCurrent);
  assert.equal(r.monsterHpCurrent,m.hpCurrent);
  assert.ok(m.hpCurrent<=before);
  if(a.adventureCombat.status==='ACTIVE'){
    assert.equal(m.status,'ENGAGED');
    assert.equal(m.engagedByAgentId,a.id);
    assert.ok(m.hpCurrent>0);
  }else if(a.adventureCombat.status==='VICTORY'){
    assert.equal(m.status,'ENGAGED');
    assert.equal(m.engagedByAgentId,a.id);
    assert.equal(m.hpCurrent,0);
  }else{
    assert.equal(a.adventureCombat.status,'DEFEATED');
    assert.equal(m.status,'IDLE');
    assert.equal(m.engagedByAgentId,null);
    assert.ok(m.hpCurrent>0);
  }
  assert.deepEqual(validate(s),[]);
});

test('SWA5 active world-bound combat survives save/load byte-identically',()=>{
  const {s,a,m}=prepareCombat(2026);
  const text=serialize(s),loaded=restore(text),b=loaded.agents.find(x=>x.id===a.id),lm=wildMonsterById(loaded,m.worldMonsterId);
  assert.equal(serialize(loaded),text);
  assert.equal(lm.status,'ENGAGED');
  assert.equal(lm.engagedByAgentId,b.id);
  assert.equal(b.adventureCombat.worldMonsterId,lm.worldMonsterId);
  assert.equal(Object.hasOwn(b.adventureCombat,'monsterHpCurrent'),false);
  assert.deepEqual(validate(loaded),[]);

  const ra=command(s,'ADVENTURE_COMBAT_ACTION',{agentId:a.id,action:'BASIC_ATTACK',expectedTurn:a.adventureCombat.turn});
  const rb=command(loaded,'ADVENTURE_COMBAT_ACTION',{agentId:b.id,action:'BASIC_ATTACK',expectedTurn:b.adventureCombat.turn});
  assert.equal(ra.ok,true);assert.equal(rb.ok,true);
  assert.equal(serialize(loaded),serialize(s));
});

test('SWA5 ENGAGED Monster rejects a second Adventurer hunt',()=>{
  const {s,a,m}=prepareCombat(230926,'z1',1,2),b=s.agents[1];
  makeAdventurer(s,b,1);
  assert.equal(m.status,'ENGAGED');
  const denied=command(s,'START_ADVENTURE_HUNT',{agentId:b.id,worldMonsterId:m.worldMonsterId});
  assert.equal(denied.ok,false);
  assert.equal(denied.reason,'monster-unavailable');
  assert.equal(b.task,null);
  assert.deepEqual(validate(s),[]);
});

test('SWA5 world HP commit rejects stale turn evidence atomically',()=>{
  const {s,a,m}=prepareCombat(42);
  const before=serialize(s);
  assert.throws(()=>commitWildMonsterCombatHp(s,m.worldMonsterId,a.id,{
    expectedBefore:m.hpCurrent+1,
    hpAfter:Math.max(0,m.hpCurrent-1)
  }),/monster_hp_stale/);
  assert.equal(serialize(s),before);
});

test('SWA5 released engagement returns a surviving Monster to IDLE without healing it',()=>{
  const {s,a,m}=prepareCombat(2026);
  const before=m.hpCurrent,after=Math.max(1,before-1);
  commitWildMonsterCombatHp(s,m.worldMonsterId,a.id,{expectedBefore:before,hpAfter:after});
  releaseWildMonsterEngagement(s,m.worldMonsterId,a.id);
  assert.equal(m.status,'IDLE');
  assert.equal(m.engagedByAgentId,null);
  assert.equal(m.hpCurrent,after);
});

test('SWA5 world-bound combat reaches a terminal state without creating a second Monster HP ledger',()=>{
  const {s,a,m}=prepareCombat(230926);
  for(let i=0;i<100&&a.adventureCombat.status==='ACTIVE';i++){
    const r=command(s,'ADVENTURE_COMBAT_ACTION',{agentId:a.id,action:'BASIC_ATTACK',expectedTurn:a.adventureCombat.turn});
    assert.equal(r.ok,true);
    assert.equal(Object.hasOwn(a.adventureCombat,'monsterHpCurrent'),false);
  }
  assert.notEqual(a.adventureCombat.status,'ACTIVE');
  if(a.adventureCombat.status==='VICTORY'){
    assert.equal(m.status,'ENGAGED');
    assert.equal(m.hpCurrent,0);
    assert.equal(m.engagedByAgentId,a.id);
    assert.equal(a.adventureCombat.reward?.status,'COMMITTED');
  }else{
    assert.equal(a.adventureCombat.status,'DEFEATED');
    assert.equal(m.status,'IDLE');
    assert.ok(m.hpCurrent>0);
    assert.equal(m.engagedByAgentId,null);
  }
  assert.deepEqual(validate(s),[]);
});
