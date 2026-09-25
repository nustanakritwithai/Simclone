/** WM4.4 — reproducible food ecology reference evidence.
 * Analysis-only. Fresh deterministic worlds are observed as-is for raw ecology
 * evidence, then a separate controlled-depletion copy gives Formula Lab actual
 * missing capacity to compare candidate increments. No runtime save or writer
 * is mutated.
 */
import {createWorld} from '../src/engine.mjs';
import {createFoodRegenerationImpact} from '../src/worldsim-food-regen-impact.mjs';
import {calibrateFoodEcology} from '../src/worldsim-food-regen-calibration.mjs';
import {evaluateFoodRegenerationFormula} from '../src/worldsim-food-regen-formula-lab.mjs';

export const FOOD_ECOLOGY_REFERENCE_SEEDS=Object.freeze([230926,1,42,2026,90001]);
export const FOOD_ECOLOGY_REFERENCE_TICKS=Object.freeze([120,240,360,480,600,720]);
export const FOOD_REFERENCE_MISSING_UNITS=3;
export const FOOD_FORMULA_CANDIDATES=Object.freeze({
  conservative:potential=>potential<.003?0:potential<.01?1:potential<.025?2:3,
  balanced:potential=>potential<.005?0:potential<.015?1:potential<.035?2:3,
  strong:potential=>potential<.01?0:potential<.025?1:potential<.05?2:3,
});

function controlledDepletion(seed,tick){
  const state=createWorld(seed);state.tick=tick;
  for(const node of state.nodes)if(node.type==='food')
    node.amount=Math.max(0,node.max-FOOD_REFERENCE_MISSING_UNITS);
  return state;
}

export function buildFoodEcologyReference(){
  const rows=[];
  for(const seed of FOOD_ECOLOGY_REFERENCE_SEEDS)for(const tick of FOOD_ECOLOGY_REFERENCE_TICKS){
    const observed=createWorld(seed);observed.tick=tick;
    const impact=createFoodRegenerationImpact(observed);
    const calibration=calibrateFoodEcology(observed,impact);

    // Formula comparison is intentionally separated from the untouched
    // observation world. Otherwise fresh nodes are full and every bounded
    // formula produces zero units, which proves nothing about severity.
    const scenario=controlledDepletion(seed,tick);
    const scenarioImpact=createFoodRegenerationImpact(scenario);
    const formulas=Object.fromEntries(Object.entries(FOOD_FORMULA_CANDIDATES).map(([name,formula])=>{
      const result=evaluateFoodRegenerationFormula(scenario,row=>formula(row.ecologyRegenerationPotential),scenarioImpact);
      return [name,result.summary];
    }));

    rows.push(Object.freeze({
      seed,tick,
      nodes:impact.summary.nodes,
      average:impact.summary.averageEcologyPotential,
      rawMin:calibration.summary.rawMin,
      p10:calibration.summary.rawP10,
      p50:calibration.summary.rawP50,
      p90:calibration.summary.rawP90,
      rawMax:calibration.summary.rawMax,
      relativeBands:calibration.summary.relativeBands,
      formulaScenario:Object.freeze({missingUnitsPerFoodNode:FOOD_REFERENCE_MISSING_UNITS}),
      formulas:Object.freeze(formulas)
    }));
  }
  return Object.freeze({
    seeds:FOOD_ECOLOGY_REFERENCE_SEEDS,
    ticks:FOOD_ECOLOGY_REFERENCE_TICKS,
    formulaScenario:Object.freeze({missingUnitsPerFoodNode:FOOD_REFERENCE_MISSING_UNITS}),
    rows:Object.freeze(rows)
  });
}

if(import.meta.url===`file://${process.argv[1]}`)
  process.stdout.write(JSON.stringify(buildFoodEcologyReference(),null,2)+'\n');
