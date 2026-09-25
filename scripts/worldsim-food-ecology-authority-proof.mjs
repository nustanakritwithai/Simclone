/** WM4.5 — behavioral proof for ecology-sensitive food regeneration.
 * Compares the production ecology policy with the historical WM4.1/K6 policy
 * through the same engine and the same single WorldSim writer.
 */
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore,validate,living,allPeople,DAY_TICKS} from '../src/engine.mjs';

const SEEDS=[230926,1,42,2026,90001];
const MODES=['legacy','ecology'];

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
    nodeFood:s.nodes.filter(n=>n.type==='food').reduce((sum,n)=>sum+n.amount,0)
  };
}

function runLong(seed,mode){
  const s=createWorld(seed);
  let minPopulation=living(s).length;
  const checkpoints=[];
  for(let year=1;year<=120;year++){
    step(s,DAY_TICKS,{resourceRegenerationMode:mode});
    assert.deepEqual(validate(s),[]);
    minPopulation=Math.min(minPopulation,living(s).length);
    if([1,10,30,60,90,120].includes(year))checkpoints.push({year,...metrics(s)});
    if(living(s).length===0)break;
  }
  return {seed,mode,minPopulation,extinct:living(s).length===0,checkpoints,final:metrics(s)};
}

function runCrisis(seed,mode){
  const s=createWorld(seed);
  s.stock.food=0;
  for(const n of s.nodes)if(n.type==='food')n.amount=0;
  for(const a of s.agents){a.satiety=5;a.energy=5;}
  step(s,DAY_TICKS*10,{resourceRegenerationMode:mode});
  assert.deepEqual(validate(s),[]);
  return {seed,mode,...metrics(s)};
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
  assert.equal(row.living,6,'ecology crisis must preserve the six-person seed colony '+row.seed);
}
assert.ok(longRuns.some(row=>{
  if(row.mode!=='ecology')return false;
  const legacy=longRuns.find(x=>x.seed===row.seed&&x.mode==='legacy');
  return legacy&&(legacy.final.nodeFood!==row.final.nodeFood||legacy.final.stockFood!==row.final.stockFood);
}),'ecology authority must have an observable effect versus legacy');

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
