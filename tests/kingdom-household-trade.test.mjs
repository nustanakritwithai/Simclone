import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,serialize,restore,walkable} from '../src/engine.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {personalHomeSite,homeOf} from '../src/individual-housing.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {householdTradeOpportunities} from '../src/kingdom-household-trade.mjs';
import {householdEconomySnapshot} from '../src/kingdom-household-economy.mjs';

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
  return command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'trade:'+s.tick+':'+a.id+':'+id});
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

test('Kingdom trade shadow finds real surplus to real scarcity without mutating stock',()=>{
  const s=createWorld(230926,{mode:'independent'}),source=s.agents[1],dest=s.agents[2];
  const sh=completeHome(s,source),dh=completeHome(s,dest);
  Object.assign(resourceStock(s,source),{food:20,wood:20,stone:20});
  Object.assign(resourceStock(s,dest),{food:0,wood:0,stone:0});
  const before=serialize(s),rows=householdTradeOpportunities(s);
  assert.equal(serialize(s),before);
  const food=rows.find(r=>r.originHouseId===sh.houseId&&r.destinationHouseId===dh.houseId&&r.good==='food');
  assert.ok(food);
  assert.ok(food.exportableSurplus>0);assert.ok(food.destinationDeficit>0);
  assert.ok(food.quantity<=food.exportableSurplus);
  assert.ok(food.quantity<=food.destinationDeficit);
  assert.ok(food.quantity<=12);
  assert.equal(food.authoritative,false);
});

test('Kingdom trade shadow emits nothing when source has no surplus or destination has no shortage',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[1],b=s.agents[2];
  completeHome(s,a);completeHome(s,b);
  const ea=householdEconomySnapshot(s,a.id),eb=householdEconomySnapshot(s,b.id);
  Object.assign(resourceStock(s,a),{food:ea.economy.demand.food,wood:ea.economy.demand.wood,stone:ea.economy.demand.stone});
  Object.assign(resourceStock(s,b),{food:eb.economy.demand.food+20,wood:eb.economy.demand.wood+20,stone:eb.economy.demand.stone+20});
  const rows=householdTradeOpportunities(s).filter(r=>r.originOwnerId===a.id&&r.destinationOwnerId===b.id);
  assert.deepEqual(rows,[]);
});

test('Kingdom trade shadow uses physical house distance as a deterministic ranking penalty',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[1],b=s.agents[2],dest=s.agents[3];
  const ha=completeHome(s,a),hb=completeHome(s,b),hd=completeHome(s,dest);
  for(const src of [a,b])Object.assign(resourceStock(s,src),{food:20,wood:20,stone:20});
  Object.assign(resourceStock(s,dest),{food:0,wood:0,stone:0});
  const rows=householdTradeOpportunities(s).filter(r=>r.destinationHouseId===hd.houseId&&r.good==='food'&&[ha.houseId,hb.houseId].includes(r.originHouseId));
  assert.equal(rows.length,2);
  const byHouse=new Map(rows.map(r=>[r.originHouseId,r]));
  const ra=byHouse.get(ha.houseId),rb=byHouse.get(hb.houseId);
  assert.ok(ra&&rb);
  if(ra.distance!==rb.distance){
    const closer=ra.distance<rb.distance?ra:rb,farther=closer===ra?rb:ra;
    assert.ok(closer.score>farther.score);
  }else{
    assert.equal(ra.score,rb.score);
  }
});

test('Kingdom trade shadow save/load recomputes identical ordering and creates no market state',()=>{
  const s=createWorld(230926,{mode:'independent'}),a=s.agents[1],b=s.agents[2];
  completeHome(s,a);completeHome(s,b);
  Object.assign(resourceStock(s,a),{food:20,wood:20,stone:20});
  Object.assign(resourceStock(s,b),{food:0,wood:0,stone:0});
  const before=serialize(s),first=householdTradeOpportunities(s);
  const loaded=restore(before),second=householdTradeOpportunities(loaded);
  assert.deepEqual(second,first);
  assert.equal(serialize(s),before);
  assert.equal('marketIndex' in s,false);
  assert.equal('tradeContracts' in s,false);
  assert.equal('settlements' in s,false);
});
