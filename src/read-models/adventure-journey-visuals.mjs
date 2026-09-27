/** Display V1 / D3 — read-only Same-World Adventure journey projection.
 * Reads SWA4-SWA6 authority only. Owns no gameplay state, timer, RNG, DOM or command.
 */
export const ADVENTURE_JOURNEY_VISUAL_VERSION='display-d3/v1';
export const ADVENTURE_JOURNEY_PHASES=Object.freeze(['HUNT','READY','ENGAGED','VICTORY','DEFEATED']);
export const ADVENTURE_DEFEAT_CUE_TICKS=18;
export const ADVENTURE_RESPAWN_CUE_TICKS=18;

const PHASE_SET=new Set(ADVENTURE_JOURNEY_PHASES);
const monsterById=(state,id)=>state?.wildMonsters?.entities?.find(m=>m.worldMonsterId===id)??null;

function deepFreeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  for(const child of Object.values(value))deepFreeze(child);
  return Object.freeze(value);
}

function safePoint(x,y){
  return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
}

function lastTurnView(turn){
  if(!turn||!Number.isSafeInteger(turn.turn))return null;
  return {
    turn:turn.turn,
    status:String(turn.status??'UNKNOWN'),
    heroDamage:Number.isFinite(turn.heroDamage)?turn.heroDamage:0,
    heroHit:Boolean(turn.heroHit),
    heroCritical:Boolean(turn.heroCritical),
    counterDamage:Number.isFinite(turn.counterDamage)?turn.counterDamage:0,
    counterHit:Boolean(turn.counterHit),
    counterCritical:Boolean(turn.counterCritical),
    monsterHpBefore:Number.isFinite(turn.monsterHpBefore)?turn.monsterHpBefore:null,
    monsterHpAfter:Number.isFinite(turn.monsterHpAfter)?turn.monsterHpAfter:null,
    agentHpBefore:Number.isFinite(turn.agentHpBefore)?turn.agentHpBefore:null,
    agentHpAfter:Number.isFinite(turn.agentHpAfter)?turn.agentHpAfter:null
  };
}

function journeyFromAgent(state,agent,activeAgentId){
  const combat=agent?.adventureCombat;
  if(combat?.worldMonsterId&&PHASE_SET.has(combat.status==='ACTIVE'?'ENGAGED':combat.status)){
    const monster=monsterById(state,combat.worldMonsterId),phase=combat.status==='ACTIVE'?'ENGAGED':combat.status;
    return {
      agentId:agent.id,active:agent.id===activeAgentId,phase,
      actor:safePoint(agent.x,agent.y),
      targetWorldMonsterId:combat.worldMonsterId,
      target:monster?safePoint(monster.x,monster.y):null,
      zoneId:combat.zoneId??monster?.zoneId??null,
      monsterId:combat.monsterId??monster?.monsterId??null,
      monsterStatus:monster?.status??null,
      monsterHpCurrent:monster?.hpCurrent??null,
      monsterHpMax:monster?.hpMax??combat.monsterHpMax??null,
      path:[],
      combatTurn:Number.isSafeInteger(combat.turn)?combat.turn:null,
      lastTurn:lastTurnView(combat.lastTurn)
    };
  }

  const encounter=agent?.adventureEncounter;
  if(encounter?.worldMonsterId&&encounter.status==='READY'){
    const monster=monsterById(state,encounter.worldMonsterId);
    return {
      agentId:agent.id,active:agent.id===activeAgentId,phase:'READY',
      actor:safePoint(agent.x,agent.y),
      targetWorldMonsterId:encounter.worldMonsterId,
      target:monster?safePoint(monster.x,monster.y):null,
      zoneId:encounter.zoneId??monster?.zoneId??null,
      monsterId:encounter.monsterId??monster?.monsterId??null,
      monsterStatus:monster?.status??null,
      monsterHpCurrent:monster?.hpCurrent??null,
      monsterHpMax:monster?.hpMax??null,
      path:[],combatTurn:null,lastTurn:null
    };
  }

  const hunt=agent?.task?.adventureHunt;
  if(hunt?.worldMonsterId){
    const monster=monsterById(state,hunt.worldMonsterId);
    return {
      agentId:agent.id,active:agent.id===activeAgentId,phase:'HUNT',
      actor:safePoint(agent.x,agent.y),
      targetWorldMonsterId:hunt.worldMonsterId,
      target:monster?safePoint(monster.x,monster.y):safePoint(hunt.monsterX,hunt.monsterY),
      engagement:safePoint(hunt.targetX,hunt.targetY),
      zoneId:hunt.zoneId??monster?.zoneId??null,
      monsterId:monster?.monsterId??null,
      monsterStatus:monster?.status??null,
      monsterHpCurrent:monster?.hpCurrent??null,
      monsterHpMax:monster?.hpMax??null,
      path:[safePoint(agent.x,agent.y),...(agent.task.path??[]).map(p=>safePoint(p.x,p.y))].filter(Boolean),
      combatTurn:null,lastTurn:null
    };
  }
  return null;
}

function lifecycleCues(state){
  const rows=[],tick=Number.isSafeInteger(state?.tick)?state.tick:0;
  for(const monster of state?.wildMonsters?.entities??[]){
    if((monster.status==='DEFEATED'||monster.status==='RESPAWNING')&&Number.isSafeInteger(monster.defeatedTick)){
      const age=tick-monster.defeatedTick;
      if(age>=0&&age<=ADVENTURE_DEFEAT_CUE_TICKS)rows.push({
        kind:'DEFEAT',worldMonsterId:monster.worldMonsterId,monsterId:monster.monsterId,
        zoneId:monster.zoneId,x:monster.x,y:monster.y,ageTicks:age,status:monster.status
      });
    }
    if(monster.status==='IDLE'&&Number.isSafeInteger(monster.spawnEpoch)&&monster.spawnEpoch>0&&Number.isSafeInteger(monster.spawnedTick)){
      const age=tick-monster.spawnedTick;
      if(age>=0&&age<=ADVENTURE_RESPAWN_CUE_TICKS)rows.push({
        kind:'RESPAWN',worldMonsterId:monster.worldMonsterId,monsterId:monster.monsterId,
        zoneId:monster.zoneId,x:monster.x,y:monster.y,ageTicks:age,spawnEpoch:monster.spawnEpoch,status:monster.status
      });
    }
  }
  return rows;
}

export function adventureJourneyVisualSnapshot(state,{activeAgentId=null}={}){
  const journeys=[];
  for(const agent of state?.agents??[]){
    if(!agent?.alive)continue;
    const row=journeyFromAgent(state,agent,activeAgentId);
    if(row)journeys.push(row);
  }
  journeys.sort((a,b)=>a.agentId-b.agentId||a.phase.localeCompare(b.phase));
  const lifecycle=lifecycleCues(state).sort((a,b)=>a.kind.localeCompare(b.kind)||a.zoneId.localeCompare(b.zoneId)||String(a.worldMonsterId).localeCompare(String(b.worldMonsterId)));
  return deepFreeze({
    version:ADVENTURE_JOURNEY_VISUAL_VERSION,
    tick:Number.isSafeInteger(state?.tick)?state.tick:0,
    activeAgentId:Number.isSafeInteger(activeAgentId)?activeAgentId:null,
    journeys,
    lifecycle
  });
}
