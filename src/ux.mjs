import {BIRTH_RULES} from './reproduction.mjs?v=0.5.0';
/** Observation UI 0.2.0. Read projections; all world mutations use the engine bridge. */
import {VERSION,SKILLS,LABELS,level,day,living,capacity,survivalSummary,ageYears,lifeStage,lifespanYears,allPeople,findPerson,retainedCount,HISTORY_LIMITS} from './engine.mjs?v=0.5.0';
import {professionLabel} from './kingdom-utility.mjs?v=0.5.0';
import {createResourceEcologyShadow,shadowExistingResourcePressure} from './worldsim-resource-shadow.mjs?v=0.5.0';
import {createResourceRegenerationShadow} from './worldsim-resource-regen-shadow.mjs?v=0.5.0';
import {createFoodRegenerationImpact} from './worldsim-food-regen-impact.mjs?v=0.5.0';
import {compareShadowRouting} from './worldsim-routing-shadow.mjs?v=0.5.0';
export const UI_VERSION='0.5.0';
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
const events={birth:'ชีวิตใหม่',skill:'พัฒนาทักษะ',knowledge:'ถ่ายทอดความรู้',build:'สิ่งปลูกสร้าง',career:'เปลี่ยนอาชีพ',death:'สูญเสีย',day:'วันใหม่'};
const roles={FORAGE:'หาอาหาร',WOODCUT:'ตัดไม้',MINE:'ขุดหิน',BUILD:'ก่อสร้าง'};
const blockedLabels={reserved:'มีคนจองงานแล้ว',satisfied:'สำรองและงานที่จองถึงเป้าแล้ว','no-path':'ไม่มีทางเดิน',stage:'ช่วงวัยนี้ทำงานนี้ไม่ได้'};
const stageLabels={CHILD:'เด็ก',ADULT:'ผู้ใหญ่',ELDER:'ผู้สูงวัย',DEAD:'เสียชีวิต'};
const birthLabels={'history-capacity':'จำนวนประวัติถึงขีดจำกัด','history-storage':'พื้นที่คลังประวัติเต็ม','history-invalid':'ประวัติต้องตรวจสอบ','history-hot':'ชุดข้อมูลทำงานเต็ม',ready:'พร้อมเมื่อถึงรอบปี',housing:'ที่พักเต็ม',history:'ประวัติตัวละครเต็ม',pace:'รอครบระยะห่างการเกิด',parent:'ยังไม่มีผู้ใหญ่ที่พร้อม',food:'อาหารสำรองยังไม่พอ',wood:'ไม้สำรองยังไม่พอ'};
const tabNames={about:'ตอนนี้',skills:'ทักษะ',why:'เหตุผล',knowledge:'ความรู้',memory:'ความทรงจำ'};
function setText(id,value){const e=$(id);if(e&&e.textContent!==String(value))e.textContent=value;}
function replaceIfChanged(el,html){if(el.dataset.content!==html){const y=el.scrollTop;el.innerHTML=html;el.dataset.content=html;el.scrollTop=y;}}
export function installUX(api){
 let expanded=false,identityKey='',tabKey='',candidate=null,lastPreview='',placement=null,railKey='',rosterFilter='all',historyFilter='all',rosterLimit=80,routeShadowKey='',routeShadow=null;
 const inspector=$('inspector'),stage=$('stage'),body=$('dialog-body');
 document.body.classList.add('ux-v2');
 const staticIcons={observe:'eye',clone:'clone',build:'home',roster:'people',history:'history',recenter:'focus'};
 for(const [id,key] of Object.entries(staticIcons)){const button=$(id);const span=button.querySelector('span');if(span)span.innerHTML=icon(key);else button.innerHTML=icon(key);}
 const navIcons={world:'eye',people:'people',clone:'clone',build:'home',history:'history'};
 document.querySelectorAll('[data-nav]').forEach(b=>b.querySelector('span').innerHTML=icon(navIcons[b.dataset.nav]));
 document.querySelector('.version').innerHTML=`KNOWLEDGE + MEMORY <b>${VERSION}</b>`;
 document.querySelector('.brand').title='Simclone · UI '+UI_VERSION;
 const foodCard=$('food').parentElement;
 foodCard.setAttribute('role','button');foodCard.tabIndex=0;
 foodCard.setAttribute('aria-label','ดูภาพรวมอาหารและงานที่จองไว้');
 foodCard.style.cursor='pointer';foodCard.onclick=openSurvival;
 foodCard.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openSurvival();}};
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
  if(b.dataset.ux==='share-knowledge'){
    const result=api.execute('SHARE_KNOWLEDGE',{fromId:api.read().selected,key:b.dataset.key});
    api.toast(result.message);if(result.ok)api.save();
  }
 });
 inspector.addEventListener('keydown',e=>{
  if(e.target.getAttribute('role')!=='tab'||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();const tabs=[...inspector.querySelectorAll('[role=tab]')],i=tabs.indexOf(e.target);
  const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  api.setTab(tabs[next].dataset.tab);inspector.querySelectorAll('[role=tab]')[next].focus();
 });
 body.addEventListener('input',e=>{if(e.target.id==='people-search'){rosterLimit=80;renderRosterList();}if(e.target.id==='story-search')renderHistoryList();});
 body.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.rosterFilter){rosterFilter=b.dataset.rosterFilter;rosterLimit=80;renderRosterList();}
  if(b.dataset.ux==='more-people'){rosterLimit+=80;renderRosterList();}
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
  const {state:s,selected,tab,follow}=api.read(),a=findPerson(s,selected);
  inspector.hidden=!a;document.body.classList.toggle('has-selection',!!a);
  if(!a){identityKey='';expanded=false;document.body.classList.remove('sheet-expanded');return;}
  const key=JSON.stringify([a.id,a.name,a.appearance,a.parentId,a.generation,a.profession]);
  if(key!==identityKey){
   expanded=false;identityKey=key;tabKey='';
   inspector.innerHTML=`<div class="sheet-handle" aria-hidden="true"></div><div class="inspect-head"><span class="eyebrow">A LIFE OF THEIR OWN</span><button data-ui="close" class="iconbtn" aria-label="ปิดข้อมูลตัวละคร">${icon('close')}</button></div><div class="identity">${api.portrait(a)}<div class="identity-text"><h2>${escape(a.name)} <sup>#${a.id}</sup></h2><p>${a.generation===0?'Original · คนแรก':'Clone · รุ่น '+a.generation} <span id="life-label"></span></p><span class="role-tag">${escape(a.profession?professionLabel(a.profession):roles[a.preference])}</span></div><button class="sheet-expand iconbtn" data-ux="expand" aria-controls="inspector-detail" aria-expanded="false" aria-label="ขยายข้อมูลตัวละคร">${icon('chevron')}</button></div><div class="needs">${[['satiety','ความอิ่ม','leaf'],['energy','พลังงาน','bolt'],['hp','สุขภาพ','heart']].map(([k,label,ic])=>`<div class="need-${k}"><div class="need-label"><span>${icon(ic)}${label}</span><b id="need-number-${k}"></b></div><div class="meter" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" id="need-meter-${k}"><i></i></div></div>`).join('')}</div><div class="action-ribbon"><span class="activity-dot"></span><span id="ux-current-action"></span><button data-ux="why" class="why-shortcut">ทำไม? →</button></div><div id="inspector-detail"><div class="tabs" role="tablist" aria-label="ข้อมูลตัวละคร">${Object.entries(tabNames).map(([id,text])=>`<button id="tab-${id}" role="tab" aria-controls="ux-tab-content" data-ui="tab-${id}" data-tab="${id}">${text}</button>`).join('')}</div><div id="ux-tab-content" role="tabpanel"></div><div class="inspect-actions"><button data-ui="follow" class="secondary follow">${icon('focus')}<span id="follow-label"></span></button><button data-ux="clone" class="primary">${icon('clone')} โคลน</button></div></div>`;
  }
  if(tabKey!==tab&&tab!=='about')expanded=true;tabKey=tab;
  inspector.classList.toggle('is-expanded',expanded);
  const toggle=inspector.querySelector('.sheet-expand');toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-label',expanded?'ย่อข้อมูลตัวละคร':'ขยายข้อมูลตัวละคร');
  document.body.classList.toggle('sheet-expanded',expanded);
  const stage=lifeStage(s,a),age=ageYears(s,a),lifespan=lifespanYears(s,a);
  const cause=a.death?.cause==='age'?'เสียชีวิตตามวัย':a.death?.cause==='starvation'?'ขาดอาหาร':'สาเหตุไม่ทราบ';
  const deathAge=age===null?'อายุไม่ทราบ':`อายุ ${age} ปี`;
  const deathTick=Number.isInteger(a.death?.tick)?` · tick ${a.death.tick}`:'';
  setText('life-label',a.alive?`· ${stageLabels[stage]??stage} · อายุ ${age??'—'} ปี · อายุขัย ${lifespan??'—'} ปี`:`· เสียชีวิต · ${deathAge} · ${cause}${deathTick}`);setText('ux-current-action',api.actionText(a));
  setText('follow-label',follow?'หยุดติดตาม':'ติดตาม');
  inspector.querySelector('[data-ux="clone"]').disabled=!a.alive;
  inspector.querySelector('[data-ui="follow"]').disabled=!a.alive;
  inspector.querySelector('.needs').title=a.alive?'ความต้องการปัจจุบัน':'ค่าครั้งสุดท้ายที่บันทึก ไม่ใช่ชีวิตที่กำลังดำเนินต่อ';
  for(const k of ['satiety','energy','hp']){setText('need-number-'+k,Math.round(a[k]));const el=$('need-meter-'+k);el.setAttribute('aria-valuenow',String(Math.round(a[k])));el.querySelector('i').style.width=a[k]+'%';el.classList.toggle('low',a[k]<25);}
  for(const b of inspector.querySelectorAll('[role=tab]')){const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}
  const panel=$('ux-tab-content');panel.setAttribute('aria-labelledby','tab-'+tab);let html='';
  if(tab==='skills')html=SKILLS.map(k=>{const p=a.skillProvenance?.bySkill?.[k],parts=[];
   if(p?.initialXP)parts.push('ตั้งต้น '+p.initialXP);if(p?.inheritedXP)parts.push('สืบทอด '+p.inheritedXP);if(p?.earnedXP)parts.push('ทำงาน '+p.earnedXP);if(p?.legacyUnattributedXP)parts.push('เดิมไม่ทราบที่มา '+p.legacyUnattributedXP);
   const evidence=(p?.evidence??[]).slice(-2).reverse().map(e=>e.kind==='inheritance'?'สืบทอดจาก '+escape(findPerson(s,e.sourceAgentId)?.name??('#'+e.sourceAgentId))+' · tick '+e.tick:e.kind==='work'?'งาน '+escape(roles[e.action]??e.action)+' · +'+e.xp+' XP · tick '+e.tick:'ทักษะตั้งต้น · +'+e.xp+' XP · tick '+e.tick).join('<br>');
   return `<div class="skill-row"><b>${roles[k]}</b><span>Lv.${level(a.skills[k])} <small>${a.skills[k]} XP</small></span></div><p class="source-note">${parts.join(' · ')||'ไม่มี XP'}${evidence?'<br>'+evidence:''}</p>`;}).join('')+`<p class="source-note">XP สืบทอดคือ inheritance ไม่ใช่การสอน · XP จากงานเกิดหลังผลลัพธ์จริงเท่านั้น · ข้อมูลเซฟเก่าที่พิสูจน์ที่มาไม่ได้จะแสดงว่าเดิมไม่ทราบที่มา</p>`;
  else if(tab==='knowledge'){
   const statusText={CONFIRMED:'ยืนยันจากประสบการณ์ตรง',UNVERIFIED:'ยังไม่ยืนยัน',STALE:'ข้อมูลเก่า',REFUTED:'ถูกหักล้าง'};
   const typeText={food:'อาหาร',wood:'ไม้',stone:'หิน'},beliefs=a.knowledgeState?.beliefs??[];
   html=beliefs.map(b=>{const source=b.sourceKind==='direct'?'ประสบการณ์ตรง':'ได้รับจาก '+escape(findPerson(s,b.sourceAgentId)?.name??('#'+b.sourceAgentId));
    const share=a.alive&&b.status==='CONFIRMED'?'<button class="secondary" data-ux="share-knowledge" data-key="'+escape(b.key)+'">แชร์ให้คนใกล้สุด</button>':'';
    return `<div class="memory-item"><small>${escape(statusText[b.status]??b.status)} · ${source}</small><b>${escape(typeText[b.value.type]??b.value.type)} #${b.value.resourceId}</b><br>ตำแหน่ง ${b.value.x}, ${b.value.y}<br><span class="source-note">origin: ${escape(b.originEvidenceId)}</span>${share}</div>`;}).join('')||
    '<p class="empty-state">ยังไม่มีความรู้จากประสบการณ์จริง · Clone ต้องพบผลลัพธ์จากงานก่อน</p>';
   html+='<p class="source-note">ความจริงของโลกไม่ถูกแจกให้ทุกคนอัตโนมัติ · ข้อมูลที่คนอื่นเล่าจะเริ่มเป็น “ยังไม่ยืนยัน”</p>';
  }
  else if(tab==='memory')html=(a.knowledgeState?.episodes??[]).slice().reverse().map(e=>`<div class="memory-item"><small>tick ${e.tick} · ${e.kind==='discovery'?'ประสบการณ์':'รับข้อมูล'}</small>${escape(e.event)}<br><span class="source-note">${escape(e.perceivedOutcome)}</span></div>`).join('')||
    a.memory.slice().reverse().map(m=>`<div class="memory-item"><small>วันที่ ${1+Math.floor(m.tick/360)}</small>${escape(m.text)}</div>`).join('')||
    '<p class="empty-state">ยังไม่มีความทรงจำสำคัญ</p>';
  else if(tab==='why'){
   const chosen=a.trace.find(t=>t.status==='selected'),max=Math.max(1,...a.trace.map(t=>t.score));
   if(chosen){html=`<div class="decision-callout">${icon('brain')}<div><small>เหตุผลจากการตัดสินใจล่าสุด</small><b>เลือก${LABELS[chosen.kind]} · ${chosen.score} คะแนน</b><p>Planner หลักยังเปรียบเทียบความต้องการ ความถนัด ทักษะ และระยะเดินจริง ส่วน K1 คำนวณ scarcity + อาชีพแบบ Kingdom เป็น shadow score เพื่อพิสูจน์ก่อนให้มีอำนาจเลือกงาน</p></div></div>`;}
   html+=(chosen?[chosen,...a.trace.filter(t=>t!==chosen).slice(0,5)]:a.trace.slice(0,6)).map(c=>`<div class="trace-row ${c.status==='selected'?'selected':''}"><span>${c.status==='selected'?'✓ ':''}${LABELS[c.kind]}${blockedLabels[c.status]?' · '+blockedLabels[c.status]:''}</span><b>${c.score}</b><div class="scorebar"><i style="width:${Math.max(0,c.score/max*100)}%"></i></div></div>`).join('');
   if(chosen){
    const f=chosen.factors,k=chosen.kingdomUtility;
    const routeKey=JSON.stringify([a.id,a.x,a.y,a.task?.x,a.task?.y,a.task?.path]);
    if(routeKey!==routeShadowKey){routeShadowKey=routeKey;routeShadow=a.task?compareShadowRouting(s,{x:a.x,y:a.y},{x:a.task.x,y:a.task.y},a.task.path):null;}
    const worldShadow=routeShadow?.weighted?`<details class="score-details"><summary>WorldSim WM2.2 · shadow route</summary><dl><div><dt>เส้นทางปัจจุบัน</dt><dd>${routeShadow.current?.cost??'—'}</dd></div><div><dt>weighted candidate</dt><dd>${routeShadow.weighted.cost}</dd></div><div><dt>candidate steps</dt><dd>${routeShadow.weighted.steps}</dd></div><div><dt>shadow savings</dt><dd>${routeShadow.savings??'—'}</dd></div></dl><p class="source-note">ค่านี้ใช้สังเกตเท่านั้น · ยังไม่เปลี่ยน task, score, path หรือ movement จริง</p></details>`:'';
    html+=`<details class="score-details"><summary>ดูส่วนประกอบคะแนน</summary><dl>${[['พื้นฐาน',f.base],['ความต้องการ',f.need],['ความถนัด',f.goal],['ทักษะ',f.skill],['ระยะเดินจริง',f.distance]].map(([key,v])=>`<div><dt>${key}</dt><dd>${v>0?'+':''}${v}</dd></div>`).join('')}</dl></details>${k?`<details class="score-details"><summary>Kingdom K1 · shadow utility</summary><dl>${[['scarcity',k.scarcity],['อาชีพเดิม',k.profession],['deterministic jitter',k.utilityJitter]].map(([key,v])=>`<div><dt>${key}</dt><dd>${v>0?'+':''}${v}</dd></div>`).join('')}</dl></details>`:''}${worldShadow}<p class="source-note">ระยะเดินตอนเลือก ${chosen.travelSteps??'—'} ช่อง · ${a.task?'เลือกเมื่อ tick '+a.task.started:'งานล่าสุดสิ้นสุดแล้ว'} · planner หลักยังเป็น authority; Kingdom K1 และ WorldSim weighted route ยังเป็น shadow evidence</p>`;
   }
   if(!a.trace.length)html=a.archived?'<p class="empty-state">คลังประวัติเก็บตัวตน ทักษะ และความทรงจำ แต่ไม่เก็บคะแนนตัดสินใจชั่วคราว</p>':'<p class="empty-state">รอโลกเดิน tick แรกเพื่อดูคะแนนจริง</p>';
  }else{
   const parent=findPerson(s,a.parentId);
   html=`<div class="life-summary"><div><small>ต้นแบบ</small><b>${escape(parent?.name??(a.parentId===null?'คนแรกของโลก':'ไม่พบประวัติต้นแบบ'))}</b></div><div><small>งานที่ได้ XP</small><b>${a.workDone} ครั้ง</b></div></div><p class="source-note">${a.archived?'เก็บอยู่ในคลังประวัติ · ตัวตนและสายตระกูลยังอยู่':a.task?.path.length?'กำลังเดิน เหลือ '+a.task.path.length+' ช่องก่อนถึงเป้าหมาย':'ตัวละครเลือกงานตามสถานการณ์ของตัวเอง'}<br>เปิด “เหตุผล” เพื่อดูงานที่พิจารณาและคะแนนจริง</p>`;
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
 function openRoster(){rosterFilter='all';rosterLimit=80;api.openDialog('ทุกคนเริ่มเหมือนกัน แต่ไม่เหมือนเดิม','PEOPLE · '+living(api.read().state).length+' คน',`<div class="search-control">${icon('search')}<label class="sr-only" for="people-search">ค้นหาชื่อ</label><input id="people-search" type="search" placeholder="ค้นหาชื่อ เช่น Kira" autocomplete="off"></div><div class="filter-tabs">${[['all','ทั้งหมด'],['hungry','ความอิ่มต่ำ'],['children','รุ่น 2 ขึ้นไป'],['archived','คลังประวัติ']].map(([id,t])=>`<button data-roster-filter="${id}">${t}</button>`).join('')}</div><p id="roster-count" class="list-count"></p><div id="roster-list"></div>`);$('dialog').dataset.kind='people';renderRosterList();renderHUD();}
 function renderRosterList(){if(!$('roster-list'))return;const q=$('people-search').value.toLocaleLowerCase(),s=api.read().state;
  const agents=allPeople(s).filter(a=>a.name.toLocaleLowerCase().includes(q)&&(rosterFilter!=='hungry'||a.alive&&a.satiety<25)&&(rosterFilter!=='children'||a.generation>=2)&&(rosterFilter!=='archived'||a.archived===true));
  setText('roster-count',`${agents.length} คน${agents.length>rosterLimit?' · แสดง '+rosterLimit+' คนแรก':''} · ข้อมูลขณะหยุดเวลา${rosterFilter==='hungry'?' · ความอิ่มต่ำกว่า 25':''}`);
  document.querySelectorAll('[data-roster-filter]').forEach(b=>{const on=b.dataset.rosterFilter===rosterFilter;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  $('roster-list').innerHTML=agents.length?agents.slice(0,rosterLimit).map(a=>`<button class="person-row" data-person="${a.id}">${api.portrait(a)}<div><b>${escape(a.name)}</b><small>รุ่น ${a.generation} · ${escape(api.actionText(a))}</small><span class="roster-skill">${roles[a.preference]} · Lv.${level(a.skills[a.preference])}</span></div><span class="roster-health">${a.alive?Math.round(a.satiety)+'%':'—'}<small>${a.alive?'อิ่ม':'เสียชีวิต'}</small></span></button>`).join(''):'<p class="empty-state">ไม่มีตัวละครตรงกับตัวกรองนี้</p>';
  if(agents.length>rosterLimit)$('roster-list').insertAdjacentHTML('beforeend','<button class="secondary" data-ux="more-people">แสดงเพิ่มอีก 80 คน</button>');
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
  api.openDialog('ส่งต่อสิ่งที่เรียนรู้','CREATE A CLONE',`<div class="clone-lineage"><div>${api.portrait(parent)}<b>${escape(parent.name)}</b><small>ต้นแบบ · รุ่น ${parent.generation}</small></div><span>→</span><div class="new-life">${icon('clone')}<b>ชีวิตใหม่</b><small>รุ่น ${parent.generation+1}</small></div></div><button class="text-link" data-ux="choose-parent">เลือกต้นแบบคนอื่น →</button><p>ใช้ <b>อาหาร 8 + ไม้ 4</b> · ที่พัก ${living(s).length} / ${capacity(s)} คน<br>รับ 35% ของ XP แต่ละทักษะ แล้วเลือกงานและเรียนรู้ต่อเอง</p><div class="clone-skills">${SKILLS.map(k=>`<div><span>${roles[k]}</span><b>${parent.skills[k]} <small>→</small> ${p.agent?p.agent.skills[k]:'—'} XP</b></div>`).join('')}</div><p class="clone-validity ${p.ok?'':'error'}" role="status">${p.ok?'พร้อมสร้าง · จะแสดงตัวละครใหม่หลังยืนยัน':escape(p.message)}</p><div class="dialog-actions"><button class="primary" data-action="confirm-clone" ${p.ok?'':'disabled'}>ยืนยันสร้าง Clone</button><button class="secondary" data-action="cancel">ยกเลิก</button></div><p class="source-note">คำสั่งนี้สร้าง Clone วัยผู้ใหญ่อายุ 18 ปีทันที · การเกิดอัตโนมัติเป็นอีกระบบหนึ่ง เด็กเริ่มอายุ 0 ปีแล้วค่อยเติบโต</p>`);$('dialog').dataset.kind='clone';
 }
 function openSurvival(){
  const s=api.read().state,v=survivalSummary(s),eco=createResourceEcologyShadow(s),pressure=shadowExistingResourcePressure(s,eco),hydro={summary:eco.hydrologySummary},regen=createResourceRegenerationShadow(s,eco),foodImpact=createFoodRegenerationImpact(s,regen);
  const topPressure=pressure.rows.slice().sort((a,b)=>b.regenerationPressure-a.regenerationPressure||a.id-b.id)[0]??null;
  const topFood=eco.hotspots.food[0]??null,topWood=eco.hotspots.wood[0]??null,topStone=eco.hotspots.stone[0]??null;
  const dominantSoil=Object.entries(eco.soilCounts??{}).filter(([type])=>type!=='none').sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]??null;
  api.openDialog('หมู่บ้านอยู่รอดอย่างไร','SURVIVAL CORE · '+VERSION,
   `<div class="life-summary"><div><small>อาหารที่ใช้ได้ตอนนี้</small><b>${v.freeFood} หน่วย</b></div><div><small>จองไว้ให้คนกิน</small><b>${v.reservedMeals} หน่วย</b></div></div>
    <p>มีอาหารทั้งหมด ${v.food} หน่วย · เป้าสำรอง ${v.targets.food} หน่วย<br>คนความอิ่มต่ำกว่า 35: ${v.hungry} คน · พลังงานต่ำกว่า 12: ${v.exhausted} คน</p>
    <div class="clone-skills"><div><span>แหล่งทรัพยากรที่มีคนจอง</span><b>${v.nodeJobs} จุด</b></div><div><span>คนที่จองงานก่อสร้าง</span><b>${v.builders} คน</b></div><div><span>บ้านที่กำลังสร้าง</span><b>${v.unfinished} หลัง</b></div><div><span>ไม้ / เป้าสำรอง</span><b>${v.stock.wood} / ${v.targets.wood}</b></div><div><span>หิน / เป้าสำรอง</span><b>${v.stock.stone} / ${v.targets.stone}</b></div></div>
    <p class="source-note">แหล่งทรัพยากรรับคนทำงานครั้งละ 1 คน · บ้านรับคนสร้างได้ 2 คนพร้อมกัน<br>เลือกแหล่งที่ไปถึงได้ตามระยะเดินจริง ไม่วัดแค่ความใกล้บนจอ<br>เมื่อหิว คนเก็บอาหารกินผลผลิต 1 หน่วยที่จุดเก็บได้ ส่วนที่เหลือเข้าคลังรวม<br>คิดเป้าสำรองรวมผลผลิตของงานที่มีคนจองแล้ว งานชุดสุดท้ายอาจทำให้เกินเป้าได้เล็กน้อย</p>
    <div class="life-summary"><div><small>Kingdom K2 · แรงกดดันสูงสุด</small><b>${escape(v.kingdomEconomy.topPressure?.profession??'—')} ×${v.kingdomEconomy.topPressure?.premium??1}</b></div><div><small>ความหลากหลายอาชีพ</small><b>${v.kingdomEconomy.specialization.diversity} / 4</b></div></div>
    <div class="clone-skills"><div><span>Demand อาหาร</span><b>${v.kingdomEconomy.demand.food} · scarcity ×${v.kingdomEconomy.scarcity.food}</b></div><div><span>Demand ไม้</span><b>${v.kingdomEconomy.demand.wood} · scarcity ×${v.kingdomEconomy.scarcity.wood}</b></div><div><span>Demand หิน</span><b>${v.kingdomEconomy.demand.stone} · scarcity ×${v.kingdomEconomy.scarcity.stone}</b></div><div><span>แรงงาน หาอาหาร / ไม้ / หิน / สร้าง</span><b>${v.kingdomEconomy.specialization.counts.forager} / ${v.kingdomEconomy.specialization.counts.woodcutter} / ${v.kingdomEconomy.specialization.counts.miner} / ${v.kingdomEconomy.specialization.counts.builder}</b></div></div>
    <p class="source-note">Kingdom K2 ยังเป็น shadow economy: ใช้สูตร demand + scarcity + labor premium เพื่อสังเกตแรงกดดันของชุมชน แต่ยังไม่สร้างราคา เงิน ค่าแรง การค้า หรือบังคับเปลี่ยนงาน จึงไม่เปลี่ยน authority ของ Survival Core</p>
    <div class="life-summary"><div><small>Kingdom K3 · effective workers</small><b>${v.kingdomProduction.effectiveWorkerUnits}</b></div><div><small>งานที่แรงกดดันสูงสุด</small><b>${escape(v.kingdomProduction.recommendedRole?.label??'สมดุล')} ${v.kingdomProduction.recommendedRole?`(${v.kingdomProduction.recommendedRole.workers}/${v.kingdomProduction.recommendedRole.ideal})`:''}</b></div></div>
    <div class="clone-skills">${Object.values(v.kingdomProduction.roles).map(r=>`<div><span>${escape(r.label)} · ${r.workers}/${r.ideal} คน</span><b>eff ×${r.averageEfficiency} · crowd ×${r.crowding}</b></div>`).join('')}</div>
    <p class="source-note">Kingdom K3 เป็น shadow production เช่นกัน: คำนวณ skill × hunger × crowding × age work-rate ตามแนว WorkSystem ของ Kingdom เพื่อดู productivity ที่คาดหมาย แต่ output จริง, XP, stock และ task completion ยังใช้กฎ Simclone เดิมทั้งหมด · tool multiplier ยังล็อกที่ ×1 จนระบบ possession/tool เชื่อมเข้ามา</p>
    <div class="life-summary"><div><small>Kingdom K4 · labor offers</small><b>${v.kingdomLabor.activeCount} ข้อเสนอ</b></div><div><small>ข้อเสนอเร่งด่วนสุด</small><b>${escape(v.kingdomLabor.topOffer?.label??'ไม่มี')} ${v.kingdomLabor.topOffer?`×${v.kingdomLabor.topOffer.premium}`:''}</b></div></div>
    ${v.kingdomLabor.offers.length?`<div class="clone-skills">${v.kingdomLabor.offers.map(o=>`<div><span>${escape(o.label)} · ขาด ${o.gap} คน</span><b>${o.urgency} · priority ${o.priority}</b></div>`).join('')}</div>`:'<p class="empty-state">K4 ยังไม่พบ shortage ที่ถึงเกณฑ์เปิดข้อเสนอแรงงาน</p>'}
    <p class="source-note">K4 ยืมแนว LaborMarketSystem: shortage เกิน 1.2 + กำลังคนต่ำกว่า ideal → เสนอแรงงานสูงสุด 3 คนต่อ role แต่ตอนนี้เป็น proposal เท่านั้น ไม่มีการเปลี่ยนอาชีพ ย้ายคน จ่ายค่าแรง หรือสร้าง recruitment record จริง</p>
    <div class="life-summary"><div><small>Kingdom K6 · ของแพงสุด</small><b>${escape(v.kingdomMarket.hottestGood??'—')} ×${v.kingdomMarket.hottestIndex}</b></div><div><small>โหมดตลาด</small><b>shadow only</b></div></div>
    <div class="clone-skills"><div><span>อาหาร · base 10</span><b>${v.kingdomMarket.prices.food}</b></div><div><span>ไม้ · base 8</span><b>${v.kingdomMarket.prices.wood}</b></div><div><span>หิน · base 15</span><b>${v.kingdomMarket.prices.stone}</b></div></div>
    <p class="source-note">K6 ใช้เส้นราคา Kingdom: base × scarcity^0.75 และ cap 0.3×–6× แต่ค่านี้เป็นดัชนีเงาเท่านั้น ยังไม่มีเงิน คลังเงิน ภาษี การซื้อขาย หรือพ่อค้า</p>
    <div class="life-summary"><div><small>WorldSim WM3.0 · ecology shadow</small><b>read-only</b></div><div><small>regen pressure สูงสุด</small><b>${topPressure?escape(topPressure.type)+' #'+topPressure.id+' · '+topPressure.regenerationPressure:'—'}</b></div></div>
    <div class="clone-skills"><div><span>Food hotspot</span><b>${topFood?topFood.x+', '+topFood.y+' · '+topFood.suitability:'—'}</b></div><div><span>Wood hotspot</span><b>${topWood?topWood.x+', '+topWood.y+' · '+topWood.suitability:'—'}</b></div><div><span>Stone hotspot</span><b>${topStone?topStone.x+', '+topStone.y+' · '+topStone.suitability:'—'}</b></div><div><span>Resource authority</span><b>K6 เดิม</b></div></div>
    <p class="source-note">WM3.0 ใช้ terrain + elevation + moisture และตอนนี้รับ soil evidence จาก WM3.1 เพื่อคำนวณ suitability / regeneration pressure แบบ shadow เท่านั้น · ไม่เพิ่ม node, ไม่เติม stock และไม่เปลี่ยน regeneration จริง</p>
    <div class="life-summary"><div><small>WorldSim WM3.1 · soil health</small><b>${eco.soilSummary.averageHealth}</b></div><div><small>ดินเด่น</small><b>${dominantSoil?escape(dominantSoil[0])+' · '+dominantSoil[1]+' ช่อง':'—'}</b></div></div>
    <div class="clone-skills"><div><span>Fertility เฉลี่ย</span><b>${eco.soilSummary.averageFertility}</b></div><div><span>Nutrient proxy</span><b>${eco.soilSummary.averageNutrient}</b></div><div><span>Organic matter</span><b>${eco.soilSummary.averageOrganicMatter}</b></div><div><span>Compaction</span><b>${eco.soilSummary.averageCompaction}</b></div></div>
    <p class="source-note">WM3.1 จำแนก none/coastal/sand/loam/clay/peat/rocky/wetland ตาม terrain + elevation + moisture และรับ temperature comfort จาก WM3.2 แบบ deterministic · ยังไม่มี Soil scheduler, N/P/K reservoir, water ownership หรือ save state ใหม่</p>
    <div class="life-summary"><div><small>WorldSim WM3.2 · climate shadow</small><b>${escape(eco.climateSummary.dominantWeather)}</b></div><div><small>อุณหภูมิเฉลี่ย</small><b>${eco.climateSummary.averageTemperatureC}°C</b></div></div>
    <div class="clone-skills"><div><span>Humidity</span><b>${eco.climateSummary.averageHumidity}</b></div><div><span>Cloud cover</span><b>${eco.climateSummary.averageCloudCover}</b></div><div><span>Rain potential</span><b>${eco.climateSummary.averageRainPotential}</b></div><div><span>Drought pressure</span><b>${eco.climateSummary.averageDroughtPressure}</b></div></div>
    <p class="source-note">WM3.2 ใช้ Simclone tick เป็น shadow cycle เท่านั้น · ไม่มี world-clock authority, atmospheric/cloud water reservoir, rainfall mutation หรือ Climate scheduler</p>
    <div class="life-summary"><div><small>WorldSim WM3.3 · hydrology shadow</small><b>read-only</b></div><div><small>Flood-risk cells</small><b>${hydro.summary.floodRiskCells}</b></div></div>
    <div class="clone-skills"><div><span>Water availability</span><b>${hydro.summary.averageWaterAvailability}</b></div><div><span>Infiltration</span><b>${hydro.summary.averageInfiltrationPotential}</b></div><div><span>Runoff</span><b>${hydro.summary.averageRunoffPotential}</b></div><div><span>Groundwater recharge</span><b>${hydro.summary.averageGroundwaterRechargePotential}</b></div><div><span>Evaporation</span><b>${hydro.summary.averageEvaporationPotential}</b></div><div><span>Soil-water comfort</span><b>${hydro.summary.averageSoilWaterComfort}</b></div></div>
    <p class="source-note">WM3.3 เป็น evidence เท่านั้น: ไม่มี surface/soil/groundwater reservoir, ไม่มี scheduler และไม่มี conservation ledger เพราะยังไม่มีน้ำจริงให้บัญชี · resource authority ยังอยู่ K6</p>
    <div class="life-summary"><div><small>WorldSim WM3.4 · vegetation shadow</small><b>read-only</b></div><div><small>Stressed cells</small><b>${eco.vegetationSummary.stressedCells}</b></div></div>
    <div class="clone-skills"><div><span>Living biomass</span><b>${eco.vegetationSummary.averageLivingBiomassPotential}</b></div><div><span>Food yield</span><b>${eco.vegetationSummary.averageFoodYieldPotential}</b></div><div><span>Wood yield</span><b>${eco.vegetationSummary.averageWoodYieldPotential}</b></div><div><span>Regeneration</span><b>${eco.vegetationSummary.averageRegenerationPotential}</b></div><div><span>Disturbance</span><b>${eco.vegetationSummary.averageDisturbanceStress}</b></div><div><span>Carrying capacity</span><b>${eco.vegetationSummary.averageCarryingCapacity}</b></div></div>
    <p class="source-note">WM3.4 ใช้ Climate + Soil + Hydrology เพื่อประเมิน biomass/yield/regeneration แบบ shadow เท่านั้น · ไม่มี living/dead/litter biomass store, plant nutrient store, growth scheduler หรือ resource mutation จริง</p>
    <div class="life-summary"><div><small>WorldSim WM4.2 · food ecology impact</small><b>shadow only</b></div><div><small>Ecology potential เฉลี่ย</small><b>${foodImpact.summary.averageEcologyPotential}</b></div></div>
    <div class="clone-skills"><div><span>Very low</span><b>${foodImpact.summary.bands['very-low']} nodes</b></div><div><span>Low</span><b>${foodImpact.summary.bands.low} nodes</b></div><div><span>Medium</span><b>${foodImpact.summary.bands.medium} nodes</b></div><div><span>High</span><b>${foodImpact.summary.bands.high} nodes</b></div><div><span>p10 / p50 / p90</span><b>${foodImpact.summary.p10} / ${foodImpact.summary.p50} / ${foodImpact.summary.p90}</b></div><div><span>Depleted / low-ecology depleted</span><b>${foodImpact.summary.depletedNodes} / ${foodImpact.summary.lowPotentialDepletedNodes}</b></div><div><span>Legacy boundary units / low-ecology</span><b>${foodImpact.summary.projectedLegacyBoundaryUnits} / ${foodImpact.summary.projectedLowEcologyBoundaryUnits}</b></div><div><span>Current writer</span><b>WorldSim WM4.1</b></div><div><span>Legacy food regen</span><b>+3 / 120 ticks</b></div><div><span>Candidate unit formula</span><b>none</b></div></div>
    <p class="source-note">WM4.2 วัด distribution ของ ecology regeneration potential เทียบกับ food contract เดิมเท่านั้น · writer อยู่ที่ WorldSim WM4.1 แล้ว แต่ยังไม่แปลง ecology เป็นจำนวนหน่วย, ไม่เปลี่ยน node.amount และไม่เปลี่ยน cadence</p>
    <div class="clone-skills"><div><span>เกิดเองแล้ว</span><b>${v.autonomousBirths} คน</b></div><div><span>สถานะการเกิดอัตโนมัติ</span><b>${birthLabels[v.birth.reason]??v.birth.reason}</b></div></div>
    <div class="clone-skills"><div><span>ตัวตนที่ยังเก็บประวัติไว้</span><b>${retainedCount(s)} / ${HISTORY_LIMITS.maxRetained}</b></div><div><span>ย้ายเข้าคลังประวัติแล้ว</span><b>${s.archive.length} คน</b></div></div>
    <p class="source-note">คลังประวัติยังค้นต้นแบบและทักษะของคนตายได้ เมื่อจำนวนหรือพื้นที่ประวัติเต็ม ระบบหยุดเพิ่มคนโดยไม่ลบบรรพบุรุษ ไม่ใช่โลกที่เก็บประวัติได้ไม่จำกัด</p>
    <p class="source-note">เงื่อนไขเกิดเอง: ที่พักต้องว่าง · ต้องมีผู้ใหญ่พร้อม · อาหารว่างต้องพอจ่าย 8 แล้วยังเหลือถึงเป้ารุ่นถัดไป · ไม้จ่าย 4 แล้วยังเหลืออย่างน้อย 12 · เว้นการเกิดอย่างน้อย ${BIRTH_RULES.globalIntervalYears} ปีจำลอง และ parent คนเดิมพัก ${BIRTH_RULES.parentCooldownYears} ปี<br>ช่วงวัยทำงานแล้ว: เด็กไม่รับงานผลิต · ผู้ใหญ่เต็มกำลัง · ผู้สูงวัยทำงานผลิตที่ 75% · อายุขัย derive 78–92 ปีและเสียชีวิตตามวัยแบบ deterministic</p>`);
  $('dialog').dataset.kind='survival';
 }
 function openGuide(){api.openDialog('เริ่มจากการรู้จักคนหนึ่งคน','OBSERVE → UNDERSTAND → INFLUENCE',`<div class="guide-step"><span>01</span><div><b>แตะหน้า เลือกคน</b><p>ใช้แถวตัวละครด้านล่าง หรือแตะคนในโลก การ์ดย่อจะบอกว่ากำลังทำอะไร โดยไม่บังแผนที่</p></div></div><div class="guide-step"><span>02</span><div><b>ถามว่า “ทำไม?”</b><p>ดูคะแนนงานจริง หรือเปิดทักษะเพื่อดูสิ่งที่เขาเรียนรู้มาต่างจากคนอื่น</p></div></div><div class="guide-step"><span>03</span><div><b>สร้างเงื่อนไขให้ชีวิตใหม่</b><p>เลือกต้นแบบก่อนโคลน หรือเลือกจุดวางบ้าน ตรวจตัวอย่าง แล้วค่อยยืนยันหักวัสดุ</p></div></div><div class="help-block">ลากแผนที่เพื่อเลื่อน · จีบนิ้วหรือกด + / − เพื่อซูม<br>หน้าต่างนี้หยุดเวลา · ปิดเว็บแล้วโลกหยุด ไม่มีการเดินเวลาขณะออฟไลน์</div><div class="dialog-actions"><button class="primary" data-action="cancel">เริ่มสังเกตโลก</button></div>`);$('dialog').dataset.kind='guide';}
 return {renderInspector,renderHUD,openRoster,openHistory,openClone,openSurvival,choosePlacement,getPlacement:()=>candidate?{...candidate,ok:placement?.ok===true}:null};
}
