import {getBalance,applyTradeDebit,applyTradeCredit} from './currency-wallet.mjs?v=0.5.0';

export const RC4_TRADE_WALLET_ADAPTER_VERSION='RC4-trade-wallet-adapter-1';

/** Thin facade for PR #177. The canonical writer remains currency-wallet.mjs. */
export function createTradeWalletAdapter({transactionId,evidence={}}={}){
  return Object.freeze({
    balance:(state,agentId)=>getBalance(state,agentId),
    debit:(state,agentId,amount)=>applyTradeDebit(state,{transactionId,agentId,amount,evidence}),
    credit:(state,agentId,amount)=>applyTradeCredit(state,{transactionId,agentId,amount,evidence}),
  });
}
