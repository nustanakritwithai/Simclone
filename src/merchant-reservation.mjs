/** RC4 canonical Reservation authority. Owns reservation locks only; never money/items/trade commit. */
export const RESERVATION_STATE_VERSION='RC4-reservation-state/1';
export const RESERVATION_STATUS=Object.freeze({ACTIVE:'ACTIVE',COMMITTED:'COMMITTED',RELEASED:'RELEASED',CANCELED:'CANCELED'});
export const BULK_RESOURCE_ASSET_TYPE='BULK_RESOURCE';

const validId=v=>typeof v==='string'&&v.length>0&&v.length<=160&&/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v);
const positive=v=>Number.isSafeInteger(v)&&v>0;
const nonnegative=v=>Number.isSafeInteger(v)&&v>=0;
const clone=v=>structuredClone(v);
const fail=(reason,state,extra={})=>({state:'VIOL',reason,reservationState:clone(state),...extra});

function stableText(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(stableText).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableText(value[k])).join(',')+'}';
}
function hash32(text,seed=0x811c9dc5){
  let h=seed>>>0;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}
  return h.toString(16).padStart(8,'0');
}
const sortedItemIds=ids=>[...ids].sort((a,b)=>a-b);
function identityPayload(input){
  const base={marketId:input.marketId,listingId:input.listingId,listingRevision:input.listingRevision,
    sellerId:input.sellerId,buyerId:input.buyerId,itemKind:input.itemKind,quantity:input.quantity,
    unitPrice:input.unitPrice};
  return input.assetType===BULK_RESOURCE_ASSET_TYPE
    ?{assetType:BULK_RESOURCE_ASSET_TYPE,...base,createdTick:input.createdTick}
    :{...base,itemIds:sortedItemIds(input.itemIds??[]),createdTick:input.createdTick};
}
export function reservationIdFor(input){
  const text=stableText(identityPayload(input));
  return 'RSV:'+hash32(text)+hash32(text,0x9e3779b9);
}
export const createReservationState=()=>({version:RESERVATION_STATE_VERSION,reservations:[]});

export function validateReservation(row){
  const e=[];
  if(!row||typeof row!=='object'||Array.isArray(row))return ['reservation'];
  if(!validId(row.id))e.push('id');
  if(!validId(row.marketId))e.push('marketId');
  if(!validId(row.listingId))e.push('listingId');
  if(!positive(row.listingRevision))e.push('listingRevision');
  if(!positive(row.sellerId)||!positive(row.buyerId)||row.sellerId===row.buyerId)e.push('parties');
  if(!validId(row.itemKind))e.push('itemKind');
  if(!positive(row.quantity)||row.quantity>128)e.push('quantity');
  if(!positive(row.unitPrice))e.push('unitPrice');
  const bulk=row.assetType===BULK_RESOURCE_ASSET_TYPE;
  if(row.assetType!==undefined&&!bulk)e.push('assetType');
  if(bulk){
    if(row.itemIds!==undefined)e.push('itemIds');
  }else{
    if(!Array.isArray(row.itemIds)||row.itemIds.length!==row.quantity||row.itemIds.some(id=>!positive(id))||new Set(row.itemIds).size!==row.itemIds.length)e.push('itemIds');
    else if(stableText(row.itemIds)!==stableText(sortedItemIds(row.itemIds)))e.push('itemIds-order');
  }
  if(!nonnegative(row.createdTick))e.push('createdTick');
  if(!Object.values(RESERVATION_STATUS).includes(row.status))e.push('status');
  if(row.id&&e.length===0&&row.id!==reservationIdFor(row))e.push('deterministic-id');
  if(row.status===RESERVATION_STATUS.ACTIVE){
    if(row.terminalTick!==undefined||row.terminalReason!==undefined||row.transactionId!==undefined)e.push('active-terminal-fields');
  }else{
    if(!nonnegative(row.terminalTick)||row.terminalTick<row.createdTick)e.push('terminalTick');
    if(typeof row.terminalReason!=='string'||row.terminalReason.length<1||row.terminalReason.length>80)e.push('terminalReason');
    if(row.status===RESERVATION_STATUS.COMMITTED){
      if(!validId(row.transactionId))e.push('transactionId');
    }else if(row.transactionId!==undefined)e.push('transactionId');
  }
  return [...new Set(e)];
}

export function validateReservationState(state){
  if(!state||state.version!==RESERVATION_STATE_VERSION||!Array.isArray(state.reservations))return ['reservation-state'];
  const e=[],ids=new Set(),activeItems=new Set();
  for(const r of state.reservations){
    if(validateReservation(r).length)e.push('reservation');
    if(ids.has(r?.id))e.push('duplicate-id');else ids.add(r?.id);
    if(r?.status===RESERVATION_STATUS.ACTIVE&&r.assetType!==BULK_RESOURCE_ASSET_TYPE&&Array.isArray(r.itemIds)){
      for(const itemId of r.itemIds){if(activeItems.has(itemId))e.push('active-item-overlap');activeItems.add(itemId);}
    }
  }
  return [...new Set(e)];
}

const alive=(world,id)=>!!world?.agents?.some(a=>a?.id===id&&a.alive===true);
function listingErrors(listing){
  const e=[];
  if(!listing||typeof listing!=='object')return ['listing'];
  if(!validId(listing.id)||!validId(listing.marketId)||!positive(listing.revision)||!positive(listing.sellerId)||!validId(listing.itemKind)||listing.assetType!==undefined&&listing.assetType!==BULK_RESOURCE_ASSET_TYPE)e.push('listing');
  if(!positive(listing.quantity)||listing.quantity>128||!positive(listing.unitPrice))e.push('listing');
  if(listing.status!=='OPEN')e.push('listing-not-open');
  return [...new Set(e)];
}
const sameReservation=(a,b)=>stableText(a)===stableText(b);

export function createReservation(world,state,{listing,listingRevision,buyerId,itemIds,quantity,createdTick=world?.tick}={}){
  const stateErrors=validateReservationState(state);if(stateErrors.length)return fail('reservation-state',state,{errors:stateErrors});
  const le=listingErrors(listing);if(le.length)return fail(le.includes('listing-not-open')?'listing-not-open':'listing',state,{errors:le});
  if(listingRevision!==listing.revision)return fail('listing-stale',state);
  if(!positive(buyerId)||buyerId===listing.sellerId)return fail('buyer',state);
  if(!alive(world,listing.sellerId))return fail('seller-dead',state);
  if(!alive(world,buyerId))return fail('buyer-dead',state);
  if(!nonnegative(createdTick)||createdTick!==world?.tick)return fail('created-tick',state);
  const bulk=listing.assetType===BULK_RESOURCE_ASSET_TYPE;
  let row;
  if(bulk){
    if(!positive(quantity)||quantity>listing.quantity||quantity>128||itemIds!==undefined)return fail('quantity',state);
    row={id:null,assetType:BULK_RESOURCE_ASSET_TYPE,marketId:listing.marketId,listingId:listing.id,listingRevision:listing.revision,
      sellerId:listing.sellerId,buyerId,itemKind:listing.itemKind,quantity,
      unitPrice:listing.unitPrice,createdTick,status:RESERVATION_STATUS.ACTIVE};
  }else{
    const frozen=sortedItemIds(itemIds??[]);
    if(frozen.length<1||frozen.length>listing.quantity||frozen.length>128||frozen.some(id=>!positive(id))||new Set(frozen).size!==frozen.length)return fail('itemIds',state);
    row={id:null,marketId:listing.marketId,listingId:listing.id,listingRevision:listing.revision,
      sellerId:listing.sellerId,buyerId,itemKind:listing.itemKind,quantity:frozen.length,
      unitPrice:listing.unitPrice,itemIds:frozen,createdTick,status:RESERVATION_STATUS.ACTIVE};
  }
  row.id=reservationIdFor(row);
  const rowErrors=validateReservation(row);if(rowErrors.length)return fail('reservation',state,{errors:rowErrors});
  const existing=state.reservations.find(r=>r.id===row.id);
  if(existing){
    if(sameReservation(existing,row))return {state:'SAT',duplicate:true,reservation:Object.freeze(clone(existing)),reservationState:clone(state)};
    return fail('reservation-id-conflict',state);
  }
  if(bulk){
    const reserved=state.reservations.filter(r=>r.status===RESERVATION_STATUS.ACTIVE&&r.assetType===BULK_RESOURCE_ASSET_TYPE&&
      r.listingId===listing.id&&r.listingRevision===listing.revision).reduce((sum,r)=>sum+r.quantity,0);
    if(reserved+row.quantity>listing.quantity)return fail('bulk-reserved',state);
  }else{
    const overlap=new Set(state.reservations.filter(r=>r.status===RESERVATION_STATUS.ACTIVE&&r.assetType!==BULK_RESOURCE_ASSET_TYPE).flatMap(r=>r.itemIds??[]));
    if(row.itemIds.some(id=>overlap.has(id)))return fail('item-reserved',state);
  }
  const next=clone(state);next.reservations.push(row);next.reservations.sort((a,b)=>a.id.localeCompare(b.id));
  return {state:'SAT',duplicate:false,reservation:Object.freeze(clone(row)),reservationState:next};
}

export function reservationById(state,id){
  if(validateReservationState(state).length)return null;
  const row=state.reservations.find(r=>r.id===id);return row?clone(row):null;
}
export function globalActiveReservations(state){
  if(validateReservationState(state).length)return null;
  return state.reservations.filter(r=>r.status===RESERVATION_STATUS.ACTIVE).map(clone).sort((a,b)=>a.id.localeCompare(b.id));
}

function terminalTransition(state,{reservationId,status,terminalTick,terminalReason,transactionId,actorId=null}){
  const errors=validateReservationState(state);if(errors.length)return fail('reservation-state',state,{errors});
  const index=state.reservations.findIndex(r=>r.id===reservationId);if(index<0)return fail('reservation-missing',state);
  const current=state.reservations[index];
  if(current.status!==RESERVATION_STATUS.ACTIVE){
    if(current.status===status&&(status!==RESERVATION_STATUS.COMMITTED||current.transactionId===transactionId))
      return {state:'SAT',duplicate:true,reservation:Object.freeze(clone(current)),reservationState:clone(state)};
    return fail('reservation-terminal',state);
  }
  if(!nonnegative(terminalTick)||terminalTick<current.createdTick)return fail('terminal-tick',state);
  if(typeof terminalReason!=='string'||terminalReason.length<1||terminalReason.length>80)return fail('terminal-reason',state);
  if(status===RESERVATION_STATUS.COMMITTED&&!validId(transactionId))return fail('transactionId',state);
  if(status===RESERVATION_STATUS.CANCELED&&actorId!==current.buyerId&&actorId!==current.sellerId)return fail('cancel-actor',state);
  const next=clone(state);
  next.reservations[index]={...current,status,terminalTick,terminalReason,...(status===RESERVATION_STATUS.COMMITTED?{transactionId}:{})};
  const post=validateReservationState(next);if(post.length)return fail('reservation-postcondition',state,{errors:post});
  return {state:'SAT',duplicate:false,reservation:Object.freeze(clone(next.reservations[index])),reservationState:next};
}

export const commitReservation=(state,{reservationId,transactionId,terminalTick}={})=>
  terminalTransition(state,{reservationId,status:RESERVATION_STATUS.COMMITTED,transactionId,terminalTick,terminalReason:'trade-committed'});
export const releaseReservation=(state,{reservationId,terminalTick,reason='released'}={})=>
  terminalTransition(state,{reservationId,status:RESERVATION_STATUS.RELEASED,terminalTick,terminalReason:reason});
export const cancelReservation=(state,{reservationId,actorId,terminalTick,reason='canceled'}={})=>
  terminalTransition(state,{reservationId,status:RESERVATION_STATUS.CANCELED,actorId,terminalTick,terminalReason:reason});

export function reconcileReservations(world,state,{listings=[]}={}){
  const errors=validateReservationState(state);if(errors.length)return fail('reservation-state',state,{errors});
  if(!Array.isArray(listings))return fail('listings',state);
  const byId=new Map(listings.map(l=>[l?.id,l])),next=clone(state);let changed=false;
  for(let i=0;i<next.reservations.length;i++){
    const r=next.reservations[i];if(r.status!==RESERVATION_STATUS.ACTIVE)continue;
    const listing=byId.get(r.listingId);let reason=null;
    if(!alive(world,r.buyerId)||!alive(world,r.sellerId))reason='party-dead';
    else if(!listing)reason='listing-missing';
    else if(listing.status!=='OPEN')reason='listing-not-open';
    else if(listing.revision!==r.listingRevision)reason='listing-stale';
    else if(listing.marketId!==r.marketId||listing.sellerId!==r.sellerId||listing.itemKind!==r.itemKind||listing.assetType!==r.assetType||listing.unitPrice!==r.unitPrice||listing.quantity<r.quantity)reason='listing-changed';
    if(reason){next.reservations[i]={...r,status:RESERVATION_STATUS.RELEASED,terminalTick:world.tick,terminalReason:reason};changed=true;}
  }
  const post=validateReservationState(next);if(post.length)return fail('reservation-postcondition',state,{errors:post});
  return {state:'SAT',changed,reservationState:next};
}

export function migrateReservationState(raw){
  if(raw===undefined||raw===null)return {state:'SAT',migrated:true,duplicate:false,reservationState:createReservationState()};
  const errors=validateReservationState(raw);
  if(errors.length)return {state:'VIOL',reason:'reservation-state',errors,reservationState:clone(raw)};
  return {state:'SAT',migrated:false,duplicate:true,reservationState:clone(raw)};
}
export function serializeReservationState(state){
  const errors=validateReservationState(state);if(errors.length)throw new Error('reservation-state-invalid:'+errors.join(','));
  return JSON.stringify(state);
}
export function restoreReservationState(serialized){
  const state=JSON.parse(serialized),errors=validateReservationState(state);
  if(errors.length)throw new Error('reservation-state-invalid:'+errors.join(','));
  return state;
}
