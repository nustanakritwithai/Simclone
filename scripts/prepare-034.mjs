// One-shot, branch-scoped source preparation. Removed from the final candidate.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(p,'utf8'),write=(p,s)=>writeFileSync(p,s);
const version=JSON.parse(read('package.json')).version;
assert.equal(version,'0.3.4');
assert.match(read('src/engine.mjs'),/VERSION = '0\.3\.4'/);
function replace(p,old,text){const s=read(p);assert.ok(s.includes(old),'Missing anchor: '+p+' / '+old);write(p,s.replace(old,text));}
// Preserve all existing functions. Pin the complete transitive ES-module graph, not just the entry.
for(const name of readdirSync('src').filter(n=>n.endsWith('.mjs'))){
 const p='src/'+name;let s=read(p).replaceAll('0.3.3',version);
 s=s.replace(/(['"])(\.\/[^'"\s?]+\.mjs)(?:\?v=[^'"]+)?\1/g,(_,q,path)=>q+path+'?v='+version+q);
 write(p,s);
}
write('index.html',read('index.html').replaceAll('0.3.3',version).replaceAll('AGE DEATH','GENERATION CONTINUITY'));
for(const p of ['tests/assets.test.mjs','tests/ui-smoke.py','tests/navigation-smoke.py','tests/survival-smoke.py'])write(p,read(p).replaceAll('0.3.3',version));
replace('src/boot.mjs',"if(window.simclone?.uiVersion!=='0.3.4')", "if(window.simclone?.uiVersion!=='0.3.4'||window.simclone?.version!=='0.3.4')");
write('src/ux.mjs',"import {BIRTH_RULES} from './reproduction.mjs?v=0.3.4';\n"+read('src/ux.mjs'));
replace('src/ux.mjs','เกิดได้สูงสุด 1 คนต่อปีจำลอง และ parent คนเดิมพัก 4 ปี','เว้นการเกิดอย่างน้อย ${BIRTH_RULES.globalIntervalYears} ปีจำลอง และ parent คนเดิมพัก ${BIRTH_RULES.parentCooldownYears} ปี');
replace('src/ux.mjs',"pace:'รอรอบปีถัดไป'","pace:'รอครบระยะห่างการเกิด'");
replace('src/ux.mjs','รุ่นนี้โคลนด้วยคำสั่งผู้เล่น ยังไม่มีการเกิดหรือเติบโตอัตโนมัติ','คำสั่งนี้สร้าง Clone วัยผู้ใหญ่อายุ 18 ปีทันที · การเกิดอัตโนมัติเป็นอีกระบบหนึ่ง เด็กเริ่มอายุ 0 ปีแล้วค่อยเติบโต');
// Strengthen UI fixtures instead of merely changing their version expectation.
replace('tests/ui-smoke.py',"s=snap(desktop);desktop.wait_for_timeout(350);check('clone preview spends no resources',snap(desktop)==s)","check('manual clone is distinguished from autonomous birth', 'อายุ 18 ปี' in desktop.locator('#dialog-body').inner_text() and 'เด็กเริ่มอายุ 0 ปี' in desktop.locator('#dialog-body').inner_text())\n s=snap(desktop);desktop.wait_for_timeout(350);check('clone preview spends no resources',snap(desktop)==s)");
replace('tests/survival-smoke.py',"page.screenshot(path=str(OUT/'mobile-survival.png'))","check('birth pacing text matches the four-year engine contract','เว้นการเกิดอย่างน้อย 4 ปีจำลอง' in page.locator('#dialog-body').inner_text() and 'เกิดได้สูงสุด 1 คนต่อปีจำลอง' not in page.locator('#dialog-body').inner_text())\n page.screenshot(path=str(OUT/'mobile-survival.png'))");
// Gate publication on the same UI/recovery suites, not only engine tests.
let pages=read('.github/workflows/pages.yml'),verify=read('.github/workflows/verify.yml');
assert.ok(pages.includes('npm run test:continuity'));
const browserStart=verify.indexOf('      - name: Setup Python for offline Chromium checks');
assert.ok(browserStart>=0);
pages=pages.replace('      - name: Setup Pages',verify.slice(browserStart).trimEnd()+'\n\n      - name: Setup Pages');write('.github/workflows/pages.yml',pages);
// Retain an actual previous-release save, with exact source provenance.
const base='d88c1d3ba8ddf3cc61b187086954732fd8935fa0',dir=mkdtempSync(join(tmpdir(),'simclone-033-')),sources={};
try{
 for(const f of ['engine.mjs','survival.mjs','lifecycle.mjs','reproduction.mjs']){
  const p='src/'+f;const bytes=execFileSync('git',['show',base+':'+p]);writeFileSync(join(dir,f),bytes);
  sources[p]=execFileSync('git',['rev-parse',base+':'+p],{encoding:'utf8'}).trim();
 }
 const old=await import(pathToFileURL(join(dir,'engine.mjs')).href),s=old.createWorld(42);old.step(s,720);
 const text=old.serialize(s);mkdirSync('tests/fixtures',{recursive:true});
 write('tests/fixtures/legacy-0.3.3-save.json',text);
 write('tests/fixtures/legacy-0.3.3-provenance.json',JSON.stringify({releaseCommit:base,sourceBlobs:sources,seed:42,ticks:720,sha256:createHash('sha256').update(text).digest('hex')},null,2)+'\n');
}finally{rmSync(dir,{recursive:true,force:true});}
// Preserve the historical roadmap; add an explicit current gate rather than rewriting history.
write('GAME_PLAN.md',read('GAME_PLAN.md').replace('## V0.3 — Clone + Lifecycle','## V0.3 — Clone + Lifecycle\n\nCurrent release contract: [V0.3.4](docs/LIFECYCLE_0.3.4.md). Current next steps: [NEXT_STEPS](docs/NEXT_STEPS.md). The earlier release descriptions below are historical.'));
write('docs/LIFECYCLE_0.3.0.md',read('docs/LIFECYCLE_0.3.0.md').replace('# Simclone V0.3 — Lifecycle + Autonomous Generation Contract','# Simclone V0.3 — Lifecycle + Autonomous Generation Contract\n\nHistorical contracts/evidence through V0.3.3. Current V0.3.4 rules and proof boundaries: [LIFECYCLE_0.3.4.md](LIFECYCLE_0.3.4.md). The former one-year global birth gap is superseded by four years; parent cooldown is still four years.'));
let agents=read('AGENTS.md').replace('Current skill transfer is manual cloning only, not mentor/archive/culture.','Current skill transfer copies 35% XP at manual cloning and autonomous birth, not mentor/archive/culture.').replace('## Survival Core 0.2.0 (current)','## Survival Core 0.2.0 (historical release)').replace('## Age Death 0.3.3 (current engine)','## Age Death 0.3.3 (historical release)');
agents+='\n\n## Generation Continuity 0.3.4 (current)\n\n- Read docs/LIFECYCLE_0.3.4.md and docs/NEXT_STEPS.md first.\n- Engine/UI are 0.3.4. Save schema stays 0.2.0; storage key stays simclone:world:v1. Never reset ages on load.\n- Global autonomous birth gap is FOUR simulated years; parent cooldown is also four. One/year was the older policy. UI reads BIRTH_RULES, not duplicate literals.\n- Run npm test, npm run test:survival, npm run test:lifecycle, npm run test:death, npm run test:continuity and all three Python UI suites before release.\n- The continuity proof runs unmodified fresh worlds for 120 years with real aging/death, no manual CLONE, and save/load plus single/batch continuation checks. The survival-only fixture still caps biological age; never call it continuity proof.\n- Final evidence is tied to source SHA-256 manifest. Verify exact candidate and Pages commits separately. UNKNOWN is not PASS.\n- Existing saves preserve their demographic structure; previously collapsed colonies are not silently repopulated. Historical agent cap 200 still prevents unlimited continuation.\n- No mentor/archive, social relationship or V1.0 proof is claimed.\n';write('AGENTS.md',agents);
console.log('Source repair prepared; no branch or deployment changed by this script.');
