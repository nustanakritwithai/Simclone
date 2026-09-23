import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,validate,serialize,restore,command,living,capacity,pathTo,walkable,SKILLS} from '../src/engine.mjs';
test('seed produces identical initial world',()=>assert.equal(serialize(createWorld(12)),serialize(createWorld(12))));
test('different seeds produce different maps',()=>assert.notDeepEqual(createWorld(1).nodes,createWorld(2).nodes));
test('10,000 ticks: deterministic, valid state, agents survive',()=>{
 const a=createWorld(),b=createWorld();a.buildings=a.buildings.slice(0,1);b.buildings=b.buildings.slice(0,1);step(a,10000);step(b,10000);
 assert.equal(serialize(a),serialize(b));assert.deepEqual(validate(a),[]);assert.equal(living(a).length,6);assert.ok(a.stats.gathered>0);
});
test('five seeds remain valid for 10,000 ticks',()=>{for(const seed of [1,42,2026,772,90001]){const s=createWorld(seed);step(s,10000);assert.deepEqual(validate(s),[]);assert.ok(living(s).length>0);}});
test('save/restore mid-task produces identical continuation',()=>{const a=createWorld(8);step(a,321);const b=restore(serialize(a));step(a,500);step(b,500);assert.equal(serialize(a),serialize(b));});
test('cloning uses selected parent, inherits all skills and charges once',()=>{
 const s=createWorld(),p=s.agents[2];p.skills.MINE=200;const food=s.stock.food,wood=s.stock.wood;
 const r=command(s,'CLONE',{parentId:p.id}),a=s.agents.at(-1);assert.equal(r.ok,true);assert.equal(a.parentId,p.id);assert.equal(a.generation,p.generation+1);
 for(const k of SKILLS)assert.equal(a.skills[k],Math.floor(p.skills[k]*.35));assert.equal(s.stock.food,food-8);assert.equal(s.stock.wood,wood-4);
});
test('invalid clone is atomic',()=>{const s=createWorld();s.stock.food=0;const before=serialize(s);assert.equal(command(s,'CLONE',{parentId:1}).ok,false);assert.equal(serialize(s),before);});
test('housing capacity is enforced',()=>{const s=createWorld();s.stock.food=999;s.stock.wood=999;while(living(s).length<capacity(s))assert.equal(command(s,'CLONE',{parentId:1}).ok,true);assert.equal(command(s,'CLONE',{parentId:1}).ok,false);});
test('construction finishes autonomously, increases housing, consumes once',()=>{
 const s=createWorld();const before=s.stock.wood;assert.equal(command(s,'BUILD',{x:14,y:11}).ok,true);assert.equal(s.stock.wood,before-12);
 assert.equal(command(s,'BUILD',{x:14,y:11}).ok,false);step(s,1200);assert.equal(s.buildings.at(-1).complete,true);assert.equal(capacity(s),18);assert.deepEqual(validate(s),[]);
});
test('water placement rejected with no mutation',()=>{const s=createWorld(),i=s.tiles.indexOf('water'),before=serialize(s);assert.equal(command(s,'BUILD',{x:i%30,y:Math.floor(i/30)}).ok,false);assert.equal(serialize(s),before);});
test('pathfinding crosses bridge and never walks in water',()=>{const s=createWorld();const p=pathTo(s,{x:11,y:12},{x:27,y:12});assert.ok(p?.length);for(const v of p)assert.ok(walkable(s,v.x,v.y));});
test('renderer is not needed to advance simulation',()=>{const s=createWorld();step(s,20);assert.equal(s.tick,20);assert.ok(s.agents.every(a=>a.trace.some(t=>t.status==='selected')));});
test('bounded history and memory',()=>{const s=createWorld();step(s,50000);assert.ok(s.events.length<=120);assert.ok(s.agents.every(a=>a.memory.length<=8));assert.deepEqual(validate(s),[]);});
test('corrupt and unsupported saves rejected',()=>{assert.throws(()=>restore('bad'));const s=createWorld();s.agents[0].x=-1;assert.throws(()=>restore(serialize(s)));s.version='99';assert.throws(()=>restore(serialize(s)));});
test('unique permanent appearance survives jobs and save/load',()=>{const s=createWorld();s.buildings=s.buildings.slice(0,1);const p=JSON.stringify(s.agents.map(a=>a.appearance));step(s,600);assert.equal(JSON.stringify(restore(serialize(s)).agents.map(a=>a.appearance)),p);assert.equal(new Set(s.agents.map(a=>a.appearance.coat)).size,6);});
