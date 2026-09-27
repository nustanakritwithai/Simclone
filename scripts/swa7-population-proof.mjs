/** Read-only SWA7 release proof. Never generates or repairs the browser snapshot. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {ADVENTURE_ANNEX_ZONES} from '../src/adventure-annex.mjs';
import {
  WILD_MONSTER_TYPES_PER_ZONE,
  WILD_MONSTER_COPIES_PER_TYPE,
  WILD_MONSTER_INITIAL_PER_ZONE,
  WILD_MONSTER_INITIAL_COUNT,
  validateWildMonsterWorld,
} from '../src/adventure-world-monsters.mjs';

export function proveSwa7Population(snapshot){
  // Pin the approved product contract independently of the implementation.
  // Then use the existing authority to validate the actual public snapshot.
  assert.equal(ADVENTURE_ANNEX_ZONES.length,4,'SWA7 authority: four zones');
  assert.equal(WILD_MONSTER_TYPES_PER_ZONE,3,'SWA7 authority: three existing types per zone');
  assert.equal(WILD_MONSTER_COPIES_PER_TYPE,2,'SWA7 authority: two copies per type');
  assert.equal(WILD_MONSTER_INITIAL_PER_ZONE,6,'SWA7 authority: six instances per zone');
  assert.equal(WILD_MONSTER_INITIAL_COUNT,24,'SWA7 authority: 24 physical instances');
  assert.ok(snapshot&&typeof snapshot==='object','SWA7 snapshot required');
  const monsters=snapshot.wildMonsters?.entities;
  assert.ok(Array.isArray(monsters),'SWA7 authoritative entities required');
  assert.equal(monsters.length,WILD_MONSTER_INITIAL_COUNT,'SWA7 physical instance count');
  assert.equal(new Set(monsters.map(m=>m?.monsterId)).size,12,'SWA7 distinct monsterId count');
  assert.deepEqual(validateWildMonsterWorld(snapshot),[],'SWA7 canonical world validation');

  const zones=[];
  for(const {zoneId} of ADVENTURE_ANNEX_ZONES){
    const rows=monsters.filter(m=>m.zoneId===zoneId);
    assert.equal(rows.length,WILD_MONSTER_INITIAL_PER_ZONE,`SWA7 ${zoneId}: instance count`);
    const byType=new Map();
    for(const row of rows){
      const pair=byType.get(row.monsterId)??[];
      pair.push(row);byType.set(row.monsterId,pair);
    }
    assert.equal(byType.size,WILD_MONSTER_TYPES_PER_ZONE,`SWA7 ${zoneId}: type count`);
    for(const [monsterId,pair] of byType){
      assert.equal(pair.length,WILD_MONSTER_COPIES_PER_TYPE,`SWA7 ${zoneId}/${monsterId}: copies`);
      assert.equal(pair[0].level,pair[1].level,`SWA7 ${zoneId}/${monsterId}: paired level`);
      assert.equal(pair[0].rank,pair[1].rank,`SWA7 ${zoneId}/${monsterId}: paired rank`);
    }
    zones.push({zoneId,physicalInstances:rows.length,distinctMonsterIds:byType.size,copiesPerType:WILD_MONSTER_COPIES_PER_TYPE});
  }
  return {physicalInstances:monsters.length,distinctMonsterIds:12,zones};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  assert.equal(process.argv[2],'--stdin','Usage: node scripts/swa7-population-proof.mjs --stdin');
  process.stdout.write(JSON.stringify(proveSwa7Population(JSON.parse(readFileSync(0,'utf8')))));
}
