/** WM4.4 prep — reproducible food ecology reference evidence.
 * This is analysis-only. It creates fresh deterministic worlds and never
 * mutates a user's save or authoritative runtime.
 */
import {createWorld} from '../src/engine.mjs';
import {createFoodRegenerationImpact} from '../src/worldsim-food-regen-impact.mjs';
import {calibrateFoodEcology} from '../src/worldsim-food-regen-calibration.mjs';

export const FOOD_ECOLOGY_REFERENCE_SEEDS=Object.freeze([230926,1,42,2026,90001]);
export const FOOD_ECOLOGY_REFERENCE_TICKS=Object.freeze([120,240,360,480,600,720]);

export function buildFoodEcologyReference(){
  const rows=[];
  for(const seed of FOOD_ECOLOGY_REFERENCE_SEEDS)for(const tick of FOOD_ECOLOGY_REFERENCE_TICKS){
    const state=createWorld(seed);state.tick=tick;
    const impact=createFoodRegenerationImpact(state);
    const calibration=calibrateFoodEcology(state,impact);
    rows.push(Object.freeze({
      seed,tick,
      nodes:impact.summary.nodes,
      average:impact.summary.averageEcologyPotential,
      rawMin:calibration.summary.rawMin,
      p10:calibration.summary.rawP10,
      p50:calibration.summary.rawP50,
      p90:calibration.summary.rawP90,
      rawMax:calibration.summary.rawMax,
      relativeBands:calibration.summary.relativeBands
    }));
  }
  return Object.freeze({
    seeds:FOOD_ECOLOGY_REFERENCE_SEEDS,
    ticks:FOOD_ECOLOGY_REFERENCE_TICKS,
    rows:Object.freeze(rows)
  });
}

if(import.meta.url===`file://${process.argv[1]}`){
  process.stdout.write(JSON.stringify(buildFoodEcologyReference(),null,2)+'\n');
}
