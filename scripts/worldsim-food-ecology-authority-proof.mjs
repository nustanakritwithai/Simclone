/** WM4.5 — behavioral proof for ecology-sensitive food regeneration.
 * Compares production ecology policy with historical WM4.1/K6 through the
 * same engine and the same single WorldSim writer.
 */
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore,validate,living,allPeople,DAY_TICKS} from '../src/engine.mjs';
import {applyWorldResourceRegeneration} from '../src/worldsim-resource-authority.mjs';

const SEEDS=[230926,1,42,2026,90001];
const MODES=['legacy','ecology'];
const FOOD_PERIOD=120;

const foodNodes=s=>s.nodes.filter(n=>n.type==='food');
const nodeFood=s=>foodNodes(s).reduce((sum,n)=>sum+n.amount,0);
const foodAvailability=s=>s.stock.food+nodeFood(s);
const depletedFoodNodes=s=>foodNodes(s).filter(n=>n.amount<n.max).length;
const median=values=>{
  const xs=[...values].sort((a,b)=>a-b),n=xs.length;
  return n? n%2?xs[(n-1)/2]:(xs[n/2-1]+xs[n/2])/2 : 0;
};

function metrics(s){
  const people=allPeople(s),deaths=people.filter(a=>!a.alive&&a.death);
  return {
    tick:s.tick,
    living:living(s).length,
    retained:people.length,
    births:people.filter(a=>a.parentId!==null&&a.bornTick>0).length,
    starvationDeaths:deaths.filter(a=>a.death.cause==='starvation').length,
    ageDeaths:deaths.filter(a=>a.death.cause==='age').length,
    stockFood:s.stock.food,
    nodeFood:nodeFood(s),
    foodAvailability:foodAvailability(s),
    depletedFoodNodes:depletedFoodNodes(s)
  };
}

/** Measure the regeneration that will happen on the exact pre-boundary state.
 * The probe uses the same single writer but does not execute agent actions.
 */
function measuredAdvance(s,ticks,mode,counter){
  const target=s.tick+ticks;
  while(s.tick<target){
    const untilBoundary=FOOD_PERIOD-(s.tick%FOOD_PERIOD||0);
    const span=Math.min(target-s.tick,untilBoundary);
    if(span>1)step(s,span-1,{resourceRegenerationMode:mode});
    if(s.tick>=target)break;
    const nextTick=s.tick+1;
    if(nextTick%FOOD_PERIOD===0){
      const probe=structuredClone(s);probe.tick=nextTick;
      const before=nodeFood(probe);
      applyWorldResourceRegeneration(probe,{foodMode:mode});
      counter.foodRegenerated+=nodeFood(probe)-before;
    }
    step(s,1,{resourceRegenerationMode:mode});
  }
}

function runLong(seed,mode){
  const s=createWorld(seed),counter={foodRegenerated:0};
  let minPopulation=living(s).length;
  const checkpoints=[],availability=[];
  for(let year=1;year<=120;year++){
    measuredAdvance(s,DAY_TICKS,mode,counter);
    assert.deepEqual(validate(s),[]);
    minPopulation=Math.min(minPopulation,living(s).length);
    availability.push(foodAvailability(s));
    if([1,10,30,60,90,120].includes(year))checkpoints.push({year,...metrics(s)});
    if(living(s).length===0)break;
  }
  return {
    seed,mode,minPopulation,extinct:living(s).length===0,
    totalFoodRegenerated:counter.foodRegenerated,
    minFoodAvailability:Math.min(...availability),
    medianFoodAvailability:median(availability),
    checkpoints,final:metrics(s)
  };
}

function runCrisis(seed,mode){
  const s=createWorld(seed),initialIds=s.agents.map(a=>a.id),counter={foodRegenerated:0};
  s.stock.food=0;
  for(const n of foodNodes(s))n.amount=0;
  for(const a of s.agents){a.satiety=5;a.energy=5;}
  measuredAdvance(s,DAY_TICKS*10,mode,counter);
  assert.deepEqual(validate(s),[]);
  const initialSurvivors=initialIds.filter(id=>s.agents.find(a=>a.id===id)?.alive).length;
  return {seed,mode,initialSurvivors,totalFoodRegenerated:counter.foodRegenerated,...metrics(s)};
}

function proveReplayAndSave(mode){
  const a=createWorld(424242),b=createWorld(424242);
  step(a,DAY_TICKS*12,{resourceRegenerationMode:mode});
  for(let i=0;i<12;i++)step(b,DAY_TICKS,{resourceRegenerationMode:mode});
  assert.equal(serialize(a),serialize(b),mode+' replay');

  const uninterrupted=createWorld(515151),split=createWorld(515151);
  step(uninterrupted,DAY_TICKS*24,{resourceRegenerationMode:mode});
  step(split,DAY_TICKS*12,{resourceRegenerationMode:mode});
  const resumed=restore(serialize(split));
  step(resumed,DAY_TICKS*12,{resourceRegenerationMode:mode});
  assert.equal(serialize(uninterrupted),serialize(resumed),mode+' save/load');
  return {mode,replay:true,saveLoad:true};
}

const longRuns=[];
for(const seed of SEEDS)for(const mode of MODES)longRuns.push(runLong(seed,mode));

const crises=[];
for(const seed of SEEDS)for(const mode of MODES)crises.push(runCrisis(seed,mode));

const continuation=MODES.map(proveReplayAndSave);

for(const row of longRuns.filter(x=>x.mode==='ecology')){
  assert.equal(row.extinct,false,'ecology long-run extinction seed '+row.seed);
  assert.ok(row.final.living>0,'ecology must retain a living population seed '+row.seed);
  assert.equal(row.final.starvationDeaths,0,'ecology introduces long-run starvation deaths seed '+row.seed);
}
for(const row of crises.filter(x=>x.mode==='ecology')){
  assert.equal(row.initialSurvivors,6,'ecology crisis lost a member of the six-person seed colony '+row.seed);
  assert.equal(row.starvationDeaths,0,'ecology crisis caused starvation death seed '+row.seed);
}
for(const seed of SEEDS){
  const legacy=longRuns.find(x=>x.seed===seed&&x.mode==='legacy');
  const ecology=longRuns.find(x=>x.seed===seed&&x.mode==='ecology');
  assert.ok(ecology.totalFoodRegenerated<=legacy.totalFoodRegenerated,'ecology exceeds legacy food regeneration seed '+seed);
}
assert.ok(longRuns.some(row=>{
  if(row.mode!=='ecology')return false;
  const legacy=longRuns.find(x=>x.seed===row.seed&&x.mode==='legacy');
  return legacy&&row.totalFoodRegenerated<legacy.totalFoodRegenerated;
}),'ecology authority must create measurable pressure versus legacy');

const report={
  gate:'WM4.5',
  candidate:'wm4.5-conservative-v1',
  seeds:SEEDS,
  years:120,
  result:'SAT',
  longRuns,
  crises,
  continuation
};
console.log('WM4_5_AUTHORITY_PROOF '+JSON.stringify(report));
