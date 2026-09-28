/**
 * RC4 canonical market-arrival proof.
 *
 * Authority rule:
 * - caller-supplied evidence objects are never accepted;
 * - proof is derived from the live Simclone agent.task owned by the engine;
 * - the task must be the exact RC4 market-travel task and have consumed its path.
 */
import {taskValid} from './survival.mjs?v=0.5.0';

export const RC4_MARKET_TRAVEL_VERSION='RC4-market-travel/1';
const validId=v=>typeof v==='string'&&v.length>0&&v.length<=160&&/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v);
const int=v=>Number.isSafeInteger(v);
const positive=v=>Number.isSafeInteger(v)&&v>0;
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

export function createRc4MarketTravelMetadata({market,startedTick}={}){
  if(!market||!validId(market.id)||market.open!==true||!int(market.x)||!int(market.y)||!positive(market.tradeRange)||
    !int(startedTick)||startedTick<0) return null;
  return Object.freeze({
    version:RC4_MARKET_TRAVEL_VERSION,
    authority:'SIMCLONE_NAVIGATION_TASK',
    marketId:market.id,
    marketX:market.x,
    marketY:market.y,
    tradeRange:market.tradeRange,
    startedTick
  });
}

export function validateRc4MarketTravelTask(task){
  const m=task?.rc4MarketTravel;
  if(!m)return [];
  const e=[];
  if(task.kind!=='EXPLORE')e.push('market-travel-kind');
  if(m.version!==RC4_MARKET_TRAVEL_VERSION||m.authority!=='SIMCLONE_NAVIGATION_TASK')e.push('market-travel-version');
  if(!validId(m.marketId))e.push('marketId');
  if(!int(m.marketX)||!int(m.marketY)||!positive(m.tradeRange))e.push('market');
  if(!int(m.startedTick)||m.startedTick<0||m.startedTick!==task.started)e.push('startedTick');
  if(task.x!==m.marketX||task.y!==m.marketY)e.push('target');
  return [...new Set(e)];
}

/**
 * Verify arrival only from the current authoritative world/task.
 * There is intentionally no evidence-object parameter to forge.
 */
export function verifyCanonicalMarketArrival(world,{agentId,market}={}){
  if(!market||!validId(market.id)||market.open!==true||!int(market.x)||!int(market.y)||!positive(market.tradeRange))
    return {state:'VIOL',reason:'market-projection'};
  const agent=world?.agents?.find(a=>a?.id===agentId&&a.alive===true);
  if(!agent)return {state:'VIOL',reason:'agent'};
  const task=agent.task;
  const errors=validateRc4MarketTravelTask(task);
  if(!task?.rc4MarketTravel||errors.length)return {state:'VIOL',reason:'navigation-task',errors};
  if(!taskValid(world,agent))return {state:'VIOL',reason:'navigation-task-invalid'};
  const meta=task.rc4MarketTravel;
  if(meta.marketId!==market.id||meta.marketX!==market.x||meta.marketY!==market.y||meta.tradeRange!==market.tradeRange)
    return {state:'VIOL',reason:'market-mismatch'};
  if(task.path.length!==0)return {state:'UNKNOWN',reason:'still-travelling'};
  if(agent.x!==task.x||agent.y!==task.y)return {state:'VIOL',reason:'position-mismatch'};
  if(dist(agent,market)>market.tradeRange)return {state:'VIOL',reason:'out-of-range'};
  return {
    state:'SAT',
    authority:'SIMCLONE_NAVIGATION_TASK',
    agentId:agent.id,
    marketId:market.id,
    tick:world.tick,
    x:agent.x,
    y:agent.y,
    startedTick:task.started
  };
}

export function rc4MarketTravelSnapshot(world,agentId){
  const agent=world?.agents?.find(a=>a?.id===agentId&&a.alive===true);
  const task=agent?.task;
  if(!task?.rc4MarketTravel)return null;
  return structuredClone({
    agentId,
    x:agent.x,
    y:agent.y,
    pathRemaining:task.path.length,
    target:{x:task.x,y:task.y},
    ...task.rc4MarketTravel
  });
}
