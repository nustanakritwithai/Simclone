/** MX3A — bounded external route-field cache.
 * Cache state is never serialized and never mutates simulation state.
 * It is valid while the state's tile-array identity and world bounds stay the same.
 */
import {worldBounds} from './world-bounds.mjs?v=0.5.0';

export const ROUTE_CACHE_VERSION='MX3A-0.1';
export const ROUTE_CACHE_LIMIT=64;

const caches=new WeakMap();

function holder(state){
  const bounds=worldBounds(state);
  let h=caches.get(state);
  if(!h||h.tiles!==state.tiles||h.width!==bounds.w||h.height!==bounds.h){
    h={tiles:state.tiles,width:bounds.w,height:bounds.h,fields:new Map(),hits:0,misses:0};
    caches.set(state,h);
  }
  return h;
}

export function cachedRouteField(state,start,build){
  if(typeof build!=='function')throw new Error('Route cache requires builder');
  const h=holder(state);
  if(!start||!Number.isInteger(start.x)||!Number.isInteger(start.y)||
    start.x<0||start.y<0||start.x>=h.width||start.y>=h.height)return build();
  const key=start.y*h.width+start.x;
  if(h.fields.has(key)){
    const value=h.fields.get(key);
    h.fields.delete(key);h.fields.set(key,value);h.hits++;
    return value;
  }
  const value=build();h.misses++;
  h.fields.set(key,value);
  while(h.fields.size>ROUTE_CACHE_LIMIT)h.fields.delete(h.fields.keys().next().value);
  return value;
}

export function clearRouteCache(state){
  return caches.delete(state);
}

export function routeCacheSnapshot(state){
  const h=caches.get(state);
  if(!h)return Object.freeze({version:ROUTE_CACHE_VERSION,entries:0,hits:0,misses:0,limit:ROUTE_CACHE_LIMIT});
  return Object.freeze({version:ROUTE_CACHE_VERSION,entries:h.fields.size,hits:h.hits,misses:h.misses,limit:ROUTE_CACHE_LIMIT,width:h.width,height:h.height});
}
