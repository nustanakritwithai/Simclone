/**
 * RC4 Merchant AI — pure decision policy over canonical authority snapshots.
 *
 * The policy can request travel, restock, listing, and market-open actions, but
 * cannot mutate Rust possession, wallet, transaction, ledger, housing, market
 * or profession state. Pricing is deliberately delegated to the pricing/ledger
 * authority through a bounded pricing-evidence request.
 */
import {customerMarketDecision} from './rc4-customer-market-policy.mjs?v=0.5.0';

export const RC4_MERCHANT_AI_VERSION='RC4-merchant-ai-0.1';
export const RC4_MERCHANT_AI_RULES=Object.freeze({
  homeRange:1,
  maxRestockPerCycle:1,
  maxDemandRows:24,
});

const lower=v=>typeof v==='string'?v.toLowerCase():'';
const safeInt=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
const validId=v=>(typeof v==='string'&&v.length>0)||(Number.isSafeInteger(v)&&v>=0);
const sameId=(a,b)=>validId(a)&&validId(b)&&String(a)===String(b);
const encode=v=>encodeURIComponent(String(v));
const manhattan=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const frozen=v=>Object.freeze(v);
const clone=v=>JSON.parse(JSON.stringify(v));

function point(v){return v&&Number.isInteger(v.x)&&Number.isInteger(v.y)?{x:v.x,y:v.y}:null;}
function homePoint(s){return point(s?.market?.storefrontSocket)??point(s?.home?.origin)??point(s?.home?.storefrontSocket);}
function atHome(s){const p=point(s?.agent),h=homePoint(s);return Boolean(p&&h&&manhattan(p,h)<=RC4_MERCHANT_AI_RULES.homeRange);}
function journal(s){return Array.isArray(s?.intentJournal)?s.intentJournal:[];}
function results(s){return Array.isArray(s?.transactionResults)?s.transactionResults:[];}
function ownHistory(s){return Array.isArray(s?.knowledge?.ownTransactionHistory)?s.knowledge.ownTransactionHistory:[];}
function activeOwnListings(s){
  const rows=Array.isArray(s?.market?.listings)?s.market.listings:Array.isArray(s?.ownMarketListings)?s.ownMarketListings:[];
  return rows.filter(l=>l&&['active','open'].includes(lower(l.status))&&sameId(l.sellerId,s?.agent?.id));
}
function canonicalBag(s){
  const a=s?.agent,p=s?.rustPossessions??{};
  const rows=Array.isArray(p.items)?p.items:Array.isArray(p.bag)?p.bag:[];
  return rows.filter(i=>i&&validId(i.id)&&typeof i.kind==='string'&&i.kind.length>0&&(
    i.location?i.location.kind==='bag'&&sameId(i.location.agentId,a?.id):true
  )).sort((x,y)=>String(x.id).localeCompare(String(y.id)));
}
function soldAfter(s,itemId,tick){
  return ownHistory(s).some(r=>r&&sameId(r.itemInstanceId,itemId)&&lower(r.side)==='seller'&&lower(r.status)==='verified'&&Number(r.commitTick??r.tick??-1)>=tick);
}
function committedRestockResults(s){
  return results(s).filter(r=>r&&r.purpose==='restock'&&sameId(r.buyerId,s?.agent?.id)&&lower(r.verificationStatus??r.status)==='verified'&&lower(r.outcome??r.result)==='committed')
    .sort((a,b)=>(Number(b.commitTick??b.tick??-1)-Number(a.commitTick??a.tick??-1))||String(b.transactionId??'').localeCompare(String(a.transactionId??'')));
}
function demandRows(s){
  const rows=[];
  for(const d of Array.isArray(s?.knowledge?.localDemand)?s.knowledge.localDemand:[]){
    if(!d||typeof d.itemKind!=='string'||!safeInt(d.quantityWanted,1)||!safeInt(d.observedTick,0))continue;
    rows.push({evidenceId:validId(d.observationId)?d.observationId:`demand:${d.itemKind}:${d.observedTick}`,itemKind:d.itemKind,quantityWanted:d.quantityWanted,observedTick:d.observedTick,source:'local-demand'});
  }
  for(const r of ownHistory(s)){
    if(!r||lower(r.side)!=='seller'||lower(r.status)!=='verified'||typeof r.itemKind!=='string'||!safeInt(r.quantity,1))continue;
    const t=Number(r.commitTick??r.tick);if(!safeInt(t,0))continue;
    rows.push({evidenceId:`sale:${r.transactionId??`${r.itemKind}:${t}`}`,itemKind:r.itemKind,quantityWanted:r.quantity,observedTick:t,source:'own-sale'});
  }
  const best=new Map();
  for(const row of rows){
    const old=best.get(row.itemKind);
    if(!old||row.observedTick>old.observedTick||row.observedTick===old.observedTick&&String(row.evidenceId).localeCompare(String(old.evidenceId))<0)best.set(row.itemKind,row);
  }
  return [...best.values()].sort((a,b)=>b.quantityWanted-a.quantityWanted||b.observedTick-a.observedTick||a.itemKind.localeCompare(b.itemKind)).slice(0,RC4_MERCHANT_AI_RULES.maxDemandRows);
}
function listedItemIds(s){return new Set(activeOwnListings(s).map(l=>String(l.itemInstanceId)));}
function demandForKind(rows,kind){return rows.find(r=>r.itemKind===kind)??null;}
function restockCycleKey(a,d){return `rc4:merchant:restock-cycle:${encode(a.id)}:${encode(d.itemKind)}:${encode(d.evidenceId)}`;}
function cycleAlreadyRequested(s,key){return journal(s).some(r=>r&&r.restockCycleKey===key&&r.type==='SUBMIT_PURCHASE'&&!['rejected','failed','cancelled'].includes(lower(r.status)));}
function cycleCommitted(s,key){return results(s).some(r=>r&&r.restockCycleKey===key&&lower(r.verificationStatus??r.status)==='verified'&&lower(r.outcome??r.result)==='committed');}
function pricingEvidence(s,demand){
  const ownTransactions=ownHistory(s).filter(r=>r&&r.itemKind===demand.itemKind&&lower(r.status)==='verified').slice(-8).map(r=>r.transactionId).filter(validId);
  const observedListings=(Array.isArray(s?.knowledge?.knownListings)?s.knowledge.knownListings:[]).filter(l=>l&&l.itemKind===demand.itemKind).slice(0,8).map(l=>l.listingId).filter(validId);
  return {demandEvidenceId:demand.evidenceId,allowedSources:['own-transaction-history','observed-market','local-demand'],ownTransactionIds:ownTransactions,observedListingIds:observedListings};
}
function listingProposal(s,item,demand){
  const a=s.agent,m=s.market,intentId=`rc4:merchant:list:${encode(a.id)}:${encode(m.marketId)}:${encode(item.id)}:${encode(demand.evidenceId)}`;
  if(journal(s).some(r=>r&&r.intentId===intentId))return frozen({type:'WAIT',reason:'listing-proposal-recorded',intentId,agentId:a.id,itemInstanceId:item.id,authoritative:false});
  return frozen({
    type:'PROPOSE_LISTING',intentId,agentId:a.id,sellerId:a.id,marketId:m.marketId,homeId:s.home.homeId,itemKind:item.kind,itemInstanceId:item.id,quantity:1,
    pricingRequest:{mode:'merchant-ledger',evidence:pricingEvidence(s,demand)},authoritative:false,
  });
}
function returnHomeIntent(s,item,demand,reason='stock-away-from-home'){
  const a=s.agent,target=homePoint(s),intentId=`rc4:merchant:return-home:${encode(a.id)}:${encode(item.id)}:${encode(demand?.evidenceId??'stock')}`;
  return frozen({type:'CREATE_TRAVEL_GOAL',intentId,agentId:a.id,purpose:'return-stock-home',reason,itemKind:item.kind,itemInstanceId:item.id,homeId:s.home.homeId,target,pathRequired:true,teleport:false,authoritative:false});
}

export function merchantDecision(s){
  const a=s?.agent;if(!a||a.alive!==true||a.profession!=='merchant'||!validId(a.id)||!point(a))return null;
  const h=s?.home;if(!h||h.valid===false||!validId(h.homeId)||!sameId(h.ownerAgentId,a.id)||!homePoint(s))return null;
  const bag=canonicalBag(s),demands=demandRows(s),listed=listedItemIds(s);

  // A verified restock transaction is not permission to invent stock. Wait for
  // the canonical Rust item, then physically return it home before listing.
  for(const r of committedRestockResults(s)){
    const commitTick=Number(r.commitTick??r.tick??0),item=bag.find(i=>sameId(i.id,r.itemInstanceId));
    if(!item){
      if(soldAfter(s,r.itemInstanceId,commitTick))continue;
      return frozen({type:'WAIT_TRANSACTION_MATERIALIZATION',intentId:`rc4:merchant:wait-item:${encode(r.transactionId)}`,agentId:a.id,transactionId:r.transactionId,itemInstanceId:r.itemInstanceId,authoritative:false});
    }
    const d=demandForKind(demands,item.kind)??{evidenceId:r.restockCycleKey??`restock:${r.transactionId}`,itemKind:item.kind,quantityWanted:1,observedTick:commitTick,source:'verified-restock'};
    if(!atHome(s))return returnHomeIntent(s,item,d,'verified-restock');
    if(s.market&&sameId(s.market.ownerAgentId,a.id)&&!listed.has(String(item.id)))return listingProposal(s,item,d);
  }

  // Sell only canonical Rust items that the merchant actually possesses.
  for(const d of demands){
    const item=bag.find(i=>i.kind===d.itemKind&&!listed.has(String(i.id)));if(!item)continue;
    if(!atHome(s))return returnHomeIntent(s,item,d);
    if(!s.market)return frozen({type:'REQUEST_HOME_MARKET',intentId:`rc4:merchant:market:${encode(a.id)}:${encode(h.homeId)}`,agentId:a.id,homeId:h.homeId,ownerAgentId:a.id,authoritative:false});
    if(!sameId(s.market.ownerAgentId,a.id)||!sameId(s.market.homeId,h.homeId))return null;
    return listingProposal(s,item,d);
  }

  // Once a real listing exists, opening the shop is still only an intent.
  if(s.market&&sameId(s.market.ownerAgentId,a.id)&&sameId(s.market.homeId,h.homeId)&&lower(s.market.status)==='closed'&&activeOwnListings(s).length){
    const intentId=`rc4:merchant:open-market:${encode(a.id)}:${encode(s.market.marketId)}`;
    if(journal(s).some(r=>r&&r.intentId===intentId))return frozen({type:'WAIT',reason:'open-market-intent-recorded',intentId,agentId:a.id,authoritative:false});
    return frozen({type:'OPEN_MARKET',intentId,agentId:a.id,marketId:s.market.marketId,homeId:h.homeId,authoritative:false});
  }

  // Restock only from known/observed markets. Each demand-evidence row defines
  // one bounded cycle; replay cannot mint fresh intents with new IDs.
  for(const d of demands){
    const target=Math.min(RC4_MERCHANT_AI_RULES.maxRestockPerCycle,Math.max(1,d.quantityWanted));
    const current=bag.filter(i=>i.kind===d.itemKind).length;if(current>=target)continue;
    const key=restockCycleKey(a,d);
    if(cycleAlreadyRequested(s,key)||cycleCommitted(s,key))return frozen({type:'WAIT_RESTOCK',intentId:`rc4:merchant:wait-restock:${encode(key)}`,agentId:a.id,itemKind:d.itemKind,restockCycleKey:key,authoritative:false});
    const pseudo={
      ...s,
      needs:[{needId:`restock:${d.evidenceId}`,itemKind:d.itemKind,quantity:Math.min(target-current,RC4_MERCHANT_AI_RULES.maxRestockPerCycle),priority:1,purpose:'restock',fulfillment:'carry'}],
    };
    const decision=customerMarketDecision(pseudo);if(!decision)continue;
    if(decision.type==='CARRY_PURCHASED_ITEM'||decision.type==='EQUIP_PURCHASED_ITEM'||decision.type==='USE_PURCHASED_ITEM')continue;
    return frozen({...clone(decision),role:'merchant',purpose:'restock',demandEvidenceId:d.evidenceId,restockCycleKey:key,authoritative:false});
  }
  return null;
}
