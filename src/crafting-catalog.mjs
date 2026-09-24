const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

export const RUST_CRAFTING_SLICE_VERSION = '0.1.0';
export const CRAFT_STATIONS = deepFreeze({
  HAND: 'HAND',
  CRAFTING_TABLE_LV1: 'CRAFTING_TABLE_LV1',
  FURNACE: 'FURNACE'
});
export const CRAFT_CATEGORIES = deepFreeze({TOOL:'tool', BUILD:'build'});

export const ITEM_CATALOG = deepFreeze({
  STONE_AXE: {
    id:'STONE_AXE', name:'ขวานหิน', category:CRAFT_CATEGORIES.TOOL,
    donorId:'stone_axe', equipSlot:'hand', workAction:'WOODCUT', workMultiplier:1.25
  },
  STONE_PICKAXE: {
    id:'STONE_PICKAXE', name:'อีเต้อหิน', category:CRAFT_CATEGORIES.TOOL,
    donorId:'stone_pick', equipSlot:'hand', workAction:'MINE', workMultiplier:1.25
  },
  HAMMER: {
    id:'HAMMER', name:'ค้อน', category:CRAFT_CATEGORIES.TOOL,
    donorId:'hammer', equipSlot:'hand', workAction:'BUILD', workMultiplier:1
  },
  CRAFTING_TABLE_LV1: {
    id:'CRAFTING_TABLE_LV1', name:'โต๊ะคราฟต์ Lv1', category:CRAFT_CATEGORIES.BUILD,
    donorId:'crafting_table', buildingType:'crafting_table', stationProvided:CRAFT_STATIONS.CRAFTING_TABLE_LV1
  },
  FURNACE: {
    id:'FURNACE', name:'เตาหลอม', category:CRAFT_CATEGORIES.BUILD,
    donorId:'furnace', buildingType:'furnace', stationProvided:CRAFT_STATIONS.FURNACE
  }
});

// Runtime costs intentionally use only Simclone's current authoritative shared
// stock keys (wood/stone). Rust Island donor costs are retained as provenance.
export const RECIPE_CATALOG = deepFreeze({
  STONE_AXE: {
    id:'STONE_AXE', output:'STONE_AXE', quantity:1, category:CRAFT_CATEGORIES.TOOL,
    station:CRAFT_STATIONS.HAND, tier:0, materials:{wood:4,stone:2}, work:24,
    donor:{out:'stone_axe',cost:{wood:2,stone:3,rope:1},station:'hand',tier:0},
    adaptation:'Preserve existing G1-A cost until rope/fiber has one authoritative Simclone owner.'
  },
  STONE_PICKAXE: {
    id:'STONE_PICKAXE', output:'STONE_PICKAXE', quantity:1, category:CRAFT_CATEGORIES.TOOL,
    station:CRAFT_STATIONS.HAND, tier:0, materials:{wood:3,stone:4}, work:24,
    donor:{out:'stone_pick',cost:{wood:2,stone:3,rope:1},station:'hand',tier:0},
    adaptation:'Rope deferred; current shared resources only.'
  },
  CRAFTING_TABLE_LV1: {
    id:'CRAFTING_TABLE_LV1', output:'CRAFTING_TABLE_LV1', quantity:1, category:CRAFT_CATEGORIES.BUILD,
    station:CRAFT_STATIONS.HAND, tier:0, materials:{wood:10,stone:4}, work:36,
    donor:{out:'crafting_table',cost:{wood:10,stone:4},station:'hand',tier:0},
    adaptation:null
  },
  FURNACE: {
    id:'FURNACE', output:'FURNACE', quantity:1, category:CRAFT_CATEGORIES.BUILD,
    station:CRAFT_STATIONS.HAND, tier:0, materials:{stone:12}, work:40,
    donor:{out:'furnace',cost:{stone:12},station:'hand',tier:0},
    adaptation:null
  },
  HAMMER: {
    id:'HAMMER', output:'HAMMER', quantity:1, category:CRAFT_CATEGORIES.TOOL,
    station:CRAFT_STATIONS.CRAFTING_TABLE_LV1, tier:1, materials:{wood:3,stone:4}, work:28,
    donor:{out:'hammer',cost:{wood:2,stone:3,rope:1},station:'table',tier:1},
    adaptation:'Rope deferred; table/tier progression preserved.'
  }
});

const safeCount = n => Number.isSafeInteger(n) && n >= 0;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateCraftingCatalog(){
  const errors=[];
  const stationValues=new Set(Object.values(CRAFT_STATIONS));
  const categoryValues=new Set(Object.values(CRAFT_CATEGORIES));
  for (const [id,item] of Object.entries(ITEM_CATALOG)) {
    if (id!==item.id) errors.push(`item-id:${id}`);
    if (!categoryValues.has(item.category)) errors.push(`item-category:${id}`);
    if (item.stationProvided && !stationValues.has(item.stationProvided)) errors.push(`item-station:${id}`);
  }
  for (const [id,recipe] of Object.entries(RECIPE_CATALOG)) {
    if (id!==recipe.id) errors.push(`recipe-id:${id}`);
    if (!ITEM_CATALOG[recipe.output]) errors.push(`recipe-output:${id}`);
    if (!stationValues.has(recipe.station)) errors.push(`recipe-station:${id}`);
    if (!categoryValues.has(recipe.category)) errors.push(`recipe-category:${id}`);
    if (!safeCount(recipe.tier) || !Number.isSafeInteger(recipe.work) || recipe.work<=0) errors.push(`recipe-work-tier:${id}`);
    if (!record(recipe.materials) || !Object.keys(recipe.materials).length ||
        Object.entries(recipe.materials).some(([key,n])=>!['wood','stone'].includes(key)||!Number.isSafeInteger(n)||n<=0)) {
      errors.push(`recipe-materials:${id}`);
    }
  }
  return errors;
}

export function recipeById(id){ return RECIPE_CATALOG[id] ?? null; }
export function itemById(id){ return ITEM_CATALOG[id] ?? null; }

export function stationInventoryFromBuildings(buildings=[]){
  const counts={
    [CRAFT_STATIONS.HAND]:1,
    [CRAFT_STATIONS.CRAFTING_TABLE_LV1]:0,
    [CRAFT_STATIONS.FURNACE]:0
  };
  for (const b of buildings) {
    if (!b || b.complete!==true) continue;
    if (b.type==='crafting_table' && (b.tier??1)>=1) counts[CRAFT_STATIONS.CRAFTING_TABLE_LV1]++;
    if (b.type==='furnace') counts[CRAFT_STATIONS.FURNACE]++;
  }
  return counts;
}

export function craftability(state,recipeId,{stations}={}){
  const recipe=recipeById(recipeId);
  if (!recipe) return {ok:false,reason:'unknown-recipe'};
  if (!record(state?.stock)) return {ok:false,reason:'invalid-stock'};
  const availableStations=stations ?? stationInventoryFromBuildings(state.buildings);
  if (!safeCount(availableStations?.[recipe.station]) || availableStations[recipe.station]<1) {
    return {ok:false,reason:'station',station:recipe.station,tier:recipe.tier};
  }
  const missing={};
  for (const [material,needed] of Object.entries(recipe.materials)) {
    const have=state.stock[material];
    if (!safeCount(have)) return {ok:false,reason:'invalid-stock'};
    if (have<needed) missing[material]=needed-have;
  }
  if (Object.keys(missing).length) return {ok:false,reason:'materials',missing};
  return {ok:true,recipeId:recipe.id,output:recipe.output,quantity:recipe.quantity,
    station:recipe.station,tier:recipe.tier,materials:{...recipe.materials},work:recipe.work};
}

export function listCraftable(state,options={}){
  return Object.keys(RECIPE_CATALOG).sort().filter(id=>craftability(state,id,options).ok);
}
