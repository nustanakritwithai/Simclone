/** Personal resource planning. World validation still belongs to the engine.
 * Perception supplies only nearby nodes. Remembered locations are investigation
 * targets, never authoritative statements about remote quantities or existence.
 */
import {KNOWLEDGE_REVISION_RULES,verifyResourceKnowledge} from './knowledge-revision.mjs?v=0.5.0';
import {LEGACY_WORLD_BOUNDS,worldBounds,worldCellCount} from './world-bounds.mjs?v=0.5.0';
export const PERSONAL_PLANNING_VERSION='personal-knowledge-1';
export const EXECUTABLE_PLAN_VERSION='VAL2-0.1';
export const EXECUTABLE_PLAN_RULES=Object.freeze({maxReplans:3});
export const PLANNING_LIMITS=Object.freeze({lessons:4,cells:LEGACY_WORLD_BOUNDS.w*LEGACY_WORLD_BOUNDS.h,width:LEGACY_WORLD_BOUNDS.w,height:LEGACY_WORLD_BOUNDS.h});
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const active=s=>s.planningPolicy===PERSONAL_PLANNING_VERSION;
const goalFor=kind=>({FORAGE:'secure-food',WOODCUT:'collect-wood',MINE:'collect-stone',BUILD:'finish-shelter'})[kind]??'explore';
const planId=(agent,goal,targetId,startedTick)=>'val2:'+agent.id+':'+goal+':'+(targetId??'none')+':'+startedTick;
const stepFor=(kind,phase)=>({kind,phase});
const init=(state,a)=>{const cells=worldCellCount(state);return a.planning??={version:PERSONAL_PLANNING_VERSION,cursor:(a.id*37)%cells,goal:null,lessons:[]};};

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
  const p=init(state,agent),bounds=worldBounds(state),cells=worldCellCount(state);
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
  p.goal={goal,targetId,x:choice.x,y:choice.y,kind,phase,status:'active',startedTick,updatedTick:state.tick,outcome:'UNKNOWN',
    planVersion:EXECUTABLE_PLAN_VERSION,planId:same?(p.goal.planId??planId(agent,goal,targetId,startedTick)):planId(agent,goal,targetId,startedTick),
    step:stepFor(kind,phase),attempt,maxReplans:EXECUTABLE_PLAN_RULES.maxReplans};
}

function lesson(state,agent,kind,targetId,outcome,amount=0){
  const p=init(state,agent),entry={tick:state.tick,kind,targetId:targetId??null,outcome,amount};
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
      p.goal={...p.goal,phase,step:p.goal.planVersion===EXECUTABLE_PLAN_VERSION?stepFor(p.goal.kind,phase):p.goal.step,
        status:result.status==='CONFIRMED'?'active':'failed',updatedTick:state.tick,
        outcome:result.ok?result.reason:'UNKNOWN'};
    }
    lesson(state,agent,task.purposeKind??'EXPLORE',task.targetId,result.ok?result.reason:'UNKNOWN');
  }else if(p.goal)p.goal={...p.goal,status:'completed',updatedTick:state.tick,outcome:'explored-location'};
}
export function recordPlanProduction(state,agent,task,amount){
  if(!active(state))return;
  const p=init(state,agent);
  if(p.goal){
    if(amount>0)p.goal={...p.goal,status:'completed',updatedTick:state.tick,outcome:'SAT:productive-outcome'};
    else{
      const attempt=Math.min(Number(p.goal.attempt??0)+1,EXECUTABLE_PLAN_RULES.maxReplans);
      p.goal={...p.goal,attempt,updatedTick:state.tick,
        status:attempt>=EXECUTABLE_PLAN_RULES.maxReplans?'failed':'interrupted',
        outcome:attempt>=EXECUTABLE_PLAN_RULES.maxReplans?'VIOL:replan-budget-exhausted':'VIOL:no-output'};
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
      !Array.isArray(p.lessons)||p.lessons.length>PLANNING_LIMITS.lessons){errors.push('Personal planning');continue;}
    if(p.lessons.some(l=>!l||!tick(l.tick)||typeof l.kind!=='string'||l.kind.length>16||typeof l.outcome!=='string'||l.outcome.length>80||
      !Number.isFinite(l.amount)||l.amount<0||(l.targetId!==null&&!Number.isSafeInteger(l.targetId))))errors.push('Planning lessons');
    const g=p.goal;
    if(g!==null&&(!g||!['active','interrupted','completed','failed'].includes(g.status)||
      !['secure-food','collect-wood','collect-stone','finish-shelter','explore'].includes(g.goal)||
      !['FORAGE','WOODCUT','MINE','BUILD','EXPLORE'].includes(g.kind)||!['visit-and-verify','verify','explore','work'].includes(g.phase)||!tick(g.startedTick)||!tick(g.updatedTick)||
      g.startedTick>g.updatedTick||!Number.isInteger(g.x)||!Number.isInteger(g.y)||g.x<0||g.y<0||g.x>=bounds.w||g.y>=bounds.h||
      typeof g.outcome!=='string'||g.outcome.length>80||(g.targetId!==null&&!Number.isSafeInteger(g.targetId))||
      (g.planVersion!==undefined&&(g.planVersion!==EXECUTABLE_PLAN_VERSION||typeof g.planId!=='string'||g.planId.length>120||
       !g.step||g.step.kind!==g.kind||g.step.phase!==g.phase||!Number.isInteger(g.attempt)||g.attempt<0||g.attempt>EXECUTABLE_PLAN_RULES.maxReplans||
       g.maxReplans!==EXECUTABLE_PLAN_RULES.maxReplans))))errors.push('Goal plan');
  }
  return [...new Set(errors)];
}
