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
  assert.equal(matrix.donorSnapshot?.exactHeads?.['179'],'9b5e63e386f0543f9700237242b2c4f0745a8c2d');
  assert.equal(matrix.donorSnapshot?.exactHeads?.['180'],'0aa5a824d7da70172a267dbf1f440e69d44ef271');
  assert.match(matrix.donorSnapshot?.evidence?.['179']??'',/#2013.*SUCCESS.*#2015.*SUCCESS/);

  assert.equal(fixture.schema,'RC4-merchant-economy-fixture-contract/1');
  assert.equal(fixture.verdict,'UNKNOWN');
  assert.equal(fixture.masterGate?.result,'UNKNOWN');
  assert.equal(fixture.donorSnapshot?.donors?.['179']?.head,'9b5e63e386f0543f9700237242b2c4f0745a8c2d');
  assert.equal(fixture.donorSnapshot?.donors?.['180']?.head,'0aa5a824d7da70172a267dbf1f440e69d44ef271');
  assert.ok(!(fixture.masterGate?.currentHardStops??[]).some(x=>/#179.*exact-head|exact-head.*#179/i.test(x)),'resolved #179 exact-head blocker must not remain in current hard stops');
  assert.equal(blockers.schema,'RC4-master-gate-blockers/1');
  assert.equal(blockers.blockers.length,6);
  assert.equal(new Set(blockers.blockers.map(x=>x.id)).size,6);
  assert.equal(blockers.blockers.filter(x=>x.state==='VIOL').length,2);
  assert.ok(blockers.blockers.some(x=>x.id==='B3'&&x.state==='VIOL'));
  assert.ok(blockers.blockers.some(x=>x.id==='B7'&&x.state==='VIOL'));
  assert.equal(blockers.lockedNextGate?.id,'B8');
  assert.ok(['LOCKED_NOT_STARTED','IN_PROGRESS_UNKNOWN'].includes(blockers.lockedNextGate?.state),'B8 may start only as UNKNOWN, never pre-promoted to SAT');
  assert.ok(blockers.resolved.some(x=>x.id==='R1'&&x.head==='9b5e63e386f0543f9700237242b2c4f0745a8c2d'));
  assert.ok(blockers.resolved.some(x=>x.id==='R2'&&x.head==='0aa5a824d7da70172a267dbf1f440e69d44ef271'));
  assert.ok(blockers.resolved.some(x=>x.id==='R4'&&x.head==='c4d1b544a1203459aa78ef55b83a28db6077056c'));
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
