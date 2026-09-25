import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate} from '../src/engine.mjs';
import {recordResourceDiscovery,BELIEF_STATUS} from '../src/knowledge.mjs';
import {MENTORSHIP_RULES} from '../src/mentor-teaching.mjs';

function seedKnowledge(s,agentId){
  const a=s.agents.find(a=>a.id===agentId),node=s.nodes.find(n=>n.type==='food');
  assert.ok(recordResourceDiscovery(a,node,s.tick,{action:'FORAGE',amount:2}));
  return 'resource:'+node.id;
}

test('KF1 mentorship is bounded and explicit',()=>{
  const s=createWorld(230926);
  const r=command(s,'CREATE_MENTOR_LINK',{mentorId:1,studentId:2});
  assert.equal(r.ok,true);assert.equal(r.changed,true);
  assert.equal(s.mentorship.links.length,1);
  assert.equal(s.mentorship.links[0].mentorId,1);
  assert.equal(s.mentorship.links[0].studentId,2);
  assert.deepEqual(validate(s),[]);
});

test('teaching transfers confirmed knowledge as UNVERIFIED and grants no XP',()=>{
  const s=createWorld(42),key=seedKnowledge(s,1),student=s.agents.find(a=>a.id===2);
  const before=JSON.stringify(student.skills),prov=JSON.stringify(student.skillProvenance);
  command(s,'CREATE_MENTOR_LINK',{mentorId:1,studentId:2});
  const r=command(s,'TEACH_KNOWLEDGE',{mentorId:1,studentId:2,key});
  assert.equal(r.ok,true);
  const belief=student.knowledgeState.beliefs.find(b=>b.key===key);
  assert.equal(belief.status,BELIEF_STATUS.UNVERIFIED);
  assert.equal(belief.sourceAgentId,1);
  assert.equal(JSON.stringify(student.skills),before);
  assert.equal(JSON.stringify(student.skillProvenance),prov);
  assert.ok(s.mentorship.links[0].taughtKeys.includes(key));
});

test('teaching requires active mentor link and communication range',()=>{
  const s=createWorld(77),key=seedKnowledge(s,1);
  assert.equal(command(s,'TEACH_KNOWLEDGE',{mentorId:1,studentId:2,key}).ok,false);
  command(s,'CREATE_MENTOR_LINK',{mentorId:1,studentId:2});
  s.agents.find(a=>a.id===2).x=29;s.agents.find(a=>a.id===2).y=25;
  const r=command(s,'TEACH_KNOWLEDGE',{mentorId:1,studentId:2,key});
  assert.equal(r.ok,false);assert.equal(r.reason,'range');
});

test('one student has at most one active mentor',()=>{
  const s=createWorld(99);
  assert.equal(command(s,'CREATE_MENTOR_LINK',{mentorId:1,studentId:3}).ok,true);
  const r=command(s,'CREATE_MENTOR_LINK',{mentorId:2,studentId:3});
  assert.equal(r.ok,false);assert.equal(r.reason,'student-busy');
});

test('automatic mentorship shares at most one untaught confirmed claim per boundary',()=>{
  const s=createWorld(2026),key=seedKnowledge(s,1);
  command(s,'CREATE_MENTOR_LINK',{mentorId:1,studentId:2});
  s.tick=MENTORSHIP_RULES.periodTicks-1;
  step(s,1);
  const student=s.agents.find(a=>a.id===2);
  assert.equal(student.knowledgeState.beliefs.find(b=>b.key===key)?.status,BELIEF_STATUS.UNVERIFIED);
  assert.deepEqual(s.mentorship.links[0].taughtKeys,[key]);
  const mentorEvidence=()=>student.knowledgeState.evidence.filter(e=>e.type==='message'&&e.sourceAgentId===1&&e.key===key).length;
  assert.equal(mentorEvidence(),1);
  step(s,MENTORSHIP_RULES.periodTicks);
  assert.equal(mentorEvidence(),1);
});

test('mentor death closes active link but preserves historical relationship',()=>{
  const s=createWorld(5150);
  command(s,'CREATE_MENTOR_LINK',{mentorId:1,studentId:2});
  const mentor=s.agents.find(a=>a.id===1);
  mentor.satiety=0;mentor.hp=.1;
  step(s,1);
  assert.equal(mentor.alive,false);
  const link=s.mentorship.links[0];
  assert.equal(link.endedTick,s.tick);assert.equal(link.endReason,'death');
  assert.deepEqual(validate(s),[]);
});

test('mentorship survives save/load and old 0.5.0 saves gain empty extension',()=>{
  let s=createWorld(90001);
  command(s,'CREATE_MENTOR_LINK',{mentorId:1,studentId:2});
  s=restore(serialize(s));assert.equal(s.mentorship.links.length,1);
  const old=createWorld(90002);delete old.mentorship;
  const migrated=restore(JSON.stringify(old));
  assert.equal(migrated.mentorship.links.length,0);
  assert.equal(migrated.mentorship.nextLink,1);
  assert.deepEqual(validate(migrated),[]);
});
