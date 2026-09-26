/**
 * IC7B — Household Cooperation
 *
 * Read-only shortage signal derived from the existing Household Economy stack.
 * Never writes tasks, stock, membership, profession or relationships.
 */
import {isIndependent} from './individual-resources.mjs?v=0.5.0';
import {householdOf} from './relationships.mjs?v=0.5.0';
import {householdEconomySnapshot} from './kingdom-household-economy.mjs?v=0.5.0';
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';

export const HOUSEHOLD_COOPERATION_VERSION='IC7B-0.1';
export const MAX_HOUSEHOLD_COOPERATION_BONUS=36;

const ACTION_ROLE=Object.freeze({
  FORAGE:{role:'forager',good:'food'},
  WOODCUT:{role:'woodcutter',good:'wood'},
  MINE:{role:'miner',good:'stone'},
});
const URGENCY_FLOOR=Object.freeze({normal:12,high:24,critical:36});

export function householdCooperationSignal(s,a,kind,{emergency=false}={}){
  if(!isIndependent(s))return {version:HOUSEHOLD_COOPERATION_VERSION,bonus:0,active:false,reason:'legacy'};
  if(!a?.alive||!canPerformProductiveWork(s,a))
    return {version:HOUSEHOLD_COOPERATION_VERSION,bonus:0,active:false,reason:'non-productive'};
  if(emergency)return {version:HOUSEHOLD_COOPERATION_VERSION,bonus:0,active:false,reason:'survival-emergency'};
  const spec=ACTION_ROLE[kind];
  if(!spec)return {version:HOUSEHOLD_COOPERATION_VERSION,bonus:0,active:false,reason:'unsupported-role'};
  const household=householdOf(s,a.id);
  if(!household||!household.residentIds.includes(a.id))
    return {version:HOUSEHOLD_COOPERATION_VERSION,bonus:0,active:false,reason:'no-household',role:spec.role,good:spec.good};
  const economy=householdEconomySnapshot(s,household.ownerId);
  const offer=economy?.labor?.offers?.find(o=>o.role===spec.role)??null;
  const scarcity=Number(economy?.economy?.scarcity?.[spec.good]??0.25);
  if(!offer)return {
    version:HOUSEHOLD_COOPERATION_VERSION,bonus:0,active:false,reason:'no-shortage',
    houseId:household.houseId,ownerId:household.ownerId,role:spec.role,good:spec.good,
    scarcity:+scarcity.toFixed(3)
  };
  const floor=URGENCY_FLOOR[offer.urgency]??URGENCY_FLOOR.normal;
  const bonus=Math.min(MAX_HOUSEHOLD_COOPERATION_BONUS,Math.max(floor,Math.round(Number(offer.priority)||0)/4));
  return {
    version:HOUSEHOLD_COOPERATION_VERSION,
    bonus:+bonus.toFixed(2),active:true,reason:'household-shortage',
    houseId:household.houseId,ownerId:household.ownerId,role:spec.role,good:spec.good,
    scarcity:+scarcity.toFixed(3),urgency:offer.urgency,priority:offer.priority
  };
}
