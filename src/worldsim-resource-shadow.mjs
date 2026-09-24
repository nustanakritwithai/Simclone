/** WM3.0 — read-only WorldSim resource ecology shadow model.
 * Uses only physical map-view evidence currently available on main:
 * terrain + elevation + moisture. It never mutates K6 resources or stock.
 */
import {createWorldMapView,visualCellAt} from './worldsim-map.mjs?v=0.5.0';

export const RESOURCE_ECOLOGY_SHADOW_VERSION='wm3.0-shadow-resource-1';
const clamp=n=>Math.max(0,Math.min(1,n));
const bell=(x,opt,width)=>clamp(1-Math.abs(x-opt)/Math.max(width,Number.EPSILON));

export function resourceSuitabilityForCell(cell){
  if(!cell||!cell.walkable)return Object.freeze({food:0,wood:0,stone:0});
  const moisture=clamp(cell.moisture??.5),elevation=clamp(cell.elevation??.5),t=cell.terrainType;
  const foodTerrain=t==='grass'?1:t==='forest'?.72:t==='sand'?.18:t==='rock'?.08:t==='path'?.1:t==='bridge'?0:0;
  const woodTerrain=t==='forest'?1:t==='grass'?.34:t==='sand'?.05:t==='rock'?.08:0;
  const stoneTerrain=t==='rock'?1:t==='sand'?.48:t==='grass'?.14:t==='forest'?.1:0;

  // Proxy version of the Living World limiting-factor idea.
  // WM3.0 intentionally does not invent nutrients/soil-health/temperature authority.
  let food=foodTerrain*bell(moisture,.58,.48)*(1-elevation*.28);
  let wood=woodTerrain*bell(moisture,.62,.55)*(0.7+elevation*.15);
  let stone=stoneTerrain*(0.55+elevation*.45)*(0.9+Math.max(0,.45-moisture)*.2);
  // Preserve biome specialization even under poor local conditions.
  if(t==='grass')wood=Math.min(wood,food*.7);
  if(t==='forest')food=Math.min(food,wood*.85);
  if(t==='rock')food=Math.min(food,stone*.25);
  food=clamp(food);wood=clamp(wood);stone=clamp(stone);
  return Object.freeze({food:+food.toFixed(4),wood:+wood.toFixed(4),stone:+stone.toFixed(4)});
}

export function createResourceEcologyShadow(state){
  const view=createWorldMapView(state),cells=view.cells.map(cell=>{
    const suitability=resourceSuitabilityForCell(cell);
    return Object.freeze({index:cell.index,x:cell.x,y:cell.y,terrainType:cell.terrainType,suitability});
  });
  const totals={food:0,wood:0,stone:0},hotspots={food:[],wood:[],stone:[]};
  for(const c of cells)for(const type of ['food','wood','stone'])totals[type]+=c.suitability[type];
  for(const type of ['food','wood','stone']){
    hotspots[type]=cells.filter(c=>c.suitability[type]>0).sort((a,b)=>b.suitability[type]-a.suitability[type]||a.index-b.index).slice(0,12)
      .map(c=>Object.freeze({x:c.x,y:c.y,terrainType:c.terrainType,suitability:c.suitability[type]}));
  }
  return Object.freeze({
    version:RESOURCE_ECOLOGY_SHADOW_VERSION,
    authority:Object.freeze({mode:'shadow-only',resources:'simclone-k6'}),
    totals:Object.freeze(Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,+v.toFixed(4)]))),
    hotspots:Object.freeze({food:Object.freeze(hotspots.food),wood:Object.freeze(hotspots.wood),stone:Object.freeze(hotspots.stone)}),
    cells:Object.freeze(cells)
  });
}

export function shadowExistingResourcePressure(state){
  const shadow=createResourceEcologyShadow(state),view=createWorldMapView(state),rows=[];
  for(const node of state.nodes??[]){
    const cell=visualCellAt(view,node.x,node.y),suitability=cell?resourceSuitabilityForCell(cell)[node.type]??0:0;
    const depletion=node.max>0?clamp(1-node.amount/node.max):0;
    rows.push(Object.freeze({
      id:node.id,type:node.type,x:node.x,y:node.y,
      terrainType:cell?.terrainType??null,
      suitability:+suitability.toFixed(4),
      depletion:+depletion.toFixed(4),
      regenerationPressure:+clamp(suitability*depletion).toFixed(4)
    }));
  }
  return Object.freeze({version:RESOURCE_ECOLOGY_SHADOW_VERSION,rows:Object.freeze(rows),summary:shadow.totals});
}
