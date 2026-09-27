/** Display V1 / DSP1 — pure world presentation read model.
 * Converts authoritative simulation state into immutable render-facing records.
 * It owns no gameplay state, commands, timers, DOM state, camera state or animation state.
 */
import {worldBounds,LARGE_WORLD_BOUNDS} from '../world-bounds.mjs?v=0.5.0';
import {ADVENTURE_ANNEX_ZONES} from '../adventure-annex.mjs?v=0.5.0';
import {monsterDefinition} from '../adventure-monsters.mjs?v=0.5.0';
import {structureDepth} from '../building-visuals.mjs?v=0.5.0';

export const WORLD_PRESENTATION_VERSION='display-dsp1/v1';
export const WORLD_PRESENTATION_KINDS=Object.freeze(['resource','building','station','drop','monster','agent']);

const KIND_ORDER=Object.freeze({resource:0,building:1,station:2,drop:3,monster:4,agent:5});
const visibleMonster=m=>m&&m.status!=='DEFEATED'&&m.status!=='RESPAWNING';
const slug=value=>String(value??'unknown').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'unknown';
const selected=(selection,kind,id)=>selection?.kind===kind&&String(selection.id)===String(id);
const finitePoint=row=>Number.isFinite(row?.x)&&Number.isFinite(row?.y);
const hpRatio=(current,max)=>Number.isFinite(current)&&Number.isFinite(max)&&max>0?Math.max(0,Math.min(1,current/max)):null;

function deepFreeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  for(const child of Object.values(value))deepFreeze(child);
  return Object.freeze(value);
}

function baseEntity(kind,id,x,y,depth,visualKey,selection){
  return {kind,id,x,y,depth,visualKey,selected:selected(selection,kind,id)};
}

function agentActivity(a){
  if(a.adventureCombat)return 'combat:'+a.adventureCombat.status;
  if(a.adventureEncounter)return 'encounter:'+a.adventureEncounter.status;
  if(a.task?.adventureHunt)return 'hunt';
  if(a.task?.adventureExpedition)return 'expedition';
  return a.task?.kind??'idle';
}

export function worldPresentationRegions(state){
  const b=worldBounds(state),coreMaxX=b.profile==='same-world'?LARGE_WORLD_BOUNDS.w-1:b.w-1;
  const rows=[{
    kind:'region',id:'core',label:'Core Settlement',visualKey:'region.core',
    minX:0,maxX:coreMaxX,minY:0,maxY:b.h-1,profile:b.profile
  }];
  if(b.profile==='same-world'){
    for(const zone of ADVENTURE_ANNEX_ZONES)rows.push({
      kind:'region',id:zone.zoneId,label:zone.zoneId.toUpperCase(),visualKey:'region.adventure.'+slug(zone.region),
      minX:zone.minX,maxX:zone.maxX,minY:0,maxY:b.h-1,
      minLevel:zone.minLevel,maxLevel:zone.maxLevel,region:zone.region,profile:b.profile
    });
  }
  return deepFreeze(rows);
}

export function worldPresentationEntities(state,{selection=null}={}){
  const rows=[];

  for(const n of state.nodes??[]){
    if(!finitePoint(n))continue;
    rows.push({
      ...baseEntity('resource',n.id,n.x,n.y,n.x+n.y,'resource.'+slug(n.type),selection),
      resourceType:n.type,amount:n.amount??null,depleted:Number.isFinite(n.amount)?n.amount<=0:false
    });
  }

  for(const b of state.buildings??[]){
    if(b?.type==='shelter'||!finitePoint(b))continue;
    rows.push({
      ...baseEntity('building',b.id,b.x,b.y,b.x+b.y+.1,'building.'+slug(b.type),selection),
      buildingType:b.type,complete:b.complete??null
    });
  }

  for(const st of state.rustStations?.stations??[]){
    if(!finitePoint(st))continue;
    rows.push({
      ...baseEntity('station',st.id,st.x,st.y,structureDepth(st),'station.'+slug(st.kind),selection),
      stationKind:st.kind,socketType:st.socket?.type??null,socketSide:st.socket?.side??null
    });
  }

  for(const item of state.rustPossessions?.items??[]){
    const p=item?.location;
    if(p?.kind!=='drop'||!finitePoint(p))continue;
    rows.push({
      ...baseEntity('drop',item.id,p.x,p.y,p.x+p.y+.15,'item.'+slug(item.kind),selection),
      itemKind:item.kind,sourceAgentId:p.sourceAgentId??null
    });
  }

  for(const m of state.wildMonsters?.entities??[]){
    if(!visibleMonster(m)||!finitePoint(m))continue;
    const def=monsterDefinition(m.monsterId),types=def?.types?[...def.types]:[];
    rows.push({
      ...baseEntity('monster',m.worldMonsterId,m.x,m.y,m.x+m.y+.18,
        'monster.'+slug(def?.speciesId??m.monsterId)+'.stage'+String(def?.stage??1),selection),
      worldMonsterId:m.worldMonsterId,monsterId:m.monsterId,speciesId:def?.speciesId??null,stage:def?.stage??null,
      types,primaryType:types[0]??'Normal',zoneId:m.zoneId,level:m.level,rank:m.rank,status:m.status,
      hpCurrent:m.hpCurrent,hpMax:m.hpMax,hpRatio:hpRatio(m.hpCurrent,m.hpMax),engagedByAgentId:m.engagedByAgentId??null
    });
  }

  for(const a of state.agents??[]){
    if(!a?.alive||!finitePoint(a))continue;
    rows.push({
      ...baseEntity('agent',a.id,a.x,a.y,a.x+a.y+.2,'clone.'+slug(a.profession??'unassigned'),selection),
      name:a.name??null,profession:a.profession??null,lifeStage:a.lifeStage??null,hp:a.hp??null,
      activity:agentActivity(a),targetWorldMonsterId:a.task?.adventureHunt?.worldMonsterId??a.adventureCombat?.worldMonsterId??null
    });
  }

  rows.sort((a,b)=>a.depth-b.depth||(KIND_ORDER[a.kind]-KIND_ORDER[b.kind])||String(a.id).localeCompare(String(b.id)));
  return deepFreeze(rows);
}

export function worldPresentationSnapshot(state,{selection=null}={}){
  const b=worldBounds(state);
  return deepFreeze({
    version:WORLD_PRESENTATION_VERSION,
    bounds:{profile:b.profile,w:b.w,h:b.h},
    regions:worldPresentationRegions(state),
    entities:worldPresentationEntities(state,{selection})
  });
}
