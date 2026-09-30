/**
 * ER6 consumer autonomy bridge.
 *
 * This is coordination/projection only. Demand comes from ER1's released
 * actor-observed PERSONAL_ITEM_NEED projection; market knowledge comes from the released
 * actor-scoped observation authority; movement/trade/equipment mutations stay
 * behind their canonical commands in engine/runtime.
 */
import {customerMarketDecision,selectKnownCustomerListing} from './rc4-customer-market-policy.mjs?v=0.5.0';
import {validateRc4MarketKnowledge,knownRc4Markets,knownRc4Listings} from './rc4-market-observation.mjs?v=0.5.0';
import {actorDirectItemNeeds,projectActorObservedDemand} from './economic-demand.mjs?v=0.5.0';
import {getBalance} from './currency-wallet.mjs?v=0.5.0';
import {projectHomeMarketForTrade} from './home-market.mjs?v=0.5.0';
import {verifyCanonicalMarketArrival} from './navigation-arrival-evidence.mjs?v=0.5.0';
import {isEr6ConsumerMarketTravelTask,prepareRc4MarketTravel} from './rc4-market-runtime.mjs?v=0.5.0';
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

function personalNeedsFromProjection(projection,agentId){
  const rows=[];
  const seen=new Set();
  for(const signal of projection?.signals??[]){
    if(signal?.unit!=='item')continue;
    for(const source of signal.sources??[]){
      if(source?.kind!=='PERSONAL_ITEM_NEED'||source.side!=='DEMAND'||source.subjectAgentId!==agentId)continue;
      const itemKind=signal.itemKind;
      if(typeof itemKind!=='string'||!itemKind||seen.has(itemKind))continue;
      seen.add(itemKind);
      rows.push({
        needId:String(source.evidenceId),itemKind,quantity:Number.isSafeInteger(source.quantity)&&source.quantity>0?source.quantity:1,
        purpose:source.purpose??'simulation-need',fulfillment:source.fulfillment??'carry',slot:source.slot??null
      });
    }
  }
  return rows.sort((a,b)=>String(a.needId).localeCompare(String(b.needId))||a.itemKind.localeCompare(b.itemKind));
}

function adventureGearUse(world,agent){
  if(agent.profession!=='adventurer')return null;
  const equipped=new Map((world.rustPossessions?.equipment??[])
    .filter(e=>e.agentId===agent.id).map(e=>[e.slot??'hand',e.itemId]));
  const rows=(world.rustPossessions?.items??[])
    .filter(i=>i.location?.kind==='bag'&&i.location.agentId===agent.id)
    .filter(i=>{
      const def=ITEM_CATALOG[i.kind];
      return def?.category==='gear'&&['WEAPON','ARMOR'].includes(def.equipSlot)&&!equipped.has(def.equipSlot);
    }).sort((a,b)=>{
      const da=ITEM_CATALOG[a.kind],db=ITEM_CATALOG[b.kind];
      return da.equipSlot.localeCompare(db.equipSlot)||a.id-b.id;
    });
  if(!rows.length)return null;
  const item=rows[0],def=ITEM_CATALOG[item.kind];
  return sat({type:'EQUIP_ITEM',agentId:agent.id,itemId:item.id,itemKind:item.kind,slot:def.equipSlot,reason:'adventure-gear-owned'});
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

  const use=productiveToolUse(world,agent)??adventureGearUse(world,agent);

  // Existing canonical stock that satisfies a real use comes before shopping for
  // another need. This keeps purchase -> actual use atomic at the policy level
  // without inventing a second equipment authority.
  if(use)return use;

  // Cheap fail-closed precheck: use ER1's own direct-need derivation and retained
  // actor knowledge before paying for full economy-root validation every tick.
  // A candidate that survives this precheck is still authorized only by the full
  // actor-observed projection below, so hidden/stale supply stays non-actionable.
  const directNeeds=actorDirectItemNeeds(world,agent);
  if(!directNeeds.length){
    if(ownTravel)return sat({type:'CANCEL_TRAVEL',agentId:agent.id,reason:'need-cleared'});
    return sat({type:'IDLE',agentId:agent.id,reason:'no-consumer-need'});
  }
  const knowledgeErrors=validateRc4MarketKnowledge(agent);
  if(knowledgeErrors.length)return unknown(agent.id,'market-knowledge-invalid',knowledgeErrors);
  const knownMarkets=knownRc4Markets(agent);
  if(!knownMarkets.length){
    if(ownTravel)return sat({type:'CANCEL_TRAVEL',agentId:agent.id,reason:'observed-market-gone'});
    return blocked(agent.id,'no-observed-market',{need:clone(directNeeds[0])});
  }
  const neededKinds=new Set(directNeeds.map(n=>n.itemKind));
  const knownListings=knownRc4Listings(agent);
  if(!knownListings.some(l=>l&&physicalListing(l)&&neededKinds.has(l.itemKind))){
    if(ownTravel)return sat({type:'CANCEL_TRAVEL',agentId:agent.id,reason:'observed-supply-gone'});
    return blocked(agent.id,'no-observed-supply',{need:clone(directNeeds[0])});
  }

  // Consumer decisions only use item demand. Household/resource shortage projection
  // is unrelated here and clones the world, so skip that read-only work without
  // weakening any item/listing/market validation.
  const projection=projectActorObservedDemand(world,agent,{includeResourceShortages:false});
  if(projection.status!=='SAT')return unknown(agent.id,projection.reason??'demand-projection',projection);
  const needs=personalNeedsFromProjection(projection,agent.id);
  if(!needs.length){
    if(ownTravel)return sat({type:'CANCEL_TRAVEL',agentId:agent.id,reason:'need-cleared'});
    return sat({type:'IDLE',agentId:agent.id,reason:'no-consumer-need'});
  }

  const balance=getBalance(world,agent.id);
  if(!Number.isSafeInteger(balance)||balance<0)return unknown(agent.id,'wallet');

  const travelMarketId=ownTravel?agent.task.rc4MarketTravel.marketId:null;
  let selectedNeed=null,selectedKnowledge=null,selectedState=null,selected=null;
  let sawSupply=false,sawAffordable=false,sawNoPath=false,travelFailure=null;

  // A missing/unaffordable first need must not mask a later need that can be
  // satisfied. Within each need, keep RC4 price ordering but discard only markets
  // that canonical Navigation proves have no path.
  for(const need of needs){
    const base=candidateKnowledge(world,agent,need,projection);
    let listings=base.listings,markets=base.markets;
    if(ownTravel){
      listings=listings.filter(l=>String(l.marketId)===String(travelMarketId));
      markets=markets.filter(m=>String(m.marketId)===String(travelMarketId));
    }
    if(!listings.length||!markets.length)continue;
    sawSupply=true;
    let remaining=listings.slice();
    while(remaining.length){
      const marketIds=new Set(remaining.map(l=>String(l.marketId)));
      const knowledge={listings:remaining,markets:markets.filter(m=>marketIds.has(String(m.marketId)))};
      const allowedListingIds=new Set(knowledge.listings.map(l=>String(l.listingId)));
      const local=ownTravel?localArrival(world,agent,travelMarketId,allowedListingIds):{};
      const state={
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
      const candidate=selectKnownCustomerListing(state,need);
      if(!candidate)break;
      sawAffordable=true;
      if(!ownTravel){
        const prepared=prepareRc4MarketTravel(world,{agentId:agent.id,marketId:candidate.marketId});
        if(!prepared.ok){
          if(prepared.reason==='no-path'){
            sawNoPath=true;
            remaining=remaining.filter(l=>String(l.marketId)!==String(candidate.marketId));
            continue;
          }
          travelFailure=prepared.reason??'unavailable';
          break;
        }
      }
      selectedNeed=need;selectedKnowledge=knowledge;selectedState=state;selected=candidate;break;
    }
    if(selected||travelFailure)break;
  }

  if(!selected){
    if(ownTravel)return sat({type:'CANCEL_TRAVEL',agentId:agent.id,reason:'purchase-no-longer-actionable'});
    const reason=travelFailure?'market-travel-'+travelFailure:
      sawNoPath?'no-reachable-observed-supply':
      sawSupply&&!sawAffordable?'no-affordable-observed-supply':'no-observed-supply';
    return blocked(agent.id,reason,{need:clone(needs[0]),needs:clone(needs),balance});
  }

  const need=selectedNeed,knowledge=selectedKnowledge,policyState=selectedState;
  const decision=customerMarketDecision(policyState);
  if(decision?.type==='CREATE_TRAVEL_GOAL')return sat({
    type:'TRAVEL_TO_MARKET',agentId:agent.id,marketId:decision.marketId,listingId:decision.listingId,needId:need.needId,
    itemKind:need.itemKind,intent:{agentId:agent.id,marketId:decision.marketId}
  });
  if(decision?.type==='WAIT_TRAVEL')return sat({type:'WAIT_TRAVEL',agentId:agent.id,marketId:decision.marketId,listingId:decision.listingId,needId:need.needId,itemKind:need.itemKind});
  if(decision?.type==='SUBMIT_PURCHASE'){
    const listing=knowledge.listings.find(l=>String(l.listingId)===String(decision.listingId));
    if(!listing||!Number.isSafeInteger(listing.snapshotVersion)||listing.snapshotVersion<1)return unknown(agent.id,'listing-revision');
    return sat({
      type:'BUY_LISTING',agentId:agent.id,marketId:decision.marketId,listingId:decision.listingId,itemKind:decision.itemKind,
      itemId:decision.itemInstanceId,needId:need.needId,quantity:decision.quantity,
      fulfillment:need.fulfillment??'carry',slot:need.slot??null,purpose:need.purpose??null,
      intent:{buyerId:agent.id,listingId:decision.listingId,listingRevision:listing.snapshotVersion,quantity:decision.quantity}
    });
  }

  if(!ownTravel&&selected)return sat({
    type:'TRAVEL_TO_MARKET',agentId:agent.id,marketId:selected.marketId,listingId:selected.listingId,needId:need.needId,
    itemKind:need.itemKind,reason:'canonical-arrival-required',intent:{agentId:agent.id,marketId:selected.marketId}
  });
  return blocked(agent.id,'customer-policy-no-action',{need:clone(need)});

}

export const consumerAutonomyDecision=consumerAutonomySnapshot;
