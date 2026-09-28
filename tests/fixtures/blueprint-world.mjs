/** Prepared valid QA scenario, not autonomous acquisition evidence. */
import {createWorld,command,step,validate} from '../../src/engine.mjs';
import {adoptProfession} from '../../src/kingdom-utility.mjs';
import {recordEarnedSkill} from '../../src/skill-provenance.mjs';
import {adventureXpForLevel} from '../../src/adventure-progression.mjs';
export function blueprintWorld(seed=42,population=2){
  const s=createWorld(seed,{mode:'independent',worldProfile:'same-world',population});
  const a=s.agents[0];s.tick=2;
  a.adventurerQualification={version:1,accepted:3,recent:[
    {id:'0:1:1',tick:0,x:1,y:1},{id:'1:1:2',tick:1,x:1,y:2},{id:'2:2:2',tick:2,x:2,y:2}]};
  adoptProfession(a,'EXPLORE',s.tick,{qualifiedProfession:'adventurer',qualification:'explore-3'});
  const xp=adventureXpForLevel(60)-a.skills.ADVENTURE;a.skills.ADVENTURE+=xp;
  if(!recordEarnedSkill(a,'ADVENTURE',xp,s.tick,{action:'RC31_QA_FIXTURE'}))throw new Error('fixture skill');
  a.task=null;a.satiety=100;a.energy=100;a.hp=100;
  const errors=validate(s);if(errors.length)throw new Error(errors.join(','));
  return s;
}
export function firstBlueprintTarget(s){return s.wildMonsters.entities.filter(m=>m.zoneId==='z1').sort((a,b)=>a.worldMonsterId<b.worldMonsterId?-1:1)[0];}
export function reachBlueprintCombat(s){
  const a=s.agents[0],m=firstBlueprintTarget(s),before={x:a.x,y:a.y};
  const hunt=command(s,'START_ADVENTURE_HUNT',{agentId:a.id,worldMonsterId:m.worldMonsterId});
  if(!hunt.ok||a.x!==before.x||a.y!==before.y)throw new Error('fixture Hunt failed / teleported');
  let n=0;while(!a.adventureEncounter&&n++<2500)step(s);
  if(!a.adventureEncounter)throw new Error('fixture READY');
  const start=command(s,'START_ADVENTURE_COMBAT',{agentId:a.id});if(!start.ok)throw new Error('fixture combat '+start.reason);
  return {a,m,hunt};
}
export function winBlueprintCombat(s){
  const a=s.agents[0];let n=0;
  while(a.adventureCombat?.status==='ACTIVE'&&n++<100){
    const r=command(s,'ADVENTURE_COMBAT_ACTION',{agentId:a.id,action:'BASIC_ATTACK',expectedTurn:a.adventureCombat.turn});
    if(!r.ok)throw new Error('fixture attack '+r.reason);
  }
  if(a.adventureCombat?.status!=='VICTORY')throw new Error('fixture victory');
  const errors=validate(s);if(errors.length)throw new Error(errors.join(','));
  return a.adventureCombat;
}
