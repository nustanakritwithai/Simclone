import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {houseSite} from '../src/housing.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {advanceCraft} from '../src/rust-possessions.mjs';
import {getBalance,totalCurrency} from '../src/currency-wallet.mjs';
import {verifyCanonicalMarketArrival} from '../src/navigation-arrival-evidence.mjs';
import {projectHomeMarketForTrade} from '../src/home-market.mjs';
import {assessTradeKernelResult,createMerchantLedger,tradeReceiptFingerprint,tradeReceiptIntegrityFingerprint} from '../src/merchant-ledger.mjs';

function give(s,a,kind){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
}
function equip(s,a,itemId){s.rustPossessions.equipment.push({agentId:a.id,itemId});}
function completeHome(s,a){
  const site=houseSite(s,walkable).origin;a.x=site.x;a.y=site.y;a.task=null;
  const hammer=give(s,a,'HAMMER');equip(s,a,hammer);
  const place=(kind,socket)=>{
    const id=give(s,a,kind);
    const r=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'rc4-home:'+s.tick+':'+a.id+':'+id});
    assert.equal(r.ok,true,JSON.stringify(r));return r;
  };
  const {x,y}=site;
  place('WOOD_FOUNDATION',{type:'cell',x,y});
  place('WOOD_WALL',canonicalEdge(x,y,'N'));
  place('WOOD_WALL',canonicalEdge(x,y,'E'));
  place('WOOD_WALL',canonicalEdge(x,y,'W'));
  place('WOOD_DOORWAY',canonicalEdge(x,y,'S'));
  place('WOOD_ROOF',{type:'cell',x,y});
  return site;
}
function craftItem(s,a,recipeId='STONE_AXE'){
  a.task=null;
  const order=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId});
  assert.equal(order.ok,true,JSON.stringify(order));
  let result=null;
  for(let i=0;i<40&&!result?.completed;i++){s.tick++;result=advanceCraft(s,a.id);}
  assert.equal(result?.completed,true,'canonical craft completes');
  const item=s.rustPossessions.items.find(i=>i.id===result.itemId);
  assert.ok(item&&item.createdBy===a.id&&item.location?.kind==='bag'&&item.location.agentId===a.id);
  return item;
}
const actor=(s,id)=>s.agents.find(a=>a.id===id);
function runToMarket(s,a,max=500){
  for(let i=0;i<max&&a.task?.path?.length;i++)step(s,1);
  assert.ok(a.task,'market arrival task is held at destination');
  assert.equal(a.task.path.length,0,'buyer reached canonical market destination');
}

test('RC4 root migration is additive and corrupt-present Home Market fails closed',()=>{
  const s=createWorld(230926);
  assert.equal(s.rc4EconomyVersion,'RC4-economy-root/1');
  assert.ok(s.homeMarkets&&s.merchantListings&&s.merchantBuyOffers&&s.merchantReservations&&s.currencyWallet&&s.tradeReplay&&s.merchantLedgers);
  assert.deepEqual(validate(s),[]);
  const old=JSON.parse(serialize(s));
  for(const key of ['rc4EconomyVersion','homeMarkets','merchantListings','merchantBuyOffers','merchantReservations','currencyWallet','tradeReplay','merchantLedgers'])delete old[key];
  const migrated=restore(JSON.stringify(old));
  assert.equal(migrated.rc4EconomyVersion,'RC4-economy-root/1');
  assert.equal(migrated.currencyWallet.accounts.length,migrated.agents.length);
  const corrupt=JSON.parse(serialize(s));corrupt.homeMarkets={};
  assert.throws(()=>restore(JSON.stringify(corrupt)),/RC4 migration failed: home-markets/);
});

test('RC4 forged receipt + matching replay + recomputed hashes stays UNKNOWN',()=>{
  const receipt={
    transactionId:'TX:forged',marketId:'M1',listingId:'L1',reservationId:'R1',
    buyerId:2,sellerId:1,itemKind:'STONE_AXE',itemInstanceId:77,itemIds:[77],
    quantity:1,unitPrice:100,totalPrice:100,eventId:'TRADE:TX:forged'
  };
  receipt.fingerprint=tradeReceiptFingerprint(receipt);
  receipt.integrityFingerprint=tradeReceiptIntegrityFingerprint(receipt);
  const result={ok:true,duplicate:false,receipt,state:{tradeReplay:{version:'RC4-trade-replay-1',receipts:[structuredClone(receipt)]}}};
  const before=createMerchantLedger(1),assessed=assessTradeKernelResult(result);
  assert.equal(assessed.state,'UNKNOWN');
  assert.equal(assessed.reason,'trade-commit-provenance');
  assert.deepEqual(before,createMerchantLedger(1));
});

test('RC4 playable vertical A->B->C: Producer -> Merchant -> Customer with 100/70/30 accounting',()=>{
  let s=createWorld(230926),producer=s.agents[0],merchant=s.agents[1],customer=s.agents[2];
  const producerId=producer.id,merchantId=merchant.id,customerId=customer.id;
  for(const a of [producer,merchant,customer]){a.satiety=100;a.energy=100;a.task=null;a.moveTick=0;}
  completeHome(s,merchant);
  const sale=craftItem(s,producer,'STONE_AXE');
  const beforeTotal=totalCurrency(s);

  // Preparation market is CLOSED and may exist before profession adoption.
  const market=command(s,'RC4_CREATE_MARKET',{agentId:merchant.id});
  assert.equal(market.ok,true,JSON.stringify(market));
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,itemKind:sale.kind,unitPrice:70});
  assert.equal(offer.ok,true,JSON.stringify(offer));
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:merchant.id});
  assert.equal(promoted.ok,true,JSON.stringify(promoted));
  producer=actor(s,producerId);merchant=actor(s,merchantId);customer=actor(s,customerId);
  assert.equal(merchant.profession,'merchant');
  assert.equal(command(s,'RC4_OPEN_MARKET',{marketId:market.marketId}).ok,true);

  // Producer accepts BuyOffer, producing a canonical procurement Listing at Merchant's market.
  const accepted=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:producer.id,offerId:offer.offerId,itemId:sale.id});
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  const procurement=s.merchantListings.listings.find(l=>l.id===accepted.listingId);
  assert.equal(procurement.sellerId,producer.id);
  assert.equal(procurement.unitPrice,70);

  // A cloned/lookalike navigation task is not canonical provenance.
  const travel0=command(s,'RC4_TRAVEL_TO_MARKET',{agentId:merchant.id,marketId:market.marketId});
  assert.equal(travel0.ok,true,JSON.stringify(travel0));
  const canonicalTask=merchant.task;
  merchant.task=structuredClone(canonicalTask);
  const marketProjection=projectHomeMarketForTrade(s,s.homeMarkets,{marketId:market.marketId}).market;
  assert.equal(verifyCanonicalMarketArrival(s,{agentId:merchant.id,market:marketProjection}).state,'VIOL');
  actor(s,merchantId).task=null;actor(s,merchantId).moveTick=0;
  merchant=actor(s,merchantId);

  // Merchant travels through canonical path and buys exact Producer item for 70.
  const travel1=command(s,'RC4_TRAVEL_TO_MARKET',{agentId:merchant.id,marketId:market.marketId});
  assert.equal(travel1.ok,true,JSON.stringify(travel1));runToMarket(s,merchant);
  assert.equal(verifyCanonicalMarketArrival(s,{agentId:merchant.id,market:marketProjection}).state,'SAT');
  const buy70=command(s,'RC4_BUY_LISTING',{buyerId:merchant.id,listingId:procurement.id});
  assert.equal(buy70.ok,true,JSON.stringify(buy70));
  producer=actor(s,producerId);merchant=actor(s,merchantId);customer=actor(s,customerId);
  assert.equal(s.rustPossessions.items.find(i=>i.id===sale.id).location.agentId,merchant.id);
  assert.equal(getBalance(s,merchant.id),30);
  assert.equal(getBalance(s,producer.id),170);

  // Merchant lists the same physical item for 100.
  const resale=command(s,'RC4_CREATE_LISTING',{agentId:merchant.id,itemId:sale.id,unitPrice:100});
  assert.equal(resale.ok,true,JSON.stringify(resale));
  const listed=s.merchantListings.listings.find(l=>l.id===resale.listingId);
  assert.equal(listed.itemInstanceId,sale.id);assert.equal(listed.unitPrice,100);

  // Customer must physically walk to the market before purchase.
  const travel2=command(s,'RC4_TRAVEL_TO_MARKET',{agentId:customer.id,marketId:market.marketId});
  assert.equal(travel2.ok,true,JSON.stringify(travel2));customer=actor(s,customerId);runToMarket(s,customer);
  assert.equal(verifyCanonicalMarketArrival(s,{agentId:customer.id,market:marketProjection}).state,'SAT');

  const bought=command(s,'RC4_BUY_LISTING',{buyerId:customer.id,listingId:listed.id});
  assert.equal(bought.ok,true,JSON.stringify(bought));
  producer=actor(s,producerId);merchant=actor(s,merchantId);customer=actor(s,customerId);
  assert.equal(getBalance(s,merchant.id),130);
  assert.equal(getBalance(s,customer.id),0);
  assert.equal(totalCurrency(s),beforeTotal);
  const moved=s.rustPossessions.items.find(i=>i.id===sale.id);
  assert.deepEqual(moved.location,{kind:'bag',agentId:customer.id});

  const ledger=s.merchantLedgers.ledgers.find(l=>l.merchantId===merchant.id);
  assert.equal(ledger.purchases.length,1);
  assert.equal(ledger.purchases[0].unitPrice,70);
  assert.deepEqual(ledger.purchases[0].remainingItemIds,[]);
  assert.equal(ledger.revenue,100);
  assert.equal(ledger.costOfGoodsSold,70);
  assert.equal(ledger.realizedProfit,30);
  const merchantAfter=s.agents.find(a=>a.id===merchant.id);
  assert.equal(merchantAfter.merchantTransactions,2);
  assert.equal(merchantAfter.merchantExperience,2);
  assert.equal(s.agents.find(a=>a.id===customer.id).task,null);
  assert.deepEqual(validate(s),[]);

  const wire=serialize(s);s=restore(wire);
  assert.equal(serialize(s),wire,'RC4 authoritative roots survive save/load byte-stably');
  assert.deepEqual(validate(s),[]);
});
