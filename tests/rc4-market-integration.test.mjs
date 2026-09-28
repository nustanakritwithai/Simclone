import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {houseSite} from '../src/housing.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {getBalance,totalCurrency} from '../src/currency-wallet.mjs';
import {verifyCanonicalMarketArrival} from '../src/navigation-arrival-evidence.mjs';
import {assessTradeKernelResult,createMerchantLedger} from '../src/merchant-ledger.mjs';

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

test('RC4 plain forged Trade result cannot become accounting authority',()=>{
  const ledger=createMerchantLedger(1);
  const forged={ok:true,duplicate:false,receipt:{},state:{tradeReplay:{version:'RC4-trade-replay-1',receipts:[]}}};
  const assessed=assessTradeKernelResult(forged);
  assert.notEqual(assessed.state,'SAT');
  assert.deepEqual(ledger,createMerchantLedger(1));
});

test('RC4 playable vertical: Merchant Home Market -> Listing -> real walk -> atomic purchase -> Ledger/Career -> save/load',()=>{
  let s=createWorld(230926),merchant=s.agents[0],buyer=s.agents[1];
  merchant.satiety=100;merchant.energy=100;buyer.satiety=100;buyer.energy=100;
  completeHome(s,merchant);
  const itemId=give(s,merchant,'STONE_AXE');

  const beforeTotal=totalCurrency(s);
  assert.equal(beforeTotal,100*s.agents.length);
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:merchant.id});
  assert.equal(promoted.ok,true,JSON.stringify(promoted));assert.equal(merchant.profession,'merchant');

  const market=command(s,'RC4_CREATE_MARKET',{agentId:merchant.id});assert.equal(market.ok,true,JSON.stringify(market));
  assert.equal(command(s,'RC4_OPEN_MARKET',{marketId:market.marketId}).ok,true);
  const listed=command(s,'RC4_CREATE_LISTING',{agentId:merchant.id,itemId,unitPrice:50});
  assert.equal(listed.ok,true,JSON.stringify(listed));

  const travel=command(s,'RC4_TRAVEL_TO_MARKET',{agentId:buyer.id,marketId:market.marketId});
  assert.equal(travel.ok,true,JSON.stringify(travel));
  runToMarket(s,buyer);
  const marker=s.homeMarkets.markets.find(m=>m.marketId===market.marketId);assert.equal(marker.status,'open');
  const fakeExternalEvidence={producer:'SIMCLONE_CANONICAL_TASK',verification:'NAVIGATION_VERIFIED',agentId:buyer.id,marketId:market.marketId,evidenceId:'recomputed'};
  const marketProjection=(await import('../src/home-market.mjs')).projectHomeMarketForTrade(s,s.homeMarkets,{marketId:market.marketId}).market;
  assert.equal(verifyCanonicalMarketArrival(s,{agentId:buyer.id,market:marketProjection,evidence:fakeExternalEvidence}).state,'SAT','verification reads canonical task, not caller evidence');

  const merchantBefore=getBalance(s,merchant.id),buyerBefore=getBalance(s,buyer.id);
  const bought=command(s,'RC4_BUY_LISTING',{buyerId:buyer.id,listingId:listed.listingId});
  assert.equal(bought.ok,true,JSON.stringify(bought));
  assert.equal(getBalance(s,merchant.id),merchantBefore+50);
  assert.equal(getBalance(s,buyer.id),buyerBefore-50);
  assert.equal(totalCurrency(s),beforeTotal);

  const item=s.rustPossessions.items.find(i=>i.id===itemId);
  assert.equal(item.location.kind,'bag');assert.equal(item.location.agentId,buyer.id);
  const listing=s.merchantListings.listings.find(l=>l.id===listed.listingId);
  assert.equal(listing.status,'FILLED');assert.equal(listing.quantity,0);assert.equal(listing.revision,2);
  const reservation=s.merchantReservations.reservations.at(-1);
  assert.equal(reservation.status,'COMMITTED');assert.equal(reservation.transactionId,bought.transactionId);
  const ledger=s.merchantLedgers.ledgers.find(l=>l.merchantId===merchant.id);
  assert.equal(ledger.revenue,50);assert.equal(ledger.costOfGoodsSold,0);assert.equal(ledger.realizedProfit,50);
  assert.equal(merchant.merchantTransactions,1);assert.equal(merchant.merchantExperience,1);
  assert.equal(buyer.task,null);
  assert.deepEqual(validate(s),[]);

  const wire=serialize(s);s=restore(wire);
  assert.equal(serialize(s),wire,'RC4 authoritative roots survive save/load byte-stably');
  const replay=command(s,'RC4_BUY_LISTING',{buyerId:buyer.id,listingId:listed.listingId});
  assert.equal(replay.ok,false,'FILLED Listing cannot be purchased again');
  assert.deepEqual(validate(s),[]);
});
