/** V0.3.4: fresh-world generation continuity with real death and checkpoint continuation. Not V1.0. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createWorld,step,validate,living,capacity,LIFE_STAGES,lifeStage,SKILLS,serialize,restore,DAY_TICKS} from '../src/engine.mjs';
import {isAutonomousChild,BIRTH_RULES} from '../src/reproduction.mjs';
import {reservations} from '../src/survival.mjs';
const results=[];
for(const seed of [230926,1,42,2026,90001]){
 const s=createWorld(seed),initialIds=new Set(s.agents.map(a=>a.id)),start=performance.now();
 const identities=new Map(s.agents.map(a=>[a.id,JSON.stringify([a.name,a.parentId,a.generation,a.appearance])])),stages=new Map(s.agents.map(a=>[a.id,lifeStage(s,a)]));
 let shadow=null,shadowSingles=false,saveContinuations=0,batchComparisons=0,childToAdult=0,adultToElder=0,ageDeaths=0,starvationDeaths=0,lastInitialDeathTick=null,lastBirthTick=null,minPopulation=6,maxPopulation=6,extinct=false;
 const observedDeaths=new Set();
 for(let year=0;year<120;year++){
  step(s,DAY_TICKS);
  if(shadow){if(shadowSingles){for(let i=0;i<DAY_TICKS;i++)step(shadow);batchComparisons++;}else step(shadow,DAY_TICKS);assert.equal(serialize(s),serialize(shadow),'checkpoint continuation');saveContinuations++;shadow=null;}
  assert.deepEqual(validate(s),[]);assert.equal(s.stats.cloned,0,'no manual CLONE');
  const pop=living(s).length;minPopulation=Math.min(minPopulation,pop);maxPopulation=Math.max(maxPopulation,pop);assert.ok(pop<=Math.min(36,capacity(s)));
  for(const a of s.agents){
   const identity=JSON.stringify([a.name,a.parentId,a.generation,a.appearance]),stage=lifeStage(s,a);
   if(identities.has(a.id))assert.equal(identity,identities.get(a.id),'permanent identity');
   else{
    const parent=s.agents.find(p=>p.id===a.parentId);assert.ok(parent&&parent.alive);assert.ok(isAutonomousChild(a));assert.equal(a.bornTick,s.tick);
    assert.equal(a.generation,parent.generation+1);assert.equal(stage,LIFE_STAGES.CHILD);assert.equal(a.workDone,0);
    for(const k of SKILLS)assert.equal(a.skills[k],Math.floor(parent.skills[k]*.35));
    if(lastBirthTick!==null)assert.ok(a.bornTick-lastBirthTick>=BIRTH_RULES.globalIntervalYears*DAY_TICKS);
    lastBirthTick=a.bornTick;identities.set(a.id,identity);
   }
   if(stages.get(a.id)===LIFE_STAGES.CHILD&&stage===LIFE_STAGES.ADULT)childToAdult++;
   if(stages.get(a.id)===LIFE_STAGES.ADULT&&stage===LIFE_STAGES.ELDER)adultToElder++;
   stages.set(a.id,stage);
   if(!a.alive){
    assert.equal(a.task,null);assert.equal(a.hp,0);assert.equal(a.moveTick,0);
    if(!observedDeaths.has(a.id)){
     const memory=a.memory.findLast(m=>m.text.includes('เสียชีวิต'));assert.ok(memory,'death remains in personal history');
     if(memory.text.includes('ตามวัย'))ageDeaths++;else if(memory.text.includes('ขาดอาหาร'))starvationDeaths++;
     if(initialIds.has(a.id))lastInitialDeathTick=Math.max(lastInitialDeathTick??0,memory.tick);observedDeaths.add(a.id);
    }
   }
  }
  const {book,rejected}=reservations(s);assert.deepEqual(rejected,[]);
  for(const id of [...book.nodes.values(),...[...book.buildings.values()].flatMap(v=>[...v]),...book.meals])assert.ok(s.agents.find(a=>a.id===id)?.alive);
  if(pop===0){extinct=true;break;}
  if([19,59,89].includes(year)){shadow=restore(serialize(s));assert.equal(serialize(shadow),serialize(s));shadowSingles=year===59;}
 }
 const allInitialDead=s.agents.filter(a=>initialIds.has(a.id)).every(a=>!a.alive);
 if(!allInitialDead)lastInitialDeathTick=null;
 // Birth on the same tick is after the death phase in the engine's tick ordering.
 const postDeathBirths=lastInitialDeathTick===null?[]:s.agents.filter(a=>isAutonomousChild(a)&&a.bornTick>=lastInitialDeathTick);
 const productiveAfter=postDeathBirths.filter(a=>a.alive&&a.workDone>0&&lifeStage(s,a)!==LIFE_STAGES.CHILD);
 const livingNow=living(s),maxGeneration=Math.max(...s.agents.map(a=>a.generation)),livingMaxGeneration=livingNow.length?Math.max(...livingNow.map(a=>a.generation)):-1,livingAdults=livingNow.filter(a=>lifeStage(s,a)===LIFE_STAGES.ADULT).length;
 const record={seed,elapsedYears:s.tick/DAY_TICKS,manualCloneCommands:s.stats.cloned,allInitialDead,lastInitialDeathTick,postInitialDeathBirths:postDeathBirths.length,productivePostDeathDescendants:productiveAfter.length,childToAdult,adultToElder,ageDeaths,starvationDeaths,maxGeneration,livingMaxGeneration,livingAdults,livingPopulation:livingNow.length,minPopulation,maxPopulation,totalHistoricalAgents:s.agents.length,housing:capacity(s),saveContinuations,batchComparisons,extinct,result:allInitialDead&&!extinct&&livingAdults>0&&postDeathBirths.length>0&&productiveAfter.length>0&&livingMaxGeneration>=3&&childToAdult>0&&adultToElder>0&&starvationDeaths===0&&saveContinuations===3?'SAT':'VIOL',elapsedMs:Math.round(performance.now()-start)};
 results.push(record);console.log(JSON.stringify(record));
}
mkdirSync('evidence-lifecycle',{recursive:true});
const report={scope:'Fresh worlds, five seeds, 120 years, real aging/death, no manual CLONE or age resets. Proves productive descendants after all initial agents die, stable identity/inheritance/reservations and three save continuations. Not unlimited-time, all-save or V1.0 proof.',total:results.length,passed:results.filter(r=>r.result==='SAT').length,results};
writeFileSync('evidence-lifecycle/generation-continuity.json',JSON.stringify(report,null,2));
if(report.passed!==report.total)process.exitCode=1;
