import {installUX,UI_VERSION} from './ux.mjs?v=0.5.0';
import {createWorldStore,saveLabel} from './storage.mjs?v=0.5.0';
import {installNavigation} from './navigation.mjs?v=0.5.0';
import {createWorldMapView,WORLD_MAP_VERSION,MAP_AUTHORITY} from './worldsim-map.mjs?v=0.5.0';
import {VERSION,SIZE,SKILLS,LABELS,createWorld,step,command,living,capacity,day,hour,level,serialize,restore,tileAt,findPerson,HISTORY_LIMITS} from './engine.mjs?v=0.5.0';
import {evaluateModularHouses} from './housing.mjs?v=0.5.0';
import {drawPiece,structureDrawInfo,structureDepth,roofNeighbours} from './building-visuals.mjs?v=0.5.0';
const $=id=>document.getElementById(id),canvas=$('world'),ctx=canvas.getContext('2d'),dialog=$('dialog');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ux=null,nav=null,worldMapView=null;
const store=createWorldStore({getStorage:()=>localStorage,serialize,restore});
let state=createWorld(),paused=false,speed=1,selected=innerWidth>700?2:null,tab='about',mode='observe';
let toastTimer,ground,cw=0,ch=0,dpr=1,zoom=innerWidth<700?1.12:1.25,pan={x:0,y:0};
let focus={x:11,y:12},follow=false,positions=new Map(),lastUi=0,lastFrame=0,accumulator=0;
const hw=27,hh=13.5;
const proj=(x,y)=>({x:(x-y)*hw,y:(x+y)*hh});
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
const loaded=store.load();if(loaded)state=loaded;
if(store.status().kind==='protected')toast('เซฟเดิมมีปัญหา จึงยังไม่เขียนทับ · สำรองไฟล์เดิมได้ในเมนู');
else if(store.status().kind==='unavailable')toast('เบราว์เซอร์ไม่ให้เข้าถึงบันทึก · ส่งออกไฟล์เพื่อเก็บโลกไว้');
else if(loaded)toast('กลับสู่โลกเดิม · วันที่ '+day(state));
function save(manual=false){const result=store.save(state);nav?.update();if(manual)toast(result.ok?'บันทึกโลกในเบราว์เซอร์นี้แล้ว':result.reason==='protected'?'ยังไม่เขียนทับเซฟเดิม · สำรองไฟล์ก่อนเริ่มโลกใหม่':'บันทึกไม่ได้ · ใช้ส่งออกไฟล์เพื่อเก็บโลกไว้');return result;}
function portrait(a){const p=a.appearance;return `<svg class="portrait" viewBox="0 0 60 68" aria-label="${esc(a.name)}"><rect width="60" height="68" fill="#3b5747"/><circle cx="30" cy="31" r="27" fill="#667954" opacity=".35"/><path d="M7 69Q7 46 30 46Q53 46 53 69" fill="${p.coat}"/><path d="M25 43h10v10l-5 5-5-5" fill="${p.skin}"/><path d="M16 28Q12 10 30 9Q47 9 45 31L43 49H17Z" fill="${p.hair}"/><ellipse cx="30" cy="32" rx="12" ry="16" fill="${p.skin}"/><path d="${p.style===0?'M17 29Q13 9 31 10Q49 13 43 28L36 19 23 22Z':p.style===1?'M17 29Q12 12 30 10Q48 11 44 31L37 16 29 24Z':'M16 28Q12 8 31 9Q49 12 44 29L41 17 32 14 21 22Z'}" fill="${p.hair}"/><path d="M22 30h5m7 0h5" stroke="#4c392e" stroke-width="1.4"/><circle cx="25" cy="33" r="1.3" fill="#24352d"/><circle cx="36" cy="33" r="1.3" fill="#24352d"/><path d="M30 34v5h2M26 43q4 3 8 0" fill="none" stroke="#a66c54" stroke-width="1"/><path d="M19 52l11 7 11-7M30 59v10" stroke="#eee4ba88" stroke-width="1" fill="none"/></svg>`;}
function polygon(c,points,fill,stroke=null){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.7;c.stroke();}}
function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function line(c,points,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function hash(x,y){return ((Math.imul(x+33,374761393)^Math.imul(y+41,668265263))>>>0)/4294967296;}
function makeGround(){
 worldMapView=createWorldMapView(state);
 ground=document.createElement('canvas');ground.width=(SIZE.w+SIZE.h)*hw+120;ground.height=(SIZE.w+SIZE.h)*hh+110;
 const c=ground.getContext('2d');c.translate(SIZE.h*hw+60,32);
 const corners=[proj(0,0),proj(SIZE.w,0),proj(SIZE.w,SIZE.h),proj(0,SIZE.h)].map(p=>[p.x,p.y]);
 polygon(c,corners.map(([x,y])=>[x,y+20]),'#304b37');
 for(let y=0;y<SIZE.h;y++)for(let x=0;x<SIZE.w;x++){
  const p=proj(x,y),cell=worldMapView.cells[y*SIZE.w+x],t=cell.terrainType,r=cell.detail;
  polygon(c,[[p.x,p.y-hh],[p.x+hw,p.y],[p.x,p.y+hh],[p.x-hw,p.y]],cell.color);
  if(t==='grass'||t==='forest'){
   for(let k=0;k<(t==='forest'?3:4);k++){
    const dx=(hash(x+k*7,y+2)-.5)*32,dy=(hash(x,y+k*5)-.5)*12;
    line(c,[[p.x+dx,p.y+dy],[p.x+dx-1,p.y+dy-3]],t==='forest'?'#91ac7955':'#c0c88d66',.8);
   }
   if(t==='grass'&&r>.87)for(let k=0;k<3;k++)ellipse(c,p.x+k*3-4,p.y+k%2,1.2,.7,'#e0cf9c');
  }
  if(t==='deepWater'||t==='shallowWater')for(let k=0;k<2;k++)line(c,[[p.x-10+k*14,p.y-2+k*4],[p.x-1+k*14,p.y-2+k*4]],t==='deepWater'?'#8ebdce55':'#d0e3c477',.8);
  if(t==='sand')for(let k=0;k<3;k++)ellipse(c,p.x-9+k*7,p.y-2+k%2,1.4,.7,'#e0cf9c88');
  if(t==='rock')line(c,[[p.x-12,p.y+1],[p.x-4,p.y-4],[p.x+5,p.y-1],[p.x+10,p.y-3]],'#c6ccbb66',.8);
  if(t==='path')line(c,[[p.x-8,p.y+2],[p.x+5,p.y-3]],'#d1c19366',.7);
  if(t==='bridge')for(let k=-2;k<=2;k++)line(c,[[p.x-19+k*4,p.y+k*3-4],[p.x+9+k*4,p.y+k*3+9]],'#d2b484',1.2);
 }
}
function tree(c,n){
 const p=proj(n.x,n.y),r=hash(n.x,n.y);c.save();c.translate(p.x,p.y);
 ellipse(c,6,2,22,9,'#193c2840');
 c.fillStyle='#695238';c.fillRect(-2,-28,5,30);
 if(n.amount<=0){c.fillStyle='#bd9a65';c.fillRect(-5,-8,11,8);ellipse(c,.5,-8,5.5,2,'#dcc18a');c.restore();return;}
 if(r>.42){
  polygon(c,[[-24,-20],[0,-65],[25,-20]],'#294e36');polygon(c,[[-21,-35],[0,-77],[21,-35]],'#356044');polygon(c,[[-15,-51],[0,-86],[16,-51]],'#47734b');
  polygon(c,[[0,-77],[0,-35],[21,-35]],'#254d37');polygon(c,[[-15,-51],[0,-86],[0,-51]],'#65874e');
 }else{
  ellipse(c,-14,-40,18,16,'#436538');ellipse(c,11,-42,21,17,'#3d6237');ellipse(c,0,-58,24,19,'#597b3e');
  ellipse(c,-10,-64,15,11,'#6f8c46');ellipse(c,14,-54,13,12,'#4e7138');ellipse(c,-14,-46,13,10,'#668241');
 }
 c.restore();
}
function node(c,n){
 if(n.type==='wood'){tree(c,n);return;}
 const p=proj(n.x,n.y);c.save();c.translate(p.x,p.y);ellipse(c,2,2,18,7,'#21422833');
 if(n.type==='food'){
  if(n.amount>0){ellipse(c,-7,-5,11,8,'#375b37');ellipse(c,6,-8,13,10,'#466d3d');ellipse(c,-2,-13,11,9,'#5e8045');
   for(const [x,y] of [[-7,-10],[2,-15],[9,-9],[-1,-5]]){ellipse(c,x,y,2.4,2.4,'#dc9d60');ellipse(c,x-.5,y-.6,.8,.8,'#ebcc93');}}
  else{ellipse(c,0,-1,11,4,'#647c46');}
 }else if(n.amount>0){
  polygon(c,[[-18,0],[-13,-15],[0,-21],[14,-10],[20,3],[2,9]],'#88968b');polygon(c,[[-18,0],[-13,-15],[0,-21],[-1,-4]],'#bac0a5');polygon(c,[[0,-21],[14,-10],[20,3],[-1,-4]],'#9da997');
  polygon(c,[[1,5],[11,-4],[20,2],[21,9],[8,12]],'#697e73');
 }
 c.restore();
}
function building(c,b,time){
 const p=proj(b.x,b.y);c.save();c.translate(p.x,p.y);ellipse(c,3,10,38,16,'#1b362849');
 if(!b.complete){
  polygon(c,[[-29,-8],[0,-23],[29,-8],[0,8]],'#c8b78355','#ebd5a9');
  for(const [x,y] of [[-24,-7],[0,5],[24,-7],[0,-20]]){c.fillStyle='#c4a16a';c.fillRect(x-2,y-26,4,26);}
  line(c,[[-24,-33],[0,-21],[24,-33]],'#a28254',4);c.fillStyle='#18372a';c.fillRect(-24,15,48,4);c.fillStyle='#dfc187';c.fillRect(-24,15,48*b.progress/30,4);
 }else if(b.type==='camp'){
  polygon(c,[[-37,-13],[-16,-48],[6,-10]],'#d1c093');polygon(c,[[-16,-48],[7,-38],[26,-3],[6,-10]],'#a49369');polygon(c,[[-25,-12],[-16,-31],[-7,-10]],'#304639');
  c.fillStyle='#805d3d';c.fillRect(18,-12,12,14);line(c,[[18,-6],[30,-6]],'#4f4634',2);
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2;ellipse(c,1+Math.cos(a)*11,16+Math.sin(a)*5,4,2.5,'#a9aa8e');}
  line(c,[[-7,20],[7,13]],'#7c5437',4);line(c,[[-6,14],[8,20]],'#a57747',4);
  const flicker=Math.sin(time*.006)*2;polygon(c,[[-6,17],[-3,5+flicker],[0,10],[4,-1-flicker],[7,17],[1,21]],'#df934d');polygon(c,[[-2,16],[2,6],[4,17],[0,20]],'#f4cd7b');
  for(let i=0;i<3;i++)ellipse(c,8+Math.sin(time*.0008+i)*7,-12-i*12+(time*.004%10),3+i*2,4+i*2,'#e1dfb91e');
  c.fillStyle='#8e7651';c.fillRect(32,-61,2,51);polygon(c,[[34,-61],[54,-58],[48,-48],[34,-49]],'#afbf93');
 }else{
  polygon(c,[[-28,-6],[0,9],[0,-25],[-28,-40]],'#b3a174');polygon(c,[[0,9],[29,-7],[29,-40],[0,-25]],'#8f815b');
  for(let y=-28;y<0;y+=7)line(c,[[-27,y],[0,y+14],[28,y-1]],'#76644188',1);
  polygon(c,[[-35,-39],[0,-61],[35,-41],[0,-20]],'#917349');polygon(c,[[-35,-39],[0,-61],[0,-43],[-20,-31]],'#b3935a');
  for(let i=0;i<5;i++)line(c,[[-29+i*7,-42-i*3],[3+i*6,-24-i*3]],'#c1a47566',1.4);
  polygon(c,[[8,4],[20,-3],[20,-25],[8,-18]],'#4a5138');polygon(c,[[-21,-25],[-10,-19],[-10,-9],[-21,-15]],'#dbbf75');line(c,[[-15,-22],[-15,-12]],'#8c794d',1.8);
  c.fillStyle='#7a8070';c.fillRect(12,-62,8,14);ellipse(c,16,-62,4,1.5,'#c0b48d');
  polygon(c,[[6,11],[23,2],[30,6],[13,15]],'#baad82');
 }
 c.restore();
}
function rustStation(c,st,structureCtx=null){
 const info=structureDrawInfo(st,{hasFoundation:structureCtx?.hasFoundation});
 if(info){
  const p=proj(info.x,info.y),opts={role:info.role};
  if(info.piece==='roof')Object.assign(opts,structureCtx?.roofOptionsFor(st)??{neighbours:new Set(),rejected:true});
  c.save();c.translate(p.x,p.y);drawPiece(c,info.piece,info.edge,opts);c.restore();return;
 }

 const p=proj(st.x,st.y);c.save();c.translate(p.x,p.y);
 ellipse(c,0,4,20,7,'#172a2355');
 if(st.kind==='CRAFTING_TABLE_LV1'){
  polygon(c,[[-20,-3],[0,-13],[20,-3],[0,7]],'#9d7b4f','#5f5138');
  line(c,[[-15,0],[-15,16]],'#604b34',4);line(c,[[15,0],[15,16]],'#604b34',4);
  line(c,[[-9,-10],[7,4]],'#c4b174',3);polygon(c,[[5,2],[13,2],[10,8]],'#aeb4a6');
 }else if(st.kind==='FURNACE'){
  polygon(c,[[-17,5],[0,14],[17,5],[17,-18],[0,-27],[-17,-18]],'#756b5b','#403f37');
  polygon(c,[[-10,-3],[0,2],[10,-3],[10,-13],[0,-18],[-10,-13]],'#342f2b');
  polygon(c,[[-6,-4],[-2,-14],[2,-7],[6,-16],[8,-3],[1,2]],'#df934d');
  c.fillStyle='#5d5549';c.fillRect(8,-31,6,14);ellipse(c,11,-31,3,1.5,'#a9a18e');
 }else if(st.kind==='WOOD_FOUNDATION'){
  polygon(c,[[-25,0],[0,-12],[25,0],[0,12]],'#8f6d45','#c09a63');line(c,[[-14,-6],[12,7]],'#644b33',2);line(c,[[-5,-10],[21,3]],'#644b33',2);
 }else if(st.kind==='WOOD_WALL'){
  polygon(c,[[-20,4],[0,14],[20,4],[20,-28],[0,-38],[-20,-28]],'#8b6845','#c29b68');
  for(const x of [-12,0,12])line(c,[[x,-29],[x,7]],'#64482f',2);
 }else if(st.kind==='WOOD_DOORWAY'){
  line(c,[[-18,7],[-18,-29]],'#7d5a39',5);line(c,[[18,7],[18,-29]],'#7d5a39',5);line(c,[[-20,-29],[20,-29]],'#9b7448',5);
  line(c,[[-18,0],[18,0]],'#6d4f35',2);
 }else if(st.kind==='WOOD_ROOF'){
  polygon(c,[[-25,-8],[0,-26],[25,-8],[0,7]],'#7f603f','#b28b59');
  line(c,[[-14,-16],[10,0]],'#5e452f',2);line(c,[[-2,-24],[22,-9]],'#5e452f',2);
 }
 c.restore();
}
function person(c,a,time){
 let v=positions.get(a.id);if(!v){v={x:a.x,y:a.y};positions.set(a.id,v);}v.x+=(a.x-v.x)*.2;v.y+=(a.y-v.y)*.2;
 const p=proj(v.x,v.y),ap=a.appearance,moving=a.task?.path.length>0;
 const stride=moving?Math.sin(time*.012+a.id)*3:0;c.save();c.translate(p.x,p.y);
 ellipse(c,1,2,10,4,'#19312755');
 if(a.id===selected){c.strokeStyle='#efd299';c.lineWidth=1.5;c.beginPath();c.ellipse(0,1,15,7,0,0,Math.PI*2);c.stroke();}
 line(c,[[-3,-9],[-4+stride,0]],'#344439',3);line(c,[[3,-9],[4-stride,0]],'#344439',3);
 polygon(c,[[-6,-20],[5,-20],[7,-7],[-7,-7]],ap.coat);
 line(c,[[-6,-18],[-9-stride*.6,-10]],ap.skin,3);line(c,[[6,-18],[9+stride*.6,-10]],ap.skin,3);
 c.fillStyle='#eadcb28a';c.fillRect(-6,-10,12,1);
 ellipse(c,0,-26,6.4,7.5,ap.skin);ellipse(c,0,-31,6.8,4.5,ap.hair);
 if(ap.style===1)ellipse(c,-6,-28,2.5,5,ap.hair);
 if(ap.style===2){c.fillStyle=ap.hair;c.fillRect(-6,-31,3,12);}
 ellipse(c,-2,-26,1,.9,'#29392e');ellipse(c,3,-26,1,.9,'#29392e');
 const equipped=state.rustPossessions?.equipment?.find(e=>e.agentId===a.id),equippedItem=equipped&&state.rustPossessions?.items?.find(i=>i.id===equipped.itemId),tool=equippedItem?.kind;
 if(!moving&&tool==='STONE_AXE'){line(c,[[10,-12],[18,-23]],'#a69265',2);polygon(c,[[16,-24],[23,-21],[20,-16]],'#c4c9b4');}
 if(!moving&&tool==='STONE_PICKAXE')line(c,[[10,-12],[17,-26],[24,-24]],'#b5bba5',2);
 if(!moving&&tool==='HAMMER'){line(c,[[10,-12],[17,-23]],'#a69265',2.4);c.fillStyle='#b8bdad';c.fillRect(14,-27,9,5);}
 const visibleWork=['BUILD','CRAFT','PROCESS'].includes(a.task?.kind);
 if(a.id===selected||a.satiety<24||visibleWork){
  const glyph=a.satiety<24?'!':({EAT:'●',REST:'z',BUILD:'⌂',CRAFT:'⚒',PROCESS:'♨',FORAGE:'✦',WOODCUT:'╱',MINE:'◆',EXPLORE:'…'}[a.task?.kind]||'…');
  c.fillStyle='#ece6cf';c.beginPath();c.roundRect(8,-53,24,17,5);c.fill();polygon(c,[[11,-37],[10,-32],[18,-37]],'#ece6cf');
  c.fillStyle='#3a5039';c.font='12px Georgia';c.textAlign='center';c.fillText(glyph,20,-41);
 }
 c.restore();
}
function cameraOrigin(){return nav?.anchor()??{x:cw/2,y:ch/2};}
function frameSelected(){const a=state.agents.find(a=>a.id===selected&&a.alive);if(a){focus={x:a.x,y:a.y};pan={x:0,y:0};}}
function centerCamera(p){focus={...p};pan={x:0,y:0};follow=false;}
function screenPoint(x,y){const p=proj(x,y),f=proj(focus.x,focus.y);return {x:cameraOrigin().x+pan.x+(p.x-f.x)*zoom,y:cameraOrigin().y+pan.y+(p.y-f.y)*zoom};}
function worldPoint(x,y){const f=proj(focus.x,focus.y);const px=(x-cameraOrigin().x-pan.x)/zoom+f.x,py=(y-cameraOrigin().y-pan.y)/zoom+f.y;return {x:Math.round((px/hw+py/hh)/2),y:Math.round((py/hh-px/hw)/2)};}
function resize(){const rect=canvas.getBoundingClientRect();cw=rect.width;ch=rect.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);}
const structureCellKey=(x,y)=>x+':'+y;
function structureRenderContext(){
 const evaluated=evaluateModularHouses(state),houseByCell=new Map(),houseCells=new Map(),foundations=new Set(),roofCells=new Set();
 for(const h of evaluated.houses){
  const cells=new Set(h.cells.map(c=>structureCellKey(c.x,c.y)));houseCells.set(h.houseId,cells);
  for(const c of h.cells){const k=structureCellKey(c.x,c.y);foundations.add(k);houseByCell.set(k,h);}
 }
 for(const st of state.rustStations?.stations??[])if(st.kind==='WOOD_ROOF'&&st.socket?.type==='cell'&&st.socket.level===2)
  roofCells.add(structureCellKey(st.socket.x,st.socket.y));
 const hasFoundation=(x,y)=>foundations.has(structureCellKey(x,y));
 const roofOptionsFor=st=>{
  const s=st.socket;if(s?.type!=='cell'||s.level!==2)return {neighbours:new Set(),rejected:true};
  const house=houseByCell.get(structureCellKey(s.x,s.y));
  // Incomplete/too-large roof records stay visible, use the rejected palette, and never join ridges.
  if(!house?.complete)return {neighbours:new Set(),rejected:true};
  const cells=houseCells.get(house.houseId);
  return {neighbours:roofNeighbours({x:s.x,y:s.y},(x,y)=>cells.has(structureCellKey(x,y))&&roofCells.has(structureCellKey(x,y))),rejected:false};
 };
 return {hasFoundation,roofOptionsFor};
}
function render(time){
 ctx.setTransform(dpr,0,0,dpr,0,0);
 const bg=ctx.createLinearGradient(0,0,cw,ch);bg.addColorStop(0,'#4c654b');bg.addColorStop(1,'#314b3d');ctx.fillStyle=bg;ctx.fillRect(0,0,cw,ch);
 if(follow){const a=state.agents.find(a=>a.id===selected&&a.alive);if(a){focus.x+=(a.x-focus.x)*.03;focus.y+=(a.y-focus.y)*.03;}}
 ctx.save();ctx.translate(cameraOrigin().x+pan.x,cameraOrigin().y+pan.y);ctx.scale(zoom,zoom);const f=proj(focus.x,focus.y);ctx.translate(-f.x,-f.y);
 ctx.drawImage(ground,-SIZE.h*hw-60,-32);
 const a=state.agents.find(a=>a.id===selected&&a.alive);
 if(a?.task?.path.length){ctx.setLineDash([3,5]);line(ctx,[[proj(a.x,a.y).x,proj(a.x,a.y).y],...a.task.path.map(v=>{const p=proj(v.x,v.y);return [p.x,p.y];})],'#e9d4a588',1.3);ctx.setLineDash([]);}
 const structureCtx=structureRenderContext();
 const objects=[...state.nodes.map(n=>({kind:'node',data:n,depth:n.x+n.y})),...state.buildings.filter(b=>b.type!=='shelter').map(b=>({kind:'building',data:b,depth:b.x+b.y+.1})),...(state.rustStations?.stations??[]).map(st=>({kind:'rust-station',data:st,depth:structureDepth(st)})),...living(state).map(a=>({kind:'agent',data:a,depth:a.x+a.y+.2}))].sort((a,b)=>a.depth-b.depth);
 for(const o of objects){if(o.kind==='node')node(ctx,o.data);else if(o.kind==='building')building(ctx,o.data,time);else if(o.kind==='rust-station')rustStation(ctx,o.data,structureCtx);else person(ctx,o.data,time);}
 if(a){const p=proj(a.x,a.y);ctx.font='10px system-ui';ctx.textAlign='center';const width=ctx.measureText(a.name).width+17;ctx.fillStyle='#17352adc';ctx.beginPath();ctx.roundRect(p.x-width/2,p.y+12,width,18,5);ctx.fill();ctx.fillStyle='#eee0b6';ctx.fillText(a.name,p.x,p.y+25);}
 ctx.restore();
 const h=hour(state);if(h>=19||h<6){ctx.fillStyle='#10294460';ctx.fillRect(0,0,cw,ch);}
 // Gentle edge vignette keeps the central village legible.
 const vignette=ctx.createRadialGradient(cw*.46,ch*.48,Math.min(cw,ch)*.22,cw*.5,ch*.5,Math.max(cw,ch)*.68);vignette.addColorStop(0,'#0b251500');vignette.addColorStop(1,'#12291e55');ctx.fillStyle=vignette;ctx.fillRect(0,0,cw,ch);
}
function actionText(a){if(!a.alive)return 'เสียชีวิตแล้ว';const task=a.task;return task?(task.path.length?'เดินไป':'กำลัง')+(LABELS[task.kind]||'พักรอ'):'กำลังเลือกงาน';}
function inspect(){ux?.renderInspector();}
function updateUI(){
 $('day').textContent='วันที่ '+day(state);const h=hour(state),mins=Math.floor(state.tick%15/15*60);$('clock').textContent=String(h).padStart(2,'0')+':'+String(mins).padStart(2,'0')+' · '+(h<6||h>=19?'กลางคืน':h<12?'เช้า':'บ่าย');
 for(const type of ['food','wood','stone'])$(type).textContent=state.stock[type];
 $('population').textContent=living(state).length+' / '+capacity(state);
 $('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'เล่นต่อ':'หยุดเวลา');
 $('world-status').textContent=paused||dialog.open?'หยุดเวลา · โลกยังอยู่ตรงนี้':'โลกกำลังดำเนินไปด้วยตัวเอง';
 $('seed-label').textContent='SEED '+state.seed;
 $('recent-events').innerHTML=state.events.slice(-3).reverse().map(e=>`<button class="event-chip" data-event="${e.id}"><small>วันที่ ${1+Math.floor(e.tick/360)} · ${e.type.toUpperCase()}</small><p>${esc(e.text)}</p></button>`).join('');
 inspect();ux?.renderHUD();nav?.update();
}
function selectAgent(id,center=false){follow=false;selected=id;tab='about';mode='observe';$('mode-hint').hidden=true;$('observe').classList.add('active');const a=findPerson(state,id);if(a&&(center||innerWidth<=700)){focus={x:a.x,y:a.y};pan={x:0,y:0};}updateUI();}
function openDialog(title,kicker,body){$('dialog').dataset.kind='other';$('dialog-title').textContent=title;$('dialog-kicker').textContent=kicker;$('dialog-body').innerHTML=body;if(!dialog.open)dialog.showModal();updateUI();}
function roster(){ux?.openRoster();}
function history(){ux?.openHistory();}
function systems(){ux?.openSystems();}
function cloneDialog(){ux?.openClone();}
function menu(){openDialog('โลกของคุณ','SIMCLONE · UI '+UI_VERSION,`<p class="menu-save-note"><strong>${esc(saveLabel(store.status()))}</strong><br>เซฟอยู่ในเบราว์เซอร์นี้เท่านั้น ไม่ได้ซิงก์ขึ้นคลาวด์</p><div class="menu-grid"><button data-action="systems">ระบบโลก / AI</button><button data-action="survival">ภาพรวมการอยู่รอด</button>${store.status().protected&&store.originalText()!==null?'<button data-action="export-original">สำรองไฟล์เซฟเดิมที่มีปัญหา</button>':''}<button data-action="save">↧ บันทึกในเครื่อง</button><button data-action="export">↗ ส่งออกไฟล์โลก</button><button data-action="import">↥ นำเข้าไฟล์โลก</button><button data-action="reset">◇ เริ่มโลกใหม่</button><a href="./plan.html" target="_blank" rel="noopener">แผนพัฒนา ↗</a><button data-action="help">วิธีเล่น</button></div><div class="help-block"><b>เล่นได้โดยไม่ต้องต่อ AI API</b><br>ตัวละครใช้กฎและคะแนนบน CPU · บันทึกอัตโนมัติทุก 10 วินาทีในเบราว์เซอร์นี้<br>เมื่อสลับแท็บหรือปิดเว็บ โลกจะหยุด ไม่มีการจำลองย้อนหลังขณะออฟไลน์<br>Engine ปัจจุบันคือ V0.5.0 + Knowledge Continuity 1 · รุ่นใหม่เกิดเองและทุกคนมีอายุขัย deterministic 78–92 ปี · ยังไม่ใช่ Living World V1.0</div>`);}
function download(){const blob=new Blob([serialize(state)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='simclone-day-'+day(state)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('ส่งออกไฟล์โลกแล้ว');}
$('dialog-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{accumulator=0;updateUI();});
$('dialog-body').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.person){dialog.close();selectAgent(Number(b.dataset.person),true);return;}
 if(b.dataset.story){const ev=state.events.find(v=>v.id===Number(b.dataset.story));if(ev?.agentId){dialog.close();selectAgent(ev.agentId,true);}else toast('เหตุการณ์ระดับโลก · ยังไม่มีภาพย้อนหลังในรุ่นนี้');return;}
 const action=b.dataset.action;
 if(action==='systems'){ux.openSystems();return;}
 if(action==='survival'){ux.openSurvival();return;}
 if(action==='cancel'){dialog.close();return;}
 if(action==='confirm-clone'){const result=command(state,'CLONE',{parentId:selected});toast(result.message);if(result.ok){dialog.close();selectAgent(result.agentId,true);save();}return;}
 if(action==='export-original'){const text=store.originalText();if(text!==null){const url=URL.createObjectURL(new Blob([text],{type:'text/plain'})),a=document.createElement('a');a.href=url;a.download='simclone-recovery-original.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('ส่งออกเซฟเดิมโดยไม่แก้ไขแล้ว');}return;}
 if(action==='save'){save(true);return;}if(action==='export'){download();return;}
 if(action==='import'){$('import-file').click();return;}
 if(action==='reset'){openDialog('เริ่มโลกใหม่','NEW WORLD',`<p>โลกปัจจุบันในเบราว์เซอร์จะถูกแทนที่ ควรส่งออกไฟล์ก่อน กรอก seed เดิมเพื่อเริ่มด้วยแผนที่และตัวละครตั้งต้นเหมือนเดิม</p><label for="seed-input">World seed</label><input id="seed-input" class="seed-input" type="number" min="0" max="4294967295" value="${state.seed}"><div class="dialog-actions"><button class="primary" data-action="confirm-reset">เริ่มใหม่และแทนที่บันทึก</button><button class="secondary" data-action="export">ส่งออกโลกปัจจุบัน</button></div>`);return;}
 if(action==='confirm-reset'){
  const seed=Number($('seed-input').value);if(!Number.isInteger(seed)||seed<0||seed>4294967295){toast('กรอก seed เป็นจำนวนเต็ม 0–4294967295');return;}
  state=createWorld(seed);store.allowReplacement();paused=false;positions.clear();follow=false;selected=innerWidth>700?2:null;mode='observe';$('mode-hint').hidden=true;focus={x:11,y:12};pan={x:0,y:0};makeGround();save();dialog.close();updateUI();toast('โลกใหม่พร้อมแล้ว');return;
 }
 if(action==='help')openDialog('ดูโลกที่กำลังคิดและสร้างเอง','HOW TO PLAY',`<p><b>1. ดูระบบโลก</b><br>เปิด “ระบบโลก” เพื่อดูว่า Housing, Production, Inventory, Knowledge, Ecology และระบบอื่นกำลัง LIVE, READY หรือ SHADOW</p><p><b>2. เจาะ Clone รายคน</b><br>แตะคนเพื่อดูงาน กระเป๋า อุปกรณ์ ทักษะ ความรู้ ความสัมพันธ์ และเปิด “เหตุผล” เพื่อดูคะแนนการตัดสินใจจริง</p><p><b>3. ปล่อยให้ AI ดำเนินโลก</b><br>บ้านและวงจรพื้นฐานเดินอัตโนมัติ การสร้าง Clone แบบ manual ยังทำได้จาก Inspector แต่ไม่ใช่แกนหลัก</p><p><b>ควบคุมเวลา</b><br>Ⅱ หยุด · 1× / 2× / 5× เร่งเวลา · Space หยุด/เล่น<br>เมนูที่เปิดเป็นหน้าต่างจะหยุดเวลาอัตโนมัติ</p><div class="help-block">LIVE คือ authority จริง · READY คือระบบพร้อมแต่ policy เต็มยังไม่เปิด · SHADOW คือการคำนวณเพื่อสังเกตโดยยังไม่เขียนผลจริง</div>`);
});
$('import-file').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>HISTORY_LIMITS.maxSaveCharacters*3)throw new Error('ไฟล์ใหญ่เกินงบการนำเข้า');const candidate=restore(await file.text());
 openDialog('นำเข้าโลกที่บันทึกไว้','IMPORT WORLD',`<p>วันที่ ${day(candidate)} · ประชากร ${living(candidate).length} คน<br>การนำเข้าจะแทนที่โลกปัจจุบันในเบราว์เซอร์</p><div class="dialog-actions"><button id="confirm-import" class="primary">ยืนยันนำเข้า</button><button class="secondary" data-action="cancel">ยกเลิก</button></div>`);
 $('confirm-import').onclick=()=>{state=candidate;store.allowReplacement();selected=null;follow=false;mode='observe';$('mode-hint').hidden=true;positions.clear();focus={x:11,y:12};pan={x:0,y:0};makeGround();save();dialog.close();updateUI();toast('นำเข้าโลกสำเร็จ');};
 }catch(error){toast('นำเข้าไม่ได้: '+error.message);}});
$('inspector').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.ui==='close'){selected=null;follow=false;}else if(b.dataset.tab){tab=b.dataset.tab;frameSelected();}else if(b.dataset.ui==='follow'){follow=!follow;const a=state.agents.find(a=>a.id===selected);if(a){focus={x:a.x,y:a.y};pan={x:0,y:0};}}updateUI();});
$('pause').onclick=()=>{paused=!paused;accumulator=0;updateUI();};
for(const b of document.querySelectorAll('[data-speed]'))b.onclick=()=>{speed=Number(b.dataset.speed);document.querySelectorAll('[data-speed]').forEach(x=>x.classList.toggle('active',x===b));};
$('systems').onclick=systems;$('roster').onclick=roster;$('history').onclick=history;$('open-chronicle').onclick=history;$('menu').onclick=menu;
function observe(){mode='observe';$('mode-hint').hidden=true;$('observe').classList.add('active');updateUI();}
$('observe').onclick=observe;
$('recent-events').onclick=e=>{const id=e.target.closest('[data-event]')?.dataset.event;if(!id)return;const ev=state.events.find(e=>e.id===Number(id));if(ev?.agentId)selectAgent(ev.agentId,true);else history();};
for(const b of document.querySelectorAll('[data-nav]'))b.onclick=()=>{document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('active',x===b));const n=b.dataset.nav;if(n==='people')roster();else if(n==='systems')systems();else if(n==='rust')ux?.openRust();else if(n==='history')history();else{selected=null;follow=false;observe();}};
$('recenter').onclick=()=>{focus={x:11,y:12};pan={x:0,y:0};follow=false;};
const setZoom=z=>{zoom=Math.max(.5,Math.min(2.8,z));};$('zoom-in').onclick=()=>setZoom(zoom*1.2);$('zoom-out').onclick=()=>setZoom(zoom/1.2);
canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*(e.deltaY<0?1.1:1/1.1));},{passive:false});
const pointers=new Map();let drag=null,pinch=0,multiTouch=false;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});follow=false;
 if(pointers.size===1){multiTouch=false;drag={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y,moved:false};}
 if(pointers.size===2){multiTouch=true;const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}
});
canvas.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)setZoom(zoom*d/pinch);pinch=d;return;}
 if(drag&&!multiTouch){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>6)drag.moved=true;pan.x=Math.max(-1800,Math.min(1800,drag.px+dx));pan.y=Math.max(-1200,Math.min(1200,drag.py+dy));}
});
canvas.addEventListener('pointerup',e=>{
 pointers.delete(e.pointerId);if(!drag||drag.moved||multiTouch){if(!pointers.size){drag=null;multiTouch=false;}return;}
 const rect=canvas.getBoundingClientRect(),sx=e.clientX-rect.left,sy=e.clientY-rect.top;
 {let hit=null,best=34;for(const a of living(state)){const v=positions.get(a.id)??a,p=screenPoint(v.x,v.y),d=Math.hypot(sx-p.x,sy-(p.y-19*zoom));if(d<best){hit=a;best=d;}}if(hit)selectAgent(hit.id);else{selected=null;follow=false;updateUI();}}
 drag=null;
});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);drag=null;multiTouch=false;});
addEventListener('keydown',e=>{if(dialog.open||['INPUT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName))return;if(e.code==='Space'){e.preventDefault();paused=!paused;accumulator=0;updateUI();}if(e.key==='Escape')observe();});
addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{accumulator=0;lastFrame=0;if(document.hidden)save();});
addEventListener('pagehide',()=>save());
function frame(time){
 const dt=lastFrame?Math.min(.2,(time-lastFrame)/1000):0;lastFrame=time;
 if(!paused&&!document.hidden&&!dialog.open){accumulator+=dt*speed;let loops=0;while(accumulator>=.25&&loops<8){step(state);accumulator-=.25;loops++;}}
 else accumulator=0;
 render(time);if(time-lastUi>300){updateUI();lastUi=time;}requestAnimationFrame(frame);
}
makeGround();resize();

ux=installUX({
 read:()=>({state,selected,tab,mode,paused,follow,canAutosave:!store.status().protected}),
 portrait,actionText,toast,openDialog,closeDialog:()=>dialog.close(),
 select:selectAgent,setTab:value=>{tab=value;frameSelected();updateUI();},observe,
 center:centerCamera,
 preview:(type,data)=>{const copy=JSON.parse(serialize(state)),result=command(copy,type,data);return {...result,agent:type==='CLONE'&&result.ok?copy.agents.at(-1):null};},
 execute:(type,data)=>{const result=command(state,type,data);updateUI();return result;},save
});
nav=installNavigation({mapView:()=>worldMapView,read:()=>({state,selected,follow,mode,paused}),menu,center:centerCamera,worldPoint,focus:()=>({...focus}),zoom:()=>zoom,storageStatus:store.status,layoutChanged:()=>{const a=state.agents.find(a=>a.id===selected&&a.alive);if(a)focus={x:a.x,y:a.y};}});
updateUI();
setInterval(()=>{if(!document.hidden)save();},10000);
requestAnimationFrame(frame);

// Read-only test hook. It returns copies, never mutable simulation state.
window.simclone=Object.freeze({version:VERSION,uiVersion:UI_VERSION,mapPresentation:()=>({version:WORLD_MAP_VERSION,...MAP_AUTHORITY}),snapshot:()=>JSON.parse(serialize(state)),saveStatus:()=>store.status(),safeFrame:()=>nav.frame(),camera:()=>({zoom,pan:{...pan},focus:{...focus},cw,ch}),screenPoint:(x,y)=>screenPoint(x,y)});
