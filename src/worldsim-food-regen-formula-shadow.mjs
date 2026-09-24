/** WM4.3 — candidate food-regeneration formula, shadow only.
 * Converts normalized WM3.4 ecology evidence into a bounded integer proposal.
 * It never mutates node.amount and is not used by the authoritative writer.
 */
import {createFoodRegenerationImpact} from './worldsim-food-regen-impact.mjs?v=0.5.0';

export const FOOD_REGEN_FORMULA_SHADOW_VERSION='wm4.3-food-formula-shadow-1';

/**
 * Conservative first candidate around the legacy +3 boundary:
 * very-low ecology -> 0
 * low ecology      -> 1
 * medium ecology   -> 2
 * high ecology     -> 3
 *
 * This never exceeds legacy +3 and deliberately cannot boost abundance yet.
 */
export function candidateFoodIncrement(ecologyPotential,missing){
  const p=Math.max(0,Math.min(1,Number(ecologyPotential)||0));
  const room=Math.max(0,Math.floor(Number(missing)||0));
  const proposed=p<.25?0:p<.5?1:p<.75?2:3;
  return Math.min(proposed,room);
}

export function createFoodFormulaShadow(state,impact=createFoodRegenerationImpact(state)){
  const rows=impact.rows.map(r=>{
    const candidateIncrement=candidateFoodIncrement(r.ecologyRegenerationPotential,r.missing);
    const projectedLegacyIncrement=Math.min(r.legacyAmount,r.missing);
    return Object.freeze({
      id:r.id,x:r.x,y:r.y,missing:r.missing,
      ecologyRegenerationPotential:r.ecologyRegenerationPotential,
      ecologyBand:r.ecologyBand,
      legacyIncrementAtBoundary:projectedLegacyIncrement,
      candidateIncrement,
      deltaFromLegacy:candidateIncrement-projectedLegacyIncrement
    });
  });
  let legacyUnits=0,candidateUnits=0,reducedNodes=0,zeroNodes=0;
  for(const r of rows){
    legacyUnits+=r.legacyIncrementAtBoundary;candidateUnits+=r.candidateIncrement;
    if(r.candidateIncrement<r.legacyIncrementAtBoundary)reducedNodes++;
    if(r.candidateIncrement===0&&r.missing>0)zeroNodes++;
  }
  return Object.freeze({
    version:FOOD_REGEN_FORMULA_SHADOW_VERSION,
    authority:Object.freeze({
      mode:'shadow-only',
      authoritativeWriter:impact.authority.writer,
      candidateFormula:'banded-0-1-2-3',
      mutation:false
    }),
    legacy:impact.legacy,
    summary:Object.freeze({
      nodes:rows.length,
      legacyBoundaryUnits:legacyUnits,
      candidateBoundaryUnits:candidateUnits,
      unitDelta:candidateUnits-legacyUnits,
      reductionRatio:legacyUnits?+((legacyUnits-candidateUnits)/legacyUnits).toFixed(4):0,
      reducedNodes,
      zeroNodes
    }),
    rows:Object.freeze(rows)
  });
}
