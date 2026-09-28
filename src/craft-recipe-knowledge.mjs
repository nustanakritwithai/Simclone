/** RC2 personal recipe authority. Resource beliefs keep their own bounded domain.
 * Missing recipes namespace is the explicit released survival baseline, not a
 * grant of all catalog recipes. Reading knowledge never materializes state.
 */
import {CRAFT_RECIPE_CATALOG,STARTER_RECIPE_IDS,recipeById} from './crafting-catalog.mjs?v=0.5.0';
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';

export const RECIPE_KNOWLEDGE_VERSION='RC2-knowledge/1';
export const RECIPE_KNOWLEDGE_LIMITS=Object.freeze({recipes:64,receipts:8,completions:65535,teachRange:2});
const starters=new Set(STARTER_RECIPE_IDS);
const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const copy=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.freeze(x);for(const y of Object.values(x))freeze(y);}return x;};
const baselineEntry=recipeId=>({recipeId,learned:{method:'baseline',tick:0},retiredCompletions:0,receipts:[]});
function baseKnowledge(agent){return record(agent?.knowledgeState)&&agent.knowledgeState.version==='0.5.0';}
function entry(agent,recipeId){
  const book=agent?.knowledgeState?.recipes;
  return book===undefined?(starters.has(recipeId)?baselineEntry(recipeId):null)
    :Array.isArray(book?.entries)?book.entries.find(e=>e?.recipeId===recipeId)??null:null;
}
export function recipeMastery(agent,recipeId){
  const e=entry(agent,recipeId);
  if(!e||!integer(e.retiredCompletions)||!Array.isArray(e.receipts))return 0;
  return Math.min(RECIPE_KNOWLEDGE_LIMITS.completions,e.retiredCompletions+e.receipts.length);
}
function structuralErrors(state,agent){
  if(!baseKnowledge(agent))return ['Recipe knowledge'];
  const book=agent.knowledgeState.recipes;
  if(book===undefined)return [];
  if(!record(book)||book.version!==RECIPE_KNOWLEDGE_VERSION||!Array.isArray(book.entries)||book.entries.length>RECIPE_KNOWLEDGE_LIMITS.recipes)return ['Recipe knowledge'];
  const seen=new Set(),orders=new Set(),items=new Set();
  const outputs=new Map((Array.isArray(state.rustPossessions?.items)?state.rustPossessions.items:[]).map(i=>[i?.id,i]));
  for(const e of book.entries){
    if(!record(e)||!recipeById(e.recipeId)||seen.has(e.recipeId)||!record(e.learned)||!integer(e.learned.tick)||e.learned.tick>state.tick||
      !integer(e.retiredCompletions)||!Array.isArray(e.receipts)||e.receipts.length>RECIPE_KNOWLEDGE_LIMITS.receipts||
      e.retiredCompletions+e.receipts.length>RECIPE_KNOWLEDGE_LIMITS.completions)return ['Recipe knowledge'];
    seen.add(e.recipeId);
    if(e.retiredCompletions>0&&(e.receipts.length!==RECIPE_KNOWLEDGE_LIMITS.receipts||e.receipts[0]?.orderId<=e.retiredCompletions))return ['Recipe mastery'];
    if(e.retiredThrough!==undefined){
      const last=e.retiredThrough,first=e.receipts[0];
      if(!record(last)||e.retiredCompletions===0||!integer(last.orderId,e.retiredCompletions)||!integer(last.itemId,1)||
        !integer(last.tick)||last.crafterId!==agent.id||!first||last.orderId>=first.orderId||last.tick>=first.tick||
        last.itemId>=state.rustPossessions.nextItem||last.tick<Math.max(e.learned.tick,agent.bornTick))return ['Recipe mastery boundary'];
      const output=outputs.get(last.itemId);
      if(output&&(output.createdBy!==agent.id||output.createdTick!==last.tick||output.kind!==recipeById(e.recipeId).output))return ['Recipe mastery output'];
    }
    let lastOrder=0,lastTick=e.learned.tick;
    for(const receipt of e.receipts){
      if(!record(receipt)||!integer(receipt.orderId,1)||receipt.orderId<=lastOrder||orders.has(receipt.orderId)||
        !integer(receipt.itemId,1)||items.has(receipt.itemId)||!integer(receipt.tick)||receipt.tick<Math.max(lastTick,agent.bornTick)||receipt.tick>state.tick||
        (receipt.crafterId!==undefined&&receipt.crafterId!==agent.id)||
        (state.rustPossessions&&(!integer(state.rustPossessions.nextOrder,1)||receipt.orderId>=state.rustPossessions.nextOrder||receipt.itemId>=state.rustPossessions.nextItem)))return ['Recipe mastery'];
      const output=outputs.get(receipt.itemId);
      if(output&&(output.createdBy!==agent.id||output.createdTick!==receipt.tick||output.kind!==recipeById(e.recipeId).output))return ['Recipe mastery output'];
      orders.add(receipt.orderId);items.add(receipt.itemId);lastOrder=receipt.orderId;lastTick=receipt.tick;
    }
    const learned=e.learned;
    if(starters.has(e.recipeId)){
      if(learned.method!=='baseline'||learned.tick!==0)return ['Recipe knowledge source'];
    }else if(learned.method==='mastery'){
      const unlock=recipeById(e.recipeId).unlock;
      if(!unlock||learned.sourceRecipeId!==unlock.recipeId||!integer(learned.sourceOrderId,1)||
        !integer(learned.sourceCompletions,unlock.completions)||learned.sourceOrderId<learned.sourceCompletions||
        learned.sourceOrderId>=state.rustPossessions.nextOrder||learned.tick<agent.bornTick)return ['Recipe knowledge source'];
    }else if(learned.method==='teaching'){
      if(!integer(learned.teacherId,1)||learned.teacherId===agent.id||learned.tick<agent.bornTick)return ['Recipe knowledge source'];
    }else return ['Recipe knowledge source'];
  }
  if(STARTER_RECIPE_IDS.some(id=>!seen.has(id)))return ['Recipe baseline'];
  return [];
}
/** Cross-person identity and count consistency; not a second completion ledger.
 * Legacy receipts without crafterId are interpreted in their containing book.
 * A retired boundary is one retained certificate, never an unbounded history.
 */
function receiptLedgerErrors(state){
  const p=state?.rustPossessions;
  if(!p||!integer(p.nextOrder,1)||!integer(p.nextItem,1)||!Array.isArray(p.items)||!Array.isArray(p.orders))return ['Recipe evidence ledger'];
  const orders=new Set(),items=new Set();let total=0;
  for(const a of [...(state.agents??[]),...(state.archive??[])]){
    const book=a?.knowledgeState?.recipes;if(book===undefined)continue;
    if(!record(book)||!Array.isArray(book.entries))return ['Recipe knowledge'];
    const retained=[];let personal=0;
    for(const e of book.entries){
      if(!record(e)||!integer(e.retiredCompletions)||!Array.isArray(e.receipts))return ['Recipe mastery'];
      personal+=e.retiredCompletions+e.receipts.length;
      for(const r of [...e.receipts,...(e.retiredThrough===undefined?[]:[e.retiredThrough])]){
        if(!record(r)||!integer(r.orderId,1)||!integer(r.itemId,1)||orders.has(r.orderId)||items.has(r.itemId))return ['Recipe receipt identity'];
        orders.add(r.orderId);items.add(r.itemId);retained.push(r);
      }
    }
    retained.sort((a,b)=>a.orderId-b.orderId);
    if(retained.some((r,i)=>i>0&&r.tick<=retained[i-1].tick))return ['Recipe receipt chronology'];
    if(!integer(personal)||personal>Math.max(0,state.tick-a.bornTick))return ['Recipe completion budget'];
    total+=personal;
  }
  for(const o of p.orders){
    if(!o||!integer(o.id,1)||o.id>=p.nextOrder||orders.has(o.id))return ['Recipe order identity'];
    orders.add(o.id);
  }
  return !integer(total)||total+p.orders.length>=p.nextOrder?['Recipe completion budget']:[];
}
function masterySourceProven(agent,source,learned){
  if(!source||learned.tick<source.learned.tick||recipeMastery(agent,source.recipeId)<learned.sourceCompletions)return false;
  // Every accepted craft currently advances by at most one unit per simulation tick.
  if(learned.tick<Math.max(agent.bornTick,source.learned.tick)+learned.sourceCompletions*recipeById(source.recipeId).work)return false;
  const index=learned.sourceCompletions-source.retiredCompletions-1;
  if(index>=0){const receipt=source.receipts[index];return !!receipt&&receipt.orderId===learned.sourceOrderId&&receipt.tick===learned.tick;}
  const first=source.receipts[0],boundary=source.retiredThrough;
  if(!first||learned.sourceOrderId>=first.orderId||learned.tick>=first.tick)return false;
  // Old valid compacted books have no boundary field: preserve them read-only,
  // using their existing count and first retained receipt as the upper bound.
  return !boundary||(learned.sourceOrderId<=boundary.orderId&&learned.tick<=boundary.tick&&
    (learned.sourceOrderId!==boundary.orderId||learned.tick===boundary.tick));
}
function proven(state,agent,recipeId,visited){
  if(!baseKnowledge(agent)||!recipeById(recipeId)||structuralErrors(state,agent).length)return false;
  const key=agent.id+':'+recipeId;if(visited.has(key))return false;
  visited.add(key);
  const e=entry(agent,recipeId);if(!e)return false;
  const l=e.learned;
  if(l.method==='baseline')return starters.has(recipeId);
  if(l.method==='mastery'){
    const source=entry(agent,l.sourceRecipeId);
    return masterySourceProven(agent,source,l)&&
      proven(state,agent,l.sourceRecipeId,visited);
  }
  const teacher=[...(state.agents??[]),...(state.archive??[])].find(a=>a.id===l.teacherId);
  const source=teacher&&entry(teacher,recipeId);
  return !!source&&source.learned.tick<=l.tick&&proven(state,teacher,recipeId,visited);
}
export function knowsCraftRecipe(state,agent,recipeId){return !receiptLedgerErrors(state).length&&proven(state,agent,recipeId,new Set());}
export function validateRecipeKnowledge(state,agent){
  const errors=[...structuralErrors(state,agent),...receiptLedgerErrors(state)];if(errors.length)return [...new Set(errors)];
  if(agent.knowledgeState.recipes?.entries.some(e=>!proven(state,agent,e.recipeId,new Set())))return ['Recipe knowledge evidence'];
  return [];
}
export function validateAllRecipeKnowledge(state){
  const errors=receiptLedgerErrors(state);if(errors.length)return errors;
  for(const a of [...(state.agents??[]),...(state.archive??[])]){
    errors.push(...structuralErrors(state,a));
    if(!errors.length&&a.knowledgeState?.recipes?.entries.some(e=>!proven(state,a,e.recipeId,new Set())))errors.push('Recipe knowledge evidence');
  }
  return [...new Set(errors)];
}
function writableBook(agent){return agent.knowledgeState.recipes?copy(agent.knowledgeState.recipes)
  :{version:RECIPE_KNOWLEDGE_VERSION,entries:STARTER_RECIPE_IDS.map(baselineEntry)};}

/** Proposal only. Caller must already have verified the live completed Rust order.
 * Receipt watermark is monotonic per recipe; bounded compaction never reopens an
 * old order. Legacy orders are not retrospectively awarded mastery.
 */
export function recipeCompletionProposal(state,agent,order,itemId,completedWork=order?.work){
  if(order?.recipeKnowledge===undefined){
    if(!starters.has(order?.recipe))throw new Error('craft_legacy_recipe');
    return null;
  }
  if(order.recipeKnowledge!==RECIPE_KNOWLEDGE_VERSION)throw new Error('craft_knowledge_version');
  if(validateRecipeKnowledge(state,agent).length||order.agentId!==agent.id||
    !state.rustPossessions.orders.includes(order)||!Number.isFinite(completedWork)||completedWork<order.required||completedWork>order.work+1||
    !integer(itemId,1)||itemId!==state.rustPossessions.nextItem||
    !knowsCraftRecipe(state,agent,order.recipe))throw new Error('craft_knowledge_completion');
  const book=writableBook(agent),e=book.entries.find(x=>x.recipeId===order.recipe);
  if(!e||e.receipts.some(x=>x.orderId>=order.id))throw new Error('craft_mastery_replay');
  if(recipeMastery(agent,order.recipe)<RECIPE_KNOWLEDGE_LIMITS.completions){
    e.receipts.push({orderId:order.id,itemId,crafterId:agent.id,tick:state.tick});
    if(e.receipts.length>RECIPE_KNOWLEDGE_LIMITS.receipts){e.retiredThrough={...e.receipts.shift(),crafterId:agent.id};e.retiredCompletions++;}
  }else{
    e.retiredThrough={...e.receipts.shift(),crafterId:agent.id};e.receipts.push({orderId:order.id,itemId,crafterId:agent.id,tick:state.tick});
  }
  const completed=e.retiredCompletions+e.receipts.length,unlocked=[];
  for(const r of Object.values(CRAFT_RECIPE_CATALOG)){
    if(r.unlock?.recipeId!==order.recipe||completed<r.unlock.completions||book.entries.some(x=>x.recipeId===r.id))continue;
    if(book.entries.length>=RECIPE_KNOWLEDGE_LIMITS.recipes)throw new Error('recipe_capacity');
    book.entries.push({recipeId:r.id,learned:{method:'mastery',tick:state.tick,sourceRecipeId:order.recipe,
      sourceOrderId:order.id,sourceCompletions:completed},retiredCompletions:0,receipts:[]});
    unlocked.push(r.id);
  }
  book.entries.sort((a,b)=>a.recipeId<b.recipeId?-1:a.recipeId>b.recipeId?1:0);
  return {book,completed,unlocked};
}

export function teachCraftRecipe(state,{teacherId,studentId,recipeId}={}){
  const teacher=state.agents?.find(a=>a.id===teacherId),student=state.agents?.find(a=>a.id===studentId);
  if(!teacher?.alive||!student?.alive||teacher===student)return {ok:false,reason:'recipe-actors'};
  if(!canPerformProductiveWork(state,teacher)||!canPerformProductiveWork(state,student))return {ok:false,reason:'stage'};
  if(validateRecipeKnowledge(state,teacher).length)return {ok:false,reason:'recipe-knowledge'};
  if(!recipeById(recipeId)||!knowsCraftRecipe(state,teacher,recipeId))return {ok:false,reason:'recipe-unknown'};
  if(validateRecipeKnowledge(state,student).length)return {ok:false,reason:'recipe-knowledge'};
  if(![teacher.x,teacher.y,student.x,student.y].every(Number.isInteger))return {ok:false,reason:'range'};
  if(Math.abs(teacher.x-student.x)+Math.abs(teacher.y-student.y)>RECIPE_KNOWLEDGE_LIMITS.teachRange)return {ok:false,reason:'range'};
  if(teacher.adventureCombat?.status==='ACTIVE'||student.adventureCombat?.status==='ACTIVE')return {ok:false,reason:'combat-active'};
  if(knowsCraftRecipe(state,student,recipeId))return {ok:true,changed:false,recipeId,teacherId,studentId};
  const book=writableBook(student);if(book.entries.length>=RECIPE_KNOWLEDGE_LIMITS.recipes)return {ok:false,reason:'capacity'};
  book.entries.push({recipeId,learned:{method:'teaching',tick:state.tick,teacherId},retiredCompletions:0,receipts:[]});
  book.entries.sort((a,b)=>a.recipeId<b.recipeId?-1:a.recipeId>b.recipeId?1:0);
  student.knowledgeState.recipes=book;
  return {ok:true,changed:true,recipeId,teacherId,studentId};
}
export function recipeKnowledgeSnapshot(state,agent){
  const coherent=!receiptLedgerErrors(state).length;
  return freeze(Object.values(CRAFT_RECIPE_CATALOG).map(r=>({recipeId:r.id,output:r.output,tier:r.tier,station:r.station,
    known:coherent&&proven(state,agent,r.id,new Set()),completed:recipeMastery(agent,r.id),
    learned:entry(agent,r.id)?.learned?copy(entry(agent,r.id).learned):null,
    unlock:r.unlock?{...r.unlock,current:recipeMastery(agent,r.unlock.recipeId)}:null})));
}
