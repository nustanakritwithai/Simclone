import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize} from '../src/engine.mjs';
import {worldBounds,LARGE_WORLD_BOUNDS} from '../src/world-bounds.mjs';
import {createWorldMapView} from '../src/worldsim-map.mjs';
import {
  WORLD_REGION_VERSION,
  WORLD_REGION_TYPES,
  REGION_RESOURCE_POLICY,
  regionNoise,
  regionalRiverCenter,
  worldRegionAt,
  regionalResourceDecision,
  createWorldRegionView
} from '../src/world-regions.mjs';

test('MX2 region field is deterministic, bounded and read-only',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'large'}),before=serialize(s);
  const a=createWorldRegionView(s),b=createWorldRegionView(s);
  assert.equal(a.version,WORLD_REGION_VERSION);
  assert.equal(a.width,60);assert.equal(a.height,52);assert.equal(a.cells.length,3120);
  assert.deepEqual(a,b);assert.equal(serialize(s),before);
  assert.equal(Object.values(a.counts).reduce((x,y)=>x+y,0),3120);
  assert.ok(WORLD_REGION_TYPES.filter(k=>a.counts[k]>0).length>=4);
  for(const c of a.cells)assert.ok(WORLD_REGION_TYPES.includes(c.region));
});

test('MX2 regional river remains deterministic and inside large-world bounds',()=>{
  for(const seed of [0,42,230926])for(const y of [0,1,13,25,51]){
    const a=regionalRiverCenter(LARGE_WORLD_BOUNDS,y),b=regionalRiverCenter(LARGE_WORLD_BOUNDS,y);
    assert.equal(a,b);assert.ok(a>=1&&a<LARGE_WORLD_BOUNDS.w-1);
    assert.ok(regionNoise(seed,a,y,503)>=0&&regionNoise(seed,a,y,503)<1);
  }
});

test('MX2 resource policies are normalized and biome-specialized',()=>{
  for(const type of WORLD_REGION_TYPES){
    const p=REGION_RESOURCE_POLICY[type];
    assert.ok(p.chance>0&&p.chance<1);
    assert.ok(Math.abs(p.food+p.wood+p.stone-1)<1e-12);
  }
  assert.ok(REGION_RESOURCE_POLICY.woodland.wood>REGION_RESOURCE_POLICY.woodland.food);
  assert.ok(REGION_RESOURCE_POLICY['stone-ridge'].stone>REGION_RESOURCE_POLICY['stone-ridge'].wood);
  assert.ok(REGION_RESOURCE_POLICY.grassland.food>REGION_RESOURCE_POLICY.grassland.wood);
  assert.ok(REGION_RESOURCE_POLICY.wetland.food>REGION_RESOURCE_POLICY.wetland.stone);
});

test('large independent engine nodes exactly follow MX2 regional decisions',()=>{
  const s=createWorld(230926,{mode:'independent',worldProfile:'large'}),bounds=worldBounds(s),expected=[];
  for(let y=0;y<bounds.h;y++)for(let x=0;x<bounds.w;x++){
    const tile=s.tiles[y*bounds.w+x],decision=regionalResourceDecision(s.seed,bounds,x,y,{blocked:tile!=='grass'});
    if(decision.spawn)expected.push({type:decision.type,x,y});
  }
  assert.deepEqual(s.nodes.map(n=>({type:n.type,x:n.x,y:n.y})),expected);
  assert.ok(expected.length>0);
});

test('different large-world seeds change regional evidence while same seed stays identical',()=>{
  const a=createWorldRegionView(createWorld(42,{mode:'independent',worldProfile:'large'}));
  const b=createWorldRegionView(createWorld(42,{mode:'independent',worldProfile:'large'}));
  const c=createWorldRegionView(createWorld(43,{mode:'independent',worldProfile:'large'}));
  assert.deepEqual(a,b);
  assert.notDeepEqual(a.cells.map(x=>x.region),c.cells.map(x=>x.region));
});

test('WorldSim terrain carries the exact MX2 region identity for every large-world cell',()=>{
  const s=createWorld(5150,{mode:'independent',worldProfile:'large'}),bounds=worldBounds(s);
  const regions=createWorldRegionView(s),map=createWorldMapView(s);
  assert.deepEqual(map.regionCounts,regions.counts);
  for(let i=0;i<map.cells.length;i++){
    assert.equal(map.cells[i].region,regions.cells[i].region);
    const e=worldRegionAt(s.seed,bounds,map.cells[i].x,map.cells[i].y);
    assert.equal(map.cells[i].region,e.region);
  }
});

test('legacy 30x26 generation remains deterministic and does not opt into a persisted region profile',()=>{
  const a=createWorld(230926),b=createWorld(230926);
  assert.equal(serialize(a),serialize(b));
  assert.equal('worldBounds' in a,false);
  assert.equal(a.tiles.length,780);
});
