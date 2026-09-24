import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KINGDOM_PRODUCTION_VERSION,kingdomSkillMultiplier,kingdomHungerPenalty,kingdomJobCrowding,
  kingdomAgentEfficiency,kingdomProductionSnapshot
} from '../src/kingdom-production.mjs';
import {createWorld,step,serialize,survivalSummary,validate} from '../src/engine.mjs';

test('K3 preserves Kingdom skill and hunger productivity multipliers',()=>{
  assert.equal(KINGDOM_PRODUCTION_VERSION,'K3-shadow-0.1');
  assert.equal(kingdomSkillMultiplier(0),1);
  assert.equal(kingdomSkillMultiplier(10),2.5);
  assert.equal(kingdomHungerPenalty(80),1);
  assert.equal(kingdomHungerPenalty(54),0.8);
  assert.equal(kingdomHungerPenalty(29),0.5);
});

test('K3 crowding falls only after a profession exceeds its ideal staffing',()=>{
  assert.equal(kingdomJobCrowding(1,6,1),1);
  assert.equal(kingdomJobCrowding(6,6,1),1);
  assert.equal(kingdomJobCrowding(12,6,1),0.5);
  assert.equal(kingdomJobCrowding(100,6,1),0.2);
});

test('agent efficiency composes explicit factors without mutation',()=>{
  const a={id:1,alive:true,satiety:40,profession:'miner',skills:{MINE:100}};
  const before=JSON.stringify(a);
  const r=kingdomAgentEfficiency(a,{role:'miner',workerCount:2,housingRatio:1,skillLevel:()=>4,ageRate:()=>0.75});
  assert.deepEqual(r.factors,{skill:1.6,hunger:0.8,crowding:1,age:0.75,tool:1});
  assert.equal(r.efficiency,0.96);
  assert.equal(JSON.stringify(a),before);
});


test('K3 respects a zero lifecycle work-rate for ineligible workers',()=>{
  const a={id:9,alive:true,satiety:90,profession:'builder',skills:{BUILD:100}};
  const r=kingdomAgentEfficiency(a,{role:'builder',workerCount:1,housingRatio:1,skillLevel:()=>5,ageRate:()=>0});
  assert.equal(r.factors.age,0);
  assert.equal(r.efficiency,0);
});

test('K3 production snapshot recommends scarce understaffed labor without taking authority',()=>{
  const agents=[
    {alive:true,satiety:90,profession:'forager',preference:'FORAGE',skills:{FORAGE:60}},
    {alive:true,satiety:90,profession:'woodcutter',preference:'WOODCUT',skills:{WOODCUT:60}},
  ];
  const e={premium:{forager:1,woodcutter:1,miner:1.8,builder:1}};
  const p=kingdomProductionSnapshot({agents,capacity:12,economy:e,skillLevel:()=>3,ageRate:()=>1});
  assert.equal(p.mode,'shadow');
  assert.equal(p.recommendedRole.role,'miner');
  assert.equal(p.roles.miner.workers,0);
  assert.ok(p.roles.miner.laborGap>0);
});

test('survival summary exposes K3 and remains read-only',()=>{
  const s=createWorld(42),before=serialize(s),v=survivalSummary(s);
  assert.equal(v.kingdomProduction.version,KINGDOM_PRODUCTION_VERSION);
  assert.equal(v.kingdomProduction.mode,'shadow');
  assert.equal(serialize(s),before);
  v.kingdomProduction.roles.forager.workers=999;
  assert.equal(serialize(s),before);
});

test('continuous K3 observation cannot change deterministic execution',()=>{
  const a=createWorld(333),b=createWorld(333);
  for(let i=0;i<720;i++){survivalSummary(a);step(a);step(b);}
  assert.equal(serialize(a),serialize(b));
  assert.deepEqual(validate(a),[]);
});
