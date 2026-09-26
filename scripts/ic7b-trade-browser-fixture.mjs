import {createWorld,command,serialize,validate,walkable} from '../src/engine.mjs';
import {personalHomeSite} from '../src/individual-housing.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {recordRelationshipEvidence} from '../src/relationships.mjs';
import {resourceStock} from '../src/individual-resources.mjs';

const s=createWorld(230926,{mode:'independent'});
const source=s.agents[1],dest=s.agents[2];

function give(a,kind){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
}
function equipHammer(a){
  const id=give(a,'HAMMER');
  s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>e.agentId!==a.id);
  s.rustPossessions.equipment.push({agentId:a.id,itemId:id});
}
function place(a,kind,socket){
  const id=give(a,kind);
  const r=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'ic7b-browser:'+s.tick+':'+a.id+':'+id});
  if(!r.ok)throw new Error('placement failed '+kind+': '+JSON.stringify(r));
}
function completeHome(a){
  const site=personalHomeSite(s,a,walkable);if(!site)throw new Error('no site');
  a.x=site.origin.x;a.y=site.origin.y;a.task=null;equipHammer(a);
  const {x,y}=site.origin;
  place(a,'WOOD_FOUNDATION',{type:'cell',x,y});
  place(a,'WOOD_WALL',canonicalEdge(x,y,'N'));
  place(a,'WOOD_WALL',canonicalEdge(x,y,'E'));
  place(a,'WOOD_WALL',canonicalEdge(x,y,'W'));
  place(a,'WOOD_DOORWAY',canonicalEdge(x,y,'S'));
  place(a,'WOOD_ROOF',{type:'cell',x,y});
}
completeHome(source);completeHome(dest);
Object.assign(resourceStock(s,source),{food:30,wood:30,stone:20});
Object.assign(resourceStock(s,dest),{food:0,wood:0,stone:0});
for(const row of [
  {fromId:source.id,toId:dest.id,key:'trade-ui:a',delta:{trust:2,affinity:2}},
  {fromId:dest.id,toId:source.id,key:'trade-ui:b',delta:{trust:2,affinity:2}},
]){
  const r=recordRelationshipEvidence(s,{...row,kind:'fixture'});
  if(!r.ok)throw new Error('relationship failed '+JSON.stringify(r));
}
s.tick=119;
const errors=validate(s);if(errors.length)throw new Error('invalid fixture '+errors.join(','));
console.log(serialize(s));
