import {BULK_MATERIAL_KEYS} from './material-schema.mjs?v=0.5.0';
/** Rust Survival RS1 — bounded crafting catalog adapted to Simclone authority. */
const deepFreeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);
  }return value;
};
export const RUST_CRAFTING_VERSION='RS1-0.3';
export const CRAFT_STATIONS=deepFreeze({HAND:'HAND',CRAFTING_TABLE_LV1:'CRAFTING_TABLE_LV1',FURNACE:'FURNACE'});
export const CRAFT_CATEGORIES=deepFreeze({TOOL:'tool',BUILD:'build',MATERIAL:'material',GEAR:'gear',BLUEPRINT:'blueprint'});
export const PLACEABLE_KINDS=deepFreeze(['CRAFTING_TABLE_LV1','FURNACE','WOOD_FOUNDATION','WOOD_WALL','WOOD_DOORWAY','WOOD_ROOF']);
export const ITEM_CATALOG=deepFreeze({
  RECIPE_BLUEPRINT:{id:'RECIPE_BLUEPRINT',name:'พิมพ์เขียวสูตร',category:'blueprint',rarity:'RARE',adventureLoot:true},
  FIRE_CORE:{id:'FIRE_CORE',name:'แกนไฟ',category:'material',rarity:'UNCOMMON',adventureLoot:true,donorId:'fire_core'},
  HIDE:{id:'HIDE',name:'หนังมอนสเตอร์',category:'material',rarity:'COMMON',adventureLoot:true,donorId:'hide'},
  EMBER_SHARD:{id:'EMBER_SHARD',name:'เศษเถ้าเพลิง',category:'material',rarity:'RARE',adventureLoot:true,donorId:'ember_shard'},
  EMBER_BLADE:{id:'EMBER_BLADE',name:'ดาบเพลิง',category:'gear',equipSlot:'WEAPON',rarity:'RARE',adventureGearId:'EMBER_BLADE'},
  HIDE_ARMOR:{id:'HIDE_ARMOR',name:'เกราะหนัง',category:'gear',equipSlot:'ARMOR',rarity:'COMMON',adventureGearId:'HIDE_ARMOR'},
  EMBER_CHARM:{id:'EMBER_CHARM',name:'เครื่องรางเพลิง',category:'gear',equipSlot:'ACCESSORY',rarity:'UNCOMMON',adventureGearId:'EMBER_CHARM'},
  STONE_AXE:{id:'STONE_AXE',name:'ขวานหิน',category:'tool',equipSlot:'hand',workAction:'WOODCUT',workMultiplier:1.25,donorId:'stone_axe'},
  STONE_PICKAXE:{id:'STONE_PICKAXE',name:'อีเต้อหิน',category:'tool',equipSlot:'hand',workAction:'MINE',workMultiplier:1.25,donorId:'stone_pick'},
  HAMMER:{id:'HAMMER',name:'ค้อน',category:'tool',equipSlot:'hand',workAction:'BUILD',workMultiplier:1,donorId:'hammer'},
  CRAFTING_TABLE_LV1:{id:'CRAFTING_TABLE_LV1',name:'โต๊ะคราฟต์ Lv1',category:'build',buildingType:'crafting_table',stationProvided:'CRAFTING_TABLE_LV1',donorId:'crafting_table'},
  FURNACE:{id:'FURNACE',name:'เตาหลอม',category:'build',buildingType:'furnace',stationProvided:'FURNACE',donorId:'furnace'},
  WOOD_FOUNDATION:{id:'WOOD_FOUNDATION',name:'ฐานไม้',category:'build',buildingType:'wood_foundation',stationProvided:'WOOD_FOUNDATION',structurePiece:true,placementRule:'ground',donorId:'wood_foundation'},
  WOOD_WALL:{id:'WOOD_WALL',name:'กำแพงไม้',category:'build',buildingType:'wood_wall',stationProvided:'WOOD_WALL',structurePiece:true,placementRule:'supported',donorId:'wood_wall'},
  WOOD_DOORWAY:{id:'WOOD_DOORWAY',name:'กรอบประตูไม้',category:'build',buildingType:'wood_doorway',stationProvided:'WOOD_DOORWAY',structurePiece:true,placementRule:'supported',donorId:'wood_doorway'},
  WOOD_ROOF:{id:'WOOD_ROOF',name:'หลังคาไม้',category:'build',buildingType:'wood_roof',stationProvided:'WOOD_ROOF',structurePiece:true,placementRule:'supported',donorId:'wood_roof'}
});
export const RECIPE_CATALOG=deepFreeze({
  STONE_AXE:{id:'STONE_AXE',output:'STONE_AXE',quantity:1,category:'tool',station:'HAND',tier:0,materials:{wood:4,stone:2},work:24,donor:{cost:{wood:2,stone:3,rope:1}},adaptation:'rope deferred until it has one authoritative ledger'},
  STONE_PICKAXE:{id:'STONE_PICKAXE',output:'STONE_PICKAXE',quantity:1,category:'tool',station:'HAND',tier:0,materials:{wood:3,stone:4},work:24,donor:{cost:{wood:2,stone:3,rope:1}},adaptation:'rope deferred until it has one authoritative ledger'},
  CRAFTING_TABLE_LV1:{id:'CRAFTING_TABLE_LV1',output:'CRAFTING_TABLE_LV1',quantity:1,category:'build',station:'HAND',tier:0,materials:{wood:10,stone:4},work:36,donor:{cost:{wood:10,stone:4}}},
  FURNACE:{id:'FURNACE',output:'FURNACE',quantity:1,category:'build',station:'HAND',tier:0,materials:{stone:12},work:40,donor:{cost:{stone:12}}},
  HAMMER:{id:'HAMMER',output:'HAMMER',quantity:1,category:'tool',station:'CRAFTING_TABLE_LV1',tier:1,materials:{wood:3,stone:4},work:28,donor:{cost:{wood:2,stone:3,rope:1}},adaptation:'rope deferred; station progression retained'},
  WOOD_FOUNDATION:{id:'WOOD_FOUNDATION',output:'WOOD_FOUNDATION',quantity:1,category:'build',station:'HAND',tier:0,materials:{wood:8},work:18},
  WOOD_WALL:{id:'WOOD_WALL',output:'WOOD_WALL',quantity:1,category:'build',station:'HAND',tier:0,materials:{wood:5},work:14},
  WOOD_DOORWAY:{id:'WOOD_DOORWAY',output:'WOOD_DOORWAY',quantity:1,category:'build',station:'HAND',tier:0,materials:{wood:5},work:14},
  WOOD_ROOF:{id:'WOOD_ROOF',output:'WOOD_ROOF',quantity:1,category:'build',station:'HAND',tier:0,materials:{wood:6},work:16}
});
/** The released nine recipes remain a compatibility view for survival UI/planners.
 * All crafting authorities resolve through recipeById / CRAFT_RECIPE_CATALOG. */
export const STARTER_RECIPE_IDS=deepFreeze(Object.keys(RECIPE_CATALOG));
const advanced={};
const toolNames=Object.freeze({STONE_AXE:['ขวานหิน','ขวานหินเสริม','ขวานเหล็ก','ขวานเหล็กกล้า','ขวานเหล็กกล้าชั้นสูง','ขวานมาสเตอร์เวิร์ก'],STONE_PICKAXE:['อีเต้อหิน','อีเต้อหินเสริม','อีเต้อเหล็ก','อีเต้อเหล็กกล้า','อีเต้อเหล็กกล้าชั้นสูง','อีเต้อมาสเตอร์เวิร์ก'],HAMMER:['ค้อน','ค้อนเสริม','ค้อนเหล็ก','ค้อนเหล็กกล้า','ค้อนเหล็กกล้าชั้นสูง','ค้อนมาสเตอร์เวิร์ก']});
const processedForTier=tier=>tier<2?{}:tier===2?{ironIngot:2}:{steelIngot:tier===3?2:tier===4?3:4};
for(const kind of ['STONE_AXE','STONE_PICKAXE','HAMMER']){const base=RECIPE_CATALOG[kind];for(let tier=base.tier+1;tier<=5;tier++){const id=kind+'_T'+tier,previous=tier===base.tier+1?kind:kind+'_T'+(tier-1);advanced[id]={id,name:toolNames[kind][tier],output:kind,quantity:1,category:'tool',station:'CRAFTING_TABLE_LV1',tier,materials:{wood:(base.materials.wood??0)+tier*2,stone:(base.materials.stone??0)+tier},processedMaterials:processedForTier(tier),work:base.work+tier*8,itemMaterials:{[kind]:1},unlock:{recipeId:previous,completions:2}};}}
const gearRecipes={
  HIDE_ARMOR:{source:'WOOD_WALL',materials:{wood:2},itemMaterials:{HIDE:1}},
  EMBER_BLADE:{source:'STONE_AXE',materials:{wood:4,stone:2},itemMaterials:{FIRE_CORE:1,EMBER_SHARD:1}},
  EMBER_CHARM:{source:'STONE_PICKAXE',materials:{wood:2},itemMaterials:{FIRE_CORE:1}}
};
for(const [kind,config] of Object.entries(gearRecipes))for(let tier=1;tier<=5;tier++){
  const id=tier===1?kind:kind+'_T'+tier,prior=tier===2?kind:kind+'_T'+(tier-1);
  advanced[id]={id,output:kind,quantity:1,category:'gear',station:'CRAFTING_TABLE_LV1',tier,
    materials:Object.fromEntries(Object.entries(config.materials).map(([key,n])=>[key,n+tier-1])),
    itemMaterials:tier===1?{...config.itemMaterials}:{[kind]:1,[kind==='HIDE_ARMOR'?'HIDE':'FIRE_CORE']:1},
    work:24+tier*8,unlock:{recipeId:tier===1?config.source:prior,completions:2}};
}
export const ADVANCED_RECIPE_CATALOG=deepFreeze(advanced);
export const CRAFT_RECIPE_CATALOG=deepFreeze({...RECIPE_CATALOG,...ADVANCED_RECIPE_CATALOG});
export const recipeById=id=>Object.hasOwn(CRAFT_RECIPE_CATALOG,id)?CRAFT_RECIPE_CATALOG[id]:null;
export const itemById=id=>ITEM_CATALOG[id]??null;
export function validateCraftingCatalog(){
  const errors=[],stations=new Set(Object.values(CRAFT_STATIONS)),placeables=new Set(PLACEABLE_KINDS),cats=new Set(Object.values(CRAFT_CATEGORIES)),gearSlots=new Set(['WEAPON','ARMOR','ACCESSORY']);
  for(const [id,item] of Object.entries(ITEM_CATALOG)){
    if(item.id!==id||!cats.has(item.category))errors.push('item:'+id);
    if(item.stationProvided&&!placeables.has(item.stationProvided))errors.push('item-placeable:'+id);
    if(item.category==='gear'&&(!gearSlots.has(item.equipSlot)||item.adventureGearId!==id))errors.push('item-gear:'+id);
  }
  for(const [id,r] of Object.entries(CRAFT_RECIPE_CATALOG)){
    if(r.id!==id||r.quantity!==1||!Number.isInteger(r.tier)||r.tier<0||r.tier>5||!ITEM_CATALOG[r.output]||!stations.has(r.station)||!cats.has(r.category)||!Number.isInteger(r.work)||r.work<1)errors.push('recipe:'+id);
    if(r.unlock&&(!CRAFT_RECIPE_CATALOG[r.unlock.recipeId]||CRAFT_RECIPE_CATALOG[r.unlock.recipeId].tier>=r.tier||!Number.isSafeInteger(r.unlock.completions)||r.unlock.completions<1))errors.push('unlock:'+id);
    if(r.itemMaterials&&Object.entries(r.itemMaterials).some(([kind,n])=>!Object.hasOwn(ITEM_CATALOG,kind)||!Number.isSafeInteger(n)||n<1||n>4))errors.push('item-materials:'+id);
    if(r.processedMaterials&&Object.entries(r.processedMaterials).some(([kind,n])=>!BULK_MATERIAL_KEYS.includes(kind)||!Number.isSafeInteger(n)||n<1||n>8))errors.push('processed-materials:'+id);
    if(!r.materials||Object.entries(r.materials).some(([k,n])=>!['wood','stone'].includes(k)||!Number.isInteger(n)||n<1))errors.push('materials:'+id);
  }
  return errors;
}
export function craftability(state,recipeId,{stationKinds}={}){
  const r=recipeById(recipeId);if(!r)return {ok:false,reason:'unknown-recipe'};
  if(!state?.stock||['wood','stone'].some(k=>!Number.isFinite(state.stock[k])||state.stock[k]<0))return {ok:false,reason:'invalid-stock'};
  const kinds=stationKinds??{HAND:1,CRAFTING_TABLE_LV1:0,FURNACE:0};
  if((kinds[r.station]??0)<1)return {ok:false,reason:'station',station:r.station,tier:r.tier};
  const missing={};for(const [k,n] of Object.entries(r.materials))if(state.stock[k]<n)missing[k]=n-state.stock[k];
  if(Object.keys(missing).length)return {ok:false,reason:'materials',missing};
  return {ok:true,recipeId:r.id,output:r.output,station:r.station,materials:{...r.materials},work:r.work};
}
