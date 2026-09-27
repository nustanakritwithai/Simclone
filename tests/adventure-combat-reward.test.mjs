import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate} from '../src/engine.mjs';
import {recordEarnedSkill} from '../src/skill-provenance.mjs';
import {adventureXpForLevel} from '../src/adventure-progression.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {monsterDefinition} from '../src/adventure-monsters.mjs';
import {
  verifyAdventureCombatTerminalEvidence,
  commitVerifiedAdventureCombatReward,
  ADVENTURE_COMBAT_OUTCOME_EVIDENCE,
} from '../src/adventure-combat-reward.mjs';

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
  assert.equal(command(s,'START_ADVENTURE_EXPEDITION',{agentId:a.id,zoneId}).ok,true);
  for(let i=0;i<max&&!a.adventureEncounter;i++)step(s,1);
  assert.equal(a.adventureEncounter?.status,'READY');
}
function startCombat(s,a){
  assert.equal(command(s,'START_ADVENTURE_COMBAT',{agentId:a.id}).ok,true);
  assert.equal(a.adventureCombat.status,'ACTIVE');
}
function fightToTerminal(s,a,max=50){
  let last=null;
  for(let i=0;i<max&&a.adventureCombat.status==='ACTIVE';i++){
    last=command(s,'ADVENTURE_COMBAT_ACTION',{agentId:a.id,action:'BASIC_ATTACK',expectedTurn:a.adventureCombat.turn});
    assert.equal(last.ok,true);
  }
  assert.notEqual(a.adventureCombat.status,'ACTIVE');
  return last;
}

test('I4 active combat is OUTCOME_UNKNOWN and cannot imply XP',()=>{
  const s=createWorld(6101,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  makeAdventurer(s,a,20);reachEncounter(s,a);startCombat(s,a);
  const before=a.skills.ADVENTURE;
  const evidence=verifyAdventureCombatTerminalEvidence(a.adventureCombat);
  assert.equal(evidence.evidence,ADVENTURE_COMBAT_OUTCOME_EVIDENCE.UNKNOWN);
  assert.equal(evidence.xpAward,0);
  assert.equal(a.skills.ADVENTURE,before);
});

test('I4 VERIFIED victory atomically awards exactly the monster baseExpYield through ADVENTURE provenance',()=>{
  const s=createWorld(6102,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  makeAdventurer(s,a,60);const before=a.skills.ADVENTURE;reachEncounter(s,a,'z1');startCombat(s,a);
  const monsterId=a.adventureCombat.monsterId,baseExp=monsterDefinition(monsterId).baseExpYield;
  const beforeItems=JSON.stringify(s.rustPossessions?.items??[]);
  const last=fightToTerminal(s,a);
  assert.equal(a.adventureCombat.status,'VICTORY');
  assert.equal(last.outcomeEvidence,'VERIFIED');
  assert.equal(last.xpAwarded,baseExp);
  assert.equal(a.skills.ADVENTURE,before+baseExp);
  assert.equal(a.adventureCombat.reward.status,'COMMITTED');
  assert.equal(a.adventureCombat.reward.xpAward,baseExp);
  assert.equal(a.adventureCombat.reward.claimKey,'ADVENTURE_XP:'+a.adventureCombat.reward.outcomeId);
  assert.equal(JSON.stringify(s.rustPossessions?.items??[]),beforeItems);
  const work=a.skillProvenance.bySkill.ADVENTURE.evidence.at(-1);
  assert.equal(work.kind,'work');
  assert.equal(work.xp,baseExp);
  assert.equal(work.action,'ADVENTURE_COMBAT_VICTORY:'+monsterId);
  assert.deepEqual(validate(s),[]);
});

test('I4 committed reward is idempotent and direct replay does not add XP twice',()=>{
  const s=createWorld(6103,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  makeAdventurer(s,a,60);reachEncounter(s,a);startCombat(s,a);fightToTerminal(s,a);
  assert.equal(a.adventureCombat.status,'VICTORY');
  const xp=a.skills.ADVENTURE,before=serialize(s);
  const repeated=commitVerifiedAdventureCombatReward(a,a.adventureCombat,s.tick);
  assert.equal(repeated.changed,false);
  assert.equal(repeated.xpAward,0);
  assert.equal(a.skills.ADVENTURE,xp);
  assert.equal(serialize(s),before);
});

test('I4 evidence conflict never becomes VERIFIED',()=>{
  const s=createWorld(6104,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  makeAdventurer(s,a,60);reachEncounter(s,a);startCombat(s,a);fightToTerminal(s,a);
  assert.equal(a.adventureCombat.status,'VICTORY');
  const tampered=JSON.parse(JSON.stringify(a.adventureCombat));
  tampered.lastTurn.monsterHpAfter=1;
  const evidence=verifyAdventureCombatTerminalEvidence(tampered);
  assert.equal(evidence.evidence,ADVENTURE_COMBAT_OUTCOME_EVIDENCE.CONFLICT);
  assert.equal(evidence.xpAward,0);
});

test('I4 VERIFIED defeat is explicitly a zero-XP outcome',()=>{
  const fixture={
    combatId:'advcombat:test-defeat',status:'DEFEATED',turn:1,monsterId:'MON_001',
    monsterHpCurrent:7,
    lastTurn:{turn:0,status:'DEFEATED',heroDamage:2,counterDamage:9,monsterHpBefore:9,monsterHpAfter:7,agentHpBefore:10,agentHpAfter:1}
  };
  const evidence=verifyAdventureCombatTerminalEvidence(fixture);
  assert.equal(evidence.evidence,'VERIFIED');
  assert.equal(evidence.outcome,'DEFEATED');
  assert.equal(evidence.xpAward,0);
});

test('I4 terminal reward survives save/load byte-identically and no Rust loot is granted yet',()=>{
  const s=createWorld(6105,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  makeAdventurer(s,a,60);reachEncounter(s,a);startCombat(s,a);fightToTerminal(s,a);
  assert.equal(a.adventureCombat.status,'VICTORY');
  const text=serialize(s),loaded=restore(text);
  assert.equal(serialize(loaded),text);
  assert.deepEqual(loaded.agents[0].adventureCombat.reward,a.adventureCombat.reward);
  assert.deepEqual(validate(loaded),[]);
});
