/** WM1 presentation only. Reads K6 tiles/resources; never writes simulation state.
 * This is a WorldSim-inspired terrain skin, not the 20.9.4 physics runtime.
 */
export const WORLD_MAP_VERSION='wm1-visual-1';
export const MAP_SIZE=Object.freeze({w:30,h:26});
export const WORLD_TERRAIN=Object.freeze(['deepWater','shallowWater','sand','grass','forest','rock','path','bridge']);
export const MAP_AUTHORITY=Object.freeze({mode:'path-authority-gate-1',path:'worldsim-wm2',resources:'simclone-k6',save:'simclone-0.5.0'});
export const TERRAIN_COLORS=Object.freeze({deepWater:'#315f70',shallowWater:'#589496',sand:'#baa77a',grass:'#738f58',forest:'#426948',rock:'#889187',path:'#b4a37a',bridge:'#a18455'});
const WATER=new Set(['deepWater','shallowWater']);
const TILES=new Set(['grass','water','path','bridge']);
const clamp=n=>Math.max(0,Math.min(1,n));

/** Explicit unsigned conversion keeps the noise in [0,1), unlike signed XOR. */
export function visualNoise(seed,x,y,salt=0){
  let n=(seed^Math.imul(x+101+salt,374761393)^Math.imul(y+313+salt,668265263))>>>0;
  n^=n>>>13;n=Math.imul(n,1274126177)>>>0;n^=n>>>16;
  return (n>>>0)/4294967296;
}
function field(seed,x,y,salt){
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const a=visualNoise(seed,ix,iy,salt),b=visualNoise(seed,ix+1,iy,salt);
  const c=visualNoise(seed,ix,iy+1,salt),d=visualNoise(seed,ix+1,iy+1,salt);
  return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}
function tint(hex,amount){
  return '#'+[1,3,5].map(i=>Math.max(0,Math.min(255,parseInt(hex.slice(i,i+2),16)+amount)).toString(16).padStart(2,'0')).join('');
}
export const isVisualWater=terrain=>WATER.has(terrain);

/** Detached immutable render snapshot. Caller owns caching; nothing is saved. */
export function createWorldMapView(state){
  const {w:width,h:height}=MAP_SIZE,n=width*height;
  if(!state||!Number.isSafeInteger(state.seed)||state.seed<0||state.seed>4294967295||
    !Array.isArray(state.tiles)||state.tiles.length!==n)throw new Error('Invalid map view input');
  for(let i=0;i<n;i++)if(!TILES.has(state.tiles[i]))throw new Error('Invalid gameplay terrain');
  const tile=(x,y)=>x>=0&&y>=0&&x<width&&y<height?state.tiles[y*width+x]:null;
  const influences={wood:new Float64Array(n),stone:new Float64Array(n),food:new Float64Array(n)};
  for(const node of state.nodes??[]){
    if(!node||!Object.hasOwn(influences,node.type)||!Number.isInteger(node.x)||!Number.isInteger(node.y))continue;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const x=node.x+dx,y=node.y+dy,d=Math.abs(dx)+Math.abs(dy);
      if(d<=2&&x>=0&&y>=0&&x<width&&y<height)influences[node.type][y*width+x]+=1/(1+d);
    }
  }
  const counts=Object.fromEntries(WORLD_TERRAIN.map(t=>[t,0])),cells=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x,gameplayTile=tile(x,y),nearWater=[[0,-1],[1,0],[0,1],[-1,0]].filter(([dx,dy])=>tile(x+dx,y+dy)==='water').length;
    const elevation=field(state.seed,x/6,y/6,29),moisture=field(state.seed,x/5,y/5,71);
    let terrainType=gameplayTile;
    if(gameplayTile==='water')terrainType=nearWater>=3?'deepWater':'shallowWater';
    else if(gameplayTile==='grass'){
      const wood=influences.wood[i],stone=influences.stone[i],food=influences.food[i];
      if(nearWater>0&&wood<.8&&stone<.8)terrainType='sand';
      else if(stone>wood&&stone>=food&&stone>=.5)terrainType='rock';
      else if(wood>=.5&&wood>=food||moisture>.64&&food<.8)terrainType='forest';
      else if(elevation>.72&&wood<.5&&food<.5)terrainType='rock';
      else terrainType='grass';
      // Clear-looking ground underneath existing homes; this does NOT alter BUILD.
      if((state.buildings??[]).some(b=>Math.abs(b.x-x)+Math.abs(b.y-y)<=1))terrainType='grass';
    }
    const detail=visualNoise(state.seed,x,y,113),shade=Math.round((detail-.5)*12+(elevation-.5)*8);
    counts[terrainType]++;
    cells.push(Object.freeze({index:i,x,y,terrainType,gameplayTile,
      walkable:gameplayTile!=='water',color:tint(TERRAIN_COLORS[terrainType],shade),
      elevation:clamp(elevation),moisture:clamp(moisture),detail}));
  }
  return Object.freeze({version:WORLD_MAP_VERSION,seed:state.seed,width,height,
    authority:MAP_AUTHORITY,cells:Object.freeze(cells),terrainCounts:Object.freeze(counts)});
}
export function visualCellAt(view,x,y){
  if(!view||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=view.width||y>=view.height)return null;
  return view.cells[y*view.width+x]??null;
}

/** WM2 path authority. Gate 1 intentionally preserves K6 topology exactly:
 * deep/shallow water are blocked; all non-water gameplay cells remain walkable.
 * Future movement-cost gates may differentiate forest/rock/sand without changing this contract.
 */
export function worldPathCellAt(state,x,y){
  const {w,h}=MAP_SIZE;
  if(!state||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=w||y>=h)return null;
  const gameplayTile=state.tiles?.[y*w+x];
  if(!TILES.has(gameplayTile))return null;
  const terrainType=gameplayTile==='water'?'shallowWater':gameplayTile;
  return Object.freeze({x,y,gameplayTile,terrainType,walkable:gameplayTile!=='water'});
}
export function worldPathWalkable(state,x,y){
  const {w,h}=MAP_SIZE;
  if(!state||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=w||y>=h)return false;
  const gameplayTile=state.tiles?.[y*w+x];
  return TILES.has(gameplayTile)&&gameplayTile!=='water';
}

export const SHADOW_MOVEMENT_COST=Object.freeze({
  bridge:.85,path:.9,grass:1,sand:1.15,forest:1.25,rock:1.45,deepWater:null,shallowWater:null
});
/** WM2.1 read-only candidate movement cost. It never changes pathfinding or task scores. */
export function shadowMovementCell(view,x,y){
  const cell=visualCellAt(view,x,y);if(!cell)return null;
  return Object.freeze({...cell,movementCost:SHADOW_MOVEMENT_COST[cell.terrainType]??null});
}
export function shadowRouteMovementCost(view,path=[]){
  if(!Array.isArray(path))return null;
  let cost=0,steps=0;
  for(const p of path){
    const cell=shadowMovementCell(view,p?.x,p?.y);
    if(!cell||cell.movementCost===null)return null;
    cost+=cell.movementCost;steps++;
  }
  return Object.freeze({steps,cost:+cost.toFixed(3),average:steps?+(cost/steps).toFixed(3):0});
}
