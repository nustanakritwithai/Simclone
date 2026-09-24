/** WM4.2 — read-only food regeneration ecology impact report.
 * Measures the current WM3.4 regeneration evidence before any ecology-based
 * unit formula is proposed. No node amount is mutated and no new rate is invented.
 */
import {createResourceRegenerationShadow} from './worldsim-resource-regen-shadow.mjs?v=0.5.0';

export const FOOD_REGEN_IMPACT_VERSION='wm4.2-food-impact-1';

const quantile=(sorted,q)=>{
  if(!sorted.length)return 0;
  const pos=(sorted.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);
  if(lo===hi)return sorted[lo];
  const t=pos-lo;return sorted[lo]*(1-t)+sorted[hi]*t;
};
const r4=n=>+n.toFixed(4);

export function createFoodRegenerationImpact(state,regen=createResourceRegenerationShadow(state)){
  const rows=regen.rows.filter(r=>r.type==='food').map(r=>Object.freeze({
    id:r.id,x:r.x,y:r.y,amount:r.amount,max:r.max,missing:r.missing,
    ecologyPotential:r.ecologyRegenerationPotential,
    legacyAmount:r.legacyAmount,
    legacyPeriodTicks:r.legacyPeriodTicks
  }));
  const values=rows.map(r=>r.ecologyPotential).sort((a,b)=>a-b);
  const stats=Object.freeze({
    count:rows.length,
    min:r4(values[0]??0),
    p25:r4(quantile(values,.25)),
    median:r4(quantile(values,.5)),
    p75:r4(quantile(values,.75)),
    max:r4(values.at(-1)??0),
    average:r4(values.length?values.reduce((s,v)=>s+v,0)/values.length:0),
    depletedNodes:rows.filter(r=>r.missing>0).length,
    emptyNodes:rows.filter(r=>r.amount===0).length
  });
  const classified=rows.map(r=>Object.freeze({
    ...r,
    relativeClass:r.ecologyPotential<stats.p25?'low':
      r.ecologyPotential>stats.p75?'high':'middle'
  }));
  return Object.freeze({
    version:FOOD_REGEN_IMPACT_VERSION,
    authority:Object.freeze({mode:'analysis-only',writer:'simclone-k6',formula:'not-defined'}),
    legacyPolicy:regen.policy.food,
    stats,
    rows:Object.freeze(classified)
  });
}
