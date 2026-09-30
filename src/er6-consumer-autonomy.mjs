/**
 * ER6 consumer autonomy bridge.
 *
 * This is coordination/projection only. Demand comes from the released
 * rc4PersonalItemNeeds authority; market knowledge comes from the released
 * actor-scoped observation authority; movement/trade/equipment mutations stay
 * behind their canonical commands in engine/runtime.
 */
import {customerMarketDecision,selectKnownCustomerListing} from './rc4-customer-market-policy.mjs?v=0.5.0';
import {rc4PersonalItemNeeds,knownRc4Markets,knownRc4Listings} from './rc4-market-observation.mjs?v=0.5.0';
import {projectActorObservedDemand} from './economic-demand.mjs?v=0.5.0';
import {getBalance} from './currency-wallet.mjs?v=0.5.0';
import {projectHomeMarketForTrade} from './home-market.mjs?v=0.5.0';
import {verifyCanonicalMarketArrival} from './navigation-arrival-evidence.mjs?v=0.5.0';
import {isEr6ConsumerMarketTravelTask} from './rc4-market-runtime.mjs?v=0.5.0';
import {ITEM_CATALOG} from './crafting-catalog.mjs?v=0.5.0';
import {TRADE_ASSET_TYPES,tradeAssetType} from './trade-assets.mjs?v=0.5.0';

export const ER6_CONSUMER_AUTONOMY_VERSION='ER6-consumer-autonomy/1';

const frozen=v=>Object.freeze(v);
const clone=v=>structuredClone(v);
const unknown=(agentId,reason,detail=null)=>frozen({status:'UNKNOWN',agentId:agentId??null,reason,detail,authoritative:false});
const blocked=(agentId,reason,detail=null)=>frozen({status:'BLOCKED',agentId:agentId??null,reason,detail,authoritative:false});
const sat=(row)=>frozen({status:'SAT',authoritative:false,...row});

const physicalListing=l=>tradeAssetType(l)===TRADE_ASSET_TYPES.PHYSICAL_ITEM;
const listingView=l=>({
  listingId:l.id,marketId:l.marketId,sellerId:l.sellerId,itemKind:l.itemKind,itemInstanceId:l.itemInstanceId??null,
  quantity:l.quantity,unitPrice:l.unitPrice,createdTick:l.createdTick??null,status:l.status,snapshotVersion:l.revision
});
const marketView=m=>({
  marketId:m.marketId,homeId:m.homeId,ownerAgentId:m.ownerAgentId,status:m.status,
  position:m.position?{x:m.position.x,y:m.position.y}:null,tradeRange:m.tradeRange
});

function productiveToolUse(world,agent){
  const rows=(world.rustPossessions?.items??[])
    .filter(i=>i.location?.kind==='bag'&&i.location.agentId===agent.id)
    .filter(i=>{
      const def=ITEM_CATALOG[i.kind];
      return def?.category==='tool'&&def.equipSlot==='hand'&&def.workAction===agent.preference;
    }).sort((a,b)=>a.id-b.id);
  if(!rows.length)return null;
  const equipped=(world.rustPossessions?.equipment??[]).find(e=>e.agentId===agent.id&&(e.slot??'hand')==='hand');
  const current=equipped&&world.rustPossessions.items.find(i=>i.id===equipped.itemId&&i.location?.kind==='bag'&&i.location.agentId===agent.id);
  if(current&&ITEM_CATALOG[current.kind]?.workAction===agent.preference)return null;
  const item=rows[0];
  return sat({type:'EQUIP_ITEM',agentId:agent.id,itemId:item.id,itemKind:item.kind,reason:'productive-tool-owned'});
}

function candidateKnowledge(world,agent,need,projection){
  const signal=projection.signals.find(s=>s.unit==='item'&&s.itemKind===need.itemKind)??null;
  if(!signal)return {markets:[],listings:[]};
  const supplyIds=new Set(signal.sources.filter(s=>s.kind==='LISTING'&&s.side==='SUPPLY').map(s=>String(s.evidenceId)));
  const listings=knownRc4Listings(agent).filter(l=>physicalListing(l)&&supplyIds.has(String(l.id))).map(listingView);
  const marketIds=new Set(listings.map(l=>String(l.marketId)));
  const markets=knownRc4Markets(agent).filter(m=>marketIds.has(String(m.marketId))).map(marketView);
  return {markets,listings};
}

function localArrival(world,agent,marketId,allowedListingIds){
  if(!isEr6ConsumerMarketTravelTask(agent.task))return {};
  const projected=projectHomeMarketForTrade(world,world.homeMarkets,{marketId});
  if(!projected.ok)return {};
  const arrival=verifyCanonicalMarketArrival(world,{agentId:agent.id,market:projected.market});
  if(arrival.state!=='SAT')return {};
  const listings=(world.merchantListings?.listings??[])
    .filter(l=>l.marketId===marketId&&allowedListingIds.has(String(l.id))&&physicalListing(l))
    .map(listingView);
  return {
    positionEvidence:{verified:true,source:'position-authority',agentId:agent.id,tick:world.tick,x:agent.x,y:agent.y},
    arrivalEvidence:{verified:true,source:'navigation-authority',evidenceId:'ER6:'+arrival.startedTick+':'+agent.id+':'+marketId,
      agentId:agent.id,marketId,tick:world.tick,x:agent.x,y:agent.y},
    localMarkets:[{marketId,ownerAgentId:(world.homeMarkets.markets.find(m=>m.marketId===marketId)?.ownerAgentId??null),
      status:projected.market.open?'open':'closed',position:{x:projected.market.x,y:projected.market.y},
      tradeRange:projected.market.tradeRange,listings}]
  };
}

export function consumerAutonomySnapshot(world,agent){
  if(!world||typeof world!=='object'||!agent||world.agents?.find(a=>a.id===agent.id)!==agent)return unknown(agent?.id,'world-agent');
  if(agent.alive!==true)return blocked(agent.id,'dead');
  if(agent.profession==='merchant'||agent.profession==='crafter')return blocked(agent.id,'specialized-seller-role');
  if(agent.adventureCombat?.status==='ACTIVE')return blocked(agent.id,'combat-active');

  const ownTravel=!!agent.task?.rc4MarketTravel&&isEr6ConsumerMarketTravelTask(agent.task);
  if(agent.task?.rc4MarketTravel&&!ownTravel)return blocked(agent.id,'foreign-market-travel');

  const use=productiveToolUse(world,agent);
  const needs=rc4PersonalItemNeeds(world,agent).slice().sort((a,b)=>String(a.needId).localeCompare(String(b.needId)));
  if(!needs.length){
    if(ownTravel)return sat({type:'CANCEL_TRAVEL',agentId:agent.id,reason:'need-cleared'});
    if(use)return use;
    return sat({type:'IDLE',agentId:agent.id,reason:'no-consumer-need'});
  }

  const projection=projectActorObservedDemand(world,agent);
  if(projection.status!=='SAT')return unknown(agent.id,projection.reason??'demand-projection',projection);
  const need=needs[0],knowledge=candidateKnowledge(world,agent,need,projection);
  if(!knowledge.listings.length||!knowledge.markets.length){
    if(ownTravel)return sat({type:'CANCEL_TRAVEL',agentId:agent.id,reason:'observed-supply-gone'});
    return blocked(agent.id,'no-observed-supply',{need:clone(need)});
  }
  const balance=getBalance(world,agent.id);
  if(!Number.isSafeInteger(balance)||balance<0)return unknown(agent.id,'wallet');

  const allowedListingIds=new Set(knowledge.listings.map(l=>String(l.listingId)));
  const travelMarketId=ownTravel?agent.task.rc4MarketTravel.marketId:null;
  const local=travelMarketId?localArrival(world,agent,travelMarketId,allowedListingIds):{};
  const policyState={
    tick:world.tick,
    agent:{id:agent.id,alive:true,x:agent.x,y:agent.y},
    needs:[clone(need)],
    wallet:{balance},
    knowledge:{knownMarkets:knowledge.markets,knownListings:knowledge.listings},
    localMarkets:local.localMarkets??[],
    intentJournal:[],
    transactionResults:[],
    ...(local.positionEvidence?{positionEvidence:local.positionEvidence}:{}),
    ...(local.arrivalEvidence?{arrivalEvidence:local.arrivalEvidence}:{}),
    ...(ownTravel?{travelGoal:{agentId:agent.id,marketId:travelMarketId,status:'walking'}}:{})
  };
  const selected=selectKnownCustomerListing(policyState,need);
  if(!selected){
    if(ownTravel)return sat({type:'CANCEL_TRAVEL',agentId:agent.id,reason:'purchase-no-longer-actionable'});
    return blocked(agent.id,'no-affordable-observed-supply',{need:clone(need),balance});
  }

  const decision=customerMarketDecision(policyState);
  if(decision?.type==='CREATE_TRAVEL_GOAL')return sat({
    type:'TRAVEL_TO_MARKET',agentId:agent.id,marketId:decision.marketId,listingId:decision.listingId,needId:need.needId,
    intent:{agentId:agent.id,marketId:decision.marketId}
  });
  if(decision?.type==='WAIT_TRAVEL')return sat({type:'WAIT_TRAVEL',agentId:agent.id,marketId:decision.marketId,listingId:decision.listingId,needId:need.needId});
  if(decision?.type==='SUBMIT_PURCHASE'){
    const listing=knowledge.listings.find(l=>String(l.listingId)===String(decision.listingId));
    if(!listing||!Number.isSafeInteger(listing.snapshotVersion)||listing.snapshotVersion<1)return unknown(agent.id,'listing-revision');
    return sat({
      type:'BUY_LISTING',agentId:agent.id,marketId:decision.marketId,listingId:decision.listingId,itemKind:decision.itemKind,
      itemId:decision.itemInstanceId,needId:need.needId,quantity:decision.quantity,
      intent:{buyerId:agent.id,listingId:decision.listingId,listingRevision:listing.snapshotVersion,quantity:decision.quantity}
    });
  }

  // The pure RC4 customer policy requires canonical arrival proof before a local
  // purchase. If the actor is already standing in range without a Navigation-owned
  // journey, create a zero/short path through the canonical travel command rather
  // than fabricating arrival evidence.
  if(!ownTravel&&selected)return sat({
    type:'TRAVEL_TO_MARKET',agentId:agent.id,marketId:selected.marketId,listingId:selected.listingId,needId:need.needId,
    reason:'canonical-arrival-required',intent:{agentId:agent.id,marketId:selected.marketId}
  });
  return blocked(agent.id,'customer-policy-no-action',{need:clone(need)});
}

export const consumerAutonomyDecision=consumerAutonomySnapshot;
