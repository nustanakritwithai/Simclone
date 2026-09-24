import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate,findPerson} from '../src/engine.mjs';
import {recordResourceDiscovery} from '../src/knowledge.mjs';
import {stepCulture,CULTURE_RULES} from '../src/cultural-archive.mjs';
function fixture(){
  const s=createWorld(42),[author,reader]=s.agents,camp=s.buildings.find(b=>b.type==='camp');
  author.x=reader.x=camp.x;author.y=reader.y=camp.y;
  const node=s.nodes.find(n=>n.type==='food'),key=`resource:${node.id}`;
  const claim=recordResourceDiscovery(author,node,s.tick,{action:'FORAGE',amount:1});
  assert.equal(command(s,'CREATE_ARCHIVE').ok,true);
  return {s,author,reader,node,key,origin:claim.originEvidenceId,camp};
}

test('archive construction pays once and insufficient material rejection is atomic',()=>{
  const s=createWorld(7);s.stock.wood=0;const before=serialize(s);
  assert.equal(command(s,'CREATE_ARCHIVE').ok,false);assert.equal(serialize(s),before);
  s.stock.wood=20;const stone=s.stock.stone;
  assert.equal(command(s,'CREATE_ARCHIVE').changed,true);
  assert.equal(s.stock.wood,14);assert.equal(s.stock.stone,stone-2);
  const built=serialize(s);assert.equal(command(s,'CREATE_ARCHIVE').changed,false);assert.equal(serialize(s),built);
});

test('publish and read create an unverified, provenance-backed claim without XP',()=>{
  const {s,author,reader,key,origin}=fixture(),skills={...reader.skills};
  assert.equal(command(s,'PUBLISH_KNOWLEDGE',{agentId:author.id,key}).ok,true);
  assert.equal(command(s,'READ_ARCHIVE',{agentId:reader.id,key}).ok,true);
  const belief=reader.knowledgeState.beliefs.find(b=>b.key===key);
  assert.equal(belief.status,'UNVERIFIED');assert.equal(belief.sourceAgentId,author.id);assert.equal(belief.originEvidenceId,origin);
  assert.ok(reader.knowledgeState.evidence.some(e=>e.channel==='archive'&&e.publishedTick===0));
  assert.deepEqual(reader.skills,skills);assert.deepEqual(validate(s),[]);
  const once=serialize(s);assert.equal(command(s,'READ_ARCHIVE',{agentId:reader.id,key}).changed,false);assert.equal(serialize(s),once);
});

test('stored knowledge survives author death and can be read after save/load',()=>{
  const {s,author,reader,key,origin}=fixture();command(s,'PUBLISH_KNOWLEDGE',{agentId:author.id,key});
  author.satiety=0;author.hp=.1;step(s);assert.equal(author.alive,false);
  const loaded=restore(serialize(s));
  assert.equal(command(loaded,'READ_ARCHIVE',{agentId:reader.id,key}).ok,true);
  const b=findPerson(loaded,reader.id).knowledgeState.beliefs.find(b=>b.key===key);
  assert.equal(b.originEvidenceId,origin);assert.equal(findPerson(loaded,b.sourceAgentId).alive,false);
  assert.deepEqual(validate(loaded),[]);
});

test('archive has finite capacity and never deletes an old publication to admit a new one',()=>{
  const {s,author,camp}=fixture();
  for(let i=0;i<CULTURE_RULES.entries;i++){
    const n={id:900+i,type:'food',x:camp.x,y:camp.y};recordResourceDiscovery(author,n,s.tick,{amount:1});
    assert.equal(command(s,'PUBLISH_KNOWLEDGE',{agentId:author.id,key:`resource:${n.id}`}).ok,true);
  }
  recordResourceDiscovery(author,{id:999,type:'food',x:camp.x,y:camp.y},s.tick,{amount:1});
  const before=serialize(s);
  assert.equal(command(s,'PUBLISH_KNOWLEDGE',{agentId:author.id,key:'resource:999'}).reason,'capacity');
  assert.equal(serialize(s),before);assert.equal(s.culture.entries.length,CULTURE_RULES.entries);
});

test('publication revisions retain a bounded history and the original discovery',()=>{
  const {s,author,key,node,origin}=fixture();command(s,'PUBLISH_KNOWLEDGE',{agentId:author.id,key});
  for(let i=1;i<=8;i++){s.tick++;recordResourceDiscovery(author,{...node,x:i},s.tick,{amount:1});command(s,'PUBLISH_KNOWLEDGE',{agentId:author.id,key});}
  const e=s.culture.entries.find(e=>e.key===key);
  assert.equal(e.revision,9);assert.equal(e.history.length,3);assert.equal(e.originEvidenceId,origin);
  assert.deepEqual(validate(s),[]);
});

test('automation performs at most one operation at its boundary and does nothing before construction',()=>{
  const empty=createWorld(1),before=serialize(empty);assert.equal(stepCulture(empty),null);assert.equal(serialize(empty),before);
  const {s,author,key}=fixture();s.tick=120;
  const r=stepCulture(s);assert.equal(r.action,'publish');assert.equal(r.agentId,author.id);
  const once=serialize(s);assert.equal(stepCulture(s),null);assert.equal(serialize(s),once);
  s.tick=240;assert.equal(stepCulture(s).action,'read');assert.equal(s.culture.entries.length,1);
  assert.ok(s.agents.some(a=>a.id!==author.id&&a.knowledgeState.beliefs.some(b=>b.key===key)));
});

test('out-of-range access and corrupt archive saves are rejected without inventing missing identities',()=>{
  const {s,author,reader,key}=fixture();command(s,'PUBLISH_KNOWLEDGE',{agentId:author.id,key});reader.x=29;reader.y=25;
  const before=serialize(s);assert.equal(command(s,'READ_ARCHIVE',{agentId:reader.id,key}).reason,'range');assert.equal(serialize(s),before);
  s.culture.entries[0]={...s.culture.entries[0],authorId:999999};assert.throws(()=>restore(serialize(s)),/Cultural entry/);
});
