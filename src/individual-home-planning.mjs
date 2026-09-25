/**
 * Independent Clone World IC2 — pure personal-home planner.
 *
 * This module proposes one next intent for one person. It does not mutate
 * world state and it does not execute crafting, equipment or placement.
 */
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {ITEM_CATALOG,RECIPE_CATALOG} from './crafting-catalog.mjs?v=0.5.0';
import {homeOf,personalHomeSite,nextPersonalHomePiece} from './individual-housing.mjs?v=0.5.0';

export const PERSONAL_HOME_PLAN_VERSION='IC2-0.1';

const bagItemsFor=(s,agentId)=>(s.rustPossessions?.items??[])
  .filter(i=>i.location?.kind==='bag'&&i.location.agentId===agentId)
  .sort((a,b)=>a.id-b.id);

const missingMaterials=(stock,materials)=>{
  const missing={};
  for(const [key,needed] of Object.entries(materials??{})){
    const have=Number(stock?.[key]??0);
    if(have<needed)missing[key]=needed-have;
  }
  return missing;
};

export function personalHomeIntent(s,a,isWalkable=()=>true){
  const agentId=Number.isSafeInteger(a?.id)?a.id:null;
  if(!a?.alive||!canPerformProductiveWork(s,a))
    return {version:PERSONAL_HOME_PLAN_VERSION,agentId,kind:'INELIGIBLE'};

  const owned=homeOf(s,a.id);
  if(owned?.complete)
    return {version:PERSONAL_HOME_PLAN_VERSION,agentId:a.id,kind:'HOME_COMPLETE',houseId:owned.houseId};

  const site=personalHomeSite(s,a,isWalkable);
  if(!site)
    return {version:PERSONAL_HOME_PLAN_VERSION,agentId:a.id,kind:'NO_SITE'};

  const piece=nextPersonalHomePiece(s,a,isWalkable);
  if(!piece?.pieceKind)
    return {version:PERSONAL_HOME_PLAN_VERSION,agentId:a.id,kind:'NO_SITE'};

  const bag=bagItemsFor(s,a.id);
  const hammer=bag.find(i=>i.kind==='HAMMER')??null;
  if(!hammer){
    return {version:PERSONAL_HOME_PLAN_VERSION,agentId:a.id,kind:'NEED_HAMMER',
      station:'CRAFTING_TABLE_LV1',site:{...site.origin}};
  }

  const equipped=(s.rustPossessions?.equipment??[]).find(e=>e.agentId===a.id)?.itemId??null;
  if(equipped!==hammer.id){
    return {version:PERSONAL_HOME_PLAN_VERSION,agentId:a.id,kind:'EQUIP_HAMMER',
      itemId:hammer.id,site:{...site.origin}};
  }

  const carried=bag.find(i=>i.kind===piece.pieceKind)??null;
  if(carried){
    return {version:PERSONAL_HOME_PLAN_VERSION,agentId:a.id,kind:'PLACE_PIECE',
      itemInstanceId:carried.id,pieceKind:piece.pieceKind,socket:{...piece.socket},site:{...site.origin}};
  }

  const recipe=RECIPE_CATALOG[piece.pieceKind];
  if(!recipe||!ITEM_CATALOG[piece.pieceKind]){
    return {version:PERSONAL_HOME_PLAN_VERSION,agentId:a.id,kind:'NO_SITE'};
  }

  const missing=missingMaterials(s.stock,recipe.materials);
  if(Object.keys(missing).length){
    return {version:PERSONAL_HOME_PLAN_VERSION,agentId:a.id,kind:'NEED_MATERIALS',
      pieceKind:piece.pieceKind,recipeId:recipe.id,missing,site:{...site.origin}};
  }

  return {version:PERSONAL_HOME_PLAN_VERSION,agentId:a.id,kind:'CRAFT_PIECE',
    pieceKind:piece.pieceKind,recipeId:recipe.id,materials:{...recipe.materials},site:{...site.origin}};
}
