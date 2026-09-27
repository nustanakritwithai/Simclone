import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {createWorld,serialize} from '../src/engine.mjs';
import {
  WORLD_PRESENTATION_VERSION,
  WORLD_PRESENTATION_KINDS,
  worldPresentationRegions,
  worldPresentationEntities,
  worldPresentationSnapshot,
} from '../src/read-models/world-presentation.mjs';

const count=(rows,kind)=>rows.filter(row=>row.kind===kind).length;

test('DSP1 projects current renderer authorities without mutating simulation state',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'same-world'});
  const before=serialize(s),snap=worldPresentationSnapshot(s),after=serialize(s);
  assert.equal(after,before);
  assert.equal(snap.version,WORLD_PRESENTATION_VERSION);
  assert.deepEqual(snap.bounds,{profile:'same-world',w:84,h:52});
  assert.ok(Object.isFrozen(snap));
  assert.ok(Object.isFrozen(snap.entities));
  assert.deepEqual(new Set(snap.entities.map(row=>row.kind)),new Set(WORLD_PRESENTATION_KINDS));
  assert.equal(count(snap.entities,'resource'),s.nodes.length);
  assert.equal(count(snap.entities,'building'),s.buildings.filter(b=>b.type!=='shelter').length);
  assert.equal(count(snap.entities,'station'),s.rustStations?.stations?.length??0);
  assert.equal(count(snap.entities,'monster'),12);
  assert.equal(count(snap.entities,'agent'),s.agents.filter(a=>a.alive).length);
  assert.equal(snap.entities.some(row=>row.kind==='building'&&row.buildingType==='shelter'),false);
});

test('DSP1 Monster projection mirrors authoritative identity, combat HP and selection',()=>{
  const s=createWorld(42,{mode:'independent',worldProfile:'same-world'}),m=s.wildMonsters.entities[0],a=s.agents.find(x=>x.alive);
  m.status='ENGAGED';m.engagedByAgentId=a.id;m.hpCurrent=Math.max(1,m.hpMax-7);
  const rows=worldPresentationEntities(s,{selection:{kind:'monster',id:m.worldMonsterId}});
  const p=rows.find(row=>row.kind==='monster'&&row.id===m.worldMonsterId);
  assert.ok(p);
  assert.equal(p.worldMonsterId,m.worldMonsterId);
  assert.equal(p.monsterId,m.monsterId);
  assert.equal(p.x,m.x);assert.equal(p.y,m.y);
  assert.equal(p.status,'ENGAGED');
  assert.equal(p.engagedByAgentId,a.id);
  assert.equal(p.hpCurrent,m.hpCurrent);
  assert.equal(p.hpMax,m.hpMax);
  assert.equal(p.selected,true);
  assert.ok(p.visualKey.startsWith('monster.'));
  assert.equal(rows.filter(row=>row.selected).length,1);
});

test('DSP1 includes dropped item presentation and deterministic depth order',()=>{
  const s=createWorld(2026,{mode:'independent',worldProfile:'same-world'}),a=s.agents.find(x=>x.alive);
  s.rustPossessions.items.push({id:900001,kind:'STONE_AXE',createdBy:a.id,createdTick:s.tick,location:{kind:'drop',sourceAgentId:a.id,tick:s.tick,x:a.x,y:a.y}});
  const rows=worldPresentationEntities(s);
  const drop=rows.find(row=>row.kind==='drop'&&row.id===900001);
  assert.ok(drop);
  assert.equal(drop.itemKind,'STONE_AXE');
  assert.equal(drop.sourceAgentId,a.id);
  for(let i=1;i<rows.length;i++)assert.ok(rows[i-1].depth<=rows[i].depth);
});

test('D1 region read model exposes Core plus z1-z4 only in Same-World',()=>{
  const same=createWorld(230926,{mode:'independent',worldProfile:'same-world'});
  const regions=worldPresentationRegions(same);
  assert.deepEqual(regions.map(r=>r.id),['core','z1','z2','z3','z4']);
  assert.deepEqual(regions.slice(1).map(r=>[r.minX,r.maxX]),[[60,65],[66,71],[72,77],[78,83]]);
  assert.deepEqual(regions.slice(1).map(r=>[r.minLevel,r.maxLevel]),[[1,15],[16,30],[31,45],[46,60]]);

  const legacy=createWorld(230926);
  assert.deepEqual(worldPresentationRegions(legacy).map(r=>r.id),['core']);
  assert.equal(worldPresentationEntities(legacy).some(r=>r.kind==='monster'),false);
});

test('DSP1 source is presentation-only: no DOM, wall clock, random or command writer',()=>{
  const source=fs.readFileSync(new URL('../src/read-models/world-presentation.mjs',import.meta.url),'utf8');
  for(const forbidden of ['document.','window.','Math.random','Date.now','new Date','command(','state.']){
    assert.equal(source.includes(forbidden),false,forbidden);
  }
});
