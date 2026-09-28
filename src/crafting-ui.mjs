/** Read-only RC2 presentation. Commands remain in the existing engine/UI bridge. */
import {BLUEPRINT_ITEM_KIND,validBlueprintItem} from './craft-blueprints.mjs?v=0.5.0';
import {ITEM_CATALOG,CRAFT_RECIPE_CATALOG,recipeById} from './crafting-catalog.mjs?v=0.5.0';
import {recipeKnowledgeSnapshot,RECIPE_KNOWLEDGE_LIMITS} from './craft-recipe-knowledge.mjs?v=0.5.0';
import {craftPreview,equipmentSlotOf,blueprintLearningPreview} from './rust-possessions.mjs?v=0.5.0';
import {craftTrainingSnapshot} from './craft-training.mjs?v=0.5.0';
import {validateCraftedItem} from './craft-outcome.mjs?v=0.5.0';
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nameOf=(s,id)=>[...(s.agents??[]),...(s.archive??[])].find(a=>a.id===id)?.name??('#'+id);
const names={wood:'ไม้',stone:'หิน',food:'อาหาร'};
const stations={HAND:'ทำด้วยมือ',CRAFTING_TABLE_LV1:'โต๊ะคราฟต์ Lv1',FURNACE:'เตาหลอม'};
const tiers=['Primitive','Basic','Advanced','Rare','Epic','Masterwork'];
export const craftReasonLabel=reason=>({
  'blueprint-invalid':'หลักฐานพิมพ์เขียวไม่ถูกต้อง','recipe-known':'รู้สูตรนี้แล้ว · เก็บใบนี้ไว้ได้','loot-result-open':'กด Continue ปิดผลต่อสู้ก่อนเรียนสูตร','recipe-capacity':'สมุดสูตรเต็ม',
  ready:'พร้อมคราฟต์',off:'ไม่ได้เปิดฝึก', 'quota-complete':'ครบเป้าหมายแล้ว · ไม่รับงานเพิ่ม',
  'recipe-unknown':'ยังไม่รู้สูตร', 'recipe-knowledge':'หลักฐานสูตรไม่ถูกต้อง', 'training-state':'ข้อมูลแผนฝึกไม่ถูกต้อง',
  stage:'ช่วงวัยนี้ทำงานไม่ได้','actor-or-recipe':'เลือก Clone และสูตรก่อน',
  station:'ยังไม่มีสถานีที่ต้องใช้', materials:'ไม้หรือหินไม่พอ','item-materials':'ของวัตถุดิบไม่ครบ หรือยังสวม/ติดผลต่อสู้อยู่',
  'craft-busy':'กำลังทำงานในคิวเดิม','bag-full':'กระเป๋าเต็ม',capacity:'พื้นที่เก็บของหรือคิวเต็ม',
  'combat-active':'กำลังต่อสู้',adventure:'อยู่ระหว่างการผจญภัย',survival:'รอให้ HP ≥70 · อิ่ม ≥70 · พลังงาน ≥65',
  housing:'สร้างที่พักให้พร้อมก่อน',reserve:'เก็บอาหาร/ไม้/หินสำรองให้พอก่อน',task:'ทำงานปัจจุบันให้เสร็จก่อน',
  'no-path':'เดินไปสถานีไม่ได้','craft-item-invalid':'ข้อมูลของวัตถุดิบไม่ถูกต้อง'
}[reason]??'ยังไม่พร้อม: '+reason);
const costText=r=>[...Object.entries(r.materials),...Object.entries(r.itemMaterials??{})]
  .map(([id,n])=>(names[id]??ITEM_CATALOG[id]?.name??id)+' ×'+n).join(' · ');
const title=r=>(ITEM_CATALOG[r.output]?.name??r.output)+' · T'+r.tier;
export function craftBookSnapshot(s,a,{stationId=null}={}){
  const processing=s.rustMaterials?.orders?.some(o=>o.agentId===a.id);
  return Object.freeze(recipeKnowledgeSnapshot(s,a).map(row=>{
    const check=processing?{ok:false,reason:'craft-busy'}:craftPreview(s,{agentId:a.id,recipeId:row.recipeId,stationId});
    return Object.freeze({...row,canCraft:check.ok,reason:check.ok?'ready':check.reason,
      missing:check.missing?Object.freeze({...check.missing}):null});
  }));
}
function learnedLabel(s,row){
  if(!row.known)return row.unlock?'ฝึก '+title(recipeById(row.unlock.recipeId))+' '+row.unlock.current+'/'+row.unlock.completions+' ครั้ง หรือเรียนจากช่าง':'ยังไม่รู้สูตร';
  if(row.learned?.method==='blueprint')return 'เรียนจากพิมพ์เขียว #'+row.learned.itemId;
  return row.learned?.method==='teaching'?'เรียนจาก '+nameOf(s,row.learned.teacherId):
    row.learned?.method==='mastery'?'ปลดจากการลงมือทำ':'สูตรพื้นฐานเพื่อเอาตัวรอด';
}
export function renderCraftRecipeBook(s,a,{stationKind=null,stationId=null}={}){
  const rows=craftBookSnapshot(s,a,{stationId}).filter(x=>!stationKind||x.station===stationKind),known=rows.filter(x=>x.known).length;
  const groups=tiers.map((label,tier)=>{
    const entries=rows.filter(x=>x.tier===tier);if(!entries.length)return '';
    const cards=entries.map(row=>{
      const r=recipeById(row.recipeId),canTrain=row.known&&canPerformProductiveWork(s,a);
      const missing=row.missing?' · ขาด '+Object.entries(row.missing).map(([k,n])=>(names[k]??ITEM_CATALOG[k]?.name??k)+' ×'+n).join(', '):'';
      return '<article class="rc2-recipe '+(row.known?'is-known':'is-locked')+'" data-recipe-id="'+esc(r.id)+'" data-known="'+row.known+'">'+
        '<div class="rc2-recipe-heading"><b>'+esc(title(r))+'</b><span class="rc2-badge">'+(row.known?'รู้สูตร':'ล็อก')+'</span></div>'+
        '<small>'+esc(stations[r.station])+' · '+r.work+' ticks</small><p>'+esc(costText(r))+'</p>'+
        '<small class="rc2-provenance">'+esc(learnedLabel(s,row))+'</small><span class="rc2-mastery">ผลิตสำเร็จ '+row.completed+' ครั้ง</span>'+
        '<p class="rc2-reason" data-craft-reason="'+esc(row.reason)+'">'+esc(craftReasonLabel(row.reason)+missing)+'</p>'+
        '<div class="rc2-actions"><button class="secondary visual-recipe-card" data-ux="craft-item" data-recipe="'+esc(r.id)+'" '+(stationId===null?'':'data-station="'+stationId+'" ')+(!row.canCraft?'disabled':'')+' aria-label="คราฟต์ '+esc(title(r))+'">คราฟต์ 1 ชิ้น</button>'+
        '<button class="secondary" data-ux="craft-train" data-recipe="'+esc(r.id)+'" '+(!canTrain?'disabled':'')+' aria-label="ฝึก '+esc(title(r))+' สองชิ้น">ฝึก 2 ชิ้น</button></div></article>';
    }).join('');
    return '<details class="rc2-tier" data-craft-tier="'+tier+'" '+(tier===(stationKind?1:0)?'open':'')+'><summary><b>T'+tier+' · '+label+'</b><span>'+entries.filter(x=>x.known).length+'/'+entries.length+' สูตร</span></summary><div class="rc2-recipe-grid">'+cards+'</div></details>';
  }).join('');
  return '<section class="rc2-book" data-craft-book="'+a.id+'"><header class="rc2-section-head"><div><small>RECIPE KNOWLEDGE</small><h3>สมุดสูตรของ '+esc(a.name)+'</h3></div><b>'+known+'/'+rows.length+'</b></header>'+
    '<p class="source-note">รู้สูตร + สถานี + วัสดุ + ช่องกระเป๋า จึงคราฟต์ได้ · ของที่ใส่อยู่ไม่ถูกใช้เป็นวัตถุดิบ · ปิดหน้าต่างเพื่อให้คิวเดินต่อ</p>'+groups+'</section>';
}
export function renderCraftItemInfo(s,item){
  if(item.kind===BLUEPRINT_ITEM_KIND){
    if(!validBlueprintItem(s,item))return '<div class="rc2-item-meta">หลักฐานพิมพ์เขียวไม่ถูกต้อง</div>';
    const r=recipeById(item.blueprint.offer.recipeId);
    return '<div class="rc2-item-meta" data-blueprint-recipe="'+esc(r.id)+'"><div class="rc2-item-score"><b>T'+r.tier+'</b><strong>'+esc(title(r))+'</strong></div>'+
      '<small>พบโดย '+esc(nameOf(s,item.createdBy))+' · '+esc(item.blueprint.offer.monsterId)+'</small><small>ใช้ 1 ใบเพื่อเรียนสูตร · ไม่เพิ่ม Mastery</small></div>';
  }
  const creator=Number.isSafeInteger(item.createdBy)?'สร้างโดย '+nameOf(s,item.createdBy):'ไม่ระบุผู้สร้าง';
  if(item.craft===undefined)return '<div class="rc2-item-meta" data-craft-quality="legacy"><small>'+esc(creator)+'</small><small>Legacy / ของเดิม · ไม่ระบุคุณภาพ</small></div>';
  if(!validateCraftedItem(item,s.seed))return '<div class="rc2-item-meta" data-craft-quality="invalid">คุณสมบัติไอเทมไม่ผ่านการตรวจสอบ</div>';
  const c=item.craft,abilities=c.abilities.map(a=>a.kind==='WORK_SPEED_BPS'?'ความเร็วงาน +'+(a.value/100).toFixed(2)+'%':a.kind+' +'+a.value);
  return '<div class="rc2-item-meta" data-craft-quality="'+c.quality+'"><div class="rc2-item-score"><b>T'+c.tier+'</b><strong>คุณภาพ '+c.quality+'/100</strong></div>'+
    '<small>'+esc(creator)+'</small><div class="rc2-abilities">'+(abilities.length?abilities.map(x=>'<span>'+esc(x)+'</span>').join(''):'<small>ชิ้นส่วนก่อสร้าง · ไม่มีโบนัสค่าสเตตัส</small>')+'</div>'+
    '<details><summary>ประวัติการผลิต</summary><small>Order #'+c.orderId+' · Tick '+item.createdTick+'</small><small>ฝีมือขณะรับงาน '+c.mastery+' · '+esc(c.ticket)+'</small></details></div>';
}
export function renderCraftItemActions(s,a,item){
  const def=ITEM_CATALOG[item.kind];if(!a.alive||!def)return '';
  if(item.kind===BLUEPRINT_ITEM_KIND){
    const check=blueprintLearningPreview(s,{agentId:a.id,itemId:item.id});
    return '<button class="secondary" data-ux="learn-blueprint" data-item="'+item.id+'" '+(!check.ok?'disabled':'')+'>ใช้พิมพ์เขียวเรียนสูตร</button>'+
      (!check.ok?'<small class="rc2-reason">'+esc(craftReasonLabel(check.reason))+'</small>':'');
  }
  const equip=s.rustPossessions.equipment.find(e=>e.agentId===a.id&&e.itemId===item.id);
  if(def.category==='tool')return equip&&equipmentSlotOf(equip)==='hand'?
    '<button class="secondary" data-ux="unequip-item">ถอดจากมือ</button>':
    '<button class="secondary" data-ux="equip-item" data-item="'+item.id+'">ใช้เป็นเครื่องมือ</button>';
  if(def.category==='gear')return equip?
    '<button class="secondary" data-ux="unequip-craft-gear" data-slot="'+esc(def.equipSlot)+'">ถอด '+esc(def.equipSlot)+'</button>':
    '<button class="secondary" data-ux="equip-craft-gear" data-item="'+item.id+'">สวม '+esc(def.equipSlot)+'</button>';
  if(def.stationProvided)return '<button class="secondary" data-ux="place-station" data-item="'+item.id+'">วางสิ่งปลูกสร้าง</button>';
  return '<small class="rc2-material">วัตถุดิบ · ใช้ผ่านสูตรคราฟต์</small>';
}
export function renderCraftTraining(s,a){
  const v=craftTrainingSnapshot(s,a),r=recipeById(v.recipeId),status={OFF:'ปิด',READY:'พร้อม',BLOCKED:'รอ',COMPLETE:'ครบแล้ว'}[v.status];
  return '<section class="rc2-training" data-training-status="'+v.status+'"><header class="rc2-section-head"><h3>ฝึกช่างส่วนตัว</h3><b>'+status+'</b></header>'+
    (r?'<p>'+esc(title(r))+' · '+v.completed+'/'+v.quota+' ชิ้น</p>':'<p>เลือก “ฝึก 2 ชิ้น” ที่สูตรที่รู้แล้ว</p>')+
    '<p class="rc2-reason">'+esc(craftReasonLabel(v.reason))+'</p><small>ฝึกจากงานสำเร็จจริง ไม่เพิ่ม XP ฟรี · อาหาร ที่พัก และงานเดิมมาก่อน · ไม่ทิ้งของหรือเริ่ม Tier ถัดไปเอง</small>'+
    (v.enabled?'<button class="secondary" data-ux="craft-training-stop">หยุดรับงานฝึกใหม่</button>':'')+'</section>';
}
export function renderCraftTeaching(s,a){
  const known=recipeKnowledgeSnapshot(s,a).filter(x=>x.known&&x.learned?.method!=='baseline');
  const pupils=s.agents.filter(x=>x.id!==a.id&&x.alive&&canPerformProductiveWork(s,x)&&
    Math.abs(x.x-a.x)+Math.abs(x.y-a.y)<=RECIPE_KNOWLEDGE_LIMITS.teachRange).sort((x,y)=>x.id-y.id);
  if(!known.length||!pupils.length)return '<section class="rc2-teaching"><h3>ถ่ายทอดสูตร</h3><p class="source-note">'+(!known.length?'ฝึกจนปลดสูตรใหม่ก่อน แล้วจึงสอนให้คนอื่น':'ต้องมีผู้เรียนวัยทำงานอยู่ในระยะ 2 ช่อง')+'</p></section>';
  return '<section class="rc2-teaching"><h3>ถ่ายทอดสูตร</h3><div class="rc2-teaching-fields"><label>สูตร<select id="rc2-teach-recipe">'+known.map(x=>'<option value="'+esc(x.recipeId)+'">'+esc(title(recipeById(x.recipeId)))+'</option>').join('')+'</select></label>'+
    '<label>ผู้เรียนใกล้ตัว<select id="rc2-teach-student">'+pupils.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('')+'</select></label></div>'+
    '<button class="secondary" data-ux="teach-craft-recipe" '+(!canPerformProductiveWork(s,a)||a.adventureCombat?.status==='ACTIVE'?'disabled':'')+'>ถ่ายทอดสูตรที่เลือก</button><small>ตรวจระยะและผู้รู้จริงอีกครั้งตอนรับคำสั่ง</small></section>';
}
