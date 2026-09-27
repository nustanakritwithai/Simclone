import {worldBounds} from './world-bounds.mjs?v=0.5.0';
import {assertAdventureZoneAccess,adventureZoneById,assertAdventureMonsterInZone} from './adventure-zones.mjs?v=0.5.0';
import {adventureAnnexZoneBounds} from './adventure-annex.mjs?v=0.5.0';
import {resolveAdventureEncounter} from './adventure-encounter.mjs?v=0.5.0';

export const ADVENTURE_EXPEDITION_VERSION='adventure-expedition/v1';
export const ADVENTURE_ENCOUNTER_STATE_VERSION='adventure-encounter-state/v1';

const ZONE_SPATIAL_RATIOS=Object.freeze({
  z1:Object.freeze([.55,.65]),
  z2:Object.freeze([.66,.76]),
  z3:Object.freeze([.77,.87]),
  z4:Object.freeze([.88,.98]),
});

const integer=(n,min=Number.MIN_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min;

export function adventureZoneSpatialBounds(state,zoneId){
  const ratio=ZONE_SPATIAL_RATIOS[zoneId];
  if(!ratio)throw new Error('unknown_zone');
  const bounds=worldBounds(state);
  if(bounds.profile==='same-world')return adventureAnnexZoneBounds(zoneId);
  const innerMax=Math.max(1,bounds.w-2);
  let minX=Math.max(1,Math.min(innerMax,Math.ceil(bounds.w*ratio[0])));
  let maxX=Math.max(minX,Math.min(innerMax,Math.floor(bounds.w*ratio[1])));
  return Object.freeze({zoneId,minX,maxX,minY:1,maxY:Math.max(1,bounds.h-2)});
}

export function isAdventureZoneCell(state,zoneId,x,y){
  if(!Number.isInteger(x)||!Number.isInteger(y))return false;
  const b=adventureZoneSpatialBounds(state,zoneId);
  return x>=b.minX&&x<=b.maxX&&y>=b.minY&&y<=b.maxY;
}

export function findAdventureZoneEntry(state,agent,zoneId,adventureLevel,{walkable,routeField,routeDistance}={}){
  assertAdventureZoneAccess(zoneId,adventureLevel);
  if(!agent||!integer(agent.x,0)||!integer(agent.y,0))throw new Error('invalid_agent_position');
  if(typeof walkable!=='function'||typeof routeField!=='function'||typeof routeDistance!=='function')throw new Error('missing_path_authority');
  const spatial=adventureZoneSpatialBounds(state,zoneId),field=routeField(state,agent);
  const centerY=Math.floor((spatial.minY+spatial.maxY)/2),candidates=[];
  for(let y=spatial.minY;y<=spatial.maxY;y++)for(let x=spatial.minX;x<=spatial.maxX;x++){
    if(!walkable(state,x,y))continue;
    const distance=routeDistance(field,{x,y});
    if(distance<0)continue;
    candidates.push({x,y,distance,centerDelta:Math.abs(y-centerY)});
  }
  candidates.sort((a,b)=>a.distance-b.distance||a.centerDelta-b.centerDelta||a.x-b.x||a.y-b.y);
  if(!candidates.length)throw new Error('no-path');
  const chosen=candidates[0];
  return Object.freeze({x:chosen.x,y:chosen.y,routeDistance:chosen.distance,zoneId});
}

export function expeditionId(agentId,started,zoneId,x,y){
  return 'advexp:'+agentId+':'+started+':'+zoneId+':'+x+':'+y;
}

export function createAdventureExpeditionTask(state,agent,zoneId,adventureLevel,entry,path){
  assertAdventureZoneAccess(zoneId,adventureLevel);
  if(!Array.isArray(path)||!isAdventureZoneCell(state,zoneId,entry?.x,entry?.y))throw new Error('invalid_expedition_path');
  const started=state.tick,id=expeditionId(agent.id,started,zoneId,entry.x,entry.y);
  return {
    kind:'EXPLORE',targetId:null,x:entry.x,y:entry.y,path:path.map(p=>({x:p.x,y:p.y})),work:0,
    started,score:0,policy:'survival-0.2',
    adventureExpedition:Object.freeze({version:ADVENTURE_EXPEDITION_VERSION,id,zoneId,adventureLevel,entryX:entry.x,entryY:entry.y})
  };
}

export function adventureExpeditionTaskValid(state,agent,task,{walkable}={}){
  const e=task?.adventureExpedition;
  if(!e)return true;
  if(task.kind!=='EXPLORE'||!agent?.alive||agent.profession!=='adventurer'||agent.adventureEncounter)return false;
  if(e.version!==ADVENTURE_EXPEDITION_VERSION||!integer(e.adventureLevel,1)||typeof e.zoneId!=='string')return false;
  if(!integer(task.started,0)||e.id!==expeditionId(agent.id,task.started,e.zoneId,task.x,task.y))return false;
  try{assertAdventureZoneAccess(e.zoneId,e.adventureLevel);}catch{return false;}
  if(e.entryX!==task.x||e.entryY!==task.y||!isAdventureZoneCell(state,e.zoneId,task.x,task.y))return false;
  if(typeof walkable==='function'&&!walkable(state,task.x,task.y))return false;
  return true;
}

export function completeAdventureExpedition(state,agent,task){
  if(!adventureExpeditionTaskValid(state,agent,task))throw new Error('invalid_expedition_completion');
  if(agent.x!==task.x||agent.y!==task.y||task.path.length!==0)throw new Error('expedition_not_arrived');
  const e=task.adventureExpedition;
  const encounter=resolveAdventureEncounter({
    seed:state.seed,tick:state.tick,agentId:agent.id,x:agent.x,y:agent.y,
    adventureLevel:e.adventureLevel,zoneId:e.zoneId
  });
  assertAdventureMonsterInZone(encounter.zoneId,encounter.monsterId);
  const id='advenc:'+e.id+':'+state.tick+':'+encounter.monsterId;
  return Object.freeze({
    version:ADVENTURE_ENCOUNTER_STATE_VERSION,
    encounterId:id,expeditionId:e.id,status:'READY',
    zoneId:encounter.zoneId,monsterId:encounter.monsterId,monsterLevel:encounter.monsterLevel,rank:encounter.rank,
    adventureLevel:e.adventureLevel,startedTick:task.started,encounterTick:state.tick,x:agent.x,y:agent.y
  });
}

export function validateAdventureEncounterState(state,agent){
  const e=agent?.adventureEncounter;
  if(e===undefined||e===null)return [];
  const bad=['Adventure encounter'];
  if(!e||e.version!==ADVENTURE_ENCOUNTER_STATE_VERSION||e.status!=='READY'||typeof e.encounterId!=='string'||typeof e.expeditionId!=='string')return bad;
  if(!integer(e.startedTick,0)||!integer(e.encounterTick,e.startedTick)||e.encounterTick>state.tick)return bad;
  if(!integer(e.adventureLevel,1)||!integer(e.monsterLevel,1)||!integer(e.x,0)||!integer(e.y,0))return bad;
  if(agent.x!==e.x||agent.y!==e.y||!isAdventureZoneCell(state,e.zoneId,e.x,e.y))return bad;
  try{
    const zone=adventureZoneById(e.zoneId);
    assertAdventureZoneAccess(e.zoneId,e.adventureLevel);
    assertAdventureMonsterInZone(e.zoneId,e.monsterId);
    if(e.monsterLevel<zone.minLevel||e.monsterLevel>zone.maxLevel)return bad;
  }catch{return bad;}
  if(!['normal','elite'].includes(e.rank))return bad;
  return [];
}
