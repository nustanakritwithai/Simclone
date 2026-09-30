import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore,validate,day} from '../src/engine.mjs';
import {homeOf} from '../src/individual-housing.mjs';
import {crafterCareerSnapshot} from '../src/crafter-career.mjs';
import {getBalance,totalCurrency} from '../src/currency-wallet.mjs';

function naturalSummary(s){
  const people=(s.agents??[]).filter(a=>a.alive).map(a=>{
    const crafter=crafterCareerSnapshot(s,a);
    const ledger=s.merchantLedgers?.ledgers?.find(l=>l.merchantId===a.id)??null;
    return {
      id:a.id,name:a.name,profession:a.profession,home:homeOf(s,a.id,{completeOnly:true})?.houseId??null,
      money:getBalance(s,a.id),workDone:a.workDone,
      crafter:crafter.status==='SAT'&&crafter.best?{family:crafter.best.family,total:crafter.best.total,t2:crafter.best.counts[2],grade:crafter.best.grade}:null,
      merchant:ledger?{purchases:ledger.purchases.length,sales:ledger.sales.length,revenue:ledger.revenue,cogs:ledger.costOfGoodsSold,profit:ledger.realizedProfit}:null,
    };
  });
  return {
    seed:s.seed,tick:s.tick,day:day(s),currency:totalCurrency(s),
    people,
    markets:(s.homeMarkets?.markets??[]).map(m=>({id:m.marketId,owner:m.ownerAgentId,status:m.status,listings:m.listingIds.length,offers:m.buyOfferIds.length})),
    openListings:(s.merchantListings?.listings??[]).filter(x=>x.status==='OPEN').map(x=>({id:x.id,seller:x.sellerId,itemKind:x.itemKind,qty:x.quantity,price:x.unitPrice})),
    openOffers:(s.merchantBuyOffers?.buyOffers??[]).filter(x=>x.status==='OPEN').map(x=>({id:x.offerId,buyer:x.buyerId,itemKind:x.itemKind,qty:x.quantityWanted,price:x.unitPrice})),
    trades:(s.tradeReplay?.receipts??[]).map(r=>({id:r.transactionId,buyer:r.buyerId,seller:r.sellerId,itemKind:r.itemKind,qty:r.quantity,total:r.totalPrice,itemIds:[...(r.itemIds??[])]})),
  };
}

test('natural independent world diagnostic: 20 days, no career/trade fixtures, save/load halfway',()=>{
  let s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:6});
  const initialCurrency=totalCurrency(s);
  assert.equal(initialCurrency,600);
  step(s,3600);
  assert.deepEqual(validate(s),[]);
  s=restore(serialize(s));
  assert.deepEqual(validate(s),[]);
  step(s,3600);
  assert.deepEqual(validate(s),[]);
  assert.equal(totalCurrency(s),initialCurrency,'natural economy must conserve canonical currency');
  console.log('NATURAL_ECONOMY_20D '+JSON.stringify(naturalSummary(s)));
});
