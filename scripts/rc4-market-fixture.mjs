import {createWorld,command,serialize,validate,walkable} from '../src/engine.mjs';
import {houseSite} from '../src/housing.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {advanceCraft} from '../src/rust-possessions.mjs';

const s=createWorld(230926),merchant=s.agents[0],buyer=s.agents[1];
merchant.satiety=100;merchant.energy=100;buyer.satiety=100;buyer.energy=100;
merchant.task=null;buyer.task=null;

const give=(a,kind)=>{
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
};
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

// Sale item must come from the canonical Rust crafting authority.
const order=command(s,'CRAFT_ITEM',{agentId:merchant.id,recipeId:'STONE_AXE'});
if(!order.ok)throw new Error('sale craft order: '+JSON.stringify(order));
let made=null;
for(let i=0;i<40&&!made?.completed;i++){s.tick++;made=advanceCraft(s,merchant.id);}
if(!made?.completed)throw new Error('sale item did not complete');
const sale=s.rustPossessions.items.find(i=>i.id===made.itemId);
if(!sale||sale.createdBy!==merchant.id||sale.location?.kind!=='bag')throw new Error('sale provenance');

merchant.task=null;buyer.task=null;merchant.moveTick=0;buyer.moveTick=0;
const errors=validate(s);if(errors.length)throw new Error('fixture invalid: '+errors.join(', '));
process.stdout.write(serialize(s));
