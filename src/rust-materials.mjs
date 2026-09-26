import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {resourceStock,isIndependent,resourceAccount} from './individual-resources.mjs?v=0.5.0';
import {RUST_PROCESSING_CATALOG,stationAt} from './rust-stations.mjs?v=0.5.0';
export const RUST_MATERIALS_VERSION='RS4-0.2';
export const RUST_MATERIAL_LIMITS=Object.freeze({charcoal:128,orders:12});
export const createRustMaterials=()=>({version:RUST_MATERIALS_VERSION,charcoal:0,nextOrder:1,orders:[]});
const living=(s,id)=>s.agents?.find(a=>a.id===id&&a.alive);
export function queueProcessing(s,{agentId,processId='CHARCOAL',stationId}={}){
  const m=s.rustMaterials,a=living(s,agentId),p=RUST_PROCESSING_CATALOG[processId],st=stationAt(s,stationId);
  if(isIndependent(s)&&a&&!canPerformProductiveWork(s,a))return {ok:false,reason:'stage'};
  if(!m||!a||!p)return {ok:false,reason:'actor-or-process'};
  if(p.live!==true)return {ok:false,reason:'not-authoritative'};
  if(m.orders.some(o=>o.agentId===agentId)||m.orders.length>=RUST_MATERIAL_LIMITS.orders)return {ok:false,reason:'busy-or-capacity'};
  const account=isIndependent(s)?resourceAccount(s,a):null;
  if(!st||!st.complete||st.kind!==p.station||
    isIndependent(s)&&st.placedBy!==a.id&&!(account?.kind==='household'&&st.placedBy===account.ownerId))
    return {ok:false,reason:'station'};
  const stock=resourceStock(s,a);
  const missing={};for(const [k,n] of Object.entries(p.input)){if(!Number.isFinite(stock?.[k])||stock[k]<n)missing[k]=n-(stock?.[k]??0);}
  if(Object.keys(missing).length)return {ok:false,reason:'materials',missing};
  for(const [k,n] of Object.entries(p.input))stock[k]-=n;
  const order={id:m.nextOrder++,agentId,processId,stationId,work:0,required:p.work,startedTick:s.tick,lastWorkedTick:s.tick,reserved:{...p.input}};
  m.orders.push(order);return {ok:true,orderId:order.id,processId,stationId,reserved:{...order.reserved},workRequired:p.work};
}
export function advanceProcessing(s,agentId,{workRate=1}={}){
  const m=s.rustMaterials,a=living(s,agentId),o=m?.orders.find(o=>o.agentId===agentId);
  if(!m||!a||!o)return {ok:false,reason:'order'};
  const p=RUST_PROCESSING_CATALOG[o.processId],st=stationAt(s,o.stationId);
  if(!p?.live||!st||!st.complete||st.kind!==p.station)return {ok:false,reason:'station'};
  if(a.x!==st.x||a.y!==st.y)return {ok:false,reason:'not-at-station'};
  if(s.tick<=o.lastWorkedTick)return {ok:false,reason:'already-worked'};
  if(!Number.isFinite(workRate)||workRate<=0||workRate>1)return {ok:false,reason:'work-rate'};
  o.lastWorkedTick=s.tick;o.work+=workRate;if(o.work<o.required)return {ok:true,completed:false,orderId:o.id,work:o.work,required:o.required};
  if(o.processId==='CHARCOAL'){
    const output=isIndependent(s)?resourceStock(s,a):m;
    if(output.charcoal>=RUST_MATERIAL_LIMITS.charcoal)return {ok:false,reason:'output-capacity'};
    output.charcoal++;
  }
  m.orders=m.orders.filter(x=>x.id!==o.id);return {ok:true,completed:true,orderId:o.id,output:{charcoal:1}};
}
export function releaseRustProcessingOnDeath(s,agentId){
  const m=s.rustMaterials;if(!m)return {ok:false,reason:'state'};
  const cancelled=m.orders.filter(o=>o.agentId===agentId).length;m.orders=m.orders.filter(o=>o.agentId!==agentId);
  return {ok:true,cancelled};
}
