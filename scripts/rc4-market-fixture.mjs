import {createWorld,command,serialize,validate,walkable} from '../src/engine.mjs';
import {houseSite} from '../src/housing.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {advanceCraft} from '../src/rust-possessions.mjs';

const s=createWorld(230926),producer=s.agents[0],merchant=s.agents[1],customer=s.agents[2];
for(const a of [producer,merchant,customer]){a.satiety=100;a.energy=100;a.task=null;a.moveTick=0;}

const give=(a,kind)=>{
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
};

// Browser setup creates only the completed home fixture directly; all claimed RC4
// economy mutations happen later through real UI clicks and engine commands.
const site=houseSite(s,walkable).origin;
merchant.x=site.x;merchant.y=site.y;
const hammer=give(merchant,'HAMMER');
s.rustPossessions.equipment.push({agentId:merchant.id,itemId:hammer});
const place=(kind,socket)=>{
  const id=give(merchant,kind);
  const r=command(s,'PLACE_STATION',{agentId:merchant.id,itemInstanceId:id,socket,placementId:'rc4-browser-home:'+s.tick+':'+merchant.id+':'+id});
  if(!r.ok)throw new Error('home fixture '+kind+': '+JSON.stringify(r));
};
const {x,y}=site;
place('WOOD_FOUNDATION',{type:'cell',x,y});
place('WOOD_WALL',canonicalEdge(x,y,'N'));
place('WOOD_WALL',canonicalEdge(x,y,'E'));
place('WOOD_WALL',canonicalEdge(x,y,'W'));
place('WOOD_DOORWAY',canonicalEdge(x,y,'S'));
place('WOOD_ROOF',{type:'cell',x,y});

const canonicalCraft=(a,recipeId,label)=>{
  a.task=null;
  const order=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId});
  if(!order.ok)throw new Error(label+' craft order: '+JSON.stringify(order));
  let made=null;
  for(let i=0;i<40&&!made?.completed;i++){s.tick++;made=advanceCraft(s,a.id);}
  if(!made?.completed)throw new Error(label+' item did not complete');
  const item=s.rustPossessions.items.find(i=>i.id===made.itemId);
  if(!item||item.createdBy!==a.id||item.location?.kind!=='bag'||item.location.agentId!==a.id)throw new Error(label+' item provenance');
  return item;
};

// Producer A makes the physical item later traded through A -> B -> C.
const sale=canonicalCraft(producer,'STONE_PICKAXE','producer');
// Merchant candidate B independently has real production evidence. No Merchant
// profession or Home Market is injected; runtime autonomy must create those.
const merchantEvidence=canonicalCraft(merchant,'STONE_AXE','merchant-evidence');
if(merchantEvidence.createdBy!==merchant.id)throw new Error('merchant evidence creator');

for(const a of [producer,merchant,customer]){a.task=null;a.moveTick=0;}
const errors=validate(s);if(errors.length)throw new Error('fixture invalid: '+errors.join(', '));
process.stdout.write(serialize(s));
