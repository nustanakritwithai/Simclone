/** Full authoritative-root failure matrix. The sale item is crafted by the real Rust authority. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {command,step,serialize,restore,capacity,validate} from '../src/engine.mjs';
import {productionMarketFixture,commitRealTrades} from './fixtures/rc4-production-world.mjs';
import {createReservation,reservationById,globalActiveReservations} from '../src/merchant-reservation.mjs?v=0.5.0';
import {projectHomeMarketForTrade} from '../src/home-market.mjs?v=0.5.0';
import {createTradeWalletAdapter} from '../src/trade-wallet-adapter.mjs?v=0.5.0';
import {rustTradeItemAdapter} from '../src/trade-rust-adapter.mjs?v=0.5.0';
import {advanceCraft} from '../src/rust-possessions.mjs';
import {settleTradeAtomic} from '../src/trade-kernel.mjs?v=0.5.0';
const must=r=>{assert.equal(r.ok,true,JSON.stringify(r));return r;};
function ready(){
  const f=productionMarketFixture(),w=f.world;
  must(command(w,'RC4_TRAVEL_TO_MARKET',{agentId:f.merchantId,marketId:f.marketId}));
  for(let i=0;i<500&&w.agents.find(a=>a.id===f.merchantId).task?.path.length;i++)step(w,1);
  const listing=w.merchantListings.listings.find(l=>l.id===f.listingId);
  const reserved=createReservation(w,w.merchantReservations,{listing,listingRevision:listing.revision,buyerId:f.merchantId,itemIds:[f.itemId],createdTick:w.tick});
  assert.equal(reserved.state,'SAT');w.merchantReservations=reserved.reservationState;
  const proposal={transactionId:'TX:canonical-atomic',marketId:f.marketId,listingId:f.listingId,reservationId:reserved.reservation.id,buyerId:f.merchantId,sellerId:f.producerId,itemKind:listing.itemKind,itemInstanceId:f.itemId,quantity:1,unitPrice:listing.unitPrice,totalPrice:listing.unitPrice};
  const adapters={wallet:createTradeWalletAdapter({transactionId:proposal.transactionId,fromAgentId:proposal.buyerId,toAgentId:proposal.sellerId,amount:proposal.totalPrice,evidence:{marketId:f.marketId,listingId:f.listingId,reservationId:reserved.reservation.id}}),item:rustTradeItemAdapter,
    market:{market:(s,id)=>{const r=projectHomeMarketForTrade(s,s.homeMarkets,{marketId:id});return r.ok?r.market:null;},listing:(s,id)=>s.merchantListings.listings.find(l=>l.id===id),reservation:(s,id)=>reservationById(s.merchantReservations,id),activeReservations:s=>globalActiveReservations(s.merchantReservations)},
    postSettlement:{apply:()=>{throw new Error('validation failure must not reach settlement postconditions');},verify:()=>false}};
  return {...f,proposal,adapters};
}
const failures=[
 ['insufficient money',f=>{f.world.currencyWallet.accounts.find(a=>a.agentId===f.merchantId).balance=0;}],
 ['wallet validation corruption',f=>{f.world.currencyWallet.accounts.find(a=>a.agentId===f.merchantId).balance=-1;}],
 ['wallet transfer rejection',f=>{f.adapters.wallet={...f.adapters.wallet,credit:()=>({ok:false,reason:'injected-transfer'})};}],
 ['item missing',f=>{f.world.rustPossessions.items=f.world.rustPossessions.items.filter(i=>i.id!==f.itemId);}],
 ['item equipped/nontradable',f=>{f.world.rustPossessions.equipment.push({agentId:f.producerId,itemId:f.itemId});}],
 ['item transfer rejection',f=>{f.adapters.item={...f.adapters.item,transfer:()=>({ok:false,reason:'injected-transfer'})};}],
 ['seller dead',f=>{f.world.agents.find(a=>a.id===f.producerId).alive=false;}],
 ['buyer dead',f=>{f.world.agents.find(a=>a.id===f.merchantId).alive=false;}],
 ['listing stale',f=>{f.world.merchantListings.listings.find(l=>l.id===f.listingId).revision++;}],
 ['reservation stale',f=>{f.world.merchantReservations.reservations[0].listingRevision++;}],
 ['duplicate reservation id',f=>{f.world.merchantReservations.reservations.push(structuredClone(f.world.merchantReservations.reservations[0]));}],
 ['incomplete global reservation view',f=>{f.adapters.market={...f.adapters.market,activeReservations:()=>[]};}],
 ['market closed',f=>{must(command(f.world,'RC4_CLOSE_MARKET',{agentId:f.merchantId,marketId:f.marketId}));}],
 ['buyer outside range',f=>{const a=f.world.agents.find(a=>a.id===f.merchantId);a.x=29;a.y=25;}]
];
for(const [name,attack] of failures)test('P11 canonical full-root rejection: '+name,()=>{
 const f=ready();attack(f);const before=serialize(f.world);
 const result=settleTradeAtomic(f.world,f.proposal,f.adapters);
 assert.equal(result.ok,false,name+': '+JSON.stringify(result));
 assert.notEqual(result.reason,'settlement-exception','rejection must occur before postconditions');
 assert.equal(serialize(f.world),before,'Wallet, item, Listing, Reservation, Trade, Ledger and Career must all stay byte-identical');
});
for(const otherMarket of [false,true])test('P11 canonical Reservation rejects overlap '+(otherMarket?'cross-market':'same-market')+' without any root mutation',()=>{
 const f=ready(),w=f.world,l=w.merchantListings.listings.find(l=>l.id===f.listingId),before=serialize(w);
 const attempted=createReservation(w,w.merchantReservations,{listing:{...l,id:otherMarket?'L:cross-market':l.id,marketId:otherMarket?'M:cross-market':l.marketId},listingRevision:l.revision,buyerId:f.customerId,itemIds:[f.itemId],createdTick:w.tick});
 assert.equal(attempted.state,'VIOL');assert.equal(attempted.reason,'item-reserved');assert.equal(serialize(w),before);
});
test('P11 canonical Rust bag overflow rejects settlement with no partial canonical mutation',()=>{
 const f=ready(),w=f.world,buyer=w.agents.find(a=>a.id===f.merchantId);
 // Fill the bag through actual crafting; the original traded item is untouched.
 while(w.rustPossessions.items.filter(i=>i.location?.kind==='bag'&&i.location.agentId===buyer.id).length<4){
   must(command(w,'CRAFT_ITEM',{agentId:buyer.id,recipeId:'WOOD_WALL'}));
   let made;
   for(let i=0;i<80&&!made?.completed;i++){w.tick++;made=advanceCraft(w,buyer.id);}
   assert.equal(made?.completed,true,'canonical filler craft');
 }
 assert.equal(w.rustPossessions.items.filter(i=>i.location?.kind==='bag'&&i.location.agentId===buyer.id).length,4);
 const before=serialize(w),r=settleTradeAtomic(w,f.proposal,f.adapters);
 assert.equal(r.ok,false);assert.equal(r.reason,'item-transfer');assert.equal(serialize(w),before);
});
test('P1 canonical produced item survives save/load before any trade with unchanged provenance',()=>{
 const f=productionMarketFixture(),before=f.world.rustPossessions.items.find(i=>i.id===f.itemId);
 const restored=restore(serialize(f.world)),after=restored.rustPossessions.items.find(i=>i.id===f.itemId);
 assert.deepEqual(after,before);assert.equal(after.createdBy,f.producerId);
 assert.equal(restored.rustPossessions.items.filter(i=>i.id===f.itemId).length,1);
});
test('P2 actual market component creates no second house, capacity, Wallet or item authority',()=>{
 const f=productionMarketFixture(),w=f.world,homeState=serialize({rustStations:w.rustStations,buildings:w.buildings}),beforeCapacity=capacity(w);
 const before=serialize(w),replay=command(w,'RC4_CREATE_MARKET',{agentId:f.merchantId});
 assert.equal(replay.ok,true);assert.equal(replay.duplicate,true);assert.equal(serialize(w),before);
 assert.equal(capacity(w),beforeCapacity);assert.equal(serialize({rustStations:w.rustStations,buildings:w.buildings}),homeState);
 const market=w.homeMarkets.markets.find(m=>m.marketId===f.marketId);
 for(const key of ['wallet','currencyWallet','balance','inventory','items','rustPossessions'])assert.equal(Object.hasOwn(market,key),false,key);
});
test('P12 canonical dead identity keeps money and accounting continuity after restore',()=>{
 const f=productionMarketFixture();commitRealTrades(f,1);const w=f.world,a=w.agents.find(a=>a.id===f.merchantId);
 const wallet=serialize(w.currencyWallet),ledger=serialize(w.merchantLedgers);
 a.satiety=0;a.hp=.1;step(w,1);assert.equal(w.agents.find(x=>x.id===a.id).alive,false);
 const restored=restore(serialize(w));
 assert.equal(serialize(restored.currencyWallet),wallet);assert.equal(serialize(restored.merchantLedgers),ledger);
 assert.deepEqual(validate(restored),[]);
});
