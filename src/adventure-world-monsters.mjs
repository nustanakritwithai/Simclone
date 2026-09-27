/** SWA2 — one authoritative Wild Monster world-state ledger.
 * Wild monsters are physical enemies in the Same-World Adventure Annex.
 * This module owns initial deterministic spawn state only; rendering, hunting,
 * combat binding, defeat and respawn transitions belong to later SWA gates.
 */
import {worldBounds} from './world-bounds.mjs?v=0.5.0';
import {ADVENTURE_ANNEX_ZONES,adventureAnnexZoneAt} from './adventure-annex.mjs?v=0.5.0';
import {adventureZoneById,assertAdventureMonsterInZone} from './adventure-zones.mjs?v=0.5.0';
import {monsterStatsAtLevel} from './adventure-monster-stats.mjs?v=0.5.0';

export const WILD_MONSTER_WORLD_VERSION='SWA2-0.1';
export const WILD_MONSTER_INITIAL_PER_ZONE=3;
export const WILD_MONSTER_INITIAL_COUNT=12;
export const WILD_MONSTER_INITIAL_STATUS='IDLE';

function mix(seed,a,b,salt=0){
  let n=(seed^Math.imul((a|0)+101+salt,374761393)^Math.imul((b|0)+313+salt,668265263))>>>0;
  n^=n>>>13;n=Math.imul(n,1274126177)>>>0;n^=n>>>16;
  return n>>>0;
}
const key=(x,y)=>x+':'+y;

function occupiedCells(state){
  const out=new Set();
  for(const row of state.nodes??[])out.add(key(row.x,row.y));
  for(const row of state.buildings??[])out.add(key(row.x,row.y));
  for(const row of state.rustStations?.stations??[])out.add(key(row.x,row.y));
  for(const row of state.agents??[])if(row?.alive)out.add(key(row.x,row.y));
  for(const item of state.rustPossessions?.items??[]){
    const p=item?.location;
    if(p?.kind==='drop'&&Number.isInteger(p.x)&&Number.isInteger(p.y))out.add(key(p.x,p.y));
  }
  return out;
}

function rankedMonsterIds(seed,zone,zoneIndex){
  const roster=adventureZoneById(zone.zoneId).rosterIds;
  return roster.map((monsterId,index)=>({monsterId,index,rank:mix(seed,zoneIndex,index,1201)}))
    .sort((a,b)=>a.rank-b.rank||a.index-b.index)
    .slice(0,WILD_MONSTER_INITIAL_PER_ZONE)
    .map(row=>row.monsterId);
}

function spawnCell(state,zone,zoneIndex,slot,occupied){
  const bounds=worldBounds(state),candidates=[];
  for(let y=1;y<bounds.h-1;y++)for(let x=zone.minX;x<=zone.maxX;x++){
    if(state.tiles?.[y*bounds.w+x]!=='grass')continue;
    if(occupied.has(key(x,y)))continue;
    candidates.push({x,y,rank:mix(state.seed,x,y,1301+zoneIndex*17+slot*101)});
  }
  candidates.sort((a,b)=>a.rank-b.rank||a.y-b.y||a.x-b.x);
  const found=candidates[0];
  if(!found)throw new Error('wild_monster_no_spawn_cell');
  return {x:found.x,y:found.y};
}

function monsterLevel(seed,zone,zoneIndex,slot){
  const span=zone.maxLevel-zone.minLevel+1;
  return zone.minLevel+(mix(seed,zoneIndex,slot,1409)%span);
}

function monsterRank(seed,zoneIndex,slot){
  return mix(seed,zoneIndex,slot,1511)%5===0?'elite':'normal';
}

export function createInitialWildMonsterWorld(state){
  if(worldBounds(state).profile!=='same-world')throw new Error('wild_monster_requires_same_world');
  const occupied=occupiedCells(state),entities=[];
  for(const [zoneIndex,zone] of ADVENTURE_ANNEX_ZONES.entries()){
    const ids=rankedMonsterIds(state.seed,zone,zoneIndex);
    for(let slot=0;slot<WILD_MONSTER_INITIAL_PER_ZONE;slot++){
      const monsterId=ids[slot],level=monsterLevel(state.seed,zone,zoneIndex,slot);
      const stats=monsterStatsAtLevel(monsterId,level);
      if(!stats.ok)throw new Error('wild_monster_stats');
      const pos=spawnCell(state,zone,zoneIndex,slot,occupied);
      occupied.add(key(pos.x,pos.y));
      const spawnEpoch=0;
      entities.push({
        worldMonsterId:`wm:${zone.zoneId}:${slot}:${spawnEpoch}`,
        monsterId,zoneId:zone.zoneId,level,rank:monsterRank(state.seed,zoneIndex,slot),
        x:pos.x,y:pos.y,hpMax:stats.stats.hp,hpCurrent:stats.stats.hp,
        status:WILD_MONSTER_INITIAL_STATUS,spawnSlot:slot,spawnEpoch,
        spawnedTick:state.tick,defeatedTick:null,respawnTick:null,engagedByAgentId:null
      });
    }
  }
  return {
    version:WILD_MONSTER_WORLD_VERSION,
    policy:'three-per-zone-static-v1',
    entities
  };
}

export function ensureWildMonsterWorld(state){
  const profile=worldBounds(state).profile;
  if(profile!=='same-world')return {ok:true,changed:false};
  if(state.wildMonsters!==undefined&&state.wildMonsters!==null)return {ok:true,changed:false};
  state.wildMonsters=createInitialWildMonsterWorld(state);
  return {ok:true,changed:true};
}

export function wildMonsterById(state,worldMonsterId){
  return state?.wildMonsters?.entities?.find(m=>m.worldMonsterId===worldMonsterId)??null;
}

export function validateWildMonsterWorld(state){
  const same=worldBounds(state).profile==='same-world',world=state?.wildMonsters;
  if(!same)return world===undefined||world===null?[]:['Wild monsters'];
  if(!world||world.version!==WILD_MONSTER_WORLD_VERSION||world.policy!=='three-per-zone-static-v1'||
    !Array.isArray(world.entities)||world.entities.length!==WILD_MONSTER_INITIAL_COUNT)return ['Wild monsters'];

  const ids=new Set(),monsterIds=new Set(),positions=new Set(),counts=new Map();
  const occupied=occupiedCells(state),bounds=worldBounds(state);
  for(const m of world.entities){
    if(!m||typeof m!=='object'||Array.isArray(m))return ['Wild monsters'];
    if(typeof m.worldMonsterId!=='string'||ids.has(m.worldMonsterId))return ['Wild monsters'];
    ids.add(m.worldMonsterId);
    if(typeof m.monsterId!=='string'||monsterIds.has(m.monsterId))return ['Wild monsters'];
    monsterIds.add(m.monsterId);
    if(!Number.isInteger(m.spawnSlot)||m.spawnSlot<0||m.spawnSlot>=WILD_MONSTER_INITIAL_PER_ZONE||m.spawnEpoch!==0||
      m.worldMonsterId!==`wm:${m.zoneId}:${m.spawnSlot}:${m.spawnEpoch}`)return ['Wild monsters'];
    const zone=ADVENTURE_ANNEX_ZONES.find(z=>z.zoneId===m.zoneId);
    if(!zone||!Number.isInteger(m.level)||m.level<zone.minLevel||m.level>zone.maxLevel)return ['Wild monsters'];
    try{assertAdventureMonsterInZone(m.zoneId,m.monsterId);}catch{return ['Wild monsters'];}
    if(!['normal','elite'].includes(m.rank)||m.status!==WILD_MONSTER_INITIAL_STATUS)return ['Wild monsters'];
    if(!Number.isInteger(m.x)||!Number.isInteger(m.y)||adventureAnnexZoneAt(m.x,m.y)?.zoneId!==m.zoneId||
      state.tiles?.[m.y*bounds.w+m.x]==='water')return ['Wild monsters'];
    const pkey=key(m.x,m.y);
    if(positions.has(pkey)||occupied.has(pkey))return ['Wild monsters'];
    positions.add(pkey);
    const stats=monsterStatsAtLevel(m.monsterId,m.level);
    if(!stats.ok||m.hpMax!==stats.stats.hp||m.hpCurrent!==m.hpMax)return ['Wild monsters'];
    if(!Number.isInteger(m.spawnedTick)||m.spawnedTick<0||m.spawnedTick>state.tick||
      m.defeatedTick!==null||m.respawnTick!==null||m.engagedByAgentId!==null)return ['Wild monsters'];
    counts.set(m.zoneId,(counts.get(m.zoneId)??0)+1);
  }
  for(const zone of ADVENTURE_ANNEX_ZONES)if(counts.get(zone.zoneId)!==WILD_MONSTER_INITIAL_PER_ZONE)return ['Wild monsters'];
  return [];
}
