import {CRAFT_STATIONS,ITEM_CATALOG,RECIPE_CATALOG} from './crafting-catalog.mjs';

export const RUST_STATIONS_VERSION='RS3-0.1';
export const STATION_LIMITS=Object.freeze({maxStations:12,interactionRange:1});

const copy=v=>JSON.parse(JSON.stringify(v));
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const stationDefByItem=itemId=>{
  const item=ITEM_CATALOG[itemId];
  if(!item?.stationProvided||!item?.buildingType)return null;
  return item;
};
const stationRecipe=id=>{
  const r=RECIPE_CATALOG[id];
  return r?.category==='build'&&stationDefByItem(r.output)?r:null;
};

export function createRustStations(){return {version:RUST_STATIONS_VERSION,nextStation:1,stations:[]};}

export function stationAt(s,id){return s.rustStations?.stations.find(x=>x.id===id)??null;}

export function availableStationKinds(s){
  const out={[CRAFT_STATIONS.HAND]:1,[CRAFT_STATIONS.CRAFTING_TABLE_LV1]:0,[CRAFT_STATIONS.FURNACE]:0};
  for(const st of s.rustStations?.stations??[])if(st.complete)out[st.kind]=(out[st.kind]??0)+1;
  return out;
}

export function canPlaceStation(s,{itemId,x,y}={}){
  const def=stationDefByItem(itemId),r=stationRecipe(itemId);
  if(!def||!r)return {ok:false,reason:'item'};
  if(!Number.isInteger(x)||!Number.isInteger(y))return {ok:false,reason:'position'};
  const rs=s.rustStations;if(!rs)return {ok:false,reason:'state'};
  if(rs.stations.length>=STATION_LIMITS.maxStations)return {ok:false,reason:'capacity'};
  if((s.buildings??[]).some(b=>b.x===x&&b.y===y)||(rs.stations??[]).some(b=>b.x===x&&b.y===y))return {ok:false,reason:'occupied'};
  if(typeof s.walkable==='function'&&!s.walkable(x,y))return {ok:false,reason:'terrain'};
  return {ok:true,itemId,stationKind:def.stationProvided,buildingType:def.buildingType,x,y};
}

export function placeStationFromItem(s,{agentId,itemId,x,y}={}){
  const a=s.agents?.find(a=>a.id===agentId&&a.alive===true);
  const p=s.rustPossessions,rs=s.rustStations;
  const item=p?.items.find(i=>i.kind===itemId&&i.location.kind==='bag'&&i.location.agentId===agentId);
  if(!a||!item||!rs)return {ok:false,reason:'actor-or-item'};
  if(dist(a,{x,y})>STATION_LIMITS.interactionRange)return {ok:false,reason:'range'};
  const check=canPlaceStation(s,{itemId,x,y});if(!check.ok)return check;
  p.items=p.items.filter(i=>i.id!==item.id);
  p.equipment=p.equipment.filter(e=>e.itemId!==item.id);
  const id=rs.nextStation++;
  rs.stations.push({id,kind:check.stationKind,buildingType:check.buildingType,x,y,complete:true,placedBy:agentId,placedTick:s.tick});
  return {ok:true,stationId:id,kind:check.stationKind,x,y};
}

export function stationRequirementMet(s,recipeId,agentId){
  const r=RECIPE_CATALOG[recipeId];if(!r)return {ok:false,reason:'recipe'};
  if(r.station===CRAFT_STATIONS.HAND)return {ok:true,stationId:null};
  const a=s.agents?.find(a=>a.id===agentId&&a.alive===true);if(!a)return {ok:false,reason:'actor'};
  const candidates=(s.rustStations?.stations??[])
    .filter(st=>st.complete&&st.kind===r.station)
    .sort((x,y)=>dist(a,x)-dist(a,y)||x.id-y.id);
  const st=candidates[0];if(!st)return {ok:false,reason:'station',station:r.station};
  return {ok:true,stationId:st.id,distance:dist(a,st)};
}

export const RUST_PROCESSING_CATALOG=Object.freeze({
  CHARCOAL:Object.freeze({id:'CHARCOAL',donorOut:'charcoal',station:CRAFT_STATIONS.FURNACE,input:Object.freeze({wood:2}),output:Object.freeze({charcoal:1}),live:false,reason:'charcoal-not-authoritative-yet'}),
  COOKED_MEAT:Object.freeze({id:'COOKED_MEAT',donorOut:'cooked_meat',station:CRAFT_STATIONS.FURNACE,input:Object.freeze({raw_meat:1}),output:Object.freeze({cooked_meat:1}),live:false,reason:'meat-ledger-not-authoritative-yet'}),
  CLEAN_WATER:Object.freeze({id:'CLEAN_WATER',donorOut:'clean_water',station:CRAFT_STATIONS.FURNACE,input:Object.freeze({dirty_water:1}),output:Object.freeze({clean_water:1}),live:false,reason:'water-ledger-not-authoritative-yet'})
});

export function processingAvailability(s,processId,agentId){
  const p=RUST_PROCESSING_CATALOG[processId];if(!p)return {ok:false,reason:'process'};
  const a=s.agents?.find(a=>a.id===agentId&&a.alive===true);if(!a)return {ok:false,reason:'actor'};
  const matches=(s.rustStations?.stations??[]).filter(st=>st.complete&&st.kind===p.station).sort((x,y)=>dist(a,x)-dist(a,y)||x.id-y.id);
  if(!matches.length)return {ok:false,reason:'station',station:p.station};
  if(!p.live)return {ok:false,reason:'not-authoritative',processId:p.id,stationId:matches[0].id,detail:p.reason};
  return {ok:true,processId:p.id,stationId:matches[0].id};
}

export function rustStationsSnapshot(s){
  return copy({version:s.rustStations?.version??null,stations:s.rustStations?.stations??[],available:availableStationKinds(s),processing:Object.values(RUST_PROCESSING_CATALOG)});
}
