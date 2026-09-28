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
/** Family skill is derived from verified per-recipe receipts, never a new XP ledger. */
export function craftFamilyMastery(agent,recipeId){
  const r=recipeById(recipeId);if(!r)return 0;
  return Math.min(RECIPE_KNOWLEDGE_LIMITS.completions,Object.values(CRAFT_RECIPE_CATALOG)
    .filter(x=>x.output===r.output).reduce((total,x)=>total+recipeMastery(agent,x.id),0));
}
function structuralErrors(state,agent){
  if(!baseKnowledge(agent))return ['Recipe knowledge'];
  const book=agent.knowledgeState.recipes;
  if(book===undefined)return [];
  if(!record(book)||book.version!==RECIPE_KNOWLEDGE_VERSION||!Array.isArray(book.entries)||book.entries.length>RECIPE_KNOWLEDGE_LIMITS.recipes)return ['Recipe knowledge'];
  const seen=new Set(),orders=new Set(),items=new Set();
  for(const e of book.entries){
    if(!record(e)||!recipeById(e.recipeId)||seen.has(e.recipeId)||!record(e.learned)||!integer(e.learned.tick)||e.learned.tick>state.tick||
      !integer(e.retiredCompletions)||!Array.isArray(e.receipts)||e.receipts.length>RECIPE_KNOWLEDGE_LIMITS.receipts||
      e.retiredCompletions+e.receipts.length>RECIPE_KNOWLEDGE_LIMITS.completions)return ['Recipe knowledge'];
    seen.add(e.recipeId);
    if(e.retiredCompletions>0&&e.receipts.length!==RECIPE_KNOWLEDGE_LIMITS.receipts)return ['Recipe mastery'];
    let lastOrder=0,lastTick=e.learned.tick;
    for(const receipt of e.receipts){
      if(!record(receipt)||!integer(receipt.orderId,1)||receipt.orderId<=lastOrder||orders.has(receipt.orderId)||
        !integer(receipt.itemId,1)||items.has(receipt.itemId)||!integer(receipt.tick)||receipt.tick<lastTick||receipt.tick>state.tick||
        (state.rustPossessions&&(!integer(state.rustPossessions.nextOrder,1)||receipt.orderId>=state.rustPossessions.nextOrder||receipt.itemId>=state.rustPossessions.nextItem)))return ['Recipe mastery'];
      orders.add(receipt.orderId);items.add(receipt.itemId);lastOrder=receipt.orderId;lastTick=receipt.tick;
    }
    const learned=e.learned;
    if(starters.has(e.recipeId)){
      if(learned.method!=='baseline'||learned.tick!==0)return ['Recipe knowledge source'];
    }else if(learned.method==='mastery'){
      const unlock=recipeById(e.recipeId).unlock;
      if(!unlock||learned.sourceRecipeId!==unlock.recipeId||!integer(learned.sourceOrderId,1)||
        !integer(learned.sourceCompletions,unlock.completions))return ['Recipe knowledge source'];
    }else if(learned.method==='teaching'){
      if(!integer(learned.teacherId,1)||learned.teacherId===agent.id)return ['Recipe knowledge source'];
    }else return ['Recipe knowledge source'];
  }
  if(STARTER_RECIPE_IDS.some(id=>!seen.has(id)))return ['Recipe baseline'];
  return [];
}
function proven(state,agent,recipeId,visited){
  if(!baseKnowledge(agent)||!recipeById(recipeId)||structuralErrors(state,agent).length)return false;
  const key=agent.id+':'+recipeId;if(visited.has(key))return false;
  visited.add(key);
  const e=entry(agent,recipeId);if(!e)return false;
  const l=e.learned;
  if(l.method==='baseline')return starters.has(recipeId);
  if(l.method==='mastery'){
    const source=entry(agent,l.sourceRecipeId),last=source?.receipts?.at(-1);
    return !!last&&last.orderId>=l.sourceOrderId&&recipeMastery(agent,l.sourceRecipeId)>=l.sourceCompletions&&
      proven(state,agent,l.sourceRecipeId,visited);
  }
  const teacher=[...(state.agents??[]),...(state.archive??[])].find(a=>a.id===l.teacherId);
  const source=teacher&&entry(teacher,recipeId);
  return !!source&&source.learned.tick<=l.tick&&proven(state,teacher,recipeId,visited);
}
export function knowsCraftRecipe(state,agent,recipeId){return proven(state,agent,recipeId,new Set());}
export function validateRecipeKnowledge(state,agent){
  const errors=structuralErrors(state,agent);if(errors.length)return errors;
  if(agent.knowledgeState.recipes?.entries.some(e=>!proven(state,agent,e.recipeId,new Set())))return ['Recipe knowledge evidence'];
  return [];
}
function writableBook(agent){return agent.knowledgeState.recipes?copy(agent.knowledgeState.recipes)
  :{version:RECIPE_KNOWLEDGE_VERSION,entries:STARTER_RECIPE_IDS.map(baselineEntry)};}

/** Proposal only. Caller must already have verified the live completed Rust order.
 * Receipt watermark is monotonic per recipe; bounded compaction never reopens an
 * old order. Legacy orders are not retrospectively awarded mastery.
 */
export function recipeCompletionProposal(state,agent,order,itemId,completedWork=order?.work){
  if(order?.recipeKnowledge===undefined)return null;
  if(order.recipeKnowledge!==RECIPE_KNOWLEDGE_VERSION)throw new Error('craft_knowledge_version');
  if(validateRecipeKnowledge(state,agent).length||order.agentId!==agent.id||
    !state.rustPossessions.orders.includes(order)||completedWork<order.required||
    completedWork>order.work+1||
    !integer(itemId,1)||itemId!==state.rustPossessions.nextItem||
    !knowsCraftRecipe(state,agent,order.recipe))throw new Error('craft_knowledge_completion');
  const book=writableBook(agent),e=book.entries.find(x=>x.recipeId===order.recipe);
  if(!e||e.receipts.some(x=>x.orderId>=order.id))throw new Error('craft_mastery_replay');
  if(recipeMastery(agent,order.recipe)<RECIPE_KNOWLEDGE_LIMITS.completions){
    e.receipts.push({orderId:order.id,itemId,tick:state.tick});
    if(e.receipts.length>RECIPE_KNOWLEDGE_LIMITS.receipts){e.receipts.shift();e.retiredCompletions++;}
  }else{
    e.receipts.shift();e.receipts.push({orderId:order.id,itemId,tick:state.tick});
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
  return freeze(Object.values(CRAFT_RECIPE_CATALOG).map(r=>({recipeId:r.id,output:r.output,tier:r.tier,station:r.station,
    known:knowsCraftRecipe(state,agent,r.id),completed:recipeMastery(agent,r.id),
    learned:entry(agent,r.id)?.learned?copy(entry(agent,r.id).learned):null,
    unlock:r.unlock?{...r.unlock,current:recipeMastery(agent,r.unlock.recipeId)}:null})));
}
