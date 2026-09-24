import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate} from '../src/engine.mjs';
import {recordResourceDiscovery} from '../src/knowledge.mjs';
import {personalResourceCandidates,PERSONAL_PLANNING_VERSION} from '../src/personal-planning.mjs';

function local(seed=42){const s=createWorld(seed);assert.equal(command(s,'SET_PLANNING_POLICY',{policy:'local'}).ok,true);return s;}

test('personal planner exposes only visible resources and owned investigation targets',()=>{
  const s=local(),a=s.agents[0];s.tiles.fill('grass');a.x=2;a.y=2;
  s.nodes=[{id:801,type:'food',x:20,y:20,amount:99,max:99},{id:802,type:'food',x:3,y:2,amount:4,max:10}];
  assert.deepEqual(personalResourceCandidates(s,a,'food').map(n=>n.id),[802]);
  recordResourceDiscovery(a,s.nodes[0],s.tick,{action:'FORAGE',amount:1});
  const before=serialize(s),nodes=personalResourceCandidates(s,a,'food');assert.equal(serialize(s),before);
  assert.equal(nodes.find(n=>n.id===801).perception,'memory');assert.equal(nodes.find(n=>n.id===801).amount,1);
  s.nodes[0].amount=0;
  assert.deepEqual(personalResourceCandidates(s,a,'food'),nodes,'unseen depletion does not leak');
  s.nodes.shift();assert.deepEqual(personalResourceCandidates(s,a,'food'),nodes,'unseen disappearance does not leak');
});

test('same position and world truth can produce different plans from different personal experience',()=>{
  const s=local(),[a,b]=s.agents;s.tiles.fill('grass');s.stock.food=0;s.stock.wood=999;s.stock.stone=999;
  for(const x of s.agents){x.x=2;x.y=2;x.satiety=30;x.energy=99;x.task=null;}
  s.nodes=[{id:803,type:'food',x:10,y:2,amount:50,max:50}];
  recordResourceDiscovery(a,s.nodes[0],s.tick,{action:'FORAGE',amount:1});
  step(s);
  assert.equal(a.task.kind,'EXPLORE');assert.equal(a.task.targetId,803);assert.equal(a.task.purposeKind,'FORAGE');
  assert.notEqual(b.task.targetId,803);assert.equal(b.knowledgeState.beliefs.length,0);
  assert.equal(a.planning.goal.phase,'visit-and-verify');
});

test('a remembered target becomes local observation and productive outcome, not free XP',()=>{
  const s=local(7),a=s.agents[0];s.tiles.fill('grass');s.stock.food=0;s.stock.wood=999;s.stock.stone=999;
  a.x=2;a.y=2;a.satiety=30;a.energy=99;s.nodes=[{id:804,type:'food',x:8,y:2,amount:50,max:50}];
  recordResourceDiscovery(a,s.nodes[0],s.tick,{action:'FORAGE',amount:1});
  const xp=a.skills.FORAGE;step(s);assert.equal(a.skills.FORAGE,xp);
  for(let i=0;i<100&&a.skills.FORAGE===xp;i++)step(s);
  assert.ok(a.skills.FORAGE>xp);assert.ok(a.planning.lessons.some(l=>l.kind==='FORAGE'&&l.outcome==='SAT'&&l.amount>0));
  assert.deepEqual(validate(s),[]);
});

test('policy changes are explicit, validated and preserve stock, XP and old save compatibility',()=>{
  const s=createWorld(2026),before=serialize(s);
  assert.equal(command(s,'SET_PLANNING_POLICY',{policy:'omniscient-magic'}).ok,false);assert.equal(serialize(s),before);
  const stock={...s.stock},skills=s.agents.map(a=>a.skills);
  command(s,'SET_PLANNING_POLICY',{policy:'local'});assert.equal(s.planningPolicy,PERSONAL_PLANNING_VERSION);
  assert.deepEqual(s.stock,stock);assert.deepEqual(s.agents.map(a=>a.skills),skills);
  step(s,100);const loaded=restore(serialize(s));assert.equal(serialize(loaded),serialize(s));
  command(s,'SET_PLANNING_POLICY',{policy:'legacy'});assert.equal(s.planningPolicy,undefined);assert.deepEqual(validate(s),[]);
});

test('local planning is deterministic for batch, single-step and restored continuation',()=>{
  const a=local(2026),b=restore(serialize(a));step(a,1000);for(let i=0;i<1000;i++)step(b);
  assert.equal(serialize(a),serialize(b));assert.deepEqual(validate(a),[]);
  for(const x of a.agents)assert.ok((x.planning?.lessons.length??0)<=4);
});

test('malformed planner persistence is rejected instead of silently selecting a different policy',()=>{
  const s=local();s.planningPolicy='future-policy';assert.ok(validate(s).includes('Planning policy'));
  s.planningPolicy=PERSONAL_PLANNING_VERSION;s.agents[0].planning.cursor=-1;
  assert.throws(()=>restore(serialize(s)),/Personal planning/);
});

test('information-seeking beats idle when needs are safe but no productive job is available',()=>{
  const s=createWorld(230926);command(s,'SET_PLANNING_POLICY',{policy:'local'});
  s.stock={food:999,wood:999,stone:999};
  for(const a of s.agents){a.satiety=100;a.energy=100;a.task=null;}
  step(s);
  for(const a of s.agents){
    const choice=a.trace.find(c=>c.status==='selected');
    assert.equal(choice.kind,'EXPLORE');assert.equal(choice.informationSeeking,true);
    assert.ok(choice.score>0);assert.equal(choice.score,Object.values(choice.factors).reduce((a,b)=>a+b,0));
  }
});

test('completing a building records a verified goal outcome',()=>{
  const s=local(42);s.tiles.fill('grass');s.stock={food:999,wood:999,stone:999};
  s.buildings.push({id:3,type:'shelter',x:11,y:11,complete:false,progress:29.99});s.nextBuilding=4;
  for(const a of s.agents){a.x=11;a.y=11;a.satiety=100;a.energy=100;a.task=null;}
  step(s);
  assert.equal(s.buildings[2].complete,true);
  assert.ok(s.agents.some(a=>a.planning?.goal?.goal==='finish-shelter'&&a.planning.goal.status==='completed'&&a.planning.lessons.some(l=>l.kind==='BUILD'&&l.outcome==='SAT')));
});
