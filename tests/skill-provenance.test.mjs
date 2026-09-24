import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  VERSION,SAVE_VERSION,SKILL_PROVENANCE_VERSION,SKILLS,
  createWorld,command,step,serialize,restore,validate,findPerson
} from '../src/engine.mjs';
import {RULES} from '../src/survival.mjs';

const totals=p=>p.initialXP+p.inheritedXP+p.earnedXP+p.legacyUnattributedXP;

test('V0.4.0 creates exact starting provenance for Original and initial descendants',()=>{
  const s=createWorld(42),original=s.agents[0];
  assert.equal(VERSION,'0.5.0');assert.equal(SAVE_VERSION,'0.5.0');assert.equal(SKILL_PROVENANCE_VERSION,'0.4.0');
  for(const k of SKILLS){
    const p=original.skillProvenance.bySkill[k];
    assert.equal(p.initialXP,original.skills[k]);assert.equal(p.inheritedXP,0);assert.equal(p.earnedXP,0);assert.equal(p.legacyUnattributedXP,0);
    assert.equal(totals(p),original.skills[k]);
    assert.ok(p.evidence.some(e=>e.kind==='initial'&&e.xp===original.skills[k]&&e.sourceAgentId===null));
  }
  for(const child of s.agents.slice(1)){
    for(const k of SKILLS){
      const p=child.skillProvenance.bySkill[k];
      assert.equal(p.initialXP,0);assert.equal(p.inheritedXP,child.skills[k]);assert.equal(p.earnedXP,0);assert.equal(p.legacyUnattributedXP,0);
      assert.equal(totals(p),child.skills[k]);
      assert.ok(p.evidence.some(e=>e.kind==='inheritance'&&e.sourceAgentId===original.id&&e.xp===child.skills[k]));
    }
  }
});

test('manual clone provenance records exact parent snapshot without changing inheritance balance',()=>{
  const s=createWorld(7),parent=s.agents[2];parent.skills.MINE=205;
  parent.skillProvenance.bySkill.MINE.initialXP=0;
  parent.skillProvenance.bySkill.MINE.inheritedXP=21;
  parent.skillProvenance.bySkill.MINE.earnedXP=184;
  parent.skillProvenance.bySkill.MINE.legacyUnattributedXP=0;
  s.stock.food=999;s.stock.wood=999;
  const r=command(s,'CLONE',{parentId:parent.id}),child=s.agents.at(-1);
  assert.equal(r.ok,true);assert.equal(child.skills.MINE,Math.floor(205*.35));
  const p=child.skillProvenance.bySkill.MINE;
  assert.equal(p.inheritedXP,child.skills.MINE);assert.equal(p.earnedXP,0);assert.equal(totals(p),child.skills.MINE);
  assert.deepEqual(p.evidence.filter(e=>e.kind==='inheritance').map(e=>[e.sourceAgentId,e.tick,e.xp]),[[parent.id,child.bornTick,child.skills.MINE]]);
});

test('real productive outcome records +5 earned XP and evidence exactly once',()=>{
  const s=createWorld(9),a=s.agents[0];
  s.tiles.fill('grass');s.nodes=[{id:1,type:'food',x:a.x,y:a.y,amount:10,max:10}];
  s.stock.food=0;a.preference='FORAGE';a.satiety=80;a.energy=100;
  a.task={policy:RULES.jobPolicy,kind:'FORAGE',targetId:1,x:a.x,y:a.y,path:[],work:100,score:100,started:s.tick};
  const before=a.skills.FORAGE,earned=a.skillProvenance.bySkill.FORAGE.earnedXP;
  step(s);
  assert.equal(a.skills.FORAGE,before+5);
  const p=a.skillProvenance.bySkill.FORAGE;
  assert.equal(p.earnedXP,earned+5);assert.equal(totals(p),a.skills.FORAGE);
  const work=p.evidence.filter(e=>e.kind==='work'&&e.action==='FORAGE');
  assert.equal(work.length,1);assert.equal(work.at(-1).xp,5);assert.equal(work.at(-1).targetId,1);
});

test('zero-output gathering creates neither XP nor provenance evidence',()=>{
  const s=createWorld(10),a=s.agents[0];
  s.tiles.fill('grass');s.nodes=[{id:1,type:'wood',x:a.x,y:a.y,amount:10,max:10}];
  s.stock.wood=999;a.preference='WOODCUT';a.satiety=100;a.energy=100;a.task=null;
  const beforeXP=a.skills.WOODCUT,before=JSON.stringify(a.skillProvenance.bySkill.WOODCUT);
  step(s,30);
  assert.equal(a.skills.WOODCUT,beforeXP);
  assert.equal(JSON.stringify(a.skillProvenance.bySkill.WOODCUT),before);
});

test('0.3.0 save migration attributes existing XP as legacy-unattributed without guessing',()=>{
  const current=createWorld(12),raw=JSON.parse(serialize(current));
  raw.version='0.3.0';
  for(const a of [...raw.agents,...raw.archive])delete a.skillProvenance;
  const migrated=restore(JSON.stringify(raw));
  assert.equal(migrated.version,SAVE_VERSION);
  for(const a of [...migrated.agents,...migrated.archive])for(const k of SKILLS){
    const p=a.skillProvenance.bySkill[k];
    assert.equal(p.initialXP,0);assert.equal(p.inheritedXP,0);assert.equal(p.earnedXP,0);
    assert.equal(p.legacyUnattributedXP,a.skills[k]);assert.equal(totals(p),a.skills[k]);
  }
  assert.deepEqual(validate(migrated),[]);
});

test('real legacy 0.3.3 fixture migrates lifecycle/history and skill provenance without XP drift',()=>{
  const text=readFileSync(new URL('./fixtures/legacy-0.3.3-save.json',import.meta.url),'utf8'),raw=JSON.parse(text);
  const migrated=restore(text);
  const before=new Map(raw.agents.map(a=>[a.id,a.skills]));
  for(const a of [...migrated.agents,...migrated.archive]){
    assert.deepEqual(a.skills,before.get(a.id));
    for(const k of SKILLS){const p=a.skillProvenance.bySkill[k];assert.equal(p.legacyUnattributedXP,a.skills[k]);assert.equal(totals(p),a.skills[k]);}
  }
});

test('skill provenance survives death/archive and resolves an archived parent source',()=>{
  const s=createWorld(15),parent=s.agents[0];s.stock.food=999;s.stock.wood=999;
  const r=command(s,'CLONE',{parentId:parent.id}),child=s.agents.find(a=>a.id===r.agentId);
  parent.satiety=0;parent.hp=.1;
  step(s);
  while(s.agents.length<64){
    const p=s.agents.find(a=>a.alive); if(!p)break;
    const fake={...JSON.parse(JSON.stringify(parent)),id:s.nextAgent++,name:'Retired '+s.nextAgent,parentId:null,generation:0,bornTick:0,alive:false,hp:0,task:null,moveTick:0,trace:[],death:{status:'recorded',tick:s.tick,cause:'starvation',ageYears:18}};
    s.agents.push(fake);
  }
  s.stock.food=999;s.stock.wood=999;
  command(s,'CLONE',{parentId:child.id});
  const archivedParent=findPerson(s,parent.id);
  assert.equal(archivedParent?.archived,true);
  const inherited=child.skillProvenance.bySkill.FORAGE.evidence.find(e=>e.kind==='inheritance');
  assert.equal(inherited.sourceAgentId,parent.id);assert.equal(findPerson(s,inherited.sourceAgentId).id,parent.id);
  const saved=restore(serialize(s)),restoredChild=findPerson(saved,child.id);
  assert.deepEqual(restoredChild.skillProvenance,child.skillProvenance);
  assert.deepEqual(validate(saved),[]);
});
