import test from 'node:test';
import assert from 'node:assert/strict';
import {tradableRustItemIds,transferRustItemInstances,RUST_POSSESSION_LIMITS} from '../src/rust-possessions.mjs';
import {rustTradeItemAdapter,RUST_TRADE_ADAPTER_VERSION} from '../src/trade-rust-adapter.mjs';

const clone=v=>structuredClone(v);
const base=()=>({
  tick:10,
  agents:[{id:1,alive:true},{id:2,alive:true}],
  rustPossessions:{
    version:'RS2-0.2',nextItem:10,nextOrder:1,
    items:[
      {id:1,kind:'HAMMER',createdBy:2,createdTick:0,location:{kind:'bag',agentId:2}},
      {id:2,kind:'HAMMER',createdBy:2,createdTick:0,location:{kind:'bag',agentId:2}},
    ],
    equipment:[],orders:[]
  }
});

test('RC4 Rust adapter is only a facade over existing possession authority',()=>{
  assert.equal(RUST_TRADE_ADAPTER_VERSION,'RC4-rust-items-1');
  const s=base();assert.deepEqual(rustTradeItemAdapter.tradableItemIds(s,{agentId:2,itemKind:'HAMMER'}),[1,2]);
});

test('RC4 Rust transfer moves exact existing instances without minting, deleting or changing creator',()=>{
  const s=base(),beforeIds=s.rustPossessions.items.map(i=>i.id),beforeCreators=s.rustPossessions.items.map(i=>i.createdBy);
  const r=transferRustItemInstances(s,{fromAgentId:2,toAgentId:1,itemIds:[2,1]});
  assert.equal(r.ok,true);assert.deepEqual(r.itemIds,[1,2]);
  assert.deepEqual(s.rustPossessions.items.map(i=>i.id),beforeIds);
  assert.deepEqual(s.rustPossessions.items.map(i=>i.createdBy),beforeCreators);
  assert.deepEqual(s.rustPossessions.items.map(i=>i.location.agentId),[1,1]);
});

test('RC4 Rust transfer validates whole batch before mutating',()=>{
  const s=base(),before=clone(s);
  const r=transferRustItemInstances(s,{fromAgentId:2,toAgentId:1,itemIds:[1,999]});
  assert.equal(r.ok,false);assert.equal(r.reason,'item');assert.deepEqual(s,before);
});

test('RC4 Rust trade excludes equipped and open-loot-claim item instances',()=>{
  const s=base();s.rustPossessions.equipment.push({agentId:2,itemId:1});
  s.agents[1].adventureCombat={lootClaim:{itemIds:[2]}};
  assert.deepEqual(tradableRustItemIds(s,{agentId:2,itemKind:'HAMMER'}),[]);
  const before=clone(s),r=transferRustItemInstances(s,{fromAgentId:2,toAgentId:1,itemIds:[1]});
  assert.equal(r.ok,false);assert.equal(r.reason,'item-reserved');assert.deepEqual(s,before);
});

test('RC4 Rust transfer refuses dead parties',()=>{
  for(const id of [1,2]){
    const s=base();s.agents.find(a=>a.id===id).alive=false;const before=clone(s);
    const r=transferRustItemInstances(s,{fromAgentId:2,toAgentId:1,itemIds:[1]});
    assert.equal(r.ok,false);assert.equal(r.reason,'actor');assert.deepEqual(s,before);
  }
});

test('RC4 Rust transfer refuses buyer bag overflow without partial mutation',()=>{
  const s=base();
  for(let i=0;i<RUST_POSSESSION_LIMITS.bag;i++)s.rustPossessions.items.push({id:20+i,kind:'HAMMER',createdBy:1,createdTick:0,location:{kind:'bag',agentId:1}});
  const before=clone(s),r=transferRustItemInstances(s,{fromAgentId:2,toAgentId:1,itemIds:[1]});
  assert.equal(r.ok,false);assert.equal(r.reason,'bag-full');assert.deepEqual(s,before);
});
