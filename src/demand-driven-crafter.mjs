/** ER3 Demand-driven Crafter policy.
 * Read-only intent generation only. Actor-observed ER1 demand may select a
 * canonical CRAFT_ITEM request, but this module owns no item/material/money/
 * market/profession/task/recipe/quality writes.
 */
import {projectActorObservedDemand} from './economic-demand.mjs?v=0.5.0';
import {
  ER3_CRAFTER_DEMAND_VERSION,crafterProductionPlanFromProjection
} from './crafter-production-plan.mjs?v=0.5.0';

export {ER3_CRAFTER_DEMAND_VERSION};

export function demandDrivenCrafterSnapshot(s,a,{allowCanonicalMarketTravel=false,allowGenericExplore=false}={}){
  // Material-demand projection is disabled here to avoid feeding another
  // Crafter's procurement need back into the product-selection pass.
  const projection=projectActorObservedDemand(s,a,{includeCrafterMaterialDemand:false,includeResourceShortages:false});
  return crafterProductionPlanFromProjection(s,a,projection,{allowCanonicalMarketTravel,allowGenericExplore});
}

export function demandDrivenCrafterIntent(s,a){
  const snap=demandDrivenCrafterSnapshot(s,a);
  return snap.status==='READY_CRAFT'?snap.intent:null;
}
