/** MX5 — read-only Community evidence derived from MX4 neighborhoods.
 * Community is evidence-backed social continuity, never a writer.
 */
import {createNeighborhoodShadow} from './neighborhood-shadow.mjs?v=0.5.0';
import {relationshipOf} from './relationships.mjs?v=0.5.0';

export const COMMUNITY_SHADOW_VERSION='MX5-0.1';
export const COMMUNITY_RULES=Object.freeze({
  minimumHouseholds:2,
  minimumSocialLinks:1,
  minimumRelationshipEvidence:2,
  minimumContinuityTicks:60
});

function ownerEvidence(state,ownerIds){
  let evidenceCount=0,earliest=null;
  const kinds={};
  for(let i=0;i<ownerIds.length;i++)for(let j=i+1;j<ownerIds.length;j++){
    for(const row of [relationshipOf(state,ownerIds[i],ownerIds[j]),relationshipOf(state,ownerIds[j],ownerIds[i])]){
      for(const e of row.evidence??[]){
        evidenceCount++;
        kinds[e.kind]=(kinds[e.kind]??0)+1;
        if(Number.isInteger(e.tick))earliest=earliest===null?e.tick:Math.min(earliest,e.tick);
      }
    }
  }
  const continuityTicks=earliest===null?0:Math.max(0,state.tick-earliest);
  return Object.freeze({evidenceCount,earliestEvidenceTick:earliest,continuityTicks,kinds:Object.freeze({...kinds})});
}

export function createCommunityShadow(state,neighborhoodProjection=createNeighborhoodShadow(state)){
  const communities=[];
  for(const n of neighborhoodProjection.neighborhoods){
    const evidence=ownerEvidence(state,n.ownerIds);
    const qualified=n.households>=COMMUNITY_RULES.minimumHouseholds&&
      n.socialLinks>=COMMUNITY_RULES.minimumSocialLinks&&
      evidence.evidenceCount>=COMMUNITY_RULES.minimumRelationshipEvidence&&
      evidence.continuityTicks>=COMMUNITY_RULES.minimumContinuityTicks;
    if(!qualified)continue;
    communities.push(Object.freeze({
      id:'C:'+n.id,
      neighborhoodId:n.id,
      ownerIds:n.ownerIds,
      residentIds:n.residentIds,
      households:n.households,
      residents:n.residents,
      center:n.center,
      anchorRegion:n.anchorRegion,
      socialLinks:n.socialLinks,
      socialDensity:n.socialDensity,
      relationshipEvidence:evidence,
      tradeEvidence:0,
      tradeAuthority:'not-released',
      qualified:true
    }));
  }
  communities.sort((a,b)=>a.ownerIds[0]-b.ownerIds[0]);
  return Object.freeze({
    version:COMMUNITY_SHADOW_VERSION,
    authority:Object.freeze({mode:'shadow-only',communityWriter:false,settlementWriter:false,saveFields:0}),
    rules:COMMUNITY_RULES,
    neighborhoods:neighborhoodProjection,
    communities:Object.freeze(communities),
    summary:Object.freeze({
      neighborhoods:neighborhoodProjection.neighborhoods.length,
      communities:communities.length,
      householdsInCommunities:[...new Set(communities.flatMap(c=>c.ownerIds))].length,
      residentsInCommunities:[...new Set(communities.flatMap(c=>c.residentIds))].length
    })
  });
}

export function communityOfOwner(projection,ownerId){
  if(!projection||!Number.isSafeInteger(ownerId))return null;
  return projection.communities.find(c=>c.ownerIds.includes(ownerId))??null;
}
