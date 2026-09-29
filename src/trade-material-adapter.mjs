/** Thin adapter from canonical Trade Kernel to existing material/resource authority. */
import {materialAmount,consumeMaterialSet,addMaterialSet} from './material-economy.mjs?v=0.5.0';
import {sameResourceAccount} from './individual-resources.mjs?v=0.5.0';
import {validBulkTradeResourceKey} from './trade-assets.mjs?v=0.5.0';

export const BULK_TRADE_RESOURCE_ADAPTER_VERSION='ER0-bulk-resource-adapter/1';
const living=(s,id)=>s?.agents?.find(a=>a?.id===id&&a.alive===true)??null;

export const bulkTradeResourceAdapter=Object.freeze({
  tradableQuantity:(state,{agentId,itemKind}={})=>{
    const a=living(state,agentId);
    if(!a||!validBulkTradeResourceKey(itemKind))return null;
    const n=materialAmount(state,a,itemKind);
    return Number.isFinite(n)&&n>=0?Math.floor(n):null;
  },
  transfer:(state,{fromAgentId,toAgentId,itemKind,quantity}={})=>{
    const from=living(state,fromAgentId),to=living(state,toAgentId);
    if(!from||!to||fromAgentId===toAgentId||!validBulkTradeResourceKey(itemKind)||
      !Number.isSafeInteger(quantity)||quantity<1)return {ok:false,reason:'bulk-transfer-input'};
    if(sameResourceAccount(state,from,to))return {ok:false,reason:'same-resource-account'};
    if(materialAmount(state,from,itemKind)<quantity)return {ok:false,reason:'seller-resource'};
    const spent=consumeMaterialSet(state,from,{[itemKind]:quantity});
    if(!spent.ok)return spent;
    const added=addMaterialSet(state,to,{[itemKind]:quantity});
    if(!added.ok)return added;
    return {ok:true,fromAgentId,toAgentId,itemKind,quantity};
  }
});
