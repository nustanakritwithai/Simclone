/** FA-R3 canonical confirmation — deterministic persistence-based social grouping.
 * Research-only read model. It owns no gameplay state and performs no writes.
 * Career/House metadata may be attached by callers but is never used to mutate
 * profession, resources, inventory, market, wallet, task, craft, or world position.
 */
export const SOCIAL_PERSISTENCE_VERSION='FA-R3-social-persistence/1';

const positiveInt=(v,d)=>Number.isSafeInteger(v)&&v>0?v:d;
const idKey=id=>typeof id==='number'?String(id).padStart(12,'0'):String(id);
function hash32(seed,text){
  let h=(2166136261^(seed>>>0))>>>0;
  for(const ch of String(text)){h^=ch.codePointAt(0);h=Math.imul(h,16777619)>>>0;}
  h^=h>>>16;h=Math.imul(h,0x7feb352d)>>>0;h^=h>>>15;h=Math.imul(h,0x846ca68b)>>>0;h^=h>>>16;
  return h>>>0;
}
const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);for(const child of Object.values(value))freeze(child);
  }
  return value;
};
function uniqueAgentIds(agentIds){
  if(!Array.isArray(agentIds))return null;
  const out=[];const seen=new Set();
  for(const id of agentIds){
    if(!(Number.isSafeInteger(id)||typeof id==='string'))return null;
    const key=typeof id+':'+String(id);if(seen.has(key))return null;
    seen.add(key);out.push(id);
  }
  return out;
}
function movesFor(epoch,cohort,turnoverDivisor){
  if(epoch<=cohort)return 0;
  return 1+Math.floor((epoch-1-cohort)/turnoverDivisor);
}
export function projectPersistentSocialGroups(agentIds,{
  seed=230926,tick=0,groupSize=4,epochTicks=120,turnoverDivisor=4
}={}){
  const ids=uniqueAgentIds(agentIds);
  if(!ids||!Number.isSafeInteger(seed)||seed<0||!Number.isSafeInteger(tick)||tick<0)
    return freeze({version:SOCIAL_PERSISTENCE_VERSION,status:'UNKNOWN',reason:'input',groups:[],groupOf:{}});
  groupSize=positiveInt(groupSize,4);epochTicks=positiveInt(epochTicks,120);turnoverDivisor=positiveInt(turnoverDivisor,4);
  if(!ids.length)return freeze({version:SOCIAL_PERSISTENCE_VERSION,status:'SAT',reason:'empty',seed,tick,epoch:Math.floor(tick/epochTicks),groups:[],groupOf:{}});
  const ranked=[...ids].sort((a,b)=>hash32(seed,idKey(a))-hash32(seed,idKey(b))||idKey(a).localeCompare(idKey(b)));
  const groupCount=Math.max(1,Math.ceil(ranked.length/groupSize)),epoch=Math.floor(tick/epochTicks);
  const groups=Array.from({length:groupCount},(_,i)=>({groupId:'PSG:'+i,members:[]}));
  ranked.forEach((id,rank)=>{
    const base=Math.floor(rank/groupSize)%groupCount,cohort=rank%turnoverDivisor;
    const shift=movesFor(epoch,cohort,turnoverDivisor),group=(base+shift)%groupCount;
    groups[group].members.push(id);
  });
  for(const g of groups)g.members.sort((a,b)=>idKey(a).localeCompare(idKey(b)));
  const groupOf={};for(const g of groups)for(const id of g.members)groupOf[String(id)]=g.groupId;
  return freeze({
    version:SOCIAL_PERSISTENCE_VERSION,status:'SAT',reason:'projected',seed,tick,epoch,epochTicks,
    groupSize,turnoverDivisor,groupCount,groups,groupOf
  });
}
export function persistentSocialCandidateOrder(snapshot,actorId,candidateIds,{fallback=true,tieSeed=0}={}){
  const ids=uniqueAgentIds(candidateIds);
  if(snapshot?.version!==SOCIAL_PERSISTENCE_VERSION||snapshot.status!=='SAT'||!ids)
    return freeze({version:SOCIAL_PERSISTENCE_VERSION,status:'UNKNOWN',reason:'input',actorId,candidates:[]});
  const actorGroup=snapshot.groupOf?.[String(actorId)]??null;
  if(actorGroup===null)return freeze({version:SOCIAL_PERSISTENCE_VERSION,status:'UNKNOWN',reason:'actor-group',actorId,candidates:[]});
  const ranked=[...ids].sort((a,b)=>{
    const ag=snapshot.groupOf?.[String(a)]===actorGroup?0:1,bg=snapshot.groupOf?.[String(b)]===actorGroup?0:1;
    if(ag!==bg)return ag-bg;
    const ah=hash32(tieSeed,idKey(a)),bh=hash32(tieSeed,idKey(b));
    return ah-bh||idKey(a).localeCompare(idKey(b));
  });
  const inGroup=ranked.filter(id=>snapshot.groupOf?.[String(id)]===actorGroup);
  const candidates=fallback?ranked:inGroup;
  return freeze({
    version:SOCIAL_PERSISTENCE_VERSION,status:'SAT',reason:'candidate-order',actorId,actorGroup,
    inGroup:[...inGroup],candidates:[...candidates]
  });
}
export function persistenceRetention(previous,next){
  if(previous?.version!==SOCIAL_PERSISTENCE_VERSION||next?.version!==SOCIAL_PERSISTENCE_VERSION||
     previous.status!=='SAT'||next.status!=='SAT')
    return freeze({version:SOCIAL_PERSISTENCE_VERSION,status:'UNKNOWN',reason:'snapshot'});
  const ids=Object.keys(previous.groupOf??{}).filter(id=>Object.hasOwn(next.groupOf??{},id));
  if(!ids.length)return freeze({version:SOCIAL_PERSISTENCE_VERSION,status:'SAT',reason:'empty',agentRetention:1,pairRetention:1,agents:0,pairs:0});
  let sameAgents=0,pairs=0,samePairs=0;
  for(const id of ids)if(previous.groupOf[id]===next.groupOf[id])sameAgents++;
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
    const a=ids[i],b=ids[j],was=previous.groupOf[a]===previous.groupOf[b];
    if(!was)continue;pairs++;if(next.groupOf[a]===next.groupOf[b])samePairs++;
  }
  return freeze({
    version:SOCIAL_PERSISTENCE_VERSION,status:'SAT',reason:'retention',agents:ids.length,pairs,
    agentRetention:sameAgents/ids.length,pairRetention:pairs?samePairs/pairs:1
  });
}
