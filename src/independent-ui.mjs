/** Independent-world presentation only. All writes use the engine bridge/preview. */
import {isIndependent,resourceStock,materialTotals,guardianOf,resourceAccount} from './individual-resources.mjs?v=0.5.0';
import {individualHouses,homeOf,survivalHome} from './individual-housing.mjs?v=0.5.0';
import {personalHomeIntent} from './individual-home-planning.mjs?v=0.5.0';
import {householdOf,householdForOwner,activeResidenceOf,relationshipOf} from './relationships.mjs?v=0.5.0';
import {cohabitationCandidate} from './cohabitation.mjs?v=0.5.0';
import {leadershipProfile} from './leadership.mjs?v=0.5.0';
import {householdEconomySnapshot} from './kingdom-household-economy.mjs?v=0.5.0';
import {householdRecruitmentOffers} from './kingdom-household-organization.mjs?v=0.5.0';
import {ITEM_CATALOG,RECIPE_CATALOG} from './crafting-catalog.mjs?v=0.5.0';
import {walkable} from './survival.mjs?v=0.5.0';
import {edgeCells} from './rust-stations.mjs?v=0.5.0';
import {allSettlementSnapshots} from './settlement-authority.mjs?v=0.5.0';
import {autonomousLifeSnapshot} from './autonomous-life-view.mjs?v=0.5.0';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=v=>{const n=Number(v)||0,s=Number.isInteger(n)?String(n):n.toFixed(2);return n>0?'+'+s:s;};
export function installIndependentUI(api){
 const $=id=>document.getElementById(id);
 const card=document.createElement('div');card.id='personal-home-summary';card.className='personal-home-summary';
 $('inspector').append(card);
 const labels={INELIGIBLE:'ยังไม่ถึงวัยสร้างบ้าน',COHABITING:'อยู่ร่วม household · หยุดสร้างบ้านตัวเองชั่วคราว',HOME_COMPLETE:'บ้านเสร็จแล้ว',NO_SITE:'กำลังหาพื้นที่',NEED_HAMMER:'เตรียมโต๊ะและค้อนส่วนตัว',EQUIP_HAMMER:'กำลังสวมค้อน',NEED_MATERIALS:'หาไม้และหินส่วนตัว',CRAFT_PIECE:'คราฟต์ชิ้นส่วนบ้าน',PLACE_PIECE:'นำชิ้นส่วนไปก่อสร้าง'};
 const button=(id,name)=>'<button class="secondary" data-person="'+id+'">'+esc(name)+'</button>';
 function update(){
  const {state:s,selected}=api.read(),a=s.agents.find(a=>a.id===selected),on=isIndependent(s);
  const settlements=on?allSettlementSnapshots(s).filter(x=>x.status==='active'):[];
  document.body.classList.toggle('independent-world',on);
  const heading=document.querySelector('.settlement h1'),eyebrow=document.querySelector('.settlement .eyebrow');
  if(heading)heading.textContent=on?(settlements.length?'Settlement เกิดเอง '+settlements.length+' แห่ง':'ต่างคนต่างเริ่มชีวิต'):'หมู่บ้านต้นกำเนิด';
  if(eyebrow)eyebrow.textContent=on?(settlements.length?'EMERGENT SETTLEMENT · MX7':'INDEPENDENT CLONE WORLD'):'YOUR FIRST SETTLEMENT';
  const populationLabel=document.querySelector('.population small');if(populationLabel)populationLabel.textContent=on?'คนในโลก':'คน / ที่พัก';
  const recenter=$('recenter');if(recenter){recenter.setAttribute('aria-label',on?'ดูภาพรวมโลก':'กลับหมู่บ้าน');recenter.title=on?'ดูภาพรวมโลก':'กลับหมู่บ้าน';}
  const auto=$('autonomy-status');if(on&&auto){auto.querySelector('b').textContent='PERSONAL AUTONOMY · ACTIVE';if(!s.agents.some(a=>a.alive&&a.trace?.some(t=>t.status==='selected')))auto.querySelector('span').textContent='แต่ละคนหากินและสร้างบ้านของตัวเอง';}
  let resourceScope=$('resource-scope');if(!resourceScope){resourceScope=document.createElement('small');resourceScope.id='resource-scope';document.querySelector('.resources').after(resourceScope);}
  resourceScope.hidden=!on;resourceScope.textContent=on?(a?(resourceAccount(s,a).kind==='household'?'ทรัพยากร Household · บ้าน '+resourceAccount(s,a).houseId:'ทรัพยากรชั่วคราวของ '+a.name):'ผลรวมทุก Household/คนไร้บ้าน · อ่านอย่างเดียว'):'';

  if(!card.isConnected)$('inspector').insertBefore(card,$('inspector-detail'));
  const marker=$('seed-label');if(on)marker.textContent=(settlements.length?'SETTLEMENT '+settlements.length+' · ':'ชีวิตอิสระ · ')+'SEED '+s.seed;
  card.hidden=!on||!a;
  if(on&&$('dialog').open){
   const kind=$('dialog').dataset.kind,homes=individualHouses(s).filter(h=>h.complete),housing=$('dialog').querySelector('[data-system-card="housing"]');
   const production=$('dialog').querySelector('[data-system-card="production"]');if(production){production.querySelector('strong').textContent='Personal autonomy';const badge=production.querySelector('.system-badge');if(badge){badge.textContent='LIVE';badge.className='system-badge live';}}
   if(housing){housing.querySelector('strong').textContent=homes.length+' บ้านส่วนตัว';housing.querySelector('details p').textContent='เจ้าของแต่ละคนสร้างและใช้บ้านของตัวเอง ไม่มีโควตาบ้านกลาง';}
   if(kind==='survival')for(const tile of $('dialog').querySelectorAll('.menu-metric'))if(['ที่พัก','บ้านส่วนตัว'].includes(tile.querySelector('small')?.textContent)){tile.querySelector('small').textContent='บ้านส่วนตัว';tile.querySelector('b').textContent=homes.length;}
   if(kind==='rust'){
    const stock=resourceStock(s,a);for(const tile of $('dialog').querySelectorAll('.menu-metric')){const label=tile.querySelector('small')?.textContent;if(label==='ถ่าน'&&a)tile.querySelector('b').textContent=stock.charcoal??0;if(label==='สถานี'&&a)tile.querySelector('b').textContent=s.rustStations.stations.filter(st=>st.placedBy===a.id).length;if(label==='RP1'){tile.querySelector('small').textContent='Personal AI';tile.querySelector('b').textContent='ON';}}
    const toggle=$('dialog').querySelector('[data-ux="production-policy"]');if(toggle)toggle.hidden=true;
   }
   if(kind==='clone'){const p=$('dialog-body').querySelector('p');if(p)p.textContent='ใช้ทรัพย์สินของต้นแบบ: อาหาร 8 + ไม้ 4 · ไม่ใช้โควตาบ้านกลาง · Clone ผู้ใหญ่เริ่มชีวิตแยกและสืบทอด Skill XP 35%';}
   if(['systems','survival','rust'].includes(kind)&&!$('independent-mode-note')){const note=document.createElement('p');note.id='independent-mode-note';note.className='source-note';note.textContent='ชีวิตอิสระ · ตัวเลขรวมใช้ดูภาพรวมเท่านั้น ไม่มีคลังวัสดุกลาง';$('dialog-body').prepend(note);}
  }
  if(!on||!a)return;
  const stock=resourceStock(s,a),h=homeOf(s,a.id),guardian=guardianOf(s,a),intent=personalHomeIntent(s,a,walkable);
  const residence=activeResidenceOf(s,a.id),household=householdOf(s,a.id),candidate=residence?null:cohabitationCandidate(s,a);
  const householdOwner=household?[...s.agents,...s.archive].find(p=>p.id===household.ownerId):null;
  const relation=householdOwner&&householdOwner.id!==a.id?relationshipOf(s,a.id,householdOwner.id):null;
  const leadership=householdOwner?leadershipProfile(s,householdOwner.id):null;
  const account=resourceAccount(s,a),life=autonomousLifeSnapshot(s,a.id);
  const lifePressure=life?.household?.topOffer?'<span>แรงกดดัน Household <b>'+esc(life.household.topOffer.label||life.household.topOffer.role)+'</b> · '+esc(life.household.topOffer.urgency)+'</span>':'';
  const lifeWhy=life?.decision?.reason==='selected-trace'
    ?'<details data-autonomous-why><summary>ทำไมเลือกงานนี้? · Score '+life.decision.score+'</summary><div class="personal-stock">'+life.decision.factors.map(f=>'<span>'+esc(f.label)+' <b>'+esc(signed(f.value))+'</b></span>').join('')+'</div><small>'+(life.decision.scoreMatches?'✓ ตรงกับ engine trace':'UNKNOWN · score ไม่ตรงกับ factors')+'</small></details>'
    :'<details data-autonomous-why><summary>ทำไมเลือกงานนี้?</summary><small>UNKNOWN · ไม่มี selected trace ที่ตรงกับงานปัจจุบัน</small></details>';
  const lifeHtml=life?'<div class="household-summary autonomous-life-summary" data-autonomous-life="'+a.id+'"><small>Autonomous Life · VAL1</small><span>ตอนนี้ <b>'+esc(life.currentAction?.label??'ยังไม่มีงานปัจจุบัน')+'</b></span><span>แผนบ้าน <b>'+esc(life.homePlan.label)+'</b></span>'+lifePressure+lifeWhy+'</div>':'';
  const homeLabel=residence&&householdOwner?'อยู่ร่วมบ้านของ '+esc(householdOwner.name):h?(h.complete?'บ้านของ '+esc(a.name):'กำลังสร้าง '+esc(h.houseId)):(guardian?'พักกับ '+esc(guardian.name):'ยังไม่มีบ้านส่วนตัว');
  const homeAction=residence?'<button class="secondary" data-leave-household="'+a.id+'">ออกจาก household</button>':h?'<button class="secondary" data-own-home="'+a.id+'">ดูบ้าน</button>':candidate?'<button class="secondary" data-join-household="'+candidate.ownerId+'">ขออยู่ร่วมบ้าน</button>':'';
  const members=household?household.residentIds.map(id=>[...s.agents,...s.archive].find(p=>p.id===id)?.name??('#'+id)).join(', '):'';
  const social=household?'<div class="household-summary" data-household-owner="'+household.ownerId+'"><small>Household · '+esc(householdOwner?.name??'#'+household.ownerId)+'</small><span>'+esc(members)+'</span>'+(leadership?'<span>Leadership <b>Lv.'+leadership.level+'</b> · Followers <b>'+leadership.activeFollowers+'/'+leadership.followerCapacity+'</b></span>':'')+(relation?'<span>Trust <b>'+relation.trust+'</b> · Affinity <b>'+relation.affinity+'</b> · Respect <b>'+relation.respect+'</b></span>':'')+'</div>':'';
  const html='<div><b>⌂ '+homeLabel+'</b>'+homeAction+'</div><small>'+esc(labels[intent.kind]??intent.kind)+'</small>'+lifeHtml+social+'<small>'+(account.kind==='household'?'ทรัพยากรร่วมของบ้าน '+esc(account.houseId):'ทรัพยากรชั่วคราวส่วนตัว')+'</small><div class="personal-stock" data-owner="'+a.id+'"><span>อาหาร <b>'+stock.food+'</b></span><span>ไม้ <b>'+stock.wood+'</b></span><span>หิน <b>'+stock.stone+'</b></span></div>';
  if(card.innerHTML!==html)card.innerHTML=html;
 }
 function openHome(h){
  const s=api.read().state,owner=[...s.agents,...s.archive].find(a=>a.id===h.ownerId),actor=s.agents.find(a=>a.id===api.read().selected&&a.alive),stock=resourceStock(s,h.ownerId);
  const data={agentId:actor?.id??null,houseId:h.houseId},preview=api.preview('CREATE_ARCHIVE',data),household=householdForOwner(s,h.ownerId);
  const currentResidence=actor?activeResidenceOf(s,actor.id):null,joinPreview=actor&&actor.id!==h.ownerId?api.preview('JOIN_HOUSEHOLD',{agentId:actor.id,ownerId:h.ownerId}):null;
  const residents=(household?.residentIds??[h.ownerId]).map(id=>[...s.agents,...s.archive].find(p=>p.id===id)?.name??('#'+id)).join(', ');
  const residenceAction=currentResidence?.ownerId===h.ownerId?'<button class="secondary" data-leave-household="'+actor.id+'">ออกจาก household</button>':joinPreview?.ok?'<button class="primary" data-join-household="'+h.ownerId+'">อยู่ร่วมบ้านนี้</button>':'';
  const ownArchive=s.culture?.houseId===h.houseId,economy=owner?householdEconomySnapshot(s,owner.id):null,recruitment=owner?householdRecruitmentOffers(s,owner.id):[];
  const topRecruitment=recruitment[0]??null;
  const recruitmentHtml=topRecruitment?'<p data-household-recruitment><b>กำลังรับคน:</b> '+esc(topRecruitment.label)+' · '+esc(topRecruitment.urgency)+' · ผู้สมัคร '+topRecruitment.candidateIds.length+' · slot '+topRecruitment.availableFollowerSlots+'</p>':'';
  const econ=economy?'<div class="household-economy" data-household-economy="'+esc(h.houseId)+'"><p><b>Household Economy</b> · Food '+economy.stock.food+' · Wood '+economy.stock.wood+' · Stone '+economy.stock.stone+' · Charcoal '+economy.stock.charcoal+'</p><p>Scarcity — Food '+economy.economy.scarcity.food+' · Wood '+economy.economy.scarcity.wood+' · Stone '+economy.economy.scarcity.stone+'</p><p>แรงงานที่ควรเสริม: '+esc(economy.labor.topOffer?.label??'สมดุล')+'</p>'+recruitmentHtml+'</div>':'';
  api.openDialog('บ้านของ '+(owner?.name??'ไม่ทราบเจ้าของ'),'PERSONAL HOME · '+h.houseId,
   '<section class="personal-house-detail" data-house="'+esc(h.houseId)+'" data-owner="'+(h.ownerId??'unknown')+'"><div class="personal-house-hero">⌂</div><h3>'+esc(h.complete?'สร้างเสร็จแล้ว':'กำลังก่อสร้าง · ขาด '+h.missing.length+' ชิ้น')+'</h3><p>เจ้าของ: '+esc(owner?.name??'UNKNOWN')+' · '+h.origin.x+', '+h.origin.y+'</p>'+
   (owner?button(owner.id,'เลือก '+owner.name):'')+'<p data-household-residents>Household: '+esc(residents)+'</p>'+residenceAction+econ+'<p>ทรัพยากรของ Household — อาหาร '+stock.food+' · ไม้ '+stock.wood+' · หิน '+stock.stone+'</p><p class="source-note">เจ้าของมาจากผู้วางฐาน #'+h.originStationId+' · ownership บ้านไม่เปลี่ยน · ทรัพยากรดิบแชร์ใน Household</p>'+
   (ownArchive?'<p>คลังความรู้สาธารณะอยู่ที่บ้านนี้ · '+s.culture.entries.length+' เรื่อง</p><button class="secondary" data-home-archive="'+esc(h.houseId)+'">อ่านคลังความรู้</button>':h.complete&&!s.culture?'<button class="primary" data-create-home-archive="'+esc(h.houseId)+'" '+(preview.ok?'':'disabled')+'>เปิดคลังความรู้ที่บ้าน</button><p class="source-note">'+esc(preview.ok?'ใช้ไม้ 6 และหิน 2 จาก resource account ปัจจุบัน':preview.message)+'</p>':'')+'</section>');
  $('dialog').dataset.kind='personal-home';
 }
 function openStructure(target){
  const s=api.read().state;if(!isIndependent(s))return false;
  const st=s.rustStations.stations.find(st=>st.id===target.id);
  if(target.type!=='station'||!st)return false;
  if(!st.structurePiece){
   const actor=s.agents.find(a=>a.id===api.read().selected&&a.alive),owner=[...s.agents,...s.archive].find(a=>a.id===st.placedBy),stock=resourceStock(s,actor);
   const actions=st.kind==='FURNACE'?[{type:'PROCESS_CHARCOAL',data:{agentId:actor?.id,stationId:st.id},label:'ไม้ 2 → ถ่าน 1'}]:Object.values(RECIPE_CATALOG).filter(r=>r.station===st.kind).map(r=>({type:'CRAFT_ITEM',data:{agentId:actor?.id,recipeId:r.id,stationId:st.id},label:ITEM_CATALOG[r.output].name}));
   api.openDialog(ITEM_CATALOG[st.kind]?.name??st.kind,'PERSONAL STATION · #'+st.id,'<p>เจ้าของ: '+esc(owner?.name??'UNKNOWN')+'</p>'+button(st.placedBy,'เลือกเจ้าของสถานี')+'<p>ทรัพยากรที่คนนี้มีสิทธิ์ใช้: ไม้ '+stock.wood+' · หิน '+stock.stone+'</p>'+actions.map(x=>{const check=api.preview(x.type,x.data);return '<button class="primary" data-personal-command="'+x.type+'" data-station="'+st.id+'" data-recipe="'+(x.data.recipeId??'')+'" '+(check.ok?'':'disabled')+'>'+esc(x.label)+'</button><p class="source-note">'+esc(check.ok?'พร้อมทำงาน':check.message)+'</p>';}).join(''));
   $('dialog').dataset.kind='personal-station';return true;
  }
  const anchors=st.socket?.type==='edge'?edgeCells(st.socket):[{x:st.x,y:st.y}];
  const h=individualHouses(s).find(h=>h.cells.some(c=>anchors.some(p=>p.x===c.x&&p.y===c.y)));
  if(!h)return false;openHome(h);return true;
 }
 function openArchive(){
  const {state:s,selected}=api.read();
  api.openDialog('คลังความรู้ที่บ้าน','CULTURAL ARCHIVE',s.culture.entries.map(e=>'<section class="memory-item"><b>'+esc(e.key)+'</b><p>บันทึกโดย #'+e.authorId+' · ฉบับ '+e.revision+'</p><button class="secondary" data-read-home-archive="'+esc(e.key)+'" '+(selected===null?'disabled':'')+'>อ่านด้วย Clone ที่เลือก</button></section>').join('')||'<p>ยังไม่มีบันทึก · เจ้าของและผู้มาเยือนสามารถเผยแพร่ความรู้ที่ยืนยันแล้วในระยะ 4 ช่อง</p>');
  $('dialog').dataset.kind='home-archive';
 }
 $('inspector').addEventListener('click',e=>{
  const join=e.target.closest('[data-join-household]');if(join){const r=api.execute('JOIN_HOUSEHOLD',{agentId:api.read().selected,ownerId:Number(join.dataset.joinHousehold)});api.toast(r.message);if(r.ok)api.save();return;}
  const leave=e.target.closest('[data-leave-household]');if(leave){const r=api.execute('LEAVE_HOUSEHOLD',{agentId:Number(leave.dataset.leaveHousehold)});api.toast(r.message);if(r.ok)api.save();return;}
  const b=e.target.closest('[data-own-home]');if(!b)return;
  const h=homeOf(api.read().state,Number(b.dataset.ownHome));if(h){api.center(h.origin);openHome(h);}
 });
 $('dialog-body').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.joinHousehold){const r=api.execute('JOIN_HOUSEHOLD',{agentId:api.read().selected,ownerId:Number(b.dataset.joinHousehold)});api.toast(r.message);if(r.ok){api.save();api.closeDialog();}return;}
  if(b.dataset.leaveHousehold){const r=api.execute('LEAVE_HOUSEHOLD',{agentId:Number(b.dataset.leaveHousehold)});api.toast(r.message);if(r.ok){api.save();api.closeDialog();}return;}
  if(b.dataset.createHomeArchive){const r=api.execute('CREATE_ARCHIVE',{agentId:api.read().selected,houseId:b.dataset.createHomeArchive});api.toast(r.message);if(r.ok){api.save();openHome(homeOf(api.read().state,api.read().selected));}}
  if(b.dataset.personalCommand){const r=api.execute(b.dataset.personalCommand,{agentId:api.read().selected,stationId:Number(b.dataset.station),recipeId:b.dataset.recipe});api.toast(r.message);if(r.ok){api.save();api.closeDialog();}}
  if(b.dataset.homeArchive)openArchive();
  if(b.dataset.readHomeArchive){const r=api.execute('READ_ARCHIVE',{agentId:api.read().selected,key:b.dataset.readHomeArchive});api.toast(r.message);if(r.ok)api.save();}
 });
 function openWorldObject(target){
  const s=api.read().state;
  if(target.type==='event'){api.openEvent(target.id);return;}
  if(target.type==='resource'){
   const n=s.nodes.find(n=>n.id===target.id);if(!n)return;
   const name={food:'อาหาร',wood:'ไม้',stone:'หิน'}[n.type],workers=s.agents.filter(a=>a.alive&&a.task?.targetId===n.id&&['FORAGE','WOODCUT','MINE'].includes(a.task.kind));
   api.openDialog(name,'RESOURCE · #'+n.id,'<section data-resource="'+n.id+'"><h3>'+n.amount+' / '+n.max+'</h3><p>ตำแหน่ง '+n.x+', '+n.y+'</p><p>'+(workers.length?'กำลังทำงาน: '+workers.map(a=>esc(a.name)).join(', '):'ยังไม่มีผู้ทำงาน')+'</p><p class="source-note">ค่าจากแหล่งทรัพยากรจริง ไม่ใช่สิ่งที่ Clone ทุกคนรู้</p></section>');
  }else if(target.type==='drop'){
   const i=s.rustPossessions.items.find(i=>i.id===target.id&&i.location?.kind==='drop');if(!i)return;
   const preview=api.preview('PICKUP_ITEM',{agentId:api.read().selected,itemId:i.id});
   api.openDialog(ITEM_CATALOG[i.kind]?.name??i.kind,'DROPPED ITEM · #'+i.id,'<section data-drop="'+i.id+'"><p>Item instance #'+i.id+' · createdBy #'+i.createdBy+' · createdTick '+i.createdTick+'</p><p>'+i.location.x+', '+i.location.y+'</p><button class="primary" data-pickup-world="'+i.id+'" '+(preview.ok?'':'disabled')+'>เก็บเข้ากระเป๋าคนที่เลือก</button><p>'+esc(preview.message)+'</p></section>');
  }else return;
  $('dialog').dataset.kind='world-object';$('dialog').dataset.worldObject=target.type+':'+target.id;
 }
 $('dialog-body').addEventListener('click',e=>{const b=e.target.closest('[data-pickup-world]');if(!b)return;const r=api.execute('PICKUP_ITEM',{agentId:api.read().selected,itemId:Number(b.dataset.pickupWorld)});api.toast(r.message);if(r.ok){api.save();api.closeDialog();}});
 return {update,openStructure,openWorldObject};
}
