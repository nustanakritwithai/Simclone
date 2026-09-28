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
  calculateMerchantProgressionAfterCommit,
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
function tradeFingerprint(r){
  return [r.transactionId,r.marketId,r.sellerId,r.buyerId,r.itemKind,r.itemInstanceId,r.quantity,r.unitPrice,r.totalPrice,r.listingId,r.reservationId]
    .map(value=>String(value)).join('|');
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
    eventId:'TRADE:'+transactionId,
    marketId:'M1',
    listingId:'L-'+transactionId,
    reservationId:'R-'+transactionId,
    buyerId,
    sellerId,
    itemKind:'STONE_PICKAXE',
    itemInstanceId:itemId,
    itemIds:[itemId],
    quantity:1,
    unitPrice:10,
    totalPrice:10,
    ...receiptOverrides,
  };
  receipt.fingerprint=tradeFingerprint(receipt);
  receipt.integrityFingerprint=receipt.fingerprint+'|ITEMS|'+receipt.itemIds.slice().sort((a,b)=>a-b).join(',');
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

test('Merchant profession and seeded progression survive engine save/load',()=>{
  const s=createWorld(230926),a=s.agents[0];
  const adopted=adoptMerchantProfession(a,validSnapshot({agentId:a.id,evidenceId:'save-load-merchant'}),s.tick);
  assert.equal(adopted.changed,true);
  a.merchantTransactions=3;a.merchantExperience=3;
  assert.deepEqual(validate(s),[]);
  const restored=restore(serialize(s)),b=restored.agents.find(row=>row.id===a.id);
  assert.equal(b.profession,'merchant');assert.equal(b.career.at(-1).profession,'merchant');
  assert.deepEqual(merchantProgressionSnapshot(b),{merchantTransactions:3,merchantRealizedProfit:null,merchantExperience:3});
  assert.deepEqual(validateMerchantProgression(b),[]);assert.deepEqual(validate(restored),[]);
});

test('non-duplicate VERIFIED + COMMITTED-looking buyer evidence fails closed without progression',()=>{
  const a=worker(7);assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:7,evidenceId:'merchant-proof-7'}),1).changed,true);
  const before=JSON.stringify(a),evidence=canonicalEvidence({transactionId:'tx-buyer',buyerId:7,sellerId:2,itemId:801});
  const assessed=assessMerchantCareerTransactionEvidence(a,evidence);
  assert.equal(assessed.status,'UNKNOWN');assert.equal(assessed.reason,'trade-commit-provenance');
  const result=noteVerifiedCommittedMerchantTransaction(a,evidence);
  assert.equal(result.counted,false);assert.equal(result.status,'UNKNOWN');assert.equal(JSON.stringify(a),before);
});

test('non-duplicate VERIFIED + COMMITTED-looking seller evidence also fails closed',()=>{
  const a=worker(8);assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:8,evidenceId:'merchant-proof-8'}),1).changed,true);
  const before=JSON.stringify(a),result=noteVerifiedCommittedMerchantTransaction(a,canonicalEvidence({transactionId:'tx-seller',buyerId:2,sellerId:8,itemId:802}));
  assert.equal(result.counted,false);assert.equal(result.status,'UNKNOWN');assert.equal(result.reason,'trade-commit-provenance');assert.equal(JSON.stringify(a),before);
});

test('canonical duplicate:true remains a harmless no-op',()=>{
  const a=worker(10);assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:10,evidenceId:'merchant-proof-10'}),1).changed,true);
  a.merchantTransactions=5;a.merchantExperience=5;const before=JSON.stringify(a);
  const replay=noteVerifiedCommittedMerchantTransaction(a,canonicalEvidence({transactionId:'tx-replay',buyerId:10,sellerId:2,itemId:803,duplicate:true}));
  assert.equal(replay.counted,false);assert.equal(replay.status,'SAT');assert.equal(replay.reason,'canonical-duplicate');assert.equal(JSON.stringify(a),before);
});

test('Merchant party lock rejects another-party evidence before provenance promotion',()=>{
  const a=worker(11);assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:11,evidenceId:'merchant-proof-11'}),1).changed,true);
  const before=JSON.stringify(a),result=noteVerifiedCommittedMerchantTransaction(a,canonicalEvidence({transactionId:'tx-other',buyerId:2,sellerId:3,itemId:804}));
  assert.equal(result.counted,false);assert.equal(result.status,'VIOL');assert.equal(result.reason,'merchant-not-party');assert.equal(JSON.stringify(a),before);
});

test('malformed or tampered canonical receipt is VIOL and immutable',()=>{
  const a=worker(13);assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:13,evidenceId:'merchant-proof-13'}),1).changed,true);
  const malformed=canonicalEvidence({transactionId:'tx-bad',buyerId:13,sellerId:2,itemId:807,receiptOverrides:{totalPrice:11}});
  const tampered=canonicalEvidence({transactionId:'tx-tamper',buyerId:13,sellerId:2,itemId:808});tampered.receipt.fingerprint='forged';
  const before=JSON.stringify(a);
  for(const evidence of [malformed,tampered]){
    const result=noteVerifiedCommittedMerchantTransaction(a,evidence);assert.equal(result.counted,false);assert.equal(result.status,'VIOL');
  }
  assert.equal(JSON.stringify(a),before);
});

test('fully forged VERIFIED/COMMITTED evidence cannot progress Career',()=>{
  const a=worker(14);assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:14,evidenceId:'merchant-proof-14'}),1).changed,true);
  const evidence=canonicalEvidence({transactionId:'tx-forged-full',buyerId:14,sellerId:2,itemId:809});
  evidence.verified=true;evidence.committed=true;
  const before=JSON.stringify(a),result=noteVerifiedCommittedMerchantTransaction(a,evidence);
  assert.equal(result.status,'UNKNOWN');assert.equal(result.reason,'trade-commit-provenance');assert.equal(result.counted,false);assert.equal(JSON.stringify(a),before);
});

test('more than 32 forged-looking non-duplicate commits cannot accumulate progression',()=>{
  const a=worker(15);assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:15,evidenceId:'merchant-proof-15'}),1).changed,true);
  const before=JSON.stringify(a);
  for(let i=1;i<=33;i++){
    const result=noteVerifiedCommittedMerchantTransaction(a,canonicalEvidence({transactionId:'tx-long-'+i,buyerId:15,sellerId:2,itemId:900+i}));
    assert.equal(result.counted,false);assert.equal(result.status,'UNKNOWN');
  }
  assert.equal(JSON.stringify(a),before);
});

test('save/load seeded progression then canonical duplicate replay is byte-stable',()=>{
  const s=createWorld(991),a=s.agents[0];
  assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:a.id,evidenceId:'merchant-save-replay'}),s.tick).changed,true);
  a.merchantTransactions=33;a.merchantExperience=33;
  const restored=restore(serialize(s)),b=restored.agents.find(row=>row.id===a.id),before=serialize(restored);
  const replay=noteVerifiedCommittedMerchantTransaction(b,canonicalEvidence({transactionId:'tx-old',buyerId:b.id,sellerId:2,itemId:1001,duplicate:true}));
  assert.equal(replay.counted,false);assert.equal(replay.status,'SAT');assert.equal(serialize(restored),before);
});

test('pure post-commit progression calculation is non-mutating and party-locked',()=>{
  const a=worker(18);assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:18,evidenceId:'merchant-proof-18'}),1).changed,true);
  a.merchantTransactions=4;a.merchantExperience=7;const before=JSON.stringify(a);
  const receipt=canonicalEvidence({transactionId:'tx-calc',buyerId:18,sellerId:2,itemId:1301}).receipt;
  const calc=calculateMerchantProgressionAfterCommit(a,receipt);
  assert.deepEqual(calc,{status:'SAT',reason:'authoritative-post-commit-calculation',transactionId:'tx-calc',merchantTransactions:5,merchantExperience:8});
  assert.equal(JSON.stringify(a),before);
  const other=canonicalEvidence({transactionId:'tx-other-calc',buyerId:2,sellerId:3,itemId:1302}).receipt;
  assert.equal(calculateMerchantProgressionAfterCommit(a,other).status,'VIOL');
});

test('Merchant realized profit hook stays a read-only Merchant Ledger projection',()=>{
  const a=worker(9);assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:9,evidenceId:'merchant-proof-9'}),1).changed,true);
  const ledger={merchantId:9,purchases:[],sales:[],revenue:100,costOfGoodsSold:70,realizedProfit:30};
  assert.deepEqual(projectMerchantRealizedProfit(a,ledger),{status:'SAT',reason:'ledger-projection',merchantRealizedProfit:30,authority:'merchant-ledger'});
  assert.equal(Object.hasOwn(a,'merchantRealizedProfit'),false);
  assert.equal(projectMerchantRealizedProfit(a,null).status,'UNKNOWN');
  assert.equal(projectMerchantRealizedProfit(a,{...ledger,merchantId:10}).status,'VIOL');
  assert.equal(projectMerchantRealizedProfit(a,{...ledger,realizedProfit:31}).status,'VIOL');
});

test('Merchant career rejects a duplicate monetary profit field',()=>{
  const a=worker(8);assert.equal(adoptMerchantProfession(a,validSnapshot({agentId:8,evidenceId:'merchant-proof-8b'}),1).changed,true);
  assert.equal(Object.hasOwn(a,'merchantRealizedProfit'),false);a.merchantRealizedProfit=999;
  assert.deepEqual(validateMerchantProgression(a),['Merchant monetary duplicate']);
});

test('Merchant career module has no direct profession assignment',()=>{
  const source=readFileSync(new URL('../src/merchant-career.mjs',import.meta.url),'utf8');
  assert.equal(/\.profession\s*=(?!=)/.test(source),false);
  assert.ok(source.includes("adoptProfession(agent,'MERCHANT'"));
});
