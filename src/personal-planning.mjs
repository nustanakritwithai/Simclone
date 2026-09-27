/** Personal resource planning. World validation still belongs to the engine.
 * Perception supplies only nearby nodes. Remembered locations are investigation
 * targets, never authoritative statements about remote quantities or existence.
 */
import {KNOWLEDGE_REVISION_RULES,verifyResourceKnowledge} from './knowledge-revision.mjs?v=0.5.0';
import {LEGACY_WORLD_BOUNDS,coreWorldBounds,worldBounds,worldCellCount} from './world-bounds.mjs?v=0.5.0';
export const PERSONAL_PLANNING_VERSION='personal-knowledge-1';
export const EXECUTABLE_PLAN_VERSION='VAL2-0.1';
export const MULTI_STEP_SEQUENCE_VERSION='VAL7-0.1';
export const PREDICTION_RECEIPT_VERSION='VAL9-0.1';
export const EXECUTABLE_PLAN_RULES=Object.freeze({maxReplans:3,maxSteps:3});
export const PLANNING_LIMITS=Object.freeze({lessons:4,predictions:4,cells:LEGACY_WORLD_BOUNDS.w*LEGACY_WORLD_BOUNDS.h,width:LEGACY_WORLD_BOUNDS.w,height:LEGACY_WORLD_BOUNDS.h});
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const active=s=>s.planningPolicy===PERSONAL_PLANNING_VERSION;
const goalFor=kind=>({FORAGE:'secure-food',WOODCUT:'collect-wood',MINE:'collect-stone',BUILD:'finish-shelter'})[kind]??'explore';
const planId=(agent,goal,targetId,startedTick)=>'val2:'+agent.id+':'+goal+':'+(targetId??'none')+':'+startedTick;
const stepFor=(kind,phase)=>({kind,phase});
const PRODUCTIVE_KINDS=new Set(['FORAGE','WOODCUT','MINE','BUILD']);
function sequenceFor(kind,phase){
  if(kind==='EXPLORE')return {
    sequenceVersion:MULTI_STEP_SEQUENCE_VERSION,stepIndex:0,
    steps:[{id:'explore-location',kind:'EXPLORE',status:'active'},{id:'verify-outcome',kind:'VERIFY',status:'pending'}]
  };
  const verify=['visit-and-verify','verify'].includes(phase),stepIndex=verify?0:1;
  return {
    sequenceVersion:MULTI_STEP_SEQUENCE_VERSION,stepIndex,
    steps:[
      {id:'verify-target',kind:'EXPLORE',status:verify?'active':'completed'},
      {id:'productive-work',kind,status:verify?'pending':'active'},
      {id:'verify-outcome',kind:'VERIFY',status:'pending'}
    ]
  };
}
function terminalSequence(goal,result){
  if(goal?.sequenceVersion!==MULTI_STEP_SEQUENCE_VERSION||!Array.isArray(goal.steps))return {};
  const success=result==='SAT',failed=result==='VIOL',steps=goal.steps.map(s=>({...s}));
  if(goal.kind==='EXPLORE'){
    steps[0].status=success?'completed':failed?'failed':steps[0].status;
    steps[1].status=success?'completed':failed?'failed':steps[1].status;
    return {steps,stepIndex:1};
  }
  steps[0].status='completed';
  steps[1].status=success?'completed':failed?'failed':'active';
  steps[2].status=success?'completed':failed?'failed':'pending';
  return {steps,stepIndex:success||failed?2:1};
}
const init=(state,a)=>{
  const cells=worldCellCount(state),p=a.planning??={version:PERSONAL_PLANNING_VERSION,cursor:(a.id*37)%cells,goal:null,lessons:[]};
  if(!Array.isArray(p.predictions))p.predictions=[];
  return p;
};

export function setPlanningPolicy(state,policy){
  if(!['local','legacy'].includes(policy))return {ok:false,reason:'policy',message:'ไม่รู้จักนโยบายการวางแผน'};
  if((policy==='local')===active(state))return {ok:true,changed:false,policy,message:'ใช้นโยบายนี้อยู่แล้ว'};
  if(policy==='local')state.planningPolicy=PERSONAL_PLANNING_VERSION;
  else delete state.planningPolicy;
  for(const a of state.agents.filter(a=>a.alive)){
    if(policy==='local')init(state,a);
    if(a.planning?.goal)a.planning.goal={...a.planning.goal,status:'interrupted',outcome:'policy-changed'};
    a.task=null;a.moveTick=0;
  }
  return {ok:true,policy,message:policy==='local'?'ใช้การมองเห็นและความรู้ส่วนตัวแล้ว · จุดที่เคยรู้ต้องเดินไปตรวจสอบ':'กลับสู่นโยบาย Survival เดิมแล้ว · ความรู้และประวัติยังอยู่'};
}

export function personalResourceCandidates(state,agent,type){
  if(!active(state))return state.nodes.filter(n=>n.type===type&&n.amount>0);
  const result=new Map();
  for(const b of agent.knowledgeState.beliefs){
    if(b.value.type!==type||b.status==='REFUTED')continue;
    // Stale locations may be investigated, but cannot become productive jobs remotely.
    result.set(b.value.resourceId,{id:b.value.resourceId,type,x:b.value.x,y:b.value.y,amount:1,max:1,
      perception:'memory',knowledgeKey:b.key,beliefStatus:b.status});
  }
  for(const n of state.nodes){
    if(n.type!==type||distance(agent,n)>KNOWLEDGE_REVISION_RULES.observationRange)continue;
    if(n.amount>0)result.set(n.id,{...n,perception:'vision'});else result.delete(n.id);
  }
  return [...result.values()];
}

/** Enumerate reachable exploration waypoints without inspecting any resource node. */
export function personalExplorationTarget(state,agent,reachable){
  if(!active(state))return null;
  const p=init(state,agent),bounds=coreWorldBounds(state),cells=bounds.w*bounds.h;
  for(let offset=0;offset<cells;offset++){
    const cursor=(p.cursor+offset)%cells;
    const cell=(cursor*113+(state.seed>>>0)%cells)%cells;
    const target={x:cell%bounds.w,y:Math.floor(cell/bounds.w),exploreCursor:cursor};
    if(distance(agent,target)>1&&reachable(target))return target;
  }
  return {x:agent.x,y:agent.y,exploreCursor:p.cursor};
}

export function rememberPlanSelection(state,agent,choice){
  if(!active(state))return;
  const p=init(state,agent),kind=choice.purposeKind??choice.kind;
  if(['EAT','REST','IDLE','CRAFT','PROCESS'].includes(kind)){
    if(p.goal?.status==='active')p.goal={...p.goal,status:'interrupted',updatedTick:state.tick,outcome:kind.toLowerCase()};
    return;
  }
  const goal=goalFor(kind),targetId=choice.targetId??null;
  const same=p.goal&&p.goal.targetId===targetId&&p.goal.goal===goal&&!['completed','failed'].includes(p.goal.status);
  const phase=choice.perception==='memory'?'visit-and-verify':choice.kind==='EXPLORE'?'explore':'work';
  const startedTick=same?p.goal.startedTick:state.tick;
  const attempt=same?Math.min(Number(p.goal.attempt??0),EXECUTABLE_PLAN_RULES.maxReplans):0;
  const sequence=sequenceFor(kind,phase);
  p.goal={goal,targetId,x:choice.x,y:choice.y,kind,phase,status:'active',startedTick,updatedTick:state.tick,outcome:'UNKNOWN',
    planVersion:EXECUTABLE_PLAN_VERSION,planId:same?(p.goal.planId??planId(agent,goal,targetId,startedTick)):planId(agent,goal,targetId,startedTick),
    step:stepFor(kind,phase),attempt,maxReplans:EXECUTABLE_PLAN_RULES.maxReplans,...sequence};
}

export function recordPredictionReceipt(state,agent,prediction){
  if(!active(state)||!prediction||!PRODUCTIVE_KINDS.has(prediction.taskKind))return null;
  const p=init(state,agent),plan=p.goal;
  if(!plan||typeof plan.planId!=='string')return null;
  const entry={
    version:PREDICTION_RECEIPT_VERSION,
    receiptId:'val9:'+agent.id+':'+state.tick+':'+prediction.taskKind+':'+(prediction.targetId??'none'),
    planId:plan.planId,tick:state.tick,taskKind:prediction.taskKind,targetId:prediction.targetId??null,
    remainingRouteSteps:Number(prediction.remainingRouteSteps??0),moveTicksPerStep:Number(prediction.moveTicksPerStep??0),
    currentMoveProgress:Number(prediction.currentMoveProgress??0),minimumTravelTicks:Number(prediction.minimumTravelTicks??0),
    revalidate:String(prediction.revalidate??'NONE'),interruptionNow:prediction.interruptionNow??null,
    selectedScore:Number(prediction.selectedScore??0),traceSource:String(prediction.traceSource??'UNKNOWN')
  };
  p.predictions.push(entry);while(p.predictions.length>PLANNING_LIMITS.predictions)p.predictions.shift();
  return entry;
}

function lesson(state,agent,kind,targetId,outcome,amount=0){
  const p=init(state,agent),entry={tick:state.tick,kind,targetId:targetId??null,outcome,amount,
    ...(typeof p.goal?.planId==='string'?{planId:p.goal.planId}:{})};
  p.lessons.push(entry);while(p.lessons.length>PLANNING_LIMITS.lessons)p.lessons.shift();
}
export function finishPersonalExploration(state,agent,task){
  if(!active(state))return;
  const p=init(state,agent);
  if(Number.isInteger(task.exploreCursor))p.cursor=(task.exploreCursor+1)%worldCellCount(state);
  if(task.knowledgeKey){
    const result=verifyResourceKnowledge(state,agent.id,task.knowledgeKey);
    if(p.goal){
      const phase=result.status==='CONFIRMED'?'work':'verify';
      const ok=result.status==='CONFIRMED',sequence=ok?sequenceFor(p.goal.kind,'work'):terminalSequence(p.goal,'VIOL');
      p.goal={...p.goal,phase,step:p.goal.planVersion===EXECUTABLE_PLAN_VERSION?stepFor(p.goal.kind,phase):p.goal.step,
        status:ok?'active':'failed',updatedTick:state.tick,
        outcome:result.ok?result.reason:'UNKNOWN',...sequence};
    }
    lesson(state,agent,task.purposeKind??'EXPLORE',task.targetId,result.ok?result.reason:'UNKNOWN');
  }else if(p.goal)p.goal={...p.goal,status:'completed',updatedTick:state.tick,outcome:'explored-location',...terminalSequence(p.goal,'SAT')};
}
export function recordPlanProduction(state,agent,task,amount){
  if(!active(state))return;
  const p=init(state,agent);
  if(p.goal){
    if(amount>0)p.goal={...p.goal,status:'completed',updatedTick:state.tick,outcome:'SAT:productive-outcome',...terminalSequence(p.goal,'SAT')};
    else{
      const attempt=Math.min(Number(p.goal.attempt??0)+1,EXECUTABLE_PLAN_RULES.maxReplans),terminal=attempt>=EXECUTABLE_PLAN_RULES.maxReplans;
      p.goal={...p.goal,attempt,updatedTick:state.tick,
        status:terminal?'failed':'interrupted',
        outcome:terminal?'VIOL:replan-budget-exhausted':'VIOL:no-output',
        ...terminalSequence(p.goal,terminal?'VIOL':'UNKNOWN')};
    }
  }
  lesson(state,agent,task.kind,task.targetId,amount>0?'SAT':'VIOL',amount);
}

export function validatePersonalPlanning(state){
  const errors=[],bounds=worldBounds(state),cells=worldCellCount(state);
  if(state.planningPolicy!==undefined&&!active(state))errors.push('Planning policy');
  for(const a of [...state.agents,...state.archive]){
    const p=a.planning;if(p===undefined)continue;
    const tick=t=>Number.isSafeInteger(t)&&t>=0&&t<=state.tick;
    if(!p||p.version!==PERSONAL_PLANNING_VERSION||!Number.isInteger(p.cursor)||p.cursor<0||p.cursor>=cells||
      !Array.isArray(p.lessons)||p.lessons.length>PLANNING_LIMITS.lessons||
      (p.predictions!==undefined&&(!Array.isArray(p.predictions)||p.predictions.length>PLANNING_LIMITS.predictions))){errors.push('Personal planning');continue;}
    if(p.lessons.some(l=>!l||!tick(l.tick)||typeof l.kind!=='string'||l.kind.length>16||typeof l.outcome!=='string'||l.outcome.length>80||
      !Number.isFinite(l.amount)||l.amount<0||(l.targetId!==null&&!Number.isSafeInteger(l.targetId))||
      (l.planId!==undefined&&(typeof l.planId!=='string'||l.planId.length>120))))errors.push('Planning lessons');
    if((p.predictions??[]).some(r=>!r||r.version!==PREDICTION_RECEIPT_VERSION||typeof r.receiptId!=='string'||r.receiptId.length>180||
      typeof r.planId!=='string'||r.planId.length>120||!tick(r.tick)||!PRODUCTIVE_KINDS.has(r.taskKind)||
      (r.targetId!==null&&!Number.isSafeInteger(r.targetId))||![r.remainingRouteSteps,r.moveTicksPerStep,r.currentMoveProgress,r.minimumTravelTicks].every(Number.isFinite)||
      r.remainingRouteSteps<0||r.moveTicksPerStep<1||r.currentMoveProgress<0||r.minimumTravelTicks<0||
      typeof r.revalidate!=='string'||r.revalidate.length>40||![null,'HUNGER','ENERGY'].includes(r.interruptionNow)||
      !Number.isFinite(r.selectedScore)||r.traceSource!=='agent.trace:selected'))errors.push('Prediction receipts');
    const g=p.goal;
    if(g!==null&&(!g||!['active','interrupted','completed','failed'].includes(g.status)||
      !['secure-food','collect-wood','collect-stone','finish-shelter','explore'].includes(g.goal)||
      !['FORAGE','WOODCUT','MINE','BUILD','EXPLORE'].includes(g.kind)||!['visit-and-verify','verify','explore','work'].includes(g.phase)||!tick(g.startedTick)||!tick(g.updatedTick)||
      g.startedTick>g.updatedTick||!Number.isInteger(g.x)||!Number.isInteger(g.y)||g.x<0||g.y<0||g.x>=bounds.w||g.y>=bounds.h||
      typeof g.outcome!=='string'||g.outcome.length>80||(g.targetId!==null&&!Number.isSafeInteger(g.targetId))||
      (g.planVersion!==undefined&&(g.planVersion!==EXECUTABLE_PLAN_VERSION||typeof g.planId!=='string'||g.planId.length>120||
       !g.step||g.step.kind!==g.kind||g.step.phase!==g.phase||!Number.isInteger(g.attempt)||g.attempt<0||g.attempt>EXECUTABLE_PLAN_RULES.maxReplans||
       g.maxReplans!==EXECUTABLE_PLAN_RULES.maxReplans||
       (g.sequenceVersion!==undefined&&(g.sequenceVersion!==MULTI_STEP_SEQUENCE_VERSION||!Array.isArray(g.steps)||g.steps.length<1||g.steps.length>EXECUTABLE_PLAN_RULES.maxSteps||
        !Number.isInteger(g.stepIndex)||g.stepIndex<0||g.stepIndex>=g.steps.length||
        g.steps.some(s=>!s||typeof s.id!=='string'||s.id.length>40||typeof s.kind!=='string'||s.kind.length>16||
          !['pending','active','completed','failed','skipped'].includes(s.status))))))))errors.push('Goal plan');
  }
  return [...new Set(errors)];
}
