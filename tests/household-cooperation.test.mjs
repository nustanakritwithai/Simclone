import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,command,serialize,restore,walkable} from '../src/engine.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {personalHomeSite,homeOf} from '../src/individual-housing.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {recordRelationshipEvidence,activeResidenceOf} from '../src/relationships.mjs';
import {householdCooperationSignal,HOUSEHOLD_COOPERATION_VERSION,MAX_HOUSEHOLD_COOPERATION_BONUS} from '../src/household-cooperation.mjs';

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
  return command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'ic7b:'+s.tick+':'+a.id+':'+id});
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
function qualify(s,subject,owner,key='ic7b'){
  assert.equal(recordRelationshipEvidence(s,{fromId:subject.id,toId:owner.id,kind:'test',key:key+':from',delta:{trust:4,affinity:2}}).ok,true);
  assert.equal(recordRelationshipEvidence(s,{fromId:owner.id,toId:subject.id,kind:'test',key:key+':to',delta:{affinity:2}}).ok,true);
}
function joinedHouse(){
  const s=createWorld(230926,{mode:'independent'});
  const owner=s.agents[2],worker=s.agents[4]; // siblings; direct parent↔child cohabitation is intentionally forbidden.
  const home=completeHome(s,owner);qualify(s,worker,owner);
  const joined=command(s,'JOIN_HOUSEHOLD',{agentId:worker.id,ownerId:owner.id});
  assert.equal(joined.ok,true,JSON.stringify(joined));
  assert.equal(activeResidenceOf(s,worker.id)?.houseId,home.houseId);
  worker.satiety=100;worker.energy=100;worker.task=null;worker.preference='WOODCUT';worker.profession='woodcutter';
  const pool=resourceStock(s,owner);
  return {s,owner,worker,home,pool};
}

test('IC7B food scarcity activates bounded FORAGE cooperation only',()=>{
  const {s,worker,pool}=joinedHouse();pool.food=0;pool.wood=999;pool.stone=999;
  const forage=householdCooperationSignal(s,worker,'FORAGE');
  const wood=householdCooperationSignal(s,worker,'WOODCUT');
  const mine=householdCooperationSignal(s,worker,'MINE');
  assert.equal(forage.version,HOUSEHOLD_COOPERATION_VERSION);
  assert.equal(forage.active,true);assert.equal(forage.good,'food');
  assert.ok(forage.bonus>=24&&forage.bonus<=MAX_HOUSEHOLD_COOPERATION_BONUS);
  assert.equal(wood.bonus,0);assert.equal(mine.bonus,0);
});

test('IC7B wood and stone shortage map to the existing household labor roles',()=>{
  const woodCase=joinedHouse();woodCase.pool.food=999;woodCase.pool.wood=0;woodCase.pool.stone=999;
  const wood=householdCooperationSignal(woodCase.s,woodCase.worker,'WOODCUT');
  assert.equal(wood.active,true);assert.equal(wood.role,'woodcutter');assert.equal(wood.good,'wood');
  assert.ok(wood.bonus>0&&wood.bonus<=MAX_HOUSEHOLD_COOPERATION_BONUS);

  const stoneCase=joinedHouse();stoneCase.pool.food=999;stoneCase.pool.wood=999;stoneCase.pool.stone=0;
  const mine=householdCooperationSignal(stoneCase.s,stoneCase.worker,'MINE');
  assert.equal(mine.active,true);assert.equal(mine.role,'miner');assert.equal(mine.good,'stone');
  assert.ok(mine.bonus>0&&mine.bonus<=MAX_HOUSEHOLD_COOPERATION_BONUS);
});

test('IC7B signal is read-only and absent outside productive Independent household work',()=>{
  const {s,worker,pool}=joinedHouse();pool.food=0;pool.wood=999;pool.stone=999;
  const before=serialize(s);
  assert.equal(householdCooperationSignal(s,worker,'FORAGE',{emergency:true}).reason,'survival-emergency');
  assert.equal(householdCooperationSignal(s,worker,'FORAGE',{emergency:true}).bonus,0);
  assert.equal(serialize(s),before,'signal must not mutate state');

  const homeless=s.agents[2];
  assert.equal(householdCooperationSignal(s,homeless,'FORAGE').reason,'no-household');
  assert.equal(householdCooperationSignal(s,homeless,'FORAGE').bonus,0);

  const legacy=createWorld(42,{mode:'legacy'});
  assert.equal(householdCooperationSignal(legacy,legacy.agents[0],'FORAGE').reason,'legacy');
  assert.equal(householdCooperationSignal(legacy,legacy.agents[0],'FORAGE').bonus,0);
});

test('IC7B feeds household food shortage into the existing candidate scorer and selects FORAGE',()=>{
  const {s,owner,worker,pool}=joinedHouse();
  pool.food=0;pool.wood=999;pool.stone=999;
  owner.satiety=100;owner.energy=1;owner.task=null; // owner rests and does not reserve the food node before worker.
  const food=s.nodes.find(n=>n.type==='food'&&n.amount>0);assert.ok(food);
  worker.x=food.x;worker.y=food.y;worker.task=null;
  step(s,1);
  const forage=worker.trace.find(c=>c.kind==='FORAGE'||c.purposeKind==='FORAGE');
  assert.ok(forage,'expected FORAGE candidate');
  assert.ok((forage.factors.householdCooperation??0)>0);
  assert.equal(forage.score,Object.values(forage.factors).reduce((n,v)=>n+v,0));
  assert.equal(worker.task?.kind,'FORAGE','existing scorer should select FORAGE; IC7B never writes task directly');
});

test('IC7B survival emergency suppresses cooperation factor in the engine trace',()=>{
  const {s,owner,worker,pool}=joinedHouse();pool.food=0;pool.wood=999;pool.stone=999;
  owner.energy=1;owner.task=null;
  const food=s.nodes.find(n=>n.type==='food'&&n.amount>0);assert.ok(food);
  worker.x=food.x;worker.y=food.y;worker.satiety=1;worker.energy=100;worker.task=null;
  step(s,1);
  const forage=worker.trace.find(c=>c.kind==='FORAGE'||c.purposeKind==='FORAGE');assert.ok(forage);
  assert.equal(forage.factors.householdCooperation??0,0);
});

test('IC7B save/load continuation stays byte-deterministic',()=>{
  const a=joinedHouse();a.pool.food=0;a.pool.wood=40;a.pool.stone=20;
  const b=restore(serialize(a.s));
  for(let i=0;i<120;i++){step(a.s,1);step(b,1);}
  assert.equal(serialize(a.s),serialize(b));
});
