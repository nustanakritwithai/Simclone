import test from 'node:test';
import assert from 'node:assert/strict';
import {pieceGeometry,structureDrawInfo,structureDepth,roofNeighbours,drawPiece,PALETTE,FOUNDATION_H,WALL_TOP_Z} from '../src/building-visuals.mjs';

test('canonical wall rendering uses the stored edge socket instead of the foundation anchor',()=>{
 const wall={kind:'WOOD_WALL',x:8,y:9,socket:{type:'edge',x:9,y:9,side:'W',level:1}};
 const info=structureDrawInfo(wall,{hasFoundation:(x,y)=>x===8&&y===9});
 assert.deepEqual({x:info.x,y:info.y,edge:info.edge},{x:9,y:9,edge:'W'});
 assert.equal(info.role,'front');
 assert.equal(info.houseEdge,'E');
 const g=pieceGeometry('wall',info.edge);
 assert.ok(g.faces[0].points.every(p=>Array.isArray(p)&&p.length===2));
});

test('modular painter depth separates back edges, foundation/agent plane and roof',()=>{
 const north={kind:'WOOD_WALL',x:8,y:9,socket:{type:'edge',x:8,y:9,side:'N',level:1}};
 const foundation={kind:'WOOD_FOUNDATION',x:8,y:9,socket:{type:'cell',x:8,y:9,level:0}};
 const roof={kind:'WOOD_ROOF',x:8,y:9,socket:{type:'cell',x:8,y:9,level:2}};
 assert.ok(structureDepth(north)<structureDepth(foundation));
 assert.ok(structureDepth(roof)>8+9+.2);
});

test('legacy structure records stay on the legacy renderer path',()=>{
 const legacy={kind:'WOOD_WALL',x:8,y:9,socket:{type:'legacy',x:8,y:9,level:null}};
 assert.equal(structureDrawInfo(legacy),null);
 assert.equal(structureDepth(legacy),17.15);
});

test('wall and roof geometry use one shared vertical scale',()=>{
 const wall=pieceGeometry('wall','N');
 const ys=wall.faces[0].points.map(p=>p[1]);
 assert.ok(Math.max(...ys)-Math.min(...ys)>=28);
 assert.equal(FOUNDATION_H,3);
 assert.equal(WALL_TOP_Z,31);
 assert.ok(pieceGeometry('roof',null,{neighbours:new Set()}).faces.length>0);
});

test('roof neighbour set is controlled only by the supplied same-house predicate',()=>{
 const allowed=new Set(['5:4','6:5']);
 const n=roofNeighbours({x:5,y:5},(x,y)=>allowed.has(x+':'+y));
 assert.deepEqual([...n].sort(),['E','N']);
});

test('rejected roof uses a distinct palette from complete roof',()=>{
 const fills=[];
 const c={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},stroke(){},fill(){fills.push(this.fillStyle);},
  set fillStyle(v){this._fillStyle=v;},get fillStyle(){return this._fillStyle;},
  set strokeStyle(v){this._strokeStyle=v;},set lineWidth(v){},set lineJoin(v){},set lineCap(v){},set globalAlpha(v){}};
 drawPiece(c,'roof',null,{neighbours:new Set(),rejected:true});
 assert.ok(fills.some(v=>Object.values(PALETTE.roofRejected).includes(v)));
 assert.ok(!fills.some(v=>Object.values(PALETTE.roof).includes(v)));
});
