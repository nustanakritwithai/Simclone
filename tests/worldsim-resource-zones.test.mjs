import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize} from '../src/engine.mjs';
import {MAP_SIZE} from '../src/worldsim-map.mjs';
import {createResourceEcologyShadow} from '../src/worldsim-resource-shadow.mjs';
import {RESOURCE_REGEN_AUTHORITY} from '../src/worldsim-resource-authority.mjs';
import {
  RESOURCE_ZONE_SHADOW_VERSION,
  RESOURCE_ZONE_TYPES,
  RESOURCE_ZONE_POLICY,
  resourceZoneThreshold,
  createResourceZonesShadow,
  resourceZoneAt
} from '../src/worldsim-resource-zones.mjs';

const cardinal=(a,b)=>{
  const ax=a%MAP_SIZE.w,ay=Math.floor(a/MAP_SIZE.w),bx=b%MAP_SIZE.w,by=Math.floor(b/MAP_SIZE.w);
  return Math.abs(ax-bx)+Math.abs(ay-by)===1;
};

test('WM4.8 resource zones are deterministic, bounded and read-only',()=>{
  const s=createWorld(230926),before=serialize(s),a=createResourceZonesShadow(s),b=createResourceZonesShadow(s);
  assert.equal(a.version,RESOURCE_ZONE_SHADOW_VERSION);
  assert.deepEqual(a,b);assert.equal(serialize(s),before);
  assert.equal(a.authority.mode,'shadow-only');
  assert.equal(a.authority.resourceWriter,RESOURCE_REGEN_AUTHORITY.writer);
  assert.equal(a.authority.nodePlacement,'not-owned');
  assert.equal(a.authority.nodeMutation,false);
  assert.equal(a.authority.saveFields,0);
});

test('resource-zone thresholds are deterministic ecology-relative cutoffs',()=>{
  const s=createWorld(42),shadow=createResourceEcologyShadow(s);
  for(const type of RESOURCE_ZONE_TYPES){
    const a=resourceZoneThreshold(shadow,type),b=resourceZoneThreshold(shadow,type);
    assert.equal(a,b);assert.ok(a>=0&&a<=1);
    const positive=shadow.cells.map(c=>c.suitability[type]).filter(v=>v>0);
    if(positive.length)assert.ok(a<=Math.max(...positive));
  }
  assert.equal(RESOURCE_ZONE_POLICY.neighborhood,'cardinal-4');
});

test('every zone contains only qualifying cardinally connected cells',()=>{
  const s=createWorld(77),shadow=createResourceEcologyShadow(s),projection=createResourceZonesShadow(s,shadow);
  for(const type of RESOURCE_ZONE_TYPES){
    const seen=new Set();
    for(const zone of projection.zones.filter(z=>z.type===type)){
      assert.ok(zone.size>=RESOURCE_ZONE_POLICY.minCells);
      assert.equal(zone.cellIndices.length,zone.size);
      for(const index of zone.cellIndices){
        assert.equal(seen.has(index),false);seen.add(index);
        const c=shadow.cells[index];
        assert.ok(c.suitability[type]>0&&c.suitability[type]>=zone.threshold);
        assert.notEqual(c.terrainType,'deepWater');assert.notEqual(c.terrainType,'shallowWater');
      }
      const reached=new Set([zone.cellIndices[0]]),queue=[zone.cellIndices[0]],members=new Set(zone.cellIndices);
      for(let q=0;q<queue.length;q++)for(const candidate of zone.cellIndices)
        if(!reached.has(candidate)&&members.has(candidate)&&cardinal(queue[q],candidate)){reached.add(candidate);queue.push(candidate);}
      assert.equal(reached.size,zone.size);
    }
  }
});

test('zone node accounting is type-safe and conserves node counts',()=>{
  const s=createWorld(2026),projection=createResourceZonesShadow(s);
  for(const type of RESOURCE_ZONE_TYPES){
    const summary=projection.byType[type];
    assert.equal(summary.zonedNodes+summary.unzonedNodes,summary.nodeCount);
    const actual=s.nodes.filter(n=>n.type===type);
    assert.equal(summary.nodeCount,actual.length);
    const ids=new Set(actual.map(n=>n.id));
    for(const zone of projection.zones.filter(z=>z.type===type)){
      assert.ok(zone.averageHarvestPressure>=0&&zone.averageHarvestPressure<=1);
      assert.ok(zone.averageSuitability>=zone.threshold);
      assert.ok(zone.maxSuitability>=zone.averageSuitability);
      assert.ok(zone.nodeIds.every(id=>ids.has(id)));
      const found=resourceZoneAt(projection,type,zone.anchor.x,zone.anchor.y);
      assert.equal(found?.id,zone.id);
    }
  }
});

test('resource-zone boundaries ignore current node amount while pressure summaries react',()=>{
  const s=createWorld(9),before=createResourceZonesShadow(s);
  for(const n of s.nodes)if(n.type==='food')n.amount=0;
  const after=createResourceZonesShadow(s);
  const shape=x=>x.zones.map(z=>[z.id,z.type,z.threshold,z.cellIndices]);
  assert.deepEqual(shape(after),shape(before));
  const beforePressure=before.zones.filter(z=>z.type==='food'&&z.nodeCount>0).map(z=>z.averageHarvestPressure);
  const afterPressure=after.zones.filter(z=>z.type==='food'&&z.nodeCount>0).map(z=>z.averageHarvestPressure);
  assert.equal(afterPressure.length,beforePressure.length);
  for(let i=0;i<afterPressure.length;i++)assert.ok(afterPressure[i]>=beforePressure[i]);
});

test('resourceZoneAt rejects invalid lookups without inventing a zone',()=>{
  const p=createResourceZonesShadow(createWorld(5150));
  assert.equal(resourceZoneAt(p,'ore',0,0),null);
  assert.equal(resourceZoneAt(p,'food',-1,0),null);
  assert.equal(resourceZoneAt(p,'wood',MAP_SIZE.w,0),null);
});
