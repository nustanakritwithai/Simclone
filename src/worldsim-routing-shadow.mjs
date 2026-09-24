/** WM2.2 — read-only deterministic weighted-route candidate.
 * Never mutates simulation state and never owns authoritative movement.
 */
import {MAP_SIZE,createWorldMapView,shadowMovementCell,shadowRouteMovementCost} from './worldsim-map.mjs?v=0.5.0';

export const SHADOW_ROUTER_VERSION='wm2.2-shadow-dijkstra-1';
const SCALE=1000;
const NEIGHBORS=Object.freeze([[0,-1],[-1,0],[1,0],[0,1]]);
const nodeId=(x,y)=>y*MAP_SIZE.w+x;
const point=id=>({x:id%MAP_SIZE.w,y:Math.floor(id/MAP_SIZE.w)});

class MinHeap{
  constructor(){this.a=[];}
  push(v){const a=this.a;a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(compare(a[p],v)<=0)break;a[i]=a[p];i=p;}a[i]=v;}
  pop(){const a=this.a;if(!a.length)return null;const root=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;while(true){const l=i*2+1,r=l+1;let b=i;if(l<a.length&&compare(a[l],a[b])<0)b=l;if(r<a.length&&compare(a[r],a[b])<0)b=r;if(b===i)break;[a[i],a[b]]=[a[b],a[i]];i=b;}}return root;}
}
const compare=(a,b)=>a.cost-b.cost||a.id-b.id;

export function shadowWeightedRoute(state,start,target){
  if(!state||!start||!target)return null;
  for(const p of [start,target])if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=MAP_SIZE.w||p.y>=MAP_SIZE.h)return null;
  const view=createWorldMapView(state),n=MAP_SIZE.w*MAP_SIZE.h,startId=nodeId(start.x,start.y),targetId=nodeId(target.x,target.y);
  if(shadowMovementCell(view,start.x,start.y)?.movementCost===null||shadowMovementCell(view,target.x,target.y)?.movementCost===null)return null;
  const dist=new Float64Array(n);dist.fill(Infinity);const parent=new Int32Array(n);parent.fill(-1);
  const heap=new MinHeap();dist[startId]=0;parent[startId]=startId;heap.push({id:startId,cost:0});
  while(true){
    const cur=heap.pop();if(!cur)break;if(cur.cost!==dist[cur.id])continue;if(cur.id===targetId)break;
    const p=point(cur.id);
    for(const [dx,dy] of NEIGHBORS){
      const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=MAP_SIZE.w||y>=MAP_SIZE.h)continue;
      const cell=shadowMovementCell(view,x,y);if(!cell||cell.movementCost===null)continue;
      const id=nodeId(x,y),step=Math.round(cell.movementCost*SCALE),cost=cur.cost+step;
      if(cost<dist[id]){dist[id]=cost;parent[id]=cur.id;heap.push({id,cost});}
    }
  }
  if(!Number.isFinite(dist[targetId]))return null;
  const path=[];for(let id=targetId;id!==startId;id=parent[id]){if(id<0)return null;path.push(point(id));}path.reverse();
  return Object.freeze({version:SHADOW_ROUTER_VERSION,path:Object.freeze(path.map(Object.freeze)),steps:path.length,costUnits:dist[targetId],cost:+(dist[targetId]/SCALE).toFixed(3)});
}

export function compareShadowRouting(state,start,target,currentPath){
  const view=createWorldMapView(state),current=shadowRouteMovementCost(view,currentPath??[]),weighted=shadowWeightedRoute(state,start,target);
  if(!weighted)return Object.freeze({current,weighted:null,savings:null});
  const savings=current?+(current.cost-weighted.cost).toFixed(3):null;
  return Object.freeze({current,weighted,savings});
}
