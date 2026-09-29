/** RC5 Producer Supply Policy — stacked design candidate.
 * Read-only intent generation over canonical Crafter, market-knowledge, BuyOffer,
 * Rust possession and craft validators. It owns no price, listing, trade, item,
 * profession, mastery or accounting state.
 */
import {CRAFT_RECIPE_CATALOG} from '../../../src/crafting-catalog.mjs?v=0.5.0';
import {knowsCraftRecipe} from '../../../src/craft-recipe-knowledge.mjs?v=0.5.0';
import {craftPreview,tradableRustItemIds} from '../../../src/rust-possessions.mjs?v=0.5.0';
import {knownRc4BuyOffers,knowsRc4Market,validateRc4MarketKnowledge} from '../../../src/rc4-market-observation.mjs?v=0.5.0';
import {projectHomeMarketForTrade} from '../../../src/home-market.mjs?v=0.5.0';
import {canPerformProductiveWork} from '../../../src/lifecycle.mjs?v=0.5.0';
import {CRAFT_TRAINING_RULES} from '../../../src/craft-training.mjs?v=0.5.0';
import {resourceStock,isIndependent} from '../../../src/individual-resources.mjs?v=0.5.0';
import {autonomousBirthFoodTarget} from '../../../src/reproduction.mjs?v=0.5.0';

export const PRODUCER_SUPPLY_VERSION='RC5-producer-supply/1';
const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;};
const view=(status,reason,extra={})=>freeze({version:PRODUCER_SUPPLY_VERSION,status,reason,...extra});
const livingCrafter=(s,a)=>a?.alive===true&&a.profession==='crafter'&&canPerformProductiveWork(s,a);

function currentObservedOffers(s,a){
  const observed=new Map(knownRc4BuyOffers(a).map(x=>[x.offerId,x.observedTick]));
  const rows=[];
  for(const offer of s?.merchantBuyOffers?.buyOffers??[]){
    if(offer?.status!=='OPEN'||offer.buyerId===a.id||!observed.has(offer.offerId)||!knowsRc4Market(a,offer.marketId))continue;
    const market=projectHomeMarketForTrade(s,s.homeMarkets,{marketId:offer.marketId});
    if(!market.ok||market.market.open!==true)continue;
    rows.push({...offer,observedTick:observed.get(offer.offerId)});
  }
  rows.sort((x,y)=>y.unitPrice-x.unitPrice||x.observedTick-y.observedTick||x.offerId.localeCompare(y.offerId));
  return rows;
}
function pendingSupplyListing(s,a){
  return (s?.merchantListings?.listings??[]).filter(l=>l?.sellerId===a.id&&l.status==='OPEN'&&typeof l.buyOfferId==='string')
    .sort((x,y)=>x.id.localeCompare(y.id))[0]??null;
}
function safeReserve(s,a,preview){
  const stock=resourceStock(s,a),foodFloor=isIndependent(s)?CRAFT_TRAINING_RULES.food:Math.max(CRAFT_TRAINING_RULES.food,autonomousBirthFoodTarget(s));
  if((stock?.food??0)<foodFloor)return false;
  if((stock?.wood??0)-(preview.materials.wood??0)<CRAFT_TRAINING_RULES.wood)return false;
  if((stock?.stone??0)-(preview.materials.stone??0)<CRAFT_TRAINING_RULES.stone)return false;
  return true;
}
function supplyRecipe(s,a,itemKind){
  const recipes=Object.values(CRAFT_RECIPE_CATALOG).filter(r=>r.output===itemKind&&knowsCraftRecipe(s,a,r.id))
    .sort((x,y)=>x.tier-y.tier||x.work-y.work||x.id.localeCompare(y.id));
  let firstReason='no-craft-route';
  for(const recipe of recipes){
    const preview=craftPreview(s,{agentId:a.id,recipeId:recipe.id});
    if(!preview.ok){if(firstReason==='no-craft-route')firstReason=preview.reason;continue;}
    if(!safeReserve(s,a,preview)){firstReason='reserve';continue;}
    return {recipe,preview};
  }
  return {recipe:null,preview:null,reason:firstReason};
}

export function producerSupplySnapshot(s,a){
  if(s?.productionPlan?.enabled!==true)return view('OFF','policy-off');
  if(!livingCrafter(s,a))return view('INELIGIBLE','crafter-required');
  if(validateRc4MarketKnowledge(a).length)return view('BLOCKED','market-knowledge');
  if(a.craftTraining?.enabled===true)return view('BLOCKED','manual-training');
  if(a.adventureCombat?.status==='ACTIVE'||a.adventureEncounter)return view('BLOCKED','adventure');
  if(a.task)return view('BLOCKED','task');
  if((s.rustPossessions?.orders??[]).some(o=>o.agentId===a.id)||(s.rustMaterials?.orders??[]).some(o=>o.agentId===a.id))return view('BLOCKED','craft-busy');
  if(a.hp<CRAFT_TRAINING_RULES.hp||a.satiety<CRAFT_TRAINING_RULES.satiety||a.energy<CRAFT_TRAINING_RULES.energy)return view('BLOCKED','survival');

  const pending=pendingSupplyListing(s,a);
  if(pending)return view('WAITING','merchant-purchase-pending',{listingId:pending.id,buyOfferId:pending.buyOfferId,itemKind:pending.itemKind});

  const offers=currentObservedOffers(s,a);
  if(!offers.length)return view('IDLE','no-observed-demand');
  const offer=offers[0],demand={offerId:offer.offerId,marketId:offer.marketId,itemKind:offer.itemKind,unitPrice:offer.unitPrice};

  const items=tradableRustItemIds(s,{agentId:a.id,itemKind:offer.itemKind});
  if(items.length){
    return view('READY_SELL','physical-stock',{agentId:a.id,demand,itemId:items[0],
      intent:freeze({type:'RC4_ACCEPT_BUY_OFFER',data:{producerId:a.id,offerId:offer.offerId,itemId:items[0]}})});
  }

  const route=supplyRecipe(s,a,offer.itemKind);
  if(!route.recipe)return view('BLOCKED',route.reason??'no-craft-route',{agentId:a.id,demand});
  return view('READY_CRAFT','observed-demand',{agentId:a.id,demand,recipeId:route.recipe.id,tier:route.recipe.tier,
    intent:freeze({type:'CRAFT_ITEM',data:{agentId:a.id,recipeId:route.recipe.id}})});
}
export function producerSupplyIntent(s,a){
  const snap=producerSupplySnapshot(s,a);
  return snap.status==='READY_CRAFT'||snap.status==='READY_SELL'?snap.intent:null;
}
