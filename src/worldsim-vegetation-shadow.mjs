/** WM3.4 — read-only WorldSim vegetation/ecology evidence.
 * This layer owns no biomass or plant nutrient reservoir. It derives potential
 * from map + climate + soil + hydrology shadow snapshots only.
 */
import {createWorldMapView} from './worldsim-map.mjs?v=0.5.0';
import {createClimateShadow} from './worldsim-climate-shadow.mjs?v=0.5.0';
import {createSoilShadow} from './worldsim-soil-shadow.mjs?v=0.5.0';
import {createHydrologyShadow} from './worldsim-hydrology-shadow.mjs?v=0.5.0';

export const VEGETATION_SHADOW_VERSION='wm3.4-shadow-vegetation-1';
export const VEGETATION_PROFILES=Object.freeze({
  ground:Object.freeze({grass:1,forest:.70,sand:.16,rock:.05,path:.08,bridge:0,deepWater:0,shallowWater:0}),
  woody:Object.freeze({forest:1,grass:.34,sand:.03,rock:.08,path:.02,bridge:0,deepWater:0,shallowWater:0}),
  wetland:Object.freeze({forest:.28,grass:.22,sand:.10,rock:.01,path:.02,bridge:0,deepWater:.02,shallowWater:.08})
});

const clamp=n=>Math.max(0,Math.min(1,n));
const round=n=>+clamp(n).toFixed(4);

function terrainWeight(profile,terrain){return profile?.[terrain]??0;}

export function vegetationShadowForCell(cell,soil,climate,hydro){
  if(!cell||!soil||!climate||!hydro)return null;
  const terrain=cell.terrainType,active=soil.active&&cell.walkable;
  if(!active)return Object.freeze({
    groundCoverPotential:0,woodyBiomassPotential:0,wetlandBiomassPotential:0,
    livingBiomassPotential:0,deadBiomassPotential:0,litterPotential:0,
    foodYieldPotential:0,woodYieldPotential:0,regenerationPotential:0,
    disturbanceStress:0,carryingCapacity:0
  });

  const soilFactor=clamp(soil.fertility*.42+soil.health*.28+soil.nutrient*.18+soil.organicMatter*.12);
  const waterFactor=clamp(hydro.soilWaterComfort*.45+hydro.waterAvailability*.35+(1-hydro.floodRisk)*.20);
  const wetlandWater=clamp(hydro.waterAvailability*.44+hydro.floodRisk*.34+hydro.soilWaterComfort*.22);
  const climateFactor=clamp(climate.vegetationClimateFactor);
  const solarFactor=clamp(.52+climate.solar*.48);
  const droughtStress=clamp(climate.droughtPressure);
  const floodStress=clamp(Math.max(0,hydro.floodRisk-.58)/.42);
  const soilStress=clamp(1-soil.health);
  const temperatureStress=clamp(1-climate.temperatureComfort);
  const disturbanceStress=clamp(droughtStress*.34+floodStress*.24+soilStress*.24+temperatureStress*.18);

  const ground=clamp(
    terrainWeight(VEGETATION_PROFILES.ground,terrain)*soilFactor*waterFactor*climateFactor*solarFactor
  );
  const woody=clamp(
    terrainWeight(VEGETATION_PROFILES.woody,terrain)*
    clamp(soil.health*.40+soil.fertility*.35+soil.depth*.25)*
    clamp(hydro.waterAvailability*.44+hydro.soilWaterComfort*.36+(1-hydro.floodRisk)*.20)*
    climateFactor
  );
  const wetland=clamp(
    terrainWeight(VEGETATION_PROFILES.wetland,terrain)*
    clamp(soil.organicMatter*.30+soil.nutrient*.25+soil.health*.20+soil.depth*.25)*
    wetlandWater*clamp(.65+climate.humidity*.35)
  );

  const living=clamp(Math.max(ground,woody,wetland)*(.92-disturbanceStress*.30));
  const dead=clamp(living*disturbanceStress*.44);
  const litter=clamp((living*.22+dead*.58)*(.55+soil.organicMatter*.45));
  const food=clamp(ground*.72+wetland*.34+woody*.16);
  const wood=clamp(woody*.88+ground*.08);
  const carrying=clamp(soilFactor*.36+waterFactor*.28+climateFactor*.24+(1-disturbanceStress)*.12);
  const regeneration=clamp(
    Math.max(food,wood)*carrying*(1-disturbanceStress*.65)
  );

  return Object.freeze({
    groundCoverPotential:round(ground),
    woodyBiomassPotential:round(woody),
    wetlandBiomassPotential:round(wetland),
    livingBiomassPotential:round(living),
    deadBiomassPotential:round(dead),
    litterPotential:round(litter),
    foodYieldPotential:round(food),
    woodYieldPotential:round(wood),
    regenerationPotential:round(regeneration),
    disturbanceStress:round(disturbanceStress),
    carryingCapacity:round(carrying)
  });
}

export function createVegetationShadow(
  state,
  view=createWorldMapView(state),
  climate=createClimateShadow(state,view),
  soil=createSoilShadow(state,view,climate),
  hydrology=createHydrologyShadow(state,view,climate,soil)
){
  const keys=['groundCoverPotential','woodyBiomassPotential','wetlandBiomassPotential','livingBiomassPotential',
    'deadBiomassPotential','litterPotential','foodYieldPotential','woodYieldPotential','regenerationPotential',
    'disturbanceStress','carryingCapacity'];
  const totals=Object.fromEntries(keys.map(k=>[k,0])),cells=[];
  let stressed=0;
  for(const cell of view.cells){
    const v=vegetationShadowForCell(cell,soil.cells[cell.index],climate.cells[cell.index],hydrology.cells[cell.index]);
    if(v.disturbanceStress>=.55)stressed++;
    for(const k of keys)totals[k]+=v[k];
    cells.push(Object.freeze({
      index:cell.index,x:cell.x,y:cell.y,terrainType:cell.terrainType,
      soilType:soil.cells[cell.index].soilType,...v
    }));
  }
  const n=cells.length||1,avg=k=>+(totals[k]/n).toFixed(4);
  const top=(key,count=12)=>Object.freeze(cells.filter(c=>c[key]>0)
    .sort((a,b)=>b[key]-a[key]||a.index-b.index).slice(0,count)
    .map(c=>Object.freeze({x:c.x,y:c.y,terrainType:c.terrainType,soilType:c.soilType,value:c[key]})));
  return Object.freeze({
    version:VEGETATION_SHADOW_VERSION,
    authority:Object.freeze({
      mode:'shadow-only',
      livingBiomass:'not-owned',
      deadBiomass:'not-owned',
      litter:'not-owned',
      plantNutrients:'not-owned',
      scheduler:'none'
    }),
    summary:Object.freeze({
      averageLivingBiomassPotential:avg('livingBiomassPotential'),
      averageDeadBiomassPotential:avg('deadBiomassPotential'),
      averageLitterPotential:avg('litterPotential'),
      averageFoodYieldPotential:avg('foodYieldPotential'),
      averageWoodYieldPotential:avg('woodYieldPotential'),
      averageRegenerationPotential:avg('regenerationPotential'),
      averageDisturbanceStress:avg('disturbanceStress'),
      averageCarryingCapacity:avg('carryingCapacity'),
      stressedCells:stressed
    }),
    hotspots:Object.freeze({
      food:top('foodYieldPotential'),
      wood:top('woodYieldPotential'),
      regeneration:top('regenerationPotential')
    }),
    cells:Object.freeze(cells)
  });
}
