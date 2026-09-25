import {ITEM_CATALOG,RECIPE_CATALOG,PLACEABLE_KINDS,validateCraftingCatalog} from './crafting-catalog.mjs?v=0.5.0';
import {createRustPossessions,queueCraft,advanceCraft,equipTool,unequipTool,pickupDroppedItem,toolMultiplier,releaseRustPossessionsOnDeath,RUST_POSSESSIONS_VERSION,RUST_POSSESSION_LIMITS} from './rust-possessions.mjs?v=0.5.0';
import {createRustStations,placeStationFromItem,canPlaceStation,migrateRustStations,validateRustStations,stationAt,availableStationKinds,RUST_STATIONS_VERSION,STATION_LIMITS,stationLimit} from './rust-stations.mjs?v=0.5.0';
import {completedHouseIds} from './housing.mjs?v=0.5.0';
import {createRustMaterials,queueProcessing,advanceProcessing,releaseRustProcessingOnDeath,RUST_MATERIALS_VERSION,RUST_MATERIAL_LIMITS} from './rust-materials.mjs?v=0.5.0';
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
  'actor-or-recipe':'เลือกคนที่มีชีวิตและสูตรที่ถูกต้อง','craft-busy':'คนนี้มีงานคราฟต์ค้างอยู่','bag-full':'กระเป๋าเต็ม','capacity':'พื้นที่เก็บของเต็ม',
  station:'ต้องมีสถานีที่ถูกต้อง','materials':'วัสดุไม่พอ','item':'ไม่พบของชิ้นนี้ในกระเป๋า','range':'ต้องอยู่ใกล้จุดใช้งาน',
  terrain:'วางสิ่งปลูกสร้างตรงนี้ไม่ได้','occupied':'ช่องนี้มีสิ่งอื่นอยู่แล้ว','actor-or-item':'เลือกคนและของที่จะวางให้ถูกต้อง',hammer:'ต้องสวมค้อนก่อนวางชิ้นส่วนอาคาร','foundation-ground':'ฐานไม้วางได้บนพื้นหญ้าเท่านั้น',support:'ชิ้นส่วนนี้ต้องต่อกับฐาน/ผนัง/กรอบประตูเดิม',
  'socket-required':'ชิ้นส่วนนี้ต้องระบุช่องหรือขอบที่จะวาง','socket-shape':'ช่อง/ขอบที่ระบุไม่ตรงกับชนิดชิ้นส่วน','socket-occupied':'ตำแหน่งนี้มีชิ้นส่วนอยู่แล้ว',
  'support-foundation':'ผนังและกรอบประตูต้องอยู่บนขอบของฐานไม้','support-roof':'หลังคาต้องอยู่บนฐานไม้ที่มีผนังอย่างน้อยหนึ่งด้าน',position:'ตำแหน่งอยู่นอกแผนที่',
  'placement-id':'คำสั่งวางต้องมีรหัสคำสั่ง','placement-id-conflict':'รหัสคำสั่งนี้ถูกใช้กับการวางอื่นแล้ว','duplicate-item':'ของชิ้นนี้ถูกวางไปแล้ว',
  'busy-or-capacity':'คนนี้มีงานแปรรูปค้างอยู่หรือคิวเต็ม','not-authoritative':'กระบวนการนี้ยังไม่เปิด authority'
}[r.reason]??'คำสั่ง Rust Survival ใช้ไม่ได้');
export function rustCommand(s,type,data={},isWalkable){
  ensureRustState(s);let r=null;
  if(type==='CRAFT_ITEM')r=queueCraft(s,data);
  else if(type==='EQUIP_ITEM')r=equipTool(s,data.agentId,data.itemId);
  else if(type==='UNEQUIP_ITEM')r=unequipTool(s,data.agentId);
  else if(type==='PICKUP_ITEM')r=pickupDroppedItem(s,data.agentId,data.itemId);
  else if(type==='PLACE_STATION'){
    const before=completedHouseIds(s);r=placeStationFromItem(s,data,isWalkable);
    // A house counts once: only the placement that turns it from incomplete to complete reports it.
    if(r.ok&&!r.duplicate){const done=[...completedHouseIds(s)].find(id=>!before.has(id));if(done)r={...r,completedHouse:done};}
  }
  else if(type==='PROCESS_CHARCOAL')r=queueProcessing(s,{...data,processId:'CHARCOAL'});
  else return null;
  if(!r.ok)return {...r,message:msg(r)};
  const text=type==='CRAFT_ITEM'?'รับงานคราฟต์แล้ว · วัสดุถูกกันเข้า order และจะไม่หักซ้ำ':
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
export function releaseRustOnDeath(s,a){
  ensureRustState(s);return {possessions:releaseRustPossessionsOnDeath(s,a.id),processing:releaseRustProcessingOnDeath(s,a.id)};
}
export function rustSummary(s,agentId=null){
  ensureRustState(s);const items=s.rustPossessions.items,bag=agentId===null?[]:items.filter(i=>i.location?.kind==='bag'&&i.location.agentId===agentId);
  return {items:items.length,bag,orders:s.rustPossessions.orders.length,stations:s.rustStations.stations.length,stationKinds:availableStationKinds(s),charcoal:s.rustMaterials.charcoal,processingOrders:s.rustMaterials.orders.length};
}
export function validateRustState(s){
  const e=[];if(validateCraftingCatalog().length)e.push('Rust catalog');
  const p=s.rustPossessions,rs=s.rustStations,m=s.rustMaterials,people=new Set([...(s.agents??[]),...(s.archive??[])].map(a=>a.id)),alive=new Set((s.agents??[]).filter(a=>a.alive).map(a=>a.id));
  if(!p||p.version!==RUST_POSSESSIONS_VERSION||!Number.isSafeInteger(p.nextItem)||!Number.isSafeInteger(p.nextOrder)||!Array.isArray(p.items)||p.items.length>RUST_POSSESSION_LIMITS.items||!Array.isArray(p.orders)||p.orders.length>RUST_POSSESSION_LIMITS.orders||!Array.isArray(p.equipment))e.push('Rust possessions');
  else{
    const ids=new Set();for(const i of p.items){if(!i||!Number.isSafeInteger(i.id)||ids.has(i.id)||!ITEM_CATALOG[i.kind]||!people.has(i.createdBy)||!i.location)e.push('Rust item');ids.add(i?.id);
      if(i?.location?.kind==='bag'&&!alive.has(i.location.agentId))e.push('Rust bag');
      if(i?.location?.kind==='drop'&&(!Number.isInteger(i.location.x)||!Number.isInteger(i.location.y)))e.push('Rust drop');
      if(!['bag','drop'].includes(i?.location?.kind))e.push('Rust item location');
    }
    const bagCounts=new Map();for(const i of p.items.filter(i=>i.location?.kind==='bag'))bagCounts.set(i.location.agentId,(bagCounts.get(i.location.agentId)??0)+1);
    if([...bagCounts.values()].some(n=>n>RUST_POSSESSION_LIMITS.bag))e.push('Rust bag capacity');
    for(const o of p.orders)if(!o||!alive.has(o.agentId)||!RECIPE_CATALOG[o.recipe]||!Number.isFinite(o.work)||o.work<0||!Number.isFinite(o.required)||o.required<1||!o.reserved)e.push('Rust craft order');
    const equippedAgents=new Set();for(const q of p.equipment){if(!alive.has(q.agentId)||equippedAgents.has(q.agentId)||!p.items.some(i=>i.id===q.itemId&&i.location?.kind==='bag'&&i.location.agentId===q.agentId&&ITEM_CATALOG[i.kind]?.category==='tool'&&ITEM_CATALOG[i.kind]?.equipSlot==='hand'))e.push('Rust equipment');equippedAgents.add(q.agentId);}
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
