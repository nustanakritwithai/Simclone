/** Autonomous Adventurer V1 — pure intent selection over released Adventure authorities.
 * This module never mutates simulation state. Engine command() remains the only
 * writer for Hunt, Combat, Attack, Loot and Result lifecycle transitions.
 */
import {adventureProgressionSnapshot} from './adventure-progression.mjs?v=0.5.0';
import {findAdventureMonsterEngagement} from './adventure-expedition.mjs?v=0.5.0';
import {routeField,routeDistance,walkable} from './survival.mjs?v=0.5.0';

export const AUTONOMOUS_ADVENTURE_VERSION='autonomous-adventure/v1';
export const AUTONOMOUS_ADVENTURE_POLICY=Object.freeze({
  minHp:60,
  minSatiety:55,
  minEnergy:50,
  readyHoldTicks:3,
  attackIntervalTicks:6,
  resultHoldTicks:12,
});

const livingAdventurer=a=>a?.alive===true&&a.profession==='adventurer';

export function autonomousAdventureSafety(agent){
  if(!livingAdventurer(agent))return Object.freeze({ok:false,reason:'not-adventurer'});
  if(agent.hp<AUTONOMOUS_ADVENTURE_POLICY.minHp)return Object.freeze({ok:false,reason:'hp'});
  if(agent.satiety<AUTONOMOUS_ADVENTURE_POLICY.minSatiety)return Object.freeze({ok:false,reason:'satiety'});
  if(agent.energy<AUTONOMOUS_ADVENTURE_POLICY.minEnergy)return Object.freeze({ok:false,reason:'energy'});
  return Object.freeze({ok:true,reason:'safe'});
}

export function chooseAutonomousAdventureTarget(state,agent){
  if(!livingAdventurer(agent)||agent.task||agent.adventureEncounter||agent.adventureCombat)return null;
  const safe=autonomousAdventureSafety(agent);if(!safe.ok)return null;
  const progression=adventureProgressionSnapshot(agent);if(!progression)return null;
  const field=routeField(state,agent),rows=[];
  for(const monster of [...(state.wildMonsters?.entities??[])].sort((a,b)=>String(a.worldMonsterId).localeCompare(String(b.worldMonsterId)))){
    if(monster.status!=='IDLE'||monster.hpCurrent<=0)continue;
    let engagement;
    try{
      engagement=findAdventureMonsterEngagement(state,agent,monster.worldMonsterId,progression.level,{
        walkable,
        routeField:()=>field,
        routeDistance,
      });
    }catch{continue;}
    rows.push({
      worldMonsterId:monster.worldMonsterId,
      zoneId:monster.zoneId,
      monsterId:monster.monsterId,
      routeDistance:engagement.routeDistance,
    });
  }
  rows.sort((a,b)=>a.routeDistance-b.routeDistance||a.zoneId.localeCompare(b.zoneId)||a.worldMonsterId.localeCompare(b.worldMonsterId));
  return rows[0]?Object.freeze({...rows[0]}):null;
}

export function autonomousAdventureIntent(state,agent){
  if(!livingAdventurer(agent))return null;

  const combat=agent.adventureCombat;
  if(combat?.worldMonsterId){
    if(combat.status==='ACTIVE'){
      const due=combat.startedTick+(combat.turn+1)*AUTONOMOUS_ADVENTURE_POLICY.attackIntervalTicks;
      return Object.freeze(state.tick>=due
        ?{type:'attack',agentId:agent.id,expectedTurn:combat.turn,worldMonsterId:combat.worldMonsterId}
        :{type:'wait-combat',agentId:agent.id,untilTick:due});
    }
    if(['VICTORY','DEFEATED'].includes(combat.status)){
      const due=combat.startedTick+combat.turn*AUTONOMOUS_ADVENTURE_POLICY.attackIntervalTicks+AUTONOMOUS_ADVENTURE_POLICY.resultHoldTicks;
      return Object.freeze(state.tick>=due
        ?{type:'finish-result',agentId:agent.id,status:combat.status,worldMonsterId:combat.worldMonsterId,claimLoot:combat.status==='VICTORY'&&!combat.lootClaim}
        :{type:'wait-result',agentId:agent.id,untilTick:due});
    }
  }

  const encounter=agent.adventureEncounter;
  if(encounter?.status==='READY'&&encounter.worldMonsterId){
    const due=encounter.encounterTick+AUTONOMOUS_ADVENTURE_POLICY.readyHoldTicks;
    return Object.freeze(state.tick>=due
      ?{type:'start-combat',agentId:agent.id,worldMonsterId:encounter.worldMonsterId}
      :{type:'wait-encounter',agentId:agent.id,untilTick:due});
  }

  if(agent.task)return null;
  const target=chooseAutonomousAdventureTarget(state,agent);
  return target?Object.freeze({type:'start-hunt',agentId:agent.id,...target}):null;
}
