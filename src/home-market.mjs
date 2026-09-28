/**
 * RC4 Home Market — a pure market component attached to an existing personal home.
 *
 * Housing ownership/completeness remain owned by individual-housing.mjs/housing.mjs.
 * This module never creates a building, changes housing capacity, owns money/items,
 * settles trades, or writes professions/AI/UI state.
 */
import {individualHouses,homeOf} from './individual-housing.mjs?v=0.5.0';
import {edgeCells} from './rust-stations.mjs?v=0.5.0';
import {worldBounds} from './world-bounds.mjs?v=0.5.0';

export const HOME_MARKET_VERSION='RC4-HM-0.1';
export const HOME_MARKET_STATUSES=Object.freeze(['closed','open','invalid','archived']);
// Canonical Home Market policy: trade occurs at/adjacent to the physical storefront cell.
// Integration must consume this value through projectHomeMarketForTrade(); it must not guess a range.
export const HOME_MARKET_TRADE_RANGE=1;
const STATUS_SET=new Set(HOME_MARKET_STATUSES);
const ACTIVE_STATUS=new Set(['closed','open']);
const ALLOWED_MARKET_KEYS=new Set(['marketId','homeId','ownerAgentId','status','listingIds','buyOfferIds','storefrontSocket','reputation','invalidReason']);
const ALLOWED_SOCKET_KEYS=new Set(['type','x','y','side','level','facing','doorwayStationId']);
const FACING=new Set(['N','E','S','W']);
const fail=(reason,message,marketState=null)=>({ok:false,reason,message,...(marketState?{marketState}:{})});
const refOk=v=>(Number.isSafeInteger(v)&&v>=0)||(typeof v==='string'&&v.length>0&&v.length<=128);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function cloneSocket(s){
  return s?{type:s.type,x:s.x,y:s.y,side:s.side,level:s.level,facing:s.facing,doorwayStationId:s.doorwayStationId}:null;
}
function cloneMarket(m){
  return {
    marketId:m.marketId,
    homeId:m.homeId,
    ownerAgentId:m.ownerAgentId,
    status:m.status,
    listingIds:[...(m.listingIds??[])],
    buyOfferIds:[...(m.buyOfferIds??[])],
    storefrontSocket:cloneSocket(m.storefrontSocket),
    reputation:m.reputation,
    ...(m.invalidReason?{invalidReason:m.invalidReason}:{})
  };
}
function cloneState(s){return {version:HOME_MARKET_VERSION,markets:structuredClone(s.markets??[])};}

/** Old saves have no homeMarkets field. Missing input becomes a valid empty component. */
export function normalizeHomeMarketState(raw){
  if(raw===undefined||raw===null)return {version:HOME_MARKET_VERSION,markets:[]};
  if(typeof raw!=='object'||Array.isArray(raw)||!Array.isArray(raw.markets))return {version:HOME_MARKET_VERSION,markets:[]};
  return {version:HOME_MARKET_VERSION,markets:raw.markets.map(m=>structuredClone(m))};
}

function structuralErrors(raw){
  const errors=[],ids=new Set();
  if(raw!==undefined&&raw!==null){
    if(typeof raw!=='object'||Array.isArray(raw))return ['state:record'];
    if(raw.version!==undefined&&raw.version!==HOME_MARKET_VERSION)errors.push('state:version');
    if(raw.markets!==undefined&&!Array.isArray(raw.markets))return [...errors,'state:markets'];
  }
  const s=normalizeHomeMarketState(raw);
  for(let i=0;i<s.markets.length;i++){
    const m=s.markets[i],at=`market[${i}]`;
    if(!m||typeof m!=='object'||Array.isArray(m)){errors.push(at+':record');continue;}
    for(const k of Object.keys(m))if(!ALLOWED_MARKET_KEYS.has(k))errors.push(at+':authority-field:'+k);
    if(typeof m.marketId!=='string'||m.marketId.length<1||m.marketId.length>160)errors.push(at+':marketId');
    else if(ids.has(m.marketId))errors.push(at+':duplicate-marketId');else ids.add(m.marketId);
    if(typeof m.homeId!=='string'||m.homeId.length<1||m.homeId.length>96)errors.push(at+':homeId');
    if(!Number.isSafeInteger(m.ownerAgentId)||m.ownerAgentId<=0)errors.push(at+':ownerAgentId');
    if(!STATUS_SET.has(m.status))errors.push(at+':status');
    for(const [name,values] of [['listingIds',m.listingIds],['buyOfferIds',m.buyOfferIds]]){
      if(!Array.isArray(values)){errors.push(at+':'+name);continue;}
      const seen=new Set();for(const v of values){if(!refOk(v))errors.push(at+':'+name+':ref');const k=typeof v+':'+String(v);if(seen.has(k))errors.push(at+':'+name+':duplicate');seen.add(k);}
    }
    if(!Number.isFinite(m.reputation))errors.push(at+':reputation');
    const socket=m.storefrontSocket;
    if(!socket||typeof socket!=='object'||Array.isArray(socket))errors.push(at+':storefrontSocket');
    else{
      for(const k of Object.keys(socket))if(!ALLOWED_SOCKET_KEYS.has(k))errors.push(at+':storefront-authority-field:'+k);
      if(socket.type!=='edge'||!Number.isInteger(socket.x)||!Number.isInteger(socket.y)||!['N','W'].includes(socket.side)||socket.level!==1||!FACING.has(socket.facing)||!Number.isSafeInteger(socket.doorwayStationId)||socket.doorwayStationId<=0)errors.push(at+':storefrontSocket');
    }
    if(m.invalidReason!==undefined&&(typeof m.invalidReason!=='string'||m.invalidReason.length>64))errors.push(at+':invalidReason');
  }
  return errors;
}

/** Structural invariant proof; world authority reconciliation is separate. */
export function validateHomeMarketState(raw){
  const errors=structuralErrors(raw),s=normalizeHomeMarketState(raw),activeByHome=new Map();
  for(const m of s.markets){
    if(!m||!ACTIVE_STATUS.has(m.status)||typeof m.homeId!=='string')continue;
    activeByHome.set(m.homeId,(activeByHome.get(m.homeId)??0)+1);
  }
  for(const [homeId,n] of activeByHome)if(n>1)errors.push('home:'+homeId+':multiple-active-markets');
  return errors;
}

function aliveAgent(world,id){return (world.agents??[]).find(a=>a?.id===id&&a.alive===true)??null;}
function localFacing(socket,cell){
  if(socket.side==='N'&&cell.x===socket.x)return cell.y===socket.y?'N':cell.y===socket.y-1?'S':null;
  if(socket.side==='W'&&cell.y===socket.y)return cell.x===socket.x?'W':cell.x===socket.x-1?'E':null;
  return null;
}

/**
 * Read-only storefront projection: the market uses the home's one physical doorway.
 * The stored canonical N/W socket is retained; facing is the doorway side as seen
 * from the house foundation component, so no second orientation/building authority exists.
 */
export function storefrontSocketForHome(world,home){
  if(!home?.complete||!Array.isArray(home.cells)||home.cells.length<1)return null;
  const cells=new Set(home.cells.map(c=>c.x+':'+c.y)),matches=[];
  for(const st of world.rustStations?.stations??[]){
    if(st?.kind!=='WOOD_DOORWAY'||st.socket?.type!=='edge'||!['N','W'].includes(st.socket.side))continue;
    const touching=edgeCells(st.socket),inside=touching.filter(c=>cells.has(c.x+':'+c.y));
    if(inside.length!==1)continue;
    const other=touching.find(c=>!cells.has(c.x+':'+c.y));if(!other)continue;
    const facing=localFacing(st.socket,inside[0]);if(!facing)continue;
    matches.push({st,inside:inside[0],facing});
  }
  matches.sort((a,b)=>a.st.id-b.st.id);
  if(matches.length!==1)return null;
  const {st,facing}=matches[0];
  return {type:'edge',x:st.socket.x,y:st.socket.y,side:st.socket.side,level:1,facing,doorwayStationId:st.id};
}

export const homeMarketId=(homeId,ownerAgentId)=>`HM:${homeId}:${ownerAgentId}`;

function reconcileValid(world,state){
  const houses=new Map(individualHouses(world).map(h=>[h.houseId,h])),markets=[];let changed=false;
  for(const original of state.markets){
    const m=cloneMarket(original);
    if(m.status==='archived'){markets.push(m);continue;}
    const home=houses.get(m.homeId),owner=aliveAgent(world,m.ownerAgentId);
    let reason=null,storefront=null;
    if(!home?.complete)reason='home-invalid';
    else if(home.ownerId!==m.ownerAgentId)reason='ownership-changed';
    else if(!owner)reason='owner-dead';
    else if(!(storefront=storefrontSocketForHome(world,home)))reason='home-invalid';
    if(reason){
      if(m.status!=='invalid'||m.invalidReason!==reason){m.status='invalid';m.invalidReason=reason;changed=true;}
    }else{
      if(m.status==='invalid'){m.status='closed';delete m.invalidReason;changed=true;}
      if(!same(m.storefrontSocket,storefront)){m.storefrontSocket=storefront;changed=true;}
    }
    markets.push(m);
  }
  return {marketState:{version:HOME_MARKET_VERSION,markets},changed};
}

/** Fail-closed repair against current home/owner truth. Never mutates world or input. */
export function reconcileHomeMarkets(world,raw){
  const errors=structuralErrors(raw),state=normalizeHomeMarketState(raw);
  if(errors.length)return fail('market-state-invalid',errors.join(','),cloneState(state));
  const result=reconcileValid(world,state),post=validateHomeMarketState(result.marketState);
  if(post.length)return fail('market-state-invalid',post.join(','),result.marketState);
  return {ok:true,...result};
}

export function createHomeMarket(world,raw,{ownerAgentId,homeId=null}={}){
  const reconciled=reconcileHomeMarkets(world,raw);if(!reconciled.ok)return reconciled;
  const state=reconciled.marketState,owner=aliveAgent(world,ownerAgentId);
  if(!owner)return fail('owner-dead','market owner must be a living agent',state);
  const home=homeOf(world,ownerAgentId,{completeOnly:true});
  if(!home||homeId!==null&&home.houseId!==homeId)return fail('home-ownership','owner must use their canonical completed home',state);
  const storefront=storefrontSocketForHome(world,home);if(!storefront)return fail('home-invalid','completed home has no valid physical doorway storefront',state);
  const active=state.markets.find(m=>m.homeId===home.houseId&&ACTIVE_STATUS.has(m.status));
  const id=homeMarketId(home.houseId,ownerAgentId);
  if(active){
    if(active.ownerAgentId===ownerAgentId&&active.marketId===id)return {ok:true,changed:reconciled.changed,duplicate:true,market:cloneMarket(active),marketState:state};
    return fail('market-exists','home already has an active market',state);
  }
  if(state.markets.some(m=>m.marketId===id))return fail('market-archived','archive/remove the prior market record before recreating it',state);
  const market={marketId:id,homeId:home.houseId,ownerAgentId,status:'closed',listingIds:[],buyOfferIds:[],storefrontSocket:storefront,reputation:0};
  const next={version:HOME_MARKET_VERSION,markets:[...state.markets.map(cloneMarket),market].sort((a,b)=>a.marketId.localeCompare(b.marketId))};
  return {ok:true,changed:true,duplicate:false,market:cloneMarket(market),marketState:next};
}

function ownerAction(world,raw,{marketId,ownerAgentId},target){
  const reconciled=reconcileHomeMarkets(world,raw);if(!reconciled.ok)return reconciled;
  const state=reconciled.marketState,index=state.markets.findIndex(m=>m.marketId===marketId);if(index<0)return fail('market','market not found',state);
  const market=state.markets[index];
  if(market.ownerAgentId!==ownerAgentId)return fail('owner','only the current market owner may change open state',state);
  if(!aliveAgent(world,ownerAgentId))return fail('owner-dead','dead owner cannot operate a market',state);
  const home=homeOf(world,ownerAgentId,{completeOnly:true});
  if(!home||home.houseId!==market.homeId)return fail('home-ownership','market no longer belongs to the owner canonical home',state);
  if(market.status==='invalid')return fail('market-invalid',market.invalidReason??'market invalid',state);
  if(market.status==='archived')return fail('market-archived','archived market cannot open or close',state);
  if(market.status===target)return {ok:true,changed:reconciled.changed,duplicate:true,market:cloneMarket(market),marketState:state};
  if(target==='open'&&market.status!=='closed'||target==='closed'&&market.status!=='open')return fail('market-status','invalid market lifecycle transition',state);
  const next=cloneState(state);next.markets[index].status=target;
  return {ok:true,changed:true,duplicate:false,market:cloneMarket(next.markets[index]),marketState:next};
}
export const openHomeMarket=(world,raw,request)=>ownerAction(world,raw,request,'open');
export const closeHomeMarket=(world,raw,request)=>ownerAction(world,raw,request,'closed');

/** Archive is lifecycle cleanup, not a trade/housing mutation. Open markets must close first. */
export function archiveHomeMarket(raw,{marketId}={}){
  const errors=validateHomeMarketState(raw),state=normalizeHomeMarketState(raw);if(errors.length)return fail('market-state-invalid',errors.join(','),cloneState(state));
  const i=state.markets.findIndex(m=>m.marketId===marketId);if(i<0)return fail('market','market not found',cloneState(state));
  if(state.markets[i].status==='open')return fail('market-open','close market before archive',cloneState(state));
  if(state.markets[i].status==='archived')return {ok:true,changed:false,duplicate:true,marketState:cloneState(state),market:cloneMarket(state.markets[i])};
  const next=cloneState(state);next.markets[i].status='archived';delete next.markets[i].invalidReason;
  return {ok:true,changed:true,duplicate:false,marketState:next,market:cloneMarket(next.markets[i])};
}

export function removeArchivedHomeMarket(raw,{marketId}={}){
  const errors=validateHomeMarketState(raw),state=normalizeHomeMarketState(raw);if(errors.length)return fail('market-state-invalid',errors.join(','),cloneState(state));
  const i=state.markets.findIndex(m=>m.marketId===marketId);if(i<0)return {ok:true,changed:false,duplicate:true,marketState:cloneState(state)};
  if(state.markets[i].status!=='archived')return fail('market-status','only archived markets may be removed',cloneState(state));
  const next=cloneState(state);next.markets.splice(i,1);return {ok:true,changed:true,marketState:next};
}


function activeOwnedMarket(world,state,{marketId,ownerAgentId}={}){
  const index=state.markets.findIndex(m=>m.marketId===marketId);
  if(index<0)return fail('market','market not found',state);
  const market=state.markets[index];
  if(market.ownerAgentId!==ownerAgentId)return fail('owner','only the canonical market owner may mutate references',state);
  if(!aliveAgent(world,ownerAgentId))return fail('owner-dead','dead owner cannot mutate market references',state);
  if(market.status==='invalid')return fail('market-invalid',market.invalidReason??'market invalid',state);
  if(market.status==='archived')return fail('market-archived','archived market cannot mutate references',state);
  if(!ACTIVE_STATUS.has(market.status))return fail('market-status','market is not active',state);
  const home=homeOf(world,ownerAgentId,{completeOnly:true});
  if(!home||home.houseId!==market.homeId)return fail('home-ownership','market no longer belongs to the owner canonical home',state);
  return {ok:true,index,market};
}

function mutateMarketReference(world,raw,{marketId,ownerAgentId,referenceId}={},field,attach){
  const reconciled=reconcileHomeMarkets(world,raw);if(!reconciled.ok)return reconciled;
  const state=reconciled.marketState;
  if(!refOk(referenceId))return fail('reference','reference id is invalid',state);
  const access=activeOwnedMarket(world,state,{marketId,ownerAgentId});if(!access.ok)return access;
  const current=access.market[field],present=current.some(id=>id===referenceId);
  if(attach&&present||!attach&&!present)return {ok:true,changed:reconciled.changed,duplicate:true,market:cloneMarket(access.market),marketState:state};
  const next=cloneState(state);
  next.markets[access.index][field]=attach
    ?[...current,referenceId].sort((a,b)=>String(a).localeCompare(String(b)))
    :current.filter(id=>id!==referenceId);
  return {ok:true,changed:true,duplicate:false,market:cloneMarket(next.markets[access.index]),marketState:next};
}

/** Canonical Home Market reference writers. These mutate references only, never Listing/BuyOffer/item/money truth. */
export const attachHomeMarketListingReference=(world,raw,request)=>mutateMarketReference(world,raw,request,'listingIds',true);
export const detachHomeMarketListingReference=(world,raw,request)=>mutateMarketReference(world,raw,request,'listingIds',false);
export const attachHomeMarketBuyOfferReference=(world,raw,request)=>mutateMarketReference(world,raw,request,'buyOfferIds',true);
export const detachHomeMarketBuyOfferReference=(world,raw,request)=>mutateMarketReference(world,raw,request,'buyOfferIds',false);

function storefrontTradePoint(socket){
  if(!socket||!FACING.has(socket.facing))return null;
  if(socket.facing==='N')return {x:socket.x,y:socket.y-1};
  if(socket.facing==='S')return {x:socket.x,y:socket.y};
  if(socket.facing==='W')return {x:socket.x-1,y:socket.y};
  return {x:socket.x,y:socket.y}; // E
}

/**
 * Canonical read-only Home Market -> Trade Kernel projection.
 * id/open come from Home Market lifecycle; x/y come from the physical doorway;
 * tradeRange is Home Market policy above. UI coordinates never participate.
 */
export function projectHomeMarketForTrade(world,raw,{marketId}={}){
  const reconciled=reconcileHomeMarkets(world,raw);if(!reconciled.ok)return reconciled;
  const state=reconciled.marketState,market=state.markets.find(m=>m.marketId===marketId);
  if(!market)return fail('market','market not found',state);
  if(market.status==='invalid')return fail('market-invalid',market.invalidReason??'market invalid',state);
  if(market.status==='archived')return fail('market-archived','archived market has no trade projection',state);
  if(!ACTIVE_STATUS.has(market.status))return fail('market-status','market is not active',state);
  const owner=aliveAgent(world,market.ownerAgentId);
  const home=owner?homeOf(world,market.ownerAgentId,{completeOnly:true}):null;
  const socket=home&&home.houseId===market.homeId?storefrontSocketForHome(world,home):null;
  const point=storefrontTradePoint(socket),bounds=worldBounds(world);
  if(!point||!Number.isInteger(point.x)||!Number.isInteger(point.y)||point.x<0||point.y<0||point.x>=bounds.w||point.y>=bounds.h)
    return fail('market-position','canonical physical storefront position unavailable',state);
  if(!Number.isSafeInteger(HOME_MARKET_TRADE_RANGE)||HOME_MARKET_TRADE_RANGE<=0)return fail('trade-range','canonical Home Market trade range invalid',state);
  const projection=Object.freeze({id:market.marketId,open:market.status==='open',x:point.x,y:point.y,tradeRange:HOME_MARKET_TRADE_RANGE});
  const provenance=Object.freeze({authority:'HomeMarket',homeId:market.homeId,doorwayStationId:socket.doorwayStationId,status:market.status});
  return {ok:true,market:projection,provenance,marketState:state};
}


/** B7 component persistence: missing old-save field migrates once; corrupt present state never resets. */
export function migrateHomeMarketState(raw){
  if(raw===undefined||raw===null)return {state:'SAT',migrated:true,duplicate:false,marketState:{version:HOME_MARKET_VERSION,markets:[]}};
  const errors=validateHomeMarketState(raw);
  if(errors.length)return {state:'VIOL',reason:'market-state-invalid',errors,marketState:structuredClone(raw)};
  return {state:'SAT',migrated:false,duplicate:true,marketState:cloneState(raw)};
}
export function serializeHomeMarketState(raw){
  const errors=validateHomeMarketState(raw);if(errors.length)throw new Error('market-state-invalid:'+errors.join(','));
  return JSON.stringify(raw);
}
export function restoreHomeMarketState(serialized){
  const raw=JSON.parse(serialized),errors=validateHomeMarketState(raw);
  if(errors.length)throw new Error('market-state-invalid:'+errors.join(','));
  return cloneState(raw);
}
