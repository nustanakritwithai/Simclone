/** ER4 Crafter material procurement policy.
 * Read-only planning only. It may propose canonical RC4 travel/purchase commands,
 * but owns no wallet, material, Rust item, market, trade, profession or task writes.
 */
import {demandDrivenCrafterSnapshot} from './demand-driven-crafter.mjs?v=0.5.0';
import {projectActorObservedDemand} from './economic-demand.mjs?v=0.5.0';
import {getBalance} from './currency-wallet.mjs?v=0.5.0';
import {TRADE_ASSET_TYPES,tradeAssetType,validBulkTradeResourceKey} from './trade-assets.mjs?v=0.5.0';
import {sameResourceAccount} from './individual-resources.mjs?v=0.5.0';
import {projectHomeMarketForTrade} from './home-market.mjs?v=0.5.0';
import {isCanonicalMarketTravelTask,verifyCanonicalMarketArrival} from './navigation-arrival-evidence.mjs?v=0.5.0';
import {routeField,routeDistance} from './survival.mjs?v=0.5.0';

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
      if(!market.ok||market.market.open!==true)continue;
      return {offerId:offer.offerId,marketId:offer.marketId,buyerId:offer.buyerId,itemKind:offer.itemKind};
    }
  }
  return null;
}

function procurementPlan(world,agent){
  const actor=world?.agents?.find(a=>a.id===agent?.id)??null;
  if(!actor||actor!==agent)return view('UNKNOWN','actor');
  const craft=demandDrivenCrafterSnapshot(world,actor,{allowCanonicalMarketTravel:true});
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
    if(travelling)return view('SAT','observed-supply-gone',{agentId:actor.id,type:'CANCEL_TRAVEL',recipeId:craft.recipeId,missing});
    const sourcing=observedMarketSourcing(world,actor,projection,missing);
    if(sourcing)return view('NEEDS_SUPPLY','observed-market-sourcing',{
      agentId:actor.id,recipeId:craft.recipeId,missing,holdFallback:true,sourcing
    });
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
