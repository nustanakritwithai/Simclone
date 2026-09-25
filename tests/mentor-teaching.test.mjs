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
  const s=createWorld(230926),r=command(s,'CREATE_MENTOR_LINK',{mentorId:1,studentId:2});
  assert.equal(r.ok,true);assert.equal(r.changed,true);
  assert.equal(s.mentorship.links.length,1);assert.deepEqual(validate(s),[]);
});

test('teaching transfers confirmed knowledge as UNVERIFIED and grants no XP',()=>{
  const s=createWorld(42),key=seedKnowledge(s,1),student=s.agents.find(a=>a.id===2);
  const skills=JSON.stringify(student.skills),prov=JSON.stringify(student.skillProvenance);
  command(s,'CREATE_MENTOR_LINK',{mentorId:1,studentId:2});
  const r=command(s,'TEACH_KNOWLEDGE',{mentorId:1,studentId:2,key});
  assert.equal(r.ok,true);assert.equal(r.changed,true);
  const belief=student.knowledgeState.beliefs.find(b=>b.key===key);
  assert.equal(belief.status,BELIEF_STATUS.UNVERIFIED);assert.equal(belief.sourceAgentId,1);
  assert.equal(JSON.stringify(student.skills),skills);assert.equal(JSON.stringify(student.skillProvenance),prov);
});

test('same Mentor link + key is idempotent and never creates duplicate message evidence',()=>{
  const s=createWorld(43),key=seedKnowledge(s,1),student=s.agents[1];
  command(s,'CREATE_MENTOR_LINK',{mentorId:1,studentId:2});
  const first=command(s,'TEACH_KNOWLEDGE',{mentorId:1,studentId:2,key});
  const before=student.knowledgeState.evidence.filter(e=>e.type==='message'&&e.sourceAgentId===1&&e.key===key).length;
  const second=command(s,'TEACH_KNOWLEDGE',{mentorId:1,studentId:2,key});
  const after=student.knowledgeState.evidence.filter(e=>e.type==='message'&&e.sourceAgentId===1&&e.key===key).length;
  assert.equal(first.changed,true);assert.equal(second.changed,false);assert.equal(second.reason,'already-taught');
  assert.equal(before,1);assert.equal(after,1);
});

test('teaching requires active mentor link and communication range',()=>{
  const s=createWorld(77),key=seedKnowledge(s,1);
  assert.equal(command(s,'TEACH_KNOWLEDGE',{mentorId:1,studentId:2,key}).ok,false);
  command(s,'CREATE_MENTOR_LINK',{mentorId:1,studentId:2});
  s.agents[1].x=29;s.agents[1].y=25;
  assert.equal(command(s,'TEACH_KNOWLEDGE',{mentorId:1,studentId:2,key}).reason,'range');
});

test('one student has at most one active mentor',()=>{
  const s=createWorld(99);assert.equal(command(s,'CREATE_MENTOR_LINK',{mentorId:1,studentId:3}).ok,true);
  assert.equal(command(s,'CREATE_MENTOR_LINK',{mentorId:2,studentId:3}).reason,'student-busy');
});

test('automatic mentorship performs at most one new teaching operation per boundary',()=>{
  const s=createWorld(2026),key=seedKnowledge(s,1);
  command(s,'CREATE_MENTOR_LINK',{mentorId:1,studentId:2});
  s.tick=MENTORSHIP_RULES.periodTicks-1;step(s,1);
  const student=s.agents[1],link=s.mentorship.links[0];
  assert.equal(student.knowledgeState.beliefs.find(b=>b.key===key)?.status,BELIEF_STATUS.UNVERIFIED);
  assert.deepEqual(link.taughtKeys,[key]);
  const firstCount=student.knowledgeState.evidence.filter(e=>e.type==='message'&&e.sourceAgentId===1&&e.key===key).length;
  assert.equal(firstCount,1);
  step(s,MENTORSHIP_RULES.periodTicks);
  const sameKey=student.knowledgeState.evidence.filter(e=>e.type==='message'&&e.sourceAgentId===1&&e.key===key).length;
  assert.equal(sameKey,1);
});

test('mentor death closes active link but preserves historical relationship',()=>{
  const s=createWorld(5150);command(s,'CREATE_MENTOR_LINK',{mentorId:1,studentId:2});
  const mentor=s.agents[0];mentor.satiety=0;mentor.hp=.1;step(s,1);
  const link=s.mentorship.links[0];assert.equal(mentor.alive,false);
  assert.equal(link.endedTick,s.tick);assert.equal(link.endReason,'death');assert.deepEqual(validate(s),[]);
});

test('mentorship survives save/load and old 0.5.0 saves gain empty extension',()=>{
  let s=createWorld(90001);command(s,'CREATE_MENTOR_LINK',{mentorId:1,studentId:2});
  s=restore(serialize(s));assert.equal(s.mentorship.links.length,1);
  const old=createWorld(90002);delete old.mentorship;
  const migrated=restore(JSON.stringify(old));
  assert.equal(migrated.mentorship.links.length,0);assert.deepEqual(validate(migrated),[]);
});
