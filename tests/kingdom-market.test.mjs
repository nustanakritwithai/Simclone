import test from 'node:test';
import assert from 'node:assert/strict';
import {KINGDOM_MARKET_VERSION,SHADOW_BASE_PRICE,shadowPrice,kingdomMarketSnapshot} from '../src/kingdom-market.mjs';
import {createWorld,step,serialize,survivalSummary,validate} from '../src/engine.mjs';

test('K6 uses Kingdom base prices adapted to Simclone stone',()=>{
  assert.equal(KINGDOM_MARKET_VERSION,'K6-shadow-0.1');
  assert.deepEqual(SHADOW_BASE_PRICE,{food:10,wood:8,stone:15});
  assert.equal(shadowPrice('food',1),10);
  assert.equal(shadowPrice('wood',1),8);
  assert.equal(shadowPrice('stone',1),15);
});

test('K6 price curve rises with scarcity and respects donor caps',()=>{
  assert.ok(shadowPrice('food',2)>shadowPrice('food',1));
  assert.equal(shadowPrice('food',0),3.54);
  assert.equal(shadowPrice('food',999),60);
});

test('K6 keeps optional danger/tax modifiers pure and bounded',()=>{
  const base=shadowPrice('wood',1),risk=shadowPrice('wood',1,{danger:1,tax:1});
  assert.ok(risk>base);
  assert.ok(risk<=SHADOW_BASE_PRICE.wood*6);
});

test('K6 market snapshot identifies the hottest scarce good',()=>{
  const m=kingdomMarketSnapshot({economy:{scarcity:{food:1,wood:4,stone:2}}});
  assert.equal(m.mode,'shadow');
  assert.equal(m.hottestGood,'wood');
  assert.ok(m.hottestIndex>m.index.stone);
});

test('survival summary exposes K6 prices without mutating world',()=>{
  const s=createWorld(42),before=serialize(s),v=survivalSummary(s);
  assert.equal(v.kingdomMarket.version,KINGDOM_MARKET_VERSION);
  assert.equal(serialize(s),before);
  v.kingdomMarket.prices.food=999;
  assert.equal(serialize(s),before);
});

test('continuous K6 observation does not change deterministic execution',()=>{
  const a=createWorld(606),b=createWorld(606);
  for(let i=0;i<720;i++){survivalSummary(a);step(a);step(b);}
  assert.equal(serialize(a),serialize(b));
  assert.deepEqual(validate(a),[]);
});
