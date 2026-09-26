import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {personalHomeSite,homeOf} from '../src/individual-housing.mjs';
import {resourceStock,materialTotals} from '../src/individual-resources.mjs';
import {recordRelationshipEvidence,relationshipOf} from '../src/relationships.mjs';
import {
  startHouseholdTrade,pendingHouseholdTrade,completeHouseholdTrade,
  stepHouseholdTradePlanning
} from '../src/household-trade-authority.mjs';

function give(s,a,kind){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
}
function equipHammer(s,a){
  const id=give(s,a,'HAMMER');
  s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>e.agentId!==a.id);
  s.rustPossessions.equipment.push({agentId:a.id,itemId:id});
}
function place(s,a,kind,socket){
  const id=give(s,a,kind);
  return command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'trade-auth:'+s.tick+':'+a.id+':'+id});
}
function completeHome(s,a){
  const site=personalHomeSite(s,a,walkable);assert.ok(site);
  a.x=site.origin.x;a.y=site.origin.y;a.task=null;equipHammer(s,a);
  const {x,y}=site.origin;
  const rows=[
    place(s,a,'WOOD_FOUNDATION',{type:'cell',x,y}),
    place(s,a,'WOOD_WALL',canonicalEdge(x,y,'N')),
    place(s,a,'WOOD_WALL',canonicalEdge(x,y,'E')),
    place(s,a,'WOOD_WALL',canonicalEdge(x,y,'W')),
    place(s,a,'WOOD_DOORWAY',canonicalEdge(x,y,'S')),
    place(s,a,'WOOD_ROOF',{type:'cell',x,y})
  ];
  assert.ok(rows.every(r=>r.ok),JSON.stringify(rows));
  return homeOf(s,a.id,{completeOnly:true});
}
function relate(s,a,b,key='trade-rel'){
  assert.equal(recordRelationshipEvidence(s,{fromId:a.id,toId:b.id,kind:'test',key:key+':a',delta:{trust:2,affinity:2}}).ok,true);
  assert.equal(recordRelationshipEvidence(s,{fromId:b.id,toId:a.id,kind:'test',key:key+':b',delta:{trust:2,affinity:2}}).ok,true);
}
function tradeWorld(){
  const s=createWorld(230926,{mode:'independent'}),source=s.agents[1],dest=s.agents[2];
  const sourceHome=completeHome(s,source),destHome=completeHome(s,dest);
  Object.assign(resourceStock(s,source),{food:30,wood:30,stone:20});
  Object.assign(resourceStock(s,dest),{food:0,wood:0,stone:0});
  relate(s,source,dest);
  source.satiety=100;source.energy=100;source.task=null;
  return {s,source,dest,sourceHome,destHome};
}

test('IC7B no reciprocal relationship means no authoritative trade contract',()=>{
  const s=createWorld(230926,{mode:'independent'}),source=s.agents[1],dest=s.agents[2];
  completeHome(s,source);completeHome(s,dest);
  Object.assign(resourceStock(s,source),{food:30,wood:30,stone:20});
  Object.assign(resourceStock(s,dest),{food:0,wood:0,stone:0});
  const r=startHouseholdTrade(s,{originOwnerId:source.id,destinationOwnerId:dest.id,good:'food'});
  assert.equal(r.ok,false);assert.equal(r.reason,'relationship');
  assert.equal(s.householdTrade.contracts.length,0);
});

test('IC7B start atomically moves source surplus into conserved cargo exactly once',()=>{
  const {s,source,dest}=tradeWorld();
  const beforeTotal=materialTotals(s).food,beforeSource=resourceStock(s,source).food;
  const r=command(s,'START_HOUSEHOLD_TRADE',{originOwnerId:source.id,destinationOwnerId:dest.id,good:'food'});
  assert.equal(r.ok,true);assert.equal(r.changed,true);
  const c=s.householdTrade.contracts[0];
  assert.equal(c.status,'in-transit');assert.equal(c.cargoQuantity,c.quantity);
  assert.equal(resourceStock(s,source).food,beforeSource-c.quantity);
  assert.equal(materialTotals(s).food,beforeTotal,'cargo remains in world aggregate');
  assert.equal(pendingHouseholdTrade(s,source).contractId,c.id);
  assert.deepEqual(validate(s),[]);
});

test('IC7B carrier walks through normal task system and delivers once at destination home',()=>{
  const {s,source,dest,destHome}=tradeWorld();
  const beforeDest=resourceStock(s,dest).food;
  const r=command(s,'START_HOUSEHOLD_TRADE',{originOwnerId:source.id,destinationOwnerId:dest.id,good:'food'});
  assert.equal(r.ok,true);const id=r.contract.id,qty=r.contract.quantity;
  let ticks=0;
  while(s.householdTrade.contracts.find(c=>c.id===id).status==='in-transit'&&ticks<220){step(s,1);ticks++;}
  const c=s.householdTrade.contracts.find(c=>c.id===id);
  assert.equal(c.status,'completed',JSON.stringify({ticks,c,source:{x:source.x,y:source.y},dest:destHome.origin}));
  assert.equal(c.cargoQuantity,0);
  assert.deepEqual({x:source.x,y:source.y},destHome.origin);
  assert.equal(resourceStock(s,dest).food,beforeDest+qty);
  assert.equal(completeHouseholdTrade(s,source.id).ok,false,'completed cargo cannot deliver twice');
  assert.deepEqual(validate(s),[]);
});

test('IC7B successful delivery creates reciprocal trust and destination debt evidence',()=>{
  const {s,source,dest}=tradeWorld();
  const beforeA=relationshipOf(s,source.id,dest.id),beforeB=relationshipOf(s,dest.id,source.id);
  const r=startHouseholdTrade(s,{originOwnerId:source.id,destinationOwnerId:dest.id,good:'food'});assert.equal(r.ok,true);
  const home=homeOf(s,dest.id,{completeOnly:true});source.x=home.origin.x;source.y=home.origin.y;s.tick++;
  const done=completeHouseholdTrade(s,source.id);assert.equal(done.ok,true);
  const afterA=relationshipOf(s,source.id,dest.id),afterB=relationshipOf(s,dest.id,source.id);
  assert.equal(afterA.trust,beforeA.trust+1);
  assert.equal(afterB.trust,beforeB.trust+1);
  assert.equal(afterB.affinity,beforeB.affinity+1);
  assert.ok(afterB.debt>beforeB.debt);
  assert.equal(afterA.evidence.some(e=>e.kind==='trade-delivery'),true);
  assert.equal(afterB.evidence.some(e=>e.kind==='trade-delivery'),true);
});

test('IC7B carrier death strands cargo at death location without losing world materials',()=>{
  const {s,source,dest}=tradeWorld();
  const before=materialTotals(s).food;
  const r=startHouseholdTrade(s,{originOwnerId:source.id,destinationOwnerId:dest.id,good:'food'});assert.equal(r.ok,true);
  source.satiety=0;source.hp=.1;source.task=null;
  const deathPos={x:source.x,y:source.y};step(s,1);
  assert.equal(source.alive,false);
  const c=s.householdTrade.contracts.find(c=>c.id===r.contract.id);
  assert.equal(c.status,'stranded');assert.equal(c.cargoQuantity,c.quantity);
  assert.deepEqual({x:c.strandedAt.x,y:c.strandedAt.y},deathPos);
  assert.equal(materialTotals(s).food,before);
  assert.deepEqual(validate(s),[]);
});

test('IC7B active cargo survives save/load and deterministic continuation',()=>{
  const {s,source,dest}=tradeWorld();
  const r=startHouseholdTrade(s,{originOwnerId:source.id,destinationOwnerId:dest.id,good:'wood'});assert.equal(r.ok,true);
  const text=serialize(s),a=restore(text),b=restore(text);
  assert.equal(a.householdTrade.contracts[0].status,'in-transit');
  step(a,40);for(let i=0;i<40;i++)step(b,1);
  assert.equal(serialize(a),serialize(b));
  assert.deepEqual(validate(a),[]);
});

test('IC7B automatic planner starts at most one relationship-backed contract per 120-tick cycle',()=>{
  const {s}=tradeWorld();s.tick=120;
  const r=stepHouseholdTradePlanning(s);assert.equal(r.ok,true);
  assert.equal(s.householdTrade.contracts.length,1);
  const again=stepHouseholdTradePlanning(s);
  assert.ok(again===null||again.ok===false,'same cycle cannot create a second usable contract without another free carrier');
  assert.equal(s.householdTrade.contracts.filter(c=>c.status==='in-transit').length,1);
});

test('IC7B legacy mode remains outside household trade authority',()=>{
  const s=createWorld(230926);
  const r=command(s,'START_HOUSEHOLD_TRADE',{originOwnerId:1,destinationOwnerId:2,good:'food'});
  assert.equal(r.ok,false);assert.equal(r.reason,'mode');
  assert.equal(s.householdTrade,undefined);
  assert.deepEqual(validate(s),[]);
});
