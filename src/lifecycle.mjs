/** Lifecycle 0.3.3: deterministic age/stage, work capability and derived lifespan helpers. */
export const LIFE = Object.freeze({
  ticksPerYear: 360,
  yearsPerSimDay: 1,
  childUntil: 16,
  elderFrom: 55,
  legacyAdultAge: 18,
  plannedAgeDeathMin: 78,
  plannedAgeDeathMax: 92,
  elderWorkRate: 0.75,
});

export const LIFE_STAGES = Object.freeze({
  CHILD:'CHILD',
  ADULT:'ADULT',
  ELDER:'ELDER',
  DEAD:'DEAD',
});

export function ageYears(state,agent){
  if(!agent?.life||!Number.isInteger(agent.life.anchorTick)||!Number.isInteger(agent.life.ageAtAnchorYears))return null;
  const elapsedTicks=Math.max(0,state.tick-agent.life.anchorTick);
  return Math.max(0,agent.life.ageAtAnchorYears+Math.floor(elapsedTicks/LIFE.ticksPerYear)*LIFE.yearsPerSimDay);
}

export function lifeStage(state,agent){
  if(!agent?.alive)return LIFE_STAGES.DEAD;
  const age=ageYears(state,agent);
  if(age===null)return null;
  if(age<LIFE.childUntil)return LIFE_STAGES.CHILD;
  if(age<LIFE.elderFrom)return LIFE_STAGES.ADULT;
  return LIFE_STAGES.ELDER;
}

export const adultLife=(anchorTick,age=LIFE.legacyAdultAge)=>({anchorTick,ageAtAnchorYears:age});
export const childLife=anchorTick=>({anchorTick,ageAtAnchorYears:0});

export function canPerformProductiveWork(state,agent){
  const stage=lifeStage(state,agent);
  return stage===LIFE_STAGES.ADULT||stage===LIFE_STAGES.ELDER;
}

export function productiveWorkRate(state,agent){
  const stage=lifeStage(state,agent);
  if(stage===LIFE_STAGES.ADULT)return 1;
  if(stage===LIFE_STAGES.ELDER)return LIFE.elderWorkRate;
  return 0;
}

export function lifespanYears(state,agent){
  if(!state||!agent||!Number.isInteger(state.seed)||!Number.isInteger(agent.id)||!Number.isInteger(agent.generation))return null;
  let x=((state.seed>>>0)^Math.imul(agent.id,0x9e3779b1)^Math.imul(agent.generation+1,0x85ebca6b))>>>0;
  x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);x^=x>>>16;
  const span=LIFE.plannedAgeDeathMax-LIFE.plannedAgeDeathMin+1;
  return LIFE.plannedAgeDeathMin+((x>>>0)%span);
}

export function shouldDieOfAge(state,agent){
  const age=ageYears(state,agent),limit=lifespanYears(state,agent);
  return !!agent?.alive&&age!==null&&limit!==null&&age>=limit;
}
