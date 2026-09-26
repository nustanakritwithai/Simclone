import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,command,serialize,walkable} from '../src/engine.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {personalHomeSite,homeOf} from '../src/individual-housing.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {recordRelationshipEvidence,activeResidenceOf} from '../src/relationships.mjs';
import {autonomousLifeSnapshot,AUTONOMOUS_LIFE_VIEW_VERSION} from '../src/autonomous-life-view.mjs';

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
  return command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'val1:'+s.tick+':'+a.id+':'+id});
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
function joinedHouse(){
  const s=createWorld(230926,{mode:'independent',worldProfile:'large'});
  const owner=s.agents[2],worker=s.agents[4];
  const home=completeHome(s,owner);
  assert.equal(recordRelationshipEvidence(s,{fromId:worker.id,toId:owner.id,kind:'test',key:'val1:from',delta:{trust:4,affinity:2}}).ok,true);
  assert.equal(recordRelationshipEvidence(s,{fromId:owner.id,toId:worker.id,kind:'test',key:'val1:to',delta:{affinity:2}}).ok,true);
  const joined=command(s,'JOIN_HOUSEHOLD',{agentId:worker.id,ownerId:owner.id});
  assert.equal(joined.ok,true,JSON.stringify(joined));
  assert.equal(activeResidenceOf(s,worker.id)?.houseId,home.houseId);
  worker.satiety=100;worker.energy=100;worker.task=null;worker.preference='WOODCUT';worker.profession='woodcutter';
  return {s,owner,worker,home,pool:resourceStock(s,owner)};
}

test('VAL1 legacy mode has no autonomous-life projection',()=>{
  const s=createWorld(42,{mode:'legacy'});
  assert.equal(autonomousLifeSnapshot(s,s.agents[0].id),null);
});

test('VAL1 projection is read-only and current action follows the authoritative task',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'large'});
  step(s,1);
  const a=s.agents.find(a=>a.alive&&a.task);assert.ok(a);
  const before=serialize(s),view=autonomousLifeSnapshot(s,a.id);
  assert.equal(serialize(s),before);
  assert.equal(view.version,AUTONOMOUS_LIFE_VIEW_VERSION);
  assert.equal(view.currentAction.kind,a.task.kind);
  assert.equal(view.homePlan.label.length>0,true);
  if(view.decision.reason==='selected-trace'){
    assert.equal(view.decision.scoreMatches,true);
    assert.equal(view.decision.score,view.decision.factorSum);
  }
});

test('VAL1 exposes real IC7B cooperation evidence and household pressure without writing state',()=>{
  const {s,owner,worker,pool,home}=joinedHouse();
  pool.food=0;pool.wood=999;pool.stone=999;
  owner.satiety=100;owner.energy=1;owner.task=null;
  const food=s.nodes.find(n=>n.type==='food'&&n.amount>0);assert.ok(food);
  worker.x=food.x;worker.y=food.y;worker.task=null;
  step(s,1);
  const before=serialize(s),view=autonomousLifeSnapshot(s,worker.id);
  assert.equal(serialize(s),before);
  assert.equal(view.currentAction.kind,'FORAGE');
  assert.equal(view.decision.reason,'selected-trace');
  assert.equal(view.decision.scoreMatches,true);
  assert.ok(view.decision.factors.some(f=>f.key==='householdCooperation'&&f.value>0));
  assert.equal(view.household.houseId,home.houseId);
  assert.equal(view.household.stock.food,0);
  assert.equal(view.household.topOffer.role,'forager');
});
