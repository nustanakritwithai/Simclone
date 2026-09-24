import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {VERSION,SAVE_VERSION,HISTORY_VERSION,SKILL_PROVENANCE_VERSION,restore,serialize,step,validate} from '../src/engine.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const version=JSON.parse(read('package.json')).version;
test('release metadata and the entire runtime module graph agree',()=>{
 assert.equal(VERSION,version);assert.equal(version,'0.4.0');assert.equal(SAVE_VERSION,'0.4.0');assert.equal(HISTORY_VERSION,'0.1.0');assert.equal(SKILL_PROVENANCE_VERSION,'0.4.0');
 const ux=read('src/ux.mjs'),boot=read('src/boot.mjs'),html=read('index.html');
 assert.ok(ux.includes("UI_VERSION='"+version+"'"));
 assert.ok(boot.includes("window.simclone?.version!=='"+version+"'"));
 assert.ok(boot.includes("window.simclone?.uiVersion!=='"+version+"'"));
 assert.ok(html.includes('data-ui-version="'+version+'"'));
 assert.ok(html.includes('src/boot.mjs?v='+version));
 for(const n of readdirSync(new URL('../src/',import.meta.url)).filter(n=>n.endsWith('.mjs')))
  for(const m of read('src/'+n).matchAll(/['"](\.\/[^'"\s]+\.mjs(?:\?[^'"]+)?)['"]/g))
   assert.ok(m[1].endsWith('?v='+version),n+': '+m[1]);
});
test('birth UI reads engine rules and does not deny implemented autonomous birth',()=>{
 const ux=read('src/ux.mjs');
 assert.ok(ux.includes('${BIRTH_RULES.globalIntervalYears}'));
 assert.ok(ux.includes('${BIRTH_RULES.parentCooldownYears}'));
 assert.ok(!ux.includes('เกิดได้สูงสุด 1 คนต่อปีจำลอง'));
 assert.ok(!ux.includes('รุ่นนี้โคลนด้วยคำสั่งผู้เล่น ยังไม่มีการเกิดหรือเติบโตอัตโนมัติ'));
});
test('Pages gates publication on engine, continuity, and browser recovery',()=>{
 const s=read('.github/workflows/pages.yml'),deploy=s.indexOf('      - name: Setup Pages');assert.ok(deploy>0);
 for(const command of ['npm test','npm run test:survival','npm run test:lifecycle','npm run test:death','npm run test:continuity','python tests/ui-smoke.py','python tests/navigation-smoke.py','python tests/survival-smoke.py']){
  assert.ok(s.indexOf('run: '+command)>=0,command);assert.ok(s.indexOf('run: '+command)<deploy,command+' precedes publication');
 }
});
test('real V0.3.3 save migrates explicitly without identity drift and continues deterministically',()=>{
 const text=read('tests/fixtures/legacy-0.3.3-save.json'),meta=JSON.parse(read('tests/fixtures/legacy-0.3.3-provenance.json')),raw=JSON.parse(text);
 assert.equal(meta.releaseCommit,'d88c1d3ba8ddf3cc61b187086954732fd8935fa0');
 assert.equal(createHash('sha256').update(text).digest('hex'),meta.sha256);
 assert.equal(raw.version,'0.2.0');assert.equal(raw.historyVersion,undefined);
 const a=restore(text),b=restore(text);assert.equal(a.tick,720);assert.equal(a.historyVersion,HISTORY_VERSION);
 assert.notEqual(serialize(a),text);
 assert.deepEqual(a.agents.map(x=>[x.id,x.parentId,x.generation,x.appearance,x.skills,x.bornTick]),
   raw.agents.map(x=>[x.id,x.parentId,x.generation,x.appearance,x.skills,x.bornTick]));
 assert.deepEqual(validate(a),[]);step(a,720);for(let i=0;i<720;i++)step(b);
 assert.equal(serialize(a),serialize(b));assert.deepEqual(validate(a),[]);
});
