import test from 'node:test';
import assert from 'node:assert/strict';

import {command,serialize,walkable,validate} from '../src/engine.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {recipeMastery} from '../src/craft-recipe-knowledge.mjs';
import {projectActorObservedDemand} from '../src/economic-demand.mjs';
import {rc2World,craftFixtureItem} from './fixtures/rc2-world.mjs';

const calm=(...rows)=>{for(const a of rows){a.hp=a.satiety=a.energy=100;a.task=null;a.moveTick=0;}};

function freeBagSlot(s,a){
  const equipped=new Set((s.rustPossessions.equipment??[]).filter(e=>e.agentId===a.id).map(e=>e.itemId));
  const item=s.rustPossessions.items.filter(i=>i.location?.kind==='bag'&&i.location.agentId===a.id&&!equipped.has(i.id)).sort((x,y)=>x.id-y.id)[0];
  assert.ok(item);item.location={kind:'drop',sourceAgentId:a.id,tick:s.tick,x:a.x,y:a.y};
}

function qualifiedCrafter(s,a){
  assert.equal(adoptProfession(a,'BUILD',s.tick).changed,true);
  Object.assign(resourceStock(s,a),{food:900,wood:900,stone:900,ironIngot:120,steelIngot:90});
  calm(a);
  craftFixtureItem(s,a,'HAMMER');
  craftFixtureItem(s,a,'HAMMER_T2');
  craftFixtureItem(s,a,'HAMMER');
  craftFixtureItem(s,a,'HAMMER_T2');
  craftFixtureItem(s,a,'HAMMER');
  assert.equal(recipeMastery(a,'HAMMER'),4);
  assert.equal(recipeMastery(a,'HAMMER_T2'),2);
  const promoted=command(s,'RC5_BECOME_CRAFTER',{agentId:a.id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  freeBagSlot(s,a);calm(a);
  return a;
}

function nearby(s,a,b){
  for(let r=1;r<6;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    if(Math.abs(dx)+Math.abs(dy)!==r)continue;
    const x=a.x+dx,y=a.y+dy;
    if(walkable(s,x,y)){b.x=x;b.y=y;b.task=null;return;}
  }
  throw new Error('no nearby walkable cell');
}

function farAway(s,from,a){
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){
    if(Math.abs(x-from.x)+Math.abs(y-from.y)<24||!walkable(s,x,y))continue;
    a.x=x;a.y=y;a.task=null;return;
  }
  throw new Error('no far walkable cell');
}

function setup(){
  const s=rc2World(),merchant=s.agents[0],crafter=qualifiedCrafter(s,s.agents[1]);
  calm(merchant,crafter);
  const market=command(s,'RC4_CREATE_MARKET',{agentId:merchant.id});assert.equal(market.ok,true,JSON.stringify(market));
  const promoted=command(s,'RC4_BECOME_MERCHANT',{agentId:merchant.id});assert.equal(promoted.ok,true,JSON.stringify(promoted));
  merchant.preference='MINE';
  // Ensure a real productive tool need. This is pre-start fixture preparation only.
  const removed=new Set(s.rustPossessions.items.filter(i=>i.kind==='STONE_PICKAXE'&&i.location?.kind==='bag'&&i.location.agentId===merchant.id).map(i=>i.id));
  s.rustPossessions.items=s.rustPossessions.items.filter(i=>!removed.has(i.id));
  s.rustPossessions.equipment=s.rustPossessions.equipment.filter(e=>!removed.has(e.itemId));
  nearby(s,merchant,crafter);
  Object.assign(resourceStock(s,crafter),{food:900,wood:0,stone:900});
  calm(merchant,crafter);
  assert.deepEqual(validate(s),[]);
  return {s,merchant,crafter};
}

test('ER6 ER1 exposes only local live Crafter material shortage and remains read-only',()=>{
  const {s,merchant,crafter}=setup(),before=serialize(s);
  const projection=projectActorObservedDemand(s,merchant);
  assert.equal(projection.status,'SAT');
  assert.equal(serialize(s),before,'projection must not mutate world');
  const wood=projection.signals.find(x=>x.unit==='bulk-resource'&&x.itemKind==='wood');
  assert.ok(wood,'Merchant should observe nearby Crafter wood shortage');
  const source=wood.sources.find(x=>x.kind==='LOCAL_CRAFTER_MATERIAL_NEED'&&x.subjectAgentId===crafter.id);
  assert.ok(source,JSON.stringify(wood));
  assert.equal(source.side,'DEMAND');
  assert.equal(source.productItemKind,'STONE_PICKAXE');
  assert.ok(Number.isSafeInteger(source.quantity)&&source.quantity>0);
  assert.equal(wood.tradable,true);
});

test('ER6 local Crafter material signal disappears out of range or after shortage clears',()=>{
  const first=setup();
  farAway(first.s,first.crafter,first.merchant);
  const remote=projectActorObservedDemand(first.s,first.merchant);
  assert.equal(remote.status,'SAT');
  assert.equal(remote.signals.some(s=>s.sources.some(x=>x.kind==='LOCAL_CRAFTER_MATERIAL_NEED'&&x.subjectAgentId===first.crafter.id)),false);

  const second=setup();
  resourceStock(second.s,second.crafter).wood=999;
  const cleared=projectActorObservedDemand(second.s,second.merchant);
  assert.equal(cleared.status,'SAT');
  assert.equal(cleared.signals.some(s=>s.sources.some(x=>x.kind==='LOCAL_CRAFTER_MATERIAL_NEED'&&x.subjectAgentId===second.crafter.id)),false);
});
