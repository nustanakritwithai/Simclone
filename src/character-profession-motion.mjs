/** Profession Motion Profiles V1 — presentation-only selector.
 * Reads canonical profession/task/combat/travel facts and selects an animation name.
 * It never writes simulation state and never owns task, combat, economy or profession authority.
 */
export const CHARACTER_PROFESSION_MOTION_VERSION='character-profession-motion/1';

export const SHARED_CHARACTER_MOTIONS=Object.freeze([
  'idle','walk','run','jump','fall','land','crouch','hit'
]);

export const PROFESSION_PROFILE_ORDER=Object.freeze([
  'forager','woodcutter','miner','builder','crafter','merchant','adventurer'
]);

export const PROFESSION_MOTION_GROUPS=Object.freeze({
  forager:Object.freeze(['forage']),
  woodcutter:Object.freeze(['woodcut']),
  miner:Object.freeze(['mine']),
  builder:Object.freeze(['build']),
  crafter:Object.freeze(['craft','process']),
  merchant:Object.freeze(['merchant-inspect','merchant-trade']),
  adventurer:Object.freeze(['hunt','attack','guard','victory'])
});

const TASK_MOTION_BY_PROFESSION=Object.freeze({
  forager:Object.freeze({FORAGE:'forage'}),
  woodcutter:Object.freeze({WOODCUT:'woodcut'}),
  miner:Object.freeze({MINE:'mine'}),
  builder:Object.freeze({BUILD:'build'}),
  crafter:Object.freeze({CRAFT:'craft',PROCESS:'process'}),
  merchant:Object.freeze({MERCHANT:'merchant-inspect'}),
  adventurer:Object.freeze({HUNT:'hunt',ADVENTURE_HUNT:'hunt'})
});

const PRODUCTIVE_TASKS=new Set(['FORAGE','WOODCUT','MINE','BUILD','CRAFT','PROCESS']);

export function professionMotionGroup(profession){
  return PROFESSION_MOTION_GROUPS[profession]??Object.freeze([]);
}

export function motionForAgent(agent){
  if(agent?.adventureCombat?.status==='ACTIVE')return 'attack';
  const profession=typeof agent?.profession==='string'?agent.profession:'';
  const task=agent?.task,kind=task?.kind;
  const moving=Array.isArray(task?.path)&&task.path.length>0;

  if(moving){
    if(profession==='adventurer'&&(kind==='HUNT'||kind==='ADVENTURE_HUNT'||task?.adventureHunt))return 'hunt';
    return 'walk';
  }

  if(profession==='merchant'&&task?.rc4MarketTravel)return 'merchant-trade';
  if(profession==='adventurer'&&task?.adventureHunt)return 'hunt';

  const mapped=TASK_MOTION_BY_PROFESSION[profession]?.[kind];
  if(mapped)return mapped;

  // Compatibility fallback: unknown/mismatched profession must not borrow
  // another profession's signature animation.
  if(PRODUCTIVE_TASKS.has(kind))return 'work';
  return 'idle';
}
