import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,command,serialize,restore,walkable} from '../src/engine.mjs';
import {houseSite} from '../src/housing.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {projectHomeMarketForTrade} from '../src/home-market.mjs';
import {transferRustItemInstances,RUST_POSSESSION_LIMITS} from '../src/rust-possessions.mjs';
import {verifyCanonicalMarketArrival} from '../src/navigation-arrival-evidence.mjs?v=0.5.0';
import {
  createMerchantLedger,applyTradeKernelCommitToLedger,tradeReceiptFingerprint,tradeReceiptIntegrityFingerprint
} from '../src/merchant-ledger.mjs';

function give(s,a,kind){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
}
function completeHome(s,a){
  const site=houseSite(s,walkable).origin;a.x=site.x;a.y=site.y;a.task=null;
  const hammer=give(s,a,'HAMMER');s.rustPossessions.equipment.push({agentId:a.id,itemId:hammer});
  const place=(kind,socket)=>{
    const itemInstanceId=give(s,a,kind);
    const r=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId,socket,placementId:'rc4-red:'+s.tick+':'+a.id+':'+itemInstanceId});
    assert.equal(r.ok,true,JSON.stringify(r));
  };
  const {x,y}=site;
  place('WOOD_FOUNDATION',{type:'cell',x,y});
  place('WOOD_WALL',canonicalEdge(x,y,'N'));
  place('WOOD_WALL',canonicalEdge(x,y,'E'));
  place('WOOD_WALL',canonicalEdge(x,y,'W'));
  place('WOOD_DOORWAY',canonicalEdge(x,y,'S'));
  place('WOOD_ROOF',{type:'cell',x,y});
}
function preparedMerchantWorld(){
  const s=createWorld(230926),merchant=s.agents[0],other=s.agents[1];
  merchant.satiety=100;merchant.energy=100;merchant.task=null;other.task=null;
  completeHome(s,merchant);
  const market=command(s,'RC4_CREATE_MARKET',{agentId:merchant.id});assert.equal(market.ok,true,JSON.stringify(market));
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,itemKind:'STONE_AXE',unitPrice:70});assert.equal(offer.ok,true,JSON.stringify(offer));
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:merchant.id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  return {s,merchantId:merchant.id,otherId:other.id,marketId:market.marketId};
}

test('RC4 independent Red Team: non-owner cannot open or close Home Market',()=>{
  const {s,merchantId,otherId,marketId}=preparedMerchantWorld();
  const before=serialize(s);
  const spoof=command(s,'RC4_OPEN_MARKET',{agentId:otherId,marketId});
  assert.equal(spoof.ok,false);assert.equal(spoof.reason,'owner');assert.equal(serialize(s),before);
  const opened=command(s,'RC4_OPEN_MARKET',{agentId:merchantId,marketId});assert.equal(opened.ok,true,JSON.stringify(opened));
  const openedBytes=serialize(s);
  const closeSpoof=command(s,'RC4_CLOSE_MARKET',{agentId:otherId,marketId});
  assert.equal(closeSpoof.ok,false);assert.equal(closeSpoof.reason,'owner');assert.equal(serialize(s),openedBytes);
});

test('RC4 independent Red Team: copied canonical-looking Navigation task has no provenance',()=>{
  const {s,merchantId,marketId}=preparedMerchantWorld();
  assert.equal(command(s,'RC4_OPEN_MARKET',{agentId:merchantId,marketId}).ok,true);
  const customer=s.agents.find(a=>a.id!==merchantId&&a.alive);customer.task=null;
  const travel=command(s,'RC4_TRAVEL_TO_MARKET',{agentId:customer.id,marketId});assert.equal(travel.ok,true,JSON.stringify(travel));
  const projection=projectHomeMarketForTrade(s,s.homeMarkets,{marketId});assert.equal(projection.ok,true);
  const canonical=customer.task;
  customer.task=structuredClone(canonical);
  const before=serialize(s);
  const forged=verifyCanonicalMarketArrival(s,{agentId:customer.id,market:projection.market});
  assert.equal(forged.state,'VIOL');assert.equal(forged.reason,'canonical-task');assert.equal(serialize(s),before);
});

test('RC4 independent Red Team: forged receipt plus matching replay cannot mutate Ledger',()=>{
  const receipt={transactionId:'RTX:1',marketId:'M1',listingId:'L1',reservationId:'R1',buyerId:2,sellerId:1,
    itemKind:'STONE_AXE',itemInstanceId:77,itemIds:[77],quantity:1,unitPrice:100,totalPrice:100,eventId:'TRADE:RTX:1'};
  receipt.fingerprint=tradeReceiptFingerprint(receipt);
  receipt.integrityFingerprint=tradeReceiptIntegrityFingerprint(receipt);
  const result={ok:true,duplicate:false,receipt,state:{tradeReplay:{version:'RC4-trade-replay-1',receipts:[structuredClone(receipt)]}}};
  const ledger=createMerchantLedger(1),before=JSON.stringify(ledger);
  const assessed=applyTradeKernelCommitToLedger(ledger,result);
  assert.equal(assessed.state,'UNKNOWN');assert.equal(assessed.reason,'trade-commit-provenance');
  assert.equal(JSON.stringify(ledger),before);assert.equal(JSON.stringify(assessed.ledger),before);
});

test('RC4 independent Red Team: corrupt-present authority roots fail restore instead of resetting',()=>{
  for(const [key,value] of [
    ['homeMarkets',{}],['merchantListings',{}],['merchantBuyOffers',{}],['merchantReservations',{}],
    ['tradeReplay',{}],['merchantLedgers',{}]
  ]){
    const raw=JSON.parse(serialize(createWorld(99)));raw[key]=value;
    assert.throws(()=>restore(JSON.stringify(raw)),/RC4 migration failed|Invalid restored world/,key);
  }
});

test('RC4 independent Red Team: UI has no direct canonical economy writer',()=>{
  const app=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
  for(const pattern of [
    /state\.currencyWallet\s*=/,/state\.merchantLedgers\s*=/,/state\.homeMarkets\s*=/,
    /state\.merchantListings\s*=/,/state\.merchantBuyOffers\s*=/,/state\.merchantReservations\s*=/,
    /settleTradeAtomic\s*\(/,/transferRustItemInstances\s*\(/,/createReservation\s*\(/
  ])assert.equal(pattern.test(app),false,String(pattern));
  for(const forbidden of ['merchantWallet','shopWallet','merchantInventory'])assert.equal(app.includes(forbidden),false,forbidden);
  assert.ok(app.includes("command(state,'RC4_"),'UI dispatches validated engine commands');
});


test('RC4 independent Red Team: equipped item and buyer bag overflow fail in Rust authority without mutation',()=>{
  {
    const s=createWorld(501),seller=s.agents[0],buyer=s.agents[1],itemId=give(s,seller,'STONE_AXE');
    s.rustPossessions.equipment.push({agentId:seller.id,itemId});
    const before=JSON.stringify(s),x=transferRustItemInstances(s,{fromAgentId:seller.id,toAgentId:buyer.id,itemIds:[itemId]});
    assert.equal(x.ok,false);assert.equal(x.reason,'item-reserved');assert.equal(JSON.stringify(s),before);
  }
  {
    const s=createWorld(502),seller=s.agents[0],buyer=s.agents[1];
    for(let i=0;i<RUST_POSSESSION_LIMITS.bag;i++)give(s,buyer,'WOOD_WALL');
    const itemId=give(s,seller,'STONE_AXE'),before=JSON.stringify(s);
    const x=transferRustItemInstances(s,{fromAgentId:seller.id,toAgentId:buyer.id,itemIds:[itemId]});
    assert.equal(x.ok,false);assert.equal(x.reason,'bag-full');assert.equal(JSON.stringify(s),before);
  }
});

test('RC4 independent Red Team: Ledger and Career run inside staged postSettlement before live-root replacement',()=>{
  const runtime=readFileSync(new URL('../src/rc4-market-runtime.mjs',import.meta.url),'utf8');
  const post=runtime.indexOf('function postSettlementAdapter()');
  const accounting=runtime.indexOf('const accounting=applyMerchantAccounting(staged,context)',post);
  const settle=runtime.indexOf('const result=settleTradeAtomic(prepared,proposal',post);
  const reject=runtime.indexOf('if(!result.ok)return fail',settle);
  const replace=runtime.indexOf('replaceWorldRoot(world,result.state)',reject);
  assert.ok(post>=0&&accounting>post,'Ledger/Career accounting must be part of staged postSettlement');
  assert.ok(settle>post&&reject>settle&&replace>reject,'live root replacement must occur only after successful atomic settlement');
  assert.equal(runtime.slice(post,replace).includes('world.merchantLedgers='),false,'integration may not write live Ledger before root replacement');
});
