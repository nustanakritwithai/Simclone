/** Observation UI 0.1.1. Read projections; all world mutations use the engine bridge. */
import {SKILLS,LABELS,level,day,living,capacity} from './engine.mjs';
export const UI_VERSION='0.1.1';
const $=id=>document.getElementById(id);
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
 eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3"/>',
 clone:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 10-4M18 13v8m-4-4h8"/>',
 home:'<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/>',
 history:'<path d="M5 3h14v18H5zM9 7h6M9 11h6M9 15h4"/>',
 focus:'<path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5"/><circle cx="12" cy="12" r="4"/>',
 leaf:'<path d="M5 20C-1 4 14 4 21 3c-1 12-5 18-13 14M4 21 15 10"/>',
 wood:'<path d="m7 3 10 6-1 11L6 14Z"/><path d="m7 3 10 6 5-3-10-5M17 9l5-3-1 11-5 3M9 9l5 3m-5 0 5 3"/>',
 stone:'<path d="m3 17 2-9 9-5 7 6-1 10-10 2Z"/><path d="m5 8 6 5 10-4M11 13l-1 8"/>',
 heart:'<path d="M12 21 3 12C-2 5 7 0 12 7c5-7 14-2 9 5Z"/>',
 bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 chevron:'<path d="m7 14 5-5 5 5"/>',
 search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v.1"/>',
 map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16"/>',
 brain:'<path d="M12 4c-5-4-9 1-7 4-4 2-3 7 0 7-1 5 5 7 7 3m0-14c5-4 9 1 7 4 4 2 3 7 0 7 1 5-5 7-7 3ZM12 4v14M5 8l3 2M19 8l-3 2M5 15l3-2M19 15l-3-2"/>'
};
export const icon=name=>`<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.eye}</svg>`;
const events={birth:'ชีวิตใหม่',skill:'พัฒนาทักษะ',build:'สิ่งปลูกสร้าง',death:'สูญเสีย',day:'วันใหม่'};
const roles={FORAGE:'หาอาหาร',WOODCUT:'ตัดไม้',MINE:'ขุดหิน',BUILD:'ก่อสร้าง'};
const tabNames={about:'ตอนนี้',skills:'ทักษะ',why:'เหตุผล',memory:'ความทรงจำ'};
function setText(id,value){const e=$(id);if(e&&e.textContent!==String(value))e.textContent=value;}
function replaceIfChanged(el,html){if(el.dataset.content!==html){const y=el.scrollTop;el.innerHTML=html;el.dataset.content=html;el.scrollTop=y;}}
export function installUX(api){
 let expanded=false,identityKey='',tabKey='',candidate=null,lastPreview='',placement=null,railKey='',rosterFilter='all',historyFilter='all';
 const inspector=$('inspector'),stage=$('stage'),body=$('dialog-body');
 document.body.classList.add('ux-v2');
 const staticIcons={observe:'eye',clone:'clone',build:'home',roster:'people',history:'history',recenter:'focus'};
 for(const [id,key] of Object.entries(staticIcons)){const button=$(id);const span=button.querySelector('span');if(span)span.innerHTML=icon(key);else button.innerHTML=icon(key);}
 const navIcons={world:'eye',people:'people',clone:'clone',build:'home',history:'history'};
 document.querySelectorAll('[data-nav]').forEach(b=>b.querySelector('span').innerHTML=icon(navIcons[b.dataset.nav]));
 document.querySelector('.version').innerHTML=`OBSERVATION UI <b>${UI_VERSION}</b>`;
 document.querySelector('.brand').title='Simclone · UI '+UI_VERSION;
 const resourceIcons=['leaf','wood','stone','people'];
 document.querySelectorAll('.resources>div').forEach((el,i)=>{el.querySelector('span').innerHTML=icon(resourceIcons[i]);});
 const rail=document.createElement('section');rail.id='people-rail';rail.className='people-rail';rail.setAttribute('aria-label','เลือกตัวละครอย่างรวดเร็ว');
 rail.innerHTML='<div class="rail-heading"><span>ผู้คนในโลกนี้</span><button id="all-people">ดูทั้งหมด →</button></div><div id="people-chips"></div>';stage.append(rail);
 const buildPanel=document.createElement('section');buildPanel.id='placement-panel';buildPanel.className='placement-panel';buildPanel.hidden=true;
 buildPanel.innerHTML=`<div class="placement-heading">${icon('home')}<div><b>บ้านพักใหม่</b><small>เพิ่มที่พัก 6 คนเมื่อสร้างเสร็จ</small></div><button id="cancel-placement" class="iconbtn" aria-label="ยกเลิกวางบ้าน">${icon('close')}</button></div><div class="placement-cost">${icon('wood')} ไม้ 12 <span>+</span> ${icon('stone')} หิน 6</div><p id="placement-status" role="status">แตะพื้นหญ้าเพื่อดูตำแหน่งก่อนสร้าง</p><div class="placement-actions"><button id="choose-position" class="secondary">ระบุช่อง</button><button id="confirm-placement" class="primary" disabled>ยืนยันตำแหน่ง</button></div>`;stage.append(buildPanel);
 const help=document.createElement('button');help.id='quick-help';help.className='quick-help';help.innerHTML=`${icon('help')}<span>เริ่มเล่นอย่างไร</span>`;help.onclick=openGuide;stage.append(help);
 $('all-people').onclick=()=>openRoster();$('cancel-placement').onclick=()=>api.observe();
 $('choose-position').onclick=()=>{
  api.openDialog('เลือกตำแหน่งบ้าน','BUILD · GRID',`<p>ระบุช่องบนแผนที่เพื่อดูตัวอย่างก่อนยืนยัน ยังไม่ใช้ทรัพยากรในขั้นนี้</p><div class="grid-input"><label>X <input id="grid-x" type="number" min="0" max="29" value="${candidate?.x??14}"></label><label>Y <input id="grid-y" type="number" min="0" max="25" value="${candidate?.y??11}"></label></div><button id="preview-grid" class="primary">ดูตำแหน่งนี้</button>`);
  $('preview-grid').onclick=()=>{const x=Number($('grid-x').value),y=Number($('grid-y').value);if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>29||y>25){api.toast('กรอก X 0–29 และ Y 0–25 เป็นจำนวนเต็ม');return;}api.closeDialog();choosePlacement({x,y});api.center({x,y});};
 };
 $('confirm-placement').onclick=()=>{
  if(!candidate)return;
  const result=api.execute('BUILD',candidate); // Authoritative validation happens again here.
  api.toast(result.message);
  if(result.ok){candidate=null;placement=null;api.observe();api.save();}else{lastPreview='';refreshPlacement();}
 };
 rail.addEventListener('click',e=>{const b=e.target.closest('[data-quick-person]');if(b)api.select(Number(b.dataset.quickPerson),true);});
 inspector.addEventListener('click',e=>{
  const b=e.target.closest('[data-ux]');if(!b)return;
  if(b.dataset.ux==='expand'){expanded=!expanded;renderInspector();}
  if(b.dataset.ux==='why'){expanded=true;api.setTab('why');}
  if(b.dataset.ux==='clone')openClone();
 });
 inspector.addEventListener('keydown',e=>{
  if(e.target.getAttribute('role')!=='tab'||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();const tabs=[...inspector.querySelectorAll('[role=tab]')],i=tabs.indexOf(e.target);
  const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  api.setTab(tabs[next].dataset.tab);inspector.querySelectorAll('[role=tab]')[next].focus();
 });
 body.addEventListener('input',e=>{if(e.target.id==='people-search')renderRosterList();if(e.target.id==='story-search')renderHistoryList();});
 body.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.rosterFilter){rosterFilter=b.dataset.rosterFilter;renderRosterList();}
  if(b.dataset.historyFilter){historyFilter=b.dataset.historyFilter;renderHistoryList();}
  if(b.dataset.ux==='choose-parent')openRoster();
 });
 $('dialog').addEventListener('close',renderHUD);
 function choosePlacement(p){candidate={...p};lastPreview='';refreshPlacement();api.setGhost(candidate);}
 function refreshPlacement(){
  if(!candidate){placement=null;setText('placement-status','แตะพื้นหญ้าเพื่อดูตำแหน่งก่อนสร้าง');$('confirm-placement').disabled=true;return;}
  const s=api.read().state,key=JSON.stringify([candidate,s.stock,s.buildings.length]);
  if(key!==lastPreview){placement=api.preview('BUILD',candidate);lastPreview=key;}
  buildPanel.classList.toggle('invalid',!placement.ok);
  setText('placement-status',placement.ok?`ช่อง ${candidate.x}, ${candidate.y} · วางได้ ยังไม่ใช้ทรัพยากร`:placement.message);
  $('confirm-placement').disabled=!placement.ok;
 }
 function renderInspector(){
  const {state:s,selected,tab,follow}=api.read(),a=s.agents.find(a=>a.id===selected);
  inspector.hidden=!a;document.body.classList.toggle('has-selection',!!a);
  if(!a){identityKey='';expanded=false;document.body.classList.remove('sheet-expanded');return;}
  const key=JSON.stringify([a.id,a.name,a.appearance,a.parentId,a.generation]);
  if(key!==identityKey){
   expanded=false;identityKey=key;tabKey='';
   inspector.innerHTML=`<div class="sheet-handle" aria-hidden="true"></div><div class="inspect-head"><span class="eyebrow">A LIFE OF THEIR OWN</span><button data-ui="close" class="iconbtn" aria-label="ปิดข้อมูลตัวละคร">${icon('close')}</button></div><div class="identity">${api.portrait(a)}<div class="identity-text"><h2>${escape(a.name)} <sup>#${a.id}</sup></h2><p>${a.generation===0?'Original · คนแรก':'Clone · รุ่น '+a.generation} <span id="life-label"></span></p><span class="role-tag">${escape(roles[a.preference])}</span></div><button class="sheet-expand iconbtn" data-ux="expand" aria-controls="inspector-detail" aria-expanded="false" aria-label="ขยายข้อมูลตัวละคร">${icon('chevron')}</button></div><div class="needs">${[['satiety','ความอิ่ม','leaf'],['energy','พลังงาน','bolt'],['hp','สุขภาพ','heart']].map(([k,label,ic])=>`<div class="need-${k}"><div class="need-label"><span>${icon(ic)}${label}</span><b id="need-number-${k}"></b></div><div class="meter" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" id="need-meter-${k}"><i></i></div></div>`).join('')}</div><div class="action-ribbon"><span class="activity-dot"></span><span id="ux-current-action"></span><button data-ux="why" class="why-shortcut">ทำไม? →</button></div><div id="inspector-detail"><div class="tabs" role="tablist" aria-label="ข้อมูลตัวละคร">${Object.entries(tabNames).map(([id,text])=>`<button id="tab-${id}" role="tab" aria-controls="ux-tab-content" data-ui="tab-${id}" data-tab="${id}">${text}</button>`).join('')}</div><div id="ux-tab-content" role="tabpanel"></div><div class="inspect-actions"><button data-ui="follow" class="secondary follow">${icon('focus')}<span id="follow-label"></span></button><button data-ux="clone" class="primary">${icon('clone')} โคลน</button></div></div>`;
  }
  if(tabKey!==tab&&tab!=='about')expanded=true;tabKey=tab;
  inspector.classList.toggle('is-expanded',expanded);
  const toggle=inspector.querySelector('.sheet-expand');toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-label',expanded?'ย่อข้อมูลตัวละคร':'ขยายข้อมูลตัวละคร');
  document.body.classList.toggle('sheet-expanded',expanded);
  setText('life-label',a.alive?'':'· เสียชีวิต');setText('ux-current-action',api.actionText(a));
  setText('follow-label',follow?'หยุดติดตาม':'ติดตาม');
  inspector.querySelector('[data-ux="clone"]').disabled=!a.alive;
  for(const k of ['satiety','energy','hp']){setText('need-number-'+k,Math.round(a[k]));const el=$('need-meter-'+k);el.setAttribute('aria-valuenow',String(Math.round(a[k])));el.querySelector('i').style.width=a[k]+'%';el.classList.toggle('low',a[k]<25);}
  for(const b of inspector.querySelectorAll('[role=tab]')){const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}
  const panel=$('ux-tab-content');panel.setAttribute('aria-labelledby','tab-'+tab);let html='';
  if(tab==='skills')html=SKILLS.map(k=>`<div class="skill-row"><b>${roles[k]}</b><span>Lv.${level(a.skills[k])} <small>${a.skills[k]} XP</small></span></div>`).join('')+`<p class="source-note">ที่มา: ${escape(a.source)}<br>นี่คือทักษะส่วนบุคคล ยังไม่มีระบบครูหรือคลังความรู้ในรุ่นนี้</p>`;
  else if(tab==='memory')html=a.memory.slice().reverse().map(m=>`<div class="memory-item"><small>วันที่ ${1+Math.floor(m.tick/360)}</small>${escape(m.text)}</div>`).join('')||'<p class="empty-state">ยังไม่มีความทรงจำสำคัญ</p>';
  else if(tab==='why'){
   const chosen=a.trace.find(t=>t.status==='selected'),max=Math.max(1,...a.trace.map(t=>t.score));
   if(chosen){html=`<div class="decision-callout">${icon('brain')}<div><small>เหตุผลจากการตัดสินใจล่าสุด</small><b>เลือก${LABELS[chosen.kind]} · ${chosen.score} คะแนน</b><p>เปรียบเทียบความต้องการ ความถนัด ทักษะ และระยะทางของงานที่เสนอเข้ามา ไม่ได้สุ่มงาน</p></div></div>`;}
   html+=a.trace.slice(0,6).map(c=>`<div class="trace-row ${c.status==='selected'?'selected':''}"><span>${c.status==='selected'?'✓ ':''}${LABELS[c.kind]}${c.status==='no-path'?' · ไปไม่ถึง':''}</span><b>${c.score}</b><div class="scorebar"><i style="width:${Math.max(0,c.score/max*100)}%"></i></div></div>`).join('');
   if(chosen){const f=chosen.factors;html+=`<details class="score-details"><summary>ดูส่วนประกอบคะแนน</summary><dl>${[['พื้นฐาน',f.base],['ความต้องการ',f.need],['ความถนัด',f.goal],['ทักษะ',f.skill],['ระยะทาง',f.distance]].map(([k,v])=>`<div><dt>${k}</dt><dd>${v>0?'+':''}${v}</dd></div>`).join('')}</dl></details><p class="source-note">${a.task?'เลือกเมื่อ tick '+a.task.started:'งานล่าสุดสิ้นสุดแล้ว'} · คะแนนนี้มาจากกฎ CPU ไม่ใช่ข้อความคิดจาก LLM</p>`;}
   if(!a.trace.length)html='<p class="empty-state">รอโลกเดิน tick แรกเพื่อดูคะแนนจริง</p>';
  }else{
   const parent=s.agents.find(p=>p.id===a.parentId);
   html=`<div class="life-summary"><div><small>ต้นแบบ</small><b>${escape(parent?.name??'คนแรกของโลก')}</b></div><div><small>งานที่ได้ XP</small><b>${a.workDone} ครั้ง</b></div></div><p class="source-note">${a.task?.path.length?'กำลังเดิน เหลือ '+a.task.path.length+' ช่องก่อนถึงเป้าหมาย':'ตัวละครเลือกงานตามสถานการณ์ของตัวเอง'}<br>เปิด “เหตุผล” เพื่อดูงานที่พิจารณาและคะแนนจริง</p>`;
  }
  if(panel.dataset.content!==html){const oldOpen=panel.querySelector('details')?.open,scroll=inspector.scrollTop;replaceIfChanged(panel,html);if(oldOpen&&panel.querySelector('details'))panel.querySelector('details').open=true;inspector.scrollTop=scroll;}
 }
 function renderHUD(){
  const {state:s,selected,mode,paused}=api.read(),agents=living(s);
  const key=agents.map(a=>a.id+':'+a.name+':'+a.alive).join('|');
  if(key!==railKey){railKey=key;const scroller=$('people-chips'),x=scroller.scrollLeft;
   scroller.innerHTML=agents.map(a=>`<button data-quick-person="${a.id}" class="person-chip" aria-label="เลือก ${escape(a.name)} รุ่น ${a.generation}">${api.portrait(a)}<span>${escape(a.name)}</span></button>`).join('');scroller.scrollLeft=x;
  }
  for(const b of rail.querySelectorAll('[data-quick-person]')){const active=Number(b.dataset.quickPerson)===selected;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));}
  const building=mode==='build';buildPanel.hidden=!building;rail.hidden=building;document.body.classList.toggle('is-building',building);
  if(!building){candidate=null;placement=null;lastPreview='';}else refreshPlacement();
  $('quick-help').hidden=building||selected!==null;
  $('pause').setAttribute('aria-pressed',String(paused));$('observe').setAttribute('aria-pressed',String(!building));$('build').setAttribute('aria-pressed',String(building));
  const h=$('world-status');h.textContent=$('dialog').open?'หยุดเวลา · กำลังดูข้อมูล':paused?'หยุดเวลา · กด ▶ เพื่อเดินต่อ':'โลกกำลังดำเนินไปด้วยตัวเอง';
  document.body.classList.toggle('is-paused',paused||$('dialog').open);
  const modal=$('dialog').open,kind=$('dialog').dataset.kind;
  for(const b of document.querySelectorAll('[data-nav]')){const active=b.dataset.nav===(modal&&kind==='people'?'people':modal&&kind==='history'?'history':building?'build':'world');b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');}
 }
 function openRoster(){rosterFilter='all';api.openDialog('ทุกคนเริ่มเหมือนกัน แต่ไม่เหมือนเดิม','PEOPLE · '+living(api.read().state).length+' คน',`<div class="search-control">${icon('search')}<label class="sr-only" for="people-search">ค้นหาชื่อ</label><input id="people-search" type="search" placeholder="ค้นหาชื่อ เช่น Kira" autocomplete="off"></div><div class="filter-tabs">${[['all','ทั้งหมด'],['hungry','ความอิ่มต่ำ'],['children','รุ่น 2 ขึ้นไป']].map(([id,t])=>`<button data-roster-filter="${id}">${t}</button>`).join('')}</div><p id="roster-count" class="list-count"></p><div id="roster-list"></div>`);$('dialog').dataset.kind='people';renderRosterList();renderHUD();}
 function renderRosterList(){if(!$('roster-list'))return;const q=$('people-search').value.toLocaleLowerCase(),s=api.read().state;
  const agents=s.agents.filter(a=>a.name.toLocaleLowerCase().includes(q)&&(rosterFilter!=='hungry'||a.alive&&a.satiety<25)&&(rosterFilter!=='children'||a.generation>=2));
  setText('roster-count',`${agents.length} คน · ข้อมูลขณะหยุดเวลา${rosterFilter==='hungry'?' · ความอิ่มต่ำกว่า 25':''}`);
  document.querySelectorAll('[data-roster-filter]').forEach(b=>{const on=b.dataset.rosterFilter===rosterFilter;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  $('roster-list').innerHTML=agents.length?agents.map(a=>`<button class="person-row" data-person="${a.id}">${api.portrait(a)}<div><b>${escape(a.name)}</b><small>รุ่น ${a.generation} · ${escape(api.actionText(a))}</small><span class="roster-skill">${roles[a.preference]} · Lv.${level(a.skills[a.preference])}</span></div><span class="roster-health">${a.alive?Math.round(a.satiety)+'%':'—'}<small>${a.alive?'อิ่ม':'เสียชีวิต'}</small></span></button>`).join(''):'<p class="empty-state">ไม่มีตัวละครตรงกับตัวกรองนี้</p>';
 }
 function openHistory(){historyFilter='all';api.openDialog('เรื่องเล่าที่เกิดขึ้นจริง','WORLD CHRONICLE',`<p class="history-limit">เหตุการณ์ล่าสุด ไม่ใช่ระบบย้อนเวลา · แตะชื่อเรื่องเพื่อไปหาตัวละคร</p><div class="search-control">${icon('search')}<label class="sr-only" for="story-search">ค้นหาเหตุการณ์</label><input id="story-search" type="search" placeholder="ค้นหาชื่อหรือเหตุการณ์"></div><div class="filter-tabs">${[['all','ทั้งหมด'],['birth','ชีวิตใหม่'],['skill','ทักษะ'],['build','บ้าน']].map(([id,t])=>`<button data-history-filter="${id}">${t}</button>`).join('')}</div><p id="history-count" class="list-count"></p><div id="history-list"></div>`);$('dialog').dataset.kind='history';renderHistoryList();renderHUD();}
 function renderHistoryList(){if(!$('history-list'))return;const s=api.read().state,q=$('story-search').value.toLocaleLowerCase(),list=s.events.filter(e=>(historyFilter==='all'||e.type===historyFilter)&&e.text.toLocaleLowerCase().includes(q));
  setText('history-count',`${list.length} เหตุการณ์ · เก็บล่าสุดไม่เกิน 120 รายการ`);
  document.querySelectorAll('[data-history-filter]').forEach(b=>{const on=b.dataset.historyFilter===historyFilter;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  $('history-list').innerHTML=list.slice().reverse().map(e=>`<button class="history-event" data-story="${e.id}"><small>วันที่ ${1+Math.floor(e.tick/360)} · ${events[e.type]||escape(e.type)}</small><p>${escape(e.text)}</p><span>${e.agentId?'ไปหาตัวละคร →':'เหตุการณ์ระดับโลก'}</span></button>`).join('')||'<p class="empty-state">ยังไม่มีเหตุการณ์ประเภทนี้</p>';
 }
 function openClone(){
  const s=api.read().state,parent=s.agents.find(a=>a.id===api.read().selected&&a.alive)||living(s)[0];
  if(!parent){api.toast('ยังไม่มีต้นแบบที่มีชีวิตอยู่');return;}
  api.select(parent.id,false);const p=api.preview('CLONE',{parentId:parent.id});
  api.openDialog('ส่งต่อสิ่งที่เรียนรู้','CREATE A CLONE',`<div class="clone-lineage"><div>${api.portrait(parent)}<b>${escape(parent.name)}</b><small>ต้นแบบ · รุ่น ${parent.generation}</small></div><span>→</span><div class="new-life">${icon('clone')}<b>ชีวิตใหม่</b><small>รุ่น ${parent.generation+1}</small></div></div><button class="text-link" data-ux="choose-parent">เลือกต้นแบบคนอื่น →</button><p>ใช้ <b>อาหาร 8 + ไม้ 4</b> · ที่พัก ${living(s).length} / ${capacity(s)} คน<br>รับ 35% ของ XP แต่ละทักษะ แล้วเลือกงานและเรียนรู้ต่อเอง</p><div class="clone-skills">${SKILLS.map(k=>`<div><span>${roles[k]}</span><b>${parent.skills[k]} <small>→</small> ${p.agent?p.agent.skills[k]:'—'} XP</b></div>`).join('')}</div><p class="clone-validity ${p.ok?'':'error'}" role="status">${p.ok?'พร้อมสร้าง · จะแสดงตัวละครใหม่หลังยืนยัน':escape(p.message)}</p><div class="dialog-actions"><button class="primary" data-action="confirm-clone" ${p.ok?'':'disabled'}>ยืนยันสร้าง Clone</button><button class="secondary" data-action="cancel">ยกเลิก</button></div><p class="source-note">รุ่นนี้โคลนด้วยคำสั่งผู้เล่น ยังไม่มีการเกิดหรือเติบโตอัตโนมัติ</p>`);$('dialog').dataset.kind='clone';
 }
 function openGuide(){api.openDialog('เริ่มจากการรู้จักคนหนึ่งคน','OBSERVE → UNDERSTAND → INFLUENCE',`<div class="guide-step"><span>01</span><div><b>แตะหน้า เลือกคน</b><p>ใช้แถวตัวละครด้านล่าง หรือแตะคนในโลก การ์ดย่อจะบอกว่ากำลังทำอะไร โดยไม่บังแผนที่</p></div></div><div class="guide-step"><span>02</span><div><b>ถามว่า “ทำไม?”</b><p>ดูคะแนนงานจริง หรือเปิดทักษะเพื่อดูสิ่งที่เขาเรียนรู้มาต่างจากคนอื่น</p></div></div><div class="guide-step"><span>03</span><div><b>สร้างเงื่อนไขให้ชีวิตใหม่</b><p>เลือกต้นแบบก่อนโคลน หรือเลือกจุดวางบ้าน ตรวจตัวอย่าง แล้วค่อยยืนยันหักวัสดุ</p></div></div><div class="help-block">ลากแผนที่เพื่อเลื่อน · จีบนิ้วหรือกด + / − เพื่อซูม<br>หน้าต่างนี้หยุดเวลา · ปิดเว็บแล้วโลกหยุด ไม่มีการเดินเวลาขณะออฟไลน์</div><div class="dialog-actions"><button class="primary" data-action="cancel">เริ่มสังเกตโลก</button></div>`);$('dialog').dataset.kind='guide';}
 return {renderInspector,renderHUD,openRoster,openHistory,openClone,choosePlacement,getPlacement:()=>candidate?{...candidate,ok:placement?.ok===true}:null};
}
