/** V0.3.3 age-death stability proof. V0.3.4 will add the stronger post-death generation-continuity gate. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createWorld,step,validate,living,capacity} from '../src/engine.mjs';
import {reservations} from '../src/survival.mjs';

const results=[];
for(const seed of [230926,1,42,2026,90001]){
  const s=createWorld(seed),start=performance.now(),knownAlive=new Set(s.agents.filter(a=>a.alive).map(a=>a.id));
  let ageDeaths=0,starvationDeaths=0,maxPopulation=living(s).length;
  for(let year=0;year<90;year++){
    step(s,360);assert.deepEqual(validate(s),[]);
    maxPopulation=Math.max(maxPopulation,living(s).length);
    const nowAlive=new Set(s.agents.filter(a=>a.alive).map(a=>a.id));
    for(const id of knownAlive)if(!nowAlive.has(id)){
      const a=s.agents.find(x=>x.id===id),text=a?.memory.at(-1)?.text??'';
      if(text.includes('ตามวัย'))ageDeaths++;else if(text.includes('ขาดอาหาร'))starvationDeaths++;
    }
    knownAlive.clear();for(const id of nowAlive)knownAlive.add(id);
    const dead=s.agents.filter(a=>!a.alive);
    assert.ok(dead.every(a=>a.task===null&&a.hp===0));
    const {book}=reservations(s),deadIds=new Set(dead.map(a=>a.id));
    assert.ok([...book.nodes.values()].every(id=>!deadIds.has(id)));
    assert.ok([...book.buildings.values()].every(ids=>[...ids].every(id=>!deadIds.has(id))));
    assert.ok([...book.meals].every(id=>!deadIds.has(id)));
    assert.ok(living(s).length<=Math.min(36,capacity(s)));
  }
  const record={seed,elapsedYears:90,ageDeaths,starvationDeaths,livingPopulation:living(s).length,
    totalHistoricalAgents:s.agents.length,maxPopulation,housing:capacity(s),result:ageDeaths>0?'SAT':'VIOL',
    elapsedMs:Math.round(performance.now()-start)};
  results.push(record);console.log(JSON.stringify(record));
}
mkdirSync('evidence-lifecycle',{recursive:true});
const report={scope:'V0.3.3 age death + cleanup; proves deterministic age deaths occur and dead agents keep no tasks/reservations. Does not yet require post-death multi-generation continuity.',
  total:results.length,passed:results.filter(r=>r.result==='SAT').length,results};
writeFileSync('evidence-lifecycle/age-death.json',JSON.stringify(report,null,2));
if(report.passed!==report.total)process.exitCode=1;
