import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOME_MARKET_VERSION,
  normalizeHomeMarketState,
  validateHomeMarketState,
  storefrontSocketForHome,
  createHomeMarket,
  openHomeMarket,
  closeHomeMarket,
  reconcileHomeMarkets,
  archiveHomeMarket,
  removeArchivedHomeMarket,
  HOME_MARKET_TRADE_RANGE,
  attachHomeMarketListingReference,
  detachHomeMarketListingReference,
  attachHomeMarketBuyOfferReference,
  detachHomeMarketBuyOfferReference,
  projectHomeMarketForTrade,
  migrateHomeMarketState,
  serializeHomeMarketState,
  restoreHomeMarketState
} from '../src/home-market.mjs';
import {homeOf} from '../src/individual-housing.mjs';
import {housingCapacity} from '../src/housing.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';

const cell=(x,y,level)=>({type:'cell',x,y,level});
function station(id,kind,socket,placedBy=1){return {id,kind,x:10,y:10,placedBy,placedTick:0,complete:true,structurePiece:true,socket};}
function marketWorld(){
  const x=10,y=10;
  return {
    agents:[{id:1,alive:true},{id:2,alive:true}],archive:[],buildings:[],
    rustStations:{version:'RS3-0.3',nextStation:7,stations:[
      station(1,'WOOD_FOUNDATION',cell(x,y,0),1),
      station(2,'WOOD_WALL',canonicalEdge(x,y,'N'),1),
      station(3,'WOOD_WALL',canonicalEdge(x,y,'E'),1),
      station(4,'WOOD_WALL',canonicalEdge(x,y,'W'),1),
      station(5,'WOOD_DOORWAY',canonicalEdge(x,y,'S'),1),
      station(6,'WOOD_ROOF',cell(x,y,2),1)
    ]},
    rustPossessions:{items:[{id:91,kind:'STONE_AXE',location:{kind:'bag',agentId:1}}],equipment:[],orders:[]}
  };
}
function activeForHome(state,homeId){return state.markets.filter(m=>m.homeId===homeId&&(m.status==='closed'||m.status==='open'));}

test('RC4 Home Market: owner creates a closed market on their existing completed home and opens it',()=>{
  const s=marketWorld(),worldBefore=JSON.stringify(s),home=homeOf(s,1,{completeOnly:true});
  assert.ok(home);assert.equal(home.houseId,'H1');
  const beforeCapacity=housingCapacity(s),created=createHomeMarket(s,undefined,{ownerAgentId:1,homeId:home.houseId});
  assert.equal(created.ok,true);assert.equal(created.market.status,'closed');assert.equal(created.market.ownerAgentId,1);assert.equal(created.market.homeId,'H1');
  assert.deepEqual(created.market.storefrontSocket,{type:'edge',x:10,y:11,side:'N',level:1,facing:'S',doorwayStationId:5});
  assert.deepEqual(storefrontSocketForHome(s,home),created.market.storefrontSocket);
  const opened=openHomeMarket(s,created.marketState,{marketId:created.market.marketId,ownerAgentId:1});
  assert.equal(opened.ok,true);assert.equal(opened.market.status,'open');assert.equal(housingCapacity({...s,homeMarkets:opened.marketState}),beforeCapacity);
  assert.equal(JSON.stringify(s),worldBefore,'pure Home Market actions do not mutate world/buildings/items');
  assert.deepEqual(validateHomeMarketState(opened.marketState),[]);
});

test('RC4 Home Market: another Clone cannot open a market on someone else home',()=>{
  const s=marketWorld(),r=createHomeMarket(s,undefined,{ownerAgentId:2,homeId:'H1'});
  assert.equal(r.ok,false);assert.equal(r.reason,'home-ownership');assert.deepEqual(r.marketState,{version:HOME_MARKET_VERSION,markets:[]});
});

test('RC4 Home Market: dead owner cannot create or keep an open shop',()=>{
  const s=marketWorld(),created=createHomeMarket(s,undefined,{ownerAgentId:1,homeId:'H1'}),opened=openHomeMarket(s,created.marketState,{marketId:created.market.marketId,ownerAgentId:1});
  assert.equal(opened.ok,true);s.agents[0].alive=false;
  const reconciled=reconcileHomeMarkets(s,opened.marketState);assert.equal(reconciled.ok,true);
  assert.equal(reconciled.marketState.markets[0].status,'invalid');assert.equal(reconciled.marketState.markets[0].invalidReason,'owner-dead');
  const again=createHomeMarket(s,reconciled.marketState,{ownerAgentId:1,homeId:'H1'});assert.equal(again.ok,false);assert.equal(again.reason,'owner-dead');
});

test('RC4 Home Market: duplicate create is idempotent and one home has at most one active market',()=>{
  const s=marketWorld(),first=createHomeMarket(s,undefined,{ownerAgentId:1,homeId:'H1'}),snapshot=JSON.stringify(first.marketState);
  const second=createHomeMarket(s,first.marketState,{ownerAgentId:1,homeId:'H1'});
  assert.equal(second.ok,true);assert.equal(second.duplicate,true);assert.equal(second.market.marketId,first.market.marketId);
  assert.equal(JSON.stringify(second.marketState),snapshot);assert.equal(activeForHome(second.marketState,'H1').length,1);
  const forged=structuredClone(second.marketState);forged.markets.push({...structuredClone(forged.markets[0]),marketId:'HM:forged:2'});
  assert.ok(validateHomeMarketState(forged).includes('home:H1:multiple-active-markets'));
});

test('RC4 Home Market: closing a market preserves listing/buy-offer references and never touches physical items',()=>{
  const s=marketWorld(),created=createHomeMarket(s,undefined,{ownerAgentId:1,homeId:'H1'});
  const l1=attachHomeMarketListingReference(s,created.marketState,{marketId:created.market.marketId,ownerAgentId:1,referenceId:'LISTING-1'});
  const l2=attachHomeMarketListingReference(s,l1.marketState,{marketId:created.market.marketId,ownerAgentId:1,referenceId:'LISTING-2'});
  const b1=attachHomeMarketBuyOfferReference(s,l2.marketState,{marketId:created.market.marketId,ownerAgentId:1,referenceId:'BUY-1'});
  const itemsBefore=JSON.stringify(s.rustPossessions),opened=openHomeMarket(s,b1.marketState,{marketId:created.market.marketId,ownerAgentId:1});
  const closed=closeHomeMarket(s,opened.marketState,{marketId:created.market.marketId,ownerAgentId:1});
  assert.equal(closed.ok,true);assert.equal(closed.market.status,'closed');
  assert.deepEqual(closed.market.listingIds,['LISTING-1','LISTING-2']);assert.deepEqual(closed.market.buyOfferIds,['BUY-1']);
  assert.equal(JSON.stringify(s.rustPossessions),itemsBefore);
});

test('RC4 Home Market: invalid home fails closed and market becomes invalid',()=>{
  const s=marketWorld(),created=createHomeMarket(s,undefined,{ownerAgentId:1,homeId:'H1'}),opened=openHomeMarket(s,created.marketState,{marketId:created.market.marketId,ownerAgentId:1});
  s.rustStations.stations=s.rustStations.stations.filter(st=>st.kind!=='WOOD_ROOF');
  const r=reconcileHomeMarkets(s,opened.marketState);assert.equal(r.ok,true);
  assert.equal(r.marketState.markets[0].status,'invalid');assert.equal(r.marketState.markets[0].invalidReason,'home-invalid');
  assert.equal(openHomeMarket(s,r.marketState,{marketId:created.market.marketId,ownerAgentId:1}).reason,'home-ownership');
});

test('RC4 Home Market: ownership change invalidates old market and permits the new owner market without duplicate active market',()=>{
  const s=marketWorld(),created=createHomeMarket(s,undefined,{ownerAgentId:1,homeId:'H1'}),opened=openHomeMarket(s,created.marketState,{marketId:created.market.marketId,ownerAgentId:1});
  s.rustStations.stations.find(st=>st.kind==='WOOD_FOUNDATION').placedBy=2;
  const reconciled=reconcileHomeMarkets(s,opened.marketState);assert.equal(reconciled.ok,true);
  const old=reconciled.marketState.markets[0];assert.equal(old.status,'invalid');assert.equal(old.invalidReason,'ownership-changed');
  assert.equal(homeOf(s,2,{completeOnly:true}).houseId,'H1');
  const next=createHomeMarket(s,reconciled.marketState,{ownerAgentId:2,homeId:'H1'});assert.equal(next.ok,true);
  assert.equal(next.market.ownerAgentId,2);assert.notEqual(next.market.marketId,old.marketId);assert.equal(activeForHome(next.marketState,'H1').length,1);
  assert.deepEqual(validateHomeMarketState(next.marketState),[]);
});

test('RC4 Home Market: save/load is deterministic and old saves with no market component load as empty',()=>{
  const s=marketWorld(),created=createHomeMarket(s,undefined,{ownerAgentId:1,homeId:'H1'}),opened=openHomeMarket(s,created.marketState,{marketId:created.market.marketId,ownerAgentId:1});
  const saved=JSON.stringify(opened.marketState),loaded=normalizeHomeMarketState(JSON.parse(saved));
  assert.equal(JSON.stringify(loaded),saved);assert.deepEqual(validateHomeMarketState(loaded),[]);
  const oldSave=JSON.parse(JSON.stringify(s));assert.equal(oldSave.homeMarkets,undefined);
  assert.deepEqual(normalizeHomeMarketState(oldSave.homeMarkets),{version:HOME_MARKET_VERSION,markets:[]});
  assert.doesNotThrow(()=>reconcileHomeMarkets(oldSave,oldSave.homeMarkets));
});

test('RC4 Home Market: lifecycle supports close -> archive -> remove and archived market cannot be opened',()=>{
  const s=marketWorld(),created=createHomeMarket(s,undefined,{ownerAgentId:1,homeId:'H1'}),opened=openHomeMarket(s,created.marketState,{marketId:created.market.marketId,ownerAgentId:1});
  assert.equal(archiveHomeMarket(opened.marketState,{marketId:created.market.marketId}).reason,'market-open');
  const closed=closeHomeMarket(s,opened.marketState,{marketId:created.market.marketId,ownerAgentId:1}),archived=archiveHomeMarket(closed.marketState,{marketId:created.market.marketId});
  assert.equal(archived.ok,true);assert.equal(archived.market.status,'archived');
  assert.equal(openHomeMarket(s,archived.marketState,{marketId:created.market.marketId,ownerAgentId:1}).reason,'market-archived');
  const removed=removeArchivedHomeMarket(archived.marketState,{marketId:created.market.marketId});assert.equal(removed.ok,true);assert.deepEqual(removed.marketState.markets,[]);
});

test('RC4 Home Market: component schema rejects wallet/item authority fields',()=>{
  const s=marketWorld(),created=createHomeMarket(s,undefined,{ownerAgentId:1,homeId:'H1'}),bad=structuredClone(created.marketState);
  bad.markets[0].wallet=100;bad.markets[0].items=[91];
  const errors=validateHomeMarketState(bad);assert.ok(errors.some(x=>x.includes('authority-field:wallet')));assert.ok(errors.some(x=>x.includes('authority-field:items')));
  const r=reconcileHomeMarkets(s,bad);assert.equal(r.ok,false);assert.equal(r.reason,'market-state-invalid');
});


test('RC4 B1: canonical Listing/BuyOffer reference writers are owner-controlled and replay-idempotent',()=>{
  const s=marketWorld(),created=createHomeMarket(s,undefined,{ownerAgentId:1,homeId:'H1'}),id=created.market.marketId;
  const l1=attachHomeMarketListingReference(s,created.marketState,{marketId:id,ownerAgentId:1,referenceId:'LISTING-1'});
  assert.equal(l1.ok,true);assert.equal(l1.duplicate,false);assert.deepEqual(l1.market.listingIds,['LISTING-1']);
  const replay=attachHomeMarketListingReference(s,l1.marketState,{marketId:id,ownerAgentId:1,referenceId:'LISTING-1'});
  assert.equal(replay.ok,true);assert.equal(replay.duplicate,true);assert.equal(JSON.stringify(replay.marketState),JSON.stringify(l1.marketState));
  const wrong=attachHomeMarketBuyOfferReference(s,l1.marketState,{marketId:id,ownerAgentId:2,referenceId:'BUY-1'});
  assert.equal(wrong.ok,false);assert.equal(wrong.reason,'owner');
  const b1=attachHomeMarketBuyOfferReference(s,l1.marketState,{marketId:id,ownerAgentId:1,referenceId:'BUY-1'});
  assert.equal(b1.ok,true);assert.deepEqual(b1.market.buyOfferIds,['BUY-1']);
  const bGone=detachHomeMarketBuyOfferReference(s,b1.marketState,{marketId:id,ownerAgentId:1,referenceId:'BUY-1'});
  assert.equal(bGone.ok,true);assert.equal(bGone.duplicate,false);assert.deepEqual(bGone.market.buyOfferIds,[]);
  const bReplay=detachHomeMarketBuyOfferReference(s,bGone.marketState,{marketId:id,ownerAgentId:1,referenceId:'BUY-1'});
  assert.equal(bReplay.ok,true);assert.equal(bReplay.duplicate,true);
  const lGone=detachHomeMarketListingReference(s,bReplay.marketState,{marketId:id,ownerAgentId:1,referenceId:'LISTING-1'});
  assert.equal(lGone.ok,true);assert.deepEqual(lGone.market.listingIds,[]);
  assert.equal('items' in lGone.market,false);assert.equal('wallet' in lGone.market,false);
  const restored=normalizeHomeMarketState(JSON.parse(JSON.stringify(lGone.marketState)));
  assert.equal(JSON.stringify(restored),JSON.stringify(lGone.marketState));
});

test('RC4 B1: dead/invalid/archived market reference writes fail closed',()=>{
  const s=marketWorld(),created=createHomeMarket(s,undefined,{ownerAgentId:1,homeId:'H1'}),id=created.market.marketId;
  s.agents[0].alive=false;
  const dead=attachHomeMarketListingReference(s,created.marketState,{marketId:id,ownerAgentId:1,referenceId:'LISTING-1'});
  assert.equal(dead.ok,false);assert.ok(['owner-dead','market-invalid'].includes(dead.reason));
  s.agents[0].alive=true;
  const archived=archiveHomeMarket(created.marketState,{marketId:id});
  assert.equal(archived.ok,true);
  const denied=attachHomeMarketBuyOfferReference(s,archived.marketState,{marketId:id,ownerAgentId:1,referenceId:'BUY-1'});
  assert.equal(denied.ok,false);assert.equal(denied.reason,'market-archived');
});

test('RC4 B2: Home Market owns deterministic Trade Market projection and canonical tradeRange',()=>{
  const s=marketWorld(),created=createHomeMarket(s,undefined,{ownerAgentId:1,homeId:'H1'}),id=created.market.marketId;
  const closed=projectHomeMarketForTrade(s,created.marketState,{marketId:id});
  assert.equal(closed.ok,true);assert.deepEqual(closed.market,{id,open:false,x:10,y:11,tradeRange:HOME_MARKET_TRADE_RANGE});
  assert.equal(Number.isSafeInteger(closed.market.tradeRange)&&closed.market.tradeRange>0,true);
  assert.deepEqual(closed.provenance,{authority:'HomeMarket',homeId:'H1',doorwayStationId:5,status:'closed'});
  const opened=openHomeMarket(s,created.marketState,{marketId:id,ownerAgentId:1});
  const a=projectHomeMarketForTrade(s,opened.marketState,{marketId:id}),b=projectHomeMarketForTrade(s,opened.marketState,{marketId:id});
  assert.equal(a.ok,true);assert.equal(a.market.open,true);assert.equal(JSON.stringify(a),JSON.stringify(b));
  s.uiMarketPosition={x:0,y:0,tradeRange:99};
  const stillPhysical=projectHomeMarketForTrade(s,opened.marketState,{marketId:id});
  assert.deepEqual(stillPhysical.market,{id,open:true,x:10,y:11,tradeRange:HOME_MARKET_TRADE_RANGE});
});

test('RC4 B2: invalid/missing physical storefront projection fails closed',()=>{
  const s=marketWorld(),created=createHomeMarket(s,undefined,{ownerAgentId:1,homeId:'H1'}),id=created.market.marketId;
  s.rustStations.stations=s.rustStations.stations.filter(st=>st.kind!=='WOOD_DOORWAY');
  const r=projectHomeMarketForTrade(s,created.marketState,{marketId:id});
  assert.equal(r.ok,false);assert.equal(r.reason,'market-invalid');
});


test('RC4 B7/HomeMarket: authoritative restore preserves refs and corrupt present state fails closed',()=>{
  const s=marketWorld(),created=createHomeMarket(s,undefined,{ownerAgentId:1,homeId:'H1'}),id=created.market.marketId;
  const attached=attachHomeMarketListingReference(s,created.marketState,{marketId:id,ownerAgentId:1,referenceId:'LISTING-PERSIST'});
  const wire=serializeHomeMarketState(attached.marketState),restored=restoreHomeMarketState(wire);
  assert.equal(JSON.stringify(restored),wire);assert.deepEqual(restored.markets[0].listingIds,['LISTING-PERSIST']);
  const old=migrateHomeMarketState(undefined);assert.equal(old.state,'SAT');assert.equal(old.migrated,true);
  const again=migrateHomeMarketState(old.marketState);assert.equal(again.state,'SAT');assert.equal(again.migrated,false);assert.equal(again.duplicate,true);
  const corrupt={version:HOME_MARKET_VERSION,markets:[{...structuredClone(attached.marketState.markets[0]),listingIds:['X','X']}]};
  assert.equal(migrateHomeMarketState(corrupt).state,'VIOL');
  assert.throws(()=>restoreHomeMarketState(JSON.stringify(corrupt)),/market-state-invalid/);
});
