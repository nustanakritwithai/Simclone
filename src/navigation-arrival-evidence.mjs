import {RULES,taskValid,walkable} from './survival.mjs?v=0.5.0';

export const NAVIGATION_ARRIVAL_VERSION='RC4-navigation-arrival/3';
export const NAVIGATION_ARRIVAL_PRODUCER='SIMCLONE_CANONICAL_TASK';
// Ephemeral execution records, never serialized or reconstructed from caller evidence.
const journeys=new WeakMap();
const validId=v=>typeof v==='string'&&v.length>0&&v.length<=160&&/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v);
const int=Number.isSafeInteger;
const positive=v=>int(v)&&v>0;
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const MARKET_TRAVEL_PREEMPTIBLE=new Set(['IDLE','FORAGE','WOODCUT','MINE','EAT','REST','EXPLORE']);

export function canPreemptForCanonicalMarketTravel(task,agent=null){
  if(agent&&(agent.satiety<RULES.hungry||agent.energy<RULES.exhausted))return false;
  if(task===null||task===undefined)return true;
  if(!task||typeof task!=='object')return false;
  if(task.rc4MarketTravel||task.adventureExpedition||task.adventureHunt||task.placement)return false;
  if(['CRAFT','PROCESS','BUILD'].includes(task.kind))return false;
  return MARKET_TRAVEL_PREEMPTIBLE.has(task.kind);
}
function marketOk(m){return !!m&&validId(m.id)&&typeof m.open==='boolean'&&int(m.x)&&int(m.y)&&positive(m.tradeRange);}
export function isCanonicalMarketTravelTask(task){
  const m=task?.rc4MarketTravel;
  return journeys.has(task)&&task?.kind==='EXPLORE'&&task.policy===RULES.jobPolicy&&
    m?.version===NAVIGATION_ARRIVAL_VERSION&&m.producer===NAVIGATION_ARRIVAL_PRODUCER;
}
function recordFor(world,agent){
  const task=agent?.task,r=task&&journeys.get(task);
  if(!r||r.world!==world||r.agentId!==agent.id||world.agents?.find(a=>a.id===agent.id)!==agent||agent.alive!==true)return null;
  if(!int(world.tick)||world.tick<r.startedTick||world.tick-r.startedTick>RULES.jobMaxTicks)return null;
  if(task.started!==r.startedTick||task.x!==r.market.x||task.y!==r.market.y)return null;
  if(!Array.isArray(task.path)||task.path.length!==r.route.length-r.index)return null;
  if(agent.x!==r.x||agent.y!==r.y)return null;
  // Detect arbitrary path shortening/replacement even when the outer task is genuine.
  for(let i=0;i<task.path.length;i++)if(task.path[i]?.x!==r.route[r.index+i].x||task.path[i]?.y!==r.route[r.index+i].y)return null;
  return r;
}

export function createCanonicalMarketTravelTask(world,agent,market,path){
  if(!agent?.alive||world?.agents?.find(a=>a.id===agent.id)!==agent||!marketOk(market)||!market.open)return {state:'VIOL',reason:'market-or-agent'};
  if(!int(world.tick)||world.tick<0||!Array.isArray(path))return {state:'VIOL',reason:'path'};
  let prev={x:agent.x,y:agent.y};
  for(const p of path){
    if(!int(p?.x)||!int(p?.y)||distance(prev,p)!==1||!walkable(world,p.x,p.y))return {state:'VIOL',reason:'path'};
    prev=p;
  }
  if(prev.x!==market.x||prev.y!==market.y)return {state:'VIOL',reason:'path-target'};
  const task=Object.freeze({
    kind:'EXPLORE',targetId:'RC4MARKET:'+market.id,x:market.x,y:market.y,
    path:path.map(p=>({x:p.x,y:p.y})),work:0,score:0,started:world.tick,policy:RULES.jobPolicy,
    rc4MarketTravel:Object.freeze({version:NAVIGATION_ARRIVAL_VERSION,producer:NAVIGATION_ARRIVAL_PRODUCER,
      marketId:market.id,marketX:market.x,marketY:market.y,tradeRange:market.tradeRange,startedTick:world.tick})
  });
  journeys.set(task,{world,agentId:agent.id,market:{...market},startedTick:world.tick,lastStepTick:world.tick,
    x:agent.x,y:agent.y,route:path.map(p=>Object.freeze({x:p.x,y:p.y})),index:0});
  return {state:'SAT',task};
}

/** Engine executor calls this once at its existing movement cadence.
 * Navigation consumes the canonical path; the engine remains the sole position writer.
 */
export function consumeCanonicalMarketTravelStep(world,agent){
  const r=recordFor(world,agent);
  if(!r||!taskValid(world,agent))return {ok:false,reason:'navigation-journey'};
  if(r.index>=r.route.length||agent.moveTick<RULES.moveTicks||world.tick-r.lastStepTick<RULES.moveTicks)return {ok:false,reason:'navigation-cadence'};
  const p=r.route[r.index];
  if(distance(agent,p)!==1||!walkable(world,p.x,p.y))return {ok:false,reason:'navigation-step'};
  agent.task.path.shift();r.index++;r.x=p.x;r.y=p.y;r.lastStepTick=world.tick;
  return {ok:true,position:{x:p.x,y:p.y}};
}

export function verifyCanonicalMarketArrival(world,{agentId,market}={}){
  if(!marketOk(market)||!market.open)return {state:'VIOL',reason:'market'};
  const agent=world?.agents?.find(a=>a.id===agentId&&a.alive===true);
  if(!agent)return {state:'VIOL',reason:'agent'};
  if(!isCanonicalMarketTravelTask(agent.task))return {state:'VIOL',reason:'canonical-task'};
  const r=recordFor(world,agent);
  if(!r)return {state:'VIOL',reason:'navigation-journey'};
  if(r.market.id!==market.id||r.market.x!==market.x||r.market.y!==market.y||r.market.tradeRange!==market.tradeRange)return {state:'VIOL',reason:'market-mismatch'};
  if(r.index!==r.route.length)return {state:'UNKNOWN',reason:'still-travelling'};
  if(agent.x!==market.x||agent.y!==market.y||distance(agent,market)>market.tradeRange)return {state:'VIOL',reason:'position'};
  return {state:'SAT',verification:'NAVIGATION_VERIFIED',agentId,marketId:market.id,x:agent.x,y:agent.y,
    tick:world.tick,startedTick:r.startedTick,walkedSteps:r.index};
}

/** Preserve an unchanged in-flight task only across the approved live-root commit.
 * A JSON restore never calls this function and cannot acquire journey provenance.
 */
export function retainCanonicalMarketTravelOnCommit(live,next){
  for(const a of live.agents??[]){
    if(!a.task?.rc4MarketTravel)continue;
    const b=next.agents?.find(x=>x.id===a.id);
    if(!b?.task?.rc4MarketTravel)continue;
    if(recordFor(live,a)&&a.x===b.x&&a.y===b.y&&JSON.stringify(a.task)===JSON.stringify(b.task))b.task=a.task;
    else {b.task=null;b.moveTick=0;}
  }
}
