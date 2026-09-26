import test from 'node:test';
import assert from 'node:assert/strict';
import {KINGDOM_LABOR_VERSION,LABOR_OFFER_CAP,laborOfferCandidate,kingdomLaborMarketSnapshot} from '../src/kingdom-labor-market.mjs';
import {createWorld,step,serialize,survivalSummary,validate} from '../src/engine.mjs';

test('K4 uses donor shortage threshold and keeps offers bounded',()=>{
  assert.equal(KINGDOM_LABOR_VERSION,'K4-shadow-0.1');
  assert.equal(LABOR_OFFER_CAP,4);
  const production={roles:{woodcutter:{workers:0,ideal:6,laborGap:6}}};
  assert.equal(laborOfferCandidate('woodcutter',{economy:{scarcity:{wood:1.2},premium:{woodcutter:1.1}},production}),null);
  const offer=laborOfferCandidate('woodcutter',{economy:{scarcity:{wood:1.21},premium:{woodcutter:1.2}},production});
  assert.equal(offer.quantityNeeded,3);
  assert.equal(offer.authoritative,false);
});

test('K4 prioritizes zero-worker high-scarcity roles',()=>{
  const economy={scarcity:{wood:3,stone:2},premium:{woodcutter:1.8,miner:1.5,builder:1.25}};
  const production={roles:{
    woodcutter:{workers:0,ideal:6,laborGap:6},
    miner:{workers:2,ideal:6,laborGap:4},
    builder:{workers:1,ideal:5,laborGap:4},
  }};
  const s=kingdomLaborMarketSnapshot({economy,production});
  assert.equal(s.topOffer.role,'woodcutter');
  assert.ok(s.activeCount>=2);
  assert.ok(s.topOffer.priority>s.offers[1].priority);
});

test('K4 includes forager recruitment when household food scarcity is real',()=>{
  const economy={scarcity:{food:6},premium:{forager:1.8}};
  const production={roles:{forager:{workers:0,ideal:8,laborGap:8}}};
  const offer=laborOfferCandidate('forager',{economy,production});
  assert.ok(offer);
  assert.equal(offer.role,'forager');
  assert.equal(offer.good,'food');
  assert.equal(offer.quantityNeeded,3);
  assert.equal(offer.authoritative,false);
});

test('survival summary exposes K4 proposals without mutating the world',()=>{
  const s=createWorld(42);s.stock.wood=0;s.stock.stone=0;
  const before=serialize(s),v=survivalSummary(s);
  assert.equal(v.kingdomLabor.version,KINGDOM_LABOR_VERSION);
  assert.equal(v.kingdomLabor.mode,'shadow');
  assert.equal(serialize(s),before);
});

test('observing K4 every tick cannot alter deterministic execution',()=>{
  const a=createWorld(444),b=createWorld(444);
  for(let i=0;i<720;i++){survivalSummary(a);step(a);step(b);}
  assert.equal(serialize(a),serialize(b));
  assert.deepEqual(validate(a),[]);
});
