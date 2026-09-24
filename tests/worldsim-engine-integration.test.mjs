import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {WORLD_MAP_VERSION,createWorldMapView} from '../src/worldsim-map.mjs';

test('WorldSim view can render a fresh K6 world without adding engine state',()=>{
  const s=createWorld(230926),before=serialize(s),view=createWorldMapView(s);
  assert.equal(view.version,WORLD_MAP_VERSION);
  assert.equal('worldMap' in s,false);
  assert.equal('worldMapVersion' in s,false);
  assert.equal(serialize(s),before);
});

test('creating WorldSim views cannot change deterministic continuation',()=>{
  const a=createWorld(77),b=createWorld(77);
  for(let i=0;i<720;i++){
    if(i%7===0)createWorldMapView(a);
    step(a);step(b);
  }
  assert.equal(serialize(a),serialize(b));
  assert.deepEqual(validate(a),[]);
});

test('gameplay path authority remains legacy K6 during presentation gate',()=>{
  const s=createWorld(230926),view=createWorldMapView(s);
  for(const c of view.cells)assert.equal(walkable(s,c.x,c.y),c.gameplayTile!=='water');
});

test('gameplay resources remain byte-identical after repeated WorldSim rendering',()=>{
  const s=createWorld(42),nodes=JSON.stringify(s.nodes),tiles=JSON.stringify(s.tiles);
  for(let i=0;i<100;i++)createWorldMapView(s);
  assert.equal(JSON.stringify(s.nodes),nodes);
  assert.equal(JSON.stringify(s.tiles),tiles);
});

test('save restore does not require presentation map metadata',()=>{
  const s=createWorld(918273);step(s,87);
  const text=serialize(s),r=restore(text),view=createWorldMapView(r);
  assert.equal(serialize(r),text);
  assert.equal(view.seed,r.seed);
  assert.equal(view.cells.length,780);
});

test('same seed and same gameplay state produce identical presentation map',()=>{
  const a=createWorld(555),b=createWorld(555);
  step(a,100);step(b,100);
  assert.deepEqual(createWorldMapView(a),createWorldMapView(b));
});
