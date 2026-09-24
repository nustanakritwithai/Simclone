/** WM4.3 prep — read-only food regeneration formula lab.
 * This module never mutates nodes. It evaluates a proposed integer 0..3
 * increment against the legacy +3/120 behavior using WM4.2 impact rows.
 */
import {createFoodRegenerationImpact} from './worldsim-food-regen-impact.mjs?v=0.5.0';

export const FOOD_REGEN_FORMULA_LAB_VERSION='wm4.3-food-formula-lab-1';

function validIncrement(value){
  return Number.isInteger(value)&&value>=0&&value<=3;
}

export function evaluateFoodRegenerationFormula(
  state,
  candidate,
  impact=createFoodRegenerationImpact(state)
){
  if(typeof candidate!=='function')throw new Error('Candidate formula must be a function');
  let legacyUnits=0,candidateUnits=0,suppressedUnits=0,changedNodes=0;
  const rows=impact.rows.map(row=>{
    const proposed=candidate(Object.freeze({...row}));
    if(!validIncrement(proposed))throw new Error('Candidate increment must be an integer from 0 to 3');
    const legacy=Math.min(row.legacyAmount,row.missing);
    const bounded=Math.min(proposed,row.missing);
    legacyUnits+=legacy;candidateUnits+=bounded;
    if(bounded!==legacy)changedNodes++;
    if(bounded<legacy)suppressedUnits+=legacy-bounded;
    return Object.freeze({
      id:row.id,
      ecologyRegenerationPotential:row.ecologyRegenerationPotential,
      ecologyBand:row.ecologyBand,
      missing:row.missing,
      legacyIncrement:legacy,
      candidateIncrement:bounded,
      delta:bounded-legacy
    });
  });
  return Object.freeze({
    version:FOOD_REGEN_FORMULA_LAB_VERSION,
    authority:Object.freeze({
      mode:'evaluation-only',
      writer:impact.authority.writer,
      cadenceTicks:impact.legacy.periodTicks,
      mutatesNodes:false
    }),
    summary:Object.freeze({
      nodes:rows.length,
      legacyUnits,
      candidateUnits,
      deltaUnits:candidateUnits-legacyUnits,
      suppressedUnits,
      changedNodes
    }),
    rows:Object.freeze(rows)
  });
}
