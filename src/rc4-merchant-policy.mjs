/**
 * RC4 Merchant AI — pure decision policy over canonical authority snapshots.
 *
 * The policy can request travel, restock, listing, and market-open actions, but
 * cannot mutate Rust possession, wallet, transaction, ledger, housing, market
 * or profession state. Pricing is deliberately delegated to the pricing/ledger
 * authority through a bounded pricing-evidence request.
 */
import {customerMarketDecision} from './rc4-customer-market-policy.mjs?v=0.5.0';
import {projectActorObservedDemand} from './economic-demand.mjs?v=0.5.0';
import {homeOf} from './individual-housing.mjs?v=0.5.0';
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {RULES,routeField,routeDistance} from './survival.mjs?v=0.5.0';
import {getBalance} from './currency-wallet.mjs?v=0.5.0';
import {merchantLedgerFromCollection} from './merchant-ledger.mjs?v=0.5.0';
import {materialAmount} from './material-economy.mjs?v=0.5.0';
import {tradableRustItemIds} from './rust-possessions.mjs?v=0.5.0';
import {TRADE_ASSET_TYPES,tradeAssetType,validBulkTradeResourceKey} from './trade-assets.mjs?v=0.5.0';
import {projectHomeMarketForTrade} from './home-market.mjs?v=0.5.0';
import {isCanonicalMarketTravelTask,verifyCanonicalMarketArrival} from './navigation-arrival-evidence.mjs?v=0.5.0';
import {quoteAskPrice,quoteBidPrice,isCanonicalMoney} from './merchant-pricing.mjs?v=0.5.0';

export const RC4_MERCHANT_AI_VERSION='RC4-merchant-ai-0.1';
export const RC4_MERCHANT_AI_RULES=Object.freeze({
  homeRange:1,
  maxRestockPerCycle:1,
  maxDemandRows:24,
});

const lower=v=>typeof v==='string'?v.toLowerCase():'';
const safeInt=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
const validId=v=>(typeof v==='string'&&v.length>0)||(Number.isSafeInteger(v)&&v>=0);
const sameId=(a,b)=>validId(a)&&validId(b)&&String(a)===String(b);
const encode=v=>encodeURIComponent(String(v));
const manhattan=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const frozen=v=>Object.freeze(v);
const clone=v=>JSON.parse(JSON.stringify(v));

function point(v){return v&&Number.isInteger(v.x)&&Number.isInteger(v.y)?{x:v.x,y:v.y}:null;}
function homePoint(s){return point(s?.market?.storefrontSocket)??point(s?.home?.origin)??point(s?.home?.storefrontSocket);}
function atHome(s){const p=point(s?.agent),h=homePoint(s);return Boolean(p&&h&&manhattan(p,h)<=RC4_MERCHANT_AI_RULES.homeRange);}
function journal(s){return Array.isArray(s?.intentJournal)?s.intentJournal:[];}
function results(s){return Array.isArray(s?.transactionResults)?s.transactionResults:[];}
function ownHistory(s){return Array.isArray(s?.knowledge?.ownTransactionHistory)?s.knowledge.ownTransactionHistory:[];}
function activeOwnListings(s){
  const rows=Array.isArray(s?.market?.listings)?s.market.listings:Array.isArray(s?.ownMarketListings)?s.ownMarketListings:[];
  return rows.filter(l=>l&&['active','open'].includes(lower(l.status))&&sameId(l.sellerId,s?.agent?.id));
}
function canonicalBag(s){
  const a=s?.agent,p=s?.rustPossessions??{};
  const rows=Array.isArray(p.items)?p.items:Array.isArray(p.bag)?p.bag:[];
  return rows.filter(i=>i&&validId(i.id)&&typeof i.kind==='string'&&i.kind.length>0&&(
    i.location?i.location.kind==='bag'&&sameId(i.location.agentId,a?.id):true
  )).sort((x,y)=>String(x.id).localeCompare(String(y.id)));
}
function soldAfter(s,itemId,tick){
  return ownHistory(s).some(r=>r&&sameId(r.itemInstanceId,itemId)&&lower(r.side)==='seller'&&lower(r.status)==='verified'&&Number(r.commitTick??r.tick??-1)>=tick);
}
function committedRestockResults(s){
  return results(s).filter(r=>r&&r.purpose==='restock'&&sameId(r.buyerId,s?.agent?.id)&&lower(r.verificationStatus??r.status)==='verified'&&lower(r.outcome??r.result)==='committed')
    .sort((a,b)=>(Number(b.commitTick??b.tick??-1)-Number(a.commitTick??a.tick??-1))||String(b.transactionId??'').localeCompare(String(a.transactionId??'')));
}
function demandRows(s){
  const rows=[];
  for(const d of Array.isArray(s?.knowledge?.localDemand)?s.knowledge.localDemand:[]){
    if(!d||typeof d.itemKind!=='string'||!safeInt(d.quantityWanted,1)||!safeInt(d.observedTick,0))continue;
    rows.push({evidenceId:validId(d.observationId)?d.observationId:`demand:${d.itemKind}:${d.observedTick}`,itemKind:d.itemKind,quantityWanted:d.quantityWanted,observedTick:d.observedTick,source:'local-demand'});
  }
  for(const r of ownHistory(s)){
    if(!r||lower(r.side)!=='seller'||lower(r.status)!=='verified'||typeof r.itemKind!=='string'||!safeInt(r.quantity,1))continue;
    const t=Number(r.commitTick??r.tick);if(!safeInt(t,0))continue;
    rows.push({evidenceId:`sale:${r.transactionId??`${r.itemKind}:${t}`}`,itemKind:r.itemKind,quantityWanted:r.quantity,observedTick:t,source:'own-sale'});
  }
  const best=new Map();
  for(const row of rows){
    const old=best.get(row.itemKind);
    if(!old||row.observedTick>old.observedTick||row.observedTick===old.observedTick&&String(row.evidenceId).localeCompare(String(old.evidenceId))<0)best.set(row.itemKind,row);
  }
  return [...best.values()].sort((a,b)=>b.quantityWanted-a.quantityWanted||b.observedTick-a.observedTick||a.itemKind.localeCompare(b.itemKind)).slice(0,RC4_MERCHANT_AI_RULES.maxDemandRows);
}
function listedItemIds(s){return new Set(activeOwnListings(s).map(l=>String(l.itemInstanceId)));}
function demandForKind(rows,kind){return rows.find(r=>r.itemKind===kind)??null;}
function restockCycleKey(a,d){return `rc4:merchant:restock-cycle:${encode(a.id)}:${encode(d.itemKind)}:${encode(d.evidenceId)}`;}
function cycleAlreadyRequested(s,key){return journal(s).some(r=>r&&r.restockCycleKey===key&&r.type==='SUBMIT_PURCHASE'&&!['rejected','failed','cancelled'].includes(lower(r.status)));}
function cycleCommitted(s,key){return results(s).some(r=>r&&r.restockCycleKey===key&&lower(r.verificationStatus??r.status)==='verified'&&lower(r.outcome??r.result)==='committed');}
function pricingEvidence(s,demand){
  const ownTransactions=ownHistory(s).filter(r=>r&&r.itemKind===demand.itemKind&&lower(r.status)==='verified').slice(-8).map(r=>r.transactionId).filter(validId);
  const observedListings=(Array.isArray(s?.knowledge?.knownListings)?s.knowledge.knownListings:[]).filter(l=>l&&l.itemKind===demand.itemKind).slice(0,8).map(l=>l.listingId).filter(validId);
  return {demandEvidenceId:demand.evidenceId,allowedSources:['own-transaction-history','observed-market','local-demand'],ownTransactionIds:ownTransactions,observedListingIds:observedListings};
}
function listingProposal(s,item,demand){
  const a=s.agent,m=s.market,intentId=`rc4:merchant:list:${encode(a.id)}:${encode(m.marketId)}:${encode(item.id)}:${encode(demand.evidenceId)}`;
  if(journal(s).some(r=>r&&r.intentId===intentId))return frozen({type:'WAIT',reason:'listing-proposal-recorded',intentId,agentId:a.id,itemInstanceId:item.id,authoritative:false});
  return frozen({
    type:'PROPOSE_LISTING',intentId,agentId:a.id,sellerId:a.id,marketId:m.marketId,homeId:s.home.homeId,itemKind:item.kind,itemInstanceId:item.id,quantity:1,
    pricingRequest:{mode:'merchant-ledger',evidence:pricingEvidence(s,demand)},authoritative:false,
  });
}
function returnHomeIntent(s,item,demand,reason='stock-away-from-home'){
  const a=s.agent,target=homePoint(s),intentId=`rc4:merchant:return-home:${encode(a.id)}:${encode(item.id)}:${encode(demand?.evidenceId??'stock')}`;
  return frozen({type:'CREATE_TRAVEL_GOAL',intentId,agentId:a.id,purpose:'return-stock-home',reason,itemKind:item.kind,itemInstanceId:item.id,homeId:s.home.homeId,target,pathRequired:true,teleport:false,authoritative:false});
}

export function merchantDecision(s){
  const a=s?.agent;if(!a||a.alive!==true||a.profession!=='merchant'||!validId(a.id)||!point(a))return null;
  const h=s?.home;if(!h||h.valid===false||!validId(h.homeId)||!sameId(h.ownerAgentId,a.id)||!homePoint(s))return null;
  const bag=canonicalBag(s),demands=demandRows(s),listed=listedItemIds(s);

  // A verified restock transaction is not permission to invent stock. Wait for
  // the canonical Rust item, then physically return it home before listing.
  for(const r of committedRestockResults(s)){
    const commitTick=Number(r.commitTick??r.tick??0),item=bag.find(i=>sameId(i.id,r.itemInstanceId));
    if(!item){
      if(soldAfter(s,r.itemInstanceId,commitTick))continue;
      return frozen({type:'WAIT_TRANSACTION_MATERIALIZATION',intentId:`rc4:merchant:wait-item:${encode(r.transactionId)}`,agentId:a.id,transactionId:r.transactionId,itemInstanceId:r.itemInstanceId,authoritative:false});
    }
    const d=demandForKind(demands,item.kind)??{evidenceId:r.restockCycleKey??`restock:${r.transactionId}`,itemKind:item.kind,quantityWanted:1,observedTick:commitTick,source:'verified-restock'};
    if(!atHome(s))return returnHomeIntent(s,item,d,'verified-restock');
    if(s.market&&sameId(s.market.ownerAgentId,a.id)&&!listed.has(String(item.id)))return listingProposal(s,item,d);
  }

  // Sell only canonical Rust items that the merchant actually possesses.
  for(const d of demands){
    const item=bag.find(i=>i.kind===d.itemKind&&!listed.has(String(i.id)));if(!item)continue;
    if(!atHome(s))return returnHomeIntent(s,item,d);
    if(!s.market)return frozen({type:'REQUEST_HOME_MARKET',intentId:`rc4:merchant:market:${encode(a.id)}:${encode(h.homeId)}`,agentId:a.id,homeId:h.homeId,ownerAgentId:a.id,authoritative:false});
    if(!sameId(s.market.ownerAgentId,a.id)||!sameId(s.market.homeId,h.homeId))return null;
    return listingProposal(s,item,d);
  }

  // Once a real listing exists, opening the shop is still only an intent.
  if(s.market&&sameId(s.market.ownerAgentId,a.id)&&sameId(s.market.homeId,h.homeId)&&lower(s.market.status)==='closed'&&activeOwnListings(s).length){
    const intentId=`rc4:merchant:open-market:${encode(a.id)}:${encode(s.market.marketId)}`;
    if(journal(s).some(r=>r&&r.intentId===intentId))return frozen({type:'WAIT',reason:'open-market-intent-recorded',intentId,agentId:a.id,authoritative:false});
    return frozen({type:'OPEN_MARKET',intentId,agentId:a.id,marketId:s.market.marketId,homeId:h.homeId,authoritative:false});
  }

  // Restock only from known/observed markets. Each demand-evidence row defines
  // one bounded cycle; replay cannot mint fresh intents with new IDs.
  for(const d of demands){
    const target=Math.min(RC4_MERCHANT_AI_RULES.maxRestockPerCycle,Math.max(1,d.quantityWanted));
    const current=bag.filter(i=>i.kind===d.itemKind).length;if(current>=target)continue;
    const key=restockCycleKey(a,d);
    if(cycleAlreadyRequested(s,key)||cycleCommitted(s,key))return frozen({type:'WAIT_RESTOCK',intentId:`rc4:merchant:wait-restock:${encode(key)}`,agentId:a.id,itemKind:d.itemKind,restockCycleKey:key,authoritative:false});
    const pseudo={
      ...s,
      needs:[{needId:`restock:${d.evidenceId}`,itemKind:d.itemKind,quantity:Math.min(target-current,RC4_MERCHANT_AI_RULES.maxRestockPerCycle),priority:1,purpose:'restock',fulfillment:'carry'}],
    };
    const decision=customerMarketDecision(pseudo);if(!decision)continue;
    if(decision.type==='CARRY_PURCHASED_ITEM'||decision.type==='EQUIP_PURCHASED_ITEM'||decision.type==='USE_PURCHASED_ITEM')continue;
    return frozen({...clone(decision),role:'merchant',purpose:'restock',demandEvidenceId:d.evidenceId,restockCycleKey:key,authoritative:false});
  }
  return null;
}


/**
 * ER5 Merchant Full Autonomy — world-backed, read-only commercial policy.
 *
 * This is intentionally separate from the original RC4 synthetic-policy adapter
 * above. It consumes released canonical world projections and returns proposals
 * only. The engine must route every proposal through RC4 commands.
 */
export const ER5_MERCHANT_AUTONOMY_VERSION='ER5-merchant-autonomy/1';
export const ER5_MERCHANT_AUTONOMY_RULES=Object.freeze({
  maxUnitsPerCycle:1,
  askMarginBps:3000,
  bidDiscountBps:3000,
});

const er5Positive=n=>Number.isSafeInteger(n)&&n>0;
const er5Safe=n=>Number.isSafeInteger(n)&&n>=0;
const er5Freeze=v=>{
  if(v&&typeof v==='object'&&!Object.isFrozen(v)){
    Object.freeze(v);
    for(const x of Object.values(v))er5Freeze(x);
  }
  return v;
};
const er5View=(status,reason,extra={})=>er5Freeze({
  version:ER5_MERCHANT_AUTONOMY_VERSION,status,reason,...extra
});

function er5OwnMarket(world,actor){
  return world?.homeMarkets?.markets?.find(m=>m.ownerAgentId===actor.id&&['open','closed'].includes(m.status))??null;
}
function er5DemandRows(projection){
  return (projection?.signals??[]).filter(s=>
    s?.tradable===true&&typeof s.itemKind==='string'&&er5Positive(s.demandQuantity)&&
    (s.unit==='item'||s.unit==='bulk-resource')
  ).sort((a,b)=>
    (b.stockShortageQuantity??0)-(a.stockShortageQuantity??0)||
    (b.shortageQuantity??0)-(a.shortageQuantity??0)||
    (b.liveDemandQuantity??0)-(a.liveDemandQuantity??0)||
    (b.historicalDemandQuantity??0)-(a.historicalDemandQuantity??0)||
    (b.verifiedTradeCount??0)-(a.verifiedTradeCount??0)||
    a.itemKind.localeCompare(b.itemKind)
  );
}
function er5AssetType(signal){
  return signal?.unit==='bulk-resource'?TRADE_ASSET_TYPES.BULK_RESOURCE:TRADE_ASSET_TYPES.PHYSICAL_ITEM;
}
function er5OpenOffers(world,actor,{excludeOfferId=null}={}){
  return (world?.merchantBuyOffers?.buyOffers??[]).filter(o=>
    o?.status==='OPEN'&&o.buyerId===actor.id&&o.offerId!==excludeOfferId
  );
}
function er5Funding(world,actor,{excludeOfferId=null}={}){
  const balance=getBalance(world,actor.id);
  if(!isCanonicalMoney(balance))return er5View('UNKNOWN','wallet-evidence',{agentId:actor.id});
  let committed=0;
  for(const offer of er5OpenOffers(world,actor,{excludeOfferId})){
    const total=offer.unitPrice*offer.quantityWanted;
    if(!er5Positive(offer.quantityWanted)||!isCanonicalMoney(offer.unitPrice,{allowZero:false})||
      !Number.isSafeInteger(total)||total<1)
      return er5View('UNKNOWN','buy-offer-funding-evidence',{agentId:actor.id});
    committed+=total;
    if(!Number.isSafeInteger(committed))return er5View('UNKNOWN','buy-offer-funding-overflow',{agentId:actor.id});
  }
  return er5View('SAT','funding',{agentId:actor.id,balance,committed,available:Math.max(0,balance-committed)});
}
function er5PhysicalBasis(ledger,itemId,itemKind){
  for(const purchase of ledger?.purchases??[]){
    if(tradeAssetType(purchase)!==TRADE_ASSET_TYPES.PHYSICAL_ITEM||purchase.itemKind!==itemKind)continue;
    if(Array.isArray(purchase.remainingItemIds)&&purchase.remainingItemIds.includes(itemId))
      return {transactionId:purchase.transactionId,unitPrice:purchase.unitPrice,itemId};
  }
  return null;
}
function er5BulkBasis(ledger,itemKind){
  for(const purchase of ledger?.purchases??[]){
    if(tradeAssetType(purchase)!==TRADE_ASSET_TYPES.BULK_RESOURCE||purchase.itemKind!==itemKind)continue;
    if(er5Positive(purchase.remainingQuantity))
      return {transactionId:purchase.transactionId,unitPrice:purchase.unitPrice,remainingQuantity:purchase.remainingQuantity};
  }
  return null;
}
function er5OpenOwnListings(world,actor,itemKind){
  return (world?.merchantListings?.listings??[]).filter(l=>
    l?.status==='OPEN'&&l.sellerId===actor.id&&l.itemKind===itemKind
  );
}
function er5ListedPhysicalIds(world,actor){
  return new Set((world?.merchantListings?.listings??[]).filter(l=>
    l?.status==='OPEN'&&l.sellerId===actor.id&&tradeAssetType(l)===TRADE_ASSET_TYPES.PHYSICAL_ITEM
  ).map(l=>l.itemInstanceId));
}
function er5BulkCommittedByActor(world,actor,itemKind){
  let total=0;
  for(const l of er5OpenOwnListings(world,actor,itemKind)){
    if(tradeAssetType(l)!==TRADE_ASSET_TYPES.BULK_RESOURCE)continue;
    total+=l.quantity;
    if(!Number.isSafeInteger(total))return null;
  }
  return total;
}
function er5SaleableStock(world,actor,ledger,signal){
  const type=er5AssetType(signal),open=er5OpenOwnListings(world,actor,signal.itemKind);
  if(type===TRADE_ASSET_TYPES.PHYSICAL_ITEM){
    const listed=er5ListedPhysicalIds(world,actor);
    const owned=tradableRustItemIds(world,{agentId:actor.id,itemKind:signal.itemKind}).slice().sort((a,b)=>a-b);
    const unlisted=[];
    for(const itemId of owned){
      if(listed.has(itemId))continue;
      const basis=er5PhysicalBasis(ledger,itemId,signal.itemKind);
      if(basis)unlisted.push({itemId,basis});
    }
    const listedWithBasis=open.filter(l=>tradeAssetType(l)===type&&!!er5PhysicalBasis(ledger,l.itemInstanceId,signal.itemKind)).length;
    return {type,ownedQuantity:owned.length,listedQuantity:listedWithBasis,availableQuantity:unlisted.length,unlisted};
  }
  const basis=er5BulkBasis(ledger,signal.itemKind);
  const owned=Math.floor(materialAmount(world,actor,signal.itemKind));
  const committed=er5BulkCommittedByActor(world,actor,signal.itemKind);
  if(!er5Safe(owned)||committed===null)return {type,status:'UNKNOWN'};
  const basisQuantity=basis?.remainingQuantity??0;
  const available=Math.max(0,Math.min(owned,basisQuantity)-committed);
  const listedQuantity=open.filter(l=>tradeAssetType(l)===type).reduce((n,l)=>n+l.quantity,0);
  return {type,ownedQuantity:owned,listedQuantity,availableQuantity:available,basis};
}
function er5AskPrice(stock,signal){
  const basis=stock.type===TRADE_ASSET_TYPES.PHYSICAL_ITEM?stock.unlisted?.[0]?.basis:stock.basis;
  if(!basis||!isCanonicalMoney(basis.unitPrice,{allowZero:false}))return {state:'UNKNOWN',reason:'acquisition-cost'};
  const localStock=Math.min(MERCHANT_PRICING_SAFE_MAX,Math.max(0,(stock.listedQuantity??0)+(stock.availableQuantity??0)));
  const recentDemand=Math.min(MERCHANT_PRICING_SAFE_MAX,Math.max(0,signal.demandQuantity??signal.liveDemandQuantity??0));
  return quoteAskPrice({
    acquisitionCost:basis.unitPrice,
    marginBps:ER5_MERCHANT_AUTONOMY_RULES.askMarginBps,
    scarcity:{localStock,targetStock:1,recentDemand}
  });
}
const MERCHANT_PRICING_SAFE_MAX=1000000000;
function er5ReferencePrice(signal,ledger){
  const observed=(signal.sources??[]).filter(s=>s?.kind==='LISTING'&&isCanonicalMoney(s.unitPrice,{allowZero:false}))
    .map(s=>s.unitPrice).sort((a,b)=>a-b);
  if(observed.length)return {price:observed[0],source:'observed-listing'};
  const verified=(signal.sources??[]).filter(s=>s?.kind==='VERIFIED_TRADE'&&isCanonicalMoney(s.unitPrice,{allowZero:false}))
    .map(s=>s.unitPrice).sort((a,b)=>a-b);
  if(verified.length)return {price:verified[0],source:'verified-trade'};
  const sales=(ledger?.sales??[]).filter(s=>s.itemKind===signal.itemKind&&isCanonicalMoney(s.unitPrice,{allowZero:false}))
    .map(s=>s.unitPrice).sort((a,b)=>a-b);
  if(sales.length)return {price:sales[0],source:'own-ledger-sale'};
  const buys=(ledger?.purchases??[]).filter(p=>p.itemKind===signal.itemKind&&isCanonicalMoney(p.unitPrice,{allowZero:false}))
    .map(p=>p.unitPrice).sort((a,b)=>a-b);
  return buys.length?{price:buys[0],source:'own-ledger-purchase'}:null;
}
function er5ExistingOffer(world,actor,signal){
  const type=er5AssetType(signal);
  return er5OpenOffers(world,actor).filter(o=>o.itemKind===signal.itemKind&&tradeAssetType(o)===type)
    .sort((a,b)=>a.createdTick-b.createdTick||a.offerId.localeCompare(b.offerId))[0]??null;
}
function er5ObservedListingCandidates(world,actor,signal){
  const expected=er5AssetType(signal),rows=[];
  for(const source of signal.sources??[]){
    if(source?.kind!=='LISTING'||source.side!=='SUPPLY'||typeof source.evidenceId!=='string')continue;
    const listing=world?.merchantListings?.listings?.find(l=>l.id===source.evidenceId);
    if(!listing||listing.status!=='OPEN'||listing.sellerId===actor.id||listing.itemKind!==signal.itemKind||
      tradeAssetType(listing)!==expected||listing.quantity!==source.quantity||listing.unitPrice!==source.unitPrice)continue;
    if(expected===TRADE_ASSET_TYPES.PHYSICAL_ITEM&&listing.itemInstanceId!==source.itemInstanceId)continue;
    let quantity=1;
    if(expected===TRADE_ASSET_TYPES.BULK_RESOURCE)quantity=Math.min(ER5_MERCHANT_AUTONOMY_RULES.maxUnitsPerCycle,listing.quantity);
    if(listing.buyOfferId){
      const offer=world?.merchantBuyOffers?.buyOffers?.find(o=>o.offerId===listing.buyOfferId&&o.status==='OPEN');
      if(!offer||offer.buyerId!==actor.id||tradeAssetType(offer)!==expected||quantity!==listing.quantity)continue;
    }
    const projected=projectHomeMarketForTrade(world,world.homeMarkets,{marketId:listing.marketId});
    if(!projected.ok||projected.market.open!==true)continue;
    const distance=routeDistance(routeField(world,actor),projected.market);
    if(distance<0)continue;
    const totalPrice=listing.unitPrice*quantity;
    if(!er5Positive(quantity)||!Number.isSafeInteger(totalPrice)||totalPrice<1)continue;
    const funding=er5Funding(world,actor,{excludeOfferId:listing.buyOfferId??null});
    if(funding.status!=='SAT')return {status:'UNKNOWN',reason:funding.reason,rows:[]};
    rows.push({
      listingId:listing.id,listingRevision:listing.revision,marketId:listing.marketId,
      itemKind:listing.itemKind,itemInstanceId:listing.itemInstanceId??null,assetType:expected,
      quantity,unitPrice:listing.unitPrice,totalPrice,distance,affordable:totalPrice<=funding.available,
      availableFunds:funding.available,market:{...projected.market}
    });
  }
  rows.sort((a,b)=>a.unitPrice-b.unitPrice||a.totalPrice-b.totalPrice||a.distance-b.distance||
    a.marketId.localeCompare(b.marketId)||a.listingId.localeCompare(b.listingId));
  return {status:'SAT',reason:'observed-listings',rows};
}
function er5Protected(world,actor){
  if(!canPerformProductiveWork(world,actor))return 'productive-stage';
  if(actor.adventureCombat?.status==='ACTIVE'||actor.adventureEncounter)return 'adventure';
  if(actor.satiety<RULES.hungry||actor.energy<RULES.exhausted)return 'survival';
  if(actor.task&&!isCanonicalMarketTravelTask(actor.task))return 'task';
  return null;
}
function er5ListingIntent(world,actor,market,signal,stock){
  const pricing=er5AskPrice(stock,signal);
  if(pricing.state!=='SAT')return er5View(pricing.state==='UNKNOWN'?'BLOCKED':'UNKNOWN',pricing.reason??'pricing',{agentId:actor.id,itemKind:signal.itemKind});
  if(stock.type===TRADE_ASSET_TYPES.PHYSICAL_ITEM){
    const row=stock.unlisted[0],requestId='ER5:'+row.basis.transactionId+':'+row.itemId;
    return er5View('SAT','list-owned-stock',{
      type:'CREATE_LISTING',agentId:actor.id,marketId:market.marketId,itemKind:signal.itemKind,
      assetType:stock.type,itemId:row.itemId,quantity:1,unitPrice:pricing.askPrice,requestId,
      acquisitionTransactionId:row.basis.transactionId
    });
  }
  const requestId='ER5:'+stock.basis.transactionId+':'+stock.basis.remainingQuantity;
  return er5View('SAT','list-owned-stock',{
    type:'CREATE_LISTING',agentId:actor.id,marketId:market.marketId,itemKind:signal.itemKind,
    assetType:stock.type,quantity:1,unitPrice:pricing.askPrice,requestId,
    acquisitionTransactionId:stock.basis.transactionId
  });
}

/** World-backed Merchant policy used by ER5 engine integration and purchase authorization. */
export function merchantAutonomySnapshot(world,agent){
  if(!world||!Number.isSafeInteger(agent?.id))return er5View('UNKNOWN','input');
  const actor=world.agents?.find(a=>a.id===agent.id)??null;
  if(!actor)return er5View('UNKNOWN','actor');
  if(actor.alive!==true||actor.profession!=='merchant')return er5View('INELIGIBLE','merchant-required',{agentId:actor.id});
  const home=homeOf(world,actor.id,{completeOnly:true});
  if(!home)return er5View('BLOCKED','housing',{agentId:actor.id});
  const protectedReason=er5Protected(world,actor);
  if(protectedReason)return er5View('BLOCKED',protectedReason,{agentId:actor.id});
  const projection=projectActorObservedDemand(world,actor);
  if(projection.status!=='SAT'||projection.scope!=='ACTOR_OBSERVED'||!Array.isArray(projection.signals))
    return er5View('UNKNOWN',projection.reason??'demand-evidence',{agentId:actor.id,demandStatus:projection.status??'UNKNOWN'});
  const ledger=merchantLedgerFromCollection(world.merchantLedgers,actor.id);
  if(!ledger)return er5View('UNKNOWN','merchant-ledger',{agentId:actor.id});
  const rows=er5DemandRows(projection);
  if(!rows.length){
    if(isCanonicalMarketTravelTask(actor.task))return er5View('SAT','demand-expired',{type:'CANCEL_TRAVEL',agentId:actor.id});
    return er5View('IDLE','no-observed-demand',{agentId:actor.id});
  }
  const market=er5OwnMarket(world,actor);
  if(!market)return er5View('SAT','home-market-required',{type:'CREATE_MARKET',agentId:actor.id,homeId:home.houseId});

  // Once ER5 starts a canonical market journey, keep that journey stable.
  // Revalidate every demanded item against supply in the journey's target market
  // before allowing unrelated higher-priority shortages to cancel it.
  const travelling=isCanonicalMarketTravelTask(actor.task);
  if(travelling){
    const targetMarketId=actor.task.rc4MarketTravel.marketId;
    let selected=null;
    for(const signal of rows){
      const stock=er5SaleableStock(world,actor,ledger,signal);
      if(stock.status==='UNKNOWN')return er5View('UNKNOWN','stock-evidence',{agentId:actor.id,itemKind:signal.itemKind});
      const covered=(stock.listedQuantity??0)+(stock.availableQuantity??0);
      if(Math.max(0,signal.demandQuantity-covered)<1)continue;
      const candidates=er5ObservedListingCandidates(world,actor,signal);
      if(candidates.status!=='SAT')return er5View('UNKNOWN',candidates.reason,{agentId:actor.id,itemKind:signal.itemKind});
      const sameMarket=candidates.rows.filter(x=>x.affordable&&x.marketId===targetMarketId);
      if(sameMarket.length){selected=sameMarket[0];break;}
    }
    if(!selected)
      return er5View('SAT','observed-supply-invalidated',{type:'CANCEL_TRAVEL',agentId:actor.id,marketId:targetMarketId});
    const arrival=verifyCanonicalMarketArrival(world,{agentId:actor.id,market:selected.market});
    if(arrival.state==='UNKNOWN')
      return er5View('SAT','travelling',{type:'WAIT_TRAVEL',agentId:actor.id,marketId:selected.marketId,listingId:selected.listingId});
    if(arrival.state!=='SAT')
      return er5View('SAT','arrival-invalid',{type:'CANCEL_TRAVEL',agentId:actor.id,marketId:selected.marketId});
    return er5View('SAT','ready-buy',{
      ...selected,type:'BUY_LISTING',agentId:actor.id,
      intent:er5Freeze({buyerId:actor.id,listingId:selected.listingId,listingRevision:selected.listingRevision,quantity:selected.quantity})
    });
  }

  // Owned canonical resale stock is always offered before sourcing more.
  let blocked=null;
  for(const signal of rows){
    const stock=er5SaleableStock(world,actor,ledger,signal);
    if(stock.status==='UNKNOWN')return er5View('UNKNOWN','stock-evidence',{agentId:actor.id,itemKind:signal.itemKind});
    if(stock.availableQuantity>0)return er5ListingIntent(world,actor,market,signal,stock);
  }

  // An existing Listing or BuyOffer becomes visible to counterparties only from an open Home Market.
  const hasOpenListing=(world.merchantListings?.listings??[]).some(l=>l.status==='OPEN'&&l.sellerId===actor.id);
  const hasOpenOffer=er5OpenOffers(world,actor).length>0;
  if(market.status==='closed'&&(hasOpenListing||hasOpenOffer))
    return er5View('SAT','open-home-market',{type:'OPEN_MARKET',agentId:actor.id,marketId:market.marketId});

  for(const signal of rows){
    const stock=er5SaleableStock(world,actor,ledger,signal);
    if(stock.status==='UNKNOWN')return er5View('UNKNOWN','stock-evidence',{agentId:actor.id,itemKind:signal.itemKind});
    const covered=(stock.listedQuantity??0)+(stock.availableQuantity??0);
    const shortage=Math.max(0,signal.demandQuantity-covered);
    if(shortage<1)continue;

    const candidates=er5ObservedListingCandidates(world,actor,signal);
    if(candidates.status!=='SAT')return er5View('UNKNOWN',candidates.reason,{agentId:actor.id,itemKind:signal.itemKind});
    const affordable=candidates.rows.filter(x=>x.affordable);
    if(affordable.length){
      const selected=affordable[0];
      return er5View('SAT','travel-to-observed-supply',{
        ...selected,type:'TRAVEL_TO_MARKET',agentId:actor.id,
        intent:er5Freeze({agentId:actor.id,marketId:selected.marketId})
      });
    }

    const existing=er5ExistingOffer(world,actor,signal);
    if(existing){
      const funding=er5Funding(world,actor,{excludeOfferId:existing.offerId});
      const total=existing.unitPrice*existing.quantityWanted;
      if(funding.status!=='SAT'||!Number.isSafeInteger(total))return er5View('UNKNOWN','buy-offer-funding-evidence',{agentId:actor.id});
      if(total>funding.available){
        blocked??=er5View('BLOCKED','buy-offer-unfunded',{agentId:actor.id,offerId:existing.offerId,required:total,available:funding.available});
        continue;
      }
      return er5View('SAT','buy-offer-open',{type:'WAIT_BUY_OFFER',agentId:actor.id,offerId:existing.offerId,itemKind:signal.itemKind});
    }

    const reference=er5ReferencePrice(signal,ledger);
    if(!reference){
      blocked??=er5View('BLOCKED','price-evidence',{agentId:actor.id,itemKind:signal.itemKind});
      continue;
    }
    const quote=quoteBidPrice({referenceUnitPrice:reference.price,discountBps:ER5_MERCHANT_AUTONOMY_RULES.bidDiscountBps});
    if(quote.state!=='SAT')return er5View(quote.state==='UNKNOWN'?'BLOCKED':'UNKNOWN',quote.reason??'bid-pricing',{agentId:actor.id,itemKind:signal.itemKind});
    const quantityWanted=Math.min(ER5_MERCHANT_AUTONOMY_RULES.maxUnitsPerCycle,shortage);
    const required=quote.bidPrice*quantityWanted;
    if(!er5Positive(quantityWanted)||!Number.isSafeInteger(required)||required<1)
      return er5View('UNKNOWN','buy-offer-total',{agentId:actor.id,itemKind:signal.itemKind});
    const funding=er5Funding(world,actor);
    if(funding.status!=='SAT')return funding;
    if(required>funding.available){
      blocked??=er5View('BLOCKED','insufficient-funded-capacity',{agentId:actor.id,itemKind:signal.itemKind,required,available:funding.available});
      continue;
    }
    return er5View('SAT','create-funded-buy-offer',{
      type:'CREATE_BUY_OFFER',agentId:actor.id,marketId:market.marketId,itemKind:signal.itemKind,
      assetType:er5AssetType(signal),quantityWanted,unitPrice:quote.bidPrice,
      referencePrice:reference.price,referenceSource:reference.source,availableFunds:funding.available
    });
  }

  return blocked??er5View('IDLE','demand-covered',{agentId:actor.id});
}

export function merchantAutonomyDecision(world,agent){
  return merchantAutonomySnapshot(world,agent);
}

/** Canonical RC4 purchase gate for ER5. It recomputes current world-backed Merchant need. */
export function merchantAutonomousPurchaseAuthorization(world,agent,listing,{quantity}={}){
  if(!listing||world?.merchantListings?.listings?.find(l=>l.id===listing.id)!==listing)
    return er5View('UNKNOWN','listing');
  if(agent?.profession!=='merchant')return er5View('VIOL','merchant-required',{listingId:listing.id});
  const plan=merchantAutonomySnapshot(world,agent);
  if(plan.status==='UNKNOWN')return er5View('UNKNOWN',plan.reason,{listingId:listing.id});
  if(plan.status!=='SAT'||plan.type!=='BUY_LISTING')
    return er5View('VIOL','listing-not-selected',{listingId:listing.id,merchantState:plan.status,merchantReason:plan.reason});
  if(plan.listingId!==listing.id||plan.listingRevision!==listing.revision)
    return er5View('VIOL','listing-not-selected',{listingId:listing.id});
  if(!er5Positive(quantity)||quantity!==plan.quantity)
    return er5View('VIOL','merchant-purchase-quantity',{listingId:listing.id,quantity,allowedQuantity:plan.quantity});
  return er5View('SAT','authorized',{listingId:listing.id,quantity,itemKind:plan.itemKind});
}
