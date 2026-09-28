import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const REPO='nustanakritwithai/Simclone';
const ROOT=path.resolve(new URL('../..',import.meta.url).pathname);
const REQUIRED=[
  'src/merchant-career.mjs',
  'src/home-market.mjs',
  'src/trade-kernel.mjs',
  'src/trade-rust-adapter.mjs',
  'src/rc4-customer-market-policy.mjs',
  'src/rc4-merchant-policy.mjs',
  'src/merchant-listing.mjs',
  'src/merchant-buy-offer.mjs',
  'src/merchant-ledger.mjs',
  'src/merchant-pricing.mjs',
  'src/currency-wallet.mjs',
  'src/trade-wallet-adapter.mjs'
];
const forty=/^[0-9a-f]{40}$/;
const checks=[];
const add=(id,result,detail)=>checks.push({id,result,detail});
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const exists=rel=>fs.existsSync(path.join(ROOT,rel));

let actualHead=null;
try{
  actualHead=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
}catch(error){
  add('exact-head-readable','UNKNOWN','git rev-parse HEAD unavailable: '+String(error?.message??error));
}

const expected=(process.env.RC4_EXPECTED_HEAD??'').trim().toLowerCase();
if(!expected){
  add('expected-head-supplied','UNKNOWN','RC4_EXPECTED_HEAD is required. No SHA means no exact-head proof.');
}else if(!forty.test(expected)){
  add('expected-head-supplied','VIOL','RC4_EXPECTED_HEAD must be one full 40-character lowercase/uppercase hex SHA.');
}else{
  add('expected-head-supplied','SAT',expected);
  if(actualHead===null)add('exact-head-match','UNKNOWN','actual HEAD could not be resolved');
  else if(actualHead.toLowerCase()!==expected)add('exact-head-match','VIOL','expected '+expected+' but HEAD is '+actualHead);
  else add('exact-head-match','SAT',actualHead);
}

const missing=REQUIRED.filter(rel=>!exists(rel));
if(missing.length){
  add('canonical-rc4-modules-present','UNKNOWN','Integration candidate is incomplete. Missing: '+missing.join(', '));
}else{
  add('canonical-rc4-modules-present','SAT',REQUIRED.join(', '));

  const listing=read('src/merchant-listing.mjs');
  const trade=read('src/trade-kernel.mjs');

  const listingHasCanonicalId=/\brow\.id\b|\blisting\.id\b|\{\s*id\s*[,}]/.test(listing);
  const listingHasRevision=/\brevision\b/.test(listing);
  if(!listingHasCanonicalId || !listingHasRevision){
    add(
      'listing-vocabulary',
      'VIOL',
      'Canonical listing must expose listing.id and revision>=1. A listingId-only/no-revision donor is incompatible with the Trade Kernel and must be repaired at the owning subsystem, not hidden by a test/integration alias.'
    );
  }else{
    add('listing-vocabulary','SAT','merchant-listing source exposes canonical id and revision vocabulary');
  }

  const kernelRequiresId=/\blisting\.id\b/.test(trade);
  const kernelRequiresRevision=/\blisting\.revision\b/.test(trade)&&/\blistingRevision\b/.test(trade);
  if(!kernelRequiresId || !kernelRequiresRevision){
    add('trade-listing-contract','VIOL','Trade Kernel must bind canonical listing.id, listing.revision and reservation.listingRevision.');
  }else{
    add('trade-listing-contract','SAT','Trade Kernel source binds id/revision/listingRevision');
  }

  const forbidden=[
    ['Math.random',/Math\.random\s*\(/],
    ['Date.now',/Date\.now\s*\(/],
    ['new Date',/new\s+Date\s*\(/]
  ];
  for(const rel of REQUIRED){
    const text=read(rel);
    for(const [name,re] of forbidden){
      if(re.test(text))add('determinism:'+rel+':'+name,'VIOL',rel+' contains forbidden gameplay source token '+name);
    }
  }
  if(!checks.some(c=>c.id.startsWith('determinism:')&&c.result==='VIOL')){
    add('determinism-source-scan','SAT','No Math.random(), Date.now(), or new Date() call found in required RC4 modules.');
  }

  const duplicateWalletNames=[];
  const walletNamePattern=/\b(?:merchantWallet|shopWallet|customerWallet|marketWallet|adventureWallet)\b/g;
  for(const rel of REQUIRED){
    const text=read(rel);
    if(walletNamePattern.test(text))duplicateWalletNames.push(rel);
    walletNamePattern.lastIndex=0;
  }
  if(duplicateWalletNames.length)add('single-wallet-name-scan','VIOL','Forbidden parallel spendable-wallet name found in: '+duplicateWalletNames.join(', '));
  else add('single-wallet-name-scan','SAT','No forbidden merchant/shop/customer/market/adventure wallet name found in required RC4 modules.');
}

let result='SAT';
if(checks.some(c=>c.result==='VIOL'))result='VIOL';
else if(checks.some(c=>c.result==='UNKNOWN'))result='UNKNOWN';

const report={
  schema:'RC4-merchant-economy-preflight/1',
  repository:REPO,
  expectedHead:expected||null,
  actualHead,
  preflightResult:result,
  integrationVerdict:'UNKNOWN',
  integrationVerdictReason:'Preflight can only prove exact-head/static contract readiness. Full vertical, replay, atomicity, persistence, browser, retained-regression and independent Red Team evidence are still mandatory.',
  checks
};

process.stdout.write(JSON.stringify(report,null,2)+'\n');
process.exitCode=result==='SAT'?0:result==='VIOL'?1:2;
