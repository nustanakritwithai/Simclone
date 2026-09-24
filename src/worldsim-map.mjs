/** Compact WorldSim-inspired physical map authority for Simclone.
 * Field arrays mirror the source simulator's typed-state architecture while
 * remaining JSON-save friendly. Deterministic, CPU-only, no Math.random/DOM.
 */
export const WORLD_MAP_VERSION='worldsim-map-0.2';
export const WORLD_TERRAIN=Object.freeze(['deepWater','shallowWater','sand','grass','forest','rock']);
export const MAP_SIZE=Object.freeze({w:30,h:26});
const WEATHER=Object.freeze(['clear','cloudy','rain','heavyRain','hot','dry']);
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const hash=(seed,x,y,salt=0)=>{let n=(seed^Math.imul(x+101+salt,374761393)^Math.imul(y+313+salt,668265263))>>>0;n^=n>>>13;n=Math.imul(n,1274126177)>>>0;n^=n>>>16;return n/4294967296;};
const smooth=(seed,x,y,salt=0)=>{let sum=0,w=0;for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){const d=Math.abs(ox)+Math.abs(oy),weight=d===0?4:d===1?2:1;sum+=hash(seed,x+ox,y+oy,salt)*weight;w+=weight;}return sum/w;};
const idx=(x,y)=>y*MAP_SIZE.w+x;
const q=n=>+n.toFixed(4);
export function terrainWalkable(type){return !['deepWater','shallowWater'].includes(type);}
export function compatibilityTile(type){return terrainWalkable(type)?'grass':'water';}
export function generateWorldMap(seed=230926){
 seed=seed>>>0;const n=MAP_SIZE.w*MAP_SIZE.h;
 const terrain=new Array(n),elevation=new Array(n),temperature=new Array(n),humidity=new Array(n),fertility=new Array(n),
   baseSeaDepth=new Array(n),surfaceWater=new Array(n),soilMoisture=new Array(n),groundwater=new Array(n),
   flooded=new Array(n),atmosphericHumidity=new Array(n),rainfall=new Array(n),droughtPressure=new Array(n),weather=new Array(n);
 const cx=(MAP_SIZE.w-1)/2,cy=(MAP_SIZE.h-1)/2;
 for(let y=0;y<MAP_SIZE.h;y++)for(let x=0;x<MAP_SIZE.w;x++){
  const i=idx(x,y),nx=(x-cx)/(MAP_SIZE.w*.5),ny=(y-cy)/(MAP_SIZE.h*.5),radial=Math.sqrt(nx*nx+ny*ny);
  const continent=smooth(seed,x,y,11)*.58+smooth(seed,x>>1,y>>1,29)*.22+(1-clamp(radial,0,1.4))*.42;
  const ridge=Math.abs(smooth(seed,x,y,47)-.5)*2;let el=clamp((continent-.42)*1.55+ridge*.18,0,1);
  const dCamp=Math.abs(x-11)+Math.abs(y-12);if(dCamp<=6)el=Math.max(el,.46);
  const moist=clamp(smooth(seed,x,y,71)*.72+(1-el)*.18,0,1),lat=Math.abs((y/(MAP_SIZE.h-1))*2-1);
  const temp=clamp(.84-lat*.38-el*.32+(smooth(seed,x,y,91)-.5)*.14,0,1),fert=clamp(moist*.52+(1-el)*.24+smooth(seed,x,y,113)*.24,0,1);
  let t;
  if(radial>1.1)t='deepWater';else if(radial>.98)t='shallowWater';else if(radial>.9)t='sand';
  else if(el>.72||ridge>.78||hash(seed,x,y,173)>.91)t='rock';
  else if((moist>.46&&fert>.43)||hash(seed,x,y,151)>.73)t='forest';
  else t='grass';
  if(dCamp<=6)t='grass';
  const sea=t==='deepWater'?clamp((1.2-radial)*-.6+.5,.28,1):t==='shallowWater'?clamp((1.02-radial)*-.5+.16,.08,.42):0;
  const sw=sea+(terrainWalkable(t)&&moist>.78?q(moist-.78):0),ah=clamp(moist*.72+sw*.18,0,1);
  const rain=clamp((ah-.48)*.18+(smooth(seed,x,y,137)-.5)*.03,0,.14),dry=clamp((.5-moist)*1.7+(temp-.65)*.8,0,1);
  const wt=rain>.085?'heavyRain':rain>.035?'rain':dry>.65?'dry':temp>.78?'hot':ah>.62?'cloudy':'clear';
  terrain[i]=WORLD_TERRAIN.indexOf(t);elevation[i]=q(el);temperature[i]=q(temp);humidity[i]=q(moist);fertility[i]=q(fert);
  baseSeaDepth[i]=q(sea);surfaceWater[i]=q(sw);soilMoisture[i]=q(clamp(moist*.72,0,1));groundwater[i]=q(clamp(moist*.48+(1-el)*.18,0,1));
  flooded[i]=sw>.18&&terrainWalkable(t)?1:0;atmosphericHumidity[i]=q(ah);rainfall[i]=q(rain);droughtPressure[i]=q(dry);weather[i]=WEATHER.indexOf(wt);
 }
 const terrainCounts=Object.fromEntries(WORLD_TERRAIN.map((t,code)=>[t,terrain.filter(v=>v===code).length]));
 return {version:WORLD_MAP_VERSION,seed,width:MAP_SIZE.w,height:MAP_SIZE.h,terrain,elevation,temperature,humidity,fertility,baseSeaDepth,surfaceWater,soilMoisture,groundwater,flooded,atmosphericHumidity,rainfall,droughtPressure,weather,terrainCounts};
}
export function cellAt(m,x,y){
 if(!m||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=m.width||y>=m.height)return null;const i=y*m.width+x,t=WORLD_TERRAIN[m.terrain[i]];
 return {index:i,x,y,elevation:m.elevation[i],terrainType:t,temperature:m.temperature[i],humidity:m.humidity[i],fertility:m.fertility[i],
  baseSeaDepth:m.baseSeaDepth[i],surfaceWater:m.surfaceWater[i],soilMoisture:m.soilMoisture[i],groundwater:m.groundwater[i],
  isOceanCell:!terrainWalkable(t),isFlooded:m.flooded[i]===1,climate:{temperature:m.temperature[i],atmosphericHumidity:m.atmosphericHumidity[i],
   rainfall:m.rainfall[i],droughtPressure:m.droughtPressure[i],weatherType:WEATHER[m.weather[i]]}};
}
export function eachCell(m){const out=[];for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++)out.push(cellAt(m,x,y));return out;}
export function nearestWalkable(m,start){const first=cellAt(m,start.x,start.y);if(first&&terrainWalkable(first.terrainType))return {x:start.x,y:start.y};const seen=new Set([start.x+','+start.y]),q=[{x:start.x,y:start.y}];while(q.length){const p=q.shift();for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]){const n={x:p.x+dx,y:p.y+dy},key=n.x+','+n.y;if(seen.has(key))continue;seen.add(key);const c=cellAt(m,n.x,n.y);if(!c)continue;if(terrainWalkable(c.terrainType))return n;q.push(n);}}return null;}
export function compatibilityTiles(m){return m.terrain.map(code=>compatibilityTile(WORLD_TERRAIN[code]));}
export function resourceNodesFromWorldMap(m){const out=[];let id=1;for(const c of eachCell(m)){if(!terrainWalkable(c.terrainType))continue;const camp=Math.abs(c.x-11)+Math.abs(c.y-12)<=4;if(camp)continue;let type=null,amount=0;const roll=hash(m.seed,c.x,c.y,191);if(c.terrainType==='forest'&&roll<.72){type='wood';amount=35+Math.floor(c.fertility*25);}else if(['grass','forest'].includes(c.terrainType)&&c.fertility>.42&&roll<.38){type='food';amount=24+Math.floor(c.fertility*28);}else if(c.terrainType==='rock'&&roll<.7){type='stone';amount=45+Math.floor(c.elevation*35);}else if(c.terrainType==='sand'&&roll<.16){type='stone';amount=20+Math.floor(c.elevation*20);}if(type)out.push({id:id++,type,x:c.x,y:c.y,amount,max:amount,worldTerrain:c.terrainType});}
 for(const [type,x,y] of [['food',6,12],['food',8,18],['wood',6,9],['wood',15,7],['stone',15,16]]){if(out.some(n=>n.x===x&&n.y===y))continue;const p=nearestWalkable(m,{x,y});if(!p)continue;out.push({id:id++,type,x:p.x,y:p.y,amount:45,max:45,worldTerrain:cellAt(m,p.x,p.y).terrainType});}return out;}
export function validateWorldMap(m){const n=MAP_SIZE.w*MAP_SIZE.h,errors=[];if(!m||m.version!==WORLD_MAP_VERSION)errors.push('World map version');if(m?.width!==MAP_SIZE.w||m?.height!==MAP_SIZE.h)return [...errors,'World map shape'];for(const k of ['terrain','elevation','temperature','humidity','fertility','baseSeaDepth','surfaceWater','soilMoisture','groundwater','flooded','atmosphericHumidity','rainfall','droughtPressure','weather'])if(!Array.isArray(m[k])||m[k].length!==n)errors.push('World map '+k);if(errors.length)return [...new Set(errors)];if(m.terrain.some(v=>!Number.isInteger(v)||v<0||v>=WORLD_TERRAIN.length)||m.weather.some(v=>!Number.isInteger(v)||v<0||v>=WEATHER.length))errors.push('World map codes');return errors;}
export function worldMapSummary(m){if(validateWorldMap(m).length)return null;const avg=a=>+(a.reduce((s,v)=>s+v,0)/a.length).toFixed(4);return {version:m.version,terrainCounts:{...m.terrainCounts},averageElevation:avg(m.elevation),averageHumidity:avg(m.humidity),averageTemperature:avg(m.temperature),flooded:m.flooded.reduce((s,v)=>s+(v?1:0),0)};}
