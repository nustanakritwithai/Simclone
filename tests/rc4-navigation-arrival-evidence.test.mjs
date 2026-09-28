import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step} from '../src/engine.mjs';
import {
  NAVIGATION_ARRIVAL_PERSISTENCE,
  beginNavigationArrivalJourney,
  observeNavigationArrivalJourney,
  verifyNavigationArrivalEvidence
} from '../src/navigation-arrival-evidence.mjs';

function findWalkingTask(world){
  for(let i=0;i<80;i++){
    step(world,1);
    const found=world.agents.find(a=>a.alive&&a.task&&Array.isArray(a.task.path)&&a.task.path.length>=2);
    if(found)return found;
  }
  return null;
}

test('RC4 B3: Navigation evidence is emitted only after canonical engine walking reaches the market range',()=>{
  const s=createWorld(230926);for(const a of s.agents){a.satiety=95;a.energy=95;}
  const a=findWalkingTask(s);assert.ok(a,'deterministic fixture must produce a walking task');
  const market={id:'HM:NAV-1',open:true,x:a.task.x,y:a.task.y,tradeRange:1};
  const begun=beginNavigationArrivalJourney(s,{agentId:a.id,market});assert.equal(begun.state,'SAT');
  let j=begun.journey,result=null;
  for(let i=0;i<400&&!result?.arrived;i++){
    step(s,1);
    const observed=observeNavigationArrivalJourney(s,j);
    assert.equal(observed.state,'SAT',observed.reason);
    j=observed.journey;result=observed;
  }
  assert.equal(result?.arrived,true);
  assert.ok(result.evidence.evidenceId.startsWith('NAVE:'));
  assert.equal(result.evidence.agentId,a.id);
  assert.equal(result.evidence.marketId,market.id);
  assert.equal(verifyNavigationArrivalEvidence(s,result.evidence,{agentId:a.id,market}).state,'SAT');
});

test('RC4 B3: teleport/deviation cannot manufacture arrival evidence',()=>{
  const s=createWorld(230926);for(const a of s.agents){a.satiety=95;a.energy=95;}
  const a=findWalkingTask(s);assert.ok(a);
  const market={id:'HM:NAV-2',open:true,x:a.task.x,y:a.task.y,tradeRange:1};
  const begun=beginNavigationArrivalJourney(s,{agentId:a.id,market});assert.equal(begun.state,'SAT');
  const last=begun.journey.route.at(-1);a.x=last.x;a.y=last.y;a.task.path=[];
  const r=observeNavigationArrivalJourney(s,begun.journey);
  assert.equal(r.state,'VIOL');assert.ok(['navigation-deviation','navigation-path-drift'].includes(r.reason));
});

test('RC4 B3: fake verified:true, stale tick, wrong agent/market and coordinate drift all fail closed',()=>{
  const s=createWorld(230926);for(const a of s.agents){a.satiety=95;a.energy=95;}
  const a=findWalkingTask(s);assert.ok(a);
  const market={id:'HM:NAV-3',open:true,x:a.task.x,y:a.task.y,tradeRange:1};
  let j=beginNavigationArrivalJourney(s,{agentId:a.id,market}).journey,r=null;
  for(let i=0;i<400&&!r?.arrived;i++){step(s,1);r=observeNavigationArrivalJourney(s,j);assert.equal(r.state,'SAT');j=r.journey;}
  const e=r.evidence;
  assert.equal(verifyNavigationArrivalEvidence(s,{verified:true,agentId:a.id,marketId:market.id,x:a.x,y:a.y,tick:s.tick},{agentId:a.id,market}).state,'VIOL');
  assert.equal(verifyNavigationArrivalEvidence(s,e,{agentId:a.id+100,market}).reason,'agent-mismatch');
  assert.equal(verifyNavigationArrivalEvidence(s,e,{agentId:a.id,market:{...market,id:'HM:OTHER'}}).reason,'market-mismatch');
  assert.equal(verifyNavigationArrivalEvidence(s,e,{agentId:a.id,market:{...market,x:market.x+1}}).reason,'market-coordinates-mismatch');
  s.tick++;
  assert.equal(verifyNavigationArrivalEvidence(s,e,{agentId:a.id,market}).reason,'stale-evidence');
});

test('RC4 B3: closed market and task not ending in trade range do not start a journey',()=>{
  const s=createWorld(230926);for(const a of s.agents){a.satiety=95;a.energy=95;}
  const a=findWalkingTask(s);assert.ok(a);
  const market={id:'HM:NAV-4',open:false,x:a.task.x,y:a.task.y,tradeRange:1};
  assert.equal(beginNavigationArrivalJourney(s,{agentId:a.id,market}).reason,'market-closed');
  const far={...market,open:true,x:0,y:0};
  if(Math.abs(a.task.x-far.x)+Math.abs(a.task.y-far.y)>far.tradeRange)
    assert.equal(beginNavigationArrivalJourney(s,{agentId:a.id,market:far}).reason,'task-not-market');
});

test('RC4 B3: arrival evidence is explicitly ephemeral across save/load',()=>{
  assert.equal(NAVIGATION_ARRIVAL_PERSISTENCE,'EPHEMERAL_REGENERATE_AFTER_LOAD');
});


test('RC4 B3 provenance: byte-identical cloned journey cannot continue observation',()=>{
  const s=createWorld(230926);for(const a of s.agents){a.satiety=95;a.energy=95;}
  const a=findWalkingTask(s);assert.ok(a);
  const market={id:'HM:NAV-CAP-J',open:true,x:a.task.x,y:a.task.y,tradeRange:1};
  const begun=beginNavigationArrivalJourney(s,{agentId:a.id,market});assert.equal(begun.state,'SAT');
  const cloned=structuredClone(begun.journey);
  const r=observeNavigationArrivalJourney(s,cloned);
  assert.equal(r.state,'VIOL');assert.equal(r.reason,'journey-provenance');
});

test('RC4 B3 provenance: fully forged matching evidence cannot verify even if every field matches',()=>{
  const s=createWorld(230926);for(const a of s.agents){a.satiety=95;a.energy=95;}
  const a=findWalkingTask(s);assert.ok(a);
  const market={id:'HM:NAV-CAP-E',open:true,x:a.task.x,y:a.task.y,tradeRange:1};
  let j=beginNavigationArrivalJourney(s,{agentId:a.id,market}).journey,r=null;
  for(let i=0;i<400&&!r?.arrived;i++){step(s,1);r=observeNavigationArrivalJourney(s,j);assert.equal(r.state,'SAT',r.reason);j=r.journey;}
  assert.equal(r.arrived,true);
  const forged=structuredClone(r.evidence);
  assert.deepEqual(forged,r.evidence);
  const rejected=verifyNavigationArrivalEvidence(s,forged,{agentId:a.id,market});
  assert.equal(rejected.state,'VIOL');assert.equal(rejected.reason,'evidence-provenance');
  assert.equal(verifyNavigationArrivalEvidence(s,r.evidence,{agentId:a.id,market}).state,'SAT');
});

test('RC4 B3 provenance: capability is bound to exact live world identity',()=>{
  const s=createWorld(230926);for(const a of s.agents){a.satiety=95;a.energy=95;}
  const a=findWalkingTask(s);assert.ok(a);
  const market={id:'HM:NAV-CAP-W',open:true,x:a.task.x,y:a.task.y,tradeRange:1};
  const begun=beginNavigationArrivalJourney(s,{agentId:a.id,market});assert.equal(begun.state,'SAT');
  const copiedWorld=structuredClone(s);
  const rejected=observeNavigationArrivalJourney(copiedWorld,begun.journey);
  assert.equal(rejected.state,'VIOL');assert.equal(rejected.reason,'journey-provenance');
});
