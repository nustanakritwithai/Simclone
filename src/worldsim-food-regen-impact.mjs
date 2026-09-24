/** WM4.2 — read-only food-regeneration impact report.
 * No candidate unit mutation is proposed here. The report only measures how
 * WM3.4 ecology evidence is distributed across the legacy +3/120 food nodes.
 */
import {createResourceRegenerationShadow} from './worldsim-resource-regen-shadow.mjs?v=0.5.0';

export const FOOD_REGEN_IMPACT_VERSION='wm4.2-food-impact-1';
const bucket=p=>p<.25?'very-low':p<.5?'low':p<.75?'medium':'high';

export function createFoodRegenerationImpact(state,regen=createResourceRegenerationShadow(state)){
  const rows=regen.rows.filter(r=>r.type==='food').map(r=>Object.freeze({
    id:r.id,x:r.x,y:r.y,amount:r.amount,max:r.max,missing:r.missing,
    legacyPeriodTicks:r.legacyPeriodTicks,legacyAmount:r.legacyAmount,
    legacyIncrement:r.legacyIncrement,
    ecologyRegenerationPotential:r.ecologyRegenerationPotential,
    ecologyBand:bucket(r.ecologyRegenerationPotential),
    authoritativeWriter:r.authoritativeWriter
  }));
  const counts={'very-low':0,low:0,medium:0,high:0};
  let potential=0,missing=0,depletedNodes=0,lowPotentialDepletedNodes=0;
  for(const r of rows){
    counts[r.ecologyBand]++;potential+=r.ecologyRegenerationPotential;missing+=r.missing;
    if(r.missing>0){depletedNodes++;if(r.ecologyRegenerationPotential<.5)lowPotentialDepletedNodes++;}
  }
  const sorted=[...rows].sort((a,b)=>b.ecologyRegenerationPotential-a.ecologyRegenerationPotential||a.id-b.id);
  const asc=[...rows].sort((a,b)=>a.ecologyRegenerationPotential-b.ecologyRegenerationPotential||a.id-b.id);
  const percentile=p=>asc.length?asc[Math.min(asc.length-1,Math.max(0,Math.floor((asc.length-1)*p)))].ecologyRegenerationPotential:0;
  return Object.freeze({
    version:FOOD_REGEN_IMPACT_VERSION,
    authority:Object.freeze({mode:'shadow-only',writer:regen.authority.writer,unitFormula:'none'}),
    legacy:Object.freeze({periodTicks:120,amount:3}),
    summary:Object.freeze({
      nodes:rows.length,
      averageEcologyPotential:rows.length?+(potential/rows.length).toFixed(4):0,
      totalMissing:missing,
      depletedNodes,
      lowPotentialDepletedNodes,
      p10:+percentile(.10).toFixed(4),
      p50:+percentile(.50).toFixed(4),
      p90:+percentile(.90).toFixed(4),
      bands:Object.freeze(counts)
    }),
    highest:Object.freeze(sorted.slice(0,8)),
    lowest:Object.freeze(sorted.slice(-8)),
    rows:Object.freeze(rows)
  });
}
