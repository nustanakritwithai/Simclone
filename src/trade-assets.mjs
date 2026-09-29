/** ER0 canonical trade asset discriminator.
 * Missing assetType is the released physical-item contract for old saves.
 */
import {BULK_MATERIAL_KEYS} from './material-schema.mjs?v=0.5.0';

export const TRADE_ASSET_TYPES=Object.freeze({
  PHYSICAL_ITEM:'PHYSICAL_ITEM',
  BULK_RESOURCE:'BULK_RESOURCE',
});
export const BULK_TRADE_RESOURCE_KEYS=Object.freeze(['food','wood','stone',...BULK_MATERIAL_KEYS]);
const bulkKeys=new Set(BULK_TRADE_RESOURCE_KEYS);

export function tradeAssetType(row){
  if(row?.assetType===undefined||row?.assetType===TRADE_ASSET_TYPES.PHYSICAL_ITEM)return TRADE_ASSET_TYPES.PHYSICAL_ITEM;
  if(row?.assetType===TRADE_ASSET_TYPES.BULK_RESOURCE)return TRADE_ASSET_TYPES.BULK_RESOURCE;
  return null;
}
export const isPhysicalTradeAsset=row=>tradeAssetType(row)===TRADE_ASSET_TYPES.PHYSICAL_ITEM;
export const isBulkTradeAsset=row=>tradeAssetType(row)===TRADE_ASSET_TYPES.BULK_RESOURCE;
export const validBulkTradeResourceKey=key=>typeof key==='string'&&bulkKeys.has(key);
export const tradeAssetFields=type=>type===TRADE_ASSET_TYPES.BULK_RESOURCE?{assetType:TRADE_ASSET_TYPES.BULK_RESOURCE}:{};
