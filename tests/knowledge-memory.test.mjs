import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VERSION,SAVE_VERSION,KNOWLEDGE_VERSION,createWorld,command,step,serialize,restore,validate,findPerson
} from '../src/engine.mjs';
import {RULES} from '../src/survival.mjs';

function prepareGather(s,agent,node,kind='FORAGE'){
  s.tiles.fill('grass');s.nodes=[node];agent.x=node.x;agent.y=node.y;agent.preference=kind;
  agent.satiety=100;agent.energy=100;
  agent.task={policy:RULES.jobPolicy,kind,targetId:node.id,x:node.x,y:node.y,path:[],work:100,score:100,started:s.tick};
}
const belief=(a,key)=>a.knowledgeState.beliefs.find(b=>b.key===key);

test('V0.5.0 starts with bounded empty personal knowledge',()=>{
  const s=createWorld(42);
  assert.equal(VERSION,'0.5.0');assert.equal(SAVE_VERSION,'0.5.0');assert.equal(KNOWLEDGE_VERSION,'0.5.0');
  for(const a of s.agents){
    assert.equal(a.knowledgeState.version,KNOWLEDGE_VERSION);
    assert.deepEqual(a.knowledgeState.evidence,[]);
    assert.deepEqual(a.knowledgeState.beliefs,[]);
    assert.deepEqual(a.knowledgeState.episodes,[]);
  }
});

test('productive resource outcome creates direct evidence, confirmed belief and episode',()=>{
  const s=createWorld(7),a=s.agents[0],node={id:501,type:'food',x:a.x,y:a.y,amount:10,max:10};
  s.stock.food=0;prepareGather(s,a,node,'FORAGE');step(s);
  const b=belief(a,'resource:501');
  assert.ok(b);assert.equal(b.status,'CONFIRMED');assert.equal(b.sourceKind,'direct');assert.equal(b.sourceAgentId,null);
  assert.deepEqual(b.value,{resourceId:501,type:'food',x:node.x,y:node.y});
  assert.equal(b.evidenceIds.length,1);
  const e=a.knowledgeState.evidence.find(e=>e.evidenceId===b.evidenceIds[0]);
  assert.equal(e.type,'observation');assert.equal(e.ownerAgentId,a.id);assert.equal(e.originEvidenceId,b.originEvidenceId);
  assert.ok(a.knowledgeState.episodes.some(x=>x.kind==='discovery'&&x.evidenceIds.includes(e.evidenceId)));
});

test('zero-output work creates no knowledge',()=>{
  const s=createWorld(8),a=s.agents[0],node={id:502,type:'wood',x:a.x,y:a.y,amount:10,max:10};
  s.stock.wood=999;prepareGather(s,a,node,'WOODCUT');step(s);
  assert.equal(a.knowledgeState.evidence.length,0);
  assert.equal(a.knowledgeState.beliefs.length,0);
  assert.equal(a.knowledgeState.episodes.length,0);
});

test('knowledge does not leak globally and explicit share transfers only one claim',()=>{
  const s=createWorld(9),sender=s.agents[0],receiver=s.agents[1],node={id:503,type:'stone',x:sender.x,y:sender.y,amount:10,max:10};
  receiver.x=sender.x;receiver.y=sender.y;s.stock.stone=0;prepareGather(s,sender,node,'MINE');step(s);
  assert.equal(belief(receiver,'resource:503'),undefined);
  assert.equal(receiver.knowledgeState.beliefs.length,0);
  const r=command(s,'SHARE_KNOWLEDGE',{fromId:sender.id,toId:receiver.id,key:'resource:503'});
  assert.equal(r.ok,true);
  const b=belief(receiver,'resource:503');
  assert.ok(b);assert.equal(b.status,'UNVERIFIED');assert.equal(b.sourceKind,'message');assert.equal(b.sourceAgentId,sender.id);
  const original=belief(sender,'resource:503');assert.equal(b.originEvidenceId,original.originEvidenceId);
  assert.equal(receiver.knowledgeState.beliefs.length,1);
  assert.ok(receiver.knowledgeState.episodes.some(x=>x.kind==='knowledge-share'&&x.sourceAgentId===sender.id));
});

test('share rejection is atomic when recipient is out of range',()=>{
  const s=createWorld(10),sender=s.agents[0],receiver=s.agents[1],node={id:504,type:'food',x:sender.x,y:sender.y,amount:10,max:10};
  s.stock.food=0;prepareGather(s,sender,node,'FORAGE');step(s);
  receiver.x=29;receiver.y=25;
  const before=serialize(s),r=command(s,'SHARE_KNOWLEDGE',{fromId:sender.id,toId:receiver.id,key:'resource:504'});
  assert.equal(r.ok,false);assert.equal(serialize(s),before);
});

test('recipient knowledge survives discoverer death archive and save load',()=>{
  const s=createWorld(11),sender=s.agents[0],receiver=s.agents[1],node={id:505,type:'wood',x:sender.x,y:sender.y,amount:10,max:10};
  receiver.x=sender.x;receiver.y=sender.y;s.stock.wood=0;prepareGather(s,sender,node,'WOODCUT');step(s);
  assert.equal(command(s,'SHARE_KNOWLEDGE',{fromId:sender.id,toId:receiver.id,key:'resource:505'}).ok,true);
  sender.satiety=0;sender.hp=.1;step(s);
  while(s.agents.length<64){
    const template=JSON.parse(JSON.stringify(sender));
    template.id=s.nextAgent++;template.name='Retired '+template.id;template.parentId=null;template.generation=0;template.bornTick=0;
    template.alive=false;template.hp=0;template.task=null;template.moveTick=0;template.trace=[];
    template.death={status:'recorded',tick:s.tick,cause:'starvation',ageYears:18};
    s.agents.push(template);
  }
  s.stock.food=999;s.stock.wood=999;
  const parent=s.agents.find(a=>a.alive);assert.ok(parent);
  command(s,'CLONE',{parentId:parent.id});
  const archived=findPerson(s,sender.id);assert.equal(archived.archived,true);
  const received=belief(receiver,'resource:505');assert.equal(received.sourceAgentId,sender.id);
  assert.equal(findPerson(s,received.sourceAgentId).id,sender.id);
  const restored=restore(serialize(s)),rr=findPerson(restored,receiver.id),rb=belief(rr,'resource:505');
  assert.deepEqual(rb,received);assert.equal(findPerson(restored,rb.sourceAgentId).id,sender.id);
  assert.deepEqual(validate(restored),[]);
});

test('0.4.0 save migration adds empty knowledge without inventing past discoveries',()=>{
  const s=createWorld(12),raw=JSON.parse(serialize(s));
  raw.version='0.4.0';
  for(const a of [...raw.agents,...raw.archive])delete a.knowledgeState;
  const migrated=restore(JSON.stringify(raw));
  assert.equal(migrated.version,SAVE_VERSION);
  for(const a of [...migrated.agents,...migrated.archive]){
    assert.equal(a.knowledgeState.version,KNOWLEDGE_VERSION);
    assert.deepEqual(a.knowledgeState.evidence,[]);
    assert.deepEqual(a.knowledgeState.beliefs,[]);
    assert.deepEqual(a.knowledgeState.episodes,[]);
  }
  assert.deepEqual(validate(migrated),[]);
});
