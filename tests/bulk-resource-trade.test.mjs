import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorld,serialize,restore} from '../src/engine.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {materialAmount,transferMaterialQuantity,TRADEABLE_MATERIAL_KEYS} from '../src/material-economy.mjs';
import {bulkResourceTradeAdapter} from '../src/trade-rust-adapter.mjs';

test('ER0 bulk transfer moves canonical wood quantity without minting Rust items or money',()=>{
  const s=createWorld(230926),seller=s.agents[0],buyer=s.agents[1];
  const a=resourceStock(s,seller),b=resourceStock(s,buyer);
  a.wood=80;b.wood=10;
  const itemCount=s.rustPossessions.items.length,wallet=JSON.stringify(s.currencyWallet);
  const r=transferMaterialQuantity(s,{fromAgentId:seller.id,toAgentId:buyer.id,itemKind:'wood',quantity:12});
  assert.equal(r.ok,true);assert.equal(a.wood,68);assert.equal(b.wood,22);
  assert.equal(r.totalBefore,r.totalAfter);assert.equal(s.rustPossessions.items.length,itemCount);
  assert.equal(JSON.stringify(s.currencyWallet),wallet);
});

test('ER0 bulk transfer supports canonical metal counters and survives save/load exactly',()=>{
  let s=createWorld(230926),seller=s.agents[0],buyer=s.agents[1];
  resourceStock(s,seller).ironOre=24;resourceStock(s,buyer).ironOre=3;
  const r=bulkResourceTradeAdapter.transfer(s,{fromAgentId:seller.id,toAgentId:buyer.id,itemKind:'ironOre',quantity:7});
  assert.equal(r.ok,true);assert.equal(materialAmount(s,seller,'ironOre'),17);assert.equal(materialAmount(s,buyer,'ironOre'),10);
  const wire=serialize(s);s=restore(wire);
  assert.equal(serialize(s),wire);assert.equal(materialAmount(s,s.agents.find(a=>a.id===seller.id),'ironOre'),17);
});

test('ER0 adapter exposes bounded availability/capacity and rejects unsupported keys read-only',()=>{
  const s=createWorld(230926),seller=s.agents[0],buyer=s.agents[1];
  resourceStock(s,seller).stone=20;resourceStock(s,buyer).stone=998;
  assert.equal(bulkResourceTradeAdapter.availableQuantity(s,{agentId:seller.id,itemKind:'stone'}),20);
  assert.equal(bulkResourceTradeAdapter.capacityRemaining(s,{agentId:buyer.id,itemKind:'stone'}),1);
  assert.equal(bulkResourceTradeAdapter.availableQuantity(s,{agentId:seller.id,itemKind:'NOT_A_RESOURCE'}),null);
  assert.equal(bulkResourceTradeAdapter.capacityRemaining(s,{agentId:buyer.id,itemKind:'NOT_A_RESOURCE'}),null);
  assert.equal(TRADEABLE_MATERIAL_KEYS.includes('food'),true);
  assert.equal(TRADEABLE_MATERIAL_KEYS.includes('steelIngot'),true);
});

test('ER0 insufficient/capacity failures leave resource bytes unchanged',()=>{
  for(const mode of ['insufficient','capacity']){
    const s=createWorld(230926),seller=s.agents[0],buyer=s.agents[1];
    if(mode==='insufficient'){resourceStock(s,seller).wood=2;resourceStock(s,buyer).wood=0;}
    else {resourceStock(s,seller).wood=20;resourceStock(s,buyer).wood=998;}
    const before=serialize(s);
    const r=transferMaterialQuantity(s,{fromAgentId:seller.id,toAgentId:buyer.id,itemKind:'wood',quantity:5});
    assert.equal(r.ok,false,mode);assert.equal(serialize(s),before,mode);
  }
});

test('ER0 same actor and shared resource account cannot trade with itself',()=>{
  const s=createWorld(230926),a=s.agents[0];
  const before=serialize(s);
  assert.equal(transferMaterialQuantity(s,{fromAgentId:a.id,toAgentId:a.id,itemKind:'wood',quantity:1}).ok,false);
  assert.equal(serialize(s),before);
});

test('ER0 resource adapter has no second inventory/wallet/market authority',()=>{
  const material=fs.readFileSync(new URL('../src/material-economy.mjs',import.meta.url),'utf8');
  const adapter=fs.readFileSync(new URL('../src/trade-rust-adapter.mjs',import.meta.url),'utf8');
  for(const source of [material,adapter]){
    assert.doesNotMatch(source,/producerInventory|crafterInventory|merchantMaterials|shopWallet|merchantWallet/);
    assert.doesNotMatch(source,/Math\.random|Date\.now|new Date\(|document\.|window\./);
  }
});
