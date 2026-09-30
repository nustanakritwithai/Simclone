/**
 * ER6 Crafter market-supply coordination.
 *
 * The Crafter owns no market mutation authority. This module reads only
 * actor-observed ER1 demand plus canonical Rust ownership and proposes existing
 * RC4 travel / BuyOffer response commands.
 */
import {projectActorObservedDemand} from './economic-demand.mjs?v=0.5.0';
import {tradableRustItemIds} from './rust-possessions.mjs?v=0.5.0';
import {projectHomeMarketForTrade} from './home-market.mjs?v=0.5.0';
import {TRADE_ASSET_TYPES,tradeAssetType} from './trade-assets.mjs?v=0.5.0';
import {isCanonicalMarketTravelTask,verifyCanonicalMarketArrival} from './navigation-arrival-evidence.mjs?v=0.5.0';
import {isEr6CrafterSupplyMarketTravelTask} from './rc4-market-runtime.mjs?v=0.5.0';

export const ER6_CRAFTER_MARKET_SUPPLY_VERSION='ER6-crafter-market-supply/1';

const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;};
const view=(status,reason,extra={})=>freeze({version:ER6_CRAFTER_MARKET_SUPPLY_VERSION,status,reason,authoritative:false,...extra});
const positive=n=>Number.isSafeInteger(n)&&n>0;

function existingListing(world,actor,offerId){
  return (world.merchantListings?.listings??[])
    .filter(l=>l?.status==='OPEN'&&l.buyOfferId===offerId&&l.sellerId===actor.id&&tradeAssetType(l)===TRADE_ASSET_TYPES.PHYSICAL_ITEM)
    .sort((a,b)=>String(a.id).localeCompare(String(b.id)))[0]??null;
}

function craftedTradableItems(world,actor,itemKind){
  const ids=new Set(tradableRustItemIds(world,{agentId:actor.id,itemKind}));
  return (world.rustPossessions?.items??[])
    .filter(i=>ids.has(i.id)&&i.kind===itemKind&&i.createdBy===actor.id&&i.craft&&typeof i.craft==='object')
    .sort((a,b)=>a.createdTick-b.createdTick||a.id-b.id);
}

function candidates(world,actor,projection){
  const rows=[];
  for(const signal of projection.signals??[]){
    if(signal?.unit!=='item'||signal.tradable!==true)continue;
    const items=craftedTradableItems(world,actor,signal.itemKind);
    if(!items.length)continue;
    for(const source of signal.sources??[]){
      if(source?.kind!=='BUY_OFFER'||source.side!=='DEMAND'||typeof source.evidenceId!=='string')continue;
      const offer=world.merchantBuyOffers?.buyOffers?.find(o=>o.offerId===source.evidenceId);
      if(!offer||offer.status!=='OPEN'||offer.buyerId===actor.id||offer.itemKind!==signal.itemKind||
        tradeAssetType(offer)!==TRADE_ASSET_TYPES.PHYSICAL_ITEM||offer.quantityWanted!==1||
        offer.marketId!==source.marketId||offer.unitPrice!==source.unitPrice)continue;
      const market=projectHomeMarketForTrade(world,world.homeMarkets,{marketId:offer.marketId});
      if(!market.ok||market.market.open!==true)continue;
      const item=items[0];
      rows.push({
        offerId:offer.offerId,marketId:offer.marketId,buyerId:offer.buyerId,itemKind:offer.itemKind,
        itemId:item.id,unitPrice:offer.unitPrice,observedTick:source.observedTick,market:{...market.market}
      });
    }
  }
  return rows.sort((a,b)=>b.unitPrice-a.unitPrice||b.observedTick-a.observedTick||
    String(a.offerId).localeCompare(String(b.offerId))||a.itemId-b.itemId);
}

export function crafterMarketSupplySnapshot(world,agent){
  const actor=world?.agents?.find(a=>a.id===agent?.id)??null;
  if(!actor||actor!==agent)return view('UNKNOWN','actor');
  if(actor.alive!==true)return view('BLOCKED','dead',{agentId:actor.id});
  if(actor.profession!=='crafter')return view('INELIGIBLE','crafter-required',{agentId:actor.id});
  if(actor.adventureCombat?.status==='ACTIVE'||actor.adventureEncounter)return view('BLOCKED','adventure',{agentId:actor.id});
  if((world.rustPossessions?.orders??[]).some(o=>o.agentId===actor.id)||(world.rustMaterials?.orders??[]).some(o=>o.agentId===actor.id))
    return view('BLOCKED','craft-busy',{agentId:actor.id});

  const marketTask=isCanonicalMarketTravelTask(actor.task);
  const ownTravel=marketTask&&isEr6CrafterSupplyMarketTravelTask(actor.task);
  if(actor.task&&!marketTask)return view('BLOCKED','task',{agentId:actor.id});
  if(marketTask&&!ownTravel)return view('BLOCKED','foreign-market-travel',{agentId:actor.id});

  const projection=projectActorObservedDemand(world,actor);
  if(projection.status!=='SAT')return view('UNKNOWN',projection.reason??'demand-evidence',{agentId:actor.id});

  const rows=candidates(world,actor,projection);
  if(!rows.length){
    if(ownTravel)return view('SAT','observed-offer-gone',{type:'CANCEL_TRAVEL',agentId:actor.id});
    return view('IDLE','no-observed-physical-buy-offer',{agentId:actor.id});
  }

  const selected=rows[0],open=existingListing(world,actor,selected.offerId);
  if(open){
    if(ownTravel)return view('SAT','listing-already-open',{
      type:'CANCEL_TRAVEL',agentId:actor.id,marketId:selected.marketId,offerId:selected.offerId,listingId:open.id
    });
    return view('SAT','listing-already-open',{
      type:'WAIT_SETTLEMENT',agentId:actor.id,marketId:selected.marketId,offerId:selected.offerId,listingId:open.id,
      itemKind:selected.itemKind,itemId:selected.itemId
    });
  }

  if(ownTravel&&actor.task.rc4MarketTravel.marketId!==selected.marketId)
    return view('SAT','market-changed',{type:'CANCEL_TRAVEL',agentId:actor.id,marketId:actor.task.rc4MarketTravel.marketId});

  const arrival=verifyCanonicalMarketArrival(world,{agentId:actor.id,market:selected.market});
  if(arrival.state==='SAT')return view('SAT','arrived-to-sell',{
    type:'ACCEPT_BUY_OFFER',agentId:actor.id,offerId:selected.offerId,marketId:selected.marketId,
    buyerId:selected.buyerId,itemKind:selected.itemKind,itemId:selected.itemId,unitPrice:selected.unitPrice,arrival
  });
  if(ownTravel&&arrival.state==='UNKNOWN')return view('SAT','walking-to-market',{
    type:'WAIT_TRAVEL',agentId:actor.id,offerId:selected.offerId,marketId:selected.marketId,
    itemKind:selected.itemKind,itemId:selected.itemId
  });
  if(ownTravel)return view('SAT','travel-invalidated',{type:'CANCEL_TRAVEL',agentId:actor.id,marketId:selected.marketId});

  return view('SAT','travel-to-observed-market',{
    type:'TRAVEL_TO_MARKET',agentId:actor.id,offerId:selected.offerId,marketId:selected.marketId,
    itemKind:selected.itemKind,itemId:selected.itemId,pathRequired:true,teleport:false
  });
}

export const crafterMarketSupplyDecision=crafterMarketSupplySnapshot;
