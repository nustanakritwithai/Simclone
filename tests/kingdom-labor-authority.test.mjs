import test from 'node:test';
import assert from 'node:assert/strict';
import {KINGDOM_LABOR_AUTHORITY_VERSION,MAX_LABOR_AUTHORITY_BONUS,laborAuthoritySignal} from '../src/kingdom-labor-authority.mjs';
import {createWorld,step,validate} from '../src/engine.mjs';

test('K5 labor authority is bounded and specialist-only',()=>{
  assert.equal(KINGDOM_LABOR_AUTHORITY_VERSION,'K5-authority-0.1');
  assert.equal(MAX_LABOR_AUTHORITY_BONUS,6);
  const agents=[{alive:true,profession:'forager'},{alive:true,profession:'forager'}];
  const r=laborAuthoritySignal({kind:'WOODCUT',agent:agents[0],agents,stock:{food:99,wood:0,stone:99}});
  assert.equal(r.active,true);assert.ok(r.bonus>=1&&r.bonus<=6);
  assert.equal(laborAuthoritySignal({kind:'FORAGE',agent:agents[0],agents,stock:{food:0}}).bonus,0);
});

test('K5 cannot override survival emergency',()=>{
  const agents=[{alive:true,profession:'forager'}];
  const r=laborAuthoritySignal({kind:'MINE',agent:agents[0],agents,stock:{stone:0},emergency:true});
  assert.deepEqual({bonus:r.bonus,active:r.active,reason:r.reason},{bonus:0,active:false,reason:'survival-emergency'});
});

test('K5 stays inactive when staffing or scarcity is adequate',()=>{
  const staffed=Array.from({length:6},()=>({alive:true,profession:'woodcutter'}));
  assert.equal(laborAuthoritySignal({kind:'WOODCUT',agent:staffed[0],agents:staffed,stock:{wood:0}}).bonus,0);
  const few=[{alive:true,profession:'woodcutter'}];
  assert.equal(laborAuthoritySignal({kind:'WOODCUT',agent:few[0],agents:few,stock:{wood:999}}).bonus,0);
});

test('engine exposes bounded K5 factor inside authoritative score math',()=>{
  const s=createWorld(77);s.stock.wood=0;s.stock.stone=0;
  for(const a of s.agents){a.satiety=90;a.energy=90;}
  step(s,1);
  let seen=false;
  for(const a of s.agents)for(const c of a.trace){
    assert.equal(c.score,Object.values(c.factors).reduce((n,v)=>n+v,0));
    if(c.factors.laborMarket){seen=true;assert.ok(c.factors.laborMarket<=MAX_LABOR_AUTHORITY_BONUS);}
  }
  assert.equal(seen,true);assert.deepEqual(validate(s),[]);
});

test('K5 can break a close productive tie toward the more severe labor shortage',()=>{
  const s=createWorld(99),a=s.agents[0];
  s.tiles.fill('grass');s.agents=s.agents.slice(0,1);a.x=11;a.y=12;a.satiety=100;a.energy=100;a.preference='FORAGE';a.profession='forager';a.task=null;
  s.stock={food:999,wood:0,stone:3};
  s.nodes=[
    {id:1,type:'stone',x:12,y:12,amount:35,max:35},
    {id:2,type:'wood',x:15,y:12,amount:35,max:35},
  ];
  s.buildings=[{id:1,type:'camp',x:11,y:12,complete:true,progress:30}];
  step(s,1);
  const wood=a.trace.find(x=>x.kind==='WOODCUT'),mine=a.trace.find(x=>x.kind==='MINE');
  assert.ok((wood.factors.laborMarket??0)>(mine.factors.laborMarket??0));
  assert.equal(a.trace.find(x=>x.status==='selected').kind,'WOODCUT');
  assert.equal(a.task.kind,'WOODCUT');
});

test('hungry agent receives no K5 labor bonus in trace',()=>{
  const s=createWorld(88),a=s.agents[0];a.satiety=1;a.energy=90;s.stock.wood=0;s.stock.stone=0;
  step(s,1);
  for(const c of a.trace)assert.equal(c.factors.laborMarket??0,0);
  assert.ok(['EAT','FORAGE'].includes(a.task.kind));
});
