import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const manifest=JSON.parse(readFileSync(new URL('../verification/rc4/persistence-ownership.json',import.meta.url),'utf8'));

test('RC4 B7 persistence ownership manifest has unique canonical roots and explicit B8 wiring boundary',()=>{
  assert.equal(manifest.schema,'RC4-persistence-ownership/1');
  const roots=manifest.rootContainers.map(x=>x.rootKey);
  assert.equal(new Set(roots).size,roots.length);
  assert.deepEqual(roots.sort(),['currencyWallet','homeMarkets','merchantBuyOffers','merchantLedgers','merchantListings','merchantReservations','tradeReplay'].sort());
  for(const row of manifest.rootContainers){
    assert.equal(row.corruptPresent,'FAIL_CLOSED');
    assert.equal(row.rootWiring,'B8');
    assert.ok(Number.isInteger(row.donorPr)&&row.donorPr>0);
    assert.match(row.donorHead,/^[a-f0-9]{40}$/);
    for(const key of ['migrate','serialize','restore'])assert.equal(typeof row[key],'string');
  }
});

test('RC4 B7 embeds Career progression in Agent and forbids duplicate top-level Career state',()=>{
  assert.deepEqual(manifest.embeddedState.map(x=>x.path).sort(),['agents[*].merchantExperience','agents[*].merchantTransactions']);
  assert.ok(manifest.embeddedState.every(x=>x.duplicateTopLevelForbidden===true));
  assert.ok(manifest.embeddedState.every(x=>x.missingPolicy==='CANONICAL_ZERO_UNTIL_TRUSTED_POST_COMMIT_WRITE'));
});

test('RC4 B7 does not invent an AI journal persistence authority',()=>{
  assert.equal(manifest.absentByContract.length,1);
  assert.equal(manifest.absentByContract[0].name,'merchantAIJournal');
  assert.match(manifest.absentByContract[0].rule,/must not invent one/i);
});

test('RC4 B7 requires replay-safe restore and leaves live root wiring to B8',()=>{
  const text=manifest.b8Requirements.join('\n');
  assert.match(text,/tradeReplay/);
  assert.match(text,/wallet receipts/);
  assert.match(text,/exactly-once/);
  assert.match(text,/localStorage shadow/);
});
