import {tradableRustItemIds,transferRustItemInstances} from './rust-possessions.mjs?v=0.5.0';
import {materialAmount,materialCapacity,TRADEABLE_MATERIAL_KEYS,transferMaterialQuantity} from './material-economy.mjs?v=0.5.0';

export const RUST_TRADE_ADAPTER_VERSION='RC4-rust-items-1';

/**
 * Adapter only. Item ownership/mutation remains inside rust-possessions.mjs,
 * the existing Rust Item Authority.
 */
export const rustTradeItemAdapter=Object.freeze({
  tradableItemIds:(state,{agentId,itemKind}={})=>tradableRustItemIds(state,{agentId,itemKind}),
  transfer:(state,{fromAgentId,toAgentId,itemIds}={})=>transferRustItemInstances(state,{fromAgentId,toAgentId,itemIds}),
});


export const BULK_RESOURCE_TRADE_ADAPTER_VERSION='ER0-bulk-resource-adapter/1';
const living=(state,id)=>state?.agents?.find(a=>a.id===id&&a.alive)??null;
/** Adapter only. Bulk quantity mutation remains inside material-economy.mjs. */
export const bulkResourceTradeAdapter=Object.freeze({
  supports:itemKind=>TRADEABLE_MATERIAL_KEYS.includes(itemKind),
  availableQuantity:(state,{agentId,itemKind}={})=>{
    const a=living(state,agentId);if(!a||!TRADEABLE_MATERIAL_KEYS.includes(itemKind))return null;
    const n=materialAmount(state,a,itemKind);return Number.isSafeInteger(n)&&n>=0?n:null;
  },
  capacityRemaining:(state,{agentId,itemKind}={})=>{
    const a=living(state,agentId),limit=materialCapacity(itemKind);if(!a||limit===null)return null;
    const n=materialAmount(state,a,itemKind);return Number.isSafeInteger(n)&&n>=0?Math.max(0,limit-n):null;
  },
  transfer:(state,{fromAgentId,toAgentId,itemKind,quantity}={})=>transferMaterialQuantity(state,{fromAgentId,toAgentId,itemKind,quantity}),
});
