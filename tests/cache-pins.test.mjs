import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
test('browser import map pins every runtime source to its exact content hash',()=>{
  const html=readFileSync(resolve(root,'index.html'),'utf8');
  const tag=html.match(/<script type="importmap" id="runtime-import-map">([\s\S]*?)<\/script>/);
  assert.ok(tag,'run node scripts/pin-assets.mjs after changing runtime source');
  const {imports}=JSON.parse(tag[1]);
  const modules=readdirSync(resolve(root,'src')).filter(n=>n.endsWith('.mjs')).sort();
  assert.equal(Object.keys(imports).length,modules.length);
  for(const name of modules){
    const hash=createHash('sha256').update(readFileSync(resolve(root,'src',name))).digest('hex').slice(0,16);
    assert.equal(imports[`./src/${name}?v=0.5.0`],`./src/${name}?v=0.5.0&rev=${hash}`,name+': regenerate source cache pins');
  }
  assert.ok(html.includes(`src="${imports['./src/boot.mjs?v=0.5.0']}"`));
  assert.ok(html.indexOf(tag[0])<html.indexOf('type="module"'));
});
