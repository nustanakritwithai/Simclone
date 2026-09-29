/** RC5 G4 bounded Crafter progression policy.
 * Read-only intent generation only. It never mints an item, writes mastery,
 * changes profession, spends stock, or bypasses CRAFT_ITEM validation.
 */
import {CRAFT_RECIPE_CATALOG} from './crafting-catalog.mjs?v=0.5.0';
import {craftPreview} from './rust-possessions.mjs?v=0.5.0';
import {crafterCareerSnapshot} from './crafter-career.mjs?v=0.5.0';
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {resourceStock,isIndependent} from './individual-resources.mjs?v=0.5.0';
import {homeOf} from './individual-housing.mjs?v=0.5.0';
import {CRAFT_TRAINING_RULES} from './craft-training.mjs?v=0.5.0';
import {autonomousBirthFoodTarget} from './reproduction.mjs?v=0.5.0';
import {routeField,routeDistance} from './survival.mjs?v=0.5.0';

export const CRAFTER_AUTONOMY_VERSION='RC5-crafter-autonomy/1';
export const CRAFTER_AUTONOMY_POLICY='rp1-crafter-progression-v1';
const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;};
const view=(status,reason,extra={})=>freeze({version:CRAFTER_AUTONOMY_VERSION,policy:CRAFTER_AUTONOMY_POLICY,status,reason,...extra});
const targetTierFor=profile=>profile.grade==='CRAFTER'?3:profile.grade==='EXPERT'?4:profile.grade==='MASTER'?5:2;

function recipeFor(family,tier){
  return Object.values(CRAFT_RECIPE_CATALOG).find(r=>r.output===family&&r.tier===tier)??null;
}
export function crafterProgressionSnapshot(s,a){
  if(s?.productionPlan?.enabled!==true)return view('OFF','policy-off');
  if(!a||a.alive!==true||a.profession!=='crafter'||!canPerformProductiveWork(s,a))return view('INELIGIBLE','crafter-required');
  if(a.craftTraining?.enabled===true)return view('BLOCKED','manual-training');
  if(a.adventureCombat?.status==='ACTIVE'||a.adventureEncounter)return view('BLOCKED','adventure');
  if(a.task)return view('BLOCKED','task');
  if((s.rustPossessions?.orders??[]).some(o=>o.agentId===a.id)||(s.rustMaterials?.orders??[]).some(o=>o.agentId===a.id))return view('BLOCKED','craft-busy');
  if(!homeOf(s,a.id,{completeOnly:true}))return view('BLOCKED','housing');
  if(a.hp<CRAFT_TRAINING_RULES.hp||a.satiety<CRAFT_TRAINING_RULES.satiety||a.energy<CRAFT_TRAINING_RULES.energy)return view('BLOCKED','survival');

  const career=crafterCareerSnapshot(s,a);
  if(career.status!=='SAT'||!career.best)return view('BLOCKED','career-evidence');
  const profile=career.best,targetTier=targetTierFor(profile);
  if(profile.grade==='MASTER'&&(profile.counts[5]??0)>=1)return view('COMPLETE','master-t5-complete',{family:profile.family,grade:profile.grade,targetTier});
  const recipe=recipeFor(profile.family,targetTier);
  if(!recipe)return view('BLOCKED','recipe',{family:profile.family,grade:profile.grade,targetTier});
  const preview=craftPreview(s,{agentId:a.id,recipeId:recipe.id});
  if(!preview.ok)return view('BLOCKED',preview.reason,{family:profile.family,grade:profile.grade,targetTier,recipeId:recipe.id});

  const stock=resourceStock(s,a),foodFloor=isIndependent(s)?CRAFT_TRAINING_RULES.food:Math.max(CRAFT_TRAINING_RULES.food,autonomousBirthFoodTarget(s));
  if((stock?.food??0)<foodFloor||
    (stock?.wood??0)-(preview.materials.wood??0)<CRAFT_TRAINING_RULES.wood||
    (stock?.stone??0)-(preview.materials.stone??0)<CRAFT_TRAINING_RULES.stone)
    return view('BLOCKED','reserve',{family:profile.family,grade:profile.grade,targetTier,recipeId:recipe.id});

  if(preview.stationId!==null){
    const station=s.rustStations?.stations?.find(st=>st.id===preview.stationId);
    if(!station||routeDistance(routeField(s,a),station)<0)return view('BLOCKED','no-path',{family:profile.family,grade:profile.grade,targetTier,recipeId:recipe.id});
  }
  return view('READY','grade-progression',{agentId:a.id,family:profile.family,grade:profile.grade,targetTier,recipeId:recipe.id,stationId:preview.stationId});
}
export function crafterProgressionIntent(s,a){
  const snapshot=crafterProgressionSnapshot(s,a);
  return snapshot.status==='READY'?freeze({agentId:a.id,recipeId:snapshot.recipeId}):null;
}
