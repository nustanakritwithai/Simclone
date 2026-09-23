import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld as legacyWorld,step as legacyStep,serialize as legacySerialize} from './fixtures/legacy-engine-0.1.0.mjs';
import {VERSION,SAVE_VERSION,createWorld,step,command,serialize,restore,validate,survivalSummary} from '../src/engine.mjs';
import {RULES,RESOURCE_ACTIONS,routeField,routeTo,routeDistance,reservations,taskValid,stockTargets} from '../src/survival.mjs';
function scenario(n=3){
 const s=createWorld(77);s.tiles.fill('grass');s.nodes=[];s.agents=s.agents.slice(0,n);
 s.stock={food:0,wood:0,stone:0};s.buildings=[{id:1,type:'camp',x:11,y:12,progress:30,complete:true}];
 for(const a of s.agents){a.x=11;a.y=12;a.satiety=100;a.energy=100;a.task=null;}
 return s;
}
const node=(id,type,x,y,amount=35)=>({id,type,x,y,amount,max:35});
function assign(s,a,kind,target,extra={}){
 const field=routeField(s,a);
 a.task={policy:RULES.jobPolicy,kind,targetId:target.id,x:target.x,y:target.y,path:routeTo(field,target),work:0,score:100,started:s.tick,...extra};
}
function assertExclusive(s){
 const active=s.agents.filter(a=>taskValid(s,a)),nodes=new Set(),builders=new Map();
 for(const a of active){const t=a.task;if(RESOURCE_ACTIONS[t.kind]){assert.ok(!nodes.has(t.targetId),'node cannot be double-booked');nodes.add(t.targetId);}if(t.kind==='BUILD'){builders.set(t.targetId,(builders.get(t.targetId)??0)+1);}}
 assert.ok([...builders.values()].every(n=>n<=2));
 assert.ok(active.filter(a=>a.task.kind==='EAT').length<=s.stock.food);
}
test('engine version changes, old save schema does not',()=>{assert.equal(VERSION,'0.2.0');assert.equal(createWorld().version,SAVE_VERSION);assert.equal(SAVE_VERSION,'0.1.0');});
test('real pre-update save retains identity, resources, seed and skills; old jobs replan on tick',()=>{
 const old=legacyWorld(230926);legacyStep(old,87);const text=legacySerialize(old),s=restore(text);
 assert.equal(serialize(s),text);assert.ok(s.agents.some(a=>a.task&&!a.task.policy));
 step(s);assert.deepEqual(s.agents.map(a=>[a.id,a.appearance,a.parentId,a.skills]),old.agents.map(a=>[a.id,a.appearance,a.parentId,a.skills]));
 assert.equal(s.seed,old.seed);assert.deepEqual(s.stock,old.stock);assert.ok(s.agents.every(a=>!a.task||a.task.policy===RULES.jobPolicy));assertExclusive(s);
});
test('BFS distances count barrier detours, not Manhattan distance',()=>{
 const s=scenario(1),a=s.agents[0];a.x=2;a.y=1;
 for(let y=0;y<10;y++)s.tiles[y*30+3]='water';
 const field=routeField(s,a);assert.equal(routeDistance(field,{x:4,y:1}),20);
 assert.equal(routeDistance(field,{x:2,y:6}),5);assert.equal(routeTo(field,{x:4,y:1}).length,20);
});
test('resource selector chooses shorter real route across a barrier',()=>{
 const s=scenario(1),a=s.agents[0];a.x=2;a.y=1;a.preference='FORAGE';
 for(let y=0;y<10;y++)s.tiles[y*30+3]='water';s.nodes=[node(1,'food',4,1),node(2,'food',2,6)];
 step(s);assert.equal(a.task.kind,'FORAGE');assert.equal(a.task.targetId,2);const t=a.trace.find(t=>t.status==='selected');assert.equal(t.travelSteps,5);assert.equal(t.factors.distance,-4);
});
test('isolated nearest node does not hide a reachable alternative',()=>{
 const s=scenario(1),a=s.agents[0];a.x=2;a.y=2;
 s.nodes=[node(1,'food',4,2),node(2,'food',2,9)];for(const [x,y] of [[3,2],[5,2],[4,1],[4,3]])s.tiles[y*30+x]='water';
 step(s);assert.equal(a.task.targetId,2);assert.equal(a.task.kind,'FORAGE');
});
test('only one worker per resource; another chooses another reachable node',()=>{
 const s=scenario(2);s.nodes=[node(1,'food',10,12),node(2,'food',14,12)];
 for(const a of s.agents)a.preference='FORAGE';step(s);assert.equal(s.agents[0].task.kind,'FORAGE');assert.equal(s.agents[1].task.kind,'FORAGE');assert.notEqual(s.agents[0].task.targetId,s.agents[1].task.targetId);assertExclusive(s);
});
test('all occupied resource candidates have a visible reserved reason',()=>{
 const s=scenario(2);s.nodes=[node(1,'food',7,12)];for(const a of s.agents)a.preference='FORAGE';
 step(s);assert.equal(s.agents.filter(a=>a.task.kind==='FORAGE').length,1);assert.ok(s.agents.some(a=>a.trace.some(t=>t.kind==='FORAGE'&&t.status==='reserved')));
});
test('at most two builders on a single unfinished house',()=>{
 const s=scenario(6);s.stock={food:99,wood:99,stone:99};s.buildings.push({id:2,type:'shelter',x:14,y:12,progress:0,complete:false});
 for(const a of s.agents)a.preference='BUILD';step(s);assert.equal(s.agents.filter(a=>a.task.kind==='BUILD').length,2);assertExclusive(s);
});
test('reserved meal cannot be spent on cloning',()=>{
 const s=scenario(2);s.stock={food:8,wood:99,stone:99};assign(s,s.agents[0],'EAT',s.buildings[0]);
 assert.equal(survivalSummary(s).freeFood,7);const before=serialize(s);assert.equal(command(s,'CLONE',{parentId:2}).ok,false);assert.equal(serialize(s),before);
 s.stock.food=9;assert.equal(command(s,'CLONE',{parentId:2}).ok,true);assert.equal(s.stock.food,1);assert.equal(survivalSummary(s).reservedMeals,1);
});
test('one meal has one reservation even with multiple hungry people',()=>{
 const s=scenario(3);s.stock.food=1;for(const a of s.agents){a.x=5;a.y=5;a.satiety=20;}
 step(s);assert.equal(s.agents.filter(a=>a.task.kind==='EAT').length,1);assert.equal(survivalSummary(s).freeFood,0);assertExclusive(s);
});
test('more urgently hungry person gets the available meal first',()=>{
 const s=scenario(2);s.stock.food=1;s.agents[0].satiety=25;s.agents[1].satiety=4;
 step(s);assert.equal(s.agents[1].task.kind,'EAT');assert.notEqual(s.agents[0].task.kind,'EAT');
});
test('depleted target cancels BEFORE moving; reservation released',()=>{
 const s=scenario(1),a=s.agents[0];s.nodes=[node(1,'food',2,2,0),node(2,'food',14,12)];assign(s,a,'FORAGE',s.nodes[0]);step(s);
 assert.equal(a.task.targetId,2);assert.deepEqual([a.x,a.y],[11,12]);assert.ok(!reservations(s).book.nodes.has(1));
});
test('dead owners do not keep resource locks',()=>{
 const s=scenario(2);s.nodes=[node(1,'food',8,12)];assign(s,s.agents[0],'FORAGE',s.nodes[0]);s.agents[0].hp=0;s.agents[0].alive=false;
 step(s);assert.equal(s.agents[1].task.targetId,1);assert.equal(reservations(s).book.nodes.get(1),s.agents[1].id);
});
test('urgent hunger interrupts building and releases its work slot',()=>{
 const s=scenario(1),a=s.agents[0];s.tick=11;s.stock.food=2;a.satiety=12;
 s.buildings.push({id:2,type:'shelter',x:14,y:12,progress:0,complete:false});assign(s,a,'BUILD',s.buildings[1]);step(s);
 assert.equal(a.task.kind,'EAT');assert.equal(survivalSummary(s).builders,0);
});
test('stale tasks expire instead of keeping a lock indefinitely',()=>{
 const s=scenario(1),a=s.agents[0];s.nodes=[node(1,'food',10,12)];s.tick=4000;assign(s,a,'FORAGE',s.nodes[0],{started:1});step(s);
 assert.equal(a.task.started,4001);assert.equal(a.task.work,0);
});
test('hungry exhausted forager consumes exactly one harvested item without a return trip',()=>{
 const s=scenario(1),a=s.agents[0];s.buildings[0].x=0;s.buildings[0].y=0;a.satiety=4;a.energy=2;
 s.nodes=[node(1,'food',a.x,a.y,10)];const originalAmount=10;step(s,14);
 const harvested=originalAmount-s.nodes[0].amount;assert.ok(a.satiety>35);assert.equal(harvested,s.stock.food+1);assert.equal(s.stats.gathered,harvested);assert.ok(a.workDone>0);
});
test('no food anywhere causes real starvation, not free resource generation',()=>{
 const s=scenario(1),a=s.agents[0];a.satiety=0;a.hp=1;step(s,100);
 assert.equal(a.alive,false);assert.equal(s.stock.food,0);assert.equal(s.stats.gathered,0);
});
test('zero-output gathering cannot award XP',()=>{
 const s=scenario(1),a=s.agents[0];s.nodes=[node(1,'wood',a.x,a.y)];s.stock.wood=999;assign(s,a,'WOODCUT',s.nodes[0],{work:100});
 const xp=a.skills.WOODCUT;step(s);assert.equal(a.skills.WOODCUT,xp);assert.equal(s.stats.gathered,0);
});
test('comfortable stocked colony stops gathering past declared soft targets',()=>{
 const s=scenario(1),a=s.agents[0];s.nodes=[node(1,'food',10,12),node(2,'wood',12,12),node(3,'stone',11,13)];s.stock=stockTargets(s);
 step(s);assert.ok(!RESOURCE_ACTIONS[a.task.kind]);assert.equal(a.trace.filter(t=>t.status==='satisfied').length,3);
});
test('rest uses nearest completed shelter, not always the original camp',()=>{
 const s=scenario(1),a=s.agents[0];a.x=20;a.y=20;a.energy=5;s.buildings.push({id:2,type:'shelter',x:19,y:20,complete:true,progress:30});
 step(s);assert.equal(a.task.kind,'REST');assert.equal(a.task.targetId,2);assert.equal(a.task.fieldRest,false);
});
test('exhausted person far from shelter can rest locally without teleporting',()=>{
 const s=scenario(1),a=s.agents[0];a.x=29;a.y=25;a.energy=3;step(s,20);assert.ok(a.energy>15);assert.deepEqual([a.x,a.y],[29,25]);
});
test('reservations survive save/restore by reconstruction, and continuation remains deterministic',()=>{
 const a=createWorld(7);step(a,87);const b=restore(serialize(a));assert.deepEqual(survivalSummary(a),survivalSummary(b));step(a,400);step(b,400);assert.equal(serialize(a),serialize(b));
});
test('single steps and batched steps produce identical state',()=>{const a=createWorld(8),b=createWorld(8);step(a,300);for(let i=0;i<300;i++)step(b);assert.equal(serialize(a),serialize(b));});
test('summary is read-only and score breakdowns add up exactly',()=>{
 const s=createWorld();step(s);const before=serialize(s);const summary=survivalSummary(s);summary.stock.food=0;summary.targets.food=0;assert.equal(serialize(s),before);
 for(const a of s.agents)for(const t of a.trace)assert.equal(t.score,Object.values(t.factors).reduce((n,v)=>n+v,0));
});
test('exclusive reservations and bounds hold every tick in a crowded 2,000-tick fixture',()=>{
 const s=createWorld(42);s.stock={food:999,wood:999,stone:999};while(s.agents.length<12)assert.equal(command(s,'CLONE',{parentId:1}).ok,true);s.stock={food:28,wood:24,stone:12};
 for(let i=0;i<2000;i++){step(s);assertExclusive(s);assert.ok(Object.values(s.stock).every(n=>n>=0&&n<=999));}
 assert.deepEqual(validate(s),[]);assert.equal(s.agents.filter(a=>a.alive).length,12);
});
test('pending production prevents a second unnecessary gather assignment',()=>{
 const s=scenario(2);s.stock.food=22;s.nodes=[node(1,'food',10,12),node(2,'food',14,12)];for(const a of s.agents)a.preference='FORAGE';
 step(s);assert.equal(s.agents.filter(a=>a.task.kind==='FORAGE').length,1);assert.ok(s.agents.some(a=>a.trace.some(t=>t.kind==='FORAGE'&&t.status==='satisfied')));
});
test('reconstructed conflicting node claims retain oldest owner and replan the loser',()=>{
 const s=scenario(2);s.tick=40;s.nodes=[node(1,'food',9,12),node(2,'food',15,12)];assign(s,s.agents[0],'FORAGE',s.nodes[0],{started:10});assign(s,s.agents[1],'FORAGE',s.nodes[0],{started:20});
 step(s);assert.equal(s.agents[0].task.targetId,1);assert.equal(s.agents[1].task.targetId,2);assertExclusive(s);
});
test('a path that would teleport an agent is canceled and replanned',()=>{
 const s=scenario(1),a=s.agents[0];s.nodes=[node(1,'food',2,2)];assign(s,a,'FORAGE',s.nodes[0]);a.task.path=[{x:2,y:2}];step(s);
 assert.deepEqual([a.x,a.y],[11,12]);assert.equal(a.task.policy,RULES.jobPolicy);assert.notEqual(a.task.path.length,1);
});
test('fractional imported node quantity cannot become a whole free meal',()=>{
 const s=scenario(1),a=s.agents[0];s.nodes=[node(1,'food',a.x,a.y,.5)];a.satiety=4;a.energy=10;assign(s,a,'FORAGE',s.nodes[0],{work:100});
 step(s);assert.equal(s.stock.food,.5);assert.equal(s.stats.gathered,.5);assert.ok(a.satiety<4);
});
