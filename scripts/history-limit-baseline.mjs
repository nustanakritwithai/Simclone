import {performance} from 'node:perf_hooks';
import {createWorld,step,serialize,living,survivalSummary} from '../src/engine.mjs';
import {birthPlan} from '../src/reproduction.mjs';

const seeds=[230926,1,42,2026,90001];
const MAX_YEARS=1200;
const YEAR_TICKS=360;

function run(seed){
  const s=createWorld(seed);
  const started=performance.now();
  let boundaryYear=null,boundaryBirths=null,birthsAfterWindow=null,reason=null,bytes=null,livingAtBoundary=null;
  for(let year=1;year<=MAX_YEARS;year++){
    step(s,YEAR_TICKS);
    if(s.agents.length>=200&&boundaryYear===null){
      boundaryYear=year;
      boundaryBirths=s.agents.filter(a=>a.parentId!==null&&a.life?.ageAtAnchorYears===0).length;
      livingAtBoundary=living(s).length;
      bytes=Buffer.byteLength(serialize(s),'utf8');
      reason=birthPlan(s,survivalSummary(s).freeFood).reason;
    }
    if(boundaryYear!==null&&year>=boundaryYear+20){
      birthsAfterWindow=s.agents.filter(a=>a.parentId!==null&&a.life?.ageAtAnchorYears===0).length;
      break;
    }
  }
  return {
    seed,
    boundaryYear,
    retainedAgents:s.agents.length,
    livingAtBoundary,
    boundaryBirths,
    birthsAfterWindow,
    birthsIn20YearsAfterBoundary: boundaryBirths===null||birthsAfterWindow===null?null:birthsAfterWindow-boundaryBirths,
    birthPlanReasonAtBoundary:reason,
    saveBytesAtBoundary:bytes,
    elapsedMs:Math.round((performance.now()-started)*100)/100,
  };
}

const rows=seeds.map(run);
console.log(JSON.stringify({
  engine:'0.3.5',
  purpose:'baseline measurement of the retained-history/active-cap coupling; not release proof',
  rows,
},null,2));

if(rows.some(r=>r.boundaryYear===null)){
  console.error('UNKNOWN: at least one seed did not reach the current 200-history boundary within '+MAX_YEARS+' years');
  process.exitCode=2;
}
