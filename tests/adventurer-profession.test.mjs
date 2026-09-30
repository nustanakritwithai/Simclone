import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,serialize,restore,validate,childLife,walkable} from '../src/engine.mjs';
import {RULES} from '../src/survival.mjs';
import {adoptProfession,ensureProfession,noteExploreCompletion,professionForAction,validateAdventurerQualification} from '../src/kingdom-utility.mjs';

function adult(seed=11){
  const s=createWorld(seed),a=s.agents[0];
  a.satiety=100;a.energy=100;a.hp=100;
  return {s,a};
}
function finishExplore(s,a,{started=s.tick,knowledgeKey,purposeKind}={}){
  a.satiety=100;a.energy=100;
  a.task={kind:'EXPLORE',targetId:null,x:a.x,y:a.y,path:[],work:5,started,score:1,policy:RULES.jobPolicy};
  if(knowledgeKey)a.task.knowledgeKey=knowledgeKey;
  if(purposeKind)a.task.purposeKind=purposeKind;
  step(s,1);
}

test('EXPLORE has no profession mapping and one completion does not adopt',()=>{
  assert.equal(professionForAction('EXPLORE'),null);
  const {s,a}=adult();
  const before=a.profession;
  finishExplore(s,a);
  assert.equal(a.profession,before);
  assert.equal(a.adventurerQualification.accepted,1);
  assert.equal(a.adventurerQualification.recent.length,1);
  assert.notEqual(a.profession,'adventurer');
  assert.deepEqual(validate(s),[]);
});

test('resource-purpose exploration does not count toward Adventurer qualification',()=>{
  const {s,a}=adult(17),before=a.profession;
  for(let i=0;i<4;i++)finishExplore(s,a,{purposeKind:'WOODCUT'});
  assert.equal(a.adventurerQualification,undefined);
  assert.equal(a.profession,before);
  assert.deepEqual(validate(s),[]);
});

test('the third distinct explore completion adopts adventurer and a replay does not',()=>{
  const {s,a}=adult(19);
  const started=s.tick;
  finishExplore(s,a,{started});
  finishExplore(s,a,{started});
  assert.equal(a.adventurerQualification.accepted,1);
  finishExplore(s,a);
  finishExplore(s,a);
  assert.equal(a.profession,'adventurer');
  assert.equal(a.adventurerQualification.accepted,3);
  assert.equal(professionForAction('EXPLORE'),null);
  const career=a.career.length;
  adoptProfession(a,'FORAGE',s.tick);
  adoptProfession(a,'WOODCUT',s.tick);
  adoptProfession(a,'MINE',s.tick);
  adoptProfession(a,'BUILD',s.tick);
  assert.equal(a.profession,'adventurer');
  assert.equal(a.career.length,career);
  assert.ok(a.career.length<=8);
  assert.deepEqual(validate(s),[]);
});

test('qualification audit tail keeps the latest eight while accepted saturates at three',()=>{
  const a={preference:'FORAGE',skills:{FORAGE:4,WOODCUT:1,MINE:1,BUILD:1},profession:'forager',professionSinceTick:0,career:[{tick:0,profession:'forager'}]};
  for(let i=0;i<10;i++){
    const noted=noteExploreCompletion(a,{kind:'EXPLORE',tick:i+1,x:i,y:1,started:i,alive:true,productive:true,knowledge:'none'});
    assert.equal(noted.counted,true);
  }
  assert.equal(a.profession,'adventurer');
  assert.equal(a.adventurerQualification.accepted,3);
  assert.equal(a.adventurerQualification.recent.length,8);
  assert.equal(a.adventurerQualification.recent[0].id,'2:2:1');
  assert.equal(a.adventurerQualification.recent.at(-1).id,'9:9:1');
  assert.equal(a.career.filter(row=>row.profession==='adventurer').length,1);
  assert.deepEqual(validateAdventurerQualification(a,10),[]);
  const before=JSON.stringify(a.adventurerQualification);
  const duplicate=noteExploreCompletion(a,{kind:'EXPLORE',tick:10,x:9,y:1,started:9,alive:true,productive:true,knowledge:'none'});
  assert.equal(duplicate.counted,false);
  assert.equal(JSON.stringify(a.adventurerQualification),before);
});

test('qualification validator rejects accepted counts unsupported by retained evidence',()=>{
  const bad={adventurerQualification:{version:1,accepted:3,recent:[{id:'0:1:1',tick:1,x:1,y:1}]}};
  assert.deepEqual(validateAdventurerQualification(bad,3),['Adventurer qualification']);
});

test('the four legacy professions still replace one another and invalid explore-3 writes nothing',()=>{
  const worker={preference:'FORAGE',skills:{FORAGE:1,WOODCUT:1,MINE:1,BUILD:1},profession:'forager',professionSinceTick:0,career:[{tick:0,profession:'forager'}]};
  for(const [kind,profession] of [['WOODCUT','woodcutter'],['MINE','miner'],['BUILD','builder'],['FORAGE','forager']]){
    const changed=adoptProfession(worker,kind,worker.career.at(-1).tick+1);
    assert.equal(changed.changed,true);
    assert.equal(worker.profession,profession);
  }
  const candidate={
    preference:'MINE',skills:{FORAGE:1,WOODCUT:1,MINE:9,BUILD:1},
    adventurerQualification:{version:1,accepted:3,recent:[
      {id:'0:1:1',tick:0,x:1,y:1},
      {id:'1:1:2',tick:1,x:1,y:2},
      {id:'2:2:2',tick:2,x:2,y:2},
    ]},
  };
  const before=JSON.stringify(candidate);
  const rejected=adoptProfession(candidate,'EXPLORE',2,{qualifiedProfession:'miner',qualification:'explore-3'});
  assert.equal(rejected.changed,false);
  assert.equal(JSON.stringify(candidate),before);
});

test('failed, unknown, walking, child and dead explores do not count',()=>{
  const failed=adult(23);
  failed.s.tick=11;
  failed.a.satiety=1;
  failed.a.task={kind:'EXPLORE',targetId:null,x:failed.a.x,y:failed.a.y,path:[],work:5,started:11,score:1,policy:RULES.jobPolicy};
  step(failed.s,1);
  assert.equal(failed.a.adventurerQualification,undefined);

  const unknown=adult(29);
  finishExplore(unknown.s,unknown.a,{knowledgeKey:'missing-claim'});
  assert.equal(unknown.a.adventurerQualification,undefined);

  const walking=adult(31);
  const stepCell=[{x:walking.a.x+1,y:walking.a.y},{x:walking.a.x-1,y:walking.a.y},{x:walking.a.x,y:walking.a.y+1},{x:walking.a.x,y:walking.a.y-1}].find(p=>walkable(walking.s,p.x,p.y));
  walking.a.task={kind:'EXPLORE',targetId:null,x:stepCell.x,y:stepCell.y,path:[stepCell],work:5,started:walking.s.tick,score:1,policy:RULES.jobPolicy};
  step(walking.s,1);
  assert.equal(walking.a.adventurerQualification,undefined);

  const child=adult(37);
  child.a.life=childLife(child.s.tick);
  finishExplore(child.s,child.a);
  assert.equal(child.a.adventurerQualification,undefined);
  assert.notEqual(child.a.profession,'adventurer');

  const dead={alive:false,profession:'forager',career:[{tick:0,profession:'forager'}]};
  const noted=noteExploreCompletion(dead,{kind:'EXPLORE',tick:1,x:1,y:1,started:0,alive:false,productive:false,knowledge:'none'});
  assert.equal(noted.counted,false);
  assert.equal(dead.adventurerQualification,undefined);
  assert.equal(dead.profession,'forager');
});

test('qualification save and load is deterministic and the explicit transition is not generic',()=>{
  const {s,a}=adult(41);
  finishExplore(s,a);
  finishExplore(s,a);
  const back=restore(serialize(s));
  const b=back.agents.find(agent=>agent.id===a.id);
  assert.deepEqual(b.adventurerQualification,a.adventurerQualification);
  assert.equal(b.profession,a.profession);
  finishExplore(back,b);
  assert.equal(b.profession,'adventurer');
  const again=restore(serialize(back));
  assert.equal(again.agents.find(agent=>agent.id===a.id).profession,'adventurer');
  assert.deepEqual(validate(again),[]);

  const forager={profession:'forager',professionSinceTick:0,career:[{tick:0,profession:'forager'}],adventurerQualification:{version:1,accepted:3,recent:[{id:'0:1:1',tick:0,x:1,y:1},{id:'1:1:2',tick:1,x:1,y:2},{id:'2:2:2',tick:2,x:2,y:2}]}};
  adoptProfession(forager,'EXPLORE',2,{qualifiedProfession:'miner',qualification:'explore-3'});
  adoptProfession(forager,'EXPLORE',2,{qualifiedProfession:'adventurer',qualification:'explore-3',extra:true});
  adoptProfession(forager,'FORAGE',2,{qualifiedProfession:'adventurer',qualification:'explore-3'});
  assert.equal(forager.profession,'forager');
  adoptProfession(forager,'EXPLORE',2);
  assert.equal(forager.profession,'forager');
  const changed=adoptProfession(forager,'EXPLORE',2,{qualifiedProfession:'adventurer',qualification:'explore-3'});
  assert.equal(changed.changed,true);
  assert.equal(forager.profession,'adventurer');
  const repaired={preference:'MINE',skills:{FORAGE:1,WOODCUT:1,MINE:9,BUILD:1}};
  assert.equal(ensureProfession(repaired,0),'miner');
});
