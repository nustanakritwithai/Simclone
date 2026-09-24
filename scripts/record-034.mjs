// Record observed results only. This preparation helper is removed before commit.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(p,'utf8'),json=p=>JSON.parse(read(p));
const unit=read('/tmp/simclone-unit.log'),tests=Number(unit.match(/# tests (\d+)/)?.[1]),passed=Number(unit.match(/# pass (\d+)/)?.[1]),failed=Number(unit.match(/# fail (\d+)/)?.[1]);assert.ok(tests>0&&passed===tests&&failed===0);
const reports={survival:json('evidence-survival/long-run.json'),birth:json('evidence-lifecycle/autonomous-birth.json'),death:json('evidence-lifecycle/age-death.json'),continuity:json('evidence-lifecycle/generation-continuity.json')};
for(const r of Object.values(reports))assert.equal(r.passed,r.total);
const ui=json('evidence-ui/results.json'),nav=json('evidence-navigation/results.json'),surv=json('evidence-survival/browser-survival.json');
assert.equal(ui.result,'PASS');assert.equal(nav.result,'PASS');assert.equal(surv.passed,surv.checks.length);
const manifest={};
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())walk(p);else if(!['scripts/prepare-034.mjs','scripts/record-034.mjs','.github/workflows/prepare-034.yml'].includes(p))manifest[p]=createHash('sha256').update(readFileSync(p)).digest('hex');}}
for(const dir of ['src','tests','scripts','.github/workflows'])walk(dir);
for(const p of ['index.html','package.json'])manifest[p]=createHash('sha256').update(readFileSync(p)).digest('hex');
const report={scope:reports.continuity.scope,release:'0.3.4',baseCandidate:'20eda5bb3b1611c103cdb43a3e92f8ee170763d3',preparationRun:process.env.GITHUB_RUN_ID,verification:'SAT for this exact source manifest; final candidate and Pages workflow must also complete successfully before publishing',unitAsset:{tests,passed,failed},reports,offlineChromium:{observation:ui.count,navigation:nav.count,survival:surv.passed,total:ui.count+nav.count+surv.passed},sourceSHA256:manifest,unknown:['native browser persistence','physical Android performance','existing homogeneous legacy-colony rescue','unlimited-time continuation beyond the 200-agent history cap','V1.0 social/knowledge/replay proof']};
writeFileSync('docs/verification/lifecycle-0.3.4.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({unit:report.unitAsset,browser:report.offlineChromium,continuity:reports.continuity.results},null,2));
