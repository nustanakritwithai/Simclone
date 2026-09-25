/** Personal resource planning. World validation still belongs to the engine.
 * Perception supplies only nearby nodes. Remembered locations are investigation
 * targets, never authoritative statements about remote quantities or existence.
 */
import {KNOWLEDGE_REVISION_RULES,verifyResourceKnowledge} from './knowledge-revision.mjs?v=0.5.0';
export const PERSONAL_PLANNING_VERSION='personal-knowledge-1';
export const PLANNING_LIMITS=Object.freeze({lessons:4,cells:780,width:30,height:26});
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const active=s=>s.planningPolicy===PERSONAL_PLANNING_VERSION;
const goalFor=kind=>({FORAGE:'secure-food',WOODCUT:'collect-wood',MINE:'collect-stone',BUILD:'finish-shelter'})[kind]??'explore';
const init=a=>a.planning??={version:PERSONAL_PLANNING_VERSION,cursor:(a.id*37)%PLANNING_LIMITS.cells,goal:null,lessons:[]};

export function setPlanningPolicy(state,policy){
  if(!['local','legacy'].includes(policy))return {ok:false,reason:'policy',message:'ไม่รู้จักนโยบายการวางแผน'};
  if((policy==='local')===active(state))return {ok:true,changed:false,policy,message:'ใช้นโยบายนี้อยู่แล้ว'};
  if(policy==='local')state.planningPolicy=PERSONAL_PLANNING_VERSION;
  else delete state.planningPolicy;
  for(const a of state.agents.filter(a=>a.alive)){
    if(policy==='local')init(a);
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
  const p=init(agent);
  for(let offset=0;offset<PLANNING_LIMITS.cells;offset++){
    const cursor=(p.cursor+offset)%PLANNING_LIMITS.cells;
    const cell=(cursor*113+(state.seed>>>0)%PLANNING_LIMITS.cells)%PLANNING_LIMITS.cells;
    const target={x:cell%PLANNING_LIMITS.width,y:Math.floor(cell/PLANNING_LIMITS.width),exploreCursor:cursor};
    if(distance(agent,target)>1&&reachable(target))return target;
  }
  return {x:agent.x,y:agent.y,exploreCursor:p.cursor};
}

export function rememberPlanSelection(state,agent,choice){
  if(!active(state))return;
  const p=init(agent),kind=choice.purposeKind??choice.kind;
  if(['EAT','REST','IDLE'].includes(kind)){
    if(p.goal?.status==='active')p.goal={...p.goal,status:'interrupted',updatedTick:state.tick,outcome:kind.toLowerCase()};
    return;
  }
  const same=p.goal&&p.goal.targetId===(choice.targetId??null)&&p.goal.goal===goalFor(kind)&&
    !['completed','failed'].includes(p.goal.status);
  p.goal={goal:goalFor(kind),targetId:choice.targetId??null,x:choice.x,y:choice.y,
    kind,phase:choice.perception==='memory'?'visit-and-verify':choice.kind==='EXPLORE'?'explore':'work',
    status:'active',startedTick:same?p.goal.startedTick:state.tick,updatedTick:state.tick,outcome:'UNKNOWN'};
}

function lesson(state,agent,kind,targetId,outcome,amount=0){
  const p=init(agent),entry={tick:state.tick,kind,targetId:targetId??null,outcome,amount};
  p.lessons.push(entry);while(p.lessons.length>PLANNING_LIMITS.lessons)p.lessons.shift();
}
export function finishPersonalExploration(state,agent,task){
  if(!active(state))return;
  const p=init(agent);
  if(Number.isInteger(task.exploreCursor))p.cursor=(task.exploreCursor+1)%PLANNING_LIMITS.cells;
  if(task.knowledgeKey){
    const result=verifyResourceKnowledge(state,agent.id,task.knowledgeKey);
    if(p.goal)p.goal={...p.goal,phase:result.status==='CONFIRMED'?'work':'verify',
      status:result.status==='CONFIRMED'?'active':'failed',updatedTick:state.tick,
      outcome:result.ok?result.reason:'UNKNOWN'};
    lesson(state,agent,task.purposeKind??'EXPLORE',task.targetId,result.ok?result.reason:'UNKNOWN');
  }else if(p.goal)p.goal={...p.goal,status:'completed',updatedTick:state.tick,outcome:'explored-location'};
}
export function recordPlanProduction(state,agent,task,amount){
  if(!active(state))return;
  const p=init(agent);
  if(p.goal)p.goal={...p.goal,status:amount>0?'completed':'failed',updatedTick:state.tick,
    outcome:amount>0?'SAT:productive-outcome':'VIOL:no-output'};
  lesson(state,agent,task.kind,task.targetId,amount>0?'SAT':'VIOL',amount);
}

export function validatePersonalPlanning(state){
  const errors=[];
  if(state.planningPolicy!==undefined&&!active(state))errors.push('Planning policy');
  for(const a of [...state.agents,...state.archive]){
    const p=a.planning;if(p===undefined)continue;
    const tick=t=>Number.isSafeInteger(t)&&t>=0&&t<=state.tick;
    if(!p||p.version!==PERSONAL_PLANNING_VERSION||!Number.isInteger(p.cursor)||p.cursor<0||p.cursor>=PLANNING_LIMITS.cells||
      !Array.isArray(p.lessons)||p.lessons.length>PLANNING_LIMITS.lessons){errors.push('Personal planning');continue;}
    if(p.lessons.some(l=>!l||!tick(l.tick)||typeof l.kind!=='string'||l.kind.length>16||typeof l.outcome!=='string'||l.outcome.length>80||
      !Number.isFinite(l.amount)||l.amount<0||(l.targetId!==null&&!Number.isSafeInteger(l.targetId))))errors.push('Planning lessons');
    const g=p.goal;
    if(g!==null&&(!g||!['active','interrupted','completed','failed'].includes(g.status)||
      !['secure-food','collect-wood','collect-stone','finish-shelter','explore'].includes(g.goal)||
      !['FORAGE','WOODCUT','MINE','BUILD','EXPLORE'].includes(g.kind)||!['visit-and-verify','verify','explore','work'].includes(g.phase)||!tick(g.startedTick)||!tick(g.updatedTick)||
      g.startedTick>g.updatedTick||!Number.isInteger(g.x)||!Number.isInteger(g.y)||g.x<0||g.y<0||g.x>=30||g.y>=26||
      typeof g.outcome!=='string'||g.outcome.length>80||(g.targetId!==null&&!Number.isSafeInteger(g.targetId))))errors.push('Goal plan');
  }
  return [...new Set(errors)];
}
