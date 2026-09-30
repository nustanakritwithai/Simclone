import {equipmentSlotOf} from './rust-possessions.mjs?v=0.5.0';
import {installIndependentUI} from './independent-ui.mjs?v=0.5.0';
import {isIndependent,resourceStock,resourceAccount,materialTotals} from './individual-resources.mjs?v=0.5.0';
import {individualHouses} from './individual-housing.mjs?v=0.5.0';
import {installUX,UI_VERSION} from './ux.mjs?v=0.5.0';
import {createWorldStore,saveLabel} from './storage.mjs?v=0.5.0';
import {installNavigation} from './navigation.mjs?v=0.5.0';
import {createWorldMapView,WORLD_MAP_VERSION,MAP_AUTHORITY} from './worldsim-map.mjs?v=0.5.0';
import {coreWorldBounds,worldBounds} from './world-bounds.mjs?v=0.5.0';
import {VERSION,SKILLS,LABELS,createWorld,step,command,living,capacity,day,hour,level,serialize,restore,tileAt,findPerson,HISTORY_LIMITS} from './engine.mjs?v=0.5.0';
import {evaluateModularHouses} from './housing.mjs?v=0.5.0';
import {drawPiece,structureDrawInfo,structureDepth,roofNeighbours} from './building-visuals.mjs?v=0.5.0';
import {installAdventureUI} from './adventure-ui.mjs?v=0.5.0';
import {monsterDefinition} from './adventure-monsters.mjs?v=0.5.0';
import {worldReadabilityRegions} from './display-world-readability.mjs?v=0.5.0';
import {worldHitCandidate,resolveWorldHit,worldSelection,selectionFromWorldHit} from './read-models/world-hit-resolver.mjs?v=0.5.0';
import {drawAgentCutout} from './character-cutout-renderer.mjs?v=0.5.0';
import {facingFromWorldStep} from './character-cutout-assets.mjs?v=0.5.0';
import {rc4MarketReadModel,rc4WorldMarketMarkers} from './rc4-market-runtime.mjs?v=0.5.0';
const $=id=>document.getElementById(id),canvas=$('world'),ctx=canvas.getContext('2d'),dialog=$('dialog');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ux=null,independentUI=null,adventureUI=null,nav=null,worldMapView=null;
const publicWorldProfile=document.documentElement.dataset.worldProfile??'legacy';
const restoreForPublic=text=>restore(text,{sameWorld:publicWorldProfile==='same-world'});
const store=createWorldStore({getStorage:()=>localStorage,serialize,restore:restoreForPublic});
const defaultFocusFor=s=>{const b=coreWorldBounds(s);return {x:Math.round((b.w-1)*11/29),y:Math.round((b.h-1)*12/25)};};
let state=createWorld(230926,{mode:document.documentElement.dataset.defaultWorld??'legacy',worldProfile:publicWorldProfile}),paused=false,speed=1,activeAgentId=innerWidth>700?2:null,selection=activeAgentId?worldSelection('agent',activeAgentId):null,tab='about',mode='observe';
let toastTimer,ground,cw=0,ch=0,dpr=1,zoom=innerWidth<700?1.12:1.25,pan={x:0,y:0};
let focus=defaultFocusFor(state),follow=false,positions=new Map(),lastUi=0,lastFrame=0,accumulator=0;
const hw=27,hh=13.5;
const proj=(x,y)=>({x:(x-y)*hw,y:(x+y)*hh});
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
const loaded=store.load();if(loaded)state=loaded;
if(store.status().kind==='protected')toast('เซฟเดิมมีปัญหา จึงยังไม่เขียนทับ · สำรองไฟล์เดิมได้ในเมนู');
else if(store.status().kind==='unavailable')toast('เบราว์เซอร์ไม่ให้เข้าถึงบันทึก · ส่งออกไฟล์เพื่อเก็บโลกไว้');
else if(loaded)toast('กลับสู่โลกเดิม · วันที่ '+day(state));
if(isIndependent(state)){activeAgentId=null;selection=null;const starter=state.agents.find(a=>a.alive);focus=starter?{x:starter.x,y:starter.y}:defaultFocusFor(state);const b=worldBounds(state);zoom=['large','same-world'].includes(b.profile)?(innerWidth<700?.42:.68):(innerWidth<700?.55:.95);}
function save(manual=false){const result=store.save(state);nav?.update();if(manual)toast(result.ok?'บันทึกโลกในเบราว์เซอร์นี้แล้ว':result.reason==='protected'?'ยังไม่เขียนทับเซฟเดิม · สำรองไฟล์ก่อนเริ่มโลกใหม่':'บันทึกไม่ได้ · ใช้ส่งออกไฟล์เพื่อเก็บโลกไว้');return result;}
function portrait(a){const p=a.appearance;return `<svg class="portrait" viewBox="0 0 60 68" aria-label="${esc(a.name)}"><rect width="60" height="68" fill="#3b5747"/><circle cx="30" cy="31" r="27" fill="#667954" opacity=".35"/><path d="M7 69Q7 46 30 46Q53 46 53 69" fill="${p.coat}"/><path d="M25 43h10v10l-5 5-5-5" fill="${p.skin}"/><path d="M16 28Q12 10 30 9Q47 9 45 31L43 49H17Z" fill="${p.hair}"/><ellipse cx="30" cy="32" rx="12" ry="16" fill="${p.skin}"/><path d="${p.style===0?'M17 29Q13 9 31 10Q49 13 43 28L36 19 23 22Z':p.style===1?'M17 29Q12 12 30 10Q48 11 44 31L37 16 29 24Z':'M16 28Q12 8 31 9Q49 12 44 29L41 17 32 14 21 22Z'}" fill="${p.hair}"/><path d="M22 30h5m7 0h5" stroke="#4c392e" stroke-width="1.4"/><circle cx="25" cy="33" r="1.3" fill="#24352d"/><circle cx="36" cy="33" r="1.3" fill="#24352d"/><path d="M30 34v5h2M26 43q4 3 8 0" fill="none" stroke="#a66c54" stroke-width="1"/><path d="M19 52l11 7 11-7M30 59v10" stroke="#eee4ba88" stroke-width="1" fill="none"/></svg>`;}
function polygon(c,points,fill,stroke=null){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.7;c.stroke();}}
function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function line(c,points,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function hash(x,y){return ((Math.imul(x+33,374761393)^Math.imul(y+41,668265263))>>>0)/4294967296;}
const COMBAT_VISUAL_FX_MS=900,combatFxSeen=new Map(),combatFxStarted=new Map();

function combatFeedbackProjection(){
 const rows=[];
 for(const agent of state.agents??[]){
  const combat=agent?.adventureCombat;if(!agent?.alive||!combat?.worldMonsterId)continue;
  const monster=state.wildMonsters?.entities?.find(m=>m.worldMonsterId===combat.worldMonsterId);if(!monster)continue;
  const last=combat.lastTurn?{
   turn:combat.lastTurn.turn,status:combat.lastTurn.status,
   heroDamage:combat.lastTurn.heroDamage,heroHit:combat.lastTurn.heroHit,heroCritical:combat.lastTurn.heroCritical,
   counterDamage:combat.lastTurn.counterDamage,counterHit:combat.lastTurn.counterHit,counterCritical:combat.lastTurn.counterCritical,
   monsterHpBefore:combat.lastTurn.monsterHpBefore,monsterHpAfter:combat.lastTurn.monsterHpAfter,
   agentHpBefore:combat.lastTurn.agentHpBefore,agentHpAfter:combat.lastTurn.agentHpAfter
  }:null;
  rows.push(Object.freeze({
   combatId:combat.combatId,agentId:agent.id,agentName:agent.name,worldMonsterId:monster.worldMonsterId,
   monsterId:monster.monsterId,status:combat.status,turn:combat.turn,
   agentX:agent.x,agentY:agent.y,monsterX:monster.x,monsterY:monster.y,
   monsterStatus:monster.status,lastTurn:last?Object.freeze(last):null
  }));
 }
 return Object.freeze(rows);
}
function drawCombatFeedback(c,time){
 const rows=combatFeedbackProjection(),activeIds=new Set(rows.map(r=>r.combatId));
 for(const id of [...combatFxSeen.keys()])if(!activeIds.has(id)){combatFxSeen.delete(id);combatFxStarted.delete(id);}
 for(const row of rows){
  const a=proj(row.agentX,row.agentY),m=proj(row.monsterX,row.monsterY),active=row.status==='ACTIVE'&&row.monsterStatus==='ENGAGED';
  if(active){
   c.save();c.setLineDash([4,5]);line(c,[[a.x,a.y-17],[m.x,m.y-18]],'#f2ce8299',1.25);c.setLineDash([]);
   c.strokeStyle='#f1d28aaa';c.lineWidth=1.2;
   c.beginPath();c.ellipse(a.x,a.y-12,13,8,0,0,Math.PI*2);c.stroke();
   c.beginPath();c.ellipse(m.x,m.y-17,18,12,0,0,Math.PI*2);c.stroke();
   const mx=(a.x+m.x)/2,my=(a.y+m.y)/2-25;c.fillStyle='#10261fe8';c.beginPath();c.roundRect(mx-13,my-10,26,20,7);c.fill();
   c.strokeStyle='#f0cb7a99';c.stroke();c.fillStyle='#f5dfaa';c.font='13px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText('⚔',mx,my+1);c.restore();
  }
  if(!row.lastTurn)continue;
  const fxKey=row.combatId+':'+row.turn;
  if(combatFxSeen.get(row.combatId)!==fxKey){combatFxSeen.set(row.combatId,fxKey);combatFxStarted.set(row.combatId,time);}
  const age=time-(combatFxStarted.get(row.combatId)??time);if(age<0||age>COMBAT_VISUAL_FX_MS)continue;
  const heroP=Math.min(1,age/520),heroAlpha=Math.max(0,1-age/720);
  c.save();c.globalAlpha=heroAlpha;
  if(row.lastTurn.heroHit){
   const dx=m.x-a.x,dy=(m.y-18)-(a.y-17);
   c.strokeStyle=row.lastTurn.heroCritical?'#fff2a8':'#f4d48b';c.lineWidth=row.lastTurn.heroCritical?3:2;
   c.beginPath();c.moveTo(a.x+dx*.28,a.y-17+dy*.28);c.lineTo(a.x+dx*(.55+.35*heroP),a.y-17+dy*(.55+.35*heroP));c.stroke();
   c.strokeStyle='#fff5c8';c.lineWidth=1.5;c.beginPath();c.moveTo(m.x-10,m.y-31);c.lineTo(m.x+10,m.y-10);c.stroke();
   c.beginPath();c.moveTo(m.x+8,m.y-32);c.lineTo(m.x-8,m.y-11);c.stroke();
  }
  c.fillStyle=row.lastTurn.heroHit?'#ffe2a1':'#e7ece6';c.font='bold 12px system-ui';c.textAlign='center';
  c.fillText(row.lastTurn.heroHit?'-'+Math.round(row.lastTurn.heroDamage):'MISS',m.x,m.y-55-heroP*16);
  c.restore();

  if(row.lastTurn.counterDamage>0&&age>=320){
   const counterAge=age-320,counterP=Math.min(1,counterAge/430),counterAlpha=Math.max(0,1-counterAge/560);
   c.save();c.globalAlpha=counterAlpha;
   const dx=a.x-m.x,dy=(a.y-17)-(m.y-18);c.strokeStyle='#e6a18f';c.lineWidth=2;
   c.beginPath();c.moveTo(m.x+dx*.3,m.y-18+dy*.3);c.lineTo(m.x+dx*(.55+.3*counterP),m.y-18+dy*(.55+.3*counterP));c.stroke();
   c.strokeStyle='#f5c0b0';c.lineWidth=1.4;c.beginPath();c.moveTo(a.x-8,a.y-29);c.lineTo(a.x+8,a.y-9);c.stroke();
   c.fillStyle='#ffc0ad';c.font='bold 11px system-ui';c.textAlign='center';c.fillText('-'+Math.round(row.lastTurn.counterDamage),a.x,a.y-48-counterP*13);c.restore();
  }
 }
}
const MONSTER_TYPE_COLORS=Object.freeze({
 Normal:'#d7d0bd',Fire:'#e77f4f',Water:'#61a8c8',Electric:'#e7cf62',Grass:'#77a95c',Ice:'#a9d6d9',
 Fighting:'#bd765a',Poison:'#9b73ad',Ground:'#b58c58',Flying:'#9fb5cf',Psychic:'#cf7fa7',Bug:'#8ead58',
 Rock:'#a79468',Ghost:'#82739d',Dragon:'#8e78c9',Dark:'#665e71',Steel:'#a5b2b3',Fairy:'#d99ab8'
});
function wildMonsterDef(m){return monsterDefinition(m?.monsterId);}
function wildMonsterType(m){return wildMonsterDef(m)?.types?.[0]??'Normal';}
function drawWildMonster(c,m,time){
 const def=wildMonsterDef(m),type=wildMonsterType(m),fill=MONSTER_TYPE_COLORS[type]??MONSTER_TYPE_COLORS.Normal;
 const p=proj(m.x,m.y),isSelected=selection?.kind==='monster'&&String(selection.id)===String(m.worldMonsterId),elite=m.rank==='elite',pulse=(Math.sin(time*.006+m.spawnSlot)+1)/2;
 const markerScale=Math.max(1,.85/Math.max(.01,zoom));
 c.save();c.translate(p.x,p.y);c.scale(markerScale,markerScale);
 ellipse(c,0,5,17,6,'#132a254f');
 if(isSelected){c.strokeStyle='#f1d59d';c.lineWidth=2;c.beginPath();c.ellipse(0,-12,22+pulse*2,15+pulse,0,0,Math.PI*2);c.stroke();}
 c.fillStyle=fill;c.strokeStyle=elite?'#f4cf79':'#263c35';c.lineWidth=elite?2:1.2;
 c.beginPath();c.ellipse(0,-18,13,11,0,0,Math.PI*2);c.fill();c.stroke();
 // Strong silhouette: ears/horns + eyes remain readable when zoomed out.
 polygon(c,[[-10,-25],[-6,-38],[-1,-27]],fill,'#263c35');
 polygon(c,[[10,-25],[6,-38],[1,-27]],fill,'#263c35');
 ellipse(c,-4,-19,1.5,1.8,'#15251f');ellipse(c,4,-19,1.5,1.8,'#15251f');
 c.fillStyle='#162a23';c.font='bold 9px system-ui';c.textAlign='center';c.fillText(type.slice(0,2).toUpperCase(),0,-7);
 c.font='bold 9px system-ui';const label='Lv.'+m.level,w=c.measureText(label).width+10;
 c.fillStyle='#11251fe8';c.beginPath();c.roundRect(-w/2,-53,w,15,5);c.fill();c.fillStyle='#f2e3bd';c.fillText(label,0,-42);
 if(isSelected){
   const hp=Math.max(0,Math.min(1,m.hpCurrent/Math.max(1,m.hpMax)));
   c.fillStyle='#0b1c17d9';c.fillRect(-18,-34,36,4);c.fillStyle='#a9cf8a';c.fillRect(-18,-34,36*hp,4);
 }
 c.restore();
}
function monsterTargetAtScreen(sx,sy){
 const hit=resolveWorldHit(worldHitCandidatesAtScreen(sx,sy).filter(row=>row.kind==='monster'));
 return legacyWorldHit(hit);
}
function openMonsterContext(worldMonsterId){
 const m=state.wildMonsters?.entities?.find(x=>x.worldMonsterId===worldMonsterId);if(!m)return false;
 selection=worldSelection('monster',m.worldMonsterId);
 const def=wildMonsterDef(m),type=wildMonsterType(m),hp=Math.max(0,Math.min(100,Math.round(m.hpCurrent/Math.max(1,m.hpMax)*100)));
 const hunter=state.agents.find(a=>a.alive&&a.id===activeAgentId&&a.profession==='adventurer')??state.agents.find(a=>a.alive&&a.profession==='adventurer')??null;
 const huntAction=m.status==='IDLE'&&m.hpCurrent>0
  ?(hunter?'<div class="dialog-actions"><button class="primary" data-action="hunt-monster" data-agent="'+hunter.id+'" data-monster="'+esc(m.worldMonsterId)+'">เดินไปหา · '+esc(hunter.name)+'</button></div>'
    :'<p class="source-note">ยังไม่มี Adventurer ที่พร้อมเลือกเป้าหมายนี้</p>')
  :'<p class="source-note">'+(m.status==='ENGAGED'?'กำลังต่อสู้กับ Adventurer #'+esc(m.engagedByAgentId):'มอนสเตอร์ตัวนี้ยังเลือกเป็นเป้าหมายไม่ได้')+'</p>';
 openDialog(def?.speciesId??m.monsterId,'WILD MONSTER',
  '<div data-world-monster="'+esc(m.worldMonsterId)+'">'+
  '<p><b>'+esc(m.monsterId)+'</b> · '+esc(type)+' · Lv.'+m.level+' · '+esc(m.rank)+'</p>'+
  '<p>เขต '+esc(m.zoneId.toUpperCase())+' · '+esc(m.status)+' · HP '+m.hpCurrent+' / '+m.hpMax+'</p>'+
  '<div class="meter" aria-label="Monster HP"><i style="width:'+hp+'%"></i></div>'+
  '<p class="source-note">World entity '+esc(m.worldMonsterId)+' · อ่านจาก simulation state โดยตรง</p>'+
  huntAction+'</div>');
 dialog.dataset.kind='monster';return true;
}
function makeGround(){
 worldMapView=createWorldMapView(state);const b=worldBounds(state),readability=worldReadabilityRegions(state),adventureRegions=readability.filter(r=>r.adventure);
 ground=document.createElement('canvas');ground.width=(b.w+b.h)*hw+120;ground.height=(b.w+b.h)*hh+110;
 const c=ground.getContext('2d');c.translate(b.h*hw+60,32);
 const corners=[proj(0,0),proj(b.w,0),proj(b.w,b.h),proj(0,b.h)].map(p=>[p.x,p.y]);
 polygon(c,corners.map(([x,y])=>[x,y+20]),'#304b37');
 for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++){
  const p=proj(x,y),cell=worldMapView.cells[y*b.w+x],t=cell.terrainType,r=cell.detail;
  const diamond=[[p.x,p.y-hh],[p.x+hw,p.y],[p.x,p.y+hh],[p.x-hw,p.y]],region=adventureRegions.find(z=>x>=z.minX&&x<=z.maxX);
  polygon(c,diamond,cell.color);
  if(region)polygon(c,diamond,region.wash);
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
 if(adventureRegions.length){
  const entry=proj(adventureRegions[0].minX,25);
  c.save();c.textAlign='center';c.textBaseline='middle';
  c.font='600 20px system-ui';c.fillStyle='#10261fd9';c.fillRect(entry.x-90,entry.y-47,180,28);
  c.strokeStyle='#dcc68b99';c.lineWidth=1;c.strokeRect(entry.x-90,entry.y-47,180,28);
  c.fillStyle='#f1dfb0';c.fillText('ADVENTURE ANNEX',entry.x,entry.y-33);
  for(const region of adventureRegions){
   const p=proj(region.markerX,region.markerY),gate=proj(region.gateX,region.gateY);
   c.fillStyle=region.accent;c.beginPath();c.moveTo(gate.x,gate.y-10);c.lineTo(gate.x+9,gate.y);c.lineTo(gate.x,gate.y+10);c.lineTo(gate.x-9,gate.y);c.closePath();c.fill();
   c.strokeStyle='#16291f99';c.lineWidth=1;c.stroke();
   c.fillStyle='#10261fe6';c.fillRect(p.x-58,p.y-13,116,31);
   c.strokeStyle=region.accent;c.strokeRect(p.x-58,p.y-13,116,31);
   c.fillStyle='#f3e7c3';c.font='700 18px system-ui';c.fillText(region.shortLabel,p.x,p.y-1);
   c.fillStyle='#c8d4c6';c.font='600 11px system-ui';c.fillText(region.levelLabel,p.x,p.y+12);
  }
  c.restore();
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
const WORLD_FEEDBACK_TICKS=12,COMMUNICATION_FEEDBACK_TICKS=18,LIFE_EVENT_FEEDBACK_TICKS=24,ACHIEVEMENT_FEEDBACK_TICKS=18;
const TASK_GLYPHS=Object.freeze({EAT:'●',REST:'z',BUILD:'⌂',CRAFT:'⚒',PROCESS:'♨',FORAGE:'✦',WOODCUT:'╱',MINE:'◆',EXPLORE:'…'});
const TASK_SHORT=Object.freeze({EAT:'กิน',REST:'พัก',BUILD:'สร้าง',CRAFT:'คราฟต์',PROCESS:'เตา',FORAGE:'อาหาร',WOODCUT:'ไม้',MINE:'หิน',EXPLORE:'สำรวจ',IDLE:'พัก'});
const EVENT_GLYPHS=Object.freeze({birth:'○',death:'†',knowledge:'↗',mentor:'↔',build:'⌂',craft:'⚒',skill:'★',career:'◇',day:'☼'});
function houseFeedback(s){
 return evaluateModularHouses(s).houses.filter(h=>!h.complete).map(h=>{
  const cells=new Set(h.cells.map(c=>c.x+':'+c.y));let perimeter=0;
  for(const cell of h.cells)for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]])if(!cells.has((cell.x+dx)+':'+(cell.y+dy)))perimeter++;
  const total=h.cells.length*2+perimeter,placed=Math.max(0,total-h.missing.length),blocked=Boolean(h.reason);
  const x=h.cells.reduce((n,p)=>n+p.x,0)/h.cells.length,y=h.cells.reduce((n,p)=>n+p.y,0)/h.cells.length;
  return {houseId:h.houseId,x,y,progress:blocked?null:Math.max(0,Math.min(99,Math.round(placed/Math.max(1,total)*100))),missing:h.missing.length,status:blocked?'blocked':'building'};
 });
}
function communicationRecipient(s,event){
 if(!event?.agentId||!['knowledge','mentor'].includes(event.type))return null;
 const direct=living(s).filter(a=>a.id!==event.agentId).flatMap(a=>(a.knowledgeState?.evidence??[]).filter(e=>e.tick===event.tick&&e.type==='message'&&e.sourceAgentId===event.agentId&&!e.channel).map(e=>({agentId:a.id,key:e.key}))).sort((a,b)=>a.agentId-b.agentId)[0];
 if(direct)return direct;
 if(event.type==='mentor'){
  const link=(s.mentorship?.links??[]).filter(l=>l.mentorId===event.agentId&&l.createdTick===event.tick).sort((a,b)=>a.id-b.id)[0];
  if(link)return {agentId:link.studentId,key:null};
 }
 return null;
}
function recentCommunicationLinks(s){
 return s.events.slice().reverse().filter(e=>s.tick>=e.tick&&s.tick-e.tick<=COMMUNICATION_FEEDBACK_TICKS&&['knowledge','mentor'].includes(e.type)).map(e=>{
  const recipient=communicationRecipient(s,e),from=s.agents.find(a=>a.id===e.agentId&&a.alive),to=recipient&&s.agents.find(a=>a.id===recipient.agentId&&a.alive);
  return from&&to?{eventId:e.id,tick:e.tick,type:e.type,fromId:from.id,toId:to.id,key:recipient.key??null,glyph:e.type==='knowledge'?'↗':'↔',label:e.type==='knowledge'?'ความรู้':'Mentor'}:null;
 }).filter(Boolean).sort((a,b)=>b.tick-a.tick||a.eventId-b.eventId).slice(0,3);
}
function agentBubbleSignal(s,a,selectedId=null,communications=recentCommunicationLinks(s)){
 const task=a.task,kind=task?.kind??null,recent=Boolean(task&&Number.isInteger(task.started)&&s.tick>=task.started&&s.tick-task.started<=WORLD_FEEDBACK_TICKS);
 if(a.id===selectedId)return {agentId:a.id,kind:'thought',glyph:TASK_GLYPHS[kind]??'…',label:TASK_SHORT[kind]??'คิด',priority:100,source:'selected',target:task?{x:task.x,y:task.y,kind}:null};
 const comm=communications.find(x=>x.fromId===a.id);
 if(comm)return {agentId:a.id,kind:'speech',glyph:comm.glyph,label:comm.label,priority:90,eventId:comm.eventId,source:'event',recipientId:comm.toId,target:null};
 if(a.satiety<24)return {agentId:a.id,kind:'thought',glyph:'!',label:'หิว',priority:84,source:'need',need:'satiety',target:task?{x:task.x,y:task.y,kind}:null};
 if(a.hp<35)return {agentId:a.id,kind:'thought',glyph:'♥',label:'HP',priority:83,source:'need',need:'hp',target:task?{x:task.x,y:task.y,kind}:null};
 if(a.energy<12)return {agentId:a.id,kind:'thought',glyph:'z',label:'เพลีย',priority:82,source:'need',need:'energy',target:task?{x:task.x,y:task.y,kind}:null};
 if(['BUILD','CRAFT','PROCESS'].includes(kind))return {agentId:a.id,kind:'work',glyph:TASK_GLYPHS[kind],label:TASK_SHORT[kind],priority:70,source:'task',target:{x:task.x,y:task.y,kind}};
 if(recent)return {agentId:a.id,kind:'thought',glyph:TASK_GLYPHS[kind]??'…',label:TASK_SHORT[kind]??'คิด',priority:50,source:'task',target:{x:task.x,y:task.y,kind}};
 return null;
}
function worldBubbleSignals(s,selectedId=null,limit=5){
 const communications=recentCommunicationLinks(s);
 return living(s).map(a=>agentBubbleSignal(s,a,selectedId,communications)).filter(Boolean).sort((a,b)=>b.priority-a.priority||a.agentId-b.agentId).slice(0,limit);
}
function droppedWorldItems(s){
 return (s.rustPossessions?.items??[]).filter(i=>i.location?.kind==='drop'&&Number.isFinite(i.location.x)&&Number.isFinite(i.location.y)).map(i=>({itemId:i.id,kind:i.kind,x:i.location.x,y:i.location.y,sourceAgentId:i.location.sourceAgentId??null}));
}
function selectedRelationshipLinks(s,selectedId){
 const a=s.agents.find(x=>x.id===selectedId&&x.alive);if(!a)return [];
 const rows=[];
 if(a.parentId!==null){const p=s.agents.find(x=>x.id===a.parentId&&x.alive);if(p)rows.push({kind:'parent',fromId:p.id,toId:a.id,glyph:'⌁'});}
 for(const child of s.agents.filter(x=>x.alive&&x.parentId===a.id).sort((x,y)=>x.id-y.id))rows.push({kind:'child',fromId:a.id,toId:child.id,glyph:'⌁'});
 for(const l of (s.mentorship?.links??[]).filter(l=>l.endedTick===null&&(l.mentorId===a.id||l.studentId===a.id))){
  const from=s.agents.find(x=>x.id===l.mentorId&&x.alive),to=s.agents.find(x=>x.id===l.studentId&&x.alive);if(from&&to)rows.push({kind:'mentor',fromId:from.id,toId:to.id,glyph:'↔'});
 }
 return rows.slice(0,3);
}
function recentLifeBursts(s){
 return s.events.slice().reverse().filter(e=>s.tick>=e.tick&&s.tick-e.tick<=LIFE_EVENT_FEEDBACK_TICKS&&(e.type==='birth'||e.type==='death')).map(e=>{
  const p=findPerson(s,e.agentId);return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?{eventId:e.id,type:e.type,agentId:p.id,x:p.x,y:p.y,glyph:e.type==='birth'?'○':'†'}:null;
 }).filter(Boolean).slice(0,3);
}
function recentAchievementBursts(s){
 return s.events.slice().reverse().filter(e=>s.tick>=e.tick&&s.tick-e.tick<=ACHIEVEMENT_FEEDBACK_TICKS&&['skill','craft','build'].includes(e.type)).map(e=>{
  const p=findPerson(s,e.agentId);if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return null;
  return {eventId:e.id,type:e.type,agentId:p.id,x:p.x,y:p.y,glyph:e.type==='skill'?'★':e.type==='craft'?'⚒':'⌂'};
 }).filter(Boolean).slice(0,3);
}
function resourceTargetPulses(s,bubbles){
 const seen=new Set(),rows=[];
 for(const signal of bubbles){const task=s.agents.find(a=>a.id===signal.agentId)?.task,node=task&&s.nodes.find(n=>n.id===task.targetId);if(!node||seen.has(node.id))continue;seen.add(node.id);rows.push({nodeId:node.id,type:node.type,x:node.x,y:node.y,agentId:signal.agentId});}
 return rows.slice(0,4);
}
function worldFeedbackSnapshot(s,selectedId=null){
 const bubbles=worldBubbleSignals(s,selectedId,innerWidth<=700?3:5),communications=recentCommunicationLinks(s);
 return {agents:bubbles.map(x=>({agentId:x.agentId,kind:s.agents.find(a=>a.id===x.agentId)?.task?.kind??null,glyph:x.glyph,reason:x.source,bubbleKind:x.kind,label:x.label,eventId:x.eventId??null,recipientId:x.recipientId??null,target:x.target??null})),bubbles,communications,relationships:selectedRelationshipLinks(s,selectedId),resourcePulses:resourceTargetPulses(s,bubbles),lifeBursts:recentLifeBursts(s),achievementBursts:recentAchievementBursts(s),drops:droppedWorldItems(s),houses:houseFeedback(s)};
}
function drawCommunicationLink(c,link){
 const from=state.agents.find(a=>a.id===link.fromId&&a.alive),to=state.agents.find(a=>a.id===link.toId&&a.alive);if(!from||!to)return;
 const a=proj(from.x,from.y),b=proj(to.x,to.y);c.save();c.setLineDash([3,4]);line(c,[[a.x,a.y-30],[b.x,b.y-30]],'#cfe3c596',1);c.setLineDash([]);
 const mx=(a.x+b.x)/2,my=(a.y+b.y)/2-34;c.fillStyle='#dceadcf0';c.beginPath();c.arc(mx,my,7,0,Math.PI*2);c.fill();c.strokeStyle='#8eb69aaa';c.lineWidth=.8;c.stroke();
 c.fillStyle='#36503f';c.font='8px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(link.glyph,mx,my+.5);c.restore();
}
function drawRelationshipLink(c,link){
 const from=state.agents.find(a=>a.id===link.fromId&&a.alive),to=state.agents.find(a=>a.id===link.toId&&a.alive);if(!from||!to)return;
 const a=proj(from.x,from.y),b=proj(to.x,to.y),mentor=link.kind==='mentor',family=link.kind==='parent'||link.kind==='child';c.save();c.setLineDash(mentor?[2,3]:family?[6,4]:[4,4]);line(c,[[a.x,a.y-14],[b.x,b.y-14]],mentor?'#9fd0c49a':'#e2c79990',1.15);c.setLineDash([]);
 const mx=(a.x+b.x)/2,my=(a.y+b.y)/2-17;c.fillStyle=mentor?'#173f37e8':'#453a28df';c.beginPath();c.arc(mx,my,6,0,Math.PI*2);c.fill();c.fillStyle='#f0dfb5';c.font='8px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(link.glyph,mx,my+.4);c.restore();
}
function drawResourcePulse(c,pulse,time){
 const p=proj(pulse.x,pulse.y),phase=(Math.sin(time*.006+pulse.nodeId)+1)/2,r=9+phase*6;c.save();c.strokeStyle=pulse.type==='food'?'#d9d58f99':pulse.type==='wood'?'#c8a36f99':'#c4c8c6aa';c.lineWidth=1.1;c.beginPath();c.arc(p.x,p.y-6,r,0,Math.PI*2);c.stroke();c.restore();
}
function drawLifeBurst(c,burst,time){
 const p=proj(burst.x,burst.y),age=Math.max(0,state.tick-(state.events.find(e=>e.id===burst.eventId)?.tick??state.tick)),fade=Math.max(.25,1-age/LIFE_EVENT_FEEDBACK_TICKS),phase=(Math.sin(time*.01+burst.eventId)+1)/2;c.save();c.globalAlpha=fade;
 c.strokeStyle=burst.type==='birth'?'#e9d98c':'#b8c0c6';c.lineWidth=1;const r=12+phase*5;c.beginPath();c.arc(p.x,p.y-30,r,0,Math.PI*2);c.stroke();
 for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.moveTo(p.x+Math.cos(a)*(r+2),p.y-30+Math.sin(a)*(r+2));c.lineTo(p.x+Math.cos(a)*(r+7),p.y-30+Math.sin(a)*(r+7));c.stroke();}
 c.fillStyle=burst.type==='birth'?'#f0dda4':'#d5d8d7';c.font='12px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(burst.glyph,p.x,p.y-30);c.restore();
}
function drawAchievementBurst(c,burst,time){
 const p=proj(burst.x,burst.y),age=Math.max(0,state.tick-(state.events.find(e=>e.id===burst.eventId)?.tick??state.tick)),fade=Math.max(.2,1-age/ACHIEVEMENT_FEEDBACK_TICKS),lift=Math.min(12,age*.55);
 c.save();c.globalAlpha=fade;c.fillStyle=burst.type==='skill'?'#f0dc8f':burst.type==='craft'?'#d8c49a':'#dfbe83';c.font='13px Georgia';c.textAlign='center';c.fillText(burst.glyph,p.x,p.y-42-lift);
 c.strokeStyle='#ead69b77';c.lineWidth=.8;c.beginPath();c.arc(p.x,p.y-40-lift,8+(Math.sin(time*.012+burst.eventId)+1)*2,0,Math.PI*2);c.stroke();c.restore();
}
function drawTaskTarget(c,signal){
 const t=signal?.target;if(!t||!Number.isFinite(t.x)||!Number.isFinite(t.y))return;
 const p=proj(t.x,t.y),glyph=TASK_GLYPHS[t.kind]??'◇';c.save();c.strokeStyle='#efd29599';c.lineWidth=1;c.beginPath();c.arc(p.x,p.y-10,9,0,Math.PI*2);c.stroke();
 c.fillStyle='#17352ad8';c.beginPath();c.arc(p.x,p.y-10,7,0,Math.PI*2);c.fill();c.fillStyle='#f0ddb0';c.font='9px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(glyph,p.x,p.y-10);c.restore();
}
function drawDroppedItem(c,item){
 const p=proj(item.x,item.y),glyph=item.kind==='STONE_AXE'?'╱':item.kind==='STONE_PICKAXE'?'◆':item.kind==='HAMMER'?'⚒':['WOOD_FOUNDATION','WOOD_WALL','WOOD_DOORWAY','WOOD_ROOF'].includes(item.kind)?'⌂':'□';
 c.save();ellipse(c,p.x,p.y+2,10,4,'#17352a55');c.fillStyle='#e9dfb9';c.beginPath();c.roundRect(p.x-8,p.y-15,16,14,4);c.fill();c.strokeStyle='#af9e72';c.lineWidth=.7;c.stroke();c.fillStyle='#405141';c.font='9px Georgia';c.textAlign='center';c.fillText(glyph,p.x,p.y-5);c.restore();
}
function drawThoughtCloud(c,x,y,w,h,fill,stroke){
 c.save();c.fillStyle=fill;c.strokeStyle=stroke;c.lineWidth=.8;
 const parts=[[x-w*.28,y, w*.26,h*.46],[x,y-h*.12,w*.34,h*.58],[x+w*.3,y,w*.26,h*.45]];
 for(const [cx,cy,rx,ry] of parts){c.beginPath();c.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);c.fill();c.stroke();}
 c.beginPath();c.arc(x-w*.38,y+h*.52,2.8,0,Math.PI*2);c.fill();c.stroke();c.beginPath();c.arc(x-w*.46,y+h*.68,1.5,0,Math.PI*2);c.fill();c.stroke();c.restore();
}
function drawSpeechBox(c,x,y,w,h,fill,stroke){
 c.save();c.fillStyle=fill;c.strokeStyle=stroke;c.lineWidth=.8;c.beginPath();c.roundRect(x-w/2,y-h/2,w,h,6);c.fill();c.stroke();
 polygon(c,[[x-w*.25,y+h/2-1],[x-w*.12,y+h/2+7],[x-w*.05,y+h/2-1]],fill,stroke);c.restore();
}
function drawAgentBubble(c,signal){
 if(!signal)return;
 const label=signal.label??'',glyph=signal.glyph??'…';c.save();c.font='9px system-ui';const labelW=label?c.measureText(label).width:0,w=Math.max(30,18+labelW),h=20,x=17,y=-61;
 if(signal.kind==='thought')drawThoughtCloud(c,x,y,w,h,'#f0ead8f2','#b8b596aa');
 else drawSpeechBox(c,x,y,w,h,signal.kind==='speech'?'#dceadcf4':'#efe2bcf3',signal.kind==='speech'?'#8eb69aaa':'#c5a96eaa');
 c.textAlign='center';c.textBaseline='middle';c.fillStyle='#32483a';c.font='11px Georgia';c.fillText(glyph,x-(label?labelW*.25:0),y);
 if(label){c.font='8px system-ui';c.fillText(label,x+9,y+.5);}
 c.restore();
}
function drawHouseFeedback(c,h,time){
 const p=proj(h.x,h.y),label=h.status==='blocked'?'⌂ !':'⌂ '+h.progress+'%',phase=(Math.sin(time*.006+h.houseId)+1)/2;c.save();c.font='9px system-ui';c.textAlign='center';
 c.strokeStyle=h.status==='blocked'?'#d69b7a88':'#e1c98b66';c.lineWidth=1;c.beginPath();c.arc(p.x,p.y-14,18+phase*7,0,Math.PI*2);c.stroke();
 const w=Math.max(36,c.measureText(label).width+12);c.fillStyle='#17352ae8';c.beginPath();c.roundRect(p.x-w/2,p.y-70,w,17,5);c.fill();
 c.strokeStyle=h.status==='blocked'?'#d69b7a99':'#e1c98b99';c.lineWidth=.8;c.stroke();c.fillStyle='#efe0b8';c.fillText(label,p.x,p.y-58);c.restore();
}
function person(c,a,time,bubble=null){
 let v=positions.get(a.id);if(!v){v={x:a.x,y:a.y};positions.set(a.id,v);}v.x+=(a.x-v.x)*.2;v.y+=(a.y-v.y)*.2;
 const p=proj(v.x,v.y),moving=Array.isArray(a.task?.path)&&a.task.path.length>0;
 const next=moving?a.task.path[0]:null,facing=next?facingFromWorldStep(a,next):(a.visualFacing??'front-right');
 if(next)a.visualFacing=facing;
 const equipped=state.rustPossessions?.equipment?.find(e=>e.agentId===a.id&&equipmentSlotOf(e)==='hand'),equippedItem=equipped&&state.rustPossessions?.items?.find(i=>i.id===equipped.itemId),tool=equippedItem?.kind;
 c.save();c.translate(p.x,p.y);
 ellipse(c,1,2,10,4,'#19312755');
 if(selection?.kind==='agent'&&String(selection.id)===String(a.id)){c.strokeStyle='#efd299';c.lineWidth=1.5;c.beginPath();c.ellipse(0,1,15,7,0,0,Math.PI*2);c.stroke();}
 drawAgentCutout(c,a,time,{tool,facing,scale:.8});
 drawAgentBubble(c,bubble);
 c.restore();
}
function cameraOrigin(){return nav?.anchor()??{x:cw/2,y:ch/2};}
function frameSelected(){const a=state.agents.find(a=>a.id===activeAgentId&&a.alive);if(a){focus={x:a.x,y:a.y};pan={x:0,y:0};}}
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
function drawRc4MarketMarkers(c,time){
  for(const m of rc4WorldMarketMarkers(state)){
    const p=proj(m.x,m.y),open=m.open===true,label=(open?'OPEN · ':'CLOSED · ')+m.ownerName;
    c.save();c.translate(p.x,p.y-18);
    c.fillStyle='#1b3b31e8';c.beginPath();c.roundRect(-24,-13,48,22,5);c.fill();
    c.fillStyle=open?'#e8cfa0':'#b7b9ae';c.font='bold 9px system-ui';c.textAlign='center';c.fillText('¤ MARKET',0,-2);
    c.font='8px system-ui';c.fillStyle='#f3ebd2';c.fillText(label,0,7);
    if(open){c.globalAlpha=.45+.2*Math.sin(time*.006);c.strokeStyle='#e8cfa0';c.strokeRect(-26,-15,52,26);}
    c.restore();
  }
}
function render(time){
 ctx.setTransform(dpr,0,0,dpr,0,0);
 const bg=ctx.createLinearGradient(0,0,cw,ch);bg.addColorStop(0,'#4c654b');bg.addColorStop(1,'#314b3d');ctx.fillStyle=bg;ctx.fillRect(0,0,cw,ch);
 if(follow){const a=state.agents.find(a=>a.id===activeAgentId&&a.alive);if(a){focus.x+=(a.x-focus.x)*.03;focus.y+=(a.y-focus.y)*.03;}}
 ctx.save();ctx.translate(cameraOrigin().x+pan.x,cameraOrigin().y+pan.y);ctx.scale(zoom,zoom);const f=proj(focus.x,focus.y);ctx.translate(-f.x,-f.y);
 const bounds=worldBounds(state);ctx.drawImage(ground,-bounds.h*hw-60,-32);
 const a=state.agents.find(a=>a.id===activeAgentId&&a.alive);
 if(a?.task?.path.length){ctx.setLineDash([3,5]);line(ctx,[[proj(a.x,a.y).x,proj(a.x,a.y).y],...a.task.path.map(v=>{const p=proj(v.x,v.y);return [p.x,p.y];})],'#e9d4a588',1.3);ctx.setLineDash([]);}
 const structureCtx=structureRenderContext(),bubbles=worldBubbleSignals(state,activeAgentId,innerWidth<=700?3:5),bubbleMap=new Map(bubbles.map(x=>[x.agentId,x]));
 for(const link of selectedRelationshipLinks(state,activeAgentId))drawRelationshipLink(ctx,link);
 for(const link of recentCommunicationLinks(state))drawCommunicationLink(ctx,link);
 const objects=[...state.nodes.map(n=>({kind:'node',data:n,depth:n.x+n.y})),...state.buildings.filter(b=>b.type!=='shelter').map(b=>({kind:'building',data:b,depth:b.x+b.y+.1})),...(state.rustStations?.stations??[]).map(st=>({kind:'rust-station',data:st,depth:structureDepth(st)})),...droppedWorldItems(state).map(item=>({kind:'drop-item',data:item,depth:item.x+item.y+.15})),...(state.wildMonsters?.entities??[]).filter(m=>m.status!=='DEFEATED'&&m.status!=='RESPAWNING').map(m=>({kind:'wild-monster',data:m,depth:m.x+m.y+.18})),...living(state).map(a=>({kind:'agent',data:a,depth:a.x+a.y+.2}))].sort((a,b)=>a.depth-b.depth);
 for(const o of objects){if(o.kind==='node')node(ctx,o.data);else if(o.kind==='building')building(ctx,o.data,time);else if(o.kind==='rust-station')rustStation(ctx,o.data,structureCtx);else if(o.kind==='drop-item')drawDroppedItem(ctx,o.data);else if(o.kind==='wild-monster')drawWildMonster(ctx,o.data,time);else person(ctx,o.data,time,bubbleMap.get(o.data.id)??null);}
 drawCombatFeedback(ctx,time);
 for(const pulse of resourceTargetPulses(state,bubbles))drawResourcePulse(ctx,pulse,time);
 for(const signal of bubbles)drawTaskTarget(ctx,signal);
 for(const burst of recentLifeBursts(state))drawLifeBurst(ctx,burst,time);
 for(const burst of recentAchievementBursts(state))drawAchievementBurst(ctx,burst,time);
 for(const h of houseFeedback(state))drawHouseFeedback(ctx,h,time);
 drawRc4MarketMarkers(ctx,time);
 if(isIndependent(state))for(const h of individualHouses(state)){
  const p=proj(h.origin.x,h.origin.y),owner=findPerson(state,h.ownerId),label=(h.complete?'⌂ ':'… ')+(owner?.name??'UNKNOWN');
  ctx.font='10px system-ui';ctx.textAlign='center';const width=ctx.measureText(label).width+12;
  ctx.fillStyle='#132e26e6';ctx.fillRect(p.x-width/2,p.y+12,width,16);ctx.fillStyle='#f0dfb7';ctx.fillText(label,p.x,p.y+24);
 }
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
 const selectedAgent=state.agents.find(a=>a.id===activeAgentId),stock=isIndependent(state)?(selectedAgent?resourceStock(state,selectedAgent):materialTotals(state,{livingOnly:true})):state.stock;
 for(const type of ['food','wood','stone'])$(type).textContent=stock[type];
 if(isIndependent(state)){
  const account=selectedAgent?resourceAccount(state,selectedAgent):null;
  document.querySelector('.resources').title=selectedAgent
   ?(account?.kind==='household'?'ทรัพยากรร่วม Household '+account.houseId:'ทรัพยากรชั่วคราวของ '+selectedAgent.name)
   :'ผลรวมทุก Household/คนไร้บ้าน · อ่านอย่างเดียว';
 }else document.querySelector('.resources').title='';
 $('population').textContent=isIndependent(state)?living(state).length+' คน':living(state).length+' / '+capacity(state);
 $('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'เล่นต่อ':'หยุดเวลา');
 $('world-status').textContent=paused||dialog.open?'หยุดเวลา · โลกยังอยู่ตรงนี้':'โลกกำลังดำเนินไปด้วยตัวเอง';
 $('seed-label').textContent='SEED '+state.seed;
 $('recent-events').innerHTML=state.events.slice(-3).reverse().map(e=>`<button class="event-chip diegetic-event-chip" data-event="${e.id}" aria-label="${esc(e.text)}"><b aria-hidden="true">${EVENT_GLYPHS[e.type]??'•'}</b><small>D${1+Math.floor(e.tick/360)}</small></button>`).join('');
 inspect();ux?.renderHUD();nav?.update();independentUI?.update();adventureUI?.update();
}
function selectAgent(id,center=false){if(isIndependent(state)&&center)zoom=Math.max(zoom,1.12);follow=false;activeAgentId=id;selection=worldSelection('agent',id);tab='about';mode='observe';$('mode-hint').hidden=true;$('observe').classList.add('active');const a=findPerson(state,id);if(a&&(center||innerWidth<=700)){focus={x:a.x,y:a.y};pan={x:0,y:0};}updateUI();}
function openDialog(title,kicker,body){$('dialog').dataset.kind='other';$('dialog-title').textContent=title;$('dialog-kicker').textContent=kicker;$('dialog-body').innerHTML=body;if(!dialog.open)dialog.showModal();updateUI();}
function roster(){ux?.openRoster();}
function history(){ux?.openHistory();}
function systems(){ux?.openSystems();}
function market(){
 const m=rc4MarketReadModel(state,activeAgentId),sel=m.selected;
 if(!sel){openDialog('ตลาด RC4','MERCHANT ECONOMY','<p>เลือก Clone จากประชากรก่อน แล้วเปิดตลาดอีกครั้ง</p>');return;}
 const q=m.qualification,checks=q?.checks??{};
 const blocked=Object.entries(checks).filter(([,v])=>v?.status!=='SAT').map(([k,v])=>'<li>'+esc(k)+' · '+esc(v?.detail??v?.status)+'</li>').join('');
 let body='<section class="visual-menu-status"><div class="visual-menu-status-icon">¤</div><div><small>SELECTED CLONE</small><b>'+esc(sel.name)+'</b><span>'+esc(sel.profession??'ยังไม่มีอาชีพ')+' · เงิน '+esc(sel.balance??'—')+'</span></div></section>';

 if(!m.ownMarket){
   body+='<div class="help-block"><b>เริ่มสาย Merchant</b><p>ต้องมีบ้านส่วนตัวที่สร้างเสร็จ แล้วเตรียม Home Market แบบปิดก่อน</p></div>'+
     '<div class="dialog-actions"><button class="primary" data-action="rc4-create-market" data-agent="'+sel.id+'">เตรียม Home Market ที่บ้าน</button></div>';
 }else{
   const open=m.ownMarket.status==='open';
   body+='<div class="help-block"><b>Home Market '+esc(m.ownMarket.marketId)+'</b><br>สถานะ '+esc(m.ownMarket.status)+' · บ้าน '+esc(m.ownMarket.homeId)+'</div>';
   if(sel.profession==='merchant'){
     body+='<div class="dialog-actions"><button class="'+(open?'secondary':'primary')+'" data-action="'+(open?'rc4-close-market':'rc4-open-market')+'" data-agent="'+sel.id+'" data-market="'+esc(m.ownMarket.marketId)+'">'+(open?'ปิดร้าน':'เปิดร้าน')+'</button></div>';
   }else{
     body+='<p class="source-note">ตลาดเตรียมการยังปิดอยู่ · ตั้ง BuyOffer/Listing intent เพื่อสร้าง trade knowledge ก่อน</p>';
   }
 }

 if(m.ownMarket){
   const kinds=[...new Set([...m.bag.map(i=>i.kind),...m.markets.flatMap(x=>x.listings.map(l=>l.itemKind)),'STONE_AXE','STONE_PICKAXE','HAMMER'])].sort().slice(0,8);
   body+='<h3>Buy Offer · Trade Knowledge</h3>'+(kinds.length?kinds.map(k=>'<button class="secondary" data-action="rc4-create-offer" data-agent="'+sel.id+'" data-kind="'+esc(k)+'" data-price="70">รับซื้อ '+esc(k)+' · 70</button>').join(' '):'<p>ยังไม่มีชนิดสินค้าในโลก</p>');
 }

 if(sel.profession!=='merchant'){
   body+=q?.qualified
     ?'<div class="dialog-actions"><button class="primary" data-action="rc4-become-merchant" data-agent="'+sel.id+'">เป็น Merchant</button></div>'
     :'<div class="help-block"><b>ยังเป็น Merchant ไม่ได้</b><ul>'+(blocked||'<li>ต้องมีบ้าน เงินทุน และ Home Market intent อย่างน้อย 1 รายการ</li>')+'</ul></div>';
 }

 if(sel.profession==='merchant'&&m.ownMarket){
   const tradable=m.bag.filter(i=>i.tradable);
   body+='<h3>ของในกระเป๋าที่ลงขายได้</h3>'+(tradable.length?tradable.map(i=>'<div class="help-block"><b>'+esc(i.kind)+'</b> · #'+i.id+'<div class="dialog-actions"><button data-action="rc4-list-item" data-agent="'+sel.id+'" data-item="'+i.id+'" data-price="100">ลงขาย 100</button></div></div>').join(''):'<p>ยังไม่มี item ที่ลงขายได้</p>');
 }

 body+='<h3>ตลาดที่ Clone เคยพบ</h3>';
 if(!m.markets.length)body+='<p>ยังไม่มี Home Market</p>';
 for(const marketRow of m.markets){
   body+='<section class="help-block"><b>¤ '+esc(marketRow.ownerName)+' · '+esc(marketRow.status)+'</b><br><small>'+esc(marketRow.marketId)+'</small>';
   if(marketRow.listings.length){
     body+='<div><b>Listings</b></div>';
     for(const l of marketRow.listings){
       body+='<div>'+esc(l.itemKind)+' · '+l.quantity+' ชิ้น · '+l.unitPrice+' · '+esc(l.status);
       if(sel.id!==l.sellerId&&l.needed&&l.status==='OPEN'&&marketRow.status==='open'){
         const arrived=m.arrival?.state==='SAT'&&m.arrival?.marketId===marketRow.marketId;
         body+=arrived
           ?' <button class="primary" data-action="rc4-buy-listing" data-agent="'+sel.id+'" data-listing="'+esc(l.id)+'" data-listing-revision="'+l.revision+'">ซื้อ</button>'
           :' <button data-action="rc4-travel-market" data-agent="'+sel.id+'" data-market="'+esc(marketRow.marketId)+'">เดินไปซื้อ</button>';
       }
       body+='</div>';
     }
   }
   if(marketRow.offers.length){
     body+='<div><b>Buy Offers</b></div>';
     for(const o of marketRow.offers){
       body+='<div>'+esc(o.itemKind)+' · '+o.quantityWanted+' ชิ้น · '+o.unitPrice+' · '+esc(o.status);
       const owned=m.bag.find(i=>i.tradable&&i.kind===o.itemKind);
       if(sel.id!==o.buyerId&&owned&&o.status==='OPEN')body+=' <button data-action="rc4-accept-offer" data-agent="'+sel.id+'" data-offer="'+esc(o.offerId)+'" data-item="'+owned.id+'">ตอบรับ BuyOffer</button>';
       body+='</div>';
     }
   }
   if(marketRow.ledger)body+='<div><b>Ledger</b> · Revenue '+marketRow.ledger.revenue+' · COGS '+marketRow.ledger.costOfGoodsSold+' · Profit '+marketRow.ledger.realizedProfit+'</div>';
   body+='</section>';
 }
 if(m.ledger)body+='<h3>Merchant Ledger</h3><div class="help-block">Revenue '+m.ledger.revenue+' · COGS '+m.ledger.costOfGoodsSold+' · Profit '+m.ledger.realizedProfit+'<br>ซื้อ '+m.ledger.purchases.length+' · ขาย '+m.ledger.sales.length+'</div>';
 if(m.arrival?.state==='UNKNOWN')body+='<p class="source-note">กำลังเดินไปตลาด…</p>';
 if(m.arrival?.state==='SAT')body+='<p class="source-note">NAVIGATION VERIFIED · ถึงตลาดแล้ว</p>';
 openDialog('ตลาด RC4','MERCHANT ECONOMY',body);
}
function cloneDialog(){ux?.openClone();}
function menu(){
 const status=store.status(),protectedSave=status.protected&&store.originalText()!==null;
 const card=(action,glyph,label,meta='')=>'<button class="visual-menu-card" data-action="'+action+'" aria-label="'+esc(label)+'"><b aria-hidden="true">'+glyph+'</b><span>'+esc(label)+'</span>'+(meta?'<small>'+esc(meta)+'</small>':'')+'</button>';
 openDialog('โลกของคุณ','SIMCLONE · UI '+UI_VERSION,
  '<section class="visual-menu-status"><div class="visual-menu-status-icon" aria-hidden="true">◈</div><div><small>SAVE</small><b>'+esc(saveLabel(status))+'</b><span>Local browser</span></div></section>'+
  '<div class="visual-menu-grid">'+
   card('systems','◇','ระบบโลก','AI / Systems')+
   card('market','¤','ตลาด RC4','Merchant Economy')+
   card('survival','♥','การอยู่รอด','World / Needs')+
   card('save','↓','บันทึก','Local')+
   card('export','↗','ส่งออก','JSON')+
   card('import','↥','นำเข้า','JSON')+
   (protectedSave?card('export-original','⛨','สำรองเซฟเดิม','Recovery'):'')+
   card('reset','○','โลกใหม่','Reset')+
   '<a class="visual-menu-card" href="./plan.html" target="_blank" rel="noopener" aria-label="แผนพัฒนา"><b aria-hidden="true">⌘</b><span>แผนพัฒนา</span><small>Roadmap</small></a>'+
   card('help','?','วิธีเล่น','Visual guide')+
  '</div>'+
  '<details class="menu-explain"><summary>ข้อมูลระบบ</summary><p>เล่นได้โดยไม่ต้องต่อ AI API · simulation ใช้กฎและคะแนนบน CPU · auto-save ทุก 10 วินาที · ปิดเว็บแล้วโลกหยุด</p><small>Engine '+VERSION+' · Knowledge Continuity 1</small></details>');
}
function download(){const blob=new Blob([serialize(state)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='simclone-day-'+day(state)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('ส่งออกไฟล์โลกแล้ว');}
$('dialog-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{accumulator=0;updateUI();});
$('dialog-body').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.person){dialog.close();selectAgent(Number(b.dataset.person),true);return;}
 if(b.dataset.story){ux?.openEvent(Number(b.dataset.story));return;}
 const action=b.dataset.action;
 if(action==='systems'){ux.openSystems();return;}
 if(action==='market'){market();return;}
 if(action==='survival'){ux.openSurvival();return;}
 if(action&&action.startsWith('rc4-')){
  let result;
  if(action==='rc4-become-merchant')result=command(state,'RC4_BECOME_MERCHANT',{agentId:Number(b.dataset.agent)});
  else if(action==='rc4-create-market')result=command(state,'RC4_CREATE_MARKET',{agentId:Number(b.dataset.agent)});
  else if(action==='rc4-open-market')result=command(state,'RC4_OPEN_MARKET',{agentId:Number(b.dataset.agent),marketId:b.dataset.market});
  else if(action==='rc4-close-market')result=command(state,'RC4_CLOSE_MARKET',{agentId:Number(b.dataset.agent),marketId:b.dataset.market});
  else if(action==='rc4-list-item')result=command(state,'RC4_CREATE_LISTING',{agentId:Number(b.dataset.agent),itemId:Number(b.dataset.item),unitPrice:Number(b.dataset.price),requestId:'ui-'+state.tick});
  else if(action==='rc4-create-offer')result=command(state,'RC4_CREATE_BUY_OFFER',{agentId:Number(b.dataset.agent),itemKind:b.dataset.kind,unitPrice:Number(b.dataset.price)});
  else if(action==='rc4-accept-offer')result=command(state,'RC4_ACCEPT_BUY_OFFER',{producerId:Number(b.dataset.agent),offerId:b.dataset.offer,itemId:Number(b.dataset.item)});
  else if(action==='rc4-travel-market')result=command(state,'RC4_TRAVEL_TO_MARKET',{agentId:Number(b.dataset.agent),marketId:b.dataset.market});
  else if(action==='rc4-buy-listing')result=command(state,'RC4_BUY_LISTING',{buyerId:Number(b.dataset.agent),listingId:b.dataset.listing,listingRevision:Number(b.dataset.listingRevision)});
  else result={ok:false,message:'คำสั่งตลาดไม่ถูกต้อง'};
  toast(result.message??result.reason??(result.ok?'สำเร็จ':'ไม่สำเร็จ'));
  if(result.ok)save();
  if(action==='rc4-travel-market'&&result.ok){dialog.close();selectAgent(Number(b.dataset.agent),true);updateUI();return;}
  market();updateUI();return;
 }
 if(action==='hunt-monster'){
  const agentId=Number(b.dataset.agent),worldMonsterId=b.dataset.monster;
  const result=command(state,'START_ADVENTURE_HUNT',{agentId,worldMonsterId});
  toast(result.ok?'กำลังเดินไปหา '+worldMonsterId:(result.message??result.reason??'เริ่มล่าไม่ได้'));
  if(result.ok){dialog.close();selectAgent(agentId,true);selection=worldSelection('monster',worldMonsterId);updateUI();save();}
  else updateUI();
  return;
 }
 if(action==='cancel'){dialog.close();return;}
 if(action==='confirm-clone'){const result=command(state,'CLONE',{parentId:activeAgentId});toast(result.message);if(result.ok){dialog.close();selectAgent(result.agentId,true);save();}return;}
 if(action==='export-original'){const text=store.originalText();if(text!==null){const url=URL.createObjectURL(new Blob([text],{type:'text/plain'})),a=document.createElement('a');a.href=url;a.download='simclone-recovery-original.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('ส่งออกเซฟเดิมโดยไม่แก้ไขแล้ว');}return;}
 if(action==='save'){save(true);return;}if(action==='export'){download();return;}
 if(action==='import'){$('import-file').click();return;}
 if(action==='reset'){openDialog('เริ่มโลกใหม่','NEW WORLD',`<p>โลกปัจจุบันในเบราว์เซอร์จะถูกแทนที่ ควรส่งออกไฟล์ก่อน กรอก seed เดิมเพื่อเริ่มด้วยแผนที่และตัวละครตั้งต้นเหมือนเดิม</p><label for="world-mode">รูปแบบโลก</label><select id="world-mode" class="seed-input"><option value="independent">ชีวิตอิสระ — แยกเริ่มชีวิตและสร้างบ้านตัวเอง</option><option value="legacy">หมู่บ้านแบบเดิม (สำหรับเซฟเก่า)</option></select><label for="seed-input">World seed</label><input id="seed-input" class="seed-input" type="number" min="0" max="4294967295" value="${state.seed}"><div class="dialog-actions"><button class="primary" data-action="confirm-reset">เริ่มใหม่และแทนที่บันทึก</button><button class="secondary" data-action="export">ส่งออกโลกปัจจุบัน</button></div>`);return;}
 if(action==='confirm-reset'){
  const seed=Number($('seed-input').value);if(!Number.isInteger(seed)||seed<0||seed>4294967295){toast('กรอก seed เป็นจำนวนเต็ม 0–4294967295');return;}
  const worldMode=$('world-mode').value;
  state=createWorld(seed,{mode:worldMode,worldProfile:worldMode==='independent'?publicWorldProfile:'legacy'});store.allowReplacement();paused=false;positions.clear();follow=false;activeAgentId=innerWidth>700?2:null;selection=activeAgentId?worldSelection('agent',activeAgentId):null;mode='observe';$('mode-hint').hidden=true;focus=defaultFocusFor(state);pan={x:0,y:0};if(isIndependent(state)){activeAgentId=null;selection=null;const starter=state.agents.find(a=>a.alive);focus=starter?{x:starter.x,y:starter.y}:defaultFocusFor(state);const b=worldBounds(state);zoom=['large','same-world'].includes(b.profile)?(innerWidth<700?.42:.68):(innerWidth<700?.55:.95);}makeGround();save();dialog.close();updateUI();toast('โลกใหม่พร้อมแล้ว');return;
 }
 if(action==='help')openDialog('ดูโลกที่กำลังคิดและสร้างเอง','HOW TO PLAY',`<p><b>1. แตะสิ่งที่อยู่ในโลก</b><br>Clone เปิด Inspector · Camp เปิด Cultural Archive · Crafting Table เปิดสูตรโต๊ะ · Furnace เปิด Charcoal · บ้านเปิด Housing status</p><p><b>2. เมนูรวมใช้ดูภาพรวม</b><br>Survival / Systems / Items แยกหน้าที่ชัดเจน และไม่ถือ action ของสิ่งปลูกสร้างแทนตัวสิ่งปลูกสร้าง</p><p><b>3. ปล่อยให้ AI ดำเนินโลก</b><br>บ้านและวงจรพื้นฐานเดินอัตโนมัติ การสร้าง Clone แบบ manual ยังทำได้จาก Inspector แต่ไม่ใช่แกนหลัก</p><p><b>ควบคุมเวลา</b><br>Ⅱ หยุด · 1× / 2× / 5× เร่งเวลา · Space หยุด/เล่น<br>เมนูที่เปิดเป็นหน้าต่างจะหยุดเวลาอัตโนมัติ</p><div class="help-block">LIVE คือ authority จริง · READY คือระบบพร้อมแต่ policy เต็มยังไม่เปิด · SHADOW คือการคำนวณเพื่อสังเกตโดยยังไม่เขียนผลจริง</div>`);
});
$('import-file').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>HISTORY_LIMITS.maxSaveCharacters*3)throw new Error('ไฟล์ใหญ่เกินงบการนำเข้า');const candidate=restoreForPublic(await file.text());
 openDialog('นำเข้าโลกที่บันทึกไว้','IMPORT WORLD',`<p>วันที่ ${day(candidate)} · ประชากร ${living(candidate).length} คน<br>การนำเข้าจะแทนที่โลกปัจจุบันในเบราว์เซอร์</p><div class="dialog-actions"><button id="confirm-import" class="primary">ยืนยันนำเข้า</button><button class="secondary" data-action="cancel">ยกเลิก</button></div>`);
 $('confirm-import').onclick=()=>{state=candidate;store.allowReplacement();activeAgentId=null;selection=null;follow=false;mode='observe';$('mode-hint').hidden=true;positions.clear();focus=defaultFocusFor(state);pan={x:0,y:0};if(isIndependent(state)){const starter=state.agents.find(a=>a.alive);focus=starter?{x:starter.x,y:starter.y}:defaultFocusFor(state);const b=worldBounds(state);zoom=['large','same-world'].includes(b.profile)?(innerWidth<700?.42:.68):(innerWidth<700?.55:.95);}makeGround();save();dialog.close();updateUI();toast('นำเข้าโลกสำเร็จ');};
 }catch(error){toast('นำเข้าไม่ได้: '+error.message);}});
$('inspector').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.ui==='close'){activeAgentId=null;selection=null;follow=false;}else if(b.dataset.tab){tab=b.dataset.tab;frameSelected();}else if(b.dataset.ui==='follow'){follow=!follow;const a=state.agents.find(a=>a.id===activeAgentId);if(a){focus={x:a.x,y:a.y};pan={x:0,y:0};}}updateUI();});
$('pause').onclick=()=>{paused=!paused;accumulator=0;updateUI();};
for(const b of document.querySelectorAll('[data-speed]'))b.onclick=()=>{speed=Number(b.dataset.speed);document.querySelectorAll('[data-speed]').forEach(x=>x.classList.toggle('active',x===b));};
$('systems').onclick=systems;if($('market'))$('market').onclick=market;$('roster').onclick=roster;$('history').onclick=history;$('open-chronicle').onclick=history;$('menu').onclick=menu;
function observe(){mode='observe';$('mode-hint').hidden=true;$('observe').classList.add('active');updateUI();}
$('observe').onclick=observe;
$('recent-events').onclick=e=>{const id=e.target.closest('[data-event]')?.dataset.event;if(!id)return;const ev=state.events.find(e=>e.id===Number(id));if(ev?.agentId)selectAgent(ev.agentId,true);else history();};
for(const b of document.querySelectorAll('[data-nav]'))b.onclick=()=>{document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('active',x===b));const n=b.dataset.nav;if(n==='people')roster();else if(n==='systems')systems();else if(n==='rust')ux?.openRust();else if(n==='history')history();else{activeAgentId=null;selection=null;follow=false;observe();}};
$('recenter').onclick=()=>{const a=state.agents.find(a=>a.alive);focus=a?{x:a.x,y:a.y}:defaultFocusFor(state);pan={x:0,y:0};follow=false;};
const setZoom=z=>{const min=['large','same-world'].includes(worldBounds(state).profile)?.3:.5;zoom=Math.max(min,Math.min(2.8,z));};$('zoom-in').onclick=()=>setZoom(zoom*1.2);$('zoom-out').onclick=()=>setZoom(zoom/1.2);
canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*(e.deltaY<0?1.1:1/1.1));},{passive:false});
const legacyWorldHit=hit=>hit?{type:hit.kind,id:hit.id,d:hit.distance}:null;
function worldHitCandidatesAtScreen(sx,sy){
 const rows=[];
 for(const a of living(state)){
  const v=positions.get(a.id)??a,p=screenPoint(v.x,v.y);
  rows.push(worldHitCandidate({kind:'agent',id:a.id,distance:Math.hypot(sx-p.x,sy-(p.y-19*zoom)),hitRadius:34,source:'agent'}));
 }
 for(const b of state.buildings.filter(b=>b.type!=='shelter')){
  const p=screenPoint(b.x,b.y);
  rows.push(worldHitCandidate({kind:'building',id:b.id,distance:Math.hypot(sx-p.x,sy-(p.y-16*zoom)),hitRadius:Math.max(24,34*zoom),source:'building'}));
 }
 for(const st of (state.rustStations?.stations??[])){
  const p=screenPoint(st.x,st.y);
  rows.push(worldHitCandidate({kind:'station',id:st.id,distance:Math.hypot(sx-p.x,sy-(p.y-14*zoom)),hitRadius:Math.max(24,34*zoom),source:'station'}));
 }
 for(const n of state.nodes){
  const p=screenPoint(n.x,n.y),oy=n.type==='wood'&&n.amount>0?42:8;
  rows.push(worldHitCandidate({kind:'resource',id:n.id,distance:Math.hypot(sx-p.x,sy-(p.y-oy*zoom)),hitRadius:Math.max(18,38*zoom),source:'resource'}));
 }
 for(const i of droppedWorldItems(state)){
  const p=screenPoint(i.x,i.y);
  rows.push(worldHitCandidate({kind:'drop',id:i.itemId,distance:Math.hypot(sx-p.x,sy-(p.y-7*zoom)),hitRadius:Math.max(18,38*zoom),source:'drop'}));
 }
 for(const m of (state.wildMonsters?.entities??[]).filter(m=>m.status!=='DEFEATED'&&m.status!=='RESPAWNING')){
  const p=screenPoint(m.x,m.y);
  rows.push(worldHitCandidate({kind:'monster',id:m.worldMonsterId,distance:Math.hypot(sx-p.x,sy-(p.y-20*zoom)),hitRadius:Math.max(24,38*zoom),source:'monster'}));
 }
 for(const e of [...recentLifeBursts(state),...recentAchievementBursts(state)]){
  const p=screenPoint(e.x,e.y);
  rows.push(worldHitCandidate({kind:'event',id:e.eventId,distance:Math.hypot(sx-p.x,sy-(p.y-30*zoom)),hitRadius:Math.max(12,18*zoom),source:'event'}));
 }
 return rows.filter(Boolean);
}
function worldTargetAtScreen(sx,sy){return resolveWorldHit(worldHitCandidatesAtScreen(sx,sy));}
function structureTargetAtScreen(sx,sy){
 return legacyWorldHit(resolveWorldHit(worldHitCandidatesAtScreen(sx,sy).filter(row=>row.kind==='building'||row.kind==='station')));
}
function worldObjectTargetAtScreen(sx,sy){
 return legacyWorldHit(resolveWorldHit(worldHitCandidatesAtScreen(sx,sy).filter(row=>['resource','drop','monster','event'].includes(row.kind))));
}
function openStructureContext(target){if(!independentUI?.openStructure(target))ux?.openStructure(target);}
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
 const rect=canvas.getBoundingClientRect(),sx=e.clientX-rect.left,sy=e.clientY-rect.top,hit=worldTargetAtScreen(sx,sy);
 if(hit?.kind==='event')independentUI?.openWorldObject(legacyWorldHit(hit));
 else if(hit){
  selection=selectionFromWorldHit(hit);
  const target=legacyWorldHit(hit);
  if(hit.kind==='agent')selectAgent(hit.id);
  else if(['building','station'].includes(hit.kind))openStructureContext(target);
  else if(hit.kind==='monster')openMonsterContext(hit.id);
  else independentUI?.openWorldObject(target);
 }else{selection=null;activeAgentId=null;follow=false;updateUI();}
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
 read:()=>({state,selected:activeAgentId,tab,mode,paused,follow,canAutosave:!store.status().protected}),
 portrait,actionText,toast,openDialog,closeDialog:()=>dialog.close(),
 select:selectAgent,setTab:value=>{tab=value;frameSelected();updateUI();},observe,
 center:centerCamera,
 preview:(type,data)=>{const copy=JSON.parse(serialize(state)),result=command(copy,type,data);return {...result,agent:type==='CLONE'&&result.ok?copy.agents.at(-1):null};},
 execute:(type,data)=>{const result=command(state,type,data);updateUI();return result;},save
});
independentUI=installIndependentUI({read:()=>({state,selected:activeAgentId}),center:centerCamera,openDialog,closeDialog:()=>dialog.close(),openEvent:id=>ux.openEvent(id),toast,save,
 preview:(type,data)=>command(JSON.parse(serialize(state)),type,data),execute:(type,data)=>{const r=command(state,type,data);updateUI();return r;}});
adventureUI=installAdventureUI({read:()=>({state,selected:activeAgentId}),openDialog,closeDialog:()=>dialog.close(),toast,save,select:selectAgent,center:centerCamera,execute:(type,data)=>{const r=command(state,type,data);updateUI();return r;}});
nav=installNavigation({mapView:()=>worldMapView,read:()=>({state,selected:activeAgentId,follow,mode,paused}),menu,center:centerCamera,worldPoint,focus:()=>({...focus}),zoom:()=>zoom,storageStatus:store.status,layoutChanged:()=>{const a=state.agents.find(a=>a.id===activeAgentId&&a.alive);if(a)focus={x:a.x,y:a.y};}});
updateUI();
setInterval(()=>{if(!document.hidden)save();},10000);
requestAnimationFrame(frame);

// Read-only test hook. It returns copies, never mutable simulation state.
window.simclone=Object.freeze({version:VERSION,uiVersion:UI_VERSION,mapPresentation:()=>({version:WORLD_MAP_VERSION,...MAP_AUTHORITY}),worldSize:()=>({...worldBounds(state)}),snapshot:()=>JSON.parse(serialize(state)),saveStatus:()=>store.status(),safeFrame:()=>nav.frame(),worldFeedback:()=>worldFeedbackSnapshot(state,activeAgentId),combatFeedback:()=>combatFeedbackProjection().map(r=>({...r,lastTurn:r.lastTurn?{...r.lastTurn}:null})),camera:()=>({zoom,pan:{...pan},focus:{...focus},cw,ch}),screenPoint:(x,y)=>screenPoint(x,y),structureTargetAtScreen:(x,y)=>structureTargetAtScreen(x,y),worldObjectTargetAtScreen:(x,y)=>worldObjectTargetAtScreen(x,y),worldSelection:()=>selection?{...selection}:null,activeAgent:()=>activeAgentId,worldTargetAtScreen:(x,y)=>worldTargetAtScreen(x,y),resolveWorldHit:candidates=>resolveWorldHit(candidates),selectedWorldMonster:()=>selection?.kind==='monster'?selection.id:null,openMonsterContext:id=>openMonsterContext(id),personalHomes:()=>individualHouses(state)});
