import {MAP_SIZE} from './worldsim-map.mjs?v=0.5.0';
import {createResourceEcologyShadow} from './worldsim-resource-shadow.mjs?v=0.5.0';
import {K6_RESOURCE_REGEN} from './worldsim-resource-policy.mjs?v=0.5.0';

/** WM4.5 — single WorldSim resource-regeneration authority.
 * Food now uses the conservative absolute-threshold ecology formula selected
 * from WM4.4 evidence. Wood remains K6 parity and stone remains finite.
 *
 * foodMode='legacy' exists only for deterministic A/B verification. The game
 * engine calls the default ecology mode and there is still only one writer.
 */
export const RESOURCE_REGEN_AUTHORITY_VERSION='wm4.5-food-ecology-1';
export const FOOD_ECOLOGY_POLICY=Object.freeze({
  id:'wm4.5-conservative-v1',
  periodTicks:K6_RESOURCE_REGEN.food.periodTicks,
  maxIncrement:K6_RESOURCE_REGEN.food.amount,
  thresholds:Object.freeze({zeroBelow:.003,oneBelow:.01,twoBelow:.025})
});
export const RESOURCE_REGEN_AUTHORITY=Object.freeze({
  writer:'worldsim-wm4.5',
  behavior:'ecology-food-v1',
  food:K6_RESOURCE_REGEN.food,
  foodPolicy:FOOD_ECOLOGY_POLICY,
  wood:K6_RESOURCE_REGEN.wood,
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
  const potentials=Object.freeze(ecology.cells.map(c=>c.vegetationRegenerationPotential));
  if(ecologyCache.size>=ECOLOGY_CACHE_LIMIT)ecologyCache.delete(ecologyCache.keys().next().value);
  ecologyCache.set(key,potentials);
  return potentials;
}

export function foodEcologyIncrement(potential){
  if(typeof potential!=='number'||!Number.isFinite(potential)||potential<0||potential>1)
    throw new Error('Invalid food ecology potential');
  if(potential<FOOD_ECOLOGY_POLICY.thresholds.zeroBelow)return 0;
  if(potential<FOOD_ECOLOGY_POLICY.thresholds.oneBelow)return 1;
  if(potential<FOOD_ECOLOGY_POLICY.thresholds.twoBelow)return 2;
  return 3;
}

export function applyWorldResourceRegeneration(state,{foodMode='ecology'}={}){
  const tick=state?.tick;
  if(!Number.isInteger(tick)||!Array.isArray(state?.nodes))throw new Error('Invalid resource regeneration state');
  if(!['ecology','legacy'].includes(foodMode))throw new Error('Invalid food regeneration mode');
  let added=0;
  if(tick===0)return 0;

  // Preserve the historical write order: food first, then wood.
  if(tick%RESOURCE_REGEN_AUTHORITY.food.periodTicks===0){
    const potentials=foodMode==='ecology'?cachedEcologyPotentials(state):null;
    for(const node of state.nodes)if(node.type==='food'){
      const before=node.amount;
      const potential=potentials?.[node.y*MAP_SIZE.w+node.x]??0;
      const increment=foodMode==='legacy'
        ? RESOURCE_REGEN_AUTHORITY.food.amount
        : foodEcologyIncrement(potential);
      node.amount=Math.min(node.max,node.amount+increment);
      added+=node.amount-before;
    }
  }
  if(tick%RESOURCE_REGEN_AUTHORITY.wood.periodTicks===0){
    for(const node of state.nodes)if(node.type==='wood'){
      const before=node.amount;
      node.amount=Math.min(node.max,node.amount+RESOURCE_REGEN_AUTHORITY.wood.amount);
      added+=node.amount-before;
    }
  }
  return added;
}
