import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorld,command,step,serialize,restore,validate,walkable,capacity,survivalSummary,birthPlan,previewPlacement} from '../src/engine.mjs';
import {evaluateModularHouses,housingCapacity,houseSite,MODULAR_HOUSE_RULES} from '../src/housing.mjs';
import {canonicalEdge,edgeCells,cellEdges,socketKey,canPlaceStation,PLACEMENT_LIMITS} from '../src/rust-stations.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
// Same inputs as worldsim-resource-authority ecologySignature (seed, phase, tiles, nodes, buildings).
const signature=s=>`${s.seed}|${((s.tick%360)+360)%360}|${s.tiles.join(',')}|${s.nodes.map(n=>`${n.id}:${n.type}:${n.x}:${n.y}`).join(';')}|${s.buildings.map(b=>`${b.id}:${b.type}:${b.x}:${b.y}:${b.complete===false?0:1}`).join(';')}`;

/** Direct-executor fixture: agent 1 stands on the deterministic site with an equipped Hammer. */
function builderFixture(seed=230926){
  const s=createWorld(seed),a=s.agents[0],site=houseSite(s,walkable).origin;
  a.x=site.x;a.y=site.y;a.task=null;
  s.rustPossessions.items.push({id:s.rustPossessions.nextItem++,kind:'HAMMER',createdBy:a.id,createdTick:0,location:{kind:'bag',agentId:a.id}});
  s.rustPossessions.equipment.push({agentId:a.id,itemId:s.rustPossessions.items.at(-1).id});
  const give=kind=>{const id=s.rustPossessions.nextItem++;s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});return id;};
  const place=(kind,socket)=>{const id=give(kind);return command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:id,socket,placementId:'pl:'+s.tick+':'+a.id+':'+id});};
  return {s,a,site,give,place};
}
function buildHouse(f,door='S'){
  const {site,place}=f,{x,y}=site;
  const results=[place('WOOD_FOUNDATION',{type:'cell',x,y})];
  for(const side of ['N','E','S','W'].filter(d=>d!==door))results.push(place('WOOD_WALL',canonicalEdge(x,y,side)));
  results.push(place('WOOD_DOORWAY',canonicalEdge(x,y,door)));
  results.push(place('WOOD_ROOF',{type:'cell',x,y}));
  return results;
}

test('1. engine rejects a new shelter BUILD with reason shelter-removed and no state change',()=>{
  const s=createWorld(230926);s.stock.wood=999;s.stock.stone=999;
  for(const data of [{x:14,y:11},{x:0,y:0},{}]){
    const before=serialize(s),r=command(s,'BUILD',data);
    assert.equal(r.ok,false);assert.equal(r.reason,'shelter-removed');assert.equal(serialize(s),before);
  }
});

test('2. unfinished shelter from an old save completes without refund or double charge',()=>{
  const old=createWorld(230926);
  old.buildings.push({id:old.nextBuilding++,type:'shelter',x:14,y:11,complete:false,progress:0});
  // Simulate an RS3-0.2 save written before sockets existed.
  old.rustStations={version:'RS3-0.2',nextStation:1,stations:[]};
  const s=restore(JSON.stringify(old));
  assert.equal(s.rustStations.version,'RS3-0.3');
  assert.equal(capacity(s),12);
  const shelter=s.buildings.at(-1),built=s.stats.built;
  let prev={...s.stock},gathered=s.stats.gathered,done=null;
  for(let i=0;i<1500&&!shelter.complete;i++){
    step(s,1);
    const dg=s.stats.gathered-gathered;
    assert.ok(s.stock.stone>=prev.stone,'stone is never charged again (RP1 off: nothing else spends stone)');
    assert.ok(s.stock.stone-prev.stone<=dg&&s.stock.wood-prev.wood<=dg,'no refund: stock only grows by gathered output');
    prev={...s.stock};gathered=s.stats.gathered;if(shelter.complete)done=s.tick;
  }
  assert.ok(done,'the legacy shelter was finished by Clones');
  assert.equal(s.stats.built,built+1);
  assert.equal(capacity(s),18);
  assert.equal(s.buildings.length,3);
  assert.deepEqual(validate(s),[]);
});

test('3. starting capacity stays 12 and seed ecology/food regrowth is unchanged vs main 3044698',()=>{
  const s=createWorld(230926);
  assert.equal(capacity(s),12);assert.equal(housingCapacity(s),12);
  assert.deepEqual(s.buildings.map(b=>b.type),['camp','shelter']);
  // Hashes recorded on main 3044698 (branch base, after WM4.6 merge), RP1 off.
  assert.equal(sha(signature(s)),'5ce3d9efcb64873448c47be9f062c8dfb91cc4da664f761a63013cafb17394a4');
  step(s,720);
  assert.equal(sha(signature(s)),'5ce3d9efcb64873448c47be9f062c8dfb91cc4da664f761a63013cafb17394a4');
  assert.equal(sha(JSON.stringify(s.nodes)),'7f02c47f8b4126e1977aed9392bae2a8b58447e5cabe732a14c4b3f9c5614cb7');
  assert.equal(s.nodes.filter(n=>n.type==='food').reduce((a,n)=>a+n.amount,0),1169);
  assert.equal(sha(JSON.stringify(s.agents)),'25a637e77aaa98e133faef28966a8c7eaab18080d5904171923e37a61eda8b03');
  assert.deepEqual(s.stock,{food:42,wood:38,stone:24});
});

test('4. seed 230926: RP1 gets the Hammer, builds a 1x1 modular house and capacity rises within 3200 ticks',()=>{
  const s=createWorld(230926);command(s,'SET_PRODUCTION_POLICY',{enabled:true});
  const start=capacity(s);let hammer=null,charcoal=null,complete=null;
  for(let i=0;i<3200&&complete===null;i++){
    step(s,1);
    if(hammer===null&&s.rustPossessions.items.some(x=>x.kind==='HAMMER'))hammer=s.tick;
    if(charcoal===null&&s.rustMaterials.charcoal>=4)charcoal=s.tick;
    if(capacity(s)>start)complete=s.tick;
  }
  assert.ok(hammer!==null&&complete!==null&&hammer<complete,JSON.stringify({hammer,charcoal,complete,goal:s.productionPlan.goal}));
  assert.equal(capacity(s),start+MODULAR_HOUSE_RULES.capacityPerHouse);
  const house=evaluateModularHouses(s).houses.find(h=>h.complete);
  assert.equal(house.cells.length,1);assert.equal(house.doorways,1);
  const pieces=s.rustStations.stations.filter(st=>st.structurePiece);
  assert.deepEqual(pieces.map(p=>p.kind).sort(),['WOOD_DOORWAY','WOOD_FOUNDATION','WOOD_ROOF','WOOD_WALL','WOOD_WALL','WOOD_WALL']);
  for(const p of pieces){
    assert.match(p.placementId,/^pl:\d+:\d+:\d+$/);
    assert.ok(p.socket.type==='cell'||['N','W'].includes(p.socket.side),'edges are stored canonically');
    assert.ok(s.agents.some(a=>a.id===p.placedBy));
  }
  assert.equal(s.buildings.length,2,'no shelter was created');
  assert.equal(s.stats.built,1,'stats.built counts the one house a Clone finished');
  assert.deepEqual(validate(s),[]);
});

test('edge sockets are canonical: E of (x,y) and W of (x+1,y) are one edge, and raw E/S is rejected',()=>{
  assert.deepEqual(canonicalEdge(4,5,'E'),canonicalEdge(5,5,'W'));
  assert.deepEqual(canonicalEdge(4,5,'S'),canonicalEdge(4,6,'N'));
  assert.deepEqual(edgeCells(canonicalEdge(4,5,'E')),[{x:4,y:5},{x:5,y:5}]);
  assert.deepEqual(cellEdges(4,5).map(socketKey),['e1:4:5:N','e1:5:5:W','e1:4:6:N','e1:4:5:W']);
  const f=builderFixture(),{s,site,place,give,a}=f;
  assert.equal(place('WOOD_FOUNDATION',{type:'cell',...site}).ok,true);
  const wid=give('WOOD_WALL'),before=serialize(s);
  const raw=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:wid,socket:{type:'edge',x:site.x,y:site.y,side:'E'},placementId:'pl:'+s.tick+':'+a.id+':'+wid});
  assert.equal(raw.reason,'socket-shape');assert.equal(serialize(s),before);
  assert.equal(command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:wid,socket:canonicalEdge(site.x,site.y,'E'),placementId:'pl:'+s.tick+':'+a.id+':'+wid}).ok,true);
  const again=serialize(s),second=place('WOOD_WALL',{type:'edge',x:site.x+1,y:site.y,side:'W'});
  assert.equal(second.reason,'socket-occupied','no double wall on the same edge');
  assert.equal(s.rustStations.stations.filter(st=>st.kind==='WOOD_WALL').length,1);
  assert.equal(JSON.parse(again).rustStations.stations.length,s.rustStations.stations.length);
  assert.deepEqual(validate(s),[]);
});

test('house evaluation: complete 1x1 gives +6, missing roof/wall or two doorways does not',()=>{
  const f=builderFixture();
  const results=buildHouse(f);
  assert.ok(results.every(r=>r.ok),JSON.stringify(results));
  assert.equal(results.at(-1).completedHouse,'H'+results[0].stationId);
  assert.equal(results.filter(r=>r.completedHouse).length,1);
  assert.equal(capacity(f.s),18);assert.equal(f.s.stats.built,1);
  const levels=f.s.rustStations.stations.map(st=>[st.kind,st.socket.level]);
  assert.deepEqual(levels,[['WOOD_FOUNDATION',0],['WOOD_WALL',1],['WOOD_WALL',1],['WOOD_WALL',1],['WOOD_DOORWAY',1],['WOOD_ROOF',2]]);
  // Derived, never stored: removing a piece in a fixture lowers capacity immediately.
  const noRoof=structuredClone(f.s);noRoof.rustStations.stations=noRoof.rustStations.stations.filter(st=>st.kind!=='WOOD_ROOF');
  assert.equal(capacity(noRoof),12);assert.equal(evaluateModularHouses(noRoof).houses[0].missing[0].pieceKind,'WOOD_ROOF');
  const noWall=structuredClone(f.s);noWall.rustStations.stations=noWall.rustStations.stations.filter(st=>st.id!==2);
  assert.equal(capacity(noWall),12);
  const g=builderFixture();buildHouse(g,'S');
  const two=structuredClone(g.s);const wall=two.rustStations.stations.find(st=>st.kind==='WOOD_WALL');wall.kind='WOOD_DOORWAY';
  assert.equal(evaluateModularHouses(two).houses[0].complete,false);assert.equal(capacity(two),12);
  // A roof needs its foundation and at least one wall on the same cell.
  const h=builderFixture();h.place('WOOD_FOUNDATION',{type:'cell',...h.site});
  assert.equal(h.place('WOOD_ROOF',{type:'cell',...h.site}).reason,'support-roof');
  assert.equal(h.place('WOOD_WALL',{type:'edge',x:h.site.x+3,y:h.site.y,side:'W'}).reason,'support-foundation');
});

test('retrying a placementId is idempotent and an item can never be placed twice',()=>{
  const f=builderFixture(),{s,a,site,give}=f;
  const id=give('WOOD_FOUNDATION'),data={agentId:a.id,itemInstanceId:id,socket:{type:'cell',...site},placementId:'pl:'+s.tick+':'+a.id+':'+id};
  const first=command(s,'PLACE_STATION',data),snapshot=serialize(s),again=command(s,'PLACE_STATION',data);
  assert.equal(first.ok,true);assert.equal(again.ok,true);assert.equal(again.duplicate,true);assert.equal(again.stationId,first.stationId);
  assert.equal(serialize(s),snapshot);
  s.rustStations.placements=[];
  assert.equal(command(s,'PLACE_STATION',data).reason,'duplicate-item','permanent guard does not depend on the bounded log');
  const missing=give('WOOD_WALL');
  assert.equal(command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:missing,socket:canonicalEdge(site.x,site.y,'N')}).reason,'placement-id');
});

test('after its placementId is evicted from the 64-entry log, a retried placement is rejected as duplicate-item and places nothing',()=>{
  const f=builderFixture(),{s,a,site,give}=f;
  const id=give('WOOD_FOUNDATION'),data={agentId:a.id,itemInstanceId:id,socket:{type:'cell',...site},placementId:'pl:'+s.tick+':'+a.id+':'+id};
  const first=command(s,'PLACE_STATION',data);assert.equal(first.ok,true);
  assert.equal(PLACEMENT_LIMITS.log,64);
  // Older rows fill the log; the next real placement trims it through the executor itself.
  for(let i=0;i<PLACEMENT_LIMITS.log-1;i++)s.rustStations.placements.push({id:'fill:'+i,tick:s.tick,stationId:first.stationId,itemInstanceId:id});
  assert.equal(command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:give('WOOD_WALL'),socket:canonicalEdge(site.x,site.y,'N'),placementId:'pl:'+s.tick+':'+a.id+':wall'}).ok,true);
  assert.equal(s.rustStations.placements.length,PLACEMENT_LIMITS.log);
  assert.ok(!s.rustStations.placements.some(p=>p.id===data.placementId),'original placementId was evicted');
  const stations=s.rustStations.stations.length,snapshot=serialize(s);
  const retry=command(s,'PLACE_STATION',data);
  assert.equal(retry.ok,false);assert.equal(retry.reason,'duplicate-item');
  assert.equal(s.rustStations.stations.length,stations);
  assert.equal(s.rustStations.stations.filter(st=>st.sourceItemId===id).length,1);
  assert.equal(serialize(s),snapshot);
});

test('preview is the same read-only validator and matches the executor',()=>{
  const f=builderFixture(),{s,a,site,give}=f;
  const id=give('WOOD_FOUNDATION');
  const cases=[{type:'cell',...site},{type:'cell',x:site.x,y:site.y,level:2},{type:'edge',x:site.x,y:site.y,side:'N'},{type:'cell',x:-1,y:0},null];
  for(const socket of cases){
    const data={agentId:a.id,itemInstanceId:id,socket,placementId:'pl:'+s.tick+':'+a.id+':'+id},frozen=structuredClone(s);
    const before=serialize(s),preview=previewPlacement(s,data);
    assert.equal(serialize(s),before,'preview never writes');
    assert.doesNotThrow(()=>canPlaceStation(Object.freeze(frozen),data,walkable,{actor:true}));
    const copy=restore(serialize(s)),exec=command(copy,'PLACE_STATION',data);
    assert.equal(preview.ok,exec.ok);assert.equal(preview.reason,exec.reason);
  }
});

test('RS3-0.2 saves migrate once: foundations become cell sockets, old full-cell pieces become legacy-inert',()=>{
  const old=createWorld(230926);
  old.rustStations={version:'RS3-0.2',nextStation:4,stations:[
    {id:1,kind:'WOOD_FOUNDATION',buildingType:'wood_foundation',x:14,y:9,complete:true,placedBy:1,placedTick:0,structurePiece:true},
    {id:2,kind:'WOOD_WALL',buildingType:'wood_wall',x:15,y:9,complete:true,placedBy:1,placedTick:0,structurePiece:true},
    {id:3,kind:'CRAFTING_TABLE_LV1',buildingType:'crafting_table',x:14,y:13,complete:true,placedBy:1,placedTick:0,structurePiece:false}]};
  const s=restore(JSON.stringify(old));
  assert.equal(s.rustStations.version,'RS3-0.3');assert.deepEqual(s.rustStations.placements,[]);
  assert.deepEqual(s.rustStations.stations[0].socket,{type:'cell',x:14,y:9,level:0});
  assert.deepEqual(s.rustStations.stations[1].socket,{type:'legacy',x:15,y:9,level:null});
  assert.equal(s.rustStations.stations[2].socket,undefined);
  assert.deepEqual(s.rustStations.stations.map(st=>st.placementId),['legacy:1','legacy:2','legacy:3']);
  assert.equal(capacity(s),12,'legacy pieces are not a house and nothing is refunded');
  assert.equal(s.rustPossessions.items.length,0);
  const again=restore(serialize(s));assert.equal(serialize(again),serialize(s),'restore->serialize->restore is stable');
  const legacy=JSON.parse(readFileSync(new URL('./fixtures/legacy-0.3.3-save.json',import.meta.url),'utf8'));
  const loaded=restore(JSON.stringify(legacy));assert.equal(loaded.rustStations.version,'RS3-0.3');assert.equal(capacity(loaded),12);
  const bad=JSON.parse(serialize(s));bad.rustStations.stations[0].socket={type:'edge',x:14,y:9,side:'E',level:1};
  assert.throws(()=>restore(JSON.stringify(bad)));
});

test('capacity has one source: housing.mjs, used by engine, birth plan and survival summary',()=>{
  const src=new URL('../src/',import.meta.url);
  for(const file of readdirSync(src).filter(f=>f.endsWith('.mjs')&&f!=='housing.mjs')){
    const text=readFileSync(new URL(file,src),'utf8');
    assert.ok(!/complete\)\.length\s*\*\s*6/.test(text),file+' re-derives housing capacity');
  }
  const s=createWorld(230926);
  assert.equal(birthPlan(s,999).capacity,capacity(s));
  assert.equal(survivalSummary(s).kingdomProduction.capacity,capacity(s));
});

test('old save with an extra completed shelter still counts +6 per shelter after RS3-0.2 migration',()=>{
  const old=createWorld(230926);
  old.buildings.push({id:old.nextBuilding++,type:'shelter',x:14,y:11,complete:true,progress:1});
  old.rustStations={version:'RS3-0.2',nextStation:1,stations:[]};
  const s=restore(JSON.stringify(old));
  assert.equal(s.rustStations.version,'RS3-0.3');
  assert.equal(capacity(s),18);assert.equal(housingCapacity(s),18);
  assert.equal(signature(s),signature(old),'ecology inputs are unchanged by migration');
  const again=restore(serialize(s));assert.equal(serialize(again),serialize(s));assert.equal(capacity(again),18);
  assert.deepEqual(validate(s),[]);
});

test('house evaluation: zero doorways or a 5-foundation component is not a house',()=>{
  const f=builderFixture();buildHouse(f);
  const none=structuredClone(f.s);none.rustStations.stations.find(st=>st.kind==='WOOD_DOORWAY').kind='WOOD_WALL';
  assert.equal(evaluateModularHouses(none).houses[0].complete,false);assert.equal(capacity(none),12);
  const big=structuredClone(f.s),{x,y}=f.site;
  for(let i=1;i<=4;i++)big.rustStations.stations.push({...structuredClone(big.rustStations.stations[0]),id:900+i,x:x+i,y,socket:{type:'cell',x:x+i,y,level:0},placementId:'fx:'+i,sourceItemId:null});
  const h=evaluateModularHouses(big).houses.find(h=>h.cells.length===5);
  assert.ok(h,'five connected foundations form one component');assert.equal(h.complete,false);assert.equal(capacity(big),12);
});

test('house evaluation: a fully built 5-cell house (every piece placed through the executor) is too-large; the same 4-cell house is complete',()=>{
  // Row of grass cells on seed 230926 starting at (9,0); the builder is moved beside each cell so range never rejects.
  const build=n=>{
    const f=builderFixture(),{s,a}=f,ox=9,oy=0;
    const at=(cx,kind,socket)=>{a.x=cx;a.y=oy;return f.place(kind,socket);};
    const results=[];
    for(let i=0;i<n;i++)results.push(at(ox+i,'WOOD_FOUNDATION',{type:'cell',x:ox+i,y:oy}));
    for(let i=0;i<n;i++)for(const side of ['N','S'])results.push(at(ox+i,i===2&&side==='S'?'WOOD_DOORWAY':'WOOD_WALL',canonicalEdge(ox+i,oy,side)));
    results.push(at(ox,'WOOD_WALL',canonicalEdge(ox,oy,'W')),at(ox+n-1,'WOOD_WALL',canonicalEdge(ox+n-1,oy,'E')));
    for(let i=0;i<n;i++)results.push(at(ox+i,'WOOD_ROOF',{type:'cell',x:ox+i,y:oy}));
    assert.ok(results.every(r=>r.ok),'every piece is accepted by the executor');
    return s;
  };
  const four=build(4),h4=evaluateModularHouses(four).houses.find(h=>h.cells.length===4);
  assert.ok(h4);assert.equal(h4.complete,true);assert.equal(capacity(four),18);
  const five=build(5),houses=evaluateModularHouses(five).houses;
  assert.equal(houses.length,1);const h=houses[0];
  assert.equal(h.cells.length,5);assert.equal(h.doorways,1);
  assert.equal(h.complete,false);assert.equal(h.reason,'too-large');assert.deepEqual(h.missing,[]);
  assert.equal(h.capacity,0);assert.equal(capacity(five),12);
});

test('save/load in the middle of the RP1 house plan resumes without duplicate pieces or double charge',()=>{
  const continuous=createWorld(230926);command(continuous,'SET_PRODUCTION_POLICY',{enabled:true});
  let mid=null;
  for(let i=0;i<3200;i++){step(continuous,1);const n=continuous.rustStations.stations.filter(st=>st.structurePiece).length;if(n>=2&&n<6){mid=continuous.tick;break;}}
  assert.ok(mid,'reached a partially built house');
  const resumed=restore(serialize(continuous));
  step(continuous,800);step(resumed,800);
  assert.equal(serialize(continuous),serialize(resumed));
  const pieces=resumed.rustStations.stations.filter(st=>st.structurePiece);
  assert.equal(new Set(pieces.map(p=>p.sourceItemId)).size,pieces.length,'each item placed once');
  assert.equal(new Set(pieces.map(p=>socketKey(p.socket))).size,pieces.length,'no socket used twice');
  assert.ok(evaluateModularHouses(resumed).houses.some(h=>h.complete));
  assert.deepEqual(validate(resumed),[]);
});

test('wood is charged once per piece: at craft acceptance only, never on placement, and not on a rejected placement',async()=>{
  const {queueCraft,advanceCraft}=await import('../src/rust-possessions.mjs');
  const {RECIPE_CATALOG}=await import('../src/crafting-catalog.mjs');
  const f=builderFixture(),{s,a,site}=f;s.stock.wood=100;s.stock.stone=100;
  // Craft: wood drops by the recipe cost once at acceptance, completion spends nothing more.
  const cost=RECIPE_CATALOG.WOOD_FOUNDATION.materials.wood,w0=s.stock.wood;
  assert.equal(queueCraft(s,{agentId:a.id,recipeId:'WOOD_FOUNDATION'}).ok,true);
  assert.equal(s.stock.wood,w0-cost);
  let done=null;for(let i=0;i<100&&!done;i++){s.tick++;const r=advanceCraft(s,a.id);if(r.completed)done=r;}
  assert.ok(done);assert.equal(s.stock.wood,w0-cost,'completion does not charge again');
  // Successful placement consumes the item once and leaves stock untouched.
  const stock={...s.stock},pid='pl:'+s.tick+':'+a.id+':'+done.itemId;
  const ok=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:done.itemId,socket:{type:'cell',...site},placementId:pid});
  assert.equal(ok.ok,true);assert.deepEqual(s.stock,stock);
  assert.equal(s.rustPossessions.items.some(i=>i.id===done.itemId&&i.location?.kind==='bag'),false,'item left the bag');
  assert.equal(s.rustStations.stations.filter(st=>st.sourceItemId===done.itemId).length,1);
  // Retry with the same placementId: no charge, no second station.
  command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:done.itemId,socket:{type:'cell',...site},placementId:pid});
  assert.deepEqual(s.stock,stock);assert.equal(s.rustStations.stations.filter(st=>st.sourceItemId===done.itemId).length,1);
  // Rejected placement (wall with no foundation beside it): nothing changes, item stays in the bag.
  const wid=f.give('WOOD_WALL'),before=serialize(s);
  const bad=command(s,'PLACE_STATION',{agentId:a.id,itemInstanceId:wid,socket:{type:'edge',x:site.x+3,y:site.y,side:'W'},placementId:'pl:'+s.tick+':'+a.id+':'+wid});
  assert.equal(bad.ok,false);assert.equal(serialize(s),before);
  assert.ok(s.rustPossessions.items.some(i=>i.id===wid&&i.location?.kind==='bag'));
});

test('RP1 on seed 230926 crafts exactly the six pieces of one 1x1 house and places each once',()=>{
  const s=createWorld(230926);command(s,'SET_PRODUCTION_POLICY',{enabled:true});
  const kinds=['WOOD_FOUNDATION','WOOD_WALL','WOOD_DOORWAY','WOOD_ROOF'];
  for(let i=0;i<3200&&!evaluateModularHouses(s).houses.some(h=>h.complete);i++)step(s,1);
  const crafted=s.rustPossessions.items.filter(i=>kinds.includes(i.kind));
  const placed=s.rustStations.stations.filter(st=>st.structurePiece);
  assert.equal(placed.length,6);
  assert.equal(new Set(placed.map(p=>p.sourceItemId)).size,6);
  assert.equal(crafted.filter(i=>i.location?.kind==='bag').length+s.rustPossessions.orders.filter(o=>kinds.includes(o.recipe)).length,0,'no extra piece crafted or left over');
});
