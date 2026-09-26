/**
 * IC6D foundation — evidence-derived household leadership.
 * Leadership is a projection of inbound trust/respect, never a random personality stat.
 */
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {homeOf} from './individual-housing.mjs?v=0.5.0';
import {householdForOwner} from './relationships.mjs?v=0.5.0';

export const LEADERSHIP_VERSION='IC6D-leadership-1';
export const LEADERSHIP_RULES=Object.freeze({
  maxLevel:5,
  scorePerLevel:10,
});

export function leadershipProfile(s,ownerId){
  const owner=s.agents?.find(a=>a.id===ownerId&&a.alive);
  const home=owner&&homeOf(s,owner.id,{completeOnly:true});
  if(!owner||!home)return null;
  const contributors=[];
  let score=0;
  for(const r of s.social?.relations??[]){
    if(r.toId!==owner.id||r.fromId===owner.id)continue;
    const from=s.agents?.find(a=>a.id===r.fromId&&a.alive);
    if(!from||!canPerformProductiveWork(s,from))continue;
    const contribution=Math.max(0,r.respect)+Math.floor(Math.max(0,r.trust)/2);
    if(contribution<=0)continue;
    score+=contribution;
    contributors.push({agentId:from.id,trust:r.trust,respect:r.respect,contribution});
  }
  contributors.sort((a,b)=>b.contribution-a.contribution||a.agentId-b.agentId);
  const level=Math.min(LEADERSHIP_RULES.maxLevel,1+Math.floor(score/LEADERSHIP_RULES.scorePerLevel));
  const household=householdForOwner(s,owner.id);
  const activeFollowers=household?.cohabitantIds?.length??0;
  const followerCapacity=level;
  return {
    version:LEADERSHIP_VERSION,
    ownerId:owner.id,
    houseId:home.houseId,
    score,
    level,
    followerCapacity,
    activeFollowers,
    availableFollowerSlots:Math.max(0,followerCapacity-activeFollowers),
    contributors,
  };
}

export function canAcceptFollower(s,ownerId){
  const p=leadershipProfile(s,ownerId);
  return p?{ok:p.activeFollowers<p.followerCapacity,profile:p}:{ok:false,profile:null};
}
