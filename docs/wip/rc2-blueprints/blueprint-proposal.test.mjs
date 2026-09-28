import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {proposeBlueprintLoot,maxBlueprintTier,BLUEPRINT_CHANCE_BP} from './blueprint-proposal.mjs';
const recipes=Array.from({length:5},(_,n)=>({recipeId:`TOOL_T${n+1}`,itemKind:`BLUEPRINT_TOOL_T${n+1}`,tier:n+1,starter:false}));
const fixture=overrides=>({worldSeed:42,catalogVersion:'fixture-catalog/v1',rngTicket:'combat:1',monster:{monsterId:'MON_002',level:60,rank:'normal'},outcome:{outcomeId:'defeat:1',verified:true,defeated:true},recipes:structuredClone(recipes),...overrides});
const deepFreeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);for(const v of Object.values(x))deepFreeze(v);}return x;};
function winning(rank='NORMAL',level=60){
  for(let i=0;i<200;i++){const f=fixture({monster:{monsterId:'MON_002',level,rank},rngTicket:`combat:${i}`});if(proposeBlueprintLoot(f).items.length)return f;}
  assert.fail('bounded winning fixture search');
}

test('proposal is deterministic, deeply frozen, and never commits inventory',()=>{
 const f=winning(),before=JSON.stringify(f),a=proposeBlueprintLoot(f),b=proposeBlueprintLoot(JSON.parse(before));
 assert.deepEqual(a,b);assert.equal(JSON.stringify(f),before);assert.equal(a.committed,false);
 assert.equal(Object.isFrozen(f),false);assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.items)&&Object.isFrozen(a.items[0])&&Object.isFrozen(a.trace));
 assert.throws(()=>{a.items[0].quantity=99;},TypeError);
 assert.equal(a.items.length,1);assert.equal(a.items[0].quantity,1);assert.equal(a.items[0].rarity,'RARE');
 assert.equal(a.claimKey,'ADVENTURE_LOOT:defeat:1');
});

test('immutable inputs and reversed catalog order yield the same proposal',()=>{
 const f=winning(),a=proposeBlueprintLoot(deepFreeze(structuredClone(f)));
 const b=proposeBlueprintLoot({...f,recipes:[...f.recipes].reverse()});assert.deepEqual(a,b);
});

test('tier boundaries are explicit 1..12 -> T1, ... 49..60 -> T5',()=>{
 for(const [level,tier] of [[1,1],[12,1],[13,2],[24,2],[25,3],[36,3],[37,4],[48,4],[49,5],[60,5]])assert.equal(maxBlueprintTier(level),tier);
 for(const level of [0,-1,61,1.5,NaN,Infinity,'1',null])assert.throws(()=>maxBlueprintTier(level));
});

test('no tier leakage for any level and 60,000 deterministic tickets',()=>{
 for(let level=1;level<=60;level++)for(let ticket=0;ticket<1000;ticket++){
  const p=proposeBlueprintLoot(fixture({monster:{monsterId:'MON_002',level,rank:'BOSS'},rngTicket:`fight:${ticket}`}));
  if(p.recipeId)assert.ok(recipes.find(r=>r.recipeId===p.recipeId).tier<=maxBlueprintTier(level));
  assert.ok(p.items.length<=1);assert.equal(p.committed,false);
 }
});

test('empty or all-too-high catalog yields no item, not invented fallback',()=>{
 const f=winning('BOSS',1);
 for(const catalog of [[],recipes.filter(r=>r.tier>1)]){
 const p=proposeBlueprintLoot({...f,recipes:catalog});assert.deepEqual(p.items,[]);assert.equal(p.recipeId,null);assert.equal(p.trace.eligibleCount,0);
 }
});

test('unverified, UNKNOWN, failed and malformed outcomes fail closed',()=>{
 for(const outcome of [undefined,null,{}, {outcomeId:'x',verified:'true',defeated:true},{outcomeId:'x',verified:true,defeated:false},{outcomeId:'x',verified:'UNKNOWN',defeated:true},{outcomeId:'',verified:true,defeated:true}]){
 const f=fixture({outcome}),before=JSON.stringify(f);assert.throws(()=>proposeBlueprintLoot(f));assert.equal(JSON.stringify(f),before);
 }
});

test('invalid inputs, prototype-like rank, duplicate or starter catalog entries reject',()=>{
 const bad=[null,[],{},fixture({worldSeed:-1}),fixture({worldSeed:2**32}),fixture({rngTicket:''}),fixture({catalogVersion:''}),fixture({monster:{monsterId:'x',level:1,rank:'__proto__'}}),fixture({recipes:[...recipes,recipes[0]]}),fixture({recipes:recipes.map(r=>({...r,itemKind:'SAME'}))}),fixture({recipes:[{...recipes[0],tier:0}]}),fixture({recipes:[{...recipes[0],starter:true}]}),fixture({recipes:Array.from({length:257},(_,i)=>({recipeId:`r${i}`,itemKind:`b${i}`,tier:1,starter:false}))})];
 for(const f of bad)assert.throws(()=>proposeBlueprintLoot(f));
});

test('rank drop-rate sample is bounded and ordered; all eligible tiers appear',()=>{
 const sample={};
 for(const rank of Object.keys(BLUEPRINT_CHANCE_BP)){
  let count=0;const seen=new Set();
  for(let n=0;n<10000;n++){
   const p=proposeBlueprintLoot(fixture({monster:{monsterId:'MON_002',level:60,rank},rngTicket:`rank-sample:${n}`}));
   if(p.items.length){count++;seen.add(p.recipeId);}
  }
  const rate=count/10000;assert.ok(Math.abs(rate-BLUEPRINT_CHANCE_BP[rank]/10000)<.025,JSON.stringify({rank,rate}));assert.equal(seen.size,5);sample[rank]=count;
 }
 assert.ok(sample.NORMAL<sample.ELITE&&sample.ELITE<sample.BOSS);
});

test('proposal replay is identical, but pure proposal does not claim grant idempotency',()=>{
 const f=winning(),a=proposeBlueprintLoot(f),b=proposeBlueprintLoot(f);
 assert.deepEqual(a,b);assert.equal(a.committed,false);assert.equal(Object.hasOwn(a,'itemIds'),false);
});

test('known-recipes changes are not an input to the loot lottery',()=>{
 const f=winning();assert.deepEqual(proposeBlueprintLoot({...f,knownRecipes:[]}),proposeBlueprintLoot({...f,knownRecipes:recipes.map(r=>r.recipeId)}));
});

test('tuple hashing avoids delimiter collision across outcome and ticket',()=>{
 const a=fixture({outcome:{outcomeId:'x|y',verified:true,defeated:true},rngTicket:'z'});
 const b=fixture({outcome:{outcomeId:'x',verified:true,defeated:true},rngTicket:'y|z'});
 assert.notDeepEqual(proposeBlueprintLoot(a),proposeBlueprintLoot(b));
});

test('donor has no authority or nondeterministic dependencies',()=>{
 const source=readFileSync(new URL('./blueprint-proposal.mjs',import.meta.url),'utf8');
 assert.ok(!/^import\s/m.test(source));for(const forbidden of ['Math.random','Date.','new Date','localStorage','document.','fetch(','rustPossessions','process.'])assert.ok(!source.includes(forbidden),forbidden);
});

test('versioned deterministic golden vector cannot silently drift',()=>{
 const p=proposeBlueprintLoot(fixture({rngTicket:'rank-sample:5'}));
 assert.deepEqual(p,{
  version:'blueprint-proposal/v1',committed:false,outcomeId:'defeat:1',claimKey:'ADVENTURE_LOOT:defeat:1',sourceMonsterId:'MON_002',
  catalogVersion:'fixture-catalog/v1',catalogDigest:'7d3a8180',tierCap:5,
  items:[{itemKind:'BLUEPRINT_TOOL_T2',quantity:1,rarity:'RARE'}],recipeId:'TOOL_T2',
  trace:{chanceBp:1250,chanceRoll:434,eligibleCount:5},
 });
});
