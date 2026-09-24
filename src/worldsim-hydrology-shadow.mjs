/** WM3.3 — read-only WorldSim hydrology evidence.
 * This module owns NO water reservoir. It derives deterministic hydraulic
 * potentials from the current map/climate/soil shadow snapshots only.
 */
import {createWorldMapView} from './worldsim-map.mjs?v=0.5.0';
import {createClimateShadow} from './worldsim-climate-shadow.mjs?v=0.5.0';
import {createSoilShadow} from './worldsim-soil-shadow.mjs?v=0.5.0';

export const HYDROLOGY_SHADOW_VERSION='wm3.3-shadow-hydrology-1';
const clamp=n=>Math.max(0,Math.min(1,n));
const round=n=>+clamp(n).toFixed(4);
const WATER=new Set(['deepWater','shallowWater']);

function cardinalNeighbors(view,cell){
  const out=[];
  for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]){
    const x=cell.x+dx,y=cell.y+dy;
    if(x<0||y<0||x>=view.width||y>=view.height)continue;
    out.push(view.cells[y*view.width+x]);
  }
  return out;
}

export function downhillEvidence(view,cell){
  if(!view||!cell)return Object.freeze({targetIndex:null,gradient:0,slope:0});
  const neighbors=cardinalNeighbors(view,cell);
  let target=null,bestDrop=0,maxSlope=0;
  for(const n of neighbors){
    const drop=(cell.elevation??0)-(n.elevation??0);
    maxSlope=Math.max(maxSlope,Math.abs(drop));
    if(drop>bestDrop||drop===bestDrop&&drop>0&&target&&n.index<target.index){
      bestDrop=drop;target=n;
    }else if(drop>0&&target===null){bestDrop=drop;target=n;}
  }
  return Object.freeze({targetIndex:target?.index??null,gradient:+Math.max(0,bestDrop).toFixed(4),slope:+clamp(maxSlope).toFixed(4)});
}

export function hydrologyShadowForCell(cell,soil,climate,flow){
  if(!cell||!soil||!climate)return null;
  const terrain=cell.terrainType,waterTerrain=WATER.has(terrain),moisture=clamp(cell.moisture??0);
  const rain=clamp(climate.rainPotential??0),solar=clamp(climate.solar??0),humidity=clamp(climate.humidity??0);
  const temp=clamp(climate.temperatureNorm??0),slope=clamp(flow?.slope??0),gradient=clamp(flow?.gradient??0);

  // Shadow surface-water availability. This is evidence only, not a reservoir.
  const surfaceWaterPotential=waterTerrain
    ? (terrain==='deepWater'?1:.86)
    : clamp(moisture*.26+rain*.46+Math.max(0,.38-(cell.elevation??0))*.28);

  const poreSpace=soil.active?clamp(Math.min(soil.porosity,1)-moisture*.55):0;
  const compactionModifier=soil.active?clamp(1-soil.compaction*.72):0;
  const depthModifier=soil.active ? .28+soil.depth*.72 : 0;
  const porosityModifier=soil.active ? .45+soil.porosity*.55 : 0;
  const infiltrationPotential=soil.active
    ? clamp(surfaceWaterPotential*poreSpace*compactionModifier*depthModifier*porosityModifier)
    : 0;

  const excessAboveField=soil.active?Math.max(0,moisture-soil.fieldCapacity):0;
  const drainagePotential=soil.active
    ? clamp(excessAboveField*(.45+soil.depth*.35+soil.porosity*.20)*compactionModifier)
    : 0;
  const groundwaterRechargePotential=clamp(Math.min(infiltrationPotential,drainagePotential+infiltrationPotential*.32));

  const runoffPotential=waterTerrain?0:clamp(
    surfaceWaterPotential*(.28+slope*.42+gradient*.22)+(1-compactionModifier)*.22-infiltrationPotential*.58
  );

  const exposedWater=waterTerrain?1:clamp(surfaceWaterPotential*.55+moisture*.45);
  const evaporationPotential=clamp(
    exposedWater*(solar*.40+temp*.25+(1-humidity)*.25+Math.max(0,climate.temperatureC-28)/40*.10)
  );

  const lowland=clamp(1-(cell.elevation??0));
  const floodRisk=waterTerrain?1:clamp(
    rain*.32+surfaceWaterPotential*.28+runoffPotential*.18+lowland*.14+soil.compaction*.08
  );

  const soilWaterComfort=soil.active?clamp(
    .52*soil.moistureComfort+.22*infiltrationPotential+.16*groundwaterRechargePotential+.10*(1-floodRisk)
  ):0;
  const waterAvailability=waterTerrain?1:clamp(
    moisture*.44+infiltrationPotential*.23+groundwaterRechargePotential*.18+(1-evaporationPotential)*.15
  );

  return Object.freeze({
    surfaceWaterPotential:round(surfaceWaterPotential),
    infiltrationPotential:round(infiltrationPotential),
    runoffPotential:round(runoffPotential),
    drainagePotential:round(drainagePotential),
    groundwaterRechargePotential:round(groundwaterRechargePotential),
    evaporationPotential:round(evaporationPotential),
    floodRisk:round(floodRisk),
    soilWaterComfort:round(soilWaterComfort),
    waterAvailability:round(waterAvailability),
    flowTargetIndex:flow?.targetIndex??null,
    downhillGradient:+Math.max(0,flow?.gradient??0).toFixed(4),
    slope:+clamp(flow?.slope??0).toFixed(4)
  });
}

export function createHydrologyShadow(
  state,
  view=createWorldMapView(state),
  climate=createClimateShadow(state,view),
  soil=createSoilShadow(state,view,climate)
){
  const totals={surfaceWaterPotential:0,infiltrationPotential:0,runoffPotential:0,drainagePotential:0,
    groundwaterRechargePotential:0,evaporationPotential:0,floodRisk:0,soilWaterComfort:0,waterAvailability:0};
  let flooded=0,waterCells=0;
  const cells=view.cells.map(cell=>{
    const flow=downhillEvidence(view,cell),soilCell=soil.cells[cell.index],climateCell=climate.cells[cell.index];
    const hydro=hydrologyShadowForCell(cell,soilCell,climateCell,flow);
    if(WATER.has(cell.terrainType))waterCells++;
    if(hydro.floodRisk>=.65)flooded++;
    for(const k of Object.keys(totals))totals[k]+=hydro[k];
    return Object.freeze({index:cell.index,x:cell.x,y:cell.y,terrainType:cell.terrainType,soilType:soilCell.soilType,...hydro});
  });
  const n=cells.length||1,avg=key=>+(totals[key]/n).toFixed(4);
  return Object.freeze({
    version:HYDROLOGY_SHADOW_VERSION,
    authority:Object.freeze({
      mode:'shadow-only',
      surfaceWater:'not-owned',
      soilWater:'not-owned',
      groundwater:'not-owned',
      scheduler:'none',
      conservation:'not-applicable-no-reservoir'
    }),
    summary:Object.freeze({
      waterCells,floodRiskCells:flooded,
      averageSurfaceWaterPotential:avg('surfaceWaterPotential'),
      averageInfiltrationPotential:avg('infiltrationPotential'),
      averageRunoffPotential:avg('runoffPotential'),
      averageDrainagePotential:avg('drainagePotential'),
      averageGroundwaterRechargePotential:avg('groundwaterRechargePotential'),
      averageEvaporationPotential:avg('evaporationPotential'),
      averageFloodRisk:avg('floodRisk'),
      averageSoilWaterComfort:avg('soilWaterComfort'),
      averageWaterAvailability:avg('waterAvailability')
    }),
    climateSummary:climate.summary,
    soilSummary:soil.summary,
    cells:Object.freeze(cells)
  });
}
