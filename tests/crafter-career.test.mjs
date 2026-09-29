import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,serialize,restore,validate,walkable} from '../src/engine.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';
import {advanceCraft} from '../src/rust-possessions.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {recipeById,STARTER_RECIPE_IDS} from '../src/crafting-catalog.mjs';
import {recipeMastery,knowsCraftRecipe} from '../src/craft-recipe-knowledge.mjs';
import {houseSite} from '../src/housing.mjs';
import {canonicalEdge,placementIdFor} from '../src/rust-stations.mjs';
import {
  CRAFTER_CAREER_VERSION,CRAFTER_QUALIFICATION_POLICY,
  crafterConstructionEvidence,crafterFamilyProfile,crafterQualificationProjection
} from '../src/crafter-career.mjs';

const clone=x=>JSON.parse(JSON.stringify(x));
function fresh(seed=230926){
  const s=createWorld(seed),a=s.agents[0];
  Object.assign(resourceStock(s,a),{wood:999,stone:999});
  a.satiety=100;a.energy=100;a.hp=100;
  adoptProfession(a,'BUILD',s.tick);
  assert.equal(a.profession,'builder');
  return {s,a};
}
function make(s,a,id='STONE_AXE'){
  const queued=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId:id});
  assert.equal(queued.ok,true,JSON.stringify(queued));
  if(Number.isSafeInteger(queued.stationId)){
    const st=s.rustStations.stations.find(x=>x.id===queued.stationId);assert.ok(st);
    a.x=st.x;a.y=st.y;
  }
  let done;
  for(let i=0;i<recipeById(id).work;i++){
    s.tick++;done=advanceCraft(s,a.id);
    assert.equal(done.ok,true,JSON.stringify(done));
  }
  assert.equal(done.completed,true,JSON.stringify(done));return done;
}
function installTable(s,a){
  const made=make(s,a,'CRAFTING_TABLE_LV1');
  const cell=[[0,-1],[-1,0],[1,0],[0,1]].map(([dx,dy])=>({x:a.x+dx,y:a.y+dy})).find(p=>
    walkable(s,p.x,p.y)&&!s.nodes.some(n=>n.x===p.x&&n.y===p.y)&&!s.buildings.some(b=>b.x===p.x&&b.y===p.y));
  assert.ok(cell);
  const placed=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:made.itemId,...cell});
  assert.equal(placed.ok,true,JSON.stringify(placed));a.x=cell.x;a.y=cell.y;return placed.stationId;
}
function giveLegacyItem(s,a,kind){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
}
function buildOneCellHouse(s,a){
  const site=houseSite(s,walkable);assert.ok(site&&!site.existing);
  a.x=site.origin.x;a.y=site.origin.y;
  const hammer=giveLegacyItem(s,a,'HAMMER');
  assert.equal(command(s,'EQUIP_ITEM',{agentId:a.id,itemId:hammer}).ok,true);
  const place=(kind,socket)=>{
    const itemInstanceId=giveLegacyItem(s,a,kind);
    const r=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId,socket,
      placementId:placementIdFor(s.tick,a.id,itemInstanceId)});
    assert.equal(r.ok,true,JSON.stringify(r));return r;
  };
  const {x,y}=site.origin;
  place('WOOD_FOUNDATION',{type:'cell',x,y,level:0});
  place('WOOD_WALL',canonicalEdge(x,y,'N'));
  place('WOOD_WALL',canonicalEdge(x,y,'E'));
  place('WOOD_WALL',canonicalEdge(x,y,'W'));
  place('WOOD_DOORWAY',canonicalEdge(x,y,'S'));
  const last=place('WOOD_ROOF',{type:'cell',x,y,level:2});
  assert.ok(last.completedHouse);return last.completedHouse;
}
function earnCrafterFamily(s,a){
  make(s,a,'STONE_AXE');make(s,a,'STONE_AXE');
  assert.equal(knowsCraftRecipe(s,a,'STONE_AXE_T1'),true);
  installTable(s,a);
  make(s,a,'STONE_AXE_T1');make(s,a,'STONE_AXE_T1');
  assert.equal(knowsCraftRecipe(s,a,'STONE_AXE_T2'),true);
  s.rustMaterials.ironIngot=20;
  make(s,a,'STONE_AXE_T2');make(s,a,'STONE_AXE_T2');
  assert.equal(recipeMastery(a,'STONE_AXE'),2);
  assert.equal(recipeMastery(a,'STONE_AXE_T1'),2);
  assert.equal(recipeMastery(a,'STONE_AXE_T2'),2);
}

test('RC5 G1 module is read-only and versioned',()=>{
  const source=fs.readFileSync(new URL('../src/crafter-career.mjs',import.meta.url),'utf8');
  assert.equal(CRAFTER_CAREER_VERSION,'RC5-career-g1/1');
  assert.doesNotMatch(source,/\badoptProfession\b|\bcommand\s*\(|Math\.random\s*\(|Date\.now\s*\(|localStorage|document\./);
});

test('initial or inherited BUILD skill is not accepted as construction work',()=>{
  const {s,a}=fresh();
  const evidence=crafterConstructionEvidence(s,a);
  assert.equal(evidence.state,'ABSENT');
  assert.equal(evidence.buildEarnedXP,0);
  assert.equal(crafterQualificationProjection(s,a.id).reason,'construction-required');
});

test('real manual modular-house placement is construction evidence even without BUILD earnedXP',()=>{
  const {s,a}=fresh();const before=a.skillProvenance.bySkill.BUILD.earnedXP;
  buildOneCellHouse(s,a);
  const evidence=crafterConstructionEvidence(s,a);
  assert.equal(before,0);assert.equal(a.skillProvenance.bySkill.BUILD.earnedXP,0);
  assert.equal(evidence.state,'CONFIRMED');
  assert.ok(evidence.completedHousePiecesPlaced>=1);
  assert.deepEqual(validate(s),[]);
});

test('construction alone does not qualify a Crafter',()=>{
  const {s,a}=fresh();buildOneCellHouse(s,a);
  const q=crafterQualificationProjection(s,a.id);
  assert.equal(q.state,'VIOL');assert.equal(q.reason,'craft-experience-required');
});

test('six verified same-family completions including two T2 qualify the read model',()=>{
  const {s,a}=fresh();buildOneCellHouse(s,a);earnCrafterFamily(s,a);
  const profile=crafterFamilyProfile(s,a,'STONE_AXE');
  assert.equal(profile.state,'CONFIRMED');
  assert.equal(profile.total,CRAFTER_QUALIFICATION_POLICY.minFamilyCompletions);
  assert.deepEqual(profile.counts.slice(0,3),[2,2,2]);
  assert.equal(profile.grade,'CRAFTER');assert.equal(profile.maxNewTier,3);
  const q=crafterQualificationProjection(s,a.id);
  assert.equal(q.state,'SAT');assert.equal(q.proposedProfession,'crafter');
  assert.equal(q.bestFamily.outputKind,'STONE_AXE');assert.equal(q.commitAllowed,false);
  assert.equal(a.profession,'builder');
  assert.deepEqual(validate(s),[]);
});

test('projection reads do not mutate world bytes',()=>{
  const {s,a}=fresh();buildOneCellHouse(s,a);earnCrafterFamily(s,a);
  const before=serialize(s);
  crafterConstructionEvidence(s,a);crafterFamilyProfile(s,a,'STONE_AXE');crafterQualificationProjection(s,a.id);
  assert.equal(serialize(s),before);
});

test('advanced recipe knowledge without completed work does not count as mastery',()=>{
  const {s,a}=fresh();buildOneCellHouse(s,a);
  const b=s.agents[1];b.x=a.x;b.y=a.y;
  // Teacher actually unlocks T1; student receives only knowledge.
  make(s,a,'STONE_AXE');make(s,a,'STONE_AXE');
  const taught=command(s,'TEACH_CRAFT_RECIPE',{teacherId:a.id,studentId:b.id,recipeId:'STONE_AXE_T1'});
  assert.equal(taught.ok,true);assert.equal(knowsCraftRecipe(s,b,'STONE_AXE_T1'),true);
  assert.equal(recipeMastery(b,'STONE_AXE_T1'),0);
});

test('owning items made by somebody else never creates recipe mastery',()=>{
  const {s,a}=fresh();buildOneCellHouse(s,a);
  const maker=s.agents[1];
  for(let i=0;i<6;i++)s.rustPossessions.items.push({
    id:s.rustPossessions.nextItem++,kind:'STONE_AXE',createdBy:maker.id,createdTick:s.tick,
    location:{kind:'bag',agentId:a.id}
  });
  const p=crafterFamilyProfile(s,a,'STONE_AXE');
  assert.equal(p.total,0);assert.equal(crafterQualificationProjection(s,a.id).reason,'craft-experience-required');
});

test('unrelated family work never qualifies the empty family',()=>{
  const {s,a}=fresh();earnCrafterFamily(s,a);
  assert.equal(crafterFamilyProfile(s,a,'STONE_AXE').grade,'CRAFTER');
  const hammer=crafterFamilyProfile(s,a,'HAMMER');
  assert.equal(hammer.total,0);assert.equal(hammer.grade,'APPRENTICE');
});

test('malformed BUILD provenance fails closed even when a completed house exists',()=>{
  const {s,a}=fresh();buildOneCellHouse(s,a);
  a.skillProvenance.bySkill.BUILD.earnedXP=5;
  const e=crafterConstructionEvidence(s,a);
  assert.equal(e.state,'UNKNOWN');assert.equal(e.reason,'build-provenance-invalid');
  assert.equal(crafterQualificationProjection(s,a.id).state,'UNKNOWN');
});

test('malformed recipe receipt fails closed rather than counting apparent mastery',()=>{
  const {s,a}=fresh();buildOneCellHouse(s,a);earnCrafterFamily(s,a);
  const entry=a.knowledgeState.recipes.entries.find(x=>x.recipeId==='STONE_AXE_T2');
  entry.receipts[0].orderId=1;
  const p=crafterFamilyProfile(s,a,'STONE_AXE');
  assert.equal(p.state,'UNKNOWN');assert.equal(p.reason,'recipe-evidence-invalid');
  assert.equal(crafterQualificationProjection(s,a.id).state,'UNKNOWN');
});

for(const profession of ['merchant','adventurer']){
  test(`special profession ${profession} is never proposed for Crafter overwrite`,()=>{
    const {s,a}=fresh();buildOneCellHouse(s,a);earnCrafterFamily(s,a);a.profession=profession;
    const q=crafterQualificationProjection(s,a.id);
    assert.equal(q.state,'VIOL');assert.equal(q.reason,'special-profession-lock');
  });
}

test('other worker profession must return to canonical Builder before Crafter qualification',()=>{
  const {s,a}=fresh();buildOneCellHouse(s,a);earnCrafterFamily(s,a);a.profession='miner';
  const q=crafterQualificationProjection(s,a.id);
  assert.equal(q.state,'VIOL');assert.equal(q.reason,'builder-required');
});

test('compacted recipe receipts retain exact family mastery without a second XP ledger',()=>{
  const {s,a}=fresh();
  for(let i=0;i<12;i++)make(s,a,'STONE_AXE');
  const entry=a.knowledgeState.recipes.entries.find(x=>x.recipeId==='STONE_AXE');
  assert.ok(entry.retiredCompletions>0);
  const p=crafterFamilyProfile(s,a,'STONE_AXE');
  assert.equal(p.counts[0],12);assert.equal(p.total,12);
  // T0 grinding alone still cannot create Crafter grade.
  assert.equal(p.grade,'APPRENTICE');
});

test('qualification survives engine save/load without creating state',()=>{
  const {s,a}=fresh();buildOneCellHouse(s,a);earnCrafterFamily(s,a);
  const before=crafterQualificationProjection(s,a.id);
  const saved=serialize(s),loaded=restore(saved);
  assert.equal(serialize(loaded),saved);
  assert.deepEqual(crafterQualificationProjection(loaded,a.id),before);
});

test('dead/archive and missing identities fail closed',()=>{
  const {s,a}=fresh();
  a.alive=false;s.archive.push(a);s.agents=s.agents.filter(x=>x!==a);
  assert.equal(crafterQualificationProjection(s,a.id).reason,'actor-dead');
  assert.equal(crafterQualificationProjection(s,999999).reason,'actor-missing');
  assert.equal(crafterQualificationProjection(s,null).state,'UNKNOWN');
});

test('family id is exact and caller objects are never coerced or frozen',()=>{
  const {s,a}=fresh(),fake={toString:()=> 'STONE_AXE'};
  assert.equal(crafterFamilyProfile(s,a,'__proto__').state,'UNKNOWN');
  assert.equal(crafterFamilyProfile(s,a,fake).state,'UNKNOWN');
  assert.equal(Object.isFrozen(fake),false);
  for(const id of STARTER_RECIPE_IDS)assert.ok(recipeById(id));
});
