import {materialStock} from './individual-resources.mjs?v=0.5.0';
/** Pure IC2 per-person next intention. This is not an executor. */
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.5.0';
import {RECIPE_CATALOG} from './crafting-catalog.mjs?v=0.5.0';
import {homeOf,personalHomeSite,nextPersonalHomePiece} from './individual-housing.mjs?v=0.5.0';
export const PERSONAL_HOME_PLAN_VERSION='IC2-0.1';
export function personalHomeIntent(s,a,isWalkable=()=>true){
 const base={version:PERSONAL_HOME_PLAN_VERSION,agentId:Number.isSafeInteger(a?.id)?a.id:null};
 if(!a?.alive||!canPerformProductiveWork(s,a))return {...base,kind:'INELIGIBLE'};
 const owned=homeOf(s,a.id);if(owned?.complete)return {...base,kind:'HOME_COMPLETE',houseId:owned.houseId};
 const site=personalHomeSite(s,a,isWalkable),piece=nextPersonalHomePiece(s,a,isWalkable);
 if(!site||!piece?.pieceKind)return {...base,kind:'NO_SITE'};
 const context={...base,site:{...site.origin}};
 const bag=(s.rustPossessions?.items??[]).filter(i=>i.location?.kind==='bag'&&i.location.agentId===a.id).sort((x,y)=>x.id-y.id);
 const hammer=bag.find(i=>i.kind==='HAMMER');
 if(!hammer)return {...context,kind:'NEED_HAMMER',station:'CRAFTING_TABLE_LV1'};
 if(s.rustPossessions.equipment.find(e=>e.agentId===a.id)?.itemId!==hammer.id)return {...context,kind:'EQUIP_HAMMER',itemId:hammer.id};
 const carried=bag.find(i=>i.kind===piece.pieceKind);
 if(carried)return {...context,kind:'PLACE_PIECE',itemInstanceId:carried.id,pieceKind:piece.pieceKind,socket:{...piece.socket}};
 const recipe=RECIPE_CATALOG[piece.pieceKind];if(!recipe)return {...base,kind:'NO_SITE'};
 const stock=materialStock(s,a);
 const missing={};for(const [k,n] of Object.entries(recipe.materials))if((stock?.[k]??0)<n)missing[k]=n-(stock?.[k]??0);
 if(Object.keys(missing).length)return {...context,kind:'NEED_MATERIALS',pieceKind:piece.pieceKind,recipeId:recipe.id,missing};
 return {...context,kind:'CRAFT_PIECE',pieceKind:piece.pieceKind,recipeId:recipe.id,materials:{...recipe.materials}};
}
