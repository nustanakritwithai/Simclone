import {ensureSkillProvenanceSkill,provenanceTotal} from './skill-provenance.mjs?v=0.5.0';

export const ADVENTURE_PROGRESSION_VERSION='adventure-progression/v1';
export const ADVENTURE_SKILL='ADVENTURE';
export const ADVENTURE_LEVEL_MIN=1;
export const ADVENTURE_LEVEL_MAX=60;
export const ADVENTURE_XP_SCALE=20;
export const ADVENTURE_INHERITANCE_RATE=.35;

const validXp=x=>Number.isSafeInteger(x)&&x>=0;

export function adventureXpForLevel(level){
  if(!Number.isSafeInteger(level)||level<ADVENTURE_LEVEL_MIN||level>ADVENTURE_LEVEL_MAX)throw new RangeError('Adventure level must be 1..60');
  return ADVENTURE_XP_SCALE*(level-1)*(level-1);
}

export function adventureLevelFromXp(xp){
  if(!validXp(xp))throw new RangeError('Adventure XP must be a non-negative safe integer');
  return Math.min(ADVENTURE_LEVEL_MAX,1+Math.floor(Math.sqrt(xp/ADVENTURE_XP_SCALE)));
}

export function inheritedAdventureXp(parent){
  const xp=parent?.skills?.[ADVENTURE_SKILL];
  if(!validXp(xp))return 0;
  return Math.floor(xp*ADVENTURE_INHERITANCE_RATE);
}

export function ensureAdventureProgressionSkill(agent,{tick=0}={}){
  if(!agent?.skills)return false;
  return ensureSkillProvenanceSkill(agent,ADVENTURE_SKILL,{xp:0,kind:'initial',tick});
}

export function adventureProgressionSnapshot(agent){
  const xp=agent?.skills?.[ADVENTURE_SKILL];
  if(!validXp(xp))return null;
  const level=adventureLevelFromXp(xp),floorXp=adventureXpForLevel(level);
  const nextLevelXp=level>=ADVENTURE_LEVEL_MAX?null:adventureXpForLevel(level+1);
  return Object.freeze({
    version:ADVENTURE_PROGRESSION_VERSION,
    skill:ADVENTURE_SKILL,
    xp,
    level,
    levelMin:ADVENTURE_LEVEL_MIN,
    levelMax:ADVENTURE_LEVEL_MAX,
    levelFloorXp:floorXp,
    nextLevelXp,
    xpIntoLevel:xp-floorXp,
    xpToNext:nextLevelXp===null?0:nextLevelXp-xp,
  });
}

export function validateAdventureProgression(agent,{required=true}={}){
  const xp=agent?.skills?.[ADVENTURE_SKILL];
  const bucket=agent?.skillProvenance?.bySkill?.[ADVENTURE_SKILL];
  if(!required&&xp===undefined&&bucket===undefined)return [];
  if(!validXp(xp)||!bucket)return ['Adventure progression'];
  if(provenanceTotal(bucket)!==xp)return ['Adventure progression provenance'];
  const snapshot=adventureProgressionSnapshot(agent);
  if(!snapshot||snapshot.level<ADVENTURE_LEVEL_MIN||snapshot.level>ADVENTURE_LEVEL_MAX)return ['Adventure progression'];
  return [];
}
