import {createWorld,step,serialize,restore,validate,day} from '../src/engine.mjs';
import {homeOf} from '../src/individual-housing.mjs';
import {crafterCareerSnapshot} from '../src/crafter-career.mjs';
import {getBalance,totalCurrency} from '../src/currency-wallet.mjs';

const seedArg=Number(process.argv[2]??230926),ticksArg=Number(process.argv[3]??7200);
if(!Number.isSafeInteger(seedArg)||seedArg<0||!Number.isSafeInteger(ticksArg)||ticksArg<720||ticksArg>100000)throw new Error('Usage: node scripts/career-economy-natural-diagnostic.mjs [seed] [ticks>=720]');
const seed=seedArg>>>0,half=Math.floor(ticksArg/2);

function summary(s){
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

let s=createWorld(seed,{mode:'independent',worldProfile:'same-world',population:6});
const initialCurrency=totalCurrency(s);
step(s,half);
let errors=validate(s);if(errors.length)throw new Error('mid-run validation: '+JSON.stringify(errors));
s=restore(serialize(s));
errors=validate(s);if(errors.length)throw new Error('restore validation: '+JSON.stringify(errors));
step(s,ticksArg-half);
errors=validate(s);if(errors.length)throw new Error('final validation: '+JSON.stringify(errors));
if(totalCurrency(s)!==initialCurrency)throw new Error('currency conservation');
console.log('NATURAL_ECONOMY_DIAGNOSTIC '+JSON.stringify(summary(s)));
