import {proposeAdventureLoot} from './adventure-loot.mjs?v=0.5.0';
import {monsterDefinition} from './adventure-monsters.mjs?v=0.5.0';
import {verifyAdventureCombatTerminalEvidence} from './adventure-combat-reward.mjs?v=0.5.0';

export const ADVENTURE_LOOT_COMMIT_VERSION='adventure-loot-commit/v1';

const freeze=value=>{
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  Object.freeze(value);for(const child of Object.values(value))freeze(child);return value;
};
const validReceipt=(receipt,session)=>{
  if(!receipt||receipt.version!==ADVENTURE_LOOT_COMMIT_VERSION||receipt.status!=='COMMITTED')return false;
  if(typeof receipt.claimKey!=='string'||!Array.isArray(receipt.itemIds)||receipt.itemIds.some(id=>!Number.isSafeInteger(id)))return false;
  if(!Number.isSafeInteger(receipt.committedTick)||receipt.committedTick<0||!Array.isArray(receipt.items)||receipt.items.length===0)return false;
  return receipt.outcomeId===session?.reward?.outcomeId;
};

export function claimVerifiedAdventureLoot(state,agent,session,{grantRust}={}){
  if(!agent?.alive||session?.status!=='VICTORY')throw new Error('loot_victory_required');
  const evidence=verifyAdventureCombatTerminalEvidence(session);
  if(evidence.evidence!=='VERIFIED'||evidence.outcome!=='VICTORY')throw new Error('loot_outcome_not_verified');
  if(session.reward?.evidence!=='VERIFIED'||session.reward?.status!=='COMMITTED'||session.reward?.outcomeId!==evidence.outcomeId)throw new Error('loot_reward_receipt');
  if(session.lootClaim!==undefined){
    if(!validReceipt(session.lootClaim,session))throw new Error('loot_claim_conflict');
    return freeze({changed:false,duplicate:true,claimKey:session.lootClaim.claimKey,itemIds:[...session.lootClaim.itemIds],bagged:session.lootClaim.bagged,dropped:session.lootClaim.dropped,session});
  }
  if(typeof grantRust!=='function')throw new Error('loot_rust_authority');
  const monster=monsterDefinition(session.monsterId);
  if(!monster)throw new Error('loot_monster');
  let proposal;
  try{
    proposal=proposeAdventureLoot({
      monster:{monsterId:monster.monsterId,primaryType:monster.types[0]},
      rank:String(session.rank).toUpperCase(),
      outcome:{outcomeId:evidence.outcomeId,verified:true,defeated:true},
      rngTicket:session.combatId,
    });
  }catch(error){
    if(String(error?.message??'').includes('unsupported loot profile'))throw new Error('unsupported_loot_profile');
    throw error;
  }
  const granted=grantRust(state,{agentId:agent.id,claimKey:proposal.claimKey,items:proposal.items});
  if(!granted?.ok)throw new Error('loot_rust_'+String(granted?.reason??'unknown').replaceAll('-','_'));
  const receipt=freeze({
    version:ADVENTURE_LOOT_COMMIT_VERSION,status:'COMMITTED',
    claimKey:proposal.claimKey,outcomeId:evidence.outcomeId,sourceMonsterId:proposal.sourceMonsterId,
    itemIds:Object.freeze([...granted.itemIds]),bagged:granted.bagged,dropped:granted.dropped,
    items:Object.freeze(proposal.items.map(i=>freeze({...i}))),committedTick:state.tick,
  });
  return freeze({changed:!granted.duplicate,duplicate:!!granted.duplicate,claimKey:receipt.claimKey,itemIds:[...receipt.itemIds],bagged:receipt.bagged,dropped:receipt.dropped,session:freeze({...session,lootClaim:receipt})});
}

export function validateAdventureLootClaimState(state,agent){
  const session=agent?.adventureCombat,receipt=session?.lootClaim;
  if(receipt===undefined||receipt===null)return [];
  if(!validReceipt(receipt,session)||receipt.committedTick>state.tick)return ['Adventure loot claim'];
  const p=state.rustPossessions;
  if(!p||receipt.itemIds.length===0)return ['Adventure loot claim'];
  const found=receipt.itemIds.map(id=>p.items.find(i=>i.id===id));
  if(found.some(i=>!i||i.sourceClaimKey!==receipt.claimKey||i.createdBy!==agent.id))return ['Adventure loot claim'];
  if(found.length!==receipt.items.reduce((n,row)=>n+row.quantity,0))return ['Adventure loot claim'];
  const expected=new Map();for(const row of receipt.items)expected.set(row.itemKind,(expected.get(row.itemKind)??0)+row.quantity);
  const actual=new Map();for(const item of found)actual.set(item.kind,(actual.get(item.kind)??0)+1);
  if([...expected].some(([kind,n])=>actual.get(kind)!==n))return ['Adventure loot claim'];
  return [];
}
