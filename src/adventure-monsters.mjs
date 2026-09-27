export const WILD_MONSTER_CATALOG_VERSION = 'adventure-wild-monsters/v1';
export const WILD_MONSTER_FAMILY_COUNT = 18;
export const WILD_MONSTER_FORM_COUNT = 36;
export const CORE6_STAT_KEYS = Object.freeze(['hp', 'atk', 'def', 'spAtk', 'spDef', 'spd']);
export const WILD_MONSTER_RUNTIME_TYPES = Object.freeze([
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
]);
export const WILD_MONSTER_RARITIES = Object.freeze(['Common', 'Uncommon', 'Rare']);
export const POCKET_MONSTER_WILD_SOURCE = Object.freeze({
  repository: 'nustanakritwithai/PocketMonster',
  commit: 'f7f243d21906d9fa26127529313b441b4b938ce0',
  contractVersion: 'monster-stat-coverage/v1',
  catalogVersion: 'monster-stat-catalog/v1',
  formulaVersion: 'monster-stat-formula/v1',
});

const RAW_WILD_FORMS = [
  ['MON_001','normalooze',1,'Normal',52,42,42,42,42,42,35,'Common'],
  ['MON_002','flameling',1,'Fire',46,38,34,54,38,46,35,'Common'],
  ['MON_003','aquapuff',1,'Water',54,38,44,44,46,36,35,'Common'],
  ['MON_004','mossbun',1,'Grass',50,34,42,44,50,38,35,'Common'],
  ['MON_005','voltkit',1,'Electric',44,44,34,46,34,58,35,'Common'],
  ['MON_006','frostowl',1,'Ice',48,36,40,46,46,42,35,'Common'],
  ['MON_007','rockhorn',1,'Rock',60,40,56,32,50,26,35,'Common'],
  ['MON_008','sandmole',1,'Ground',56,48,48,34,40,32,35,'Common'],
  ['MON_009','galebird',1,'Flying',44,42,34,42,34,58,35,'Common'],
  ['MON_010','toxitoad',1,'Poison',48,36,38,48,42,44,35,'Common'],
  ['MON_011','voidhorn',1,'Dark',42,52,32,44,34,58,35,'Common'],
  ['MON_012','fairimp',1,'Fairy',52,32,40,48,54,36,35,'Common'],
  ['MON_013','mindcoon',1,'Psychic',48,36,40,46,46,42,35,'Common'],
  ['MON_014','buglet',1,'Bug',50,40,48,40,46,34,35,'Common'],
  ['MON_015','emberdrake',1,'Dragon',50,44,40,50,40,38,35,'Common'],
  ['MON_016','punchcub',1,'Fighting',50,52,40,32,36,48,35,'Common'],
  ['MON_017','ironbug',1,'Steel',60,40,56,32,50,26,35,'Common'],
  ['MON_018','ghostpurr',1,'Ghost',46,38,36,50,42,50,35,'Common'],
  ['MON_019','normalooze',2,'Normal',96,76,76,76,76,76,90,'Uncommon'],
  ['MON_020','flameling',2,'Fire',86,69,63,95,69,82,90,'Uncommon'],
  ['MON_021','aquapuff',2,'Water',99,69,79,79,82,66,90,'Uncommon'],
  ['MON_022','mossbun',2,'Grass',93,63,76,79,89,69,90,'Uncommon'],
  ['MON_023','voltkit',2,'Electric',83,79,63,82,63,101,90,'Uncommon'],
  ['MON_024','frostowl',2,'Ice',89,66,72,82,82,76,90,'Uncommon'],
  ['MON_025','rockhorn',2,'Rock',109,72,98,59,89,50,90,'Uncommon'],
  ['MON_026','sandmole',2,'Ground',102,85,85,63,72,59,90,'Uncommon'],
  ['MON_027','galebird',2,'Flying',83,76,63,76,63,101,90,'Uncommon'],
  ['MON_028','toxitoad',2,'Poison',89,66,69,85,76,79,90,'Uncommon'],
  ['MON_029','voidhorn',2,'Dark',80,92,59,79,63,101,100,'Rare'],
  ['MON_030','fairimp',2,'Fairy',96,59,72,85,95,66,100,'Rare'],
  ['MON_031','mindcoon',2,'Psychic',89,66,72,82,82,76,90,'Uncommon'],
  ['MON_032','buglet',2,'Bug',93,72,85,72,82,63,90,'Uncommon'],
  ['MON_033','emberdrake',2,'Dragon',93,79,72,89,72,69,100,'Rare'],
  ['MON_034','punchcub',2,'Fighting',93,92,72,59,66,85,90,'Uncommon'],
  ['MON_035','ironbug',2,'Steel',109,72,98,59,89,50,90,'Uncommon'],
  ['MON_036','ghostpurr',2,'Ghost',86,69,66,89,76,89,100,'Rare'],
];

function freezeDefinition(raw) {
  const [monsterId, speciesId, stage, runtimeType, hp, atk, def, spAtk, spDef, spd, baseExpYield, rarity] = raw;
  const baseStats = Object.freeze({ hp, atk, def, spAtk, spDef, spd });
  return Object.freeze({
    monsterId,
    speciesId,
    formId: monsterId,
    stage,
    types: Object.freeze([runtimeType]),
    baseStats,
    baseExpYield,
    rarity,
  });
}

export const WILD_MONSTER_FORMS = Object.freeze(RAW_WILD_FORMS.map(freezeDefinition));
const MONSTER_BY_ID = new Map(WILD_MONSTER_FORMS.map(definition => [definition.monsterId, definition]));
const TYPE_SET = new Set(WILD_MONSTER_RUNTIME_TYPES);
const RARITY_SET = new Set(WILD_MONSTER_RARITIES);
const FORBIDDEN_FIELD_NAMES = new Set([
  'capture', 'capturerate', 'captureratepct', 'throw', 'ranch', 'bond', 'basebond',
  'breeding', 'breed', 'egg', 'party', 'owner', 'ownerid', 'owned', 'inventory',
  'genes', 'gene', 'saveinstance', 'monsterinstance', 'evolution', 'evolutionto',
  'requiredbond',
]);

function issue(code, index = -1, field = 'root', detail = {}) {
  return Object.freeze({ code, index, field, ...detail });
}

function hasForbiddenField(record) {
  return Object.keys(record).find(key => FORBIDDEN_FIELD_NAMES.has(key.toLowerCase())) ?? null;
}

export function monsterDefinition(id) {
  return MONSTER_BY_ID.get(id) ?? null;
}

export function allWildMonsterForms() {
  return WILD_MONSTER_FORMS;
}

export function validateMonsterCatalog(records = WILD_MONSTER_FORMS) {
  if (!Array.isArray(records)) {
    return Object.freeze({ ok: false, issues: Object.freeze([issue('invalid_catalog')]) });
  }

  const issues = [];
  if (records.length !== WILD_MONSTER_FORM_COUNT) {
    issues.push(issue('catalog_count_mismatch', -1, 'length', { value: records.length }));
  }

  const monsterIds = new Set();
  const formIds = new Set();
  const species = new Map();

  records.forEach((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      issues.push(issue('invalid_definition', index));
      return;
    }

    const forbiddenField = hasForbiddenField(record);
    if (forbiddenField) issues.push(issue('forbidden_field', index, forbiddenField));

    if (!/^MON_\d{3}$/.test(record.monsterId ?? '')) {
      issues.push(issue('invalid_monster_id', index, 'monsterId', { value: record.monsterId ?? null }));
    }
    if (monsterIds.has(record.monsterId)) issues.push(issue('duplicate_monster_id', index, 'monsterId', { value: record.monsterId }));
    monsterIds.add(record.monsterId);

    if (record.formId !== record.monsterId) {
      issues.push(issue('form_identity_mismatch', index, 'formId', { value: record.formId ?? null }));
    }
    if (formIds.has(record.formId)) issues.push(issue('duplicate_form_id', index, 'formId', { value: record.formId }));
    formIds.add(record.formId);

    if (typeof record.speciesId !== 'string' || !/^[a-z][a-z0-9]*$/.test(record.speciesId)) {
      issues.push(issue('invalid_species_id', index, 'speciesId', { value: record.speciesId ?? null }));
    }
    if (![1, 2].includes(record.stage)) issues.push(issue('invalid_stage', index, 'stage', { value: record.stage ?? null }));

    if (!Array.isArray(record.types) || record.types.length !== 1 || !TYPE_SET.has(record.types[0])) {
      issues.push(issue('invalid_types', index, 'types'));
    }

    const baseStats = record.baseStats;
    if (!baseStats || typeof baseStats !== 'object' || Array.isArray(baseStats)) {
      issues.push(issue('invalid_core6', index, 'baseStats'));
    } else {
      const keys = Object.keys(baseStats).sort();
      const expectedKeys = [...CORE6_STAT_KEYS].sort();
      if (keys.length !== expectedKeys.length || keys.some((key, keyIndex) => key !== expectedKeys[keyIndex])) {
        issues.push(issue('invalid_core6_shape', index, 'baseStats'));
      } else if (CORE6_STAT_KEYS.some(key => !Number.isSafeInteger(baseStats[key]) || baseStats[key] <= 0)) {
        issues.push(issue('invalid_core6_value', index, 'baseStats'));
      }
    }

    if (!Number.isSafeInteger(record.baseExpYield) || record.baseExpYield <= 0) {
      issues.push(issue('invalid_base_exp_yield', index, 'baseExpYield', { value: record.baseExpYield ?? null }));
    }
    if (!RARITY_SET.has(record.rarity)) {
      issues.push(issue('invalid_rarity', index, 'rarity', { value: record.rarity ?? null }));
    }

    const forms = species.get(record.speciesId) ?? [];
    forms.push(record);
    species.set(record.speciesId, forms);
  });

  if (monsterIds.size !== WILD_MONSTER_FORM_COUNT) issues.push(issue('monster_id_count_mismatch', -1, 'monsterId', { value: monsterIds.size }));
  if (formIds.size !== WILD_MONSTER_FORM_COUNT) issues.push(issue('form_id_count_mismatch', -1, 'formId', { value: formIds.size }));
  if (species.size !== WILD_MONSTER_FAMILY_COUNT) issues.push(issue('species_family_count_mismatch', -1, 'speciesId', { value: species.size }));

  for (const [speciesId, forms] of species) {
    const stages = forms.map(form => form.stage).sort((a, b) => a - b);
    if (forms.length !== 2 || stages[0] !== 1 || stages[1] !== 2) {
      issues.push(issue('species_stage_coverage_mismatch', -1, 'speciesId', { speciesId }));
      continue;
    }
    if (forms[0].types[0] !== forms[1].types[0]) {
      issues.push(issue('species_type_mismatch', -1, 'types', { speciesId }));
    }
  }

  return Object.freeze({ ok: issues.length === 0, issues: Object.freeze(issues) });
}
