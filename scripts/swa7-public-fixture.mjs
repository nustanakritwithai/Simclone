import {createWorld,serialize,validate} from '../src/engine.mjs';
import {recordEarnedSkill} from '../src/skill-provenance.mjs';
import {adventureXpForLevel} from '../src/adventure-progression.mjs';
import {adoptProfession} from '../src/kingdom-utility.mjs';

const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:1});
const a=s.agents[0];
s.tick=2;
a.adventurerQualification={version:1,accepted:3,recent:[
  {id:'0:1:1',tick:0,x:1,y:1},
  {id:'1:1:2',tick:1,x:1,y:2},
  {id:'2:2:2',tick:2,x:2,y:2}
]};
const career=adoptProfession(a,'EXPLORE',s.tick,{qualifiedProfession:'adventurer',qualification:'explore-3'});
if(!career.changed&&a.profession!=='adventurer')throw new Error('SWA7 fixture profession');
const targetXp=adventureXpForLevel(60),delta=targetXp-a.skills.ADVENTURE;
if(delta>0){
  a.skills.ADVENTURE+=delta;
  if(!recordEarnedSkill(a,'ADVENTURE',delta,s.tick,{action:'SWA7_PUBLIC_FIXTURE'}))throw new Error('SWA7 fixture provenance');
}
a.task=null;
a.adventureEncounter=null;
a.adventureCombat=null;
a.satiety=100;
a.energy=100;
a.hp=100;
const errors=validate(s);
if(errors.length)throw new Error('SWA7 fixture invalid: '+errors.join(', '));
process.stdout.write(serialize(s));
