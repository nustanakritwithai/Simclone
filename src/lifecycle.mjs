/** Lifecycle 0.3.1: deterministic simulated age/stage and stage capability helpers. */
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
