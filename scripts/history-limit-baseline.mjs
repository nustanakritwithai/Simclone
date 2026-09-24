/** Usage: node --expose-gc scripts/history-limit-baseline.mjs OLD_CHECKOUT OUTPUT_DIR
 * Measurements on the frozen 0.3.5 baseline; compaction projection is size-only, not a gameplay proof. */
import {performance} from 'node:perf_hooks';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {serialize as v8serialize} from 'node:v8';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.argv[2]??'.'),out=resolve(process.argv[3]??'evidence-history-baseline');
const {VERSION,createWorld,step,serialize,validate,living,survivalSummary}=await import(pathToFileURL(resolve(root,'src/engine.mjs')));
const {birthPlan,isAutonomousChild}=await import(pathToFileURL(resolve(root,'src/reproduction.mjs')));
import assert from 'node:assert/strict';
assert.equal(VERSION,'0.3.5','Pass a frozen 0.3.5 checkout as the first argument; this measures the old engine only');
mkdirSync(out,{recursive:true});
const rows=[];
for(const seed of [230926,1,42,2026,90001]){
 const s=createWorld(seed),start=performance.now();let boundary=null,minPopulation=6;
 for(let year=1;year<=1800;year++){
  step(s,360);minPopulation=Math.min(minPopulation,living(s).length);
  assert.deepEqual(validate(s),[]);
  if(s.agents.length===200&&!boundary){
   const raw=serialize(s),dead=s.agents.filter(a=>!a.alive);
   const projection={...s,version:'0.3.0',archiveVersion:'0.1.0',agents:living(s),archive:dead.map(a=>({...a,trace:[],archived:true}))};
   const projected=JSON.stringify(projection);
   const heap=state=>{if(!global.gc)return null;global.gc();const before=process.memoryUsage().heapUsed,clones=Array.from({length:12},()=>structuredClone(state));global.gc();const after=process.memoryUsage().heapUsed;assert.equal(clones.length,12);return Math.round((after-before)/12);};
   boundary={year,living:living(s).length,births:s.agents.filter(isAutonomousChild).length,saveCharacters:raw.length,saveUtf8Bytes:Buffer.byteLength(raw),v8Bytes:v8serialize(s).length,estimatedCloneHeapBytes:heap(s),planReason:birthPlan(s,survivalSummary(s).freeFood).reason,
    sizeOnlyProjection:{retainedDead:dead.length,saveCharacters:projected.length,saveUtf8Bytes:Buffer.byteLength(projected),v8Bytes:v8serialize(projection).length,estimatedCloneHeapBytes:heap(projection)}};
   writeFileSync(`${out}/baseline-boundary-${seed}.json`,raw);
  }
  if(boundary&&year>=boundary.year+20)break;
 }
 const row={seed,result:boundary?'MEASURED':'UNKNOWN',boundary,finalYear:s.tick/360,retained:s.agents.length,living:living(s).length,minPopulation,extinct:living(s).length===0,
  birthsIn20YearsAfterBoundary:boundary?s.agents.filter(isAutonomousChild).length-boundary.births:null,finalBirthReason:birthPlan(s,survivalSummary(s).freeFood).reason,elapsedMs:Math.round(performance.now()-start)};
 rows.push(row);console.error(JSON.stringify(row));writeFileSync(`${out}/history-measured-partial.json`,JSON.stringify(rows,null,2));
}
const sourceFiles=['src/engine.mjs','src/survival.mjs','src/lifecycle.mjs','src/reproduction.mjs'];
const manifest=Object.fromEntries(sourceFiles.map(f=>[f,createHash('sha256').update(readFileSync(resolve(root,f))).digest('hex')]));
const report={baselineCommit:'f2edda01af049ca8090f651d84376c29a8f32490',engine:VERSION,node:process.version,maxYears:1800,rows,manifest,
 scope:'Five fresh seeded 0.3.5 worlds. No resource injection, age reset, manual clone, extra housing or revival. Checks each year; 20-year boundary window.',
 memoryScope:'V8 serialization is a storage proxy; heap estimate uses 12 structuredClone copies and explicit GC, is noisy and not browser/Android memory. Compaction projection estimates sizes only; it does not prove archive gameplay.'};
writeFileSync(`${out}/history-measured.json`,JSON.stringify(report,null,2));
if(rows.some(r=>r.result==='UNKNOWN'))process.exitCode=2;
