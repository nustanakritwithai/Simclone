/** 0.3.6: unmodified long-run continuity across the old history boundary. Not unlimited-time proof. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {serialize as v8serialize} from 'node:v8';
import {createWorld,step,serialize,restore,validate,living,capacity,lifeStage,LIFE_STAGES,SKILLS,VERSION} from '../src/engine.mjs';
import {allPeople,findPerson,retainedCount,HISTORY_LIMITS} from '../src/history.mjs';
import {isAutonomousChild,BIRTH_RULES} from '../src/reproduction.mjs';
import {reservations} from '../src/survival.mjs';
const baseline=JSON.parse(readFileSync(new URL('../docs/verification/history-baseline-0.3.5.json',import.meta.url),'utf8'));
const out='evidence-history';mkdirSync(out,{recursive:true});
const rows=[];
const identity=a=>JSON.stringify([a.id,a.name,a.parentId,a.generation,a.appearance,a.bornTick,a.life]);
const deadFacts=a=>JSON.stringify([a.death,a.skills,a.memory,a.source,a.workDone,a.x,a.y,a.satiety,a.energy]);
function heapEstimate(s){
 if(!global.gc)return null;
 global.gc();const before=process.memoryUsage().heapUsed,clones=Array.from({length:12},()=>structuredClone(s));global.gc();
 const bytes=Math.round((process.memoryUsage().heapUsed-before)/12);assert.equal(clones.length,12);return bytes;
}
for(const seed of [230926,1,42,2026,90001]){
 const s=createWorld(seed),started=performance.now(),identities=new Map(s.agents.map(a=>[a.id,identity(a)])),deaths=new Map();
 let minPopulation=6,maxPopulation=6,maxHot=6,maxArchive=0,maxSampledSaveBytes=0,boundary=null,birthsAfter20=null;
 let lastBirthTick=null,shadow=null,single=false,continuations=0,singleComparisons=0;
 for(let year=1;year<=1800;year++){
  step(s,360);
  if(shadow){if(single){for(let i=0;i<360;i++)step(shadow);singleComparisons++;}else step(shadow,360);assert.equal(serialize(s),serialize(shadow),'exact save continuation');continuations++;shadow=null;}
  assert.deepEqual(validate(s),[]);assert.equal(s.stats.cloned,0,'no manual clone');
  const pop=living(s).length;minPopulation=Math.min(minPopulation,pop);maxPopulation=Math.max(maxPopulation,pop);
  assert.ok(pop>0&&pop<=Math.min(BIRTH_RULES.maxPopulation,capacity(s)),'living population');
  maxHot=Math.max(maxHot,s.agents.length);maxArchive=Math.max(maxArchive,s.archive.length);assert.ok(s.agents.length<=HISTORY_LIMITS.hotRecords);
  for(const a of allPeople(s)){
   if(identities.has(a.id))assert.equal(identity(a),identities.get(a.id),'identity including lifecycle/birth origin');
   else{
    const p=findPerson(s,a.parentId);assert.ok(p?.alive);assert.ok(isAutonomousChild(a));assert.equal(a.bornTick,s.tick);
    assert.equal(a.life.ageAtAnchorYears,0);assert.equal(a.generation,p.generation+1);assert.equal(a.workDone,0);
    for(const k of SKILLS)assert.equal(a.skills[k],Math.floor(p.skills[k]*.35));
    if(lastBirthTick!==null)assert.ok(a.bornTick-lastBirthTick>=4*360);lastBirthTick=a.bornTick;
    identities.set(a.id,identity(a));
   }
   if(!a.alive){
    assert.equal(a.hp,0);assert.equal(a.task,null);assert.equal(a.moveTick,0);assert.equal(a.death.cause,'age','no starvation in fresh baseline');
    if(deaths.has(a.id))assert.equal(deadFacts(a),deaths.get(a.id),'stable historical death/XP/memory');else deaths.set(a.id,deadFacts(a));
   }
  }
  const {book,rejected}=reservations(s);assert.deepEqual(rejected,[]);
  for(const id of [...book.nodes.values(),...book.meals,...[...book.buildings.values()].flatMap(v=>[...v])])assert.ok(findPerson(s,id)?.alive);
  if(year%20===0)maxSampledSaveBytes=Math.max(maxSampledSaveBytes,Buffer.byteLength(serialize(s)));
  if(retainedCount(s)>=200&&!boundary){
   const text=serialize(s);boundary={year,retained:retainedCount(s),living:pop,hot:s.agents.length,archived:s.archive.length,saveCharacters:text.length,saveUtf8Bytes:Buffer.byteLength(text),v8Bytes:v8serialize(s).length,estimatedCloneHeapBytes:heapEstimate(s)};
   assert.equal(year,baseline.rows.find(r=>r.seed===seed).boundary.year,'archive does not change pre-boundary gameplay');
  }
  if(boundary&&year===boundary.year+20){birthsAfter20=retainedCount(s)-boundary.retained;assert.ok(birthsAfter20>0,'new births after old 200-history cap');}
  if([20,60,90,400,1000,1600].includes(year)||year===boundary?.year){shadow=restore(serialize(s));assert.equal(serialize(shadow),serialize(s));single=year===400||year===boundary?.year;}
 }
 const people=allPeople(s),pop=living(s),save=serialize(s);
 assert.ok(retainedCount(s)>200&&s.archive.length>0);assert.ok(pop.some(a=>lifeStage(s,a)===LIFE_STAGES.ADULT&&a.workDone>0));
 const row={seed,result:'SAT',years:1800,minPopulation,maxPopulation,extinct:false,manualClones:s.stats.cloned,starvationDeaths:0,ageDeaths:deaths.size,
  retained:people.length,living:pop.length,archived:s.archive.length,hot:s.agents.length,maxHot,maxArchive,maxGeneration:Math.max(...people.map(a=>a.generation)),
  birthCount:people.filter(isAutonomousChild).length,boundary,birthsIn20YearsAfterBoundary:birthsAfter20,saveContinuations:continuations,singleComparisons,
  saveCharacters:save.length,saveUtf8Bytes:Buffer.byteLength(save),maxSampledSaveBytes,elapsedMs:Math.round(performance.now()-started)};
 rows.push(row);console.log(JSON.stringify(row));writeFileSync(out+'/long-run-partial.json',JSON.stringify(rows,null,2));
}
const report={engine:VERSION,result:'SAT',total:rows.length,passed:rows.filter(r=>r.result==='SAT').length,rows,
 scope:'Five fresh seeds, 1800 years each, no manual clone, resource injection, age reset, extra housing or resurrection. Invariants checked at year boundaries; save-size maxima sampled every 20 years. Runtime includes verification overhead. Native/physical-device performance is a separate claim.',
 memoryScope:'V8 serialization is not live memory. Optional heap estimate averages 12 structuredClone copies with explicit Node GC and is noisy; not browser/Android memory.'};
writeFileSync(out+'/long-run.json',JSON.stringify(report,null,2));
