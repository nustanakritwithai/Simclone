import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,command,validate,walkable} from '../src/engine.mjs';
import {houseSite} from '../src/housing.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';

function give(s,a,kind){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
}
function completeHome(s,a,label){
  const site=houseSite(s,walkable).origin;
  a.x=site.x;a.y=site.y;a.task=null;a.moveTick=0;
  const hammer=give(s,a,'HAMMER');
  s.rustPossessions.equipment.push({agentId:a.id,itemId:hammer});
  const place=(kind,socket)=>{
    const itemId=give(s,a,kind);
    const r=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:itemId,socket,placementId:`merchant-auto:${label}:${itemId}`});
    assert.equal(r.ok,true,JSON.stringify(r));
  };
  const {x,y}=site;
  place('WOOD_FOUNDATION',{type:'cell',x,y});
  place('WOOD_WALL',canonicalEdge(x,y,'N'));
  place('WOOD_WALL',canonicalEdge(x,y,'E'));
  place('WOOD_WALL',canonicalEdge(x,y,'W'));
  place('WOOD_DOORWAY',canonicalEdge(x,y,'S'));
  place('WOOD_ROOF',{type:'cell',x,y});
}
function calm(s){
  for(const a of s.agents){a.satiety=100;a.energy=100;a.task=null;a.moveTick=0;}
}

test('eligible home owner with self-produced tradable item autonomously becomes one Merchant',()=>{
  const s=createWorld(91001),candidate=s.agents[0];
  calm(s);completeHome(s,candidate,'eligible');give(s,candidate,'STONE_AXE');
  s.tick=29;
  step(s,1);
  const live=s.agents.find(a=>a.id===candidate.id);
  assert.equal(live.profession,'merchant');
  assert.equal(s.agents.filter(a=>a.alive&&a.profession==='merchant').length,1);
  const market=s.homeMarkets.markets.find(m=>m.ownerAgentId===live.id);
  assert.ok(market,'autonomous Merchant gets canonical Home Market');
  assert.equal(market.status,'closed','autonomy prepares a closed market; it does not fabricate listings/prices');
  assert.ok(s.merchantLedgers.ledgers.some(l=>l.merchantId===live.id));
  assert.ok(s.events.some(e=>e.type==='career'&&e.agentId===live.id&&e.text.includes('Merchant')));
  assert.deepEqual(validate(s),[]);

  step(s,60);
  assert.equal(s.agents.filter(a=>a.alive&&a.profession==='merchant').length,1,'quota prevents Merchant spam');
  assert.deepEqual(validate(s),[]);
});

test('home and money without physical trade evidence does not auto-promote Merchant',()=>{
  const s=createWorld(91002),candidate=s.agents[0];
  calm(s);completeHome(s,candidate,'no-evidence');
  s.tick=29;
  step(s,1);
  assert.notEqual(s.agents.find(a=>a.id===candidate.id).profession,'merchant');
  assert.equal(s.agents.filter(a=>a.alive&&a.profession==='merchant').length,0);
  assert.deepEqual(validate(s),[]);
});

test('Adventurer lock wins over autonomous Merchant entry',()=>{
  const s=createWorld(91003),candidate=s.agents[0];
  calm(s);completeHome(s,candidate,'adventurer');give(s,candidate,'STONE_AXE');
  candidate.profession='adventurer';
  candidate.professionSinceTick=s.tick;
  candidate.career=[{tick:s.tick,profession:'adventurer'}];
  s.tick=29;
  step(s,1);
  assert.equal(s.agents.find(a=>a.id===candidate.id).profession,'adventurer');
  assert.equal(s.agents.filter(a=>a.alive&&a.profession==='merchant').length,0);
  assert.deepEqual(validate(s),[]);
});
