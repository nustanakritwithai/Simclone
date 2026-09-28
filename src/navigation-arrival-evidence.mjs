/**
 * RC4 Navigation-owned arrival evidence.
 *
 * This module is a read-only observer over the existing Simclone movement authority.
 * It never mutates agent position, creates a teleport, or owns a second path ledger.
 */
import {taskValid} from './survival.mjs?v=0.5.0';

export const NAVIGATION_ARRIVAL_VERSION='RC4-navigation-arrival/1';
export const NAVIGATION_ARRIVAL_VERIFICATION='NAVIGATION_VERIFIED';
export const NAVIGATION_ARRIVAL_PRODUCER='SIMCLONE_SURVIVAL_NAVIGATION';
export const NAVIGATION_ARRIVAL_PERSISTENCE='EPHEMERAL_REGENERATE_AFTER_LOAD';

const idPattern=/^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const validId=v=>typeof v==='string'&&v.length>0&&v.length<=160&&idPattern.test(v);
const int=v=>Number.isSafeInteger(v);
const positive=v=>Number.isSafeInteger(v)&&v>0;
const clone=v=>structuredClone(v);
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const fail=(reason,extra={})=>({state:'VIOL',reason,...extra});

function stableText(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(stableText).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableText(value[k])).join(',')+'}';
}
function hash32(text){
  let h=0x811c9dc5;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}
  return h.toString(16).padStart(8,'0');
}
function marketOk(m){
  return !!m&&validId(m.id)&&typeof m.open==='boolean'&&int(m.x)&&int(m.y)&&positive(m.tradeRange);
}
function taskIdentity(task){
  return {
    kind:task.kind,
    started:task.started,
    targetId:task.targetId??null,
    x:task.x,
    y:task.y
  };
}
function routeFingerprint({startX,startY,route,task}){
  return hash32(stableText({startX,startY,route,task:taskIdentity(task)}));
}
function journeyIdFor(j){
  return 'NAVJ:'+hash32(stableText({
    agentId:j.agentId,marketId:j.marketId,marketX:j.marketX,marketY:j.marketY,tradeRange:j.tradeRange,
    startX:j.startX,startY:j.startY,plannedTick:j.plannedTick,task:j.task,route:j.route,routeFingerprint:j.routeFingerprint
  }));
}
function evidenceIdFor(e){
  return 'NAVE:'+hash32(stableText({
    producer:NAVIGATION_ARRIVAL_PRODUCER,journeyId:e.journeyId,routeFingerprint:e.routeFingerprint,
    agentId:e.agentId,marketId:e.marketId,x:e.x,y:e.y,tick:e.tick,
    marketX:e.marketX,marketY:e.marketY,tradeRange:e.tradeRange,steps:e.steps
  }));
}
function sameTask(task,identity){
  return !!task&&task.kind===identity.kind&&task.started===identity.started&&
    (task.targetId??null)===identity.targetId&&task.x===identity.x&&task.y===identity.y;
}

export function validateNavigationJourney(world,journey){
  const e=[];
  if(!journey||journey.version!==NAVIGATION_ARRIVAL_VERSION)e.push('journey-version');
  if(!positive(journey?.agentId))e.push('agentId');
  if(!validId(journey?.marketId))e.push('marketId');
  if(!int(journey?.marketX)||!int(journey?.marketY)||!positive(journey?.tradeRange))e.push('market');
  if(!int(journey?.startX)||!int(journey?.startY)||!int(journey?.plannedTick)||journey.plannedTick<0)e.push('start');
  if(!Array.isArray(journey?.route)||journey.route.length<1||journey.route.some(p=>!int(p?.x)||!int(p?.y)))e.push('route');
  if(!journey?.task||!int(journey.task.started)||!int(journey.task.x)||!int(journey.task.y)||typeof journey.task.kind!=='string')e.push('task');
  if(!int(journey?.nextIndex)||journey.nextIndex<0||journey.nextIndex>(journey.route?.length??0))e.push('nextIndex');
  if(!int(journey?.lastX)||!int(journey?.lastY)||!int(journey?.lastObservedTick)||journey.lastObservedTick<journey.plannedTick)e.push('observer');
  if(typeof journey?.routeFingerprint!=='string')e.push('routeFingerprint');
  if(typeof journey?.journeyId!=='string')e.push('journeyId');
  if(e.length)return [...new Set(e)];
  let prev={x:journey.startX,y:journey.startY};
  for(const p of journey.route){if(distance(prev,p)!==1)e.push('route-nonadjacent');prev=p;}
  if(distance(prev,{x:journey.marketX,y:journey.marketY})>journey.tradeRange)e.push('route-not-market');
  const fp=routeFingerprint({startX:journey.startX,startY:journey.startY,route:journey.route,task:journey.task});
  if(fp!==journey.routeFingerprint)e.push('route-fingerprint');
  if(journeyIdFor({...journey,routeFingerprint:fp})!==journey.journeyId)e.push('journey-id');
  const agent=world?.agents?.find(a=>a?.id===journey.agentId&&a.alive===true);
  if(!agent)e.push('agent');
  return [...new Set(e)];
}

/**
 * Start observing an already-authoritative Simclone task.
 * The task itself is owned/validated by survival.mjs. This module does not create it.
 */
export function beginNavigationArrivalJourney(world,{agentId,market}={}){
  if(!marketOk(market))return fail('market-projection');
  if(market.open!==true)return fail('market-closed');
  const agent=world?.agents?.find(a=>a?.id===agentId&&a.alive===true);
  if(!agent)return fail('agent');
  if(!int(world?.tick)||world.tick<0)return fail('tick');
  if(!taskValid(world,agent))return fail('navigation-task');
  const task=agent.task;
  if(!Array.isArray(task.path)||task.path.length<1)return fail('walk-required');
  const last=task.path.at(-1);
  if(last.x!==task.x||last.y!==task.y)return fail('navigation-task');
  if(distance(last,market)>market.tradeRange)return fail('task-not-market');
  const route=task.path.map(p=>({x:p.x,y:p.y}));
  const identity=taskIdentity(task);
  const journey={
    version:NAVIGATION_ARRIVAL_VERSION,agentId,marketId:market.id,
    marketX:market.x,marketY:market.y,tradeRange:market.tradeRange,
    startX:agent.x,startY:agent.y,plannedTick:world.tick,task:identity,route,
    routeFingerprint:routeFingerprint({startX:agent.x,startY:agent.y,route,task:identity}),
    nextIndex:0,lastX:agent.x,lastY:agent.y,lastObservedTick:world.tick
  };
  journey.journeyId=journeyIdFor(journey);
  const errors=validateNavigationJourney(world,journey);
  return errors.length?fail('journey', {errors}):{state:'SAT',journey:Object.freeze(clone(journey))};
}

function makeEvidence(world,journey,agent){
  const evidence={
    version:NAVIGATION_ARRIVAL_VERSION,
    producer:NAVIGATION_ARRIVAL_PRODUCER,
    verification:NAVIGATION_ARRIVAL_VERIFICATION,
    journeyId:journey.journeyId,
    routeFingerprint:journey.routeFingerprint,
    agentId:journey.agentId,marketId:journey.marketId,
    x:agent.x,y:agent.y,tick:world.tick,
    marketX:journey.marketX,marketY:journey.marketY,tradeRange:journey.tradeRange,
    steps:journey.route.length
  };
  evidence.evidenceId=evidenceIdFor(evidence);
  return Object.freeze(evidence);
}

/**
 * Observe one canonical movement tick. Skipping over a route cell is a teleport/deviation VIOL.
 * Repeated observation while the engine has not moved is a deterministic no-op.
 */
export function observeNavigationArrivalJourney(world,rawJourney){
  const journey=clone(rawJourney),errors=validateNavigationJourney(world,journey);
  if(errors.length)return fail('journey',{errors});
  if(!int(world?.tick)||world.tick<journey.lastObservedTick)return fail('tick-regression');
  const agent=world.agents.find(a=>a?.id===journey.agentId&&a.alive===true);
  if(!agent)return fail('agent');
  const previous=journey.nextIndex===0?{x:journey.startX,y:journey.startY}:journey.route[journey.nextIndex-1];
  if(agent.x===previous.x&&agent.y===previous.y){
    journey.lastObservedTick=world.tick;
    return {state:'SAT',arrived:false,moved:false,journey:Object.freeze(journey)};
  }
  const next=journey.route[journey.nextIndex];
  if(!next||agent.x!==next.x||agent.y!==next.y)return fail('navigation-deviation');
  if(distance(previous,agent)!==1)return fail('teleport');
  if(!sameTask(agent.task,journey.task))return fail('navigation-task-changed');
  const remaining=agent.task.path??[];
  const expected=journey.route.slice(journey.nextIndex+1);
  if(stableText(remaining)!==stableText(expected))return fail('navigation-path-drift');
  journey.nextIndex++;journey.lastX=agent.x;journey.lastY=agent.y;journey.lastObservedTick=world.tick;
  if(journey.nextIndex<journey.route.length)return {state:'SAT',arrived:false,moved:true,journey:Object.freeze(journey)};
  if(distance(agent,{x:journey.marketX,y:journey.marketY})>journey.tradeRange)return fail('out-of-range');
  const evidence=makeEvidence(world,journey,agent);
  return {state:'SAT',arrived:true,moved:true,journey:Object.freeze(journey),evidence};
}

/**
 * Validate evidence against current canonical position and the selected market projection.
 * Plain {verified:true} or caller-authored lookalikes fail closed.
 */
export function verifyNavigationArrivalEvidence(world,evidence,{agentId,market}={}){
  if(!marketOk(market))return fail('market-projection');
  if(market.open!==true)return fail('market-closed');
  if(!evidence||evidence.version!==NAVIGATION_ARRIVAL_VERSION||
    evidence.producer!==NAVIGATION_ARRIVAL_PRODUCER||
    evidence.verification!==NAVIGATION_ARRIVAL_VERIFICATION)return fail('evidence-shape');
  if(evidence.evidenceId!==evidenceIdFor(evidence))return fail('evidence-id');
  if(evidence.agentId!==agentId)return fail('agent-mismatch');
  if(evidence.marketId!==market.id)return fail('market-mismatch');
  if(evidence.marketX!==market.x||evidence.marketY!==market.y||evidence.tradeRange!==market.tradeRange)return fail('market-coordinates-mismatch');
  if(!int(world?.tick)||evidence.tick!==world.tick)return fail('stale-evidence');
  const agent=world?.agents?.find(a=>a?.id===agentId&&a.alive===true);
  if(!agent)return fail('agent');
  if(agent.x!==evidence.x||agent.y!==evidence.y)return fail('position-mismatch');
  if(distance(agent,market)>market.tradeRange)return fail('out-of-range');
  if(!positive(evidence.steps)||!validId(evidence.journeyId)||typeof evidence.routeFingerprint!=='string')return fail('path-proof');
  return {state:'SAT',verification:NAVIGATION_ARRIVAL_VERIFICATION,evidence:Object.freeze(clone(evidence))};
}
