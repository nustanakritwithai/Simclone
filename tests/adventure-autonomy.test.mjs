import test from 'node:test';
import assert from 'node:assert/strict';

import {createWorld,step,serialize,restore,validate} from '../src/engine.mjs';
import {recordEarnedSkill} from '../src/skill-provenance.mjs';
import {adventureXpForLevel} from '../src/adventure-progression.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {AUTONOMOUS_ADVENTURE_POLICY,chooseAutonomousAdventureTarget} from '../src/adventure-autonomy.mjs';

function makeAdventurer(s,a,level=60){
  a.adventurerQualification={version:1,accepted:3,recent:[
    {id:'0:1:1',tick:0,x:1,y:1},
    {id:'1:1:2',tick:1,x:1,y:2},
    {id:'2:2:2',tick:2,x:2,y:2},
  ]};
  const changed=adoptProfession(a,'EXPLORE',Math.max(2,s.tick),{qualifiedProfession:'adventurer',qualification:'explore-3'});
  if(changed.changed&&s.tick<2)s.tick=2;
  const targetXp=adventureXpForLevel(level),delta=targetXp-a.skills.ADVENTURE;
  if(delta>0){
    a.skills.ADVENTURE+=delta;
    assert.equal(recordEarnedSkill(a,'ADVENTURE',delta,s.tick,{action:'TEST_AUTO_ADVENTURE'}),true);
  }
  a.task=null;a.adventureEncounter=null;a.adventureCombat=null;
  a.hp=100;a.satiety=100;a.energy=100;
}

function runUntil(s,predicate,max=5000){
  for(let i=0;i<max;i++){
    if(predicate())return i;
    step(s,1);
  }
  assert.fail('autonomous Adventure condition not reached within '+max+' ticks');
}

test('AUTO-ADV safe Adventurer selects a physical Monster and starts a real Hunt without UI commands',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
  makeAdventurer(s,a,60);
  const expected=chooseAutonomousAdventureTarget(s,a);
  assert.ok(expected);
  const before={x:a.x,y:a.y};
  step(s,1);
  assert.equal(a.task?.adventureHunt?.worldMonsterId,expected.worldMonsterId);
  assert.equal(a.task?.adventureHunt?.control,'autonomous');
  assert.deepEqual({x:a.x,y:a.y},before);
  assert.ok(a.task.path.length>0);
  assert.equal(Math.abs(a.task.x-a.task.adventureHunt.monsterX)+Math.abs(a.task.y-a.task.adventureHunt.monsterY),1);
  assert.deepEqual(validate(s),[]);
});

test('AUTO-ADV Hunt progresses through READY, ENGAGED and autonomous BASIC_ATTACK turns',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
  makeAdventurer(s,a,60);
  step(s,1);
  const targetId=a.task.adventureHunt.worldMonsterId;

  runUntil(s,()=>a.adventureEncounter?.worldMonsterId===targetId);
  assert.equal(a.adventureEncounter.status,'READY');
  assert.equal(a.adventureEncounter.control,'autonomous');

  runUntil(s,()=>a.adventureCombat?.worldMonsterId===targetId);
  const m=s.wildMonsters.entities.find(x=>x.worldMonsterId===targetId);
  assert.equal(a.adventureCombat.status,'ACTIVE');
  assert.equal(a.adventureCombat.control,'autonomous');
  assert.equal(m.status,'ENGAGED');
  assert.equal(m.engagedByAgentId,a.id);

  const hp=m.hpCurrent;
  runUntil(s,()=>a.adventureCombat?.turn>=1);
  assert.ok(m.hpCurrent<=hp);
  assert.equal(a.adventureCombat.lastTurn.monsterHpAfter,m.hpCurrent);
  assert.deepEqual(validate(s),[]);
});

test('AUTO-ADV completes a world-bound fight and clears terminal result automatically',()=>{
  const s=createWorld(42,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
  makeAdventurer(s,a,60);
  step(s,1);
  const targetId=a.task.adventureHunt.worldMonsterId;
  runUntil(s,()=>a.adventureCombat?.worldMonsterId===targetId);
  runUntil(s,()=>a.adventureCombat&&a.adventureCombat.status!=='ACTIVE');
  const terminal=a.adventureCombat.status;
  assert.ok(['VICTORY','DEFEATED'].includes(terminal));

  runUntil(s,()=>a.adventureCombat===null);
  assert.equal(a.adventureEncounter,null);
  if(terminal==='VICTORY'){
    const old=s.wildMonsters.entities.find(m=>m.worldMonsterId===targetId);
    assert.ok(old===undefined||['DEFEATED','RESPAWNING','IDLE'].includes(old.status));
  }
  assert.deepEqual(validate(s),[]);
});

test('AUTO-ADV survival gates prevent Hunt selection when HP, satiety or energy is unsafe',()=>{
  for(const [field,value] of [
    ['hp',AUTONOMOUS_ADVENTURE_POLICY.minHp-1],
    ['satiety',AUTONOMOUS_ADVENTURE_POLICY.minSatiety-1],
    ['energy',AUTONOMOUS_ADVENTURE_POLICY.minEnergy-1],
  ]){
    const s=createWorld(2026,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
    makeAdventurer(s,a,60);a[field]=value;
    assert.equal(chooseAutonomousAdventureTarget(s,a),null);
    step(s,1);
    assert.equal(Boolean(a.task?.adventureHunt),false,field+' must block autonomous hunt');
  }
});

test('AUTO-ADV two Adventurers never autonomously claim the same worldMonsterId',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:2}),[a,b]=s.agents;
  makeAdventurer(s,a,60);makeAdventurer(s,b,60);
  runUntil(s,()=>Boolean(a.task?.adventureHunt)&&Boolean(b.task?.adventureHunt),50);
  assert.notEqual(a.task.adventureHunt.worldMonsterId,b.task.adventureHunt.worldMonsterId);
  assert.deepEqual(validate(s),[]);
});

test('AUTO-ADV save/load during autonomous Hunt remains deterministic',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
  makeAdventurer(s,a,60);step(s,1);step(s,12);
  const text=serialize(s),loaded=restore(text),b=loaded.agents[0];
  assert.equal(serialize(loaded),text);
  for(let i=0;i<180;i++){step(s,1);step(loaded,1);}
  assert.equal(serialize(loaded),serialize(s));
  assert.equal(b.profession,'adventurer');
  assert.deepEqual(validate(loaded),[]);
});


test('AUTO-ADV never advances a manual READY or terminal Combat chain',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
  makeAdventurer(s,a,60);
  const target=chooseAutonomousAdventureTarget(s,a);
  assert.ok(target);
  const hunt=command(s,'START_ADVENTURE_HUNT',{agentId:a.id,worldMonsterId:target.worldMonsterId});
  assert.equal(hunt.ok,true);
  assert.equal(a.task.adventureHunt.control,undefined);
  runUntil(s,()=>a.adventureEncounter?.worldMonsterId===target.worldMonsterId);
  assert.equal(a.adventureEncounter.control,undefined);
  const heldTick=s.tick;
  step(s,AUTONOMOUS_ADVENTURE_POLICY.readyHoldTicks+2);
  assert.equal(a.adventureCombat,null);
  assert.equal(a.adventureEncounter.status,'READY');
  assert.ok(s.tick>heldTick);
});
