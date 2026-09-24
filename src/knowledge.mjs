/** Knowledge + Memory 0.5.0 — bounded personal claims with explicit provenance. */
export const KNOWLEDGE_VERSION='0.5.0';
export const KNOWLEDGE_LIMITS=Object.freeze({beliefs:4,evidence:8,episodes:8,shareRange:8});
export const BELIEF_STATUS=Object.freeze({
  UNVERIFIED:'UNVERIFIED',
  CONFIRMED:'CONFIRMED',
  STALE:'STALE',
  REFUTED:'REFUTED',
});

const clone=v=>JSON.parse(JSON.stringify(v));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const validTick=n=>Number.isInteger(n)&&n>=0;
const trim=(xs,max)=>{while(xs.length>max)xs.shift();return xs};

export function createKnowledgeState(){
  return {version:KNOWLEDGE_VERSION,evidence:[],beliefs:[],episodes:[]};
}

function ensure(agent){
  return agent?.knowledgeState?.version===KNOWLEDGE_VERSION&&
    Array.isArray(agent.knowledgeState.evidence)&&Array.isArray(agent.knowledgeState.beliefs)&&Array.isArray(agent.knowledgeState.episodes);
}
function upsertBy(list,key,value,max){
  const i=list.findIndex(key);
  if(i>=0)list.splice(i,1);
  list.push(value);trim(list,max);return value;
}
function addEvidence(agent,e){
  if(!ensure(agent))return null;
  const x=Object.freeze(clone(e));
  upsertBy(agent.knowledgeState.evidence,v=>v.evidenceId===x.evidenceId,x,KNOWLEDGE_LIMITS.evidence);
  return x;
}
function addEpisode(agent,e){
  if(!ensure(agent))return null;
  const x=Object.freeze(clone(e));
  upsertBy(agent.knowledgeState.episodes,v=>v.episodeId===x.episodeId,x,KNOWLEDGE_LIMITS.episodes);
  return x;
}
function addBelief(agent,b){
  if(!ensure(agent))return null;
  const x=Object.freeze(clone(b));
  upsertBy(agent.knowledgeState.beliefs,v=>v.key===x.key,x,KNOWLEDGE_LIMITS.beliefs);
  return x;
}

export function activeKnowledge(agent,key){
  if(!ensure(agent)||typeof key!=='string')return null;
  return agent.knowledgeState.beliefs.find(b=>b.key===key&&
    (b.status===BELIEF_STATUS.CONFIRMED||b.status===BELIEF_STATUS.UNVERIFIED))??null;
}

export function recordResourceDiscovery(agent,node,tick,{action=null,amount=null}={}){
  if(!ensure(agent)||!agent.alive||!node||!Number.isInteger(node.id)||!['food','wood','stone'].includes(node.type)||
    !Number.isInteger(node.x)||!Number.isInteger(node.y)||!validTick(tick))return null;
  const key=`resource:${node.id}`,evidenceId=`know:obs:${agent.id}:${node.id}:${tick}`;
  const evidence=addEvidence(agent,{
    evidenceId,type:'observation',ownerAgentId:agent.id,sourceAgentId:null,tick,key,originEvidenceId:evidenceId
  });
  const value={resourceId:node.id,type:node.type,x:node.x,y:node.y};
  const belief=addBelief(agent,{
    beliefId:`belief:${agent.id}:${key}`,key,value,status:BELIEF_STATUS.CONFIRMED,confidence:1,
    sourceKind:'direct',sourceAgentId:null,originEvidenceId:evidenceId,evidenceIds:[evidenceId],
    observedTick:tick,receivedTick:null
  });
  addEpisode(agent,{
    episodeId:`episode:${agent.id}:discovery:${node.id}`,tick,kind:'discovery',
    event:`พบแหล่ง ${node.type} #${node.id}`,
    perceivedOutcome:amount==null?`productive ${action??node.type}`:`ได้ผลผลิต ${amount}`,
    evidenceIds:[evidence.evidenceId],sourceAgentId:null,key
  });
  return belief;
}

export function shareKnowledge(sender,receiver,key,tick){
  if(!ensure(sender)||!ensure(receiver)||!sender.alive||!receiver.alive||sender.id===receiver.id||!validTick(tick))return {ok:false,reason:'actor'};
  const claim=activeKnowledge(sender,key);
  if(!claim||claim.status!==BELIEF_STATUS.CONFIRMED)return {ok:false,reason:'knowledge'};
  const evidenceId=`know:msg:${receiver.id}:${sender.id}:${tick}:${key}`;
  const evidence=addEvidence(receiver,{
    evidenceId,type:'message',ownerAgentId:receiver.id,sourceAgentId:sender.id,tick,key,
    originEvidenceId:claim.originEvidenceId
  });
  const current=activeKnowledge(receiver,key);
  if(current?.status===BELIEF_STATUS.CONFIRMED&&current.sourceKind==='direct'){
    addEpisode(receiver,{
      episodeId:`episode:${receiver.id}:share:${sender.id}:${key}`,tick,kind:'knowledge-share',
      event:`ได้รับข้อมูล ${key} จาก #${sender.id}`,perceivedOutcome:'kept direct confirmed knowledge',
      evidenceIds:[evidence.evidenceId],sourceAgentId:sender.id,key
    });
    return {ok:true,reason:'direct-kept',belief:current};
  }
  const belief=addBelief(receiver,{
    beliefId:`belief:${receiver.id}:${key}`,key,value:clone(claim.value),status:BELIEF_STATUS.UNVERIFIED,
    confidence:Math.min(.8,Math.max(.1,(claim.confidence??1)*.8)),sourceKind:'message',sourceAgentId:sender.id,
    originEvidenceId:claim.originEvidenceId,evidenceIds:[evidenceId],observedTick:null,receivedTick:tick
  });
  addEpisode(receiver,{
    episodeId:`episode:${receiver.id}:share:${sender.id}:${key}`,tick,kind:'knowledge-share',
    event:`ได้รับข้อมูล ${key} จาก #${sender.id}`,perceivedOutcome:'stored as unverified',
    evidenceIds:[evidence.evidenceId],sourceAgentId:sender.id,key
  });
  return {ok:true,reason:'shared',belief};
}

export function withinKnowledgeRange(a,b){
  if(!a||!b)return false;
  return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)<=KNOWLEDGE_LIMITS.shareRange;
}

export function validateKnowledgeState(agent){
  const errors=[],k=agent?.knowledgeState;
  if(!k||k.version!==KNOWLEDGE_VERSION||!Array.isArray(k.evidence)||!Array.isArray(k.beliefs)||!Array.isArray(k.episodes))return ['Knowledge state'];
  if(k.evidence.length>KNOWLEDGE_LIMITS.evidence||k.beliefs.length>KNOWLEDGE_LIMITS.beliefs||k.episodes.length>KNOWLEDGE_LIMITS.episodes)errors.push('Knowledge bounds');
  const evidenceIds=new Set();
  for(const e of k.evidence){
    if(!e||typeof e.evidenceId!=='string'||evidenceIds.has(e.evidenceId)||!['observation','message'].includes(e.type)||
      e.ownerAgentId!==agent.id||(e.sourceAgentId!==null&&!Number.isInteger(e.sourceAgentId))||!validTick(e.tick)||
      typeof e.key!=='string'||typeof e.originEvidenceId!=='string')errors.push('Knowledge evidence');
    evidenceIds.add(e?.evidenceId);
  }
  const beliefIds=new Set(),keys=new Set();
  for(const b of k.beliefs){
    if(!b||typeof b.beliefId!=='string'||beliefIds.has(b.beliefId)||typeof b.key!=='string'||keys.has(b.key)||
      !Object.values(BELIEF_STATUS).includes(b.status)||!finite(b.confidence)||b.confidence<0||b.confidence>1||
      !['direct','message'].includes(b.sourceKind)||(b.sourceAgentId!==null&&!Number.isInteger(b.sourceAgentId))||
      typeof b.originEvidenceId!=='string'||!Array.isArray(b.evidenceIds)||b.evidenceIds.some(x=>typeof x!=='string')||
      (b.observedTick!==null&&!validTick(b.observedTick))||(b.receivedTick!==null&&!validTick(b.receivedTick))||
      !b.value||!Number.isInteger(b.value.resourceId)||!['food','wood','stone'].includes(b.value.type)||
      !Number.isInteger(b.value.x)||!Number.isInteger(b.value.y))errors.push('Knowledge belief');
    beliefIds.add(b?.beliefId);keys.add(b?.key);
  }
  const episodeIds=new Set();
  for(const e of k.episodes){
    if(!e||typeof e.episodeId!=='string'||episodeIds.has(e.episodeId)||!validTick(e.tick)||
      !['discovery','knowledge-share'].includes(e.kind)||typeof e.event!=='string'||typeof e.perceivedOutcome!=='string'||
      !Array.isArray(e.evidenceIds)||e.evidenceIds.some(x=>typeof x!=='string')||
      (e.sourceAgentId!==null&&!Number.isInteger(e.sourceAgentId))||typeof e.key!=='string')errors.push('Knowledge episode');
    episodeIds.add(e?.episodeId);
  }
  return [...new Set(errors)];
}

export function cloneKnowledgeState(state){return clone(state);}
