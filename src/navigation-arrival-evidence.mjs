import {RULES,taskValid} from './survival.mjs?v=0.5.0';

export const NAVIGATION_ARRIVAL_VERSION='RC4-navigation-arrival/2';
export const NAVIGATION_ARRIVAL_PRODUCER='SIMCLONE_CANONICAL_TASK';

const validId=v=>typeof v==='string'&&v.length>0&&v.length<=160&&/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v);
const int=v=>Number.isSafeInteger(v);
const positive=v=>Number.isSafeInteger(v)&&v>0;
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const clone=v=>structuredClone(v);

function marketOk(m){
  return !!m&&validId(m.id)&&typeof m.open==='boolean'&&int(m.x)&&int(m.y)&&positive(m.tradeRange);
}

export function isCanonicalMarketTravelTask(task){
  const m=task?.rc4MarketTravel;
  return task?.kind==='EXPLORE'&&task?.policy===RULES.jobPolicy&&!!m&&
    m.version===NAVIGATION_ARRIVAL_VERSION&&m.producer===NAVIGATION_ARRIVAL_PRODUCER&&
    validId(m.marketId)&&int(m.marketX)&&int(m.marketY)&&positive(m.tradeRange)&&
    int(m.startedTick)&&m.startedTick===task.started;
}

/**
 * Builds metadata that lives inside the existing canonical Simclone navigation task.
 * There is no caller-owned evidence token/hash to verify later.
 */
export function createCanonicalMarketTravelTask(world,agent,market,path){
  if(!agent?.alive||!marketOk(market)||market.open!==true)return {state:'VIOL',reason:'market-or-agent'};
  if(!int(world?.tick)||world.tick<0||!Array.isArray(path))return {state:'VIOL',reason:'path'};
  let prev={x:agent.x,y:agent.y};
  for(const p of path){
    if(!int(p?.x)||!int(p?.y)||distance(prev,p)!==1)return {state:'VIOL',reason:'path'};
    prev=p;
  }
  if(prev.x!==market.x||prev.y!==market.y)return {state:'VIOL',reason:'path-target'};
  const task={
    kind:'EXPLORE',
    targetId:'RC4MARKET:'+market.id,
    x:market.x,y:market.y,
    path:path.map(p=>({x:p.x,y:p.y})),
    work:0,score:0,started:world.tick,policy:RULES.jobPolicy,
    rc4MarketTravel:{
      version:NAVIGATION_ARRIVAL_VERSION,
      producer:NAVIGATION_ARRIVAL_PRODUCER,
      marketId:market.id,marketX:market.x,marketY:market.y,tradeRange:market.tradeRange,
      startedTick:world.tick
    }
  };
  return {state:'SAT',task:Object.freeze(clone(task))};
}

/**
 * Arrival proof is resolved from authoritative world state only.
 * Callers provide only identity of the agent/market they want verified.
 */
export function verifyCanonicalMarketArrival(world,{agentId,market}={}){
  if(!marketOk(market)||market.open!==true)return {state:'VIOL',reason:'market'};
  const agent=world?.agents?.find(a=>a?.id===agentId&&a.alive===true);
  if(!agent)return {state:'VIOL',reason:'agent'};
  const task=agent.task,meta=task?.rc4MarketTravel;
  if(!isCanonicalMarketTravelTask(task))return {state:'VIOL',reason:'canonical-task'};
  if(!taskValid(world,agent))return {state:'VIOL',reason:'navigation-task'};
  if(meta.marketId!==market.id||meta.marketX!==market.x||meta.marketY!==market.y||meta.tradeRange!==market.tradeRange)
    return {state:'VIOL',reason:'market-mismatch'};
  if(task.path.length!==0)return {state:'UNKNOWN',reason:'still-travelling'};
  if(agent.x!==task.x||agent.y!==task.y||agent.x!==market.x||agent.y!==market.y)return {state:'VIOL',reason:'position'};
  if(distance(agent,market)>market.tradeRange)return {state:'VIOL',reason:'out-of-range'};
  return {state:'SAT',verification:'NAVIGATION_VERIFIED',agentId,marketId:market.id,x:agent.x,y:agent.y,tick:world.tick,startedTick:task.started};
}
