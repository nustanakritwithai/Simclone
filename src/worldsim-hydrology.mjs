/** WS2 — deterministic WorldSim-style hydrology over canonical worldMap arrays.
 * worldMap owns all water reservoirs. This module owns scheduler/accounting metadata only.
 */
import {WORLD_TERRAIN} from './worldsim-map.mjs?v=0.5.0';

export const WORLD_HYDROLOGY_VERSION='ws2-hydrology-0.1';
export const HYDROLOGY_RULES=Object.freeze({
  flowRate:.35,maximumFlowPerTick:.25,minimumFlowThreshold:.0001,
  absorptionRate:.004,evaporationRate:.001,groundwaterRechargeRate:.001,
  floodThreshold:.35,maximumSurfaceWater:1,soilCapacity:1,groundwaterCapacity:1
});
const ABSORB=Object.freeze({deepWater:0,shallowWater:0,sand:1.6,grass:.9,forest:1.2,rock:.08});
const EVAP=Object.freeze({deepWater:1.18,shallowWater:1.18,sand:1.15,grass:1,forest:.78,rock:1.08});
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const totalWater=m=>{
  let n=0;for(let i=0;i<m.surfaceWater.length;i++)n+=m.surfaceWater[i]+m.soilMoisture[i]+m.groundwater[i];return n;
};

export function createWorldHydrology(){
  return {version:WORLD_HYDROLOGY_VERSION,tick:0,totalRainfall:0,totalEvaporation:0,
    lastRainfall:0,lastEvaporation:0,lastConservationError:0,lastMovedSurfaceWater:0};
}
export function validateWorldHydrology(h){
  if(!h||h.version!==WORLD_HYDROLOGY_VERSION)return ['World hydrology version'];
  const errors=[];for(const k of ['tick','totalRainfall','totalEvaporation','lastRainfall','lastEvaporation','lastConservationError','lastMovedSurfaceWater'])
    if(!finite(h[k])||h[k]<0&&k!=='lastConservationError')errors.push('World hydrology '+k);
  return errors;
}
function terrain(m,i){return WORLD_TERRAIN[m.terrain[i]];}
function transferSurface(m,delta,i,j,amount){if(amount<=0)return 0;delta[i]-=amount;delta[j]+=amount;return amount;}

export function stepWorldHydrology(worldMap,hydrology,steps=1,climate=null){
  if(!Number.isInteger(steps)||steps<0||steps>10000)throw new Error('Invalid hydrology step count');
  const w=worldMap.width,h=worldMap.height,n=w*h;
  if(!hydrology||hydrology.version!==WORLD_HYDROLOGY_VERSION)throw new Error('Invalid hydrology state');
  for(let step=0;step<steps;step++){
    const before=totalWater(worldMap),delta=new Array(n).fill(0);
    let rainAdded=0,evaporated=0,moved=0;

    // Climate rainfall is an explicit external water input.
    for(let i=0;i<n;i++){
      const rain=climate?clamp(worldMap.rainfall[i],0,.02):clamp(worldMap.rainfall[i]*.04,0,.008);
      if(rain>0){const accepted=Math.min(rain,HYDROLOGY_RULES.maximumSurfaceWater-worldMap.surfaceWater[i]);worldMap.surfaceWater[i]+=accepted;rainAdded+=accepted;}
    }

    // Two-phase four-neighbor downhill surface flow using elevation + water head.
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=y*w+x,available=Math.max(0,worldMap.surfaceWater[i]-worldMap.baseSeaDepth[i]);
      if(available<=HYDROLOGY_RULES.minimumFlowThreshold)continue;
      const head=worldMap.elevation[i]+worldMap.surfaceWater[i],lower=[];
      for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
        const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;
        const j=ny*w+nx,d=head-(worldMap.elevation[j]+worldMap.surfaceWater[j]);
        if(d>HYDROLOGY_RULES.minimumFlowThreshold)lower.push([j,d]);
      }
      if(!lower.length)continue;
      const weight=lower.reduce((s,v)=>s+v[1],0);
      const budget=Math.min(available,HYDROLOGY_RULES.maximumFlowPerTick,available*HYDROLOGY_RULES.flowRate);
      for(const [j,d] of lower)moved+=transferSurface(worldMap,delta,i,j,budget*d/weight);
    }
    for(let i=0;i<n;i++)worldMap.surfaceWater[i]=clamp(worldMap.surfaceWater[i]+delta[i],worldMap.baseSeaDepth[i],HYDROLOGY_RULES.maximumSurfaceWater);

    // Internal surface -> soil -> groundwater transfers.
    for(let i=0;i<n;i++){
      const t=terrain(worldMap,i),surfaceAvailable=Math.max(0,worldMap.surfaceWater[i]-worldMap.baseSeaDepth[i]);
      const pore=Math.max(0,HYDROLOGY_RULES.soilCapacity-worldMap.soilMoisture[i]);
      const absorption=Math.min(surfaceAvailable,pore,HYDROLOGY_RULES.absorptionRate*(ABSORB[t]??1));
      worldMap.surfaceWater[i]-=absorption;worldMap.soilMoisture[i]+=absorption;
      const excess=Math.max(0,worldMap.soilMoisture[i]-.58),groundSpace=Math.max(0,HYDROLOGY_RULES.groundwaterCapacity-worldMap.groundwater[i]);
      const recharge=Math.min(excess,groundSpace,HYDROLOGY_RULES.groundwaterRechargeRate);
      worldMap.soilMoisture[i]-=recharge;worldMap.groundwater[i]+=recharge;
    }

    // Evaporation is an explicit external loss until WS3 couples it to atmosphere.
    for(let i=0;i<n;i++){
      const t=terrain(worldMap,i),available=Math.max(0,worldMap.surfaceWater[i]-worldMap.baseSeaDepth[i]);
      const loss=Math.min(available,HYDROLOGY_RULES.evaporationRate*(EVAP[t]??1));
      worldMap.surfaceWater[i]-=loss;evaporated+=loss;
      if(climate&&loss>0){climate.atmosphericWater[i]+=loss;climate.totalEvaporationReceived+=loss;climate.lastEvaporationReceived+=loss;}
      worldMap.flooded[i]=worldMap.surfaceWater[i]-worldMap.baseSeaDepth[i]>=HYDROLOGY_RULES.floodThreshold?1:0;
    }

    const after=totalWater(worldMap),error=after-before-rainAdded+evaporated;
    hydrology.tick++;hydrology.totalRainfall+=rainAdded;hydrology.totalEvaporation+=evaporated;
    hydrology.lastRainfall=rainAdded;hydrology.lastEvaporation=evaporated;
    hydrology.lastConservationError=Math.abs(error);hydrology.lastMovedSurfaceWater=moved;
  }
  return hydrology;
}
export function hydrologySummary(worldMap,h){
  let flooded=0,surface=0,soil=0,groundwater=0;
  for(let i=0;i<worldMap.surfaceWater.length;i++){surface+=worldMap.surfaceWater[i];soil+=worldMap.soilMoisture[i];groundwater+=worldMap.groundwater[i];if(worldMap.flooded[i])flooded++;}
  return {version:h.version,tick:h.tick,surface:+surface.toFixed(4),soil:+soil.toFixed(4),groundwater:+groundwater.toFixed(4),
    flooded,lastRainfall:+h.lastRainfall.toFixed(6),lastEvaporation:+h.lastEvaporation.toFixed(6),
    conservationError:h.lastConservationError};
}
