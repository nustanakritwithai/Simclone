/** Kingdom K5: bounded labor-market authority experiment.
 * Pure deterministic bonus only. Survival emergencies, pathing and reservations remain authoritative.
 */
import {kingdomVillageDemand,kingdomScarcityRatio} from './kingdom-economy.mjs?v=0.5.0';

export const KINGDOM_LABOR_AUTHORITY_VERSION='K5-authority-0.1';
export const MAX_LABOR_AUTHORITY_BONUS=6;
const ROLE=Object.freeze({
  WOODCUT:{profession:'woodcutter',good:'wood',ideal:6},
  MINE:{profession:'miner',good:'stone',ideal:6},
  BUILD:{profession:'builder',good:'building',ideal:5},
});
const inferred=a=>a?.profession??({WOODCUT:'woodcutter',MINE:'miner',BUILD:'builder',FORAGE:'forager'}[a?.preference]??null);

export function laborAuthoritySignal({kind,agent,agents=[],stock={},unfinished=0,emergency=false}={}){
  const spec=ROLE[kind];
  if(!spec||emergency)return {bonus:0,active:false,reason:emergency?'survival-emergency':'unsupported-role'};
  const living=agents.filter(a=>a?.alive);
  const workers=living.filter(a=>inferred(a)===spec.profession).length;
  const gap=Math.max(0,spec.ideal-workers);
  if(gap<=0)return {bonus:0,active:false,reason:'staffed',role:spec.profession,workers,gap};
  const demand=kingdomVillageDemand(living.length);
  const scarcity=spec.good==='building'
    ? (Number(unfinished)>0?1.5:0.25)
    : kingdomScarcityRatio(stock,demand,spec.good);
  if(scarcity<=1.2)return {bonus:0,active:false,reason:'no-shortage',role:spec.profession,workers,gap,scarcity};
  const priority=(scarcity-1)*40+gap*4+(workers===0?25:0);
  const switching=inferred(agent)!==spec.profession;
  // Small authority: 1..6, and switching gets at most one extra point.
  const bonus=Math.min(MAX_LABOR_AUTHORITY_BONUS,Math.max(1,Math.round(priority/35)+(switching?1:0)));
  return {bonus,active:true,reason:'labor-shortage',role:spec.profession,workers,gap,scarcity:+scarcity.toFixed(3),priority:+priority.toFixed(2),switching};
}
