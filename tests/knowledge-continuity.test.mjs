import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,command,step,serialize,restore,validate,living,findPerson} from '../src/engine.mjs';
import {allPeople} from '../src/history.mjs';

// Separate policy proof. The original untouched 120/1800-year fixtures remain in force.
// This fixture changes only two explicitly available engine settings at tick zero:
// personal planning and a paid camp archive. No food/XP/age/population injection.
for(const seed of [230926,1,42,2026,90001])test(`local knowledge and archive continue across 120 years (seed ${seed})`,()=>{
  const s=createWorld(seed);
  assert.equal(command(s,'SET_PLANNING_POLICY',{policy:'local'}).ok,true);
  assert.equal(command(s,'CREATE_ARCHIVE').ok,true);
  let minPopulation=living(s).length;
  for(let year=1;year<=120;year++){
    step(s,360);assert.deepEqual(validate(s),[]);
    minPopulation=Math.min(minPopulation,living(s).length);
    assert.ok(living(s).length>0,`extinct in year ${year}`);
    if([30,90].includes(year)){
      const a=restore(serialize(s)),b=restore(serialize(s));step(a,360);for(let i=0;i<360;i++)step(b);
      assert.equal(serialize(a),serialize(b));assert.deepEqual(validate(a),[]);
    }
  }
  const people=allPeople(s);
  assert.equal(s.stats.cloned,0);assert.ok(people.some(a=>a.generation>=2));
  assert.ok(people.some(a=>a.death?.cause==='age'));
  assert.ok(s.culture.entries.length>0&&s.culture.entries.length<=16);
  assert.ok(s.culture.entries.some(e=>!findPerson(s,e.authorId).alive),'written knowledge outlives an author');
  assert.ok(people.some(a=>a.knowledgeState.evidence.some(e=>e.channel==='archive')),'archive reading is exercised');
  assert.equal(serialize(restore(serialize(s))),serialize(s));
  console.log(JSON.stringify({seed,years:120,result:'SAT',minPopulation,population:living(s).length,
    maxGeneration:Math.max(...people.map(a=>a.generation)),entries:s.culture.entries.length,
    starvationDeaths:people.filter(a=>a.death?.cause==='starvation').length,
    saveCharacters:serialize(s).length}));
});
