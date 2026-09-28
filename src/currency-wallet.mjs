export const CURRENCY_WALLET_VERSION='RC4-wallet-1';
export const CURRENCY_WALLET_ROOT_KEY='currencyWallet';
export const CURRENCY_WALLET_BOOTSTRAP_VERSION='RC4-wallet-bootstrap-1';
export const CURRENCY_WALLET_BOOTSTRAP_BALANCE=100;

const MAX_ID_LENGTH=96;
const MAX_EVIDENCE_DEPTH=6;

const safeNonNegative=n=>Number.isSafeInteger(n)&&n>=0;
const safePositive=n=>Number.isSafeInteger(n)&&n>0;
const validAgentId=id=>safePositive(id);
const validTransactionId=id=>typeof id==='string'&&id.length>0&&id.length<=MAX_ID_LENGTH;

const clone=value=>structuredClone(value);

function canonicalize(value,depth=0){
  if(depth>MAX_EVIDENCE_DEPTH)throw new TypeError('evidence-depth');
  if(value===null||typeof value==='boolean'||typeof value==='string')return value;
  if(typeof value==='number'){
    if(!Number.isSafeInteger(value))throw new TypeError('evidence-number');
    return value;
  }
  if(Array.isArray(value))return value.map(v=>canonicalize(v,depth+1));
  if(value&&typeof value==='object'){
    const out={};
    for(const key of Object.keys(value).sort()){
      const v=value[key];
      if(v===undefined||typeof v==='function'||typeof v==='symbol'||typeof v==='bigint')throw new TypeError('evidence-value');
      out[key]=canonicalize(v,depth+1);
    }
    return out;
  }
  throw new TypeError('evidence-value');
}

function canonicalEvidence(evidence){
  if(evidence===undefined)return {};
  if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))throw new TypeError('evidence');
  return canonicalize(evidence);
}

function fingerprint(payload){return JSON.stringify(canonicalize(payload));}

function identityIndex(state){
  const rows=[...(state?.agents??[]),...(state?.archive??[])],map=new Map();
  for(const row of rows){
    if(!validAgentId(row?.id)||map.has(row.id))continue;
    map.set(row.id,row);
  }
  return map;
}

function livingAgent(state,agentId){
  return (state?.agents??[]).find(a=>a?.id===agentId&&a.alive!==false)??null;
}

function mutationPayload({kind,transactionId,agentId=null,fromAgentId=null,toAgentId=null,amount,evidence={}}){
  return {kind,transactionId,agentId,fromAgentId,toAgentId,amount,evidence:canonicalEvidence(evidence)};
}

function makeReceipt(payload){return {...payload,fingerprint:fingerprint(payload)};}

function validateReceipt(receipt){
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||!validTransactionId(receipt.transactionId)||
    typeof receipt.kind!=='string'||receipt.kind.length===0||receipt.kind.length>32||!safePositive(receipt.amount)||
    typeof receipt.fingerprint!=='string')return false;
  try{
    const payload=mutationPayload({
      kind:receipt.kind,transactionId:receipt.transactionId,agentId:receipt.agentId??null,
      fromAgentId:receipt.fromAgentId??null,toAgentId:receipt.toAgentId??null,
      amount:receipt.amount,evidence:receipt.evidence??{}
    });
    if(payload.agentId!==null&&!validAgentId(payload.agentId))return false;
    if(payload.fromAgentId!==null&&!validAgentId(payload.fromAgentId))return false;
    if(payload.toAgentId!==null&&!validAgentId(payload.toAgentId))return false;
    return receipt.fingerprint===fingerprint(payload);
  }catch{return false;}
}

export function createCurrencyWalletState(){
  return {version:CURRENCY_WALLET_VERSION,accounts:[],receipts:[],bootstrap:null};
}

export function validateCurrencyWallet(state){
  const wallet=state?.currencyWallet;
  if(!wallet||wallet.version!==CURRENCY_WALLET_VERSION||!Array.isArray(wallet.accounts)||!Array.isArray(wallet.receipts))return ['Currency wallet shape'];
  const ids=new Set(),known=identityIndex(state);
  for(const account of wallet.accounts){
    if(!account||!validAgentId(account.agentId)||!safeNonNegative(account.balance)||ids.has(account.agentId)||!known.has(account.agentId))return ['Currency wallet account'];
    ids.add(account.agentId);
  }
  const txIds=new Set();
  for(const receipt of wallet.receipts){
    if(!validateReceipt(receipt)||txIds.has(receipt.transactionId))return ['Currency wallet receipt'];
    txIds.add(receipt.transactionId);
  }
  if(wallet.bootstrap!==null){
    const b=wallet.bootstrap;
    if(!b||b.version!==CURRENCY_WALLET_BOOTSTRAP_VERSION||!safeNonNegative(b.initialBalance)||
      !Array.isArray(b.agentIds)||!b.agentIds.every(validAgentId)||new Set(b.agentIds).size!==b.agentIds.length||
      !safeNonNegative(b.totalGranted)||b.totalGranted!==b.initialBalance*b.agentIds.length||!Number.isSafeInteger(b.totalGranted))return ['Currency wallet bootstrap'];
    if(!b.agentIds.every(id=>ids.has(id)))return ['Currency wallet bootstrap'];
  }
  return [];
}

export function totalCurrency(state){
  if(validateCurrencyWallet(state).length)return null;
  let total=0;
  for(const account of state.currencyWallet.accounts){
    if(!Number.isSafeInteger(total+account.balance))return null;
    total+=account.balance;
  }
  return total;
}

export function getBalance(state,agentId){
  if(validateCurrencyWallet(state).length||!validAgentId(agentId))return null;
  return state.currencyWallet.accounts.find(a=>a.agentId===agentId)?.balance??null;
}

export function createCurrencyAccount(state,{agentId}={}){
  if(validateCurrencyWallet(state).length)return {ok:false,reason:'wallet-invalid'};
  if(!validAgentId(agentId)||!identityIndex(state).has(agentId))return {ok:false,reason:'agent'};
  if(state.currencyWallet.accounts.some(a=>a.agentId===agentId))return {ok:false,reason:'duplicate-account'};
  state.currencyWallet.accounts.push({agentId,balance:0});
  state.currencyWallet.accounts.sort((a,b)=>a.agentId-b.agentId);
  return {ok:true,agentId,balance:0};
}

function replayStatus(state,payload){
  const existing=state.currencyWallet.receipts.find(r=>r.transactionId===payload.transactionId);
  if(!existing)return {kind:'fresh'};
  return existing.fingerprint===fingerprint(payload)?{kind:'duplicate',receipt:existing}:{kind:'conflict'};
}

function commitSingleAccountMutation(state,{kind,transactionId,agentId,amount,evidence,delta,requireLiving=false}){
  if(validateCurrencyWallet(state).length)return {ok:false,reason:'wallet-invalid'};
  if(!validTransactionId(transactionId))return {ok:false,reason:'transaction-id'};
  if(!validAgentId(agentId)||!identityIndex(state).has(agentId))return {ok:false,reason:'agent'};
  if(requireLiving&&!livingAgent(state,agentId))return {ok:false,reason:'agent-dead'};
  if(!safePositive(amount))return {ok:false,reason:'amount'};
  let payload;try{payload=mutationPayload({kind,transactionId,agentId,amount,evidence});}catch{return {ok:false,reason:'evidence'};}
  const replay=replayStatus(state,payload);
  if(replay.kind==='duplicate')return {ok:true,duplicate:true,receipt:clone(replay.receipt)};
  if(replay.kind==='conflict')return {ok:false,reason:'transaction-conflict'};
  const row=state.currencyWallet.accounts.find(a=>a.agentId===agentId);
  if(!row)return {ok:false,reason:'account'};
  const next=row.balance+delta*amount;
  if(!safeNonNegative(next))return {ok:false,reason:delta<0?'insufficient-funds':'overflow'};
  const staged=clone(state.currencyWallet),stagedRow=staged.accounts.find(a=>a.agentId===agentId);
  stagedRow.balance=next;
  staged.receipts.push(makeReceipt(payload));
  const probe={...state,currencyWallet:staged};
  if(validateCurrencyWallet(probe).length)return {ok:false,reason:'wallet-postcondition'};
  state.currencyWallet=staged;
  return {ok:true,duplicate:false,agentId,balance:next,receipt:clone(staged.receipts.at(-1))};
}

export function credit(state,agentId,amount,evidence={}){
  if(evidence?.operation!=='INITIAL_GRANT'&&evidence?.operation!=='SYSTEM_MINT')return {ok:false,reason:'credit-authority'};
  return commitSingleAccountMutation(state,{kind:evidence.operation,transactionId:evidence.transactionId,agentId,amount,evidence,delta:1});
}

export function debit(state,agentId,amount,evidence={}){
  if(evidence?.operation!=='SYSTEM_BURN')return {ok:false,reason:'debit-authority'};
  return commitSingleAccountMutation(state,{kind:'SYSTEM_BURN',transactionId:evidence.transactionId,agentId,amount,evidence,delta:-1,requireLiving:true});
}

export function transfer(state,{transactionId,fromAgentId,toAgentId,amount,evidence={}}={}){
  if(validateCurrencyWallet(state).length)return {ok:false,reason:'wallet-invalid'};
  if(!validTransactionId(transactionId))return {ok:false,reason:'transaction-id'};
  if(!validAgentId(fromAgentId)||!validAgentId(toAgentId)||fromAgentId===toAgentId)return {ok:false,reason:fromAgentId===toAgentId?'self-transfer':'agent'};
  const known=identityIndex(state);
  if(!known.has(fromAgentId))return {ok:false,reason:'sender'};
  if(!known.has(toAgentId))return {ok:false,reason:'receiver'};
  if(!livingAgent(state,fromAgentId))return {ok:false,reason:'sender-dead'};
  if(!safePositive(amount))return {ok:false,reason:'amount'};
  let payload;try{payload=mutationPayload({kind:'TRANSFER',transactionId,fromAgentId,toAgentId,amount,evidence});}catch{return {ok:false,reason:'evidence'};}
  const replay=replayStatus(state,payload);
  if(replay.kind==='duplicate')return {ok:true,duplicate:true,receipt:clone(replay.receipt)};
  if(replay.kind==='conflict')return {ok:false,reason:'transaction-conflict'};
  const from=state.currencyWallet.accounts.find(a=>a.agentId===fromAgentId),to=state.currencyWallet.accounts.find(a=>a.agentId===toAgentId);
  if(!from)return {ok:false,reason:'sender-account'};
  if(!to)return {ok:false,reason:'receiver-account'};
  if(from.balance<amount)return {ok:false,reason:'insufficient-funds'};
  if(!Number.isSafeInteger(to.balance+amount))return {ok:false,reason:'overflow'};
  const totalBefore=totalCurrency(state);
  if(totalBefore===null)return {ok:false,reason:'conservation'};
  const staged=clone(state.currencyWallet),stagedFrom=staged.accounts.find(a=>a.agentId===fromAgentId),stagedTo=staged.accounts.find(a=>a.agentId===toAgentId);
  stagedFrom.balance-=amount;
  stagedTo.balance+=amount;
  staged.receipts.push(makeReceipt(payload));
  const probe={...state,currencyWallet:staged},totalAfter=totalCurrency(probe);
  if(totalAfter===null||totalAfter!==totalBefore||validateCurrencyWallet(probe).length)return {ok:false,reason:'conservation'};
  state.currencyWallet=staged;
  return {ok:true,duplicate:false,receipt:clone(staged.receipts.at(-1)),totalBefore,totalAfter};
}

export function migrateLegacyCurrencyWallet(state,{initialBalance=CURRENCY_WALLET_BOOTSTRAP_BALANCE}={}){
  if(!state||typeof state!=='object'||Array.isArray(state)||!Array.isArray(state.agents)||!safeNonNegative(initialBalance))return {ok:false,reason:'migration-input'};
  if(state.currencyWallet!==undefined){
    if(validateCurrencyWallet(state).length)return {ok:false,reason:'wallet-invalid'};
    return {ok:true,duplicate:true,granted:0,accounts:state.currencyWallet.accounts.length};
  }
  const ids=[];
  for(const row of state.agents){
    if(!validAgentId(row?.id)||ids.includes(row.id))return {ok:false,reason:'agent'};
    ids.push(row.id);
  }
  ids.sort((a,b)=>a-b);
  if(!Number.isSafeInteger(initialBalance*ids.length))return {ok:false,reason:'overflow'};
  const wallet=createCurrencyWalletState();
  wallet.accounts=ids.map(agentId=>({agentId,balance:initialBalance}));
  wallet.bootstrap={version:CURRENCY_WALLET_BOOTSTRAP_VERSION,initialBalance,agentIds:[...ids],totalGranted:initialBalance*ids.length};
  for(const agentId of ids){
    if(initialBalance===0)continue;
    const transactionId='MIGRATE:'+CURRENCY_WALLET_BOOTSTRAP_VERSION+':'+agentId;
    const evidence={operation:'INITIAL_GRANT',migration:CURRENCY_WALLET_BOOTSTRAP_VERSION,initialBalance};
    const payload=mutationPayload({kind:'INITIAL_GRANT',transactionId,agentId,amount:initialBalance,evidence});
    wallet.receipts.push(makeReceipt(payload));
  }
  const probe={...state,currencyWallet:wallet};
  if(validateCurrencyWallet(probe).length)return {ok:false,reason:'wallet-postcondition'};
  state.currencyWallet=wallet;
  return {ok:true,duplicate:false,granted:wallet.bootstrap.totalGranted,accounts:wallet.accounts.length};
}

export function currencyWalletSnapshot(state){
  if(validateCurrencyWallet(state).length)return null;
  return clone(state.currencyWallet);
}

export function canonicalCurrencyBytes(state){
  if(validateCurrencyWallet(state).length)return null;
  return JSON.stringify(state.currencyWallet);
}


export function serializeCurrencyWallet(state){
  const bytes=canonicalCurrencyBytes(state);
  if(bytes===null)throw new Error('currency-wallet-invalid');
  return bytes;
}

export function restoreCurrencyWallet(state,serialized){
  if(!state||typeof state!=='object'||Array.isArray(state)||!Array.isArray(state.agents))return {ok:false,reason:'restore-input'};
  let currencyWallet;
  try{currencyWallet=JSON.parse(serialized);}catch{return {ok:false,reason:'restore-json'};}
  const probe={...state,currencyWallet};
  if(validateCurrencyWallet(probe).length)return {ok:false,reason:'wallet-invalid'};
  if(state.currencyWallet!==undefined){
    if(validateCurrencyWallet(state).length)return {ok:false,reason:'wallet-invalid'};
    const existing=JSON.stringify(state.currencyWallet),incoming=JSON.stringify(currencyWallet);
    if(existing===incoming)return {ok:true,duplicate:true};
    return {ok:false,reason:'wallet-restore-conflict'};
  }
  state.currencyWallet=clone(currencyWallet);
  return {ok:true,duplicate:false};
}
