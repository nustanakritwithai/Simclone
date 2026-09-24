/** Kingdom Sandbox economy extraction K2.
 * Read-only shadow settlement economics: demand, scarcity, labor premium and specialization.
 * No prices, money, trade, mutation, clocks or Math.random.
 */
export const KINGDOM_ECONOMY_VERSION='K2-shadow-0.1';

const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const ACTION_TO_PROFESSION=Object.freeze({
  FORAGE:'forager',WOODCUT:'woodcutter',MINE:'miner',BUILD:'builder'
});
export const ECONOMY_PROFESSIONS=Object.freeze(['forager','woodcutter','miner','builder']);

export function inferredProfession(agent){
  if(ECONOMY_PROFESSIONS.includes(agent?.profession))return agent.profession;
  return ACTION_TO_PROFESSION[agent?.preference]??null;
}

/** Adapt Kingdom's village demand formula to Simclone goods (ore -> stone). */
export function kingdomVillageDemand(population){
  const pop=Math.max(0,Number(population)||0);
  return {
    food:Math.round(pop*2),
    wood:Math.round(pop*0.5+5),
    stone:Math.round(pop*0.25+4),
  };
}

export function kingdomScarcityRatio(stock,demand,good){
  const have=Math.max(0,Number(stock?.[good]??0));
  const need=Math.max(0,Number(demand?.[good]??0));
  if(need===0)return 0.25;
  return +clamp(need/Math.max(have,1),0.25,6).toFixed(3);
}

/** Kingdom Phase 19.1 target before damping: 1 + (scarcity - 1) * 0.5, capped at 1.8. */
export function kingdomLaborPremium(scarcityRatio){
  return +clamp(1+(Number(scarcityRatio)-1)*0.5,1,1.8).toFixed(3);
}

export function specializationSnapshot(agents=[]){
  const counts={forager:0,woodcutter:0,miner:0,builder:0};
  for(const a of agents){
    if(!a?.alive)continue;
    const p=inferredProfession(a);
    if(p)counts[p]++;
  }
  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  const shares=Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,total?+(v/total).toFixed(3):0]));
  const ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  return {
    counts,shares,total,
    dominant:ranked[0]?.[1]>0?ranked[0][0]:null,
    diversity:Object.values(counts).filter(v=>v>0).length,
  };
}

export function kingdomEconomySnapshot({agents=[],stock={},unfinished=0}={}){
  const living=agents.filter(a=>a?.alive);
  const demand=kingdomVillageDemand(living.length);
  const scarcity={
    food:kingdomScarcityRatio(stock,demand,'food'),
    wood:kingdomScarcityRatio(stock,demand,'wood'),
    stone:kingdomScarcityRatio(stock,demand,'stone'),
  };
  const premium={
    forager:kingdomLaborPremium(scarcity.food),
    woodcutter:kingdomLaborPremium(scarcity.wood),
    miner:kingdomLaborPremium(scarcity.stone),
    builder:Number(unfinished)>0?1.25:1,
  };
  const specialization=specializationSnapshot(living);
  const pressure=[
    {profession:'forager',good:'food',scarcity:scarcity.food,premium:premium.forager,count:specialization.counts.forager},
    {profession:'woodcutter',good:'wood',scarcity:scarcity.wood,premium:premium.woodcutter,count:specialization.counts.woodcutter},
    {profession:'miner',good:'stone',scarcity:scarcity.stone,premium:premium.miner,count:specialization.counts.miner},
    {profession:'builder',good:'building',scarcity:Number(unfinished)>0?1.5:0.25,premium:premium.builder,count:specialization.counts.builder},
  ].sort((a,b)=>b.premium-a.premium||b.scarcity-a.scarcity||a.profession.localeCompare(b.profession));
  return {
    version:KINGDOM_ECONOMY_VERSION,
    mode:'shadow',
    population:living.length,
    demand,scarcity,premium,specialization,
    topPressure:pressure[0],
    missingCritical:pressure.filter(x=>x.premium>1.1&&x.count===0).map(x=>x.profession),
  };
}
