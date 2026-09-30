import {isIndependent} from './individual-resources.mjs?v=0.5.0';
import {homeOf,individualHouses} from './individual-housing.mjs?v=0.5.0';

export const POST_STUDIO_VERSION='post-studio/0.1';
export const POST_STUDIO_RULES=Object.freeze({posts:24,range:4,titleChars:96,bodyChars:280,maxCharacters:24000});

const clone=v=>JSON.parse(JSON.stringify(v));
const freeze=v=>Object.freeze(clone(v));
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const actor=(s,id)=>s.agents.find(a=>a.id===id&&a.alive)??null;
const fail=(reason,message)=>({ok:false,reason,message});
const resourceLabel=type=>({food:'อาหาร',wood:'ไม้',stone:'หิน'}[type]??type);

function hostHome(s,studio=s.postStudio){
  if(!studio||studio.hostKind!=='house')return null;
  return individualHouses(s).find(h=>h.houseId===studio.houseId&&h.complete&&h.ownerId===studio.ownerId)??null;
}
function nearStudio(s,a){
  const h=hostHome(s);
  return !!a&&!!h&&distance(a,h.origin)<=POST_STUDIO_RULES.range;
}
function archiveEntry(s,key){
  return s.culture?.entries?.find(e=>e.key===key)??null;
}
function postText(entry){
  const v=entry.value,label=resourceLabel(v.type);
  return {
    title:`พบแหล่ง${label} #${v.resourceId}`,
    body:`บันทึกจากโลกจริง: แหล่ง${label} #${v.resourceId} อยู่ที่ (${v.x}, ${v.y}) · อ้างอิง Cultural Archive ฉบับ ${entry.revision}`
  };
}

export function postStudioSnapshot(s){
  if(!s.postStudio)return null;
  return freeze(s.postStudio);
}

export function createPostStudio(s,{agentId=null,houseId=null}={}){
  if(!isIndependent(s))return fail('mode','Post Studio ใช้ใน Independent world เท่านั้น');
  if(s.postStudio)return {ok:true,changed:false,studioId:s.postStudio.studioId,message:'โลกนี้มี Post Studio อยู่แล้ว'};
  if(!s.culture||s.culture.hostKind!=='house')return fail('archive','ต้องเปิด Cultural Archive ที่บ้านก่อน');
  const a=actor(s,agentId);
  if(!a)return fail('actor','เลือกเจ้าของบ้านที่ยังมีชีวิต');
  const h=homeOf(s,a.id,{completeOnly:true});
  if(!h||h.houseId!==houseId||s.culture.houseId!==houseId||s.culture.ownerId!==a.id)
    return fail('owner','Post Studio ต้องเปิดโดยเจ้าของบ้านเดียวกับ Cultural Archive');
  if(distance(a,h.origin)>POST_STUDIO_RULES.range)return fail('range','ต้องอยู่ใกล้บ้านไม่เกิน 4 ช่องเพื่อเปิด Post Studio');
  s.postStudio={
    version:POST_STUDIO_VERSION,
    studioId:`post-studio:${h.houseId}`,
    hostKind:'house',
    houseId:h.houseId,
    ownerId:a.id,
    createdTick:s.tick,
    nextPostId:1,
    posts:[]
  };
  return {ok:true,changed:true,studioId:s.postStudio.studioId,message:'เปิด Post Studio แล้ว · ใช้หลักฐานจาก Cultural Archive เท่านั้น'};
}

export function publishStudioPost(s,{agentId=null,key=null}={}){
  const studio=s.postStudio;
  if(!studio)return fail('studio','ต้องเปิด Post Studio ก่อน');
  const a=actor(s,agentId);
  if(!a||a.id!==studio.ownerId)return fail('owner','เฉพาะเจ้าของ Post Studio ที่ยังมีชีวิตเท่านั้นที่เผยแพร่ได้');
  if(!nearStudio(s,a))return fail('range','ต้องอยู่ใกล้ Post Studio ไม่เกิน 4 ช่องเพื่อเผยแพร่');
  if(!s.culture||s.culture.houseId!==studio.houseId||s.culture.ownerId!==studio.ownerId)
    return fail('archive','Cultural Archive ต้นทางไม่ตรงกับ Post Studio');
  const entry=archiveEntry(s,key);
  if(!entry)return fail('entry','ไม่มีข้อมูลนี้ใน Cultural Archive');
  if(studio.posts.some(p=>p.sourceKey===entry.key&&p.sourceRevision===entry.revision))
    return {ok:true,changed:false,message:'Cultural Archive ฉบับนี้ถูกทำเป็นโพสต์แล้ว'};
  if(studio.posts.length>=POST_STUDIO_RULES.posts)return fail('capacity','Post Studio เต็มแล้ว · ไม่ลบโพสต์เก่าอัตโนมัติ');
  const text=postText(entry);
  if(text.title.length>POST_STUDIO_RULES.titleChars||text.body.length>POST_STUDIO_RULES.bodyChars)
    return fail('format','ข้อความโพสต์เกินขนาดที่กำหนด');
  const post=freeze({
    postId:`post:${studio.nextPostId++}`,
    authorId:a.id,
    sourceKey:entry.key,
    sourceRevision:entry.revision,
    sourceEvidenceId:entry.evidenceId,
    sourceOriginEvidenceId:entry.originEvidenceId,
    sourceObservedTick:entry.observedTick,
    publishedTick:s.tick,
    title:text.title,
    body:text.body,
    claim:entry.value
  });
  studio.posts.push(post);
  if(JSON.stringify(studio).length>POST_STUDIO_RULES.maxCharacters){
    studio.posts.pop();studio.nextPostId--;
    return fail('capacity','Post Studio เกินขนาดบันทึกที่กำหนด');
  }
  return {ok:true,changed:true,postId:post.postId,post,message:'เผยแพร่โพสต์จากหลักฐานใน Cultural Archive แล้ว'};
}

export function postStudioCommand(s,type,data={}){
  if(type==='CREATE_POST_STUDIO')return createPostStudio(s,data);
  if(type==='PUBLISH_STUDIO_POST')return publishStudioPost(s,data);
  return null;
}

export function validatePostStudio(s){
  const studio=s.postStudio;
  if(studio===undefined)return [];
  const errors=[];
  const tick=t=>Number.isSafeInteger(t)&&t>=0&&t<=s.tick;
  const ids=new Set([...s.agents,...s.archive].map(a=>a.id));
  const h=hostHome(s,studio);
  if(!isIndependent(s)||!studio||studio.version!==POST_STUDIO_VERSION||typeof studio.studioId!=='string'||
    studio.hostKind!=='house'||typeof studio.houseId!=='string'||!Number.isSafeInteger(studio.ownerId)||!ids.has(studio.ownerId)||
    !h||!tick(studio.createdTick)||!Number.isSafeInteger(studio.nextPostId)||studio.nextPostId<1||
    !Array.isArray(studio.posts)||studio.posts.length>POST_STUDIO_RULES.posts){
    return ['Post Studio'];
  }
  if(JSON.stringify(studio).length>POST_STUDIO_RULES.maxCharacters)errors.push('Post Studio size');
  const postIds=new Set();
  let maxSeq=0;
  for(const p of studio.posts){
    const seq=typeof p?.postId==='string'&&/^post:\d+$/.test(p.postId)?Number(p.postId.slice(5)):NaN;
    const v=p?.claim;
    if(!p||!Number.isSafeInteger(seq)||seq<1||postIds.has(p.postId)||p.authorId!==studio.ownerId||
      typeof p.sourceKey!=='string'||!Number.isSafeInteger(p.sourceRevision)||p.sourceRevision<1||
      typeof p.sourceEvidenceId!=='string'||typeof p.sourceOriginEvidenceId!=='string'||!tick(p.sourceObservedTick)||
      !tick(p.publishedTick)||p.sourceObservedTick>p.publishedTick||
      typeof p.title!=='string'||p.title.length<1||p.title.length>POST_STUDIO_RULES.titleChars||
      typeof p.body!=='string'||p.body.length<1||p.body.length>POST_STUDIO_RULES.bodyChars||
      !v||!Number.isSafeInteger(v.resourceId)||!['food','wood','stone'].includes(v.type)||
      !Number.isSafeInteger(v.x)||!Number.isSafeInteger(v.y)||p.sourceKey!==`resource:${v?.resourceId}`){
      errors.push('Post Studio post');
    }
    postIds.add(p?.postId);if(Number.isSafeInteger(seq))maxSeq=Math.max(maxSeq,seq);
  }
  if(studio.nextPostId<=maxSeq)errors.push('Post Studio counter');
  return [...new Set(errors)];
}
