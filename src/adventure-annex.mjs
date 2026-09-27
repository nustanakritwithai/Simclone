/** SWA1 — deterministic Adventure Annex terrain and 60x52 -> 84x52 migration.
 * The Annex extends the existing physical coordinate system. It is not a
 * second map and owns no ordinary K6 resource nodes.
 */
import {LARGE_WORLD_BOUNDS,SAME_WORLD_BOUNDS,persistedWorldBounds} from './world-bounds.mjs?v=0.5.0';

export const ADVENTURE_ANNEX_VERSION='SWA1-0.1';
export const ADVENTURE_ANNEX_X_MIN=LARGE_WORLD_BOUNDS.w;
export const ADVENTURE_ANNEX_X_MAX=SAME_WORLD_BOUNDS.w-1;
export const ADVENTURE_ANNEX_HEIGHT=SAME_WORLD_BOUNDS.h;

export const ADVENTURE_ANNEX_ZONES=Object.freeze([
  Object.freeze({zoneId:'z1',minX:60,maxX:65,minLevel:1,maxLevel:15,region:'grassland'}),
  Object.freeze({zoneId:'z2',minX:66,maxX:71,minLevel:16,maxLevel:30,region:'woodland'}),
  Object.freeze({zoneId:'z3',minX:72,maxX:77,minLevel:31,maxLevel:45,region:'uplands'}),
  Object.freeze({zoneId:'z4',minX:78,maxX:83,minLevel:46,maxLevel:60,region:'stone-ridge'})
]);

const clamp=n=>Math.max(0,Math.min(1,n));
function hash(seed,x,y,salt=0){
  let n=(seed^Math.imul(x+101+salt,374761393)^Math.imul(y+313+salt,668265263))>>>0;
  n^=n>>>13;n=Math.imul(n,1274126177)>>>0;n^=n>>>16;
  return (n>>>0)/4294967296;
}

export function adventureAnnexZoneAt(x,y){
  if(!Number.isInteger(x)||!Number.isInteger(y)||y<0||y>=ADVENTURE_ANNEX_HEIGHT||
    x<ADVENTURE_ANNEX_X_MIN||x>ADVENTURE_ANNEX_X_MAX)return null;
  return ADVENTURE_ANNEX_ZONES.find(z=>x>=z.minX&&x<=z.maxX)??null;
}

export function adventureAnnexZoneBounds(zoneId){
  const zone=ADVENTURE_ANNEX_ZONES.find(z=>z.zoneId===zoneId);
  if(!zone)throw new Error('unknown_zone');
  return Object.freeze({zoneId,minX:zone.minX,maxX:zone.maxX,minY:1,maxY:ADVENTURE_ANNEX_HEIGHT-2});
}

/** A two-cell east-west trail guarantees one continuous route through all four zones. */
export function adventureAnnexTile(seed,x,y){
  const zone=adventureAnnexZoneAt(x,y);
  if(!zone||!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw new Error('Invalid Adventure Annex cell');
  if(y===25||y===26||(x===ADVENTURE_ANNEX_X_MIN&&y>=23&&y<=28))return 'path';
  const roll=hash(seed,x,y,811);
  const waterChance=zone.zoneId==='z1'?.01:zone.zoneId==='z2'?.035:zone.zoneId==='z3'?.02:.03;
  return roll<waterChance?'water':'grass';
}

export function adventureAnnexRegionEvidence(seed,x,y){
  const zone=adventureAnnexZoneAt(x,y);
  if(!zone||!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw new Error('Invalid Adventure Annex region cell');
  const a=hash(seed,x,y,907),b=hash(seed,x,y,991),c=hash(seed,x,y,1061);
  let region=zone.region,moisture=.48,relief=.36,canopy=.42;
  if(zone.zoneId==='z1'){
    region=a>.72?'woodland':'grassland';moisture=.42+b*.24;relief=.22+c*.22;canopy=.30+a*.34;
  }else if(zone.zoneId==='z2'){
    region=a>.86?'wetland':'woodland';moisture=.56+b*.28;relief=.30+c*.22;canopy=.58+a*.32;
  }else if(zone.zoneId==='z3'){
    region=a>.68?'stone-ridge':'uplands';moisture=.30+b*.22;relief=.60+c*.32;canopy=.20+a*.28;
  }else{
    region=a>.82?'uplands':'stone-ridge';moisture=.18+b*.20;relief=.72+c*.26;canopy=.10+a*.20;
  }
  return Object.freeze({
    region,
    moisture:+clamp(moisture).toFixed(4),
    relief:+clamp(relief).toFixed(4),
    canopy:+clamp(canopy).toFixed(4),
    riverCenter:LARGE_WORLD_BOUNDS.w-1,
    riverDistance:x-(LARGE_WORLD_BOUNDS.w-1),
    zoneId:zone.zoneId
  });
}

export function expandLargeWorldToSameWorld(state){
  const raw=state?.worldBounds;
  if(raw?.profile==='same-world')return Object.freeze({ok:true,changed:false});
  if(raw?.profile!=='large')return Object.freeze({ok:true,changed:false});
  if(!Array.isArray(state.tiles)||state.tiles.length!==LARGE_WORLD_BOUNDS.w*LARGE_WORLD_BOUNDS.h)
    throw new Error('Invalid released large-world tiles');

  const tiles=[];
  for(let y=0;y<LARGE_WORLD_BOUNDS.h;y++){
    const start=y*LARGE_WORLD_BOUNDS.w;
    tiles.push(...state.tiles.slice(start,start+LARGE_WORLD_BOUNDS.w));
    for(let x=ADVENTURE_ANNEX_X_MIN;x<=ADVENTURE_ANNEX_X_MAX;x++)tiles.push(adventureAnnexTile(state.seed,x,y));
  }
  state.tiles=tiles;
  for(const agent of state.agents??[]){
    if(agent?.adventureCombat)continue; // An in-flight/terminal V1 fight may finish at its preserved Core coordinate.
    if(agent?.task?.adventureExpedition){agent.task=null;agent.moveTick=0;}
    if(agent?.adventureEncounter)agent.adventureEncounter=null;
  }
  state.worldBounds=persistedWorldBounds('same-world');
  state.adventureAnnex={version:ADVENTURE_ANNEX_VERSION,coreProfile:'large',xMin:ADVENTURE_ANNEX_X_MIN,xMax:ADVENTURE_ANNEX_X_MAX};
  return Object.freeze({ok:true,changed:true});
}

export function validateAdventureAnnexState(state){
  const raw=state?.worldBounds;
  if(raw?.profile!=='same-world')return state?.adventureAnnex===undefined?[]:['Adventure annex'];
  const a=state.adventureAnnex;
  if(!a||a.version!==ADVENTURE_ANNEX_VERSION||a.coreProfile!=='large'||
    a.xMin!==ADVENTURE_ANNEX_X_MIN||a.xMax!==ADVENTURE_ANNEX_X_MAX)return ['Adventure annex'];
  if(!Array.isArray(state.tiles)||state.tiles.length!==SAME_WORLD_BOUNDS.w*SAME_WORLD_BOUNDS.h)return ['Adventure annex'];
  for(let y=0;y<SAME_WORLD_BOUNDS.h;y++)for(let x=ADVENTURE_ANNEX_X_MIN;x<=ADVENTURE_ANNEX_X_MAX;x++)
    if(state.tiles[y*SAME_WORLD_BOUNDS.w+x]!==adventureAnnexTile(state.seed,x,y))return ['Adventure annex'];
  return [];
}
