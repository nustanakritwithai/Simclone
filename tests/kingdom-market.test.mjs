import test from 'node:test';
import assert from 'node:assert/strict';
import {KINGDOM_MARKET_VERSION,BASE_PRICE,kingdomShadowPrice,kingdomMarketSnapshot} from '../src/kingdom-market.mjs';
import {createWorld,step,serialize,survivalSummary,validate} from '../src/engine.mjs';

test('K5 preserves donor base prices for Simclone core goods',()=>{
  assert.equal(KINGDOM_MARKET_VERSION,'K5-shadow-0.1');
  assert.deepEqual(BASE_PRICE,{food:10,wood:8,stone:15});
});

test('K5 price rises monotonically with scarcity and remains donor-bounded',()=>{
  const low=kingdomShadowPrice('wood',0.25),normal=kingdomShadowPrice('wood',1),high=kingdomShadowPrice('wood',6);
  assert.ok(low<normal&&normal<high);
  assert.ok(low>=BASE_PRICE.wood*0.3);
  assert.ok(high<=BASE_PRICE.wood*6);
});

test('food alone receives settlement crowding modifier',()=>{
  assert.ok(kingdomShadowPrice('food',1,{housingRatio:1})>kingdomShadowPrice('food',1,{housingRatio:0.8}));
  assert.equal(kingdomShadowPrice('wood',1,{housingRatio:1}),kingdomShadowPrice('wood',1,{housingRatio:0.8}));
});

test('K5 market snapshot identifies the most scarcity-inflated good',()=>{
  const m=kingdomMarketSnapshot({
    economy:{scarcity:{food:1,wood:5,stone:2}},
    production:{housingRatio:1}
  });
  assert.equal(m.mode,'shadow');
  assert.equal(m.hottest.good,'wood');
  assert.ok(m.normalized.wood>m.normalized.stone);
});

test('survival summary exposes market projection without world mutation',()=>{
  const s=createWorld(42);s.stock.wood=1;
  const before=serialize(s),v=survivalSummary(s);
  assert.equal(v.kingdomMarket.version,KINGDOM_MARKET_VERSION);
  assert.equal(serialize(s),before);
});

test('continuous K5 observation cannot change deterministic execution',()=>{
  const a=createWorld(555),b=createWorld(555);
  for(let i=0;i<720;i++){survivalSummary(a);step(a);step(b);}
  assert.equal(serialize(a),serialize(b));
  assert.deepEqual(validate(a),[]);
});
