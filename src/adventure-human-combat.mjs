import {projectAdventurerCombatStats} from './adventure-combat-stats.mjs?v=0.5.0';
import {boundCombatModifiers,ADVENTURE_LOADOUT_STAT_BOUNDS} from './adventure-gear.mjs?v=0.5.0';

export const ADVENTURE_HUMAN_COMBAT_VERSION='adventure-human-combat/v1';
export const ADVENTURE_HUMAN_BASE_STAT=50;
export const ADVENTURE_HUMAN_POTENTIAL=15;
export const ADVENTURE_HUMAN_TRAINING=0;
export const ADVENTURE_HUMAN_RATINGS=Object.freeze({
  accuracy:1,
  crit:.05,
  evasion:0,
  resistance:0,
  penetration:0,
});

const validLevel=level=>Number.isSafeInteger(level)&&level>=1&&level<=60;

function statValue(level,isHp){
  const subtotal=(2*ADVENTURE_HUMAN_BASE_STAT)+ADVENTURE_HUMAN_POTENTIAL+(ADVENTURE_HUMAN_TRAINING/4);
  const scaled=Math.floor((subtotal*level)/100);
  return scaled+(isHp?level+10:5);
}

export function neutralAdventurerCoreStatsAtLevel(level){
  if(!validLevel(level))throw new RangeError('Adventure combat level must be 1..60');
  return Object.freeze({
    hp:statValue(level,true),
    atk:statValue(level,false),
    def:statValue(level,false),
    spAtk:statValue(level,false),
    spDef:statValue(level,false),
    spd:statValue(level,false),
  });
}

export function adventurerCoreStatsWithLoadout(level,loadoutModifiers={}){
  const base=neutralAdventurerCoreStatsAtLevel(level);
  const modifiers=boundCombatModifiers(loadoutModifiers,ADVENTURE_LOADOUT_STAT_BOUNDS);
  return Object.freeze({
    hp:base.hp+(modifiers.HP??0),
    atk:base.atk+(modifiers.ATK??0),
    def:base.def+(modifiers.DEF??0),
    spAtk:base.spAtk+(modifiers.SPATK??0),
    spDef:base.spDef+(modifiers.SPDEF??0),
    spd:base.spd+(modifiers.SPD??0),
  });
}

export function neutralAdventurerCombatProfile(agent,level,loadoutModifiers={}){
  if(!agent||!validLevel(level))throw new TypeError('invalid_adventurer_profile_input');
  const projected=projectAdventurerCombatStats({
    agent:{hp:agent.hp},
    adventureProgression:{combatLevel:level,coreStats:adventurerCoreStatsWithLoadout(level,loadoutModifiers)},
    ratings:ADVENTURE_HUMAN_RATINGS,
  });
  if(!projected.ok)throw new Error('adventurer_profile_'+projected.reason);
  return Object.freeze({...projected.profile,types:Object.freeze([])});
}
