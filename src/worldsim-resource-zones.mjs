/** WM4.8 — read-only ecological resource-zone projection.
 * Groups high-suitability WorldSim cells into deterministic cardinally
 * contiguous Food/Wood/Stone zones. It does not place, move or mutate nodes.
 */
import {createResourceEcologyShadow} from './worldsim-resource-shadow.mjs?v=0.5.0';
import {RESOURCE_REGEN_AUTHORITY} from './worldsim-resource-authority.mjs?v=0.5.0';

export const RESOURCE_ZONE_SHADOW_VERSION='wm4.8-shadow-resource-zones-1';
export const RESOURCE_ZONE_TYPES=Object.freeze(['food','wood','stone']);
export const RESOURCE_ZONE_POLICY=Object.freeze({
  relativeQuantile:.65,
  absoluteFloor:Object.freeze({food:.12,wood:.10,stone:.18}),
  neighborhood:'cardinal-4',
  minCells:1
});

const clamp=n=>Math.max(0,Math.min(1,n));
const round4=n=>+n.toFixed(4);
const cellIndex=(x,y,width)=>y*width+x;

function discreteQuantile(values,q){
  if(!values.length)return 0;
  const sorted=values.slice().sort((a,b)=>a-b);
  return sorted[Math.floor((sorted.length-1)*clamp(q))];
}

export function resourceZoneThreshold(shadow,type){
  if(!RESOURCE_ZONE_TYPES.includes(type))throw new Error('Invalid resource zone type');
  if(!shadow||!Number.isInteger(shadow.width)||!Number.isInteger(shadow.height)||!Array.isArray(shadow.cells)||shadow.cells.length!==shadow.width*shadow.height)
    throw new Error('Invalid resource ecology shadow');
  const values=shadow.cells.map(c=>c?.suitability?.[type]).filter(v=>typeof v==='number'&&Number.isFinite(v)&&v>0);
  if(!values.length)return 1;
  const max=Math.max(...values);
  return round4(Math.min(max,Math.max(RESOURCE_ZONE_POLICY.absoluteFloor[type],discreteQuantile(values,RESOURCE_ZONE_POLICY.relativeQuantile))));
}

function cardinal(index,width,height){
  const x=index%width,y=Math.floor(index/width),out=[];
  if(y>0)out.push(index-width);
  if(x>0)out.push(index-1);
  if(x<width-1)out.push(index+1);
  if(y<height-1)out.push(index+width);
  return out;
}

function componentsFor(shadow,type,threshold){
  const {width,height}=shadow;
  const eligible=new Set(shadow.cells.filter(c=>(c?.suitability?.[type]??0)>0&&(c?.suitability?.[type]??0)>=threshold).map(c=>c.index));
  const visited=new Set(),components=[];
  for(const start of [...eligible].sort((a,b)=>a-b)){
    if(visited.has(start))continue;
    const queue=[start],indices=[];visited.add(start);
    for(let q=0;q<queue.length;q++){
      const index=queue[q];indices.push(index);
      for(const n of cardinal(index,width,height))if(eligible.has(n)&&!visited.has(n)){visited.add(n);queue.push(n);}
    }
    indices.sort((a,b)=>a-b);
    if(indices.length>=RESOURCE_ZONE_POLICY.minCells)components.push(indices);
  }
  return components;
}

function zoneFromComponent(state,shadow,type,threshold,indices){
  const width=shadow.width;
  const set=new Set(indices),cells=indices.map(i=>shadow.cells[i]),scores=cells.map(c=>c.suitability[type]);
  let sx=0,sy=0;
  for(const c of cells){sx+=c.x;sy+=c.y;}
  const nodeRows=(state.nodes??[]).filter(n=>n.type===type&&set.has(cellIndex(n.x,n.y,width))).sort((a,b)=>a.id-b.id);
  const totalAmount=nodeRows.reduce((s,n)=>s+n.amount,0),totalCapacity=nodeRows.reduce((s,n)=>s+n.max,0);
  const averagePressure=nodeRows.length
    ? nodeRows.reduce((s,n)=>s+(n.max>0?clamp(1-n.amount/n.max):0),0)/nodeRows.length
    : 0;
  let anchor=cells[0];
  for(const c of cells)if(c.suitability[type]>anchor.suitability[type]||
    c.suitability[type]===anchor.suitability[type]&&c.index<anchor.index)anchor=c;
  return Object.freeze({
    id:`wm4.8:${type}:${indices[0]}`,
    type,
    threshold,
    size:indices.length,
    cellIndices:Object.freeze(indices.slice()),
    anchor:Object.freeze({x:anchor.x,y:anchor.y,index:anchor.index,suitability:anchor.suitability[type]}),
    centroid:Object.freeze({x:+(sx/indices.length).toFixed(3),y:+(sy/indices.length).toFixed(3)}),
    averageSuitability:round4(scores.reduce((a,b)=>a+b,0)/scores.length),
    maxSuitability:round4(Math.max(...scores)),
    nodeIds:Object.freeze(nodeRows.map(n=>n.id)),
    nodeCount:nodeRows.length,
    currentAmount:totalAmount,
    maxCapacity:totalCapacity,
    averageHarvestPressure:round4(averagePressure)
  });
}

export function createResourceZonesShadow(state,shadow=createResourceEcologyShadow(state)){
  if(!state||!Array.isArray(state.nodes))throw new Error('Invalid resource-zone state');
  const zones=[],byType={};
  for(const type of RESOURCE_ZONE_TYPES){
    const threshold=resourceZoneThreshold(shadow,type);
    const typeZones=componentsFor(shadow,type,threshold).map(indices=>zoneFromComponent(state,shadow,type,threshold,indices));
    const zonedNodeIds=new Set(typeZones.flatMap(z=>z.nodeIds));
    const nodeCount=state.nodes.filter(n=>n.type===type).length;
    const coveredCells=typeZones.reduce((s,z)=>s+z.size,0);
    byType[type]=Object.freeze({
      threshold,
      zones:typeZones.length,
      cells:coveredCells,
      nodeCount,
      zonedNodes:zonedNodeIds.size,
      unzonedNodes:Math.max(0,nodeCount-zonedNodeIds.size),
      averageZoneSuitability:typeZones.length?round4(typeZones.reduce((s,z)=>s+z.averageSuitability,0)/typeZones.length):0
    });
    zones.push(...typeZones);
  }
  return Object.freeze({
    version:RESOURCE_ZONE_SHADOW_VERSION,width:shadow.width,height:shadow.height,
    authority:Object.freeze({
      mode:'shadow-only',
      ecology:shadow.version,
      resourceWriter:RESOURCE_REGEN_AUTHORITY.writer,
      nodePlacement:'not-owned',
      nodeMutation:false,
      saveFields:0
    }),
    policy:RESOURCE_ZONE_POLICY,
    byType:Object.freeze(byType),
    zones:Object.freeze(zones)
  });
}

export function resourceZoneAt(projection,type,x,y){
  if(!projection||!RESOURCE_ZONE_TYPES.includes(type)||!Number.isInteger(x)||!Number.isInteger(y)||
    x<0||y<0||x>=projection.width||y>=projection.height)return null;
  const index=cellIndex(x,y,projection.width);
  return projection.zones.find(z=>z.type===type&&z.cellIndices.includes(index))??null;
}
