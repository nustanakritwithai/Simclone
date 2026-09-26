/**
 * IC7B — authoritative Household trade with conserved cargo.
 */
import {isIndependent,resourceStock,resourceAccount} from './individual-resources.mjs?v=0.5.0';
import {householdForOwner,relationshipOf,recordRelationshipEvidence} from './relationships.mjs?v=0.5.0';
import {homeOf} from './individual-housing.mjs?v=0.5.0';
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {householdTradeOpportunities} from './kingdom-household-trade.mjs?v=0.5.0';

export const HOUSEHOLD_TRADE_VERSION='IC7B-household-trade-1';
export const HOUSEHOLD_TRADE_RULES=Object.freeze({
  maxContracts:64,
  intervalTicks:120,
  maxQuantity:12,
  relationTrustMin:2,
  relationAffinityMin:2,
});
export const TRADE_GOODS=Object.freeze(['food','wood','stone']);

export const createHouseholdTradeState=()=>({version:HOUSEHOLD_TRADE_VERSION,nextContract:1,contracts:[]});

export function ensureHouseholdTradeState(s){
  if(!isIndependent(s))return null;
  if(s.householdTrade===undefined)s.householdTrade=createHouseholdTradeState();
  return s.householdTrade;
}

const relationPass=r=>r.trust>=HOUSEHOLD_TRADE_RULES.relationTrustMin||r.affinity>=HOUSEHOLD_TRADE_RULES.relationAffinityMin;
export function tradeRelationshipGate(s,originOwnerId,destinationOwnerId){
  const a=relationshipOf(s,originOwnerId,destinationOwnerId),b=relationshipOf(s,destinationOwnerId,originOwnerId);
  return relationPass(a)&&relationPass(b);
}

export function activeTradeForCarrier(s,carrierId){
  const row=s.householdTrade?.contracts?.find(c=>c.carrierId===carrierId&&c.status==='in-transit');
  return row?structuredClone(row):null;
}

function validCarrier(s,carrier,originHouseId){
  return !!carrier?.alive&&canPerformProductiveWork(s,carrier)&&
    resourceAccount(s,carrier).kind==='household'&&resourceAccount(s,carrier).houseId===originHouseId&&
    !activeTradeForCarrier(s,carrier.id);
}

function chooseCarrier(s,originOwnerId,originHouseId,preferredId=null){
  const household=householdForOwner(s,originOwnerId);
  if(!household)return null;
  const ids=[originOwnerId,...(household.cohabitantIds??[])];
  const rows=ids.map(id=>s.agents?.find(a=>a.id===id)).filter(a=>validCarrier(s,a,originHouseId));
  if(preferredId!==null)return rows.find(a=>a.id===preferredId)??null;
  return rows.sort((a,b)=>(a.id===originOwnerId?-1:b.id===originOwnerId?1:a.id-b.id))[0]??null;
}

export function startHouseholdTrade(s,{originOwnerId,destinationOwnerId,good,carrierId=null}={}){
  if(!isIndependent(s))return {ok:false,reason:'mode'};
  if(!Number.isSafeInteger(originOwnerId)||!Number.isSafeInteger(destinationOwnerId)||originOwnerId===destinationOwnerId||!TRADE_GOODS.includes(good))
    return {ok:false,reason:'contract'};
  const trade=ensureHouseholdTradeState(s);
  if(trade.contracts.length>=HOUSEHOLD_TRADE_RULES.maxContracts)return {ok:false,reason:'capacity'};
  if(!tradeRelationshipGate(s,originOwnerId,destinationOwnerId))return {ok:false,reason:'relationship'};
  const opportunity=householdTradeOpportunities(s).find(r=>
    r.originOwnerId===originOwnerId&&r.destinationOwnerId===destinationOwnerId&&r.good===good
  );
  if(!opportunity)return {ok:false,reason:'opportunity'};
  const carrier=chooseCarrier(s,originOwnerId,opportunity.originHouseId,carrierId);
  if(!carrier)return {ok:false,reason:'carrier'};
  const quantity=Math.min(HOUSEHOLD_TRADE_RULES.maxQuantity,opportunity.quantity);
  const source=resourceStock(s,originOwnerId);
  if(!source||source[good]<quantity)return {ok:false,reason:'stock'};
  source[good]-=quantity;
  const row={
    id:trade.nextContract++,
    originHouseId:opportunity.originHouseId,
    destinationHouseId:opportunity.destinationHouseId,
    originOwnerId,
    destinationOwnerId,
    carrierId:carrier.id,
    good,
    quantity,
    cargoQuantity:quantity,
    status:'in-transit',
    createdTick:s.tick,
    completedTick:null,
    strandedAt:null,
  };
  trade.contracts.push(row);
  return {ok:true,changed:true,contract:structuredClone(row),message:'เริ่มขนส่ง '+good+' '+quantity+' หน่วย'};
}

export function pendingHouseholdTrade(s,a){
  const c=s.householdTrade?.contracts?.find(c=>c.carrierId===a?.id&&c.status==='in-transit');
  if(!c)return null;
  const home=homeOf(s,c.destinationOwnerId,{completeOnly:true});
  if(!home?.origin||home.houseId!==c.destinationHouseId)return null;
  return {
    kind:'TRADE_DELIVERY',
    targetId:c.id,
    x:home.origin.x,y:home.origin.y,
    houseId:home.houseId,
    contractId:c.id,
    label:'ส่ง '+c.good+' '+c.cargoQuantity,
  };
}

export function completeHouseholdTrade(s,carrierId){
  const trade=ensureHouseholdTradeState(s),c=trade?.contracts.find(c=>c.carrierId===carrierId&&c.status==='in-transit');
  if(!c)return {ok:false,reason:'contract'};
  const carrier=s.agents?.find(a=>a.id===carrierId&&a.alive);
  const home=homeOf(s,c.destinationOwnerId,{completeOnly:true});
  if(!carrier||!home?.origin||home.houseId!==c.destinationHouseId||carrier.x!==home.origin.x||carrier.y!==home.origin.y)
    return {ok:false,reason:'destination'};
  const dest=resourceStock(s,c.destinationOwnerId);
  if(!dest||dest[c.good]+c.cargoQuantity>999)return {ok:false,reason:'capacity'};
  const delivered=c.cargoQuantity;
  dest[c.good]+=delivered;c.cargoQuantity=0;c.status='completed';c.completedTick=s.tick;
  const debt=Math.min(10,Math.max(1,Math.ceil(delivered/3)));
  recordRelationshipEvidence(s,{
    fromId:c.originOwnerId,toId:c.destinationOwnerId,kind:'trade-delivery',
    key:'trade:'+c.id+':origin',delta:{trust:1},ref:'trade:'+c.id
  });
  recordRelationshipEvidence(s,{
    fromId:c.destinationOwnerId,toId:c.originOwnerId,kind:'trade-delivery',
    key:'trade:'+c.id+':destination',delta:{trust:1,affinity:1,debt},ref:'trade:'+c.id
  });
  return {ok:true,changed:true,contract:structuredClone(c),delivered,message:'ส่งมอบ '+c.good+' '+delivered+' หน่วยสำเร็จ'};
}

export function releaseHouseholdTradeOnDeath(s,a){
  if(!isIndependent(s)||!s.householdTrade)return {changed:0};
  let changed=0;
  for(const c of s.householdTrade.contracts){
    if(c.status==='in-transit'&&c.carrierId===a.id){
      c.status='stranded';c.strandedAt={x:a.x,y:a.y,tick:s.tick};changed++;
    }
  }
  return {changed};
}

export function stepHouseholdTradePlanning(s){
  if(!isIndependent(s)||s.tick%HOUSEHOLD_TRADE_RULES.intervalTicks!==0)return null;
  ensureHouseholdTradeState(s);
  for(const o of householdTradeOpportunities(s)){
    if(!tradeRelationshipGate(s,o.originOwnerId,o.destinationOwnerId))continue;
    const r=startHouseholdTrade(s,{originOwnerId:o.originOwnerId,destinationOwnerId:o.destinationOwnerId,good:o.good});
    if(r.ok)return r;
  }
  return null;
}

export function householdTradeCommand(s,type,data={}){
  if(type==='START_HOUSEHOLD_TRADE')return startHouseholdTrade(s,data);
  return null;
}

export function validateHouseholdTradeState(s,{required=false}={}){
  const t=s.householdTrade;
  if(t===undefined)return required?['Household trade state']:[];
  if(!t||t.version!==HOUSEHOLD_TRADE_VERSION||!Number.isSafeInteger(t.nextContract)||t.nextContract<1||
    !Array.isArray(t.contracts)||t.contracts.length>HOUSEHOLD_TRADE_RULES.maxContracts)return ['Household trade state'];
  const errors=[],ids=new Set(),people=new Set([...(s.agents??[]),...(s.archive??[])].map(a=>a.id));let maxId=0;
  for(const c of t.contracts){
    if(!c||!Number.isSafeInteger(c.id)||c.id<1||ids.has(c.id)||
      !people.has(c.originOwnerId)||!people.has(c.destinationOwnerId)||!people.has(c.carrierId)||
      c.originOwnerId===c.destinationOwnerId||!TRADE_GOODS.includes(c.good)||
      typeof c.originHouseId!=='string'||typeof c.destinationHouseId!=='string'||
      !Number.isInteger(c.quantity)||c.quantity<1||c.quantity>HOUSEHOLD_TRADE_RULES.maxQuantity||
      !Number.isInteger(c.cargoQuantity)||c.cargoQuantity<0||c.cargoQuantity>c.quantity||
      !['in-transit','completed','stranded'].includes(c.status)||
      !Number.isInteger(c.createdTick)||c.createdTick<0||c.createdTick>s.tick||
      (c.completedTick!==null&&(!Number.isInteger(c.completedTick)||c.completedTick<c.createdTick||c.completedTick>s.tick)))
      errors.push('Household trade contract');
    if(c?.status==='in-transit'){
      if(c.cargoQuantity!==c.quantity||c.completedTick!==null||c.strandedAt!==null||
        !s.agents?.some(a=>a.id===c.carrierId&&a.alive))errors.push('Household trade in-transit');
    }else if(c?.status==='completed'){
      if(c.cargoQuantity!==0||c.completedTick===null||c.strandedAt!==null)errors.push('Household trade completed');
    }else if(c?.status==='stranded'){
      if(c.cargoQuantity!==c.quantity||c.completedTick!==null||!c.strandedAt||
        !Number.isInteger(c.strandedAt.x)||!Number.isInteger(c.strandedAt.y)||!Number.isInteger(c.strandedAt.tick)||
        c.strandedAt.tick<c.createdTick||c.strandedAt.tick>s.tick)errors.push('Household trade stranded');
    }
    ids.add(c?.id);maxId=Math.max(maxId,c?.id??0);
  }
  if(t.nextContract<=maxId)errors.push('Household trade counter');
  return [...new Set(errors)];
}
