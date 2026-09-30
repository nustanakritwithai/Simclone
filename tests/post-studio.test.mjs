import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,step,command,serialize,restore,validate} from '../src/engine.mjs';
import {homeOf} from '../src/individual-housing.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {recordResourceDiscovery} from '../src/knowledge.mjs';
import {POST_STUDIO_RULES,postStudioSnapshot} from '../src/post-studio.mjs';

let baseText=null;
function fixture(){
  if(!baseText){
    const s=createWorld(230926,{mode:'independent',population:2});
    step(s,2400);
    const owner=s.agents[0],h=homeOf(s,owner.id);
    assert.ok(h?.complete);
    owner.x=h.origin.x;owner.y=h.origin.y;owner.task=null;
    Object.assign(resourceStock(s,owner),{wood:30,stone:10});
    assert.equal(command(s,'CREATE_ARCHIVE',{agentId:owner.id,houseId:h.houseId}).ok,true);
    const node=s.nodes.find(n=>n.type==='wood'&&n.amount>0)??s.nodes.find(n=>n.amount>0);
    assert.ok(node);
    recordResourceDiscovery(owner,node,s.tick,{action:'WOODCUT',amount:1});
    const key=`resource:${node.id}`;
    assert.equal(command(s,'PUBLISH_KNOWLEDGE',{agentId:owner.id,key}).ok,true);
    baseText=serialize(s);
  }
  const s=restore(baseText),owner=s.agents[0],h=homeOf(s,owner.id),key=s.culture.entries[0].key;
  owner.x=h.origin.x;owner.y=h.origin.y;owner.task=null;
  return {s,owner,h,key};
}

test('Post Studio requires the owned Cultural Archive home and canonical proximity',()=>{
  const {s,owner,h}=fixture(),other=s.agents[1],before=serialize(s);
  const denied=command(s,'CREATE_POST_STUDIO',{agentId:other.id,houseId:h.houseId});
  assert.equal(denied.ok,false);assert.equal(serialize(s),before);
  owner.x=h.origin.x;owner.y=h.origin.y;
  const made=command(s,'CREATE_POST_STUDIO',{agentId:owner.id,houseId:h.houseId});
  assert.equal(made.ok,true);assert.equal(made.changed,true);
  assert.equal(s.postStudio.ownerId,owner.id);assert.equal(s.postStudio.houseId,h.houseId);
  assert.deepEqual(validate(s),[]);
});

test('Post Studio publishes an immutable evidence-backed card without writing knowledge or economy',()=>{
  const {s,owner,h,key}=fixture();
  assert.equal(command(s,'CREATE_POST_STUDIO',{agentId:owner.id,houseId:h.houseId}).ok,true);
  const knowledge=JSON.stringify(owner.knowledgeState),wallet=JSON.stringify(s.currencyWallet),materials=JSON.stringify(s.rustMaterials);
  const r=command(s,'PUBLISH_STUDIO_POST',{agentId:owner.id,key});
  assert.equal(r.ok,true);assert.equal(r.changed,true);assert.equal(s.postStudio.posts.length,1);
  const post=s.postStudio.posts[0],entry=s.culture.entries[0];
  assert.equal(post.sourceKey,entry.key);assert.equal(post.sourceRevision,entry.revision);
  assert.equal(post.sourceEvidenceId,entry.evidenceId);assert.deepEqual(post.claim,entry.value);
  assert.equal(JSON.stringify(owner.knowledgeState),knowledge);
  assert.equal(JSON.stringify(s.currencyWallet),wallet);
  assert.equal(JSON.stringify(s.rustMaterials),materials);
  assert.deepEqual(validate(s),[]);
});

test('Post Studio duplicate source revision is replay-safe while a newer archive revision may publish',()=>{
  const {s,owner,h,key}=fixture();
  command(s,'CREATE_POST_STUDIO',{agentId:owner.id,houseId:h.houseId});
  const first=command(s,'PUBLISH_STUDIO_POST',{agentId:owner.id,key});assert.equal(first.changed,true);
  const once=serialize(s),replay=command(s,'PUBLISH_STUDIO_POST',{agentId:owner.id,key});
  assert.equal(replay.ok,true);assert.equal(replay.changed,false);assert.equal(serialize(s),once);
  const entry=s.culture.entries[0],node={...entry.value,x:entry.value.x+1};
  s.tick++;
  recordResourceDiscovery(owner,{id:node.resourceId,type:node.type,x:node.x,y:node.y},s.tick,{action:'WOODCUT',amount:1});
  assert.equal(command(s,'PUBLISH_KNOWLEDGE',{agentId:owner.id,key}).ok,true);
  const second=command(s,'PUBLISH_STUDIO_POST',{agentId:owner.id,key});
  assert.equal(second.ok,true);assert.equal(second.changed,true);assert.equal(s.postStudio.posts.length,2);
  assert.notEqual(s.postStudio.posts[0].sourceRevision,s.postStudio.posts[1].sourceRevision);
  assert.deepEqual(validate(s),[]);
});

test('Post Studio is bounded, survives save/load, and rejects corrupt persisted media',()=>{
  const {s,owner,h,key}=fixture();
  command(s,'CREATE_POST_STUDIO',{agentId:owner.id,houseId:h.houseId});
  command(s,'PUBLISH_STUDIO_POST',{agentId:owner.id,key});
  const snap=postStudioSnapshot(s);snap.posts[0].title='tamper';
  assert.notEqual(s.postStudio.posts[0].title,'tamper');
  const saved=serialize(s),loaded=restore(saved);
  assert.equal(serialize(loaded),saved);assert.deepEqual(validate(loaded),[]);
  loaded.postStudio.posts[0]={...loaded.postStudio.posts[0],sourceRevision:0};
  assert.throws(()=>restore(serialize(loaded)),/Post Studio post/);
  assert.equal(POST_STUDIO_RULES.posts,24);
});

test('Post Studio source has no random, wall clock, DOM, fetch, or duplicate authority writes',()=>{
  const source=readFileSync(new URL('../src/post-studio.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Math\.random|\bDate\b|document\.|window\.|fetch\(/);
  assert.doesNotMatch(source,/knowledgeState\s*=|currencyWallet\s*=|rustMaterials\s*=|profession\s*=|\.task\s*=/);
  for(const token of ['postWallet','studioWallet','postInventory','studioInventory','postProfession'])assert.equal(source.includes(token),false,token);
});
