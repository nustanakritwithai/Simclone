/** Survival-only fixtures. NOT the V1.0 lifecycle/generation proof. */
import {performance} from 'node:perf_hooks';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createWorld,command,step,validate,living,survivalSummary,serialize,restore} from '../src/engine.mjs';
import assert from 'node:assert/strict';
const results=[];
function populate(seed,population){
 const s=createWorld(seed);
 if(population===6)s.buildings=s.buildings.slice(0,1);
 if(population>12)for(const [x,y] of [[13,9],[15,10],[8,16],[14,17]])s.buildings.push({id:s.nextBuilding++,type:'shelter',x,y,progress:30,complete:true});
 s.stock={food:999,wood:999,stone:999};
 while(s.agents.length<population)assert.ok(command(s,'CLONE',{parentId:1}).ok);
 s.stock={food:Math.max(28,population*2),wood:24,stone:12};
 return s;
}
for(const seed of [230926,1,42,2026,90001])for(const population of [6,12,36]){
 const s=populate(seed,population),start=performance.now();let lowestHP=100,maxHungry=0,maxNodeJobs=0,highestStock=0;
 for(let d=0;d<100;d++){
  step(s,360);assert.deepEqual(validate(s),[]);
  const v=survivalSummary(s);lowestHP=Math.min(lowestHP,...s.agents.map(a=>a.hp));maxHungry=Math.max(maxHungry,v.hungry);maxNodeJobs=Math.max(maxNodeJobs,v.nodeJobs);highestStock=Math.max(highestStock,...Object.values(s.stock));
 }
 const survivors=living(s).length,foodAtEnd=s.stock.food;
 const checkpoint=restore(serialize(s));step(s,60);step(checkpoint,60);assert.equal(serialize(s),serialize(checkpoint));
 const record={seed,population,elapsedDays:100,survivors,lowestHP,maxHungry,maxNodeJobs,highestStock,foodAtEnd,foodTarget:survivalSummary(s).targets.food,elapsedMs:Math.round(performance.now()-start),result:survivors===population?'SAT':'VIOL'};
 results.push(record);console.log(JSON.stringify(record));
}
for(const population of [6,12,36]){
 const s=populate(230926,population);s.stock.food=0;
 for(const a of s.agents){a.satiety=5;a.energy=5;}
 step(s,3600);const survivors=living(s).length;
 results.push({fixture:'empty-food-crisis',population,elapsedDays:10,survivors,foodAtEnd:s.stock.food,result:survivors===population?'SAT':'VIOL'});
 console.log(JSON.stringify(results.at(-1)));
}
mkdirSync('evidence-survival',{recursive:true});
const report={scope:'V0.2 survival only; fixture-built housing and initial population; no autonomous births/aging/social proof',total:results.length,passed:results.filter(x=>x.result==='SAT').length,results};
writeFileSync('evidence-survival/long-run.json',JSON.stringify(report,null,2));
if(report.passed!==report.total)process.exitCode=1;
