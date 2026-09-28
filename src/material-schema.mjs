/** RC3.2 bulk-material schema shared by resource, processing and crafting authorities. */
export const BULK_MATERIAL_VERSION='RC3.2-bulk/1';
export const BULK_MATERIAL_KEYS=Object.freeze(['charcoal','ironOre','ironIngot','steelIngot']);
export const BULK_MATERIAL_CAPS=Object.freeze({charcoal:128,ironOre:256,ironIngot:128,steelIngot:96});
export const BULK_MATERIAL_LABELS=Object.freeze({charcoal:'ถ่านไม้',ironOre:'แร่เหล็ก',ironIngot:'เหล็กแท่ง',steelIngot:'เหล็กกล้า'});
export const materialCap=key=>BULK_MATERIAL_CAPS[key]??999;
export function ensureBulkMaterialFields(record){if(!record||typeof record!=='object'||Array.isArray(record))return record;for(const key of BULK_MATERIAL_KEYS)if(record[key]===undefined)record[key]=0;return record;}
export function validBulkMaterialFields(record){return !!record&&BULK_MATERIAL_KEYS.every(key=>Number.isSafeInteger(record[key])&&record[key]>=0&&record[key]<=BULK_MATERIAL_CAPS[key]);}
