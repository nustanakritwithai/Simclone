/**
 * Kingdom MarketTradeSystem adapted to Independent Household scope.
 * Pure shadow: no stock reservation, cargo, money or relationship mutation.
 */
import {allHouseholdEconomies} from './kingdom-household-economy.mjs?v=0.5.0';
import {homeOf} from './individual-housing.mjs?v=0.5.0';

export const KINGDOM_HOUSEHOLD_TRADE_VERSION='K-trade-household-shadow-0.1';
export const HOUSEHOLD_TRADE_RULES=Object.freeze({
  goods:Object.freeze(['food','wood','stone']),
  maxQuantity:12,
  destinationScarcityMin:1.2,
  sourceScarcityMax:1,
});

const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

export function householdTradeOpportunities(s){
  const economies=allHouseholdEconomies(s),out=[];
  const homes=new Map();
  for(const row of economies){
    const h=homeOf(s,row.ownerId,{completeOnly:true});
    if(h?.origin)homes.set(row.houseId,h.origin);
  }
  for(const origin of economies){
    const from=homes.get(origin.houseId);if(!from)continue;
    for(const destination of economies){
      if(destination.houseId===origin.houseId)continue;
      const to=homes.get(destination.houseId);if(!to)continue;
      const dist=distance(from,to);
      for(const good of HOUSEHOLD_TRADE_RULES.goods){
        const sourceStock=Math.max(0,Number(origin.stock?.[good]??0));
        const destinationStock=Math.max(0,Number(destination.stock?.[good]??0));
        const sourceDemand=Math.max(0,Number(origin.economy?.demand?.[good]??0));
        const destinationDemand=Math.max(0,Number(destination.economy?.demand?.[good]??0));
        const sourceScarcity=Number(origin.economy?.scarcity?.[good]??0);
        const destinationScarcity=Number(destination.economy?.scarcity?.[good]??0);
        const exportableSurplus=Math.max(0,Math.floor(sourceStock-sourceDemand));
        const destinationDeficit=Math.max(0,Math.ceil(destinationDemand-destinationStock));
        if(exportableSurplus<=0||destinationDeficit<=0)continue;
        if(sourceScarcity>=HOUSEHOLD_TRADE_RULES.sourceScarcityMax||
          destinationScarcity<=HOUSEHOLD_TRADE_RULES.destinationScarcityMin)continue;
        const quantity=Math.min(
          HOUSEHOLD_TRADE_RULES.maxQuantity,
          exportableSurplus,
          destinationDeficit
        );
        if(quantity<=0)continue;
        const sourcePrice=Number(origin.market?.prices?.[good]??0);
        const destinationPrice=Number(destination.market?.prices?.[good]??0);
        const priceGap=+(destinationPrice-sourcePrice).toFixed(2);
        const scarcityGap=+(destinationScarcity-sourceScarcity).toFixed(3);
        const score=+(scarcityGap*30+Math.max(0,priceGap)*2-dist*.5).toFixed(2);
        out.push({
          version:KINGDOM_HOUSEHOLD_TRADE_VERSION,
          originHouseId:origin.houseId,
          destinationHouseId:destination.houseId,
          originOwnerId:origin.ownerId,
          destinationOwnerId:destination.ownerId,
          good,
          exportableSurplus,
          destinationDeficit,
          quantity,
          sourceScarcity,
          destinationScarcity,
          scarcityGap,
          sourcePrice,
          destinationPrice,
          priceGap,
          distance:dist,
          score,
          authoritative:false,
        });
      }
    }
  }
  return out.sort((a,b)=>
    b.score-a.score||
    a.originHouseId.localeCompare(b.originHouseId)||
    a.destinationHouseId.localeCompare(b.destinationHouseId)||
    a.good.localeCompare(b.good)
  );
}

export function bestHouseholdTradeOpportunity(s,ownerId=null){
  const rows=householdTradeOpportunities(s);
  if(ownerId===null)return rows[0]??null;
  return rows.find(r=>r.originOwnerId===ownerId||r.destinationOwnerId===ownerId)??null;
}
