import {validateCraftedItem} from './craft-outcome.mjs?v=0.5.0';
import {teachCraftRecipe,validateAllRecipeKnowledge} from './craft-recipe-knowledge.mjs?v=0.5.0';
import {ITEM_CATALOG,CRAFT_RECIPE_CATALOG as RECIPE_CATALOG,PLACEABLE_KINDS,validateCraftingCatalog} from './crafting-catalog.mjs?v=0.5.0';
import {learnRecipeBlueprint,createRustPossessions,queueCraft,advanceCraft,validateCraftOrder,equipTool,unequipTool,equipAdventureGear,unequipAdventureGear,pickupDroppedItem,toolMultiplier,releaseRustPossessionsOnDeath,grantAdventureLoot,equipmentSlotOf,RUST_POSSESSIONS_VERSION,RUST_POSSESSION_LIMITS} from './rust-possessions.mjs?v=0.5.0';
import {createRustStations,placeStationFromItem,canPlaceStation,migrateRustStations,validateRustStations,stationAt,availableStationKinds,RUST_STATIONS_VERSION,STATION_LIMITS,stationLimit} from './rust-stations.mjs?v=0.5.0';
import {completedHouseIds} from './housing.mjs?v=0.5.0';
import {createRustMaterials,queueProcessing,advanceProcessing,releaseRustProcessingOnDeath,RUST_MATERIALS_VERSION,RUST_MATERIAL_LIMITS} from './rust-materials.mjs?v=0.5.0';
import {activateHouseholdStore,isIndependent} from './individual-resources.mjs?v=0.5.0';
import {ADVENTURE_MAX_UPGRADE_LEVEL} from './adventure-upgrade.mjs?v=0.5.0';
export const RUST_RUNTIME_VERSION='RS1-RS4-integrated-0.2';
export function ensureRustState(s){
  if(s.rustPossessions===undefined)s.rustPossessions=createRustPossessions();
  if(s.rustStations===undefined)s.rustStations=createRustStations();
  // Single RS3-0.2 -> RS3-0.3 migration point (idempotent; RS3-0.3 is left untouched).
  migrateRustStations(s.rustStations);
  if(s.rustMaterials===undefined)s.rustMaterials=createRustMaterials();
  return s;
}
const msg=r=>({
  'blueprint-invalid':'หลักฐานพิมพ์เขียวไม่ถูกต้อง','recipe-known':'รู้สูตรนี้แล้ว · ไม่ใช้พิมพ์เขียว','recipe-capacity':'สมุดสูตรเต็ม','loot-result-open':'กด Continue ปิดผลต่อสู้ก่อน แล้วจึงใช้พิมพ์เขียว',
  'item-materials':'ของวัตถุดิบไม่ครบ หรือยังสวม/ติดผลต่อสู้อยู่','output-capacity':'กระเป๋าเต็ม งานที่เสร็จรอช่องว่าง','craft-order-invalid':'หลักฐานงานคราฟต์ไม่ถูกต้อง','craft-item-invalid':'คุณสมบัติของวัตถุดิบไม่ถูกต้อง',
  'recipe-unknown':'คนนี้ยังไม่รู้สูตร ต้องฝึกหรือเรียนจากผู้ที่รู้สูตรก่อน','recipe-knowledge':'ข้อมูลสูตรของคนนี้ไม่ถูกต้อง','recipe-actors':'เลือกครูและผู้เรียนที่ยังมีชีวิตคนละคน',
  'actor-or-recipe':'เลือกคนที่มีชีวิตและสูตรที่ถูกต้อง','craft-busy':'คนนี้มีงานคราฟต์ค้างอยู่','bag-full':'กระเป๋าเต็ม','capacity':'พื้นที่เก็บของเต็ม',
  station:'ต้องมีสถานีที่ถูกต้อง','materials':'วัสดุไม่พอ','item':'ไม่พบของชิ้นนี้ในกระเป๋า','range':'ต้องอยู่ใกล้จุดใช้งาน',
  terrain:'วางสิ่งปลูกสร้างตรงนี้ไม่ได้','occupied':'ช่องนี้มีสิ่งอื่นอยู่แล้ว','actor-or-item':'เลือกคนและของที่จะวางให้ถูกต้อง',hammer:'ต้องสวมค้อนก่อนวางชิ้นส่วนอาคาร','foundation-ground':'ฐานไม้วางได้บนพื้นหญ้าเท่านั้น',support:'ชิ้นส่วนนี้ต้องต่อกับฐาน/ผนัง/กรอบประตูเดิม',
  'socket-required':'ชิ้นส่วนนี้ต้องระบุช่องหรือขอบที่จะวาง','socket-shape':'ช่อง/ขอบที่ระบุไม่ตรงกับชนิดชิ้นส่วน','socket-occupied':'ตำแหน่งนี้มีชิ้นส่วนอยู่แล้ว',
  'support-foundation':'ผนังและกรอบประตูต้องอยู่บนขอบของฐานไม้','support-roof':'หลังคาต้องอยู่บนฐานไม้ที่มีผนังอย่างน้อยหนึ่งด้าน',position:'ตำแหน่งอยู่นอกแผนที่',
  'placement-id':'คำสั่งวางต้องมีรหัสคำสั่ง','placement-id-conflict':'รหัสคำสั่งนี้ถูกใช้กับการวางอื่นแล้ว','duplicate-item':'ของชิ้นนี้ถูกวางไปแล้ว',
  'busy-or-capacity':'คนนี้มีงานแปรรูปค้างอยู่หรือคิวเต็ม','not-authoritative':'กระบวนการนี้ยังไม่เปิด authority','combat-active':'เปลี่ยนอุปกรณ์ระหว่าง combat ไม่ได้','gear-slot':'ช่องอุปกรณ์ไม่ถูกต้อง'
}[r.reason]??'คำสั่ง Rust Survival ใช้ไม่ได้');
export function rustCommand(s,type,data={},isWalkable){
  ensureRustState(s);let r=null;
  if(type==='LEARN_RECIPE_BLUEPRINT')r=learnRecipeBlueprint(s,data);
  else if(type==='TEACH_CRAFT_RECIPE')r=teachCraftRecipe(s,data);
  else if(type==='CRAFT_ITEM')r=queueCraft(s,data);
  else if(type==='EQUIP_ITEM')r=equipTool(s,data.agentId,data.itemId);
  else if(type==='UNEQUIP_ITEM')r=unequipTool(s,data.agentId);
  else if(type==='EQUIP_ADVENTURE_GEAR')r=equipAdventureGear(s,data.agentId,data.itemId);
  else if(type==='UNEQUIP_ADVENTURE_GEAR')r=unequipAdventureGear(s,data.agentId,data.slot);
  else if(type==='PICKUP_ITEM')r=pickupDroppedItem(s,data.agentId,data.itemId);
  else if(type==='PLACE_STATION'){
    const before=completedHouseIds(s);r=placeStationFromItem(s,data,isWalkable);
    // A house counts once: only the placement that turns it from incomplete to complete reports it.
    if(r.ok&&!r.duplicate){
      const done=[...completedHouseIds(s)].find(id=>!before.has(id));
      if(done){
        let householdStoreActivated=false;
        if(isIndependent(s)){
          const foundationId=Number(done.slice(1)),foundation=s.rustStations.stations.find(st=>st.id===foundationId&&st.kind==='WOOD_FOUNDATION');
          const activated=foundation?activateHouseholdStore(s,done,foundation.placedBy):{ok:false,reason:'house'};
          if(!activated.ok)throw new Error('Household resource activation failed');
          householdStoreActivated=activated.changed;
        }
        r={...r,completedHouse:done,householdStoreActivated};
      }
    }
  }
  else if(type==='PROCESS_CHARCOAL')r=queueProcessing(s,{...data,processId:'CHARCOAL'});
  else return null;
  if(!r.ok)return {...r,message:msg(r)};
  const text=type==='LEARN_RECIPE_BLUEPRINT'?'เรียนสูตรแล้ว · ใช้พิมพ์เขียว 1 ใบ ไม่เพิ่ม Mastery':type==='TEACH_CRAFT_RECIPE'?(r.changed?'ถ่ายทอดสูตรให้ผู้เรียนแล้ว':'ผู้เรียนรู้สูตรนี้อยู่แล้ว'):type==='CRAFT_ITEM'?'รับงานคราฟต์แล้ว · วัสดุถูกกันเข้า order และจะไม่หักซ้ำ':
    type==='EQUIP_ADVENTURE_GEAR'?'สวมอุปกรณ์ผจญภัยแล้ว':type==='UNEQUIP_ADVENTURE_GEAR'?'ถอดอุปกรณ์ผจญภัยแล้ว':
    type==='EQUIP_ITEM'?'สวมอุปกรณ์ช่องมือแล้ว':type==='UNEQUIP_ITEM'?(r.changed?'ถอดอุปกรณ์ช่องมือแล้ว':'ช่องมือว่างอยู่แล้ว'):type==='PICKUP_ITEM'?'เก็บของขึ้นกระเป๋าแล้ว':
    type==='PLACE_STATION'?'วางสิ่งปลูกสร้างสำเร็จ': 'รับงานเผาถ่านแล้ว · ไม้ถูกกันเข้า order';
  return {...r,message:text};
}
/** Read-only preview of the same validator the executor re-runs; no clone and no write. */
export function placementPreview(s,data,isWalkable){
  const r=canPlaceStation(s,data,isWalkable,{actor:true});
  return r.ok?{...r,message:'วางได้ · ยังไม่ใช้ของ'}:{...r,message:msg(r)};
}
export function pendingRustWork(s,a){
  const craft=s.rustPossessions?.orders.find(o=>o.agentId===a.id);
  if(craft){
    const r=RECIPE_CATALOG[craft.recipe],st=craft.stationId===null?null:stationAt(s,craft.stationId);
    return {kind:'CRAFT',orderId:craft.id,x:st?.x??a.x,y:st?.y??a.y,stationId:craft.stationId,label:ITEM_CATALOG[r.output]?.name??r.output};
  }
  const process=s.rustMaterials?.orders.find(o=>o.agentId===a.id);
  if(process){const st=stationAt(s,process.stationId);if(st)return {kind:'PROCESS',orderId:process.id,x:st.x,y:st.y,stationId:st.id,label:'ถ่านไม้'};}
  return null;
}
export function advanceRustWork(s,a,workRate){
  const pending=pendingRustWork(s,a);if(!pending)return {ok:false,reason:'order'};
  return pending.kind==='CRAFT'?advanceCraft(s,a.id,{workRate}):advanceProcessing(s,a.id,{workRate});
}
export const rustToolMultiplier=(s,a,action)=>toolMultiplier(s,a.id,action);
export const rustGrantAdventureLoot=(s,data)=>{ensureRustState(s);return grantAdventureLoot(s,data);};
export function releaseRustOnDeath(s,a){
  ensureRustState(s);return {possessions:releaseRustPossessionsOnDeath(s,a.id),processing:releaseRustProcessingOnDeath(s,a.id)};
}
export function rustSummary(s,agentId=null){
  ensureRustState(s);const items=s.rustPossessions.items,bag=agentId===null?[]:items.filter(i=>i.location?.kind==='bag'&&i.location.agentId===agentId);
  return {items:items.length,bag,orders:s.rustPossessions.orders.length,stations:s.rustStations.stations.length,stationKinds:availableStationKinds(s),charcoal:s.rustMaterials.charcoal,processingOrders:s.rustMaterials.orders.length};
}
export function validateRustState(s){
  const e=[];if(validateCraftingCatalog().length)e.push('Rust catalog');
  e.push(...validateAllRecipeKnowledge(s));
  const p=s.rustPossessions,rs=s.rustStations,m=s.rustMaterials,people=new Set([...(s.agents??[]),...(s.archive??[])].map(a=>a.id)),alive=new Set((s.agents??[]).filter(a=>a.alive).map(a=>a.id));
  if(!p||p.version!==RUST_POSSESSIONS_VERSION||!Number.isSafeInteger(p.nextItem)||!Number.isSafeInteger(p.nextOrder)||!Array.isArray(p.items)||p.items.length>RUST_POSSESSION_LIMITS.items||!Array.isArray(p.orders)||p.orders.length>RUST_POSSESSION_LIMITS.orders||!Array.isArray(p.equipment))e.push('Rust possessions');
  else{
    const ids=new Set(),craftOrders=new Set();for(const i of p.items){const def=ITEM_CATALOG[i?.kind];if(!i||!Number.isSafeInteger(i.id)||ids.has(i.id)||!def||!people.has(i.createdBy)||!i.location)e.push('Rust item');ids.add(i?.id);
      if(!validateCraftedItem(i,s.seed))e.push('Rust craft outcome');
      if(i?.craft){if(craftOrders.has(i.craft.orderId)||!Number.isSafeInteger(i.createdTick)||i.createdTick<0||i.createdTick>s.tick||i.craft.orderId>=p.nextOrder||p.orders.some(o=>o.id===i.craft.orderId))e.push('Rust craft outcome');craftOrders.add(i.craft.orderId);}
      if(def?.category==='gear'&&i.upgradeLevel!==0)e.push('Rust gear');
      if(i?.location?.kind==='bag'&&!alive.has(i.location.agentId))e.push('Rust bag');
      if(i?.location?.kind==='drop'&&(!Number.isInteger(i.location.x)||!Number.isInteger(i.location.y)))e.push('Rust drop');
      if(!['bag','drop'].includes(i?.location?.kind))e.push('Rust item location');
    }
    const bagCounts=new Map();for(const i of p.items.filter(i=>i.location?.kind==='bag'))bagCounts.set(i.location.agentId,(bagCounts.get(i.location.agentId)??0)+1);
    if([...bagCounts.values()].some(n=>n>RUST_POSSESSION_LIMITS.bag))e.push('Rust bag capacity');
    for(const o of p.orders)e.push(...validateCraftOrder(s,o));
    const escrowIds=p.orders.flatMap(o=>Array.isArray(o?.reservedItems)?o.reservedItems.map(i=>i.itemId):[]);
    if(new Set(escrowIds).size!==escrowIds.length)e.push('Rust craft escrow');
    const equippedSlots=new Set();for(const q of p.equipment){
      const slot=equipmentSlotOf(q),key=q?.agentId+':'+slot,item=p.items.find(i=>i.id===q?.itemId&&i.location?.kind==='bag'&&i.location.agentId===q?.agentId),def=item&&ITEM_CATALOG[item.kind];
      const validSlot=slot==='hand'
        ?def?.category==='tool'&&def?.equipSlot==='hand'
        :['WEAPON','ARMOR','ACCESSORY'].includes(slot)&&def?.category==='gear'&&def?.equipSlot===slot&&item?.upgradeLevel===0;
      if(!alive.has(q?.agentId)||equippedSlots.has(key)||!item||!validSlot)e.push('Rust equipment');
      equippedSlots.add(key);
    }
  }
  if(!rs||rs.version!==RUST_STATIONS_VERSION||!Number.isSafeInteger(rs.nextStation)||!Array.isArray(rs.stations)||rs.stations.length>stationLimit(s))e.push('Rust stations');
  else{
    for(const st of rs.stations)if(!st||!Number.isSafeInteger(st.id)||!PLACEABLE_KINDS.includes(st.kind)||!Number.isInteger(st.x)||!Number.isInteger(st.y)||!people.has(st.placedBy))e.push('Rust station');
    e.push(...validateRustStations(s));
  }
  if(!m||m.version!==RUST_MATERIALS_VERSION||!Number.isInteger(m.charcoal)||m.charcoal<0||m.charcoal>RUST_MATERIAL_LIMITS.charcoal||!Array.isArray(m.orders)||m.orders.length>RUST_MATERIAL_LIMITS.orders)e.push('Rust materials');
  else for(const o of m.orders)if(!o||!alive.has(o.agentId)||o.processId!=='CHARCOAL'||!stationAt(s,o.stationId)||!Number.isFinite(o.work)||o.work<0||!o.reserved)e.push('Rust process order');
  return [...new Set(e)];
}
