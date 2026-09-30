/** ER3 shared Crafter production-plan projection.
 * Read-only only. The caller supplies an already actor-scoped ER1 projection.
 * This file centralizes the released ER3 recipe/tier/material/reserve/station plan
 * so ER6 can observe the same plan without creating a second demand authority.
 */
import {CRAFT_RECIPE_CATALOG} from './crafting-catalog.mjs?v=0.5.0';
import {knowsCraftRecipe,validateRecipeKnowledge} from './craft-recipe-knowledge.mjs?v=0.5.0';
import {crafterTierPermission,validateCrafterTierPolicy} from './crafter-tier-policy.mjs?v=0.5.0';
import {craftPreview} from './rust-possessions.mjs?v=0.5.0';
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {homeOf} from './individual-housing.mjs?v=0.5.0';
import {CRAFT_TRAINING_RULES} from './craft-training.mjs?v=0.5.0';
import {resourceStock,isIndependent} from './individual-resources.mjs?v=0.5.0';
import {autonomousBirthFoodTarget} from './reproduction.mjs?v=0.5.0';
import {routeField,routeDistance} from './survival.mjs?v=0.5.0';
import {isCanonicalMarketTravelTask} from './navigation-arrival-evidence.mjs?v=0.5.0';

export const ER3_CRAFTER_DEMAND_VERSION='ER3-demand-crafter/1';

const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;};
const view=(status,reason,extra={})=>freeze({version:ER3_CRAFTER_DEMAND_VERSION,status,reason,...extra});
const evidenceFailure=new Set(['recipe-knowledge','crafter-tier-evidence','craft-career-evidence','invalid-stock','actor-or-recipe','craft-item-invalid']);

function canonicalCrafter(s,a){
  if(!s||!Number.isSafeInteger(a?.id))return {status:'UNKNOWN',reason:'input',actor:null};
  const actor=s.agents?.find(x=>x.id===a.id)??null;
  if(!actor)return {status:'UNKNOWN',reason:'actor',actor:null};
  if(actor.alive!==true||actor.profession!=='crafter'||!canPerformProductiveWork(s,actor))
    return {status:'INELIGIBLE',reason:'crafter-required',actor};
  return {status:'SAT',reason:'crafter',actor};
}

function demandRows(projection){
  return projection.signals
    .filter(x=>x?.unit==='item'&&x.tradable===true&&x.actionable===true&&
      Number.isSafeInteger(x.stockShortageQuantity)&&x.stockShortageQuantity>0)
    .sort((a,b)=>
      b.stockShortageQuantity-a.stockShortageQuantity||
      b.shortageQuantity-a.shortageQuantity||
      b.liveDemandQuantity-a.liveDemandQuantity||
      b.historicalDemandQuantity-a.historicalDemandQuantity||
      b.verifiedTradeCount-a.verifiedTradeCount||
      a.itemKind.localeCompare(b.itemKind)
    );
}

function demandView(signal){
  return freeze({
    signalId:signal.signalId,itemKind:signal.itemKind,
    liveDemandQuantity:signal.liveDemandQuantity,historicalDemandQuantity:signal.historicalDemandQuantity,
    demandQuantity:signal.demandQuantity,supplyQuantity:signal.supplyQuantity,shortageQuantity:signal.shortageQuantity,
    ownStockQuantity:signal.ownStockQuantity,stockShortageQuantity:signal.stockShortageQuantity,
    verifiedTradeCount:signal.verifiedTradeCount,observedTick:signal.observedTick,expiresTick:signal.expiresTick,
    marketIds:[...(signal.marketIds??[])]
  });
}

function reserveCheck(s,a,preview){
  const stock=resourceStock(s,a);
  const foodFloor=isIndependent(s)?CRAFT_TRAINING_RULES.food:Math.max(CRAFT_TRAINING_RULES.food,autonomousBirthFoodTarget(s));
  if(!stock||!Number.isFinite(stock.food)||!Number.isFinite(stock.wood)||!Number.isFinite(stock.stone))
    return {status:'UNKNOWN',reason:'reserve-evidence',missing:{}};
  if(stock.food<foodFloor)return {status:'BLOCKED',reason:'reserve-food',missing:{}};
  const missing={};
  const woodNeed=(preview.materials?.wood??0)+CRAFT_TRAINING_RULES.wood;
  const stoneNeed=(preview.materials?.stone??0)+CRAFT_TRAINING_RULES.stone;
  if(stock.wood<woodNeed)missing.wood=Math.ceil(woodNeed-stock.wood);
  if(stock.stone<stoneNeed)missing.stone=Math.ceil(stoneNeed-stock.stone);
  return Object.keys(missing).length
    ?{status:'NEEDS_MATERIALS',reason:'reserve',missing}
    :{status:'SAT',reason:'reserve-ok',missing:{}};
}

function routeForDemand(s,a,itemKind){
  if(validateRecipeKnowledge(s,a).length)return {status:'UNKNOWN',reason:'recipe-evidence',recipe:null};
  if(validateCrafterTierPolicy(s).length)return {status:'UNKNOWN',reason:'crafter-tier-evidence',recipe:null};

  const recipes=Object.values(CRAFT_RECIPE_CATALOG)
    .filter(r=>r.output===itemKind)
    .sort((x,y)=>x.tier-y.tier||x.work-y.work||x.id.localeCompare(y.id));
  if(!recipes.length)return {status:'BLOCKED',reason:'no-recipe',recipe:null};

  const known=recipes.filter(r=>knowsCraftRecipe(s,a,r.id));
  if(!known.length)return {status:'BLOCKED',reason:'recipe-unknown',recipe:null};

  let recipe=null,firstTierViolation=null;
  for(const candidate of known){
    const permission=crafterTierPermission(s,a,candidate.id);
    if(permission.status==='UNKNOWN')return {status:'UNKNOWN',reason:permission.reason??'crafter-tier-evidence',recipe:candidate};
    if(permission.status==='VIOL'){
      if(firstTierViolation===null)firstTierViolation={recipe:candidate,permission};
      continue;
    }
    recipe=candidate;break;
  }
  if(!recipe)return {status:'BLOCKED',reason:'crafter-tier',recipe:firstTierViolation?.recipe??known[0],tierPermission:firstTierViolation?.permission??null};

  const preview=craftPreview(s,{agentId:a.id,recipeId:recipe.id});
  if(!preview.ok){
    if(evidenceFailure.has(preview.reason))return {status:'UNKNOWN',reason:preview.reason,recipe,preview};
    if(preview.reason==='materials'||preview.reason==='item-materials')
      return {status:'NEEDS_MATERIALS',reason:preview.reason,recipe,preview,missing:{...(preview.missing??{})}};
    return {status:'BLOCKED',reason:preview.reason,recipe,preview};
  }

  const reserve=reserveCheck(s,a,preview);
  if(reserve.status!=='SAT')return {status:reserve.status,reason:reserve.reason,recipe,preview,missing:{...reserve.missing}};

  if(preview.stationId!==null){
    const station=s.rustStations?.stations?.find(st=>st.id===preview.stationId)??null;
    if(!station)return {status:'UNKNOWN',reason:'station-evidence',recipe,preview};
    if(routeDistance(routeField(s,a),station)<0)return {status:'BLOCKED',reason:'no-path',recipe,preview};
  }
  return {status:'READY',reason:'ready',recipe,preview};
}

export function crafterProductionPlanFromProjection(s,a,projection,{allowCanonicalMarketTravel=false}={}){
  const identity=canonicalCrafter(s,a);
  if(identity.status!=='SAT')return view(identity.status,identity.reason);
  const actor=identity.actor;

  if(actor.craftTraining?.enabled===true)return view('BLOCKED','manual-training',{agentId:actor.id});
  if(actor.adventureCombat?.status==='ACTIVE'||actor.adventureEncounter)return view('BLOCKED','adventure',{agentId:actor.id});
  if(actor.task&&!(allowCanonicalMarketTravel&&isCanonicalMarketTravelTask(actor.task)))return view('BLOCKED','task',{agentId:actor.id});
  if((s.rustPossessions?.orders??[]).some(o=>o.agentId===actor.id)||(s.rustMaterials?.orders??[]).some(o=>o.agentId===actor.id))
    return view('BLOCKED','craft-busy',{agentId:actor.id});
  if(!homeOf(s,actor.id,{completeOnly:true}))return view('BLOCKED','housing',{agentId:actor.id});
  if(actor.hp<CRAFT_TRAINING_RULES.hp||actor.satiety<CRAFT_TRAINING_RULES.satiety||actor.energy<CRAFT_TRAINING_RULES.energy)
    return view('BLOCKED','survival',{agentId:actor.id});

  if(projection.status!=='SAT'||projection.scope!=='ACTOR_OBSERVED'||!Array.isArray(projection.signals))
    return view('UNKNOWN',projection.reason??'demand-evidence',{agentId:actor.id,demandStatus:projection.status??'UNKNOWN'});

  const rows=demandRows(projection);
  if(!rows.length)return view('IDLE','no-actionable-demand',{agentId:actor.id});

  let needsMaterials=null,blocked=null;
  for(const signal of rows){
    const route=routeForDemand(s,actor,signal.itemKind);
    if(route.status==='UNKNOWN')
      return view('UNKNOWN',route.reason,{agentId:actor.id,demand:demandView(signal),recipeId:route.recipe?.id??null});
    if(route.status==='READY'){
      const intent=freeze({agentId:actor.id,recipeId:route.recipe.id});
      return view('READY_CRAFT','observed-demand',{
        agentId:actor.id,demand:demandView(signal),recipeId:route.recipe.id,tier:route.recipe.tier,
        stationId:route.preview.stationId,intent
      });
    }
    if(route.status==='NEEDS_MATERIALS'&&needsMaterials===null)needsMaterials={signal,route};
    else if(blocked===null)blocked={signal,route};
  }

  if(needsMaterials){
    const {signal,route}=needsMaterials;
    return view('NEEDS_MATERIALS',route.reason,{
      agentId:actor.id,demand:demandView(signal),recipeId:route.recipe?.id??null,tier:route.recipe?.tier??null,
      missing:freeze({...route.missing}),procurementRequired:true
    });
  }
  if(blocked){
    const {signal,route}=blocked;
    return view('BLOCKED',route.reason,{
      agentId:actor.id,demand:demandView(signal),recipeId:route.recipe?.id??null,tier:route.recipe?.tier??null
    });
  }
  return view('IDLE','demand-covered',{agentId:actor.id});
}
