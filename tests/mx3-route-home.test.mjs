import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,walkable} from '../src/engine.mjs';
import {routeField,routeFieldUncached,routeDistance} from '../src/survival.mjs';
import {routeCacheSnapshot,clearRouteCache,ROUTE_CACHE_LIMIT} from '../src/route-cache.mjs?v=0.5.0';
import {personalHomeSite} from '../src/individual-housing.mjs';
import {smartHomeSiteEvidence,chooseSmartHomeSite} from '../src/home-site-scoring.mjs';
import {worldBounds} from '../src/world-bounds.mjs';

test('MX3A cached route field is exactly equivalent to uncached BFS and leaves save bytes unchanged',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0],before=serialize(s);
  clearRouteCache(s);
  const uncached=routeFieldUncached(s,a),first=routeField(s,a),second=routeField(s,a);
  assert.deepEqual([...first.dist],[...uncached.dist]);
  assert.deepEqual([...first.parent],[...uncached.parent]);
  assert.equal(first.start,uncached.start);assert.equal(first.width,60);assert.equal(first.height,52);
  assert.strictEqual(first,second);
  const stats=routeCacheSnapshot(s);
  assert.equal(stats.misses,1);assert.equal(stats.hits,1);assert.equal(stats.entries,1);
  assert.equal(serialize(s),before);
});

test('MX3A route cache is bounded on the 60x52 world',()=>{
  const s=createWorld(42,{mode:'independent',worldProfile:'large',population:1});
  clearRouteCache(s);const b=worldBounds(s);
  let used=0;
  for(let y=0;y<b.h&&used<ROUTE_CACHE_LIMIT+12;y++)for(let x=0;x<b.w&&used<ROUTE_CACHE_LIMIT+12;x++){
    if(!walkable(s,x,y))continue;
    routeField(s,{x,y});used++;
  }
  const stats=routeCacheSnapshot(s);
  assert.equal(stats.entries,ROUTE_CACHE_LIMIT);
  assert.ok(stats.misses>=ROUTE_CACHE_LIMIT);
});

test('MX3A cache does not change route distances across repeated decisions',()=>{
  const s=createWorld(5150,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  clearRouteCache(s);
  const first=routeField(s,a),targets=s.nodes.filter(n=>n.amount>0).slice(0,20);
  const distances=targets.map(n=>routeDistance(first,n));
  const again=routeField(s,a);
  assert.deepEqual(targets.map(n=>routeDistance(again,n)),distances);
});

test('MX3B hidden remote resources do not affect home-site evidence',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0];
  const site={x:a.x,y:a.y};
  const before=smartHomeSiteEvidence(s,a,site);
  const b=worldBounds(s),far={x:a.x<b.w/2?b.w-2:1,y:a.y<b.h/2?b.h-2:1};
  s.nodes.push({id:999999,type:'food',x:far.x,y:far.y,amount:999,max:999});
  const after=smartHomeSiteEvidence(s,a,site);
  assert.deepEqual(after,before);
});

test('MX3B known resource belief can improve a candidate score without reading remote amount',()=>{
  const s=createWorld(9,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0],site={x:a.x,y:a.y};
  const before=smartHomeSiteEvidence(s,a,site);
  a.knowledgeState.beliefs.push({
    beliefId:'belief:test',key:'resource:900001',value:{resourceId:900001,type:'food',x:site.x,y:site.y},
    status:'UNVERIFIED',confidence:.5,sourceKind:'message',sourceAgentId:null,originEvidenceId:'test',
    evidenceIds:[],observedTick:null,receivedTick:s.tick
  });
  const after=smartHomeSiteEvidence(s,a,site);
  assert.ok(after.score>before.score);
  assert.equal(after.nearestKnownResource.food,0);
});

test('MX3B choice is deterministic and does not mutate the world',()=>{
  const s=createWorld(77,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0],before=serialize(s);
  const candidates=[];
  for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
    const x=a.x+dx,y=a.y+dy;
    if((dx||dy)&&walkable(s,x,y))candidates.push({x,y});
  }
  const x=chooseSmartHomeSite(s,a,candidates),y=chooseSmartHomeSite(s,a,candidates);
  assert.deepEqual(x,y);assert.equal(serialize(s),before);
});

test('MX3B personalHomeSite uses smart ranking only for Large World and preserves remembered plan',()=>{
  const s=createWorld(2026,{mode:'independent',worldProfile:'large',population:1}),a=s.agents[0],before=serialize(s);
  const first=personalHomeSite(s,a,walkable);
  assert.ok(first);assert.equal(first.existing,false);
  assert.equal(serialize(s),before);
  a.homePlan={version:'home-plan-1',x:first.origin.x,y:first.origin.y,createdTick:s.tick};
  const remembered=personalHomeSite(s,a,walkable);
  assert.deepEqual(remembered.origin,first.origin);
});
