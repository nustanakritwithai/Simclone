/** Kingdom Sandbox utility-AI extraction for Simclone.
 * Pure deterministic scoring only: no DOM, clocks, Math.random or donor world globals.
 * K1 ports worker specialization, scarcity pressure and profession continuity.
 */
export const KINGDOM_PROFESSIONS=Object.freeze({
  forager:'ผู้หาอาหาร',
  woodcutter:'คนตัดไม้',
  miner:'คนขุดหิน',
  builder:'ช่างก่อสร้าง',
  adventurer:'นักผจญภัย',
});
const ACTION_TO_PROFESSION=Object.freeze({
  FORAGE:'forager',
  WOODCUT:'woodcutter',
  MINE:'miner',
  BUILD:'builder',
});
const ACTION_ORDER=Object.freeze(['FORAGE','WOODCUT','MINE','BUILD']);
export const ADVENTURER_QUALIFICATION=3;
const QUALIFICATION_HISTORY=8;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

export function professionForAction(action){return ACTION_TO_PROFESSION[action]??null;}
export function professionLabel(profession){return KINGDOM_PROFESSIONS[profession]??'ยังไม่มีอาชีพ';}
export function isKingdomProfession(profession){return Object.prototype.hasOwnProperty.call(KINGDOM_PROFESSIONS,profession);}

function bestSkillProfession(agent){
  let best=ACTION_ORDER[0],bestXP=-Infinity;
  for(const action of ACTION_ORDER){
    const xp=Number(agent?.skills?.[action]??0);
    const preference=agent?.preference===action?0.001:0;
    if(xp+preference>bestXP){bestXP=xp+preference;best=action;}
  }
  return professionForAction(agent?.preference)??professionForAction(best);
}

export function ensureProfession(agent,tick=0){
  if(isKingdomProfession(agent?.profession))return agent.profession;
  const profession=bestSkillProfession(agent);
  agent.profession=profession;
  agent.professionSinceTick=Number.isInteger(tick)&&tick>=0?tick:0;
  if(!Array.isArray(agent.career))agent.career=[{tick:agent.professionSinceTick,profession}];
  return profession;
}

function mix32(n){
  n=(n^61)^(n>>>16);
  n=Math.imul(n,9);
  n=n^(n>>>4);
  n=Math.imul(n,0x27d4eb2d);
  return (n^(n>>>15))>>>0;
}
function stringHash(text){
  let h=2166136261>>>0;
  for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
  return h>>>0;
}

/** Kingdom used rand(-4,4); Simclone preserves that small variation without nondeterminism. */
export function deterministicUtilityJitter(seed,agentId,tick,kind){
  const mixed=mix32((seed>>>0)^Math.imul(Number(agentId)||0,0x9e3779b1)^Math.imul((Number(tick)||0)+1,0x85ebca6b)^stringHash(kind));
  return (mixed%9)-4;
}

/** Convert the donor economy's shortage/wage pressure into a stock-target utility premium. */
export function scarcityPremium(projected,targets,resourceType){
  const target=Math.max(0,Number(targets?.[resourceType]??0));
  const have=Math.max(0,Number(projected?.[resourceType]??0));
  if(target<=0)return 0;
  return Math.round(clamp((target-have)/target,0,1)*45);
}

export function kingdomWorkFactors({seed=0,tick=0,agent,kind,resourceType=null,projected=null,targets=null,scarcityOverride=null}){
  const profession=ensureProfession(agent,tick);
  const expected=professionForAction(kind);
  const scarcity=scarcityOverride===null?scarcityPremium(projected,targets,resourceType):Math.round(Number(scarcityOverride)||0);
  return {
    scarcity,
    profession:expected&&expected===profession?8:0,
    utilityJitter:deterministicUtilityJitter(seed,agent?.id,tick,kind),
  };
}

/** Kingdom changes profession when another productive job wins. Keep only a bounded career tail. */
function explicitAdventurer(transition){
  if(!transition||typeof transition!=='object'||Array.isArray(transition))return false;
  const keys=Object.keys(transition);
  return keys.length===2&&Object.hasOwn(transition,'qualifiedProfession')&&Object.hasOwn(transition,'qualification')&&transition.qualifiedProfession==='adventurer'&&transition.qualification==='explore-3';
}
export function adoptProfession(agent,kind,tick,transition){
  if(transition!==undefined){
    const ready=kind==='EXPLORE'&&explicitAdventurer(transition)&&agent?.adventurerQualification?.version===1&&agent.adventurerQualification.accepted===ADVENTURER_QUALIFICATION&&Number.isInteger(tick)&&tick>=0;
    if(!ready)return {changed:false,profession:isKingdomProfession(agent?.profession)?agent.profession:undefined};
    const previous=ensureProfession(agent,tick);
    if(previous==='adventurer')return {changed:false,profession:previous};
    agent.profession='adventurer';
    agent.professionSinceTick=tick;
    if(!Array.isArray(agent.career))agent.career=[];
    agent.career.push({tick,profession:'adventurer'});
    if(agent.career.length>8)agent.career.splice(0,agent.career.length-8);
    return {changed:true,previous,profession:'adventurer'};
  }
  const next=professionForAction(kind);
  if(!next)return {changed:false,profession:ensureProfession(agent,tick)};
  const previous=ensureProfession(agent,tick);
  if(previous==='adventurer'||previous===next)return {changed:false,profession:previous};
  agent.profession=next;
  agent.professionSinceTick=tick;
  if(!Array.isArray(agent.career))agent.career=[];
  agent.career.push({tick,profession:next});
  if(agent.career.length>8)agent.career.splice(0,agent.career.length-8);
  return {changed:true,previous,profession:next};
}

function blankQualification(){return {version:1,accepted:0,recent:[]};}
export function noteExploreCompletion(agent,fact){
  const accepted=agent?.adventurerQualification?.accepted??0;
  const skip={counted:false,accepted,career:null};
  if(!agent||fact?.kind!=='EXPLORE'||fact.alive!==true||fact.productive!==true)return skip;
  if(fact.knowledge!=='none'&&fact.knowledge!=='CONFIRMED')return skip;
  if(!Number.isInteger(fact.tick)||fact.tick<0||!Number.isInteger(fact.x)||fact.x<0||!Number.isInteger(fact.y)||fact.y<0||!Number.isInteger(fact.started)||fact.started<0||fact.started>fact.tick)return skip;
  if(!agent.adventurerQualification)agent.adventurerQualification=blankQualification();
  const q=agent.adventurerQualification;
  if(validateAdventurerQualification(agent,fact.tick).length)return {counted:false,accepted:q.accepted,career:null};
  const id=`${fact.started}:${fact.x}:${fact.y}`;
  if(q.recent.some(row=>row.id===id))return {counted:false,accepted:q.accepted,career:null};
  q.recent.push({id,tick:fact.tick,x:fact.x,y:fact.y});
  while(q.recent.length>QUALIFICATION_HISTORY)q.recent.shift();
  const previousAccepted=q.accepted;
  if(q.accepted<ADVENTURER_QUALIFICATION)q.accepted+=1;
  const career=previousAccepted<ADVENTURER_QUALIFICATION&&q.accepted===ADVENTURER_QUALIFICATION
    ?adoptProfession(agent,'EXPLORE',fact.tick,{qualifiedProfession:'adventurer',qualification:'explore-3'})
    :null;
  return {counted:true,accepted:q.accepted,career};
}
export function validateAdventurerQualification(agent,tick){
  const q=agent?.adventurerQualification;
  if(q===undefined)return [];
  const bad=['Adventurer qualification'];
  if(!q||q.version!==1||!Number.isInteger(q.accepted)||q.accepted<0||q.accepted>ADVENTURER_QUALIFICATION||!Array.isArray(q.recent)||q.recent.length>QUALIFICATION_HISTORY)return bad;
  if(q.accepted!==Math.min(ADVENTURER_QUALIFICATION,q.recent.length))return bad;
  const ids=new Set();
  for(const row of q.recent){
    if(!row||typeof row.id!=='string'||!Number.isInteger(row.tick)||row.tick<0||row.tick>tick||!Number.isInteger(row.x)||row.x<0||!Number.isInteger(row.y)||row.y<0||ids.has(row.id))return bad;
    const parts=row.id.split(':');
    if(parts.length!==3)return bad;
    const started=Number(parts[0]);
    if(!Number.isInteger(started)||String(started)!==parts[0]||started<0||started>row.tick||Number(parts[1])!==row.x||Number(parts[2])!==row.y)return bad;
    ids.add(row.id);
  }
  return [];
}
