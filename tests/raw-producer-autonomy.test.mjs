import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {createWorld,command,step,serialize,restore,validate,pathTo,walkable} from '../src/engine.mjs';
import {rc2World,craftFixtureTable,craftFixtureHome} from './fixtures/rc2-world.mjs';
import {resourceStock,personalTargets} from '../src/individual-resources.mjs';
import {materialAmount} from '../src/material-economy.mjs';
import {getBalance,totalCurrency} from '../src/currency-wallet.mjs';
import {observeRc4Markets} from '../src/rc4-market-observation.mjs';
import {projectHomeMarketForTrade} from '../src/home-market.mjs';
import {TRADE_ASSET_TYPES} from '../src/trade-assets.mjs';
import {recordResourceDiscovery} from '../src/knowledge.mjs';
import {recordRelationshipEvidence} from '../src/relationships.mjs';
import {
  RAW_PRODUCER_VERSION,rawProducerCapability,producerSurplusSnapshot,rawProducerDecision,rawProducerGatherPressure
} from '../src/raw-producer-autonomy.mjs';

function setProfession(a,profession,preference){
  a.profession=profession;a.preference=preference;a.professionSinceTick=0;a.career=[{tick:0,profession}];
}
function setupOffer({itemKind='wood',quantity=2,unitPrice=3,producerAmount=null}={}){
  const s=rc2World(),merchant=s.agents[0],producer=s.agents[1];
  setProfession(producer,itemKind==='food'?'forager':itemKind==='wood'?'woodcutter':'miner',itemKind==='food'?'FORAGE':itemKind==='wood'?'WOODCUT':'MINE');
  producer.task=null;merchant.task=null;producer.hp=producer.satiety=producer.energy=100;merchant.hp=merchant.satiety=merchant.energy=100;
  if(producerAmount!==null)resourceStock(s,producer)[itemKind]=producerAmount;
  const market=command(s,'RC4_CREATE_MARKET',{agentId:merchant.id});assert.equal(market.ok,true,JSON.stringify(market));
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,itemKind,quantityWanted:quantity,unitPrice});
  assert.equal(offer.ok,true,JSON.stringify(offer));
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:merchant.id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  assert.equal(command(s,'RC4_OPEN_MARKET',{agentId:merchant.id,marketId:market.marketId}).ok,true);
  const projected=projectHomeMarketForTrade(s,s.homeMarkets,{marketId:market.marketId});assert.equal(projected.ok,true,JSON.stringify(projected));
  producer.x=projected.market.x;producer.y=projected.market.y;producer.task=null;observeRc4Markets(s);
  return {s,merchant,producer,market,offer,tradePoint:projected.market};
}
function nearbyReachable(s,from,minDistance=3){
  for(let r=minDistance;r<12;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    if(Math.abs(dx)+Math.abs(dy)<minDistance)continue;
    const p={x:from.x+dx,y:from.y+dy};
    if(walkable(s,p.x,p.y)&&pathTo(s,p,from)?.length>=minDistance)return p;
  }
  return null;
}
function arrive(s,a,marketId){
  a.task=null;
  const travel=command(s,'RC4_TRAVEL_TO_MARKET',{agentId:a.id,marketId});assert.equal(travel.ok,true,JSON.stringify(travel));
  for(let i=0;i<800&&a.task?.path?.length;i++)step(s,1);
  assert.ok(a.task?.rc4MarketTravel);assert.equal(a.task.path.length,0);
}

test('ER2 version and raw career capabilities are explicit and bounded',()=>{
  assert.equal(RAW_PRODUCER_VERSION,'ER2-raw-producer/1');
  assert.equal(rawProducerCapability({profession:'forager'},'food').action,'FORAGE');
  assert.equal(rawProducerCapability({profession:'woodcutter'},'wood').action,'WOODCUT');
  assert.equal(rawProducerCapability({profession:'miner'},'stone').action,'MINE');
  assert.equal(rawProducerCapability({profession:'miner'},'ironOre').action,'MINE');
  assert.equal(rawProducerCapability({profession:'woodcutter'},'ironOre'),null);
  assert.equal(rawProducerCapability({profession:'merchant'},'wood'),null);
});

test('ER2 surplus is owned minus canonical household reserve and cohabitants raise that reserve',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:3}),dependent=s.agents[1],producer=s.agents[2];
  Object.assign(resourceStock(s,producer),{wood:500,stone:500,food:500});
  producer.hp=producer.satiety=producer.energy=100;dependent.hp=dependent.satiety=dependent.energy=100;
  craftFixtureTable(s,producer);craftFixtureHome(s,producer);
  producer.task=null;dependent.task=null;
  setProfession(producer,'woodcutter','WOODCUT');
  const solo=personalTargets(s,producer).wood;
  assert.equal(recordRelationshipEvidence(s,{fromId:dependent.id,toId:producer.id,kind:'test',key:'er2-join-from',delta:{trust:4,affinity:2}}).ok,true);
  assert.equal(recordRelationshipEvidence(s,{fromId:producer.id,toId:dependent.id,kind:'test',key:'er2-join-to',delta:{affinity:2}}).ok,true);
  const joined=command(s,'JOIN_HOUSEHOLD',{agentId:dependent.id,ownerId:producer.id});assert.equal(joined.ok,true,JSON.stringify(joined));
  const household=personalTargets(s,producer).wood;assert.ok(household>solo);
  resourceStock(s,producer).wood=household+7;
  const snap=producerSurplusSnapshot(s,producer,'wood');
  assert.equal(snap.status,'SAT');assert.equal(snap.protectedReserve,household);assert.equal(snap.grossSurplus,7);assert.equal(snap.tradableSurplus,7);
});

test('ER2 global BuyOffer truth is not demand until this producer observed it',()=>{
  const {s,producer}=setupOffer({itemKind:'wood',quantity:2,producerAmount:100});
  delete producer.rc4MarketKnowledge;
  const before=serialize(s),decision=rawProducerDecision(s,producer);
  assert.equal(decision.status,'SAT');assert.equal(decision.type,'IDLE');assert.equal(decision.reason,'no-observed-buy-offer');
  assert.equal(serialize(s),before);
});

test('ER2 observed demand above reserve creates gather pressure instead of selling reserve',()=>{
  const {s,producer}=setupOffer({itemKind:'wood',quantity:3});
  const reserve=personalTargets(s,producer).wood;resourceStock(s,producer).wood=reserve;
  const d=rawProducerDecision(s,producer);
  assert.equal(d.status,'SAT');assert.equal(d.type,'GATHER');assert.equal(d.action,'WOODCUT');assert.equal(d.missing,3);
  assert.equal(d.protectedReserve,reserve);assert.equal(d.tradableSurplus,0);
  const pressure=rawProducerGatherPressure(d,'WOODCUT');assert.ok(pressure);assert.ok(pressure.bonus>0);
  assert.equal(rawProducerGatherPressure(d,'MINE'),null);
});

test('ER2 real Woodcutter gathers through the existing node authority, walks to an observed market and creates one procurement Listing',()=>{
  const {s,merchant,producer,market,offer,tradePoint}=setupOffer({itemKind:'wood',quantity:2});
  const reserve=personalTargets(s,producer).wood;resourceStock(s,producer).wood=reserve;
  const node=s.nodes.filter(n=>n.type==='wood'&&n.amount>=3)
    .map(n=>({node:n,path:pathTo(s,producer,n)}))
    .filter(x=>Array.isArray(x.path))
    .sort((a,b)=>a.path.length-b.path.length||a.node.id-b.node.id)[0]?.node;
  assert.ok(node,'reachable wood node');
  assert.ok(recordResourceDiscovery(producer,node,s.tick,{action:'WOODCUT',amount:1}));
  const nodeBefore=node.amount,moneyBefore=getBalance(s,producer.id),totalBefore=totalCurrency(s);
  let sawGather=false,sawTravel=false,listing=null;
  for(let i=0;i<720&&!listing;i++){
    step(s,1);
    if(producer.task?.kind==='WOODCUT')sawGather=true;
    if(producer.task?.rc4MarketTravel)sawTravel=true;
    listing=s.merchantListings.listings.find(l=>l.buyOfferId===offer.offerId&&l.sellerId===producer.id&&l.status==='OPEN')??null;
  }
  assert.equal(sawGather,true);assert.equal(sawTravel,true);assert.ok(listing,'autonomous producer must answer the observed BuyOffer');
  assert.ok(node.amount<nodeBefore,'wood came from a real node');
  assert.ok(materialAmount(s,producer,'wood')>=reserve+2,'reserve remains plus offered quantity before settlement');
  assert.equal(getBalance(s,producer.id),moneyBefore,'accepting a BuyOffer is not remote payment');
  assert.equal(totalCurrency(s),totalBefore);
  assert.equal(listing.assetType,TRADE_ASSET_TYPES.BULK_RESOURCE);
  assert.equal(Object.hasOwn(listing,'itemInstanceId'),false);

  const saved=producerSurplusSnapshot(s,producer,'wood');
  const loaded=restore(serialize(s)),loadedProducer=loaded.agents.find(a=>a.id===producer.id);
  assert.deepEqual(producerSurplusSnapshot(loaded,loadedProducer,'wood'),saved,'derived reserve/surplus survives save/load without new state');

  merchant.task=null;arrive(s,merchant,market.marketId);
  const sellerMoney=getBalance(s,producer.id),buyerMoney=getBalance(s,merchant.id),currency=totalCurrency(s);
  const bought=command(s,'RC4_BUY_LISTING',{buyerId:merchant.id,listingId:listing.id,listingRevision:listing.revision});
  assert.equal(bought.ok,true,JSON.stringify(bought));
  assert.equal(getBalance(s,producer.id),sellerMoney+listing.unitPrice*listing.quantity);
  assert.equal(getBalance(s,merchant.id),buyerMoney-listing.unitPrice*listing.quantity);
  assert.equal(totalCurrency(s),currency);
  assert.ok(materialAmount(s,producer,'wood')>=personalTargets(s,producer).wood,'settlement cannot consume protected reserve');
  assert.deepEqual(validate(s),[]);
  assert.ok(Math.abs(producer.x-tradePoint.x)+Math.abs(producer.y-tradePoint.y)<=1);
});

test('ER2 competing BuyOffers cannot over-commit one producer surplus and exact replay stays idempotent',()=>{
  const {s,merchant,producer,market,offer}=setupOffer({itemKind:'wood',quantity:4,unitPrice:2});
  const reserve=personalTargets(s,producer).wood;resourceStock(s,producer).wood=reserve+5;
  const first=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:producer.id,offerId:offer.offerId,quantity:4});
  assert.equal(first.ok,true,JSON.stringify(first));
  const replay=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:producer.id,offerId:offer.offerId,quantity:4});
  assert.equal(replay.ok,true,JSON.stringify(replay));
  const secondOffer=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,itemKind:'wood',quantityWanted:2,unitPrice:3});
  assert.equal(secondOffer.ok,true,JSON.stringify(secondOffer));
  const second=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:producer.id,offerId:secondOffer.offerId,quantity:2});
  assert.equal(second.ok,false);assert.equal(second.reason,'producer-resource-committed');
  const snap=producerSurplusSnapshot(s,producer,'wood');
  assert.equal(snap.offeredQuantity,4);assert.equal(snap.tradableSurplus,1);
  assert.equal(s.merchantListings.listings.filter(l=>l.buyOfferId===offer.offerId&&l.sellerId===producer.id).length,1);
  assert.equal(market.marketId,first.marketId);
});



test('ER2 settlement preserves other open procurement commitments after stock drops',()=>{
  const {s,merchant,producer,market,offer}=setupOffer({itemKind:'wood',quantity:3,unitPrice:2});
  const reserve=personalTargets(s,producer).wood;resourceStock(s,producer).wood=reserve+6;
  const first=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:producer.id,offerId:offer.offerId,quantity:3});assert.equal(first.ok,true,JSON.stringify(first));
  const secondOffer=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,itemKind:'wood',quantityWanted:3,unitPrice:3});
  assert.equal(secondOffer.ok,true,JSON.stringify(secondOffer));
  const second=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:producer.id,offerId:secondOffer.offerId,quantity:3});assert.equal(second.ok,true,JSON.stringify(second));
  const listing=s.merchantListings.listings.find(l=>l.id===first.listingId);assert.ok(listing);
  resourceStock(s,producer).wood=reserve+5;
  merchant.task=null;arrive(s,merchant,market.marketId);
  const before=serialize(s);
  const bought=command(s,'RC4_BUY_LISTING',{buyerId:merchant.id,listingId:listing.id,listingRevision:listing.revision});
  assert.equal(bought.ok,false);assert.equal(bought.reason,'producer-resource-committed');
  assert.equal(serialize(s),before,'settlement must preserve reserve plus the other open procurement commitment');
});

test('ER2 settlement revalidates reserve after intervening consumption and rolls back the attempted trade',()=>{
  const {s,merchant,producer,market,offer}=setupOffer({itemKind:'wood',quantity:4,unitPrice:2});
  const reserve=personalTargets(s,producer).wood;resourceStock(s,producer).wood=reserve+5;
  const accepted=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:producer.id,offerId:offer.offerId,quantity:4});assert.equal(accepted.ok,true);
  const listing=s.merchantListings.listings.find(l=>l.id===accepted.listingId);assert.ok(listing);
  resourceStock(s,producer).wood=reserve+3;
  merchant.task=null;arrive(s,merchant,market.marketId);
  const before=serialize(s);
  const bought=command(s,'RC4_BUY_LISTING',{buyerId:merchant.id,listingId:listing.id,listingRevision:listing.revision});
  assert.equal(bought.ok,false);assert.equal(bought.reason,'producer-protected-reserve');
  assert.equal(serialize(s),before,'failed reserve revalidation must not mutate wallet/resource/listing/reservation');
});

test('ER2 corrupt demand authority remains UNKNOWN and policy source owns no economic writer',()=>{
  const {s,producer}=setupOffer({itemKind:'wood',quantity:2,producerAmount:100});
  s.merchantBuyOffers={};
  const d=rawProducerDecision(s,producer);assert.equal(d.status,'UNKNOWN');
  const source=fs.readFileSync(new URL('../src/raw-producer-autonomy.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Math\.random|\bDate\b|document\.|window\.|fetch\(/);
  assert.doesNotMatch(source,/currencyWallet\s*=|merchantListings\s*=|merchantBuyOffers\s*=|\.balance\s*[+\-]?=|addMaterialSet|consumeMaterialSet|profession\s*=(?!=)/);
});
