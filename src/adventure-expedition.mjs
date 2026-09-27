import {worldBounds} from './world-bounds.mjs?v=0.5.0';
import {assertAdventureZoneAccess,adventureZoneById,assertAdventureMonsterInZone} from './adventure-zones.mjs?v=0.5.0';
import {adventureAnnexZoneBounds} from './adventure-annex.mjs?v=0.5.0';
import {resolveAdventureEncounter} from './adventure-encounter.mjs?v=0.5.0';
import {wildMonsterById} from './adventure-world-monsters.mjs?v=0.5.0';

export const ADVENTURE_EXPEDITION_VERSION='adventure-expedition/v1';
export const ADVENTURE_ENCOUNTER_STATE_VERSION='adventure-encounter-state/v1';
export const ADVENTURE_HUNT_VERSION='adventure-hunt/v1';

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

function engagementOccupied(state,agent,x,y,targetWorldMonsterId){
  if((state.nodes??[]).some(n=>n.x===x&&n.y===y))return true;
  if((state.buildings??[]).some(b=>b.x===x&&b.y===y))return true;
  if((state.rustStations?.stations??[]).some(st=>st.x===x&&st.y===y))return true;
  if((state.agents??[]).some(a=>a.alive&&a.id!==agent.id&&a.x===x&&a.y===y))return true;
  if((state.rustPossessions?.items??[]).some(i=>i.location?.kind==='drop'&&i.location.x===x&&i.location.y===y))return true;
  if((state.wildMonsters?.entities??[]).some(m=>m.worldMonsterId!==targetWorldMonsterId&&m.status!=='DEFEATED'&&m.status!=='RESPAWNING'&&m.x===x&&m.y===y))return true;
  return false;
}

export function findAdventureMonsterEngagement(state,agent,worldMonsterId,adventureLevel,{walkable,routeField,routeDistance}={}){
  if(!agent||!integer(agent.x,0)||!integer(agent.y,0))throw new Error('invalid_agent_position');
  if(typeof walkable!=='function'||typeof routeField!=='function'||typeof routeDistance!=='function')throw new Error('missing_path_authority');
  const monster=wildMonsterById(state,worldMonsterId);
  if(!monster||monster.status!=='IDLE'||monster.hpCurrent<=0)throw new Error('monster_unavailable');
  assertAdventureZoneAccess(monster.zoneId,adventureLevel);
  assertAdventureMonsterInZone(monster.zoneId,monster.monsterId);
  const field=routeField(state,agent),candidates=[],dirs=[[0,-1],[-1,0],[1,0],[0,1]];
  for(let order=0;order<dirs.length;order++){
    const [dx,dy]=dirs[order],x=monster.x+dx,y=monster.y+dy;
    if(!isAdventureZoneCell(state,monster.zoneId,x,y)||!walkable(state,x,y))continue;
    if(engagementOccupied(state,agent,x,y,worldMonsterId))continue;
    const distance=routeDistance(field,{x,y});if(distance<0)continue;
    candidates.push({x,y,distance,order});
  }
  candidates.sort((a,b)=>a.distance-b.distance||a.order-b.order||a.y-b.y||a.x-b.x);
  if(!candidates.length)throw new Error('no-path');
  const chosen=candidates[0];
  return Object.freeze({worldMonsterId,zoneId:monster.zoneId,x:chosen.x,y:chosen.y,monsterX:monster.x,monsterY:monster.y,routeDistance:chosen.distance});
}

export function adventureHuntId(agentId,started,worldMonsterId,x,y){
  return 'advhunt:'+agentId+':'+started+':'+worldMonsterId+':'+x+':'+y;
}

export function createAdventureHuntTask(state,agent,worldMonsterId,adventureLevel,engagement,path){
  const monster=wildMonsterById(state,worldMonsterId);
  if(!monster||monster.status!=='IDLE'||monster.zoneId!==engagement?.zoneId)throw new Error('monster_unavailable');
  assertAdventureZoneAccess(monster.zoneId,adventureLevel);
  assertAdventureMonsterInZone(monster.zoneId,monster.monsterId);
  if(!Array.isArray(path)||!isAdventureZoneCell(state,monster.zoneId,engagement?.x,engagement?.y)||
    Math.abs(engagement.x-monster.x)+Math.abs(engagement.y-monster.y)!==1)throw new Error('invalid_hunt_path');
  const started=state.tick,id=adventureHuntId(agent.id,started,worldMonsterId,engagement.x,engagement.y);
  return {
    kind:'EXPLORE',targetId:null,x:engagement.x,y:engagement.y,path:path.map(p=>({x:p.x,y:p.y})),work:0,
    started,score:0,policy:'survival-0.2',
    adventureHunt:Object.freeze({
      version:ADVENTURE_HUNT_VERSION,id,worldMonsterId,zoneId:monster.zoneId,adventureLevel,
      monsterX:monster.x,monsterY:monster.y,targetX:engagement.x,targetY:engagement.y
    })
  };
}

function adventureHuntTaskValid(state,agent,task,{walkable}={}){
  const h=task?.adventureHunt;if(!h)return true;
  if(task.adventureExpedition||task.kind!=='EXPLORE'||!agent?.alive||agent.profession!=='adventurer'||agent.adventureEncounter)return false;
  if(h.version!==ADVENTURE_HUNT_VERSION||typeof h.worldMonsterId!=='string'||typeof h.zoneId!=='string'||!integer(h.adventureLevel,1))return false;
  if(!integer(task.started,0)||h.id!==adventureHuntId(agent.id,task.started,h.worldMonsterId,task.x,task.y))return false;
  const monster=wildMonsterById(state,h.worldMonsterId);
  if(!monster||monster.status!=='IDLE'||monster.hpCurrent<=0||monster.zoneId!==h.zoneId||
    monster.x!==h.monsterX||monster.y!==h.monsterY)return false;
  const taskClaims=(state.agents??[]).filter(other=>other.alive&&other.task?.adventureHunt?.worldMonsterId===h.worldMonsterId)
    .sort((a,b)=>(a.task.started-b.task.started)||a.id-b.id);
  if(taskClaims[0]?.id!==agent.id)return false;
  if((state.agents??[]).some(other=>other.alive&&other.id!==agent.id&&(
    other.adventureEncounter?.worldMonsterId===h.worldMonsterId||
    (other.adventureCombat?.worldMonsterId===h.worldMonsterId&&other.adventureCombat.status==='ACTIVE')
  )))return false;
  try{assertAdventureZoneAccess(h.zoneId,h.adventureLevel);assertAdventureMonsterInZone(h.zoneId,monster.monsterId);}catch{return false;}
  if(h.targetX!==task.x||h.targetY!==task.y||!isAdventureZoneCell(state,h.zoneId,task.x,task.y))return false;
  if(Math.abs(task.x-monster.x)+Math.abs(task.y-monster.y)!==1)return false;
  if(typeof walkable==='function'&&!walkable(state,task.x,task.y))return false;
  return true;
}

export function completeAdventureHunt(state,agent,task){
  if(!adventureHuntTaskValid(state,agent,task))throw new Error('invalid_hunt_completion');
  if(agent.x!==task.x||agent.y!==task.y||task.path.length!==0)throw new Error('hunt_not_arrived');
  const h=task.adventureHunt,monster=wildMonsterById(state,h.worldMonsterId);
  const id='advenc:'+h.id+':'+state.tick+':'+monster.worldMonsterId;
  return Object.freeze({
    version:ADVENTURE_ENCOUNTER_STATE_VERSION,
    encounterId:id,expeditionId:h.id,status:'READY',worldMonsterId:monster.worldMonsterId,
    zoneId:monster.zoneId,monsterId:monster.monsterId,monsterLevel:monster.level,rank:monster.rank,
    adventureLevel:h.adventureLevel,startedTick:task.started,encounterTick:state.tick,x:agent.x,y:agent.y
  });
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
  if(task?.adventureHunt)return adventureHuntTaskValid(state,agent,task,{walkable});
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
  if(e.worldMonsterId!==undefined){
    if(typeof e.worldMonsterId!=='string')return bad;
    const monster=wildMonsterById(state,e.worldMonsterId);
    if(!monster||monster.status!=='IDLE'||monster.worldMonsterId!==e.worldMonsterId||
      monster.zoneId!==e.zoneId||monster.monsterId!==e.monsterId||monster.level!==e.monsterLevel||monster.rank!==e.rank||
      Math.abs(monster.x-e.x)+Math.abs(monster.y-e.y)!==1)return bad;
  }
  return [];
}
