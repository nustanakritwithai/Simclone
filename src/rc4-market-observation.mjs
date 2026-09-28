/** Personal market knowledge. Observations are claims, never market or money authority. */
import {withinKnowledgeRange} from './knowledge.mjs?v=0.5.0';
import {ITEM_CATALOG} from './crafting-catalog.mjs?v=0.5.0';
import {projectHomeMarketForTrade} from './home-market.mjs?v=0.5.0';
export const RC4_MARKET_KNOWLEDGE_VERSION='RC4-market-knowledge/1';
const LIMITS=Object.freeze({markets:32,listings:128,offers:128});
const clone=v=>structuredClone(v);
const empty=()=>({version:RC4_MARKET_KNOWLEDGE_VERSION,knownMarkets:[],knownListings:[],knownBuyOffers:[]});
const ref=v=>typeof v==='string'&&v.length>0&&v.length<=160;
const tick=v=>Number.isSafeInteger(v)&&v>=0;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function upsert(rows,row,key,limit){const i=rows.findIndex(x=>x[key]===row[key]);if(i>=0){if(same(rows[i],row))return;rows.splice(i,1);}rows.push(row);if(rows.length>limit)rows.splice(0,rows.length-limit);}
export function validateRc4MarketKnowledge(agent){
  const k=agent?.rc4MarketKnowledge;if(k===undefined)return [];
  if(!k||k.version!==RC4_MARKET_KNOWLEDGE_VERSION)return ['market-knowledge'];
  for(const [field,id,max] of [['knownMarkets','marketId',LIMITS.markets],['knownListings','id',LIMITS.listings],['knownBuyOffers','offerId',LIMITS.offers]]){
    const rows=k[field];if(!Array.isArray(rows)||rows.length>max||new Set(rows.map(r=>r?.[id])).size!==rows.length)return ['market-knowledge'];
    if(rows.some(r=>!r||!ref(r[id])||!ref(r.marketId)||!tick(r.observedTick)||!['local-observation','own-market'].includes(r.source)))return ['market-knowledge'];
  }
  return [];
}
/** Called by the engine tick and successful canonical market commands, never by a UI getter. */
export function observeRc4Markets(world){
  if(!world.homeMarkets?.markets?.length)return;
  for(const agent of world.agents??[]){
    if(!agent.alive||validateRc4MarketKnowledge(agent).length)continue;
    let k=agent.rc4MarketKnowledge;
    for(const m of world.homeMarkets.markets){
      const projection=projectHomeMarketForTrade(world,world.homeMarkets,{marketId:m.marketId});
      const point=projection.ok?projection.market:m.storefrontSocket;
      const own=m.ownerAgentId===agent.id;
      if(!point||(!own&&!withinKnowledgeRange(agent,point)))continue;
      if(!k)k=agent.rc4MarketKnowledge=empty();
      const source=own?'own-market':'local-observation',observedTick=world.tick;
      const owner=world.agents.find(a=>a.id===m.ownerAgentId)??world.archive?.find(a=>a.id===m.ownerAgentId);
      upsert(k.knownMarkets,{marketId:m.marketId,homeId:m.homeId,ownerAgentId:m.ownerAgentId,ownerName:owner?.name??'UNKNOWN',status:m.status,
        position:{x:point.x,y:point.y},tradeRange:projection.ok?projection.market.tradeRange:null,observedTick,source},'marketId',LIMITS.markets);
      for(const l of world.merchantListings.listings)if(l.marketId===m.marketId&&m.listingIds.includes(l.id))upsert(k.knownListings,{...clone(l),observedTick,source},'id',LIMITS.listings);
      for(const o of world.merchantBuyOffers.buyOffers)if(o.marketId===m.marketId&&m.buyOfferIds.includes(o.offerId))upsert(k.knownBuyOffers,{...clone(o),observedTick,source},'offerId',LIMITS.offers);
    }
  }
}
export function knownRc4Markets(agent){return clone(agent?.rc4MarketKnowledge?.knownMarkets??[]);}
export function knownRc4Listings(agent){return clone(agent?.rc4MarketKnowledge?.knownListings??[]);}
export function knownRc4BuyOffers(agent){return clone(agent?.rc4MarketKnowledge?.knownBuyOffers??[]);}
export function knowsRc4Market(agent,marketId){return agent?.rc4MarketKnowledge?.knownMarkets?.some(m=>m.marketId===marketId)===true;}
/** Need is derived from the current productive goal and physical possessions, not UI flags. */
export function rc4PersonalItemNeeds(world,agent){
  if(!agent?.alive)return [];
  const held=new Set((world.rustPossessions?.items??[]).filter(i=>i.location?.kind==='bag'&&i.location.agentId===agent.id).map(i=>i.kind));
  return Object.values(ITEM_CATALOG).filter(i=>i.workAction===agent.preference&&!held.has(i.id))
    .map(i=>({needId:'work-tool:'+agent.id+':'+i.id,itemKind:i.id,quantity:1,purpose:'productive-work',fulfillment:'carry'}));
}
export function hasRc4PurchaseNeed(world,agent,listing){
  if(!agent?.alive||!listing)return false;
  if(listing.buyOfferId){const o=world.merchantBuyOffers.buyOffers.find(o=>o.offerId===listing.buyOfferId);return !!o&&o.status==='OPEN'&&o.buyerId===agent.id&&o.itemKind===listing.itemKind;}
  if(rc4PersonalItemNeeds(world,agent).some(n=>n.itemKind===listing.itemKind))return true;
  if(agent.profession==='merchant'){
    const ownOffers=world.merchantBuyOffers.buyOffers.filter(o=>o.buyerId===agent.id&&o.status==='OPEN');
    return ownOffers.some(o=>o.itemKind===listing.itemKind);
  }
  return false;
}
