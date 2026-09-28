import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  TRADE_KERNEL_VERSION,createTradeReplayState,validateTradeReplayState,
  validateTradeProposal,buildTradeSettlementProposal,settleTradeAtomic
} from '../src/trade-kernel.mjs';

const clone=v=>structuredClone(v);

function fixture(){
  return {
    tick:40,
    agents:[
      {id:1,alive:true,x:0,y:0},
      {id:2,alive:true,x:1,y:0},
      {id:3,alive:true,x:0,y:1},
    ],
    testWallet:{1:100,2:10,3:5},
    testItems:[
      {id:101,kind:'IRON_SWORD',agentId:2},
      {id:102,kind:'IRON_SWORD',agentId:2},
      {id:103,kind:'IRON_SWORD',agentId:2},
    ],
    testMarket:{
      markets:[{id:'M1',open:true,x:0,y:0,tradeRange:3}],
      listings:[{id:'L1',marketId:'M1',status:'OPEN',revision:1,sellerId:2,itemKind:'IRON_SWORD',unitPrice:25,quantity:3}],
      reservations:[{id:'R1',status:'ACTIVE',marketId:'M1',listingId:'L1',listingRevision:1,sellerId:2,buyerId:1,itemKind:'IRON_SWORD',unitPrice:25,quantity:2,itemIds:[101,102]}],
    },
    tradeReplay:createTradeReplayState(),
  };
}

const wallet={
  balance:(s,id)=>s.testWallet[id],
  debit:(s,id,n)=>{if(!Number.isSafeInteger(n)||n<1||s.testWallet[id]<n)return {ok:false};s.testWallet[id]-=n;return {ok:true};},
  credit:(s,id,n)=>{if(!Number.isSafeInteger(n)||n<1||!Number.isSafeInteger(s.testWallet[id]+n))return {ok:false};s.testWallet[id]+=n;return {ok:true};},
};
const item={
  tradableItemIds:(s,{agentId,itemKind})=>s.testItems.filter(i=>i.agentId===agentId&&i.kind===itemKind).map(i=>i.id).sort((a,b)=>a-b),
  transfer:(s,{fromAgentId,toAgentId,itemIds})=>{
    const ids=new Set(itemIds);
    const rows=s.testItems.filter(i=>ids.has(i.id));
    if(rows.length!==ids.size||rows.some(i=>i.agentId!==fromAgentId))return {ok:false};
    for(const row of rows)row.agentId=toAgentId;
    return {ok:true};
  },
};
const market={
  market:(s,id)=>s.testMarket.markets.find(x=>x.id===id)??null,
  listing:(s,id)=>s.testMarket.listings.find(x=>x.id===id)??null,
  reservation:(s,id)=>s.testMarket.reservations.find(x=>x.id===id)??null,
  activeReservations:(s,marketId)=>s.testMarket.reservations.filter(x=>x.marketId===marketId&&x.status==='ACTIVE'),
};
const adapters={wallet,item,market};
const proposal=(overrides={})=>({
  transactionId:'TX-1',marketId:'M1',sellerId:2,buyerId:1,itemKind:'IRON_SWORD',itemInstanceId:101,
  quantity:2,unitPrice:25,totalPrice:50,listingId:'L1',reservationId:'R1',...overrides
});

function rejectedWithoutMutation(mutator,expected,customProposal={}){
  const s=fixture();mutator?.(s);const before=clone(s);
  const r=settleTradeAtomic(s,proposal(customProposal),adapters);
  assert.equal(r.ok,false);assert.equal(r.reason,expected);assert.deepEqual(s,before);
}

test('RC4 contract builds deterministic settlement proposal',()=>{
  const s=fixture(),r=buildTradeSettlementProposal(s,proposal(),adapters);
  assert.equal(r.ok,true);assert.equal(r.settlement.version,TRADE_KERNEL_VERSION);
  assert.deepEqual(r.settlement.wallet,{debit:{agentId:1,amount:50},credit:{agentId:2,amount:50}});
  assert.deepEqual(r.settlement.items.itemIds,[101,102]);
  assert.equal(r.settlement.receipt.eventId,'TRADE:TX-1');
});

test('RC4 atomic success moves money and exact existing item instances once',()=>{
  const s=fixture(),before=clone(s),r=settleTradeAtomic(s,proposal(),adapters);
  assert.equal(r.ok,true);assert.equal(r.duplicate,false);assert.deepEqual(s,before);
  assert.equal(r.state.testWallet[1],50);assert.equal(r.state.testWallet[2],60);
  assert.deepEqual(r.state.testItems.filter(i=>[101,102].includes(i.id)).map(i=>i.agentId),[1,1]);
  assert.equal(r.state.testItems.length,before.testItems.length);
  assert.equal(r.state.tradeReplay.receipts.length,1);
  assert.equal(r.state.tradeReplay.receipts[0].eventId,'TRADE:TX-1');
});

test('RC4 exact replay is idempotent: no second debit, credit, item move or receipt',()=>{
  const first=settleTradeAtomic(fixture(),proposal(),adapters);assert.equal(first.ok,true);
  const bytes=JSON.stringify(first.state),second=settleTradeAtomic(first.state,proposal(),adapters);
  assert.equal(second.ok,true);assert.equal(second.duplicate,true);assert.equal(second.state,first.state);
  assert.equal(JSON.stringify(second.state),bytes);assert.equal(second.state.tradeReplay.receipts.length,1);
});

test('RC4 same transactionId with a different proposal is a conflict and immutable',()=>{
  const first=settleTradeAtomic(fixture(),proposal(),adapters);assert.equal(first.ok,true);
  const before=clone(first.state);
  const conflict=proposal({itemInstanceId:102});
  const r=settleTradeAtomic(first.state,conflict,adapters);
  assert.equal(r.ok,false);assert.equal(r.reason,'transaction-conflict');assert.deepEqual(first.state,before);
});

test('RC4 rejects insufficient buyer funds',()=>rejectedWithoutMutation(s=>s.testWallet[1]=49,'insufficient-funds'));
test('RC4 rejects seller missing reserved item',()=>rejectedWithoutMutation(s=>{s.testItems=s.testItems.filter(i=>i.id!==102)},'seller-item'));
test('RC4 rejects stale listing snapshot',()=>rejectedWithoutMutation(s=>s.testMarket.listings[0].revision=2,'listing-stale'));
test('RC4 rejects canceled listing',()=>rejectedWithoutMutation(s=>s.testMarket.listings[0].status='CANCELED','listing-canceled'));
test('RC4 rejects closed market',()=>rejectedWithoutMutation(s=>s.testMarket.markets[0].open=false,'market-closed'));
test('RC4 rejects invalid reservation',()=>rejectedWithoutMutation(s=>s.testMarket.reservations[0].status='CANCELED','reservation-invalid'));
test('RC4 rejects quantity zero',()=>rejectedWithoutMutation(null,'quantity',{quantity:0,totalPrice:0}));
test('RC4 rejects negative price',()=>rejectedWithoutMutation(null,'unit-price',{unitPrice:-1,totalPrice:-2}));

test('RC4 rejects NaN and Infinity monetary values',()=>{
  for(const [patch,reason] of [
    [{unitPrice:NaN},'unit-price'],[{unitPrice:Infinity},'unit-price'],[{totalPrice:NaN},'total-price'],[{totalPrice:Infinity},'total-price']
  ])rejectedWithoutMutation(null,reason,patch);
});

test('RC4 rejects fractional quantity or money',()=>{
  rejectedWithoutMutation(null,'quantity',{quantity:1.5,totalPrice:37.5});
  rejectedWithoutMutation(null,'unit-price',{unitPrice:25.5,totalPrice:51});
  rejectedWithoutMutation(null,'total-price',{totalPrice:50.5});
});

test('RC4 rejects buyer=seller',()=>rejectedWithoutMutation(null,'same-party',{buyerId:2}));
test('RC4 revalidates buyer alive at commit',()=>rejectedWithoutMutation(s=>s.agents.find(a=>a.id===1).alive=false,'buyer-dead'));
test('RC4 revalidates seller alive at commit',()=>rejectedWithoutMutation(s=>s.agents.find(a=>a.id===2).alive=false,'seller-dead'));
test('RC4 rejects totalPrice mismatch',()=>rejectedWithoutMutation(null,'total-price',{totalPrice:49}));
test('RC4 rejects buyer outside market trade range',()=>rejectedWithoutMutation(s=>{const a=s.agents.find(x=>x.id===1);a.x=20;a.y=20},'trade-range'));

test('RC4 rejects item reserved by another active reservation',()=>rejectedWithoutMutation(s=>{
  s.testMarket.reservations.push({id:'R2',status:'ACTIVE',marketId:'M1',listingId:'L2',listingRevision:1,sellerId:2,buyerId:3,itemKind:'IRON_SWORD',unitPrice:30,quantity:1,itemIds:[102]});
},'item-reserved'));

test('RC4 missing canonical wallet authority fails closed',()=>{
  const s=fixture(),before=clone(s),r=settleTradeAtomic(s,proposal(),{item,market});
  assert.equal(r.ok,false);assert.equal(r.reason,'wallet-authority');assert.deepEqual(s,before);
});

test('RC4 wallet credit failure after staged debit cannot partially mutate source state',()=>{
  const s=fixture(),before=clone(s),badWallet={...wallet,credit:()=>({ok:false})};
  const r=settleTradeAtomic(s,proposal(),{wallet:badWallet,item,market});
  assert.equal(r.ok,false);assert.equal(r.reason,'wallet-credit');assert.deepEqual(s,before);
});

test('RC4 item transfer failure after staged money mutations cannot partially mutate source state',()=>{
  const s=fixture(),before=clone(s),badItem={...item,transfer:()=>({ok:false})};
  const r=settleTradeAtomic(s,proposal(),{wallet,item:badItem,market});
  assert.equal(r.ok,false);assert.equal(r.reason,'item-transfer');assert.deepEqual(s,before);
});

test('RC4 deterministic twin state + proposal produces byte-identical next state',()=>{
  const a=settleTradeAtomic(fixture(),proposal(),adapters),b=settleTradeAtomic(fixture(),proposal(),adapters);
  assert.equal(a.ok,true);assert.equal(b.ok,true);assert.equal(JSON.stringify(a.state),JSON.stringify(b.state));
});

test('RC4 replay state validator rejects duplicate transaction receipts',()=>{
  const first=settleTradeAtomic(fixture(),proposal(),adapters);assert.equal(first.ok,true);
  const corrupt=clone(first.state);corrupt.tradeReplay.receipts.push(clone(corrupt.tradeReplay.receipts[0]));
  assert.deepEqual(validateTradeReplayState(corrupt),['Trade replay receipt']);
});

test('RC4 source has no random or wall-clock gameplay rule',()=>{
  const src=readFileSync(new URL('../src/trade-kernel.mjs',import.meta.url),'utf8');
  assert.equal(src.includes('Math.random'),false);assert.equal(src.includes('Date.now'),false);assert.equal(/new\s+Date\s*\(/.test(src),false);
});

test('RC4 validator is pure and does not mutate state',()=>{
  const s=fixture(),before=clone(s),r=validateTradeProposal(s,proposal(),adapters);
  assert.equal(r.ok,true);assert.deepEqual(s,before);
});
