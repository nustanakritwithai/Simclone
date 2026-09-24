/** Kingdom Sandbox market-price extraction K5.
 * Read-only price projection from scarcity. No currency, treasury, tax, trade or stock mutation.
 */
export const KINGDOM_MARKET_VERSION='K5-shadow-0.1';
export const BASE_PRICE=Object.freeze({food:10,wood:8,stone:15});
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

export function kingdomShadowPrice(good,scarcity,{housingRatio=1}={}){
  const base=BASE_PRICE[good];
  if(base===undefined)return null;
  const ratio=clamp(Number(scarcity)||0.25,0.25,6);
  let price=base*Math.pow(ratio,0.75);
  // Donor adds a crowding modifier to food only.
  if(good==='food'){
    const crowdFoodMod=1+Math.max(0,(Number(housingRatio)||0)-0.9)*0.45;
    price*=crowdFoodMod;
  }
  return +clamp(price,base*0.3,base*6).toFixed(2);
}

export function kingdomMarketSnapshot({economy=null,production=null}={}){
  const scarcity=economy?.scarcity??{};
  const housingRatio=production?.housingRatio??1;
  const prices=Object.fromEntries(Object.keys(BASE_PRICE).map(g=>[g,kingdomShadowPrice(g,scarcity[g],{housingRatio})]));
  const normalized=Object.fromEntries(Object.entries(prices).map(([g,p])=>[g,+(p/BASE_PRICE[g]).toFixed(3)]));
  const ranked=Object.entries(normalized).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  return {
    version:KINGDOM_MARKET_VERSION,
    mode:'shadow',
    prices,normalized,
    hottest:ranked[0]?{good:ranked[0][0],ratio:ranked[0][1],price:prices[ranked[0][0]]}:null,
    coldest:ranked.at(-1)?{good:ranked.at(-1)[0],ratio:ranked.at(-1)[1],price:prices[ranked.at(-1)[0]]}:null,
  };
}
