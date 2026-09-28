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
  activeReservations:s=>s.testMarket.reservations.filter(x=>x.status==='ACTIVE'),
};
const postSettlement={
  apply:(s,{receipt})=>{
    const listing=s.testMarket.listings.find(x=>x.id===receipt.listingId);
    const reservation=s.testMarket.reservations.find(x=>x.id===receipt.reservationId);
    if(!listing||listing.status!=='OPEN'||listing.quantity<receipt.quantity||!reservation||reservation.status!=='ACTIVE')return {ok:false,reason:'market-postcondition'};
    listing.quantity-=receipt.quantity;listing.revision++;
    if(listing.quantity===0)listing.status='FILLED';
    reservation.status='COMMITTED';reservation.transactionId=receipt.transactionId;
    return {ok:true};
  },
  verify:(s,{receipt})=>{
    const listing=s.testMarket.listings.find(x=>x.id===receipt.listingId);
    const reservation=s.testMarket.reservations.find(x=>x.id===receipt.reservationId);
    return {ok:!!listing&&listing.revision===2&&listing.quantity===1&&listing.status==='OPEN'&&
      reservation?.status==='COMMITTED'&&reservation.transactionId===receipt.transactionId};
  }
};
const adapters={wallet,item,market,postSettlement};
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
  assert.equal(r.settlement.receipt.itemInstanceId,101);
});

test('RC4 atomic success moves money and exact existing item instances once',()=>{
  const s=fixture(),before=clone(s),r=settleTradeAtomic(s,proposal(),adapters);
  assert.equal(r.ok,true);assert.equal(r.duplicate,false);assert.deepEqual(s,before);
  assert.equal(r.state.testWallet[1],50);assert.equal(r.state.testWallet[2],60);
  assert.deepEqual(r.state.testItems.filter(i=>[101,102].includes(i.id)).map(i=>i.agentId),[1,1]);
  assert.equal(r.state.testItems.length,before.testItems.length);
  assert.equal(r.state.tradeReplay.receipts.length,1);
  assert.equal(r.state.tradeReplay.receipts[0].eventId,'TRADE:TX-1');
  assert.deepEqual(r.state.testMarket.listings[0],{id:'L1',marketId:'M1',status:'OPEN',revision:2,sellerId:2,itemKind:'IRON_SWORD',unitPrice:25,quantity:1});
  assert.equal(r.state.testMarket.reservations[0].status,'COMMITTED');
  assert.equal(r.state.testMarket.reservations[0].transactionId,'TX-1');
});

test('RC4 exact replay is idempotent: no second debit, credit, item move or receipt',()=>{
  const first=settleTradeAtomic(fixture(),proposal(),adapters);assert.equal(first.ok,true);
  const bytes=JSON.stringify(first.state),second=settleTradeAtomic(first.state,proposal(),adapters);
  assert.equal(second.ok,true);assert.equal(second.duplicate,true);assert.equal(second.state,first.state);
  assert.equal(JSON.stringify(second.state),bytes);assert.equal(second.state.tradeReplay.receipts.length,1);
});

test('RC4 replay survives a JSON persistence boundary and stays a full no-op',()=>{
  const first=settleTradeAtomic(fixture(),proposal(),adapters);assert.equal(first.ok,true);
  const restored=JSON.parse(JSON.stringify(first.state)),before=JSON.stringify(restored);
  const replay=settleTradeAtomic(restored,proposal(),adapters);
  assert.equal(replay.ok,true);assert.equal(replay.duplicate,true);assert.equal(replay.state,restored);
  assert.equal(JSON.stringify(restored),before);assert.equal(restored.tradeReplay.receipts.length,1);
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

test('RC4 global reservation lock rejects the same item reserved in another market',()=>rejectedWithoutMutation(s=>{
  s.testMarket.markets.push({id:'M2',open:true,x:8,y:8,tradeRange:2});
  s.testMarket.reservations.push({id:'R2',status:'ACTIVE',marketId:'M2',listingId:'L2',listingRevision:1,sellerId:2,buyerId:3,itemKind:'IRON_SWORD',unitPrice:30,quantity:1,itemIds:[102]});
},'item-reserved'));

test('RC4 fails closed when global active-reservation view omits current reservation',()=>{
  const s=fixture(),before=clone(s),incompleteMarket={...market,activeReservations:()=>[]};
  const r=settleTradeAtomic(s,proposal(),{wallet,item,market:incompleteMarket});
  assert.equal(r.ok,false);assert.equal(r.reason,'market-view-incomplete');assert.deepEqual(s,before);
});

test('RC4 fails closed when global current-reservation projection disagrees with canonical reservation lookup',()=>{
  const s=fixture(),before=clone(s);
  const incoherentMarket={...market,activeReservations:state=>state.testMarket.reservations
    .filter(x=>x.status==='ACTIVE').map(x=>x.id==='R1'?{...x,itemIds:[101,103]}:x)};
  const r=settleTradeAtomic(s,proposal(),{wallet,item,market:incoherentMarket});
  assert.equal(r.ok,false);assert.equal(r.reason,'market-view-incomplete');assert.deepEqual(s,before);
});

test('RC4 fails closed on duplicate active reservation ids in global evidence',()=>{
  const s=fixture();s.testMarket.reservations.push({...clone(s.testMarket.reservations[0])});
  const before=clone(s),r=settleTradeAtomic(s,proposal(),adapters);
  assert.equal(r.ok,false);assert.equal(r.reason,'market-view-incomplete');assert.deepEqual(s,before);
});

test('RC4 fails closed on malformed global active reservation evidence',()=>{
  const s=fixture();s.testMarket.reservations.push({id:'R2',status:'ACTIVE',marketId:'M2',itemIds:[NaN]});
  const before=clone(s),r=settleTradeAtomic(s,proposal(),adapters);
  assert.equal(r.ok,false);assert.equal(r.reason,'market-view-incomplete');assert.deepEqual(s,before);
});

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

test('RC4 replay validates committed receipt state before returning duplicate',()=>{
  const first=settleTradeAtomic(fixture(),proposal(),adapters);assert.equal(first.ok,true);
  const corrupt=clone(first.state);corrupt.tradeReplay.receipts[0].eventId='bad event';const before=clone(corrupt);
  const r=settleTradeAtomic(corrupt,proposal(),adapters);
  assert.equal(r.ok,false);assert.equal(r.reason,'replay-state');assert.deepEqual(corrupt,before);
});

test('RC4 replay rejects receipt field tampering even when stored fingerprint is unchanged',()=>{
  const fields=[
    ['buyerId',3],
    ['sellerId',3],
    ['marketId','M9'],
    ['listingId','L9'],
    ['reservationId','R9'],
    ['itemKind','OTHER_ITEM'],
    ['itemInstanceId',102],
    ['unitPrice',24],
    ['totalPrice',48],
  ];
  for(const [key,value] of fields){
    const first=settleTradeAtomic(fixture(),proposal(),adapters);assert.equal(first.ok,true);
    const corrupt=clone(first.state);corrupt.tradeReplay.receipts[0][key]=value;
    assert.deepEqual(validateTradeReplayState(corrupt),['Trade replay receipt'],key);
    const before=clone(corrupt),r=settleTradeAtomic(corrupt,proposal(),adapters);
    assert.equal(r.ok,false,key);assert.equal(r.reason,'replay-state',key);assert.deepEqual(corrupt,before,key);
  }
});

test('RC4 replay rejects itemIds tampering and requires itemInstanceId to remain represented',()=>{
  const first=settleTradeAtomic(fixture(),proposal(),adapters);assert.equal(first.ok,true);
  for(const itemIds of [[101,103],[102,103]]){
    const corrupt=clone(first.state);corrupt.tradeReplay.receipts[0].itemIds=itemIds;
    assert.deepEqual(validateTradeReplayState(corrupt),['Trade replay receipt']);
  }
});

test('RC4 maximum transaction id remains valid with deterministic TRADE event prefix',()=>{
  const tx='T'.repeat(80),p=proposal({transactionId:tx}),r=settleTradeAtomic(fixture(),p,adapters);
  assert.equal(r.ok,true);assert.equal(r.receipt.eventId,'TRADE:'+tx);
  assert.deepEqual(validateTradeReplayState(r.state),[]);
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


test('RC4 B6: missing post-settlement authority cannot return a committed candidate',()=>{
  const s=fixture(),before=JSON.stringify(s),r=settleTradeAtomic(s,proposal(),{wallet,item,market});
  assert.equal(r.ok,false);assert.equal(r.reason,'post-settlement-authority');assert.equal(JSON.stringify(s),before);
});

test('RC4 B6: post-settlement apply failure after staged money/item/receipt leaves live source byte-identical',()=>{
  const s=fixture(),before=JSON.stringify(s);
  const failing={apply:(staged)=>{
    staged.testMarket.listings[0].quantity=999;
    staged.testMarket.reservations[0].status='BROKEN';
    return {ok:false,reason:'injected-post-apply-failure'};
  },verify:()=>({ok:true})};
  const r=settleTradeAtomic(s,proposal(),{wallet,item,market,postSettlement:failing});
  assert.equal(r.ok,false);assert.equal(r.reason,'injected-post-apply-failure');assert.equal(JSON.stringify(s),before);
});

test('RC4 B6: post-settlement verify failure discards the entire staged root',()=>{
  const s=fixture(),before=JSON.stringify(s);
  const failing={apply:postSettlement.apply,verify:()=>({ok:false,reason:'injected-postcondition-failure'})};
  const r=settleTradeAtomic(s,proposal(),{wallet,item,market,postSettlement:failing});
  assert.equal(r.ok,false);assert.equal(r.reason,'injected-postcondition-failure');assert.equal(JSON.stringify(s),before);
});

test('RC4 B6: exact replay does not re-run Listing/Reservation transitions',()=>{
  const first=settleTradeAtomic(fixture(),proposal(),adapters);assert.equal(first.ok,true);
  const bytes=JSON.stringify(first.state),second=settleTradeAtomic(first.state,proposal(),adapters);
  assert.equal(second.ok,true);assert.equal(second.duplicate,true);assert.equal(JSON.stringify(second.state),bytes);
  assert.equal(second.state.testMarket.listings[0].revision,2);
  assert.equal(second.state.testMarket.reservations[0].status,'COMMITTED');
});


test('RC4 replay capacity 512 fails closed without eviction and oldest receipt stays protected',()=>{
  const s={
    tick:1,
    agents:[{id:1,alive:true,x:0,y:0},{id:2,alive:true,x:0,y:1}],
    testWallet:{1:10000,2:0},
    testItems:[],
    testMarket:{markets:[{id:'MCAP',open:true,x:0,y:0,tradeRange:3}],listings:[],reservations:[]},
    tradeReplay:createTradeReplayState(),
  };
  for(let i=0;i<513;i++){
    const itemId=1000+i,listingId='LCAP-'+i,reservationId='RCAP-'+i;
    s.testItems.push({id:itemId,kind:'IRON_SWORD',agentId:2});
    s.testMarket.listings.push({id:listingId,marketId:'MCAP',status:'OPEN',revision:1,sellerId:2,itemKind:'IRON_SWORD',unitPrice:1,quantity:1});
    s.testMarket.reservations.push({id:reservationId,status:'ACTIVE',marketId:'MCAP',listingId,listingRevision:1,sellerId:2,buyerId:1,itemKind:'IRON_SWORD',unitPrice:1,quantity:1,itemIds:[itemId]});
  }
  const capPost={
    apply:(state,{receipt})=>{
      const l=state.testMarket.listings.find(x=>x.id===receipt.listingId);
      const r=state.testMarket.reservations.find(x=>x.id===receipt.reservationId);
      if(!l||!r||l.status!=='OPEN'||r.status!=='ACTIVE')return {ok:false};
      l.quantity=0;l.revision++;l.status='FILLED';r.status='COMMITTED';r.transactionId=receipt.transactionId;
      return {ok:true};
    },
    verify:(state,{receipt})=>{
      const l=state.testMarket.listings.find(x=>x.id===receipt.listingId);
      const r=state.testMarket.reservations.find(x=>x.id===receipt.reservationId);
      return {ok:l?.status==='FILLED'&&l.revision===2&&r?.status==='COMMITTED'&&r.transactionId===receipt.transactionId};
    }
  };
  const capAdapters={wallet,item,market,postSettlement:capPost};
  let state=s,firstProposal=null;
  for(let i=0;i<512;i++){
    const p={transactionId:'TXCAP-'+i,marketId:'MCAP',sellerId:2,buyerId:1,itemKind:'IRON_SWORD',itemInstanceId:1000+i,
      quantity:1,unitPrice:1,totalPrice:1,listingId:'LCAP-'+i,reservationId:'RCAP-'+i};
    if(i===0)firstProposal=structuredClone(p);
    const r=settleTradeAtomic(state,p,capAdapters);
    assert.equal(r.ok,true,'commit '+i);state=r.state;
  }
  assert.equal(state.tradeReplay.receipts.length,512);
  const before=JSON.stringify(state);
  const p513={transactionId:'TXCAP-512',marketId:'MCAP',sellerId:2,buyerId:1,itemKind:'IRON_SWORD',itemInstanceId:1512,
    quantity:1,unitPrice:1,totalPrice:1,listingId:'LCAP-512',reservationId:'RCAP-512'};
  const rejected=settleTradeAtomic(state,p513,capAdapters);
  assert.equal(rejected.ok,false);assert.equal(rejected.reason,'replay-capacity');
  assert.equal(JSON.stringify(state),before,'513th failure must not mutate source or evict receipts');
  assert.equal(state.tradeReplay.receipts.length,512);
  assert.equal(state.tradeReplay.receipts[0].transactionId,'TXCAP-0');
  const oldest=settleTradeAtomic(state,firstProposal,capAdapters);
  assert.equal(oldest.ok,true);assert.equal(oldest.duplicate,true);assert.equal(oldest.state,state);
  assert.equal(JSON.stringify(state),before);
});
