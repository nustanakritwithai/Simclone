/**
 * IC6A — bounded evidence-backed social relationship signals.
 * No free-form emotion inference and no second person/home registry.
 */
import {guardianOf} from './individual-resources.mjs?v=0.5.0';
import {homeOf} from './individual-housing.mjs?v=0.5.0';

export const SOCIAL_VERSION='IC6-social-2';
export const PREVIOUS_SOCIAL_VERSION='IC6-social-1';
export const SOCIAL_RULES=Object.freeze({
  maxRelations:512,
  evidencePerRelation:6,
  maxResidences:512,
  scoreMin:-100,
  scoreMax:100,
  fearMin:0,
  fearMax:100,
});

const SCORE_KEYS=Object.freeze(['trust','affinity','respect','fear','debt']);
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const people=s=>[...(s.agents??[]),...(s.archive??[])];
const ids=s=>new Set(people(s).map(a=>a.id));
const validId=id=>Number.isSafeInteger(id)&&id>0;

export const createSocialState=()=>({version:SOCIAL_VERSION,nextEvidence:1,relations:[],residences:[]});

export function ensureSocialState(s){
  if(s.social===undefined)s.social=createSocialState();
  else if(s.social?.version===PREVIOUS_SOCIAL_VERSION){
    s.social.version=SOCIAL_VERSION;
    if(s.social.residences===undefined)s.social.residences=[];
  }
  return s.social;
}

function zeroRelation(fromId,toId){
  return {fromId,toId,trust:0,affinity:0,respect:0,fear:0,debt:0,evidence:[]};
}

export function relationshipOf(s,fromId,toId){
  const row=s.social?.relations?.find(r=>r.fromId===fromId&&r.toId===toId);
  return structuredClone(row??zeroRelation(fromId,toId));
}

export function recordRelationshipEvidence(s,{
  fromId,toId,kind,key,tick=s.tick,delta={},ref=null
}={}){
  const social=ensureSocialState(s),known=ids(s);
  if(!validId(fromId)||!validId(toId)||fromId===toId||!known.has(fromId)||!known.has(toId))
    return {ok:false,reason:'actor'};
  if(typeof kind!=='string'||!kind||kind.length>48||typeof key!=='string'||!key||key.length>180)
    return {ok:false,reason:'evidence'};
  if(!Number.isInteger(tick)||tick<0||tick>s.tick)return {ok:false,reason:'tick'};
  if(ref!==null&&(typeof ref!=='string'||ref.length>180))return {ok:false,reason:'ref'};
  const d={};
  for(const k of SCORE_KEYS){
    const n=delta[k]??0;
    if(!Number.isInteger(n)||n<-100||n>100)return {ok:false,reason:'delta'};
    d[k]=n;
  }
  let row=social.relations.find(r=>r.fromId===fromId&&r.toId===toId);
  if(row?.evidence.some(e=>e.key===key))return {ok:true,changed:false,relation:relationshipOf(s,fromId,toId)};
  if(!row){
    if(social.relations.length>=SOCIAL_RULES.maxRelations)return {ok:false,reason:'capacity'};
    row=zeroRelation(fromId,toId);social.relations.push(row);
  }
  row.trust=clamp(row.trust+d.trust,SOCIAL_RULES.scoreMin,SOCIAL_RULES.scoreMax);
  row.affinity=clamp(row.affinity+d.affinity,SOCIAL_RULES.scoreMin,SOCIAL_RULES.scoreMax);
  row.respect=clamp(row.respect+d.respect,SOCIAL_RULES.scoreMin,SOCIAL_RULES.scoreMax);
  row.fear=clamp(row.fear+d.fear,SOCIAL_RULES.fearMin,SOCIAL_RULES.fearMax);
  row.debt=clamp(row.debt+d.debt,SOCIAL_RULES.scoreMin,SOCIAL_RULES.scoreMax);
  row.evidence.push({id:social.nextEvidence++,key,tick,kind,delta:d,ref});
  while(row.evidence.length>SOCIAL_RULES.evidencePerRelation)row.evidence.shift();
  return {ok:true,changed:true,relation:relationshipOf(s,fromId,toId)};
}

export function activeResidenceOf(s,agentId){
  const r=s.social?.residences?.find(r=>r.agentId===agentId&&r.leftTick===null);
  return r?structuredClone(r):null;
}

/** Read-only household projection: owner + explicit cohabitants + evidenced guardian dependents. */
export function householdForOwner(s,ownerId){
  const owner=s.agents?.find(a=>a.id===ownerId&&a.alive);
  if(!owner)return null;
  const home=homeOf(s,ownerId,{completeOnly:true});
  if(!home)return null;
  const dependentIds=(s.agents??[]).filter(a=>a.alive&&a.id!==ownerId&&guardianOf(s,a)?.id===ownerId)
    .map(a=>a.id).sort((a,b)=>a-b);
  const cohabitantIds=(s.social?.residences??[]).filter(r=>r.leftTick===null&&r.ownerId===ownerId)
    .map(r=>r.agentId).filter(id=>id!==ownerId&&(s.agents??[]).some(a=>a.id===id&&a.alive))
    .sort((a,b)=>a-b);
  return {
    houseId:home.houseId,
    ownerId,
    residentIds:[ownerId,...new Set([...dependentIds,...cohabitantIds])],
    dependentIds,
    cohabitantIds,
    source:'owner+guardian+explicit-cohabitation'
  };
}

export function householdOf(s,agentId){
  const a=s.agents?.find(a=>a.id===agentId&&a.alive);
  if(!a)return null;
  const guardian=guardianOf(s,a);
  const residence=activeResidenceOf(s,a.id);
  return householdForOwner(s,guardian?.id??residence?.ownerId??a.id);
}

export function allHouseholds(s){
  return (s.agents??[]).filter(a=>a.alive).map(a=>householdForOwner(s,a.id)).filter(Boolean)
    .sort((a,b)=>a.ownerId-b.ownerId);
}

export function validateSocialState(s,{required=false}={}){
  const social=s.social;
  if(social===undefined)return required?['Social state']:[];
  const errors=[],known=ids(s);
  if(!social||social.version!==SOCIAL_VERSION||!Number.isSafeInteger(social.nextEvidence)||social.nextEvidence<1||
    !Array.isArray(social.relations)||social.relations.length>SOCIAL_RULES.maxRelations||
    !Array.isArray(social.residences)||social.residences.length>SOCIAL_RULES.maxResidences)return ['Social state'];
  const pairs=new Set(),evidenceIds=new Set();
  let maxEvidence=0;
  for(const r of social.relations){
    const pair=r?.fromId+':'+r?.toId;
    if(!r||!validId(r.fromId)||!validId(r.toId)||r.fromId===r.toId||!known.has(r.fromId)||!known.has(r.toId)||pairs.has(pair)||
      !Array.isArray(r.evidence)||r.evidence.length>SOCIAL_RULES.evidencePerRelation||
      !Number.isInteger(r.trust)||r.trust<-100||r.trust>100||
      !Number.isInteger(r.affinity)||r.affinity<-100||r.affinity>100||
      !Number.isInteger(r.respect)||r.respect<-100||r.respect>100||
      !Number.isInteger(r.fear)||r.fear<0||r.fear>100||
      !Number.isInteger(r.debt)||r.debt<-100||r.debt>100)errors.push('Social relation');
    pairs.add(pair);
    const keys=new Set();
    for(const e of r?.evidence??[]){
      if(!e||!Number.isSafeInteger(e.id)||e.id<1||evidenceIds.has(e.id)||keys.has(e.key)||
        typeof e.key!=='string'||!e.key||e.key.length>180||typeof e.kind!=='string'||!e.kind||e.kind.length>48||
        !Number.isInteger(e.tick)||e.tick<0||e.tick>s.tick||
        (e.ref!==null&&(typeof e.ref!=='string'||e.ref.length>180))||
        !e.delta||SCORE_KEYS.some(k=>!Number.isInteger(e.delta[k])||e.delta[k]<-100||e.delta[k]>100))
        errors.push('Social evidence');
      evidenceIds.add(e?.id);keys.add(e?.key);maxEvidence=Math.max(maxEvidence,e?.id??0);
    }
  }
  if(social.nextEvidence<=maxEvidence)errors.push('Social evidence counter');
  const activeResidents=new Set();
  for(const r of social.residences){
    if(!r||!validId(r.agentId)||!validId(r.ownerId)||r.agentId===r.ownerId||!known.has(r.agentId)||!known.has(r.ownerId)||
      typeof r.houseId!=='string'||!/^H\d+$/.test(r.houseId)||
      !Number.isInteger(r.joinedTick)||r.joinedTick<0||r.joinedTick>s.tick||
      (r.leftTick!==null&&(!Number.isInteger(r.leftTick)||r.leftTick<r.joinedTick||r.leftTick>s.tick))||
      typeof r.joinReason!=='string'||!r.joinReason||
      (r.leftTick===null?r.leaveReason!==null:typeof r.leaveReason!=='string')||
      !r.evidence||!Array.isArray(r.evidence.subjectToOwner)||!Array.isArray(r.evidence.ownerToSubject)||
      [...r.evidence.subjectToOwner,...r.evidence.ownerToSubject].some(id=>!Number.isSafeInteger(id)||id<1))
      errors.push('Social residence');
    if(r?.leftTick===null){
      if(activeResidents.has(r.agentId))errors.push('Social active residence');
      activeResidents.add(r.agentId);
      const resident=s.agents?.find(a=>a.id===r.agentId&&a.alive);
      const owner=s.agents?.find(a=>a.id===r.ownerId&&a.alive);
      const home=owner?homeOf(s,owner.id,{completeOnly:true}):null;
      if(!resident||!owner||!home||home.houseId!==r.houseId)errors.push('Social residence home');
    }
  }
  return [...new Set(errors)];
}
