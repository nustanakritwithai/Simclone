/**
 * RC4 Customer Market AI — pure, deterministic intent selection.
 *
 * This module reads only caller-supplied, already-authoritative snapshots and
 * returns intent/proposal objects. It never mutates wallet, Rust possessions,
 * transaction state, market/listing state, housing or profession state.
 */
export const RC4_CUSTOMER_MARKET_AI_VERSION='RC4-customer-market-ai-0.1';
export const RC4_CUSTOMER_MARKET_AI_RULES=Object.freeze({
  defaultTradeRange:1,
  maxTradeRange:8,
  maxPurchaseQuantity:12,
});

const lower=v=>typeof v==='string'?v.toLowerCase():'';
const safeInt=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
const finite=(n,min=0)=>typeof n==='number'&&Number.isFinite(n)&&n>=min;
const validId=v=>(typeof v==='string'&&v.length>0)||(Number.isSafeInteger(v)&&v>=0);
const sameId=(a,b)=>validId(a)&&validId(b)&&String(a)===String(b);
const manhattan=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const clone=v=>JSON.parse(JSON.stringify(v));
const frozen=v=>Object.freeze(v);
const encode=v=>encodeURIComponent(String(v));
const tickOf=s=>safeInt(s?.tick,0)?s.tick:0;

function positionOf(a){
  return a&&Number.isInteger(a.x)&&Number.isInteger(a.y)?{x:a.x,y:a.y}:null;
}
function marketPoint(m){
  const p=m?.storefrontSocket??m?.position??m?.origin;
  return p&&Number.isInteger(p.x)&&Number.isInteger(p.y)?{x:p.x,y:p.y}:null;
}
function walletBalance(s){
  const n=s?.wallet?.balance;
  return safeInt(n,0)?n:null;
}
function tradeRange(s,m=null){
  const n=m?.tradeRange??s?.tradeRange??RC4_CUSTOMER_MARKET_AI_RULES.defaultTradeRange;
  return safeInt(n,0)&&n<=RC4_CUSTOMER_MARKET_AI_RULES.maxTradeRange?n:RC4_CUSTOMER_MARKET_AI_RULES.defaultTradeRange;
}
function intentRows(s){return Array.isArray(s?.intentJournal)?s.intentJournal:[];}
function resultRows(s){return Array.isArray(s?.transactionResults)?s.transactionResults:[];}
function hasIntent(s,intentId){return intentRows(s).some(r=>r&&r.intentId===intentId);}
function statusOpen(v){return lower(v)==='open';}
function statusActive(v){return ['active','open'].includes(lower(v));}
function verifiedCommitted(r){return r&&lower(r.verificationStatus??r.status)==='verified'&&lower(r.outcome??r.result)==='committed';}
function verifiedRejected(r){return r&&lower(r.verificationStatus??r.status)==='verified'&&['rejected','failed','invalid'].includes(lower(r.outcome??r.result));}

function normalizedNeed(row){
  if(!row||typeof row.itemKind!=='string'||row.itemKind.length===0||!safeInt(row.quantity,1)||row.quantity>RC4_CUSTOMER_MARKET_AI_RULES.maxPurchaseQuantity)return null;
  const needId=validId(row.needId)?row.needId:`need:${row.itemKind}`;
  return {
    needId,
    itemKind:row.itemKind,
    quantity:row.quantity,
    priority:finite(row.priority,0)?row.priority:0,
    purpose:typeof row.purpose==='string'&&row.purpose?row.purpose:'personal',
    fulfillment:['use','equip','carry'].includes(lower(row.fulfillment))?lower(row.fulfillment):'carry',
  };
}
export function customerNeeds(s){
  return (Array.isArray(s?.needs)?s.needs:[]).map(normalizedNeed).filter(Boolean).sort((a,b)=>
    b.priority-a.priority||String(a.needId).localeCompare(String(b.needId))||a.itemKind.localeCompare(b.itemKind)
  );
}

function marketKnowledge(s){
  const k=s?.knowledge??{};
  return {
    markets:Array.isArray(k.knownMarkets)?k.knownMarkets:[],
    listings:Array.isArray(k.knownListings)?k.knownListings:[],
  };
}
function knownMarketById(s,id){return marketKnowledge(s).markets.find(m=>m&&sameId(m.marketId,id))??null;}
function knownCandidateRows(s,need){
  const a=s?.agent,pos=positionOf(a),balance=walletBalance(s);if(!a||a.alive!==true||!pos||balance===null)return [];
  const {markets,listings}=marketKnowledge(s),marketMap=new Map();
  for(const m of markets){
    if(!m||!validId(m.marketId)||!statusOpen(m.status)||!marketPoint(m))continue;
    marketMap.set(String(m.marketId),m);
  }
  const rows=[];
  for(const l of listings){
    if(!l||!validId(l.listingId)||!validId(l.marketId)||!validId(l.sellerId)||!statusActive(l.status)||l.itemKind!==need.itemKind)continue;
    if(sameId(l.sellerId,a.id)||!safeInt(l.quantity,1)||l.quantity<need.quantity||!safeInt(l.unitPrice,0))continue;
    const m=marketMap.get(String(l.marketId));if(!m)continue;
    const total=l.unitPrice*need.quantity;if(!Number.isSafeInteger(total)||total>balance)continue;
    const point=marketPoint(m),distance=manhattan(pos,point);
    rows.push({market:m,listing:l,point,distance,totalPrice:total});
  }
  rows.sort((x,y)=>x.totalPrice-y.totalPrice||x.distance-y.distance||String(x.market.marketId).localeCompare(String(y.market.marketId))||String(x.listing.listingId).localeCompare(String(y.listing.listingId)));
  return rows;
}

export function selectKnownCustomerListing(s,needInput=null){
  const need=needInput?normalizedNeed(needInput):customerNeeds(s)[0];if(!need)return null;
  const row=knownCandidateRows(s,need)[0];
  return row?frozen({
    need:clone(need),
    marketId:row.market.marketId,
    listingId:row.listing.listingId,
    sellerId:row.listing.sellerId,
    itemKind:row.listing.itemKind,
    itemInstanceId:row.listing.itemInstanceId??null,
    quantity:need.quantity,
    observedUnitPrice:row.listing.unitPrice,
    observedTotalPrice:row.totalPrice,
    destination:{...row.point},
    distance:row.distance,
  }):null;
}

function currentLocalMarket(s,marketId){
  return (Array.isArray(s?.localMarkets)?s.localMarkets:[]).find(m=>m&&sameId(m.marketId,marketId))??null;
}
function currentLocalListing(localMarket,listingId){
  return (Array.isArray(localMarket?.listings)?localMarket.listings:[]).find(l=>l&&sameId(l.listingId,listingId))??null;
}
function verifiedPositionEvidence(s){
  const e=s?.positionEvidence,a=s?.agent;
  if(!e||e.verified!==true||!a||!sameId(e.agentId,a.id)||!safeInt(e.tick,0)||e.tick>tickOf(s)||!Number.isInteger(e.x)||!Number.isInteger(e.y))return null;
  if(e.x!==a.x||e.y!==a.y)return null;
  return e;
}
function verifiedArrivalEvidence(s,market){
  const e=s?.arrivalEvidence,a=s?.agent,p=marketPoint(market),pos=positionOf(a);if(!e||!p||!pos)return null;
  if(e.verified!==true||!sameId(e.agentId,a.id)||!sameId(e.marketId,market.marketId)||!safeInt(e.tick,0)||e.tick>tickOf(s))return null;
  if(!Number.isInteger(e.x)||!Number.isInteger(e.y)||e.x!==a.x||e.y!==a.y)return null;
  if(manhattan(pos,p)>tradeRange(s,market))return null;
  return e;
}
function pendingPurchaseForNeed(s,need){
  return intentRows(s).find(r=>r&&r.type==='SUBMIT_PURCHASE'&&sameId(r.buyerId,s?.agent?.id)&&sameId(r.needId,need.needId)&&r.itemKind===need.itemKind&&
    !['verified','rejected','failed','cancelled','committed'].includes(lower(r.status)))??null;
}
function latestResultForNeed(s,need){
  return resultRows(s).filter(r=>r&&sameId(r.buyerId,s?.agent?.id)&&sameId(r.needId,need.needId)&&r.itemKind===need.itemKind&&r.purpose===need.purpose)
    .sort((a,b)=>(Number(b.commitTick??b.tick??-1)-Number(a.commitTick??a.tick??-1))||String(b.transactionId??'').localeCompare(String(a.transactionId??'')))[0]??null;
}
function postPurchaseIntent(s,need,result){
  if(!verifiedCommitted(result)||!validId(result.transactionId)||!validId(result.itemInstanceId))return null;
  const action=need.fulfillment==='equip'?'EQUIP_PURCHASED_ITEM':need.fulfillment==='use'?'USE_PURCHASED_ITEM':'CARRY_PURCHASED_ITEM';
  const intentId=`rc4:customer:post:${encode(result.transactionId)}:${action.toLowerCase()}`;
  if(hasIntent(s,intentId))return frozen({type:'WAIT',reason:'post-purchase-intent-recorded',intentId,transactionId:result.transactionId});
  return frozen({
    type:action,intentId,agentId:s.agent.id,buyerId:s.agent.id,needId:need.needId,purpose:need.purpose,
    transactionId:result.transactionId,itemKind:need.itemKind,itemInstanceId:result.itemInstanceId,quantity:result.quantity??need.quantity,
    verifiedTransactionResult:clone(result),authoritative:false,
  });
}

export function customerMarketDecision(s){
  const a=s?.agent;if(!a||a.alive!==true||!validId(a.id)||!positionOf(a))return null;
  const need=customerNeeds(s)[0];if(!need)return null;

  const prior=latestResultForNeed(s,need);
  if(verifiedCommitted(prior))return postPurchaseIntent(s,need,prior);
  if(verifiedRejected(prior))return frozen({type:'WAIT',reason:'verified-transaction-rejected',agentId:a.id,needId:need.needId,transactionId:prior.transactionId??null});
  const pending=pendingPurchaseForNeed(s,need);
  if(pending)return frozen({type:'WAIT_TRANSACTION_RESULT',intentId:`rc4:customer:wait:${encode(pending.intentId)}`,agentId:a.id,needId:need.needId,purchaseIntentId:pending.intentId,authoritative:false});

  const selected=selectKnownCustomerListing(s,need);if(!selected)return null;
  const knownMarket=knownMarketById(s,selected.marketId);if(!knownMarket)return null;
  const pos=positionOf(a),range=tradeRange(s,knownMarket);
  if(manhattan(pos,selected.destination)>range){
    const intentId=`rc4:customer:travel:${encode(a.id)}:${encode(need.needId)}:${encode(selected.marketId)}:${encode(selected.listingId)}`;
    const existing=s?.travelGoal;
    if(existing&&sameId(existing.agentId,a.id)&&sameId(existing.marketId,selected.marketId)&&['active','walking','accepted'].includes(lower(existing.status)))
      return frozen({type:'WAIT_TRAVEL',intentId,agentId:a.id,marketId:selected.marketId,listingId:selected.listingId,authoritative:false});
    return frozen({type:'CREATE_TRAVEL_GOAL',intentId,agentId:a.id,needId:need.needId,purpose:need.purpose,marketId:selected.marketId,listingId:selected.listingId,target:{...selected.destination},pathRequired:true,teleport:false,authoritative:false});
  }

  const localMarket=currentLocalMarket(s,selected.marketId);if(!localMarket||!statusOpen(localMarket.status))return null;
  const localListing=currentLocalListing(localMarket,selected.listingId);
  if(!localListing||!statusActive(localListing.status)||localListing.itemKind!==need.itemKind||!sameId(localListing.sellerId,selected.sellerId)||sameId(localListing.sellerId,a.id))return null;
  if(!safeInt(localListing.quantity,1)||localListing.quantity<need.quantity||!safeInt(localListing.unitPrice,0))return null;
  const totalPrice=localListing.unitPrice*need.quantity,balance=walletBalance(s);if(!Number.isSafeInteger(totalPrice)||balance===null||balance<totalPrice)return null;
  const positionEvidence=verifiedPositionEvidence(s),arrivalEvidence=verifiedArrivalEvidence(s,localMarket);if(!positionEvidence||!arrivalEvidence)return null;

  const snapshotToken=localListing.snapshotVersion??localListing.updatedTick??localListing.createdTick??'na';
  const intentId=`rc4:customer:purchase:${encode(a.id)}:${encode(need.needId)}:${encode(localListing.listingId)}:${need.quantity}:${encode(snapshotToken)}`;
  if(hasIntent(s,intentId))return frozen({type:'WAIT_TRANSACTION_RESULT',intentId:`rc4:customer:wait:${encode(intentId)}`,agentId:a.id,needId:need.needId,purchaseIntentId:intentId,authoritative:false});
  return frozen({
    type:'SUBMIT_PURCHASE',intentId,agentId:a.id,buyerId:a.id,sellerId:localListing.sellerId,needId:need.needId,purpose:need.purpose,
    marketId:localMarket.marketId,listingId:localListing.listingId,itemKind:localListing.itemKind,itemInstanceId:localListing.itemInstanceId??null,
    quantity:need.quantity,unitPrice:localListing.unitPrice,totalPrice,
    listingSnapshot:{listingId:localListing.listingId,marketId:localListing.marketId,sellerId:localListing.sellerId,itemKind:localListing.itemKind,itemInstanceId:localListing.itemInstanceId??null,quantity:localListing.quantity,unitPrice:localListing.unitPrice,createdTick:localListing.createdTick??null,status:localListing.status,snapshotVersion:localListing.snapshotVersion??null},
    positionEvidence:clone(positionEvidence),arrivalEvidence:clone(arrivalEvidence),authoritative:false,
  });
}
