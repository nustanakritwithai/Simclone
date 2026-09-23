import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,step,command,serialize,restore,VERSION,SAVE_VERSION,DAY_TICKS,
  LIFE,LIFE_STAGES,ageYears,lifeStage,childLife,adultLife,canPerformProductiveWork,productiveWorkRate} from '../src/engine.mjs';
import {createWorld as legacyWorld,step as legacyStep,serialize as legacySerialize} from './fixtures/legacy-engine-0.1.0.mjs';

test('lifecycle clock is simulated and one day equals one biological year',()=>{
  assert.equal(VERSION,'0.3.2');assert.equal(SAVE_VERSION,'0.2.0');
  assert.equal(DAY_TICKS,360);assert.equal(LIFE.ticksPerYear,360);assert.equal(LIFE.yearsPerSimDay,1);
  const source=readFileSync(new URL('../src/lifecycle.mjs',import.meta.url),'utf8');
  assert.equal(source.includes('Date.'),false);assert.equal(source.includes('Math.random'),false);
});

test('new world and manual clone retain adult semantics at lifecycle adoption',()=>{
  const s=createWorld(9);
  assert.ok(s.agents.every(a=>ageYears(s,a)===18&&lifeStage(s,a)===LIFE_STAGES.ADULT));
  s.stock.food=999;s.stock.wood=999;
  const r=command(s,'CLONE',{parentId:1}),a=s.agents.at(-1);
  assert.equal(r.ok,true);assert.equal(ageYears(s,a),18);assert.equal(lifeStage(s,a),LIFE_STAGES.ADULT);
});

test('child adult elder boundaries are deterministic from simulation tick',()=>{
  const s=createWorld(2),a=s.agents[0];a.life=childLife(0);
  s.tick=15*DAY_TICKS;assert.equal(ageYears(s,a),15);assert.equal(lifeStage(s,a),LIFE_STAGES.CHILD);
  s.tick=16*DAY_TICKS;assert.equal(ageYears(s,a),16);assert.equal(lifeStage(s,a),LIFE_STAGES.ADULT);
  s.tick=54*DAY_TICKS;assert.equal(lifeStage(s,a),LIFE_STAGES.ADULT);
  s.tick=55*DAY_TICKS;assert.equal(ageYears(s,a),55);assert.equal(lifeStage(s,a),LIFE_STAGES.ELDER);
  a.alive=false;assert.equal(lifeStage(s,a),LIFE_STAGES.DEAD);
});

test('legacy 0.1.0 save migrates explicitly and starts lifecycle clock at adult age 18',()=>{
  const old=legacyWorld(230926);legacyStep(old,87);const original=legacySerialize(old),s=restore(original);
  assert.equal(s.version,SAVE_VERSION);assert.notEqual(serialize(s),original);
  assert.ok(s.agents.every(a=>a.life.anchorTick===87&&ageYears(s,a)===18&&lifeStage(s,a)===LIFE_STAGES.ADULT));
  assert.deepEqual(s.agents.map(a=>[a.id,a.parentId,a.generation,a.appearance,a.skills]),
    old.agents.map(a=>[a.id,a.parentId,a.generation,a.appearance,a.skills]));
});

test('current lifecycle save round-trips and continuation stays deterministic',()=>{
  const a=createWorld(42);step(a,777);const b=restore(serialize(a));
  assert.equal(serialize(a),serialize(b));
  step(a,1234);step(b,1234);assert.equal(serialize(a),serialize(b));
});

test('stage capability and elder work rate are deterministic',()=>{
  const s=createWorld(11),a=s.agents[0];
  a.life=childLife(s.tick);
  assert.equal(canPerformProductiveWork(s,a),false);assert.equal(productiveWorkRate(s,a),0);
  a.life=adultLife(s.tick,30);
  assert.equal(canPerformProductiveWork(s,a),true);assert.equal(productiveWorkRate(s,a),1);
  a.life=adultLife(s.tick,60);
  assert.equal(canPerformProductiveWork(s,a),true);assert.equal(productiveWorkRate(s,a),0.75);
  a.alive=false;
  assert.equal(canPerformProductiveWork(s,a),false);assert.equal(productiveWorkRate(s,a),0);
});
