/**
 * Test-scene DATA for preview.html and check-geometry.mjs (pure: no DOM, no RNG, no clock).
 * Records use the RS3-0.3 shape (SPEC §1.3). Every edge socket is canonical N/W (SPEC §1.2):
 * a house's E/S side is stored as W of (x+1,y) / N of (x,y+1) via canonicalEdge(); the anchor x,y
 * stays on the supporting foundation.
 */
import {canonicalEdge,structureDrawInfo,structureDepth,roofNeighbours,sameHouseRoofPredicate,TILE,XRAY_ALPHA} from './building-visuals.mjs';

const {hw,hh}=TILE;
export const proj=(x,y)=>({x:(x-y)*hw,y:(x+y)*hh});   // src/app.mjs L13-14
const key=(x,y)=>x+':'+y;

export function buildScene(){
 let nextId=1;const stations=[],agents=[],ghosts=[],labels=[],xrayCells=new Set();
 const F=(x,y)=>stations.push({id:nextId++,kind:'WOOD_FOUNDATION',x,y,socket:{type:'cell',x,y,level:0}});
 const R=(x,y)=>stations.push({id:nextId++,kind:'WOOD_ROOF',x,y,socket:{type:'cell',x,y,level:2}});
 // house-relative side N/E/S/W of foundation (fx,fy) -> canonical socket; anchor = the foundation
 const E=(kind,fx,fy,side)=>{const s=canonicalEdge(fx,fy,side);stations.push({id:nextId++,kind,x:fx,y:fy,socket:{...s,level:1}});};
 const Wl=(fx,fy,side)=>E('WOOD_WALL',fx,fy,side), Dw=(fx,fy,side)=>E('WOOD_DOORWAY',fx,fy,side);
 // Generic house: foundations on `cells`, a wall on every perimeter edge, one doorway at door={i,side}, roofs.
 const house=(cells,door,roof=true)=>{const has=(x,y)=>cells.some(c=>c.x===x&&c.y===y),off={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]};
  cells.forEach(c=>F(c.x,c.y));
  cells.forEach((c,i)=>{for(const side of ['N','E','S','W']){const [dx,dy]=off[side];if(has(c.x+dx,c.y+dy))continue;(door&&door.i===i&&door.side===side?Dw:Wl)(c.x,c.y,side);}});
  if(roof)cells.forEach(c=>R(c.x,c.y));};
 const house1=(x,y,door='S',roof=true)=>house([{x,y}],{i:0,side:door},roof);
 const house2=(x,y,door='S',roof=true)=>house([{x,y},{x:x+1,y}],{i:0,side:door},roof);
 const markXray=cells=>cells.forEach(c=>xrayCells.add(key(c.x,c.y)));
 const at=(s,d)=>({x:(s+d)/2,y:(s-d)/2});
 const label=(s,d,text,dy=30)=>labels.push({p:proj((s+d)/2,(s-d)/2),text,dy});
 const mid2=(p,text,dy)=>labels.push({p:{x:(proj(p.x,p.y).x+proj(p.x+1,p.y).x)/2,y:proj(p.x,p.y).y},text,dy});
 const ghost=(piece,x,y,side,ok)=>ghosts.push({piece,socket:side?{...canonicalEdge(x,y,side),level:1}:{type:'cell',x,y,level:piece==='roof'?2:0},ok});
 const A=Math.round(XRAY_ALPHA*100)/100;

 // Row 0: houses
 {let p=at(0,-10);house1(p.x,p.y,'S');agents.push({x:p.x+1,y:p.y});label(0,-10,'1×1 · door S',42);}
 {const p={x:-3,y:2};house2(p.x,p.y,'S');mid2(p,'2×1 · door S',42);}
 {let p=at(0,0);house1(p.x,p.y,'E',false);agents.push({x:p.x,y:p.y});label(0,0,'no roof · door E · clone',42);}
 {const p={x:2,y:-3};house2(p.x,p.y,'S',false);mid2(p,'2×1 no roof',42);}
 {let p=at(0,10);F(p.x,p.y);Wl(p.x,p.y,'N');Wl(p.x,p.y,'W');label(0,10,'back walls N+W');}
 // Row 1: SPEC §10.2/§10.9 roof shapes, §10.3/§10.8 x-ray (roof + FRONT walls at XRAY_ALPHA)
 {let p=at(9,-11);house1(p.x,p.y,'N');label(9,-11,'door N · opaque',44);}
 {let p=at(9,-7);house1(p.x,p.y,'N');markXray([p]);label(9,-7,'door N · x-ray α'+A,44);}
 {let p=at(9,-3);const cells=[p,{x:p.x+1,y:p.y}];house(cells,{i:0,side:'W'});markXray(cells);mid2(p,'2×1 · door W · x-ray α'+A,44);}
 {let p=at(9,3);const cells=[p,{x:p.x+1,y:p.y},{x:p.x,y:p.y+1}];house(cells,{i:2,side:'S'});
  labels.push({p:proj(p.x+.33,p.y+.33),text:'L house (3) · valley',dy:52});}
 {let p=at(9,9);const cells=[p,{x:p.x+1,y:p.y},{x:p.x,y:p.y+1},{x:p.x+1,y:p.y+1}];house(cells,{i:2,side:'S'});
  labels.push({p:proj(p.x+.5,p.y+.5),text:'2×2 house',dy:48});}
 // Row 2: wall variants, Row 3: doorway variants (house-relative side; stored canonically)
 ['N','E','S','W'].forEach((side,i)=>{const d=-9+i*6;let p=at(19,d);F(p.x,p.y);Wl(p.x,p.y,side);
  label(19,d,'wall '+side+(side==='N'||side==='W'?' (back)':' (front) = '+(side==='E'?'W of x+1':'N of y+1')));});
 ['N','E','S','W'].forEach((side,i)=>{const d=-9+i*6;let p=at(27,d);F(p.x,p.y);Dw(p.x,p.y,side);
  label(27,d,'doorway '+side+(side==='N'||side==='W'?' (back)':' (front)'));});
 // Row 4: ghosts. `ok` stands in for the engine validator result; draw code only reads it.
 {const s=36;
  let p=at(s,-12);ghost('foundation',p.x,p.y,null,true);label(s,-12,'foundation ✓');
  p=at(s,-8);ghost('foundation',p.x,p.y,null,false);label(s,-8,'foundation ✕');
  p=at(s,-4);F(p.x,p.y);ghost('wall',p.x,p.y,'N',true);label(s,-4,'wall N ✓');
  p=at(s,0);ghost('wall',p.x,p.y,'E',false);label(s,0,'wall E ✕');
  p=at(s,4);F(p.x,p.y);Wl(p.x,p.y,'N');Wl(p.x,p.y,'W');ghost('doorway',p.x,p.y,'S',true);label(s,4,'doorway S ✓');
  p=at(s,8);house1(p.x,p.y,'S',false);ghost('roof',p.x,p.y,null,true);label(s,8,'roof ✓');
  p=at(s,12);F(p.x,p.y);ghost('roof',p.x,p.y,null,false);label(s,12,'roof ✕');
 }

 // PREVIEW STAND-IN for evaluateModularHouses(s).houses (SPEC §5.1): 4-neighbour components of
 // foundations, houseId = 'H'+lowest foundation id. In the game this comes from src/housing.mjs.
 const foundations=stations.filter(s=>s.kind==='WOOD_FOUNDATION').sort((a,b)=>a.id-b.id);
 const foundationKeys=new Set(foundations.map(s=>key(s.x,s.y))),houseOf=new Map(),houses=[];
 for(const st of foundations){if(houseOf.has(key(st.x,st.y)))continue;
  const h={houseId:'H'+st.id,cells:[]},todo=[[st.x,st.y]];houseOf.set(key(st.x,st.y),h);
  while(todo.length){const [x,y]=todo.pop();h.cells.push({x,y});for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){const k=key(x+dx,y+dy);if(foundationKeys.has(k)&&!houseOf.has(k)){houseOf.set(k,h);todo.push([x+dx,y+dy]);}}}
  houses.push(h);}
 const hasFoundation=(x,y)=>foundationKeys.has(key(x,y));
 const roofCells=stations.filter(s=>s.kind==='WOOD_ROOF').map(s=>({x:s.socket.x,y:s.socket.y}));

 // Draw list exactly like app.mjs render(): stations by structureDepth(), agents x+y+.2, stable sort.
 const optsFor=(st,info)=>{
  if(info.piece==='roof'){const h=houseOf.get(key(info.x,info.y));
   return h?{neighbours:roofNeighbours(info,sameHouseRoofPredicate(h.cells,roofCells)),xray:xrayCells.has(key(info.x,info.y))}:{};}
  if(info.piece==='wall'||info.piece==='doorway')return {role:info.role,xray:xrayCells.has(key(info.houseCell.x,info.houseCell.y))};
  return {};};
 const drawList=[
  ...stations.map(st=>{const info=structureDrawInfo(st,{hasFoundation});if(!info)throw new Error("undrawable "+JSON.stringify(st));return {kind:'station',id:st.id,st,info,opts:optsFor(st,info),depth:structureDepth(st)};}),
  ...agents.map((a,i)=>({kind:'agent',id:1000+i,data:a,depth:a.x+a.y+.2}))
 ].sort((a,b)=>a.depth-b.depth||a.id-b.id);
 return {stations,agents,ghosts,labels,xrayCells,houses,hasFoundation,drawList};
}
