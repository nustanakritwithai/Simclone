import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const root=resolve(import.meta.dirname,'..');
test('all local module imports resolve to shipped files',()=>{for(const name of readdirSync(resolve(root,'src')).filter(n=>n.endsWith('.mjs'))){const file=resolve(root,'src',name),text=readFileSync(file,'utf8');for(const m of text.matchAll(/(?:from\s*|import\(\s*)['"](\.\/[^'"]+)['"]/g))assert.ok(existsSync(resolve(dirname(file),m[1].split('?')[0])),`${name}: ${m[1]}`);}});
test('entry ships boot fallback and valid stylesheet/module paths',()=>{const text=readFileSync(resolve(root,'index.html'),'utf8');assert.ok(text.includes('id="boot-screen"'));assert.ok(text.includes('src/boot.mjs?v=0.5.0'));for(const m of text.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^\"]+)?"/g))assert.ok(existsSync(resolve(root,m[1])),m[1]);});

test('versioned module imports do not mix pre-lifecycle engine assets',()=>{
 const release='0.5.0';
 for(const name of readdirSync(resolve(root,'src')).filter(n=>n.endsWith('.mjs'))){
  const text=readFileSync(resolve(root,'src',name),'utf8');
  for(const m of text.matchAll(/\.\/[^'"]+\.mjs\?v=([0-9.]+)/g))assert.equal(m[1],release,`${name}: ${m[0]}`);
 }
});
