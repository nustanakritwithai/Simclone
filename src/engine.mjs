import {isIndependent,materialStock,resourceStock,resourceAccount,foodStock,mealOwnerId,reservedMealsFor,materialTotals,personalTargets,guardianOf,ensureHouseholdResourceState,activateHouseholdStore,joinHouseholdResources} from './individual-resources.mjs?v=0.5.0';
import {INDEPENDENT_SAVE_VERSION,addPersonalStore,validateIndependentWorld} from './individual-resources.mjs?v=0.5.0';
import {initializeIndependentStart,independentSpawn} from './independent-start.mjs?v=0.5.0';
import {survivalHome,homeOf,individualHouses} from './individual-housing.mjs?v=0.5.0';
import {cultureCommand,stepCulture,validateCulture} from './cultural-archive.mjs?v=0.5.0';
import {setPlanningPolicy,personalResourceCandidates,personalExplorationTarget,rememberPlanSelection,recordPredictionReceipt,finishPersonalExploration,recordPlanProduction,validatePersonalPlanning} from './personal-planning.mjs?v=0.5.0';
import {verifyResourceKnowledge,ageKnowledge} from './knowledge-revision.mjs?v=0.5.0';
/** Simclone 0.5.0 — evidence-backed personal knowledge over skill provenance. */
import {RULES,RESOURCE_ACTIONS,tileAt,walkable,pathTo,routeField,routeTo,routeDistance,
  skillLevel,plannedStock,stockTargets,taskValid,reservations,claim,release,survivalSummary} from './survival.mjs?v=0.5.0';
import {LIFE,LIFE_STAGES,ageYears,ageYearsAtTick,lifeStage,adultLife,childLife,canPerformProductiveWork,productiveWorkRate,lifespanYears,shouldDieOfAge} from './lifecycle.mjs?v=0.5.0';
import {BIRTH_RULES,birthPlan,isAutonomousChild} from './reproduction.mjs?v=0.5.0';
import {ARCHIVE_VERSION,HISTORY_LIMITS,allPeople,findPerson,retainedCount,retentionPlan,compactRetired} from './history.mjs?v=0.5.0';
import {SKILL_PROVENANCE_VERSION,createSkillProvenance,createLegacySkillProvenance,recordEarnedSkill,validateSkillProvenance} from './skill-provenance.mjs?v=0.5.0';
import {ensureLeadershipSkill,LEADERSHIP_SKILL,leadershipProfile} from './leadership.mjs?v=0.5.0';
import {KNOWLEDGE_VERSION,KNOWLEDGE_LIMITS,BELIEF_STATUS,createKnowledgeState,recordResourceDiscovery,shareKnowledge,withinKnowledgeRange,validateKnowledgeState,activeKnowledge} from './knowledge.mjs?v=0.5.0';
import {professionForAction,professionLabel,ensureProfession,isKingdomProfession,kingdomWorkFactors,adoptProfession,noteExploreCompletion,validateAdventurerQualification} from './kingdom-utility.mjs?v=0.5.0';
import {ADVENTURE_SKILL,ensureAdventureProgressionSkill,inheritedAdventureXp,validateAdventureProgression} from './adventure-progression.mjs?v=0.5.0';
import {adventureProgressionSnapshot} from './adventure-progression.mjs?v=0.5.0';
import {findAdventureZoneEntry,createAdventureExpeditionTask,adventureExpeditionTaskValid,completeAdventureExpedition,findAdventureMonsterEngagement,createAdventureHuntTask,completeAdventureHunt,validateAdventureEncounterState,ADVENTURE_HUNT_AUTONOMOUS_POLICY} from './adventure-expedition.mjs?v=0.5.0';
import {startAdventureCombatSession,resolveAdventureCombatTurnProposal,validateAdventureCombatState} from './adventure-combat-session.mjs?v=0.5.0';
import {commitVerifiedAdventureCombatReward,validateAdventureCombatRewardState} from './adventure-combat-reward.mjs?v=0.5.0';
import {claimVerifiedAdventureLoot,validateAdventureLootClaimState} from './adventure-loot-commit.mjs?v=0.5.0';
import {laborAuthoritySignal} from './kingdom-labor-authority.mjs?v=0.5.0';
import {applyWorldResourceRegeneration} from './worldsim-resource-authority.mjs?v=0.5.0';
import {ensureRustState,rustCommand,placementPreview,pendingRustWork,advanceRustWork,rustToolMultiplier,rustGrantAdventureLoot,releaseRustOnDeath,validateRustState,rustSummary} from './rust-runtime.mjs?v=0.5.0';
import {housingCapacity,unfinishedHousing,evaluateModularHouses,pendingPlacements} from './housing.mjs?v=0.5.0';
import {pendingPersonalPlacements} from './individual-housing.mjs?v=0.5.0';
import {placementIdFor} from './rust-stations.mjs?v=0.5.0';
import {ensureProductionPlan,productionCommand,stepProductionPlanning,validateProductionPlan} from './production-planning.mjs?v=0.5.0';
import {ensureMentorshipState,mentorshipCommand,stepMentorship,endMentorshipsForAgent,validateMentorship} from './mentor-teaching.mjs?v=0.5.0';
import {ensureSocialState,recordRelationshipEvidence,relationshipOf,householdOf,allHouseholds,activeResidenceOf,validateSocialState} from './relationships.mjs?v=0.5.0';
import {householdResidenceCommand,endResidencesForAgent,residenceHome} from './household-residence.mjs?v=0.5.0';
import {stepHouseholdRecruitment} from './household-recruitment-authority.mjs?v=0.5.0';
import {householdCooperationSignal} from './household-cooperation.mjs?v=0.5.0';
import {ensureSettlementState,stepSettlementAuthority,validateSettlementState,allSettlementSnapshots} from './settlement-authority.mjs?v=0.5.0';
import {ensureGovernanceState,stepGovernanceAuthority,validateGovernanceState} from './governance-authority.mjs?v=0.5.0';
import {stepGovernancePolicy,governorPolicySignal} from './governance-policy.mjs?v=0.5.0';
import {outcomeLearningSignal} from './outcome-learning-authority.mjs?v=0.5.0';
import {actionPredictionEvidence} from './action-prediction-evidence.mjs?v=0.5.0';
import {LEGACY_WORLD_BOUNDS,boundsForProfile,persistedWorldBounds,worldBounds,worldCellCount,scaleLegacyPoint,scaleLegacyX,scaleLegacyY,validateWorldBoundsState} from './world-bounds.mjs?v=0.5.0';
import {regionalRiverCenter,regionalResourceDecision} from './world-regions.mjs?v=0.5.0';
import {expandLargeWorldToSameWorld,validateAdventureAnnexState} from './adventure-annex.mjs?v=0.5.0';
import {ensureWildMonsterWorld,validateWildMonsterWorld,wildMonsterById,engageWildMonster,commitWildMonsterCombatHp,releaseWildMonsterEngagement,defeatWildMonster,stepWildMonsterLifecycle,migrateWildMonsterLifecycleState} from './adventure-world-monsters.mjs?v=0.5.0';
import {autonomousAdventureIntent,chooseAutonomousAdventureTarget} from './adventure-autonomy.mjs?v=0.5.0';
export {ARCHIVE_VERSION,HISTORY_LIMITS,allPeople,findPerson,retainedCount,SKILL_PROVENANCE_VERSION,KNOWLEDGE_VERSION,KNOWLEDGE_LIMITS,BELIEF_STATUS,activeKnowledge};
export {evaluateModularHouses};
export {relationshipOf,householdOf,allHouseholds};
export {leadershipProfile};
export {allSettlementSnapshots};
export {tileAt,walkable,pathTo,survivalSummary,LIFE,LIFE_STAGES,ageYears,ageYearsAtTick,lifeStage,adultLife,childLife,canPerformProductiveWork,productiveWorkRate,lifespanYears,shouldDieOfAge,BIRTH_RULES,birthPlan,isAutonomousChild};
export const VERSION = '0.5.0';
export const SAVE_VERSION = '0.5.0';
export const PREVIOUS_SAVE_VERSION = '0.4.0';
export const HISTORY_ARCHIVE_SAVE_VERSION = '0.3.0';
export const DEATH_HISTORY_SAVE_VERSION = '0.2.0';
export const LEGACY_SAVE_VERSION = '0.1.0';
export const HISTORY_VERSION = '0.1.0';
const DEATH_STATUSES = new Set(['recorded','legacy-evidence','legacy-unknown']);
const DEATH_CAUSES = new Set(['age','starvation','unknown']);
/** Backward-compatible legacy default. Runtime systems must use worldBounds(state). */
export const SIZE = { w: LEGACY_WORLD_BOUNDS.w, h: LEGACY_WORLD_BOUNDS.h };
export const DAY_TICKS = LIFE.ticksPerYear;
export const SKILLS = ['FORAGE', 'WOODCUT', 'MINE', 'BUILD'];
export const SOCIAL_SKILLS = [LEADERSHIP_SKILL];
export const ADVENTURE_SKILLS = [ADVENTURE_SKILL];
export const ALL_SKILLS = [...SKILLS,...SOCIAL_SKILLS,...ADVENTURE_SKILLS];
export const LABELS = { FORAGE:'หาอาหาร', WOODCUT:'ตัดไม้', MINE:'ขุดหิน', BUILD:'สร้างบ้าน', CRAFT:'คราฟต์', PROCESS:'แปรรูป', EAT:'กินอาหาร', REST:'พักผ่อน', EXPLORE:'สำรวจ', IDLE:'พักรอ' };
export const clamp = (n, lo=0, hi=100) => Math.max(lo, Math.min(hi, n));
export const level = skillLevel;
const distance = (a,b) => Math.abs(a.x-b.x) + Math.abs(a.y-b.y);
const names = ['Original','Nira','Kira','Rin','Tao','Lume','Ari','Mira','Sol','Nova','Kai','Yuna'];
const palette = ['#dda35d','#71b6a0','#b791bc','#6e9fbf','#d77c69','#c5ba6b'];
function rng(s) { s.rng = (Math.imul(1664525,s.rng)+1013904223)>>>0; return s.rng/4294967296; }
function event(s,type,text,agentId=null) {
  const e={id:s.nextEvent++,tick:s.tick,type,text,agentId};
  s.events.push(e); if(s.events.length>120)s.events.shift();
  if(agentId){const a=s.agents.find(a=>a.id===agentId); if(a){a.memory.push({tick:s.tick,text});if(a.memory.length>8)a.memory.shift();}}
}
function createAgent(s,parent,initial=false,mode='manual'){
  const id=s.nextAgent++, k=id-1,autonomous=mode==='birth',bounds=worldBounds(s);
  const start=scaleLegacyPoint(bounds,9+k%4,11+Math.floor(k/4)%3);
  const skills=Object.fromEntries(SKILLS.map(key=>[key,parent?Math.floor(parent.skills[key]*.35):60]));
  if(isIndependent(s))skills[LEADERSHIP_SKILL]=parent?Math.floor(Number(parent.skills?.[LEADERSHIP_SKILL]??0)*.35):0;
  if(isIndependent(s))skills[ADVENTURE_SKILL]=parent?inheritedAdventureXp(parent):0;
  const preference=SKILLS[k%4],profession=professionForAction(preference);
  const skillProvenance=createSkillProvenance(id,skills,{kind:parent?'inheritance':'initial',sourceAgentId:parent?.id??null,tick:s.tick});
  const a={id,name:names[k%names.length]+(k>=names.length?' '+id:''),parentId:parent?.id??null,generation:parent?parent.generation+1:0,
    x:start.x,y:start.y,hp:100,satiety:85,energy:90,alive:true,death:null,
    appearance:{coat:palette[k%palette.length],skin:['#e5b38a','#c99064','#f1c9a6','#a97050'][k%4],hair:['#302a28','#5e3e2c','#d5ad6f','#312e3b'][k%4],style:k%3},
    preference,profession,professionSinceTick:s.tick,career:[{tick:s.tick,profession}],skills,skillProvenance,knowledgeState:createKnowledgeState(),source:parent?(autonomous?'สืบทอดเมื่อเกิดจาก '+parent.name:'Clone จาก '+parent.name):'ความรู้เริ่มต้นของ Original',
    memory:[],task:null,trace:[],moveTick:0,workDone:0,bornTick:s.tick,life:autonomous?childLife(s.tick):adultLife(s.tick)};
  if(parent){a.x=parent.x;a.y=parent.y;}
  if(initial&&parent){const p=scaleLegacyPoint(bounds,9+k%4,10+Math.floor(k/4)*2);a.x=p.x;a.y=p.y;a.satiety=65+k*3;a.energy=72+k*3;}
  s.agents.push(a);
  if(isIndependent(s))addPersonalStore(s,a);
  event(s,'birth',parent?(autonomous?a.name+' เกิดจาก '+parent.name+' · รุ่น '+a.generation:a.name+' ถูกสร้างจาก '+parent.name+' · รุ่น '+a.generation):'Original เข้าสู่โลกใหม่',id);
  return a;
}
function attemptAutonomousBirth(s){
  const {book}=reservations(s),freeFood=isIndependent(s)?0:Math.max(0,s.stock.food-book.meals.size),plan=birthPlan(s,freeFood);
  if(!plan.ok)return null;
  const parent=s.agents.find(a=>a.id===plan.parentId&&a.alive);
  if(!parent||!compactRetired(s).ok)return null;
  const funds=resourceStock(s,parent);funds.food-=BIRTH_RULES.foodCost;funds.wood-=BIRTH_RULES.woodCost;
  return createAgent(s,parent,false,'birth');
}
function killAgent(s,a,cause){
  if(!a.alive)return false;
  const deathAge=ageYearsAtTick(s,a,s.tick);
  a.death={status:'recorded',tick:s.tick,cause,ageYears:deathAge};
  const bound=a.adventureCombat?.worldMonsterId?wildMonsterById(s,a.adventureCombat.worldMonsterId):null;
  if(bound?.status==='ENGAGED'&&bound.engagedByAgentId===a.id&&bound.hpCurrent>0)releaseWildMonsterEngagement(s,bound.worldMonsterId,a.id);
  a.alive=false;a.hp=0;a.task=null;a.moveTick=0;a.adventureEncounter=null;a.adventureCombat=null;releaseRustOnDeath(s,a);endMentorshipsForAgent(s,a.id,'death');endResidencesForAgent(s,a.id,'death');
  const text=cause==='age'
    ?a.name+' เสียชีวิตตามวัยเมื่ออายุ '+(deathAge??'ไม่ทราบ')+' ปี'
    :a.name+' เสียชีวิตจากการขาดอาหารเมื่ออายุ '+(deathAge??'ไม่ทราบ')+' ปี';
  event(s,'death',text,a.id);return true;
}
export function createWorld(seed=230926,options={}){
  const independent=options.mode==='independent',population=independent?(options.population??6):6;
  if(options.mode!==undefined&&!['legacy','independent'].includes(options.mode))throw new Error('Unsupported world mode');
  if(!Number.isInteger(population)||population<1||population>6)throw new Error('Starting population must be 1..6');
  const profile=options.worldProfile??'legacy';
  if(profile==='same-world'){
    boundsForProfile(profile);
    const core=createWorld(seed,{...options,worldProfile:'large'});
    expandLargeWorldToSameWorld(core);
    ensureWildMonsterWorld(core);
    return core;
  }
  const bounds=boundsForProfile(profile),large=profile==='large';
  const camp=scaleLegacyPoint(bounds,11,12),shelter=scaleLegacyPoint(bounds,8,9),storedBounds=persistedWorldBounds(profile);
  const s={version:SAVE_VERSION,historyVersion:HISTORY_VERSION,archiveVersion:ARCHIVE_VERSION,archive:[],seed:seed>>>0,rng:seed>>>0,tick:0,nextAgent:1,nextEvent:1,nextBuilding:3,tiles:[],nodes:[],agents:[],events:[],
    ...(storedBounds?{worldBounds:storedBounds}:{}),
    stock:{food:28,wood:24,stone:12},buildings:[{id:1,type:'camp',x:camp.x,y:camp.y,complete:true,progress:30},{id:2,type:'shelter',x:shelter.x,y:shelter.y,complete:true,progress:30}],stats:{gathered:0,built:0,cloned:0}};
  ensureRustState(s);ensureProductionPlan(s);ensureMentorshipState(s);ensureSocialState(s);ensureHouseholdResourceState(s);
  let nid=1;
  const riverWidth=large?6:3;
  const bridgeStart=scaleLegacyY(bounds,13),bridgeEnd=scaleLegacyY(bounds,14);
  const roadY=scaleLegacyY(bounds,13),roadX=scaleLegacyX(bounds,11);
  const roadXMin=scaleLegacyX(bounds,6),roadXMax=scaleLegacyX(bounds,27),roadYMin=scaleLegacyY(bounds,7),roadYMax=scaleLegacyY(bounds,18);
  const campMin=scaleLegacyPoint(bounds,7,8),campMax=scaleLegacyPoint(bounds,15,17);
  for(let y=0;y<bounds.h;y++)for(let x=0;x<bounds.w;x++){
    const river=large?regionalRiverCenter(bounds,y):20+Math.round(Math.sin(y*.26)*2),wet=x>=river&&x<river+riverWidth;
    const bridge=wet&&y>=bridgeStart&&y<=bridgeEnd;
    const road=!independent&&((Math.abs(y-roadY)<1&&x>roadXMin&&x<roadXMax)||(Math.abs(x-roadX)<1&&y>roadYMin&&y<roadYMax));
    s.tiles.push(bridge?'bridge':wet?'water':road?'path':'grass');
    const r=rng(s),inCamp=!independent&&x>=campMin.x&&x<=campMax.x&&y>=campMin.y&&y<=campMax.y;
    if(large){
      const decision=regionalResourceDecision(s.seed,bounds,x,y,{blocked:wet||road||inCamp});
      if(decision.spawn){
        const type=decision.type;
        s.nodes.push({id:nid++,type,x,y,amount:type==='stone'?70:35,max:type==='stone'?70:35});
      }
    }else if(!wet&&!road&&!inCamp&&r<.23){
      const type=r<.14?'wood':r<.19?'food':'stone';
      s.nodes.push({id:nid++,type,x,y,amount:type==='stone'?70:35,max:type==='stone'?70:35});
    }
  }
  if(!independent)for(const [type,lx,ly] of [['food',6,12],['food',8,18],['wood',6,9],['wood',15,7],['stone',15,16]]){
    const p=scaleLegacyPoint(bounds,lx,ly);s.nodes.push({id:nid++,type,x:p.x,y:p.y,amount:45,max:45});
  }
  const original=createAgent(s,null);for(let i=1;i<population;i++)createAgent(s,original,true);
  if(independent){initializeIndependentStart(s,walkable);ensureSettlementState(s);ensureGovernanceState(s);for(const a of s.agents){ensureLeadershipSkill(a,{tick:s.tick});ensureAdventureProgressionSkill(a,{tick:s.tick});}setPlanningPolicy(s,'local');}
  return s;
}
export const living = s => s.agents.filter(a=>a.alive);
// Housing capacity has one definition: src/housing.mjs (camp + legacy shelters + complete modular houses).
export const capacity = housingCapacity;
/** UI placement preview: the same validator the executor re-runs, read-only on the live state. */
export const previewPlacement = (s,data) => placementPreview(s,data,walkable);
export const day = s => 1+Math.floor(s.tick/DAY_TICKS);
export const hour = s => (8+Math.floor(s.tick/15))%24;
export function command(s,type,data={}){
  const residence=householdResidenceCommand(s,type,data);if(residence){if(residence.ok&&residence.changed)event(s,'household',residence.message,residence.agentId??null);return residence;}
  const mentorship=mentorshipCommand(s,type,data);if(mentorship){
    if(mentorship.ok&&mentorship.changed){
      event(s,'mentor',mentorship.message,mentorship.mentorId??null);
      if(type==='CREATE_MENTOR_LINK'){
        recordRelationshipEvidence(s,{fromId:mentorship.studentId,toId:mentorship.mentorId,kind:'mentor-link',key:'mentor:'+mentorship.linkId+':student',delta:{respect:8,trust:2},ref:'mentor-link:'+mentorship.linkId});
        recordRelationshipEvidence(s,{fromId:mentorship.mentorId,toId:mentorship.studentId,kind:'mentor-link',key:'mentor:'+mentorship.linkId+':mentor',delta:{affinity:2},ref:'mentor-link:'+mentorship.linkId});
      }
    }
    return mentorship;
  }
  const production=productionCommand(s,type,data);if(production)return production;
  const rust=rustCommand(s,type,data,walkable);
  if(rust){
    // stats.built counts houses that a Clone actually finishes: once, on the completing placement.
    if(type==='PLACE_STATION'&&rust.ok&&rust.completedHouse){
      const a=s.agents.find(a=>a.id===data.agentId);s.stats.built++;
      event(s,'build',(a?a.name+' ':'')+(isIndependent(s)?'สร้างบ้านส่วนตัวสำเร็จ':'สร้างบ้านสำเร็จ · ที่พักเพิ่ม 6 คน'),a?.id??null);
    }
    return rust;
  }
  const cultural=cultureCommand(s,type,data);if(cultural)return cultural;
  if(type==='SET_PLANNING_POLICY')return setPlanningPolicy(s,data.policy);
  if(type==='START_ADVENTURE_EXPEDITION'){
    if(!isIndependent(s))return {ok:false,reason:'mode',message:'Adventure expedition requires Independent world'};
    const a=s.agents.find(a=>a.id===data.agentId&&a.alive);
    if(!a)return {ok:false,reason:'agent',message:'เลือก Clone ที่ยังมีชีวิตก่อน'};
    if(a.profession!=='adventurer')return {ok:false,reason:'profession',message:'ต้องเป็นนักผจญภัยก่อน'};
    if(!canPerformProductiveWork(s,a))return {ok:false,reason:'stage',message:'ยังออกผจญภัยไม่ได้'};
    if(a.task)return {ok:false,reason:'busy',message:'Clone กำลังทำงานอื่นอยู่'};
    if(a.adventureEncounter)return {ok:false,reason:'encounter-pending',message:'มี encounter ที่ยังไม่จบ'};
    if(a.adventureCombat)return {ok:false,reason:'combat-pending',message:'มี combat ที่ยังไม่จบ'};
    if(a.satiety<RULES.hungry)return {ok:false,reason:'hungry',message:'หิวเกินไปสำหรับการออกผจญภัย'};
    if(a.energy<RULES.exhausted)return {ok:false,reason:'exhausted',message:'เหนื่อยเกินไปสำหรับการออกผจญภัย'};
    const progression=adventureProgressionSnapshot(a);
    if(!progression)return {ok:false,reason:'progression',message:'Adventure progression ไม่ถูกต้อง'};
    let entry;
    try{entry=findAdventureZoneEntry(s,a,data.zoneId,progression.level,{walkable,routeField,routeDistance});}
    catch(error){return {ok:false,reason:error.message,message:'เข้าเขตผจญภัยไม่ได้'};}
    const path=pathTo(s,a,entry);
    if(!path)return {ok:false,reason:'no-path',message:'ไม่มีเส้นทางเดินไปเขตศิลา'};
    a.task=createAdventureExpeditionTask(s,a,data.zoneId,progression.level,entry,path);
    a.moveTick=0;
    event(s,'adventure',a.name+' ออกเดินทางสู่ '+data.zoneId,a.id);
    return {ok:true,agentId:a.id,zoneId:data.zoneId,target:{x:entry.x,y:entry.y},pathLength:path.length};
  }
  if(type==='START_ADVENTURE_HUNT'){
    if(!isIndependent(s))return {ok:false,reason:'mode',message:'Adventure hunt requires Independent world'};
    const a=s.agents.find(a=>a.id===data.agentId&&a.alive);
    if(!a)return {ok:false,reason:'agent',message:'เลือก Clone ที่ยังมีชีวิตก่อน'};
    if(a.profession!=='adventurer')return {ok:false,reason:'profession',message:'ต้องเป็นนักผจญภัยก่อน'};
    if(!canPerformProductiveWork(s,a))return {ok:false,reason:'stage',message:'ยังออกล่ามอนสเตอร์ไม่ได้'};
    const monster=wildMonsterById(s,data.worldMonsterId);
    if(!monster||monster.status!=='IDLE'||monster.hpCurrent<=0)return {ok:false,reason:'monster-unavailable',message:'มอนสเตอร์ตัวนี้ไม่พร้อม'};
    if(a.task)return {ok:false,reason:'busy',message:'Clone กำลังทำงานอื่นอยู่'};
    if(a.adventureEncounter)return {ok:false,reason:'encounter-pending',message:'มี encounter ที่ยังไม่จบ'};
    if(a.adventureCombat)return {ok:false,reason:'combat-pending',message:'มี combat ที่ยังไม่จบ'};
    if(a.satiety<RULES.hungry)return {ok:false,reason:'hungry',message:'หิวเกินไปสำหรับการล่า'};
    if(a.energy<RULES.exhausted)return {ok:false,reason:'exhausted',message:'เหนื่อยเกินไปสำหรับการล่า'};
    const claimed=s.agents.some(other=>other.alive&&other.id!==a.id&&(
      other.task?.adventureHunt?.worldMonsterId===monster.worldMonsterId||
      other.adventureEncounter?.worldMonsterId===monster.worldMonsterId||
      (other.adventureCombat?.worldMonsterId===monster.worldMonsterId&&other.adventureCombat.status==='ACTIVE')
    ));
    if(claimed)return {ok:false,reason:'monster-busy',message:'มอนสเตอร์ตัวนี้มีนักผจญภัยกำลังเข้าหาอยู่'};
    const progression=adventureProgressionSnapshot(a);
    if(!progression)return {ok:false,reason:'progression',message:'Adventure progression ไม่ถูกต้อง'};
    if(data.control==='autonomous'){
      const expected=chooseAutonomousAdventureTarget(s,a);
      if(!expected||expected.worldMonsterId!==monster.worldMonsterId)return {ok:false,reason:'target-policy',message:'AI ต้องเลือกมอนสเตอร์ตามระดับ Adventure ก่อน'};
    }
    let engagement;
    try{engagement=findAdventureMonsterEngagement(s,a,monster.worldMonsterId,progression.level,{walkable,routeField,routeDistance});}
    catch(error){return {ok:false,reason:error.message,message:'เดินไปหามอนสเตอร์ไม่ได้'};}
    const path=pathTo(s,a,engagement);
    if(!path)return {ok:false,reason:'no-path',message:'ไม่มีเส้นทางเดินไปหามอนสเตอร์'};
    a.task=createAdventureHuntTask(s,a,monster.worldMonsterId,progression.level,engagement,path,{control:data.control==='autonomous'?'autonomous':null,targetPolicy:data.control==='autonomous'?ADVENTURE_HUNT_AUTONOMOUS_POLICY:null});
    a.moveTick=0;
    event(s,'adventure',a.name+' ออกล่า '+monster.monsterId+' ที่ '+monster.zoneId,a.id);
    return {ok:true,agentId:a.id,worldMonsterId:monster.worldMonsterId,zoneId:monster.zoneId,target:{x:engagement.x,y:engagement.y},monster:{x:monster.x,y:monster.y},pathLength:path.length};
  }
  if(type==='START_ADVENTURE_COMBAT'){
    if(!isIndependent(s))return {ok:false,reason:'mode',message:'Adventure combat requires Independent world'};
    const a=s.agents.find(a=>a.id===data.agentId&&a.alive);
    if(!a)return {ok:false,reason:'agent',message:'เลือก Clone ที่ยังมีชีวิตก่อน'};
    if(a.profession!=='adventurer')return {ok:false,reason:'profession',message:'ต้องเป็นนักผจญภัยก่อน'};
    if(a.task)return {ok:false,reason:'busy',message:'Clone ยังมี task อยู่'};
    if(a.adventureCombat)return {ok:false,reason:'combat-pending',message:'มี combat ที่ยังไม่จบ'};
    if(a.adventureEncounter?.status!=='READY')return {ok:false,reason:'encounter',message:'ยังไม่มี encounter พร้อมต่อสู้'};
    let session;
    try{session=startAdventureCombatSession(s,a,a.adventureEncounter);}
    catch(error){return {ok:false,reason:error.message,message:'เริ่ม combat ไม่ได้'};}
    if(session.worldMonsterId){
      try{engageWildMonster(s,session.worldMonsterId,a.id,a.adventureEncounter);}
      catch(error){return {ok:false,reason:error.message,message:'ผูก combat กับ world monster ไม่ได้'};}
    }
    a.adventureCombat=session;
    a.adventureEncounter=null;
    const boundMonster=session.worldMonsterId?wildMonsterById(s,session.worldMonsterId):null;
    event(s,'adventure',a.name+' เริ่มต่อสู้กับ '+session.monsterId+' Lv.'+session.monsterLevel,a.id);
    return {ok:true,combatId:session.combatId,turn:session.turn,status:session.status,worldMonsterId:session.worldMonsterId??null,
      monsterHpCurrent:boundMonster?.hpCurrent??session.monsterHpCurrent,monsterHpMax:session.monsterHpMax};
  }
  if(type==='ADVENTURE_COMBAT_ACTION'){
    const a=s.agents.find(a=>a.id===data.agentId&&a.alive);
    if(!a)return {ok:false,reason:'agent',message:'เลือก Clone ที่ยังมีชีวิตก่อน'};
    const session=a.adventureCombat;
    if(!session||session.status!=='ACTIVE')return {ok:false,reason:'combat',message:'ไม่มี combat ที่กำลังดำเนินอยู่'};
    if(data.action!=='BASIC_ATTACK')return {ok:false,reason:'action',message:'I3 รองรับ BASIC_ATTACK เท่านั้น'};
    if(!Number.isSafeInteger(data.expectedTurn)||data.expectedTurn!==session.turn)return {ok:false,reason:'stale-turn',message:'combat turn ไม่ตรงกับ state ปัจจุบัน'};
    let proposal;
    try{proposal=resolveAdventureCombatTurnProposal(s,a,session,{action:'BASIC_ATTACK'});}
    catch(error){return {ok:false,reason:error.message,message:'resolve combat ไม่ได้'};}
    const bound=session.worldMonsterId?wildMonsterById(s,session.worldMonsterId):null;
    const worldBefore=bound?{hpCurrent:bound.hpCurrent,status:bound.status,engagedByAgentId:bound.engagedByAgentId,defeatedTick:bound.defeatedTick,respawnTick:bound.respawnTick}:null;
    let reward={changed:false,evidence:'OUTCOME_UNKNOWN',xpAward:0,session:proposal.session};
    try{
      if(bound){
        commitWildMonsterCombatHp(s,session.worldMonsterId,a.id,{expectedBefore:proposal.monsterHpBefore,hpAfter:proposal.monsterHpAfter});
        if(proposal.session.status==='DEFEATED')releaseWildMonsterEngagement(s,session.worldMonsterId,a.id);
      }
      if(proposal.session.status!=='ACTIVE')reward=commitVerifiedAdventureCombatReward(a,proposal.session,s.tick);
      if(bound&&proposal.session.status==='VICTORY')defeatWildMonster(s,session.worldMonsterId,a.id,s.tick);
    }catch(error){
      if(bound&&worldBefore){bound.hpCurrent=worldBefore.hpCurrent;bound.status=worldBefore.status;bound.engagedByAgentId=worldBefore.engagedByAgentId;bound.defeatedTick=worldBefore.defeatedTick;bound.respawnTick=worldBefore.respawnTick;}
      return {ok:false,reason:error.message,message:bound?'commit world combat ไม่ได้':'verify combat outcome ไม่ได้'};
    }
    a.hp=proposal.agentHpAfter;
    a.adventureCombat=reward.session;
    const combatState=a.adventureCombat.status,currentMonster=session.worldMonsterId?wildMonsterById(s,session.worldMonsterId):null;
    if(combatState==='VICTORY')event(s,'adventure',a.name+' ชนะ '+a.adventureCombat.monsterId+(reward.xpAward?' · +'+reward.xpAward+' Adventure XP':''),a.id);
    else if(combatState==='DEFEATED')event(s,'adventure',a.name+' พ่ายแพ้ต่อ '+a.adventureCombat.monsterId,a.id);
    return {ok:true,combatId:a.adventureCombat.combatId,turn:a.adventureCombat.turn,status:combatState,worldMonsterId:a.adventureCombat.worldMonsterId??null,
      agentHp:a.hp,monsterHpCurrent:currentMonster?.hpCurrent??a.adventureCombat.monsterHpCurrent,monsterHpMax:a.adventureCombat.monsterHpMax,
      heroDamage:proposal.heroOutcome.damage,counterDamage:proposal.counterOutcome?.damage??0,
      outcomeEvidence:reward.evidence,xpAwarded:reward.xpAward};
  }
  if(type==='CLAIM_ADVENTURE_LOOT'){
    const a=s.agents.find(a=>a.id===data.agentId&&a.alive);
    if(!a)return {ok:false,reason:'agent',message:'เลือก Clone ที่ยังมีชีวิตก่อน'};
    if(a.adventureCombat?.status!=='VICTORY')return {ok:false,reason:'victory',message:'ต้องชนะ combat ก่อน'};
    let claimed;
    try{claimed=claimVerifiedAdventureLoot(s,a,a.adventureCombat,{grantRust:rustGrantAdventureLoot});}
    catch(error){return {ok:false,reason:error.message,message:'รับ loot ไม่ได้'};}
    a.adventureCombat=claimed.session;
    if(claimed.changed)event(s,'adventure',a.name+' ได้ loot '+claimed.itemIds.length+' ชิ้น',a.id);
    return {ok:true,changed:claimed.changed,duplicate:claimed.duplicate,claimKey:claimed.claimKey,itemIds:claimed.itemIds,bagged:claimed.bagged,dropped:claimed.dropped};
  }
  if(type==='FINISH_ADVENTURE_RESULT'){
    const a=s.agents.find(a=>a.id===data.agentId&&a.alive);
    if(!a)return {ok:false,reason:'agent',message:'เลือก Clone ที่ยังมีชีวิตก่อน'};
    const session=a.adventureCombat;
    if(!session||!['VICTORY','DEFEATED'].includes(session.status))return {ok:false,reason:'terminal',message:'ยังไม่มีผลการต่อสู้ที่ปิดได้'};
    if(session.status==='VICTORY'&&session.reward?.evidence!=='VERIFIED')return {ok:false,reason:'reward',message:'หลักฐานรางวัลยังไม่พร้อม'};
    const skippedLoot=session.status==='VICTORY'&&!session.lootClaim;
    const worldMonsterId=session.worldMonsterId??null,combatId=session.combatId,status=session.status;
    a.adventureCombat=null;
    event(s,'adventure',a.name+' จบผลการต่อสู้ '+status+(skippedLoot?' · ไม่รับ loot':'') ,a.id);
    return {ok:true,combatId,status,worldMonsterId,skippedLoot};
  }
  if(type==='CLONE'){
    const parent=s.agents.find(a=>a.id===data.parentId&&a.alive);
    if(!parent)return {ok:false,message:'เลือก Clone ที่ยังมีชีวิตก่อน'};
    if(living(s).length>=(isIndependent(s)?36:Math.min(36,capacity(s))))return {ok:false,message:'ที่พักเต็มแล้ว สร้างบ้านให้เสร็จก่อน'};
    const retention=retentionPlan(s);
    if(!retention.ok)return {ok:false,reason:retention.reason,message:'พื้นที่ประวัติตัวละครเต็ม · หยุดเพิ่มคนโดยไม่ลบบรรพบุรุษ'};
    const funds=resourceStock(s,parent),book=reservations(s).book;
    const freeFood=isIndependent(s)?Math.max(0,funds.food-reservedMealsFor(s,parent.id,book.meals)):survivalSummary(s).freeFood;
    if(freeFood<8||funds.wood<4)return {ok:false,message:'ต้องมีอาหารว่าง 8 และไม้ 4 · อาหารที่จองไว้ให้คนกินไม่นับเป็นอาหารว่าง'};
    const spawn=isIndependent(s)?independentSpawn(s,walkable,living(s)):null;
    if(isIndependent(s)&&!spawn)return {ok:false,reason:'no-spawn',message:'ไม่มีจุดเริ่มชีวิตแยกที่ปลอดภัย'};
    if(!compactRetired(s).ok)return {ok:false,reason:'history-storage',message:'เก็บประวัติเพิ่มไม่ได้ · ไม่หักทรัพยากรและไม่ลบประวัติเดิม'};
    funds.food-=8;funds.wood-=4;s.stats.cloned++;
    const a=createAgent(s,parent);if(spawn){a.x=spawn.x;a.y=spawn.y;}return {ok:true,message:'สร้าง '+a.name+' แล้ว · สืบทักษะ 35% จาก '+parent.name,agentId:a.id};
  }
  if(type==='VERIFY_KNOWLEDGE'){
    const verifier=s.agents.find(a=>a.id===data.agentId&&a.alive);
    const priorClaim=verifier?.knowledgeState?.beliefs?.find(b=>b.key===data.key);
    const sourceAgentId=priorClaim?.sourceAgentId??null;
    const result=verifyResourceKnowledge(s,data.agentId,data.key);
    if(result.ok&&result.changed&&result.reason==='locally-observed'&&Number.isSafeInteger(sourceAgentId)&&sourceAgentId!==data.agentId)
      recordRelationshipEvidence(s,{fromId:data.agentId,toId:sourceAgentId,kind:'verified-knowledge',key:'verified:'+data.agentId+':'+sourceAgentId+':'+data.key,delta:{trust:4},ref:data.key});
    const messages={actor:'เลือกผู้ตรวจสอบที่ยังมีชีวิต',knowledge:'ตัวละครยังไม่เคยรับรู้ข้อมูลนี้',
      'out-of-range':'ต้องอยู่ห่างจากตำแหน่งที่รู้ไม่เกิน 4 ช่อง',
      'locally-observed':'ตรวจพบแหล่งทรัพยากรแล้ว · ยืนยันด้วยการสังเกตตรง',
      'temporarily-depleted':'แหล่งนี้หมดชั่วคราว · ข้อมูลเก่า ไม่ได้แปลว่าผู้ส่งโกหก',
      'not-at-observed-location':'ตรวจตำแหน่งนี้แล้ว ไม่พบแหล่งที่ระบุ',
      'different-resource':'สิ่งที่พบไม่ตรงกับข้อมูลเดิม'};
    return {...result,message:messages[result.reason]??'ตรวจสอบข้อมูลไม่ได้'};
  }
  if(type==='SHARE_KNOWLEDGE'){
    const sender=s.agents.find(a=>a.id===data.fromId&&a.alive);
    if(!sender)return {ok:false,message:'เลือกผู้ส่งที่ยังมีชีวิตก่อน'};
    const receiver=data.toId!=null
      ?s.agents.find(a=>a.id===data.toId&&a.alive)
      :s.agents.filter(a=>a.alive&&a.id!==sender.id&&withinKnowledgeRange(sender,a))
        .sort((a,b)=>distance(sender,a)-distance(sender,b)||a.id-b.id)[0];
    if(!receiver||sender.id===receiver.id)return {ok:false,message:'ไม่มีผู้รับที่ยังมีชีวิตในระยะสื่อสาร'};
    if(!withinKnowledgeRange(sender,receiver))return {ok:false,message:'อยู่ไกลเกินระยะสื่อสารความรู้'};
    const result=shareKnowledge(sender,receiver,data.key,s.tick);
    if(!result.ok)return {ok:false,message:'ผู้ส่งยังไม่มีความรู้นี้ยืนยันจากประสบการณ์ตรง'};
    event(s,'knowledge',sender.name+' ถ่ายทอด '+data.key+' ให้ '+receiver.name,sender.id);
    if(result.changed!==false){
      const shared='share:'+sender.id+':'+receiver.id+':'+data.key+':'+s.tick;
      recordRelationshipEvidence(s,{fromId:sender.id,toId:receiver.id,kind:'knowledge-share',key:shared+':sender',delta:{affinity:1},ref:data.key});
      recordRelationshipEvidence(s,{fromId:receiver.id,toId:sender.id,kind:'knowledge-share',key:shared+':receiver',delta:{affinity:1},ref:data.key});
    }
    return {ok:true,message:'ถ่ายทอดความรู้ให้ '+receiver.name+' แล้ว',fromId:sender.id,toId:receiver.id,key:data.key};
  }
  // Shelter BUILD is removed: modular pieces (PLACE_STATION) are the only construction system.
  // Rejected before any read of the payload, so there is never a mutation. Unfinished shelters
  // already in old saves are still finished by BUILD workers below (no refund, no second charge).
  if(type==='BUILD')return {ok:false,reason:'shelter-removed',message:'ระบบบ้านพัก (Shelter) ถูกถอดแล้ว · สร้างบ้านจากฐาน ผนัง ประตู และหลังคาไม้แทน'};
  return {ok:false,message:'ไม่รู้จักคำสั่งนี้'};
}
/** One reachable destination per job family; busy nodes never hide a free alternative. */
function candidates(s,a,book,field){
  ensureProfession(a,s.tick);
  const independent=isIndependent(s),stock=resourceStock(s,a),meal=foodStock(s,a),guardian=independent?guardianOf(s,a):null;
  const out=[],targets=stockTargets(s,a),projected=plannedStock(s,book,a),freeFood=meal.food-reservedMealsFor(s,mealOwnerId(s,a),book.meals);
  const productive=canPerformProductiveWork(s,a);
  const compare=(x,y)=>routeDistance(field,x)-routeDistance(field,y)||x.id-y.id;
  const homes=s.buildings.filter(b=>b.complete&&routeDistance(field,b)>=0).sort(compare),unfinished=unfinishedHousing(s);
  const home=independent?(residenceHome(s,a)??survivalHome(s,a)):homes[0];
  function add(kind,target,base,need=0,goal=0,status='candidate',extra={}){
    const travel=routeDistance(field,target),skillKind=extra.purposeKind??kind,skill=SKILLS.includes(skillKind)?level(a.skills[skillKind])*3:0;
    const laborMarket=Number(extra.laborAuthority?.bonus??0);
    const householdCooperation=Number(extra.householdCooperation?.bonus??0);
    const governorPolicy=Number(extra.governorPolicy?.bonus??0);
    const emergency=a.satiety<RULES.hungry||a.energy<RULES.exhausted;
    const outcomeLearning=Number(outcomeLearningSignal(s,a,kind,{emergency}).bonus??0);
    // Information-seeking must outrank doing nothing even when its waypoint is far.
    // Only the optional personal planner bounds this soft cost; execution still
    // pays the full route and hunger/energy interruptions remain authoritative.
    const distanceCost=extra.informationSeeking?Math.min(travel,8):travel;
    const factors={base,need:Math.round(need),goal,skill,distance:travel<0?0:-Math.round(distanceCost*.7),
      ...(laborMarket?{laborMarket}: {}),...(householdCooperation?{householdCooperation}: {}),...(governorPolicy?{governorPolicy}: {}),
      ...(outcomeLearning?{outcomeLearning}: {})};
    out.push({kind,targetId:target.id??null,x:target.x,y:target.y,
      score:Object.values(factors).reduce((sum,v)=>sum+v,0),factors,travelSteps:Math.max(0,travel),
      status:travel<0?'no-path':status,...extra});
  }
  const rustWork=pendingRustWork(s,a);
  if(rustWork)add(rustWork.kind,{...rustWork,id:rustWork.orderId},90,0,0,productive?'candidate':'stage',{rustOrderId:rustWork.orderId,rustLabel:rustWork.label});
  if(a.satiety<82&&meal.food>0&&(independent||home)){
    const fieldEat=independent&&!guardian&&(!home||a.satiety<RULES.hungry&&routeDistance(field,home)>8);
    const target=independent?(guardian??(fieldEat?a:home)):home;
    add('EAT',target,0,(100-a.satiety)*1.25+(a.satiety<RULES.hungry?180:0),0,freeFood>0?'candidate':'reserved',independent?{mealOwnerId:mealOwnerId(s,a),guardianId:guardian?.id??null,homeId:home?.houseId??null,fieldEat}:{});
  }
  if(a.energy<85){
    const fieldRest=!home||(a.energy<RULES.exhausted&&routeDistance(field,home)>8);
    add('REST',fieldRest?a:home,0,(100-a.energy)*1.2+(a.energy<RULES.exhausted?80:0),0,'candidate',{fieldRest,...(independent?{homeId:home?.houseId??null}:{})});
  }
  for(const [kind,type] of Object.entries(RESOURCE_ACTIONS)){
    const all=personalResourceCandidates(s,a,type);
    const reachable=all.filter(n=>routeDistance(field,n)>=0).sort(compare);
    const available=reachable.filter(n=>n.perception==='memory'||!book.nodes.has(n.id));
    const target=available[0]??reachable[0]??all[0];if(!target)continue;
    const hungerBonus=kind==='FORAGE'&&a.satiety<RULES.hungry&&freeFood<=0?210:0;
    const shortage=projected[type]<targets[type]/2?40:18;
    const kingdom=kingdomWorkFactors({seed:s.seed,tick:s.tick,agent:a,kind,resourceType:type,projected,targets});
    const emergency=a.satiety<RULES.hungry||a.energy<RULES.exhausted;
    const laborAuthority=laborAuthoritySignal({kind,agent:a,agents:s.agents,stock,unfinished,emergency});
    const householdCooperation=householdCooperationSignal(s,a,kind,{emergency});
    const governorPolicy=governorPolicySignal(s,a,kind,{emergency});
    const status=!productive?'stage':reachable.length===0?'no-path':available.length===0?'reserved':projected[type]>=targets[type]&&!hungerBonus&&!householdCooperation.active&&!governorPolicy.active?'satisfied':'candidate';
    add(target.perception==='memory'?'EXPLORE':kind,target,25,shortage+hungerBonus,a.preference===kind?15:0,status,{kingdomUtility:kingdom,laborAuthority,householdCooperation,governorPolicy,
      ...(target.perception?{purposeKind:kind,perception:target.perception,...(target.knowledgeKey?{knowledgeKey:target.knowledgeKey}:{})}: {})});
  }
  for(const b of s.buildings.filter(b=>!b.complete)){
    const kingdom=kingdomWorkFactors({seed:s.seed,tick:s.tick,agent:a,kind:'BUILD',scarcityOverride:18});
    const laborAuthority=laborAuthoritySignal({kind:'BUILD',agent:a,agents:s.agents,stock,unfinished,emergency:a.satiety<RULES.hungry||a.energy<RULES.exhausted});
    add('BUILD',b,56,0,a.preference==='BUILD'?18:0,!productive?'stage':(book.buildings.get(b.id)?.size??0)<RULES.builders?'candidate':'reserved',{kingdomUtility:kingdom,laborAuthority});
  }
  // Modular house pieces: the carrier walks to the socket's anchor cell; placement itself goes through PLACE_STATION.
  for(const p of ((independent||s.productionPlan?.enabled===true)?pendingPersonalPlacements(s,a,walkable):pendingPlacements(s,a,walkable))){
    const kingdom=kingdomWorkFactors({seed:s.seed,tick:s.tick,agent:a,kind:'BUILD',scarcityOverride:18});
    const laborAuthority=laborAuthoritySignal({kind:'BUILD',agent:a,agents:s.agents,stock,unfinished,emergency:a.satiety<RULES.hungry||a.energy<RULES.exhausted});
    add('BUILD',{id:p.itemInstanceId,x:p.anchor.x,y:p.anchor.y},56,0,a.preference==='BUILD'?18:0,!productive?'stage':book.buildings.has('piece:'+p.itemInstanceId)?'reserved':'candidate',
      {kingdomUtility:kingdom,laborAuthority,placement:{itemInstanceId:p.itemInstanceId,pieceKind:p.pieceKind,socket:p.socket}});
  }
  const tx=5+(a.id*7+Math.floor(s.tick/40))%13,ty=5+(a.id*3+Math.floor(s.tick/60))%16;
  const exploration=personalExplorationTarget(s,a,target=>routeDistance(field,target)>=0);
  add('EXPLORE',exploration??{x:tx,y:ty},exploration?8:3,0,0,'candidate',exploration?{exploreCursor:exploration.exploreCursor,informationSeeking:true}:{});
  add('IDLE',a,0);
  return out.sort((x,y)=>y.score-x.score||(x.kind<y.kind?-1:x.kind>y.kind?1:0)||(x.targetId??0)-(y.targetId??0));
}
function decide(s,a,book){
  if(a.adventureEncounter?.status==='READY'||a.adventureCombat)return;
  const field=routeField(s,a),choices=candidates(s,a,book,field);
  a.trace=choices;
  for(const c of choices){
    if(c.status!=='candidate')continue;
    a.task={kind:c.kind,targetId:c.targetId,x:c.x,y:c.y,path:routeTo(field,c),work:0,
      score:c.score,started:s.tick,policy:RULES.jobPolicy,fieldRest:c.fieldRest===true,
      ...(isIndependent(s)?{homeId:c.homeId??null,mealOwnerId:c.mealOwnerId??null,guardianId:c.guardianId??null,fieldEat:c.fieldEat===true}:{}),
      ...(c.purposeKind?{purposeKind:c.purposeKind}:{}),...(c.knowledgeKey?{knowledgeKey:c.knowledgeKey}:{}),
      ...(Number.isInteger(c.exploreCursor)?{exploreCursor:c.exploreCursor}:{}),...(c.placement?{placement:{...c.placement,socket:{...c.placement.socket}}}:{})};
    if(!claim(book,s,a)){c.status='reserved';a.task=null;continue;}
    rememberPlanSelection(s,a,c);
    const career=adoptProfession(a,c.kind,s.tick);
    if(career.changed&&s.tick-(a.lastCareerEventTick??-999)>=60){event(s,'career',a.name+' เปลี่ยนอาชีพเป็น '+professionLabel(a.profession),a.id);a.lastCareerEventTick=s.tick;}
    c.status='selected';
    recordPredictionReceipt(s,a,actionPredictionEvidence(a,a.task,c));
    a.moveTick=0;return;
  }
}
function stepAutonomousAdventure(s,a){
  const intent=autonomousAdventureIntent(s,a);
  if(!intent)return false;
  if(intent.type==='wait-combat'||intent.type==='wait-encounter'||intent.type==='wait-result')return true;

  if(intent.type==='start-hunt'){
    const r=command(s,'START_ADVENTURE_HUNT',{agentId:a.id,worldMonsterId:intent.worldMonsterId,control:'autonomous'});
    return r.ok;
  }
  if(intent.type==='start-combat'){
    const r=command(s,'START_ADVENTURE_COMBAT',{agentId:a.id});
    return r.ok;
  }
  if(intent.type==='attack'){
    const r=command(s,'ADVENTURE_COMBAT_ACTION',{agentId:a.id,action:'BASIC_ATTACK',expectedTurn:intent.expectedTurn});
    return r.ok;
  }
  if(intent.type==='finish-result'){
    if(intent.claimLoot)command(s,'CLAIM_ADVENTURE_LOOT',{agentId:a.id});
    const r=command(s,'FINISH_ADVENTURE_RESULT',{agentId:a.id});
    return r.ok;
  }
  return false;
}

function gain(s,a,key,targetId=null){
  if(!SKILLS.includes(key))return;
  const old=level(a.skills[key]);a.skills[key]+=5;a.workDone++;
  if(!recordEarnedSkill(a,key,5,s.tick,{action:key,targetId}))throw new Error('Skill provenance write failed');
  if(level(a.skills[key])>old)event(s,'skill',a.name+' พัฒนา '+LABELS[key]+' เป็นระดับ '+level(a.skills[key]),a.id);
}
function execute(s,a){
  const t=a.task,stock=resourceStock(s,a),meal=foodStock(s,a);
  if(t.kind==='IDLE'){a.energy=clamp(a.energy+.3);if(++t.work>=12)a.task=null;return;}
  if(t.kind==='EAT'&&meal.food<=0){a.task=null;return;}
  if(t.path.length){a.moveTick++;if(a.moveTick>=RULES.moveTicks){const p=t.path.shift();a.x=p.x;a.y=p.y;a.moveTick=0;}return;}
  const workRate=SKILLS.includes(t.kind)?productiveWorkRate(s,a)*rustToolMultiplier(s,a,t.kind):(['CRAFT','PROCESS'].includes(t.kind)?productiveWorkRate(s,a):1);
  if(t.kind==='CRAFT'||t.kind==='PROCESS'){
    const result=advanceRustWork(s,a,workRate);
    if(!result.ok){if(result.reason!=='already-worked')a.task=null;return;}
    t.work=result.work??t.work;
    if(result.completed){event(s,'craft',a.name+(t.kind==='CRAFT'?' คราฟต์ของสำเร็จ':' แปรรูปถ่านไม้สำเร็จ'),a.id);a.task=null;}
    return;
  }
  t.work+=workRate;
  if(t.kind==='EAT'){
    if(t.work>=3){
      if(meal.food>0){
        const ownerId=mealOwnerId(s,a);
        meal.food--;a.satiety=clamp(a.satiety+RULES.mealSatiety);
        if(isIndependent(s)&&Number.isSafeInteger(ownerId)&&ownerId!==a.id){
          const year=Math.floor(s.tick/LIFE.ticksPerYear);
          recordRelationshipEvidence(s,{fromId:a.id,toId:ownerId,kind:'guardian-support',key:'guardian-meal:'+a.id+':'+ownerId+':'+year,delta:{trust:1,affinity:1},ref:'food'});
        }
      }
      a.task=null;
    }
  }else if(t.kind==='REST'){
    a.energy=clamp(a.energy+(t.fieldRest?.9:2));if(!t.fieldRest&&a.satiety>30)a.hp=clamp(a.hp+.3);
    if(t.work>=26||a.energy>=99)a.task=null;
  }else if(t.kind==='BUILD'&&t.placement){
    // Arrived at the anchor: place through the single executor (command -> rustCommand -> placeStationFromItem).
    const data={agentId:a.id,itemInstanceId:t.placement.itemInstanceId,pieceKind:t.placement.pieceKind,socket:{...t.placement.socket},placementId:placementIdFor(s.tick,a.id,t.placement.itemInstanceId)};
    let r=command(s,'PLACE_STATION',data);
    if(!r.ok&&r.reason==='hammer'){
      const hammer=s.rustPossessions.items.filter(i=>i.kind==='HAMMER'&&i.location?.kind==='bag'&&i.location.agentId===a.id).sort((x,y)=>x.id-y.id)[0];
      if(hammer&&command(s,'EQUIP_ITEM',{agentId:a.id,itemId:hammer.id}).ok)r=command(s,'PLACE_STATION',data);
    }
    if(r.ok&&r.completedHouse){gain(s,a,'BUILD',r.stationId);recordPlanProduction(s,a,t,1);}
    a.task=null;
  }else if(t.kind==='BUILD'){
    const b=s.buildings.find(b=>b.id===t.targetId);
    if(!b||b.complete){a.task=null;return;}
    b.progress=Math.min(30,b.progress+(.35+level(a.skills.BUILD)*.08)*workRate);
    if(b.progress>=30){b.complete=true;s.stats.built++;gain(s,a,'BUILD',b.id);recordPlanProduction(s,a,t,1);event(s,'build',a.name+' สร้างบ้านสำเร็จ · ที่พักเพิ่ม 6 คน',a.id);a.task=null;}
  }else if(SKILLS.includes(t.kind)){
    const n=s.nodes.find(n=>n.id===t.targetId);
    if(!n||n.amount<=0){a.task=null;return;}
    if(t.work>=Math.max(4,14-level(a.skills[t.kind]))){
      const amount=Math.min(n.amount,2+Math.floor(level(a.skills[t.kind])/2),999-stock[n.type]);
      if(amount>0){
        n.amount-=amount;s.stats.gathered+=amount;
        // A hungry forager eats ONE freshly harvested unit. No free meal is created.
        const meal=t.kind==='FORAGE'&&a.satiety<RULES.hungry&&amount>=1?1:0;
        stock[n.type]+=amount-meal;
        if(meal)a.satiety=clamp(a.satiety+RULES.mealSatiety);
        gain(s,a,t.kind,n.id);
        if(!recordResourceDiscovery(a,n,s.tick,{action:t.kind,amount}))throw new Error('Knowledge evidence write failed');
        if(isIndependent(s)&&['FORAGE','WOODCUT','MINE'].includes(t.kind)){
          const account=resourceAccount(s,a);
          if(account.kind==='household'&&Number.isSafeInteger(account.ownerId)&&account.ownerId!==a.id){
            const year=Math.floor(s.tick/DAY_TICKS);
            recordRelationshipEvidence(s,{
              fromId:account.ownerId,toId:a.id,kind:'household-contribution',
              key:'household-contribution:'+account.ownerId+':'+a.id+':'+t.kind+':'+year,
              delta:{trust:1,respect:1},ref:account.houseId+':'+n.type
            });
          }
        }
        recordPlanProduction(s,a,t,amount);
      }
      a.task=null;
    }
  }else if(t.adventureHunt&&t.work>=6){
    const encounter=completeAdventureHunt(s,a,t);
    a.adventureEncounter=encounter;
    event(s,'adventure',a.name+' เข้าถึง '+encounter.monsterId+' Lv.'+encounter.monsterLevel+' ที่ '+encounter.zoneId,a.id);
    a.task=null;
  }else if(t.work>=6){
    finishPersonalExploration(s,a,t);
    const belief=t.knowledgeKey?a.knowledgeState?.beliefs?.find(b=>b.key===t.knowledgeKey):null;
    const qualification=noteExploreCompletion(a,{
      kind:t.kind,tick:s.tick,x:a.x,y:a.y,started:t.started,
      alive:a.alive===true,productive:canPerformProductiveWork(s,a),
      knowledge:t.knowledgeKey?(belief?.status??'UNKNOWN'):'none'
    });
    if(qualification.career?.changed&&s.tick-(a.lastCareerEventTick??-999)>=60){
      event(s,'career',a.name+' เปลี่ยนอาชีพเป็น '+professionLabel(a.profession),a.id);
      a.lastCareerEventTick=s.tick;
    }
    if(t.adventureExpedition){
      const encounter=completeAdventureExpedition(s,a,t);
      a.adventureEncounter=encounter;
      event(s,'adventure',a.name+' พบ '+encounter.monsterId+' Lv.'+encounter.monsterLevel+' ที่ '+encounter.zoneId,a.id);
    }
    a.task=null;
  }
}
function interrupt(s,a){
  const t=a.task;if(!taskValid(s,a)||!adventureExpeditionTaskValid(s,a,t,{walkable}))return true;
  if(s.tick%12!==0)return false;
  // Hunger wins over tiredness; avoid oscillating between rest and foraging.
  if(a.satiety<RULES.hungry&&!['EAT','FORAGE'].includes(t.kind))return true;
  return a.energy<RULES.exhausted&&a.satiety>=RULES.hungry&&t.kind!=='REST';
}
export function step(s,count=1,options={}){
  if(!Number.isInteger(count)||count<0||count>100000)throw new Error('Invalid tick count');
  const resourceRegenerationMode=options?.resourceRegenerationMode??'ecology';
  if(!['ecology','legacy'].includes(resourceRegenerationMode))throw new Error('Invalid resource regeneration mode');
  for(let i=0;i<count;i++){
    s.tick++;
    applyWorldResourceRegeneration(s,{foodMode:resourceRegenerationMode,woodMode:resourceRegenerationMode});
    for(const a of s.agents){
      if(!a.alive)continue;
      a.satiety=clamp(a.satiety-.11);a.energy=clamp(a.energy-.06);
      if(a.satiety===0)a.hp=clamp(a.hp-.28);
      if(a.hp===0){killAgent(s,a,'starvation');continue;}
      if(shouldDieOfAge(s,a)){killAgent(s,a,'age');continue;}
      ageKnowledge(a,s.tick);
      if(a.task&&interrupt(s,a)){a.task=null;a.moveTick=0;}
    }
    stepProductionPlanning(s,walkable,(type,data)=>command(s,type,data));
    const {book,rejected}=reservations(s);
    for(const id of rejected)s.agents.find(a=>a.id===id).task=null;
    const agents=living(s),rotation=s.tick%Math.max(1,agents.length);
    const priority=a=>a.satiety<RULES.hungry?0:a.energy<RULES.exhausted?1:2;
    const order=agents.map((a,index)=>({a,order:(index+rotation)%agents.length})).sort((x,y)=>
      priority(x.a)-priority(y.a)||(priority(x.a)===0?x.a.satiety-y.a.satiety:priority(x.a)===1?x.a.energy-y.a.energy:0)||x.order-y.order);
    for(const {a} of order){
      if(a.task&&(!taskValid(s,a)||!adventureExpeditionTaskValid(s,a,a.task,{walkable}))){release(book,a,a.task);a.task=null;}
      if(stepAutonomousAdventure(s,a))continue;
      if(!a.task)decide(s,a,book);
      const task=a.task;
      if(task){execute(s,a);if(a.task!==task)release(book,a,task);}
    }
    stepWildMonsterLifecycle(s);
    const teaching=stepMentorship(s);if(teaching)event(s,'mentor',teaching.message,teaching.mentorId);
    const cultural=stepCulture(s);
    if(cultural)event(s,'knowledge',cultural.message,cultural.agentId);
    const recruitment=stepHouseholdRecruitment(s);
    if(recruitment?.ok&&recruitment.changed)event(s,'household',recruitment.message,recruitment.agentId??null);
    const settlement=stepSettlementAuthority(s);
    if(settlement?.changed&&settlement.createdIds.length)event(s,'settlement','เกิด Settlement ใหม่ '+settlement.createdIds.join(', '));
    const governance=stepGovernanceAuthority(s);
    if(governance?.changed){
      for(const x of governance.appointed)event(s,'governance','แต่งตั้งผู้ปกครอง '+x.settlementId+' · #'+x.governorId,x.governorId);
      for(const x of governance.vacated)event(s,'governance','ตำแหน่งผู้ปกครอง '+x.settlementId+' ว่าง · '+x.reason);
    }
    const policy=stepGovernancePolicy(s);
    if(policy?.changed){
      for(const x of policy.created)event(s,'governance','นโยบาย '+x.settlementId+' · '+x.good+' · bonus '+x.bonus,x.governorId);
      for(const x of policy.resolved)event(s,'governance','นโยบาย '+x.settlementId+' แก้ shortage สำเร็จ · '+x.policyId);
    }
    if(s.tick%DAY_TICKS===0){
      attemptAutonomousBirth(s);
      const independent=isIndependent(s),food=independent?materialTotals(s,{livingOnly:true}).food:s.stock.food;
      event(s,'day','เริ่มวันที่ '+day(s)+' · ประชากร '+living(s).length+' คน · '+(independent?'อาหารรวม ':'อาหาร ')+food);
    }
  }
  return s;
}
export function serialize(s){
  const text=JSON.stringify(s);
  if(text.length>HISTORY_LIMITS.maxSaveCharacters)throw new Error('ไฟล์บันทึกมีขนาดใหญ่เกินไป · ไม่เขียนทับเซฟเดิม');
  return text;
}
export function validate(s){
  const errors=[];const bad=x=>errors.push(x),finite=n=>typeof n==='number'&&Number.isFinite(n);
  if(!s||![SAVE_VERSION,INDEPENDENT_SAVE_VERSION].includes(s.version))return ['Unsupported save version'];
  const boundsErrors=validateWorldBoundsState(s);if(boundsErrors.length)return boundsErrors;
  const bounds=worldBounds(s),cellCount=worldCellCount(s);
  errors.push(...validateAdventureAnnexState(s));
  errors.push(...validateWildMonsterWorld(s));
  errors.push(...validateIndependentWorld(s));
  errors.push(...validateSettlementState(s,{required:isIndependent(s)}));
  errors.push(...validateGovernanceState(s,{required:isIndependent(s)}));
  if(s.historyVersion!==HISTORY_VERSION)bad('History version');
  if(s.archiveVersion!==ARCHIVE_VERSION)bad('Archive version');
  if(!Array.isArray(s.archive)||s.archive.length>HISTORY_LIMITS.maxRetained)return ['Archive'];
  if(JSON.stringify(s.archive).length>HISTORY_LIMITS.maxArchiveCharacters)bad('Archive size');
  if(!Number.isInteger(s.tick)||s.tick<0||!Number.isInteger(s.rng)||!Number.isInteger(s.seed))bad('Clock/seed');
  if(!Array.isArray(s.tiles)||s.tiles.length!==cellCount||s.tiles.some(t=>!['grass','water','path','bridge'].includes(t)))return ['Terrain'];
  // Independent s.stock is a zero-only compatibility placeholder. validateIndependentWorld owns that contract.
  // Only legacy mode treats s.stock as a spendable inventory authority.
  if(!isIndependent(s)&&(!s.stock||['food','wood','stone'].some(k=>!finite(s.stock[k])||s.stock[k]<0||s.stock[k]>999)))bad('Inventory');
  if(!Array.isArray(s.agents)||s.agents.length>HISTORY_LIMITS.maxImportedHotRecords||retainedCount(s)<1||retainedCount(s)>HISTORY_LIMITS.maxRetained)return ['Agent count'];
  const people=[...s.agents,...s.archive];
  if(people.some(a=>!a||typeof a!=='object'||Array.isArray(a)))return ['Agent record'];
  if(s.archive.some(a=>a.archived!==true||a.alive!==false||a.hp!==0||a.task!==null||a.moveTick!==0||!Array.isArray(a.trace)||a.trace.length!==0))bad('Archived runtime');
  if(s.agents.some(a=>a.archived!==undefined))bad('Hot archive marker');
  const ids=new Set();
  for(const a of people){
    if(!Number.isSafeInteger(a.id)||a.id<1||ids.has(a.id))bad('Agent ID');ids.add(a.id);
    if(!walkable(s,a.x,a.y))bad('Agent position');
    if(['hp','satiety','energy'].some(k=>!finite(a[k])||a[k]<0||a[k]>100))bad('Agent needs');
    if(typeof a.alive!=='boolean'||!Number.isInteger(a.generation)||a.generation<0||typeof a.name!=='string'||a.name.length>50)bad('Agent identity');
    const requiredSkills=isIndependent(s)?ALL_SKILLS:SKILLS;
    if(!a.skills||requiredSkills.some(k=>!finite(a.skills[k])||a.skills[k]<0))bad('Skills');
    if(a.profession!==undefined&&!isKingdomProfession(a.profession))bad('Profession');
    if(a.professionSinceTick!==undefined&&(!Number.isInteger(a.professionSinceTick)||a.professionSinceTick<0||a.professionSinceTick>s.tick))bad('Profession');
    if(a.career!==undefined&&(!Array.isArray(a.career)||a.career.length>8||a.career.some(c=>!c||!Number.isInteger(c.tick)||c.tick<0||c.tick>s.tick||!isKingdomProfession(c.profession))))bad('Career');
    for(const e of validateAdventurerQualification(a,s.tick))bad(e);
    for(const e of validateSkillProvenance(a,requiredSkills))bad(e);
    for(const e of validateAdventureProgression(a,{required:isIndependent(s)}))bad(e);
    for(const e of validateAdventureEncounterState(s,a))bad(e);
    for(const e of validateAdventureCombatState(s,a))bad(e);
    for(const e of validateAdventureCombatRewardState(s,a))bad(e);
    for(const e of validateAdventureLootClaimState(s,a))bad(e);
    for(const e of validateKnowledgeState(a))bad(e);
    if(!a.appearance||['coat','skin','hair'].some(k=>!/^#[a-fA-F0-9]{6}$/.test(a.appearance[k]))||![0,1,2].includes(a.appearance.style))bad('Appearance');
    if(!Array.isArray(a.memory)||a.memory.length>8||a.memory.some(m=>typeof m.text!=='string'||!finite(m.tick)))bad('Memory');
    if(!Array.isArray(a.trace)||a.trace.length>30||a.trace.some(t=>!LABELS[t.kind]||!finite(t.score)||!t.factors||Object.values(t.factors).some(v=>!finite(v))))bad('Trace');
    if(!finite(a.moveTick)||!finite(a.workDone)||!finite(a.bornTick)||typeof a.source!=='string'||!SKILLS.includes(a.preference))bad('Agent bookkeeping');
    if(!a.life||!Number.isInteger(a.life.anchorTick)||a.life.anchorTick<0||a.life.anchorTick>s.tick||
      !Number.isInteger(a.life.ageAtAnchorYears)||a.life.ageAtAnchorYears<0||a.life.ageAtAnchorYears>200)bad('Lifecycle');
    if(a.alive){
      if(a.death!==null)bad('Death history');
    }else{
      if(a.hp!==0||a.task!==null||a.moveTick!==0)bad('Dead runtime');
      const d=a.death;
      if(!d||!DEATH_STATUSES.has(d.status)||!DEATH_CAUSES.has(d.cause))bad('Death history');
      else{
        if(d.tick!==null&&(!Number.isInteger(d.tick)||d.tick<0||d.tick>s.tick))bad('Death history');
        if(d.ageYears!==null&&(!Number.isInteger(d.ageYears)||d.ageYears<0||d.ageYears>200))bad('Death history');
        if(d.status==='recorded'&&(d.tick===null||d.ageYears===null||d.cause==='unknown'))bad('Death history');
        if(d.status==='legacy-unknown'&&(d.tick!==null||d.ageYears!==null||d.cause!=='unknown'))bad('Death history');
      }
    }
    if(a.task&&(!LABELS[a.task.kind]||!finite(a.task.work)||!Array.isArray(a.task.path)||a.task.path.length>cellCount||a.task.path.some(p=>!walkable(s,p.x,p.y))))bad('Task');
    if(a.task&&!adventureExpeditionTaskValid(s,a,a.task,{walkable}))bad('Adventure task');
  }
  const byId=new Map(people.map(a=>[a.id,a]));
  for(const a of people){
    for(const b of a.knowledgeState.beliefs)if(b.sourceAgentId!==null&&!byId.has(b.sourceAgentId))bad('Knowledge source');
    for(const e of a.knowledgeState.evidence)if(e.sourceAgentId!==null&&!byId.has(e.sourceAgentId))bad('Knowledge source');
  }
  for(const a of people)if(a.parentId!==null){
    const parent=byId.get(a.parentId);
    if(!parent)bad('Parent reference');
    else if(a.parentId===a.id||a.generation!==parent.generation+1||parent.bornTick>a.bornTick)bad('Parent lineage');
  }
  if(!Array.isArray(s.nodes)||s.nodes.length>cellCount||s.nodes.some(n=>!walkable(s,n.x,n.y)||!['food','wood','stone'].includes(n.type)||!finite(n.amount)||!finite(n.max)||n.amount<0||n.amount>n.max))bad('Resources');
  if(!Array.isArray(s.buildings)||(!isIndependent(s)&&s.buildings.length<1)||s.buildings.length>12||s.buildings.some(b=>!walkable(s,b.x,b.y)||!['camp','shelter'].includes(b.type)||typeof b.complete!=='boolean'||!finite(b.progress)||b.progress<0||b.progress>30))bad('Buildings');
  if(!Array.isArray(s.events)||s.events.length>120||s.events.some(e=>typeof e.text!=='string'||!finite(e.tick)||!finite(e.id)))bad('Events');
  if(!s.stats||['gathered','built','cloned'].some(k=>!finite(s.stats[k])||s.stats[k]<0))bad('Stats');
  if(!Number.isInteger(s.nextAgent)||s.nextAgent<=Math.max(...ids)||!Number.isInteger(s.nextEvent)||!Number.isInteger(s.nextBuilding))bad('Counters');
  for(const e of validatePersonalPlanning(s))bad(e);
  for(const e of validateCulture(s))bad(e);
  for(const e of validateRustState(s))bad(e);
  for(const e of validateProductionPlan(s))bad(e);
  for(const e of validateMentorship(s))bad(e);
  for(const e of validateSocialState(s,{required:isIndependent(s)}))bad(e);
  return errors;
}
function deathCauseFromText(text){
  if(typeof text!=='string')return 'unknown';
  if(text.includes('เสียชีวิตตามวัย'))return 'age';
  if(text.includes('ขาดอาหาร'))return 'starvation';
  return 'unknown';
}
function deathAgeFromText(text){
  if(typeof text!=='string')return null;
  const match=text.match(/อายุ\s+(\d+)\s+ปี/);
  if(!match)return null;
  const age=Number(match[1]);return Number.isInteger(age)&&age>=0&&age<=200?age:null;
}
function retainedDeathEvidence(s,a){
  const rows=[];
  if(Array.isArray(s.events))for(const e of s.events)
    if(e?.type==='death'&&e.agentId===a.id)rows.push({tick:e.tick,text:e.text});
  if(Array.isArray(a.memory))for(const m of a.memory)
    if(typeof m?.text==='string'&&m.text.includes('เสียชีวิต'))rows.push({tick:m.tick,text:m.text});
  rows.sort((x,y)=>(Number.isInteger(y.tick)?y.tick:-1)-(Number.isInteger(x.tick)?x.tick:-1));
  return rows[0]??null;
}
function migrateDeathRecord(s,a,sourceVersion){
  if(a.alive)return null;
  const evidence=retainedDeathEvidence(s,a);
  if(!evidence)return {status:'legacy-unknown',tick:null,cause:'unknown',ageYears:null};
  const tick=Number.isInteger(evidence.tick)&&evidence.tick>=0&&evidence.tick<=s.tick?evidence.tick:null;
  const cause=deathCauseFromText(evidence.text);
  let age=deathAgeFromText(evidence.text);
  if(age===null&&sourceVersion===DEATH_HISTORY_SAVE_VERSION&&tick!==null)age=ageYearsAtTick(s,a,tick);
  const known=tick!==null||cause!=='unknown'||age!==null;
  return {status:known?'legacy-evidence':'legacy-unknown',tick,cause,ageYears:age};
}
function migrateHistory(s,sourceVersion){
  if(s?.historyVersion===HISTORY_VERSION)return s;
  if(s?.historyVersion!==undefined&&s?.historyVersion!==null)return s;
  if(Array.isArray(s?.agents))for(const a of s.agents)a.death=migrateDeathRecord(s,a,sourceVersion);
  s.historyVersion=HISTORY_VERSION;
  return s;
}
function migrateSkillProvenance(s){
  for(const a of allPeople(s)){
    if(!a.skillProvenance)a.skillProvenance=createLegacySkillProvenance(a.skills);
    if(isIndependent(s)){ensureLeadershipSkill(a,{tick:0});ensureAdventureProgressionSkill(a,{tick:0});}
  }
  return s;
}
function syncHouseholdResources(s){
  if(!isIndependent(s))return s;
  ensureHouseholdResourceState(s);
  for(const h of individualHouses(s).filter(h=>h.complete&&Number.isSafeInteger(h.ownerId))){
    const r=activateHouseholdStore(s,h.houseId,h.ownerId);
    if(!r.ok)throw new Error('Household resource migration failed');
  }
  for(const r of s.social?.residences??[]){
    if(r.leftTick!==null)continue;
    const moved=joinHouseholdResources(s,r.agentId,r.houseId);
    if(!moved.ok)throw new Error('Household resident resource migration failed');
  }
  return s;
}
function migrateKnowledge(s){
  for(const a of allPeople(s))if(!a.knowledgeState)a.knowledgeState=createKnowledgeState();
  return s;
}
function migrateAutonomousAdventurePolicy(s){
  for(const a of s?.agents??[]){
    if(a.task?.adventureHunt?.control==='autonomous'&&a.task.adventureHunt.targetPolicy!==ADVENTURE_HUNT_AUTONOMOUS_POLICY){
      a.task=null;a.moveTick=0;
    }
    if(a.adventureEncounter?.control==='autonomous'&&a.adventureEncounter.targetPolicy!==ADVENTURE_HUNT_AUTONOMOUS_POLICY){
      a.adventureEncounter=null;
    }
  }
  return s;
}
function migrateSave(s,{sameWorld=false}={}){
  if(!s)return s;
  if(sameWorld)expandLargeWorldToSameWorld(s);
  if(s?.worldBounds?.profile==='same-world'){ensureWildMonsterWorld(s);migrateWildMonsterLifecycleState(s);}
  migrateAutonomousAdventurePolicy(s);
  const sourceVersion=s.version;
  if(sourceVersion===INDEPENDENT_SAVE_VERSION){migrateSkillProvenance(s);ensureSocialState(s);syncHouseholdResources(s);ensureSettlementState(s);ensureGovernanceState(s);return s;} // additive social/settlement/governance state migrates deterministically.
  // Rust RS1-RS4 is an optional 0.5.0 extension; older 0.5.0 saves gain empty bounded ledgers.
  if(sourceVersion===SAVE_VERSION){migrateSkillProvenance(s);ensureRustState(s);ensureProductionPlan(s);ensureMentorshipState(s);ensureSocialState(s);return s;}
  if(sourceVersion===PREVIOUS_SAVE_VERSION){
    if(!Array.isArray(s.archive)||s.archiveVersion!==ARCHIVE_VERSION||s.historyVersion!==HISTORY_VERSION)return s;
    migrateKnowledge(s);ensureRustState(s);ensureProductionPlan(s);ensureMentorshipState(s);ensureSocialState(s);s.version=SAVE_VERSION;return s;
  }
  if(sourceVersion===HISTORY_ARCHIVE_SAVE_VERSION){
    if(!Array.isArray(s.archive)||s.archiveVersion!==ARCHIVE_VERSION||s.historyVersion!==HISTORY_VERSION)return s;
    migrateSkillProvenance(s);migrateKnowledge(s);ensureRustState(s);ensureProductionPlan(s);ensureMentorshipState(s);ensureSocialState(s);s.version=SAVE_VERSION;return s;
  }
  if(![LEGACY_SAVE_VERSION,DEATH_HISTORY_SAVE_VERSION].includes(sourceVersion))return s;
  if(s.archive!==undefined||s.archiveVersion!==undefined)throw new Error('Unexpected archive in legacy save');
  if(sourceVersion===LEGACY_SAVE_VERSION){
    const anchor=Number.isInteger(s.tick)&&s.tick>=0?s.tick:0;
    if(Array.isArray(s.agents))for(const a of s.agents)a.life=adultLife(anchor);
  }
  // Old engines could leave a dead agent's movement counter (or task) behind.
  // Normalize execution-only state; do not rewrite identity or historical death facts.
  if(Array.isArray(s.agents))for(const a of s.agents)if(a?.alive===false&&a.hp===0){a.task=null;a.moveTick=0;}
  migrateHistory(s,sourceVersion);
  s.archiveVersion=ARCHIVE_VERSION;s.archive=[];
  migrateSkillProvenance(s);migrateKnowledge(s);ensureRustState(s);ensureProductionPlan(s);ensureMentorshipState(s);ensureSocialState(s);s.version=SAVE_VERSION;
  return s;
}
export function restore(text,options={}){
  if(typeof text!=='string'||text.length>HISTORY_LIMITS.maxSaveCharacters)throw new Error('ไฟล์บันทึกมีขนาดใหญ่เกินไป');
  const s=migrateSave(JSON.parse(text),options),errors=validate(s);
  if(errors.length)throw new Error('บันทึกไม่ถูกต้อง: '+errors.join(', '));return s;
}
