/** RC4 canonical merchant BuyOffer. Reference/intention only; owns no money or item. */
import {isCanonicalMoney} from './merchant-pricing.mjs';

export const MERCHANT_BUY_OFFER_VERSION='RC4-buy-offer/1';
export const BUY_OFFER_STATUS=Object.freeze({OPEN:'OPEN',CLOSED:'CLOSED',CANCELED:'CANCELED',FILLED:'FILLED'});
const validId=v=>(Number.isSafeInteger(v)&&v>0)||(typeof v==='string'&&v.length>0&&v.length<=160);
const validKind=v=>typeof v==='string'&&v.length>0&&v.length<=128;

export function validateBuyOffer(row){
  const e=[];
  if(!row||typeof row!=='object'||Array.isArray(row))return ['buyOffer'];
  if(!validId(row.offerId))e.push('offerId');
  if(!validId(row.marketId))e.push('marketId');
  if(!validId(row.buyerId))e.push('buyerId');
  if(!validKind(row.itemKind))e.push('itemKind');
  if(!Number.isSafeInteger(row.quantityWanted)||row.quantityWanted<1)e.push('quantityWanted');
  if(!isCanonicalMoney(row.unitPrice))e.push('unitPrice');
  if(!Number.isSafeInteger(row.createdTick)||row.createdTick<0)e.push('createdTick');
  if(!Object.values(BUY_OFFER_STATUS).includes(row.status))e.push('status');
  return e;
}

export function createBuyOffer({offerId,marketId,buyerId,itemKind,quantityWanted,unitPrice,createdTick,status=BUY_OFFER_STATUS.OPEN}={}){
  const offer={offerId,marketId,buyerId,itemKind,quantityWanted,unitPrice,createdTick,status};
  const errors=validateBuyOffer(offer);
  return errors.length?{state:'VIOL',errors,offer:null}:{state:'SAT',offer:Object.freeze({...offer})};
}

export function transitionBuyOffer(offer,status){
  const errors=validateBuyOffer(offer);if(errors.length)return {state:'VIOL',reason:'buy-offer',errors};
  if(![BUY_OFFER_STATUS.CLOSED,BUY_OFFER_STATUS.CANCELED,BUY_OFFER_STATUS.FILLED].includes(status))return {state:'VIOL',reason:'status'};
  if(offer.status===status)return {state:'SAT',duplicate:true,offer:Object.freeze({...offer})};
  if(offer.status!==BUY_OFFER_STATUS.OPEN)return {state:'VIOL',reason:'transition'};
  return {state:'SAT',duplicate:false,offer:Object.freeze({...offer,status})};
}
