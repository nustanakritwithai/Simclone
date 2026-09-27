import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  CORE6_STAT_KEYS,
  WILD_MONSTER_FAMILY_COUNT,
  WILD_MONSTER_FORM_COUNT,
  WILD_MONSTER_RUNTIME_TYPES,
  allWildMonsterForms,
  monsterDefinition,
  validateMonsterCatalog,
} from '../src/adventure-monsters.mjs';
import {
  WILD_MONSTER_LEVEL_MAX,
  WILD_MONSTER_LEVEL_MIN,
  monsterStatsAtLevel,
} from '../src/adventure-monster-stats.mjs';

const EXPECTED_ROWS = [
  ['MON_001','normalooze',1,'Normal',[52,42,42,42,42,42],35,'Common'],
  ['MON_002','flameling',1,'Fire',[46,38,34,54,38,46],35,'Common'],
  ['MON_003','aquapuff',1,'Water',[54,38,44,44,46,36],35,'Common'],
  ['MON_004','mossbun',1,'Grass',[50,34,42,44,50,38],35,'Common'],
  ['MON_005','voltkit',1,'Electric',[44,44,34,46,34,58],35,'Common'],
  ['MON_006','frostowl',1,'Ice',[48,36,40,46,46,42],35,'Common'],
  ['MON_007','rockhorn',1,'Rock',[60,40,56,32,50,26],35,'Common'],
  ['MON_008','sandmole',1,'Ground',[56,48,48,34,40,32],35,'Common'],
  ['MON_009','galebird',1,'Flying',[44,42,34,42,34,58],35,'Common'],
  ['MON_010','toxitoad',1,'Poison',[48,36,38,48,42,44],35,'Common'],
  ['MON_011','voidhorn',1,'Dark',[42,52,32,44,34,58],35,'Common'],
  ['MON_012','fairimp',1,'Fairy',[52,32,40,48,54,36],35,'Common'],
  ['MON_013','mindcoon',1,'Psychic',[48,36,40,46,46,42],35,'Common'],
  ['MON_014','buglet',1,'Bug',[50,40,48,40,46,34],35,'Common'],
  ['MON_015','emberdrake',1,'Dragon',[50,44,40,50,40,38],35,'Common'],
  ['MON_016','punchcub',1,'Fighting',[50,52,40,32,36,48],35,'Common'],
  ['MON_017','ironbug',1,'Steel',[60,40,56,32,50,26],35,'Common'],
  ['MON_018','ghostpurr',1,'Ghost',[46,38,36,50,42,50],35,'Common'],
  ['MON_019','normalooze',2,'Normal',[96,76,76,76,76,76],90,'Uncommon'],
  ['MON_020','flameling',2,'Fire',[86,69,63,95,69,82],90,'Uncommon'],
  ['MON_021','aquapuff',2,'Water',[99,69,79,79,82,66],90,'Uncommon'],
  ['MON_022','mossbun',2,'Grass',[93,63,76,79,89,69],90,'Uncommon'],
  ['MON_023','voltkit',2,'Electric',[83,79,63,82,63,101],90,'Uncommon'],
  ['MON_024','frostowl',2,'Ice',[89,66,72,82,82,76],90,'Uncommon'],
  ['MON_025','rockhorn',2,'Rock',[109,72,98,59,89,50],90,'Uncommon'],
  ['MON_026','sandmole',2,'Ground',[102,85,85,63,72,59],90,'Uncommon'],
  ['MON_027','galebird',2,'Flying',[83,76,63,76,63,101],90,'Uncommon'],
  ['MON_028','toxitoad',2,'Poison',[89,66,69,85,76,79],90,'Uncommon'],
  ['MON_029','voidhorn',2,'Dark',[80,92,59,79,63,101],100,'Rare'],
  ['MON_030','fairimp',2,'Fairy',[96,59,72,85,95,66],100,'Rare'],
  ['MON_031','mindcoon',2,'Psychic',[89,66,72,82,82,76],90,'Uncommon'],
  ['MON_032','buglet',2,'Bug',[93,72,85,72,82,63],90,'Uncommon'],
  ['MON_033','emberdrake',2,'Dragon',[93,79,72,89,72,69],100,'Rare'],
  ['MON_034','punchcub',2,'Fighting',[93,92,72,59,66,85],90,'Uncommon'],
  ['MON_035','ironbug',2,'Steel',[109,72,98,59,89,50],90,'Uncommon'],
  ['MON_036','ghostpurr',2,'Ghost',[86,69,66,89,76,89],100,'Rare'],
];

function compactRow(definition) {
  return [
    definition.monsterId,
    definition.speciesId,
    definition.stage,
    definition.types[0],
    CORE6_STAT_KEYS.map(key => definition.baseStats[key]),
    definition.baseExpYield,
    definition.rarity,
  ];
}

function recursivelyCollectKeys(value, out = []) {
  if (!value || typeof value !== 'object') return out;
  for (const [key, child] of Object.entries(value)) {
    out.push(key.toLowerCase());
    recursivelyCollectKeys(child, out);
  }
  return out;
}

test('ADV4 wild catalog is exactly the expected 18 families x 2 forms', () => {
  const forms = allWildMonsterForms();
  assert.equal(forms.length, WILD_MONSTER_FORM_COUNT);
  assert.equal(WILD_MONSTER_FORM_COUNT, 36);
  assert.equal(WILD_MONSTER_FAMILY_COUNT, 18);
  assert.deepEqual(forms.map(compactRow), EXPECTED_ROWS);
  assert.equal(validateMonsterCatalog().ok, true);
  assert.equal(new Set(forms.map(form => form.monsterId)).size, 36);
  assert.equal(new Set(forms.map(form => form.formId)).size, 36);
  assert.equal(new Set(forms.map(form => form.speciesId)).size, 18);
  assert.deepEqual(new Set(forms.map(form => form.types[0])), new Set(WILD_MONSTER_RUNTIME_TYPES));
  assert.equal(monsterDefinition('MON_001')?.speciesId, 'normalooze');
  assert.equal(monsterDefinition('MON_036')?.speciesId, 'ghostpurr');
  assert.equal(monsterDefinition('MON_999'), null);
});

test('ADV4 definitions expose valid Core6 and no ownership/capture progression fields', () => {
  const forbidden = new Set([
    'capture', 'capturerate', 'captureratepct', 'throw', 'ranch', 'bond', 'basebond',
    'breeding', 'breed', 'egg', 'party', 'owner', 'ownerid', 'owned', 'inventory',
    'genes', 'gene', 'saveinstance', 'monsterinstance', 'evolution', 'evolutionto',
    'requiredbond',
  ]);
  for (const definition of allWildMonsterForms()) {
    assert.deepEqual(Object.keys(definition).sort(), [
      'baseExpYield', 'baseStats', 'formId', 'monsterId', 'rarity', 'speciesId', 'stage', 'types',
    ].sort());
    assert.deepEqual(Object.keys(definition.baseStats).sort(), [...CORE6_STAT_KEYS].sort());
    for (const key of CORE6_STAT_KEYS) assert.ok(Number.isSafeInteger(definition.baseStats[key]) && definition.baseStats[key] > 0);
    const leaked = recursivelyCollectKeys(definition).filter(key => forbidden.has(key));
    assert.deepEqual(leaked, []);
  }
});

test('ADV4 level 1-60 projection is deterministic for every wild form', () => {
  assert.equal(WILD_MONSTER_LEVEL_MIN, 1);
  assert.equal(WILD_MONSTER_LEVEL_MAX, 60);
  for (const definition of allWildMonsterForms()) {
    for (let level = 1; level <= 60; level += 1) {
      const first = monsterStatsAtLevel(definition.monsterId, level);
      const second = monsterStatsAtLevel(definition.monsterId, level);
      assert.deepEqual(second, first);
      assert.equal(first.ok, true);
      assert.equal(first.level, level);
      assert.deepEqual(Object.keys(first.stats).sort(), [...CORE6_STAT_KEYS].sort());
      for (const key of CORE6_STAT_KEYS) assert.ok(Number.isSafeInteger(first.stats[key]) && first.stats[key] > 0);
    }
  }
});

test('ADV4 uses the Pocket default-potential level formula and fails closed outside 1-60', () => {
  const level1 = monsterStatsAtLevel('MON_001', 1);
  assert.deepEqual(level1.stats, { hp: 12, atk: 5, def: 5, spAtk: 5, spDef: 5, spd: 5 });
  const level60 = monsterStatsAtLevel('MON_001', 60);
  assert.deepEqual(level60.stats, { hp: 141, atk: 64, def: 64, spAtk: 64, spDef: 64, spd: 64 });
  assert.deepEqual(monsterStatsAtLevel('MON_999', 10), { ok: false, reason: 'unknown_monster_id', field: 'id', value: 'MON_999' });
  assert.equal(monsterStatsAtLevel('MON_001', 0).ok, false);
  assert.equal(monsterStatsAtLevel('MON_001', 61).ok, false);
  assert.equal(monsterStatsAtLevel('MON_001', 1.5).ok, false);
});

test('ADV4 source modules contain no random or wall-clock gameplay rule', () => {
  for (const path of ['src/adventure-monsters.mjs', 'src/adventure-monster-stats.mjs']) {
    const source = fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
    assert.equal(source.includes('Math.random'), false, path + ' must not use Math.random');
    assert.equal(source.includes('Date.now'), false, path + ' must not use Date.now');
    assert.equal(source.includes('new Date'), false, path + ' must not use wall-clock Date');
  }
});
