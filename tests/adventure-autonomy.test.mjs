import test from 'node:test';
import assert from 'node:assert/strict';

import {createWorld,step,serialize,restore,validate,command} from '../src/engine.mjs';
import {recordEarnedSkill} from '../src/skill-provenance.mjs';
import {adventureXpForLevel} from '../src/adventure-progression.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {AUTONOMOUS_ADVENTURE_POLICY,chooseAutonomousAdventureTarget} from '../src/adventure-autonomy.mjs';
import {ADVENTURE_HUNT_AUTONOMOUS_POLICY,findAdventureMonsterEngagement} from '../src/adventure-expedition.mjs';
import {routeField,routeDistance,walkable} from '../src/survival.mjs';

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


test('AUTO-ADV2 targets the strongest reachable Monster that does not exceed own Adventure level',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
  const z1=s.wildMonsters.entities.filter(m=>m.zoneId==='z1'&&m.status==='IDLE').sort((x,y)=>x.level-y.level||x.worldMonsterId.localeCompare(y.worldMonsterId));
  assert.ok(z1.length>0);
  const trainingLevel=z1[0].level;
  makeAdventurer(s,a,trainingLevel);
  const target=chooseAutonomousAdventureTarget(s,a);
  assert.ok(target);
  assert.ok(target.monsterLevel<=trainingLevel);
  const expectedLevel=Math.max(...z1.filter(m=>m.level<=trainingLevel).map(m=>m.level));
  assert.equal(target.monsterLevel,expectedLevel);
  assert.equal(target.adventureLevel,trainingLevel);
  assert.equal(target.levelGap,trainingLevel-target.monsterLevel);
});

test('AUTO-ADV2 waits for safe respawn instead of attacking an over-level Monster',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
  const z1=s.wildMonsters.entities.filter(m=>m.zoneId==='z1').sort((x,y)=>x.level-y.level);
  const trainingLevel=z1[0].level;
  makeAdventurer(s,a,trainingLevel);
  for(const m of s.wildMonsters.entities)if(m.level<=trainingLevel){
    m.status='DEFEATED';m.hpCurrent=0;m.defeatedTick=s.tick;m.respawnTick=s.tick+5;m.engagedByAgentId=null;
  }
  assert.equal(chooseAutonomousAdventureTarget(s,a),null);
});

test('AUTO-ADV2 leveling up unlocks stronger training targets deterministically',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
  const z1=s.wildMonsters.entities.filter(m=>m.zoneId==='z1'&&m.status==='IDLE').sort((x,y)=>x.level-y.level||x.worldMonsterId.localeCompare(y.worldMonsterId));
  const low=z1[0].level,high=z1.at(-1).level;
  makeAdventurer(s,a,low);
  const first=chooseAutonomousAdventureTarget(s,a);
  assert.ok(first&&first.monsterLevel<=low);
  makeAdventurer(s,a,high);
  const next=chooseAutonomousAdventureTarget(s,a);
  assert.ok(next&&next.monsterLevel<=high);
  assert.ok(next.monsterLevel>=first.monsterLevel);
  assert.equal(next.monsterLevel,high);
});


test('AUTO-ADV2.1 engine rejects a nearer weak Monster when level policy selects a farther stronger safe target',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
  makeAdventurer(s,a,15);
  const field=routeField(s,a),rows=[];
  for(const m of s.wildMonsters.entities.filter(m=>m.zoneId==='z1'&&m.status==='IDLE')){
    try{
      const e=findAdventureMonsterEngagement(s,a,m.worldMonsterId,15,{walkable,routeField:()=>field,routeDistance});
      rows.push({m,d:e.routeDistance});
    }catch{}
  }
  rows.sort((x,y)=>x.d-y.d||x.m.worldMonsterId.localeCompare(y.m.worldMonsterId));
  assert.ok(rows.length>=2);
  const nearest=rows[0],farther=[...rows].reverse().find(row=>row.d>nearest.d);
  assert.ok(farther,'fixture needs a farther reachable z1 Monster');
  for(const row of rows)row.m.level=1;
  farther.m.level=15;

  const expected=chooseAutonomousAdventureTarget(s,a);
  assert.ok(expected);
  assert.equal(expected.worldMonsterId,farther.m.worldMonsterId);
  assert.ok(expected.routeDistance>nearest.d);

  const denied=command(s,'START_ADVENTURE_HUNT',{agentId:a.id,worldMonsterId:nearest.m.worldMonsterId,control:'autonomous'});
  assert.equal(denied.ok,false);
  assert.equal(denied.reason,'target-policy');
  assert.equal(a.task,null);

  const accepted=command(s,'START_ADVENTURE_HUNT',{agentId:a.id,worldMonsterId:expected.worldMonsterId,control:'autonomous'});
  assert.equal(accepted.ok,true);
  assert.equal(a.task.adventureHunt.worldMonsterId,expected.worldMonsterId);
  assert.equal(a.task.adventureHunt.targetPolicy,ADVENTURE_HUNT_AUTONOMOUS_POLICY);
});

test('AUTO-ADV2.1 restore drops a pre-policy autonomous Hunt task and reselects under level-grinding policy',()=>{
  const s=createWorld(42,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
  makeAdventurer(s,a,60);
  step(s,1);
  assert.equal(a.task?.adventureHunt?.targetPolicy,ADVENTURE_HUNT_AUTONOMOUS_POLICY);
  const legacy=JSON.parse(serialize(s));
  delete legacy.agents[0].task.adventureHunt.targetPolicy;

  const loaded=restore(JSON.stringify(legacy)),b=loaded.agents[0];
  assert.equal(b.task,null);
  step(loaded,1);
  assert.equal(b.task?.adventureHunt?.control,'autonomous');
  assert.equal(b.task?.adventureHunt?.targetPolicy,ADVENTURE_HUNT_AUTONOMOUS_POLICY);
});

test('AUTO-ADV safe Adventurer selects a physical Monster and starts a real Hunt without UI commands',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
  makeAdventurer(s,a,60);
  const expected=chooseAutonomousAdventureTarget(s,a);
  assert.ok(expected);
  const before={x:a.x,y:a.y};
  step(s,1);
  assert.equal(a.task?.adventureHunt?.worldMonsterId,expected.worldMonsterId);
  assert.equal(a.task?.adventureHunt?.control,'autonomous');
  assert.equal(a.task?.adventureHunt?.targetPolicy,ADVENTURE_HUNT_AUTONOMOUS_POLICY);
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


test('AUTO-ADV releases terminal result before the five-tick respawn boundary',()=>{
  assert.ok(AUTONOMOUS_ADVENTURE_POLICY.resultHoldTicks<5);
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


test('AUTO-ADV2 selector skips a Monster already claimed by another Adventurer',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:2}),[a,b]=s.agents;
  makeAdventurer(s,a,60);makeAdventurer(s,b,60);
  const first=chooseAutonomousAdventureTarget(s,a);
  assert.ok(first);
  const claimed=command(s,'START_ADVENTURE_HUNT',{agentId:a.id,worldMonsterId:first.worldMonsterId,control:'autonomous'});
  assert.equal(claimed.ok,true);
  const second=chooseAutonomousAdventureTarget(s,b);
  assert.ok(second);
  assert.notEqual(second.worldMonsterId,first.worldMonsterId);
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
