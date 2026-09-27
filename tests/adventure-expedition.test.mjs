import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate} from '../src/engine.mjs';
import {recordEarnedSkill} from '../src/skill-provenance.mjs';
import {adventureXpForLevel} from '../src/adventure-progression.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {isAdventureZoneCell,adventureZoneSpatialBounds} from '../src/adventure-expedition.mjs';
import {zoneContainsMonster} from '../src/adventure-zones.mjs';

function makeAdventurer(s,a,level=1){
  a.adventurerQualification={version:1,accepted:3,recent:[
    {id:'0:1:1',tick:0,x:1,y:1},{id:'1:1:2',tick:1,x:1,y:2},{id:'2:2:2',tick:2,x:2,y:2}
  ]};
  const changed=adoptProfession(a,'EXPLORE',Math.max(2,s.tick),{qualifiedProfession:'adventurer',qualification:'explore-3'});
  if(changed.changed&&s.tick<2)s.tick=2;
  const targetXp=adventureXpForLevel(level),delta=targetXp-a.skills.ADVENTURE;
  if(delta>0){a.skills.ADVENTURE+=delta;assert.equal(recordEarnedSkill(a,'ADVENTURE',delta,s.tick,{action:'TEST_VERIFIED_ADVENTURE'}),true);}
  a.satiety=100;a.energy=100;a.hp=100;
}
function runUntilEncounter(s,a,max=1000){
  for(let i=0;i<max&&!a.adventureEncounter;i++)step(s,1);
  assert.ok(a.adventureEncounter,'expected a deterministic encounter');
}

test('I2 Khet zones occupy non-overlapping eastward world bands',()=>{
  const s=createWorld(4101,{mode:'independent',worldProfile:'large'});
  const bands=['z1','z2','z3','z4'].map(z=>adventureZoneSpatialBounds(s,z));
  for(let i=1;i<bands.length;i++)assert.ok(bands[i].minX>bands[i-1].maxX);
  assert.ok(bands[0].minX>0);
  assert.ok(bands[3].maxX<60);
});

test('I2 START_ADVENTURE_EXPEDITION uses the existing path and never teleports the Clone',()=>{
  const s=createWorld(4102,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  makeAdventurer(s,a,1);
  const before={x:a.x,y:a.y};
  const r=command(s,'START_ADVENTURE_EXPEDITION',{agentId:a.id,zoneId:'z1'});
  assert.equal(r.ok,true);
  assert.deepEqual({x:a.x,y:a.y},before);
  assert.ok(Array.isArray(a.task.path));
  assert.equal(a.task.kind,'EXPLORE');
  assert.ok(isAdventureZoneCell(s,'z1',a.task.x,a.task.y));
  assert.equal(r.pathLength,a.task.path.length);
  runUntilEncounter(s,a);
  assert.equal(a.x,a.adventureEncounter.x);
  assert.equal(a.y,a.adventureEncounter.y);
  assert.ok(isAdventureZoneCell(s,'z1',a.x,a.y));
  assert.equal(zoneContainsMonster('z1',a.adventureEncounter.monsterId),true);
  assert.equal(a.adventureEncounter.status,'READY');
  assert.deepEqual(validate(s),[]);
});

test('I2 combat level gate is enforced before a path is assigned',()=>{
  const s=createWorld(4103,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  makeAdventurer(s,a,1);
  const before=JSON.stringify({x:a.x,y:a.y,task:a.task});
  const denied=command(s,'START_ADVENTURE_EXPEDITION',{agentId:a.id,zoneId:'z2'});
  assert.equal(denied.ok,false);
  assert.equal(denied.reason,'zone_level_gate');
  assert.equal(JSON.stringify({x:a.x,y:a.y,task:a.task}),before);
  makeAdventurer(s,a,16);
  const allowed=command(s,'START_ADVENTURE_EXPEDITION',{agentId:a.id,zoneId:'z2'});
  assert.equal(allowed.ok,true);
});

test('I2 save/load during travel continues to the same encounter deterministically',()=>{
  const s=createWorld(4104,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  makeAdventurer(s,a,1);
  assert.equal(command(s,'START_ADVENTURE_EXPEDITION',{agentId:a.id,zoneId:'z1'}).ok,true);
  step(s,5);
  const loaded=restore(serialize(s)),b=loaded.agents.find(x=>x.id===a.id);
  runUntilEncounter(s,a);runUntilEncounter(loaded,b);
  assert.deepEqual(b.adventureEncounter,a.adventureEncounter);
  assert.equal(serialize(loaded),serialize(s));
});

test('I2 pending encounter blocks a second expedition and tampered expedition targets never create encounters',()=>{
  const s=createWorld(4105,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  makeAdventurer(s,a,1);
  assert.equal(command(s,'START_ADVENTURE_EXPEDITION',{agentId:a.id,zoneId:'z1'}).ok,true);
  runUntilEncounter(s,a);
  const second=command(s,'START_ADVENTURE_EXPEDITION',{agentId:a.id,zoneId:'z1'});
  assert.equal(second.ok,false);
  assert.equal(second.reason,'encounter-pending');

  const t=createWorld(4106,{mode:'independent',worldProfile:'large',population:1}),c=t.agents[0];
  makeAdventurer(t,c,1);
  assert.equal(command(t,'START_ADVENTURE_EXPEDITION',{agentId:c.id,zoneId:'z1'}).ok,true);
  c.task.x=1;c.task.y=1;c.task.path=[];
  step(t,1);
  assert.equal(c.adventureEncounter,undefined);
  assert.notEqual(c.task?.adventureExpedition?.entryX,1);
});
