/** WS3 — deterministic WorldSim-style climate coupled to WS2 hydrology.
 * Climate owns atmospheric/cloud water. worldMap keeps derived climate fields.
 */
import {WORLD_TERRAIN} from './worldsim-map.mjs?v=0.5.0';

export const WORLD_CLIMATE_VERSION='ws3-climate-0.1';
export const CLIMATE_RULES=Object.freeze({
  cloudFormationThreshold:.68,condensationRate:.16,cloudDissipationRate:.025,
  cloudWaterCapacity:.08,rainThreshold:.58,rainHumidityThreshold:.66,
  rainfallReleaseRate:.24,maximumRainPerTick:.02,temperatureSmoothing:.18,
  maximumTemperatureChangeC:2.5,seasonalAmplitudeC:8,elevationCoolingC:12,
  solarHeatingC:9,nightCoolingC:5,droughtSmoothing:.06
});
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const capacity=tempC=>.018+clamp((tempC+30)/90,0,1)*(.14-.018);
const weatherCode=type=>({clear:0,cloudy:1,rain:2,heavyRain:3,hot:4,dry:5})[type]??0;

export function createWorldClimate(worldMap){
  const n=worldMap.width*worldMap.height,temperatureC=new Array(n),atmosphericWater=new Array(n),cloudWater=new Array(n).fill(0),
    cloudCover=new Array(n).fill(0),solarRadiation=new Array(n).fill(0),windX=new Array(n).fill(.8),windY=new Array(n).fill(0);
  for(let i=0;i<n;i++){
    const t=-4+clamp(worldMap.temperature[i],0,1)*40;temperatureC[i]=+t.toFixed(4);
    atmosphericWater[i]=+(clamp(worldMap.atmosphericHumidity[i],0,1)*capacity(t)).toFixed(6);
  }
  return {version:WORLD_CLIMATE_VERSION,tick:0,totalMinutes:480,temperatureC,atmosphericWater,cloudWater,cloudCover,solarRadiation,windX,windY,
    totalEvaporationReceived:0,totalRainfallReleased:0,lastEvaporationReceived:0,lastRainfallReleased:0,lastCombinedWaterError:0};
}
export function validateWorldClimate(c,n){
  if(!c||c.version!==WORLD_CLIMATE_VERSION)return ['World climate version'];const errors=[];
  for(const k of ['temperatureC','atmosphericWater','cloudWater','cloudCover','solarRadiation','windX','windY'])
    if(!Array.isArray(c[k])||c[k].length!==n)errors.push('World climate '+k);
  for(const k of ['tick','totalMinutes','totalEvaporationReceived','totalRainfallReleased','lastEvaporationReceived','lastRainfallReleased','lastCombinedWaterError'])
    if(typeof c[k]!=='number'||!Number.isFinite(c[k]))errors.push('World climate '+k);
  return errors;
}
export function receiveHydrologyEvaporation(climate,index,amount){
  if(amount<=0)return;climate.atmosphericWater[index]+=amount;climate.totalEvaporationReceived+=amount;climate.lastEvaporationReceived+=amount;
}
function totalClimateWater(c){let n=0;for(let i=0;i<c.atmosphericWater.length;i++)n+=c.atmosphericWater[i]+c.cloudWater[i];return n;}
export function stepWorldClimate(worldMap,climate,steps=1){
  if(!Number.isInteger(steps)||steps<0||steps>10000)throw new Error('Invalid climate step count');
  const n=worldMap.width*worldMap.height;
  for(let step=0;step<steps;step++){
    const before=totalClimateWater(climate),beforeEvap=climate.totalEvaporationReceived;
    climate.lastRainfallReleased=0;climate.totalMinutes+=4;
    const dayProgress=((climate.totalMinutes%1440)+1440)%1440/1440;
    const absoluteDay=Math.floor(climate.totalMinutes/1440),yearProgress=(absoluteDay%120)/120,seasonalWave=Math.sin(yearProgress*Math.PI*2);
    const sun=Math.max(0,Math.sin((dayProgress-.25)*Math.PI*2));
    for(let i=0;i<n;i++){
      const row=Math.floor(i/worldMap.width),latitude=worldMap.height<=1?0:(row/(worldMap.height-1))*2-1;
      const baseline=-4+clamp(worldMap.temperature[i],0,1)*40;
      const seasonal=-latitude*seasonalWave*CLIMATE_RULES.seasonalAmplitudeC;
      const cloud=clamp(climate.cloudCover[i],0,1),waterModeration=['deepWater','shallowWater'].includes(WORLD_TERRAIN[worldMap.terrain[i]])||worldMap.surfaceWater[i]>.15?.55:1;
      const target=baseline+seasonal+(sun*CLIMATE_RULES.solarHeatingC-(1-sun)*CLIMATE_RULES.nightCoolingC+(sun>.05?-cloud*2.52:cloud*1.1))*waterModeration-worldMap.elevation[i]*CLIMATE_RULES.elevationCoolingC;
      const current=climate.temperatureC[i],change=clamp((target-current)*CLIMATE_RULES.temperatureSmoothing,-CLIMATE_RULES.maximumTemperatureChangeC,CLIMATE_RULES.maximumTemperatureChangeC);
      climate.temperatureC[i]=clamp(current+change,-30,60);climate.solarRadiation[i]=sun;

      const cap=capacity(climate.temperatureC[i]),threshold=cap*CLIMATE_RULES.cloudFormationThreshold-worldMap.elevation[i]*cap*.1;
      const excess=Math.max(0,climate.atmosphericWater[i]-threshold),condensed=Math.min(climate.atmosphericWater[i],excess*CLIMATE_RULES.condensationRate);
      climate.atmosphericWater[i]-=condensed;climate.cloudWater[i]+=condensed;
      const humidity=clamp(climate.atmosphericWater[i]/Math.max(cap,Number.EPSILON),0,1),dryness=Math.max(0,CLIMATE_RULES.cloudFormationThreshold-humidity);
      const dissipated=Math.min(climate.cloudWater[i],CLIMATE_RULES.cloudDissipationRate*(dryness+sun*.3));
      climate.cloudWater[i]-=dissipated;climate.atmosphericWater[i]+=dissipated;
      const targetCover=clamp(climate.cloudWater[i]/CLIMATE_RULES.cloudWaterCapacity,0,1);
      climate.cloudCover[i]=clamp(climate.cloudCover[i]+(targetCover-climate.cloudCover[i])*.22,0,1);

      const humidity2=clamp(climate.atmosphericWater[i]/Math.max(capacity(climate.temperatureC[i]),Number.EPSILON),0,1);
      let rain=0;
      if(climate.cloudCover[i]>=CLIMATE_RULES.rainThreshold&&humidity2>=CLIMATE_RULES.rainHumidityThreshold){
        const cp=clamp((climate.cloudCover[i]-CLIMATE_RULES.rainThreshold)/(1-CLIMATE_RULES.rainThreshold),0,1);
        const hp=clamp((humidity2-CLIMATE_RULES.rainHumidityThreshold)/(1-CLIMATE_RULES.rainHumidityThreshold),0,1);
        rain=Math.min(CLIMATE_RULES.maximumRainPerTick,climate.cloudWater[i]*CLIMATE_RULES.rainfallReleaseRate*(.45+cp*.35+hp*.2));
        climate.cloudWater[i]-=rain;climate.totalRainfallReleased+=rain;climate.lastRainfallReleased+=rain;
      }
      worldMap.atmosphericHumidity[i]=+humidity2.toFixed(4);worldMap.rainfall[i]=+rain.toFixed(6);
      const droughtTarget=clamp((.55-humidity2)*1.35+(climate.temperatureC[i]>30?(climate.temperatureC[i]-30)/30:0)+(worldMap.soilMoisture[i]<.3?(.3-worldMap.soilMoisture[i]):0),0,1);
      worldMap.droughtPressure[i]=+clamp(worldMap.droughtPressure[i]+(droughtTarget-worldMap.droughtPressure[i])*CLIMATE_RULES.droughtSmoothing,0,1).toFixed(4);
      const weather=rain>.012?'heavyRain':rain>0?'rain':worldMap.droughtPressure[i]>.65?'dry':climate.temperatureC[i]>34?'hot':climate.cloudCover[i]>.45?'cloudy':'clear';
      worldMap.weather[i]=weatherCode(weather);
    }
    const after=totalClimateWater(climate),evapInput=climate.totalEvaporationReceived-beforeEvap;
    climate.lastCombinedWaterError=Math.abs(after-before-evapInput+climate.lastRainfallReleased);
    climate.tick++;
  }
  climate.lastEvaporationReceived=0;
  return climate;
}
export function climateSummary(worldMap,c){
  const avg=a=>+(a.reduce((s,v)=>s+v,0)/a.length).toFixed(4);
  return {version:c.version,tick:c.tick,hour:Math.floor((((c.totalMinutes%1440)+1440)%1440)/60),temperatureC:avg(c.temperatureC),
    humidity:avg(worldMap.atmosphericHumidity),cloudCover:avg(c.cloudCover),rainfall:+c.lastRainfallReleased.toFixed(6),
    drought:avg(worldMap.droughtPressure),conservationError:c.lastCombinedWaterError};
}
