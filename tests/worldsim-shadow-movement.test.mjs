import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize} from '../src/engine.mjs';
import {createWorldMapView,SHADOW_MOVEMENT_COST,shadowMovementCell,shadowRouteMovementCost} from '../src/worldsim-map.mjs';

test('shadow movement costs are ordered and water stays non-traversable',()=>{
  assert.ok(SHADOW_MOVEMENT_COST.bridge<SHADOW_MOVEMENT_COST.path);
  assert.ok(SHADOW_MOVEMENT_COST.path<SHADOW_MOVEMENT_COST.grass);
  assert.ok(SHADOW_MOVEMENT_COST.grass<SHADOW_MOVEMENT_COST.sand);
  assert.ok(SHADOW_MOVEMENT_COST.sand<SHADOW_MOVEMENT_COST.forest);
  assert.ok(SHADOW_MOVEMENT_COST.forest<SHADOW_MOVEMENT_COST.rock);
  assert.equal(SHADOW_MOVEMENT_COST.deepWater,null);
  assert.equal(SHADOW_MOVEMENT_COST.shallowWater,null);
});

test('shadow movement observation never mutates simulation state',()=>{
  const s=createWorld(230926),before=serialize(s),view=createWorldMapView(s);
  for(const c of view.cells)shadowMovementCell(view,c.x,c.y);
  assert.equal(serialize(s),before);
});

test('shadow route cost is deterministic and detached',()=>{
  const s=createWorld(42),view=createWorldMapView(s);
  const path=[{x:11,y:12},{x:12,y:12},{x:13,y:12}];
  const a=shadowRouteMovementCost(view,path),b=shadowRouteMovementCost(view,path);
  assert.deepEqual(a,b);assert.equal(a.steps,3);assert.ok(a.cost>0);assert.equal(Object.isFrozen(a),true);
});

test('shadow route rejects blocked water rather than inventing crossing cost',()=>{
  const s=createWorld(77),view=createWorldMapView(s),water=view.cells.find(c=>c.gameplayTile==='water');
  assert.ok(water);assert.equal(shadowRouteMovementCost(view,[{x:water.x,y:water.y}]),null);
});

test('observing shadow costs every tick cannot change deterministic execution',()=>{
  const a=createWorld(9191),b=createWorld(9191);
  for(let i=0;i<720;i++){
    const view=createWorldMapView(a),agent=a.agents.find(x=>x.alive);
    shadowRouteMovementCost(view,agent?.task?.path??[]);
    step(a);step(b);
  }
  assert.equal(serialize(a),serialize(b));
});
