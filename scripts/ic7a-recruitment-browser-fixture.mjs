import {createWorld,command,serialize,validate,walkable} from '../src/engine.mjs';
import {personalHomeSite} from '../src/individual-housing.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {recordRelationshipEvidence} from '../src/relationships.mjs';
import {resourceStock} from '../src/individual-resources.mjs';

const s=createWorld(230926,{mode:'independent',population:3});
const subject=s.agents[1],owner=s.agents[2];

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
  const r=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'ic7a-browser:'+s.tick+':'+a.id+':'+id});
  if(!r.ok)throw new Error('placement failed '+kind+': '+JSON.stringify(r));
}
const site=personalHomeSite(s,owner,walkable);
if(!site)throw new Error('no owner home site');
owner.x=site.origin.x;owner.y=site.origin.y;owner.task=null;equipHammer(owner);
const {x,y}=site.origin;
place(owner,'WOOD_FOUNDATION',{type:'cell',x,y});
place(owner,'WOOD_WALL',canonicalEdge(x,y,'N'));
place(owner,'WOOD_WALL',canonicalEdge(x,y,'E'));
place(owner,'WOOD_WALL',canonicalEdge(x,y,'W'));
place(owner,'WOOD_DOORWAY',canonicalEdge(x,y,'S'));
place(owner,'WOOD_ROOF',{type:'cell',x,y});

for(const row of [
  {fromId:subject.id,toId:owner.id,key:'recruit-fixture:from',delta:{trust:4,affinity:2}},
  {fromId:owner.id,toId:subject.id,key:'recruit-fixture:to',delta:{affinity:2}},
]){
  const r=recordRelationshipEvidence(s,{...row,kind:'fixture'});
  if(!r.ok)throw new Error('relationship failed '+JSON.stringify(r));
}
const pool=resourceStock(s,owner);pool.food=0;pool.wood=30;pool.stone=20;
s.tick=59;
const errors=validate(s);if(errors.length)throw new Error('invalid fixture '+errors.join(','));
console.log(serialize(s));
