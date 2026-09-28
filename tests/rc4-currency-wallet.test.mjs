import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  CURRENCY_WALLET_BOOTSTRAP_BALANCE,createCurrencyWalletState,validateCurrencyWallet,totalCurrency,getBalance,
  createCurrencyAccount,credit,debit,transfer,migrateLegacyCurrencyWallet,canonicalCurrencyBytes
} from '../src/currency-wallet.mjs';
import {createTradeWalletAdapter} from '../src/trade-wallet-adapter.mjs';

const clone=v=>structuredClone(v);
const base=()=>({seed:42,tick:10,agents:[{id:1,alive:true,name:'A'},{id:2,alive:true,name:'B'},{id:3,alive:true,name:'C'}]});
function migrated(){const s=base();const r=migrateLegacyCurrencyWallet(s);assert.equal(r.ok,true);return s;}
function explicit(balances=[100,200,300]){
  const s=base();s.currencyWallet=createCurrencyWalletState();
  for(const [i,balance] of balances.entries())s.currencyWallet.accounts.push({agentId:i+1,balance});
  return s;
}
function unchanged(s,fn){const before=clone(s),r=fn();assert.deepEqual(s,before);return r;}

test('1 legacy bootstrap is deterministic and explicit',()=>{
  const a=base(),b=base(),ra=migrateLegacyCurrencyWallet(a),rb=migrateLegacyCurrencyWallet(b);
  assert.equal(ra.ok,true);assert.equal(ra.granted,3*CURRENCY_WALLET_BOOTSTRAP_BALANCE);assert.equal(JSON.stringify(a),JSON.stringify(b));
});
test('2 duplicate account is rejected',()=>{const s=migrated();const r=unchanged(s,()=>createCurrencyAccount(s,{agentId:1}));assert.equal(r.reason,'duplicate-account');});
test('3 get balance',()=>{const s=migrated();assert.equal(getBalance(s,2),100);});
test('4 valid explicit credit is audit-visible',()=>{const s=migrated(),r=credit(s,1,25,{transactionId:'MINT-1',operation:'SYSTEM_MINT',reason:'test'});assert.equal(r.ok,true);assert.equal(getBalance(s,1),125);});
test('5 valid explicit debit is audit-visible',()=>{const s=migrated(),r=debit(s,1,25,{transactionId:'BURN-1',operation:'SYSTEM_BURN',reason:'test'});assert.equal(r.ok,true);assert.equal(getBalance(s,1),75);});
test('6 debit over balance fails without mutation',()=>{const s=migrated(),r=unchanged(s,()=>debit(s,1,101,{transactionId:'BURN-X',operation:'SYSTEM_BURN'}));assert.equal(r.reason,'insufficient-funds');});
test('7 amount zero is invalid',()=>{const s=migrated();assert.equal(unchanged(s,()=>debit(s,1,0,{transactionId:'BURN-0',operation:'SYSTEM_BURN'})).reason,'amount');});
test('8 negative amount rejected',()=>{const s=migrated();assert.equal(unchanged(s,()=>transfer(s,{transactionId:'T-neg',fromAgentId:1,toAgentId:2,amount:-1})).reason,'amount');});
test('9 float rejected',()=>{const s=migrated();assert.equal(unchanged(s,()=>transfer(s,{transactionId:'T-float',fromAgentId:1,toAgentId:2,amount:1.5})).reason,'amount');});
test('10 NaN rejected',()=>{const s=migrated();assert.equal(unchanged(s,()=>transfer(s,{transactionId:'T-nan',fromAgentId:1,toAgentId:2,amount:NaN})).reason,'amount');});
test('11 Infinity rejected',()=>{const s=migrated();assert.equal(unchanged(s,()=>transfer(s,{transactionId:'T-inf',fromAgentId:1,toAgentId:2,amount:Infinity})).reason,'amount');});
test('12 overflow rejected',()=>{const s=explicit([100,Number.MAX_SAFE_INTEGER,0]);assert.deepEqual(validateCurrencyWallet(s),[]);const r=unchanged(s,()=>transfer(s,{transactionId:'T-over',fromAgentId:1,toAgentId:2,amount:1}));assert.equal(r.reason,'overflow');});
test('13 transfer A to B succeeds',()=>{const s=explicit([100,20,0]),r=transfer(s,{transactionId:'T-1',fromAgentId:1,toAgentId:2,amount:30,evidence:{reason:'trade'}});assert.equal(r.ok,true);assert.equal(getBalance(s,1),70);assert.equal(getBalance(s,2),50);});
test('14 transfer conserves money',()=>{const s=explicit([100,20,0]),before=totalCurrency(s),r=transfer(s,{transactionId:'T-2',fromAgentId:1,toAgentId:2,amount:30});assert.equal(r.totalBefore,before);assert.equal(r.totalAfter,before);assert.equal(totalCurrency(s),before);});
test('15 self transfer rejected',()=>{const s=migrated();assert.equal(unchanged(s,()=>transfer(s,{transactionId:'T-self',fromAgentId:1,toAgentId:1,amount:1})).reason,'self-transfer');});
test('16 missing sender rejected',()=>{const s=migrated();assert.equal(unchanged(s,()=>transfer(s,{transactionId:'T-ms',fromAgentId:9,toAgentId:1,amount:1})).reason,'sender');});
test('17 missing receiver rejected',()=>{const s=migrated();assert.equal(unchanged(s,()=>transfer(s,{transactionId:'T-mr',fromAgentId:1,toAgentId:9,amount:1})).reason,'receiver');});
test('18 exact replay does not transfer twice',()=>{const s=explicit([100,20,0]),p={transactionId:'T-replay',fromAgentId:1,toAgentId:2,amount:30,evidence:{source:'test'}},a=transfer(s,p);assert.equal(a.ok,true);const bytes=JSON.stringify(s),b=transfer(s,p);assert.equal(b.ok,true);assert.equal(b.duplicate,true);assert.equal(JSON.stringify(s),bytes);});
test('19 same transaction id different payload conflicts',()=>{const s=explicit([100,20,0]);assert.equal(transfer(s,{transactionId:'T-conflict',fromAgentId:1,toAgentId:2,amount:10}).ok,true);const r=unchanged(s,()=>transfer(s,{transactionId:'T-conflict',fromAgentId:1,toAgentId:2,amount:11}));assert.equal(r.reason,'transaction-conflict');});
test('20 save/load balance identical',()=>{const s=explicit([100,20,0]);transfer(s,{transactionId:'T-save',fromAgentId:1,toAgentId:2,amount:30});const loaded=JSON.parse(JSON.stringify(s));assert.equal(getBalance(loaded,1),70);assert.equal(getBalance(loaded,2),50);assert.deepEqual(validateCurrencyWallet(loaded),[]);});
test('21 save/load keeps replay protection',()=>{const s=explicit([100,20,0]),p={transactionId:'T-save-replay',fromAgentId:1,toAgentId:2,amount:30};transfer(s,p);const loaded=JSON.parse(JSON.stringify(s)),bytes=JSON.stringify(loaded),r=transfer(loaded,p);assert.equal(r.duplicate,true);assert.equal(JSON.stringify(loaded),bytes);});
test('22 legacy migration runs once',()=>{const s=base(),a=migrateLegacyCurrencyWallet(s),b=migrateLegacyCurrencyWallet(s);assert.equal(a.duplicate,false);assert.equal(b.duplicate,true);});
test('23 repeated migration never grants more money',()=>{const s=base();migrateLegacyCurrencyWallet(s);const before=totalCurrency(s),bytes=JSON.stringify(s);migrateLegacyCurrencyWallet(s);assert.equal(totalCurrency(s),before);assert.equal(JSON.stringify(s),bytes);});
test('24 failed operations leave source state unchanged',()=>{const s=migrated();for(const fn of [()=>transfer(s,{transactionId:'F1',fromAgentId:1,toAgentId:2,amount:999}),()=>credit(s,1,-1,{transactionId:'F2',operation:'SYSTEM_MINT'}),()=>debit(s,1,1,{transactionId:'F3',operation:'SYSTEM_MINT'})])unchanged(s,fn);});
test('25 identical input produces byte-identical output',()=>{const a=explicit(),b=explicit(),p={transactionId:'T-byte',fromAgentId:1,toAgentId:2,amount:33,evidence:{z:1,a:'x'}};transfer(a,p);transfer(b,{...p,evidence:{a:'x',z:1}});assert.equal(canonicalCurrencyBytes(a),canonicalCurrencyBytes(b));});

test('red-team multi-agent transfer conservation remains 600',()=>{const s=explicit([100,200,300]);assert.equal(totalCurrency(s),600);for(const p of [
  {transactionId:'R1',fromAgentId:1,toAgentId:2,amount:40},{transactionId:'R2',fromAgentId:2,toAgentId:3,amount:75},{transactionId:'R3',fromAgentId:3,toAgentId:1,amount:10}
]){const r=transfer(s,p);assert.equal(r.ok,true);assert.equal(totalCurrency(s),600);}assert.equal(totalCurrency(s),600);});
test('duplicate wallet account fails closed',()=>{const s=explicit();s.currencyWallet.accounts.push({agentId:1,balance:0});assert.deepEqual(validateCurrencyWallet(s),['Currency wallet account']);assert.equal(getBalance(s,1),null);});
test('dead sender cannot initiate transfer but balance remains',()=>{const s=explicit();s.agents[0].alive=false;assert.equal(getBalance(s,1),100);assert.equal(unchanged(s,()=>transfer(s,{transactionId:'DEAD',fromAgentId:1,toAgentId:2,amount:1})).reason,'sender-dead');});
test('receipt tampering fails closed',()=>{const s=explicit();transfer(s,{transactionId:'T-tamper',fromAgentId:1,toAgentId:2,amount:1});s.currencyWallet.receipts[0].amount=2;assert.deepEqual(validateCurrencyWallet(s),['Currency wallet receipt']);});
test('trade adapter debit is validation-only and credit commits one conserved canonical transfer',()=>{const s=explicit([100,20,0]),wallet=createTradeWalletAdapter({transactionId:'TRADE-1',fromAgentId:1,toAgentId:2,amount:30,evidence:{source:'kernel'}}),before=JSON.stringify(s);assert.equal(wallet.balance(s,1),100);assert.equal(wallet.debit(s,1,30).ok,true);assert.equal(JSON.stringify(s),before);assert.equal(totalCurrency(s),120);const paid=wallet.credit(s,2,30);assert.equal(paid.ok,true);assert.equal(getBalance(s,1),70);assert.equal(getBalance(s,2),50);assert.equal(totalCurrency(s),120);const bytes=JSON.stringify(s);assert.equal(wallet.debit(s,1,30).ok,true);assert.equal(JSON.stringify(s),bytes);assert.equal(wallet.credit(s,2,30).duplicate,true);assert.equal(JSON.stringify(s),bytes);});
test('trade adapter rejects redirected party or amount without mutation',()=>{const s=explicit([100,20,0]),wallet=createTradeWalletAdapter({transactionId:'TRADE-LOCK',fromAgentId:1,toAgentId:2,amount:30}),before=JSON.stringify(s);for(const r of [wallet.debit(s,3,30),wallet.debit(s,1,29),wallet.credit(s,3,30),wallet.credit(s,2,29)])assert.equal(r.ok,false);assert.equal(JSON.stringify(s),before);assert.equal(totalCurrency(s),120);});
test('trade adapter credit without prior debit still moves conserved money rather than minting',()=>{const s=explicit([100,20,0]),wallet=createTradeWalletAdapter({transactionId:'TRADE-DIRECT',fromAgentId:1,toAgentId:2,amount:30}),before=totalCurrency(s),r=wallet.credit(s,2,30);assert.equal(r.ok,true);assert.equal(getBalance(s,1),70);assert.equal(getBalance(s,2),50);assert.equal(totalCurrency(s),before);});
test('source forbids random and wall clock rules',()=>{for(const f of ['../src/currency-wallet.mjs','../src/trade-wallet-adapter.mjs']){const src=readFileSync(new URL(f,import.meta.url),'utf8');assert.equal(src.includes('Math.random'),false);assert.equal(src.includes('Date.now'),false);assert.equal(/new\s+Date\s*\(/.test(src),false);}});
