import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESERVATION_STATUS,
  createReservationState,
  createReservation,
  validateReservationState,
  globalActiveReservations,
  commitReservation,
  releaseReservation,
  cancelReservation,
  reconcileReservations,
  migrateReservationState,
  serializeReservationState,
  restoreReservationState
} from '../src/merchant-reservation.mjs';

const world=(tick=10)=>({tick,agents:[{id:1,alive:true},{id:2,alive:true},{id:3,alive:true}]});
const listing=(patch={})=>({id:'L1',marketId:'M1',revision:3,sellerId:1,itemKind:'PICKAXE',quantity:2,unitPrice:70,status:'OPEN',...patch});

test('RC4 B4: deterministic create + exact replay are idempotent',()=>{
  const w=world(),s=createReservationState(),req={listing:listing(),listingRevision:3,buyerId:2,itemIds:[12,11]};
  const a=createReservation(w,s,req),b=createReservation(w,a.reservationState,req);
  assert.equal(a.state,'SAT');assert.equal(a.duplicate,false);assert.equal(b.state,'SAT');assert.equal(b.duplicate,true);
  assert.equal(a.reservation.id,b.reservation.id);assert.deepEqual(a.reservation.itemIds,[11,12]);
  assert.equal(JSON.stringify(a.reservationState),JSON.stringify(b.reservationState));
});

test('RC4 B4: stale listing revision and dead parties fail closed',()=>{
  const s=createReservationState();
  assert.equal(createReservation(world(),s,{listing:listing(),listingRevision:2,buyerId:2,itemIds:[11]}).reason,'listing-stale');
  const wb=world();wb.agents.find(a=>a.id===2).alive=false;
  assert.equal(createReservation(wb,s,{listing:listing(),listingRevision:3,buyerId:2,itemIds:[11]}).reason,'buyer-dead');
  const ws=world();ws.agents.find(a=>a.id===1).alive=false;
  assert.equal(createReservation(ws,s,{listing:listing(),listingRevision:3,buyerId:2,itemIds:[11]}).reason,'seller-dead');
  assert.equal(createReservation(world(),s,{listing:listing({status:'CANCELED'}),listingRevision:3,buyerId:2,itemIds:[11]}).reason,'listing-not-open');
});

test('RC4 B4: active item lock is global across markets',()=>{
  const w=world(),a=createReservation(w,createReservationState(),{listing:listing(),listingRevision:3,buyerId:2,itemIds:[11]});
  const other=listing({id:'L2',marketId:'M2',sellerId:3});
  const b=createReservation(w,a.reservationState,{listing:other,listingRevision:3,buyerId:2,itemIds:[11]});
  assert.equal(b.state,'VIOL');assert.equal(b.reason,'item-reserved');
  const active=globalActiveReservations(a.reservationState);
  assert.equal(active.length,1);assert.equal(active[0].marketId,'M1');
});

test('RC4 B4: duplicate reservation id corruption fails closed',()=>{
  const w=world(),a=createReservation(w,createReservationState(),{listing:listing(),listingRevision:3,buyerId:2,itemIds:[11]});
  const forged=structuredClone(a.reservationState);forged.reservations.push(structuredClone(forged.reservations[0]));
  assert.ok(validateReservationState(forged).includes('duplicate-id'));
  assert.equal(globalActiveReservations(forged),null);
  assert.throws(()=>restoreReservationState(JSON.stringify(forged)),/reservation-state-invalid/);
});

test('RC4 B4: terminal lifecycle releases item locks exactly once',()=>{
  const w=world(),a=createReservation(w,createReservationState(),{listing:listing(),listingRevision:3,buyerId:2,itemIds:[11]});
  const id=a.reservation.id;
  const committed=commitReservation(a.reservationState,{reservationId:id,transactionId:'TX1',terminalTick:11});
  assert.equal(committed.state,'SAT');assert.equal(committed.reservation.status,RESERVATION_STATUS.COMMITTED);
  const replay=commitReservation(committed.reservationState,{reservationId:id,transactionId:'TX1',terminalTick:99});
  assert.equal(replay.state,'SAT');assert.equal(replay.duplicate,true);assert.equal(JSON.stringify(replay.reservationState),JSON.stringify(committed.reservationState));
  assert.equal(globalActiveReservations(committed.reservationState).length,0);
  const w2=world(12),fresh=createReservation(w2,committed.reservationState,{listing:listing(),listingRevision:3,buyerId:3,itemIds:[11]});
  assert.equal(fresh.state,'SAT','terminal reservation no longer owns the item lock');
});

test('RC4 B4: release/cancel are terminal and cancel is party-controlled',()=>{
  const w=world(),a=createReservation(w,createReservationState(),{listing:listing(),listingRevision:3,buyerId:2,itemIds:[11]});
  assert.equal(cancelReservation(a.reservationState,{reservationId:a.reservation.id,actorId:3,terminalTick:11}).reason,'cancel-actor');
  const canceled=cancelReservation(a.reservationState,{reservationId:a.reservation.id,actorId:2,terminalTick:11});
  assert.equal(canceled.state,'SAT');assert.equal(canceled.reservation.status,'CANCELED');
  const again=releaseReservation(canceled.reservationState,{reservationId:a.reservation.id,terminalTick:12});
  assert.equal(again.state,'VIOL');assert.equal(again.reason,'reservation-terminal');
});

test('RC4 B4: reconciliation releases dead/stale/closed reservations without deleting history',()=>{
  const w=world(),a=createReservation(w,createReservationState(),{listing:listing(),listingRevision:3,buyerId:2,itemIds:[11]});
  const stale=reconcileReservations({...w,tick:20},a.reservationState,{listings:[listing({revision:4})]});
  assert.equal(stale.state,'SAT');assert.equal(stale.changed,true);assert.equal(stale.reservationState.reservations[0].status,'RELEASED');assert.equal(stale.reservationState.reservations[0].terminalReason,'listing-stale');
  assert.equal(globalActiveReservations(stale.reservationState).length,0);
});

test('RC4 B4: save/load preserves active locks and replay state',()=>{
  const w=world(),a=createReservation(w,createReservationState(),{listing:listing(),listingRevision:3,buyerId:2,itemIds:[11]});
  const saved=serializeReservationState(a.reservationState),loaded=restoreReservationState(saved);
  assert.equal(JSON.stringify(loaded),saved);assert.equal(globalActiveReservations(loaded).length,1);
  const replay=createReservation(w,loaded,{listing:listing(),listingRevision:3,buyerId:2,itemIds:[11]});
  assert.equal(replay.state,'SAT');assert.equal(replay.duplicate,true);assert.equal(JSON.stringify(replay.reservationState),saved);
});

test('RC4 B4: old-save migration is one-shot; corrupt present state never resets to empty',()=>{
  const first=migrateReservationState(undefined);assert.equal(first.state,'SAT');assert.equal(first.migrated,true);
  const second=migrateReservationState(first.reservationState);assert.equal(second.state,'SAT');assert.equal(second.migrated,false);assert.equal(second.duplicate,true);
  assert.equal(JSON.stringify(second.reservationState),JSON.stringify(first.reservationState));
  const corrupt=migrateReservationState({version:'bad',reservations:[]});
  assert.equal(corrupt.state,'VIOL');assert.equal(corrupt.reason,'reservation-state');
});
