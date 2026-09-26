/** MX4 — read-only neighborhood emergence projection.
 * A neighborhood is a spatially connected set of completed household homes.
 * It is evidence, not a settlement/faction authority and never mutates state.
 */
import {allHouseholds,relationshipOf} from './relationships.mjs?v=0.5.0';
import {homeOf} from './individual-housing.mjs?v=0.5.0';
import {worldRegionAt} from './world-regions.mjs?v=0.5.0';
import {worldBounds} from './world-bounds.mjs?v=0.5.0';

export const NEIGHBORHOOD_SHADOW_VERSION='MX4-0.1';
export const NEIGHBORHOOD_RULES=Object.freeze({
  linkDistance:12,
  minimumHouseholds:2,
  socialLinkTrust:2,
  socialLinkAffinity:1
});

const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const round3=n=>+n.toFixed(3);

function householdHomes(state){
  return allHouseholds(state).map(h=>{
    const home=homeOf(state,h.ownerId,{completeOnly:true});
    if(!home?.origin)return null;
    return Object.freeze({
      houseId:h.houseId,ownerId:h.ownerId,residentIds:Object.freeze([...h.residentIds]),
      x:home.origin.x,y:home.origin.y
    });
  }).filter(Boolean).sort((a,b)=>a.ownerId-b.ownerId);
}

function socialEvidence(state,a,b){
  const ab=relationshipOf(state,a.ownerId,b.ownerId),ba=relationshipOf(state,b.ownerId,a.ownerId);
  const linked=(ab.trust>=NEIGHBORHOOD_RULES.socialLinkTrust&&ab.affinity>=NEIGHBORHOOD_RULES.socialLinkAffinity)||
    (ba.trust>=NEIGHBORHOOD_RULES.socialLinkTrust&&ba.affinity>=NEIGHBORHOOD_RULES.socialLinkAffinity);
  return Object.freeze({
    linked,
    trust:ab.trust+ba.trust,
    affinity:ab.affinity+ba.affinity,
    respect:ab.respect+ba.respect,
    evidenceCount:(ab.evidence?.length??0)+(ba.evidence?.length??0)
  });
}

function components(homes){
  const byOwner=new Map(homes.map(h=>[h.ownerId,h])),seen=new Set(),out=[];
  for(const start of homes){
    if(seen.has(start.ownerId))continue;
    const queue=[start.ownerId],owners=[];seen.add(start.ownerId);
    for(let q=0;q<queue.length;q++){
      const id=queue[q],a=byOwner.get(id);owners.push(id);
      for(const b of homes){
        if(seen.has(b.ownerId)||dist(a,b)>NEIGHBORHOOD_RULES.linkDistance)continue;
        seen.add(b.ownerId);queue.push(b.ownerId);
      }
    }
    owners.sort((a,b)=>a-b);out.push(owners);
  }
  return out;
}

function neighborhood(state,homes,ownerIds){
  const members=ownerIds.map(id=>homes.find(h=>h.ownerId===id));
  let sx=0,sy=0;for(const h of members){sx+=h.x;sy+=h.y;}
  const residentIds=[...new Set(members.flatMap(h=>h.residentIds))].sort((a,b)=>a-b);
  const links=[];let socialLinks=0,trust=0,affinity=0,respect=0,evidenceCount=0;
  for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++){
    const a=members[i],b=members[j],distance=dist(a,b),social=socialEvidence(state,a,b);
    if(distance>NEIGHBORHOOD_RULES.linkDistance)continue;
    if(social.linked)socialLinks++;
    trust+=social.trust;affinity+=social.affinity;respect+=social.respect;evidenceCount+=social.evidenceCount;
    links.push(Object.freeze({aOwnerId:a.ownerId,bOwnerId:b.ownerId,distance,...social}));
  }
  const possible=members.length*(members.length-1)/2;
  const center={x:round3(sx/members.length),y:round3(sy/members.length)};
  const bounds=worldBounds(state),anchor=members.slice().sort((a,b)=>a.ownerId-b.ownerId)[0];
  const region=worldRegionAt(state.seed,bounds,anchor.x,anchor.y).region;
  return Object.freeze({
    id:'N:'+ownerIds.join('-'),
    ownerIds:Object.freeze(ownerIds.slice()),
    houseIds:Object.freeze(members.map(h=>h.houseId)),
    residentIds:Object.freeze(residentIds),
    households:members.length,residents:residentIds.length,
    center:Object.freeze(center),
    anchorRegion:region,
    spatialLinks:links.length,
    socialLinks,
    socialDensity:possible?round3(socialLinks/possible):0,
    relationshipEvidence:Object.freeze({trust,affinity,respect,evidenceCount}),
    links:Object.freeze(links)
  });
}

export function createNeighborhoodShadow(state){
  const before=state,homes=householdHomes(state);
  const all=components(homes).filter(ids=>ids.length>=NEIGHBORHOOD_RULES.minimumHouseholds)
    .map(ids=>neighborhood(state,homes,ids))
    .sort((a,b)=>a.ownerIds[0]-b.ownerIds[0]);
  const assigned=new Set(all.flatMap(n=>n.ownerIds));
  return Object.freeze({
    version:NEIGHBORHOOD_SHADOW_VERSION,
    authority:Object.freeze({
      mode:'shadow-only',
      settlementWriter:false,
      householdWriter:false,
      relationshipWriter:false,
      resourceWriter:false,
      saveFields:0
    }),
    rules:NEIGHBORHOOD_RULES,
    homes:Object.freeze(homes),
    neighborhoods:Object.freeze(all),
    isolatedHouseholdOwnerIds:Object.freeze(homes.map(h=>h.ownerId).filter(id=>!assigned.has(id))),
    summary:Object.freeze({
      completedHouseholds:homes.length,
      neighborhoods:all.length,
      neighborhoodHouseholds:assigned.size,
      isolatedHouseholds:homes.length-assigned.size,
      residentsInNeighborhoods:[...new Set(all.flatMap(n=>n.residentIds))].length
    }),
    stateIdentityPreserved:before===state
  });
}

export function neighborhoodOfOwner(projection,ownerId){
  if(!projection||!Number.isSafeInteger(ownerId))return null;
  return projection.neighborhoods.find(n=>n.ownerIds.includes(ownerId))??null;
}
