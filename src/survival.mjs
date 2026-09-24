/** Survival 0.2 + Lifecycle 0.3.1: routing/reservations also enforce stage work eligibility. */
import {canPerformProductiveWork} from './lifecycle.mjs?v=0.3.6';
import {autonomousBirthFoodTarget,birthPlan,isAutonomousChild} from './reproduction.mjs?v=0.3.6';
import {allPeople} from './history.mjs?v=0.3.6';
export const RULES = Object.freeze({
  width:30, height:26, moveTicks:3, mealSatiety:48, hungry:35,
  exhausted:12, nodeWorkers:1, builders:2, stockLimit:999,
  jobPolicy:'survival-0.2', jobMaxTicks:2580
});
export const skillLevel = xp => Math.min(10, 1 + Math.floor(Math.sqrt(xp / 20)));
export const RESOURCE_ACTIONS = Object.freeze({FORAGE:'food',WOODCUT:'wood',MINE:'stone'});
export const tileAt = (s,x,y) => s.tiles[y*RULES.width+x];
export const walkable = (s,x,y) => Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<RULES.width&&y<RULES.height&&tileAt(s,x,y)!=='water';

/** One breadth-first search per decision; distances include bridges and detours. */
export function routeField(s,start){
  const size=RULES.width*RULES.height,dist=new Int32Array(size).fill(-1),parent=new Int32Array(size).fill(-1);
  if(!walkable(s,start.x,start.y))return {dist,parent,start:-1};
  const first=start.y*RULES.width+start.x,queue=new Int32Array(size);let head=0,tail=1;
  queue[0]=first;dist[first]=0;parent[first]=first;
  while(head<tail){
    const i=queue[head++],x=i%RULES.width,y=Math.floor(i/RULES.width);
    for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
      const nx=x+dx,ny=y+dy,k=ny*RULES.width+nx;
      if(walkable(s,nx,ny)&&dist[k]===-1){dist[k]=dist[i]+1;parent[k]=i;queue[tail++]=k;}
    }
  }
  return {dist,parent,start:first};
}
export function routeDistance(field,target){
  const {x,y}=target;
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=RULES.width||y>=RULES.height)return -1;
  return field.dist[y*RULES.width+x];
}
export function routeTo(field,target){
  if(routeDistance(field,target)<0)return null;
  const out=[];
  for(let k=target.y*RULES.width+target.x;k!==field.start;k=field.parent[k])out.push({x:k%RULES.width,y:Math.floor(k/RULES.width)});
  return out.reverse();
}
export const pathTo=(s,a,b)=>walkable(s,b.x,b.y)?routeTo(routeField(s,a),b):null;
export function stockTargets(s){
  const n=s.agents.filter(a=>a.alive).length;
  return {food:Math.max(24,n*4,autonomousBirthFoodTarget(s)),wood:Math.max(36,n*3),stone:Math.max(24,n*2)};
}

/** Validate an in-flight contract BEFORE walking, not only at the destination. */
export function taskValid(s,a){
  const t=a.task;
  if(!t||!a.alive||t.policy!==RULES.jobPolicy||!Number.isFinite(t.started)||t.started>s.tick||s.tick-t.started>RULES.jobMaxTicks)return false;
  if(!Array.isArray(t.path)||!walkable(s,t.x,t.y))return false;
  if(t.path.length){
    const next=t.path[0],last=t.path.at(-1);
    if(!walkable(s,next.x,next.y)||Math.abs(a.x-next.x)+Math.abs(a.y-next.y)!==1||last.x!==t.x||last.y!==t.y)return false;
  }else if(a.x!==t.x||a.y!==t.y)return false;
  if(RESOURCE_ACTIONS[t.kind]){
    if(!canPerformProductiveWork(s,a))return false;
    const n=s.nodes.find(n=>n.id===t.targetId);
    return !!n&&n.type===RESOURCE_ACTIONS[t.kind]&&n.x===t.x&&n.y===t.y&&n.amount>0&&s.stock[n.type]<RULES.stockLimit;
  }
  if(t.kind==='BUILD')return canPerformProductiveWork(s,a)&&s.buildings.some(b=>b.id===t.targetId&&!b.complete&&b.x===t.x&&b.y===t.y);
  if(t.kind==='EAT')return s.stock.food>0&&s.buildings.some(b=>b.id===t.targetId&&b.complete&&b.x===t.x&&b.y===t.y);
  if(t.kind==='REST')return t.fieldRest===true||s.buildings.some(b=>b.id===t.targetId&&b.complete&&b.x===t.x&&b.y===t.y);
  return ['IDLE','EXPLORE'].includes(t.kind);
}
export function emptyReservations(){return {nodes:new Map(),buildings:new Map(),meals:new Set()};}
export function claim(book,s,a){
  const t=a.task;
  if(RESOURCE_ACTIONS[t.kind]){
    if(book.nodes.has(t.targetId))return false;
    book.nodes.set(t.targetId,a.id);
  }else if(t.kind==='BUILD'){
    const ids=book.buildings.get(t.targetId)??new Set();
    if(ids.size>=RULES.builders)return false;
    ids.add(a.id);book.buildings.set(t.targetId,ids);
  }else if(t.kind==='EAT'){
    if(book.meals.size>=s.stock.food)return false;
    book.meals.add(a.id);
  }
  return true;
}
export function release(book,a,task){
  if(RESOURCE_ACTIONS[task.kind]&&book.nodes.get(task.targetId)===a.id)book.nodes.delete(task.targetId);
  if(task.kind==='BUILD')book.buildings.get(task.targetId)?.delete(a.id);
  if(task.kind==='EAT')book.meals.delete(a.id);
}
/** Rebuilt from saved tasks each tick: no second source of truth or stale locks. */
export function reservations(s){
  const book=emptyReservations(),rejected=[];
  const workers=s.agents.filter(a=>taskValid(s,a)).sort((a,b)=>a.task.started-b.task.started||a.id-b.id);
  for(const a of workers)if(!claim(book,s,a))rejected.push(a.id);
  return {book,rejected};
}
/** Include already-assigned production before allocating another gather job. */
export function plannedStock(s,book){
  const projected={...s.stock};
  for(const [nodeId,agentId] of book.nodes){
    const n=s.nodes.find(n=>n.id===nodeId),a=s.agents.find(a=>a.id===agentId);
    if(!n||!a?.task)continue;
    const amount=Math.min(n.amount,2+Math.floor(skillLevel(a.skills[a.task.kind])/2));
    const meal=n.type==='food'&&a.satiety<RULES.hungry&&amount>=1?1:0;
    projected[n.type]+=amount-meal;
  }
  return projected;
}
export function survivalSummary(s){
  const agents=s.agents.filter(a=>a.alive),{book}=reservations(s),target=stockTargets(s);
  const freeFood=Math.max(0,s.stock.food-book.meals.size),birth=birthPlan(s,freeFood);
  return {population:agents.length,hungry:agents.filter(a=>a.satiety<RULES.hungry).length,
    exhausted:agents.filter(a=>a.energy<RULES.exhausted).length,
    food:s.stock.food,reservedMeals:book.meals.size,freeFood,
    targets:target,projected:plannedStock(s,book),nodeJobs:book.nodes.size,builders:[...book.buildings.values()].reduce((sum,ids)=>sum+ids.size,0),
    unfinished:s.buildings.filter(b=>!b.complete).length,autonomousBirths:allPeople(s).filter(isAutonomousChild).length,birth:{...birth},
    stock:{...s.stock}};
}
