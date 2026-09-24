/** WM4.0 — shadow resource-regeneration migration contract.
 * Captures the existing K6 regeneration behavior exactly and compares it with
 * WM3.4 ecology evidence. It never mutates node.amount.
 */
import {MAP_SIZE} from './worldsim-map.mjs?v=0.5.0';
import {K6_RESOURCE_REGEN} from './worldsim-resource-policy.mjs?v=0.5.0';
import {createResourceEcologyShadow} from './worldsim-resource-shadow.mjs?v=0.5.0';
export {K6_RESOURCE_REGEN};

export const RESOURCE_REGEN_SHADOW_VERSION='wm4.0-shadow-regen-contract-1';
const clamp=n=>Math.max(0,Math.min(1,n));
function nextBoundary(tick,period){
  if(!period)return null;
  const rem=tick%period;
  return tick+(rem===0?period:period-rem);
}

export function createResourceRegenerationShadow(state,resourceShadow=createResourceEcologyShadow(state)){
  const tick=Number.isInteger(state?.tick)?state.tick:0,rows=[];
  for(const node of state.nodes??[]){
    const policy=K6_RESOURCE_REGEN[node.type];if(!policy)continue;
    const shadowCell=resourceShadow.cells[node.y*MAP_SIZE.w+node.x]??null;
    const missing=Math.max(0,node.max-node.amount);
    const boundary=tick>0&&policy.periodTicks!==null&&tick%policy.periodTicks===0;
    const legacyIncrement=boundary?Math.min(policy.amount,missing):0;
    const ecologyPotential=policy.renewable
      ? clamp(shadowCell?.vegetationRegenerationPotential??0)
      : 0;
    rows.push(Object.freeze({
      id:node.id,type:node.type,x:node.x,y:node.y,
      amount:node.amount,max:node.max,missing,
      legacyPeriodTicks:policy.periodTicks,
      legacyAmount:policy.amount,
      boundaryTick:boundary,
      legacyIncrement,
      nextLegacyTick:nextBoundary(tick,policy.periodTicks),
      ecologyRegenerationPotential:+ecologyPotential.toFixed(4),
      authoritativeWriter:'simclone-k6'
    }));
  }
  const byType={};
  for(const type of ['food','wood','stone']){
    const typeRows=rows.filter(r=>r.type===type),policy=K6_RESOURCE_REGEN[type];
    byType[type]=Object.freeze({
      nodes:typeRows.length,
      renewable:policy.renewable,
      periodTicks:policy.periodTicks,
      amount:policy.amount,
      nextLegacyTick:nextBoundary(tick,policy.periodTicks),
      averageEcologyPotential:typeRows.length
        ? +(typeRows.reduce((s,r)=>s+r.ecologyRegenerationPotential,0)/typeRows.length).toFixed(4)
        : 0
    });
  }
  return Object.freeze({
    version:RESOURCE_REGEN_SHADOW_VERSION,
    authority:Object.freeze({mode:'shadow-only',writer:'simclone-k6',worldsimMutation:false}),
    tick,
    policy:K6_RESOURCE_REGEN,
    byType:Object.freeze(byType),
    rows:Object.freeze(rows)
  });
}
