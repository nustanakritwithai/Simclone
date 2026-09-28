import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore} from '../src/engine.mjs';
import {createCanonicalMarketTravelTask,verifyCanonicalMarketArrival} from '../src/navigation-arrival-evidence.mjs?v=0.5.0';

const roots=['homeMarkets','merchantListings','merchantBuyOffers','merchantReservations','currencyWallet','tradeReplay','merchantLedgers'];
for(const key of roots)for(const variant of ['deleted','null'])test(`RC4 production: modern ${key} ${variant} cannot silently reset`,()=>{
  const s=createWorld(99);if(variant==='deleted')delete s[key];else s[key]=null;
  assert.throws(()=>restore(serialize(s)),/RC4 migration failed|Invalid restored world/);
});
test('RC4 production: complete pre-RC4 save bootstraps only once',()=>{
  const s=createWorld(99);for(const k of [...roots,'rc4EconomyVersion'])delete s[k];
  const once=restore(serialize(s)),twice=restore(serialize(once));
  assert.equal(serialize(once),serialize(twice));
  assert.equal(once.currencyWallet.bootstrap.totalGranted,600);
});
function travel(){
  const world=createWorld(99),agent=world.agents[0];agent.satiety=100;agent.energy=100;agent.task=null;
  const market={id:'M-audit',open:true,x:agent.x+1,y:agent.y,tradeRange:1};
  const r=createCanonicalMarketTravelTask(world,agent,market,[{x:market.x,y:market.y}]);
  assert.equal(r.state,'SAT');agent.task=r.task;agent.moveTick=0;
  return {world,agent,market};
}
test('RC4 production: emptying branded path and teleporting is not arrival',()=>{
  const {world,agent,market}=travel();agent.task.path.length=0;agent.x=market.x;agent.y=market.y;
  assert.notEqual(verifyCanonicalMarketArrival(world,{agentId:agent.id,market}).state,'SAT');
});
test('RC4 production: genuine task cannot be borrowed by another Clone',()=>{
  const {world,agent,market}=travel();step(world,3);
  const other=world.agents[1];other.task=agent.task;other.x=market.x;other.y=market.y;
  assert.notEqual(verifyCanonicalMarketArrival(world,{agentId:other.id,market}).state,'SAT');
});
test('RC4 production: genuine task cannot be moved to a different world',()=>{
  const {world,agent,market}=travel();step(world,3);
  const other=createWorld(99),b=other.agents.find(a=>a.id===agent.id);
  b.task=agent.task;b.x=market.x;b.y=market.y;other.tick=world.tick;
  assert.notEqual(verifyCanonicalMarketArrival(other,{agentId:b.id,market}).state,'SAT');
});
test('RC4 production: actual engine movement still reaches verified arrival',()=>{
  const {world,agent,market}=travel();step(world,3);
  assert.equal(verifyCanonicalMarketArrival(world,{agentId:agent.id,market}).state,'SAT');
});
