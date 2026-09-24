import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,pathTo,serialize,step} from '../src/engine.mjs';
import {shadowWeightedRoute,compareShadowRouting} from '../src/worldsim-routing-shadow.mjs';

test('shadow weighted router is deterministic',()=>{
  const s=createWorld(230926),start={x:11,y:12},target={x:27,y:12};
  assert.deepEqual(shadowWeightedRoute(s,start,target),shadowWeightedRoute(s,start,target));
});
test('shadow weighted router never crosses gameplay water',()=>{
  const s=createWorld(42),r=shadowWeightedRoute(s,{x:11,y:12},{x:27,y:12});assert.ok(r);
  for(const p of r.path)assert.notEqual(s.tiles[p.y*30+p.x],'water');
});
test('weighted comparison does not replace authoritative BFS route',()=>{
  const s=createWorld(77),start={x:11,y:12},target={x:27,y:12},before=serialize(s);
  const bfs=pathTo(s,start,target),cmp=compareShadowRouting(s,start,target,bfs);
  assert.ok(bfs?.length);assert.ok(cmp.weighted?.path.length);assert.equal(serialize(s),before);
});
test('shadow router returns null for blocked endpoints',()=>{
  const s=createWorld(1),i=s.tiles.indexOf('water'),water={x:i%30,y:Math.floor(i/30)};
  assert.equal(shadowWeightedRoute(s,{x:11,y:12},water),null);
});
test('observing weighted alternatives every tick cannot alter deterministic execution',()=>{
  const a=createWorld(2026),b=createWorld(2026);
  for(let i=0;i<360;i++){
    const agent=a.agents.find(x=>x.alive),task=agent?.task;
    if(task)compareShadowRouting(a,{x:agent.x,y:agent.y},{x:task.x,y:task.y},task.path);
    step(a);step(b);
  }
  assert.equal(serialize(a),serialize(b));
});
