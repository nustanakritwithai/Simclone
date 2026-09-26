import {createWorld,command,serialize,validate} from '../src/engine.mjs';
import {canonicalEdge} from '../src/rust-stations.mjs';
import {recordRelationshipEvidence} from '../src/relationships.mjs';
import {recordEarnedSkill} from '../src/skill-provenance.mjs';
import {resourceStock} from '../src/individual-resources.mjs';
import {stepSettlementAuthority} from '../src/settlement-authority.mjs';
import {stepGovernanceAuthority,governanceOffice} from '../src/governance-authority.mjs';
import {stepGovernancePolicy,activeGovernancePolicy} from '../src/governance-policy.mjs';

const s=createWorld(260926,{mode:'independent',population:3});
const governor=s.agents[1],supporter=s.agents[2];

function give(a,kind){
  const id=s.rustPossessions.nextItem++;
  s.rustPossessions.items.push({id,kind,createdBy:a.id,createdTick:s.tick,location:{kind:'bag',agentId:a.id}});
  return id;
}
function equipHammer(a){
  const id=give(a,'HAMMER');
  const r=command(s,'EQUIP_ITEM',{agentId:a.id,itemId:id});
  if(!r.ok)throw new Error('equip failed '+JSON.stringify(r));
}
function place(a,kind,socket,label){
  const id=give(a,kind);
  const r=command(s,'PLACE_STATION',{
    agentId:a.id,itemInstanceId:id,socket,
    placementId:'gov-browser:'+label+':'+a.id+':'+id
  });
  if(!r.ok)throw new Error('placement failed '+kind+' '+JSON.stringify(r));
}
function buildHome(a,x,y,label){
  a.x=x;a.y=y;a.task=null;equipHammer(a);
  place(a,'WOOD_FOUNDATION',{type:'cell',x,y},label);
  place(a,'WOOD_WALL',canonicalEdge(x,y,'N'),label);
  place(a,'WOOD_WALL',canonicalEdge(x,y,'E'),label);
  place(a,'WOOD_WALL',canonicalEdge(x,y,'W'),label);
  place(a,'WOOD_DOORWAY',canonicalEdge(x,y,'S'),label);
  place(a,'WOOD_ROOF',{type:'cell',x,y},label);
}

buildHome(governor,5,5,'a');
buildHome(supporter,8,5,'b');

let r=recordRelationshipEvidence(s,{
  fromId:supporter.id,toId:governor.id,kind:'governance-support',
  key:'gov-browser:support:1',tick:0,delta:{trust:4,respect:2,affinity:1}
});
if(!r.ok)throw new Error('support failed '+JSON.stringify(r));
s.tick=30;
r=recordRelationshipEvidence(s,{
  fromId:supporter.id,toId:governor.id,kind:'governance-support',
  key:'gov-browser:support:2',tick:30,delta:{}
});
if(!r.ok)throw new Error('support evidence failed '+JSON.stringify(r));

s.tick=120;
governor.skills.LEADERSHIP+=10;
if(!recordEarnedSkill(governor,'LEADERSHIP',10,s.tick,{action:'GOV_BROWSER'}))throw new Error('leadership evidence failed');

const aStock=resourceStock(s,governor),bStock=resourceStock(s,supporter);
Object.assign(aStock,{food:999,wood:999,stone:999});
Object.assign(bStock,{food:0,wood:999,stone:999});

s.tick=360;
const settlement=stepSettlementAuthority(s,{force:true});
if(!settlement?.createdIds?.includes('S1'))throw new Error('settlement failed '+JSON.stringify(settlement));
const officeStep=stepGovernanceAuthority(s,{force:true});
if(!officeStep?.appointed?.some(x=>x.governorId===governor.id))throw new Error('governor appointment failed '+JSON.stringify(officeStep));
const policyStep=stepGovernancePolicy(s,{force:true});
const office=governanceOffice(s,'S1'),policy=activeGovernancePolicy(s,'S1');
if(office?.governorId!==governor.id||policy?.good!=='food')throw new Error('governance fixture failed');

const errors=validate(s);if(errors.length)throw new Error('invalid fixture '+errors.join(','));
console.log(serialize(s));
