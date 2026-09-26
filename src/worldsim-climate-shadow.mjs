/** WM3.2 — read-only WorldSim climate projection.
 * Uses Simclone tick only as a deterministic shadow cycle. It is NOT the
 * authoritative Living World Climate scheduler and owns no atmospheric water.
 */
import {createWorldMapView} from './worldsim-map.mjs?v=0.5.0';

export const CLIMATE_SHADOW_VERSION='wm3.2-shadow-climate-1';
export const CLIMATE_WEATHER=Object.freeze(['clear','cloudy','rain','heavyRain','hot','dry']);

const clamp=n=>Math.max(0,Math.min(1,n));
const round=n=>+clamp(n).toFixed(4);
const roundC=n=>+n.toFixed(2);

export function climateShadowForCell(cell,{cyclePhase=0,solar=null,worldHeight=26}={}){
  if(!cell)return null;
  const phase=((cyclePhase%1)+1)%1;
  const sun=solar===null?Math.max(0,Math.sin((phase-.25)*Math.PI*2)):clamp(solar);
  const latitude=Math.abs((cell.y/Math.max(1,worldHeight-1))*2-1),elevation=clamp(cell.elevation??.5),moisture=clamp(cell.moisture??.5);
  const water=['deepWater','shallowWater'].includes(cell.terrainType);
  const temperatureNorm=clamp(.78-latitude*.22-elevation*.38+sun*.10-moisture*.03+(water?.03:0));
  const temperatureC=-2+temperatureNorm*38;
  const humidity=clamp(moisture*.78+(water?.16:0)+(1-sun)*.05);
  const cloudCover=clamp((humidity-.45)*1.45+(1-sun)*.08);
  const rainPotential=clamp(Math.max(0,cloudCover-.50)*1.9*Math.max(0,humidity-.52)*2.1);
  const droughtPressure=clamp(Math.max(0,.52-moisture)*1.4+Math.max(0,temperatureC-30)/12-rainPotential*.8);
  const temperatureComfort=clamp(1-Math.abs(temperatureC-24)/22);
  const vegetationClimateFactor=clamp(.40+temperatureComfort*.28+humidity*.24+rainPotential*.10-droughtPressure*.22);
  const weatherType=rainPotential>.48?'heavyRain':rainPotential>.14?'rain':droughtPressure>.65?'dry':temperatureC>32?'hot':cloudCover>.45?'cloudy':'clear';
  return Object.freeze({
    temperatureC:roundC(temperatureC),temperatureNorm:round(temperatureNorm),temperatureComfort:round(temperatureComfort),
    humidity:round(humidity),cloudCover:round(cloudCover),rainPotential:round(rainPotential),droughtPressure:round(droughtPressure),
    solar:round(sun),vegetationClimateFactor:round(vegetationClimateFactor),weatherType
  });
}

export function createClimateShadow(state,view=createWorldMapView(state)){
  const tick=Number.isFinite(state?.tick)?state.tick:0,cyclePhase=((tick%360)+360)%360/360;
  const solar=Math.max(0,Math.sin((cyclePhase-.25)*Math.PI*2)),counts=Object.fromEntries(CLIMATE_WEATHER.map(x=>[x,0]));
  let temperatureC=0,humidity=0,cloudCover=0,rainPotential=0,droughtPressure=0,temperatureComfort=0,vegetationClimateFactor=0;
  const cells=view.cells.map(cell=>{
    const climate=climateShadowForCell(cell,{cyclePhase,solar,worldHeight:view.height});counts[climate.weatherType]++;
    temperatureC+=climate.temperatureC;humidity+=climate.humidity;cloudCover+=climate.cloudCover;rainPotential+=climate.rainPotential;
    droughtPressure+=climate.droughtPressure;temperatureComfort+=climate.temperatureComfort;vegetationClimateFactor+=climate.vegetationClimateFactor;
    return Object.freeze({index:cell.index,x:cell.x,y:cell.y,terrainType:cell.terrainType,...climate});
  });
  const n=cells.length||1,dominantWeather=Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]??'clear';
  return Object.freeze({
    version:CLIMATE_SHADOW_VERSION,
    authority:Object.freeze({mode:'shadow-only',time:'simclone-tick-proxy',atmosphericWater:'not-owned',scheduler:'none'}),
    cycle:Object.freeze({tick,phase:+cyclePhase.toFixed(4),solar:round(solar)}),
    weatherCounts:Object.freeze(counts),
    summary:Object.freeze({
      averageTemperatureC:+(temperatureC/n).toFixed(2),averageHumidity:+(humidity/n).toFixed(4),averageCloudCover:+(cloudCover/n).toFixed(4),
      averageRainPotential:+(rainPotential/n).toFixed(4),averageDroughtPressure:+(droughtPressure/n).toFixed(4),
      averageTemperatureComfort:+(temperatureComfort/n).toFixed(4),averageVegetationClimateFactor:+(vegetationClimateFactor/n).toFixed(4),dominantWeather
    }),
    cells:Object.freeze(cells)
  });
}
