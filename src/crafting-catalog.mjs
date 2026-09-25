/** Rust Survival RS1 — bounded crafting catalog adapted to Simclone authority. */
const deepFreeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);
  }return value;
};
export const RUST_CRAFTING_VERSION='RS1-0.2';
export const CRAFT_STATIONS=deepFreeze({HAND:'HAND',CRAFTING_TABLE_LV1:'CRAFTING_TABLE_LV1',FURNACE:'FURNACE'});
export const CRAFT_CATEGORIES=deepFreeze({TOOL:'tool',BUILD:'build'});
export const ITEM_CATALOG=deepFreeze({
  STONE_AXE:{id:'STONE_AXE',name:'ขวานหิน',category:'tool',equipSlot:'hand',workAction:'WOODCUT',workMultiplier:1.25,donorId:'stone_axe'},
  STONE_PICKAXE:{id:'STONE_PICKAXE',name:'อีเต้อหิน',category:'tool',equipSlot:'hand',workAction:'MINE',workMultiplier:1.25,donorId:'stone_pick'},
  HAMMER:{id:'HAMMER',name:'ค้อน',category:'tool',equipSlot:'hand',workAction:'BUILD',workMultiplier:1,donorId:'hammer'},
  CRAFTING_TABLE_LV1:{id:'CRAFTING_TABLE_LV1',name:'โต๊ะคราฟต์ Lv1',category:'build',buildingType:'crafting_table',stationProvided:'CRAFTING_TABLE_LV1',donorId:'crafting_table'},
  FURNACE:{id:'FURNACE',name:'เตาหลอม',category:'build',buildingType:'furnace',stationProvided:'FURNACE',donorId:'furnace'}
});
export const RECIPE_CATALOG=deepFreeze({
  STONE_AXE:{id:'STONE_AXE',output:'STONE_AXE',quantity:1,category:'tool',station:'HAND',tier:0,materials:{wood:4,stone:2},work:24,donor:{cost:{wood:2,stone:3,rope:1}},adaptation:'rope deferred until it has one authoritative ledger'},
  STONE_PICKAXE:{id:'STONE_PICKAXE',output:'STONE_PICKAXE',quantity:1,category:'tool',station:'HAND',tier:0,materials:{wood:3,stone:4},work:24,donor:{cost:{wood:2,stone:3,rope:1}},adaptation:'rope deferred until it has one authoritative ledger'},
  CRAFTING_TABLE_LV1:{id:'CRAFTING_TABLE_LV1',output:'CRAFTING_TABLE_LV1',quantity:1,category:'build',station:'HAND',tier:0,materials:{wood:10,stone:4},work:36,donor:{cost:{wood:10,stone:4}}},
  FURNACE:{id:'FURNACE',output:'FURNACE',quantity:1,category:'build',station:'HAND',tier:0,materials:{stone:12},work:40,donor:{cost:{stone:12}}},
  HAMMER:{id:'HAMMER',output:'HAMMER',quantity:1,category:'tool',station:'CRAFTING_TABLE_LV1',tier:1,materials:{wood:3,stone:4},work:28,donor:{cost:{wood:2,stone:3,rope:1}},adaptation:'rope deferred; station progression retained'}
});
export const recipeById=id=>RECIPE_CATALOG[id]??null;
export const itemById=id=>ITEM_CATALOG[id]??null;
export function validateCraftingCatalog(){
  const errors=[],stations=new Set(Object.values(CRAFT_STATIONS)),cats=new Set(Object.values(CRAFT_CATEGORIES));
  for(const [id,item] of Object.entries(ITEM_CATALOG)){
    if(item.id!==id||!cats.has(item.category))errors.push('item:'+id);
    if(item.stationProvided&&!stations.has(item.stationProvided))errors.push('item-station:'+id);
  }
  for(const [id,r] of Object.entries(RECIPE_CATALOG)){
    if(r.id!==id||!ITEM_CATALOG[r.output]||!stations.has(r.station)||!cats.has(r.category)||!Number.isInteger(r.work)||r.work<1)errors.push('recipe:'+id);
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
