/**
 * Kingdom donor adaptation — household leadership skill.
 *
 * Kingdom-sandbox uses a real leadership skill plus relationship/loyalty gates.
 * Simclone keeps that semantic while adapting capacity to emergent households.
 */
import {recordEarnedSkill,ensureSkillProvenanceSkill} from './skill-provenance.mjs?v=0.5.0';
import {homeOf} from './individual-housing.mjs?v=0.5.0';
import {householdForOwner} from './relationships.mjs?v=0.5.0';

export const LEADERSHIP_SKILL='LEADERSHIP';
export const LEADERSHIP_VERSION='Kingdom-adapt-leadership-1';
export const LEADERSHIP_RULES=Object.freeze({
  xpPerLevel:10,
  maxHouseholdLevel:5,
  baseFollowerCapacity:1,
  xpPerFirstFollower:10,
});

export function ensureLeadershipSkill(agent,{parent=null,tick=0}={}){
  if(!agent?.skills)return false;
  const inherited=parent?Math.floor(Number(parent.skills?.[LEADERSHIP_SKILL]??0)*0.35):0;
  return ensureSkillProvenanceSkill(agent,LEADERSHIP_SKILL,{
    xp:inherited,
    kind:parent?'inheritance':'initial',
    sourceAgentId:parent?.id??null,
    tick
  });
}

export function leadershipLevel(agent){
  const xp=Math.max(0,Number(agent?.skills?.[LEADERSHIP_SKILL]??0));
  return Math.min(10,Math.floor(xp/LEADERSHIP_RULES.xpPerLevel));
}

export function followerCapacity(agent){
  return LEADERSHIP_RULES.baseFollowerCapacity+
    Math.min(LEADERSHIP_RULES.maxHouseholdLevel,leadershipLevel(agent));
}

export function leadershipProfile(s,ownerId){
  const owner=s.agents?.find(a=>a.id===ownerId&&a.alive);
  const home=owner&&homeOf(s,owner.id,{completeOnly:true});
  if(!owner||!home)return null;
  const household=householdForOwner(s,owner.id);
  const activeFollowers=household?.cohabitantIds?.length??0;
  const level=leadershipLevel(owner),capacity=followerCapacity(owner);
  return {
    version:LEADERSHIP_VERSION,
    ownerId:owner.id,
    houseId:home.houseId,
    xp:Number(owner.skills?.[LEADERSHIP_SKILL]??0),
    level,
    followerCapacity:capacity,
    activeFollowers,
    availableFollowerSlots:Math.max(0,capacity-activeFollowers),
  };
}

export function canAcceptFollower(s,ownerId){
  const profile=leadershipProfile(s,ownerId);
  return profile?{ok:profile.activeFollowers<profile.followerCapacity,profile}:{ok:false,profile:null};
}

/**
 * Award once for the first successful follower relationship between this pair.
 * Rejoining the same host never farms Leadership XP.
 */
export function awardLeadershipForFirstFollower(s,ownerId,followerId){
  const owner=s.agents?.find(a=>a.id===ownerId&&a.alive);
  if(!owner)return {ok:false,reason:'owner'};
  ensureLeadershipSkill(owner,{tick:s.tick});
  const prior=(s.social?.residences??[]).some(r=>r.ownerId===ownerId&&r.agentId===followerId);
  if(prior)return {ok:true,changed:false,xp:owner.skills[LEADERSHIP_SKILL],level:leadershipLevel(owner)};
  owner.skills[LEADERSHIP_SKILL]+=LEADERSHIP_RULES.xpPerFirstFollower;
  if(!recordEarnedSkill(owner,LEADERSHIP_SKILL,LEADERSHIP_RULES.xpPerFirstFollower,s.tick,{
    action:'FOLLOWER_JOIN',targetId:followerId
  }))throw new Error('Leadership provenance write failed');
  return {ok:true,changed:true,xp:owner.skills[LEADERSHIP_SKILL],level:leadershipLevel(owner)};
}
