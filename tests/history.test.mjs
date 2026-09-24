import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,command,step,serialize,restore,validate,living,ageYears,VERSION,SAVE_VERSION} from '../src/engine.mjs';
import {ARCHIVE_VERSION,HISTORY_LIMITS,allPeople,findPerson,retainedCount,retentionPlan,compactRetired} from '../src/history.mjs';
import {birthPlan,eligibleBirthParents,isAutonomousChild,autonomousChildrenOf} from '../src/reproduction.mjs';
import {reservations} from '../src/survival.mjs';

// Synthetic structural boundary fixtures, NOT unmodified survival/continuity proofs.
function historyFixture(count=200){
 const s=createWorld(42),template=s.agents[1];s.stock.food=100;s.stock.wood=100;
 for(let id=7;id<=count;id++)s.agents.push({...structuredClone(template),id,name:'Ancestor '+id,alive:false,hp:0,task:null,moveTick:0,
  death:{status:'recorded',tick:0,cause:'starvation',ageYears:18},memory:[{tick:0,text:'Synthetic boundary death'}]});
 s.nextAgent=count+1;return s;
}
function coldFixture(count){
 const s=historyFixture(count);s.archive=s.agents.slice(6).map(a=>({...a,trace:[],archived:true}));s.agents=s.agents.slice(0,6);return s;
}
const facts=a=>[a.id,a.name,a.parentId,a.generation,a.appearance,a.skills,a.source,a.preference,a.bornTick,a.life,a.death,a.workDone,a.memory];

test('historical storage is explicitly versioned separately from living capacity',()=>{
 const s=createWorld();assert.equal(VERSION,'0.5.0');assert.equal(SAVE_VERSION,'0.5.0');
 assert.equal(s.archiveVersion,ARCHIVE_VERSION);assert.deepEqual(s.archive,[]);assert.equal(retainedCount(s),6);
 assert.equal(HISTORY_LIMITS.hotRecords,64);assert.equal(HISTORY_LIMITS.maxRetained,1024);
});

test('old 200-identity boundary allows a valid manual clone without erasing ancestry',()=>{
 const s=historyFixture(),before=allPeople(s).map(facts),stock={...s.stock};assert.deepEqual(validate(s),[]);
 const result=command(s,'CLONE',{parentId:1});assert.equal(result.ok,true);
 assert.equal(living(s).length,7);assert.equal(retainedCount(s),201);assert.equal(s.agents.length,7);assert.equal(s.archive.length,194);
 assert.equal(s.stock.food,stock.food-8);assert.equal(s.stock.wood,stock.wood-4);
 assert.deepEqual(allPeople(s).filter(a=>a.id<=200).map(facts),before);
 assert.ok(s.archive.every(a=>!a.alive&&a.hp===0&&a.task===null&&a.moveTick===0&&a.trace.length===0));
 assert.equal(findPerson(s,7).id,7);assert.equal(findPerson(s,201).parentId,1);assert.deepEqual(validate(s),[]);
});

test('autonomous birth crosses the same boundary and inherits real parent XP once',()=>{
 const s=historyFixture();s.tick=359;for(const a of living(s)){a.satiety=100;a.energy=100;a.task=null;}
 const parent=s.agents[0],skills={...parent.skills};step(s);
 const child=findPerson(s,201);assert.equal(retainedCount(s),201);assert.equal(isAutonomousChild(child),true);
 assert.equal(child.bornTick,360);assert.equal(child.life.ageAtAnchorYears,0);assert.equal(child.parentId,parent.id);
 for(const k of Object.keys(skills))assert.equal(child.skills[k],Math.floor(skills[k]*.35));
 assert.deepEqual(validate(s),[]);
});

test('retention preview and rejected clone do not compact or spend resources',()=>{
 const s=historyFixture(),before=serialize(s);assert.equal(retentionPlan(s).ok,true);assert.equal(serialize(s),before);
 const preview=restore(before);assert.equal(command(preview,'CLONE',{parentId:1}).ok,true);assert.equal(serialize(s),before);
 s.stock.food=0;const rejected=serialize(s);assert.equal(command(s,'CLONE',{parentId:1}).ok,false);assert.equal(serialize(s),rejected);
});

test('archived autonomous child still determines birth pacing and same-parent cooldown',()=>{
 const s=historyFixture(80);s.tick=360;
 const child=s.agents.find(a=>a.id===7);child.bornTick=360;child.life={anchorTick:360,ageAtAnchorYears:0};
 child.death={status:'recorded',tick:360,cause:'starvation',ageYears:0};
 const plan=birthPlan(s,100),parents=eligibleBirthParents(s).map(a=>a.id),record=facts(child);
 assert.equal(plan.reason,'pace');assert.equal(parents.includes(1),false);
 assert.equal(compactRetired(s).ok,true);assert.equal(findPerson(s,7).archived,true);
 assert.deepEqual(facts(findPerson(s,7)),record);assert.equal(isAutonomousChild(findPerson(s,7)),true);
 assert.equal(autonomousChildrenOf(s,1).length,1);assert.equal(birthPlan(s,100).reason,'pace');
 assert.deepEqual(eligibleBirthParents(s).map(a=>a.id),parents);
 s.tick+=4*360;assert.equal(birthPlan(s,100).ok,true);assert.ok(eligibleBirthParents(s).some(a=>a.id===1));
});

test('archived parents resolve through multiple generations and save/restore',()=>{
 const s=historyFixture(80),p=s.agents.find(a=>a.id===7),child=s.agents[2];
 child.parentId=p.id;child.generation=p.generation+1;assert.equal(compactRetired(s).ok,true);
 const restored=restore(serialize(s));assert.equal(findPerson(restored,child.parentId).name,p.name);
 assert.deepEqual(facts(findPerson(restored,p.id)),facts(p));assert.equal(ageYears(restored,findPerson(restored,p.id)),18);
 const before=JSON.stringify(restored.archive);step(restored,720);assert.equal(JSON.stringify(restored.archive),before);
 const book=reservations(restored).book;const claims=[...book.nodes.values(),...book.meals,...[...book.buildings.values()].flatMap(x=>[...x])];
 assert.ok(claims.every(id=>findPerson(restored,id)?.alive));
});

test('compacted continuation is byte-identical under single and batched steps',()=>{
 const s=historyFixture(80);command(s,'CLONE',{parentId:1});const b=restore(serialize(s));
 assert.equal(serialize(b),serialize(s));step(s,721);for(let i=0;i<721;i++)step(b);
 assert.equal(serialize(s),serialize(b));assert.deepEqual(validate(s),[]);
});

test('retained identity capacity has explicit atomic failure, not ancestry deletion',()=>{
 const s=coldFixture(HISTORY_LIMITS.maxRetained);assert.deepEqual(validate(s),[]);const before=serialize(s);
 assert.equal(retentionPlan(s).reason,'history-capacity');assert.equal(command(s,'CLONE',{parentId:1}).ok,false);assert.equal(serialize(s),before);
 s.tick=359;for(const a of living(s)){a.satiety=100;a.energy=100;}step(s);
 assert.equal(retainedCount(s),HISTORY_LIMITS.maxRetained);assert.equal(s.stats.cloned,0);
});

test('archive character budget blocks compaction without discarding original records',()=>{
 const s=historyFixture(80),record={...s.agents.pop(),trace:[],archived:true};s.archive=[record];
 record.memory=[{tick:0,text:'x'.repeat(HISTORY_LIMITS.maxArchiveCharacters-JSON.stringify(s.archive).length-100)}];
 assert.ok(JSON.stringify(s.archive).length<HISTORY_LIMITS.maxArchiveCharacters);
 assert.deepEqual(validate(s),[]);const before=serialize(s);
 assert.equal(retentionPlan(s).reason,'history-storage');assert.equal(compactRetired(s).ok,false);
 assert.equal(command(s,'CLONE',{parentId:1}).ok,false);assert.equal(serialize(s),before);
});

test('archive validation rejects live records, dangling/cyclic parents, duplicates and runtime work',()=>{
 const s=coldFixture(20);assert.deepEqual(validate(s),[]);
 for(const alter of [x=>x.archive[0].alive=true,x=>x.archive[0].parentId=9999,x=>x.archive[0].parentId=x.archive[0].id,
  x=>x.archive[0].id=x.agents[0].id,x=>x.archive[0].moveTick=1,x=>x.archive[0].archived=false,
  x=>x.archive[0].task={kind:'IDLE',path:[],work:0},x=>x.archive[0].generation=99,x=>x.archive[0]=null,
  x=>x.archiveVersion='99',x=>delete x.archive,x=>delete x.archiveVersion]){
  const raw=JSON.parse(serialize(s));alter(raw);assert.throws(()=>restore(JSON.stringify(raw)));
 }
});

test('real save 0.2.0 explicitly adopts archive schema without rewriting life or identity',()=>{
 const raw=JSON.parse(readFileSync(new URL('./fixtures/legacy-0.3.3-save.json',import.meta.url),'utf8'));
 const migrated=restore(JSON.stringify(raw));assert.equal(raw.version,'0.2.0');assert.equal(migrated.version,'0.5.0');
 assert.equal(migrated.archiveVersion,ARCHIVE_VERSION);assert.deepEqual(migrated.archive,[]);
 for(let i=0;i<raw.agents.length;i++)for(const k of ['id','parentId','generation','skills','appearance','bornTick','life'])assert.deepEqual(migrated.agents[i][k],raw.agents[i][k]);
 assert.equal(migrated.tick,raw.tick);assert.equal(migrated.seed,raw.seed);
});

test('missing archive fields in current save are corrupt, not silently initialized',()=>{
 const s=coldFixture(20);delete s.archive;assert.throws(()=>restore(JSON.stringify(s)));
});

test('unknown legacy death remains unknown after compaction and further years',()=>{
 const s=historyFixture(80),a=s.agents.find(a=>a.id===7);a.death={status:'legacy-unknown',tick:null,cause:'unknown',ageYears:null};
 assert.equal(compactRetired(s).ok,true);const r=restore(serialize(s));step(r,720);
 assert.equal(ageYears(r,findPerson(r,7)),null);assert.deepEqual(findPerson(r,7).death,a.death);
});


test('oversized serialization cannot replace previously readable browser save bytes',async()=>{
 const {createWorldStore}=await import('../src/storage.mjs');const s=createWorld(),good=serialize(s);let bytes=good;
 const store=createWorldStore({getStorage:()=>({getItem:()=>bytes,setItem:(key,value)=>{bytes=value;}}),serialize,restore});
 assert.ok(store.load());s.agents[0].memory=[{tick:0,text:'x'.repeat(HISTORY_LIMITS.maxSaveCharacters)}];
 assert.throws(()=>serialize(s));assert.equal(store.save(s).ok,false);assert.equal(bytes,good);
});

test('browser import byte bound accommodates UTF-8 while restore enforces character budget',()=>{
 const source=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
 assert.ok(source.includes('file.size>HISTORY_LIMITS.maxSaveCharacters*3'));
 const s=createWorld();s.agents[0].memory=[{tick:0,text:'ก'.repeat(700000)}];
 const text=serialize(s);assert.ok(Buffer.byteLength(text)>2000000);assert.ok(Buffer.byteLength(text)<=HISTORY_LIMITS.maxSaveCharacters*3);
 assert.equal(serialize(restore(text)),text);
});


test('real 0.1.0 starvation save with stale movement is migrated without losing death evidence',async()=>{
 const legacy=await import('./fixtures/legacy-engine-0.1.0.mjs');const s=legacy.createWorld(42),a=s.agents[0];
 a.satiety=0;a.hp=.1;a.moveTick=2;legacy.step(s);assert.equal(a.alive,false);assert.equal(a.moveTick,2);
 const restored=restore(legacy.serialize(s)),dead=findPerson(restored,a.id);
 assert.equal(dead.alive,false);assert.equal(dead.moveTick,0);assert.equal(dead.task,null);
 assert.equal(dead.death.cause,'starvation');assert.equal(dead.death.tick,s.tick);assert.equal(dead.death.ageYears,null);
 for(const k of ['id','parentId','generation','appearance','skills','bornTick','memory'])assert.deepEqual(dead[k],a[k]);
 assert.deepEqual(validate(restored),[]);
});
