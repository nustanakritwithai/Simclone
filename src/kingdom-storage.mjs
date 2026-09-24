/** Kingdom Sandbox storage/spoilage extraction K6.
 * Read-only projection of donor village storage and food decay rules.
 * No stock mutation or building ownership is introduced here.
 */
export const KINGDOM_STORAGE_VERSION='K6-shadow-0.1';
export const STORAGE_BUILDINGS=Object.freeze({
  Granary:{foodCapMultiplier:1.8,foodDecay:0.004},
  Warehouse:{materialCapMultiplier:1.8},
});
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

export function kingdomStorageCaps({granary=false,warehouse=false}={}){
  const villageBase=400;
  return {
    food:villageBase*(granary?1.8:1),
    wood:villageBase*0.5*(warehouse?1.8:1),
    stone:villageBase*0.5*(warehouse?1.8:1),
  };
}

export function kingdomFoodDecayRate({granary=false}={}){
  return granary?STORAGE_BUILDINGS.Granary.foodDecay:0.012;
}

export function kingdomStorageSnapshot({stock={},granary=false,warehouse=false}={}){
  const caps=kingdomStorageCaps({granary,warehouse});
  const decayRate=kingdomFoodDecayRate({granary});
  const projectedFoodAfterDecay=Math.max(0,(Number(stock.food)||0)*(1-decayRate));
  const overflow={
    food:Math.max(0,(Number(stock.food)||0)-caps.food),
    wood:Math.max(0,(Number(stock.wood)||0)-caps.wood),
    stone:Math.max(0,(Number(stock.stone)||0)-caps.stone),
  };
  const utilization={
    food:+clamp((Number(stock.food)||0)/Math.max(caps.food,1),0,9).toFixed(3),
    wood:+clamp((Number(stock.wood)||0)/Math.max(caps.wood,1),0,9).toFixed(3),
    stone:+clamp((Number(stock.stone)||0)/Math.max(caps.stone,1),0,9).toFixed(3),
  };
  const pressure=Object.entries(utilization).map(([good,ratio])=>({
    good,ratio,overflow:overflow[good],nearFull:ratio>=0.8
  })).sort((a,b)=>b.ratio-a.ratio||a.good.localeCompare(b.good));
  return {
    version:KINGDOM_STORAGE_VERSION,
    mode:'shadow',
    buildings:{granary,warehouse},
    caps,decayRate,
    projectedFoodDecay:+((Number(stock.food)||0)-projectedFoodAfterDecay).toFixed(3),
    projectedFoodAfterDecay:+projectedFoodAfterDecay.toFixed(3),
    overflow,utilization,
    topPressure:pressure[0]??null,
    needsGranary:utilization.food>=0.8&&!granary,
    needsWarehouse:(utilization.wood>=0.8||utilization.stone>=0.8)&&!warehouse,
  };
}
