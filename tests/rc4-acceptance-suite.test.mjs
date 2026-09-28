import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const readJson=rel=>JSON.parse(fs.readFileSync(path.join(ROOT,rel),'utf8'));

test('RC4 acceptance artifacts are parseable, unique and fail-closed before Master Gate',()=>{
  const matrix=readJson('verification/rc4/merchant-economy-matrix.json');
  const fixture=readJson('verification/rc4/merchant-economy-fixture-contract.json');
  const blockers=readJson('verification/rc4/master-gate-blockers.json');

  assert.equal(matrix.schema,'RC4-merchant-economy-acceptance-matrix/1');
  assert.equal(matrix.masterGate?.requiredPhase,0);
  assert.equal(matrix.masterGate?.currentResult,'UNKNOWN');
  assert.equal(matrix.rows.length,171);
  assert.equal(new Set(matrix.rows.map(row=>row.id)).size,matrix.rows.length,'acceptance ids must be unique');
  assert.equal(matrix.rows.filter(row=>row.phase===0).length,13,'Phase 0 must contain all Master Gate readiness locks');
  assert.deepEqual([...new Set(matrix.rows.map(row=>row.phase))].sort((a,b)=>a-b),Array.from({length:16},(_,i)=>i));
  assert.ok(matrix.rows.every(row=>['SAT','VIOL','UNKNOWN'].includes(row.result)));
  assert.equal(matrix.rows.filter(row=>row.result!=='UNKNOWN').length,0,'unexecuted prepared rows may not be pre-promoted');
  assert.equal(matrix.donorSnapshot?.exactHeads?.['179'],'da82d2178e605283fabf76b80c91cd731da4ad49');
  assert.equal(matrix.donorSnapshot?.exactHeads?.['180'],'0aa5a824d7da70172a267dbf1f440e69d44ef271');
  assert.match(matrix.donorSnapshot?.evidence?.['179']??'',/#1978.*SUCCESS.*#1979.*SUCCESS/);

  assert.equal(fixture.schema,'RC4-merchant-economy-fixture-contract/1');
  assert.equal(fixture.verdict,'UNKNOWN');
  assert.equal(fixture.masterGate?.result,'UNKNOWN');
  assert.equal(fixture.donorSnapshot?.donors?.['179']?.head,'da82d2178e605283fabf76b80c91cd731da4ad49');
  assert.equal(fixture.donorSnapshot?.donors?.['180']?.head,'0aa5a824d7da70172a267dbf1f440e69d44ef271');
  assert.ok(!(fixture.masterGate?.currentHardStops??[]).some(x=>/#179.*exact-head|exact-head.*#179/i.test(x)),'resolved #179 exact-head blocker must not remain in current hard stops');
  assert.equal(blockers.schema,'RC4-master-gate-blockers/1');
  assert.equal(blockers.blockers.length,8);
  assert.equal(new Set(blockers.blockers.map(x=>x.id)).size,8);
  assert.ok(blockers.blockers.every(x=>x.state==='UNKNOWN'));
  assert.ok(blockers.resolved.some(x=>x.id==='R1'&&x.head==='da82d2178e605283fabf76b80c91cd731da4ad49'));
  assert.ok(blockers.resolved.some(x=>x.id==='R2'&&x.head==='0aa5a824d7da70172a267dbf1f440e69d44ef271'));
  assert.ok(fixture.setupPolicy?.forbiddenPrimaryEvidence?.some(x=>x.includes('tradeRange')));
  assert.ok(fixture.setupPolicy?.forbiddenPrimaryEvidence?.some(x=>x.includes('Reservation')));
});

test('RC4 preflight parses and reports UNKNOWN on the preparation branch',()=>{
  const syntax=spawnSync(process.execPath,['--check','verification/rc4/preflight.mjs'],{cwd:ROOT,encoding:'utf8'});
  assert.equal(syntax.status,0,syntax.stderr||syntax.stdout);

  const head=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
  const run=spawnSync(process.execPath,['verification/rc4/preflight.mjs'],{
    cwd:ROOT,
    encoding:'utf8',
    env:{...process.env,RC4_EXPECTED_HEAD:head}
  });
  assert.equal(run.status,2,'pre-integration preparation branch must remain UNKNOWN');
  const report=JSON.parse(run.stdout);
  assert.equal(report.actualHead,head);
  assert.equal(report.preflightResult,'UNKNOWN');
  assert.equal(report.masterGateResult,'UNKNOWN');
  assert.equal(report.integrationVerdict,'UNKNOWN');
  assert.ok(report.checks.some(c=>c.id==='canonical-rc4-modules-present'&&c.result==='UNKNOWN'));
  assert.ok(report.checks.some(c=>c.id==='reservation-authority'&&c.result==='UNKNOWN'));
  assert.ok(report.checks.some(c=>c.id==='market-binding-source'&&c.result==='UNKNOWN'));
  assert.ok(report.checks.some(c=>c.id==='navigation-arrival-evidence'&&c.result==='UNKNOWN'));
});
