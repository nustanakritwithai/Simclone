/** WorldSim-inspired full map authority for Simclone.
 * Derived from Living World Physics Simulator 20.9.4 terrain/snapshot contracts.
 * Deterministic, CPU-only, no Math.random, no DOM.
 */
export const WORLD_MAP_VERSION='worldsim-map-0.1';
export const WORLD_TERRAIN=Object.freeze(['deepWater','shallowWater','sand','grass','forest','rock']);
export const MAP_SIZE=Object.freeze({w:30,h:26});

const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const hash=(seed,x,y,salt=0)=>{
  let n=(seed^Math.imul(x+101+salt,374761393)^Math.imul(y+313+salt,668265263))>>>0;
  n^=n>>>13;n=Math.imul(n,1274126177)>>>0;n^=n>>>16;
  return n/4294967296;
};
const smooth=(seed,x,y,salt=0)=>{
  let sum=0,w=0;
  for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){
    const d=Math.abs(ox)+Math.abs(oy),weight=d===0?4:d===1?2:1;
    sum+=hash(seed,x+ox,y+oy,salt)*weight;w+=weight;
  }
  return sum/w;
};
const index=(x,y)=>y*MAP_SIZE.w+x;

export function terrainWalkable(type){return !['deepWater','shallowWater'].includes(type);}
export function compatibilityTile(type){return terrainWalkable(type)?'grass':'water';}

export function generateWorldMap(seed=230926){
  seed=seed>>>0;
  const cells=[];
  const cx=(MAP_SIZE.w-1)/2,cy=(MAP_SIZE.h-1)/2;
  for(let y=0;y<MAP_SIZE.h;y++)for(let x=0;x<MAP_SIZE.w;x++){
    const nx=(x-cx)/(MAP_SIZE.w*.5),ny=(y-cy)/(MAP_SIZE.h*.5);
    const radial=Math.sqrt(nx*nx+ny*ny);
    const continent=smooth(seed,x,y,11)*.58+smooth(seed,x>>1,y>>1,29)*.22+(1-clamp(radial,0,1.4))*.42;
    const ridge=Math.abs(smooth(seed,x,y,47)-.5)*2;
    let elevation=clamp((continent-.42)*1.55+ridge*.18,0,1);
    // Keep the original settlement basin safe and connected.
    const dCamp=Math.abs(x-11)+Math.abs(y-12);
    if(dCamp<=6)elevation=Math.max(elevation,.46);
    const moisture=clamp(smooth(seed,x,y,71)*.72+(1-elevation)*.18,0,1);
    const latitude=Math.abs((y/(MAP_SIZE.h-1))*2-1);
    const temperature=clamp(0.84-latitude*.38-elevation*.32+(smooth(seed,x,y,91)-.5)*.14,0,1);
    const fertility=clamp(moisture*.52+(1-elevation)*.24+smooth(seed,x,y,113)*.24,0,1);
    let terrainType;
    if(elevation<.18)terrainType='deepWater';
    else if(elevation<.36)terrainType='shallowWater';
    else if(elevation<.42)terrainType='sand';
    else if(elevation>.72||ridge>.78)terrainType='rock';
    else if(moisture>.48&&fertility>.45)terrainType='forest';
    else terrainType='grass';
    if(dCamp<=6)terrainType='grass';
    const baseSeaDepth=terrainType==='deepWater'?clamp((.18-elevation)*3.2+.28,.28,1):terrainType==='shallowWater'?clamp((.36-elevation)*2.2+.08,.08,.42):0;
    const surfaceWater=baseSeaDepth+(terrainType!=='deepWater'&&terrainType!=='shallowWater'&&moisture>.78?+(moisture-.78).toFixed(3):0);
    const atmosphericHumidity=clamp(moisture*.72+surfaceWater*.18,0,1);
    const rainfall=clamp((atmosphericHumidity-.48)*.18+(smooth(seed,x,y,137)-.5)*.03,0,.14);
    const droughtPressure=clamp((.5-moisture)*1.7+(temperature-.65)*.8,0,1);
    const weatherType=rainfall>.085?'heavyRain':rainfall>.035?'rain':droughtPressure>.65?'dry':temperature>.78?'hot':atmosphericHumidity>.62?'cloudy':'clear';
    cells.push(Object.freeze({
      index:index(x,y),x,y,elevation:+elevation.toFixed(4),terrainType,
      temperature:+temperature.toFixed(4),humidity:+moisture.toFixed(4),fertility:+fertility.toFixed(4),
      baseSeaDepth:+baseSeaDepth.toFixed(4),surfaceWater:+surfaceWater.toFixed(4),
      soilMoisture:+clamp(moisture*.72,0,1).toFixed(4),groundwater:+clamp(moisture*.48+(1-elevation)*.18,0,1).toFixed(4),
      isOceanCell:['deepWater','shallowWater'].includes(terrainType),isFlooded:surfaceWater>.18&&terrainType!=='deepWater',
      climate:Object.freeze({temperature:+temperature.toFixed(4),atmosphericHumidity:+atmosphericHumidity.toFixed(4),
        rainfall:+rainfall.toFixed(4),droughtPressure:+droughtPressure.toFixed(4),weatherType})
    }));
  }
  const counts=Object.fromEntries(WORLD_TERRAIN.map(t=>[t,0]));for(const c of cells)counts[c.terrainType]++;
  return Object.freeze({version:WORLD_MAP_VERSION,seed,width:MAP_SIZE.w,height:MAP_SIZE.h,cells:Object.freeze(cells),terrainCounts:Object.freeze(counts)});
}

export function cellAt(worldMap,x,y){
  if(!worldMap||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=worldMap.width||y>=worldMap.height)return null;
  return worldMap.cells[y*worldMap.width+x]??null;
}
export function nearestWalkable(worldMap,start){
  const first=cellAt(worldMap,start.x,start.y);if(first&&terrainWalkable(first.terrainType))return {x:start.x,y:start.y};
  const seen=new Set([start.x+','+start.y]),q=[{x:start.x,y:start.y}];
  while(q.length){
    const p=q.shift();
    for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]){
      const n={x:p.x+dx,y:p.y+dy},key=n.x+','+n.y;if(seen.has(key))continue;seen.add(key);
      const c=cellAt(worldMap,n.x,n.y);if(!c)continue;if(terrainWalkable(c.terrainType))return n;q.push(n);
    }
  }
  return null;
}
export function compatibilityTiles(worldMap){return worldMap.cells.map(c=>compatibilityTile(c.terrainType));}

export function resourceNodesFromWorldMap(worldMap){
  const out=[];let id=1;
  for(const c of worldMap.cells){
    if(!terrainWalkable(c.terrainType))continue;
    const camp=Math.abs(c.x-11)+Math.abs(c.y-12)<=4;if(camp)continue;
    let type=null,amount=0;
    const roll=hash(worldMap.seed,c.x,c.y,191);
    if(c.terrainType==='forest'&&roll<.46){type='wood';amount=35+Math.floor(c.fertility*25);}
    else if(['grass','forest'].includes(c.terrainType)&&c.fertility>.54&&roll<.25){type='food';amount=24+Math.floor(c.fertility*28);}
    else if(c.terrainType==='rock'&&roll<.52){type='stone';amount=45+Math.floor(c.elevation*35);}
    else if(c.terrainType==='sand'&&roll<.08){type='stone';amount=20+Math.floor(c.elevation*20);}
    if(type)out.push({id:id++,type,x:c.x,y:c.y,amount,max:amount,worldTerrain:c.terrainType});
  }
  // Guaranteed starter resources around the basin, moved to nearest valid land if needed.
  for(const [type,x,y] of [['food',6,12],['food',8,18],['wood',6,9],['wood',15,7],['stone',15,16]]){
    if(out.some(n=>n.x===x&&n.y===y))continue;const p=nearestWalkable(worldMap,{x,y});if(!p)continue;
    out.push({id:id++,type,x:p.x,y:p.y,amount:45,max:45,worldTerrain:cellAt(worldMap,p.x,p.y).terrainType});
  }
  return out;
}
export function validateWorldMap(worldMap){
  const errors=[];
  if(!worldMap||worldMap.version!==WORLD_MAP_VERSION)errors.push('World map version');
  if(worldMap?.width!==MAP_SIZE.w||worldMap?.height!==MAP_SIZE.h||!Array.isArray(worldMap?.cells)||worldMap.cells.length!==MAP_SIZE.w*MAP_SIZE.h)return [...errors,'World map shape'];
  for(let i=0;i<worldMap.cells.length;i++){
    const c=worldMap.cells[i];
    if(!c||c.index!==i||c.x!==i%MAP_SIZE.w||c.y!==Math.floor(i/MAP_SIZE.w)||!WORLD_TERRAIN.includes(c.terrainType)){errors.push('World map cell');break;}
    for(const k of ['elevation','temperature','humidity','fertility','baseSeaDepth','surfaceWater','soilMoisture','groundwater'])
      if(typeof c[k]!=='number'||!Number.isFinite(c[k])){errors.push('World map physics');break;}
    if(!c.climate||typeof c.climate.weatherType!=='string'){errors.push('World map climate');break;}
  }
  return [...new Set(errors)];
}

export function worldMapSummary(worldMap){
  const cells=worldMap?.cells??[];if(!cells.length)return null;
  const avg=k=>+(cells.reduce((s,c)=>s+c[k],0)/cells.length).toFixed(4);
  return {version:worldMap.version,terrainCounts:{...worldMap.terrainCounts},averageElevation:avg('elevation'),
    averageHumidity:avg('humidity'),averageTemperature:avg('temperature'),flooded:cells.filter(c=>c.isFlooded).length};
}
