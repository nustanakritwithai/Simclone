/** RC4 canonical merchant BuyOffer. Reference/intention only; owns no money or item. */
import {isCanonicalMoney} from './merchant-pricing.mjs?v=0.5.0';
import {TRADE_ASSET_TYPES,tradeAssetType,validBulkTradeResourceKey,tradeAssetFields} from './trade-assets.mjs?v=0.5.0';

export const MERCHANT_BUY_OFFER_VERSION='RC4-buy-offer/3';
export const BUY_OFFER_COLLECTION_VERSION='RC4-buy-offer-collection/1';
export const MERCHANT_BUY_OFFER_ROOT_KEY='merchantBuyOffers';
export const BUY_OFFER_STATUS=Object.freeze({OPEN:'OPEN',CLOSED:'CLOSED',CANCELED:'CANCELED',FILLED:'FILLED'});
const idPattern=/^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const validRefId=v=>typeof v==='string'&&v.length>0&&v.length<=80&&idPattern.test(v);
const positiveInt=v=>Number.isSafeInteger(v)&&v>0;
const validKind=validRefId;
const clone=v=>structuredClone(v);

function stableText(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(stableText).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableText(value[k])).join(',')+'}';
}
function hash32(text,seed=0x811c9dc5){
  let h=seed>>>0;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}
  return h.toString(16).padStart(8,'0');
}
export function buyOfferIdFor({marketId,buyerId,itemKind,quantityWanted,unitPrice,createdTick,assetType}={}){
  const type=tradeAssetType({assetType});
  const payload={marketId,buyerId,itemKind,quantityWanted,unitPrice,createdTick};
  if(type===TRADE_ASSET_TYPES.BULK_RESOURCE)payload.assetType=TRADE_ASSET_TYPES.BULK_RESOURCE;
  else if(type===null)payload.assetType=assetType;
  const text=stableText(payload);
  return 'BO:'+hash32(text)+hash32(text,0x9e3779b9);
}

export function validateBuyOffer(row){
  const e=[];
  if(!row||typeof row!=='object'||Array.isArray(row))return ['buyOffer'];
  if(!validRefId(row.offerId))e.push('offerId');
  if(!validRefId(row.marketId))e.push('marketId');
  if(!positiveInt(row.buyerId))e.push('buyerId');
  if(!validKind(row.itemKind))e.push('itemKind');
  const assetType=tradeAssetType(row);
  if(assetType===null)e.push('assetType');
  else if(assetType===TRADE_ASSET_TYPES.BULK_RESOURCE&&!validBulkTradeResourceKey(row.itemKind))e.push('bulk-asset');
  if(!Number.isSafeInteger(row.quantityWanted)||row.quantityWanted<1||row.quantityWanted>128)e.push('quantityWanted');
  if(!isCanonicalMoney(row.unitPrice,{allowZero:false}))e.push('unitPrice');
  if(!Number.isSafeInteger(row.createdTick)||row.createdTick<0)e.push('createdTick');
  if(!Object.values(BUY_OFFER_STATUS).includes(row.status))e.push('status');
  return e;
}

export function createBuyOffer({offerId,marketId,buyerId,itemKind,quantityWanted,unitPrice,createdTick,status=BUY_OFFER_STATUS.OPEN,assetType}={}){
  const type=tradeAssetType({assetType});
  const offer={offerId,marketId,buyerId,itemKind,...tradeAssetFields(type),quantityWanted,unitPrice,createdTick,status};
  const errors=type===null?['assetType']:validateBuyOffer(offer);
  return errors.length?{state:'VIOL',errors,offer:null}:{state:'SAT',offer:Object.freeze({...offer})};
}

export function transitionBuyOffer(offer,status){
  const errors=validateBuyOffer(offer);if(errors.length)return {state:'VIOL',reason:'buy-offer',errors};
  if(![BUY_OFFER_STATUS.CLOSED,BUY_OFFER_STATUS.CANCELED,BUY_OFFER_STATUS.FILLED].includes(status))return {state:'VIOL',reason:'status'};
  if(offer.status===status)return {state:'SAT',duplicate:true,offer:Object.freeze({...offer})};
  if(offer.status!==BUY_OFFER_STATUS.OPEN)return {state:'VIOL',reason:'transition'};
  return {state:'SAT',duplicate:false,offer:Object.freeze({...offer,status})};
}

export const createBuyOfferCollection=()=>({version:BUY_OFFER_COLLECTION_VERSION,buyOffers:[]});
const homeMarketReferenceRequest=offer=>Object.freeze({
  authority:'HOME_MARKET',
  writer:'attachHomeMarketBuyOfferReference',
  marketId:offer.marketId,
  ownerAgentId:offer.buyerId,
  referenceId:offer.offerId
});

export function validateBuyOfferCollection(collection){
  if(!collection||collection.version!==BUY_OFFER_COLLECTION_VERSION||!Array.isArray(collection.buyOffers))return ['buy-offer-collection'];
  const e=[],ids=new Set();
  for(const row of collection.buyOffers){
    if(validateBuyOffer(row).length)e.push('buy-offer');
    if(ids.has(row?.offerId))e.push('duplicate-id');else ids.add(row?.offerId);
    if(row&&row.offerId!==buyOfferIdFor(row))e.push('non-deterministic-id');
  }
  return [...new Set(e)];
}

export function createBuyOfferInCollection(collection,input={}){
  const errors=validateBuyOfferCollection(collection);if(errors.length)return {state:'VIOL',reason:'buy-offer-collection',errors,collection:clone(collection)};
  const deterministicId=buyOfferIdFor(input);
  if(input.offerId!==undefined&&input.offerId!==deterministicId)return {state:'VIOL',reason:'offer-id',collection:clone(collection)};
  const made=createBuyOffer({...input,offerId:deterministicId});if(made.state!=='SAT')return {...made,collection:clone(collection)};
  const existing=collection.buyOffers.find(x=>x.offerId===made.offer.offerId);
  if(existing){
    if(stableText(existing)===stableText(made.offer))return {state:'SAT',duplicate:true,offer:Object.freeze({...existing}),referenceRequest:homeMarketReferenceRequest(existing),collection:clone(collection)};
    return {state:'VIOL',reason:'offer-id-conflict',collection:clone(collection)};
  }
  const next=clone(collection);next.buyOffers.push({...made.offer});next.buyOffers.sort((a,b)=>a.offerId.localeCompare(b.offerId));
  return {state:'SAT',duplicate:false,offer:made.offer,referenceRequest:homeMarketReferenceRequest(made.offer),collection:next};
}

export function transitionBuyOfferInCollection(collection,offerId,status){
  const errors=validateBuyOfferCollection(collection);if(errors.length)return {state:'VIOL',reason:'buy-offer-collection',errors,collection:clone(collection)};
  const index=collection.buyOffers.findIndex(x=>x.offerId===offerId);if(index<0)return {state:'VIOL',reason:'buy-offer-missing',collection:clone(collection)};
  const changed=transitionBuyOffer(collection.buyOffers[index],status);if(changed.state!=='SAT')return {...changed,collection:clone(collection)};
  if(changed.duplicate)return {...changed,collection:clone(collection)};
  const next=clone(collection);next.buyOffers[index]={...changed.offer};
  return {state:'SAT',duplicate:false,offer:changed.offer,collection:next};
}

/**
 * Producer matching is proposal-only. It cannot reserve money/items or commit Trade.
 * V1 freezes exact physical item ids for the requested quantity; canonical Listing,
 * Reservation and Trade authorities remain separate.
 */
export function proposeProducerBuyOfferMatch(offer,{producerId,itemInstanceId,itemInstanceIds}={}){
  const errors=validateBuyOffer(offer);if(errors.length)return {state:'VIOL',reason:'buy-offer',errors};
  if(tradeAssetType(offer)!==TRADE_ASSET_TYPES.PHYSICAL_ITEM)return {state:'VIOL',reason:'asset-type'};
  if(offer.status!==BUY_OFFER_STATUS.OPEN)return {state:'VIOL',reason:'offer-not-open'};
  if(!positiveInt(producerId)||producerId===offer.buyerId)return {state:'VIOL',reason:'producer'};
  const raw=Array.isArray(itemInstanceIds)?itemInstanceIds:(itemInstanceId===undefined?[]:[itemInstanceId]);
  const ids=[...raw].sort((a,b)=>a-b);
  if(ids.length!==offer.quantityWanted||ids.some(id=>!positiveInt(id))||new Set(ids).size!==ids.length)return {state:'VIOL',reason:'itemIds'};
  const key=stableText({offerId:offer.offerId,producerId,itemIds:ids});
  const matchId='BOM:'+hash32(key)+hash32(key,0x9e3779b9);
  const listingId='PROC:'+hash32(matchId+'|LISTING')+hash32(matchId+'|LISTING',0x9e3779b9);
  return {state:'SAT',proposal:Object.freeze({
    authoritative:false,
    kind:'BUY_OFFER_PRODUCER_MATCH',
    matchId,buyOfferId:offer.offerId,marketId:offer.marketId,buyerId:offer.buyerId,producerId,
    itemKind:offer.itemKind,itemInstanceId:ids[0],itemIds:Object.freeze(ids),quantity:ids.length,unitPrice:offer.unitPrice,
    listingRequest:Object.freeze({
      authority:'MERCHANT_LISTING',
      id:listingId,marketId:offer.marketId,sellerId:producerId,itemKind:offer.itemKind,
      itemInstanceId:ids[0],quantity:ids.length,unitPrice:offer.unitPrice,status:'OPEN',buyOfferId:offer.offerId
    }),
    reservationRequest:Object.freeze({
      authority:'CANONICAL_RESERVATION',
      buyerId:offer.buyerId,
      exactItemIds:Object.freeze(ids),
      listingSnapshotRequired:true
    }),
    homeMarketListingReferenceRequest:Object.freeze({
      authority:'HOME_MARKET',
      writer:'attachHomeMarketListingReference',
      marketId:offer.marketId,
      ownerAgentId:offer.buyerId,
      referenceId:listingId
    }),
    tradeProposalOwner:'RC4_TRADE_KERNEL'
  })};
}

export function proposeProducerBulkBuyOfferMatch(offer,{producerId,quantity}={}){
  const errors=validateBuyOffer(offer);if(errors.length)return {state:'VIOL',reason:'buy-offer',errors};
  if(tradeAssetType(offer)!==TRADE_ASSET_TYPES.BULK_RESOURCE)return {state:'VIOL',reason:'asset-type'};
  if(offer.status!==BUY_OFFER_STATUS.OPEN)return {state:'VIOL',reason:'offer-not-open'};
  if(!positiveInt(producerId)||producerId===offer.buyerId)return {state:'VIOL',reason:'producer'};
  if(!positiveInt(quantity)||quantity!==offer.quantityWanted)return {state:'VIOL',reason:'quantity'};
  const key=stableText({offerId:offer.offerId,producerId,quantity,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE});
  const matchId='BOM:'+hash32(key)+hash32(key,0x9e3779b9);
  const listingId='PROC:'+hash32(matchId+'|LISTING')+hash32(matchId+'|LISTING',0x9e3779b9);
  return {state:'SAT',proposal:Object.freeze({
    authoritative:false,kind:'BUY_OFFER_PRODUCER_MATCH',assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,
    matchId,buyOfferId:offer.offerId,marketId:offer.marketId,buyerId:offer.buyerId,producerId,
    itemKind:offer.itemKind,quantity,unitPrice:offer.unitPrice,
    listingRequest:Object.freeze({
      authority:'MERCHANT_LISTING',id:listingId,marketId:offer.marketId,sellerId:producerId,
      itemKind:offer.itemKind,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,quantity,unitPrice:offer.unitPrice,
      status:'OPEN',buyOfferId:offer.offerId
    }),
    reservationRequest:Object.freeze({
      authority:'CANONICAL_RESERVATION',buyerId:offer.buyerId,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,
      itemKind:offer.itemKind,quantity,listingSnapshotRequired:true
    }),
    homeMarketListingReferenceRequest:Object.freeze({
      authority:'HOME_MARKET',writer:'attachHomeMarketListingReference',marketId:offer.marketId,
      ownerAgentId:offer.buyerId,referenceId:listingId
    }),
    tradeProposalOwner:'RC4_TRADE_KERNEL'
  })};
}

/** Post-commit BuyOffer lifecycle projection. Exact V1 procurement fills the one-unit offer. */
export function applyBuyOfferSettlementInCollection(collection,offerId,{quantity,unitPrice}={}){
  const errors=validateBuyOfferCollection(collection);if(errors.length)return {state:'VIOL',reason:'buy-offer-collection',errors,collection:clone(collection)};
  const index=collection.buyOffers.findIndex(x=>x.offerId===offerId);if(index<0)return {state:'VIOL',reason:'buy-offer-missing',collection:clone(collection)};
  const current=collection.buyOffers[index];
  if(current.status!==BUY_OFFER_STATUS.OPEN)return {state:'VIOL',reason:'offer-not-open',collection:clone(collection)};
  if(quantity!==current.quantityWanted||unitPrice!==current.unitPrice)return {state:'VIOL',reason:'offer-settlement-mismatch',collection:clone(collection)};
  const next=clone(collection);next.buyOffers[index]={...current,status:BUY_OFFER_STATUS.FILLED};
  return {state:'SAT',duplicate:false,offer:Object.freeze({...next.buyOffers[index]}),collection:next};
}

export function migrateBuyOfferCollection(raw){
  if(raw===undefined||raw===null)return {state:'SAT',migrated:true,duplicate:false,collection:createBuyOfferCollection()};
  const errors=validateBuyOfferCollection(raw);
  if(errors.length)return {state:'VIOL',reason:'buy-offer-collection',errors,collection:null};
  return {state:'SAT',migrated:false,duplicate:true,collection:clone(raw)};
}

export function serializeBuyOfferCollection(collection){
  const errors=validateBuyOfferCollection(collection);if(errors.length)throw new Error('buy-offer-collection-invalid:'+errors.join(','));
  return JSON.stringify(collection);
}
export function restoreBuyOfferCollection(serialized){
  const collection=JSON.parse(serialized),errors=validateBuyOfferCollection(collection);
  if(errors.length)throw new Error('buy-offer-collection-invalid:'+errors.join(','));
  return collection;
}
