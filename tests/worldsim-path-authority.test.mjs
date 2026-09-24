import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,validate,walkable,pathTo} from '../src/engine.mjs';
import {MAP_AUTHORITY,MAP_SIZE,worldPathCellAt,worldPathWalkable} from '../src/worldsim-map.mjs';

test('WM2 declares WorldSim path authority but keeps resource/save authority unchanged',()=>{
  assert.equal(MAP_AUTHORITY.mode,'path-authority-gate-1');
  assert.equal(MAP_AUTHORITY.path,'worldsim-wm2');
  assert.equal(MAP_AUTHORITY.resources,'simclone-k6');
  assert.equal(MAP_AUTHORITY.save,'simclone-0.5.0');
});

test('WM2 walkability is parity-equivalent to K6 topology for every cell across seeds',()=>{
  for(const seed of [1,42,2026,230926,90001]){
    const s=createWorld(seed);
    for(let y=0;y<MAP_SIZE.h;y++)for(let x=0;x<MAP_SIZE.w;x++){
      const legacy=s.tiles[y*MAP_SIZE.w+x]!=='water';
      assert.equal(worldPathWalkable(s,x,y),legacy,seed+':'+x+','+y);
      assert.equal(walkable(s,x,y),legacy,seed+':engine:'+x+','+y);
    }
  }
});

test('WM2 walkability hot path stays allocation-free',()=>{
  assert.equal(typeof worldPathWalkable(createWorld(1),11,12),'boolean');
  assert.equal(worldPathWalkable.toString().includes('worldPathCellAt'),false);
});

test('WM2 cell contract is bounded and detached',()=>{
  const s=createWorld(77);
  assert.equal(worldPathCellAt(s,-1,0),null);
  assert.equal(worldPathCellAt(s,30,0),null);
  const cell=worldPathCellAt(s,11,12);
  assert.equal(cell.x,11);assert.equal(cell.y,12);
  assert.equal(cell.walkable,s.tiles[12*30+11]!=='water');
  assert.equal(Object.isFrozen(cell),true);
});

test('existing bridge route remains reachable under WorldSim path authority',()=>{
  const s=createWorld(230926);
  const route=pathTo(s,{x:11,y:12},{x:27,y:12});
  assert.ok(route?.length);
  for(const p of route)assert.equal(worldPathWalkable(s,p.x,p.y),true);
});

test('WM2 path authority does not mutate resources, save schema or deterministic execution',()=>{
  const a=createWorld(9191),b=createWorld(9191);
  const nodes=JSON.stringify(a.nodes),version=a.version;
  for(let i=0;i<720;i++){worldPathWalkable(a,(i*7)%30,(i*11)%26);step(a);step(b);}
  assert.equal(JSON.stringify(a.nodes),JSON.stringify(b.nodes));
  assert.equal(version,a.version);
  assert.equal(serialize(a),serialize(b));
  assert.deepEqual(validate(a),[]);
  assert.notEqual(nodes,'[]');
});

test('WM2 rejects out-of-bounds and malformed gameplay terrain',()=>{
  const s=createWorld(3);
  assert.equal(worldPathWalkable(s,-1,12),false);
  const copy=structuredClone(s);copy.tiles[0]='lava';
  assert.equal(worldPathWalkable(copy,0,0),false);
});
