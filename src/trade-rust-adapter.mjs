import {tradableRustItemIds,transferRustItemInstances} from './rust-possessions.mjs?v=0.5.0';

export const RUST_TRADE_ADAPTER_VERSION='RC4-rust-items-1';

/**
 * Adapter only. Item ownership/mutation remains inside rust-possessions.mjs,
 * the existing Rust Item Authority.
 */
export const rustTradeItemAdapter=Object.freeze({
  tradableItemIds:(state,{agentId,itemKind}={})=>tradableRustItemIds(state,{agentId,itemKind}),
  transfer:(state,{fromAgentId,toAgentId,itemIds}={})=>transferRustItemInstances(state,{fromAgentId,toAgentId,itemIds}),
});
