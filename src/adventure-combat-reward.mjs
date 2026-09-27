import {monsterDefinition} from './adventure-monsters.mjs?v=0.5.0';
import {recordEarnedSkill} from './skill-provenance.mjs?v=0.5.0';
import {ADVENTURE_SKILL} from './adventure-progression.mjs?v=0.5.0';

export const ADVENTURE_COMBAT_REWARD_VERSION='adventure-combat-reward/v1';
export const ADVENTURE_COMBAT_OUTCOME_EVIDENCE=Object.freeze({
  VERIFIED:'VERIFIED',
  UNKNOWN:'OUTCOME_UNKNOWN',
  CONFLICT:'EVIDENCE_CONFLICT',
});

const freeze=value=>{
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  Object.freeze(value);for(const child of Object.values(value))freeze(child);return value;
};
const integer=(n,min=Number.MIN_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min;

function unknown(reason){
  return freeze({evidence:ADVENTURE_COMBAT_OUTCOME_EVIDENCE.UNKNOWN,reason,outcome:null,outcomeId:null,xpAward:0});
}
function conflict(reason){
  return freeze({evidence:ADVENTURE_COMBAT_OUTCOME_EVIDENCE.CONFLICT,reason,outcome:null,outcomeId:null,xpAward:0});
}

export function verifyAdventureCombatTerminalEvidence(session){
  if(!session||typeof session!=='object')return unknown('missing-session');
  if(session.status==='ACTIVE')return unknown('combat-active');
  if(!['VICTORY','DEFEATED'].includes(session.status))return conflict('invalid-terminal-status');
  if(typeof session.combatId!=='string'||!session.combatId||!integer(session.turn,1))return conflict('invalid-terminal-identity');
  const last=session.lastTurn;
  if(!last||!integer(last.turn,0)||last.turn!==session.turn-1||last.status!==session.status)return conflict('terminal-turn-unlinked');
  if(!Number.isFinite(last.heroDamage)||last.heroDamage<0||!Number.isFinite(last.counterDamage)||last.counterDamage<0)return conflict('invalid-terminal-damage');

  const outcomeId='advout:'+session.combatId+':'+session.status.toLowerCase()+':'+session.turn;
  if(session.status==='VICTORY'){
    const monster=monsterDefinition(session.monsterId);
    if(!monster||!integer(monster.baseExpYield,1))return conflict('missing-monster-exp-yield');
    const terminalHp=session.worldMonsterId!==undefined?last.monsterHpAfter:session.monsterHpCurrent;
    if(terminalHp!==0||last.monsterHpAfter!==0||!integer(last.monsterHpBefore,1))return conflict('victory-hp-conflict');
    if(last.heroDamage!==last.monsterHpBefore||last.counterDamage!==0)return conflict('victory-damage-conflict');
    return freeze({
      evidence:ADVENTURE_COMBAT_OUTCOME_EVIDENCE.VERIFIED,
      reason:'verified-victory',
      outcome:'VICTORY',
      outcomeId,
      xpAward:monster.baseExpYield,
      monsterId:session.monsterId,
    });
  }

  const terminalHp=session.worldMonsterId!==undefined?last.monsterHpAfter:session.monsterHpCurrent;
  if(!integer(terminalHp,1)||last.monsterHpAfter!==terminalHp||last.agentHpAfter!==1||last.counterDamage<=0)
    return conflict('defeat-evidence-conflict');
  return freeze({
    evidence:ADVENTURE_COMBAT_OUTCOME_EVIDENCE.VERIFIED,
    reason:'verified-defeat',
    outcome:'DEFEATED',
    outcomeId,
    xpAward:0,
    monsterId:session.monsterId,
  });
}

function rewardMatches(reward,evidence){
  if(!reward||reward.version!==ADVENTURE_COMBAT_REWARD_VERSION)return false;
  if(reward.evidence!==ADVENTURE_COMBAT_OUTCOME_EVIDENCE.VERIFIED||reward.outcome!==evidence.outcome||reward.outcomeId!==evidence.outcomeId)return false;
  if(reward.claimKey!=='ADVENTURE_XP:'+evidence.outcomeId||reward.xpAward!==evidence.xpAward)return false;
  if(!integer(reward.committedTick,0))return false;
  return evidence.outcome==='VICTORY'?reward.status==='COMMITTED':reward.status==='NO_REWARD';
}

export function commitVerifiedAdventureCombatReward(agent,session,tick){
  const evidence=verifyAdventureCombatTerminalEvidence(session);
  if(evidence.evidence!==ADVENTURE_COMBAT_OUTCOME_EVIDENCE.VERIFIED)throw new Error('combat_outcome_'+evidence.evidence.toLowerCase());
  if(!integer(tick,0))throw new Error('combat_reward_tick');

  if(session.reward!==undefined){
    if(!rewardMatches(session.reward,evidence))throw new Error('combat_reward_conflict');
    return freeze({changed:false,evidence:evidence.evidence,xpAward:0,session});
  }

  const reward=freeze({
    version:ADVENTURE_COMBAT_REWARD_VERSION,
    claimKey:'ADVENTURE_XP:'+evidence.outcomeId,
    evidence:evidence.evidence,
    outcome:evidence.outcome,
    outcomeId:evidence.outcomeId,
    status:evidence.outcome==='VICTORY'?'COMMITTED':'NO_REWARD',
    xpAward:evidence.xpAward,
    committedTick:tick,
  });

  if(evidence.xpAward>0){
    const current=agent?.skills?.[ADVENTURE_SKILL];
    const bucket=agent?.skillProvenance?.bySkill?.[ADVENTURE_SKILL];
    if(!Number.isSafeInteger(current)||current<0||!bucket)throw new Error('combat_reward_progression');
    const next=current+evidence.xpAward;
    if(!Number.isSafeInteger(next))throw new Error('combat_reward_overflow');
    agent.skills[ADVENTURE_SKILL]=next;
    if(!recordEarnedSkill(agent,ADVENTURE_SKILL,evidence.xpAward,tick,{
      action:'ADVENTURE_COMBAT_VICTORY:'+evidence.monsterId,
      targetId:null,
    })){
      agent.skills[ADVENTURE_SKILL]=current;
      throw new Error('combat_reward_provenance');
    }
  }

  return freeze({
    changed:true,
    evidence:evidence.evidence,
    xpAward:evidence.xpAward,
    session:freeze({...session,reward}),
  });
}

export function validateAdventureCombatRewardState(state,agent){
  const session=agent?.adventureCombat;
  const reward=session?.reward;
  if(reward===undefined||reward===null)return [];
  const evidence=verifyAdventureCombatTerminalEvidence(session);
  if(evidence.evidence!==ADVENTURE_COMBAT_OUTCOME_EVIDENCE.VERIFIED)return ['Adventure combat reward'];
  if(!rewardMatches(reward,evidence)||reward.committedTick>state.tick)return ['Adventure combat reward'];
  return [];
}
