import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VERSION,SAVE_VERSION,HISTORY_VERSION,BIRTH_RULES,createWorld,step,serialize,restore,validate,
  people,personById,adultLife,autonomousChildrenOf,birthPlan,command
} from '../src/engine.mjs';

function oneAgent(seed=1){
  const s=createWorld(seed);
  s.agents=s.agents.slice(0,1);
  s.buildings=s.buildings.slice(0,1);
  return s;
}

function recordedDeath(tick=1,ageYears=30,cause='starvation'){
  return {status:'recorded',tick,cause,ageYears};
}

function historicalRecord(id,{parentId=null,generation=0,bornTick=0,age=30,autonomous=false}={}){
  return {
    id,name:'History '+id,parentId,generation,x:11,y:12,hp:0,satiety:0,energy:0,alive:false,
    death:recordedDeath(1,age),
    appearance:{coat:'#dda35d',skin:'#e5b38a',hair:'#302a28',style:0},
    preference:'FORAGE',skills:{FORAGE:60,WOODCUT:60,MINE:60,BUILD:60},
    source:'historical fixture',memory:[{tick:1,text:'เสียชีวิตจากการขาดอาหารเมื่ออายุ '+age+' ปี'}],
    workDone:0,bornTick,life:adultLife(0,autonomous?0:age)
  };
}

test('V0.3.6 separates runtime and historical schema versions',()=>{
  const s=createWorld(5);
  assert.equal(VERSION,'0.3.6');
  assert.equal(SAVE_VERSION,'0.2.0');
  assert.equal(HISTORY_VERSION,'0.2.0');
  assert.deepEqual(s.historyAgents,[]);
  assert.equal(people(s).length,s.agents.length);
});

test('death archives one compact identity before later simulation work',()=>{
  const s=oneAgent(7),a=s.agents[0];
  a.life=adultLife(0,33);s.tick=100;a.satiety=0;a.hp=.1;
  step(s);
  assert.equal(s.agents.length,0);
  assert.equal(s.historyAgents.length,1);
  const h=s.historyAgents[0];
  assert.equal(h.id,a.id);assert.equal(h.alive,false);
  assert.deepEqual(h.death,{status:'recorded',tick:101,cause:'starvation',ageYears:33});
  assert.equal('task' in h,false);assert.equal('trace' in h,false);assert.equal('moveTick' in h,false);
  assert.equal(personById(s,a.id),h);
  const frozen=JSON.stringify(h);step(s,720);assert.equal(JSON.stringify(h),frozen);
  const restored=restore(serialize(s));assert.deepEqual(restored.historyAgents,[h]);assert.deepEqual(validate(restored),[]);
});

test('phase-1 historyVersion 0.1.0 migrates dead workers into archive without identity drift',()=>{
  const s=createWorld(11),dead=s.agents[1];
  dead.alive=false;dead.hp=0;dead.task=null;dead.moveTick=0;
  dead.death=recordedDeath(s.tick,18,'starvation');
  s.historyVersion='0.1.0';delete s.historyAgents;
  const expected=[dead.id,dead.parentId,dead.generation,dead.appearance,dead.skills,dead.bornTick,dead.life,dead.death];
  const migrated=restore(JSON.stringify(s)),h=personById(migrated,dead.id);
  assert.equal(migrated.historyVersion,HISTORY_VERSION);
  assert.ok(!migrated.agents.some(a=>a.id===dead.id));
  assert.ok(migrated.historyAgents.some(a=>a.id===dead.id));
  assert.deepEqual([h.id,h.parentId,h.generation,h.appearance,h.skills,h.bornTick,h.life,h.death],expected);
});

test('archived autonomous children remain visible to reproduction history',()=>{
  const s=oneAgent(13),parent=s.agents[0];
  const child=historicalRecord(99,{parentId:parent.id,generation:1,bornTick:0,age:20,autonomous:true});
  child.life={anchorTick:0,ageAtAnchorYears:0};
  s.historyAgents=[child];s.nextAgent=100;
  assert.deepEqual(autonomousChildrenOf(s,parent.id).map(a=>a.id),[99]);
  assert.equal(personById(s,99).parentId,parent.id);
});

test('retained identity cap is distinct from living cap and never deletes ancestry',()=>{
  const s=createWorld(17);s.stock.food=999;s.stock.wood=999;
  let id=s.nextAgent;
  while(people(s).length<BIRTH_RULES.maxRetainedAgents)s.historyAgents.push(historicalRecord(id++));
  s.nextAgent=id;
  assert.equal(people(s).length,BIRTH_RULES.maxRetainedAgents);
  assert.equal(validate(s).length,0);
  const bytes=Buffer.byteLength(serialize(s),'utf8');
  assert.ok(bytes<2_000_000,'boundary save must remain below import guard: '+bytes);
  const before=serialize(s),plan=birthPlan(s,999);
  assert.equal(plan.ok,false);assert.equal(plan.reason,'history');
  const result=command(s,'CLONE',{parentId:s.agents[0].id});
  assert.equal(result.ok,false);assert.match(result.message,/ประวัติ/);
  assert.equal(serialize(s),before);
});

test('archive boundary survives save/restore exactly and remains below import guard',()=>{
  const s=createWorld(19);let id=s.nextAgent;
  while(people(s).length<BIRTH_RULES.maxRetainedAgents)s.historyAgents.push(historicalRecord(id++));
  s.nextAgent=id;
  const text=serialize(s);assert.ok(Buffer.byteLength(text,'utf8')<2_000_000);
  const r=restore(text);assert.equal(serialize(r),text);assert.equal(people(r).length,BIRTH_RULES.maxRetainedAgents);
});
