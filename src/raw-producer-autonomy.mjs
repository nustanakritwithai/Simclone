/** ER2 Raw Producer — actor-scoped reserve/surplus and observed BuyOffer policy.
 * Read-only policy. It never writes resources, money, markets, tasks or careers.
 * Execution remains engine -> canonical RC4 commands -> existing authorities.
 */
import {isIndependent,personalTargets,resourceAccount,sameResourceAccount,mealOwnerId,reservedMealsFor} from './individual-resources.mjs?v=0.5.0';
import {materialAmount} from './material-economy.mjs?v=0.5.0';
import {projectActorObservedDemand} from './economic-demand.mjs?v=0.5.0';
import {knownRc4BuyOffers} from './rc4-market-observation.mjs?v=0.5.0';
import {TRADE_ASSET_TYPES,tradeAssetType} from './trade-assets.mjs?v=0.5.0';
import {projectHomeMarketForTrade} from './home-market.mjs?v=0.5.0';
import {verifyCanonicalMarketArrival,isCanonicalMarketTravelTask} from './navigation-arrival-evidence.mjs?v=0.5.0';
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {RULES,reservations} from './survival.mjs?v=0.5.0';

export const RAW_PRODUCER_VERSION='ER2-raw-producer/1';
export const RAW_PRODUCER_RESOURCES=Object.freeze(['food','wood','stone','ironOre']);
export const RAW_PRODUCER_CAPABILITIES=Object.freeze({
  forager:Object.freeze({action:'FORAGE',resources:Object.freeze(['food'])}),
  woodcutter:Object.freeze({action:'WOODCUT',resources:Object.freeze(['wood'])}),
  miner:Object.freeze({action:'MINE',resources:Object.freeze(['stone','ironOre'])}),
});
const resourceSet=new Set(RAW_PRODUCER_RESOURCES);
const clone=v=>structuredClone(v);
const positive=v=>Number.isSafeInteger(v)&&v>0;
const nonnegative=v=>Number.isSafeInteger(v)&&v>=0;
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
const view=(status,reason,extra={})=>freeze({version:RAW_PRODUCER_VERSION,status,reason,...extra});

export function rawProducerCapability(agent,itemKind=null){
  const profile=RAW_PRODUCER_CAPABILITIES[agent?.profession]??null;
  if(!profile)return null;
  if(itemKind!==null&&!profile.resources.includes(itemKind))return null;
  return profile;
}
function shadowFor(world,agent){
  const shadow=clone(world),actor=shadow.agents?.find(a=>a.id===agent?.id&&a.alive===true)??null;
  return actor?{shadow,actor}:null;
}
function sameAccountInShadow(shadow,actor,sellerId){
  const seller=shadow.agents?.find(a=>a.id===sellerId&&a.alive===true);
  return !!seller&&sameResourceAccount(shadow,actor,seller);
}
function reserveSnapshot(world,agent,itemKind){
  if(!isIndependent(world))return view('INELIGIBLE','independent-world-required',{itemKind});
  if(!agent?.alive||world.agents?.find(a=>a.id===agent.id)!==agent)return view('UNKNOWN','actor',{itemKind});
  if(!resourceSet.has(itemKind))return view('INELIGIBLE','resource-kind',{itemKind});
  const ctx=shadowFor(world,agent);if(!ctx)return view('UNKNOWN','actor',{itemKind});
  const targets=personalTargets(ctx.shadow,ctx.actor),baseReserve=Math.max(0,Math.floor(Number(targets?.[itemKind]??0)));
  let consumptionReserve=0;
  if(itemKind==='food'){
    const {book}=reservations(ctx.shadow),ownerId=mealOwnerId(ctx.shadow,ctx.actor);
    consumptionReserve=reservedMealsFor(ctx.shadow,ownerId,book.meals);
  }
  if(!nonnegative(baseReserve)||!nonnegative(consumptionReserve))return view('UNKNOWN','reserve',{itemKind});
  return view('SAT','canonical-reserve',{
    itemKind,account:resourceAccount(ctx.shadow,ctx.actor),baseReserve,consumptionReserve,
    protectedReserve:baseReserve+consumptionReserve
  });
}
function accountCommitments(world,agent,itemKind,{excludeListingId=null,excludeOfferId=null}={}){
  const ctx=shadowFor(world,agent);if(!ctx)return view('UNKNOWN','actor',{itemKind});
  const rows=world.merchantReservations?.reservations;
  const listings=world.merchantListings?.listings;
  if(!Array.isArray(rows)||!Array.isArray(listings))return view('UNKNOWN','authority-root',{itemKind});
  const active=rows.filter(r=>r?.status==='ACTIVE'&&tradeAssetType(r)===TRADE_ASSET_TYPES.BULK_RESOURCE&&
    r.itemKind===itemKind&&r.listingId!==excludeListingId&&sameAccountInShadow(ctx.shadow,ctx.actor,r.sellerId));
  if(active.some(r=>!positive(r.quantity)))return view('UNKNOWN','reservation',{itemKind});
  const reservedListingIds=new Set(active.map(r=>r.listingId));
  const open=listings.filter(l=>l?.status==='OPEN'&&l.buyOfferId&&tradeAssetType(l)===TRADE_ASSET_TYPES.BULK_RESOURCE&&
    l.itemKind===itemKind&&l.id!==excludeListingId&&sameAccountInShadow(ctx.shadow,ctx.actor,l.sellerId)&&
    !reservedListingIds.has(l.id)&&!(excludeOfferId&&l.buyOfferId===excludeOfferId&&l.sellerId===agent.id));
  if(open.some(l=>!positive(l.quantity)))return view('UNKNOWN','listing',{itemKind});
  return view('SAT','canonical-commitments',{
    itemKind,reservedQuantity:active.reduce((n,r)=>n+r.quantity,0),
    offeredQuantity:open.reduce((n,l)=>n+l.quantity,0),
    reservationIds:active.map(r=>r.id).sort(),
    listingIds:open.map(l=>l.id).sort()
  });
}

export function producerSurplusSnapshot(world,agent,itemKind,options={}){
  const reserve=reserveSnapshot(world,agent,itemKind);if(reserve.status!=='SAT')return reserve;
  const commitments=accountCommitments(world,agent,itemKind,options);if(commitments.status!=='SAT')return commitments;
  const owned=Math.floor(materialAmount(world,agent,itemKind));
  if(!nonnegative(owned))return view('UNKNOWN','owned',{itemKind});
  const grossSurplus=Math.max(0,owned-reserve.protectedReserve);
  const committedQuantity=commitments.reservedQuantity+commitments.offeredQuantity;
  const tradableSurplus=Math.max(0,grossSurplus-committedQuantity);
  return view('SAT','surplus',{
    itemKind,owned,protectedReserve:reserve.protectedReserve,baseReserve:reserve.baseReserve,
    consumptionReserve:reserve.consumptionReserve,reservedQuantity:commitments.reservedQuantity,
    offeredQuantity:commitments.offeredQuantity,committedQuantity,grossSurplus,tradableSurplus,
    account:reserve.account,reservationIds:commitments.reservationIds,listingIds:commitments.listingIds
  });
}

export function rawProducerOfferGate(world,{producerId,itemKind,quantity,offerId=null}={}){
  if(!isIndependent(world)||!resourceSet.has(itemKind))return view('SAT','not-applicable',{applicable:false});
  const producer=world.agents?.find(a=>a.id===producerId&&a.alive===true);
  if(!producer)return view('SAT','producer-validation-delegated',{applicable:false});
  if(!positive(quantity))return view('VIOL','producer-quantity',{applicable:true});
  const snap=producerSurplusSnapshot(world,producer,itemKind,{excludeOfferId:offerId});
  if(snap.status!=='SAT')return view('UNKNOWN',snap.reason,{applicable:true,itemKind});
  if(snap.tradableSurplus<quantity){
    const reason=snap.grossSurplus<quantity?'producer-protected-reserve':'producer-resource-committed';
    return view('VIOL',reason,{applicable:true,itemKind,quantity,owned:snap.owned,protectedReserve:snap.protectedReserve,
      reservedQuantity:snap.reservedQuantity,offeredQuantity:snap.offeredQuantity,tradableSurplus:snap.tradableSurplus});
  }
  return view('SAT','producer-surplus',{applicable:true,itemKind,quantity,tradableSurplus:snap.tradableSurplus,protectedReserve:snap.protectedReserve});
}

export function rawProducerSettlementGate(world,{sellerId,itemKind,quantity,listingId=null,buyOfferId=null}={}){
  if(!buyOfferId||!isIndependent(world)||!resourceSet.has(itemKind))return view('SAT','not-applicable',{applicable:false});
  const seller=world.agents?.find(a=>a.id===sellerId&&a.alive===true);
  if(!seller)return view('SAT','seller-validation-delegated',{applicable:false});
  if(!positive(quantity))return view('VIOL','producer-quantity',{applicable:true});
  const reserve=reserveSnapshot(world,seller,itemKind);if(reserve.status!=='SAT')return view('UNKNOWN',reserve.reason,{applicable:true,itemKind});
  const commitments=accountCommitments(world,seller,itemKind,{excludeListingId:listingId});
  if(commitments.status!=='SAT')return view('UNKNOWN',commitments.reason,{applicable:true,itemKind});
  const owned=Math.floor(materialAmount(world,seller,itemKind));
  if(!nonnegative(owned))return view('UNKNOWN','owned',{applicable:true,itemKind});
  const afterSale=owned-commitments.reservedQuantity-quantity;
  const afterCommitments=afterSale-commitments.offeredQuantity;
  if(afterCommitments<reserve.protectedReserve){
    const reason=afterSale<reserve.protectedReserve?'producer-protected-reserve':'producer-resource-committed';
    return view('VIOL',reason,{
      applicable:true,itemKind,quantity,owned,protectedReserve:reserve.protectedReserve,
      reservedQuantity:commitments.reservedQuantity,offeredQuantity:commitments.offeredQuantity,
      afterSale,afterCommitments
    });
  }
  return view('SAT','producer-settlement-surplus',{
    applicable:true,itemKind,quantity,owned,protectedReserve:reserve.protectedReserve,
    reservedQuantity:commitments.reservedQuantity,offeredQuantity:commitments.offeredQuantity,
    afterSale,afterCommitments
  });
}

function currentObservedOffers(world,agent,profile){
  const demand=projectActorObservedDemand(world,agent,{includeResourceShortages:false});
  if(demand.status!=='SAT')return view('UNKNOWN',demand.reason??'demand',{offers:[]});
  const known=new Map(knownRc4BuyOffers(agent).map(o=>[o.offerId,o]));
  const rows=[];
  for(const signal of demand.signals??[]){
    if(!profile.resources.includes(signal.itemKind)||signal.unit!=='bulk-resource'||signal.tradable!==true||signal.actionable!==true)continue;
    for(const source of signal.sources??[]){
      if(!['BUY_OFFER','MERCHANT_STOCK_SHORTAGE_BUY_OFFER'].includes(source.kind))continue;
      const observed=known.get(source.evidenceId),current=world.merchantBuyOffers?.buyOffers?.find(o=>o.offerId===source.evidenceId);
      if(!observed||!current||current.status!=='OPEN'||tradeAssetType(current)!==TRADE_ASSET_TYPES.BULK_RESOURCE)continue;
      if(current.itemKind!==signal.itemKind||current.marketId!==observed.marketId||current.buyerId!==observed.buyerId||
        current.quantityWanted!==observed.quantityWanted||current.unitPrice!==observed.unitPrice||current.buyerId===agent.id)continue;
      const ctx=shadowFor(world,agent);
      if(ctx&&sameAccountInShadow(ctx.shadow,ctx.actor,current.buyerId))continue;
      rows.push({
        offerId:current.offerId,marketId:current.marketId,buyerId:current.buyerId,itemKind:current.itemKind,
        quantityWanted:current.quantityWanted,unitPrice:current.unitPrice,observedTick:observed.observedTick,
        demandEvidenceId:source.evidenceId,shortageQuantity:signal.shortageQuantity
      });
    }
  }
  const uniq=new Map();for(const row of rows)if(!uniq.has(row.offerId))uniq.set(row.offerId,row);
  const offers=[...uniq.values()].sort((a,b)=>b.unitPrice-a.unitPrice||b.observedTick-a.observedTick||
    String(a.offerId).localeCompare(String(b.offerId)));
  return view('SAT','observed-offers',{offers});
}
function accountOpenListingForOffer(world,agent,offerId){
  const ctx=shadowFor(world,agent);if(!ctx)return null;
  return (world.merchantListings?.listings??[]).filter(l=>l?.status==='OPEN'&&l.buyOfferId===offerId&&
    tradeAssetType(l)===TRADE_ASSET_TYPES.BULK_RESOURCE&&sameAccountInShadow(ctx.shadow,ctx.actor,l.sellerId))
    .sort((a,b)=>String(a.id).localeCompare(String(b.id)))[0]??null;
}
function accountOpenProcurementCommitment(world,agent,profile){
  const rows=(world.merchantListings?.listings??[]).filter(l=>l?.status==='OPEN'&&l.buyOfferId&&
    tradeAssetType(l)===TRADE_ASSET_TYPES.BULK_RESOURCE&&profile.resources.includes(l.itemKind)&&
    l.sellerId===agent.id).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  if(!rows.length)return null;
  // Most ticks have no accepted procurement for this Producer. Avoid building the
  // account shadow unless canonical open work actually exists.
  const ctx=shadowFor(world,agent);if(!ctx)return null;
  for(const listing of rows){
    const offer=world.merchantBuyOffers?.buyOffers?.find(o=>o.offerId===listing.buyOfferId);
    if(!offer||offer.status!=='OPEN'||tradeAssetType(offer)!==TRADE_ASSET_TYPES.BULK_RESOURCE)continue;
    if(offer.marketId!==listing.marketId||offer.itemKind!==listing.itemKind||sameAccountInShadow(ctx.shadow,ctx.actor,offer.buyerId))continue;
    return {listing,offer};
  }
  return null;
}

export function rawProducerDecision(world,agent){
  if(!world||!agent?.alive||world.agents?.find(a=>a.id===agent.id)!==agent)return view('UNKNOWN','actor');
  if(!isIndependent(world))return view('INELIGIBLE','independent-world-required');
  const profile=rawProducerCapability(agent);if(!profile)return view('INELIGIBLE','raw-producer-profession');
  if(!canPerformProductiveWork(world,agent))return view('INELIGIBLE','productive-stage');
  const marketTask=isCanonicalMarketTravelTask(agent.task);
  if(agent.satiety<RULES.hungry||agent.energy<RULES.exhausted)
    return view('BLOCKED','survival',{action:profile.action});

  // This Producer's accepted procurement Listing is canonical owned work.
  // It outranks unrelated work already in progress, but never survival.
  // No lock state is stored: FILLED/CANCELLED/invalid BuyOffers or Listings
  // disappear from this projection and the previous task can continue.
  const commitment=accountOpenProcurementCommitment(world,agent,profile);
  if(commitment&&!marketTask)return view('SAT','listing-already-open',{
    type:'WAIT_SETTLEMENT',agentId:agent.id,marketId:commitment.offer.marketId,
    listingId:commitment.listing.id,offerId:commitment.offer.offerId,itemKind:commitment.offer.itemKind
  });
  if(agent.task&&!marketTask)return view('BLOCKED','task',{action:profile.action});

  const observed=currentObservedOffers(world,agent,profile);
  if(observed.status!=='SAT')return observed;
  if(!observed.offers.length){
    if(marketTask)return view('SAT','demand-expired',{type:'CANCEL_TRAVEL',agentId:agent.id});
    return view('SAT','no-observed-buy-offer',{type:'IDLE',agentId:agent.id});
  }
  const offer=observed.offers[0],existing=accountOpenListingForOffer(world,agent,offer.offerId);
  if(existing){
    if(marketTask)return view('SAT','listing-already-open',{type:'CANCEL_TRAVEL',agentId:agent.id,marketId:offer.marketId,listingId:existing.id});
    return view('SAT','listing-already-open',{type:'WAIT_SETTLEMENT',agentId:agent.id,marketId:offer.marketId,listingId:existing.id,offerId:offer.offerId});
  }
  const surplus=producerSurplusSnapshot(world,agent,offer.itemKind);
  if(surplus.status!=='SAT')return view('UNKNOWN',surplus.reason,{offer});
  if(surplus.tradableSurplus<offer.quantityWanted){
    if(marketTask)return view('SAT','surplus-dropped',{type:'CANCEL_TRAVEL',agentId:agent.id,marketId:offer.marketId,offerId:offer.offerId});
    return view('SAT','gather-for-observed-demand',{
      type:'GATHER',agentId:agent.id,action:profile.action,itemKind:offer.itemKind,offerId:offer.offerId,
      marketId:offer.marketId,quantityWanted:offer.quantityWanted,missing:offer.quantityWanted-surplus.tradableSurplus,
      protectedReserve:surplus.protectedReserve,owned:surplus.owned,tradableSurplus:surplus.tradableSurplus
    });
  }
  const market=projectHomeMarketForTrade(world,world.homeMarkets,{marketId:offer.marketId});
  if(!market.ok||market.market.open!==true){
    if(marketTask)return view('SAT','market-invalidated',{type:'CANCEL_TRAVEL',agentId:agent.id,marketId:offer.marketId});
    return view('SAT','market-invalidated',{type:'IDLE',agentId:agent.id});
  }
  if(marketTask&&agent.task.rc4MarketTravel.marketId!==offer.marketId)
    return view('SAT','market-changed',{type:'CANCEL_TRAVEL',agentId:agent.id,marketId:agent.task.rc4MarketTravel.marketId});
  const arrival=verifyCanonicalMarketArrival(world,{agentId:agent.id,market:market.market});
  if(arrival.state==='SAT')return view('SAT','arrived-to-sell',{
    type:'ACCEPT_BUY_OFFER',agentId:agent.id,offerId:offer.offerId,marketId:offer.marketId,
    itemKind:offer.itemKind,quantity:offer.quantityWanted,arrival
  });
  if(marketTask&&arrival.state==='UNKNOWN')return view('SAT','walking-to-market',{
    type:'WAIT_TRAVEL',agentId:agent.id,offerId:offer.offerId,marketId:offer.marketId,itemKind:offer.itemKind,quantity:offer.quantityWanted
  });
  if(marketTask)return view('SAT','travel-invalidated',{type:'CANCEL_TRAVEL',agentId:agent.id,marketId:offer.marketId});
  return view('SAT','travel-to-observed-market',{
    type:'TRAVEL_TO_MARKET',agentId:agent.id,offerId:offer.offerId,marketId:offer.marketId,
    itemKind:offer.itemKind,quantity:offer.quantityWanted,pathRequired:true,teleport:false
  });
}

export function rawProducerGatherPressure(intent,action){
  if(intent?.status!=='SAT'||intent.type!=='GATHER'||intent.action!==action||!positive(intent.missing))return null;
  return freeze({
    version:RAW_PRODUCER_VERSION,offerId:intent.offerId,itemKind:intent.itemKind,
    missing:intent.missing,bonus:Math.min(90,45+intent.missing*5)
  });
}
