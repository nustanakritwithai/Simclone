import {getBalance,transfer} from './currency-wallet.mjs?v=0.5.0';

export const RC4_TRADE_WALLET_ADAPTER_VERSION='RC4-trade-wallet-adapter-2';

/**
 * Thin transaction-bound facade for PR #177.
 * debit() is validation-only; credit() commits one canonical conserved transfer.
 * No monetary leg can mint or burn trade money in isolation.
 */
export function createTradeWalletAdapter({transactionId,fromAgentId,toAgentId,amount,evidence={}}={}){
  const matches=(agentId,n)=>agentId===fromAgentId&&n===amount;
  return Object.freeze({
    balance:(state,agentId)=>getBalance(state,agentId),
    debit:(state,agentId,n)=>{
      if(!matches(agentId,n))return {ok:false,reason:'trade-debit-contract'};
      const balance=getBalance(state,agentId);
      if(!Number.isSafeInteger(balance)||balance<n)return {ok:false,reason:'insufficient-funds'};
      return {ok:true,validated:true};
    },
    credit:(state,agentId,n)=>{
      if(agentId!==toAgentId||n!==amount)return {ok:false,reason:'trade-credit-contract'};
      return transfer(state,{transactionId,fromAgentId,toAgentId,amount,evidence:{...evidence,operation:'TRADE_TRANSFER'}});
    },
  });
}
