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
  projectMerchantRealizedProfit,
  assessMerchantCareerTransactionEvidence,
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
function canonicalEvidence({
  transactionId='tx-1',
  buyerId=1,
  sellerId=2,
  itemId=101,
  duplicate=false,
  verification='VERIFIED',
  commitStatus='COMMITTED',
  receiptOverrides={},
}={}){
  const receipt={
    transactionId,
    fingerprint:'fp:'+transactionId,
    eventId:'TRADE:'+transactionId,
    marketId:'M1',
    listingId:'L-'+transactionId,
    reservationId:'R-'+transactionId,
    buyerId,
    sellerId,
    itemKind:'STONE_PICKAXE',
    itemIds:[itemId],
    quantity:1,
    unitPrice:10,
    totalPrice:10,
    ...receiptOverrides,
  };
  if(duplicate)return {state:'SAT',duplicate:true,receipt};
  return {state:'SAT',duplicate:false,verification,commitStatus,receipt};
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
  const tx=noteVerifiedCommittedMerchantTransaction(a,canonicalEvidence({transactionId:'tx-save-1',buyerId:a.id,sellerId:2,itemId:701}));
  assert.equal(tx.counted,true);
  assert.deepEqual(validate(s),[]);

  const restored=restore(serialize(s)),b=restored.agents.find(row=>row.id===a.id);
  assert.equal(b.profession,'merchant');
  assert.equal(b.career.at(-1).profession,'merchant');
  assert.deepEqual(merchantProgressionSnapshot(b),{merchantTransactions:1,merchantRealizedProfit:null,merchantExperience:1});
  assert.deepEqual(validateMerchantProgression(b),[]);
  assert.deepEqual(validate(restored),[]);
});

test('canonical VERIFIED + COMMITTED Merchant buyer counts exactly once',()=>{
  const a=worker(7);
  assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:7,evidenceId:'merchant-proof-7'}),1).changed,true);
  const result=noteVerifiedCommittedMerchantTransaction(a,canonicalEvidence({transactionId:'tx-buyer',buyerId:7,sellerId:2,itemId:801}));
  assert.equal(result.counted,true);
  assert.equal(result.status,'SAT');
  assert.deepEqual(merchantProgressionSnapshot(a),{merchantTransactions:1,merchantRealizedProfit:null,merchantExperience:1});
});

test('canonical VERIFIED + COMMITTED Merchant seller counts exactly once',()=>{
  const a=worker(8);
  assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:8,evidenceId:'merchant-proof-8'}),1).changed,true);
  const result=noteVerifiedCommittedMerchantTransaction(a,canonicalEvidence({transactionId:'tx-seller',buyerId:2,sellerId:8,itemId:802}));
  assert.equal(result.counted,true);
  assert.equal(result.status,'SAT');
  assert.deepEqual(merchantProgressionSnapshot(a),{merchantTransactions:1,merchantRealizedProfit:null,merchantExperience:1});
});

test('canonical duplicate:true is a no-op and Career does not determine replay uniqueness',()=>{
  const a=worker(10);
  assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:10,evidenceId:'merchant-proof-10'}),1).changed,true);
  const first=noteVerifiedCommittedMerchantTransaction(a,canonicalEvidence({transactionId:'tx-replay',buyerId:10,sellerId:2,itemId:803}));
  assert.equal(first.counted,true);
  const before=JSON.stringify(a);
  const replay=noteVerifiedCommittedMerchantTransaction(a,canonicalEvidence({transactionId:'tx-replay',buyerId:10,sellerId:2,itemId:803,duplicate:true}));
  assert.equal(replay.counted,false);
  assert.equal(replay.status,'SAT');
  assert.equal(replay.reason,'canonical-duplicate');
  assert.equal(JSON.stringify(a),before);
});

test('Merchant party lock rejects another party transaction',()=>{
  const a=worker(11);
  assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:11,evidenceId:'merchant-proof-11'}),1).changed,true);
  const before=JSON.stringify(a);
  const result=noteVerifiedCommittedMerchantTransaction(a,canonicalEvidence({transactionId:'tx-other',buyerId:2,sellerId:3,itemId:804}));
  assert.equal(result.counted,false);
  assert.equal(result.status,'VIOL');
  assert.equal(result.reason,'merchant-not-party');
  assert.equal(JSON.stringify(a),before);
});

test('missing canonical verification or commit status is UNKNOWN and immutable',()=>{
  const a=worker(12);
  assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:12,evidenceId:'merchant-proof-12'}),1).changed,true);
  const missingVerification=canonicalEvidence({transactionId:'tx-no-verify',buyerId:12,sellerId:2,itemId:805});
  delete missingVerification.verification;
  const missingCommit=canonicalEvidence({transactionId:'tx-no-commit',buyerId:12,sellerId:2,itemId:806});
  delete missingCommit.commitStatus;
  const before=JSON.stringify(a);
  assert.equal(noteVerifiedCommittedMerchantTransaction(a,missingVerification).status,'UNKNOWN');
  assert.equal(noteVerifiedCommittedMerchantTransaction(a,missingCommit).status,'UNKNOWN');
  assert.equal(JSON.stringify(a),before);
});

test('malformed canonical receipt is rejected',()=>{
  const a=worker(13);
  assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:13,evidenceId:'merchant-proof-13'}),1).changed,true);
  const bad=canonicalEvidence({transactionId:'tx-bad',buyerId:13,sellerId:2,itemId:807,receiptOverrides:{totalPrice:11}});
  const assessed=assessMerchantCareerTransactionEvidence(a,bad);
  assert.equal(assessed.status,'VIOL');
  assert.equal(assessed.reason,'trade-receipt');
  assert.equal(noteVerifiedCommittedMerchantTransaction(a,bad).counted,false);
});

test('forged legacy plain object cannot increase Merchant progression',()=>{
  const a=worker(14);
  assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:14,evidenceId:'merchant-proof-14'}),1).changed,true);
  const before=JSON.stringify(a);
  const forged={transactionId:'tx-forged',verified:true,committed:true};
  const result=noteVerifiedCommittedMerchantTransaction(a,forged);
  assert.equal(result.counted,false);
  assert.equal(result.status,'UNKNOWN');
  assert.equal(JSON.stringify(a),before);
});

test('legacy recent transaction ids are audit-only and never decide canonical uniqueness',()=>{
  const a=worker(16);
  assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:16,evidenceId:'merchant-proof-16'}),1).changed,true);
  a.merchantTransactionReceipts=['tx-audit'];
  assert.deepEqual(validateMerchantProgression(a),[]);
  const result=noteVerifiedCommittedMerchantTransaction(a,canonicalEvidence({
    transactionId:'tx-audit',buyerId:16,sellerId:2,itemId:890,
  }));
  assert.equal(result.counted,true);
  assert.deepEqual(a.merchantTransactionReceipts,['tx-audit']);
  assert.deepEqual(merchantProgressionSnapshot(a),{merchantTransactions:1,merchantRealizedProfit:null,merchantExperience:1});
});

test('more than 32 unique commits then replay of the first transaction stays a no-op',()=>{
  const a=worker(15);
  assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:15,evidenceId:'merchant-proof-15'}),1).changed,true);
  for(let i=1;i<=33;i++){
    const result=noteVerifiedCommittedMerchantTransaction(a,canonicalEvidence({
      transactionId:'tx-long-'+i,buyerId:15,sellerId:2,itemId:900+i,
    }));
    assert.equal(result.counted,true);
  }
  assert.deepEqual(merchantProgressionSnapshot(a),{merchantTransactions:33,merchantRealizedProfit:null,merchantExperience:33});
  assert.equal(Object.hasOwn(a,'merchantTransactionReceipts'),false);
  const before=JSON.stringify(a);
  const replay=noteVerifiedCommittedMerchantTransaction(a,canonicalEvidence({
    transactionId:'tx-long-1',buyerId:15,sellerId:2,itemId:901,duplicate:true,
  }));
  assert.equal(replay.counted,false);
  assert.equal(replay.reason,'canonical-duplicate');
  assert.equal(JSON.stringify(a),before);
});

test('save/load then old canonical duplicate replay cannot increase progression',()=>{
  const s=createWorld(991),a=s.agents[0];
  assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:a.id,evidenceId:'merchant-save-replay'}),s.tick).changed,true);
  for(let i=1;i<=33;i++)assert.equal(noteVerifiedCommittedMerchantTransaction(a,canonicalEvidence({
    transactionId:'tx-save-long-'+i,buyerId:a.id,sellerId:2,itemId:1000+i,
  })).counted,true);
  const restored=restore(serialize(s)),b=restored.agents.find(row=>row.id===a.id);
  const before=serialize(restored);
  const replay=noteVerifiedCommittedMerchantTransaction(b,canonicalEvidence({
    transactionId:'tx-save-long-1',buyerId:b.id,sellerId:2,itemId:1001,duplicate:true,
  }));
  assert.equal(replay.counted,false);
  assert.equal(replay.reason,'canonical-duplicate');
  assert.equal(serialize(restored),before);
  assert.deepEqual(merchantProgressionSnapshot(b),{merchantTransactions:33,merchantRealizedProfit:null,merchantExperience:33});
});

test('Merchant realized profit progression hook is a read-only projection of Merchant Ledger',()=>{
  const a=worker(9);
  assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:9,evidenceId:'merchant-proof-9'}),1).changed,true);
  noteVerifiedCommittedMerchantTransaction(a,canonicalEvidence({transactionId:'tx-ledger-1',buyerId:9,sellerId:2,itemId:1201}));
  const ledger={merchantId:9,purchases:[],sales:[],revenue:100,costOfGoodsSold:70,realizedProfit:30};

  const projection=projectMerchantRealizedProfit(a,ledger);
  assert.deepEqual(projection,{status:'SAT',reason:'ledger-projection',merchantRealizedProfit:30,authority:'merchant-ledger'});
  assert.deepEqual(merchantProgressionSnapshot(a,{ledger}),{
    merchantTransactions:1,
    merchantRealizedProfit:30,
    merchantExperience:1,
  });
  assert.equal(Object.hasOwn(a,'merchantRealizedProfit'),false);

  assert.equal(projectMerchantRealizedProfit(a,null).status,'UNKNOWN');
  assert.equal(projectMerchantRealizedProfit(a,{...ledger,merchantId:10}).status,'VIOL');
  assert.equal(projectMerchantRealizedProfit(a,{...ledger,realizedProfit:31}).status,'VIOL');
  assert.equal(merchantProgressionSnapshot(a,{ledger:{...ledger,realizedProfit:31}}).merchantRealizedProfit,null);
  assert.equal(Object.hasOwn(a,'merchantRealizedProfit'),false);
});

test('Merchant career rejects a duplicate monetary profit field and never stores realized profit',()=>{
  const a=worker(8);
  assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:8,evidenceId:'merchant-proof-8'}),1).changed,true);
  assert.equal(noteVerifiedCommittedMerchantTransaction(a,canonicalEvidence({transactionId:'tx-money-1',buyerId:8,sellerId:2,itemId:1202})).counted,true);
  assert.equal(Object.hasOwn(a,'merchantRealizedProfit'),false);
  a.merchantRealizedProfit=999;
  assert.deepEqual(validateMerchantProgression(a),['Merchant monetary duplicate']);
});

test('Merchant career module has no direct profession assignment',()=>{
  const source=readFileSync(new URL('../src/merchant-career.mjs',import.meta.url),'utf8');
  assert.equal(/\.profession\s*=(?!=)/.test(source),false);
  assert.ok(source.includes("adoptProfession(agent,'MERCHANT'"));
});
