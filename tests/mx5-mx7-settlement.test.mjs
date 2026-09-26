import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,serialize,restore,step} from '../src/engine.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {activateHouseholdStore} from '../src/individual-resources.mjs';
import {recordRelationshipEvidence} from '../src/relationships.mjs';
import {createCommunityShadow} from '../src/community-shadow.mjs';
import {createSettlementCandidates} from '../src/settlement-candidate.mjs';
import {
  SETTLEMENT_STATE_VERSION,
  ensureSettlementState,
  validateSettlementState,
  stepSettlementAuthority,
  settlementSnapshot,
  allSettlementSnapshots
} from '../src/settlement-authority.mjs';

function completedHouse(state,id,ownerId,x,y){
  state.rustStations.stations.push(
    {id,kind:'WOOD_FOUNDATION',x,y,placedBy:ownerId,socket:{type:'cell',x,y,level:0}},
    {id:id+1,kind:'WOOD_WALL',x,y,socket:canonicalEdge(x,y,'N')},
    {id:id+2,kind:'WOOD_WALL',x,y,socket:canonicalEdge(x,y,'E')},
    {id:id+3,kind:'WOOD_WALL',x,y,socket:canonicalEdge(x,y,'S')},
    {id:id+4,kind:'WOOD_DOORWAY',x,y,socket:canonicalEdge(x,y,'W')},
    {id:id+5,kind:'WOOD_ROOF',x,y,socket:{type:'cell',x,y,level:2}}
  );
  const houseId='H'+id;
  const activated=activateHouseholdStore(state,houseId,ownerId);
  assert.equal(activated.ok,true);
  return houseId;
}

function twoHouseholdCommunity(seed=230926){
  const s=createWorld(seed,{mode:'independent',worldProfile:'large',population:2});
  const [a,b]=s.agents;
  a.x=5;a.y=5;b.x=8;b.y=5;
  completedHouse(s,1001,a.id,5,5);
  completedHouse(s,1101,b.id,8,5);
  s.tick=120;
  recordRelationshipEvidence(s,{fromId:a.id,toId:b.id,kind:'cooperation',key:'mx5:cooperate:1',tick:0,delta:{trust:2,affinity:1}});
  recordRelationshipEvidence(s,{fromId:a.id,toId:b.id,kind:'knowledge-share',key:'mx5:cooperate:2',tick:30,delta:{}});
  return {s,a,b};
}

test('MX5 proximity alone never promotes a Neighborhood into Community',()=>{
  const s=createWorld(1,{mode:'independent',worldProfile:'large',population:2});
  const [a,b]=s.agents;
  completedHouse(s,2001,a.id,5,5);completedHouse(s,2101,b.id,8,5);
  s.tick=300;
  const p=createCommunityShadow(s);
  assert.equal(p.neighborhoods.neighborhoods.length,1);
  assert.equal(p.communities.length,0);
  assert.equal(p.authority.communityWriter,false);
  assert.equal(p.authority.saveFields,0);
});

test('MX5 repeated relationship evidence plus continuity promotes one Community candidate read-only',()=>{
  const {s,a,b}=twoHouseholdCommunity(),before=serialize(s);
  const x=createCommunityShadow(s),y=createCommunityShadow(s);
  assert.deepEqual(x,y);assert.equal(serialize(s),before);
  assert.equal(x.communities.length,1);
  const c=x.communities[0];
  assert.deepEqual(c.ownerIds,[a.id,b.id]);
  assert.equal(c.socialLinks,1);
  assert.equal(c.relationshipEvidence.evidenceCount,2);
  assert.ok(c.relationshipEvidence.continuityTicks>=60);
  assert.equal(c.tradeEvidence,0);
  assert.equal(c.tradeAuthority,'not-released');
});

test('MX6 derives a stable Settlement candidate without writing state',()=>{
  const {s}=twoHouseholdCommunity(42),before=serialize(s);
  const a=createSettlementCandidates(s),b=createSettlementCandidates(s);
  assert.deepEqual(a,b);assert.equal(serialize(s),before);
  assert.equal(a.candidates.length,1);
  const row=a.candidates[0];
  assert.ok(row.id.startsWith('SC:C:N:'));
  assert.equal(row.households,2);
  assert.equal(row.residents,2);
  assert.equal(row.qualified,true);
  assert.ok(row.boundary.minX<=row.boundary.maxX);
  assert.equal(a.authority.settlementWriter,false);
});

test('MX7 fresh Independent worlds own one empty bounded Settlement state',()=>{
  const s=createWorld(9,{mode:'independent',worldProfile:'large'});
  assert.deepEqual(s.settlementState,{version:SETTLEMENT_STATE_VERSION,nextId:1,records:[]});
  assert.deepEqual(validateSettlementState(s),[]);
  assert.deepEqual(allSettlementSnapshots(s),[]);
});

test('MX7 promotes a qualified MX6 candidate to persistent provenance only',()=>{
  const {s,a,b}=twoHouseholdCommunity(77);s.tick=360;
  const result=stepSettlementAuthority(s,{force:true});
  assert.equal(result.changed,true);assert.deepEqual(result.createdIds,['S1']);
  assert.equal(s.settlementState.records.length,1);
  const record=s.settlementState.records[0];
  assert.equal(record.id,'S1');
  assert.equal(record.anchorOwnerId,a.id);
  for(const forbidden of ['ownerIds','residentIds','houseIds','resources','stock','inventory'])
    assert.equal(Object.prototype.hasOwnProperty.call(record,forbidden),false);
  const snap=settlementSnapshot(s,'S1');
  assert.equal(snap.status,'active');assert.ok(snap.current);
  assert.deepEqual(snap.current.ownerIds,[a.id,b.id]);
  assert.equal(snap.current.households,2);
  assert.equal(validateSettlementState(s).length,0);
});

test('MX7 writer is idempotent for the same candidate and bounded cadence creates no duplicate',()=>{
  const {s}=twoHouseholdCommunity(5150);s.tick=360;
  stepSettlementAuthority(s,{force:true});
  const text=JSON.stringify(s.settlementState);
  const again=stepSettlementAuthority(s,{force:true});
  assert.equal(again.createdIds.length,0);
  assert.equal(s.settlementState.records.length,1);
  assert.equal(JSON.stringify(s.settlementState),text);
});

test('MX7 marks a Settlement dormant when its qualifying Community evidence disappears',()=>{
  const {s}=twoHouseholdCommunity(2026);s.tick=360;stepSettlementAuthority(s,{force:true});
  const rel=s.social.relations.find(r=>r.evidence?.some(e=>e.key==='mx5:cooperate:1'));
  rel.trust=0;rel.affinity=0;rel.evidence=[];
  s.tick=720;
  const result=stepSettlementAuthority(s,{force:true});
  assert.deepEqual(result.dormantIds,['S1']);
  assert.equal(s.settlementState.records[0].status,'dormant');
  assert.equal(settlementSnapshot(s,'S1').current,null);
});

test('MX7 old Independent saves migrate an empty settlementState deterministically',()=>{
  const s=createWorld(88,{mode:'independent',worldProfile:'large'});
  delete s.settlementState;
  const text=JSON.stringify(s),a=restore(text),b=restore(text);
  assert.deepEqual(a.settlementState,{version:SETTLEMENT_STATE_VERSION,nextId:1,records:[]});
  assert.equal(serialize(a),serialize(b));
});

test('MX7 settlement provenance survives save/load and validator rejects copied ownership/resources',()=>{
  const s=createWorld(99,{mode:'independent',worldProfile:'large'});
  s.settlementState.records.push({
    id:'S1',sourceCandidateId:'SC:C:N:1-2',sourceCommunityId:'C:N:1-2',sourceNeighborhoodId:'N:1-2',
    anchorOwnerId:1,createdTick:0,lastQualifiedTick:0,status:'dormant'
  });
  s.settlementState.nextId=2;
  const loaded=restore(serialize(s));
  assert.deepEqual(loaded.settlementState,s.settlementState);
  loaded.settlementState.records[0].resources={food:1};
  assert.deepEqual(validateSettlementState(loaded),['Settlement record']);
});

test('MX7 engine daily cadence invokes Settlement writer after Community evidence matures',()=>{
  const {s}=twoHouseholdCommunity(1234);
  s.tick=359;step(s,1);
  assert.equal(s.tick,360);
  assert.equal(s.settlementState.records.length,1);
  assert.equal(s.settlementState.records[0].id,'S1');
  assert.ok(s.events.some(e=>e.type==='settlement'&&e.text.includes('S1')));
});

test('MX7 Independent UI exposes only promoted Settlement status',()=>{
  const source=readFileSync(new URL('../src/independent-ui.mjs',import.meta.url),'utf8');
  assert.ok(source.includes("allSettlementSnapshots(s).filter(x=>x.status==='active')"));
  assert.ok(source.includes('EMERGENT SETTLEMENT · MX7'));
  assert.ok(source.includes("Settlement เกิดเอง"));
});
