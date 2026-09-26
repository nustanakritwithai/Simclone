/**
 * IC7A — read-only estate and lineage heir projection.
 * No inheritance mutation, no title transfer, no material transfer.
 */
import {isIndependent,materialStock} from './individual-resources.mjs?v=0.5.0';
import {individualHouses} from './individual-housing.mjs?v=0.5.0';

const people=s=>[...(s.agents??[]),...(s.archive??[])];
const byId=(s,id)=>people(s).find(a=>a.id===id)??null;

function lineageDistance(s,ancestorId,person){
  if(!person||person.id===ancestorId)return null;
  const map=new Map(people(s).map(a=>[a.id,a]));
  let distance=0,current=person,seen=new Set([person.id]);
  while(Number.isSafeInteger(current?.parentId)&&!seen.has(current.parentId)){
    distance++;
    if(current.parentId===ancestorId)return distance;
    seen.add(current.parentId);
    current=map.get(current.parentId);
    if(!current)return null;
  }
  return null;
}

export function heirCandidates(s,deceasedId){
  const deceased=byId(s,deceasedId);
  if(!deceased||deceased.alive!==false)return [];
  const rows=[];
  for(const a of s.agents??[]){
    if(!a.alive)continue;
    const distance=lineageDistance(s,deceasedId,a);
    if(distance===null)continue;
    rows.push({agentId:a.id,lineageDistance:distance,bornTick:a.bornTick,generation:a.generation});
  }
  return rows.sort((a,b)=>a.lineageDistance-b.lineageDistance||a.bornTick-b.bornTick||a.agentId-b.agentId);
}

export function estateSnapshot(s,deceasedId){
  const deceased=byId(s,deceasedId);
  if(!deceased||deceased.alive!==false)return null;
  const material=isIndependent(s)?materialStock(s,deceasedId):null;
  const houses=individualHouses(s).filter(h=>h.ownerId===deceasedId).map(h=>({
    houseId:h.houseId,
    complete:h.complete,
    constructionOwnerId:h.ownerId,
    originStationId:h.originStationId,
    origin:h.origin?{...h.origin}:null,
  })).sort((a,b)=>a.houseId.localeCompare(b.houseId));
  const droppedItemIds=(s.rustPossessions?.items??[])
    .filter(i=>i.location?.kind==='drop'&&i.location.sourceAgentId===deceasedId)
    .map(i=>i.id).sort((a,b)=>a-b);
  return {
    deceasedId,
    death:deceased.death?structuredClone(deceased.death):null,
    personalMaterials:material?structuredClone(material):null,
    houses,
    droppedItemIds,
    heirCandidates:heirCandidates(s,deceasedId),
  };
}
