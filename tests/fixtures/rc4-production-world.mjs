import {createWorld,command,step,walkable} from '../../src/engine.mjs';
import {houseSite} from '../../src/housing.mjs';
import {canonicalEdge} from '../../src/rust-stations.mjs';
import {advanceCraft} from '../../src/rust-possessions.mjs';
const requireOk=r=>{if(!r.ok)throw new Error(JSON.stringify(r));return r;};
// Non-claimed prerequisite fixture: canonical modular placement builds the existing home.
function home(world,agent){
  const give=kind=>{const id=world.rustPossessions.nextItem++;world.rustPossessions.items.push({id,kind,createdBy:agent.id,createdTick:world.tick,location:{kind:'bag',agentId:agent.id}});return id;};
  const {x,y}=houseSite(world,walkable).origin;agent.x=x;agent.y=y;
  const hammer=give('HAMMER');world.rustPossessions.equipment.push({agentId:agent.id,itemId:hammer});
  for(const [kind,socket] of [['WOOD_FOUNDATION',{type:'cell',x,y}],['WOOD_WALL',canonicalEdge(x,y,'N')],['WOOD_WALL',canonicalEdge(x,y,'E')],['WOOD_WALL',canonicalEdge(x,y,'W')],['WOOD_DOORWAY',canonicalEdge(x,y,'S')],['WOOD_ROOF',{type:'cell',x,y}]]){
    const itemInstanceId=give(kind);requireOk(command(world,'PLACE_STATION',{agentId:agent.id,itemInstanceId,socket,placementId:'release-home:'+itemInstanceId}));
  }
}
export function productionMarketFixture({price=1}={}){
  const world=createWorld(230926),[producer,merchant,customer]=world.agents;
  for(const a of [producer,merchant,customer]){a.satiety=100;a.energy=100;a.task=null;a.moveTick=0;}
  home(world,merchant);
  requireOk(command(world,'CRAFT_ITEM',{agentId:producer.id,recipeId:'STONE_PICKAXE'}));
  let made;
  for(let i=0;i<40&&!made?.completed;i++){world.tick++;made=advanceCraft(world,producer.id);}
  if(!made?.completed)throw new Error('canonical Producer craft incomplete');
  const {marketId}=requireOk(command(world,'RC4_CREATE_MARKET',{agentId:merchant.id}));
  const offer=requireOk(command(world,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,itemKind:'STONE_PICKAXE',unitPrice:price}));
  requireOk(command(world,'RC4_BECOME_MERCHANT',{agentId:merchant.id}));
  requireOk(command(world,'RC4_OPEN_MARKET',{agentId:merchant.id,marketId}));
  const listing=requireOk(command(world,'RC4_ACCEPT_BUY_OFFER',{producerId:producer.id,offerId:offer.offerId,itemId:made.itemId}));
  return {world,producerId:producer.id,merchantId:merchant.id,customerId:customer.id,marketId,itemId:made.itemId,listingId:listing.listingId};
}
export function travelAndBuy(world,buyerId,listingId){
  const listing=world.merchantListings.listings.find(l=>l.id===listingId);
  requireOk(command(world,'RC4_TRAVEL_TO_MARKET',{agentId:buyerId,marketId:listing.marketId}));
  for(let i=0;i<500;i++){
    const a=world.agents.find(a=>a.id===buyerId);
    if(a.task?.rc4MarketTravel&&a.task.path.length===0)break;
    step(world,1);
  }
  return requireOk(command(world,'RC4_BUY_LISTING',{buyerId,listingId,listingRevision:listing.revision}));
}
export function commitRealTrades(f,count){
  const {world,merchantId,customerId,itemId}=f;
  const first=travelAndBuy(world,merchantId,f.listingId);let last=first;
  for(let i=1;i<count;i++){
    step(world,1);
    if(i%2){
      const l=requireOk(command(world,'RC4_CREATE_LISTING',{agentId:merchantId,itemId,unitPrice:1,requestId:'cycle-'+i}));
      last=travelAndBuy(world,customerId,l.listingId);
    }else{
      const o=requireOk(command(world,'RC4_CREATE_BUY_OFFER',{agentId:merchantId,itemKind:'STONE_PICKAXE',unitPrice:1}));
      const l=requireOk(command(world,'RC4_ACCEPT_BUY_OFFER',{producerId:customerId,offerId:o.offerId,itemId}));
      last=travelAndBuy(world,merchantId,l.listingId);
    }
  }
  return {first,last};
}
