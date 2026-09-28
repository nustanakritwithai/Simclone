import {proposeAdventureLoot} from './adventure-loot.mjs?v=0.5.0';
import {monsterDefinition} from './adventure-monsters.mjs?v=0.5.0';
import {verifyAdventureCombatTerminalEvidence} from './adventure-combat-reward.mjs?v=0.5.0';
import {BLUEPRINT_ITEM_KIND,blueprintSessionErrors,blueprintPayload,validBlueprintItem,sameBlueprintPayload} from './craft-blueprints.mjs?v=0.5.0';
export const ADVENTURE_LOOT_COMMIT_VERSION='adventure-loot-commit/v1';
export const ADVENTURE_BLUEPRINT_LOOT_COMMIT_VERSION='adventure-loot-commit/v2';
const freeze=value=>{
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  Object.freeze(value);for(const child of Object.values(value))freeze(child);return value;
};
const int=(x,min=0)=>Number.isSafeInteger(x)&&x>=min;
const validReceipt=(r,s)=>{
  if(!r||![ADVENTURE_LOOT_COMMIT_VERSION,ADVENTURE_BLUEPRINT_LOOT_COMMIT_VERSION].includes(r.version)||r.status!=='COMMITTED')return false;
  if(!Array.isArray(r.itemIds)||r.itemIds.some(id=>!int(id,1))||new Set(r.itemIds).size!==r.itemIds.length||!int(r.committedTick))return false;
  if(!Array.isArray(r.items)||r.items.some(i=>!i||!int(i.quantity,1)||typeof i.itemKind!=='string')||!int(r.bagged)||!int(r.dropped))return false;
  if(r.version===ADVENTURE_LOOT_COMMIT_VERSION&&r.items.length===0)return false;
  if(r.version===ADVENTURE_BLUEPRINT_LOOT_COMMIT_VERSION&&s?.blueprintOffer===undefined)return false;
  return r.outcomeId===s?.reward?.outcomeId&&r.claimKey==='ADVENTURE_LOOT:'+r.outcomeId&&r.bagged+r.dropped===r.itemIds.length;
};
/** Read-only terminal projection. New sessions reuse their frozen offer; legacy
 * results never acquire a retroactive Blueprint or a different loot profile. */
export function verifiedAdventureLootProposal(state,agent,session){
  if(!agent?.alive||session?.status!=='VICTORY')throw new Error('loot_victory_required');
  const evidence=verifyAdventureCombatTerminalEvidence(session);
  if(evidence.evidence!=='VERIFIED'||evidence.outcome!=='VICTORY')throw new Error('loot_outcome_not_verified');
  if(session.reward?.evidence!=='VERIFIED'||session.reward?.status!=='COMMITTED'||session.reward?.outcomeId!==evidence.outcomeId)throw new Error('loot_reward_receipt');
  if(blueprintSessionErrors(state,agent,session).length)throw new Error('loot_blueprint_offer');
  const monster=monsterDefinition(session.monsterId);if(!monster)throw new Error('loot_monster');
  const admitted=session.blueprintOffer!==undefined;
  let items=[];
  if(monster.types[0]==='Fire')items=[...proposeAdventureLoot({
    monster:{monsterId:monster.monsterId,primaryType:monster.types[0]},rank:String(session.rank).toUpperCase(),
    outcome:{outcomeId:evidence.outcomeId,verified:true,defeated:true},rngTicket:session.combatId,
  }).items];
  else if(!admitted)throw new Error('unsupported_loot_profile');
  if(admitted&&session.blueprintOffer.recipeId!==null)items.push({itemKind:BLUEPRINT_ITEM_KIND,quantity:1,rarity:'RARE',
    blueprint:blueprintPayload(session.blueprintOffer,evidence.outcomeId,session.turn)});
  return freeze({version:admitted?ADVENTURE_BLUEPRINT_LOOT_COMMIT_VERSION:ADVENTURE_LOOT_COMMIT_VERSION,
    sourceMonsterId:monster.monsterId,outcomeId:evidence.outcomeId,claimKey:'ADVENTURE_LOOT:'+evidence.outcomeId,items});
}
export function claimVerifiedAdventureLoot(state,agent,session,{grantRust}={}){
  const proposal=verifiedAdventureLootProposal(state,agent,session);
  if(session.lootClaim!==undefined){
    if(!validReceipt(session.lootClaim,session)||validateAdventureLootClaimState(state,agent,session).length)throw new Error('loot_claim_conflict');
    return freeze({changed:false,duplicate:true,claimKey:session.lootClaim.claimKey,itemIds:[...session.lootClaim.itemIds],bagged:session.lootClaim.bagged,dropped:session.lootClaim.dropped,session});
  }
  if(typeof grantRust!=='function')throw new Error('loot_rust_authority');
  const granted=proposal.items.length?grantRust(state,{agentId:agent.id,claimKey:proposal.claimKey,items:proposal.items})
    :{ok:true,duplicate:false,itemIds:[],bagged:0,dropped:0};
  if(!granted?.ok)throw new Error('loot_rust_'+String(granted?.reason??'unknown').replaceAll('-','_'));
  const receipt=freeze({version:proposal.version,status:'COMMITTED',claimKey:proposal.claimKey,outcomeId:proposal.outcomeId,
    sourceMonsterId:proposal.sourceMonsterId,itemIds:[...granted.itemIds],bagged:granted.bagged,dropped:granted.dropped,
    items:proposal.items.map(i=>({...i})),committedTick:state.tick});
  return freeze({changed:!granted.duplicate,duplicate:!!granted.duplicate,claimKey:receipt.claimKey,itemIds:[...receipt.itemIds],
    bagged:receipt.bagged,dropped:receipt.dropped,session:freeze({...session,lootClaim:receipt})});
}
export function validateAdventureLootClaimState(state,agent,session=agent?.adventureCombat){
  const receipt=session?.lootClaim;if(receipt===undefined||receipt===null)return [];
  const bad=['Adventure loot claim'];
  if(!validReceipt(receipt,session)||receipt.committedTick>state.tick)return bad;
  const p=state.rustPossessions;if(!p)return bad;
  if(receipt.version===ADVENTURE_BLUEPRINT_LOOT_COMMIT_VERSION){
    let expected;try{expected=verifiedAdventureLootProposal(state,agent,session);}catch{return bad;}
    if(receipt.items.length!==expected.items.length||receipt.sourceMonsterId!==expected.sourceMonsterId)return bad;
    if(receipt.items.some((row,n)=>{const e=expected.items[n];return row.itemKind!==e.itemKind||row.quantity!==e.quantity||row.rarity!==e.rarity||
      (e.blueprint?!sameBlueprintPayload(row.blueprint,e.blueprint):row.blueprint!==undefined);}))return bad;
  }
  const found=receipt.itemIds.map(id=>p.items.find(i=>i.id===id));
  if(found.some(i=>!i||i.sourceClaimKey!==receipt.claimKey||i.createdBy!==agent.id))return bad;
  if(found.length!==receipt.items.reduce((n,row)=>n+row.quantity,0))return bad;
  const expected=new Map();for(const row of receipt.items)expected.set(row.itemKind,(expected.get(row.itemKind)??0)+row.quantity);
  const actual=new Map();for(const item of found){
    actual.set(item.kind,(actual.get(item.kind)??0)+1);
    if(item.kind===BLUEPRINT_ITEM_KIND&&(!validBlueprintItem(state,item)||
      !sameBlueprintPayload(item.blueprint,receipt.items.find(r=>r.itemKind===BLUEPRINT_ITEM_KIND)?.blueprint)))return bad;
  }
  return [...expected].some(([kind,n])=>actual.get(kind)!==n)?bad:[];
}
