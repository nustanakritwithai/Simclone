/** ER3 Demand-driven Crafter policy — STACKED DRAFT.
 * Reads ER1 actor-scoped demand and existing Crafter/Rust/RC4 authorities.
 * This module proposes intents only. It owns no item, material, price, market,
 * wallet, trade, profession, mastery or task state.
 */
import {CRAFT_RECIPE_CATALOG} from '../../../src/crafting-catalog.mjs?v=0.5.0';
import {knowsCraftRecipe} from '../../../src/craft-recipe-knowledge.mjs?v=0.5.0';
import {craftPreview,tradableRustItemIds} from '../../../src/rust-possessions.mjs?v=0.5.0';
import {
  knownRc4Markets,knownRc4BuyOffers,validateRc4MarketKnowledge
} from '../../../src/rc4-market-observation.mjs?v=0.5.0';
import {projectHomeMarketForTrade} from '../../../src/home-market.mjs?v=0.5.0';
import {
  projectActorObservedDemand,ECONOMIC_DEMAND_TTL_TICKS
} from '../../../src/economic-demand.mjs?v=0.5.0';
import {canPerformProductiveWork} from '../../../src/lifecycle.mjs?v=0.5.0';
import {homeOf} from '../../../src/individual-housing.mjs?v=0.5.0';
import {CRAFT_TRAINING_RULES} from '../../../src/craft-training.mjs?v=0.5.0';
import {resourceStock,isIndependent} from '../../../src/individual-resources.mjs?v=0.5.0';
import {autonomousBirthFoodTarget} from '../../../src/reproduction.mjs?v=0.5.0';

export const ER3_CRAFTER_MARKET_VERSION='ER3-crafter-market/1';

const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;};
const view=(status,reason,extra={})=>freeze({version:ER3_CRAFTER_MARKET_VERSION,status,reason,...extra});
const livingCrafter=(s,a)=>a?.alive===true&&a.profession==='crafter'&&canPerformProductiveWork(s,a);
const materialReason=reason=>['materials','item-materials'].includes(reason);
const fresh=(tick,observedTick)=>Number.isSafeInteger(tick)&&Number.isSafeInteger(observedTick)&&observedTick>=0&&observedTick<=tick&&tick-observedTick<=ECONOMIC_DEMAND_TTL_TICKS;

function currentObservedOffers(s,a,itemKind=null){
  const observedMarkets=new Map(knownRc4Markets(a).filter(x=>fresh(s.tick,x.observedTick)).map(x=>[x.marketId,x]));
  const observedOffers=new Map(knownRc4BuyOffers(a).filter(x=>fresh(s.tick,x.observedTick)).map(x=>[x.offerId,x]));
  const rows=[];
  for(const offer of s?.merchantBuyOffers?.buyOffers??[]){
    const seen=observedOffers.get(offer?.offerId),marketSeen=observedMarkets.get(offer?.marketId);
    if(!seen||!marketSeen||offer.status!=='OPEN'||offer.buyerId===a.id)continue;
    if(itemKind!==null&&offer.itemKind!==itemKind)continue;
    if(seen.marketId!==offer.marketId||seen.buyerId!==offer.buyerId||seen.itemKind!==offer.itemKind||
      seen.quantityWanted!==offer.quantityWanted||seen.unitPrice!==offer.unitPrice||
      seen.createdTick!==offer.createdTick||seen.status!=='OPEN')continue;
    if(marketSeen.status!=='open')continue;
    const market=projectHomeMarketForTrade(s,s.homeMarkets,{marketId:offer.marketId});
    if(!market.ok||market.market.open!==true)continue;
    rows.push({...offer,observedTick:seen.observedTick});
  }
  return rows.sort((x,y)=>y.unitPrice-x.unitPrice||x.observedTick-y.observedTick||x.offerId.localeCompare(y.offerId));
}

function pendingSupplyListing(s,a){
  return (s?.merchantListings?.listings??[])
    .filter(l=>l?.sellerId===a.id&&l.status==='OPEN'&&typeof l.buyOfferId==='string')
    .sort((x,y)=>x.id.localeCompare(y.id))[0]??null;
}

function safeReserve(s,a,preview){
  const stock=resourceStock(s,a);
  const foodFloor=isIndependent(s)?CRAFT_TRAINING_RULES.food:Math.max(CRAFT_TRAINING_RULES.food,autonomousBirthFoodTarget(s));
  if((stock?.food??0)<foodFloor)return false;
  if((stock?.wood??0)-(preview.materials?.wood??0)<CRAFT_TRAINING_RULES.wood)return false;
  if((stock?.stone??0)-(preview.materials?.stone??0)<CRAFT_TRAINING_RULES.stone)return false;
  return true;
}

function recipeRoute(s,a,itemKind){
  const recipes=Object.values(CRAFT_RECIPE_CATALOG)
    .filter(r=>r.output===itemKind&&knowsCraftRecipe(s,a,r.id))
    .sort((x,y)=>x.tier-y.tier||x.work-y.work||x.id.localeCompare(y.id));
  let missing=null,blocked=null;
  for(const recipe of recipes){
    const preview=craftPreview(s,{agentId:a.id,recipeId:recipe.id});
    if(!preview.ok){
      if(materialReason(preview.reason)&&missing===null)missing={recipe,reason:preview.reason,missing:{...(preview.missing??{})}};
      else if(blocked===null)blocked={recipe,reason:preview.reason};
      continue;
    }
    if(!safeReserve(s,a,preview)){
      if(missing===null)missing={recipe,reason:'reserve',missing:{}};
      continue;
    }
    return {status:'READY',recipe,preview};
  }
  if(missing)return {status:'NEEDS_MATERIALS',...missing};
  if(blocked)return {status:'BLOCKED',...blocked};
  return {status:'BLOCKED',recipe:null,reason:'no-craft-route'};
}

function demandRows(projection){
  return projection.signals
    .filter(x=>x.unit==='item'&&x.tradable===true&&x.demandQuantity>0)
    .sort((a,b)=>
      b.stockShortageQuantity-a.stockShortageQuantity||
      b.shortageQuantity-a.shortageQuantity||
      b.liveDemandQuantity-a.liveDemandQuantity||
      b.historicalDemandQuantity-a.historicalDemandQuantity||
      b.verifiedTradeCount-a.verifiedTradeCount||
      a.itemKind.localeCompare(b.itemKind)
    );
}

function demandView(signal){
  return freeze({
    signalId:signal.signalId,itemKind:signal.itemKind,
    liveDemandQuantity:signal.liveDemandQuantity,historicalDemandQuantity:signal.historicalDemandQuantity,
    demandQuantity:signal.demandQuantity,supplyQuantity:signal.supplyQuantity,shortageQuantity:signal.shortageQuantity,
    ownStockQuantity:signal.ownStockQuantity,stockShortageQuantity:signal.stockShortageQuantity,
    verifiedTradeCount:signal.verifiedTradeCount,marketIds:[...signal.marketIds]
  });
}

export function demandDrivenCrafterSnapshot(s,a){
  if(!livingCrafter(s,a))return view('INELIGIBLE','crafter-required');
  if(validateRc4MarketKnowledge(a).length)return view('BLOCKED','market-knowledge');
  if(a.craftTraining?.enabled===true)return view('BLOCKED','manual-training');
  if(a.adventureCombat?.status==='ACTIVE'||a.adventureEncounter)return view('BLOCKED','adventure');
  if(a.task)return view('BLOCKED','task');
  if((s.rustPossessions?.orders??[]).some(o=>o.agentId===a.id)||(s.rustMaterials?.orders??[]).some(o=>o.agentId===a.id))return view('BLOCKED','craft-busy');
  if(!homeOf(s,a.id,{completeOnly:true}))return view('BLOCKED','housing');
  if(a.hp<CRAFT_TRAINING_RULES.hp||a.satiety<CRAFT_TRAINING_RULES.satiety||a.energy<CRAFT_TRAINING_RULES.energy)return view('BLOCKED','survival');

  const projection=projectActorObservedDemand(s,a);
  if(projection.status!=='SAT')return view('UNKNOWN',projection.reason??'demand-unknown',{demandStatus:projection.status});

  const pending=pendingSupplyListing(s,a);
  if(pending)return view('WAITING','merchant-purchase-pending',{listingId:pending.id,buyOfferId:pending.buyOfferId,itemKind:pending.itemKind});

  const rows=demandRows(projection);
  if(!rows.length)return view('IDLE','no-supported-demand');

  // Existing physical stock is always used before another craft order.
  // A fresh observed BuyOffer provides the only direct Producer sale route.
  const stockWaiting=[];
  for(const signal of rows){
    const itemIds=tradableRustItemIds(s,{agentId:a.id,itemKind:signal.itemKind});
    if(!itemIds.length)continue;
    const offer=currentObservedOffers(s,a,signal.itemKind)[0]??null;
    if(offer){
      return view('READY_SELL','physical-stock',{
        agentId:a.id,demand:demandView(signal),itemId:itemIds[0],
        buyOfferId:offer.offerId,marketId:offer.marketId,
        intent:freeze({type:'RC4_ACCEPT_BUY_OFFER',data:{producerId:a.id,offerId:offer.offerId,itemId:itemIds[0]}})
      });
    }
    stockWaiting.push({signal,itemId:itemIds[0]});
  }

  let firstProcurement=null,firstBlocked=null;
  for(const signal of rows){
    const owned=tradableRustItemIds(s,{agentId:a.id,itemKind:signal.itemKind});
    if(owned.length>=signal.demandQuantity)continue;
    const route=recipeRoute(s,a,signal.itemKind);
    if(route.status==='READY'){
      return view('READY_CRAFT','local-demand',{
        agentId:a.id,demand:demandView(signal),recipeId:route.recipe.id,tier:route.recipe.tier,
        intent:freeze({type:'CRAFT_ITEM',data:{agentId:a.id,recipeId:route.recipe.id}})
      });
    }
    if(route.status==='NEEDS_MATERIALS'&&firstProcurement===null)firstProcurement={signal,route};
    else if(firstBlocked===null)firstBlocked={signal,route};
  }

  if(firstProcurement){
    const {signal,route}=firstProcurement;
    return view('NEEDS_MATERIALS',route.reason,{
      agentId:a.id,demand:demandView(signal),recipeId:route.recipe.id,tier:route.recipe.tier,missing:freeze({...route.missing}),
      procurementRequired:true
    });
  }
  if(stockWaiting.length){
    const {signal,itemId}=stockWaiting[0];
    return view('WAITING','stock-awaiting-procurement',{
      agentId:a.id,demand:demandView(signal),itemId
    });
  }
  if(firstBlocked){
    return view('BLOCKED',firstBlocked.route.reason??'no-craft-route',{
      agentId:a.id,demand:demandView(firstBlocked.signal),recipeId:firstBlocked.route.recipe?.id??null
    });
  }
  return view('IDLE','demand-covered');
}

export function demandDrivenCrafterIntent(s,a){
  const snap=demandDrivenCrafterSnapshot(s,a);
  return snap.status==='READY_CRAFT'||snap.status==='READY_SELL'?snap.intent:null;
}
