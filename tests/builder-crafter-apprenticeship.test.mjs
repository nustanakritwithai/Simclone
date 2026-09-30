import test from 'node:test';
import assert from 'node:assert/strict';
import {step,serialize,restore,validate} from '../src/engine.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {addMaterialSet} from '../src/material-economy.mjs';
import {crafterFamilyProfile} from '../src/crafter-career.mjs';
import {
  BUILDER_CRAFTER_APPRENTICESHIP_VERSION,
  builderCrafterApprenticeshipState,
  builderCrafterApprenticeshipIntent,
} from '../src/production-planning.mjs';
import {rc2World} from './fixtures/rc2-world.mjs';

function builderWorld(){
  const s=rc2World(),target=s.agents[1];
  const changed=adoptProfession(target,'BUILD',s.tick);
  assert.equal(changed.changed,true);
  assert.equal(target.profession,'builder');
  target.hp=target.satiety=target.energy=100;target.task=null;
  // Focused regression fixture supplies only raw/processed inputs. It does not
  // grant crafted items, recipe receipts, mastery, profession or XP evidence.
  addMaterialSet(s,target,{ironOre:8,charcoal:4});
  assert.equal(s.productionPlan.enabled,false,'full RP1 remains OFF');
  assert.notEqual(target.craftTraining?.enabled,true,'manual Training remains OFF');
  assert.deepEqual(validate(s),[]);
  return {s,targetId:target.id};
}
function hammerProfile(s,id){
  const a=s.agents.find(x=>x.id===id);
  const snap=crafterFamilyProfile(s,a,'HAMMER');
  assert.equal(snap.status,'SAT',JSON.stringify(snap));
  return snap.profile;
}

test('Builder apprenticeship is canonical, RP1-independent and protects the Builder career while gathering',()=>{
  const {s,targetId}=builderWorld(),a=s.agents.find(x=>x.id===targetId);
  const state=builderCrafterApprenticeshipState(s,a);
  assert.equal(state.version,BUILDER_CRAFTER_APPRENTICESHIP_VERSION);
  assert.equal(state.status,'SAT');assert.equal(state.active,true);assert.equal(state.careerLock,true);
  Object.assign(resourceStock(s,a),{food:500,wood:0,stone:0});
  const intent=builderCrafterApprenticeshipIntent(s,a);
  assert.equal(intent.status,'SAT');assert.equal(intent.type,'GATHER');assert.equal(intent.action,'WOODCUT');
  assert.equal(intent.careerLock,true);
  const careerCount=a.career.length;
  step(s,1);
  const live=s.agents.find(x=>x.id===targetId);
  assert.equal(live.profession,'builder','apprenticeship gathering must not rewrite Builder to Woodcutter/Miner');
  assert.equal(live.career.length,careerCount);
  assert.equal(s.productionPlan.enabled,false);
  assert.notEqual(live.craftTraining?.enabled,true);
});

test('Builder autonomously reaches 6 total / 2 T2 through Furnace + iron, survives save/load, then becomes Crafter',()=>{
  let {s,targetId}=builderWorld();
  let sawTier2=false,beforeSave=null;
  for(let i=0;i<3000;i++){
    step(s,1);
    const a=s.agents.find(x=>x.id===targetId);
    if(!a?.alive)break;
    const profile=hammerProfile(s,targetId);
    if(a.profession==='builder'&&profile.counts[2]>=1){
      sawTier2=true;beforeSave={total:profile.total,tier2:profile.counts[2],career:[...a.career]};
      break;
    }
    if(a.profession==='crafter')break;
  }
  assert.equal(sawTier2,true,'autonomy must create a real HAMMER_T2 before promotion');
  const pre=s.agents.find(x=>x.id===targetId);
  assert.equal(pre.profession,'builder');
  assert.equal(s.productionPlan.enabled,false,'apprenticeship must not silently enable full RP1');
  assert.notEqual(pre.craftTraining?.enabled,true,'apprenticeship must not enable manual Training');
  assert.ok(s.rustStations.stations.some(st=>st.complete&&st.kind==='FURNACE'&&st.placedBy===targetId),'Builder must bootstrap a canonical Furnace for T2 iron');

  s=restore(serialize(s));
  let loaded=s.agents.find(x=>x.id===targetId),loadedProfile=hammerProfile(s,targetId);
  assert.equal(loaded.profession,'builder');
  assert.equal(loadedProfile.total,beforeSave.total);
  assert.equal(loadedProfile.counts[2],beforeSave.tier2);
  assert.deepEqual(loaded.career,beforeSave.career);

  for(let i=0;i<3000&&loaded?.alive&&loaded.profession!=='crafter';i++){
    step(s,1);loaded=s.agents.find(x=>x.id===targetId);
  }
  assert.ok(loaded?.alive,'apprentice must remain alive');
  assert.equal(loaded.profession,'crafter','canonical qualification should promote after autonomous evidence reaches threshold');
  const final=hammerProfile(s,targetId);
  assert.equal(final.total,6,'promotion should happen at the released six-completion threshold');
  assert.equal(final.counts[2],2,'promotion should retain the released two-T2 threshold');
  assert.equal(final.grade,'CRAFTER');
  assert.equal(s.productionPlan.enabled,false);
  assert.notEqual(loaded.craftTraining?.enabled,true);
  assert.ok(s.events.some(e=>e.type==='career'&&e.agentId===targetId));
  assert.deepEqual(validate(s),[]);
});
