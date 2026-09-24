/** WM3.1 — read-only WorldSim soil projection.
 * Adapts the Living World 20.9.4 Phase 5 soil architecture without creating
 * a second simulation reservoir. All values are normalized integration proxies.
 */
import {createWorldMapView} from './worldsim-map.mjs?v=0.5.0';

export const SOIL_SHADOW_VERSION='wm3.1-shadow-soil-1';
export const SOIL_TYPES=Object.freeze(['none','coastal','sand','loam','clay','peat','rocky','wetland']);

export const SOIL_PROFILE_PROXY=Object.freeze({
  none:Object.freeze({depth:0,porosity:0,fieldCapacity:0,nutrientCapacity:0,organicCapacity:0,retention:0,moistureOpt:0,moistureWidth:1,baseSalinity:0,acidityStress:0,fertilityPotential:0}),
  coastal:Object.freeze({depth:.35,porosity:.52,fieldCapacity:.28,nutrientCapacity:.22,organicCapacity:.12,retention:.28,moistureOpt:.48,moistureWidth:.48,baseSalinity:.65,acidityStress:.12,fertilityPotential:.28}),
  sand:Object.freeze({depth:.45,porosity:.42,fieldCapacity:.18,nutrientCapacity:.22,organicCapacity:.18,retention:.22,moistureOpt:.38,moistureWidth:.42,baseSalinity:.12,acidityStress:.10,fertilityPotential:.38}),
  loam:Object.freeze({depth:.80,porosity:.50,fieldCapacity:.52,nutrientCapacity:.78,organicCapacity:.72,retention:.72,moistureOpt:.56,moistureWidth:.46,baseSalinity:.04,acidityStress:.08,fertilityPotential:.92}),
  clay:Object.freeze({depth:.72,porosity:.44,fieldCapacity:.68,nutrientCapacity:.70,organicCapacity:.62,retention:.82,moistureOpt:.66,moistureWidth:.38,baseSalinity:.06,acidityStress:.10,fertilityPotential:.78}),
  peat:Object.freeze({depth:.90,porosity:.78,fieldCapacity:.82,nutrientCapacity:.68,organicCapacity:.95,retention:.92,moistureOpt:.76,moistureWidth:.34,baseSalinity:.03,acidityStress:.35,fertilityPotential:.72}),
  rocky:Object.freeze({depth:.22,porosity:.18,fieldCapacity:.12,nutrientCapacity:.15,organicCapacity:.08,retention:.15,moistureOpt:.32,moistureWidth:.50,baseSalinity:.02,acidityStress:.08,fertilityPotential:.18}),
  wetland:Object.freeze({depth:.82,porosity:.65,fieldCapacity:.88,nutrientCapacity:.72,organicCapacity:.82,retention:.90,moistureOpt:.86,moistureWidth:.28,baseSalinity:.08,acidityStress:.18,fertilityPotential:.76})
});

const clamp=n=>Math.max(0,Math.min(1,n));
const round=n=>+clamp(n).toFixed(4);

export function classifySoilShadow(cell){
  if(!cell)return 'none';
  const t=cell.terrainType,m=clamp(cell.moisture??.5),e=clamp(cell.elevation??.5);
  if(t==='deepWater'||t==='bridge')return 'none';
  if(t==='shallowWater')return 'coastal';
  if(t==='rock'||e>.84)return 'rocky';
  if(t==='sand')return m>.62?'coastal':'sand';
  if(t==='forest'){
    if(m>.82&&e<.42)return 'peat';
    if(m>.76&&e<.34)return 'wetland';
    return 'loam';
  }
  if(t==='grass'||t==='path'){
    if(m>.80&&e<.40)return 'wetland';
    if(m>.64)return 'clay';
    return 'loam';
  }
  return 'loam';
}

export function soilShadowForCell(cell,{occupied=false}={}){
  const soilType=classifySoilShadow(cell),p=SOIL_PROFILE_PROXY[soilType];
  if(soilType==='none')return Object.freeze({
    soilType,active:false,depth:0,porosity:0,fieldCapacity:0,organicMatter:0,nutrient:0,
    moistureComfort:0,compaction:0,salinity:0,acidityStress:0,health:0,fertility:0
  });
  const m=clamp(cell.moisture??.5),terrain=cell.terrainType;
  const moistureComfort=clamp(1-Math.abs(m-p.moistureOpt)/Math.max(p.moistureWidth,Number.EPSILON));
  const terrainOrganic=terrain==='forest'?1:terrain==='grass'?.78:terrain==='path'?.42:terrain==='sand'?.28:terrain==='rock'?.15:.35;
  const organicMatter=clamp(p.organicCapacity*terrainOrganic*(.65+m*.35));
  const nutrient=clamp(p.nutrientCapacity*(.58+organicMatter*.24+moistureComfort*.18));
  const baseCompaction=terrain==='path'?.78:occupied?.62:soilType==='clay'?.20:soilType==='wetland'?.16:.08;
  const compaction=clamp(baseCompaction+(occupied&&terrain==='path'?.08:0));
  const salinity=clamp(p.baseSalinity+(soilType==='coastal'?m*.12:0));
  const acidityStress=clamp(p.acidityStress+(soilType==='peat'?(1-m)*.08:0));
  const health=clamp(
    nutrient*.23+organicMatter*.20+moistureComfort*.20+(1-compaction)*.15+
    (1-salinity)*.08+(1-acidityStress)*.06+p.depth*.08
  );
  const fertility=clamp(health*(.52+nutrient*.28+p.fertilityPotential*.20));
  return Object.freeze({
    soilType,active:true,
    depth:round(p.depth),porosity:round(p.porosity),fieldCapacity:round(p.fieldCapacity),
    organicMatter:round(organicMatter),nutrient:round(nutrient),moistureComfort:round(moistureComfort),
    compaction:round(compaction),salinity:round(salinity),acidityStress:round(acidityStress),
    health:round(health),fertility:round(fertility)
  });
}

export function createSoilShadow(state,view=createWorldMapView(state)){
  const occupied=new Set((state.buildings??[]).filter(b=>b.complete!==false).map(b=>b.x+','+b.y));
  const counts=Object.fromEntries(SOIL_TYPES.map(t=>[t,0])),cells=[];
  let active=0,health=0,fertility=0,nutrient=0,organicMatter=0,compaction=0;
  for(const cell of view.cells){
    const soil=soilShadowForCell(cell,{occupied:occupied.has(cell.x+','+cell.y)});
    counts[soil.soilType]++;
    if(soil.active){active++;health+=soil.health;fertility+=soil.fertility;nutrient+=soil.nutrient;organicMatter+=soil.organicMatter;compaction+=soil.compaction;}
    cells.push(Object.freeze({index:cell.index,x:cell.x,y:cell.y,terrainType:cell.terrainType,...soil}));
  }
  const avg=n=>active?+(n/active).toFixed(4):0;
  return Object.freeze({
    version:SOIL_SHADOW_VERSION,
    authority:Object.freeze({mode:'shadow-only',soil:'worldsim-wm3.1',water:'not-owned',nutrients:'proxy-only'}),
    counts:Object.freeze(counts),
    summary:Object.freeze({activeCells:active,averageHealth:avg(health),averageFertility:avg(fertility),averageNutrient:avg(nutrient),averageOrganicMatter:avg(organicMatter),averageCompaction:avg(compaction)}),
    cells:Object.freeze(cells)
  });
}
