import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate} from '../src/engine.mjs';
import {adoptProfession,noteExploreCompletion} from '../src/kingdom-utility.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {addMaterialSet} from '../src/material-economy.mjs';
import {homeOf,individualHouses} from '../src/individual-housing.mjs';
import {crafterFamilyProfile,evaluateBuilderRecovery} from '../src/crafter-career.mjs';
import {
  BUILDER_CRAFTER_APPRENTICESHIP_VERSION,
  builderCrafterApprenticeshipState,
  builderCrafterApprenticeshipIntent,
} from '../src/production-planning.mjs';
import {rc2World} from './fixtures/rc2-world.mjs';

function hammerProfile(s,id){
  const a=s.agents.find(x=>x.id===id);
  const snap=crafterFamilyProfile(s,a,'HAMMER');
  assert.equal(snap.status,'SAT',JSON.stringify(snap));
  return snap.profile;
}
function buildEarnedXP(a){
  return Number(a?.skillProvenance?.bySkill?.BUILD?.earnedXP??0);
}
function builderWorld(){
  const s=rc2World(),target=s.agents[1];
  const changed=adoptProfession(target,'BUILD',s.tick);
  assert.equal(changed.changed,true);
  assert.equal(target.profession,'builder');
  target.hp=target.satiety=target.energy=100;target.task=null;
  // Focused apprenticeship regression supplies only raw/processed inputs.
  // It never grants crafted items, recipe receipts, mastery, profession or XP.
  addMaterialSet(s,target,{ironOre:8,charcoal:4});
  assert.equal(s.productionPlan.enabled,false);
  assert.notEqual(target.craftTraining?.enabled,true);
  assert.deepEqual(validate(s),[]);
  return {s,targetId:target.id};
}

let naturalRecoveryText=null,naturalRecoveryId=null;
function naturalRecoveryWorld(){
  if(!naturalRecoveryText){
    let s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:6}),target=null;
    for(let i=0;i<7000&&!target;i++){
      step(s,1);
      target=s.agents.find(a=>{
        if(!a.alive||a.profession!=='builder'||buildEarnedXP(a)<=0)return false;
        const home=homeOf(s,a.id,{completeOnly:true});if(!home||home.ownerId!==a.id)return false;
        const snap=crafterFamilyProfile(s,a,'HAMMER');
        return snap.status==='SAT'&&snap.profile?.total===1&&snap.profile?.counts[2]===0;
      })??null;
    }
    assert.ok(target,'natural world must produce exact Builder recovery evidence before apprenticeship adds extra mastery');
    naturalRecoveryId=target.id;naturalRecoveryText=serialize(s);
  }
  return {s:restore(naturalRecoveryText),targetId:naturalRecoveryId};
}
function driftedNaturalWorld(kind='WOODCUT'){
  const {s,targetId}=naturalRecoveryWorld(),target=s.agents.find(a=>a.id===targetId);
  const drift=adoptProfession(target,kind,s.tick);assert.equal(drift.changed,true);assert.notEqual(target.profession,'builder');
  return {s,targetId,target};
}
const structureKinds=new Set(['WOOD_FOUNDATION','WOOD_WALL','WOOD_DOORWAY','WOOD_ROOF']);
function removeOwnedRoof(s,targetId){
  const home=homeOf(s,targetId,{completeOnly:true});assert.ok(home);
  const roof=s.rustStations.stations.find(st=>st.placedBy===targetId&&st.kind==='WOOD_ROOF'&&st.x===home.origin.x&&st.y===home.origin.y);assert.ok(roof);
  s.rustStations.stations=s.rustStations.stations.filter(st=>st.id!==roof.id);return home;
}
function assertRecoveryRejectedWithoutMutation(s,targetId,reason,status='VIOL'){
  const before=serialize(s),q=evaluateBuilderRecovery(s,targetId);assert.equal(q.status,status,JSON.stringify(q));assert.equal(q.reason,reason);
  const r=command(s,'RC5_RECOVER_BUILDER',{agentId:targetId});assert.equal(r.ok,false);assert.equal(r.reason,reason);assert.equal(serialize(s),before);
}

test('career-only Builder apprenticeship keeps the released 6 total / 2 T2 gate',()=>{
  let {s,targetId}=builderWorld();
  const a0=s.agents.find(x=>x.id===targetId);
  const state=builderCrafterApprenticeshipState(s,a0);
  assert.equal(state.version,BUILDER_CRAFTER_APPRENTICESHIP_VERSION);
  assert.equal(state.status,'SAT');assert.equal(state.active,true);assert.equal(state.careerLock,true);
  Object.assign(resourceStock(s,a0),{food:500,wood:0,stone:0});
  const gather=builderCrafterApprenticeshipIntent(s,a0);
  assert.equal(gather.status,'SAT');assert.equal(gather.type,'GATHER');assert.equal(gather.action,'WOODCUT');
  const careerCount=a0.career.length;
  step(s,1);
  let a=s.agents.find(x=>x.id===targetId);
  assert.equal(a.profession,'builder');
  assert.equal(a.career.length,careerCount);
  assert.equal(s.productionPlan.enabled,false);
  assert.notEqual(a.craftTraining?.enabled,true);

  Object.assign(resourceStock(s,a),{food:500,wood:500,stone:500});
  let sawTier2=false,beforeSave=null;
  for(let i=0;i<3000;i++){
    step(s,1);a=s.agents.find(x=>x.id===targetId);
    if(!a?.alive)break;
    const p=hammerProfile(s,targetId);
    if(a.profession==='builder'&&p.counts[2]>=1){
      sawTier2=true;beforeSave={total:p.total,tier2:p.counts[2],career:[...a.career]};break;
    }
  }
  assert.equal(sawTier2,true,'must create a real HAMMER_T2 before promotion');
  assert.ok(s.rustStations.stations.some(st=>st.complete&&st.kind==='FURNACE'&&st.placedBy===targetId));

  s=restore(serialize(s));a=s.agents.find(x=>x.id===targetId);
  const loaded=hammerProfile(s,targetId);
  assert.equal(a.profession,'builder');
  assert.equal(loaded.total,beforeSave.total);assert.equal(loaded.counts[2],beforeSave.tier2);
  assert.deepEqual(a.career,beforeSave.career);

  for(let i=0;i<4000&&a?.alive&&a.profession!=='crafter';i++){step(s,1);a=s.agents.find(x=>x.id===targetId);}
  assert.ok(a?.alive);
  assert.equal(a.profession,'crafter');
  const final=hammerProfile(s,targetId);
  assert.equal(final.total,6);assert.equal(final.counts[2],2);assert.equal(final.grade,'CRAFTER');
  assert.equal(s.productionPlan.enabled,false);
  assert.notEqual(a.craftTraining?.enabled,true);
  assert.deepEqual(validate(s),[]);
});

test('old-save style Woodcutter with real Builder evidence recovers canonically and continues to Crafter',()=>{
  let {s,targetId}=naturalRecoveryWorld(),target=s.agents.find(a=>a.id===targetId);
  const homeBefore=homeOf(s,targetId,{completeOnly:true}),profileBefore=hammerProfile(s,targetId),buildBefore=buildEarnedXP(target);
  assert.ok(buildBefore>0);assert.ok(profileBefore.total>=1);

  // Simulate the reported old-save drift through the canonical ordinary profession writer.
  const drift=adoptProfession(target,'WOODCUT',s.tick);
  assert.equal(drift.changed,true);assert.equal(target.profession,'woodcutter');
  const driftCareer=[...target.career];
  s=restore(serialize(s));target=s.agents.find(a=>a.id===targetId);
  assert.equal(target.profession,'woodcutter');

  const recovery=evaluateBuilderRecovery(s,targetId);
  assert.equal(recovery.status,'SAT',JSON.stringify(recovery));
  assert.equal(recovery.reason,'builder-recovery-satisfied');

  let recovered=false;
  for(let i=0;i<2500&&!recovered;i++){
    step(s,1);target=s.agents.find(a=>a.id===targetId);
    recovered=target?.profession==='builder';
  }
  assert.equal(recovered,true,'old-save drift must re-enter Builder through canonical recovery');
  assert.equal(homeOf(s,targetId,{completeOnly:true})?.houseId,homeBefore.houseId);
  assert.equal(buildEarnedXP(target),buildBefore);
  assert.ok(hammerProfile(s,targetId).total>=profileBefore.total);
  assert.ok(target.career.length>=driftCareer.length);
  assert.equal(target.career.at(-1)?.profession,'builder');

  for(let i=0;i<9000&&target?.alive&&target.profession!=='crafter';i++){
    step(s,1);target=s.agents.find(a=>a.id===targetId);
  }
  assert.ok(target?.alive);
  assert.equal(target.profession,'crafter','recovered Builder must continue autonomously to Crafter');
  const final=hammerProfile(s,targetId);
  assert.equal(final.total,6);assert.equal(final.counts[2],2);
  const continuity={homeId:homeOf(s,targetId,{completeOnly:true})?.houseId,buildXP:buildEarnedXP(target),total:final.total,tier2:final.counts[2],career:[...target.career]};
  s=restore(serialize(s));target=s.agents.find(a=>a.id===targetId);
  assert.equal(target.profession,'crafter');
  assert.equal(homeOf(s,targetId,{completeOnly:true})?.houseId,continuity.homeId);
  assert.equal(buildEarnedXP(target),continuity.buildXP);
  const loaded=hammerProfile(s,targetId);assert.equal(loaded.total,continuity.total);assert.equal(loaded.counts[2],continuity.tier2);
  assert.deepEqual(target.career,continuity.career);
  assert.deepEqual(validate(s),[]);
});

test('recovery command is replay-safe immediately and after save/restore',()=>{
  let {s,targetId,target}=driftedNaturalWorld('WOODCUT');
  const xp=buildEarnedXP(target),mastery=hammerProfile(s,targetId).total,careerBefore=target.career.length;
  const eventsBefore=s.events.filter(e=>e.type==='career'&&e.agentId===targetId).length;
  const first=command(s,'RC5_RECOVER_BUILDER',{agentId:targetId});assert.equal(first.ok,true);assert.equal(first.changed,true);assert.equal(target.profession,'builder');
  assert.equal(buildEarnedXP(target),xp);assert.equal(hammerProfile(s,targetId).total,mastery);assert.equal(target.career.length,careerBefore+1);
  assert.equal(s.events.filter(e=>e.type==='career'&&e.agentId===targetId).length,eventsBefore+1);
  const once=serialize(s),second=command(s,'RC5_RECOVER_BUILDER',{agentId:targetId});assert.equal(second.ok,true);assert.equal(second.changed,false);assert.equal(second.reason,'already-builder');assert.equal(serialize(s),once);
  s=restore(once);target=s.agents.find(a=>a.id===targetId);const loaded=serialize(s),third=command(s,'RC5_RECOVER_BUILDER',{agentId:targetId});assert.equal(third.ok,true);assert.equal(third.changed,false);assert.equal(serialize(s),loaded);
  assert.equal(buildEarnedXP(target),xp);assert.equal(hammerProfile(s,targetId).total,mastery);assert.deepEqual(validate(s),[]);
});

test('Builder recovery rejects missing, incomplete and stranger-only housing evidence',()=>{
  {
    const {s,targetId}=driftedNaturalWorld();
    s.rustStations.stations=s.rustStations.stations.filter(st=>!(st.placedBy===targetId&&structureKinds.has(st.kind)));
    assert.equal(homeOf(s,targetId),null);assertRecoveryRejectedWithoutMutation(s,targetId,'construction-required');
  }
  {
    const {s,targetId}=driftedNaturalWorld();removeOwnedRoof(s,targetId);
    assert.ok(homeOf(s,targetId));assert.equal(homeOf(s,targetId,{completeOnly:true}),null);assertRecoveryRejectedWithoutMutation(s,targetId,'construction-required');
  }
  {
    const {s,targetId}=driftedNaturalWorld();
    s.rustStations.stations=s.rustStations.stations.filter(st=>!(st.placedBy===targetId&&structureKinds.has(st.kind)));
    assert.ok(individualHouses(s).some(h=>h.complete&&h.ownerId!==targetId),'a stranger completed home must still exist');
    assertRecoveryRejectedWithoutMutation(s,targetId,'construction-required');
  }
});

test('Builder recovery rejects absent or malformed earned BUILD and HAMMER evidence',()=>{
  {
    const {s,targetId,target}=driftedNaturalWorld();target.skillProvenance.bySkill.BUILD.earnedXP=0;
    assertRecoveryRejectedWithoutMutation(s,targetId,'build-work-required');
  }
  {
    const {s,targetId,target}=driftedNaturalWorld();target.skillProvenance.bySkill.BUILD.earnedXP='forged';
    assertRecoveryRejectedWithoutMutation(s,targetId,'build-evidence','UNKNOWN');
  }
  {
    const {s,targetId,target}=driftedNaturalWorld();const e=target.knowledgeState.recipes.entries.find(x=>x.recipeId==='HAMMER');assert.ok(e);e.retiredCompletions=0;e.receipts=[];
    assert.equal(hammerProfile(s,targetId).total,0);assertRecoveryRejectedWithoutMutation(s,targetId,'craft-foundation-required');
  }
  {
    const {s,targetId,target}=driftedNaturalWorld();const e=target.knowledgeState.recipes.entries.find(x=>x.recipeId==='HAMMER');assert.ok(e?.receipts[0]);e.receipts[0].crafterId=targetId+999;
    assertRecoveryRejectedWithoutMutation(s,targetId,'recipe-evidence','UNKNOWN');
  }
  {
    const {s,targetId}=driftedNaturalWorld(),before=serialize(s);
    const forged=command(s,'RC5_RECOVER_BUILDER',{agentId:targetId,evidenceId:'caller-must-not-supply-evidence'});assert.equal(forged.ok,false);assert.equal(forged.reason,'input');assert.equal(serialize(s),before);
  }
});

test('Merchant, Adventurer and Crafter are locked out of Builder recovery',()=>{
  {
    const {s,targetId,target}=naturalRecoveryWorld();const changed=adoptProfession(target,'MERCHANT',s.tick,{qualifiedProfession:'merchant',qualification:'merchant-v1',evidenceId:'test-merchant-lock'});assert.equal(changed.changed,true);assert.equal(target.profession,'merchant');
    assertRecoveryRejectedWithoutMutation(s,targetId,'special-profession-lock');
  }
  {
    const {s,targetId}=naturalRecoveryWorld(),target=s.agents.find(a=>a.id===targetId);
    for(let i=0;i<3;i++){s.tick++;const learned=noteExploreCompletion(target,{kind:'EXPLORE',alive:true,productive:true,knowledge:'none',tick:s.tick,x:target.x+i,y:target.y,started:s.tick});assert.equal(learned.counted,true);}
    assert.equal(target.profession,'adventurer');assertRecoveryRejectedWithoutMutation(s,targetId,'special-profession-lock');
  }
  {
    let {s,targetId}=builderWorld(),target=s.agents.find(a=>a.id===targetId);Object.assign(resourceStock(s,target),{food:500,wood:500,stone:500});
    for(let i=0;i<7000&&target.profession!=='crafter';i++){step(s,1);target=s.agents.find(a=>a.id===targetId);}
    assert.equal(target.profession,'crafter');const q=evaluateBuilderRecovery(s,targetId);assert.equal(q.status,'VIOL');assert.equal(q.reason,'special-profession-lock');
    const before=serialize(s),r=command(s,'RC5_RECOVER_BUILDER',{agentId:targetId});assert.equal(r.ok,false);assert.equal(r.reason,'special-profession-lock');assert.equal(serialize(s),before);
  }
});

test('ordinary Woodcutter without earned BUILD evidence is never recovered as Builder',()=>{
  const s=rc2World(),a=s.agents[0];
  assert.ok(homeOf(s,a.id,{completeOnly:true}),'negative control intentionally has a completed fixture home');
  assert.ok(hammerProfile(s,a.id).total>=1,'negative control intentionally has HAMMER completion evidence');
  assert.equal(buildEarnedXP(a),0,'fixture home placement did not earn BUILD work XP');
  const drift=adoptProfession(a,'WOODCUT',s.tick);
  assert.equal(drift.changed,true);assert.equal(a.profession,'woodcutter');
  const before=[...a.career];
  const eligibility=evaluateBuilderRecovery(s,a.id);
  assert.equal(eligibility.status,'VIOL');assert.equal(eligibility.reason,'build-work-required');
  const attempted=command(s,'RC5_RECOVER_BUILDER',{agentId:a.id});
  assert.equal(attempted.ok,false);assert.equal(attempted.reason,'build-work-required');
  assert.equal(a.profession,'woodcutter');assert.deepEqual(a.career,before);
  assert.deepEqual(validate(s),[]);
});
