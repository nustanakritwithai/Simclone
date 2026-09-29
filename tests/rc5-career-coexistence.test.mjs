/** Cross-career regression. Items, home and mastery are prepared through the
 * existing RC2 fixture/craft authority, never by assigning a Crafter profession.
 * Initial stocks are fixture setup, not a claim of autonomous resource production.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,serialize,restore,validate} from '../src/engine.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {addMaterialSet} from '../src/material-economy.mjs';
import {autonomousMerchantEntryCandidate,stepRc4Economy,rc4MarketReadModel,RC4_MERCHANT_AUTONOMY_RULES} from '../src/rc4-market-runtime.mjs';
import {craftFixtureItem,craftFixtureTable,craftFixtureHome} from './fixtures/rc2-world.mjs';

function crafterFixture(){
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:2});
  for(const person of s.agents){
    Object.assign(resourceStock(s,person),{food:500,wood:500,stone:500});
    person.hp=person.satiety=person.energy=100;person.task=null;
    craftFixtureTable(s,person);craftFixtureHome(s,person);
  }
  // The worker has real tradable stock and enough free bag space to buy output.
  craftFixtureItem(s,s.agents[0],'STONE_AXE');
  const a=s.agents[1];
  assert.equal(adoptProfession(a,'BUILD',s.tick).changed,true);
  Object.assign(resourceStock(s,a),{food:500,wood:500,stone:500});
  assert.equal(addMaterialSet(s,a,{ironIngot:30,steelIngot:30}).ok,true);
  for(const recipe of ['HAMMER','HAMMER_T2','HAMMER','HAMMER_T2','HAMMER'])craftFixtureItem(s,a,recipe);
  assert.equal(command(s,'RC5_BECOME_CRAFTER',{agentId:a.id}).ok,true);
  assert.equal(a.profession,'crafter');
  s.tick=Math.ceil(s.tick/RC4_MERCHANT_AUTONOMY_RULES.cadenceTicks)*RC4_MERCHANT_AUTONOMY_RULES.cadenceTicks;
  assert.deepEqual(validate(s),[]);
  return {s,a};
}

test('Crafter must never qualify as a Merchant or become its bootstrap candidate',()=>{
  const {s,a}=crafterFixture();
  // The other actor is not a candidate in this negative control.
  s.agents[0].profession='adventurer';s.agents[0].career=[{tick:s.tick,profession:'adventurer'}];s.agents[0].professionSinceTick=s.tick;
  const before=serialize(s);
  const view=rc4MarketReadModel(s,a.id);
  assert.equal(view.qualification.qualified,false,'read model must respect the actual profession lock');
  assert.equal(autonomousMerchantEntryCandidate(s),null,'do not nominate a locked Crafter');
  assert.equal(serialize(s),before,'qualification projection must not write state');
});

test('autonomous Merchant entry does not create a phantom Home Market for a Crafter',()=>{
  const {s,a}=crafterFixture();
  s.agents[0].profession='adventurer';s.agents[0].career=[{tick:s.tick,profession:'adventurer'}];s.agents[0].professionSinceTick=s.tick;
  const before=serialize(s);
  assert.equal(stepRc4Economy(s),null);
  assert.equal(s.homeMarkets.markets.some(m=>m.ownerAgentId===a.id),false);
  assert.equal(serialize(s),before,'failed/absent career entry must not prepare a store');
});

test('explicit Merchant preparation and qualification reject Crafter without mutation',()=>{
  const {s,a}=crafterFixture();
  for(const type of ['RC4_CREATE_MARKET','RC4_BECOME_MERCHANT']){
    const before=serialize(s),r=command(s,type,{agentId:a.id});
    assert.equal(r.ok,false,type);assert.equal(serialize(s),before,type+' mutated rejected state');
  }
});

test('an eligible worker still becomes Merchant while the real Crafter stays a Crafter',()=>{
  const {s,a}=crafterFixture(),worker=s.agents[0];
  const candidate=autonomousMerchantEntryCandidate(s);
  assert.ok(candidate);assert.equal(candidate.agentId,worker.id);
  const history=JSON.stringify(a.career),result=stepRc4Economy(s);
  assert.equal(result?.changed,true);assert.equal(worker.profession,'merchant');
  assert.equal(a.profession,'crafter');assert.equal(JSON.stringify(a.career),history);
  assert.equal(s.homeMarkets.markets.length,1);assert.equal(s.homeMarkets.markets[0].ownerAgentId,worker.id);
  const loaded=restore(serialize(s));
  assert.equal(loaded.agents.find(x=>x.id===a.id).profession,'crafter');
  assert.equal(loaded.agents.find(x=>x.id===worker.id).profession,'merchant');
  assert.deepEqual(validate(loaded),[]);
});

test('Crafter sells its real quality item through a Merchant BuyOffer without becoming Merchant',async()=>{
  const {s,a}=crafterFixture(),merchant=s.agents[0];
  const {travelAndBuy}=await import('./fixtures/rc4-production-world.mjs');
  const {totalCurrency,getBalance}=await import('../src/currency-wallet.mjs');
  const entry=stepRc4Economy(s);assert.equal(entry?.agentId,merchant.id);
  const market=s.homeMarkets.markets.find(m=>m.ownerAgentId===merchant.id);
  assert.equal(command(s,'RC4_OPEN_MARKET',{agentId:merchant.id,marketId:market.marketId}).ok,true);
  const equipped=new Set(s.rustPossessions.equipment.map(e=>e.itemId));
  const item=s.rustPossessions.items.find(i=>i.createdBy===a.id&&i.kind==='HAMMER'&&i.craft&&i.location?.kind==='bag'&&i.location.agentId===a.id&&!equipped.has(i.id));
  assert.ok(item,'item must come from actual earlier crafting');
  const identity={id:item.id,createdBy:item.createdBy,craft:structuredClone(item.craft)};
  const currencyBefore=totalCurrency(s),sellerBefore=getBalance(s,a.id),buyerBefore=getBalance(s,merchant.id);
  const offer=command(s,'RC4_CREATE_BUY_OFFER',{agentId:merchant.id,itemKind:'HAMMER',unitPrice:2});assert.equal(offer.ok,true,JSON.stringify(offer));
  const listed=command(s,'RC4_ACCEPT_BUY_OFFER',{producerId:a.id,offerId:offer.offerId,itemId:item.id});assert.equal(listed.ok,true,JSON.stringify(listed));
  const trade=travelAndBuy(s,merchant.id,listed.listingId);assert.equal(trade.ok,true);
  const after=s.rustPossessions.items.find(i=>i.id===identity.id);
  assert.equal(after.location.agentId,merchant.id);assert.equal(after.createdBy,identity.createdBy);assert.deepEqual(after.craft,identity.craft);
  assert.equal(getBalance(s,a.id),sellerBefore+2);assert.equal(getBalance(s,merchant.id),buyerBefore-2);assert.equal(totalCurrency(s),currencyBefore);
  assert.equal(s.agents.find(x=>x.id===a.id).profession,'crafter');
  assert.equal(s.homeMarkets.markets.some(m=>m.ownerAgentId===a.id),false);
  const loaded=restore(serialize(s));assert.deepEqual(validate(loaded),[]);
  assert.deepEqual(loaded.rustPossessions.items.find(i=>i.id===identity.id).craft,identity.craft);
});

test('Crafter panel describes the active Tier gate and remains a read-only view',async()=>{
  const {s,a}=crafterFixture();
  const {renderCrafterProfile}=await import('../src/crafting-ui.mjs');
  const before=serialize(s),html=renderCrafterProfile(s,a);
  assert.match(html,/T3=Crafter/);assert.match(html,/T4=Expert/);assert.match(html,/T5=Master/);
  assert.match(html,/เฉพาะสูตรที่ผ่าน migration/);
  assert.doesNotMatch(html,/T3–T5 ยังยึดสิทธิ์สูตรเดิม/);
  assert.match(html,/data-crafter-grade="CRAFTER"/);
  assert.equal(serialize(s),before);
});
