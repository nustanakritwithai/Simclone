import test from 'node:test';
import assert from 'node:assert/strict';
import {
  professionForAction,professionLabel,deterministicUtilityJitter,scarcityPremium,
  kingdomWorkFactors,adoptProfession
} from '../src/kingdom-utility.mjs';
import {createWorld,step,serialize,validate} from '../src/engine.mjs';

test('Kingdom worker professions map to Simclone productive actions',()=>{
  assert.equal(professionForAction('FORAGE'),'forager');
  assert.equal(professionForAction('WOODCUT'),'woodcutter');
  assert.equal(professionForAction('MINE'),'miner');
  assert.equal(professionForAction('BUILD'),'builder');
  assert.equal(professionLabel('miner'),'คนขุดหิน');
});

test('Kingdom random utility variation is replaced by bounded deterministic jitter',()=>{
  const a=deterministicUtilityJitter(42,7,99,'WOODCUT');
  assert.equal(a,deterministicUtilityJitter(42,7,99,'WOODCUT'));
  assert.ok(a>=-4&&a<=4);
  const values=new Set(Array.from({length:12},(_,i)=>deterministicUtilityJitter(42,7,99+i,'WOODCUT')));
  assert.ok(values.size>1);
});

test('scarcity pressure rises as projected communal stock falls',()=>{
  const targets={food:30,wood:30,stone:20};
  assert.equal(scarcityPremium({wood:30},targets,'wood'),0);
  assert.ok(scarcityPremium({wood:10},targets,'wood')>scarcityPremium({wood:20},targets,'wood'));
  assert.equal(scarcityPremium({wood:0},targets,'wood'),45);
});

test('profession continuity bonus is explicit and careers stay bounded',()=>{
  const agent={id:3,preference:'FORAGE',skills:{FORAGE:60,WOODCUT:60,MINE:60,BUILD:60},profession:'forager',career:[{tick:0,profession:'forager'}]};
  const forage=kingdomWorkFactors({seed:1,tick:10,agent,kind:'FORAGE',resourceType:'food',projected:{food:10},targets:{food:30}});
  const mine=kingdomWorkFactors({seed:1,tick:10,agent,kind:'MINE',resourceType:'stone',projected:{stone:10},targets:{stone:20}});
  assert.equal(forage.profession,8);
  assert.equal(mine.profession,0);
  for(let i=0;i<12;i++)adoptProfession(agent,['WOODCUT','MINE','BUILD','FORAGE'][i%4],20+i);
  assert.ok(agent.career.length<=8);
});

test('engine records Kingdom utility as shadow evidence without changing authoritative score math',()=>{
  const s=createWorld(230926);step(s,1);
  for(const a of s.agents){
    for(const c of a.trace){
      assert.equal(c.score,Object.values(c.factors).reduce((sum,v)=>sum+v,0));
      if(['FORAGE','WOODCUT','MINE','BUILD'].includes(c.kind)){
        assert.equal(typeof c.kingdomUtility?.scarcity,'number');
        assert.equal(typeof c.kingdomUtility?.profession,'number');
        assert.equal(typeof c.kingdomUtility?.utilityJitter,'number');
      }
    }
  }
  assert.deepEqual(validate(s),[]);
});

test('selected productive work updates profession but shadow utility does not own task validation',()=>{
  const s=createWorld(77),a=s.agents[0];
  a.preference='WOODCUT';a.profession='forager';s.stock.food=999;s.stock.stone=999;s.stock.wood=0;
  step(s,1);
  const chosen=a.trace.find(c=>c.status==='selected');
  assert.equal(chosen.kind,'WOODCUT');
  assert.equal(a.profession,'woodcutter');
  assert.ok(a.career.some(c=>c.profession==='woodcutter'));
  assert.deepEqual(validate(s),[]);
});

test('Kingdom shadow layer keeps same-seed execution deterministic',()=>{
  const a=createWorld(9191),b=createWorld(9191);
  step(a,720);for(let i=0;i<720;i++)step(b);
  assert.equal(serialize(a),serialize(b));
  assert.deepEqual(validate(a),[]);
});
