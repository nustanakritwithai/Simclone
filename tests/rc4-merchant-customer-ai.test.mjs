import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RC4_CUSTOMER_MARKET_AI_VERSION,
  customerMarketDecision,
  selectKnownCustomerListing,
} from '../src/rc4-customer-market-policy.mjs';
import {
  RC4_MERCHANT_AI_VERSION,
  merchantDecision,
} from '../src/rc4-merchant-policy.mjs';

const clone=v=>JSON.parse(JSON.stringify(v));

function listing(overrides={}){
  return {
    listingId:'L1',marketId:'M1',sellerId:2,itemKind:'IRON_SWORD',itemInstanceId:201,
    quantity:1,unitPrice:20,createdTick:4,snapshotVersion:1,status:'active',...overrides,
  };
}
function knownMarket(overrides={}){
  return {marketId:'M1',homeId:'H2',ownerAgentId:2,status:'open',storefrontSocket:{x:5,y:0},...overrides};
}
function customer(overrides={}){
  const l=listing(),m=knownMarket();
  return {
    tick:10,
    agent:{id:1,alive:true,x:0,y:0},
    needs:[{needId:'need-weapon',itemKind:'IRON_SWORD',quantity:1,priority:10,purpose:'personal',fulfillment:'equip'}],
    wallet:{balance:100},
    knowledge:{knownMarkets:[m],knownListings:[l]},
    localMarkets:[{...m,listings:[l]}],
    intentJournal:[],transactionResults:[],
    ...overrides,
  };
}
function arrivedCustomer(overrides={}){
  return customer({
    agent:{id:1,alive:true,x:5,y:0},
    positionEvidence:{verified:true,source:'position-authority',agentId:1,tick:10,x:5,y:0},
    arrivalEvidence:{verified:true,source:'navigation-authority',evidenceId:'arrive-1',agentId:1,marketId:'M1',tick:10,x:5,y:0},
    ...overrides,
  });
}
function ownItem(overrides={}){
  return {id:301,kind:'IRON_SWORD',createdBy:1,createdTick:2,location:{kind:'bag',agentId:1},...overrides};
}
function merchant(overrides={}){
  const supplyListing=listing({listingId:'SUPPLY1',marketId:'M2',sellerId:3,itemInstanceId:401,unitPrice:18});
  const supplyMarket={marketId:'M2',homeId:'H3',ownerAgentId:3,status:'open',storefrontSocket:{x:8,y:0}};
  return {
    tick:20,
    agent:{id:1,alive:true,profession:'merchant',x:0,y:0},
    home:{homeId:'H1',ownerAgentId:1,valid:true,origin:{x:0,y:0}},
    market:{marketId:'MH1',homeId:'H1',ownerAgentId:1,status:'closed',storefrontSocket:{x:0,y:0},listings:[]},
    rustPossessions:{items:[]},
    wallet:{balance:100},
    knowledge:{
      localDemand:[{observationId:'D1',itemKind:'IRON_SWORD',quantityWanted:1,observedTick:19}],
      ownTransactionHistory:[],knownMarkets:[supplyMarket],knownListings:[supplyListing],
    },
    localMarkets:[],intentJournal:[],transactionResults:[],
    ...overrides,
  };
}

test('versions identify RC4 proposal-only policy modules',()=>{
  assert.equal(RC4_CUSTOMER_MARKET_AI_VERSION,'RC4-customer-market-ai-0.1');
  assert.equal(RC4_MERCHANT_AI_VERSION,'RC4-merchant-ai-0.1');
});

test('customer: no need means no purchase intent',()=>{
  const s=customer({needs:[]});
  assert.equal(customerMarketDecision(s),null);
});

test('customer: insufficient canonical wallet balance creates no valid purchase or travel intent',()=>{
  const s=customer({wallet:{balance:19}});
  assert.equal(selectKnownCustomerListing(s),null);
  assert.equal(customerMarketDecision(s),null);
});

test('customer: unknown market stays unknown even if caller leaks global market truth',()=>{
  const s=customer({knowledge:{knownMarkets:[],knownListings:[]},worldMarkets:[knownMarket()],worldListings:[listing()]});
  assert.equal(customerMarketDecision(s),null);
});

test('customer: remote buyer must create a real travel goal, never a remote purchase or teleport',()=>{
  const s=customer(),before=clone(s.agent);
  const d=customerMarketDecision(s);
  assert.equal(d.type,'CREATE_TRAVEL_GOAL');
  assert.equal(d.pathRequired,true);
  assert.equal(d.teleport,false);
  assert.equal(d.marketId,'M1');
  assert.deepEqual(s.agent,before);
});

test('customer: physical proximity without verified position and arrival evidence is still not enough to buy',()=>{
  const s=arrivedCustomer();
  delete s.positionEvidence;
  assert.equal(customerMarketDecision(s),null);
  s.positionEvidence={verified:true,agentId:1,tick:10,x:5,y:0};
  delete s.arrivalEvidence;
  assert.equal(customerMarketDecision(s),null);
});

test('customer: forged arrival evidence cannot bypass actual trade range',()=>{
  const s=customer({
    positionEvidence:{verified:true,agentId:1,tick:10,x:0,y:0},
    arrivalEvidence:{verified:true,evidenceId:'fake',agentId:1,marketId:'M1',tick:10,x:0,y:0},
  });
  const d=customerMarketDecision(s);
  assert.equal(d.type,'CREATE_TRAVEL_GOAL');
  assert.notEqual(d.type,'SUBMIT_PURCHASE');
});

test('customer: closed current market blocks purchase after arrival',()=>{
  const s=arrivedCustomer();
  s.localMarkets[0].status='closed';
  assert.equal(customerMarketDecision(s),null);
});

test('customer: closed or invalid current listing blocks purchase after arrival',()=>{
  const s=arrivedCustomer();
  s.localMarkets[0].listings[0].status='closed';
  assert.equal(customerMarketDecision(s),null);
});

test('customer: valid local evidence yields proposal only with canonical trade fields',()=>{
  const s=arrivedCustomer(),before=JSON.stringify(s);
  const d=customerMarketDecision(s);
  assert.equal(d.type,'SUBMIT_PURCHASE');
  assert.equal(d.buyerId,1);
  assert.equal(d.sellerId,2);
  assert.equal(d.marketId,'M1');
  assert.equal(d.listingId,'L1');
  assert.equal(d.itemInstanceId,201);
  assert.equal(d.totalPrice,20);
  assert.equal(d.positionEvidence.verified,true);
  assert.equal(d.arrivalEvidence.verified,true);
  assert.equal(d.authoritative,false);
  assert.equal(JSON.stringify(s),before);
});

test('customer: same snapshot always gives exactly the same decision and intent id',()=>{
  const s=arrivedCustomer();
  assert.deepEqual(customerMarketDecision(s),customerMarketDecision(clone(s)));
});

test('customer: replayed purchase intent is stable and journal suppression prevents a second trade proposal',()=>{
  const s=arrivedCustomer();
  const first=customerMarketDecision(s),replay=customerMarketDecision(clone(s));
  assert.equal(first.type,'SUBMIT_PURCHASE');
  assert.equal(replay.intentId,first.intentId);
  const journaled=clone(s);
  journaled.intentJournal.push({...first,status:'submitted'});
  const after=customerMarketDecision(journaled);
  assert.equal(after.type,'WAIT_TRANSACTION_RESULT');
  assert.equal(after.purchaseIntentId,first.intentId);
});

test('customer: waits for VERIFIED transaction result before equip/use/carry follow-up',()=>{
  const s=arrivedCustomer();
  const purchase=customerMarketDecision(s);
  const pending=clone(s);
  pending.intentJournal.push({...purchase,status:'submitted'});
  pending.transactionResults.push({intentId:purchase.intentId,transactionId:'T1',buyerId:1,needId:'need-weapon',purpose:'personal',itemKind:'IRON_SWORD',itemInstanceId:201,quantity:1,status:'pending',outcome:'pending',tick:11});
  assert.equal(customerMarketDecision(pending).type,'WAIT_TRANSACTION_RESULT');

  const committed=clone(s);
  committed.transactionResults.push({intentId:purchase.intentId,transactionId:'T1',buyerId:1,needId:'need-weapon',purpose:'personal',itemKind:'IRON_SWORD',itemInstanceId:201,quantity:1,verificationStatus:'VERIFIED',outcome:'COMMITTED',commitTick:11});
  const follow=customerMarketDecision(committed);
  assert.equal(follow.type,'EQUIP_PURCHASED_ITEM');
  assert.equal(follow.transactionId,'T1');
  assert.equal(follow.itemInstanceId,201);
});

test('customer: dead agent never buys or travels',()=>{
  const s=arrivedCustomer({agent:{id:1,alive:false,x:5,y:0}});
  assert.equal(customerMarketDecision(s),null);
});

test('merchant: dead or non-merchant agent never buys, lists or opens a market',()=>{
  assert.equal(merchantDecision(merchant({agent:{id:1,alive:false,profession:'merchant',x:0,y:0}})),null);
  assert.equal(merchantDecision(merchant({agent:{id:1,alive:true,profession:'crafter',x:0,y:0}})),null);
});

test('merchant: only a canonical Rust-owned item can become a listing proposal',()=>{
  const noStock=merchant();
  const d0=merchantDecision(noStock);
  assert.notEqual(d0?.type,'PROPOSE_LISTING');

  const withStock=merchant({rustPossessions:{items:[ownItem()]}});
  const d1=merchantDecision(withStock);
  assert.equal(d1.type,'PROPOSE_LISTING');
  assert.equal(d1.itemInstanceId,301);
  assert.equal(d1.quantity,1);
  assert.equal(d1.authoritative,false);
  assert.equal(d1.unitPrice,undefined,'pricing remains delegated to pricing/ledger authority');
});

test('merchant: stock away from home creates a path-required return-home goal before listing',()=>{
  const s=merchant({agent:{id:1,alive:true,profession:'merchant',x:3,y:0},rustPossessions:{items:[ownItem()]}});
  const d=merchantDecision(s);
  assert.equal(d.type,'CREATE_TRAVEL_GOAL');
  assert.equal(d.purpose,'return-stock-home');
  assert.equal(d.pathRequired,true);
  assert.equal(d.teleport,false);
  assert.deepEqual(d.target,{x:0,y:0});
});

test('merchant: listing proposal uses only allowed local/observed/own-history pricing evidence',()=>{
  const s=merchant({
    rustPossessions:{items:[ownItem()]},
    globalPriceOracle:{IRON_SWORD:999999},
    knowledge:{
      localDemand:[{observationId:'D1',itemKind:'IRON_SWORD',quantityWanted:1,observedTick:19}],
      ownTransactionHistory:[{transactionId:'OLD-SALE',side:'seller',status:'VERIFIED',itemKind:'IRON_SWORD',itemInstanceId:999,quantity:1,unitPrice:22,commitTick:18}],
      knownMarkets:[{marketId:'M9',homeId:'H9',ownerAgentId:9,status:'open',storefrontSocket:{x:7,y:0}}],
      knownListings:[listing({listingId:'SEEN',marketId:'M9',sellerId:9,itemInstanceId:900,unitPrice:25})],
    },
  });
  const d=merchantDecision(s);
  assert.equal(d.type,'PROPOSE_LISTING');
  assert.deepEqual(d.pricingRequest.evidence.allowedSources,['own-transaction-history','observed-market','local-demand']);
  assert.ok(d.pricingRequest.evidence.ownTransactionIds.includes('OLD-SALE'));
  assert.ok(d.pricingRequest.evidence.observedListingIds.includes('SEEN'));
  assert.equal(JSON.stringify(d).includes('999999'),false);
});

test('merchant: global market leak does not change restock choice; only known markets are considered',()=>{
  const base=merchant();
  const withLeak=clone(base);
  withLeak.globalMarkets=[{marketId:'CHEAP',status:'open',storefrontSocket:{x:1,y:0}}];
  withLeak.globalListings=[listing({listingId:'CHEAP-L',marketId:'CHEAP',sellerId:99,unitPrice:1})];
  assert.deepEqual(merchantDecision(withLeak),merchantDecision(base));
});

test('merchant: shortage creates one bounded known-market restock travel intent, not stock mutation',()=>{
  const s=merchant(),before=JSON.stringify(s);
  const d=merchantDecision(s);
  assert.equal(d.type,'CREATE_TRAVEL_GOAL');
  assert.equal(d.role,'merchant');
  assert.equal(d.purpose,'restock');
  assert.equal(d.restockCycleKey.includes('D1'),true);
  assert.equal(d.pathRequired,true);
  assert.equal(JSON.stringify(s),before);
});

test('merchant: restock replay is deterministic and a submitted purchase blocks infinite repeat restock',()=>{
  const remote=merchant();
  const travelA=merchantDecision(remote),travelB=merchantDecision(clone(remote));
  assert.deepEqual(travelA,travelB);

  const atSupplier=merchant({
    agent:{id:1,alive:true,profession:'merchant',x:8,y:0},
    positionEvidence:{verified:true,agentId:1,tick:20,x:8,y:0},
    arrivalEvidence:{verified:true,evidenceId:'arrive-m2',agentId:1,marketId:'M2',tick:20,x:8,y:0},
    localMarkets:[{marketId:'M2',homeId:'H3',ownerAgentId:3,status:'open',storefrontSocket:{x:8,y:0},listings:[listing({listingId:'SUPPLY1',marketId:'M2',sellerId:3,itemInstanceId:401,unitPrice:18})]}],
  });
  const buy=merchantDecision(atSupplier);
  assert.equal(buy.type,'SUBMIT_PURCHASE');
  assert.equal(buy.quantity,1);
  assert.equal(buy.purpose,'restock');
  const replay=merchantDecision(clone(atSupplier));
  assert.equal(replay.intentId,buy.intentId);

  const recorded=clone(atSupplier);
  recorded.intentJournal.push({...buy,status:'submitted'});
  const held=merchantDecision(recorded);
  assert.equal(held.type,'WAIT_RESTOCK');
  assert.equal(held.restockCycleKey,buy.restockCycleKey);
});

test('merchant: verified restock must materialize in canonical Rust authority before any listing',()=>{
  const s=merchant({
    transactionResults:[{transactionId:'T-R1',buyerId:1,purpose:'restock',itemKind:'IRON_SWORD',itemInstanceId:501,quantity:1,verificationStatus:'VERIFIED',outcome:'COMMITTED',commitTick:20,restockCycleKey:'cycle'}],
  });
  const d=merchantDecision(s);
  assert.equal(d.type,'WAIT_TRANSACTION_MATERIALIZATION');
  assert.equal(d.itemInstanceId,501);
});

test('merchant: verified restock item must physically return home before listing',()=>{
  const result={transactionId:'T-R1',buyerId:1,purpose:'restock',itemKind:'IRON_SWORD',itemInstanceId:501,quantity:1,verificationStatus:'VERIFIED',outcome:'COMMITTED',commitTick:20,restockCycleKey:'cycle'};
  const item=ownItem({id:501});
  const away=merchant({agent:{id:1,alive:true,profession:'merchant',x:8,y:0},rustPossessions:{items:[item]},transactionResults:[result]});
  assert.equal(merchantDecision(away).purpose,'return-stock-home');
  const home=merchant({rustPossessions:{items:[item]},transactionResults:[result]});
  assert.equal(merchantDecision(home).type,'PROPOSE_LISTING');
});

test('merchant: market opens only after a real active listing exists',()=>{
  const item=ownItem();
  const s=merchant({
    rustPossessions:{items:[item]},
    market:{marketId:'MH1',homeId:'H1',ownerAgentId:1,status:'closed',storefrontSocket:{x:0,y:0},listings:[{listingId:'OWN-L1',marketId:'MH1',sellerId:1,itemKind:'IRON_SWORD',itemInstanceId:301,quantity:1,unitPrice:30,status:'active'}]},
  });
  const d=merchantDecision(s);
  assert.equal(d.type,'OPEN_MARKET');
  assert.equal(d.marketId,'MH1');
});

test('merchant: same snapshot gives same decision and policy never mutates authorities',()=>{
  const s=merchant(),before=JSON.stringify(s);
  const a=merchantDecision(s),b=merchantDecision(clone(s));
  assert.deepEqual(a,b);
  assert.equal(JSON.stringify(s),before);
});
