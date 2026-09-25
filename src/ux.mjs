import {CULTURE_RULES} from './cultural-archive.mjs?v=0.5.0';
import {BIRTH_RULES} from './reproduction.mjs?v=0.5.0';
/** Observation UI 0.2.0. Read projections; all world mutations use the engine bridge. */
import {VERSION,SKILLS,LABELS,level,day,living,capacity,survivalSummary,ageYears,lifeStage,lifespanYears,allPeople,findPerson,retainedCount,HISTORY_LIMITS} from './engine.mjs?v=0.5.0';
import {professionLabel} from './kingdom-utility.mjs?v=0.5.0';
import {createResourceEcologyShadow,shadowExistingResourcePressure} from './worldsim-resource-shadow.mjs?v=0.5.0';
import {createResourceRegenerationShadow} from './worldsim-resource-regen-shadow.mjs?v=0.5.0';
import {createFoodRegenerationImpact} from './worldsim-food-regen-impact.mjs?v=0.5.0';
import {createFoodEcologyCalibration} from './worldsim-food-regen-calibration.mjs?v=0.5.0';
import {compareShadowRouting} from './worldsim-routing-shadow.mjs?v=0.5.0';
import {ITEM_CATALOG,RECIPE_CATALOG} from './crafting-catalog.mjs?v=0.5.0';
import {evaluateModularHouses} from './housing.mjs?v=0.5.0';
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
 hammer:'<path d="M14 4 20 10M11 7l6 6M5 21l8-8M3 19l2 2M10 4l3-2 9 9-2 3-3-3-7 7-4-4 7-7Z"/>',
 brain:'<path d="M12 4c-5-4-9 1-7 4-4 2-3 7 0 7-1 5 5 7 7 3m0-14c5-4 9 1 7 4 4 2 3 7 0 7 1 5-5 7-7 3ZM12 4v14M5 8l3 2M19 8l-3 2M5 15l3-2M19 15l-3-2"/>'
};
export const icon=name=>`<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.eye}</svg>`;
const events={birth:'ชีวิตใหม่',skill:'พัฒนาทักษะ',knowledge:'ถ่ายทอดความรู้',mentor:'Mentor',build:'สิ่งปลูกสร้าง',craft:'คราฟต์/แปรรูป',career:'เปลี่ยนอาชีพ',death:'สูญเสีย',day:'วันใหม่'};
const roles={FORAGE:'หาอาหาร',WOODCUT:'ตัดไม้',MINE:'ขุดหิน',BUILD:'ก่อสร้าง'};
const rustStationLabels={HAND:'ทำด้วยมือ',CRAFTING_TABLE_LV1:'โต๊ะคราฟต์ Lv1',FURNACE:'เตาหลอม'};
function rustCatalog(s){
 const items=s.rustPossessions?.items??[],stations=s.rustStations?.stations??[];
 return '<details class="score-details" open><summary>ไอเทม Rust ที่ใช้งานได้ตอนนี้ · '+Object.keys(ITEM_CATALOG).length+' ชนิด</summary>'+
 Object.values(RECIPE_CATALOG).map(r=>{const item=ITEM_CATALOG[r.output],placed=item.stationProvided?stations.filter(st=>st.kind===item.stationProvided).length:0,owned=items.filter(i=>i.kind===item.id).length+placed,cost=Object.entries(r.materials).map(([k,n])=>(k==='wood'?'ไม้':'หิน')+' '+n).join(' + ');return '<div class="memory-item" data-rust-catalog-item="'+escape(item.id)+'"><b>'+escape(item.name)+'</b><small>'+(item.category==='tool'?'เครื่องมือ':item.structurePiece?'ชิ้นส่วนอาคาร':'สถานี')+' · '+cost+' · '+escape(rustStationLabels[r.station]??r.station)+' · มีในโลก '+owned+'</small></div>';}).join('')+
 '</details>';
}
function rustPanel(s,api){
 const selected=api.read().selected,actor=s.agents.find(a=>a.id===selected&&a.alive);
 if(!actor)return rustCatalog(s)+'<div class="life-summary"><div><small>Rust Survival · RS1–RS4</small><b>เลือก Clone ก่อน</b></div><div><small>ถ่านไม้ / สถานี</small><b>'+(s.rustMaterials?.charcoal??0)+' / '+(s.rustStations?.stations?.length??0)+'</b></div></div><p class="source-note">รายการด้านบนคือไอเทม Rust ที่เชื่อมเข้าระบบเกมจริงแล้ว เลือก Clone ที่ยังมีชีวิตเพื่อเริ่มคราฟต์ จัดกระเป๋า และสวมอุปกรณ์</p>';
 const items=s.rustPossessions?.items??[],bag=items.filter(i=>i.location?.kind==='bag'&&i.location.agentId===actor.id);
 const equipped=s.rustPossessions?.equipment?.find(e=>e.agentId===actor.id)?.itemId??null;
 const craft=s.rustPossessions?.orders?.find(o=>o.agentId===actor.id),process=s.rustMaterials?.orders?.find(o=>o.agentId===actor.id);
 const drops=items.filter(i=>i.location?.kind==='drop'&&Math.abs(actor.x-i.location.x)+Math.abs(actor.y-i.location.y)<=1);
 const recipes=Object.values(RECIPE_CATALOG).map(r=>'<button class="secondary" data-ux="craft-item" data-recipe="'+r.id+'" '+(craft||process?'disabled':'')+'>คราฟต์ '+escape(ITEM_CATALOG[r.output].name)+'</button>').join('');
 const bagHtml=bag.length?'<details class="score-details"><summary>ของในกระเป๋า</summary>'+bag.map(i=>'<div class="memory-item"><b>'+escape(ITEM_CATALOG[i.kind]?.name??i.kind)+'</b><small>#'+i.id+' · สร้าง tick '+i.createdTick+'</small>'+(ITEM_CATALOG[i.kind]?.category==='tool'?(equipped===i.id?'<button class="secondary" data-ux="unequip-item">ถอดจากช่องมือ</button>':'<button class="secondary" data-ux="equip-item" data-item="'+i.id+'">สวมช่องมือ</button>'):'<button class="secondary" data-ux="place-station" data-item="'+i.id+'">'+(ITEM_CATALOG[i.kind]?.structurePiece?'วางชิ้นส่วนอาคาร':'วางสถานีติดตัว')+'</button>')+'</div>').join('')+'</details>':'';
 const dropHtml=drops.length?'<details class="score-details"><summary>ของตกใกล้ตัว</summary>'+drops.map(i=>'<button class="secondary" data-ux="pickup-rust" data-item="'+i.id+'">เก็บ '+escape(ITEM_CATALOG[i.kind]?.name??i.kind)+' #'+i.id+'</button>').join('')+'</details>':'';
 const equippedItem=bag.find(i=>i.id===equipped);
 const plan=s.productionPlan,goal=plan?.goal;
 return rustCatalog(s)+'<div class="life-summary"><div><small>Rust Survival · RS1–RS4</small><b>'+escape(actor.name)+'</b></div><div><small>ถ่านไม้ / สถานี</small><b>'+(s.rustMaterials?.charcoal??0)+' / '+(s.rustStations?.stations?.length??0)+'</b></div></div>'+
 '<div class="clone-skills"><div><span>กระเป๋า</span><b>'+bag.length+' / 4 ชิ้น</b></div><div><span>งานคราฟต์</span><b>'+(craft?escape(ITEM_CATALOG[RECIPE_CATALOG[craft.recipe]?.output]?.name??craft.recipe)+' '+Math.floor(craft.work)+'/'+craft.required:'ไม่มี')+'</b></div><div><span>งานเตา</span><b>'+(process?'ถ่านไม้ '+Math.floor(process.work)+'/'+process.required:'ไม่มี')+'</b></div><div><span>ของสวมอยู่</span><b>'+(equippedItem?escape(ITEM_CATALOG[equippedItem.kind]?.name??equippedItem.kind):'ไม่มี')+'</b></div></div>'+
 '<div class="life-summary"><div><small>RP1 · แผนผลิตอัตโนมัติ</small><b>'+(plan?.enabled?'เปิด':'ปิด')+'</b></div><div><small>สถานะล่าสุด</small><b>'+escape(goal?goal.goal+' · '+goal.outcome:'ยังไม่มีแผน')+'</b></div></div>'+
 '<div class="dialog-actions"><button class="secondary" data-ux="production-policy" data-enabled="'+(!plan?.enabled)+'">'+(plan?.enabled?'■ หยุดสร้างบ้าน + ทำของอัตโนมัติ':'▶ เริ่มให้ Clone สร้างบ้าน + ทำของอัตโนมัติ')+'</button>'+recipes+'<button class="secondary" data-ux="process-charcoal" '+(craft||process?'disabled':'')+'>เผาถ่าน Wood 2 → Charcoal 1</button></div>'+bagHtml+dropHtml+
 '<p class="source-note">RP1 เป็น deterministic coordinator: ใช้คำสั่ง Rust เดิมเพื่อสร้างขวาน/อีเต้อ → โต๊ะคราฟต์ → ค้อน → เตาหลอม → ถ่าน เป้าถ่าน 4 หน่วย · ไม่สร้างของเองนอก scheduler และ hunger/energy ยัง interrupt งานได้</p>'+
 '<p class="source-note">วัสดุถูก commit เข้า order แบบ atomic ตอนรับงาน · Clone เดิน/ทำงานตาม tick จริง · Stone Axe เร่ง WOODCUT ×1.25, Stone Pickaxe เร่ง MINE ×1.25 · ชิ้นส่วนอาคารไม้ต้องสวม Hammer ก่อนวาง และผนัง/ประตู/หลังคาต้องต่อกับโครงสร้างเดิม</p>';
}


function personalInventoryPanel(s,a){
 const items=s.rustPossessions?.items??[],bag=items.filter(i=>i.location?.kind==='bag'&&i.location.agentId===a.id).sort((x,y)=>x.id-y.id);
 const equippedId=s.rustPossessions?.equipment?.find(e=>e.agentId===a.id)?.itemId??null,equipped=bag.find(i=>i.id===equippedId)??null;
 const slots=Array.from({length:4},(_,slot)=>{const item=bag[slot];if(!item)return '<div class="memory-item" data-inventory-slot="'+slot+'"><small>ช่อง '+(slot+1)+'</small><b>ว่าง</b></div>';
  const def=ITEM_CATALOG[item.kind],action=a.alive&&def?.category==='tool'?(equippedId===item.id?'<button class="secondary" data-ux="unequip-item">ถอดจากช่องมือ</button>':'<button class="secondary" data-ux="equip-item" data-item="'+item.id+'">สวมช่องมือ</button>'):'';
  return '<div class="memory-item" data-inventory-slot="'+slot+'" data-item-id="'+item.id+'"><small>ช่อง '+(slot+1)+' · #'+item.id+'</small><b>'+escape(def?.name??item.kind)+'</b><p class="source-note">'+escape(def?.category==='tool'?'เครื่องมือ · ช่องมือ':def?.structurePiece?'ชิ้นส่วนอาคาร':'ของติดตัว')+'</p>'+action+'</div>';}).join('');
 const hand=equipped?escape(ITEM_CATALOG[equipped.kind]?.name??equipped.kind)+' #'+equipped.id:'ว่าง';
 return '<div class="life-summary"><div><small>กระเป๋าส่วนตัว</small><b>'+bag.length+' / 4 ช่อง</b></div><div><small>อุปกรณ์ · มือ</small><b>'+hand+'</b></div></div>'+
  '<div data-personal-inventory="'+a.id+'">'+slots+'</div>'+
  '<p class="source-note">ของเป็นของ Clone คนนี้ตาม item instance จริง · อุปกรณ์ที่สวมยังอยู่ในกระเป๋าและใช้ช่องเดิม · ตอนนี้มีช่องอุปกรณ์มือ 1 ช่องสำหรับ Stone Axe / Stone Pickaxe / Hammer</p>';
}

const blockedLabels={reserved:'มีคนจองงานแล้ว',satisfied:'สำรองและงานที่จองถึงเป้าแล้ว','no-path':'ไม่มีทางเดิน',stage:'ช่วงวัยนี้ทำงานนี้ไม่ได้'};
const stageLabels={CHILD:'เด็ก',ADULT:'ผู้ใหญ่',ELDER:'ผู้สูงวัย',DEAD:'เสียชีวิต'};
const birthLabels={'history-capacity':'จำนวนประวัติถึงขีดจำกัด','history-storage':'พื้นที่คลังประวัติเต็ม','history-invalid':'ประวัติต้องตรวจสอบ','history-hot':'ชุดข้อมูลทำงานเต็ม',ready:'พร้อมเมื่อถึงรอบปี',housing:'ที่พักเต็ม',history:'ประวัติตัวละครเต็ม',pace:'รอครบระยะห่างการเกิด',parent:'ยังไม่มีผู้ใหญ่ที่พร้อม',food:'อาหารสำรองยังไม่พอ',wood:'ไม้สำรองยังไม่พอ'};
const tabNames={about:'ตอนนี้',inventory:'กระเป๋า',skills:'ทักษะ',why:'เหตุผล',knowledge:'ความรู้',social:'สัมพันธ์',memory:'ความทรงจำ'};
function setText(id,value){const e=$(id);if(e&&e.textContent!==String(value))e.textContent=value;}
function replaceIfChanged(el,html){if(el.dataset.content!==html){const y=el.scrollTop;el.innerHTML=html;el.dataset.content=html;el.scrollTop=y;}}
export function installUX(api){
 let expanded=false,identityKey='',tabKey='',railKey='',rosterFilter='all',historyFilter='all',rosterLimit=80,routeShadowKey='',routeShadow=null;
 const inspector=$('inspector'),stage=$('stage'),body=$('dialog-body');
 document.body.classList.add('ux-v2');
 document.body.dataset.knowledgeVersion='knowledge-continuity-1';
 const staticIcons={observe:'eye',systems:'brain',rust:'hammer',roster:'people',history:'history',recenter:'focus'};
 for(const [id,key] of Object.entries(staticIcons)){const button=$(id);const span=button.querySelector('span');if(span)span.innerHTML=icon(key);else button.innerHTML=icon(key);}
 const navIcons={world:'eye',people:'people',systems:'brain',rust:'hammer',history:'history'};
 document.querySelectorAll('[data-nav]').forEach(b=>b.querySelector('span').innerHTML=icon(navIcons[b.dataset.nav]));
 const rustButton=$('rust'),rustNav=document.querySelector('[data-nav="rust"]'),systemsButton=$('systems'),systemsNav=document.querySelector('[data-nav="systems"]');
 if(rustButton)rustButton.onclick=()=>openRust();
 if(rustNav)rustNav.onclick=()=>{document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('active',x===rustNav));openRust();};
 if(systemsButton)systemsButton.onclick=()=>openSystems();
 if(systemsNav)systemsNav.onclick=()=>{document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('active',x===systemsNav));openSystems();};
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
 const help=document.createElement('button');help.id='quick-help';help.className='quick-help';help.innerHTML=`${icon('help')}<span>เริ่มเล่นอย่างไร</span>`;help.onclick=openGuide;stage.append(help);
 const auto=document.createElement('button');auto.type='button';auto.id='autonomy-status';auto.className='autonomy-status';auto.setAttribute('aria-live','polite');auto.setAttribute('aria-haspopup','dialog');auto.onclick=()=>openDecisionFeed();stage.append(auto);
 $('all-people').onclick=()=>openRoster();
 rail.addEventListener('click',e=>{const b=e.target.closest('[data-quick-person]');if(b)api.select(Number(b.dataset.quickPerson),true);});
 inspector.addEventListener('click',e=>{
  const b=e.target.closest('[data-ux]');if(!b)return;
  if(b.dataset.ux==='expand'){expanded=!expanded;renderInspector();}
  if(b.dataset.ux==='why'){expanded=true;api.setTab('why');}
  if(b.dataset.ux==='clone')openClone();
  if(b.dataset.ux==='equip-item'){const result=api.execute('EQUIP_ITEM',{agentId:api.read().selected,itemId:Number(b.dataset.item)});api.toast(result.message);if(result.ok){api.save();renderInspector();}}
  if(b.dataset.ux==='unequip-item'){const result=api.execute('UNEQUIP_ITEM',{agentId:api.read().selected});api.toast(result.message);if(result.ok){api.save();renderInspector();}}
  if(b.dataset.ux==='publish-knowledge'){
    const result=api.execute('PUBLISH_KNOWLEDGE',{agentId:api.read().selected,key:b.dataset.key});
    api.toast(result.message);if(result.ok)api.save();
  }
  if(b.dataset.ux==='verify-knowledge'){
    const result=api.execute('VERIFY_KNOWLEDGE',{agentId:api.read().selected,key:b.dataset.key});
    api.toast(result.message);if(result.ok){api.save();renderInspector();}
  }
  if(b.dataset.ux==='share-knowledge'){
    const result=api.execute('SHARE_KNOWLEDGE',{fromId:api.read().selected,key:b.dataset.key});
    api.toast(result.message);if(result.ok)api.save();
  }
  if(b.dataset.ux==='create-mentor'){const result=api.execute('CREATE_MENTOR_LINK',{mentorId:api.read().selected});api.toast(result.message);if(result.ok){api.save();renderInspector();}}
  if(b.dataset.ux==='end-mentor'){const result=api.execute('END_MENTOR_LINK',{linkId:Number(b.dataset.link)});api.toast(result.message);if(result.ok){api.save();renderInspector();}}
 });
 inspector.addEventListener('keydown',e=>{
  if(e.target.getAttribute('role')!=='tab'||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();const tabs=[...inspector.querySelectorAll('[role=tab]')],i=tabs.indexOf(e.target);
  const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  api.setTab(tabs[next].dataset.tab);inspector.querySelectorAll('[role=tab]')[next].focus();
 });
 body.addEventListener('input',e=>{if(e.target.id==='people-search'){rosterLimit=80;renderRosterList();}if(e.target.id==='story-search')renderHistoryList();});
 body.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.ux==='create-archive'){const result=api.execute('CREATE_ARCHIVE');api.toast(result.message);if(result.ok){api.save();openSurvival();}}
  if(b.dataset.ux==='culture-automation'){const result=api.execute('SET_CULTURE_AUTOMATION',{enabled:b.dataset.enabled==='true'});api.toast(result.message);if(result.ok){api.save();openSurvival();}}
  if(b.dataset.ux==='read-archive'){const result=api.execute('READ_ARCHIVE',{agentId:api.read().selected,key:b.dataset.key});api.toast(result.message);if(result.ok)api.save();}
  if(b.dataset.ux==='planning-policy'){const result=api.execute('SET_PLANNING_POLICY',{policy:b.dataset.policy});api.toast(result.message);if(result.ok){api.save();openSurvival();}}
  if(b.dataset.ux==='production-policy'){const result=api.execute('SET_PRODUCTION_POLICY',{enabled:b.dataset.enabled==='true'});api.toast(result.message);if(result.ok){api.save();openSurvival();}}
  if(b.dataset.ux==='craft-item'){const result=api.execute('CRAFT_ITEM',{agentId:api.read().selected,recipeId:b.dataset.recipe});api.toast(result.message);if(result.ok){api.save();openSurvival();}}
  if(b.dataset.ux==='equip-item'){const result=api.execute('EQUIP_ITEM',{agentId:api.read().selected,itemId:Number(b.dataset.item)});api.toast(result.message);if(result.ok){api.save();openSurvival();}}
  if(b.dataset.ux==='unequip-item'){const result=api.execute('UNEQUIP_ITEM',{agentId:api.read().selected});api.toast(result.message);if(result.ok){api.save();openSurvival();}}
  if(b.dataset.ux==='place-station'){
    const {state:s,selected}=api.read(),a=s.agents.find(a=>a.id===selected&&a.alive),itemId=Number(b.dataset.item),kind=s.rustPossessions?.items.find(i=>i.id===itemId)?.kind;let chosen=null;
    // Deterministic placement id (pl:<tick>:<agent>:<item>); the engine validator decides every candidate.
    const base=a&&{agentId:a.id,itemInstanceId:itemId,placementId:'pl:'+s.tick+':'+a.id+':'+itemId},near=a?[[0,0],[1,0],[0,1],[-1,0],[0,-1]].map(([dx,dy])=>({x:a.x+dx,y:a.y+dy})):[];
    const options=!a?[]:['WOOD_WALL','WOOD_DOORWAY'].includes(kind)?near.flatMap(c=>[{type:'edge',x:c.x,y:c.y,side:'N'},{type:'edge',x:c.x,y:c.y,side:'W'},{type:'edge',x:c.x,y:c.y+1,side:'N'},{type:'edge',x:c.x+1,y:c.y,side:'W'}]).map(socket=>({...base,socket})):
      kind==='WOOD_ROOF'?near.map(c=>({...base,socket:{type:'cell',x:c.x,y:c.y}})):near.slice(1).map(c=>({...base,...c}));
    for(const data of options)if(api.preview('PLACE_STATION',data).ok){chosen=data;break;}
    const result=chosen?api.execute('PLACE_STATION',chosen):{ok:false,message:'ไม่มีช่องว่างติดตัวที่ผ่านกฎการวาง'};api.toast(result.message);if(result.ok){api.save();openSurvival();}
  }
  if(b.dataset.ux==='process-charcoal'){
    const {state:s,selected}=api.read(),a=s.agents.find(a=>a.id===selected&&a.alive),dist=st=>a?Math.abs(a.x-st.x)+Math.abs(a.y-st.y):Infinity;
    const st=a?(s.rustStations?.stations??[]).filter(x=>x.complete&&x.kind==='FURNACE').sort((x,y)=>dist(x)-dist(y)||x.id-y.id)[0]:null;
    const result=st?api.execute('PROCESS_CHARCOAL',{agentId:a.id,stationId:st.id}):{ok:false,message:'ยังไม่มีเตาหลอม'};api.toast(result.message);if(result.ok){api.save();openSurvival();}
  }
  if(b.dataset.ux==='pickup-rust'){const result=api.execute('PICKUP_ITEM',{agentId:api.read().selected,itemId:Number(b.dataset.item)});api.toast(result.message);if(result.ok){api.save();openSurvival();}}
  if(b.dataset.ux==='systems-rust')openRust();
  if(b.dataset.ux==='systems-survival')openSurvival();
  if(b.dataset.ux==='event-agent'){api.closeDialog();api.select(Number(b.dataset.agent),true);return;}
  if(b.dataset.ux==='event-why-now'){api.closeDialog();api.select(Number(b.dataset.agent),true);expanded=true;api.setTab('why');return;}
  if(b.dataset.ux==='event-place'){api.closeDialog();api.observe();api.center({x:Number(b.dataset.x),y:Number(b.dataset.y)});return;}
  if(b.dataset.ux==='event-back'){openHistory();return;}
  if(b.dataset.aiPerson){const id=Number(b.dataset.aiPerson);api.closeDialog();api.select(id,true);expanded=true;api.setTab('why');return;}
  if(b.dataset.rosterFilter){rosterFilter=b.dataset.rosterFilter;rosterLimit=80;renderRosterList();}
  if(b.dataset.ux==='more-people'){rosterLimit+=80;renderRosterList();}
  if(b.dataset.historyFilter){historyFilter=b.dataset.historyFilter;renderHistoryList();}
  if(b.dataset.ux==='choose-parent')openRoster();
 });
 $('dialog').addEventListener('close',renderHUD);
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
  if(tab==='inventory')html=personalInventoryPanel(s,a);
  else if(tab==='skills')html=SKILLS.map(k=>{const p=a.skillProvenance?.bySkill?.[k],parts=[];
   if(p?.initialXP)parts.push('ตั้งต้น '+p.initialXP);if(p?.inheritedXP)parts.push('สืบทอด '+p.inheritedXP);if(p?.earnedXP)parts.push('ทำงาน '+p.earnedXP);if(p?.legacyUnattributedXP)parts.push('เดิมไม่ทราบที่มา '+p.legacyUnattributedXP);
   const evidence=(p?.evidence??[]).slice(-2).reverse().map(e=>e.kind==='inheritance'?'สืบทอดจาก '+escape(findPerson(s,e.sourceAgentId)?.name??('#'+e.sourceAgentId))+' · tick '+e.tick:e.kind==='work'?'งาน '+escape(roles[e.action]??e.action)+' · +'+e.xp+' XP · tick '+e.tick:'ทักษะตั้งต้น · +'+e.xp+' XP · tick '+e.tick).join('<br>');
   return `<div class="skill-row"><b>${roles[k]}</b><span>Lv.${level(a.skills[k])} <small>${a.skills[k]} XP</small></span></div><p class="source-note">${parts.join(' · ')||'ไม่มี XP'}${evidence?'<br>'+evidence:''}</p>`;}).join('')+`<p class="source-note">XP สืบทอดคือ inheritance ไม่ใช่การสอน · XP จากงานเกิดหลังผลลัพธ์จริงเท่านั้น · ข้อมูลเซฟเก่าที่พิสูจน์ที่มาไม่ได้จะแสดงว่าเดิมไม่ทราบที่มา</p>`;
  else if(tab==='knowledge'){
   const statusText={CONFIRMED:'ยืนยันจากประสบการณ์ตรง',UNVERIFIED:'ยังไม่ยืนยัน',STALE:'ข้อมูลเก่า',REFUTED:'ถูกหักล้าง'};
   const typeText={food:'อาหาร',wood:'ไม้',stone:'หิน'},beliefs=a.knowledgeState?.beliefs??[];
   html=beliefs.map(b=>{const fromArchive=(a.knowledgeState.evidence??[]).some(e=>b.evidenceIds.includes(e.evidenceId)&&e.channel==='archive');const source=b.sourceKind==='direct'?'ประสบการณ์ตรง':(fromArchive?'อ่านคลังที่บันทึกโดย ':'ได้รับจาก ')+escape(findPerson(s,b.sourceAgentId)?.name??('#'+b.sourceAgentId));
    const share=a.alive&&b.status==='CONFIRMED'?'<button class="secondary" data-ux="share-knowledge" data-key="'+escape(b.key)+'">แชร์ให้คนใกล้สุด</button>':'';
    const publish=a.alive&&b.status==='CONFIRMED'&&s.culture?'<button class="secondary" data-ux="publish-knowledge" data-key="'+escape(b.key)+'">บันทึกลงคลัง</button>':'';
    const verify=a.alive?'<button class="secondary" data-ux="verify-knowledge" data-key="'+escape(b.key)+'">ตรวจสอบ ณ ตำแหน่งนี้</button>':'';
    return `<div class="memory-item"><small>${escape(statusText[b.status]??b.status)} · ${source}</small><b>${escape(typeText[b.value.type]??b.value.type)} #${b.value.resourceId}</b><br>ตำแหน่ง ${b.value.x}, ${b.value.y}<br><span class="source-note">origin: ${escape(b.originEvidenceId)}</span>${share}${verify}${publish}</div>`;}).join('')||
    '<p class="empty-state">ยังไม่มีความรู้จากประสบการณ์จริง · Clone ต้องพบผลลัพธ์จากงานก่อน</p>';
   html+='<p class="source-note">ข้อมูลที่คนอื่นเล่าเริ่มเป็น “ยังไม่ยืนยัน” · ตรวจได้เมื่ออยู่ในระยะ 4 ช่อง · แหล่งหมดชั่วคราวหรือข้อมูลอายุเกิน 720 ticks เป็น “ข้อมูลเก่า” ไม่ใช่ข้อสรุปว่าผู้ส่งโกหก</p>';
  }
  else if(tab==='social'){
   const links=s.mentorship?.links??[],mine=links.filter(l=>l.mentorId===a.id||l.studentId===a.id);
   const activeStudent=links.some(l=>l.studentId===a.id&&l.endedTick===null);
   const rows=mine.map(l=>{const asMentor=l.mentorId===a.id,other=findPerson(s,asMentor?l.studentId:l.mentorId),active=l.endedTick===null;
    const end=active&&a.alive?'<button class="secondary" data-ux="end-mentor" data-link="'+l.id+'">สิ้นสุด Mentor</button>':'';
    return '<div class="memory-item"><small>'+(active?'active':'สิ้นสุด tick '+l.endedTick)+'</small><b>'+escape((asMentor?'Mentor ของ ':'เรียนกับ ')+(other?.name??('#'+(asMentor?l.studentId:l.mentorId))))+'</b><p class="source-note">เริ่ม tick '+l.createdTick+' · สอนแล้ว '+(l.taughtKeys?.length??0)+' เรื่อง'+(l.endReason?' · '+escape(l.endReason):'')+'</p>'+end+'</div>';
   }).join('');
   html=(rows||'<p class="empty-state">ยังไม่มีความสัมพันธ์ Mentor</p>')+(a.alive&&!activeStudent?'<button class="primary" data-ux="create-mentor">เป็น Mentor ให้คนใกล้สุด</button>':'')+
    '<p class="source-note">Mentor ส่งเฉพาะความรู้ที่ยืนยันแล้ว · ผู้เรียนรับเป็น UNVERIFIED · key เดิมใน Mentor link เดิมไม่ถูกส่งซ้ำ · การสอนไม่เพิ่ม Skill XP</p>';
  }
  else if(tab==='memory')html=(a.knowledgeState?.episodes??[]).slice().reverse().map(e=>`<div class="memory-item"><small>tick ${e.tick} · ${e.kind==='discovery'?'ประสบการณ์':'รับข้อมูล'}</small>${escape(e.event)}<br><span class="source-note">${escape(e.perceivedOutcome)}</span></div>`).join('')||
    a.memory.slice().reverse().map(m=>`<div class="memory-item"><small>วันที่ ${1+Math.floor(m.tick/360)}</small>${escape(m.text)}</div>`).join('')||
    '<p class="empty-state">ยังไม่มีความทรงจำสำคัญ</p>';
  else if(tab==='why'){
   const chosen=a.trace.find(t=>t.status==='selected'),max=Math.max(1,...a.trace.map(t=>t.score));
   const personalGoal=a.planning?.goal;
   if(chosen){html=`<div class="decision-callout">${icon('brain')}<div><small>เหตุผลจากการตัดสินใจล่าสุด</small><b>เลือก${LABELS[chosen.kind]} · ${chosen.score} คะแนน</b><p>Planner หลักยังเปรียบเทียบความต้องการ ความถนัด ทักษะ และระยะเดินจริง ส่วน K1 คำนวณ scarcity + อาชีพแบบ Kingdom เป็น shadow score เพื่อพิสูจน์ก่อนให้มีอำนาจเลือกงาน</p></div></div>`;}
   html+=(chosen?[chosen,...a.trace.filter(t=>t!==chosen).slice(0,5)]:a.trace.slice(0,6)).map(c=>`<div class="trace-row ${c.status==='selected'?'selected':''}"><span>${c.status==='selected'?'✓ ':''}${LABELS[c.kind]}${blockedLabels[c.status]?' · '+blockedLabels[c.status]:''}</span><b>${c.score}</b><div class="scorebar"><i style="width:${Math.max(0,c.score/max*100)}%"></i></div></div>`).join('');
   if(chosen){
    const f=chosen.factors,k=chosen.kingdomUtility;
    const routeKey=JSON.stringify([a.id,a.x,a.y,a.task?.x,a.task?.y,a.task?.path]);
    if(routeKey!==routeShadowKey){routeShadowKey=routeKey;routeShadow=a.task?compareShadowRouting(s,{x:a.x,y:a.y},{x:a.task.x,y:a.task.y},a.task.path):null;}
    const worldShadow=routeShadow?.weighted?`<details class="score-details"><summary>WorldSim WM2.2 · shadow route</summary><dl><div><dt>เส้นทางปัจจุบัน</dt><dd>${routeShadow.current?.cost??'—'}</dd></div><div><dt>weighted candidate</dt><dd>${routeShadow.weighted.cost}</dd></div><div><dt>candidate steps</dt><dd>${routeShadow.weighted.steps}</dd></div><div><dt>shadow savings</dt><dd>${routeShadow.savings??'—'}</dd></div></dl><p class="source-note">ค่านี้ใช้สังเกตเท่านั้น · ยังไม่เปลี่ยน task, score, path หรือ movement จริง</p></details>`:'';
    html+=`<details class="score-details"><summary>ดูส่วนประกอบคะแนน</summary><dl>${[['พื้นฐาน',f.base],['ความต้องการ',f.need],['ความถนัด',f.goal],['ทักษะ',f.skill],['ระยะเดินจริง',f.distance],...(f.laborMarket?[['แรงงาน K5',f.laborMarket]]:[])].map(([key,v])=>`<div><dt>${key}</dt><dd>${v>0?'+':''}${v}</dd></div>`).join('')}</dl></details>${k?`<details class="score-details"><summary>Kingdom K1 · shadow utility</summary><dl>${[['scarcity',k.scarcity],['อาชีพเดิม',k.profession],['deterministic jitter',k.utilityJitter]].map(([key,v])=>`<div><dt>${key}</dt><dd>${v>0?'+':''}${v}</dd></div>`).join('')}</dl></details>`:''}${worldShadow}<p class="source-note">ระยะเดินตอนเลือก ${chosen.travelSteps??'—'} ช่อง · ${a.task?'เลือกเมื่อ tick '+a.task.started:'งานล่าสุดสิ้นสุดแล้ว'} · planner หลักยังเป็น authority; Kingdom K1 และ WorldSim weighted route ยังเป็น shadow evidence</p>`;
   }
   if(personalGoal){
    const goals={'secure-food':'หาอาหาร','collect-wood':'หาไม้','collect-stone':'หาหิน','finish-shelter':'สร้างที่พัก','explore':'สำรวจพื้นที่'};
    const phases={'visit-and-verify':'เดินไปยังจุดที่จำได้ → ตรวจสอบ → ทำงาน',verify:'ตรวจสอบข้อมูล',explore:'สำรวจจุดที่ยังไม่รู้',work:'ทำงาน → ตรวจผลผลิตจริง'};
    html+=`<div class="memory-item" data-ui="personal-goal"><small>แผนต่อเนื่อง · ${escape(personalGoal.status)}</small><b>${escape(goals[personalGoal.goal]??personalGoal.goal)}</b><p>${escape(phases[personalGoal.phase]??personalGoal.phase)}</p><span class="source-note">ผลล่าสุด: ${escape(personalGoal.outcome)} · เป้าหมาย ${personalGoal.x}, ${personalGoal.y}</span></div>`;
   }
   if(!a.trace.length)html=a.archived?'<p class="empty-state">คลังประวัติเก็บตัวตน ทักษะ และความทรงจำ แต่ไม่เก็บคะแนนตัดสินใจชั่วคราว</p>':'<p class="empty-state">รอโลกเดิน tick แรกเพื่อดูคะแนนจริง</p>';
  }else{
   const parent=findPerson(s,a.parentId);
   html=`<div class="life-summary"><div><small>ต้นแบบ</small><b>${escape(parent?.name??(a.parentId===null?'คนแรกของโลก':'ไม่พบประวัติต้นแบบ'))}</b></div><div><small>งานที่ได้ XP</small><b>${a.workDone} ครั้ง</b></div></div><p class="source-note">${a.archived?'เก็บอยู่ในคลังประวัติ · ตัวตนและสายตระกูลยังอยู่':a.task?.path.length?'กำลังเดิน เหลือ '+a.task.path.length+' ช่องก่อนถึงเป้าหมาย':'ตัวละครเลือกงานตามสถานการณ์ของตัวเอง'}<br>เปิด “เหตุผล” เพื่อดูงานที่พิจารณาและคะแนนจริง</p>`;
  }
  if(panel.dataset.content!==html){const oldOpen=panel.querySelector('details')?.open,scroll=inspector.scrollTop;replaceIfChanged(panel,html);if(oldOpen&&panel.querySelector('details'))panel.querySelector('details').open=true;inspector.scrollTop=scroll;}
 }
 function currentDecisions(s,limit=12){
  const factorLabels={base:'พื้นฐาน',need:'ความต้องการ',goal:'ความถนัด',skill:'ทักษะ',distance:'ระยะเดิน',laborMarket:'แรงงาน K5'};
  return living(s).map(a=>{
   const chosen=(a.trace??[]).find(t=>t.status==='selected');if(!chosen)return null;
   const causes=Object.entries(chosen.factors??{}).filter(([k,v])=>k in factorLabels&&Number.isFinite(v)&&v!==0).sort((x,y)=>Math.abs(y[1])-Math.abs(x[1])||x[0].localeCompare(y[0])).slice(0,3).map(([k,v])=>factorLabels[k]+' '+(v>0?'+':'')+v);
   return {agent:a,chosen,causes,started:a.task?.started??-1};
  }).filter(Boolean).sort((a,b)=>b.started-a.started||a.agent.id-b.agent.id).slice(0,limit);
 }
 function openDecisionFeed(){
  const s=api.read().state,rows=currentDecisions(s);
  const html=rows.length?rows.map(({agent,chosen,causes})=>'<button class="decision-feed-row" data-ai-person="'+agent.id+'" aria-label="ดูเหตุผลของ '+escape(agent.name)+'"><div class="decision-feed-title"><b>'+escape(agent.name)+'</b><span>'+escape(LABELS[chosen.kind]??chosen.kind)+' · '+chosen.score+' คะแนน</span></div><p>'+escape(causes.join(' · ')||'ดู trace การตัดสินใจล่าสุด')+'</p><small>เปิด Clone → เหตุผล →</small></button>').join(''):'<p class="empty-state">ยังไม่มี decision trace · ปล่อยโลกเดินอย่างน้อย 1 tick</p>';
  api.openDialog('AI กำลังตัดสินใจอะไร','AI DECISION FEED · LIVE','<p class="decision-feed-intro">นี่คือการตัดสินใจจริงจาก planner ปัจจุบัน ไม่ใช่ข้อความแต่ง · แตะแถวเพื่อไปยัง Clone และเปิด “เหตุผล” โดยตรง</p><div class="decision-feed-list">'+html+'</div>');
  $('dialog').dataset.kind='decisions';renderHUD();
 }
 function renderHUD(){
  const {state:s,selected,mode,paused}=api.read(),agents=living(s);
  const key=agents.map(a=>a.id+':'+a.name+':'+a.alive).join('|');
  if(key!==railKey){railKey=key;const scroller=$('people-chips'),x=scroller.scrollLeft;
   scroller.innerHTML=agents.map(a=>`<button data-quick-person="${a.id}" class="person-chip" aria-label="เลือก ${escape(a.name)} รุ่น ${a.generation}">${api.portrait(a)}<span>${escape(a.name)}</span></button>`).join('');scroller.scrollLeft=x;
  }
  for(const b of rail.querySelectorAll('[data-quick-person]')){const active=Number(b.dataset.quickPerson)===selected;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));}
  $('quick-help').hidden=selected!==null;
  const auto=$('autonomy-status'),autoOn=s.productionPlan?.enabled===true,latestDecision=currentDecisions(s,1)[0];
  auto.hidden=selected!==null;
  auto.innerHTML='<b>AI AUTONOMY · ACTIVE</b><span>'+(latestDecision?escape(latestDecision.agent.name)+' → '+escape(LABELS[latestDecision.chosen.kind]??latestDecision.chosen.kind)+' · ทำไม?':'Housing LIVE · RP1 '+(autoOn?'LIVE':'READY'))+'</span>';
  auto.setAttribute('aria-label',latestDecision?'เปิด AI Decision Feed · '+latestDecision.agent.name+' เลือก '+(LABELS[latestDecision.chosen.kind]??latestDecision.chosen.kind):'เปิด AI Decision Feed');
  $('pause').setAttribute('aria-pressed',String(paused));$('observe').setAttribute('aria-pressed','true');
  const h=$('world-status');h.textContent=$('dialog').open?'หยุดเวลา · กำลังดูข้อมูล':paused?'หยุดเวลา · กด ▶ เพื่อเดินต่อ':'โลกกำลังดำเนินไปด้วยตัวเอง';
  document.body.classList.toggle('is-paused',paused||$('dialog').open);
  const modal=$('dialog').open,kind=$('dialog').dataset.kind,activeNav=modal&&kind==='people'?'people':modal&&kind==='systems'?'systems':modal&&kind==='rust'?'rust':modal&&(kind==='history'||kind==='event')?'history':'world';
  for(const b of document.querySelectorAll('[data-nav]')){const active=b.dataset.nav===activeNav;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');}
 }
 function openSystems(){
 const s=api.read().state,agents=living(s),v=survivalSummary(s),houses=evaluateModularHouses(s).houses;
 const completeHouses=houses.filter(h=>h.complete).length,buildingHouses=houses.length-completeHouses;
 const items=s.rustPossessions?.items??[],bagItems=items.filter(i=>i.location?.kind==='bag').length,equipped=s.rustPossessions?.equipment?.length??0;
 const craftOrders=s.rustPossessions?.orders?.length??0,processOrders=s.rustMaterials?.orders?.length??0,stations=s.rustStations?.stations?.length??0;
 const mentorLinks=(s.mentorship?.links??[]).filter(l=>l.endedTick===null).length;
 const beliefs=agents.reduce((n,a)=>n+(a.knowledgeState?.beliefs?.length??0),0),cultureEntries=s.culture?.entries?.length??0;
 const eco=createResourceEcologyShadow(s),pressure=shadowExistingResourcePressure(s,eco),topPressure=pressure.rows.slice().sort((a,b)=>b.regenerationPressure-a.regenerationPressure||a.id-b.id)[0]??null;
 const plan=s.productionPlan,goal=plan?.goal,maxGeneration=agents.reduce((m,a)=>Math.max(m,a.generation??0),0);
 const taskCounts={};for(const a of agents){const k=a.task?.kind??'IDLE';taskCounts[k]=(taskCounts[k]??0)+1;}
 const activityLabels={BUILD:'สร้าง',CRAFT:'คราฟต์',PROCESS:'แปรรูป',FORAGE:'หาอาหาร',WOODCUT:'ตัดไม้',MINE:'ขุดหิน',EXPLORE:'สำรวจ',EAT:'กิน',REST:'พัก',IDLE:'ว่าง'};
 const activityOrder=['BUILD','CRAFT','PROCESS','FORAGE','WOODCUT','MINE','EXPLORE','EAT','REST','IDLE'];
 const activity=activityOrder.filter(k=>taskCounts[k]).map(k=>'<div><span>'+activityLabels[k]+'</span><b>'+taskCounts[k]+' คน</b></div>').join('')||'<div><span>สถานะ</span><b>ยังไม่มี task</b></div>';
 const badge=status=>'<span class="system-badge '+status.toLowerCase()+'">'+status+'</span>';
 const card=(id,title,status,value,detail)=>'<article class="system-card" data-system-card="'+id+'"><div class="system-card-head"><b>'+title+'</b>'+badge(status)+'</div><strong>'+value+'</strong><p>'+detail+'</p></article>';
 const cards=[
  card('lifecycle','Lifecycle','LIVE','รุ่นสูงสุด '+maxGeneration,'เกิดอัตโนมัติ · เติบโต · อายุขัยและการตาย deterministic'),
  card('housing','Housing','LIVE',agents.length+' / '+capacity(s)+' คน','บ้าน modular เสร็จ '+completeHouses+' · กำลังก่อสร้าง '+buildingHouses+' · AI ขยายที่พักตามแรงกดดัน'),
  card('production','Production + Craft',plan?.enabled?'LIVE':'READY',plan?.enabled?'Full RP1':'Housing-only autonomy','งานคราฟต์ '+craftOrders+' · แปรรูป '+processOrders+' · สถานี '+stations+(goal?' · ล่าสุด '+escape(goal.goal)+' / '+escape(goal.outcome):'')),
  card('inventory','Inventory + Equipment','LIVE',bagItems+' item · สวม '+equipped,'ของแต่ละชิ้นมีเจ้าของ Clone จริง · กระเป๋า 4 ช่อง · ช่องมือ 1 ช่อง'),
  card('knowledge','Knowledge + Mentor','LIVE',beliefs+' belief · Mentor '+mentorLinks,'คลังวัฒนธรรม '+cultureEntries+' รายการ · ความรู้มี source และสถานะยืนยัน'),
  card('ecology','WorldSim Ecology','LIVE','Food + Wood authority','Stone finite · regen pressure สูงสุด '+(topPressure?escape(topPressure.type)+' #'+topPressure.id+' · '+topPressure.regenerationPressure:'—')),
  card('kingdom','Kingdom Systems','SHADOW',(v.kingdomLabor?.activeCount??0)+' labor offer','K1/K5 มี authority บางส่วน · K2/K3/K4/K6 ยังเป็น projection')
 ].join('');
 const sys=(name,status,detail)=>({name,status,detail});
 const groups=[
  ['ชีวิต / AI',[
   sys('Survival Core','LIVE','ความหิว พลังงาน งาน ทรัพยากร และ survival targets'),
   sys('Lifecycle','LIVE','อายุ ช่วงวัย work-rate และวงจรชีวิต'),
   sys('Reproduction','LIVE','เกิดอัตโนมัติ housing/food/wood safety gates และ lineage'),
   sys('Housing','LIVE','บ้าน modular + capacity + autonomous expansion'),
   sys('Personal Planning',s.planningPolicy?'LIVE':'READY',s.planningPolicy?'ใช้ความรู้ส่วนตัวเลือกเป้าหมาย':'ระบบพร้อม แต่ยังใช้นโยบาย Survival เดิม'),
   sys('Skill Provenance','LIVE','แยก XP ตั้งต้น / สืบทอด / ได้จากงานจริง'),
   sys('History / Identity Archive','LIVE','เก็บตัวตน คนตาย lineage และ bounded history'),
   sys('Navigation','INFRA','path / reachability / camera-safe world navigation')
  ]],
  ['การผลิต / ไอเทม',[
   sys('Rust Runtime','LIVE','command bridge + scheduler สำหรับ crafting/placement/process'),
   sys('Crafting Catalog','INFRA','สูตร ไอเทม station requirement และต้นทุน authoritative'),
   sys('Personal Possessions','LIVE',bagItems+' item อยู่ในกระเป๋าของ Clone'),
   sys('Equipment · Hand','LIVE',equipped+' ชิ้นกำลังสวม · Axe/Pickaxe/Hammer'),
   sys('Rust Stations','LIVE',stations+' station/structure อยู่ในโลกจริง'),
   sys('Rust Materials / Charcoal','LIVE',(s.rustMaterials?.charcoal??0)+' charcoal · '+processOrders+' process order'),
   sys('Housing-only Production Autonomy','LIVE','สร้าง Table → Hammer → บ้าน เมื่อ housing กดดัน'),
   sys('Production Planning RP1',plan?.enabled?'LIVE':'READY',plan?.enabled?'Full tool/station/charcoal coordinator เปิดอยู่':'Full RP1 พร้อมแต่ policy ยังปิด')
  ]],
  ['ความรู้ / สังคม',[
   sys('Personal Knowledge','LIVE',beliefs+' belief ใน Clone ที่มีชีวิต'),
   sys('Knowledge Revision','LIVE','CONFIRMED / UNVERIFIED / STALE / REFUTED + evidence source'),
   sys('Cultural Archive',s.culture?'LIVE':'READY',s.culture?cultureEntries+' รายการถูกบันทึกในคลัง':'ระบบพร้อม แต่โลกนี้ยังไม่ได้สร้างคลัง'),
   sys('Mentorship KF1','LIVE',mentorLinks+' Mentor link ที่ active'),
   sys('Lineage + Skill Inheritance','LIVE','parentId / generation + 35% skill inheritance with provenance')
  ]],
  ['WorldSim / นิเวศ',[
   sys('World Map Presentation','INFRA','terrain/world visual projection บนแผนที่'),
   sys('Resource Authority · Food/Wood','LIVE','single regeneration writer; Stone ยัง finite'),
   sys('Resource Policy','LIVE','policy ที่กำหนด regen authority ปัจจุบัน'),
   sys('Resource Ecology Shadow','SHADOW','suitability / regeneration pressure จาก world evidence'),
   sys('Resource Regeneration Shadow','SHADOW','candidate regen แบบ read-only'),
   sys('Food Regen Impact','SHADOW','วิเคราะห์ผลของ candidate food regeneration'),
   sys('Food Ecology Calibration','SHADOW','calibration evidence ก่อนเปลี่ยน authority'),
   sys('Food Formula Lab','SHADOW','สูตรทดลอง/เปรียบเทียบ ไม่เขียนโลก'),
   sys('Climate','SHADOW','climate projection ใช้เป็น evidence เท่านั้น'),
   sys('Hydrology','SHADOW','น้ำ/ความชื้น projection ใช้ประกอบ ecology'),
   sys('Soil','SHADOW','soil type / fertility / nutrient / compaction projection'),
   sys('Vegetation','SHADOW','vegetation suitability projection'),
   sys('Weighted Routing','SHADOW','เส้นทางถ่วงน้ำหนักเทียบกับ path authority เดิม')
  ]],
  ['Kingdom / เศรษฐกิจ',[
   sys('K1 Utility + Career','LIVE','utility/profession state เชื่อมกับงานที่ชนะจริง'),
   sys('K2 Economy','SHADOW','demand + scarcity + labor pressure'),
   sys('K3 Production','SHADOW','effective worker / crowding / expected productivity'),
   sys('K4 Labor Market','SHADOW',(v.kingdomLabor?.activeCount??0)+' labor offer เป็น proposal'),
   sys('K5 Labor Authority','LIVE','labor scoring premium อยู่ใน eligibility/survival constraints เดิม'),
   sys('K6 Market','SHADOW','price index เท่านั้น ยังไม่มีเงินจริง/การค้า')
  ]],
  ['ระบบพื้นฐาน / ความปลอดภัย',[
   sys('Save / Restore','INFRA','local persistence + migration + protected recovery'),
   sys('Runtime Boot + Source Pins','INFRA','กัน browser โหลด module คนละ revision'),
   sys('Building Visuals','INFRA','renderer สำหรับ modular foundation/wall/door/roof'),
   sys('Observation UI','INFRA','อ่าน state + dispatch command ที่ผ่าน validator เท่านั้น')
  ]]
 ];
 const allSystems=groups.flatMap(g=>g[1]),counts=allSystems.reduce((o,x)=>(o[x.status]=(o[x.status]??0)+1,o),{});
 const row=x=>'<div class="system-row" data-system-status="'+x.status+'"><div><b>'+escape(x.name)+'</b><p>'+escape(x.detail)+'</p></div>'+badge(x.status)+'</div>';
 const catalog=groups.map(([title,list])=>'<details class="system-catalog"><summary><span>'+escape(title)+'</span><b>'+list.length+' ระบบ</b></summary>'+list.map(row).join('')+'</details>').join('');
 api.openDialog('ระบบที่กำลังขับเคลื่อนโลก','WORLD SYSTEMS · AUTONOMOUS',
  '<section class="system-hero"><span class="eyebrow">AI WORLD STATUS</span><h3>โลกทำงานเอง · ทุกระบบที่มีจริงต้องมองเห็นได้</h3><p>แยกชัดว่า LIVE, READY, SHADOW หรือ INFRA เพื่อไม่ให้ระบบซ่อนอยู่หลังโค้ด</p><div class="system-counts"><span>LIVE '+(counts.LIVE??0)+'</span><span>READY '+(counts.READY??0)+'</span><span>SHADOW '+(counts.SHADOW??0)+'</span><span>INFRA '+(counts.INFRA??0)+'</span></div></section>'+
  '<div class="system-grid">'+cards+'</div>'+
  '<section class="ai-activity"><div class="system-section-head"><div><span class="eyebrow">LIVE ACTIVITY</span><h3>ตอนนี้ Clone กำลังทำอะไร</h3></div><b>'+agents.length+' คน</b></div><div class="activity-grid">'+activity+'</div></section>'+
  '<details class="system-advanced"><summary><div><span class="eyebrow">ADVANCED SYSTEMS</span><b>ดูระบบทั้งหมด '+allSystems.length+' ระบบ</b></div><span>LIVE / READY / SHADOW / INFRA</span></summary><section class="all-systems"><div class="system-section-head"><div><span class="eyebrow">FULL RUNTIME CATALOG</span><h3>ระบบทั้งหมดที่มีอยู่ในเกม</h3></div><b>'+allSystems.length+' ระบบ</b></div>'+catalog+'</section></details>'+
  '<div class="system-actions"><button class="secondary" data-ux="systems-survival">รายละเอียด Survival / Ecology</button><button class="secondary" data-ux="systems-rust">รายละเอียดของ / คราฟต์</button></div>'+
  '<p class="source-note">LIVE = เขียนผลเกมจริง · READY = ระบบพร้อมแต่ policy/สิ่งปลูกสร้างยังไม่เปิด · SHADOW = คำนวณเพื่อสังเกต · INFRA = ระบบพื้นฐานที่รองรับ gameplay แต่ไม่ใช่ decision authority</p>');
 $('dialog').dataset.kind='systems';renderHUD();
}
 function openRoster(){rosterFilter='all';rosterLimit=80;api.openDialog('ทุกคนเริ่มเหมือนกัน แต่ไม่เหมือนเดิม','PEOPLE · '+living(api.read().state).length+' คน',`<div class="search-control">${icon('search')}<label class="sr-only" for="people-search">ค้นหาชื่อ</label><input id="people-search" type="search" placeholder="ค้นหาชื่อ เช่น Kira" autocomplete="off"></div><div class="filter-tabs">${[['all','ทั้งหมด'],['hungry','ความอิ่มต่ำ'],['children','รุ่น 2 ขึ้นไป'],['archived','คลังประวัติ']].map(([id,t])=>`<button data-roster-filter="${id}">${t}</button>`).join('')}</div><p id="roster-count" class="list-count"></p><div id="roster-list"></div>`);$('dialog').dataset.kind='people';renderRosterList();renderHUD();}
 function renderRosterList(){if(!$('roster-list'))return;const q=$('people-search').value.toLocaleLowerCase(),s=api.read().state;
  const agents=allPeople(s).filter(a=>a.name.toLocaleLowerCase().includes(q)&&(rosterFilter!=='hungry'||a.alive&&a.satiety<25)&&(rosterFilter!=='children'||a.generation>=2)&&(rosterFilter!=='archived'||a.archived===true));
  setText('roster-count',`${agents.length} คน${agents.length>rosterLimit?' · แสดง '+rosterLimit+' คนแรก':''} · ข้อมูลขณะหยุดเวลา${rosterFilter==='hungry'?' · ความอิ่มต่ำกว่า 25':''}`);
  document.querySelectorAll('[data-roster-filter]').forEach(b=>{const on=b.dataset.rosterFilter===rosterFilter;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  $('roster-list').innerHTML=agents.length?agents.slice(0,rosterLimit).map(a=>`<button class="person-row" data-person="${a.id}">${api.portrait(a)}<div><b>${escape(a.name)}</b><small>รุ่น ${a.generation} · ${escape(api.actionText(a))}</small><span class="roster-skill">${roles[a.preference]} · Lv.${level(a.skills[a.preference])}</span></div><span class="roster-health">${a.alive?Math.round(a.satiety)+'%':'—'}<small>${a.alive?'อิ่ม':'เสียชีวิต'}</small></span></button>`).join(''):'<p class="empty-state">ไม่มีตัวละครตรงกับตัวกรองนี้</p>';
  if(agents.length>rosterLimit)$('roster-list').insertAdjacentHTML('beforeend','<button class="secondary" data-ux="more-people">แสดงเพิ่มอีก 80 คน</button>');
 }
 function eventEvidence(s,e){
  const person=e.agentId!==null&&e.agentId!==undefined?findPerson(s,e.agentId):null;
  const parent=person?.parentId!==null&&person?.parentId!==undefined?findPerson(s,person.parentId):null;
  let status='UNKNOWN',cause='เหตุผลย้อนหลังไม่ได้ถูกเก็บใน event log รุ่นนี้',source='event log มีเพียง tick / type / text / agentId',place=null,evidence='ยังไม่มี provenance ที่ผูกกับ tick นี้';
  if(e.type==='birth'&&person?.bornTick===e.tick){
   status='EVIDENCE';cause=person.parentId===null?'Original เข้าสู่โลกเป็นจุดเริ่มต้นสายตระกูล':(person.source?.startsWith('สืบทอดเมื่อเกิดจาก')?'เกิดอัตโนมัติจาก '+(parent?.name??('#'+person.parentId)):'ถูกสร้างแบบ manual จาก '+(parent?.name??('#'+person.parentId)));
   evidence='bornTick + parentId + generation · รุ่น '+person.generation;source='agent identity / lineage';
  }else if(e.type==='death'&&person?.death?.tick===e.tick){
   status='EVIDENCE';const causes={age:'อายุขัย deterministic สิ้นสุด',starvation:'ขาดอาหาร',unknown:'ไม่ทราบสาเหตุ'};
   cause=causes[person.death.cause]??person.death.cause;evidence='death record · อายุ '+(person.death.ageYears??'ไม่ทราบ')+' ปี';source='immutable death history';
   if(Number.isFinite(person.x)&&Number.isFinite(person.y))place={x:person.x,y:person.y,label:'ตำแหน่ง identity ที่เก็บไว้'};
  }else if(e.type==='career'&&person){
   const row=(person.career??[]).find(x=>x.tick===e.tick),work=Object.entries(person.skillProvenance?.bySkill??{}).flatMap(([skill,b])=>(b.evidence??[]).filter(x=>x.kind==='work'&&x.tick===e.tick).map(x=>({skill,...x})))[0];
   if(row){status='EVIDENCE';cause=work?'งาน '+escape(LABELS[work.action]??work.action)+' ที่ให้ผลจริงทำให้อาชีพเปลี่ยน':'มี career record ตรงกับ tick นี้ แต่ work evidence ถูก bounded ออกแล้ว';evidence='อาชีพใหม่ '+escape(professionLabel(row.profession));source=work?'career + skill provenance':'career history';}
  }else if(e.type==='skill'&&person){
   const work=Object.entries(person.skillProvenance?.bySkill??{}).flatMap(([skill,b])=>(b.evidence??[]).filter(x=>x.kind==='work'&&x.tick===e.tick).map(x=>({skill,...x})))[0];
   if(work){status='EVIDENCE';cause='ได้ XP จากงาน '+escape(LABELS[work.action]??work.action);evidence=escape(work.skill)+' +'+work.xp+' XP'+(work.targetId!==null?' · target #'+work.targetId:'');source='bounded skill provenance';}
  }else if(e.type==='build'&&person){
   const st=(s.rustStations?.stations??[]).filter(x=>x.placedBy===person.id&&x.placedTick===e.tick).sort((a,b)=>b.id-a.id)[0];
   if(st){status='EVIDENCE';cause='การวางชิ้นส่วน '+escape(st.kind)+' ทำให้ระบบบันทึกผลก่อสร้าง';evidence='station #'+st.id+' · placement '+escape(st.placementId??'—');source='Rust placement record';place={x:st.x,y:st.y,label:'ตำแหน่งชิ้นส่วนที่วาง'};}
  }else if(e.type==='craft'&&person){
   const item=(s.rustPossessions?.items??[]).filter(x=>x.createdBy===person.id&&x.createdTick===e.tick).sort((a,b)=>b.id-a.id)[0];
   if(item){status='EVIDENCE';cause='craft order ทำงานครบและสร้าง item instance';evidence=escape(ITEM_CATALOG[item.kind]?.name??item.kind)+' #'+item.id;source='Rust possession item';}
  }else if(e.type==='mentor'&&person){
   const created=(s.mentorship?.links??[]).find(l=>l.mentorId===person.id&&l.createdTick===e.tick);
   const taught=allPeople(s).flatMap(a=>(a.knowledgeState?.evidence??[]).filter(x=>x.type==='message'&&x.tick===e.tick&&x.sourceAgentId===person.id).map(x=>({receiver:a,e:x})))[0];
   if(created){status='EVIDENCE';const student=findPerson(s,created.studentId);cause='สร้าง Mentor link';evidence=escape(person.name)+' → '+escape(student?.name??('#'+created.studentId));source='mentorship link';}
   else if(taught){status='EVIDENCE';cause='Mentor ส่ง claim ให้ผู้เรียน';evidence=escape(taught.e.key)+' → '+escape(taught.receiver.name);source='knowledge message evidence';}
  }else if(e.type==='knowledge'&&person){
   const sent=allPeople(s).flatMap(a=>(a.knowledgeState?.evidence??[]).filter(x=>x.tick===e.tick&&x.sourceAgentId===person.id).map(x=>({receiver:a,e:x})))[0];
   const archiveRead=(person.knowledgeState?.evidence??[]).find(x=>x.tick===e.tick&&x.channel==='archive');
   const published=s.culture?.entries?.find(x=>x.authorId===person.id&&x.publishedTick===e.tick);
   if(sent){status='EVIDENCE';cause='ส่ง claim ที่ยืนยันแล้วให้ผู้รับ';evidence=escape(sent.e.key)+' → '+escape(sent.receiver.name);source='knowledge message evidence';}
   else if(archiveRead){status='EVIDENCE';cause='อ่าน claim จาก Cultural Archive';evidence=escape(archiveRead.key)+' · revision '+(archiveRead.archiveRevision??'—');source='archive evidence';const camp=s.buildings.find(b=>b.id===s.culture?.buildingId);if(camp)place={x:camp.x,y:camp.y,label:'Cultural Archive'};}
   else if(published){status='EVIDENCE';cause='บันทึก direct confirmed knowledge ลง Cultural Archive';evidence=escape(published.key)+' · revision '+published.revision;source='cultural archive entry';const camp=s.buildings.find(b=>b.id===s.culture?.buildingId);if(camp)place={x:camp.x,y:camp.y,label:'Cultural Archive'};}
  }else if(e.type==='day'){
   status='EVIDENCE';cause='simulation tick ข้ามขอบวัน';evidence='tick '+e.tick+' → วันที่ '+(1+Math.floor(e.tick/360));source='deterministic world clock';
  }
  return {event:e,person,status,cause,evidence,source,place};
 }
 function openEvent(eventId){
  const s=api.read().state,e=s.events.find(x=>x.id===eventId);if(!e){api.toast('ไม่พบเหตุการณ์นี้แล้ว');return;}
  const d=eventEvidence(s,e),person=d.person,statusClass=d.status==='EVIDENCE'?'evidence':'unknown';
  const actions=[
   person?'<button class="secondary" data-ux="event-agent" data-agent="'+person.id+'">ดู '+escape(person.name)+'</button>':'',
   person?.alive?'<button class="secondary" data-ux="event-why-now" data-agent="'+person.id+'">Why ปัจจุบัน</button>':'',
   d.place?'<button class="secondary" data-ux="event-place" data-x="'+d.place.x+'" data-y="'+d.place.y+'">ไปยัง '+escape(d.place.label)+'</button>':'',
   '<button class="secondary" data-ux="event-back">← กลับ Chronicle</button>'
  ].join('');
  api.openDialog(escape(events[e.type]??e.type),'EVENT → EVIDENCE · tick '+e.tick,
   '<article class="event-detail"><span class="event-evidence-status '+statusClass+'" data-event-evidence-status="'+d.status+'">'+d.status+'</span><small>วันที่ '+(1+Math.floor(e.tick/360))+' · '+escape(events[e.type]??e.type)+'</small><h3>'+escape(e.text)+'</h3>'+
   '<div class="event-evidence-grid"><div><span>เหตุที่พิสูจน์ได้</span><b>'+d.cause+'</b></div><div><span>หลักฐาน</span><b>'+d.evidence+'</b></div><div><span>Source</span><b>'+d.source+'</b></div><div><span>ผู้เกี่ยวข้อง</span><b>'+(person?escape(person.name)+' #'+person.id:'เหตุการณ์ระดับโลก')+'</b></div></div>'+
   (d.status==='UNKNOWN'?'<p class="event-warning">UNKNOWN ไม่ถูกนับเป็นเหตุผลย้อนหลัง · UI จะไม่เอา decision trace ปัจจุบันไปแทนอดีต</p>':'')+
   '<div class="system-actions">'+actions+'</div>'+
   (person?.alive?'<p class="source-note">“Why ปัจจุบัน” คือเหตุผลของ decision ล่าสุดของ Clone ตอนนี้ ไม่ใช่หลักฐานว่าคิดแบบเดียวกันตอนเหตุการณ์นี้</p>':'')+
   '</article>');
  $('dialog').dataset.kind='event';renderHUD();
 }
 function openHistory(){historyFilter='all';api.openDialog('เรื่องเล่าที่เกิดขึ้นจริง','WORLD CHRONICLE',`<p class="history-limit">เหตุการณ์ล่าสุด ไม่ใช่ระบบย้อนเวลา · แตะเหตุการณ์เพื่อดูหลักฐาน สาเหตุที่พิสูจน์ได้ และสิ่งที่ยัง UNKNOWN</p><div class="search-control">${icon('search')}<label class="sr-only" for="story-search">ค้นหาเหตุการณ์</label><input id="story-search" type="search" placeholder="ค้นหาชื่อหรือเหตุการณ์"></div><div class="filter-tabs">${[['all','ทั้งหมด'],['birth','ชีวิตใหม่'],['skill','ทักษะ'],['build','บ้าน']].map(([id,t])=>`<button data-history-filter="${id}">${t}</button>`).join('')}</div><p id="history-count" class="list-count"></p><div id="history-list"></div>`);$('dialog').dataset.kind='history';renderHistoryList();renderHUD();}
 function renderHistoryList(){if(!$('history-list'))return;const s=api.read().state,q=$('story-search').value.toLocaleLowerCase(),list=s.events.filter(e=>(historyFilter==='all'||e.type===historyFilter)&&e.text.toLocaleLowerCase().includes(q));
  setText('history-count',`${list.length} เหตุการณ์ · เก็บล่าสุดไม่เกิน 120 รายการ`);
  document.querySelectorAll('[data-history-filter]').forEach(b=>{const on=b.dataset.historyFilter===historyFilter;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  $('history-list').innerHTML=list.slice().reverse().map(e=>`<button class="history-event" data-story="${e.id}"><small>วันที่ ${1+Math.floor(e.tick/360)} · ${events[e.type]||escape(e.type)}</small><p>${escape(e.text)}</p><span>ดูเหตุ → หลักฐาน →</span></button>`).join('')||'<p class="empty-state">ยังไม่มีเหตุการณ์ประเภทนี้</p>';
 }
 function openClone(){
  const s=api.read().state,parent=s.agents.find(a=>a.id===api.read().selected&&a.alive)||living(s)[0];
  if(!parent){api.toast('ยังไม่มีต้นแบบที่มีชีวิตอยู่');return;}
  api.select(parent.id,false);const p=api.preview('CLONE',{parentId:parent.id});
  api.openDialog('ส่งต่อสิ่งที่เรียนรู้','CREATE A CLONE',`<div class="clone-lineage"><div>${api.portrait(parent)}<b>${escape(parent.name)}</b><small>ต้นแบบ · รุ่น ${parent.generation}</small></div><span>→</span><div class="new-life">${icon('clone')}<b>ชีวิตใหม่</b><small>รุ่น ${parent.generation+1}</small></div></div><button class="text-link" data-ux="choose-parent">เลือกต้นแบบคนอื่น →</button><p>ใช้ <b>อาหาร 8 + ไม้ 4</b> · ที่พัก ${living(s).length} / ${capacity(s)} คน<br>รับ 35% ของ XP แต่ละทักษะ แล้วเลือกงานและเรียนรู้ต่อเอง</p><div class="clone-skills">${SKILLS.map(k=>`<div><span>${roles[k]}</span><b>${parent.skills[k]} <small>→</small> ${p.agent?p.agent.skills[k]:'—'} XP</b></div>`).join('')}</div><p class="clone-validity ${p.ok?'':'error'}" role="status">${p.ok?'พร้อมสร้าง · จะแสดงตัวละครใหม่หลังยืนยัน':escape(p.message)}</p><div class="dialog-actions"><button class="primary" data-action="confirm-clone" ${p.ok?'':'disabled'}>ยืนยันสร้าง Clone</button><button class="secondary" data-action="cancel">ยกเลิก</button></div><p class="source-note">คำสั่งนี้สร้าง Clone วัยผู้ใหญ่อายุ 18 ปีทันที · การเกิดอัตโนมัติเป็นอีกระบบหนึ่ง เด็กเริ่มอายุ 0 ปีแล้วค่อยเติบโต</p>`);$('dialog').dataset.kind='clone';
 }
 function openRust(){const s=api.read().state;api.openDialog('ไอเทมและการคราฟต์','RUST SURVIVAL · RS1–RS4',rustPanel(s,api));$('dialog').dataset.kind='rust';}
 function openSurvival(){
  const s=api.read().state,v=survivalSummary(s),eco=createResourceEcologyShadow(s),pressure=shadowExistingResourcePressure(s,eco),hydro={summary:eco.hydrologySummary},regen=createResourceRegenerationShadow(s,eco),foodImpact=createFoodRegenerationImpact(s,regen),foodCalibration=createFoodEcologyCalibration(s,foodImpact);
  const topPressure=pressure.rows.slice().sort((a,b)=>b.regenerationPressure-a.regenerationPressure||a.id-b.id)[0]??null;
  const topFood=eco.hotspots.food[0]??null,topWood=eco.hotspots.wood[0]??null,topStone=eco.hotspots.stone[0]??null;
  const dominantSoil=Object.entries(eco.soilCounts??{}).filter(([type])=>type!=='none').sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]??null;
  api.openDialog('หมู่บ้านอยู่รอดอย่างไร','SURVIVAL CORE · '+VERSION,
   `<div class="life-summary"><div><small>อาหารที่ใช้ได้ตอนนี้</small><b>${v.freeFood} หน่วย</b></div><div><small>จองไว้ให้คนกิน</small><b>${v.reservedMeals} หน่วย</b></div></div>
    <p>มีอาหารทั้งหมด ${v.food} หน่วย · เป้าสำรอง ${v.targets.food} หน่วย<br>คนความอิ่มต่ำกว่า 35: ${v.hungry} คน · พลังงานต่ำกว่า 12: ${v.exhausted} คน</p>
    <div class="clone-skills"><div><span>แหล่งทรัพยากรที่มีคนจอง</span><b>${v.nodeJobs} จุด</b></div><div><span>คนที่จองงานก่อสร้าง</span><b>${v.builders} คน</b></div><div><span>บ้านที่กำลังสร้าง</span><b>${v.unfinished} หลัง</b></div><div><span>ไม้ / เป้าสำรอง</span><b>${v.stock.wood} / ${v.targets.wood}</b></div><div><span>หิน / เป้าสำรอง</span><b>${v.stock.stone} / ${v.targets.stone}</b></div></div>
    <p class="source-note">แหล่งทรัพยากรรับคนทำงานครั้งละ 1 คน · บ้านรับคนสร้างได้ 2 คนพร้อมกัน<br>เลือกแหล่งที่ไปถึงได้ตามระยะเดินจริง ไม่วัดแค่ความใกล้บนจอ<br>เมื่อหิว คนเก็บอาหารกินผลผลิต 1 หน่วยที่จุดเก็บได้ ส่วนที่เหลือเข้าคลังรวม<br>คิดเป้าสำรองรวมผลผลิตของงานที่มีคนจองแล้ว งานชุดสุดท้ายอาจทำให้เกินเป้าได้เล็กน้อย</p>
    <div class="life-summary"><div><small>Cultural Archive · คลังความรู้ที่แคมป์</small><b>${s.culture?s.culture.entries.length+' / '+CULTURE_RULES.entries+' รายการ':'ยังไม่สร้าง'}</b></div><div>${s.culture?`<button class="secondary" data-ux="culture-automation" data-enabled="${!s.culture.automation}">${s.culture.automation?'หยุด':'เปิด'}บันทึกและอ่านอัตโนมัติ</button>`:`<button class="secondary" data-ux="create-archive">สร้างคลัง · ไม้ ${CULTURE_RULES.woodCost} + หิน ${CULTURE_RULES.stoneCost}</button>`}</div></div>
    <p class="source-note">ผู้ค้นพบตายได้ แต่ข้อมูลที่เขียนไว้ยังอ่านได้ · อ่านแล้วเริ่มเป็น “ยังไม่ยืนยัน” และไม่เพิ่ม XP · บันทึก/อ่านในระยะ ${CULTURE_RULES.range} ช่องจากแคมป์ · เก็บประวัติแก้ไขล่าสุด ${CULTURE_RULES.history} ครั้งต่อรายการ</p>
    ${s.culture?.entries.length?`<details class="score-details"><summary>เปิดรายการความรู้ในคลัง</summary>${s.culture.entries.map(e=>`<div class="memory-item"><b>${escape(e.key)} · ฉบับ ${e.revision}</b><small>บันทึกโดย ${escape(findPerson(s,e.authorId)?.name??('#'+e.authorId))} · tick ${e.publishedTick}</small><p>ตำแหน่ง ${e.value.x}, ${e.value.y}</p><button class="secondary" data-ux="read-archive" data-key="${escape(e.key)}">ให้ตัวละครที่เลือกอ่าน</button></div>`).join('')}</details>`:''}
    <div class="life-summary"><div><small>Personal Knowledge Planner</small><b>${s.planningPolicy?'ความรู้ส่วนตัว':'Survival เดิม'}</b></div><div><small>เปลี่ยนกฎการหาแหล่งทรัพยากร</small><button class="secondary" data-ux="planning-policy" data-policy="${s.planningPolicy?'legacy':'local'}">${s.planningPolicy?'กลับนโยบายเดิม':'ใช้ความรู้ส่วนตัว'}</button></div></div>
    <p class="source-note">โหมดความรู้ส่วนตัวเห็นแหล่งในระยะ 4 ช่อง · จุดที่จำได้ต้องเดินไปตรวจ ไม่อ่านจำนวนทรัพยากรที่อยู่นอกสายตา · แผนที่ทางเดินและคลังกลางยังเป็นข้อมูลส่วนรวม</p>\n    ${rustPanel(s,api)}
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
    <div class="clone-skills"><div><span>Very low</span><b>${foodImpact.summary.bands['very-low']} nodes</b></div><div><span>Low</span><b>${foodImpact.summary.bands.low} nodes</b></div><div><span>Medium</span><b>${foodImpact.summary.bands.medium} nodes</b></div><div><span>High</span><b>${foodImpact.summary.bands.high} nodes</b></div><div><span>p10 / p50 / p90</span><b>${foodImpact.summary.p10} / ${foodImpact.summary.p50} / ${foodImpact.summary.p90}</b></div><div><span>Depleted / low-ecology depleted</span><b>${foodImpact.summary.depletedNodes} / ${foodImpact.summary.lowPotentialDepletedNodes}</b></div><div><span>Legacy boundary units / low-ecology</span><b>${foodImpact.summary.projectedLegacyBoundaryUnits} / ${foodImpact.summary.projectedLowEcologyBoundaryUnits}</b></div><div><span>Current writer</span><b>${escape(foodImpact.authority.writer)}</b></div><div><span>Legacy food regen</span><b>+3 / 120 ticks</b></div><div><span>Candidate unit formula</span><b>none</b></div></div>
    <p class="source-note">WM4.2 วัด distribution ของ ecology regeneration potential เทียบกับ food behavior เดิมเท่านั้น · writer อยู่ที่ WorldSim WM4.1 แล้ว แต่ยังไม่แปลง ecology เป็นจำนวนหน่วย, ไม่เปลี่ยน node.amount และไม่เปลี่ยน cadence</p>
    <div class="life-summary"><div><small>WM4.3 · ecology calibration</small><b>read-only</b></div><div><small>Raw min / max</small><b>${foodCalibration.summary.rawMin} / ${foodCalibration.summary.rawMax}</b></div></div>
    <div class="clone-skills"><div><span>Raw p10 / p50 / p90</span><b>${foodCalibration.summary.rawP10} / ${foodCalibration.summary.rawP50} / ${foodCalibration.summary.rawP90}</b></div><div><span>Relative q1</span><b>${foodCalibration.summary.relativeBands.q1}</b></div><div><span>Relative q2</span><b>${foodCalibration.summary.relativeBands.q2}</b></div><div><span>Relative q3</span><b>${foodCalibration.summary.relativeBands.q3}</b></div><div><span>Relative q4</span><b>${foodCalibration.summary.relativeBands.q4}</b></div><div><span>Unit formula</span><b>none</b></div></div>
    <p class="source-note">Calibration ใช้ empirical rank ของ food nodes ปัจจุบันเพื่อแก้ปัญหา raw ecology scale ที่ไม่ได้กระจายเต็ม 0–1 · ยังไม่มี gameplay mutation</p>
    <div class="clone-skills"><div><span>เกิดเองแล้ว</span><b>${v.autonomousBirths} คน</b></div><div><span>สถานะการเกิดอัตโนมัติ</span><b>${birthLabels[v.birth.reason]??v.birth.reason}</b></div></div>
    <div class="clone-skills"><div><span>ตัวตนที่ยังเก็บประวัติไว้</span><b>${retainedCount(s)} / ${HISTORY_LIMITS.maxRetained}</b></div><div><span>ย้ายเข้าคลังประวัติแล้ว</span><b>${s.archive.length} คน</b></div></div>
    <p class="source-note">คลังประวัติยังค้นต้นแบบและทักษะของคนตายได้ เมื่อจำนวนหรือพื้นที่ประวัติเต็ม ระบบหยุดเพิ่มคนโดยไม่ลบบรรพบุรุษ ไม่ใช่โลกที่เก็บประวัติได้ไม่จำกัด</p>
    <p class="source-note">เงื่อนไขเกิดเอง: ที่พักต้องว่าง · ต้องมีผู้ใหญ่พร้อม · อาหารว่างต้องพอจ่าย 8 แล้วยังเหลือถึงเป้ารุ่นถัดไป · ไม้จ่าย 4 แล้วยังเหลืออย่างน้อย 12 · เว้นการเกิดอย่างน้อย ${BIRTH_RULES.globalIntervalYears} ปีจำลอง และ parent คนเดิมพัก ${BIRTH_RULES.parentCooldownYears} ปี<br>ช่วงวัยทำงานแล้ว: เด็กไม่รับงานผลิต · ผู้ใหญ่เต็มกำลัง · ผู้สูงวัยทำงานผลิตที่ 75% · อายุขัย derive 78–92 ปีและเสียชีวิตตามวัยแบบ deterministic</p>`);
  $('dialog').dataset.kind='survival';
 }
 function openGuide(){api.openDialog('เริ่มจากการดูโลกที่กำลังคิดเอง','OBSERVE → UNDERSTAND → TRACE',`<div class="guide-step"><span>01</span><div><b>เปิด “ระบบโลก”</b><p>ดูว่า Housing, Production, Inventory, Knowledge, Ecology และระบบอื่นกำลัง LIVE, READY หรือ SHADOW</p></div></div><div class="guide-step"><span>02</span><div><b>แตะ Clone ที่สนใจ</b><p>ดูสิ่งที่กำลังทำ กระเป๋า อุปกรณ์ ทักษะ ความรู้ ความสัมพันธ์ และกด “ทำไม?” เพื่อดูเหตุผลจริง</p></div></div><div class="guide-step"><span>03</span><div><b>ปล่อยให้โลกสร้างเรื่องของมันเอง</b><p>บ้านและวงจรพื้นฐานเดินอัตโนมัติ การโคลนแบบ manual ยังอยู่ใน Inspector แต่ไม่ใช่แกนหลักของเกม</p></div></div><div class="help-block">ลากแผนที่เพื่อเลื่อน · จีบนิ้วหรือกด + / − เพื่อซูม<br>หน้าต่างข้อมูลหยุดเวลา · ปิดเว็บแล้วโลกหยุด ไม่มีการเดินเวลาขณะออฟไลน์</div><div class="dialog-actions"><button class="primary" data-action="cancel">กลับไปดูโลก</button></div>`);$('dialog').dataset.kind='guide';}
 return {renderInspector,renderHUD,openRoster,openHistory,openEvent,openClone,openRust,openSurvival,openSystems,openDecisionFeed};
}
