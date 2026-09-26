import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,step,birthPlan,validate} from '../src/engine.mjs';
import {materialTotals,materialStock,resourceStock} from '../src/individual-resources.mjs';

test('IC6C closeout: Independent central stock is zero-only compatibility state, not the material authority',()=>{
  const s=createWorld(230926,{mode:'independent'});
  assert.deepEqual(s.stock,{food:0,wood:0,stone:0});
  assert.deepEqual(materialTotals(s),{food:28,wood:24,stone:12});
  assert.notStrictEqual(resourceStock(s,s.agents[0]),s.stock);
  assert.deepEqual(validate(s),[]);
});

test('IC6C closeout: Independent birth plan ignores central-stock and external free-food values',()=>{
  const a=createWorld(230926,{mode:'independent'}),b=createWorld(230926,{mode:'independent'});
  a.tick=b.tick=360;
  Object.assign(materialStock(a,a.agents[0]),{food:60,wood:30});
  Object.assign(materialStock(b,b.agents[0]),{food:60,wood:30});
  b.stock.food=999;b.stock.wood=999;
  const pa=birthPlan(a,0),pb=birthPlan(b,999999);
  assert.deepEqual(pb,pa);
  assert.equal(pa.ok,true);
  assert.ok(validate(b).includes('Independent world stock must be empty'));
});

test('IC6C closeout: Independent day event reports derived aggregate food, never zero placeholder food',()=>{
  const s=createWorld(230926,{mode:'independent',population:1}),a=s.agents[0];
  Object.assign(materialStock(s,a),{food:37,wood:0,stone:0});
  a.satiety=100;a.energy=100;a.task={kind:'IDLE',targetId:null,x:a.x,y:a.y,path:[],work:0,score:0,started:s.tick,policy:'survival-0.2'};
  s.tick=359;step(s,1);
  const total=materialTotals(s,{livingOnly:true}).food;
  const dayEvent=[...s.events].reverse().find(e=>e.type==='day');
  assert.ok(dayEvent);
  assert.ok(dayEvent.text.includes('อาหารรวม '+total),dayEvent.text);
  assert.equal(s.stock.food,0);
});

test('IC6C closeout: legacy mode still owns spendable s.stock authority',()=>{
  const s=createWorld(230926);
  assert.equal(s.stock.food,28);assert.equal(s.stock.wood,24);assert.equal(s.stock.stone,12);
  assert.strictEqual(resourceStock(s,s.agents[0]),s.stock);
  assert.deepEqual(validate(s),[]);
});

test('IC6C closeout: app HUD uses resourceStock for a selected Independent clone',()=>{
  const source=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
  assert.ok(source.includes("selectedAgent?resourceStock(state,selectedAgent):materialTotals(state,{livingOnly:true})"));
  assert.equal(source.includes('selectedAgent?materialStock(state,selectedAgent)'),false);
});
