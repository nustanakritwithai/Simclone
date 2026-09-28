/** RC4 canonical merchant Listing. References Rust item authority; owns no item. */
import {isCanonicalMoney} from './merchant-pricing.mjs';

export const MERCHANT_LISTING_VERSION='RC4-listing/1';
export const LISTING_STATUS=Object.freeze({OPEN:'OPEN',CLOSED:'CLOSED',CANCELED:'CANCELED',FILLED:'FILLED'});
const validId=v=>(Number.isSafeInteger(v)&&v>0)||(typeof v==='string'&&v.length>0&&v.length<=160);
const validKind=v=>typeof v==='string'&&v.length>0&&v.length<=128;

export function validateListing(row){
  const e=[];
  if(!row||typeof row!=='object'||Array.isArray(row))return ['listing'];
  if(!validId(row.listingId))e.push('listingId');
  if(!validId(row.marketId))e.push('marketId');
  if(!validId(row.sellerId))e.push('sellerId');
  if(!validKind(row.itemKind))e.push('itemKind');
  if(!validId(row.itemInstanceId))e.push('itemInstanceId');
  if(!Number.isSafeInteger(row.quantity)||row.quantity<1)e.push('quantity');
  if(!isCanonicalMoney(row.unitPrice))e.push('unitPrice');
  if(!Number.isSafeInteger(row.createdTick)||row.createdTick<0)e.push('createdTick');
  if(!Object.values(LISTING_STATUS).includes(row.status))e.push('status');
  return e;
}

export function createListing({listingId,marketId,sellerId,itemKind,itemInstanceId,quantity,unitPrice,createdTick,status=LISTING_STATUS.OPEN}={}){
  const listing={listingId,marketId,sellerId,itemKind,itemInstanceId,quantity,unitPrice,createdTick,status};
  const errors=validateListing(listing);
  return errors.length?{state:'VIOL',errors,listing:null}:{state:'SAT',listing:Object.freeze({...listing})};
}

export function transitionListing(listing,status){
  const errors=validateListing(listing);if(errors.length)return {state:'VIOL',reason:'listing',errors};
  if(![LISTING_STATUS.CLOSED,LISTING_STATUS.CANCELED,LISTING_STATUS.FILLED].includes(status))return {state:'VIOL',reason:'status'};
  if(listing.status===status)return {state:'SAT',duplicate:true,listing:Object.freeze({...listing})};
  if(listing.status!==LISTING_STATUS.OPEN)return {state:'VIOL',reason:'transition'};
  return {state:'SAT',duplicate:false,listing:Object.freeze({...listing,status})};
}
