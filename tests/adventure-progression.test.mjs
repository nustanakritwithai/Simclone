import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate,SKILLS,ADVENTURE_SKILLS,ALL_SKILLS} from '../src/engine.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {recordEarnedSkill,provenanceTotal} from '../src/skill-provenance.mjs';
import {
  ADVENTURE_SKILL,ADVENTURE_LEVEL_MAX,ADVENTURE_XP_SCALE,
  adventureXpForLevel,adventureLevelFromXp,adventureProgressionSnapshot,
  validateAdventureProgression
} from '../src/adventure-progression.mjs';
import {RULES} from '../src/survival.mjs';

test('I1 Adventure level is deterministic 1..60 and extends the existing square-root skill curve',()=>{
  assert.equal(ADVENTURE_XP_SCALE,20);
  assert.equal(adventureXpForLevel(1),0);
  assert.equal(adventureXpForLevel(2),20);
  assert.equal(adventureXpForLevel(60),69620);
  assert.equal(adventureLevelFromXp(0),1);
  assert.equal(adventureLevelFromXp(19),1);
  assert.equal(adventureLevelFromXp(20),2);
  assert.equal(adventureLevelFromXp(69619),59);
  assert.equal(adventureLevelFromXp(69620),60);
  assert.equal(adventureLevelFromXp(999999),ADVENTURE_LEVEL_MAX);
});

test('fresh Independent Clones have one canonical ADVENTURE skill and provenance bucket at level 1',()=>{
  const s=createWorld(3101,{mode:'independent'}),a=s.agents[0];
  assert.deepEqual(SKILLS,['FORAGE','WOODCUT','MINE','BUILD']);
  assert.deepEqual(ADVENTURE_SKILLS,[ADVENTURE_SKILL]);
  assert.ok(ALL_SKILLS.includes(ADVENTURE_SKILL));
  assert.equal(a.skills.ADVENTURE,0);
  const bucket=a.skillProvenance.bySkill.ADVENTURE;
  assert.equal(provenanceTotal(bucket),0);
  assert.deepEqual(adventureProgressionSnapshot(a),{
    version:'adventure-progression/v1',skill:'ADVENTURE',xp:0,level:1,levelMin:1,levelMax:60,
    levelFloorXp:0,nextLevelXp:20,xpIntoLevel:0,xpToNext:20
  });
  assert.deepEqual(validateAdventureProgression(a),[]);
  assert.deepEqual(validate(s),[]);
});

test('new Clone inherits 35 percent of canonical Adventure XP through the existing skill provenance envelope',()=>{
  const s=createWorld(3102,{mode:'independent',population:1}),parent=s.agents[0];
  parent.skills.ADVENTURE+=80;
  assert.equal(recordEarnedSkill(parent,'ADVENTURE',80,s.tick,{action:'TEST_VERIFIED_ADVENTURE'}),true);
  const stock=resourceStock(s,parent);stock.food=100;stock.wood=100;
  const r=command(s,'CLONE',{parentId:parent.id});
  assert.equal(r.ok,true);
  const child=s.agents.find(a=>a.id===r.agentId);
  assert.equal(child.skills.ADVENTURE,28);
  const bucket=child.skillProvenance.bySkill.ADVENTURE;
  assert.equal(bucket.inheritedXP,28);
  assert.equal(bucket.evidence[0].kind,'inheritance');
  assert.equal(bucket.evidence[0].sourceAgentId,parent.id);
  assert.equal(provenanceTotal(bucket),28);
  assert.equal(adventureProgressionSnapshot(child).level,2);
  assert.deepEqual(validate(s),[]);
});

test('current Independent saves without I1 fields migrate deterministically to Adventure XP 0 without guessing history',()=>{
  const s=createWorld(3103,{mode:'independent'}),raw=JSON.parse(serialize(s));
  for(const a of [...raw.agents,...raw.archive]){
    delete a.skills.ADVENTURE;
    delete a.skillProvenance.bySkill.ADVENTURE;
  }
  const a=restore(JSON.stringify(raw)),b=restore(JSON.stringify(raw));
  assert.equal(serialize(a),serialize(b));
  for(const person of [...a.agents,...a.archive]){
    assert.equal(person.skills.ADVENTURE,0);
    assert.equal(provenanceTotal(person.skillProvenance.bySkill.ADVENTURE),0);
    assert.equal(adventureProgressionSnapshot(person).level,1);
  }
  assert.deepEqual(validate(a),[]);
});

test('I1 never repairs conflicting Adventure XP/provenance by inventing evidence',()=>{
  const s=createWorld(3104,{mode:'independent'}),raw=JSON.parse(serialize(s));
  raw.agents[0].skills.ADVENTURE=20;
  assert.throws(()=>restore(JSON.stringify(raw)),/Skill provenance total|Adventure progression provenance/);
});

test('ADV0 qualification completion does not award Adventure XP before the verified reward gate exists',()=>{
  const s=createWorld(3105,{mode:'independent',population:1}),a=s.agents[0];
  a.satiety=100;a.energy=100;a.hp=100;
  const before=a.skills.ADVENTURE;
  a.task={kind:'EXPLORE',targetId:null,x:a.x,y:a.y,path:[],work:5,started:s.tick,score:1,policy:RULES.jobPolicy};
  step(s,1);
  assert.equal(a.adventurerQualification.accepted,1);
  assert.equal(a.skills.ADVENTURE,before);
  assert.equal(adventureProgressionSnapshot(a).level,1);
  assert.deepEqual(validate(s),[]);
});
