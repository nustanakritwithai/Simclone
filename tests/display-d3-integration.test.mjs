import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');

test('D3 runtime consumes one authoritative Adventure journey projection',()=>{
  assert.match(source,/adventureJourneyVisualSnapshot,ADVENTURE_DEFEAT_CUE_TICKS,ADVENTURE_RESPAWN_CUE_TICKS/);
  assert.match(source,/const journeyView=adventureJourneyVisualSnapshot\(state,\{activeAgentId\}\)/);
  assert.match(source,/adventureJourneyVisuals:\(\)=>adventureJourneyVisualSnapshot\(state,\{activeAgentId\}\)/);
});

test('D3 Hunt path has one visual owner and generic task path excludes Hunt',()=>{
  assert.match(source,/if\(a\?\.task\?\.path\.length&&!a\.task\.adventureHunt\)/);
  const helper=source.slice(source.indexOf('function drawAdventureJourney'),source.indexOf('function drawAdventureLifecycleCue'));
  assert.equal(helper.includes('j.path.map'),false,'HUNT path must not be drawn twice inside badge overlay helper');
  const render=source.slice(source.indexOf('function render(time)'),source.indexOf('function actionText'));
  assert.match(render,/j\.phase==='HUNT'&&j\.path\?\.length>1/);
});

test('D3 journey overlays never participate in D2 hit candidate collection',()=>{
  const hits=source.slice(source.indexOf('function worldHitCandidatesAtScreen'),source.indexOf('function worldTargetAtScreen'));
  // DEFEATED/RESPAWNING strings are expected here because D2 excludes hidden Monsters.
  for(const forbidden of ['journeyView','adventureJourneyVisualSnapshot(','drawAdventureJourney(','drawAdventureLifecycleCue(']){
    assert.equal(hits.includes(forbidden),false,forbidden);
  }
});

test('D3 overlay helpers are presentation-only and do not dispatch gameplay commands',()=>{
  const badgeStart=source.indexOf('function drawAdventureBadge');
  const journeyStart=source.indexOf('function drawAdventureJourney');
  const lifecycleStart=source.indexOf('function drawAdventureLifecycleCue');
  const renderStart=source.indexOf('function render(time)');
  assert.ok(badgeStart>=0&&journeyStart>badgeStart&&lifecycleStart>journeyStart&&renderStart>lifecycleStart,'D3 helper boundaries');
  const overlays=[
    source.slice(badgeStart,journeyStart),
    source.slice(journeyStart,lifecycleStart),
    source.slice(lifecycleStart,renderStart)
  ];
  for(const overlay of overlays){
    for(const forbidden of ['command(','state.','step(','wildMonsters.entities.push','hpCurrent=']){
      assert.equal(overlay.includes(forbidden),false,forbidden);
    }
    assert.equal(overlay.replaceAll('c.save()','').includes('save('),false,'gameplay save(');
  }
});

test('D2.5 remains the single strike/damage animation owner after D3 integration',()=>{
  const d3=source.slice(source.indexOf('function drawAdventureJourney'),source.indexOf('function drawAdventureLifecycleCue'));
  assert.equal(d3.includes('heroDamage'),false);
  assert.equal(d3.includes('counterDamage'),false);
  assert.match(source,/function drawCombatFeedback\(c,time\)/);
});

test('D3 keeps DEFEATED and RESPAWNING Monsters out of ordinary render/hit projections',()=>{
  assert.match(source,/filter\(m=>m\.status!=='DEFEATED'&&m\.status!=='RESPAWNING'\)/);
  const hits=source.slice(source.indexOf('function worldHitCandidatesAtScreen'),source.indexOf('function worldTargetAtScreen'));
  assert.match(hits,/filter\(m=>m\.status!=='DEFEATED'&&m\.status!=='RESPAWNING'\)/);
});
