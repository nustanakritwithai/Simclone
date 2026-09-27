import {neutralAdventurerCombatProfile} from './adventure-human-combat.mjs?v=0.5.0';
import {monsterStatsAtLevel} from './adventure-monster-stats.mjs?v=0.5.0';
import {monsterDefinition} from './adventure-monsters.mjs?v=0.5.0';
import {resolveAdventureCombat} from './adventure-combat.mjs?v=0.5.0';
import {agentHpFromCombatRatio} from './adventure-combat-stats.mjs?v=0.5.0';
import {adventureCombatLoadoutSnapshot,validateAdventureCombatLoadoutSnapshot} from './adventure-equipment-bridge.mjs?v=0.5.0';
import {wildMonsterById} from './adventure-world-monsters.mjs?v=0.5.0';

export const ADVENTURE_COMBAT_SESSION_VERSION='adventure-combat-session/v1';
export const ADVENTURE_COMBAT_SESSION_STATUSES=Object.freeze(['ACTIVE','VICTORY','DEFEATED']);
export const ADVENTURE_BASIC_ATTACK=Object.freeze({
  actionId:'ADVENTURE_BASIC_ATTACK',channel:'physical',power:40,accuracy:1,element:null,
  criticalAllowed:true,armorPierce:0,hitCount:1,statusApplications:Object.freeze([])
});
export const ADVENTURE_MONSTER_BASIC_ATTACK=Object.freeze({
  actionId:'WILD_MONSTER_BASIC_ATTACK',channel:'physical',power:40,accuracy:1,element:null,
  criticalAllowed:true,armorPierce:0,hitCount:1,statusApplications:Object.freeze([])
});
const RATINGS=Object.freeze({accuracy:1,crit:.05,evasion:0,resistance:0,penetration:0});

const integer=(n,min=Number.MIN_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min;
const freeze=value=>{
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  Object.freeze(value);for(const child of Object.values(value))freeze(child);return value;
};

function monsterProfile(session,hpCurrent){
  if(hpCurrent===undefined)hpCurrent=session.monsterHpCurrent;
  const stats=monsterStatsAtLevel(session.monsterId,session.monsterLevel);
  const def=monsterDefinition(session.monsterId);
  if(!stats.ok||!def)throw new Error('monster_profile');
  return {
    level:session.monsterLevel,types:[...def.types],
    hpMax:stats.stats.hp,hpCurrent,
    atk:stats.stats.atk,def:stats.stats.def,spAtk:stats.stats.spAtk,spDef:stats.stats.spDef,spd:stats.stats.spd,
    ...RATINGS,
  };
}

export function startAdventureCombatSession(state,agent,encounter){
  if(!agent?.alive||agent.profession!=='adventurer')throw new Error('combat_actor');
  if(agent.task)throw new Error('combat_busy');
  if(!encounter||encounter.status!=='READY'||encounter.x!==agent.x||encounter.y!==agent.y)throw new Error('combat_encounter');
  const monster=monsterStatsAtLevel(encounter.monsterId,encounter.monsterLevel);
  if(!monster.ok)throw new Error('combat_monster');
  const worldMonster=encounter.worldMonsterId?wildMonsterById(state,encounter.worldMonsterId):null;
  if(encounter.worldMonsterId){
    if(!worldMonster||worldMonster.status!=='IDLE'||worldMonster.hpCurrent<=0||
      worldMonster.monsterId!==encounter.monsterId||worldMonster.zoneId!==encounter.zoneId||
      worldMonster.level!==encounter.monsterLevel||worldMonster.rank!==encounter.rank||
      Math.abs(worldMonster.x-agent.x)+Math.abs(worldMonster.y-agent.y)!==1)throw new Error('combat_world_monster');
  }
  const loadout=adventureCombatLoadoutSnapshot(state,agent.id);
  neutralAdventurerCombatProfile(agent,encounter.adventureLevel,loadout.modifiers);
  const combatId='advcombat:'+encounter.encounterId;
  const base={
    version:ADVENTURE_COMBAT_SESSION_VERSION,
    combatId,encounterId:encounter.encounterId,expeditionId:encounter.expeditionId,
    status:'ACTIVE',zoneId:encounter.zoneId,monsterId:encounter.monsterId,monsterLevel:encounter.monsterLevel,rank:encounter.rank,
    adventureLevel:encounter.adventureLevel,x:encounter.x,y:encounter.y,startedTick:state.tick,turn:0,
    monsterHpMax:monster.stats.hp,
    loadout,lastTurn:null,
  };
  if(worldMonster)return freeze({...base,worldMonsterId:worldMonster.worldMonsterId});
  return freeze({...base,monsterHpCurrent:monster.stats.hp});
}

export function validateAdventureCombatState(state,agent){
  const c=agent?.adventureCombat;
  if(c===undefined||c===null)return [];
  const bad=['Adventure combat'];
  if(!c||c.version!==ADVENTURE_COMBAT_SESSION_VERSION||!ADVENTURE_COMBAT_SESSION_STATUSES.includes(c.status))return bad;
  if(typeof c.combatId!=='string'||typeof c.encounterId!=='string'||typeof c.expeditionId!=='string')return bad;
  if(!integer(c.startedTick,0)||c.startedTick>state.tick||!integer(c.turn,0))return bad;
  if(!integer(c.adventureLevel,1)||c.adventureLevel>60||!integer(c.monsterLevel,1)||c.monsterLevel>60)return bad;
  if(!integer(c.x,0)||!integer(c.y,0)||agent.x!==c.x||agent.y!==c.y)return bad;
  const monster=monsterStatsAtLevel(c.monsterId,c.monsterLevel);if(!monster.ok)return bad;
  if(c.monsterHpMax!==monster.stats.hp)return bad;
  const worldBound=typeof c.worldMonsterId==='string';
  let terminalHp=null;
  if(worldBound){
    if(Object.prototype.hasOwnProperty.call(c,'monsterHpCurrent'))return bad;
    const entity=wildMonsterById(state,c.worldMonsterId);
    if(!entity||entity.monsterId!==c.monsterId||entity.zoneId!==c.zoneId||entity.level!==c.monsterLevel||entity.rank!==c.rank||
      entity.hpMax!==c.monsterHpMax||Math.abs(entity.x-agent.x)+Math.abs(entity.y-agent.y)!==1)return bad;
    terminalHp=entity.hpCurrent;
    if(c.status==='ACTIVE'&&(entity.status!=='ENGAGED'||entity.engagedByAgentId!==agent.id||entity.hpCurrent<=0))return bad;
    if(c.status==='VICTORY'&&(entity.status!=='ENGAGED'||entity.engagedByAgentId!==agent.id||entity.hpCurrent!==0))return bad;
    if(c.status==='DEFEATED'&&(entity.status!=='IDLE'||entity.engagedByAgentId!==null||entity.hpCurrent<=0))return bad;
  }else{
    if(!integer(c.monsterHpCurrent,0)||c.monsterHpCurrent>c.monsterHpMax)return bad;
    terminalHp=c.monsterHpCurrent;
    if(c.status==='ACTIVE'&&terminalHp===0)return bad;
    if(c.status==='VICTORY'&&terminalHp!==0)return bad;
  }
  if(c.status==='DEFEATED'&&agent.hp<=0)return bad;
  if((c.status==='ACTIVE'||c.loadout!==undefined)&&validateAdventureCombatLoadoutSnapshot(c.loadout).length)return bad;
  if(c.lastTurn!==null){
    if(!c.lastTurn||!integer(c.lastTurn.turn,0)||c.lastTurn.turn!==c.turn-1)return bad;
    if(!['ACTIVE','VICTORY','DEFEATED'].includes(c.lastTurn.status))return bad;
  }
  return [];
}

export function resolveAdventureCombatTurnProposal(state,agent,session,{action}={}){
  if(action!=='BASIC_ATTACK')throw new Error('combat_action');
  if(validateAdventureCombatState(state,{...agent,adventureCombat:session}).length)throw new Error('combat_state');
  if(session.status!=='ACTIVE')throw new Error('combat_not_active');
  if(!agent.alive||agent.profession!=='adventurer'||agent.x!==session.x||agent.y!==session.y)throw new Error('combat_actor');
  if(!(agent.hp>0))throw new Error('combat_hp');

  const hero=neutralAdventurerCombatProfile(agent,session.adventureLevel,session.loadout.modifiers);
  const worldMonster=session.worldMonsterId?wildMonsterById(state,session.worldMonsterId):null;
  const monsterHpBefore=worldMonster?worldMonster.hpCurrent:session.monsterHpCurrent;
  const monsterBefore=monsterProfile(session,monsterHpBefore);
  const heroOutcome=resolveAdventureCombat({
    attacker:hero,defender:monsterBefore,action:ADVENTURE_BASIC_ATTACK,
    rng:{seed:state.seed,ticket:session.combatId+':turn:'+session.turn+':hero',sequence:session.turn}
  });
  const monsterHpAfter=heroOutcome.hpAfter;
  let counterOutcome=null,status=monsterHpAfter===0?'VICTORY':'ACTIVE',agentHpAfter=agent.hp;

  if(status==='ACTIVE'){
    const monsterAfter=monsterProfile(session,monsterHpAfter);
    counterOutcome=resolveAdventureCombat({
      attacker:monsterAfter,defender:hero,action:ADVENTURE_MONSTER_BASIC_ATTACK,
      rng:{seed:state.seed,ticket:session.combatId+':turn:'+session.turn+':monster',sequence:session.turn}
    });
    if(counterOutcome.hpAfter===0){
      status='DEFEATED';
      agentHpAfter=1;
    }else{
      agentHpAfter=agentHpFromCombatRatio(counterOutcome.hpAfter,hero.hpMax);
      if(agentHpAfter<=0)agentHpAfter=1;
    }
  }

  const lastTurn=freeze({
    turn:session.turn,status,
    heroDamage:heroOutcome.damage,heroHit:heroOutcome.hit,heroCritical:heroOutcome.critical,
    counterDamage:counterOutcome?.damage??0,counterHit:counterOutcome?.hit??false,counterCritical:counterOutcome?.critical??false,
    monsterHpBefore,monsterHpAfter,
    agentHpBefore:agent.hp,agentHpAfter,
  });
  const nextSession=session.worldMonsterId
    ?freeze({...session,status,turn:session.turn+1,lastTurn})
    :freeze({...session,status,turn:session.turn+1,monsterHpCurrent:monsterHpAfter,lastTurn});
  return freeze({session:nextSession,agentHpAfter,monsterHpBefore,monsterHpAfter,heroOutcome,counterOutcome});
}
