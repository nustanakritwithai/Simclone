import test from 'node:test';
import assert from 'node:assert/strict';

import {createWorld,command,step,serialize,restore,validate} from '../src/engine.mjs';
import {recordEarnedSkill} from '../src/skill-provenance.mjs';
import {adventureXpForLevel} from '../src/adventure-progression.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {adventureExpeditionTaskValid} from '../src/adventure-expedition.mjs';

function makeAdventurer(s,a,level=1){
  a.adventurerQualification={version:1,accepted:3,recent:[
    {id:'0:1:1',tick:0,x:1,y:1},{id:'1:1:2',tick:1,x:1,y:2},{id:'2:2:2',tick:2,x:2,y:2}
  ]};
  const changed=adoptProfession(a,'EXPLORE',Math.max(2,s.tick),{qualifiedProfession:'adventurer',qualification:'explore-3'});
  if(changed.changed&&s.tick<2)s.tick=2;
  const targetXp=adventureXpForLevel(level),delta=targetXp-a.skills.ADVENTURE;
  if(delta>0){a.skills.ADVENTURE+=delta;assert.equal(recordEarnedSkill(a,'ADVENTURE',delta,s.tick,{action:'TEST_SWA4'}),true);}
  a.task=null;a.adventureEncounter=null;a.adventureCombat=null;a.satiety=100;a.energy=100;a.hp=100;
}
function monsterIn(s,zoneId){return s.wildMonsters.entities.filter(m=>m.zoneId===zoneId).sort((a,b)=>a.worldMonsterId.localeCompare(b.worldMonsterId));}
function startAvailable(s,a,zoneId='z1'){
  for(const m of monsterIn(s,zoneId)){
    const r=command(s,'START_ADVENTURE_HUNT',{agentId:a.id,worldMonsterId:m.worldMonsterId});
    if(r.ok)return {m,r};
  }
  assert.fail('expected a reachable monster in '+zoneId);
}
function runUntilEncounter(s,a,max=1200){
  for(let i=0;i<max&&!a.adventureEncounter;i++)step(s,1);
  assert.ok(a.adventureEncounter,'expected READY encounter from physical monster');
}

test('SWA4 selected physical monster creates a real-path hunt without teleporting',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
  makeAdventurer(s,a,1);
  const before={x:a.x,y:a.y},accepted=a.adventurerQualification.accepted,{m,r}=startAvailable(s,a,'z1');
  assert.deepEqual({x:a.x,y:a.y},before);
  assert.equal(r.worldMonsterId,m.worldMonsterId);
  assert.equal(a.task.kind,'EXPLORE');
  assert.equal(a.task.adventureHunt.worldMonsterId,m.worldMonsterId);
  assert.equal(Math.abs(a.task.x-m.x)+Math.abs(a.task.y-m.y),1);
  assert.equal(r.pathLength,a.task.path.length);
  assert.equal(adventureExpeditionTaskValid(s,a,a.task),true);

  runUntilEncounter(s,a);
  assert.equal(a.task,null);
  assert.equal(a.adventureEncounter.status,'READY');
  assert.equal(a.adventureEncounter.worldMonsterId,m.worldMonsterId);
  assert.equal(a.adventureEncounter.monsterId,m.monsterId);
  assert.equal(a.adventureEncounter.monsterLevel,m.level);
  assert.equal(a.adventureEncounter.rank,m.rank);
  assert.equal(Math.abs(a.x-m.x)+Math.abs(a.y-m.y),1);
  assert.equal(a.adventurerQualification.accepted,accepted,'hunt must not create generic EXPLORE qualification evidence');
  assert.deepEqual(validate(s),[]);
});

test('SWA4 hunt obeys zone level gate before assigning any path',()=>{
  const s=createWorld(42,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0],m=monsterIn(s,'z2')[0];
  makeAdventurer(s,a,1);
  const before=JSON.stringify({x:a.x,y:a.y,task:a.task});
  const denied=command(s,'START_ADVENTURE_HUNT',{agentId:a.id,worldMonsterId:m.worldMonsterId});
  assert.equal(denied.ok,false);
  assert.equal(denied.reason,'zone_level_gate');
  assert.equal(JSON.stringify({x:a.x,y:a.y,task:a.task}),before);
});

test('SWA4 one physical monster cannot be claimed by two Adventurers',()=>{
  const s=createWorld(2026,{mode:'independent',worldProfile:'same-world',population:2}),[a,b]=s.agents;
  makeAdventurer(s,a,1);makeAdventurer(s,b,1);
  const {m}=startAvailable(s,a,'z1');
  const denied=command(s,'START_ADVENTURE_HUNT',{agentId:b.id,worldMonsterId:m.worldMonsterId});
  assert.equal(denied.ok,false);
  assert.equal(denied.reason,'monster-busy');
  assert.equal(b.task,null);
});

test('SWA4 save/load during hunt reaches the same physical monster deterministically',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
  makeAdventurer(s,a,1);
  const {m}=startAvailable(s,a,'z1');
  step(s,5);
  const text=serialize(s),loaded=restore(text),b=loaded.agents.find(x=>x.id===a.id);
  assert.equal(serialize(loaded),text);
  runUntilEncounter(s,a);runUntilEncounter(loaded,b);
  assert.deepEqual(b.adventureEncounter,a.adventureEncounter);
  assert.equal(b.adventureEncounter.worldMonsterId,m.worldMonsterId);
  assert.equal(serialize(loaded),serialize(s));
});

test('SWA4 stale physical target invalidates the hunt contract instead of spawning a replacement',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0];
  makeAdventurer(s,a,1);
  const {m}=startAvailable(s,a,'z1');
  assert.equal(adventureExpeditionTaskValid(s,a,a.task),true);
  m.x+=1;
  assert.equal(adventureExpeditionTaskValid(s,a,a.task),false);
});
