/** V0.3.4 proof-first gate: can the world continue producing generations after the initial six have died? */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createWorld,step,validate,living,capacity,LIFE_STAGES,lifeStage} from '../src/engine.mjs';
import {isAutonomousChild} from '../src/reproduction.mjs';

const results=[];
for(const seed of [230926,1,42,2026,90001]){
  const s=createWorld(seed),initialIds=s.agents.map(a=>a.id),start=performance.now();
  let maxPopulation=living(s).length,maxGeneration=Math.max(...s.agents.map(a=>a.generation)),extinct=false;
  for(let year=0;year<120;year++){
    step(s,360);assert.deepEqual(validate(s),[]);
    const pop=living(s).length;maxPopulation=Math.max(maxPopulation,pop);
    maxGeneration=Math.max(maxGeneration,...s.agents.map(a=>a.generation));
    assert.ok(pop<=Math.min(36,capacity(s)));
    if(pop===0){extinct=true;break;}
  }
  const initial=s.agents.filter(a=>initialIds.includes(a.id));
  const allInitialDead=initial.every(a=>!a.alive);
  const deathTicks=initial.map(a=>a.memory.findLast?.(m=>m.text.includes('เสียชีวิต'))?.tick??a.memory.slice().reverse().find(m=>m.text.includes('เสียชีวิต'))?.tick).filter(Number.isFinite);
  const lastInitialDeathTick=deathTicks.length===initial.length?Math.max(...deathTicks):null;
  const postDeathBirths=lastInitialDeathTick===null?[]:s.agents.filter(a=>isAutonomousChild(a)&&a.bornTick>=lastInitialDeathTick);
  const productiveAfter=postDeathBirths.filter(a=>a.workDone>0);
  const livingNow=living(s),livingMaxGeneration=livingNow.length?Math.max(...livingNow.map(a=>a.generation)):-1;
  const livingAdults=livingNow.filter(a=>lifeStage(s,a)===LIFE_STAGES.ADULT).length;
  const record={seed,elapsedYears:Math.floor(s.tick/360),manualCloneCommands:s.stats.cloned,allInitialDead,lastInitialDeathTick,
    postInitialDeathBirths:postDeathBirths.length,productivePostDeathDescendants:productiveAfter.length,
    maxGeneration,livingMaxGeneration,livingAdults,livingPopulation:livingNow.length,maxPopulation,
    totalHistoricalAgents:s.agents.length,housing:capacity(s),extinct,
    result:s.stats.cloned===0&&allInitialDead&&!extinct&&livingNow.length>0&&postDeathBirths.length>0&&productiveAfter.length>0&&maxGeneration>=3?'SAT':'VIOL',
    elapsedMs:Math.round(performance.now()-start)};
  results.push(record);console.log(JSON.stringify(record));
}
mkdirSync('evidence-lifecycle',{recursive:true});
const report={scope:'V0.3.4 generation continuity proof-first: initial six die, later autonomous birth occurs, post-death descendant becomes productive, max generation >=3, no player CLONE',
 total:results.length,passed:results.filter(r=>r.result==='SAT').length,results};
writeFileSync('evidence-lifecycle/generation-continuity.json',JSON.stringify(report,null,2));
if(report.passed!==report.total)process.exitCode=1;
