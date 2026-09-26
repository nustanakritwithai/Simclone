/** Untouched independent fresh-world proof; no manual commands, free items or age caps. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {createWorld,step,serialize,restore,validate,living} from '../src/engine.mjs';
import {individualHouses} from '../src/individual-housing.mjs';
const seed=Number(process.argv[2]??230926),years=Number(process.argv[3]??120);
assert.ok(Number.isSafeInteger(seed)&&seed>=0&&Number.isSafeInteger(years)&&years>=100&&years<=120);
const s=createWorld(seed,{mode:'independent'}),founders=s.agents.map(a=>a.id),initial=serialize(s);
assert.deepEqual(s.buildings,[]);
let firstAllFoundersHoused=null;
for(let year=1;year<=years;year++){
 step(s,360);assert.deepEqual(validate(s),[],'valid independent save at year '+year);
 if(year%10===0)console.error('Independent proof',seed,'year',year);
 if(firstAllFoundersHoused===null&&founders.every(id=>individualHouses(s).some(h=>h.ownerId===id&&h.complete)))firstAllFoundersHoused=year;
 assert.deepEqual(s.stock,{food:0,wood:0,stone:0});
}
const all=[...s.agents,...s.archive],original=all.find(a=>a.id===1),homes=individualHouses(s).filter(h=>h.complete);
assert.ok(firstAllFoundersHoused!==null,'every starting person earns a distinct complete home');
assert.equal(original.alive,false,'Original reaches actual age death');assert.equal(original.death.cause,'age');
assert.ok(living(s).length>=2,'descendants remain alive');assert.ok(Math.max(...all.map(a=>a.generation))>=2,'later generation exists');
assert.ok(homes.some(h=>!founders.includes(h.ownerId)),'a descendant earns a personal home');
const a=restore(serialize(s)),b=restore(serialize(s));step(a,600);for(let i=0;i<600;i++)step(b);
assert.equal(serialize(a),serialize(b),'save/load batch and single-tick continuation match');assert.deepEqual(validate(a),[]);
const hash=text=>createHash('sha256').update(text).digest('hex');
const sources=Object.fromEntries(readdirSync(new URL('../src/',import.meta.url)).filter(n=>n.endsWith('.mjs')).sort().map(n=>[n,hash(readFileSync(new URL('../src/'+n,import.meta.url)))]));
console.log(JSON.stringify({result:'SAT',scope:'local Node deterministic independent simulation; not browser or deployment',seed,years,ticks:s.tick,firstAllFoundersHoused,founders,retained:all.length,living:living(s).length,maxGeneration:Math.max(...all.map(a=>a.generation)),completeHomes:homes.length,descendantHomes:homes.filter(h=>!founders.includes(h.ownerId)).length,originalDeath:original.death,initialHash:hash(initial),finalHash:hash(serialize(s)),continuationHash:hash(serialize(a)),sourceHashes:sources},null,2));
