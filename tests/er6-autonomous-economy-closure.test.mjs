import test from 'node:test';
import assert from 'node:assert/strict';

import {createWorld,command,step,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {personalHomeSite} from '../src/individual-housing.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {advanceCraft,toolMultiplier} from '../src/rust-possessions.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {producerSurplusSnapshot} from '../src/raw-producer-autonomy.mjs';
import {TRADE_ASSET_TYPES} from '../src/trade-assets.mjs';
import {CRAFT_TRAINING_RULES} from '../src/craft-training.mjs';
import {CRAFT_RECIPE_CATALOG} from '../src/crafting-catalog.mjs';
import {craftFixtureItem,craftFixtureTable,craftFixtureHome} from './fixtures/rc2-world.mjs';
import {projectHomeMarketForTrade} from '../src/home-market.mjs';
import {observeRc4Markets} from '../src/rc4-market-observation.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {getBalance,totalCurrency} from '../src/currency-wallet.mjs';
import {ECONOMIC_DEMAND_TTL_TICKS,projectActorObservedDemand} from '../src/economic-demand.mjs';
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
  assert.ok(toolMultiplier(s,consumer.id,'MINE')>1,'equipped purchased tool affects real productive work');
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


function dropBagFixture(s,a,{keep=new Set()}={}){
  const moved=[];
  for(const item of s.rustPossessions.items){
    if(item.location?.kind!=='bag'||item.location.agentId!==a.id||keep.has(item.id))continue;
    item.location={kind:'drop',sourceAgentId:a.id,tick:s.tick,x:a.x,y:a.y};moved.push(item.id);
  }
  if(moved.length){
    const ids=new Set(moved);
    s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>!ids.has(e.itemId));
  }
  a.task=null;a.moveTick=0;
  return moved;
}

function closureCrafterFixture(s,a){
  Object.assign(resourceStock(s,a),{food:900,wood:900,stone:900,ironIngot:120,steelIngot:90});
  calm(a);
  adoptProfession(a,'BUILD',s.tick);
  craftFixtureTable(s,a);
  craftFixtureHome(s,a);
  craftFixtureItem(s,a,'HAMMER');
  craftFixtureItem(s,a,'HAMMER_T2');
  craftFixtureItem(s,a,'HAMMER');
  craftFixtureItem(s,a,'HAMMER_T2');
  craftFixtureItem(s,a,'HAMMER');
  const promoted=command(s,'RC5_BECOME_CRAFTER',{agentId:a.id});
  assert.equal(promoted.ok,true,JSON.stringify(promoted));
  assert.equal(a.profession,'crafter');
  dropBagFixture(s,a);
}

function closureProducerFixture(s,a){
  Object.assign(resourceStock(s,a),{food:900,wood:900,stone:900});
  calm(a);a.preference='WOODCUT';adoptProfession(a,'WOODCUT',s.tick);
  assert.equal(a.profession,'woodcutter');
  const axe=craftFixtureItem(s,a,'STONE_AXE');
  assert.equal(command(s,'EQUIP_ITEM',{agentId:a.id,itemId:axe.id}).ok,true);
  return axe.id;
}

function placeAtMarketFixture(s,marketId,...agents){
  const p=marketPoint(s,marketId);
  for(const a of agents){a.x=p.x;a.y=p.y;a.task=null;a.moveTick=0;}
  observeRc4Markets(s);
  return p;
}

function dropSpecificFixture(s,a,itemId){
  const item=s.rustPossessions.items.find(i=>i.id===itemId);
  assert.ok(item);
  item.location={kind:'drop',sourceAgentId:a.id,tick:s.tick,x:a.x,y:a.y};
  s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>e.itemId!==itemId);
  a.task=null;a.moveTick=0;
}

function bootstrapPhysicalPriceFixture(s,{merchant,crafter,consumer,marketId}){
  const sample=craftFixtureItem(s,crafter,'STONE_PICKAXE');
  placeAtMarketFixture(s,marketId,merchant,consumer);
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,itemKind:'STONE_PICKAXE',unitPrice:1});
  assert.equal(offer.ok,true,JSON.stringify(offer));
  const accepted=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:crafter.id,offerId:offer.offerId,itemId:sample.id});
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  arriveImmediately(s,merchant.id,marketId);
  const procurement=s.merchantListings.listings.find(l=>l.id===accepted.listingId);assert.ok(procurement);
  const bought=command(s,'RC4_BUY_LISTING',{buyerId:merchant.id,listingId:procurement.id,listingRevision:procurement.revision});
  assert.equal(bought.ok,true,JSON.stringify(bought));
  actor(s,merchant.id).task=null;
  const resale=command(s,'RC4_CREATE_LISTING',{agentId:merchant.id,itemId:sample.id,unitPrice:1,requestId:'er6-final-bootstrap-product'});
  assert.equal(resale.ok,true,JSON.stringify(resale));
  arriveImmediately(s,consumer.id,marketId);
  const listing=s.merchantListings.listings.find(l=>l.id===resale.listingId);assert.ok(listing);
  const consumed=command(s,'RC4_BUY_LISTING',{buyerId:consumer.id,listingId:listing.id,listingRevision:listing.revision});
  assert.equal(consumed.ok,true,JSON.stringify(consumed));
  actor(s,consumer.id).task=null;
  dropSpecificFixture(s,consumer,sample.id);
  return sample.id;
}

function bootstrapWoodPriceFixture(s,{merchant,crafter,producer,consumer,marketId}){
  resourceStock(s,producer).wood=100;
  resourceStock(s,crafter).wood=0;
  placeAtMarketFixture(s,marketId,merchant,crafter,producer,consumer);
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{
    agentId:merchant.id,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,itemKind:'wood',quantityWanted:1,unitPrice:1
  });
  assert.equal(offer.ok,true,JSON.stringify(offer));
  const accepted=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:producer.id,offerId:offer.offerId,quantity:1});
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  arriveImmediately(s,merchant.id,marketId);
  const procurement=s.merchantListings.listings.find(l=>l.id===accepted.listingId);assert.ok(procurement);
  const bought=command(s,'RC4_BUY_LISTING',{buyerId:merchant.id,listingId:procurement.id,listingRevision:procurement.revision,quantity:1});
  assert.equal(bought.ok,true,JSON.stringify(bought));
  actor(s,merchant.id).task=null;
  const resale=command(s,'RC4_CREATE_LISTING',{
    agentId:merchant.id,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,itemKind:'wood',quantity:1,unitPrice:1,requestId:'er6-final-bootstrap-wood'
  });
  assert.equal(resale.ok,true,JSON.stringify(resale));
  arriveImmediately(s,crafter.id,marketId);
  const listing=s.merchantListings.listings.find(l=>l.id===resale.listingId);assert.ok(listing);
  const consumed=command(s,'RC4_BUY_LISTING',{buyerId:crafter.id,listingId:listing.id,listingRevision:listing.revision,quantity:1});
  assert.equal(consumed.ok,true,JSON.stringify(consumed));
  actor(s,crafter.id).task=null;
}

function uniqueCanonicalIds(s){
  const unique=(rows,key)=>new Set(rows.map(x=>x[key])).size===rows.length;
  return unique(s.rustPossessions.items,'id')&&
    unique(s.merchantListings.listings,'id')&&
    unique(s.merchantBuyOffers.buyOffers,'offerId')&&
    unique(s.merchantReservations.reservations,'id')&&
    unique(s.tradeReplay.receipts,'transactionId');
}

function setupFourRoleClosure(){
  const s=createWorld(926006,{mode:'independent',worldProfile:'same-world',population:4});
  const merchant=s.agents[0],crafter=s.agents[1],consumer=s.agents[2],producer=s.agents[3];
  for(const a of s.agents){Object.assign(resourceStock(s,a),{food:900,wood:900,stone:900});calm(a);}
  closureCrafterFixture(s,crafter);
  const producerAxeId=closureProducerFixture(s,producer);
  consumer.preference='MINE';adoptProfession(consumer,'MINE',s.tick);calm(consumer);
  const marketId=prepareMerchant(s,merchant,'four-role');
  dropBagFixture(s,merchant);
  placeAtMarketFixture(s,marketId,merchant,crafter,consumer,producer);
  const sampleItemId=bootstrapPhysicalPriceFixture(s,{merchant,crafter,consumer,marketId});
  bootstrapWoodPriceFixture(s,{merchant,crafter,producer,consumer,marketId});

  const producerReserve=producerSurplusSnapshot(s,producer,'wood');
  assert.equal(producerReserve.status,'SAT',JSON.stringify(producerReserve));
  Object.assign(resourceStock(s,producer),{food:100,wood:producerReserve.protectedReserve,stone:100});
  const recipe=CRAFT_RECIPE_CATALOG.STONE_PICKAXE;
  Object.assign(resourceStock(s,crafter),{
    food:100,
    wood:CRAFT_TRAINING_RULES.wood+(recipe.materials.wood??0)-1,
    stone:100
  });
  Object.assign(resourceStock(s,merchant),{food:100,wood:0,stone:100});
  Object.assign(resourceStock(s,consumer),{food:100,wood:0,stone:100});
  dropBagFixture(s,crafter);
  removeNeedTool(s,consumer,'STONE_PICKAXE');
  placeAtMarketFixture(s,marketId,merchant,crafter,consumer,producer);
  calm(merchant,crafter,consumer,producer);
  consumer.preference='MINE';producer.preference='WOODCUT';
  // Restore the Producer's canonical tool after the fixture cleanup/reset.
  const axe=s.rustPossessions.items.find(i=>i.id===producerAxeId);
  assert.ok(axe?.location?.kind==='bag'&&axe.location.agentId===producer.id);
  assert.ok(s.rustPossessions.equipment.some(e=>e.agentId===producer.id&&e.itemId===producerAxeId));
  const need=projectActorObservedDemand(s,consumer).signals.find(x=>x.itemKind==='STONE_PICKAXE');
  assert.ok(need?.sources.some(x=>x.kind==='PERSONAL_ITEM_NEED'),'consumer starts with a real released tool need');
  assert.deepEqual(validate(s),[]);
  return {s,merchantId:merchant.id,crafterId:crafter.id,consumerId:consumer.id,producerId:producer.id,marketId,
    sampleItemId,producerReserve:producerReserve.protectedReserve,startTick:s.tick};
}

test('ER6 final four-role loop closes once, begins a second cycle, conserves state and survives long-horizon replay',()=>{
  const f=setupFourRoleClosure();let s=f.s;
  const startCurrency=totalCurrency(s),startTick=s.tick;
  const startWood={
    producer:resourceStock(s,actor(s,f.producerId)).wood,
    crafter:resourceStock(s,actor(s,f.crafterId)).wood,
    merchant:resourceStock(s,actor(s,f.merchantId)).wood
  };
  const checkpoints={beforeMaterial:serialize(s)};
  let liveItemId=null,firstCycleTick=null,consumerWorkAtEquip=null,secondCycle=false;
  let sawProducerSale=false,sawCrafterMaterialBuy=false,sawCraft=false,sawMerchantBuy=false,sawMerchantListing=false,sawConsumerBuy=false;
  for(let i=0;i<2600;i++){
    step(s,1);
    const producer=actor(s,f.producerId),crafter=actor(s,f.crafterId),consumer=actor(s,f.consumerId);
    const openWoodOffer=s.merchantBuyOffers.buyOffers.find(o=>o.buyerId===f.merchantId&&o.itemKind==='wood'&&o.status==='OPEN'&&o.createdTick>=startTick);
    if(openWoodOffer&&!checkpoints.afterBuyOffer)checkpoints.afterBuyOffer=serialize(s);
    if(!checkpoints.duringTravel&&s.agents.some(a=>a.task?.rc4MarketTravel))checkpoints.duringTravel=serialize(s);

    const producerReceipt=s.tradeReplay.receipts.find(r=>r.sellerId===f.producerId&&r.buyerId===f.merchantId&&r.itemKind==='wood');
    if(producerReceipt){sawProducerSale=true;if(!checkpoints.afterResourceSettlement)checkpoints.afterResourceSettlement=serialize(s);}
    if(s.tradeReplay.receipts.some(r=>r.sellerId===f.merchantId&&r.buyerId===f.crafterId&&r.itemKind==='wood'))sawCrafterMaterialBuy=true;

    const liveItem=s.rustPossessions.items.find(x=>x.kind==='STONE_PICKAXE'&&x.createdBy===f.crafterId&&x.createdTick>=startTick);
    if(liveItem){
      liveItemId??=liveItem.id;sawCraft=true;
      if(!checkpoints.afterCraft)checkpoints.afterCraft=serialize(s);
    }
    if(liveItemId!==null){
      const merchantReceipt=s.tradeReplay.receipts.find(r=>r.sellerId===f.crafterId&&r.buyerId===f.merchantId&&r.itemIds?.includes(liveItemId));
      if(merchantReceipt){sawMerchantBuy=true;if(!checkpoints.afterMerchantPurchase)checkpoints.afterMerchantPurchase=serialize(s);}
      const listing=s.merchantListings.listings.find(l=>l.sellerId===f.merchantId&&l.itemInstanceId===liveItemId);
      if(listing){sawMerchantListing=true;if(!checkpoints.afterListing)checkpoints.afterListing=serialize(s);}
      const consumerReceipt=s.tradeReplay.receipts.find(r=>r.sellerId===f.merchantId&&r.buyerId===f.consumerId&&r.itemIds?.includes(liveItemId));
      if(consumerReceipt){
        sawConsumerBuy=true;
        if(!checkpoints.afterConsumerPurchase)checkpoints.afterConsumerPurchase=serialize(s);
        if(firstCycleTick===null)firstCycleTick=s.tick;
      }
      const equipped=s.rustPossessions.equipment.some(e=>e.agentId===f.consumerId&&(e.slot??'hand')==='hand'&&e.itemId===liveItemId);
      if(firstCycleTick!==null&&equipped&&consumerWorkAtEquip===null)consumerWorkAtEquip=consumer.workDone;
    }
    if(firstCycleTick!==null){
      const nextOffer=s.merchantBuyOffers.buyOffers.find(o=>o.buyerId===f.merchantId&&o.status==='OPEN'&&o.createdTick>firstCycleTick&&['wood','STONE_PICKAXE'].includes(o.itemKind));
      if(nextOffer)secondCycle=true;
    }
    const used=consumerWorkAtEquip!==null&&consumer.workDone>consumerWorkAtEquip;
    if(sawProducerSale&&sawCrafterMaterialBuy&&sawCraft&&sawMerchantBuy&&sawMerchantListing&&sawConsumerBuy&&secondCycle&&used)break;
  }

  assert.equal(sawProducerSale,true,'Producer must sell canonical wood to Merchant');
  assert.equal(sawCrafterMaterialBuy,true,'Crafter must procure Merchant wood canonically');
  assert.equal(sawCraft,true,'Crafter must craft a real physical product');
  assert.equal(sawMerchantBuy,true,'Merchant must buy the exact Crafter product');
  assert.equal(sawMerchantListing,true,'Merchant must list acquired stock');
  assert.equal(sawConsumerBuy,true,'Consumer must buy the exact listed product');
  assert.equal(secondCycle,true,'fulfilled demand must lead to a later autonomous economic cycle');
  assert.notEqual(liveItemId,null);
  const finalItem=s.rustPossessions.items.find(x=>x.id===liveItemId);
  assert.deepEqual(finalItem.location,{kind:'bag',agentId:f.consumerId});
  assert.ok(s.rustPossessions.equipment.some(e=>e.agentId===f.consumerId&&(e.slot??'hand')==='hand'&&e.itemId===liveItemId));
  assert.ok(toolMultiplier(s,f.consumerId,'MINE')>1,'purchased item must affect real productive work');
  assert.ok(actor(s,f.consumerId).workDone>consumerWorkAtEquip,'consumer must actually resume productive use');
  assert.equal(totalCurrency(s),startCurrency,'closed loop conserves canonical currency');
  assert.ok(resourceStock(s,actor(s,f.producerId)).wood>=f.producerReserve,'Producer reserve remains protected');
  assert.equal(s.rustPossessions.items.filter(x=>x.id===liveItemId).length,1,'exact physical item is never duplicated');
  assert.equal(uniqueCanonicalIds(s),true,'canonical ids/replay identities stay unique');
  assert.deepEqual(validate(s),[]);

  for(const key of ['beforeMaterial','afterBuyOffer','duringTravel','afterResourceSettlement','afterCraft','afterMerchantPurchase','afterListing','afterConsumerPurchase']){
    assert.ok(checkpoints[key],key+' checkpoint must exist');
    const restored=restore(checkpoints[key]);
    step(restored,3);
    assert.equal(uniqueCanonicalIds(restored),true,key+' restore must not duplicate canonical identities');
    assert.deepEqual(validate(restored),[],key+' restore must safely re-plan');
  }

  const closedWire=serialize(s),left=restore(closedWire),right=restore(closedWire);
  for(let i=0;i<720;i++){
    step(left,1);step(right,1);
    if(i%120===0){assert.deepEqual(validate(left),[]);assert.deepEqual(validate(right),[]);}
  }
  assert.equal(serialize(left),serialize(right),'long-horizon continuation must be deterministic');
  assert.equal(totalCurrency(left),startCurrency,'long-horizon economy must conserve currency');
  assert.equal(uniqueCanonicalIds(left),true,'long-horizon state keeps unique canonical identities');
  assert.ok(resourceStock(left,actor(left,f.producerId)).wood>=f.producerReserve,'long-horizon Producer reserve remains protected');
  assert.ok(left.merchantBuyOffers.buyOffers.filter(o=>o.status==='OPEN').length<=8,'BuyOffers remain bounded');
  assert.ok(left.merchantListings.listings.filter(l=>l.status==='OPEN').length<=8,'Listings remain bounded');

  const replayProbe=restore(checkpoints.afterConsumerPurchase);
  const filled=replayProbe.merchantListings.listings.find(l=>l.itemInstanceId===liveItemId&&l.sellerId===f.merchantId);
  assert.ok(filled);
  const beforeReplay=serialize(replayProbe);
  const replay=command(replayProbe,'RC4_BUY_LISTING',{buyerId:f.consumerId,listingId:filled.id,listingRevision:filled.revision});
  assert.equal(replay.ok,false,'filled consumer purchase cannot replay');
  assert.equal(serialize(replayProbe),beforeReplay,'replay attack must be atomic');
});
