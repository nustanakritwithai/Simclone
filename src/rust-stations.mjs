import {CRAFT_STATIONS,ITEM_CATALOG,RECIPE_CATALOG} from './crafting-catalog.mjs?v=0.5.0';
export const RUST_STATIONS_VERSION='RS3-0.2';
export const STATION_LIMITS=Object.freeze({maxStations:12,interactionRange:1});
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export const createRustStations=()=>({version:RUST_STATIONS_VERSION,nextStation:1,stations:[]});
export const stationAt=(s,id)=>s.rustStations?.stations.find(x=>x.id===id)??null;
export function availableStationKinds(s){
  const out={HAND:1,CRAFTING_TABLE_LV1:0,FURNACE:0};
  for(const st of s.rustStations?.stations??[])if(st.complete)out[st.kind]=(out[st.kind]??0)+1;
  return out;
}
export function stationForRecipe(s,recipeId,agent,preferredId=null){
  const r=RECIPE_CATALOG[recipeId];if(!r)return null;
  if(r.station===CRAFT_STATIONS.HAND)return {id:null,kind:'HAND',x:agent.x,y:agent.y,complete:true};
  const xs=(s.rustStations?.stations??[]).filter(st=>st.complete&&st.kind===r.station&&(preferredId===null||st.id===preferredId));
  return xs.sort((a,b)=>dist(agent,a)-dist(agent,b)||a.id-b.id)[0]??null;
}
export function canPlaceStation(s,{agentId,itemInstanceId,x,y}={},isWalkable=()=>true){
  const a=s.agents?.find(a=>a.id===agentId&&a.alive),item=s.rustPossessions?.items.find(i=>i.id===itemInstanceId&&i.location?.kind==='bag'&&i.location.agentId===agentId);
  const def=item&&ITEM_CATALOG[item.kind];
  if(!a||!item||!def?.stationProvided)return {ok:false,reason:'actor-or-item'};
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=30||y>=26)return {ok:false,reason:'position'};
  if(dist(a,{x,y})>STATION_LIMITS.interactionRange)return {ok:false,reason:'range'};
  if(!isWalkable(s,x,y))return {ok:false,reason:'terrain'};
  if((s.buildings??[]).some(b=>b.x===x&&b.y===y)||(s.nodes??[]).some(n=>n.x===x&&n.y===y)||(s.rustStations?.stations??[]).some(st=>st.x===x&&st.y===y))return {ok:false,reason:'occupied'};
  if((s.rustStations?.stations?.length??0)>=STATION_LIMITS.maxStations)return {ok:false,reason:'capacity'};
  return {ok:true,agentId,itemInstanceId,x,y,kind:def.stationProvided,buildingType:def.buildingType};
}
export function placeStationFromItem(s,data,isWalkable){
  const check=canPlaceStation(s,data,isWalkable);if(!check.ok)return check;
  const p=s.rustPossessions,rs=s.rustStations;
  p.items=p.items.filter(i=>i.id!==check.itemInstanceId);p.equipment=p.equipment.filter(e=>e.itemId!==check.itemInstanceId);
  const id=rs.nextStation++;rs.stations.push({id,kind:check.kind,buildingType:check.buildingType,x:check.x,y:check.y,complete:true,placedBy:check.agentId,placedTick:s.tick});
  return {ok:true,stationId:id,kind:check.kind,x:check.x,y:check.y};
}
export const RUST_PROCESSING_CATALOG=Object.freeze({
  CHARCOAL:Object.freeze({id:'CHARCOAL',station:'FURNACE',input:Object.freeze({wood:2}),output:Object.freeze({charcoal:1}),work:12,live:true}),
  COOKED_MEAT:Object.freeze({id:'COOKED_MEAT',station:'FURNACE',input:Object.freeze({raw_meat:1}),output:Object.freeze({cooked_meat:1}),work:12,live:false,reason:'meat-ledger-not-authoritative'}),
  CLEAN_WATER:Object.freeze({id:'CLEAN_WATER',station:'FURNACE',input:Object.freeze({dirty_water:1}),output:Object.freeze({clean_water:1}),work:12,live:false,reason:'water-ledger-not-authoritative'})
});
