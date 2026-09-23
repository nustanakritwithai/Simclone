import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore,SKILLS,lifeStage,LIFE_STAGES} from '../src/engine.mjs';
import {BIRTH_RULES,birthPlan,isAutonomousChild,autonomousChildrenOf} from '../src/reproduction.mjs';
import {RULES,stockTargets} from '../src/survival.mjs';

const ready=(seed=230926)=>{
  const s=createWorld(seed);s.stock={food:100,wood:100,stone:100};s.tick=359;
  for(const a of s.agents){a.satiety=100;a.energy=100;a.task=null;}
  return s;
};

test('birth reserve raises food target enough to pay cost and preserve next population target',()=>{
  const s=createWorld();assert.equal(stockTargets(s).food,36);
  const plan=birthPlan(s,36);assert.equal(plan.ok,true);assert.equal(plan.nextFoodTarget,28);assert.equal(plan.requiredFood,36);
});

test('autonomous birth creates age-zero child, preserves lineage and charges exactly once',()=>{
  const s=ready(),p=s.agents[0],skills={...p.skills};const before={food:s.stock.food,wood:s.stock.wood,cloned:s.stats.cloned};
  step(s);const child=s.agents.at(-1);
  assert.equal(s.agents.length,7);assert.equal(isAutonomousChild(child),true);assert.equal(child.parentId,p.id);assert.equal(child.generation,p.generation+1);
  assert.equal(lifeStage(s,child),LIFE_STAGES.CHILD);assert.equal(child.life.ageAtAnchorYears,0);assert.equal(child.bornTick,360);
  for(const k of SKILLS)assert.equal(child.skills[k],Math.floor(skills[k]*.35));
  assert.equal(s.stock.food,before.food-BIRTH_RULES.foodCost);assert.equal(s.stock.wood,before.wood-BIRTH_RULES.woodCost);
  assert.equal(s.stats.cloned,before.cloned);assert.ok(s.events.some(e=>e.agentId===child.id&&e.type==='birth'&&e.text.includes('เกิดจาก')));
});

test('reserved meal is not spendable by autonomous birth',()=>{
  const s=ready(),a=s.agents[0];s.stock.food=36;
  a.x=11;a.y=12;a.task={policy:RULES.jobPolicy,kind:'EAT',targetId:1,x:11,y:12,path:[],work:0,score:100,started:s.tick};
  step(s);assert.equal(s.agents.length,6);assert.equal(s.stock.food,36);
});

test('housing, food and wood safety gates prevent free population growth',()=>{
  const housing=ready();housing.buildings=housing.buildings.slice(0,1);step(housing);assert.equal(housing.agents.length,6);
  const food=ready();food.stock.food=35;step(food);assert.equal(food.agents.length,6);
  const wood=ready();wood.stock.wood=BIRTH_RULES.woodCost+BIRTH_RULES.woodSafetyFloor-1;step(wood);assert.equal(wood.agents.length,6);
});

test('global birth gap spreads cohorts four years apart and parent cooldown rotates parents',()=>{
  const s=ready();step(s);assert.equal(s.agents.filter(isAutonomousChild).length,1);
  step(s,3*360);assert.equal(s.agents.filter(isAutonomousChild).length,1);
  s.stock.food=100;s.stock.wood=100;step(s,360);
  const born=s.agents.filter(isAutonomousChild);assert.equal(born.length,2);
  assert.equal(born[1].bornTick-born[0].bornTick,4*360);assert.notEqual(born[0].parentId,born[1].parentId);
  assert.equal(autonomousChildrenOf(s,born[0].parentId).length,1);
});

test('housing cap prevents explosion even with abundant resources',()=>{
  const s=ready();step(s);
  for(let year=0;year<24;year++){s.stock.food=999;s.stock.wood=999;step(s,360);}
  assert.equal(s.agents.filter(a=>a.alive).length,12);assert.equal(s.agents.filter(isAutonomousChild).length,6);
  const ticks=s.agents.filter(isAutonomousChild).map(a=>a.bornTick);
  for(let i=1;i<ticks.length;i++)assert.ok(ticks[i]-ticks[i-1]>=4*360);
});

test('autonomous birth save/restore continuation is deterministic',()=>{
  const a=ready(42);step(a,900);const b=restore(serialize(a));step(a,2000);step(b,2000);assert.equal(serialize(a),serialize(b));
});
