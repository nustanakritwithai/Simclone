/** ER4 Crafter material procurement policy.
 * Read-only planning only. It may propose canonical RC4 travel/purchase commands,
 * but owns no wallet, material, Rust item, market, trade, profession or task writes.
 */
import {demandDrivenCrafterSnapshot} from './demand-driven-crafter.mjs?v=0.5.0';
import {projectActorObservedDemand,ECONOMIC_DEMAND_TTL_TICKS} from './economic-demand.mjs?v=0.5.0';
import {getBalance} from './currency-wallet.mjs?v=0.5.0';
import {knownRc4Markets,knownRc4Listings,knownRc4BuyOffers} from './rc4-market-observation.mjs?v=0.5.0';
import {TRADE_ASSET_TYPES,tradeAssetType,validBulkTradeResourceKey} from './trade-assets.mjs?v=0.5.0';
import {sameResourceAccount} from './individual-resources.mjs?v=0.5.0';
import {projectHomeMarketForTrade} from './home-market.mjs?v=0.5.0';
import {isCanonicalMarketTravelTask,verifyCanonicalMarketArrival} from './navigation-arrival-evidence.mjs?v=0.5.0';
import {routeField,routeDistance} from './survival.mjs?v=0.5.0';
import {merchantLedgerFromCollection} from './merchant-ledger.mjs?v=0.5.0';

export const ER4_MATERIAL_PROCUREMENT_VERSION='ER4-material-procurement/1';

const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;};
const view=(status,reason,extra={})=>freeze({version:ER4_MATERIAL_PROCUREMENT_VERSION,...extra,status,reason});
const positive=n=>Number.isSafeInteger(n)&&n>0;

function missingRows(snapshot){
  return Object.entries(snapshot?.missing??{})
    .filter(([key,n])=>typeof key==='string'&&key.length>0&&positive(n))
    .map(([itemKind,quantity])=>({itemKind,quantity}))
    .sort((a,b)=>a.itemKind.localeCompare(b.itemKind));
}

function listingCandidate(world,actor,projection,need){
  const signal=projection.signals.find(s=>s.itemKind===need.itemKind&&
    s.unit===(validBulkTradeResourceKey(need.itemKind)?'bulk-resource':'item'));
  if(!signal)return [];
  const expectedType=validBulkTradeResourceKey(need.itemKind)?TRADE_ASSET_TYPES.BULK_RESOURCE:TRADE_ASSET_TYPES.PHYSICAL_ITEM;
  const rows=[];
  for(const source of signal.sources??[]){
    if(source?.kind!=='LISTING'||source.side!=='SUPPLY'||typeof source.evidenceId!=='string')continue;
    const listing=world.merchantListings?.listings?.find(l=>l.id===source.evidenceId);
    if(!listing||listing.status!=='OPEN'||listing.itemKind!==need.itemKind||listing.sellerId===actor.id||
      tradeAssetType(listing)!==expectedType||listing.quantity!==source.quantity||listing.unitPrice!==source.unitPrice)continue;
    if(expectedType===TRADE_ASSET_TYPES.PHYSICAL_ITEM&&listing.itemInstanceId!==source.itemInstanceId)continue;
    if(listing.buyOfferId){
      const offer=world.merchantBuyOffers?.buyOffers?.find(o=>o.offerId===listing.buyOfferId&&o.status==='OPEN');
      if(!offer||offer.buyerId!==actor.id||tradeAssetType(offer)!==expectedType)continue;
    }
    const seller=world.agents?.find(a=>a.id===listing.sellerId&&a.alive);
    if(!seller)continue;
    if(expectedType===TRADE_ASSET_TYPES.BULK_RESOURCE&&sameResourceAccount(world,actor,seller))continue;
    const projected=projectHomeMarketForTrade(world,world.homeMarkets,{marketId:listing.marketId});
    if(!projected.ok||projected.market.open!==true)continue;
    const distance=routeDistance(routeField(world,actor),projected.market);
    if(distance<0)continue;
    let quantity=1;
    if(expectedType===TRADE_ASSET_TYPES.BULK_RESOURCE){
      quantity=Math.min(need.quantity,listing.quantity);
      // BuyOffer-bound Listings are exact bilateral procurement contracts.
      if(listing.buyOfferId&&quantity!==listing.quantity)continue;
    }
    const totalPrice=listing.unitPrice*quantity;
    if(!positive(quantity)||!Number.isSafeInteger(totalPrice)||totalPrice<1)continue;
    rows.push({
      itemKind:need.itemKind,missingQuantity:need.quantity,assetType:expectedType,
      listingId:listing.id,listingRevision:listing.revision,marketId:listing.marketId,
      sellerId:listing.sellerId,itemInstanceId:listing.itemInstanceId??null,
      listingQuantity:listing.quantity,quantity,unitPrice:listing.unitPrice,totalPrice,
      distance,market:{...projected.market}
    });
  }
  return rows;
}

function staleMarketRecheck(world,actor,missing){
  const needed=new Set(missing.map(x=>x.itemKind));
  if(!needed.size)return null;
  const markets=knownRc4Markets(actor)
    .filter(m=>m?.status==='open'&&Number.isSafeInteger(m.observedTick)&&m.observedTick>=0&&m.observedTick<=world.tick);
  const evidence=[
    ...knownRc4Listings(actor).filter(x=>x?.sellerId!==actor.id),
    ...knownRc4BuyOffers(actor).filter(x=>x?.buyerId!==actor.id)
  ].filter(x=>needed.has(x?.itemKind)&&Number.isSafeInteger(x.observedTick)&&x.observedTick>=0&&x.observedTick<=world.tick&&
    world.tick-x.observedTick>ECONOMIC_DEMAND_TTL_TICKS);
  const rows=[];
  for(const market of markets){
    const relevant=evidence.filter(x=>x.marketId===market.marketId);
    if(!relevant.length)continue;
    const latestEvidenceTick=Math.max(...relevant.map(x=>x.observedTick));
    // A later market observation means the actor already came back after this
    // stale evidence. With no fresh actionable row above, fall back instead of
    // looping forever on the same memory.
    if(market.observedTick>latestEvidenceTick)continue;
    rows.push({marketId:market.marketId,marketObservedTick:market.observedTick,evidenceObservedTick:latestEvidenceTick});
  }
  return rows.sort((a,b)=>b.evidenceObservedTick-a.evidenceObservedTick||
    b.marketObservedTick-a.marketObservedTick||a.marketId.localeCompare(b.marketId))[0]??null;
}

function observedMarketSourcing(world,actor,projection,missing){
  const needed=new Set(missing.map(x=>x.itemKind));
  for(const signal of projection?.signals??[]){
    if(!needed.has(signal.itemKind))continue;
    const expected=validBulkTradeResourceKey(signal.itemKind)?TRADE_ASSET_TYPES.BULK_RESOURCE:TRADE_ASSET_TYPES.PHYSICAL_ITEM;
    for(const source of signal.sources??[]){
      if(!['BUY_OFFER','MERCHANT_STOCK_SHORTAGE_BUY_OFFER'].includes(source?.kind)||typeof source.evidenceId!=='string')continue;
      const offer=world.merchantBuyOffers?.buyOffers?.find(o=>o.offerId===source.evidenceId&&o.status==='OPEN');
      if(!offer||offer.buyerId===actor.id||offer.itemKind!==signal.itemKind||tradeAssetType(offer)!==expected)continue;
      const buyer=world.agents?.find(a=>a.id===offer.buyerId&&a.alive&&a.profession==='merchant');if(!buyer)continue;
      const market=projectHomeMarketForTrade(world,world.homeMarkets,{marketId:offer.marketId});
      if(!market.ok||market.market.open!==true||routeDistance(routeField(world,actor),market.market)<0)continue;
      return {kind:'open-merchant-buy-offer',offerId:offer.offerId,marketId:offer.marketId,buyerId:offer.buyerId,itemKind:offer.itemKind};
    }
  }
  // Once an observed procurement Listing flips FILLED, the corresponding open
  // BuyOffer disappears from live demand before the Merchant can publish resale.
  // Keep the Crafter on the same observed pipeline only while the exact filled
  // Listing is in personal market memory and the Merchant still retains that
  // canonical purchase basis. No hidden stock alone can create this hold.
  for(const known of actor.rc4MarketKnowledge?.knownListings??[]){
    if(!needed.has(known?.itemKind)||known?.status!=='FILLED'||!known.buyOfferId||
      !Number.isSafeInteger(known.observedTick)||known.observedTick<0||known.observedTick>world.tick||
      world.tick-known.observedTick>ECONOMIC_DEMAND_TTL_TICKS)continue;
    const current=world.merchantListings?.listings?.find(l=>l.id===known.id);
    if(!current||current.status!=='FILLED'||current.marketId!==known.marketId||current.sellerId!==known.sellerId||
      current.itemKind!==known.itemKind||current.buyOfferId!==known.buyOfferId||current.revision!==known.revision)continue;
    const receipt=world.tradeReplay?.receipts?.find(r=>r.listingId===current.id&&r.marketId===current.marketId&&
      r.sellerId===current.sellerId&&r.itemKind===current.itemKind);
    if(!receipt||receipt.buyerId===actor.id)continue;
    const expected=validBulkTradeResourceKey(current.itemKind)?TRADE_ASSET_TYPES.BULK_RESOURCE:TRADE_ASSET_TYPES.PHYSICAL_ITEM;
    if(tradeAssetType(receipt)!==expected)continue;
    const buyer=world.agents?.find(a=>a.id===receipt.buyerId&&a.alive&&a.profession==='merchant');if(!buyer)continue;
    if(expected===TRADE_ASSET_TYPES.BULK_RESOURCE&&sameResourceAccount(world,actor,buyer))continue;
    const ledger=merchantLedgerFromCollection(world.merchantLedgers,buyer.id);
    const purchase=ledger?.purchases?.find(p=>p.transactionId===receipt.transactionId&&p.itemKind===receipt.itemKind);
    const retained=expected===TRADE_ASSET_TYPES.BULK_RESOURCE
      ?Number.isSafeInteger(purchase?.remainingQuantity)&&purchase.remainingQuantity>0
      :Array.isArray(purchase?.remainingItemIds)&&purchase.remainingItemIds.length>0;
    if(!retained)continue;
    const market=projectHomeMarketForTrade(world,world.homeMarkets,{marketId:receipt.marketId});
    if(!market.ok||market.market.open!==true||routeDistance(routeField(world,actor),market.market)<0)continue;
    return {kind:'observed-filled-procurement',transactionId:receipt.transactionId,listingId:current.id,
      marketId:receipt.marketId,buyerId:receipt.buyerId,itemKind:receipt.itemKind,quantity:receipt.quantity};
  }
  return null;
}

function procurementPlan(world,agent){
  const actor=world?.agents?.find(a=>a.id===agent?.id)??null;
  if(!actor||actor!==agent)return view('UNKNOWN','actor');
  const craft=demandDrivenCrafterSnapshot(world,actor,{allowCanonicalMarketTravel:true,allowGenericExplore:true,allowMarketPreemptibleTask:true});
  const travelling=isCanonicalMarketTravelTask(actor.task);
  if(craft.status==='UNKNOWN')return view('UNKNOWN',craft.reason,{agentId:actor.id,craftStatus:craft.status});
  if(craft.status!=='NEEDS_MATERIALS'){
    if(travelling)return view('SAT','procurement-no-longer-needed',{agentId:actor.id,type:'CANCEL_TRAVEL'});
    return view(craft.status==='BLOCKED'?'BLOCKED':'IDLE',craft.reason,{agentId:actor.id,craftStatus:craft.status});
  }

  const missing=missingRows(craft);
  if(!missing.length)return view('UNKNOWN','missing-evidence',{agentId:actor.id,recipeId:craft.recipeId});
  const projection=projectActorObservedDemand(world,actor);
  if(projection.status!=='SAT')return view('UNKNOWN',projection.reason??'demand-evidence',{agentId:actor.id,recipeId:craft.recipeId});

  const candidates=missing.flatMap(need=>listingCandidate(world,actor,projection,need))
    .sort((a,b)=>a.itemKind.localeCompare(b.itemKind)||a.unitPrice-b.unitPrice||a.totalPrice-b.totalPrice||
      a.distance-b.distance||a.marketId.localeCompare(b.marketId)||a.listingId.localeCompare(b.listingId));

  if(!candidates.length){
    const sourcing=observedMarketSourcing(world,actor,projection,missing);
    if(sourcing){
      if(travelling)return view('SAT','observed-supply-gone',{agentId:actor.id,type:'CANCEL_TRAVEL',recipeId:craft.recipeId,missing});
      return view('NEEDS_SUPPLY','observed-market-sourcing',{
        agentId:actor.id,recipeId:craft.recipeId,missing,holdFallback:true,sourcing
      });
    }
    const recheck=staleMarketRecheck(world,actor,missing);
    if(travelling){
      if(recheck&&actor.task.rc4MarketTravel.marketId===recheck.marketId)
        return view('RECHECK_MARKET','stale-market-recheck-travelling',{agentId:actor.id,recipeId:craft.recipeId,missing,...recheck});
      return view('SAT','observed-supply-gone',{agentId:actor.id,type:'CANCEL_TRAVEL',recipeId:craft.recipeId,missing});
    }
    if(recheck)return view('RECHECK_MARKET','stale-market-recheck',{agentId:actor.id,recipeId:craft.recipeId,missing,...recheck});
    return view('NEEDS_SUPPLY','no-observed-listing',{agentId:actor.id,recipeId:craft.recipeId,missing});
  }

  const balance=getBalance(world,actor.id);
  if(!Number.isSafeInteger(balance)||balance<0)return view('UNKNOWN','wallet-evidence',{agentId:actor.id,recipeId:craft.recipeId});
  const affordable=candidates.filter(row=>row.totalPrice<=balance);
  if(!affordable.length){
    if(travelling)return view('SAT','insufficient-funds-during-travel',{agentId:actor.id,type:'CANCEL_TRAVEL',recipeId:craft.recipeId,balance});
    const cheapest=[...candidates].sort((a,b)=>a.totalPrice-b.totalPrice||a.itemKind.localeCompare(b.itemKind)||a.listingId.localeCompare(b.listingId))[0];
    return view('NEEDS_FUNDS','insufficient-funds',{
      agentId:actor.id,recipeId:craft.recipeId,balance,required:cheapest.totalPrice,
      itemKind:cheapest.itemKind,listingId:cheapest.listingId
    });
  }

  const selected=affordable[0];
  return view('READY','observed-supply',{
    agentId:actor.id,recipeId:craft.recipeId,missing,
    itemKind:selected.itemKind,missingQuantity:selected.missingQuantity,assetType:selected.assetType,
    listingId:selected.listingId,listingRevision:selected.listingRevision,marketId:selected.marketId,
    sellerId:selected.sellerId,itemInstanceId:selected.itemInstanceId,listingQuantity:selected.listingQuantity,
    quantity:selected.quantity,unitPrice:selected.unitPrice,totalPrice:selected.totalPrice,
    distance:selected.distance,market:selected.market
  });
}

export function crafterMaterialProcurementSnapshot(world,agent){
  const plan=procurementPlan(world,agent);
  if(plan.status==='RECHECK_MARKET'){
    const actor=world.agents.find(a=>a.id===plan.agentId);
    const travel=isCanonicalMarketTravelTask(actor?.task);
    if(travel)return view('SAT','stale-market-recheck-travelling',{
      ...plan,type:'WAIT_TRAVEL',agentId:actor.id,marketId:plan.marketId
    });
    return view('SAT','stale-market-recheck',{
      ...plan,type:'TRAVEL_TO_MARKET',agentId:actor.id,marketId:plan.marketId,
      intent:freeze({agentId:actor.id,marketId:plan.marketId})
    });
  }
  if(plan.status!=='READY')return plan;
  const actor=world.agents.find(a=>a.id===plan.agentId);
  const travel=isCanonicalMarketTravelTask(actor?.task);
  if(travel){
    if(actor.task.rc4MarketTravel.marketId!==plan.marketId)
      return view('SAT','travel-target-changed',{agentId:actor.id,type:'CANCEL_TRAVEL',listingId:plan.listingId,marketId:plan.marketId});
    const arrival=verifyCanonicalMarketArrival(world,{agentId:actor.id,market:plan.market});
    if(arrival.state==='UNKNOWN')
      return view('SAT','travelling',{agentId:actor.id,type:'WAIT_TRAVEL',listingId:plan.listingId,marketId:plan.marketId,quantity:plan.quantity});
    if(arrival.state!=='SAT')
      return view('SAT','arrival-invalid',{agentId:actor.id,type:'CANCEL_TRAVEL',listingId:plan.listingId,marketId:plan.marketId});
    return view('SAT','ready-buy',{
      ...plan,type:'BUY_LISTING',
      intent:freeze({buyerId:actor.id,listingId:plan.listingId,listingRevision:plan.listingRevision,quantity:plan.quantity})
    });
  }
  return view('SAT','travel-required',{
    ...plan,type:'TRAVEL_TO_MARKET',
    intent:freeze({agentId:actor.id,marketId:plan.marketId})
  });
}

export function crafterMaterialProcurementDecision(world,agent){
  return crafterMaterialProcurementSnapshot(world,agent);
}

/** Canonical RC4 purchase gate for ER4. No caller-supplied need evidence is trusted. */
export function crafterMaterialPurchaseAuthorization(world,agent,listing,{quantity}={}){
  if(!listing||world?.merchantListings?.listings?.find(l=>l.id===listing.id)!==listing)return view('UNKNOWN','listing');
  const plan=procurementPlan(world,agent);
  if(plan.status!=='READY')return view(plan.status==='UNKNOWN'?'UNKNOWN':'VIOL',plan.reason,{listingId:listing.id});
  if(plan.listingId!==listing.id||plan.listingRevision!==listing.revision)return view('VIOL','listing-not-selected',{listingId:listing.id});
  if(!positive(quantity)||quantity!==plan.quantity)return view('VIOL','procurement-quantity',{listingId:listing.id,quantity,allowedQuantity:plan.quantity});
  return view('SAT','authorized',{listingId:listing.id,quantity,itemKind:plan.itemKind,recipeId:plan.recipeId});
}
