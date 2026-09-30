import test from 'node:test';
import assert from 'node:assert/strict';

import {command,step,serialize,restore,validate,pathTo,walkable} from '../src/engine.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {recipeMastery} from '../src/craft-recipe-knowledge.mjs';
import {projectHomeMarketForTrade} from '../src/home-market.mjs';
import {observeRc4Markets} from '../src/rc4-market-observation.mjs';
import {getBalance,totalCurrency} from '../src/currency-wallet.mjs';
import {merchantAutonomySnapshot} from '../src/rc4-merchant-policy.mjs';
import {projectActorObservedDemand} from '../src/economic-demand.mjs';
import {rc2World,craftFixtureItem} from './fixtures/rc2-world.mjs';
import {
  ER6_CRAFTER_MARKET_SUPPLY_VERSION,crafterMarketSupplySnapshot
} from '../src/er6-crafter-market-supply.mjs';

const live=(s,id)=>s.agents.find(a=>a.id===id);
const calm=(...rows)=>{for(const a of rows){a.hp=a.satiety=a.energy=100;a.task=null;a.moveTick=0;}};

function freeBagSlot(s,a){
  const equipped=new Set((s.rustPossessions.equipment??[]).filter(e=>e.agentId===a.id).map(e=>e.itemId));
  const item=s.rustPossessions.items.filter(i=>i.location?.kind==='bag'&&i.location.agentId===a.id&&!equipped.has(i.id)).sort((x,y)=>x.id-y.id)[0];
  assert.ok(item);item.location={kind:'drop',sourceAgentId:a.id,tick:s.tick,x:a.x,y:a.y};
}

function qualifiedCrafter(s,a){
  assert.equal(adoptProfession(a,'BUILD',s.tick).changed,true);
  Object.assign(resourceStock(s,a),{food:900,wood:900,stone:900,ironIngot:120,steelIngot:90});
  calm(a);
  craftFixtureItem(s,a,'HAMMER');
  craftFixtureItem(s,a,'HAMMER_T2');
  craftFixtureItem(s,a,'HAMMER');
  craftFixtureItem(s,a,'HAMMER_T2');
  craftFixtureItem(s,a,'HAMMER');
  assert.equal(recipeMastery(a,'HAMMER'),4);
  assert.equal(recipeMastery(a,'HAMMER_T2'),2);
  const promoted=command(s,'RC5_BECOME_CRAFTER',{agentId:a.id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  freeBagSlot(s,a);calm(a);
  return a;
}

function merchantMarket(s,a){
  calm(a);
  const made=command(s,'RC4_CREATE_MARKET',{agentId:a.id});assert.equal(made.ok,true,JSON.stringify(made));
  const initialOffer=command(s,'RC4_CREATE_BUY_OFFER',{agentId:a.id,itemKind:'STONE_PICKAXE',unitPrice:40});
  assert.equal(initialOffer.ok,true,JSON.stringify(initialOffer));
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:a.id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  assert.equal(command(s,'RC4_OPEN_MARKET',{agentId:a.id,marketId:made.marketId}).ok,true);
  const p=projectHomeMarketForTrade(s,s.homeMarkets,{marketId:made.marketId});assert.equal(p.ok,true,JSON.stringify(p));
  return {marketId:made.marketId,offerId:initialOffer.offerId,point:p.market};
}

function reachableStart(s,agent,target,minDistance=3){
  for(let r=minDistance;r<12;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    const p={x:target.x+dx,y:target.y+dy};
    if(Math.abs(dx)+Math.abs(dy)<minDistance||!walkable(s,p.x,p.y))continue;
    const path=pathTo(s,p,target);
    if(Array.isArray(path)&&path.length>=minDistance){agent.x=p.x;agent.y=p.y;agent.task=null;return p;}
  }
  return null;
}

function handoffDebug(s,f){
  const merchant=live(s,f.merchantId),crafter=live(s,f.crafterId);
  const listing=s.merchantListings.listings.find(l=>l.buyOfferId===f.offerId&&l.sellerId===f.crafterId)??null;
  const offer=s.merchantBuyOffers.buyOffers.find(o=>o.offerId===f.offerId)??null;
  const projection=projectActorObservedDemand(s,merchant);
  return {
    tick:s.tick,
    item:s.rustPossessions.items.find(x=>x.id===f.itemId)??null,
    listing,offer,
    merchant:{id:merchant.id,x:merchant.x,y:merchant.y,task:merchant.task,balance:getBalance(s,merchant.id),decision:merchantAutonomySnapshot(s,merchant)},
    crafter:{id:crafter.id,x:crafter.x,y:crafter.y,task:crafter.task,balance:getBalance(s,crafter.id)},
    demand:projection.status==='SAT'?projection.signals.find(x=>x.itemKind==='STONE_PICKAXE')??null:projection
  };
}

function setup(){
  const s=rc2World(),merchant=s.agents[0],crafter=qualifiedCrafter(s,s.agents[1]);
  const market=merchantMarket(s,merchant);
  // This focused slice proves the Crafter's autonomous market journey. Keep the
  // Merchant at its canonical storefront so an unrelated return-home route cannot
  // turn a supply-handoff proof into a navigation-fixture failure.
  merchant.x=market.point.x;merchant.y=market.point.y;merchant.task=null;observeRc4Markets(s);
  // The product itself is created by the released crafting authority after the
  // Crafter profession exists; no fixture mint supplies the item under test.
  const item=craftFixtureItem(s,crafter,'STONE_PICKAXE');calm(crafter,live(s,merchant.id));
  crafter.x=market.point.x;crafter.y=market.point.y;observeRc4Markets(s);
  assert.ok(reachableStart(s,crafter,market.point));
  return {s,merchantId:merchant.id,crafterId:crafter.id,itemId:item.id,...market};
}

test('ER6 Crafter supply projection is read-only and uses only observed physical BuyOffer demand',()=>{
  const f=setup(),s=f.s,c=live(s,f.crafterId),before=serialize(s);
  assert.equal(ER6_CRAFTER_MARKET_SUPPLY_VERSION,'ER6-crafter-market-supply/1');
  const snap=crafterMarketSupplySnapshot(s,c);
  assert.equal(snap.status,'SAT');assert.equal(snap.type,'TRAVEL_TO_MARKET');
  assert.equal(snap.offerId,f.offerId);assert.equal(snap.itemId,f.itemId);
  assert.equal(serialize(s),before);

  c.rc4MarketKnowledge.knownBuyOffers=[];
  const hidden=crafterMarketSupplySnapshot(s,c);
  assert.equal(hidden.status,'IDLE');assert.equal(hidden.reason,'no-observed-physical-buy-offer');
});

test('ER6 Crafter autonomously walks to observed BuyOffer, exposes exact crafted item and Merchant settles canonically',()=>{
  const f=setup();let s=f.s;
  const totalBefore=totalCurrency(s),sellerBefore=getBalance(s,f.crafterId),buyerBefore=getBalance(s,f.merchantId);
  let sawJourney=false,sawListing=false,settled=false;
  for(let i=0;i<240&&!settled;i++){
    step(s,1);
    const crafter=live(s,f.crafterId);
    if(crafter.task?.rc4MarketTravel)sawJourney=true;
    const listing=s.merchantListings.listings.find(l=>l.buyOfferId===f.offerId&&l.sellerId===f.crafterId);
    if(listing)sawListing=true;
    const item=s.rustPossessions.items.find(x=>x.id===f.itemId);
    settled=item?.location?.kind==='bag'&&item.location.agentId===f.merchantId;
  }
  assert.equal(sawJourney,true);
  assert.equal(sawListing,true);
  assert.equal(settled,true,JSON.stringify(handoffDebug(s,f)));
  assert.equal(s.rustPossessions.items.filter(x=>x.id===f.itemId).length,1);
  assert.equal(getBalance(s,f.crafterId),sellerBefore+40);
  assert.equal(getBalance(s,f.merchantId),buyerBefore-40);
  assert.equal(totalCurrency(s),totalBefore);
  const receipt=s.tradeReplay.receipts.find(r=>r.buyerId===f.merchantId&&r.sellerId===f.crafterId&&r.itemIds?.includes(f.itemId));
  assert.ok(receipt,'verified trade receipt');
  const ledger=s.merchantLedgers.ledgers.find(l=>l.merchantId===f.merchantId);
  assert.ok(ledger.purchases.some(p=>p.transactionId===receipt.transactionId&&p.remainingItemIds.includes(f.itemId)));
  assert.deepEqual(validate(s),[]);
});

test('ER6 Crafter supply journey save/load safely loses ephemeral provenance and replans without duplicate Listing',()=>{
  const f=setup();let s=f.s;
  step(s,1);
  assert.ok(live(s,f.crafterId).task?.rc4MarketTravel);
  s=restore(serialize(s));
  let settled=false;
  for(let i=0;i<260&&!settled;i++){
    step(s,1);
    const item=s.rustPossessions.items.find(x=>x.id===f.itemId);
    settled=item?.location?.kind==='bag'&&item.location.agentId===f.merchantId;
  }
  assert.equal(settled,true,JSON.stringify(handoffDebug(s,f)));
  const rows=s.merchantListings.listings.filter(l=>l.buyOfferId===f.offerId&&l.sellerId===f.crafterId);
  assert.equal(rows.length,1,'restore must not duplicate the BuyOffer-bound Listing');
  assert.equal(s.tradeReplay.receipts.filter(r=>r.listingId===rows[0].id).length,1);
  assert.deepEqual(validate(s),[]);
});
