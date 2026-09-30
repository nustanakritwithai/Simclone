/** ER1 actor-scoped economic demand projection.
 * Read-only by contract: this module never creates items, money, markets, trades,
 * tasks or professions. Hidden/stale market rows are rejected instead of refreshed
 * from world truth.
 */
import {
  validateRc4MarketKnowledge,knownRc4Markets,knownRc4Listings,knownRc4BuyOffers,rc4PersonalItemNeeds
} from './rc4-market-observation.mjs?v=0.5.0';
import {withinKnowledgeRange} from './knowledge.mjs?v=0.5.0';
import {ITEM_CATALOG} from './crafting-catalog.mjs?v=0.5.0';
import {validateHomeMarketState} from './home-market.mjs?v=0.5.0';
import {validateListingCollection} from './merchant-listing.mjs?v=0.5.0';
import {validateBuyOfferCollection} from './merchant-buy-offer.mjs?v=0.5.0';
import {validateReservationState} from './merchant-reservation.mjs?v=0.5.0';
import {validateCurrencyWallet,getBalance} from './currency-wallet.mjs?v=0.5.0';
import {validateTradeReplayState} from './trade-kernel.mjs?v=0.5.0';
import {tradableRustItemIds} from './rust-possessions.mjs?v=0.5.0';
import {resourceStock,resourceAccount,personalTargets} from './individual-resources.mjs?v=0.5.0';
import {materialAmount} from './material-economy.mjs?v=0.5.0';
import {TRADE_ASSET_TYPES,tradeAssetType,validBulkTradeResourceKey} from './trade-assets.mjs?v=0.5.0';
import {crafterMaterialNeedsForObservedItems} from './crafter-production-plan.mjs?v=0.5.0';

export const ECONOMIC_DEMAND_VERSION='ER1-local-demand/1';
export const ECONOMIC_DEMAND_TTL_TICKS=720;
export const ECONOMIC_DEMAND_RESOURCE_KEYS=Object.freeze(['food','wood','stone']);

const clone=v=>structuredClone(v);
const deepFreeze=v=>{
  if(v&&typeof v==='object'&&!Object.isFrozen(v)){
    Object.freeze(v);
    for(const x of Object.values(v))deepFreeze(x);
  }
  return v;
};
const safeTick=v=>Number.isSafeInteger(v)&&v>=0;
const positive=v=>Number.isSafeInteger(v)&&v>0;
const fresh=(worldTick,observedTick,ttl)=>safeTick(worldTick)&&safeTick(observedTick)&&observedTick<=worldTick&&worldTick-observedTick<=ttl;
const keyFor=(unit,itemKind)=>unit+':'+itemKind;
const unknown=(agentId,worldTick,reason,errors=[])=>deepFreeze({
  version:ECONOMIC_DEMAND_VERSION,status:'UNKNOWN',authority:'READ_ONLY',scope:'ACTOR_OBSERVED',
  agentId:agentId??null,worldTick:safeTick(worldTick)?worldTick:null,reason,errors:[...errors],signals:[]
});

function sameMarketObservation(known,current){
  return !!known&&!!current&&
    known.marketId===current.marketId&&known.homeId===current.homeId&&
    known.ownerAgentId===current.ownerAgentId&&known.status===current.status;
}
function sameOfferObservation(known,current){
  return !!known&&!!current&&
    known.offerId===current.offerId&&known.marketId===current.marketId&&
    known.buyerId===current.buyerId&&known.itemKind===current.itemKind&&
    known.quantityWanted===current.quantityWanted&&known.unitPrice===current.unitPrice&&
    known.createdTick===current.createdTick&&known.status===current.status&&tradeAssetType(known)===tradeAssetType(current);
}
function sameListingObservation(known,current){
  return !!known&&!!current&&
    known.id===current.id&&known.marketId===current.marketId&&
    known.sellerId===current.sellerId&&known.itemKind===current.itemKind&&
    known.itemInstanceId===current.itemInstanceId&&known.quantity===current.quantity&&
    known.unitPrice===current.unitPrice&&known.revision===current.revision&&
    known.status===current.status&&known.buyOfferId===current.buyOfferId&&tradeAssetType(known)===tradeAssetType(current);
}
function rootErrors(world){
  const e=[];
  e.push(...validateHomeMarketState(world?.homeMarkets).map(x=>'HomeMarket:'+x));
  e.push(...validateListingCollection(world?.merchantListings).map(x=>'Listing:'+x));
  e.push(...validateBuyOfferCollection(world?.merchantBuyOffers).map(x=>'BuyOffer:'+x));
  e.push(...validateReservationState(world?.merchantReservations).map(x=>'Reservation:'+x));
  e.push(...validateCurrencyWallet(world).map(x=>'Wallet:'+x));
  e.push(...validateTradeReplayState(world).map(x=>'Trade:'+x));
  return e;
}
function ensureSignal(rows,{agentId,itemKind,unit='item',tradable=true,representation='physical-item-instance'}){
  const k=keyFor(unit,itemKind);
  let row=rows.get(k);
  if(!row){
    row={
      signalId:'ER1:'+agentId+':'+unit+':'+itemKind,itemKind,unit,tradable,representation,
      liveDemandQuantity:0,historicalDemandQuantity:0,demandQuantity:0,supplyQuantity:0,shortageQuantity:0,
      ownStockQuantity:0,stockShortageQuantity:0,verifiedTradeCount:0,verifiedTradeQuantity:0,
      observedTick:null,expiresTick:null,marketIds:new Set(),sources:[]
    };
    rows.set(k,row);
  }else if(tradable===true)row.tradable=true;
  return row;
}
function addSource(row,source){
  row.sources.push(source);
  if(source.marketId)row.marketIds.add(source.marketId);
  if(safeTick(source.observedTick)){
    row.observedTick=row.observedTick===null?source.observedTick:Math.max(row.observedTick,source.observedTick);
    if(safeTick(source.expiresTick))row.expiresTick=row.expiresTick===null?source.expiresTick:Math.max(row.expiresTick,source.expiresTick);
  }
}
function currentMarketMap(world,agent,ttlTicks){
  const out=new Map();
  for(const known of knownRc4Markets(agent)){
    if(!fresh(world.tick,known.observedTick,ttlTicks))continue;
    const current=world.homeMarkets.markets.find(m=>m.marketId===known.marketId);
    if(!current||current.status!=='open'||!sameMarketObservation(known,current))continue;
    out.set(known.marketId,{known,current});
  }
  return out;
}
function verifiedTradeEvidence(world,receipt){
  const payment=world.currencyWallet.receipts.find(r=>r.transactionId===receipt.transactionId);
  const reservation=world.merchantReservations.reservations.find(r=>r.id===receipt.reservationId);
  const listing=world.merchantListings.listings.find(r=>r.id===receipt.listingId);
  const ok=!!payment&&payment.kind==='TRANSFER'&&payment.fromAgentId===receipt.buyerId&&payment.toAgentId===receipt.sellerId&&
    payment.amount===receipt.totalPrice&&payment.evidence?.operation==='TRADE_TRANSFER'&&
    payment.evidence.marketId===receipt.marketId&&payment.evidence.listingId===receipt.listingId&&
    payment.evidence.reservationId===receipt.reservationId&&
    !!reservation&&reservation.status==='COMMITTED'&&reservation.transactionId===receipt.transactionId&&
    !!listing&&listing.marketId===receipt.marketId&&listing.sellerId===receipt.sellerId&&listing.itemKind===receipt.itemKind;
  return ok?{ok:true,commitTick:reservation.terminalTick}:{ok:false,commitTick:null};
}
function ownedKinds(world,subject){
  return new Set((world.rustPossessions?.items??[])
    .filter(i=>i.location?.kind==='bag'&&i.location.agentId===subject.id)
    .map(i=>i.kind));
}
function adventurerEquipmentNeeds(world,subject){
  if(subject?.profession!=='adventurer')return [];
  const owned=ownedKinds(world,subject),equipped=new Set();
  for(const e of world.rustPossessions?.equipment??[]){
    if(e.agentId!==subject.id)continue;
    const item=world.rustPossessions.items.find(i=>i.id===e.itemId&&i.location?.kind==='bag'&&i.location.agentId===subject.id);
    const slot=item&&ITEM_CATALOG[item.kind]?.equipSlot;
    if(slot)equipped.add(slot);
  }
  const out=[];
  for(const slot of ['WEAPON','ARMOR']){
    if(equipped.has(slot))continue;
    const candidates=Object.values(ITEM_CATALOG).filter(i=>i.category==='gear'&&i.equipSlot===slot).sort((a,b)=>a.id.localeCompare(b.id));
    const carried=candidates.find(i=>owned.has(i.id));
    if(carried)continue;
    const selected=candidates[0];if(!selected)continue;
    out.push({needId:'adventure-equipment:'+subject.id+':'+slot,itemKind:selected.id,quantity:1,purpose:'adventure-readiness',fulfillment:'equip',slot});
  }
  return out;
}
function directItemNeeds(world,subject){
  const seen=new Set(),out=[];
  for(const need of [...rc4PersonalItemNeeds(world,subject),...adventurerEquipmentNeeds(world,subject)]){
    if(!need?.itemKind||seen.has(need.itemKind))continue;
    seen.add(need.itemKind);out.push(need);
  }
  return out;
}
function liveCrafterItemDemandProjection(world,actor,ttlTicks){
  const knowledgeErrors=validateRc4MarketKnowledge(actor);
  if(knowledgeErrors.length)return unknown(actor.id,world.tick,'market-knowledge-invalid',knowledgeErrors);
  const rows=new Map(),markets=currentMarketMap(world,actor,ttlTicks);
  const knownOffers=knownRc4BuyOffers(actor),knownListings=knownRc4Listings(actor);
  const observedOfferNeeds=new Set();

  // This lightweight projection intentionally covers only live physical-item
  // evidence needed to decide what a nearby Crafter is currently trying to make.
  // It does not recurse into ER1 history/resource/material projections.
  for(const known of knownOffers){
    if(!fresh(world.tick,known.observedTick,ttlTicks))continue;
    const market=markets.get(known.marketId)?.current;
    const current=world.merchantBuyOffers.buyOffers.find(o=>o.offerId===known.offerId);
    if(!market||!current||current.status!=='OPEN'||!market.buyOfferIds.includes(current.offerId)||
      !sameOfferObservation(known,current)||tradeAssetType(current)!==TRADE_ASSET_TYPES.PHYSICAL_ITEM)continue;
    const buyer=world.agents.find(a=>a.id===current.buyerId&&a.alive);
    const total=current.unitPrice*current.quantityWanted,balance=getBalance(world,current.buyerId);
    if(!buyer||!Number.isSafeInteger(total)||!Number.isSafeInteger(balance)||balance<total)continue;
    const row=ensureSignal(rows,{agentId:actor.id,itemKind:current.itemKind});
    row.liveDemandQuantity+=current.quantityWanted;
    observedOfferNeeds.add(current.buyerId+'|'+current.itemKind);
    addSource(row,deepFreeze({
      kind:current.buyerId===actor.id?'MERCHANT_STOCK_SHORTAGE_BUY_OFFER':'BUY_OFFER',
      side:'DEMAND',evidenceId:current.offerId,marketId:current.marketId,buyerId:current.buyerId,
      quantity:current.quantityWanted,unitPrice:current.unitPrice,
      observedTick:known.observedTick,expiresTick:known.observedTick+ttlTicks
    }));
  }

  for(const known of knownListings){
    if(!fresh(world.tick,known.observedTick,ttlTicks))continue;
    const market=markets.get(known.marketId)?.current;
    const current=world.merchantListings.listings.find(l=>l.id===known.id);
    if(!market||!current||current.status!=='OPEN'||!market.listingIds.includes(current.id)||
      !sameListingObservation(known,current)||tradeAssetType(current)!==TRADE_ASSET_TYPES.PHYSICAL_ITEM)continue;
    const tradable=tradableRustItemIds(world,{agentId:current.sellerId,itemKind:current.itemKind});
    if(!tradable.includes(current.itemInstanceId))continue;
    const row=ensureSignal(rows,{agentId:actor.id,itemKind:current.itemKind});
    row.supplyQuantity+=current.quantity;
    addSource(row,deepFreeze({
      kind:'LISTING',side:'SUPPLY',evidenceId:current.id,marketId:current.marketId,
      quantity:current.quantity,unitPrice:current.unitPrice,itemInstanceId:current.itemInstanceId,
      observedTick:known.observedTick,expiresTick:known.observedTick+ttlTicks
    }));
  }

  for(const subject of world.agents??[]){
    if(!subject.alive||!withinKnowledgeRange(actor,subject))continue;
    for(const need of directItemNeeds(world,subject)){
      if(observedOfferNeeds.has(subject.id+'|'+need.itemKind))continue;
      const quantity=positive(need.quantity)?need.quantity:1;
      const row=ensureSignal(rows,{agentId:actor.id,itemKind:need.itemKind});
      row.liveDemandQuantity+=quantity;
      addSource(row,deepFreeze({
        kind:subject.id===actor.id?'PERSONAL_ITEM_NEED':'LOCAL_ITEM_NEED',
        side:'DEMAND',evidenceId:need.needId,subjectAgentId:subject.id,
        quantity,purpose:need.purpose,fulfillment:need.fulfillment,slot:need.slot??null,
        observedTick:world.tick,expiresTick:world.tick+1
      }));
    }
  }

  const ownTradableCounts=new Map();
  for(const item of world.rustPossessions?.items??[]){
    if(item.location?.kind!=='bag'||item.location.agentId!==actor.id||typeof item.kind!=='string')continue;
    if(!tradableRustItemIds(world,{agentId:actor.id,itemKind:item.kind}).includes(item.id))continue;
    ownTradableCounts.set(item.kind,(ownTradableCounts.get(item.kind)??0)+1);
  }
  const signals=[...rows.values()].map(row=>{
    row.demandQuantity=row.liveDemandQuantity;
    row.shortageQuantity=Math.max(0,row.demandQuantity-row.supplyQuantity);
    row.ownStockQuantity=ownTradableCounts.get(row.itemKind)??0;
    row.stockShortageQuantity=Math.max(0,row.demandQuantity-row.ownStockQuantity);
    const sources=row.sources.slice().sort((a,b)=>
      (a.observedTick??-1)-(b.observedTick??-1)||
      String(a.kind).localeCompare(String(b.kind))||
      String(a.evidenceId??'').localeCompare(String(b.evidenceId??''))
    );
    return deepFreeze({
      signalId:row.signalId,itemKind:row.itemKind,unit:'item',tradable:true,representation:'physical-item-instance',
      liveDemandQuantity:row.liveDemandQuantity,historicalDemandQuantity:0,demandQuantity:row.demandQuantity,
      supplyQuantity:row.supplyQuantity,shortageQuantity:row.shortageQuantity,
      ownStockQuantity:row.ownStockQuantity,stockShortageQuantity:row.stockShortageQuantity,
      verifiedTradeCount:0,verifiedTradeQuantity:0,observedTick:row.observedTick,expiresTick:row.expiresTick,
      marketIds:[...row.marketIds].sort(),sources,actionable:row.shortageQuantity>0
    });
  }).sort((a,b)=>a.itemKind.localeCompare(b.itemKind));
  return deepFreeze({
    version:ECONOMIC_DEMAND_VERSION,status:'SAT',authority:'READ_ONLY',scope:'ACTOR_OBSERVED',
    agentId:actor.id,worldTick:world.tick,ttlTicks,signals
  });
}

function readLocalCrafterMaterialNeeds(world,actor,rows){
  // Only Merchant policy consumes brokerage demand. Keeping this projection
  // merchant-scoped prevents Producer/Crafter/Consumer demand reads from paying
  // the Crafter material-planning cost every tick.
  if(actor.profession!=='merchant')return;
  // Reuse only item demand that this observer has already legally seen in this
  // projection. Never recurse into another actor's ER1 market projection.
  const visibleItems=[...rows.values()]
    .filter(row=>row.unit==='item'&&row.liveDemandQuantity>0)
    .map(row=>row.itemKind)
    .sort();
  if(!visibleItems.length)return;
  for(const subject of world.agents??[]){
    if(!subject.alive||subject.id===actor.id||subject.profession!=='crafter'||!withinKnowledgeRange(actor,subject))continue;
    const projected=crafterMaterialNeedsForObservedItems(world,subject,visibleItems);
    if(projected.status!=='SAT')continue;
    for(const need of projected.needs){
      if(!validBulkTradeResourceKey(need.materialKind)||!positive(need.quantity))continue;
      const row=ensureSignal(rows,{agentId:actor.id,itemKind:need.materialKind,unit:'bulk-resource',tradable:true,representation:'resource-counter'});
      row.liveDemandQuantity+=need.quantity;
      addSource(row,deepFreeze({
        kind:'LOCAL_CRAFTER_MATERIAL_NEED',side:'DEMAND',
        evidenceId:'crafter-material:'+subject.id+':'+need.materialKind,
        subjectAgentId:subject.id,quantity:need.quantity,
        observedTick:world.tick,expiresTick:world.tick+1
      }));
    }
  }
}
function readResourceShortages(world,actor,rows){
  // Existing resource helpers may repair legacy household fields. Run them only on
  // a clone so the projection cannot mutate the authoritative world.
  const shadow=clone(world);
  const a=shadow.agents?.find(x=>x.id===actor.id&&x.alive);
  if(!a)return;
  const stock=resourceStock(shadow,a),targets=personalTargets(shadow,a),account=resourceAccount(shadow,a);
  for(const itemKind of ECONOMIC_DEMAND_RESOURCE_KEYS){
    const have=Number(stock?.[itemKind]??0),target=Number(targets?.[itemKind]??0);
    if(!Number.isFinite(have)||!Number.isFinite(target))continue;
    const deficit=Math.max(0,Math.ceil(target-have));
    if(deficit<=0)continue;
    const row=ensureSignal(rows,{agentId:actor.id,itemKind,unit:'bulk-resource',tradable:false,representation:'resource-counter'});
    row.liveDemandQuantity+=deficit;
    addSource(row,deepFreeze({
      kind:'HOUSEHOLD_SHORTAGE',side:'DEMAND',quantity:deficit,
      accountKind:account?.kind??'unknown',houseId:account?.houseId??null,
      observedTick:world.tick,expiresTick:world.tick+1
    }));
  }
}

export function projectActorObservedDemand(world,agent,{ttlTicks=ECONOMIC_DEMAND_TTL_TICKS,includeCrafterMaterialDemand=true}={}){
  const actor=world?.agents?.find(a=>a.id===agent?.id&&a.alive);
  if(!world||!actor||!safeTick(world.tick)||!positive(ttlTicks))return unknown(agent?.id,world?.tick,'projection-input');
  const roots=rootErrors(world);
  if(roots.length)return unknown(actor.id,world.tick,'authority-invalid',roots);
  const knowledgeErrors=validateRc4MarketKnowledge(actor);
  if(knowledgeErrors.length)return unknown(actor.id,world.tick,'market-knowledge-invalid',knowledgeErrors);

  const rows=new Map(),markets=currentMarketMap(world,actor,ttlTicks);
  const knownOffers=knownRc4BuyOffers(actor),knownListings=knownRc4Listings(actor);
  const observedOfferNeeds=new Set();

  for(const known of knownOffers){
    if(!fresh(world.tick,known.observedTick,ttlTicks))continue;
    const market=markets.get(known.marketId)?.current;
    const current=world.merchantBuyOffers.buyOffers.find(o=>o.offerId===known.offerId);
    if(!market||!current||current.status!=='OPEN'||!market.buyOfferIds.includes(current.offerId)||!sameOfferObservation(known,current))continue;
    const buyer=world.agents.find(a=>a.id===current.buyerId&&a.alive);
    const total=current.unitPrice*current.quantityWanted,balance=getBalance(world,current.buyerId);
    if(!buyer||!Number.isSafeInteger(total)||!Number.isSafeInteger(balance)||balance<total)continue;
    const assetType=tradeAssetType(current);
    const row=assetType===TRADE_ASSET_TYPES.BULK_RESOURCE
      ?ensureSignal(rows,{agentId:actor.id,itemKind:current.itemKind,unit:'bulk-resource',tradable:true,representation:'resource-counter'})
      :ensureSignal(rows,{agentId:actor.id,itemKind:current.itemKind});
    row.liveDemandQuantity+=current.quantityWanted;
    observedOfferNeeds.add(current.buyerId+'|'+current.itemKind);
    addSource(row,deepFreeze({
      kind:current.buyerId===actor.id?'MERCHANT_STOCK_SHORTAGE_BUY_OFFER':'BUY_OFFER',
      side:'DEMAND',evidenceId:current.offerId,marketId:current.marketId,
      buyerId:current.buyerId,quantity:current.quantityWanted,unitPrice:current.unitPrice,
      observedTick:known.observedTick,expiresTick:known.observedTick+ttlTicks
    }));
  }

  for(const known of knownListings){
    if(!fresh(world.tick,known.observedTick,ttlTicks))continue;
    const market=markets.get(known.marketId)?.current;
    const current=world.merchantListings.listings.find(l=>l.id===known.id);
    if(!market||!current||current.status!=='OPEN'||!market.listingIds.includes(current.id)||!sameListingObservation(known,current))continue;
    const assetType=tradeAssetType(current);
    let row;
    if(assetType===TRADE_ASSET_TYPES.BULK_RESOURCE){
      const seller=world.agents.find(a=>a.id===current.sellerId&&a.alive);if(!seller)continue;
      if(Math.floor(materialAmount(world,seller,current.itemKind))<current.quantity)continue;
      row=ensureSignal(rows,{agentId:actor.id,itemKind:current.itemKind,unit:'bulk-resource',tradable:true,representation:'resource-counter'});
    }else{
      const tradable=tradableRustItemIds(world,{agentId:current.sellerId,itemKind:current.itemKind});
      if(!tradable.includes(current.itemInstanceId))continue;
      row=ensureSignal(rows,{agentId:actor.id,itemKind:current.itemKind});
    }
    row.supplyQuantity+=current.quantity;
    addSource(row,deepFreeze({
      kind:'LISTING',side:'SUPPLY',evidenceId:current.id,marketId:current.marketId,
      quantity:current.quantity,unitPrice:current.unitPrice,itemInstanceId:current.itemInstanceId,
      observedTick:known.observedTick,expiresTick:known.observedTick+ttlTicks
    }));
  }

  // A nearby person's currently missing supported item is observable local demand,
  // not global omniscience. Explicit observed BuyOffer demand wins to avoid counting
  // the same person's need twice.
  for(const subject of world.agents??[]){
    if(!subject.alive||!withinKnowledgeRange(actor,subject))continue;
    for(const need of directItemNeeds(world,subject)){
      if(observedOfferNeeds.has(subject.id+'|'+need.itemKind))continue;
      const quantity=positive(need.quantity)?need.quantity:1;
      const row=ensureSignal(rows,{agentId:actor.id,itemKind:need.itemKind});
      row.liveDemandQuantity+=quantity;
      addSource(row,deepFreeze({
        kind:subject.id===actor.id?'PERSONAL_ITEM_NEED':'LOCAL_ITEM_NEED',
        side:'DEMAND',evidenceId:need.needId,subjectAgentId:subject.id,
        quantity,purpose:need.purpose,fulfillment:need.fulfillment,slot:need.slot??null,
        observedTick:world.tick,expiresTick:world.tick+1
      }));
    }
  }

  if(includeCrafterMaterialDemand)readLocalCrafterMaterialNeeds(world,actor,rows);
  readResourceShortages(world,actor,rows);

  const observedListings=new Map(knownListings.map(l=>[l.id,l]));
  for(const receipt of world.tradeReplay.receipts){
    const observed=observedListings.get(receipt.listingId);
    if(!observed||observed.marketId!==receipt.marketId||observed.itemKind!==receipt.itemKind||observed.sellerId!==receipt.sellerId)continue;
    const evidence=verifiedTradeEvidence(world,receipt);
    if(!evidence.ok||!fresh(world.tick,evidence.commitTick,ttlTicks))continue;
    const party=receipt.buyerId===actor.id||receipt.sellerId===actor.id;
    if(!party&&!markets.has(receipt.marketId))continue;
    const row=tradeAssetType(receipt)===TRADE_ASSET_TYPES.BULK_RESOURCE
      ?ensureSignal(rows,{agentId:actor.id,itemKind:receipt.itemKind,unit:'bulk-resource',tradable:true,representation:'resource-counter'})
      :ensureSignal(rows,{agentId:actor.id,itemKind:receipt.itemKind});
    row.historicalDemandQuantity+=receipt.quantity;
    row.verifiedTradeCount++;
    row.verifiedTradeQuantity+=receipt.quantity;
    addSource(row,deepFreeze({
      kind:'VERIFIED_TRADE',side:'HISTORY',evidenceId:receipt.transactionId,marketId:receipt.marketId,
      quantity:receipt.quantity,unitPrice:receipt.unitPrice,
      observedTick:evidence.commitTick,expiresTick:evidence.commitTick+ttlTicks
    }));
  }

  const ownTradableCounts=new Map();
  for(const item of world.rustPossessions?.items??[]){
    if(item.location?.kind!=='bag'||item.location.agentId!==actor.id||typeof item.kind!=='string')continue;
    if(!tradableRustItemIds(world,{agentId:actor.id,itemKind:item.kind}).includes(item.id))continue;
    ownTradableCounts.set(item.kind,(ownTradableCounts.get(item.kind)??0)+1);
  }

  const signals=[...rows.values()].map(row=>{
    row.demandQuantity=Math.max(row.liveDemandQuantity,row.historicalDemandQuantity);
    row.shortageQuantity=Math.max(0,row.demandQuantity-row.supplyQuantity);
    row.ownStockQuantity=row.unit==='item'
      ?(ownTradableCounts.get(row.itemKind)??0)
      :Math.floor(materialAmount(world,actor,row.itemKind));
    row.stockShortageQuantity=Math.max(0,row.demandQuantity-row.ownStockQuantity);
    const sources=row.sources.slice().sort((a,b)=>
      (a.observedTick??-1)-(b.observedTick??-1)||
      String(a.kind).localeCompare(String(b.kind))||
      String(a.evidenceId??'').localeCompare(String(b.evidenceId??''))
    );
    return deepFreeze({
      signalId:row.signalId,itemKind:row.itemKind,unit:row.unit,tradable:row.tradable,representation:row.representation,
      liveDemandQuantity:row.liveDemandQuantity,historicalDemandQuantity:row.historicalDemandQuantity,
      demandQuantity:row.demandQuantity,supplyQuantity:row.supplyQuantity,shortageQuantity:row.shortageQuantity,
      ownStockQuantity:row.ownStockQuantity,stockShortageQuantity:row.stockShortageQuantity,
      verifiedTradeCount:row.verifiedTradeCount,verifiedTradeQuantity:row.verifiedTradeQuantity,
      observedTick:row.observedTick,expiresTick:row.expiresTick,
      marketIds:[...row.marketIds].sort(),sources,
      actionable:row.tradable&&row.shortageQuantity>0
    });
  }).sort((a,b)=>a.unit.localeCompare(b.unit)||a.itemKind.localeCompare(b.itemKind));

  return deepFreeze({
    version:ECONOMIC_DEMAND_VERSION,status:'SAT',authority:'READ_ONLY',scope:'ACTOR_OBSERVED',
    agentId:actor.id,worldTick:world.tick,ttlTicks,signals
  });
}

export function observedDemandFor(world,agent,itemKind,options={}){
  const projection=projectActorObservedDemand(world,agent,options);
  if(projection.status!=='SAT')return deepFreeze({status:'UNKNOWN',reason:projection.reason,signal:null});
  return deepFreeze({status:'SAT',signal:projection.signals.find(s=>s.itemKind===itemKind)??null});
}
