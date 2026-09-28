import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,serialize,restore,validate} from '../src/engine.mjs';
import {adoptProfession,professionLabel} from '../src/kingdom-utility.mjs';
import {
  MERCHANT_QUALIFICATION_POLICY,
  evaluateMerchantQualification,
  adoptMerchantProfession,
  merchantProgressionSnapshot,
  noteVerifiedCommittedMerchantTransaction,
  validateMerchantProgression,
} from '../src/merchant-career.mjs';

function validSnapshot(overrides={}){
  return {
    agentId:1,
    alive:true,
    lifeStage:'ADULT',
    professionTransitionAllowed:true,
    homeControl:{status:'CONFIRMED',houseId:'h1'},
    operatingCapital:{status:'CONFIRMED',amount:MERCHANT_QUALIFICATION_POLICY.minOperatingCapital},
    tradeKnowledge:{status:'CONFIRMED',evidenceCount:MERCHANT_QUALIFICATION_POLICY.minTradeEvidence},
    evidenceId:'merchant-proof-1',
    ...overrides,
  };
}
function worker(id=1){
  return {
    id,
    preference:'FORAGE',
    skills:{FORAGE:10,WOODCUT:1,MINE:1,BUILD:1},
    profession:'forager',
    professionSinceTick:0,
    career:[{tick:0,profession:'forager'}],
  };
}

test('Merchant qualification is pure and requires alive adult-capable agent',()=>{
  const input=validSnapshot(),before=JSON.stringify(input);
  const good=evaluateMerchantQualification(input);
  assert.equal(good.status,'SAT');
  assert.equal(good.qualified,true);
  assert.equal(JSON.stringify(input),before);

  const child=evaluateMerchantQualification(validSnapshot({lifeStage:'CHILD'}));
  assert.equal(child.status,'VIOL');
  assert.equal(child.qualified,false);

  const dead=evaluateMerchantQualification(validSnapshot({alive:false,lifeStage:'DEAD'}));
  assert.equal(dead.status,'VIOL');
  assert.equal(dead.qualified,false);
});

test('Merchant qualification rejects missing home and insufficient operating capital',()=>{
  const noHome=evaluateMerchantQualification(validSnapshot({homeControl:{status:'ABSENT'}}));
  assert.equal(noHome.status,'VIOL');
  assert.equal(noHome.qualified,false);

  const poor=evaluateMerchantQualification(validSnapshot({
    operatingCapital:{status:'CONFIRMED',amount:MERCHANT_QUALIFICATION_POLICY.minOperatingCapital-1},
  }));
  assert.equal(poor.status,'VIOL');
  assert.equal(poor.qualified,false);
});

test('UNKNOWN Merchant evidence never passes',()=>{
  const unknownHome=evaluateMerchantQualification(validSnapshot({homeControl:{status:'UNKNOWN'}}));
  assert.equal(unknownHome.status,'UNKNOWN');
  assert.equal(unknownHome.qualified,false);

  const unknownTrade=evaluateMerchantQualification(validSnapshot({tradeKnowledge:{status:'UNKNOWN'}}));
  assert.equal(unknownTrade.status,'UNKNOWN');
  assert.equal(unknownTrade.qualified,false);

  const missingTransition=evaluateMerchantQualification(validSnapshot({professionTransitionAllowed:undefined}));
  assert.equal(missingTransition.status,'UNKNOWN');
  assert.equal(missingTransition.qualified,false);
});

test('Merchant adoption routes through profession authority and replay does not duplicate career history',()=>{
  const a=worker(3),snapshot=validSnapshot({agentId:3});
  const before=a.career.length;
  const first=adoptMerchantProfession(a,snapshot,10);
  assert.equal(first.status,'SAT');
  assert.equal(first.changed,true);
  assert.equal(a.profession,'merchant');
  assert.equal(professionLabel(a.profession),'พ่อค้า');
  assert.equal(a.career.length,before+1);
  assert.equal(a.career.at(-1).profession,'merchant');

  const history=JSON.stringify(a.career);
  const replay=adoptMerchantProfession(a,snapshot,10);
  assert.equal(replay.status,'SAT');
  assert.equal(replay.changed,false);
  assert.equal(JSON.stringify(a.career),history);
});

test('Merchant does not overwrite locked Adventurer and ordinary work does not overwrite Merchant',()=>{
  const adventurer={...worker(4),profession:'adventurer',career:[{tick:0,profession:'adventurer'}]};
  const blocked=adoptMerchantProfession(adventurer,validSnapshot({agentId:4,evidenceId:'merchant-proof-4'}),12);
  assert.equal(blocked.status,'VIOL');
  assert.equal(blocked.changed,false);
  assert.equal(adventurer.profession,'adventurer');
  assert.equal(adventurer.career.length,1);

  const merchant=worker(5);
  assert.equal(adoptMerchantProfession(merchant,validSnapshot({agentId:5,evidenceId:'merchant-proof-5'}),13).changed,true);
  const history=JSON.stringify(merchant.career);
  for(const kind of ['WOODCUT','MINE','BUILD','FORAGE'])assert.equal(adoptProfession(merchant,kind,20).changed,false);
  assert.equal(merchant.profession,'merchant');
  assert.equal(JSON.stringify(merchant.career),history);

  merchant.adventurerQualification={version:1,accepted:3,recent:[
    {id:'0:1:1',tick:0,x:1,y:1},
    {id:'1:1:2',tick:1,x:1,y:2},
    {id:'2:2:2',tick:2,x:2,y:2},
  ]};
  assert.equal(adoptProfession(merchant,'EXPLORE',21,{qualifiedProfession:'adventurer',qualification:'explore-3'}).changed,false);
  assert.equal(merchant.profession,'merchant');
});

test('Merchant profession and career continuity survive engine save/load',()=>{
  const s=createWorld(230926),a=s.agents[0];
  const adopted=adoptMerchantProfession(a,validSnapshot({agentId:a.id,evidenceId:'save-load-merchant'}),s.tick);
  assert.equal(adopted.changed,true);
  const tx=noteVerifiedCommittedMerchantTransaction(a,{transactionId:'tx-save-1',verified:true,committed:true,realizedProfit:3});
  assert.equal(tx.counted,true);
  assert.deepEqual(validate(s),[]);

  const restored=restore(serialize(s)),b=restored.agents.find(row=>row.id===a.id);
  assert.equal(b.profession,'merchant');
  assert.equal(b.career.at(-1).profession,'merchant');
  assert.deepEqual(merchantProgressionSnapshot(b),{merchantTransactions:1,merchantRealizedProfit:3,merchantExperience:1});
  assert.deepEqual(validateMerchantProgression(b),[]);
  assert.deepEqual(validate(restored),[]);
});

test('Merchant progression counts only verified and committed transactions and is replay-safe within retained receipts',()=>{
  const a=worker(7);
  assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:7,evidenceId:'merchant-proof-7'}),1).changed,true);

  assert.equal(noteVerifiedCommittedMerchantTransaction(a,{transactionId:'tx-0',verified:false,committed:true,realizedProfit:9}).counted,false);
  assert.equal(noteVerifiedCommittedMerchantTransaction(a,{transactionId:'tx-0',verified:true,committed:false,realizedProfit:9}).counted,false);
  assert.equal(noteVerifiedCommittedMerchantTransaction(a,{transactionId:'tx-0',committed:true,realizedProfit:9}).status,'UNKNOWN');
  assert.deepEqual(merchantProgressionSnapshot(a),{merchantTransactions:0,merchantRealizedProfit:0,merchantExperience:0});

  const first=noteVerifiedCommittedMerchantTransaction(a,{transactionId:'tx-1',verified:true,committed:true,realizedProfit:4.5});
  assert.equal(first.counted,true);
  assert.deepEqual(merchantProgressionSnapshot(a),{merchantTransactions:1,merchantRealizedProfit:4.5,merchantExperience:1});

  const replay=noteVerifiedCommittedMerchantTransaction(a,{transactionId:'tx-1',verified:true,committed:true,realizedProfit:4.5});
  assert.equal(replay.counted,false);
  assert.equal(replay.reason,'replay');

  const second=noteVerifiedCommittedMerchantTransaction(a,{transactionId:'tx-2',verified:true,committed:true,realizedProfit:-2});
  assert.equal(second.counted,true);
  assert.deepEqual(merchantProgressionSnapshot(a),{merchantTransactions:2,merchantRealizedProfit:2.5,merchantExperience:2});
  assert.deepEqual(validateMerchantProgression(a),[]);
});

test('Merchant career module has no direct profession assignment',()=>{
  const source=readFileSync(new URL('../src/merchant-career.mjs',import.meta.url),'utf8');
  assert.equal(/\.profession\s*=(?!=)/.test(source),false);
  assert.ok(source.includes("adoptProfession(agent,'MERCHANT'"));
});
