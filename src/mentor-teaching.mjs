/** KF1 — bounded mentorship and explicit teaching.
 * Teaching transfers evidence-backed knowledge only; it never grants skill XP.
 */
import {shareKnowledge,withinKnowledgeRange,BELIEF_STATUS} from './knowledge.mjs?v=0.5.0';

export const MENTORSHIP_VERSION='mentor-kf1-0.1';
export const MENTORSHIP_RULES=Object.freeze({links:16,taughtKeys:4,periodTicks:120});

export const createMentorshipState=()=>({version:MENTORSHIP_VERSION,nextLink:1,lastProcessedTick:-1,links:[]});
export function ensureMentorshipState(s){if(s.mentorship===undefined)s.mentorship=createMentorshipState();return s.mentorship;}

const living=(s,id)=>s.agents.find(a=>a.id===id&&a.alive);
const personIds=s=>new Set([...(s.agents??[]),...(s.archive??[])].map(a=>a.id));
const activeLinks=s=>s.mentorship.links.filter(l=>l.endedTick===null);

function fail(reason,message){return {ok:false,reason,message};}
function pairExists(s,mentorId,studentId){return activeLinks(s).some(l=>l.mentorId===mentorId&&l.studentId===studentId);}

export function createMentorLink(s,mentorId,studentId){
  const m=ensureMentorshipState(s),mentor=living(s,mentorId),student=living(s,studentId);
  if(!mentor||!student||mentor.id===student.id)return fail('actor','เลือก Mentor และผู้เรียนที่ยังมีชีวิตคนละคน');
  if(pairExists(s,mentor.id,student.id))return {ok:true,changed:false,linkId:activeLinks(s).find(l=>l.mentorId===mentor.id&&l.studentId===student.id).id,message:'คู่นี้เป็น Mentor กันอยู่แล้ว'};
  if(activeLinks(s).some(l=>l.studentId===student.id))return fail('student-busy','ผู้เรียนมี Mentor ที่ยัง active อยู่แล้ว');
  if(m.links.length>=MENTORSHIP_RULES.links)return fail('capacity','จำนวนประวัติ Mentor ถึงขีดจำกัด');
  const link={id:m.nextLink++,mentorId:mentor.id,studentId:student.id,createdTick:s.tick,endedTick:null,endReason:null,taughtKeys:[]};
  m.links.push(link);
  return {ok:true,changed:true,linkId:link.id,mentorId:mentor.id,studentId:student.id,message:mentor.name+' เป็น Mentor ของ '+student.name+' แล้ว'};
}

export function endMentorLink(s,linkId,reason='manual'){
  const m=ensureMentorshipState(s),link=m.links.find(l=>l.id===linkId&&l.endedTick===null);
  if(!link)return fail('link','ไม่พบความสัมพันธ์ Mentor ที่ active');
  link.endedTick=s.tick;link.endReason=reason;
  return {ok:true,changed:true,linkId:link.id,message:'สิ้นสุดความสัมพันธ์ Mentor แล้ว'};
}

export function endMentorshipsForAgent(s,agentId,reason='death'){
  const m=ensureMentorshipState(s);let changed=0;
  for(const link of m.links)if(link.endedTick===null&&(link.mentorId===agentId||link.studentId===agentId)){
    link.endedTick=s.tick;link.endReason=reason;changed++;
  }
  return changed;
}

export function teachKnowledge(s,{mentorId,studentId,key}={}){
  const m=ensureMentorshipState(s),mentor=living(s,mentorId),student=living(s,studentId);
  const link=activeLinks(s).find(l=>l.mentorId===mentorId&&l.studentId===studentId);
  if(!mentor||!student||!link)return fail('link','ต้องมีความสัมพันธ์ Mentor ที่ active ก่อน');
  if(!withinKnowledgeRange(mentor,student))return fail('range','Mentor กับผู้เรียนอยู่ไกลเกินระยะสอน');
  if(typeof key!=='string')return fail('knowledge','ระบุความรู้ที่จะสอน');
  const claim=mentor.knowledgeState?.beliefs?.find(b=>b.key===key&&b.status===BELIEF_STATUS.CONFIRMED);
  if(!claim)return fail('knowledge','Mentor ยังไม่มีความรู้นี้ยืนยันจากประสบการณ์');
  const result=shareKnowledge(mentor,student,key,s.tick);
  if(!result.ok)return fail(result.reason??'knowledge','ถ่ายทอดความรู้ไม่ได้');
  if(!link.taughtKeys.includes(key)){link.taughtKeys.push(key);while(link.taughtKeys.length>MENTORSHIP_RULES.taughtKeys)link.taughtKeys.shift();}
  return {ok:true,changed:true,linkId:link.id,key,mentorId,studentId,message:'Mentor ถ่ายทอด '+key+' แล้ว · ผู้เรียนยังต้องตรวจเอง'};
}

export function stepMentorship(s){
  const m=ensureMentorshipState(s);
  if(s.tick%MENTORSHIP_RULES.periodTicks!==0||m.lastProcessedTick===s.tick)return null;
  m.lastProcessedTick=s.tick;
  for(const link of activeLinks(s).sort((a,b)=>a.id-b.id)){
    const mentor=living(s,link.mentorId),student=living(s,link.studentId);
    if(!mentor||!student||!withinKnowledgeRange(mentor,student))continue;
    const claim=mentor.knowledgeState.beliefs.find(b=>b.status===BELIEF_STATUS.CONFIRMED&&!link.taughtKeys.includes(b.key));
    if(!claim)continue;
    const result=teachKnowledge(s,{mentorId:mentor.id,studentId:student.id,key:claim.key});
    if(result.ok)return result;
  }
  return null;
}

export function mentorshipCommand(s,type,data={}){
  if(type==='CREATE_MENTOR_LINK')return createMentorLink(s,data.mentorId,data.studentId);
  if(type==='END_MENTOR_LINK')return endMentorLink(s,data.linkId);
  if(type==='TEACH_KNOWLEDGE')return teachKnowledge(s,data);
  return null;
}

export function validateMentorship(s){
  const m=s.mentorship;if(!m)return ['Mentorship'];
  const errors=[],ids=personIds(s),ticks=n=>Number.isInteger(n)&&n>=0&&n<=s.tick;
  if(m.version!==MENTORSHIP_VERSION||!Number.isSafeInteger(m.nextLink)||m.nextLink<1||
    !(m.lastProcessedTick===-1||ticks(m.lastProcessedTick))||!Array.isArray(m.links)||m.links.length>MENTORSHIP_RULES.links)
    return ['Mentorship'];
  const linkIds=new Set(),activeStudents=new Set();
  for(const l of m.links){
    if(!l||!Number.isSafeInteger(l.id)||linkIds.has(l.id)||!ids.has(l.mentorId)||!ids.has(l.studentId)||l.mentorId===l.studentId||
      !ticks(l.createdTick)||(l.endedTick!==null&&!ticks(l.endedTick))||(l.endedTick!==null&&l.endedTick<l.createdTick)||
      (l.endedTick===null?l.endReason!==null:typeof l.endReason!=='string')||!Array.isArray(l.taughtKeys)||
      l.taughtKeys.length>MENTORSHIP_RULES.taughtKeys||l.taughtKeys.some(k=>typeof k!=='string')||
      new Set(l.taughtKeys).size!==l.taughtKeys.length)errors.push('Mentorship link');
    if(l.endedTick===null){
      if(activeStudents.has(l.studentId))errors.push('Mentorship student');
      activeStudents.add(l.studentId);
    }
    linkIds.add(l?.id);
  }
  return [...new Set(errors)];
}
