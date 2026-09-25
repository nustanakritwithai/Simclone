// Node self-check for the DRAFT visuals: `node check-geometry.mjs`. Pure, no DOM, no randomness.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pieceGeometry,localEdge,structureDepth,structureDrawInfo,roofNeighbours,sameHouseRoofPredicate,roofAlpha,edgeAlpha,canonicalEdge,edgeCells,edgeRole,drawPiece,FOUNDATION_H,WALL_H,ROOF_H,XRAY_ALPHA,SIZES,TILE} from './building-visuals.mjs';
import {buildScene,proj} from './preview-scene.mjs';
const eq=(a,b,m)=>assert.ok(Math.abs(a[0]-b[0])<1e-9&&Math.abs(a[1]-b[1])<1e-9,m+' '+a+' vs '+b);
const {hw,hh}=TILE,z0=FOUNDATION_H,z1=FOUNDATION_H+WALL_H;
const T=[0,-hh],R=[hw,0],B=[0,hh],L=[-hw,0],up=(p,z)=>[p[0],p[1]-z];
// 1. foundation top = tile diamond lifted by FOUNDATION_H
const top=pieceGeometry('foundation').faces.find(f=>f.tone==='top').points;
[T,R,B,L].forEach((p,i)=>eq(top[i],up(p,z0),'foundation corner'));
// 2. each wall/doorway sits exactly on its diamond edge (base) and reaches wall-top (roof eave)
const ends={N:[T,R],E:[B,R],S:[L,B],W:[L,T]};
for(const piece of ['wall','doorway'])for(const e of ['N','E','S','W']){
 const faces=pieceGeometry(piece,e).faces.filter(f=>f.tone!=='opening');
 const pts=faces.flatMap(f=>f.points),xs=pts.map(p=>p[0]);
 eq(pts.find(p=>p[0]===Math.min(...xs)&&Math.abs(p[1]-up(ends[e][0],z0)[1])<1e-9)??[NaN,NaN],up(ends[e][0],z0),piece+' '+e+' base start');
 eq(pts.find(p=>p[0]===Math.max(...xs)&&Math.abs(p[1]-up(ends[e][1],z0)[1])<1e-9)??[NaN,NaN],up(ends[e][1],z0),piece+' '+e+' base end');
 assert.ok(pts.some(p=>Math.abs(p[1]-up(ends[e][0],z1)[1])<1e-9&&p[0]===ends[e][0][0]),piece+' '+e+' top start');
 // doorway panels tile the edge with no gap/overlap: [0,d0] [d0,d1](header) [d1,1]
}
// 3. roof eave = wall top diamond
const roofPts=pieceGeometry('roof').faces.flatMap(f=>f.points);
for(const p of [T,R,B,L])assert.ok(roofPts.some(q=>Math.abs(q[0]-p[0])<1e-9&&Math.abs(q[1]-up(p,z1)[1])<1e-9),'roof eave corner');
// 4. canonical edge helpers (SPEC §1.2)
assert.equal(localEdge({type:'edge',x:3,y:4,side:'N'},{x:3,y:4}),'N');
assert.equal(localEdge({type:'edge',x:3,y:4,side:'N'},{x:3,y:3}),'S');
assert.equal(localEdge({type:'edge',x:3,y:4,side:'W'},{x:3,y:4}),'W');
assert.equal(localEdge({type:'edge',x:3,y:4,side:'W'},{x:2,y:4}),'E');
assert.equal(localEdge({type:'edge',x:3,y:4,side:'W'},{x:5,y:4}),null);
// 5. depth order inside a tile: back edges < foundation < agent(.2) < roof < front edges
const d=(socket,kind='WOOD_WALL',x=socket.x,y=socket.y)=>structureDepth({kind,x,y,socket});
const back=d({type:'edge',x:5,y:5,side:'N',level:1}),found=d({type:'cell',x:5,y:5,level:0},'WOOD_FOUNDATION'),
 roof=d({type:'cell',x:5,y:5,level:2},'WOOD_ROOF'),frontS=d({type:'edge',x:5,y:6,side:'N',level:1},'WOOD_WALL',5,5),
 frontE=d({type:'edge',x:6,y:5,side:'W',level:1},'WOOD_WALL',5,5);
assert.ok(back<found&&found<5+5+.2&&5+5+.2<roof&&roof<frontS&&frontS===frontE);
assert.equal(structureDrawInfo({kind:'WOOD_WALL',x:5,y:5,socket:{type:'legacy',x:5,y:5,level:null}}),null);
assert.deepEqual(structureDrawInfo({kind:'WOOD_DOORWAY',x:5,y:5,socket:{type:'edge',x:5,y:6,side:'N',level:1}}),
 {piece:'doorway',x:5,y:6,edge:'N',depth:10.5,role:'front',houseCell:{x:5,y:5},houseEdge:'S'});
assert.equal(structureDrawInfo({kind:'WOOD_WALL',x:5,y:5,socket:{type:'edge',x:5,y:5,side:'S',level:1}}),null,'non-canonical E/S socket is not drawn');
assert.equal(structureDrawInfo({kind:'WOOD_WALL',x:5,y:5,socket:{type:'edge',x:5,y:5,side:'E',level:1}}),null,'non-canonical E/S socket is not drawn');
// 5b. SPEC §10.7 / §1.2: canonicalEdge + front/back from the foundation cell
assert.deepEqual(canonicalEdge(3,4,'E'),{type:'edge',x:4,y:4,side:'W'});
assert.deepEqual(canonicalEdge(3,4,'S'),{type:'edge',x:3,y:5,side:'N'});
assert.deepEqual(canonicalEdge(3,4,'N'),{type:'edge',x:3,y:4,side:'N'});
assert.deepEqual(canonicalEdge(3,4,'W'),{type:'edge',x:3,y:4,side:'W'});
assert.deepEqual(edgeCells({type:'edge',x:3,y:4,side:'N'}),[{x:3,y:4},{x:3,y:3}]);
assert.deepEqual(edgeCells({type:'edge',x:3,y:4,side:'W'}),[{x:3,y:4},{x:2,y:4}]);
{const only=(...cells)=>(x,y)=>cells.some(c=>c[0]===x&&c[1]===y);
 const N={type:'edge',x:3,y:4,side:'N'},W={type:'edge',x:3,y:4,side:'W'};
 assert.deepEqual(edgeRole(N,{x:3,y:4},only([3,4])),{role:'back',houseCell:{x:3,y:4},houseEdge:'N'});
 assert.deepEqual(edgeRole(N,{x:3,y:3},only([3,3])),{role:'front',houseCell:{x:3,y:3},houseEdge:'S'});
 assert.deepEqual(edgeRole(W,{x:3,y:4},only([3,4])),{role:'back',houseCell:{x:3,y:4},houseEdge:'W'});
 assert.deepEqual(edgeRole(W,{x:2,y:4},only([2,4])),{role:'front',houseCell:{x:2,y:4},houseEdge:'E'});
 // foundations on BOTH sides (shared/interior wall): role 'interior', drawn from the anchor's side
 assert.deepEqual(edgeRole(N,{x:3,y:3},only([3,4],[3,3])),{role:'interior',houseCell:{x:3,y:3},houseEdge:'S'});
 assert.deepEqual(edgeRole(W,{x:3,y:4},only([3,4],[2,4])),{role:'interior',houseCell:{x:3,y:4},houseEdge:'W'});
 // the foundation cell wins over a mismatching anchor; no predicate -> anchor decides
 assert.equal(edgeRole(N,{x:3,y:4},only([3,3])).role,'front');
 assert.equal(edgeRole(N,{x:3,y:3}).role,'front');assert.equal(edgeRole(N,{x:3,y:4}).role,'back');
 assert.equal(edgeRole(N,{x:9,y:9}).role,'unknown');}
// 6. forbidden APIs in executable code (comments stripped; preview.html may use document/window, modules may not)
const code=f=>readFileSync(new URL(f,import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"])\/\/.*$/gm,'$1');
for(const f of ['building-visuals.mjs','building-icons.mjs','preview-scene.mjs','preview.html'])assert.ok(!new RegExp('Math\\.'+'random|\\bDa'+'te\\b').test(code(f)),f+' uses RNG/clock');
for(const f of ['building-visuals.mjs','building-icons.mjs','preview-scene.mjs'])assert.ok(!/\b(document|window|localStorage|globalThis)\b/.test(code(f)),f+' touches the DOM');
// 7. SPEC §10.1 sizes live in one exported place
assert.deepEqual([SIZES.FOUNDATION_H,SIZES.WALL_H,SIZES.ROOF_H,SIZES.WALL_TOP_Z,SIZES.ROOF_TOP_Z],[3,28,16,31,47]);
// SPEC §10.8: one x-ray alpha for roof + front walls/doorways; back walls stay opaque
assert.equal(XRAY_ALPHA,.35);assert.equal(roofAlpha({}),1);assert.equal(roofAlpha({xray:true}),XRAY_ALPHA);
assert.equal(edgeAlpha({xray:true,role:'front'}),XRAY_ALPHA);assert.equal(edgeAlpha({xray:true,role:'interior'}),XRAY_ALPHA);
assert.equal(edgeAlpha({xray:true,role:'back'}),1);assert.equal(edgeAlpha({xray:true,role:'unknown'}),1);
assert.equal(edgeAlpha({role:'front'}),1);assert.equal(edgeAlpha({xray:false,role:'front'}),1);
// recording 2D context: the alpha actually used for every fill/stroke
function recCtx(){const log=[],st={globalAlpha:1},stack=[];return {log,ctx:new Proxy(st,{get(t,k){
 if(k==='save')return ()=>stack.push({...t});if(k==='restore')return ()=>Object.assign(t,stack.pop());
 if(k==='fill'||k==='stroke')return ()=>log.push(t.globalAlpha);if(k in t)return t[k];return ()=>{};},
 set(t,k,v){t[k]=v;return true;}})};}
const alphasOf=(piece,edge,opts)=>{const r=recCtx();drawPiece(r.ctx,piece,edge,opts);return [...new Set(r.log)];};
for(const piece of ['wall','doorway'])for(const e of ['N','W']){
 assert.deepEqual(alphasOf(piece,e,{xray:true,role:'front'}),[XRAY_ALPHA],piece+' '+e+' front x-ray');
 assert.deepEqual(alphasOf(piece,e,{xray:true,role:'back'}),[1],piece+' '+e+' back stays opaque');
 assert.deepEqual(alphasOf(piece,e,{role:'front'}),[1],piece+' '+e+' no x-ray');}
assert.deepEqual(alphasOf('roof',null,{xray:true}),[XRAY_ALPHA]);assert.deepEqual(alphasOf('roof',null,{}),[1]);
// 8. SPEC §10.2 continuous roofs: for EVERY roofed shape inside a 3x3 block (511 shapes), each cell's
//    roof faces tile the cell exactly (uv area sums to 1, no face outside the cell) and every vertex
//    shared between cells has one height -> no gap, no overlap, no valley along shared sides.
const uvArea=pts=>{let a=0;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a)/2;};
let shapes=0;
for(let mask=1;mask<512;mask++){
 const cells=[];for(let i=0;i<9;i++)if(mask>>i&1)cells.push({x:i%3,y:Math.floor(i/3)});
 const pred=sameHouseRoofPredicate(cells,cells),heights=new Map();
 for(const cell of cells){
  const n=roofNeighbours(cell,pred),g=pieceGeometry('roof',null,{neighbours:n});
  const total=g.faces.reduce((s,f)=>s+uvArea(f.uv3),0);
  assert.ok(Math.abs(total-1)<1e-9,'roof faces must tile the cell: mask '+mask+' cell '+cell.x+','+cell.y+' area '+total);
  for(const f of g.faces)for(const [u,v,z] of f.uv3){
   assert.ok(Math.abs(u)<=.5+1e-9&&Math.abs(v)<=.5+1e-9&&z>=0&&z<=ROOF_H,'roof vertex inside cell');
   const k=(cell.x+u)+':'+(cell.y+v);if(heights.has(k))assert.ok(Math.abs(heights.get(k)-z)<1e-9,'height mismatch at '+k+' mask '+mask);else heights.set(k,z);
  }
  // merged sides have no eave on them
  for(const s of ['N','E','S','W'])if(n.has(s)){const mid={N:[0,-.5],E:[.5,0],S:[0,.5],W:[-.5,0]}[s];
   assert.ok(g.faces.some(f=>f.uv3.some(p=>p[0]===mid[0]&&p[1]===mid[1]&&p[2]===ROOF_H)),'ridge reaches merged side');}
 }
 shapes++;
}
assert.equal(shapes,511);
// 2x1 must not draw the hip faces on the shared side
assert.equal(pieceGeometry('roof',null,{neighbours:['E']}).faces.length,3);
assert.equal(roofNeighbours({x:0,y:0},sameHouseRoofPredicate([{x:0,y:0},{x:1,y:0}],[{x:0,y:0}])).size,0,'unroofed neighbour does not merge');
assert.deepEqual([...roofNeighbours({x:0,y:0},sameHouseRoofPredicate([{x:0,y:0},{x:1,y:0}],[{x:0,y:0},{x:1,y:0},{x:0,y:1}]))],['E'],'other-house roof does not merge');
// 9. preview scene (preview-scene.mjs): canonical-only data, and canonical drawing == old anchor-based drawing
{const sc=buildScene(),edges=sc.drawList.filter(o=>o.kind==='station'&&o.st.socket.type==='edge');
 assert.ok(sc.stations.filter(s=>s.socket.type==='edge').every(s=>s.socket.side==='N'||s.socket.side==='W'),'saves store only N/W');
 assert.ok(sc.ghosts.filter(g=>g.socket.type==='edge').every(g=>g.socket.side==='N'||g.socket.side==='W'),'ghost sockets canonical');
 assert.equal(sc.drawList.filter(o=>o.kind==='station').length,sc.stations.length,'every station drawable');
 const pts=(piece,edge,cell)=>{const o=proj(cell.x,cell.y);return pieceGeometry(piece,edge).faces.map(f=>f.points.map(([x,y])=>[+(x+o.x).toFixed(9),+(y+o.y).toFixed(9)]));};
 const oldMid={N:[0,-.5],E:[.5,0],S:[0,.5],W:[-.5,0]};let es=0;
 for(const o of edges){const {st,info}=o;
  assert.ok(info.edge==='N'||info.edge==='W','drawn side is the stored canonical side');
  assert.deepEqual(info.houseCell,{x:st.x,y:st.y},'house cell = anchor foundation (id '+st.id+')');
  // polygons: stored socket cell + side  ==  anchor + house-relative side (old non-canonical path)
  assert.deepEqual(pts(info.piece,info.edge,info),pts(info.piece,info.houseEdge,info.houseCell),'geometry id '+st.id);
  // depth: canonical formula == old anchor + local-edge midpoint formula
  const od=st.x+st.y+oldMid[info.houseEdge][0]+oldMid[info.houseEdge][1];
  assert.ok(Math.abs(o.depth-od)<1e-12,'depth id '+st.id);
  assert.equal(info.role,info.houseEdge==='N'||info.houseEdge==='W'?'back':'front');
  if(info.houseEdge==='E'||info.houseEdge==='S'){es++;assert.equal(st.socket.side,info.houseEdge==='E'?'W':'N','visible '+info.houseEdge+' from '+st.socket.side);}}
 assert.ok(es>=20,'scene has visible E/S walls, all from canonical W/N sockets: '+es);
 // draw order identical to the old non-canonical depth
 const oldDepth=o=>o.kind!=='station'||o.st.socket.type!=='edge'?o.depth:o.st.x+o.st.y+oldMid[o.info.houseEdge][0]+oldMid[o.info.houseEdge][1];
 const oldOrder=[...sc.drawList].sort((a,b)=>oldDepth(a)-oldDepth(b)||a.id-b.id).map(o=>o.id);
 assert.deepEqual(sc.drawList.map(o=>o.id),oldOrder,'draw order');
 // x-ray houses: roof + front edges at XRAY_ALPHA, back edges opaque; opaque houses unchanged
 let xf=0,xb=0;
 for(const o of sc.drawList.filter(o=>o.kind==='station'&&o.info.piece!=='foundation')){
  const inX=sc.xrayCells.has((o.info.houseCell??o.info).x+':'+(o.info.houseCell??o.info).y);
  const want=inX&&(o.info.piece==='roof'||o.info.role==='front')?XRAY_ALPHA:1;
  assert.deepEqual(alphasOf(o.info.piece,o.info.edge,o.opts),[want],'alpha id '+o.id);
  if(inX&&o.info.role==='front')xf++;if(inX&&o.info.role==='back')xb++;}
 assert.ok(xf>=5&&xb>=4,'x-ray row has front and back edges '+xf+'/'+xb);
 // the x-ray doors on N and W are BACK edges -> opaque, seen through the translucent roof/front walls
 const doors=sc.drawList.filter(o=>o.info?.piece==='doorway'&&sc.xrayCells.has(o.info.houseCell.x+':'+o.info.houseCell.y));
 assert.deepEqual(doors.map(o=>[o.info.houseEdge,o.info.role,alphasOf('doorway',o.info.edge,o.opts)[0]]),[['N','back',1],['W','back',1]]);}
// 10. interior/shared edge (foundations on both sides): position, depth and role do not depend on
//     which foundation is the anchor (spec §1.3: lower station id), and x-ray treats it as front.
{const hf=(x,y)=>(x===3&&y===4)||(x===3&&y===3),sock={type:'edge',x:3,y:4,side:'N',level:1};
 const a=structureDrawInfo({kind:'WOOD_WALL',x:3,y:4,socket:sock},{hasFoundation:hf}),b=structureDrawInfo({kind:'WOOD_WALL',x:3,y:3,socket:sock},{hasFoundation:hf});
 for(const k of ['piece','x','y','edge','depth','role'])assert.equal(a[k],b[k],'interior '+k);
 assert.equal(a.role,'interior');assert.deepEqual(alphasOf('wall',a.edge,{xray:true,role:a.role}),[XRAY_ALPHA]);}
console.log('check-geometry: all checks passed');
