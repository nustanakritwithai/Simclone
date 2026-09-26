/**
 * IC6B — explicit adult cohabitation residence authority.
 * Residency never changes physical house ownership or personal material ownership.
 */
import {isIndependent} from './individual-resources.mjs?v=0.5.0';
import {activeResidenceOf,ensureSocialState,SOCIAL_RULES} from './relationships.mjs?v=0.5.0';
import {cohabitationCandidates} from './cohabitation.mjs?v=0.5.0';
import {homeOf} from './individual-housing.mjs?v=0.5.0';
import {awardLeadershipForFirstFollower} from './leadership.mjs?v=0.5.0';

const fail=(reason,message)=>({ok:false,reason,message});

export function residenceHome(s,a){
  const residence=a?.alive?activeResidenceOf(s,a.id):null;
  if(!residence)return null;
  const h=homeOf(s,residence.ownerId,{completeOnly:true});
  if(!h?.origin||h.houseId!==residence.houseId)return null;
  return {id:h.houseId,houseId:h.houseId,ownerId:h.ownerId,x:h.origin.x,y:h.origin.y};
}

export function joinHousehold(s,agentId,ownerId){
  if(!isIndependent(s))return fail('mode','ใช้การอยู่ร่วมกันแบบปัจเจกได้เฉพาะโลก Independent');
  const subject=s.agents?.find(a=>a.id===agentId&&a.alive);
  const owner=s.agents?.find(a=>a.id===ownerId&&a.alive);
  if(!subject||!owner||subject.id===owner.id)return fail('actor','เลือกคนและเจ้าของบ้านที่ยังมีชีวิตคนละคน');
  const social=ensureSocialState(s);
  const current=activeResidenceOf(s,subject.id);
  if(current){
    if(current.ownerId===owner.id)return {ok:true,changed:false,agentId:subject.id,ownerId:owner.id,houseId:current.houseId,message:'อยู่บ้านนี้ร่วมกันอยู่แล้ว'};
    return fail('resident-busy','ต้องออกจาก household เดิมก่อน');
  }
  const candidate=cohabitationCandidates(s,subject).find(r=>r.ownerId===owner.id);
  if(!candidate)return fail('relationship','หลักฐานความสัมพันธ์หรือบ้านยังไม่ผ่านเงื่อนไขอยู่ร่วมกัน');
  if(social.residences.length>=SOCIAL_RULES.maxResidences)return fail('capacity','ประวัติ household ถึงขีดจำกัด');
  const leadership=awardLeadershipForFirstFollower(s,owner.id,subject.id);
  const row={
    agentId:subject.id,
    ownerId:owner.id,
    houseId:candidate.houseId,
    joinedTick:s.tick,
    leftTick:null,
    joinReason:'relationship-evidence',
    leaveReason:null,
    evidence:structuredClone(candidate.evidence)
  };
  social.residences.push(row);
  return {ok:true,changed:true,agentId:subject.id,ownerId:owner.id,houseId:row.houseId,leadership,message:subject.name+' ย้ายมาอยู่บ้านของ '+owner.name+' แล้ว'};
}

export function leaveHousehold(s,agentId,reason='manual'){
  const social=ensureSocialState(s);
  const row=social.residences.find(r=>r.agentId===agentId&&r.leftTick===null);
  if(!row)return fail('residence','ไม่พบ household ที่กำลังอยู่ร่วมกัน');
  row.leftTick=s.tick;row.leaveReason=reason;
  const a=s.agents?.find(a=>a.id===agentId);
  return {ok:true,changed:true,agentId,row:structuredClone(row),message:(a?.name??'#'+agentId)+' ออกจาก household แล้ว'};
}

export function endResidencesForAgent(s,agentId,reason='death'){
  let changed=0;
  for(const row of s.social?.residences??[]){
    if(row.leftTick!==null)continue;
    if(row.agentId===agentId){
      row.leftTick=s.tick;row.leaveReason=reason==='death'?'resident-death':reason;changed++;
    }else if(row.ownerId===agentId){
      row.leftTick=s.tick;row.leaveReason=reason==='death'?'owner-death':reason;changed++;
    }
  }
  return changed;
}

export function householdResidenceCommand(s,type,data={}){
  if(type==='JOIN_HOUSEHOLD')return joinHousehold(s,data.agentId,data.ownerId);
  if(type==='LEAVE_HOUSEHOLD')return leaveHousehold(s,data.agentId,'manual');
  return null;
}
