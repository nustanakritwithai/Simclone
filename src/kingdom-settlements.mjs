/** Kingdom Sandbox integration K7.
 * Derived settlement identity contract. Read-only: no stock split, migration, trade or ownership mutation.
 */
export const KINGDOM_SETTLEMENTS_VERSION='K7-shadow-0.1';

const validAnchor=b=>b&&b.complete===true&&b.type==='camp'&&Number.isSafeInteger(b.id)&&Number.isInteger(b.x)&&Number.isInteger(b.y);
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

export function settlementIdForCamp(campId){return `settlement:camp:${campId}`;}

export function kingdomSettlementSnapshot({agents=[],buildings=[]}={}){
  const anchors=buildings.filter(validAnchor).slice().sort((a,b)=>a.id-b.id);
  const settlements=anchors.map(b=>({
    id:settlementIdForCamp(b.id),anchorBuildingId:b.id,x:b.x,y:b.y,
    memberIds:[],population:0
  }));
  for(const a of agents.filter(a=>a?.alive&&Number.isInteger(a.x)&&Number.isInteger(a.y)).sort((a,b)=>a.id-b.id)){
    if(!settlements.length)break;
    const winner=settlements.slice().sort((x,y)=>dist(a,x)-dist(a,y)||x.anchorBuildingId-y.anchorBuildingId)[0];
    winner.memberIds.push(a.id);winner.population++;
  }
  return {
    version:KINGDOM_SETTLEMENTS_VERSION,
    mode:'shadow',
    count:settlements.length,
    settlements,
    unassignedLiving:settlements.length?0:agents.filter(a=>a?.alive).length
  };
}
