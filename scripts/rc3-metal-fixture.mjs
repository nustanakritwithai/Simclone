/** Prepared valid RC3.2 browser scenario. Resources/stations are QA setup, not autonomous achievement evidence. */
import {createWorld,command,serialize,validate,walkable} from '../src/engine.mjs';
import {advanceCraft} from '../src/rust-possessions.mjs';
import {resourceStock} from '../src/individual-resources.mjs';

const s=createWorld(230926,{mode:'independent',worldProfile:'same-world',population:1}),a=s.agents[0],stock=resourceStock(s,a);
Object.assign(stock,{food:100,wood:300,stone:300,charcoal:20,ironOre:20,ironIngot:10,steelIngot:10});
a.satiety=100;a.energy=100;a.hp=100;a.task=null;
function finishCraft(){
  const o=s.rustPossessions.orders.find(o=>o.agentId===a.id);if(!o)throw new Error('fixture order');
  let result;for(let i=0;i<o.required+2;i++){s.tick++;result=advanceCraft(s,a.id);if(result.completed)break;}
  if(!result?.completed)throw new Error('fixture craft '+JSON.stringify(result));
  return s.rustPossessions.items.find(i=>i.id===result.itemId);
}
function craft(recipeId){const q=command(s,'CRAFT_ITEM',{agentId:a.id,recipeId});if(!q.ok)throw new Error('fixture queue '+recipeId+' '+JSON.stringify(q));return finishCraft();}
function freeNear(){
  for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1],[2,0],[0,2],[-2,0],[0,-2]]){
    const x=a.x+dx,y=a.y+dy;
    if(walkable(s,x,y)&&!s.nodes.some(n=>n.x===x&&n.y===y)&&!s.rustStations.stations.some(st=>st.x===x&&st.y===y))return {x,y};
  }
  throw new Error('fixture station cell');
}
const tableItem=craft('CRAFTING_TABLE_LV1'),tablePos=freeNear();
const table=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:tableItem.id,...tablePos});if(!table.ok)throw new Error('fixture table '+JSON.stringify(table));
a.x=tablePos.x;a.y=tablePos.y;
const furnaceItem=craft('FURNACE'),furnacePos=freeNear();
const furnace=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:furnaceItem.id,...furnacePos});if(!furnace.ok)throw new Error('fixture furnace '+JSON.stringify(furnace));
a.x=tablePos.x;a.y=tablePos.y;
craft('STONE_AXE');craft('STONE_AXE');craft('STONE_AXE_T1');craft('STONE_AXE_T1');
Object.assign(stock,{food:100,wood:300,stone:300,charcoal:20,ironOre:20,ironIngot:10,steelIngot:10});
a.task=null;a.satiety=100;a.energy=100;a.hp=100;
const errors=validate(s);if(errors.length)throw new Error(errors.join(','));
process.stdout.write(serialize(s));
