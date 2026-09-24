import test from 'node:test';
import assert from 'node:assert/strict';
import {KINGDOM_SETTLEMENTS_VERSION,settlementIdForCamp,kingdomSettlementSnapshot} from '../src/kingdom-settlements.mjs';

const agents=[
  {id:1,alive:true,x:1,y:1},{id:2,alive:true,x:8,y:1},{id:3,alive:false,x:2,y:1}
];

test('stable settlement id derives only from camp id',()=>{
  assert.equal(settlementIdForCamp(7),'settlement:camp:7');
});
test('only complete camps become settlement anchors',()=>{
  const s=kingdomSettlementSnapshot({agents,buildings:[
    {id:4,type:'camp',complete:false,x:0,y:0},
    {id:2,type:'shelter',complete:true,x:0,y:0},
    {id:1,type:'camp',complete:true,x:0,y:0}
  ]});
  assert.equal(s.version,KINGDOM_SETTLEMENTS_VERSION);assert.equal(s.count,1);
  assert.equal(s.settlements[0].id,'settlement:camp:1');
});
test('living agents deterministically join nearest settlement',()=>{
  const s=kingdomSettlementSnapshot({agents,buildings:[
    {id:2,type:'camp',complete:true,x:10,y:0},
    {id:1,type:'camp',complete:true,x:0,y:0}
  ]});
  assert.deepEqual(s.settlements.map(x=>[x.id,x.memberIds]),[
    ['settlement:camp:1',[1]],['settlement:camp:2',[2]]
  ]);
});
test('ties resolve by anchor building id, not array order',()=>{
  const s=kingdomSettlementSnapshot({agents:[{id:9,alive:true,x:5,y:0}],buildings:[
    {id:8,type:'camp',complete:true,x:10,y:0},{id:3,type:'camp',complete:true,x:0,y:0}
  ]});
  assert.deepEqual(s.settlements[0].memberIds,[9]);
});
test('no settlement leaves living population explicitly unassigned',()=>{
  const s=kingdomSettlementSnapshot({agents,buildings:[]});
  assert.equal(s.count,0);assert.equal(s.unassignedLiving,2);
});
test('snapshot is read-only and deterministic',()=>{
  const input={agents:structuredClone(agents),buildings:[{id:1,type:'camp',complete:true,x:0,y:0}]};
  const before=JSON.stringify(input),a=kingdomSettlementSnapshot(input),b=kingdomSettlementSnapshot(input);
  assert.equal(JSON.stringify(input),before);assert.deepEqual(a,b);
});
