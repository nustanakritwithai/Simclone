import {ADVENTURE_GEAR_EXAMPLES,ADVENTURE_GEAR_SLOTS,calculateLoadoutModifiers} from './adventure-gear.mjs?v=0.5.0';
import {calculateUpgradeModifiers,ADVENTURE_MAX_UPGRADE_LEVEL} from './adventure-upgrade.mjs?v=0.5.0';
import {equipmentSlotOf} from './rust-possessions.mjs?v=0.5.0';

export const ADVENTURE_EQUIPMENT_BRIDGE_VERSION='adventure-equipment-bridge/v1';

const freeze=value=>{
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  Object.freeze(value);for(const child of Object.values(value))freeze(child);return value;
};
const orderedSlots=new Map(ADVENTURE_GEAR_SLOTS.map((slot,index)=>[slot,index]));

export function adventureCombatLoadoutSnapshot(state,agentId){
  const p=state?.rustPossessions;
  if(!p||!Number.isSafeInteger(agentId))return freeze({version:ADVENTURE_EQUIPMENT_BRIDGE_VERSION,items:freeze([]),modifiers:calculateLoadoutModifiers([])});
  const items=[];
  for(const row of p.equipment??[]){
    const slot=equipmentSlotOf(row);
    if(row.agentId!==agentId||!ADVENTURE_GEAR_SLOTS.includes(slot))continue;
    const item=p.items?.find(i=>i.id===row.itemId&&i.location?.kind==='bag'&&i.location.agentId===agentId);
    const gear=item&&ADVENTURE_GEAR_EXAMPLES[item.kind];
    if(!item||!gear||gear.slot!==slot||!Number.isSafeInteger(item.upgradeLevel)||item.upgradeLevel<0||item.upgradeLevel>ADVENTURE_MAX_UPGRADE_LEVEL)throw new Error('invalid_adventure_equipment');
    items.push(freeze({
      itemId:item.id,gearId:gear.gearId,slot,rarity:gear.rarity,upgradeLevel:item.upgradeLevel,
      modifiers:calculateUpgradeModifiers(gear.baseModifiers,item.upgradeLevel),
    }));
  }
  items.sort((a,b)=>orderedSlots.get(a.slot)-orderedSlots.get(b.slot)||a.itemId-b.itemId);
  if(new Set(items.map(i=>i.slot)).size!==items.length)throw new Error('duplicate_adventure_equipment_slot');
  return freeze({
    version:ADVENTURE_EQUIPMENT_BRIDGE_VERSION,
    items:freeze(items),
    modifiers:calculateLoadoutModifiers(items.map(i=>({slot:i.slot,modifiers:i.modifiers}))),
  });
}

export function validateAdventureCombatLoadoutSnapshot(snapshot){
  if(!snapshot||snapshot.version!==ADVENTURE_EQUIPMENT_BRIDGE_VERSION||!Array.isArray(snapshot.items)||snapshot.items.length>ADVENTURE_GEAR_SLOTS.length)return ['Adventure loadout'];
  try{
    const seen=new Set(),entries=[];
    for(const item of snapshot.items){
      const gear=ADVENTURE_GEAR_EXAMPLES[item?.gearId];
      if(!gear||item.slot!==gear.slot||seen.has(item.slot)||!Number.isSafeInteger(item.itemId)||!Number.isSafeInteger(item.upgradeLevel)||item.upgradeLevel<0||item.upgradeLevel>ADVENTURE_MAX_UPGRADE_LEVEL)return ['Adventure loadout'];
      const modifiers=calculateUpgradeModifiers(gear.baseModifiers,item.upgradeLevel);
      if(JSON.stringify(modifiers)!==JSON.stringify(item.modifiers))return ['Adventure loadout'];
      seen.add(item.slot);entries.push({slot:item.slot,modifiers});
    }
    if(JSON.stringify(calculateLoadoutModifiers(entries))!==JSON.stringify(snapshot.modifiers))return ['Adventure loadout'];
  }catch{return ['Adventure loadout'];}
  return [];
}
