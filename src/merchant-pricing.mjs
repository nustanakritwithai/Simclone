/** RC4 Merchant Pricing V1 — pure deterministic money/pricing helpers. */
export const MERCHANT_PRICING_VERSION='RC4-pricing/1';
export const MERCHANT_PRICING_RULES=Object.freeze({
  moneyScale:100,
  maxMarginBps:50000,
  maxScarcityAdjustmentBps:2500,
  maxObservationQuantity:1000000000,
});

const int=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

export function isCanonicalMoney(value,{allowZero=true}={}){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||(!allowZero&&value===0))return false;
  const scaled=value*MERCHANT_PRICING_RULES.moneyScale,rounded=Math.round(scaled);
  return Number.isSafeInteger(rounded)&&Math.abs(scaled-rounded)<1e-7;
}

export function moneyToMinor(value){
  if(!isCanonicalMoney(value))throw new Error('money');
  return Math.round(value*MERCHANT_PRICING_RULES.moneyScale);
}

export function minorToMoney(value){
  if(!Number.isSafeInteger(value)||value<0)throw new Error('minor-money');
  return value/MERCHANT_PRICING_RULES.moneyScale;
}

export function multiplyMoney(unitPrice,quantity){
  if(!isCanonicalMoney(unitPrice)||!int(quantity,1))throw new Error('money-multiply');
  const minor=moneyToMinor(unitPrice);
  if(minor>Math.floor(Number.MAX_SAFE_INTEGER/quantity))throw new Error('money-overflow');
  return minorToMoney(minor*quantity);
}

function signedBpsMinor(baseMinor,bps){
  if(!Number.isSafeInteger(baseMinor)||baseMinor<0||!Number.isSafeInteger(bps))throw new Error('bps');
  const numerator=BigInt(baseMinor)*BigInt(Math.abs(bps));
  const rounded=(numerator+5000n)/10000n;
  const signed=bps<0?-rounded:rounded;
  const n=Number(signed);
  if(!Number.isSafeInteger(n))throw new Error('money-overflow');
  return n;
}

/**
 * Derive a bounded scarcity adjustment from merchant-local observations only.
 * No world/global market state is read here.
 */
export function deriveScarcityAdjustmentBps({localStock=0,targetStock=0,recentDemand=0}={},
  {maxAdjustmentBps=MERCHANT_PRICING_RULES.maxScarcityAdjustmentBps}={}){
  const maxQ=MERCHANT_PRICING_RULES.maxObservationQuantity;
  if(!int(localStock,0,maxQ)||!int(targetStock,0,maxQ)||!int(recentDemand,0,maxQ)||
    !int(maxAdjustmentBps,0,MERCHANT_PRICING_RULES.maxScarcityAdjustmentBps))throw new Error('scarcity-observation');
  const desired=targetStock+recentDemand;
  if(!Number.isSafeInteger(desired)||desired===0)return 0;
  const pressure=clamp((desired-localStock)/desired,-1,1);
  return clamp(Math.round(pressure*maxAdjustmentBps),-maxAdjustmentBps,maxAdjustmentBps);
}

/** Acquisition Cost + Margin + bounded local scarcity adjustment = Ask Price. */
export function quoteAskPrice({acquisitionCost,marginBps=0,scarcity=null,
  maxScarcityAdjustmentBps=MERCHANT_PRICING_RULES.maxScarcityAdjustmentBps}={}){
  if(acquisitionCost===undefined||acquisitionCost===null)return {state:'UNKNOWN',reason:'acquisition-cost'};
  if(!isCanonicalMoney(acquisitionCost))return {state:'VIOL',reason:'acquisition-cost'};
  if(!int(marginBps,0,MERCHANT_PRICING_RULES.maxMarginBps))return {state:'VIOL',reason:'margin'};
  if(!int(maxScarcityAdjustmentBps,0,MERCHANT_PRICING_RULES.maxScarcityAdjustmentBps))return {state:'VIOL',reason:'scarcity-bound'};
  let scarcityAdjustmentBps=0;
  try{
    scarcityAdjustmentBps=scarcity===null?0:deriveScarcityAdjustmentBps(scarcity,{maxAdjustmentBps:maxScarcityAdjustmentBps});
  }catch{return {state:'VIOL',reason:'scarcity-observation'};}
  try{
    const costMinor=moneyToMinor(acquisitionCost);
    const marginMinor=signedBpsMinor(costMinor,marginBps);
    const scarcityMinor=signedBpsMinor(costMinor,scarcityAdjustmentBps);
    const askMinor=costMinor+marginMinor+scarcityMinor;
    if(!Number.isSafeInteger(askMinor)||askMinor<0)return {state:'VIOL',reason:'price-overflow'};
    return Object.freeze({
      state:'SAT',version:MERCHANT_PRICING_VERSION,
      acquisitionCost,
      marginBps,
      marginAmount:marginMinor/MERCHANT_PRICING_RULES.moneyScale,
      scarcityAdjustmentBps,
      scarcityAdjustment:scarcityMinor/MERCHANT_PRICING_RULES.moneyScale,
      askPrice:askMinor/MERCHANT_PRICING_RULES.moneyScale,
    });
  }catch{return {state:'VIOL',reason:'price-overflow'};}
}
