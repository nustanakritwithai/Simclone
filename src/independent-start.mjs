/** Deterministic no-Camp start. Spawn placement is world generation, not agent omniscience. */
import {INDEPENDENT_MODE,INDEPENDENT_SAVE_VERSION,PERSONAL_MATERIAL_VERSION,HOUSEHOLD_MATERIAL_VERSION,addPersonalStore} from './individual-resources.mjs?v=0.5.0';
import {worldBounds} from './world-bounds.mjs?v=0.5.0';
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const rank=(seed,x,y)=>{let n=(seed^Math.imul(x+1,374761393)^Math.imul(y+1,668265263))>>>0;n^=n>>>13;return Math.imul(n,1274126177)>>>0;};
/** World generation ranks walkable cells with nearby food, wood and stone; agent knowledge is not populated by this lookup. */
export function independentSpawn(s,isWalkable,occupied=[]){
 const bounds=worldBounds(s),options=[];
 const foods=s.nodes.filter(n=>n.type==='food'&&n.amount>0),woods=s.nodes.filter(n=>n.type==='wood'&&n.amount>0),stones=s.nodes.filter(n=>n.type==='stone'&&n.amount>0);
 for(let y=1;y<bounds.h-1;y++)for(let x=1;x<bounds.w-1;x++){
  if(!isWalkable(s,x,y)||s.nodes.some(n=>n.x===x&&n.y===y)||s.rustStations.stations.some(st=>st.x===x&&st.y===y))continue;
  const p={x,y};
  const food=Math.min(...foods.map(n=>distance(p,n))),wood=Math.min(...woods.map(n=>distance(p,n))),stone=Math.min(...stones.map(n=>distance(p,n)));
  if(food>4||wood>4||stone>8)continue;
  const separation=occupied.length?Math.min(...occupied.map(o=>distance(p,o))):12;
  if(separation<5)continue;
  options.push({...p,score:Math.min(12,separation)*12-food*4-wood*2-stone,rank:rank(s.seed,x,y)});
 }
 options.sort((a,b)=>b.score-a.score||a.rank-b.rank||a.y-b.y||a.x-b.x);
 // A bounded crowded world reports no site rather than teleporting onto an illegal cell.
 return options.length?{x:options[0].x,y:options[0].y}:null;
}
export function initializeIndependentStart(s,isWalkable){
 const budget={...s.stock};s.version=INDEPENDENT_SAVE_VERSION;s.worldMode={...INDEPENDENT_MODE};s.buildings=[];s.nextBuilding=1;
 s.rustMaterials.personalVersion=PERSONAL_MATERIAL_VERSION;s.rustMaterials.personalStores=[];
 s.rustMaterials.householdVersion=HOUSEHOLD_MATERIAL_VERSION;s.rustMaterials.householdStores=[];
 const placed=[];
 for(const [i,a] of s.agents.entries()){
  const spawn=independentSpawn(s,isWalkable,placed);if(!spawn)throw new Error('No separated viable spawn for seed '+s.seed);
  a.x=spawn.x;a.y=spawn.y;a.task=null;a.moveTick=0;placed.push(spawn);
  const grant={};for(const k of ['food','wood','stone'])grant[k]=Math.floor(budget[k]/s.agents.length)+(i<budget[k]%s.agents.length?1:0);
  addPersonalStore(s,a,grant);
 }
 s.stock={food:0,wood:0,stone:0};
 // New independent agents use only local resource observations and personal remembered targets.
 return s;
}
