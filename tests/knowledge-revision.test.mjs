import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,serialize,restore,validate,step} from '../src/engine.mjs';
import {recordResourceDiscovery,shareKnowledge,validateKnowledgeState} from '../src/knowledge.mjs';
import {ageKnowledge,evaluateResourceObservation,KNOWLEDGE_REVISION_RULES} from '../src/knowledge-revision.mjs';

function fixture(){
  const s=createWorld(42),[sender,receiver]=s.agents,node=s.nodes.find(n=>n.type==='food');
  sender.x=receiver.x=node.x;sender.y=receiver.y=node.y;
  const b=recordResourceDiscovery(sender,node,s.tick,{action:'FORAGE',amount:1});
  assert.equal(shareKnowledge(sender,receiver,b.key,s.tick).ok,true);
  return {s,sender,receiver,node,key:b.key,origin:b.originEvidenceId};
}
const claim=(a,key)=>a.knowledgeState.beliefs.find(b=>b.key===key);

test('local verification confirms received knowledge without granting XP or losing origin',()=>{
  const {s,sender,receiver,key,origin}=fixture(),stock={...s.stock},xp={...receiver.skills};
  const r=command(s,'VERIFY_KNOWLEDGE',{agentId:receiver.id,key});
  assert.equal(r.ok,true);assert.equal(r.status,'CONFIRMED');assert.equal(r.changed,true);
  assert.equal(claim(receiver,key).sourceAgentId,sender.id);
  assert.equal(claim(receiver,key).originEvidenceId,origin);
  assert.equal(claim(receiver,key).sourceKind,'direct');
  assert.deepEqual(receiver.skills,xp);assert.deepEqual(s.stock,stock);
  assert.deepEqual(validate(s),[]);assert.deepEqual(restore(serialize(s)),s);
});

test('same-tick repeated verification is idempotent',()=>{
  const {s,receiver,key}=fixture();command(s,'VERIFY_KNOWLEDGE',{agentId:receiver.id,key});
  const before=serialize(s),r=command(s,'VERIFY_KNOWLEDGE',{agentId:receiver.id,key});
  assert.equal(r.changed,false);assert.equal(serialize(s),before);
});

test('unowned and out-of-range claims fail atomically without global knowledge leakage',()=>{
  const {s,receiver,key}=fixture();receiver.x=29;receiver.y=25;
  const before=serialize(s);
  assert.equal(command(s,'VERIFY_KNOWLEDGE',{agentId:receiver.id,key}).reason,'out-of-range');
  assert.equal(command(s,'VERIFY_KNOWLEDGE',{agentId:receiver.id,key:'resource:999999'}).reason,'knowledge');
  assert.equal(serialize(s),before);
});

test('temporary depletion is STALE and can later be confirmed, not treated as dishonesty',()=>{
  const {s,receiver,key,node}=fixture();node.amount=0;
  const r=command(s,'VERIFY_KNOWLEDGE',{agentId:receiver.id,key});
  assert.equal(r.status,'STALE');assert.equal(r.reason,'temporarily-depleted');
  node.amount=1;s.tick++;
  assert.equal(command(s,'VERIFY_KNOWLEDGE',{agentId:receiver.id,key}).status,'CONFIRMED');
});

test('observed absence or mismatch refutes only the locally inspected claim',()=>{
  const {s,receiver,key,node}=fixture();s.nodes=s.nodes.filter(n=>n.id!==node.id);
  assert.equal(command(s,'VERIFY_KNOWLEDGE',{agentId:receiver.id,key}).status,'REFUTED');
  assert.equal(receiver.knowledgeState.beliefs.length,1);
  const b=claim(receiver,key);
  assert.equal(evaluateResourceObservation(b,{x:node.x,y:node.y,resource:{...node,id:node.id+10000}}).status,'REFUTED');
  assert.equal(evaluateResourceObservation(b,{x:node.x+1,y:node.y,resource:node}).ok,false);
});

test('time alone marks evidence stale at exact deterministic boundary, never refutes it',()=>{
  const {s,sender,receiver,key}=fixture(),limit=KNOWLEDGE_REVISION_RULES.staleAfterTicks;
  assert.equal(ageKnowledge(receiver,limit-1),0);
  assert.equal(ageKnowledge(receiver,limit),1);assert.equal(claim(receiver,key).status,'STALE');
  assert.equal(ageKnowledge(receiver,limit+1),0);
  const before=JSON.stringify(sender.knowledgeState);sender.alive=false;
  assert.equal(ageKnowledge(sender,limit),0);assert.equal(JSON.stringify(sender.knowledgeState),before);
});

test('productive re-observation preserves relayed origin instead of rewriting discovery history',()=>{
  const {s,sender,receiver,key,node,origin}=fixture();
  recordResourceDiscovery(receiver,node,s.tick+1,{action:'FORAGE',amount:2});
  assert.equal(claim(receiver,key).status,'CONFIRMED');
  assert.equal(claim(receiver,key).sourceAgentId,sender.id);
  assert.equal(claim(receiver,key).originEvidenceId,origin);
  assert.deepEqual(validateKnowledgeState(receiver),[]);
});

test('revision remains bounded under repeated observations and deterministic through save/load',()=>{
  const {s,receiver,key,node}=fixture();
  for(let i=0;i<100;i++){s.tick++;node.amount=i%2;command(s,'VERIFY_KNOWLEDGE',{agentId:receiver.id,key});}
  assert.ok(receiver.knowledgeState.evidence.length<=8);assert.ok(receiver.knowledgeState.episodes.length<=8);
  assert.deepEqual(validate(s),[]);
  const a=restore(serialize(s)),b=restore(serialize(s));step(a,50);for(let i=0;i<50;i++)step(b);
  assert.equal(serialize(a),serialize(b));assert.deepEqual(validate(a),[]);
});

test('co-located resource identities do not falsely refute a present claim',()=>{
  const {s,receiver,key,node}=fixture();
  s.nodes.unshift({...node,id:9999,type:node.type==='food'?'wood':'food'});
  assert.equal(command(s,'VERIFY_KNOWLEDGE',{agentId:receiver.id,key}).status,'CONFIRMED');
});
