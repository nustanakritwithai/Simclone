/** WM4.3 prep — read-only food ecology calibration.
 * Converts raw WM3.4 regeneration potentials into deterministic relative ranks.
 * This does not select or apply a gameplay regeneration formula.
 */
import {createFoodRegenerationImpact} from './worldsim-food-regen-impact.mjs?v=0.5.0';

export const FOOD_ECOLOGY_CALIBRATION_VERSION='wm4.3-food-ecology-calibration-1';

const bandForRank=rank=>rank<.25?'q1':rank<.5?'q2':rank<.75?'q3':'q4';

export function calibrateFoodEcology(
  state,
  impact=createFoodRegenerationImpact(state)
){
  const sorted=[...impact.rows].sort((a,b)=>
    a.ecologyRegenerationPotential-b.ecologyRegenerationPotential||a.id-b.id
  );
  const rankById=new Map();
  for(let i=0;i<sorted.length;){
    let j=i+1;
    while(j<sorted.length&&sorted[j].ecologyRegenerationPotential===sorted[i].ecologyRegenerationPotential)j++;
    const midpoint=sorted.length<=1?.5:((i+j-1)/2)/(sorted.length-1);
    for(let k=i;k<j;k++)rankById.set(sorted[k].id,midpoint);
    i=j;
  }
  const counts={q1:0,q2:0,q3:0,q4:0};
  const rows=impact.rows.map(row=>{
    const relativeRank=rankById.get(row.id)??.5,relativeBand=bandForRank(relativeRank);
    counts[relativeBand]++;
    return Object.freeze({
      id:row.id,x:row.x,y:row.y,
      rawPotential:row.ecologyRegenerationPotential,
      relativeRank:+relativeRank.toFixed(4),
      relativeBand,
      missing:row.missing,
      legacyIncrement:row.legacyIncrement
    });
  });
  return Object.freeze({
    version:FOOD_ECOLOGY_CALIBRATION_VERSION,
    authority:Object.freeze({
      mode:'calibration-only',
      writer:impact.authority.writer,
      mutatesNodes:false,
      unitFormula:'none'
    }),
    summary:Object.freeze({
      nodes:rows.length,
      rawMin:sorted[0]?.ecologyRegenerationPotential??0,
      rawMax:sorted.at(-1)?.ecologyRegenerationPotential??0,
      rawP10:impact.summary.p10,
      rawP50:impact.summary.p50,
      rawP90:impact.summary.p90,
      relativeBands:Object.freeze(counts)
    }),
    rows:Object.freeze(rows)
  });
}
