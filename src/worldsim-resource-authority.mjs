import {K6_RESOURCE_REGEN} from './worldsim-resource-policy.mjs?v=0.5.0';

/** WM4.1 — authoritative resource-regeneration parity gate.
 * Ownership moves to WorldSim while behavior stays byte-for-byte equivalent
 * to the previous K6 inline schedule. No ecology multiplier is active here.
 */
export const RESOURCE_REGEN_AUTHORITY_VERSION='wm4.1-regen-parity-1';
export const RESOURCE_REGEN_AUTHORITY=Object.freeze({
  writer:'worldsim-wm4.1',
  behavior:'k6-parity',
  food:K6_RESOURCE_REGEN.food,
  wood:K6_RESOURCE_REGEN.wood,
  stone:K6_RESOURCE_REGEN.stone
});

export function applyWorldResourceRegeneration(state){
  const tick=state?.tick;
  if(!Number.isInteger(tick)||!Array.isArray(state?.nodes))throw new Error('Invalid resource regeneration state');
  let added=0;
  if(tick===0)return 0;
  // Preserve the exact historical write order: food first, then wood.
  if(tick%RESOURCE_REGEN_AUTHORITY.food.periodTicks===0){
    for(const node of state.nodes)if(node.type==='food'){
      const before=node.amount;
      node.amount=Math.min(node.max,node.amount+RESOURCE_REGEN_AUTHORITY.food.amount);
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
