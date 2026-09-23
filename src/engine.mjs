/** Simclone 0.1.0 — deterministic, DOM-free simulation. No external services. */
export const VERSION = '0.1.0';
export const SIZE = { w: 30, h: 26 };
export const DAY_TICKS = 360;
export const SKILLS = ['FORAGE', 'WOODCUT', 'MINE', 'BUILD'];
export const LABELS = { FORAGE:'หาอาหาร', WOODCUT:'ตัดไม้', MINE:'ขุดหิน', BUILD:'สร้างบ้าน', EAT:'กินอาหาร', REST:'พักผ่อน', EXPLORE:'สำรวจ', IDLE:'พักรอ' };
export const clamp = (n, lo=0, hi=100) => Math.max(lo, Math.min(hi, n));
export const level = xp => Math.min(10, 1 + Math.floor(Math.sqrt(xp / 20)));
const distance = (a,b) => Math.abs(a.x-b.x) + Math.abs(a.y-b.y);
const names = ['Original','Nira','Kira','Rin','Tao','Lume','Ari','Mira','Sol','Nova','Kai','Yuna'];
const palette = ['#dda35d','#71b6a0','#b791bc','#6e9fbf','#d77c69','#c5ba6b'];
function rng(s) { s.rng = (Math.imul(1664525,s.rng)+1013904223)>>>0; return s.rng/4294967296; }
function event(s,type,text,agentId=null) {
  const e={id:s.nextEvent++,tick:s.tick,type,text,agentId};
  s.events.push(e); if(s.events.length>120)s.events.shift();
  if(agentId){const a=s.agents.find(a=>a.id===agentId); if(a){a.memory.push({tick:s.tick,text});if(a.memory.length>8)a.memory.shift();}}
}
export function tileAt(s,x,y) { return s.tiles[y*SIZE.w+x]; }
export function walkable(s,x,y) { return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<SIZE.w&&y<SIZE.h&&tileAt(s,x,y)!=='water'; }
export function pathTo(s,a,b) {
  if(!walkable(s,b.x,b.y))return null;
  const key=(x,y)=>y*SIZE.w+x, start=key(a.x,a.y), goal=key(b.x,b.y);
  const parent=new Int32Array(SIZE.w*SIZE.h).fill(-1), queue=[start]; parent[start]=start;
  for(let i=0;i<queue.length;i++){
    const p=queue[i]; if(p===goal)break;
    const x=p%SIZE.w,y=Math.floor(p/SIZE.w);
    for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
      const nx=x+dx,ny=y+dy,k=key(nx,ny);
      if(walkable(s,nx,ny)&&parent[k]===-1){parent[k]=p;queue.push(k);}
    }
  }
  if(parent[goal]===-1)return null;
  const out=[];for(let p=goal;p!==start;p=parent[p])out.push({x:p%SIZE.w,y:Math.floor(p/SIZE.w)});
  return out.reverse();
}
function createAgent(s,parent,initial=false){
  const id=s.nextAgent++, k=id-1;
  const skills=Object.fromEntries(SKILLS.map(key=>[key,parent?Math.floor(parent.skills[key]*.35):60]));
  const a={id,name:names[k%names.length]+(k>=names.length?' '+id:''),parentId:parent?.id??null,generation:parent?parent.generation+1:0,
    x:9+k%4,y:11+Math.floor(k/4)%3,hp:100,satiety:85,energy:90,alive:true,
    appearance:{coat:palette[k%palette.length],skin:['#e5b38a','#c99064','#f1c9a6','#a97050'][k%4],hair:['#302a28','#5e3e2c','#d5ad6f','#312e3b'][k%4],style:k%3},
    preference:SKILLS[k%4],skills,source:parent?'Clone จาก '+parent.name:'ความรู้เริ่มต้นของ Original',
    memory:[],task:null,trace:[],moveTick:0,workDone:0,bornTick:s.tick};
  if(parent){a.x=parent.x;a.y=parent.y;}
  if(initial&&parent){a.x=9+k%4;a.y=10+Math.floor(k/4)*2;a.satiety=65+k*3;a.energy=72+k*3;}
  s.agents.push(a);event(s,'birth',parent?a.name+' ถูกสร้างจาก '+parent.name+' · รุ่น '+a.generation:'Original เข้าสู่โลกใหม่',id);
  return a;
}
export function createWorld(seed=230926){
  const s={version:VERSION,seed:seed>>>0,rng:seed>>>0,tick:0,nextAgent:1,nextEvent:1,nextBuilding:3,tiles:[],nodes:[],agents:[],events:[],
    stock:{food:28,wood:24,stone:12},buildings:[{id:1,type:'camp',x:11,y:12,complete:true,progress:30},{id:2,type:'shelter',x:8,y:9,complete:true,progress:30}],stats:{gathered:0,built:0,cloned:0}};
  let nid=1;
  for(let y=0;y<SIZE.h;y++)for(let x=0;x<SIZE.w;x++){
    const river=20+Math.round(Math.sin(y*.26)*2), wet=x>=river&&x<river+3;
    const bridge=wet&&(y===13||y===14);
    const road=(Math.abs(y-13)<1&&x>6&&x<27)||(Math.abs(x-11)<1&&y>7&&y<18);
    s.tiles.push(bridge?'bridge':wet?'water':road?'path':'grass');
    const r=rng(s),inCamp=x>=7&&x<=15&&y>=8&&y<=17;
    if(!wet&&!road&&!inCamp&&r<.23){
      const type=r<.14?'wood':r<.19?'food':'stone';
      s.nodes.push({id:nid++,type,x,y,amount:type==='stone'?70:35,max:type==='stone'?70:35});
    }
  }
  for(const [type,x,y] of [['food',6,12],['food',8,18],['wood',6,9],['wood',15,7],['stone',15,16]])
    s.nodes.push({id:nid++,type,x,y,amount:45,max:45});
  const original=createAgent(s,null);for(let i=0;i<5;i++)createAgent(s,original,true);
  return s;
}
export const living = s => s.agents.filter(a=>a.alive);
export const capacity = s => s.buildings.filter(b=>b.complete).length*6;
export const day = s => 1+Math.floor(s.tick/DAY_TICKS);
export const hour = s => (8+Math.floor(s.tick/15))%24;
export function command(s,type,data={}){
  if(type==='CLONE'){
    const parent=s.agents.find(a=>a.id===data.parentId&&a.alive);
    if(!parent)return {ok:false,message:'เลือก Clone ที่ยังมีชีวิตก่อน'};
    if(living(s).length>=Math.min(36,capacity(s)))return {ok:false,message:'ที่พักเต็มแล้ว สร้างบ้านให้เสร็จก่อน'};
    if(s.agents.length>=200)return {ok:false,message:'ถึงขีดจำกัดประวัติตัวละครของต้นแบบนี้แล้ว'};
    if(s.stock.food<8||s.stock.wood<4)return {ok:false,message:'ต้องมีอาหาร 8 และไม้ 4'};
    s.stock.food-=8;s.stock.wood-=4;s.stats.cloned++;
    const a=createAgent(s,parent);return {ok:true,message:'สร้าง '+a.name+' แล้ว · สืบทักษะ 35% จาก '+parent.name,agentId:a.id};
  }
  if(type==='BUILD'){
    const {x,y}=data;
    if(!walkable(s,x,y)||tileAt(s,x,y)!=='grass')return {ok:false,message:'วางบ้านบนพื้นหญ้าที่ว่างเท่านั้น'};
    if(s.buildings.some(b=>distance(b,{x,y})<2)||s.nodes.some(n=>n.x===x&&n.y===y))return {ok:false,message:'พื้นที่นี้มีสิ่งปลูกสร้างหรือทรัพยากรอยู่'};
    if(s.buildings.length>=12)return {ok:false,message:'ต้นแบบนี้รองรับสิ่งปลูกสร้าง 12 แห่ง'};
    if(s.stock.wood<12||s.stock.stone<6)return {ok:false,message:'ต้องมีไม้ 12 และหิน 6'};
    if(pathTo(s,s.buildings[0],{x,y})===null)return {ok:false,message:'ไม่มีเส้นทางจากหมู่บ้านถึงตำแหน่งนี้'};
    s.stock.wood-=12;s.stock.stone-=6;
    s.buildings.push({id:s.nextBuilding++,type:'shelter',x,y,complete:false,progress:0});
    event(s,'build','วางแปลนบ้านแล้ว · Clone จะเลือกมาช่วยสร้าง');return {ok:true,message:'วางแปลนแล้ว · วัสดุถูกกันไว้สำหรับงานนี้'};
  }
  return {ok:false,message:'ไม่รู้จักคำสั่งนี้'};
}
function candidates(s,a){
  const home=s.buildings[0],out=[];
  function add(kind,target,base,need=0,goal=0){
    const skill=SKILLS.includes(kind)?level(a.skills[kind])*3:0;
    const cost=Math.round(distance(a,target)*.7);
    out.push({kind,targetId:target.id??null,x:target.x,y:target.y,score:Math.round(base+need+goal+skill-cost),factors:{base,need:Math.round(need),goal,skill,distance:-cost}});
  }
  if(s.stock.food>0&&a.satiety<82)add('EAT',home,0,(100-a.satiety)*1.25+(a.satiety<25?90:0));
  if(a.energy<85)add('REST',home,0,(100-a.energy)*1.2+(a.energy<18?80:0));
  for(const [kind,type] of [['FORAGE','food'],['WOODCUT','wood'],['MINE','stone']]){
    if(s.stock[type]>=900)continue;
    const nodes=s.nodes.filter(n=>n.type===type&&n.amount>0).sort((x,y)=>distance(a,x)-distance(a,y)||x.id-y.id);
    if(nodes.length){const shortage=s.stock[type]<(type==='food'?living(s).length*3:24)?25:0;
      add(kind,nodes[0],25,shortage+(kind==='FORAGE'&&a.satiety<25&&s.stock.food===0?100:0),a.preference===kind?15:0);}
  }
  for(const b of s.buildings.filter(b=>!b.complete))add('BUILD',b,56,0,a.preference==='BUILD'?18:0);
  // Exploration target uses stable time/id arithmetic, never render randomness.
  const tx=5+(a.id*7+Math.floor(s.tick/40))%13,ty=5+(a.id*3+Math.floor(s.tick/60))%16;
  add('EXPLORE',{x:tx,y:ty},3);return out.sort((x,y)=>y.score-x.score||x.kind.localeCompare(y.kind));
}
function decide(s,a){
  const choices=candidates(s,a);a.trace=choices.map(c=>({...c,status:'candidate'}));
  for(let i=0;i<choices.length;i++){
    const c=choices[i],path=pathTo(s,a,c);
    if(path===null){a.trace[i].status='no-path';continue;}
    a.trace[i].status='selected';
    a.task={kind:c.kind,targetId:c.targetId,x:c.x,y:c.y,path,work:0,score:c.score,started:s.tick};return;
  }
  a.task={kind:'IDLE',path:[],work:0,started:s.tick};
}
function gain(s,a,key){
  if(!SKILLS.includes(key))return;
  const old=level(a.skills[key]);a.skills[key]+=5;a.workDone++;
  if(level(a.skills[key])>old)event(s,'skill',a.name+' พัฒนา '+LABELS[key]+' เป็นระดับ '+level(a.skills[key]),a.id);
}
function execute(s,a){
  const t=a.task;
  if(t.kind==='IDLE'){a.energy=clamp(a.energy+1);a.task=null;return;}
  if(t.kind==='EAT'&&s.stock.food<=0){a.task=null;return;}
  if(t.path.length){a.moveTick++;if(a.moveTick>=3){const p=t.path.shift();a.x=p.x;a.y=p.y;a.moveTick=0;}return;}
  t.work++;
  if(t.kind==='EAT'){
    if(t.work>=3){if(s.stock.food>0){s.stock.food--;a.satiety=clamp(a.satiety+48);}a.task=null;}
  }else if(t.kind==='REST'){
    a.energy=clamp(a.energy+2);if(a.satiety>30)a.hp=clamp(a.hp+.3);
    if(t.work>=26||a.energy>=99)a.task=null;
  }else if(t.kind==='BUILD'){
    const b=s.buildings.find(b=>b.id===t.targetId);
    if(!b||b.complete){a.task=null;return;}
    b.progress=Math.min(30,b.progress+.35+level(a.skills.BUILD)*.08);
    if(b.progress>=30){b.complete=true;s.stats.built++;gain(s,a,'BUILD');event(s,'build',a.name+' สร้างบ้านสำเร็จ · ที่พักเพิ่ม 6 คน',a.id);a.task=null;}
  }else if(SKILLS.includes(t.kind)){
    const n=s.nodes.find(n=>n.id===t.targetId);
    if(!n||n.amount<=0){a.task=null;return;}
    if(t.work>=Math.max(4,14-level(a.skills[t.kind]))){
      const amount=Math.min(n.amount,2+Math.floor(level(a.skills[t.kind])/2),999-s.stock[n.type]);
      n.amount-=amount;s.stock[n.type]+=amount;s.stats.gathered+=amount;gain(s,a,t.kind);a.task=null;
    }
  }else if(t.work>=6){a.task=null;}
}
export function step(s,count=1){
  if(!Number.isInteger(count)||count<0||count>100000)throw new Error('Invalid tick count');
  for(let i=0;i<count;i++){
    s.tick++;
    if(s.tick%120===0)for(const n of s.nodes)if(n.type==='food')n.amount=Math.min(n.max,n.amount+3);
    if(s.tick%720===0)for(const n of s.nodes)if(n.type==='wood')n.amount=Math.min(n.max,n.amount+1);
    for(const a of s.agents){
      if(!a.alive)continue;
      a.satiety=clamp(a.satiety-.11);a.energy=clamp(a.energy-.06);
      if(a.satiety===0)a.hp=clamp(a.hp-.28);
      if(a.hp===0){a.alive=false;a.task=null;event(s,'death',a.name+' เสียชีวิตจากการขาดอาหาร',a.id);continue;}
      if(a.task&&s.tick%12===0&&((a.satiety<18&&!['EAT','FORAGE'].includes(a.task.kind))||(a.energy<10&&a.task.kind!=='REST')))a.task=null;
      if(!a.task)decide(s,a);execute(s,a);
    }
    if(s.tick%DAY_TICKS===0)event(s,'day','เริ่มวันที่ '+day(s)+' · ประชากร '+living(s).length+' คน · อาหาร '+s.stock.food);
  }
  return s;
}
export function serialize(s){return JSON.stringify(s);}
export function validate(s){
  const errors=[];const bad=x=>errors.push(x),finite=n=>typeof n==='number'&&Number.isFinite(n);
  if(!s||s.version!==VERSION)return ['Unsupported save version'];
  if(!Number.isInteger(s.tick)||s.tick<0||!Number.isInteger(s.rng)||!Number.isInteger(s.seed))bad('Clock/seed');
  if(!Array.isArray(s.tiles)||s.tiles.length!==SIZE.w*SIZE.h||s.tiles.some(t=>!['grass','water','path','bridge'].includes(t)))return ['Terrain'];
  if(!s.stock||['food','wood','stone'].some(k=>!finite(s.stock[k])||s.stock[k]<0||s.stock[k]>999))bad('Inventory');
  if(!Array.isArray(s.agents)||s.agents.length<1||s.agents.length>200)return ['Agent count'];
  const ids=new Set();
  for(const a of s.agents){
    if(!Number.isInteger(a.id)||ids.has(a.id))bad('Agent ID');ids.add(a.id);
    if(!walkable(s,a.x,a.y))bad('Agent position');
    if(['hp','satiety','energy'].some(k=>!finite(a[k])||a[k]<0||a[k]>100))bad('Agent needs');
    if(typeof a.alive!=='boolean'||!Number.isInteger(a.generation)||a.generation<0||typeof a.name!=='string'||a.name.length>50)bad('Agent identity');
    if(!a.skills||SKILLS.some(k=>!finite(a.skills[k])||a.skills[k]<0))bad('Skills');
    if(!a.appearance||['coat','skin','hair'].some(k=>!/^#[a-fA-F0-9]{6}$/.test(a.appearance[k]))||![0,1,2].includes(a.appearance.style))bad('Appearance');
    if(!Array.isArray(a.memory)||a.memory.length>8||a.memory.some(m=>typeof m.text!=='string'||!finite(m.tick)))bad('Memory');
    if(!Array.isArray(a.trace)||a.trace.length>30||a.trace.some(t=>!LABELS[t.kind]||!finite(t.score)||!t.factors||Object.values(t.factors).some(v=>!finite(v))))bad('Trace');
    if(!finite(a.moveTick)||!finite(a.workDone)||!finite(a.bornTick)||typeof a.source!=='string'||!SKILLS.includes(a.preference))bad('Agent bookkeeping');
    if(a.task&&(!LABELS[a.task.kind]||!finite(a.task.work)||!Array.isArray(a.task.path)||a.task.path.length>SIZE.w*SIZE.h||a.task.path.some(p=>!walkable(s,p.x,p.y))))bad('Task');
  }
  if(s.agents.some(a=>a.parentId!==null&&!ids.has(a.parentId)))bad('Parent reference');
  if(!Array.isArray(s.nodes)||s.nodes.length>SIZE.w*SIZE.h||s.nodes.some(n=>!walkable(s,n.x,n.y)||!['food','wood','stone'].includes(n.type)||!finite(n.amount)||!finite(n.max)||n.amount<0||n.amount>n.max))bad('Resources');
  if(!Array.isArray(s.buildings)||s.buildings.length<1||s.buildings.length>12||s.buildings.some(b=>!walkable(s,b.x,b.y)||!['camp','shelter'].includes(b.type)||typeof b.complete!=='boolean'||!finite(b.progress)||b.progress<0||b.progress>30))bad('Buildings');
  if(!Array.isArray(s.events)||s.events.length>120||s.events.some(e=>typeof e.text!=='string'||!finite(e.tick)||!finite(e.id)))bad('Events');
  if(!s.stats||['gathered','built','cloned'].some(k=>!finite(s.stats[k])||s.stats[k]<0))bad('Stats');
  if(!Number.isInteger(s.nextAgent)||s.nextAgent<=Math.max(...ids)||!Number.isInteger(s.nextEvent)||!Number.isInteger(s.nextBuilding))bad('Counters');
  return errors;
}
export function restore(text){
  if(typeof text!=='string'||text.length>2000000)throw new Error('ไฟล์บันทึกมีขนาดใหญ่เกินไป');
  const s=JSON.parse(text),errors=validate(s);if(errors.length)throw new Error('บันทึกไม่ถูกต้อง: '+errors.join(', '));return s;
}
