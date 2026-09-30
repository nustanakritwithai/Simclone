import test from 'node:test';
import assert from 'node:assert/strict';

import {command,step,serialize,walkable,validate} from '../src/engine.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {recipeMastery} from '../src/craft-recipe-knowledge.mjs';
import {projectActorObservedDemand} from '../src/economic-demand.mjs';
import {observeRc4Markets} from '../src/rc4-market-observation.mjs';
import {crafterMaterialProcurementSnapshot} from '../src/crafter-material-procurement.mjs';
import {merchantAutonomySnapshot} from '../src/rc4-merchant-policy.mjs';
import {TRADE_ASSET_TYPES} from '../src/trade-assets.mjs';
import {rc2World,craftFixtureItem} from './fixtures/rc2-world.mjs';

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

function nearby(s,a,b){
  for(let r=1;r<6;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    if(Math.abs(dx)+Math.abs(dy)!==r)continue;
    const x=a.x+dx,y=a.y+dy;
    if(walkable(s,x,y)){b.x=x;b.y=y;b.task=null;return;}
  }
  throw new Error('no nearby walkable cell');
}

function farAway(s,from,a){
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){
    if(Math.abs(x-from.x)+Math.abs(y-from.y)<24||!walkable(s,x,y))continue;
    a.x=x;a.y=y;a.task=null;return;
  }
  throw new Error('no far walkable cell');
}

function setup(){
  const s=rc2World(),merchant=s.agents[0],crafter=qualifiedCrafter(s,s.agents[1]);
  calm(merchant,crafter);
  const market=command(s,'RC4_CREATE_MARKET',{agentId:merchant.id});assert.equal(market.ok,true,JSON.stringify(market));
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:merchant.id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  merchant.preference='MINE';
  // Ensure a real productive tool need. This is pre-start fixture preparation only.
  const removed=new Set(s.rustPossessions.items.filter(i=>i.kind==='STONE_PICKAXE'&&i.location?.kind==='bag'&&i.location.agentId===merchant.id).map(i=>i.id));
  s.rustPossessions.items=s.rustPossessions.items.filter(i=>!removed.has(i.id));
  s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>!removed.has(e.itemId));
  nearby(s,merchant,crafter);
  Object.assign(resourceStock(s,crafter),{food:900,wood:0,stone:900});
  calm(merchant,crafter);
  assert.deepEqual(validate(s),[]);
  return {s,merchant,crafter};
}

test('ER6 ER1 exposes only local live Crafter material shortage and remains read-only',()=>{
  const {s,merchant,crafter}=setup(),before=serialize(s);
  const projection=projectActorObservedDemand(s,merchant,{includeCrafterMaterialDemand:true});
  assert.equal(projection.status,'SAT');
  assert.equal(serialize(s),before,'projection must not mutate world');
  const wood=projection.signals.find(x=>x.unit==='bulk-resource'&&x.itemKind==='wood');
  assert.ok(wood,'Merchant should observe nearby Crafter wood shortage');
  const source=wood.sources.find(x=>x.kind==='LOCAL_CRAFTER_MATERIAL_NEED'&&x.subjectAgentId===crafter.id);
  assert.ok(source,JSON.stringify(wood));
  assert.equal(source.side,'DEMAND');
  assert.ok(Number.isSafeInteger(source.quantity)&&source.quantity>0);
  assert.equal('recipeId' in source,false);
  assert.equal('productItemKind' in source,false);
  assert.equal('demandEvidenceId' in source,false);
  assert.equal(wood.tradable,true);
});

test('ER6 local Crafter material signal disappears out of range or after shortage clears',()=>{
  const first=setup();
  farAway(first.s,first.crafter,first.merchant);
  const remote=projectActorObservedDemand(first.s,first.merchant,{includeCrafterMaterialDemand:true});
  assert.equal(remote.status,'SAT');
  assert.equal(remote.signals.some(s=>s.sources.some(x=>x.kind==='LOCAL_CRAFTER_MATERIAL_NEED'&&x.subjectAgentId===first.crafter.id)),false);

  const second=setup();
  resourceStock(second.s,second.crafter).wood=999;
  const cleared=projectActorObservedDemand(second.s,second.merchant,{includeCrafterMaterialDemand:true});
  assert.equal(cleared.status,'SAT');
  assert.equal(cleared.signals.some(s=>s.sources.some(x=>x.kind==='LOCAL_CRAFTER_MATERIAL_NEED'&&x.subjectAgentId===second.crafter.id)),false);
});


test('ER6 Merchant turns observed Crafter material shortage into funded bulk BuyOffer using verified price history',()=>{
  const {s,merchant,crafter}=setup();
  // Establish one real historical price before the autonomous proof. The Merchant
  // sells one canonical wood unit to the Crafter through ER4; no price oracle or
  // synthetic Ledger row is introduced.
  resourceStock(s,merchant).wood=1;
  const market=s.homeMarkets.markets.find(m=>m.ownerAgentId===merchant.id);assert.ok(market);
  assert.equal(command(s,'RC4_OPEN_MARKET',{agentId:merchant.id,marketId:market.marketId}).ok,true);
  merchant.x=market.storefrontSocket.x;merchant.y=market.storefrontSocket.y;crafter.x=merchant.x;crafter.y=merchant.y;
  merchant.task=null;crafter.task=null;observeRc4Markets(s);
  const listed=command(s,'RC4_CREATE_LISTING',{
    agentId:merchant.id,assetType:TRADE_ASSET_TYPES.BULK_RESOURCE,itemKind:'wood',quantity:1,unitPrice:5,requestId:'er6-price-bootstrap-wood'
  });
  assert.equal(listed.ok,true,JSON.stringify(listed));
  observeRc4Markets(s);
  const plan=crafterMaterialProcurementSnapshot(s,crafter);
  assert.equal(plan.status,'SAT',JSON.stringify(plan));
  assert.equal(plan.type,'TRAVEL_TO_MARKET');assert.equal(plan.itemKind,'wood');
  assert.equal(command(s,'RC4_TRAVEL_TO_MARKET',{agentId:crafter.id,marketId:market.marketId}).ok,true);
  const arrived=crafterMaterialProcurementSnapshot(s,crafter);
  assert.equal(arrived.type,'BUY_LISTING',JSON.stringify(arrived));
  const bought=command(s,'RC4_BUY_LISTING',arrived.intent);assert.equal(bought.ok,true,JSON.stringify(bought));
  assert.equal(resourceStock(s,merchant).wood,0);
  assert.ok(resourceStock(s,crafter).wood>0);
  const ledger=s.merchantLedgers.ledgers.find(l=>l.merchantId===merchant.id);assert.ok(ledger);
  assert.ok(ledger.sales.some(x=>x.itemKind==='wood'&&x.unitPrice===5));

  merchant.task=null;crafter.task=null;nearby(s,merchant,crafter);observeRc4Markets(s);
  const demand=projectActorObservedDemand(s,merchant,{includeCrafterMaterialDemand:true});
  const wood=demand.signals.find(x=>x.unit==='bulk-resource'&&x.itemKind==='wood');
  assert.ok(wood?.sources.some(x=>x.kind==='LOCAL_CRAFTER_MATERIAL_NEED'),JSON.stringify(wood));
  const decision=merchantAutonomySnapshot(s,merchant);
  assert.equal(decision.status,'SAT',JSON.stringify(decision));
  assert.equal(decision.type,'CREATE_BUY_OFFER',JSON.stringify(decision));
  assert.equal(decision.itemKind,'wood');
  assert.equal(decision.assetType,TRADE_ASSET_TYPES.BULK_RESOURCE);
  assert.equal(decision.referencePrice,5);
  assert.ok(['verified-trade','own-ledger-sale'].includes(decision.referenceSource));
  assert.ok(Number.isSafeInteger(decision.unitPrice)&&decision.unitPrice>0);
  const beforeOffers=s.merchantBuyOffers.buyOffers.length;
  step(s,1);
  const offer=s.merchantBuyOffers.buyOffers.find(o=>o.buyerId===merchant.id&&o.itemKind==='wood'&&o.status==='OPEN');
  assert.ok(offer,'engine must commit the funded bulk BuyOffer through RC4');
  assert.equal(offer.assetType,TRADE_ASSET_TYPES.BULK_RESOURCE);
  assert.equal(s.merchantBuyOffers.buyOffers.length,beforeOffers+1);
  assert.deepEqual(validate(s),[]);
});
