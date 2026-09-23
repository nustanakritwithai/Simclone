/** V0.3.2 autonomous-birth proof. No player CLONE commands. Not the V0.3.4 death/continuity proof. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createWorld,step,validate,living,lifeStage,LIFE_STAGES,capacity} from '../src/engine.mjs';
import {isAutonomousChild} from '../src/reproduction.mjs';

const results=[];
for(const seed of [230926,1,42,2026,90001]){
  const s=createWorld(seed),start=performance.now();
  let maxPopulation=living(s).length,maxGeneration=Math.max(...s.agents.map(a=>a.generation));
  for(let year=0;year<30;year++){
    step(s,360);assert.deepEqual(validate(s),[]);
    maxPopulation=Math.max(maxPopulation,living(s).length);
    maxGeneration=Math.max(maxGeneration,...s.agents.map(a=>a.generation));
    assert.ok(living(s).length<=Math.min(36,capacity(s)));
    assert.ok(Object.values(s.stock).every(v=>v>=0&&v<=999));
  }
  const descendants=s.agents.filter(isAutonomousChild);
  const grown=descendants.filter(a=>lifeStage(s,a)!==LIFE_STAGES.CHILD&&a.alive);
  const productive=grown.filter(a=>a.workDone>0);
  const record={seed,elapsedYears:30,manualCloneCommands:s.stats.cloned,autonomousBirths:descendants.length,
    grownDescendants:grown.length,productiveDescendants:productive.length,maxGeneration,
    livingPopulation:living(s).length,maxPopulation,housing:capacity(s),
    result:s.stats.cloned===0&&descendants.length>0&&grown.length>0&&productive.length>0&&maxGeneration>=2?'SAT':'VIOL',
    elapsedMs:Math.round(performance.now()-start)};
  results.push(record);console.log(JSON.stringify(record));
}
mkdirSync('evidence-lifecycle',{recursive:true});
const report={scope:'V0.3.2 autonomous birth only; no manual CLONE commands; proves birth -> child growth -> productive descendant across seeds, but not age death or post-death generation continuity',
  total:results.length,passed:results.filter(r=>r.result==='SAT').length,results};
writeFileSync('evidence-lifecycle/autonomous-birth.json',JSON.stringify(report,null,2));
if(report.passed!==report.total)process.exitCode=1;
