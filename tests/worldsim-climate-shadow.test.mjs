import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,serialize,step} from '../src/engine.mjs';
import {createWorldMapView} from '../src/worldsim-map.mjs';
import {CLIMATE_WEATHER,climateShadowForCell,createClimateShadow} from '../src/worldsim-climate-shadow.mjs';

test('climate shadow is deterministic, bounded and read-only',()=>{
  const s=createWorld(230926),before=serialize(s),view=createWorldMapView(s);
  const a=createClimateShadow(s,view),b=createClimateShadow(s,view);
  assert.deepEqual(a,b);assert.equal(serialize(s),before);assert.equal(a.cells.length,780);
  for(const c of a.cells){
    for(const k of ['temperatureNorm','temperatureComfort','humidity','cloudCover','rainPotential','droughtPressure','solar','vegetationClimateFactor'])assert.ok(c[k]>=0&&c[k]<=1,k);
    assert.ok(CLIMATE_WEATHER.includes(c.weatherType));
  }
});

test('higher elevation cools the climate proxy',()=>{
  const low=climateShadowForCell({x:10,y:12,terrainType:'grass',elevation:.1,moisture:.5},{cyclePhase:.5,solar:1});
  const high=climateShadowForCell({x:10,y:12,terrainType:'grass',elevation:.9,moisture:.5},{cyclePhase:.5,solar:1});
  assert.ok(high.temperatureC<low.temperatureC);
});

test('water cells carry more humidity than equal land cells',()=>{
  const land=climateShadowForCell({x:10,y:12,terrainType:'grass',elevation:.3,moisture:.5},{cyclePhase:.5,solar:1});
  const water=climateShadowForCell({x:10,y:12,terrainType:'shallowWater',elevation:.3,moisture:.5},{cyclePhase:.5,solar:1});
  assert.ok(water.humidity>land.humidity);
});

test('shadow solar cycle changes without mutating simulation time',()=>{
  const s=createWorld(77),view=createWorldMapView(s),before=serialize(s);
  s.tick=0;const night=createClimateShadow(s,view);s.tick=180;const day=createClimateShadow(s,view);
  assert.notEqual(night.cycle.solar,day.cycle.solar);
  s.tick=0;assert.equal(serialize(s),before);
});

test('observing climate every tick cannot change deterministic execution',()=>{
  const a=createWorld(2026),b=createWorld(2026);
  for(let i=0;i<360;i++){createClimateShadow(a);step(a);step(b);}
  assert.equal(serialize(a),serialize(b));
});
