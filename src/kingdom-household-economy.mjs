/**
 * Kingdom Sandbox K2-K6 adapted from settlement scope to Simclone household scope.
 * Pure/read-only: no stock, profession, price or membership mutation.
 */
import {householdForOwner} from './relationships.mjs?v=0.5.0';
import {resourceStock} from './individual-resources.mjs?v=0.5.0';
import {leadershipProfile} from './leadership.mjs?v=0.5.0';
import {kingdomEconomySnapshot} from './kingdom-economy.mjs?v=0.5.0';
import {kingdomProductionSnapshot} from './kingdom-production.mjs?v=0.5.0';
import {kingdomLaborMarketSnapshot} from './kingdom-labor-market.mjs?v=0.5.0';
import {kingdomMarketSnapshot} from './kingdom-market.mjs?v=0.5.0';
import {skillLevel} from './survival.mjs?v=0.5.0';
import {productiveWorkRate} from './lifecycle.mjs?v=0.5.0';

export const KINGDOM_HOUSEHOLD_ECONOMY_VERSION='K2-K6-household-shadow-0.1';

const memberRows=(s,ids)=>ids.map(id=>s.agents.find(a=>a.id===id&&a.alive)).filter(Boolean);

export function householdEconomySnapshot(s,ownerId){
  const household=householdForOwner(s,ownerId);
  if(!household)return null;
  const owner=s.agents.find(a=>a.id===ownerId&&a.alive);
  if(!owner)return null;
  const members=memberRows(s,household.residentIds),stock=resourceStock(s,owner);
  const economy=kingdomEconomySnapshot({agents:members,stock,unfinished:0});
  const leadership=leadershipProfile(s,ownerId);
  const capacity=Math.max(
    members.length,
    1+(leadership?.followerCapacity??0)+(household.dependentIds?.length??0)
  );
  const production=kingdomProductionSnapshot({
    agents:members,
    capacity,
    economy,
    skillLevel:(a,action)=>skillLevel(a.skills?.[action]??0),
    ageRate:a=>productiveWorkRate(s,a),
  });
  const labor=kingdomLaborMarketSnapshot({economy,production});
  const market=kingdomMarketSnapshot({economy});
  return {
    version:KINGDOM_HOUSEHOLD_ECONOMY_VERSION,
    houseId:household.houseId,
    ownerId,
    memberIds:household.residentIds.slice(),
    stock:{food:stock.food,wood:stock.wood,stone:stock.stone,charcoal:stock.charcoal??0},
    leadership,
    economy,
    production,
    labor,
    market,
  };
}

export function allHouseholdEconomies(s){
  const seen=new Set(),out=[];
  for(const a of (s.agents??[]).filter(a=>a.alive).sort((a,b)=>a.id-b.id)){
    const h=householdForOwner(s,a.id);
    if(!h||seen.has(h.houseId))continue;
    seen.add(h.houseId);
    const row=householdEconomySnapshot(s,h.ownerId);
    if(row)out.push(row);
  }
  return out.sort((a,b)=>a.houseId.localeCompare(b.houseId));
}
