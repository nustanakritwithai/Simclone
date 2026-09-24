import {CRAFT_STATIONS,RECIPE_CATALOG} from './crafting-catalog.mjs';
import {RUST_PROCESSING_CATALOG,stationAt} from './rust-stations.mjs';

export const RUST_MATERIALS_VERSION='RS4-0.1';
export const RUST_MATERIAL_LIMITS=Object.freeze({charcoal:128,orders:12});

const living=(s,id)=>s.agents?.find(a=>a.id===id&&a.alive===true);
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

export function createRustMaterials(){
  return {version:RUST_MATERIALS_VERSION,charcoal:0,nextOrder:1,orders:[]};
}

export function reservedProcessingMaterials(s){
  const total={wood:0,stone:0};
  for(const o of s.rustMaterials?.orders??[]){
    const p=RUST_PROCESSING_CATALOG[o.processId];
    if(!p||p.live!==true)continue;
    for(const [k,n] of Object.entries(p.input))if(k in total)total[k]+=n;
  }
  return total;
}
function reservedToolMaterials(s){
  const total={wood:0,stone:0};
  for(const o of s.rustPossessions?.orders??[]){
    const r=RECIPE_CATALOG[o.recipe];if(!r)continue;
    for(const [k,n] of Object.entries(r.materials??{}))if(k in total)total[k]+=n;
  }
  return total;
}

export function queueProcessing(s,{agentId,processId,stationId}={}){
  const a=living(s,agentId),m=s.rustMaterials,p=RUST_PROCESSING_CATALOG[processId];
  if(!a||!m||!p)return {ok:false,reason:'actor-or-process'};
  if(p.live!==true)return {ok:false,reason:'not-authoritative',detail:p.reason};
  if(m.orders.length>=RUST_MATERIAL_LIMITS.orders||m.orders.some(o=>o.agentId===agentId))return {ok:false,reason:'busy-or-capacity'};
  const st=stationAt(s,stationId);
  if(!st||!st.complete||st.kind!==p.station)return {ok:false,reason:'station'};
  const reserved=reservedProcessingMaterials(s),tools=reservedToolMaterials(s);
  const missing={};
  for(const [k,n] of Object.entries(p.input)){
    if(!(k in (s.stock??{})))return {ok:false,reason:'unsupported-input',material:k};
    const free=s.stock[k]-(reserved[k]??0)-(tools[k]??0);
    if(free<n)missing[k]=n-free;
  }
  if(Object.keys(missing).length)return {ok:false,reason:'materials',missing};
  const order={id:m.nextOrder++,agentId,processId,stationId,work:0,startedTick:s.tick,lastWorkedTick:s.tick};
  m.orders.push(order);
  return {ok:true,orderId:order.id,processId,stationId,input:{...p.input},workRequired:p.work};
}

export function advanceProcessing(s,agentId,{workRate=1}={}){
  const a=living(s,agentId),m=s.rustMaterials,o=m?.orders.find(o=>o.agentId===agentId);
  if(!a||!m||!o)return {ok:false,reason:'order'};
  const p=RUST_PROCESSING_CATALOG[o.processId],st=stationAt(s,o.stationId);
  if(!p||p.live!==true)return {ok:false,reason:'process'};
  if(!st||!st.complete||st.kind!==p.station)return {ok:false,reason:'station'};
  if(dist(a,st)!==0)return {ok:false,reason:'not-at-station'};
  if(s.tick<=o.lastWorkedTick)return {ok:false,reason:'already-worked'};
  if(typeof workRate!=='number'||!Number.isFinite(workRate)||workRate<=0||workRate>1)return {ok:false,reason:'work-rate'};
  o.lastWorkedTick=s.tick;o.work+=workRate;
  if(o.work<p.work)return {ok:true,completed:false,orderId:o.id,work:o.work};
  const reserved=reservedProcessingMaterials(s);
  for(const [k,n] of Object.entries(p.input)){
    if((s.stock[k]??0)<n)return {ok:false,reason:'materials'};
  }
  if(o.processId==='CHARCOAL'&&m.charcoal+1>RUST_MATERIAL_LIMITS.charcoal)return {ok:false,reason:'output-capacity'};
  for(const [k,n] of Object.entries(p.input))s.stock[k]-=n;
  if(o.processId==='CHARCOAL')m.charcoal+=1;
  m.orders=m.orders.filter(x=>x.id!==o.id);
  return {ok:true,completed:true,orderId:o.id,output:{charcoal:1}};
}

export function rustMaterialsSnapshot(s){
  const m=s.rustMaterials;
  if(!m)return null;
  return JSON.parse(JSON.stringify({version:m.version,charcoal:m.charcoal,orders:m.orders,reserved:reservedProcessingMaterials(s)}));
}
