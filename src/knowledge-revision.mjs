/** V0.5.1 gate: local evidence revises owned claims; it never grants world knowledge. */
import {BELIEF_STATUS,KNOWLEDGE_LIMITS} from './knowledge.mjs?v=0.5.0';

export const KNOWLEDGE_REVISION_RULES=Object.freeze({observationRange:4,staleAfterTicks:720});
const validTick=t=>Number.isSafeInteger(t)&&t>=0;
const copy=x=>JSON.parse(JSON.stringify(x));
const frozen=x=>Object.freeze(copy(x));
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const owned=(a,key)=>a?.knowledgeState?.beliefs?.find(b=>b.key===key);
const replace=(xs,key,value,max)=>{
  const i=xs.findIndex(key);if(i>=0)xs.splice(i,1);
  xs.push(frozen(value));while(xs.length>max)xs.shift();
};

/** The cognition function sees a local observation, not state.nodes. */
export function evaluateResourceObservation(claim,observation){
  if(!claim?.value||!observation||observation.x!==claim.value.x||observation.y!==claim.value.y||
    !Object.hasOwn(observation,'resource'))return {ok:false,reason:'observation'};
  const n=observation.resource;
  if(n===null)return {ok:true,status:BELIEF_STATUS.REFUTED,reason:'not-at-observed-location'};
  if(n.x!==observation.x||n.y!==observation.y)return {ok:false,reason:'observation'};
  if(n.id!==claim.value.resourceId||n.type!==claim.value.type)
    return {ok:true,status:BELIEF_STATUS.REFUTED,reason:'different-resource'};
  if(!Number.isFinite(n.amount)||n.amount<0)return {ok:false,reason:'observation'};
  // Empty now does not prove that a previous visitor was wrong or dishonest.
  return n.amount===0?{ok:true,status:BELIEF_STATUS.STALE,reason:'temporarily-depleted'}:
    {ok:true,status:BELIEF_STATUS.CONFIRMED,reason:'locally-observed'};
}

/** Engine boundary: validate actor + owned claim + locality before reading one cell. */
export function verifyResourceKnowledge(state,agentId,key){
  const agent=state?.agents?.find(a=>a.id===agentId&&a.alive);
  if(!agent||!validTick(state.tick))return {ok:false,reason:'actor'};
  const claim=owned(agent,key);
  if(!claim)return {ok:false,reason:'knowledge'};
  if(distance(agent,claim.value)>KNOWLEDGE_REVISION_RULES.observationRange)return {ok:false,reason:'out-of-range'};
  const {x,y}=claim.value;
  const local=state.nodes.filter(n=>n.x===x&&n.y===y);
  // Several resource identities can share a tile (including seeded camp nodes).
  const resource=local.find(n=>n.id===claim.value.resourceId)??local[0]??null;
  const result=evaluateResourceObservation(claim,{x,y,resource});
  if(!result.ok)return result;
  const evidenceId=`know:verify:${agent.id}:${claim.value.resourceId}:${state.tick}:${result.status}`;
  if(claim.observedTick===state.tick&&claim.status===result.status&&claim.evidenceIds.includes(evidenceId))
    return {...result,changed:false,key};
  const evidence={evidenceId,type:'observation',ownerAgentId:agent.id,sourceAgentId:null,tick:state.tick,key,
    originEvidenceId:claim.originEvidenceId};
  replace(agent.knowledgeState.evidence,e=>e.evidenceId===evidenceId,evidence,KNOWLEDGE_LIMITS.evidence);
  replace(agent.knowledgeState.beliefs,b=>b.key===key,{
    ...claim,status:result.status,confidence:result.status===BELIEF_STATUS.CONFIRMED?1:0,
    sourceKind:'direct',evidenceIds:[evidenceId],observedTick:state.tick
  },KNOWLEDGE_LIMITS.beliefs);
  replace(agent.knowledgeState.episodes,e=>e.episodeId===`episode:${agent.id}:verification:${key}`,{
    episodeId:`episode:${agent.id}:verification:${key}`,tick:state.tick,kind:'discovery',
    event:`ตรวจสอบ ${key} ณ ${x}, ${y}`,perceivedOutcome:result.reason,
    evidenceIds:[evidenceId],sourceAgentId:claim.sourceAgentId,key
  },KNOWLEDGE_LIMITS.episodes);
  return {...result,changed:true,key};
}

/** Time alone can make evidence stale, never refuted. Dead historical records are immutable. */
export function ageKnowledge(agent,tick){
  if(!agent?.alive||!validTick(tick)||!agent.knowledgeState)return 0;
  let changed=0;
  const beliefs=agent.knowledgeState.beliefs;
  for(let i=0;i<beliefs.length;i++){
    const b=beliefs[i];
    const knownTick=b.observedTick??b.receivedTick;
    if(![BELIEF_STATUS.CONFIRMED,BELIEF_STATUS.UNVERIFIED].includes(b.status)||
      !validTick(knownTick)||tick-knownTick<KNOWLEDGE_REVISION_RULES.staleAfterTicks)continue;
    changed++;
    beliefs[i]=frozen({...b,status:BELIEF_STATUS.STALE,confidence:Math.min(b.confidence,.5)});
  }
  return changed;
}
