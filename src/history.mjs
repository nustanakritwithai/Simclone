/** Historical identity storage; preserves skill provenance fields verbatim. Pure simulation data: no clocks, I/O or secondary lineage registry. */
export const ARCHIVE_VERSION='0.1.0';
export const HISTORY_LIMITS=Object.freeze({
  hotRecords:64,
  maxImportedHotRecords:200,
  maxRetained:1024,
  maxArchiveCharacters:1800000,
  maxSaveCharacters:2000000,
});
export const retainedCount=s=>s.agents.length+(s.archive?.length??0);
export const allPeople=s=>s.archive?.length?[...s.agents,...s.archive].sort((a,b)=>a.id-b.id):s.agents;
export const findPerson=(s,id)=>s.agents.find(a=>a.id===id)??s.archive?.find(a=>a.id===id);

function projection(s){
  const retired=s.agents.filter(a=>!a.alive);
  if(retired.some(a=>a.hp!==0||a.task!==null||a.moveTick!==0))return {ok:false,reason:'history-invalid'};
  // Preserve identity, lineage, birth origin, death facts, XP, source and all retained memory.
  // Only the transient decision-score trace is omitted, explicitly disclosed by the inspector.
  const archived=retired.map(a=>({...JSON.parse(JSON.stringify(a)),trace:[],archived:true}));
  const archive=[...(s.archive??[]),...archived].sort((a,b)=>a.id-b.id);
  if(JSON.stringify(archive).length>HISTORY_LIMITS.maxArchiveCharacters)return {ok:false,reason:'history-storage'};
  const agents=s.agents.filter(a=>a.alive);
  if(agents.length>=HISTORY_LIMITS.hotRecords)return {ok:false,reason:'history-hot'};
  return {ok:true,reason:'ready',archive,agents};
}

/** Read-only admission check; never charges resources or retires an identity during preview. */
export function retentionPlan(s){
  if(retainedCount(s)>=HISTORY_LIMITS.maxRetained)return {ok:false,reason:'history-capacity'};
  if(s.agents.length<HISTORY_LIMITS.hotRecords)return {ok:true,reason:'ready',needsCompaction:false};
  const p=projection(s);
  return p.ok?{ok:true,reason:'ready',needsCompaction:true}:{ok:false,reason:p.reason};
}

/** Engine-only transition, called after all birth/clone preconditions succeed. Failure is atomic. */
export function compactRetired(s){
  if(s.agents.length<HISTORY_LIMITS.hotRecords)return {ok:true,moved:0};
  const p=projection(s);if(!p.ok)return {ok:false,reason:p.reason};
  const moved=s.agents.length-p.agents.length;
  s.archive=p.archive;s.agents=p.agents;
  return {ok:true,moved};
}
