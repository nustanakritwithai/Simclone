import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate} from '../src/engine.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {addMaterialSet} from '../src/material-economy.mjs';
import {homeOf} from '../src/individual-housing.mjs';
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
  let s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:6});
  let target=null;
  for(let i=0;i<7000&&!target;i++){
    step(s,1);
    target=s.agents.find(a=>{
      if(!a.alive||a.profession!=='builder'||buildEarnedXP(a)<=0)return false;
      const home=homeOf(s,a.id,{completeOnly:true});
      if(!home||home.ownerId!==a.id)return false;
      const snap=crafterFamilyProfile(s,a,'HAMMER');
      return snap.status==='SAT'&&snap.profile?.total>=1;
    })??null;
  }
  assert.ok(target,'natural world must create a Builder with own completed home, BUILD earned XP and HAMMER evidence');
  const targetId=target.id,homeBefore=homeOf(s,targetId,{completeOnly:true}),profileBefore=hammerProfile(s,targetId),buildBefore=buildEarnedXP(target);
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
