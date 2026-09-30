import test from 'node:test';
import assert from 'node:assert/strict';

import {createWorld,command,step,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {personalHomeSite} from '../src/individual-housing.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {advanceCraft,rustToolMultiplier} from '../src/rust-possessions.mjs';
import {projectHomeMarketForTrade} from '../src/home-market.mjs';
import {observeRc4Markets} from '../src/rc4-market-observation.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {getBalance,totalCurrency} from '../src/currency-wallet.mjs';
import {ECONOMIC_DEMAND_TTL_TICKS} from '../src/economic-demand.mjs';
import {
  ER6_CONSUMER_AUTONOMY_VERSION,consumerAutonomySnapshot
} from '../src/er6-consumer-autonomy.mjs';

const actor=(s,id)=>s.agents.find(a=>a.id===id);
const calm=(...agents)=>{for(const a of agents){a.hp=a.satiety=a.energy=100;a.task=null;a.moveTick=0;}};
function give(s,a,kind){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
}
function equipFixture(s,a,itemId){s.rustPossessions.equipment.push({agentId:a.id,itemId});}
function completeHome(s,a,label){
  const planned=personalHomeSite(s,a,walkable);assert.ok(planned);
  const {x,y}=planned.origin;a.x=x;a.y=y;a.task=null;
  const hammer=give(s,a,'HAMMER');equipFixture(s,a,hammer);
  const place=(kind,socket)=>{
    const id=give(s,a,kind);
    const r=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'er6-home:'+label+':'+id});
    assert.equal(r.ok,true,JSON.stringify(r));
  };
  place('WOOD_FOUNDATION',{type:'cell',x,y});
  place('WOOD_WALL',canonicalEdge(x,y,'N'));
  place('WOOD_WALL',canonicalEdge(x,y,'E'));
  place('WOOD_WALL',canonicalEdge(x,y,'W'));
  place('WOOD_DOORWAY',canonicalEdge(x,y,'S'));
  place('WOOD_ROOF',{type:'cell',x,y});
}
function craftItem(s,a,recipeId){
  a.task=null;
  const order=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId});assert.equal(order.ok,true,JSON.stringify(order));
  let r=null;
  for(let i=0;i<80&&!r?.completed;i++){s.tick++;r=advanceCraft(s,a.id);}
  assert.equal(r?.completed,true,'canonical craft completes');
  return s.rustPossessions.items.find(i=>i.id===r.itemId);
}
function prepareMerchant(s,a,label){
  completeHome(s,a,label);
  give(s,a,'STONE_AXE');
  calm(a);
  const made=command(s,'RC4_CREATE_MARKET',{agentId:a.id});assert.equal(made.ok,true,JSON.stringify(made));
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:a.id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  assert.equal(command(s,'RC4_OPEN_MARKET',{agentId:a.id,marketId:made.marketId}).ok,true);
  return made.marketId;
}
function marketPoint(s,marketId){
  const p=projectHomeMarketForTrade(s,s.homeMarkets,{marketId});assert.equal(p.ok,true,JSON.stringify(p));return p.market;
}
function arriveImmediately(s,agentId,marketId){
  const p=marketPoint(s,marketId),a=actor(s,agentId);
  a.task=null;a.x=p.x;a.y=p.y;observeRc4Markets(s);
  const travel=command(s,'RC4_TRAVEL_TO_MARKET',{agentId,marketId});assert.equal(travel.ok,true,JSON.stringify(travel));
  assert.equal(actor(s,agentId).task.path.length,0);
}
function reachableStart(s,target,minDistance=3){
  for(let r=minDistance;r<12;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    if(Math.abs(dx)+Math.abs(dy)<minDistance)continue;
    const x=target.x+dx,y=target.y+dy;
    if(!walkable(s,x,y))continue;
    const probe={...actor(s,3),x,y};
    const path=(awaitPath=>awaitPath)(null);
    // path validity is delegated to RC4_TRAVEL_TO_MARKET in the actual proof;
    // choose a walkable nearby point deterministically.
    return {x,y};
  }
  return null;
}
function removeNeedTool(s,a,kind){
  const removed=new Set(s.rustPossessions.items.filter(i=>i.kind===kind&&i.location?.kind==='bag'&&i.location.agentId===a.id).map(i=>i.id));
  s.rustPossessions.items=s.rustPossessions.items.filter(i=>!removed.has(i.id));
  s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>!removed.has(e.itemId));
}
function setupConsumerResale(){
  const s=createWorld(926001,{mode:'independent',worldProfile:'same-world',population:4});
  const producer=s.agents[3],merchant=s.agents[0],consumer=s.agents[2];
  calm(producer,merchant,consumer);
  Object.assign(resourceStock(s,producer),{food:500,wood:500,stone:500});
  const item=craftItem(s,producer,'STONE_PICKAXE');
  const marketId=prepareMerchant(s,merchant,'consumer');
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,itemKind:'STONE_PICKAXE',unitPrice:40});
  assert.equal(offer.ok,true,JSON.stringify(offer));
  const accepted=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:producer.id,offerId:offer.offerId,itemId:item.id});
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  arriveImmediately(s,merchant.id,marketId);
  const procurement=s.merchantListings.listings.find(l=>l.id===accepted.listingId);assert.ok(procurement);
  const bought=command(s,'RC4_BUY_LISTING',{buyerId:merchant.id,listingId:procurement.id,listingRevision:procurement.revision});
  assert.equal(bought.ok,true,JSON.stringify(bought));
  actor(s,merchant.id).task=null;
  const listed=command(s,'RC4_CREATE_LISTING',{agentId:merchant.id,itemId:item.id,unitPrice:60,requestId:'er6-consumer-resale'});
  assert.equal(listed.ok,true,JSON.stringify(listed));

  const c=actor(s,consumer.id);
  assert.equal(c.preference,'MINE');assert.equal(c.profession,'miner');
  removeNeedTool(s,c,'STONE_PICKAXE');
  const p=marketPoint(s,marketId);
  c.x=p.x;c.y=p.y;c.task=null;observeRc4Markets(s);
  // Move after observation so the purchase is driven by retained personal knowledge,
  // not by hidden world truth. The actual route is still computed canonically.
  let start=null;
  for(let r=3;r<10&&!start;r++)for(let dy=-r;dy<=r&&!start;dy++)for(let dx=-r;dx<=r;dx++){
    if(Math.abs(dx)+Math.abs(dy)<r||!walkable(s,p.x+dx,p.y+dy))continue;
    c.x=p.x+dx;c.y=p.y+dy;c.task=null;
    const probe=command(s,'RC4_TRAVEL_TO_MARKET',{agentId:c.id,marketId});
    if(probe.ok&&actor(s,c.id).task.path.length>=3){start={x:c.x,y:c.y};actor(s,c.id).task=null;actor(s,c.id).moveTick=0;break;}
    actor(s,c.id).task=null;actor(s,c.id).moveTick=0;
  }
  assert.ok(start,'reachable consumer start');
  // Re-observe once at the market is intentionally not performed.
  return {s,producerId:producer.id,merchantId:merchant.id,consumerId:consumer.id,marketId,itemId:item.id,listingId:listed.listingId};
}

test('ER6 consumer projection is read-only and rejects hidden/stale supply',()=>{
  const f=setupConsumerResale(),s=f.s,c=actor(s,f.consumerId);
  assert.equal(ER6_CONSUMER_AUTONOMY_VERSION,'ER6-consumer-autonomy/1');
  const before=serialize(s),snap=consumerAutonomySnapshot(s,c);
  assert.equal(snap.status,'SAT');assert.equal(snap.type,'TRAVEL_TO_MARKET');assert.equal(snap.listingId,f.listingId);
  assert.equal(serialize(s),before);

  c.rc4MarketKnowledge.knownListings=[];
  const hidden=consumerAutonomySnapshot(s,c);
  assert.equal(hidden.status,'BLOCKED');assert.equal(hidden.reason,'no-observed-supply');

  // Restore the fixture and age knowledge without an observation refresh.
  const g=setupConsumerResale(),staleWorld=g.s,stale=actor(staleWorld,g.consumerId);
  staleWorld.tick+=ECONOMIC_DEMAND_TTL_TICKS+1;
  const staleSnap=consumerAutonomySnapshot(staleWorld,stale);
  assert.equal(staleSnap.status,'BLOCKED');assert.equal(staleSnap.reason,'no-observed-supply');
});

test('ER6 autonomous consumer travels, buys exact canonical item, cancels journey, equips tool and preserves currency',()=>{
  const f=setupConsumerResale();let s=f.s;
  const totalBefore=totalCurrency(s),buyerBefore=getBalance(s,f.consumerId),merchantBefore=getBalance(s,f.merchantId);
  let purchased=false,equipped=false;
  for(let i=0;i<120;i++){
    step(s,1);
    const item=s.rustPossessions.items.find(x=>x.id===f.itemId);
    purchased ||= item?.location?.kind==='bag'&&item.location.agentId===f.consumerId;
    const eq=s.rustPossessions.equipment.find(e=>e.agentId===f.consumerId&&(e.slot??'hand')==='hand');
    equipped ||= eq?.itemId===f.itemId;
    if(purchased&&equipped&&!actor(s,f.consumerId).task?.rc4MarketTravel)break;
  }
  const consumer=actor(s,f.consumerId),merchant=actor(s,f.merchantId),item=s.rustPossessions.items.find(x=>x.id===f.itemId);
  assert.equal(purchased,true,'consumer purchased exact item');
  assert.equal(equipped,true,'consumer equipped purchased tool through Rust authority');
  assert.deepEqual(item.location,{kind:'bag',agentId:f.consumerId});
  assert.ok(rustToolMultiplier(s,consumer,'MINE')>1,'equipped purchased tool affects real productive work');
  assert.equal(getBalance(s,f.consumerId),buyerBefore-60);
  assert.equal(getBalance(s,f.merchantId),merchantBefore+60);
  assert.equal(totalCurrency(s),totalBefore);
  const ledger=s.merchantLedgers.ledgers.find(l=>l.merchantId===f.merchantId);
  assert.equal(ledger.revenue,60);assert.equal(ledger.costOfGoodsSold,40);assert.equal(ledger.realizedProfit,20);
  assert.equal(s.merchantListings.listings.find(l=>l.id===f.listingId).status,'FILLED');
  assert.deepEqual(validate(s),[]);

  const workBefore=consumer.workDone;
  for(let i=0;i<240&&actor(s,f.consumerId).workDone===workBefore;i++)step(s,1);
  assert.ok(actor(s,f.consumerId).workDone>workBefore,'consumer resumes real productive work with purchased tool equipped');

  const wire=serialize(s);s=restore(wire);
  const afterRestore=serialize(s);
  for(let i=0;i<10;i++)step(s,1);
  assert.equal(s.rustPossessions.items.filter(x=>x.id===f.itemId).length,1);
  assert.equal(s.tradeReplay.receipts.filter(r=>r.listingId===f.listingId&&r.buyerId===f.consumerId).length,1);
  assert.equal(totalCurrency(s),totalBefore);
  assert.notEqual(serialize(s),'');
  assert.ok(afterRestore.length>0);
  assert.deepEqual(validate(s),[]);
});

test('ER6 save/load during consumer travel loses runtime provenance safely and replans without replay',()=>{
  const f=setupConsumerResale();let s=f.s;
  step(s,1);
  assert.ok(actor(s,f.consumerId).task?.rc4MarketTravel,'consumer starts canonical market journey');
  const totalBefore=totalCurrency(s);
  s=restore(serialize(s));
  let bought=false;
  for(let i=0;i<160;i++){
    step(s,1);
    const item=s.rustPossessions.items.find(x=>x.id===f.itemId);
    if(item?.location?.kind==='bag'&&item.location.agentId===f.consumerId){bought=true;break;}
  }
  assert.equal(bought,true,'restored consumer safely replans and buys');
  assert.equal(s.tradeReplay.receipts.filter(r=>r.listingId===f.listingId&&r.buyerId===f.consumerId).length,1);
  assert.equal(totalCurrency(s),totalBefore);
  assert.deepEqual(validate(s),[]);
});
