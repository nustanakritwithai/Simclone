/** Kingdom Sandbox market extraction K6.
 * Read-only shadow prices using the donor scarcity curve. No money, tax, trade or mutation.
 */
export const KINGDOM_MARKET_VERSION='K6-shadow-0.1';
export const SHADOW_BASE_PRICE=Object.freeze({food:10,wood:8,stone:15});
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

export function shadowPrice(good,scarcity,{danger=0,tax=0,crowding=1,siege=false}={}){
  const base=SHADOW_BASE_PRICE[good];
  if(!base)return null;
  const scarcityBound=clamp(Number(scarcity)||0.25,0.25,6);
  const dangerMod=1+clamp(Number(danger)||0,0,1)*0.35;
  const taxMod=1+clamp(Number(tax)||0,0,1)*0.8;
  const crowdFoodMod=good==='food'?Math.max(1,Number(crowding)||1):1;
  const siegeMod=siege?1.6:1;
  const raw=base*Math.pow(scarcityBound,0.75)*dangerMod*taxMod*crowdFoodMod*siegeMod;
  return +clamp(raw,base*0.3,base*6).toFixed(2);
}

export function kingdomMarketSnapshot({economy=null}={}){
  const scarcity=economy?.scarcity??{};
  const prices={
    food:shadowPrice('food',scarcity.food),
    wood:shadowPrice('wood',scarcity.wood),
    stone:shadowPrice('stone',scarcity.stone),
  };
  const index=Object.fromEntries(Object.entries(prices).map(([good,price])=>[good,+(price/SHADOW_BASE_PRICE[good]).toFixed(3)]));
  const ranked=Object.entries(index).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  return {
    version:KINGDOM_MARKET_VERSION,
    mode:'shadow',
    base:{...SHADOW_BASE_PRICE},
    prices,index,
    hottestGood:ranked[0]?.[0]??null,
    hottestIndex:ranked[0]?.[1]??1,
  };
}
