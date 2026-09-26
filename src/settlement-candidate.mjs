/** MX6 — read-only Settlement candidates derived from MX5 Community evidence. */
import {createCommunityShadow} from './community-shadow.mjs?v=0.5.0';

export const SETTLEMENT_CANDIDATE_VERSION='MX6-0.1';
export const SETTLEMENT_CANDIDATE_RULES=Object.freeze({
  minimumHouseholds:2,
  minimumResidents:2,
  minimumSocialLinks:1,
  minimumEvidence:2,
  minimumContinuityTicks:60
});

function boundsForCommunity(community,neighborhoodProjection){
  const ownerSet=new Set(community.ownerIds);
  const homes=neighborhoodProjection.homes.filter(h=>ownerSet.has(h.ownerId));
  const xs=homes.map(h=>h.x),ys=homes.map(h=>h.y);
  return Object.freeze({
    minX:Math.min(...xs),maxX:Math.max(...xs),
    minY:Math.min(...ys),maxY:Math.max(...ys)
  });
}

export function createSettlementCandidates(state,communityProjection=createCommunityShadow(state)){
  const rows=[];
  for(const c of communityProjection.communities){
    const qualified=c.households>=SETTLEMENT_CANDIDATE_RULES.minimumHouseholds&&
      c.residents>=SETTLEMENT_CANDIDATE_RULES.minimumResidents&&
      c.socialLinks>=SETTLEMENT_CANDIDATE_RULES.minimumSocialLinks&&
      c.relationshipEvidence.evidenceCount>=SETTLEMENT_CANDIDATE_RULES.minimumEvidence&&
      c.relationshipEvidence.continuityTicks>=SETTLEMENT_CANDIDATE_RULES.minimumContinuityTicks;
    if(!qualified)continue;
    rows.push(Object.freeze({
      version:SETTLEMENT_CANDIDATE_VERSION,
      id:'SC:'+c.id,
      communityId:c.id,
      neighborhoodId:c.neighborhoodId,
      ownerIds:c.ownerIds,
      residentIds:c.residentIds,
      households:c.households,
      residents:c.residents,
      center:c.center,
      region:c.anchorRegion,
      boundary:boundsForCommunity(c,communityProjection.neighborhoods),
      socialLinks:c.socialLinks,
      evidenceCount:c.relationshipEvidence.evidenceCount,
      continuityTicks:c.relationshipEvidence.continuityTicks,
      qualified:true
    }));
  }
  rows.sort((a,b)=>a.ownerIds[0]-b.ownerIds[0]);
  return Object.freeze({
    version:SETTLEMENT_CANDIDATE_VERSION,
    authority:Object.freeze({mode:'shadow-only',settlementWriter:false,saveFields:0}),
    rules:SETTLEMENT_CANDIDATE_RULES,
    community:communityProjection,
    candidates:Object.freeze(rows)
  });
}
