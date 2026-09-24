import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  VERSION,SAVE_VERSION,HISTORY_VERSION,createWorld,step,serialize,restore,
  ageYears,adultLife,lifespanYears
} from '../src/engine.mjs';

function oneAgent(seed=1){
  const s=createWorld(seed);
  s.agents=s.agents.slice(0,1);
  s.buildings=s.buildings.slice(0,1);
  return s;
}

test('V0.5.0 retains the historical lifecycle sub-schema',()=>{
  assert.equal(VERSION,'0.5.0');
  assert.equal(SAVE_VERSION,'0.5.0');
  assert.equal(HISTORY_VERSION,'0.1.0');
  const s=createWorld(5);
  assert.equal(s.historyVersion,HISTORY_VERSION);
  assert.ok(s.agents.every(a=>a.death===null));
});

test('age death records immutable tick cause and age-at-death',()=>{
  const s=oneAgent(7),a=s.agents[0],limit=lifespanYears(s,a);
  a.life=adultLife(0,limit-1);s.tick=359;a.satiety=100;a.energy=100;
  step(s);
  assert.equal(a.alive,false);
  assert.deepEqual(a.death,{status:'recorded',tick:360,cause:'age',ageYears:limit});
  assert.equal(ageYears(s,a),limit);
  step(s,720);
  assert.deepEqual(a.death,{status:'recorded',tick:360,cause:'age',ageYears:limit});
  assert.equal(ageYears(s,a),limit);
});

test('starvation death records immutable age and keeps cleanup stable',()=>{
  const s=oneAgent(9),a=s.agents[0];
  a.life=adultLife(0,33);s.tick=100;a.satiety=0;a.hp=.1;a.moveTick=2;
  step(s);
  assert.equal(a.alive,false);
  assert.equal(a.hp,0);assert.equal(a.task,null);assert.equal(a.moveTick,0);
  assert.deepEqual(a.death,{status:'recorded',tick:101,cause:'starvation',ageYears:33});
  step(s,720);
  assert.equal(ageYears(s,a),33);
  assert.deepEqual(a.death,{status:'recorded',tick:101,cause:'starvation',ageYears:33});
});

test('0.2.0 migration recovers death facts from retained evidence',()=>{
  const s=oneAgent(21),a=s.agents[0];
  a.life=adultLife(0,41);s.tick=100;a.satiety=0;a.hp=.1;
  step(s);
  const raw=JSON.parse(serialize(s));
  raw.version="0.2.0";delete raw.archive;delete raw.archiveVersion;
  delete raw.historyVersion;
  for(const x of raw.agents){delete x.death;delete x.skillProvenance;delete x.knowledgeState;}
  const migrated=restore(JSON.stringify(raw)),m=migrated.agents[0];
  assert.equal(migrated.version,'0.5.0');
  assert.equal(migrated.historyVersion,HISTORY_VERSION);
  assert.equal(m.alive,false);
  assert.deepEqual(m.death,{status:'legacy-evidence',tick:101,cause:'starvation',ageYears:41});
  assert.equal(ageYears(migrated,m),41);
});

test('dead 0.2.0 agent without retained evidence remains explicitly unknown',()=>{
  const s=oneAgent(22),a=s.agents[0];
  a.alive=false;a.hp=0;a.task=null;a.moveTick=0;a.memory=[];
  s.events=s.events.filter(e=>e.agentId!==a.id||e.type!=='death');
  const raw=JSON.parse(serialize(s));
  raw.version="0.2.0";delete raw.archive;delete raw.archiveVersion;
  delete raw.historyVersion;
  for(const x of raw.agents){delete x.death;delete x.skillProvenance;delete x.knowledgeState;}
  const migrated=restore(JSON.stringify(raw)),m=migrated.agents[0];
  assert.deepEqual(m.death,{status:'legacy-unknown',tick:null,cause:'unknown',ageYears:null});
  assert.equal(ageYears(migrated,m),null);
  step(migrated,720);
  assert.equal(ageYears(migrated,m),null);
});

test('real V0.3.3 save fixture migrates history metadata without identity drift',()=>{
  const text=readFileSync(new URL('./fixtures/legacy-0.3.3-save.json',import.meta.url),'utf8');
  const raw=JSON.parse(text),migrated=restore(text);
  assert.equal(raw.version,'0.2.0');
  assert.equal(raw.historyVersion,undefined);
  assert.equal(migrated.version,'0.5.0');
  assert.equal(migrated.historyVersion,HISTORY_VERSION);
  assert.deepEqual(
    migrated.agents.map(a=>[a.id,a.parentId,a.generation,a.appearance,a.skills,a.bornTick]),
    raw.agents.map(a=>[a.id,a.parentId,a.generation,a.appearance,a.skills,a.bornTick])
  );
  assert.ok(migrated.agents.every(a=>a.alive?a.death===null:['legacy-evidence','legacy-unknown'].includes(a.death?.status)));
});
