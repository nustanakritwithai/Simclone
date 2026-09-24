import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Native ESM linking validates named exports without evaluating browser code.
// Checking that an imported file exists is not sufficient (PR #50 regression).
const linker = `
import {SourceTextModule} from 'node:vm';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,sep} from 'node:path';
const root=resolve('src'),cache=new Map();
function moduleAt(url){
  const path=fileURLToPath(url);
  if(!path.startsWith(root+sep)||!path.endsWith('.mjs'))throw Error('Unexpected runtime import: '+url);
  if(!cache.has(url))cache.set(url,new SourceTextModule(readFileSync(path,'utf8'),{identifier:url}));
  return cache.get(url);
}
function linker(specifier,parent){return moduleAt(new URL(specifier,parent.identifier).href);}
function* files(dir){for(const item of readdirSync(dir,{withFileTypes:true})){
  const path=resolve(dir,item.name);
  if(item.isDirectory())yield* files(path);else if(path.endsWith('.mjs'))yield path;
}}
for(const file of files(root)){
  const mod=moduleAt(pathToFileURL(file).href);
  if(mod.status==='unlinked')await mod.link(linker);
}
console.log('LINKED',cache.size);
`;

test('all shipped runtime modules link with matching named exports, without DOM execution',()=>{
  const result=spawnSync(process.execPath,['--experimental-vm-modules','--input-type=module','-e',linker],{
    cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:15000
  });
  assert.equal(result.error,undefined);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/LINKED \d+/);
});
