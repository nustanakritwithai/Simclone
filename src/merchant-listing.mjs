/** RC4 canonical merchant Listing. References Rust item authority; owns no item. */
import {isCanonicalMoney} from './merchant-pricing.mjs?v=0.5.0';

export const MERCHANT_LISTING_VERSION='RC4-listing/3';
export const MERCHANT_LISTING_COLLECTION_VERSION='RC4-listing-collection/2';
export const MERCHANT_LISTING_ROOT_KEY='merchantListings';
export const LISTING_STATUS=Object.freeze({OPEN:'OPEN',CLOSED:'CLOSED',CANCELED:'CANCELED',FILLED:'FILLED'});
const idPattern=/^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const validRefId=v=>typeof v==='string'&&v.length>0&&v.length<=80&&idPattern.test(v);
const positiveInt=v=>Number.isSafeInteger(v)&&v>0;
const validKind=validRefId;
const clone=v=>structuredClone(v);
function stableHash(text){
  let h=0x811c9dc5;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}
  return h.toString(16).padStart(8,'0');
}
export function listingIdFor({marketId,sellerId,itemInstanceId,requestId=null}={}){
  if(!validRefId(marketId)||!positiveInt(sellerId)||!positiveInt(itemInstanceId))return null;
  if(requestId!==null&&!validRefId(requestId))return null;
  const text=marketId+'|'+sellerId+'|'+itemInstanceId+(requestId===null?'':'|REQUEST|'+requestId);
  return 'L:'+stableHash(text)+stableHash(text+'|RC4');
}

export function validateListing(row){
  const e=[];
  if(!row||typeof row!=='object'||Array.isArray(row))return ['listing'];
  if(!validRefId(row.id))e.push('id');
  if(!validRefId(row.marketId))e.push('marketId');
  if(!positiveInt(row.sellerId))e.push('sellerId');
  if(!validKind(row.itemKind))e.push('itemKind');
  if(!positiveInt(row.itemInstanceId))e.push('itemInstanceId');
  if(!Number.isSafeInteger(row.quantity)||row.quantity<0||row.quantity>128||(row.status===LISTING_STATUS.FILLED?row.quantity!==0:row.quantity<1))e.push('quantity');
  if(!isCanonicalMoney(row.unitPrice,{allowZero:false}))e.push('unitPrice');
  if(!positiveInt(row.revision))e.push('revision');
  if(row.buyOfferId!==undefined&&!validRefId(row.buyOfferId))e.push('buyOfferId');
  if(!Object.values(LISTING_STATUS).includes(row.status))e.push('status');
  return [...new Set(e)];
}

export function createListing({id,marketId,sellerId,itemKind,itemInstanceId,quantity,unitPrice,status=LISTING_STATUS.OPEN,buyOfferId}={}){
  const listing={id,marketId,sellerId,itemKind,itemInstanceId,quantity,unitPrice,revision:1,status,...(buyOfferId===undefined?{}:{buyOfferId})};
  const errors=validateListing(listing);
  return errors.length?{state:'VIOL',errors,listing:null}:{state:'SAT',duplicate:false,listing:Object.freeze(listing)};
}

export function updateListing(listing,patch={}){
  const errors=validateListing(listing);if(errors.length)return {state:'VIOL',reason:'listing',errors};
  if(listing.status!==LISTING_STATUS.OPEN)return {state:'VIOL',reason:'listing-not-open'};
  const allowed=new Set(['quantity','unitPrice']);
  if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!allowed.has(k)))return {state:'VIOL',reason:'listing-patch'};
  const next={...listing,...patch};
  if(next.quantity===listing.quantity&&next.unitPrice===listing.unitPrice)return {state:'SAT',duplicate:true,listing:Object.freeze({...listing})};
  next.revision=listing.revision+1;
  if(!Number.isSafeInteger(next.revision))return {state:'VIOL',reason:'revision-overflow'};
  const nextErrors=validateListing(next);
  return nextErrors.length?{state:'VIOL',reason:'listing-patch',errors:nextErrors}:{state:'SAT',duplicate:false,listing:Object.freeze(next)};
}

export function transitionListing(listing,status){
  const errors=validateListing(listing);if(errors.length)return {state:'VIOL',reason:'listing',errors};
  if(listing.status===status)return {state:'SAT',duplicate:true,listing:Object.freeze({...listing})};
  // FILLED is settlement-owned. Generic lifecycle callers may only close/cancel.
  if(listing.status!==LISTING_STATUS.OPEN||![LISTING_STATUS.CLOSED,LISTING_STATUS.CANCELED].includes(status))return {state:'VIOL',reason:'transition'};
  const revision=listing.revision+1;if(!Number.isSafeInteger(revision))return {state:'VIOL',reason:'revision-overflow'};
  return {state:'SAT',duplicate:false,listing:Object.freeze({...listing,status,revision})};
}

export function createListingCollection(){return {version:MERCHANT_LISTING_COLLECTION_VERSION,listings:[],creations:[]};}

export function validateListingCollection(collection){
  if(!collection||collection.version!==MERCHANT_LISTING_COLLECTION_VERSION||!Array.isArray(collection.listings)||!Array.isArray(collection.creations))return ['listing-collection'];
  const e=[],ids=new Set(),openItems=new Set();
  for(const row of collection.listings){
    if(validateListing(row).length)e.push('listing');
    if(ids.has(row?.id))e.push('duplicate-id');else ids.add(row?.id);
    if(row?.status===LISTING_STATUS.OPEN){
      if(openItems.has(row.itemInstanceId))e.push('duplicate-open-item');else openItems.add(row.itemInstanceId);
    }
  }
  const requests=new Map();
  for(const r of collection.creations){
    if(!r||!validRefId(r.id)||!r.input||r.input.id!==r.id||validateListing(r.input).length||r.input.revision!==1||requests.has(r.id))e.push('creation-receipt');
    else requests.set(r.id,r.input);
  }
  for(const row of collection.listings){const original=requests.get(row.id);if(!original||!sameIdentity(original,row))e.push('creation-receipt');}
  if(requests.size!==collection.listings.length)e.push('creation-receipt');
  return [...new Set(e)];
}

const sameIdentity=(a,b)=>a.marketId===b.marketId&&a.sellerId===b.sellerId&&a.itemKind===b.itemKind&&a.itemInstanceId===b.itemInstanceId&&a.buyOfferId===b.buyOfferId;
const resultCollection=collection=>clone(collection);

export function createListingInCollection(collection,input={}){
  const errors=validateListingCollection(collection);if(errors.length)return {state:'VIOL',reason:'listing-collection',errors,collection:resultCollection(collection)};
  const made=createListing(input);if(made.state!=='SAT')return {...made,collection:resultCollection(collection)};
  const existing=collection.listings.find(x=>x.id===made.listing.id);
  if(existing){
    const original=collection.creations.find(r=>r.id===existing.id)?.input;
    if(!original||JSON.stringify(original)!==JSON.stringify(made.listing))return {state:'VIOL',reason:'listing-id-conflict',collection:resultCollection(collection)};
    return {state:'SAT',duplicate:true,listing:Object.freeze({...existing}),collection:resultCollection(collection)};
  }
  if(made.listing.status===LISTING_STATUS.OPEN&&collection.listings.some(x=>x.status===LISTING_STATUS.OPEN&&x.itemInstanceId===made.listing.itemInstanceId))
    return {state:'VIOL',reason:'item-already-listed',collection:resultCollection(collection)};
  const next=resultCollection(collection);next.listings.push({...made.listing});next.creations.push({id:made.listing.id,input:{...made.listing}});
  return {state:'SAT',duplicate:false,listing:Object.freeze({...made.listing}),collection:next};
}

export function updateListingInCollection(collection,id,patch={}){
  const errors=validateListingCollection(collection);if(errors.length)return {state:'VIOL',reason:'listing-collection',errors,collection:resultCollection(collection)};
  const index=collection.listings.findIndex(x=>x.id===id);if(index<0)return {state:'VIOL',reason:'listing-missing',collection:resultCollection(collection)};
  const changed=updateListing(collection.listings[index],patch);if(changed.state!=='SAT')return {...changed,collection:resultCollection(collection)};
  if(changed.duplicate)return {...changed,collection:resultCollection(collection)};
  const next=resultCollection(collection);next.listings[index]={...changed.listing};
  return {state:'SAT',duplicate:false,listing:changed.listing,collection:next};
}

export function transitionListingInCollection(collection,id,status){
  const errors=validateListingCollection(collection);if(errors.length)return {state:'VIOL',reason:'listing-collection',errors,collection:resultCollection(collection)};
  const index=collection.listings.findIndex(x=>x.id===id);if(index<0)return {state:'VIOL',reason:'listing-missing',collection:resultCollection(collection)};
  const current=collection.listings[index];
  if(current.status===status)return {state:'SAT',duplicate:true,listing:Object.freeze({...current}),collection:resultCollection(collection)};
  let changed;
  if(current.status===LISTING_STATUS.CLOSED&&status===LISTING_STATUS.OPEN){
    if(collection.listings.some((x,i)=>i!==index&&x.status===LISTING_STATUS.OPEN&&x.itemInstanceId===current.itemInstanceId))
      return {state:'VIOL',reason:'item-already-listed',collection:resultCollection(collection)};
    const revision=current.revision+1;if(!Number.isSafeInteger(revision))return {state:'VIOL',reason:'revision-overflow',collection:resultCollection(collection)};
    changed={state:'SAT',duplicate:false,listing:Object.freeze({...current,status,revision})};
  }else changed=transitionListing(current,status);
  if(changed.state!=='SAT')return {...changed,collection:resultCollection(collection)};
  const next=resultCollection(collection);next.listings[index]={...changed.listing};
  return {state:'SAT',duplicate:false,listing:changed.listing,collection:next};
}

/**
 * Canonical post-settlement Listing mutation.
 * Quantity/revision/status change together on the staged collection only.
 */
export function applyListingSettlementInCollection(collection,id,{expectedRevision,quantity,unitPrice}={}){
  const errors=validateListingCollection(collection);if(errors.length)return {state:'VIOL',reason:'listing-collection',errors,collection:resultCollection(collection)};
  const index=collection.listings.findIndex(x=>x.id===id);if(index<0)return {state:'VIOL',reason:'listing-missing',collection:resultCollection(collection)};
  const current=collection.listings[index];
  if(current.status!==LISTING_STATUS.OPEN)return {state:'VIOL',reason:'listing-not-open',collection:resultCollection(collection)};
  if(current.revision!==expectedRevision)return {state:'VIOL',reason:'listing-stale',collection:resultCollection(collection)};
  if(current.unitPrice!==unitPrice)return {state:'VIOL',reason:'listing-price-mismatch',collection:resultCollection(collection)};
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>current.quantity)return {state:'VIOL',reason:'listing-fill-quantity',collection:resultCollection(collection)};
  const revision=current.revision+1;if(!Number.isSafeInteger(revision))return {state:'VIOL',reason:'revision-overflow',collection:resultCollection(collection)};
  const remaining=current.quantity-quantity;
  const listing={...current,quantity:remaining,revision,status:remaining===0?LISTING_STATUS.FILLED:LISTING_STATUS.OPEN};
  const post=validateListing(listing);if(post.length)return {state:'VIOL',reason:'listing-postcondition',errors:post,collection:resultCollection(collection)};
  const next=resultCollection(collection);next.listings[index]=listing;
  return {state:'SAT',duplicate:false,listing:Object.freeze({...listing}),collection:next};
}

export function freezeListingReservationSnapshot(listing){
  const errors=validateListing(listing);if(errors.length)return {state:'VIOL',reason:'listing',errors};
  return {state:'SAT',snapshot:Object.freeze({listingId:listing.id,listingRevision:listing.revision})};
}

export function assessListingReservationRevision(listing,reservation){
  const errors=validateListing(listing);if(errors.length)return {state:'VIOL',reason:'listing',errors};
  if(!reservation||typeof reservation!=='object'||reservation.listingId!==listing.id||!positiveInt(reservation.listingRevision))return {state:'VIOL',reason:'reservation'};
  return reservation.listingRevision===listing.revision?{state:'SAT'}:{state:'VIOL',reason:'listing-stale'};
}

export function migrateListingCollection(raw){
  if(raw===undefined||raw===null)return {state:'SAT',migrated:true,duplicate:false,collection:createListingCollection()};
  const errors=validateListingCollection(raw);
  if(errors.length)return {state:'VIOL',reason:'listing-collection',errors,collection:null};
  return {state:'SAT',migrated:false,duplicate:true,collection:resultCollection(raw)};
}

export function serializeListingCollection(collection){
  const errors=validateListingCollection(collection);if(errors.length)throw new Error('listing-collection-invalid:'+errors.join(','));
  return JSON.stringify(collection);
}

export function restoreListingCollection(serialized){
  const collection=JSON.parse(serialized),errors=validateListingCollection(collection);
  if(errors.length)throw new Error('listing-collection-invalid:'+errors.join(','));
  return collection;
}
