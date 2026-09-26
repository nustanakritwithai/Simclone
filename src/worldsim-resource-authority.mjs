import {MAP_SIZE} from './worldsim-map.mjs?v=0.5.0';
import {createResourceEcologyShadow} from './worldsim-resource-shadow.mjs?v=0.5.0';
import {K6_RESOURCE_REGEN} from './worldsim-resource-policy.mjs?v=0.5.0';

/** WM4.7 — single WorldSim resource-regeneration authority.
 * Food and wood retain the WM4.5/WM4.6 ecology formulas, then apply a
 * depletion-derived harvest-pressure gate. Stone remains finite.
 *
 * Harvest pressure is derived from the existing node amount/max only. It adds
 * no second resource ledger, no wall-clock state and no extra writer.
 *
 * foodMode/woodMode='legacy' exist only for deterministic A/B verification.
 * If woodMode is omitted it follows foodMode, so engine resourceRegenerationMode
 * selects both policies without a second writer.
 */
export const RESOURCE_REGEN_AUTHORITY_VERSION='wm4.7-harvest-pressure-1';
export const FOOD_ECOLOGY_POLICY=Object.freeze({
  id:'wm4.5-conservative-v1',
  periodTicks:K6_RESOURCE_REGEN.food.periodTicks,
  maxIncrement:K6_RESOURCE_REGEN.food.amount,
  thresholds:Object.freeze({zeroBelow:.003,oneBelow:.01,twoBelow:.025})
});
export const WOOD_ECOLOGY_POLICY=Object.freeze({
  id:'wm4.6-conservative-v1',
  periodTicks:K6_RESOURCE_REGEN.wood.periodTicks,
  maxIncrement:K6_RESOURCE_REGEN.wood.amount,
  thresholds:Object.freeze({zeroBelow:.08})
});
export const HARVEST_PRESSURE_POLICY=Object.freeze({
  id:'wm4.7-depletion-pressure-v1',
  mediumAt:.50,
  highAt:.85,
  highPressureModulo:2
});
export const RESOURCE_REGEN_AUTHORITY=Object.freeze({
  writer:'worldsim-wm4.7',
  behavior:'ecology-food-wood-harvest-pressure-v1',
  food:K6_RESOURCE_REGEN.food,
  foodPolicy:FOOD_ECOLOGY_POLICY,
  wood:K6_RESOURCE_REGEN.wood,
  woodPolicy:WOOD_ECOLOGY_POLICY,
  harvestPressurePolicy:HARVEST_PRESSURE_POLICY,
  stone:K6_RESOURCE_REGEN.stone
});

const ECOLOGY_CACHE_LIMIT=64;
const ecologyCache=new Map();

function ecologySignature(state){
  const phase=((state.tick%360)+360)%360;
  const tiles=(state.tiles??[]).join(',');
  const nodes=(state.nodes??[]).map(n=>`${n.id}:${n.type}:${n.x}:${n.y}`).join(';');
  const buildings=(state.buildings??[]).map(b=>`${b.id}:${b.type}:${b.x}:${b.y}:${b.complete===false?0:1}`).join(';');
  return `${state.seed}|${phase}|${tiles}|${nodes}|${buildings}`;
}

function cachedEcologyPotentials(state){
  const key=ecologySignature(state);
  if(ecologyCache.has(key)){
    const value=ecologyCache.get(key);
    ecologyCache.delete(key);ecologyCache.set(key,value);
    return value;
  }
  const ecology=createResourceEcologyShadow(state);
  const potentials=Object.freeze({
    width:ecology.width,
    food:Object.freeze(ecology.cells.map(c=>c.vegetationRegenerationPotential)),
    wood:Object.freeze(ecology.cells.map(c=>c.woodYieldPotential))
  });
  if(ecologyCache.size>=ECOLOGY_CACHE_LIMIT)ecologyCache.delete(ecologyCache.keys().next().value);
  ecologyCache.set(key,potentials);
  return potentials;
}

export function harvestPressure(node){
  if(!node||typeof node.amount!=='number'||!Number.isFinite(node.amount)||
    typeof node.max!=='number'||!Number.isFinite(node.max)||node.max<=0||
    node.amount<0||node.amount>node.max)throw new Error('Invalid resource node pressure input');
  return +Math.max(0,Math.min(1,1-node.amount/node.max)).toFixed(4);
}

export function harvestPressureAdjustedIncrement(baseIncrement,pressure,{nodeId=0,epoch=0}={}){
  if(!Number.isSafeInteger(baseIncrement)||baseIncrement<0)throw new Error('Invalid base regeneration increment');
  if(typeof pressure!=='number'||!Number.isFinite(pressure)||pressure<0||pressure>1)
    throw new Error('Invalid harvest pressure');
  if(!Number.isSafeInteger(nodeId)||!Number.isSafeInteger(epoch))throw new Error('Invalid harvest pressure gate key');
  if(baseIncrement===0||pressure<HARVEST_PRESSURE_POLICY.mediumAt)return baseIncrement;
  if(pressure<HARVEST_PRESSURE_POLICY.highAt)return Math.max(1,baseIncrement-1);
  if(baseIncrement>1)return baseIncrement-1;
  return ((epoch+nodeId)%HARVEST_PRESSURE_POLICY.highPressureModulo)===0?1:0;
}

export function foodEcologyIncrement(potential){
  if(typeof potential!=='number'||!Number.isFinite(potential)||potential<0||potential>1)
    throw new Error('Invalid food ecology potential');
  if(potential<FOOD_ECOLOGY_POLICY.thresholds.zeroBelow)return 0;
  if(potential<FOOD_ECOLOGY_POLICY.thresholds.oneBelow)return 1;
  if(potential<FOOD_ECOLOGY_POLICY.thresholds.twoBelow)return 2;
  return 3;
}

export function woodEcologyIncrement(potential){
  if(typeof potential!=='number'||!Number.isFinite(potential)||potential<0||potential>1)
    throw new Error('Invalid wood ecology potential');
  if(potential<WOOD_ECOLOGY_POLICY.thresholds.zeroBelow)return 0;
  return 1;
}

export function applyWorldResourceRegeneration(state,options={}){
  const foodMode=options.foodMode??'ecology';
  const woodMode=options.woodMode??foodMode;
  const tick=state?.tick;
  if(!Number.isInteger(tick)||!Array.isArray(state?.nodes))throw new Error('Invalid resource regeneration state');
  if(!['ecology','legacy'].includes(foodMode))throw new Error('Invalid food regeneration mode');
  if(!['ecology','legacy'].includes(woodMode))throw new Error('Invalid wood regeneration mode');
  let added=0;
  if(tick===0)return 0;

  const foodDue=tick%RESOURCE_REGEN_AUTHORITY.food.periodTicks===0;
  const woodDue=tick%RESOURCE_REGEN_AUTHORITY.wood.periodTicks===0;
  if(!foodDue&&!woodDue)return 0;
  // Ecology potentials are expensive; compute them only on a regeneration boundary.
  const needEcology=(foodDue&&foodMode==='ecology')||(woodDue&&woodMode==='ecology');
  const potentials=needEcology?cachedEcologyPotentials(state):null;

  // Preserve the historical write order: food first, then wood.
  if(foodDue){
    for(const node of state.nodes)if(node.type==='food'){
      const before=node.amount;
      const potential=potentials?.food[node.y*potentials.width+node.x]??0;
      const baseIncrement=foodMode==='legacy'
        ? RESOURCE_REGEN_AUTHORITY.food.amount
        : foodEcologyIncrement(potential);
      const increment=foodMode==='legacy'
        ? baseIncrement
        : harvestPressureAdjustedIncrement(baseIncrement,harvestPressure(node),{
            nodeId:node.id,epoch:Math.floor(tick/RESOURCE_REGEN_AUTHORITY.food.periodTicks)
          });
      node.amount=Math.min(node.max,node.amount+increment);
      added+=node.amount-before;
    }
  }
  if(woodDue){
    for(const node of state.nodes)if(node.type==='wood'){
      const before=node.amount;
      const potential=potentials?.wood[node.y*potentials.width+node.x]??0;
      const baseIncrement=woodMode==='legacy'
        ? RESOURCE_REGEN_AUTHORITY.wood.amount
        : woodEcologyIncrement(potential);
      const increment=woodMode==='legacy'
        ? baseIncrement
        : harvestPressureAdjustedIncrement(baseIncrement,harvestPressure(node),{
            nodeId:node.id,epoch:Math.floor(tick/RESOURCE_REGEN_AUTHORITY.wood.periodTicks)
          });
      node.amount=Math.min(node.max,node.amount+increment);
      added+=node.amount-before;
    }
  }
  return added;
}
