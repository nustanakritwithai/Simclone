import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ADVENTURE_JOURNEY_VISUAL_VERSION,
  ADVENTURE_DEFEAT_CUE_TICKS,
  ADVENTURE_RESPAWN_CUE_TICKS,
  adventureJourneyVisualSnapshot,
} from '../src/read-models/adventure-journey-visuals.mjs';

const monster=(overrides={})=>({
  worldMonsterId:'wm:z1:0:0',monsterId:'MON_002',zoneId:'z1',x:10,y:8,
  hpCurrent:26,hpMax:26,status:'IDLE',spawnEpoch:0,spawnedTick:0,
  defeatedTick:null,respawnTick:null,...overrides
});
const agent=(overrides={})=>({id:1,alive:true,x:8,y:8,task:null,adventureEncounter:null,adventureCombat:null,...overrides});
const state=(a,m,tick=10)=>({tick,agents:[a],wildMonsters:{entities:[m]}});

test('D3 HUNT projects authoritative target, engagement and route without mutation',()=>{
  const m=monster(),a=agent({task:{
    path:[{x:9,y:8}],adventureHunt:{worldMonsterId:m.worldMonsterId,zoneId:'z1',monsterX:m.x,monsterY:m.y,targetX:9,targetY:8}
  }}),s=state(a,m),before=JSON.stringify(s);
  const view=adventureJourneyVisualSnapshot(s,{activeAgentId:1});
  assert.equal(JSON.stringify(s),before);
  assert.equal(view.version,ADVENTURE_JOURNEY_VISUAL_VERSION);
  assert.equal(view.journeys[0].phase,'HUNT');
  assert.deepEqual(view.journeys[0].actor,{x:8,y:8});
  assert.deepEqual(view.journeys[0].target,{x:10,y:8});
  assert.deepEqual(view.journeys[0].engagement,{x:9,y:8});
  assert.deepEqual(view.journeys[0].path,[{x:8,y:8},{x:9,y:8}]);
  assert.equal(view.journeys[0].active,true);
  assert.ok(Object.isFrozen(view));
});

test('D3 READY reads exact worldMonsterId from encounter',()=>{
  const m=monster(),a=agent({x:9,y:8,adventureEncounter:{
    status:'READY',worldMonsterId:m.worldMonsterId,zoneId:'z1',monsterId:m.monsterId
  }});
  const j=adventureJourneyVisualSnapshot(state(a,m)).journeys[0];
  assert.equal(j.phase,'READY');
  assert.equal(j.targetWorldMonsterId,m.worldMonsterId);
  assert.equal(j.monsterStatus,'IDLE');
});

test('D3 ENGAGED reads canonical world HP and last-turn evidence',()=>{
  const m=monster({status:'ENGAGED',hpCurrent:14}),a=agent({x:9,y:8,adventureCombat:{
    status:'ACTIVE',worldMonsterId:m.worldMonsterId,zoneId:'z1',monsterId:m.monsterId,monsterHpMax:26,turn:2,
    lastTurn:{turn:1,status:'ACTIVE',heroDamage:12,heroHit:true,heroCritical:false,counterDamage:4,counterHit:true,counterCritical:false,monsterHpBefore:26,monsterHpAfter:14,agentHpBefore:100,agentHpAfter:96}
  }});
  const j=adventureJourneyVisualSnapshot(state(a,m)).journeys[0];
  assert.equal(j.phase,'ENGAGED');
  assert.equal(j.monsterHpCurrent,14);
  assert.equal(j.monsterHpMax,26);
  assert.equal(j.lastTurn.heroDamage,12);
  assert.equal(j.lastTurn.counterDamage,4);
});

test('D3 VICTORY and Clone DEFEATED phases come from combat status, not renderer flags',()=>{
  const defeatedMonster=monster({status:'DEFEATED',hpCurrent:0,defeatedTick:20,respawnTick:110}),victor=agent({adventureCombat:{
    status:'VICTORY',worldMonsterId:defeatedMonster.worldMonsterId,zoneId:'z1',monsterId:defeatedMonster.monsterId,monsterHpMax:26,turn:3,lastTurn:null
  }});
  assert.equal(adventureJourneyVisualSnapshot(state(victor,defeatedMonster,21)).journeys[0].phase,'VICTORY');

  const livingMonster=monster({status:'IDLE',hpCurrent:11}),loser=agent({adventureCombat:{
    status:'DEFEATED',worldMonsterId:livingMonster.worldMonsterId,zoneId:'z1',monsterId:livingMonster.monsterId,monsterHpMax:26,turn:3,lastTurn:null
  }});
  assert.equal(adventureJourneyVisualSnapshot(state(loser,livingMonster,21)).journeys[0].phase,'DEFEATED');
});

test('D3 defeat cue is simulation-tick bounded and remains non-interactive data',()=>{
  const m=monster({status:'DEFEATED',hpCurrent:0,defeatedTick:20,respawnTick:110});
  assert.equal(adventureJourneyVisualSnapshot(state(agent(),m,20)).lifecycle[0].kind,'DEFEAT');
  assert.equal(adventureJourneyVisualSnapshot(state(agent(),m,20+ADVENTURE_DEFEAT_CUE_TICKS)).lifecycle.length,1);
  assert.equal(adventureJourneyVisualSnapshot(state(agent(),m,21+ADVENTURE_DEFEAT_CUE_TICKS)).lifecycle.length,0);
});

test('D3 respawn cue is derived from new incarnation spawnEpoch and spawnedTick',()=>{
  const m=monster({worldMonsterId:'wm:z1:0:1',spawnEpoch:1,spawnedTick:100,status:'IDLE'});
  const cue=adventureJourneyVisualSnapshot(state(agent(),m,100)).lifecycle[0];
  assert.equal(cue.kind,'RESPAWN');
  assert.equal(cue.spawnEpoch,1);
  assert.equal(cue.worldMonsterId,'wm:z1:0:1');
  assert.equal(adventureJourneyVisualSnapshot(state(agent(),m,101+ADVENTURE_RESPAWN_CUE_TICKS)).lifecycle.length,0);
});

test('D3 source is pure presentation logic',()=>{
  const source=fs.readFileSync(new URL('../src/read-models/adventure-journey-visuals.mjs',import.meta.url),'utf8');
  for(const forbidden of ['document.','window.','Math.random','Date.now','new Date','command(']){
    assert.equal(source.includes(forbidden),false,forbidden);
  }
});
