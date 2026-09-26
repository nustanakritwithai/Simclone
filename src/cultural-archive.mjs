import {isIndependent,materialStock} from './individual-resources.mjs?v=0.5.0';
import {homeOf,individualHouses} from './individual-housing.mjs?v=0.5.0';
/** Bounded cultural archive: persistent written claims, not global world truth.
 * An upgraded camp enables publication and autonomous reading. Reading never
 * creates XP or confirmed knowledge; the recipient still has to verify it.
 */
import {KNOWLEDGE_LIMITS,BELIEF_STATUS} from './knowledge.mjs?v=0.5.0';
import {KNOWLEDGE_REVISION_RULES} from './knowledge-revision.mjs?v=0.5.0';
export const CULTURE_VERSION='cultural-archive-1';
export const CULTURE_RULES=Object.freeze({entries:16,history:3,range:4,periodTicks:120,woodCost:6,stoneCost:2,maxCharacters:32000});
const clone=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>Object.freeze(clone(x));
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const people=s=>[...s.agents,...s.archive];
const actor=(s,id)=>s.agents.find(a=>a.id===id&&a.alive);
export function archivePlace(s){
 if(!s.culture)return null;
 if(isIndependent(s)){const h=individualHouses(s).find(h=>h.houseId===s.culture.houseId&&h.complete&&h.ownerId===s.culture.ownerId);return h?{type:'house',id:h.houseId,...h.origin}:null;}
 return s.buildings.find(b=>b.id===s.culture.buildingId&&b.complete)??null;
}
const place=archivePlace;
const near=(s,a)=>!!a&&!!place(s)&&distance(a,place(s))<=CULTURE_RULES.range;
const entryAt=(s,key)=>s.culture?.entries.find(e=>e.key===key);
const fail=(reason,message)=>({ok:false,reason,message});
const upsert=(list,match,item,max)=>{
  const i=list.findIndex(match);if(i>=0)list.splice(i,1);list.push(freeze(item));
  while(list.length>max)list.shift();
};

export function establishArchive(s,{agentId=null,houseId=null}={}){
 if(isIndependent(s)){
  if(s.culture)return {ok:true,changed:false,message:'โลกนี้มีคลังความรู้ที่บ้านอยู่แล้ว'};
  const a=actor(s,agentId),h=a&&homeOf(s,a.id,{completeOnly:true});
  if(!a||!h||h.houseId!==houseId)return fail('owner','เลือกเจ้าของบ้านที่สร้างเสร็จแล้ว');
  if(distance(a,h.origin)>CULTURE_RULES.range)return fail('range','ต้องอยู่ใกล้บ้านไม่เกิน 4 ช่อง');
  const stock=materialStock(s,a);
  if(stock.wood<CULTURE_RULES.woodCost||stock.stone<CULTURE_RULES.stoneCost)return fail('materials','ใช้ไม้ส่วนตัว 6 และหิน 2');
  stock.wood-=CULTURE_RULES.woodCost;stock.stone-=CULTURE_RULES.stoneCost;
  s.culture={version:CULTURE_VERSION,hostKind:'house',houseId:h.houseId,ownerId:a.id,createdTick:s.tick,automation:true,lastProcessedTick:-1,entries:[]};
  return {ok:true,changed:true,message:'เปิดคลังความรู้ที่บ้านแล้ว · ไม่สร้างหมู่บ้านหรือคลังวัสดุกลาง'};
 }
  if(s.culture)return {ok:true,changed:false,message:'แคมป์มีคลังความรู้อยู่แล้ว'};
  const building=s.buildings.find(b=>b.type==='camp'&&b.complete);
  if(!building)return fail('camp','ต้องมีแคมป์ที่สร้างเสร็จก่อน');
  if(s.stock.wood<CULTURE_RULES.woodCost||s.stock.stone<CULTURE_RULES.stoneCost)
    return fail('materials','สร้างคลังที่แคมป์ใช้ไม้ 6 และหิน 2');
  const culture={version:CULTURE_VERSION,buildingId:building.id,createdTick:s.tick,automation:true,lastProcessedTick:-1,entries:[]};
  s.stock.wood-=CULTURE_RULES.woodCost;s.stock.stone-=CULTURE_RULES.stoneCost;s.culture=culture;
  return {ok:true,changed:true,message:'สร้างคลังความรู้ที่แคมป์แล้ว · คนใกล้แคมป์เริ่มบันทึกและอ่านต่อเอง'};
}

export function publishKnowledge(s,agentId,key){
  if(!s.culture)return fail('archive','สร้างคลังความรู้ที่แหล่งบันทึกก่อน');
  const a=actor(s,agentId);if(!a)return fail('actor','เลือกผู้บันทึกที่ยังมีชีวิต');
  if(!near(s,a))return fail('range','ต้องอยู่ห่างจากคลังความรู้ไม่เกิน 4 ช่องเพื่อบันทึก');
  const b=a.knowledgeState.beliefs.find(b=>b.key===key);
  if(!b||b.status!==BELIEF_STATUS.CONFIRMED||b.sourceKind!=='direct'||b.observedTick===null||
    s.tick-b.observedTick>=KNOWLEDGE_REVISION_RULES.staleAfterTicks)return fail('knowledge','ต้องยืนยันข้อมูลด้วยตนเองและยังไม่หมดอายุก่อนบันทึก');
  if(!b.value||!Number.isSafeInteger(b.value.resourceId)||b.value.resourceId<1||!['food','wood','stone'].includes(b.value.type)||
    !Number.isInteger(b.value.x)||!Number.isInteger(b.value.y)||b.value.x<0||b.value.y<0||b.value.x>=30||b.value.y>=26||
    !Number.isSafeInteger(b.observedTick)||b.observedTick<0||b.observedTick>s.tick||
    typeof b.originEvidenceId!=='string'||b.originEvidenceId.length>160||typeof b.evidenceIds.at(-1)!=='string'||b.evidenceIds.at(-1).length>160)
    return fail('knowledge','ข้อมูลความรู้ไม่อยู่ในรูปแบบที่บันทึกได้');
  const prior=entryAt(s,key);
  if(prior&&JSON.stringify(prior.value)===JSON.stringify(b.value))return {ok:true,changed:false,message:'ข้อมูลนี้มีในคลังแล้ว · ไม่สร้างรายการซ้ำ'};
  if(!prior&&s.culture.entries.length>=CULTURE_RULES.entries)return fail('capacity','คลังเต็มแล้ว · ไม่ลบความรู้เก่าเพื่อเพิ่มรายการใหม่');
  const history=prior?[...prior.history,{revision:prior.revision,authorId:prior.authorId,publishedTick:prior.publishedTick,value:prior.value}].slice(-CULTURE_RULES.history):[];
  const entry=freeze({key,value:b.value,originEvidenceId:prior?.originEvidenceId??b.originEvidenceId,
    authorId:a.id,sourceAgentId:b.sourceAgentId,publishedTick:s.tick,observedTick:b.observedTick,
    revision:(prior?.revision??0)+1,evidenceId:b.evidenceIds.at(-1),history});
  const entries=s.culture.entries.filter(e=>e.key!==key).concat(entry);
  if(JSON.stringify({...s.culture,entries}).length>CULTURE_RULES.maxCharacters)return fail('capacity','พื้นที่คลังเต็ม · ไม่เปลี่ยนข้อมูลเดิม');
  s.culture.entries=entries;
  return {ok:true,changed:true,key,revision:entry.revision,message:'บันทึกความรู้ลงคลังแล้ว · ข้อมูลจะอยู่แม้ผู้บันทึกเสียชีวิต'};
}

export function learnFromArchive(s,agentId,key){
  const entry=entryAt(s,key);if(!entry)return fail('entry','ไม่มีความรู้นี้ในคลัง');
  const a=actor(s,agentId);if(!a)return fail('actor','เลือกผู้อ่านที่ยังมีชีวิต');
  if(!near(s,a))return fail('range','ต้องอยู่ห่างจากคลังความรู้ไม่เกิน 4 ช่องเพื่ออ่าน');
  const current=a.knowledgeState.beliefs.find(b=>b.key===key);
  if(current?.sourceKind==='direct'&&current.observedTick>=entry.observedTick)
    return {ok:true,changed:false,message:'เก็บผลที่ผู้อ่านตรวจด้วยตนเองไว้ ไม่แทนที่ด้วยข้อมูลจากคลัง'};
  const evidenceId=`know:archive:${a.id}:${key}:${entry.revision}`;
  if(current?.evidenceIds.includes(evidenceId))return {ok:true,changed:false,message:'อ่านฉบับนี้แล้ว · ต้องไปตรวจจึงจะยืนยันได้'};
  upsert(a.knowledgeState.evidence,e=>e.evidenceId===evidenceId,{
    evidenceId,type:'message',channel:'archive',ownerAgentId:a.id,sourceAgentId:entry.authorId,tick:s.tick,key,
    originEvidenceId:entry.originEvidenceId,archiveRevision:entry.revision,publishedTick:entry.publishedTick
  },KNOWLEDGE_LIMITS.evidence);
  upsert(a.knowledgeState.beliefs,b=>b.key===key,{
    beliefId:`belief:${a.id}:${key}`,key,value:entry.value,status:BELIEF_STATUS.UNVERIFIED,confidence:.6,
    sourceKind:'message',sourceAgentId:entry.authorId,originEvidenceId:entry.originEvidenceId,evidenceIds:[evidenceId],
    observedTick:null,receivedTick:s.tick
  },KNOWLEDGE_LIMITS.beliefs);
  upsert(a.knowledgeState.episodes,e=>e.episodeId===`episode:${a.id}:archive:${key}`,{
    episodeId:`episode:${a.id}:archive:${key}`,tick:s.tick,kind:'knowledge-share',key,
    event:`อ่าน ${key} ฉบับ ${entry.revision} จากคลังที่ #${entry.authorId} บันทึกไว้`,
    perceivedOutcome:'archive claim received; independent verification required',evidenceIds:[evidenceId],sourceAgentId:entry.authorId
  },KNOWLEDGE_LIMITS.episodes);
  return {ok:true,changed:true,key,message:'อ่านความรู้จากคลังแล้ว · ยังไม่ยืนยันจนกว่าจะตรวจด้วยตนเอง'};
}

/** At most one successful publication or reading per boundary. No per-tick LLM. */
export function stepCulture(s){
  const c=s.culture;
  if(!c||!c.automation)return null;
  if(s.tick%CULTURE_RULES.periodTicks!==0||c.lastProcessedTick===s.tick)return null;
  c.lastProcessedTick=s.tick;
  const nearby=s.agents.filter(a=>a.alive&&near(s,a)).sort((a,b)=>a.id-b.id);
  for(const a of nearby)for(const b of a.knowledgeState.beliefs){
    const previous=entryAt(s,b.key);
    if(previous&&JSON.stringify(previous.value)===JSON.stringify(b.value))continue;
    const result=publishKnowledge(s,a.id,b.key);if(result.ok&&result.changed)return {...result,action:'publish',agentId:a.id};
  }
  // Least-informed people read first; direct observations are never overwritten.
  for(const a of nearby.slice().sort((a,b)=>a.knowledgeState.beliefs.length-b.knowledgeState.beliefs.length||a.id-b.id)){
    for(const entry of c.entries){
      const result=learnFromArchive(s,a.id,entry.key);if(result.ok&&result.changed)return {...result,action:'read',agentId:a.id};
    }
  }
  return null;
}

export function cultureCommand(s,type,data){
  if(type==='CREATE_ARCHIVE')return establishArchive(s,data);
  if(type==='PUBLISH_KNOWLEDGE')return publishKnowledge(s,data.agentId,data.key);
  if(type==='READ_ARCHIVE')return learnFromArchive(s,data.agentId,data.key);
  if(type==='SET_CULTURE_AUTOMATION'){
    if(!s.culture||typeof data.enabled!=='boolean')return fail('automation','สร้างคลังก่อน และระบุเปิดหรือปิดอย่างชัดเจน');
    s.culture.automation=data.enabled;
    return {ok:true,message:data.enabled?'เปิดบันทึกและอ่านความรู้อัตโนมัติ':'หยุดระบบบันทึกและอ่านอัตโนมัติ · ข้อมูลเดิมยังอยู่'};
  }
  return null;
}

export function validateCulture(s){
  const c=s.culture,errors=[];if(c===undefined)return people(s).some(a=>a.knowledgeState.evidence.some(e=>e.channel==='archive'))?['Missing cultural archive']:errors;
  const tick=t=>Number.isSafeInteger(t)&&t>=0&&t<=s.tick;
  const ids=new Set(people(s).map(a=>a.id)),hasId=id=>Number.isSafeInteger(id)&&ids.has(id);
  const value=v=>v&&Number.isSafeInteger(v.resourceId)&&['food','wood','stone'].includes(v.type)&&
    Number.isInteger(v.x)&&Number.isInteger(v.y)&&v.x>=0&&v.y>=0&&v.x<30&&v.y<26;
  if(!c||c.version!==CULTURE_VERSION||(isIndependent(s)?c.hostKind!=='house'||!hasId(c.ownerId)||place(s)?.type!=='house':place(s)?.type!=='camp')||!tick(c.createdTick)||typeof c.automation!=='boolean'||
    !(c.lastProcessedTick===-1||tick(c.lastProcessedTick))||!Array.isArray(c.entries)||c.entries.length>CULTURE_RULES.entries)return ['Cultural archive'];
  if(JSON.stringify(c).length>CULTURE_RULES.maxCharacters)errors.push('Cultural archive size');
  const keys=new Set();
  for(const e of c.entries){
    if(!e||typeof e.key!=='string'||keys.has(e.key)||!value(e.value)||e.key!==`resource:${e.value?.resourceId}`||
      !hasId(e.authorId)||(e.sourceAgentId!==null&&!hasId(e.sourceAgentId))||!tick(e.publishedTick)||!tick(e.observedTick)||
      e.observedTick>e.publishedTick||!Number.isSafeInteger(e.revision)||e.revision<1||
      typeof e.originEvidenceId!=='string'||e.originEvidenceId.length>160||typeof e.evidenceId!=='string'||e.evidenceId.length>160||
      !Array.isArray(e.history)||e.history.length>CULTURE_RULES.history)errors.push('Cultural entry');
    else if(e.history.some(h=>!h||!Number.isInteger(h.revision)||h.revision<1||h.revision>=e.revision||!hasId(h.authorId)||
      !tick(h.publishedTick)||h.publishedTick>e.publishedTick||!value(h.value)))errors.push('Cultural history');
    keys.add(e?.key);
  }
  for(const a of people(s))for(const e of a.knowledgeState.evidence){
    if(e.channel==='archive'&&(!entryAt(s,e.key)||!Number.isSafeInteger(e.archiveRevision)||e.archiveRevision<1||
      e.archiveRevision>entryAt(s,e.key).revision||!tick(e.publishedTick)||e.publishedTick>e.tick))errors.push('Archive evidence');
  }
  return [...new Set(errors)];
}
