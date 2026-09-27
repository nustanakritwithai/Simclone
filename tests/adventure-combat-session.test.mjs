import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate} from '../src/engine.mjs';
import {recordEarnedSkill} from '../src/skill-provenance.mjs';
import {adventureXpForLevel} from '../src/adventure-progression.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {neutralAdventurerCoreStatsAtLevel} from '../src/adventure-human-combat.mjs';

function makeAdventurer(s,a,level=1){
  a.adventurerQualification={version:1,accepted:3,recent:[
    {id:'0:1:1',tick:0,x:1,y:1},{id:'1:1:2',tick:1,x:1,y:2},{id:'2:2:2',tick:2,x:2,y:2}
  ]};
  const changed=adoptProfession(a,'EXPLORE',Math.max(2,s.tick),{qualifiedProfession:'adventurer',qualification:'explore-3'});
  if(changed.changed&&s.tick<2)s.tick=2;
  const target=adventureXpForLevel(level),delta=target-a.skills.ADVENTURE;
  if(delta>0){a.skills.ADVENTURE+=delta;assert.equal(recordEarnedSkill(a,'ADVENTURE',delta,s.tick,{action:'TEST_VERIFIED_ADVENTURE'}),true);}
  a.satiety=100;a.energy=100;a.hp=100;
}
function reachEncounter(s,a,zoneId='z1',max=2000){
  const r=command(s,'START_ADVENTURE_EXPEDITION',{agentId:a.id,zoneId});assert.equal(r.ok,true);
  for(let i=0;i<max&&!a.adventureEncounter;i++)step(s,1);
  assert.equal(a.adventureEncounter?.status,'READY');
}
function startCombat(s,a){
  const r=command(s,'START_ADVENTURE_COMBAT',{agentId:a.id});assert.equal(r.ok,true);
  assert.equal(a.adventureEncounter,null);
  assert.equal(a.adventureCombat.status,'ACTIVE');
}

test('I3 neutral human Core6 uses the Pocket-shaped level formula without reading ordinary work skills',()=>{
  assert.deepEqual(neutralAdventurerCoreStatsAtLevel(1),{hp:12,atk:6,def:6,spAtk:6,spDef:6,spd:6});
  assert.deepEqual(neutralAdventurerCoreStatsAtLevel(60),{hp:139,atk:74,def:74,spAtk:74,spDef:74,spd:74});
});

test('I3 starts combat from READY encounter and stores monster HP only, not a human HP ledger',()=>{
  const s=createWorld(5101,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  makeAdventurer(s,a,1);reachEncounter(s,a);const hp=a.hp;startCombat(s,a);
  assert.equal(a.hp,hp);
  assert.ok(a.adventureCombat.monsterHpMax>0);
  assert.equal(a.adventureCombat.monsterHpCurrent,a.adventureCombat.monsterHpMax);
  for(const forbidden of ['agentHpCurrent','humanHpCurrent','heroHpCurrent','hpCurrent'])assert.equal(Object.hasOwn(a.adventureCombat,forbidden),false);
  assert.deepEqual(validate(s),[]);
});

test('I3 one turn commits counter damage to canonical agent.hp and replaying the same expectedTurn is rejected',()=>{
  const s=createWorld(5102,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  makeAdventurer(s,a,10);reachEncounter(s,a);startCombat(s,a);
  const before=serialize(s),turn=a.adventureCombat.turn;
  const first=command(s,'ADVENTURE_COMBAT_ACTION',{agentId:a.id,action:'BASIC_ATTACK',expectedTurn:turn});
  assert.equal(first.ok,true);
  assert.equal(a.adventureCombat.turn,turn+1);
  assert.ok(a.hp>0&&a.hp<=100);
  const after=serialize(s);
  const replay=command(s,'ADVENTURE_COMBAT_ACTION',{agentId:a.id,action:'BASIC_ATTACK',expectedTurn:turn});
  assert.equal(replay.ok,false);assert.equal(replay.reason,'stale-turn');
  assert.equal(serialize(s),after);
  assert.notEqual(after,before);
  assert.deepEqual(validate(s),[]);
});

test('I3 combat continuation is deterministic across save/load',()=>{
  const s=createWorld(5103,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  makeAdventurer(s,a,20);reachEncounter(s,a);startCombat(s,a);
  const loaded=restore(serialize(s)),b=loaded.agents.find(x=>x.id===a.id);
  for(let i=0;i<5&&a.adventureCombat.status==='ACTIVE';i++){
    const ra=command(s,'ADVENTURE_COMBAT_ACTION',{agentId:a.id,action:'BASIC_ATTACK',expectedTurn:a.adventureCombat.turn});
    const rb=command(loaded,'ADVENTURE_COMBAT_ACTION',{agentId:b.id,action:'BASIC_ATTACK',expectedTurn:b.adventureCombat.turn});
    assert.deepEqual(rb,ra);
  }
  assert.equal(serialize(loaded),serialize(s));
  assert.deepEqual(validate(s),[]);
});

test('I3 combat defeat never writes agent.hp to zero and does not trigger permanent death authority',()=>{
  const s=createWorld(5104,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  makeAdventurer(s,a,60);reachEncounter(s,a,'z4');startCombat(s,a);
  a.hp=2;
  let guard=0;
  while(a.adventureCombat.status==='ACTIVE'&&guard++<20){
    const r=command(s,'ADVENTURE_COMBAT_ACTION',{agentId:a.id,action:'BASIC_ATTACK',expectedTurn:a.adventureCombat.turn});
    assert.equal(r.ok,true);
  }
  if(a.adventureCombat.status==='DEFEATED'){
    assert.equal(a.hp,1);
    assert.equal(a.alive,true);
    assert.equal(a.death,null);
  }else{
    assert.equal(a.adventureCombat.status,'VICTORY');
    assert.ok(a.hp>0);
  }
  assert.deepEqual(validate(s),[]);
});

test('I3 victory is terminal evidence only: no Adventure XP or Rust item reward is committed yet',()=>{
  const s=createWorld(5105,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  makeAdventurer(s,a,60);const xp=a.skills.ADVENTURE;reachEncounter(s,a,'z1');startCombat(s,a);
  const beforeItems=JSON.stringify(s.rustPossessions?.items??[]);
  let guard=0;
  while(a.adventureCombat.status==='ACTIVE'&&guard++<20){
    const r=command(s,'ADVENTURE_COMBAT_ACTION',{agentId:a.id,action:'BASIC_ATTACK',expectedTurn:a.adventureCombat.turn});
    assert.equal(r.ok,true);
  }
  assert.equal(a.adventureCombat.status,'VICTORY');
  assert.equal(a.skills.ADVENTURE,xp);
  assert.equal(JSON.stringify(s.rustPossessions?.items??[]),beforeItems);
  assert.deepEqual(validate(s),[]);
});
