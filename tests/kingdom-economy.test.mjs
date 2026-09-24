import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KINGDOM_ECONOMY_VERSION,kingdomVillageDemand,kingdomScarcityRatio,kingdomLaborPremium,
  specializationSnapshot,kingdomEconomySnapshot
} from '../src/kingdom-economy.mjs';
import {createWorld,step,serialize,survivalSummary,validate} from '../src/engine.mjs';

test('K2 adapts Kingdom village demand formula to Simclone goods',()=>{
  assert.equal(KINGDOM_ECONOMY_VERSION,'K2-shadow-0.1');
  assert.deepEqual(kingdomVillageDemand(10),{food:20,wood:10,stone:7});
  assert.deepEqual(kingdomVillageDemand(0),{food:0,wood:5,stone:4});
});

test('K2 scarcity and labor premium preserve Kingdom bounds',()=>{
  const d={food:20,wood:10,stone:7};
  assert.equal(kingdomScarcityRatio({food:20},d,'food'),1);
  assert.equal(kingdomScarcityRatio({food:0},d,'food'),6);
  assert.equal(kingdomScarcityRatio({food:999},d,'food'),0.25);
  assert.equal(kingdomLaborPremium(1),1);
  assert.equal(kingdomLaborPremium(6),1.8);
});

test('specialization snapshot is read-only and can infer legacy agents from preference',()=>{
  const agents=[
    {alive:true,profession:'forager',preference:'MINE'},
    {alive:true,preference:'WOODCUT'},
    {alive:true,preference:'MINE'},
    {alive:false,profession:'builder',preference:'BUILD'},
  ];
  const before=JSON.stringify(agents),s=specializationSnapshot(agents);
  assert.deepEqual(s.counts,{forager:1,woodcutter:1,miner:1,builder:0});
  assert.equal(s.diversity,3);
  assert.equal(JSON.stringify(agents),before);
});

test('K2 snapshot identifies labor pressure without mutating state',()=>{
  const s=createWorld(230926);
  const before=serialize(s);
  const e=kingdomEconomySnapshot({agents:s.agents,stock:{food:1,wood:999,stone:999},unfinished:0});
  assert.equal(e.mode,'shadow');
  assert.equal(e.topPressure.profession,'forager');
  assert.ok(e.premium.forager>e.premium.woodcutter);
  assert.equal(serialize(s),before);
});

test('survival summary exposes K2 shadow economy and remains read-only',()=>{
  const s=createWorld(42),before=serialize(s),v=survivalSummary(s);
  assert.equal(v.kingdomEconomy.version,KINGDOM_ECONOMY_VERSION);
  assert.equal(v.kingdomEconomy.population,6);
  assert.equal(serialize(s),before);
  v.kingdomEconomy.demand.food=999;
  assert.equal(serialize(s),before);
});

test('observing K2 every tick cannot change deterministic execution',()=>{
  const a=createWorld(9191),b=createWorld(9191);
  for(let i=0;i<600;i++){survivalSummary(a);step(a);step(b);}
  assert.equal(serialize(a),serialize(b));
  assert.deepEqual(validate(a),[]);
});
