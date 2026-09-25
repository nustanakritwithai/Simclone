/** WM4.6 — behavioral proof for ecology-sensitive wood regeneration.
 * Food remains the WM4.5 policy. Long-run generation safety stays in continuity.
 */
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore,validate,living,allPeople,DAY_TICKS} from '../src/engine.mjs';
import {applyWorldResourceRegeneration,woodEcologyIncrement} from '../src/worldsim-resource-authority.mjs';
import {createResourceEcologyShadow} from '../src/worldsim-resource-shadow.mjs';

const SEEDS=[230926,42];
const YEARS=1;

const woodNodes=s=>s.nodes.filter(n=>n.type==='wood');
const nodeWood=s=>woodNodes(s).reduce((sum,n)=>sum+n.amount,0);

function metrics(s){
  const people=allPeople(s),deaths=people.filter(a=>!a.alive&&a.death);
  return {
    tick:s.tick,
    living:living(s).length,
    nodeWood:nodeWood(s),
    stockWood:s.stock.wood,
    starvationDeaths:deaths.filter(a=>a.death.cause==='starvation').length
  };
}

function runWindow(seed,mode,years=YEARS){
  const s=createWorld(seed);
  const startWood=nodeWood(s)+s.stock.wood;
  step(s,DAY_TICKS*years,{resourceRegenerationMode:mode});
  assert.deepEqual(validate(s),[]);
  return {seed,mode,extinct:living(s).length===0,woodDelta:(nodeWood(s)+s.stock.wood)-startWood,...metrics(s)};
}

function proveReplayAndSave(mode){
  const a=createWorld(424242),b=createWorld(424242);
  step(a,DAY_TICKS,{resourceRegenerationMode:mode});
  step(b,DAY_TICKS,{resourceRegenerationMode:mode});
  assert.equal(serialize(a),serialize(b),mode+' replay');
  const uninterrupted=createWorld(515151),split=createWorld(515151);
  step(uninterrupted,DAY_TICKS*2,{resourceRegenerationMode:mode});
  step(split,DAY_TICKS,{resourceRegenerationMode:mode});
  const resumed=restore(serialize(split));
  step(resumed,DAY_TICKS,{resourceRegenerationMode:mode});
  assert.equal(serialize(uninterrupted),serialize(resumed),mode+' save/load');
  return {mode,replay:true,saveLoad:true};
}

const s0=createWorld(77);s0.tick=720;for(const n of s0.nodes)n.amount=0;
const ecology=createResourceEcologyShadow(s0);
assert.ok(woodNodes(s0).length>0);
for(const n of woodNodes(s0)){
  const expected=woodEcologyIncrement(ecology.cells[n.y*30+n.x].woodYieldPotential);
  const probe=structuredClone(s0);
  applyWorldResourceRegeneration(probe);
  assert.equal(probe.nodes.find(x=>x.id===n.id).amount,expected);
}

const windows=[];
for(const seed of SEEDS){
  windows.push(runWindow(seed,'ecology'));
  windows.push(runWindow(seed,'legacy'));
}
for(const row of windows.filter(x=>x.mode==='ecology')){
  assert.equal(row.extinct,false,'ecology wood window extinction seed '+row.seed);
  assert.ok(row.living>0,'ecology wood window must retain a living population seed '+row.seed);
  assert.equal(row.starvationDeaths,0,'ecology wood window introduced starvation seed '+row.seed);
}
assert.ok(SEEDS.some(seed=>{
  const ecologyRow=windows.find(x=>x.seed===seed&&x.mode==='ecology');
  const legacy=windows.find(x=>x.seed===seed&&x.mode==='legacy');
  return ecologyRow&&legacy&&(ecologyRow.woodDelta!==legacy.woodDelta||ecologyRow.nodeWood!==legacy.nodeWood);
}),'wood ecology authority must create a measurable wood-regeneration difference versus legacy');

const continuation=['legacy','ecology'].map(proveReplayAndSave);
const report={gate:'WM4.6',candidate:'wm4.6-conservative-v1',seeds:SEEDS,years:YEARS,result:'SAT',windows,continuation};
console.log('WM4_6_AUTHORITY_PROOF '+JSON.stringify(report));
