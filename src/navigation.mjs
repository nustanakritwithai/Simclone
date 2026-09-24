/** Read-only map and layout-aware camera. No simulation mutations. */
import {SIZE} from './engine.mjs?v=0.5.0';
import {saveLabel} from './storage.mjs?v=0.5.0';
export function safeFrame(width,height,edges={}){
  const left=Math.max(8,Math.min(edges.left??12,width*.4));
  const right=Math.max(left+40,Math.min(edges.right??width-12,width-8));
  const top=Math.max(8,Math.min(edges.top??12,height-72));
  const bottom=Math.max(top+56,Math.min(edges.bottom??height-12,height-8));
  return {left,right,top,bottom,width:right-left,height:bottom-top};
}
export function mapCell(x,y,width,height){
  return {x:Math.max(0,Math.min(SIZE.w-1,Math.floor(x/width*SIZE.w))),y:Math.max(0,Math.min(SIZE.h-1,Math.floor(y/height*SIZE.h)))};
}
export function installNavigation(api){
  const $=id=>document.getElementById(id),stage=$('stage'),camera=document.querySelector('.camera');
  const button=document.createElement('button');button.id='map-toggle';button.className='iconbtn';button.textContent='▧';button.setAttribute('aria-label','เปิดแผนที่ย่อ');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','mini-map');camera.append(button);
  const panel=document.createElement('section');panel.id='mini-map';panel.hidden=true;
  panel.innerHTML='<div class="minimap-heading"><span>WorldSim · ภาพแผนที่</span><button id="map-close" aria-label="ปิดแผนที่ย่อ">×</button></div><canvas id="map-canvas" width="180" height="156" tabindex="0" aria-label="แผนที่ย่อ แตะเพื่อย้ายกล้อง ใช้ปุ่มลูกศรเพื่อเลื่อนมุมมอง"></canvas><small>ภาพใหม่ · เส้นทางและทรัพยากรเดิม</small><small>แตะเพื่อย้ายกล้อง · ไม่ใช่สั่งคนเดิน</small>';
  stage.append(panel);
  const saveButton=document.createElement('button');saveButton.id='save-indicator';saveButton.innerHTML='<span class="save-dot"></span><span id="save-label"></span>';saveButton.onclick=()=>api.menu();document.querySelector('.time-controls').prepend(saveButton);
  const canvas=$('map-canvas'),c=canvas.getContext('2d');let frame=safeFrame(stage.clientWidth,stage.clientHeight),pending=false,layoutKey='';
  function visible(el){return el&&!el.hidden&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0;}
  function bounds(el){const r=el.getBoundingClientRect(),s=stage.getBoundingClientRect();return {left:r.left-s.left,right:r.right-s.left,top:r.top-s.top,bottom:r.bottom-s.top};}
  function measure(){
    pending=false;const w=stage.clientWidth,h=stage.clientHeight,edges={};
    if(visible(document.querySelector('.world-top')))edges.top=bounds(document.querySelector('.world-top')).bottom+14;
    const toolbar=document.querySelector('.toolbar');if(visible(toolbar))edges.left=bounds(toolbar).right+16;
    const ins=$('inspector');if(visible(ins)){
      const r=bounds(ins);if(w<=700)edges.bottom=r.top-12;else edges.right=r.left-16;
    }
    for(const el of [document.querySelector('.chronicle-strip'),$('people-rail'),$('placement-panel')])if(visible(el)){
      edges.bottom=Math.min(edges.bottom??h,bounds(el).top-12);
    }
    stage.style.setProperty('--camera-top',(edges.top??12)+'px');
    frame=safeFrame(w,h,edges);
    const key=JSON.stringify(frame);if(key!==layoutKey){layoutKey=key;api.layoutChanged?.();}
    if(visible(camera)){const r=bounds(camera);panel.style.left=Math.min(w-202,Math.max(8,r.left))+'px';panel.style.bottom=Math.max(8,h-r.top+8)+'px';}
  }
  function requestMeasure(){if(!pending){pending=true;requestAnimationFrame(measure);}}
  const ro=new ResizeObserver(requestMeasure);for(const el of [stage,$('inspector'),document.querySelector('.world-top'),$('people-rail'),$('placement-panel'),camera])if(el)ro.observe(el);
  const mo=new MutationObserver(requestMeasure);for(const el of [$('inspector'),$('people-rail'),$('placement-panel')])if(el)mo.observe(el,{attributes:true,attributeFilter:['class','hidden']});
  addEventListener('resize',requestMeasure);
  function setOpen(open){panel.hidden=!open;button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'ปิดแผนที่ย่อ':'เปิดแผนที่ย่อ');document.body.classList.toggle('map-is-open',open);measure();if(open){draw();canvas.focus({preventScroll:true});}}
  button.onclick=()=>setOpen(panel.hidden);$('map-close').onclick=()=>{setOpen(false);button.focus();};
  canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect();api.center(mapCell(e.clientX-r.left,e.clientY-r.top,r.width,r.height));draw();});
  canvas.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);button.focus();return;}
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;
    e.preventDefault();const f=api.focus(),n=e.shiftKey?5:1;api.center({x:Math.max(0,Math.min(SIZE.w-1,f.x+delta[0]*n)),y:Math.max(0,Math.min(SIZE.h-1,f.y+delta[1]*n))});draw();
  });
  function draw(){
    if(panel.hidden)return;const s=api.read().state,sx=canvas.width/SIZE.w,sy=canvas.height/SIZE.h;
    c.clearRect(0,0,canvas.width,canvas.height);
    const view=api.mapView?.();
    for(let y=0;y<SIZE.h;y++)for(let x=0;x<SIZE.w;x++){c.fillStyle=view?.cells[y*SIZE.w+x]?.color??({grass:'#66834e',water:'#4b888a',path:'#bcab7e',bridge:'#dac192'})[s.tiles[y*SIZE.w+x]];c.fillRect(x*sx,y*sy,sx,sy);}
    for(const n of s.nodes)if(n.amount>0){c.fillStyle=n.type==='food'?'#e2af67':n.type==='wood'?'#284d35':'#aab5a3';c.fillRect((n.x+.25)*sx,(n.y+.25)*sy,sx*.5,sy*.5);}
    for(const b of s.buildings){c.fillStyle=b.complete?'#f4e4b3':'#dd9d69';c.fillRect(b.x*sx,b.y*sy,sx,sy);}
    for(const a of s.agents)if(a.alive){c.fillStyle=a.id===api.read().selected?'#ffffff':a.appearance.coat;c.beginPath();c.arc((a.x+.5)*sx,(a.y+.5)*sy,a.id===api.read().selected?3:2,0,Math.PI*2);c.fill();}
    c.strokeStyle='#ffe4a6';c.lineWidth=1.4;c.beginPath();
    for(const [i,p] of [[frame.left,frame.top],[frame.right,frame.top],[frame.right,frame.bottom],[frame.left,frame.bottom]].entries()){
      const v=api.worldPoint(p[0],p[1]);const x=(v.x+.5)*sx,y=(v.y+.5)*sy;if(i)c.lineTo(x,y);else c.moveTo(x,y);
    }c.closePath();c.stroke();
  }
  function update(){
    const info=api.storageStatus(),label=saveLabel(info);if($('save-label').textContent!==label)$('save-label').textContent=label;
    const note=document.querySelector('.menu-save-note strong');if(note&&note.textContent!==label)note.textContent=label;
    saveButton.dataset.state=info.kind;saveButton.title=label+' · บันทึกเฉพาะเบราว์เซอร์นี้ ไม่ใช่คลาวด์';
    const s=api.read();if((s.mode==='build'||document.body.classList.contains('sheet-expanded'))&&!panel.hidden)setOpen(false);
    requestMeasure();draw();
  }
  measure();update();return {update,frame:()=>({...frame}),anchor:()=>({x:(frame.left+frame.right)/2,y:(frame.top+frame.bottom)/2+14*api.zoom()})};
}
