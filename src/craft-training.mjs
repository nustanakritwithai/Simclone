/** RC2 practice is a bounded preference, NOT a second craft/XP executor.
 * The engine dispatches the returned intent through CRAFT_ITEM. All progress
 * is read from verified recipe receipts, including manual completions.
 */
import {recipeById} from './crafting-catalog.mjs?v=0.5.0';
import {knowsCraftRecipe,recipeMastery,RECIPE_KNOWLEDGE_LIMITS} from './craft-recipe-knowledge.mjs?v=0.5.0';
import {craftPreview} from './rust-possessions.mjs?v=0.5.0';
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {resourceStock,isIndependent} from './individual-resources.mjs?v=0.5.0';
import {homeOf} from './individual-housing.mjs?v=0.5.0';
import {activeResidenceOf} from './relationships.mjs?v=0.5.0';
import {unfinishedHousing,housingCapacity} from './housing.mjs?v=0.5.0';
import {BIRTH_RULES,autonomousBirthFoodTarget} from './reproduction.mjs?v=0.5.0';
import {routeField,routeDistance} from './survival.mjs?v=0.5.0';

export const CRAFT_TRAINING_VERSION='RC2-training/1';
export const CRAFT_TRAINING_RULES=Object.freeze({quota:2,hp:70,satiety:70,energy:65,food:32,wood:BIRTH_RULES.woodCost+BIRTH_RULES.woodSafetyFloor,stone:8});
const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
const fields=['version','revision','enabled','recipeId','startedTick','startCompletions','targetCompletions'];
export function validateCraftTraining(s,a){
  const p=a?.craftTraining;if(p===undefined)return [];
  if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).sort().join()!==[...fields].sort().join()||
    p.version!==CRAFT_TRAINING_VERSION||!integer(p.revision,1)||typeof p.enabled!=='boolean'||
    !recipeById(p.recipeId)||!integer(p.startedTick)||p.startedTick>s.tick||p.startedTick<a.bornTick||
    !integer(p.startCompletions)||!integer(p.targetCompletions,p.startCompletions+1)||
    p.targetCompletions-p.startCompletions>CRAFT_TRAINING_RULES.quota||p.targetCompletions>RECIPE_KNOWLEDGE_LIMITS.completions||
    recipeMastery(a,p.recipeId)<p.startCompletions||!knowsCraftRecipe(s,a,p.recipeId))return ['Craft training'];
  return [];
}
export function craftTrainingCommand(s,type,data={}){
  if(type!=='SET_CRAFT_TRAINING')return null;
  const reject=reason=>({ok:false,reason,message:{
    actor:'เลือก Clone ที่ยังมีชีวิต',stage:'ช่วงวัยนี้ฝึกงานไม่ได้',
    'training-state':'ข้อมูลแผนฝึกไม่ถูกต้อง','training-revision':'แผนฝึกเปลี่ยนแล้ว เปิดหน้าต่างใหม่ก่อน',
    'recipe-unknown':'ต้องรู้สูตรนี้ก่อนเริ่มฝึก','training-quota':'ฝึกครั้งละ 1–2 ชิ้นเท่านั้น'
  }[reason]??'แผนฝึกใช้ไม่ได้'});
  const a=s.agents?.find(x=>x.id===data.agentId&&x.alive);
  if(!a)return reject('actor');
  if(validateCraftTraining(s,a).length)return reject('training-state');
  const prior=a.craftTraining,revision=prior?.revision??0;
  if(!integer(data.expectedRevision)||data.expectedRevision!==revision||revision>=Number.MAX_SAFE_INTEGER)return reject('training-revision');
  if(typeof data.enabled!=='boolean')return reject('training-state');
  if(!data.enabled){
    if(!prior||!prior.enabled)return {ok:true,changed:false,message:'ไม่ได้เปิดฝึกอยู่'};
    a.craftTraining={...prior,enabled:false,revision:revision+1};
    return {ok:true,changed:true,message:'หยุดรับงานฝึกใหม่ · งานที่รับแล้วทำต่อผ่านคิวเดิม'};
  }
  if(!canPerformProductiveWork(s,a))return reject('stage');
  if(!knowsCraftRecipe(s,a,data.recipeId))return reject('recipe-unknown');
  const count=data.count??CRAFT_TRAINING_RULES.quota,start=recipeMastery(a,data.recipeId);
  if(!integer(count,1)||count>CRAFT_TRAINING_RULES.quota||start+count>RECIPE_KNOWLEDGE_LIMITS.completions)return reject('training-quota');
  a.craftTraining={version:CRAFT_TRAINING_VERSION,revision:revision+1,enabled:true,recipeId:data.recipeId,
    startedTick:s.tick,startCompletions:start,targetCompletions:start+count};
  return {ok:true,changed:true,message:'ตั้งแผนฝึก '+count+' ชิ้น · ปิดหน้าต่างเพื่อให้โลกเดินต่อ'};
}
/** Default-OFF fast path leaves legacy saves byte-identical. No stock is spent here. */
export function craftTrainingSnapshot(s,a){
  const p=a?.craftTraining;
  const base={enabled:p?.enabled===true,revision:p?.revision??0,recipeId:p?.recipeId??null,completed:0,quota:0,status:'OFF',reason:'off'};
  if(!p)return Object.freeze(base);
  if(validateCraftTraining(s,a).length)return Object.freeze({...base,status:'BLOCKED',reason:'training-state'});
  base.completed=Math.min(p.targetCompletions-p.startCompletions,recipeMastery(a,p.recipeId)-p.startCompletions);
  base.quota=p.targetCompletions-p.startCompletions;
  const blocked=reason=>Object.freeze({...base,status:'BLOCKED',reason});
  if(!p.enabled)return Object.freeze(base);
  if(base.completed>=base.quota)return Object.freeze({...base,status:'COMPLETE',reason:'quota-complete'});
  if(!a.alive||!canPerformProductiveWork(s,a))return blocked('stage');
  if(a.adventureCombat?.status==='ACTIVE'||a.adventureEncounter)return blocked('adventure');
  if(a.hp<CRAFT_TRAINING_RULES.hp||a.satiety<CRAFT_TRAINING_RULES.satiety||a.energy<CRAFT_TRAINING_RULES.energy)return blocked('survival');
  if(s.rustPossessions.orders.some(o=>o.agentId===a.id)||s.rustMaterials.orders.some(o=>o.agentId===a.id))return blocked('craft-busy');
  if(a.task)return blocked('task');
  if(isIndependent(s)){
    if(!homeOf(s,a.id,{completeOnly:true})&&!activeResidenceOf(s,a.id))return blocked('housing');
  }else{
    const population=s.agents.filter(x=>x.alive).length;
    if(unfinishedHousing(s)>0||(population>=7&&housingCapacity(s)-population<6))return blocked('housing');
  }
  const r=recipeById(p.recipeId),stock=resourceStock(s,a),foodFloor=isIndependent(s)?CRAFT_TRAINING_RULES.food:
    Math.max(CRAFT_TRAINING_RULES.food,autonomousBirthFoodTarget(s));
  if((stock?.food??0)<foodFloor||(stock?.wood??0)-(r.materials.wood??0)<CRAFT_TRAINING_RULES.wood||
    (stock?.stone??0)-(r.materials.stone??0)<CRAFT_TRAINING_RULES.stone)return blocked('reserve');
  const check=craftPreview(s,{agentId:a.id,recipeId:p.recipeId});
  if(!check.ok)return blocked(check.reason);
  if(check.stationId!==null){
    const station=s.rustStations.stations.find(x=>x.id===check.stationId);
    if(!station||routeDistance(routeField(s,a),station)<0)return blocked('no-path');
  }
  return Object.freeze({...base,status:'READY',reason:'ready'});
}
export function craftTrainingIntent(s,a){
  if(!a?.craftTraining?.enabled)return null;
  // Completed plans never become per-tick work or an automatic re-arm.
  if(recipeMastery(a,a.craftTraining.recipeId)>=a.craftTraining.targetCompletions)return null;
  const view=craftTrainingSnapshot(s,a);
  return view.status==='READY'?Object.freeze({agentId:a.id,recipeId:view.recipeId}):null;
}
