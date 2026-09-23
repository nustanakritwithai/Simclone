/** Autonomous Birth 0.3.4 — deterministic pacing avoids synchronized generation collapse. */
import {LIFE,LIFE_STAGES,lifeStage} from './lifecycle.mjs';

export const BIRTH_RULES=Object.freeze({
  foodCost:8,
  woodCost:4,
  woodSafetyFloor:12,
  globalIntervalYears:4,
  parentCooldownYears:4,
  maxPopulation:36,
  maxAgents:200,
});

export const isAutonomousChild=a=>a?.parentId!==null&&a?.life?.ageAtAnchorYears===0;

const living=s=>s.agents.filter(a=>a.alive);
const capacity=s=>s.buildings.filter(b=>b.complete).length*6;
const autoChildren=s=>s.agents.filter(isAutonomousChild);
const lastTick=items=>items.length?Math.max(...items.map(a=>a.bornTick)):-Infinity;

export function autonomousChildrenOf(s,parentId){
  return autoChildren(s).filter(a=>a.parentId===parentId);
}

export function eligibleBirthParents(s){
  const cooldown=BIRTH_RULES.parentCooldownYears*LIFE.ticksPerYear;
  return living(s).filter(a=>lifeStage(s,a)===LIFE_STAGES.ADULT).filter(a=>{
    const children=autonomousChildrenOf(s,a.id);
    return !children.length||s.tick-lastTick(children)>=cooldown;
  }).sort((a,b)=>{
    const ac=autonomousChildrenOf(s,a.id),bc=autonomousChildrenOf(s,b.id);
    const al=lastTick(ac),bl=lastTick(bc);
    return ac.length-bc.length||al-bl||a.id-b.id;
  });
}

/** Food reserve that lets the colony pay birth cost and still hold the next population's food target. */
export function autonomousBirthFoodTarget(s){
  const pop=living(s).length,cap=Math.min(BIRTH_RULES.maxPopulation,capacity(s));
  if(pop>=cap||s.agents.length>=BIRTH_RULES.maxAgents)return 0;
  if(!living(s).some(a=>lifeStage(s,a)===LIFE_STAGES.ADULT))return 0;
  return BIRTH_RULES.foodCost+Math.max(24,(pop+1)*4);
}

export function birthPlan(s,freeFood){
  const pop=living(s).length,cap=Math.min(BIRTH_RULES.maxPopulation,capacity(s));
  const base={population:pop,capacity:cap,freeFood,foodCost:BIRTH_RULES.foodCost,woodCost:BIRTH_RULES.woodCost,
    woodSafetyFloor:BIRTH_RULES.woodSafetyFloor,nextFoodTarget:Math.max(24,(pop+1)*4)};
  if(pop>=cap)return {...base,ok:false,reason:'housing'};
  if(s.agents.length>=BIRTH_RULES.maxAgents)return {...base,ok:false,reason:'history'};
  const last=lastTick(autoChildren(s)),interval=BIRTH_RULES.globalIntervalYears*LIFE.ticksPerYear;
  if(Number.isFinite(last)&&s.tick-last<interval)return {...base,ok:false,reason:'pace',lastBirthTick:last};
  const parents=eligibleBirthParents(s);
  if(!parents.length)return {...base,ok:false,reason:'parent'};
  const requiredFood=BIRTH_RULES.foodCost+base.nextFoodTarget;
  if(freeFood<requiredFood)return {...base,ok:false,reason:'food',requiredFood};
  const requiredWood=BIRTH_RULES.woodCost+BIRTH_RULES.woodSafetyFloor;
  if(s.stock.wood<requiredWood)return {...base,ok:false,reason:'wood',requiredWood};
  return {...base,ok:true,reason:'ready',parentId:parents[0].id,requiredFood,requiredWood};
}
