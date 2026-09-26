const block = (hp, atk, def, spAtk, spDef, spd) => ({ hp, atk, def, spAtk, spDef, spd });
const JOBS = {
  ranger: {
    id: "ranger",
    name: "\u0E19\u0E31\u0E01\u0E40\u0E14\u0E34\u0E19\u0E1B\u0E48\u0E32",
    blurb: "\u0E22\u0E34\u0E07\u0E08\u0E38\u0E14\u0E41\u0E25\u0E30\u0E02\u0E22\u0E31\u0E1A\u0E01\u0E48\u0E2D\u0E19 \u0E40\u0E01\u0E48\u0E07\u0E15\u0E2D\u0E19\u0E40\u0E1B\u0E49\u0E32\u0E2B\u0E21\u0E32\u0E22\u0E2D\u0E48\u0E2D\u0E19",
    element: null,
    channel: "physical",
    apprentice: block(48, 46, 36, 40, 36, 56),
    advanced: block(90, 82, 66, 74, 66, 100),
    skills: ["aim", "weak", "pace", "mark"]
  },
  guardian: {
    id: "guardian",
    name: "\u0E19\u0E31\u0E01\u0E2A\u0E39\u0E49\u0E04\u0E38\u0E49\u0E21\u0E01\u0E31\u0E19",
    blurb: "\u0E23\u0E31\u0E1A\u0E14\u0E32\u0E40\u0E21\u0E08\u0E41\u0E25\u0E49\u0E27\u0E17\u0E38\u0E1A\u0E40\u0E01\u0E23\u0E32\u0E30 \u0E18\u0E32\u0E15\u0E38\u0E2A\u0E39\u0E49",
    element: "FIGHTING",
    channel: "physical",
    apprentice: block(58, 50, 54, 32, 46, 28),
    advanced: block(104, 90, 98, 60, 84, 52),
    skills: ["slam", "guard", "plate", "smash"]
  },
  ritual: {
    id: "ritual",
    name: "\u0E19\u0E31\u0E01\u0E1E\u0E34\u0E18\u0E35",
    blurb: "\u0E40\u0E27\u0E17\u0E41\u0E25\u0E30\u0E1B\u0E23\u0E30\u0E04\u0E2D\u0E07 \u0E18\u0E32\u0E15\u0E38\u0E19\u0E32\u0E07\u0E1F\u0E49\u0E32",
    element: "FAIRY",
    channel: "special",
    apprentice: block(52, 32, 40, 54, 50, 34),
    advanced: block(96, 60, 74, 96, 90, 64),
    skills: ["spark", "mend", "veil", "purge"]
  }
};
const SKILLS = {
  aim: { id: "aim", name: "\u0E40\u0E25\u0E47\u0E07\u0E41\u0E21\u0E48\u0E19", detail: "\u0E17\u0E48\u0E32\u0E16\u0E31\u0E14\u0E44\u0E1B\u0E15\u0E34\u0E14\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E31\u0E25", channel: "self", element: null },
  weak: { id: "weak", name: "\u0E22\u0E34\u0E07\u0E08\u0E38\u0E14\u0E2D\u0E48\u0E2D\u0E19", detail: "\u0E42\u0E08\u0E21\u0E15\u0E35\u0E01\u0E32\u0E22\u0E41\u0E23\u0E07\u0E02\u0E36\u0E49\u0E19\u0E15\u0E32\u0E21\u0E23\u0E30\u0E14\u0E31\u0E1A", channel: "physical", element: null },
  pace: { id: "pace", name: "\u0E1D\u0E35\u0E40\u0E17\u0E49\u0E32", detail: "\u0E2B\u0E25\u0E1A\u0E01\u0E32\u0E23\u0E42\u0E08\u0E21\u0E15\u0E35\u0E16\u0E31\u0E14\u0E44\u0E1B\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E04\u0E23\u0E31\u0E49\u0E07", channel: "self", element: null },
  mark: { id: "mark", name: "\u0E23\u0E2D\u0E22\u0E2A\u0E31\u0E07\u0E2B\u0E32\u0E23", detail: "\u0E41\u0E23\u0E07\u0E02\u0E36\u0E49\u0E19\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E1B\u0E49\u0E32\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E44\u0E21\u0E48\u0E16\u0E36\u0E07 40%", channel: "physical", element: null },
  slam: { id: "slam", name: "\u0E01\u0E23\u0E30\u0E41\u0E17\u0E01", detail: "\u0E42\u0E08\u0E21\u0E15\u0E35\u0E18\u0E32\u0E15\u0E38\u0E2A\u0E39\u0E49 \u0E41\u0E25\u0E30\u0E21\u0E35\u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E43\u0E2B\u0E49\u0E28\u0E31\u0E15\u0E23\u0E39\u0E40\u0E2A\u0E35\u0E22\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30", channel: "physical", element: "FIGHTING" },
  guard: { id: "guard", name: "\u0E15\u0E31\u0E49\u0E07\u0E23\u0E31\u0E1A", detail: "\u0E25\u0E14\u0E14\u0E32\u0E40\u0E21\u0E08\u0E04\u0E23\u0E31\u0E49\u0E07\u0E16\u0E31\u0E14\u0E44\u0E1B", channel: "self", element: null },
  plate: { id: "plate", name: "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E2B\u0E19\u0E32", detail: "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E01\u0E23\u0E32\u0E30\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27\u0E2A\u0E32\u0E21\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30", channel: "self", element: null },
  smash: { id: "smash", name: "\u0E17\u0E38\u0E1A\u0E40\u0E01\u0E23\u0E32\u0E30", detail: "\u0E42\u0E08\u0E21\u0E15\u0E35\u0E18\u0E32\u0E15\u0E38\u0E2A\u0E39\u0E49\u0E41\u0E25\u0E30\u0E40\u0E08\u0E32\u0E30\u0E40\u0E01\u0E23\u0E32\u0E30", channel: "physical", element: "FIGHTING" },
  spark: { id: "spark", name: "\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22", detail: "\u0E40\u0E27\u0E17\u0E19\u0E32\u0E07\u0E1F\u0E49\u0E32", channel: "special", element: "FAIRY" },
  mend: { id: "mend", name: "\u0E1B\u0E23\u0E30\u0E04\u0E2D\u0E07", detail: "\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07 \u0E44\u0E21\u0E48\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E1E\u0E25\u0E31\u0E07\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14", channel: "self", element: null },
  veil: { id: "veil", name: "\u0E21\u0E48\u0E32\u0E19", detail: "\u0E25\u0E14\u0E14\u0E32\u0E40\u0E21\u0E08\u0E17\u0E35\u0E48\u0E23\u0E31\u0E1A\u0E2A\u0E2D\u0E07\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30", channel: "self", element: null },
  purge: { id: "purge", name: "\u0E0A\u0E33\u0E23\u0E30", detail: "\u0E40\u0E27\u0E17\u0E41\u0E23\u0E07 \u0E41\u0E25\u0E30\u0E25\u0E49\u0E32\u0E07\u0E40\u0E01\u0E23\u0E32\u0E30\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27\u0E02\u0E2D\u0E07\u0E28\u0E31\u0E15\u0E23\u0E39", channel: "special", element: "FAIRY" }
};
function mon(id, name, element, stage, hp, atk, def, spAtk, spDef, spd, exp, rare = false) {
  return { id, name, element, stage, bases: block(hp, atk, def, spAtk, spDef, spd), exp, rare };
}
const MONSTERS = [
  mon("MON_001", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E1B\u0E01\u0E15\u0E34", "NORMAL", 1, 52, 42, 42, 42, 42, 42, 35),
  mon("MON_002", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E44\u0E1F", "FIRE", 1, 46, 38, 34, 54, 38, 46, 35),
  mon("MON_003", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E19\u0E49\u0E33", "WATER", 1, 54, 38, 44, 44, 46, 36, 35),
  mon("MON_004", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E1E\u0E37\u0E0A", "GRASS", 1, 50, 34, 42, 44, 50, 38, 35),
  mon("MON_005", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E44\u0E1F\u0E1F\u0E49\u0E32", "ELECTRIC", 1, 44, 44, 34, 46, 34, 58, 35),
  mon("MON_006", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07", "ICE", 1, 48, 36, 40, 46, 46, 42, 35),
  mon("MON_007", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E2B\u0E34\u0E19", "ROCK", 1, 60, 40, 56, 32, 50, 26, 35),
  mon("MON_008", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E14\u0E34\u0E19", "GROUND", 1, 56, 48, 48, 34, 40, 32, 35),
  mon("MON_009", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E25\u0E21", "FLYING", 1, 44, 42, 34, 42, 34, 58, 35),
  mon("MON_010", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E1E\u0E34\u0E29", "POISON", 1, 48, 36, 38, 48, 42, 44, 35),
  mon("MON_011", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E21\u0E37\u0E14", "DARK", 1, 42, 52, 32, 44, 34, 58, 35),
  mon("MON_012", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E41\u0E2A\u0E07", "FAIRY", 1, 52, 32, 40, 48, 54, 36, 35),
  mon("MON_013", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E1E\u0E25\u0E31\u0E07\u0E08\u0E34\u0E15", "PSYCHIC", 1, 48, 36, 40, 46, 46, 42, 35),
  mon("MON_014", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E41\u0E21\u0E25\u0E07", "BUG", 1, 50, 40, 48, 40, 46, 34, 35),
  mon("MON_015", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E21\u0E31\u0E07\u0E01\u0E23", "DRAGON", 1, 50, 44, 40, 50, 40, 38, 35),
  mon("MON_016", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E15\u0E48\u0E2D\u0E2A\u0E39\u0E49", "FIGHTING", 1, 50, 52, 40, 32, 36, 48, 35),
  mon("MON_017", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E40\u0E2B\u0E25\u0E47\u0E01", "STEEL", 1, 60, 40, 56, 32, 50, 26, 35),
  mon("MON_018", "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13", "GHOST", 1, 46, 38, 36, 50, 42, 50, 35),
  mon("MON_019", "\u0E01\u0E23\u0E30\u0E15\u0E48\u0E32\u0E22\u0E27\u0E48\u0E2D\u0E07\u0E44\u0E27", "NORMAL", 2, 96, 76, 76, 76, 76, 76, 90),
  mon("MON_020", "\u0E08\u0E34\u0E49\u0E07\u0E08\u0E2D\u0E01\u0E40\u0E1E\u0E25\u0E34\u0E07", "FIRE", 2, 86, 69, 63, 95, 69, 82, 90),
  mon("MON_021", "\u0E19\u0E32\u0E01\u0E27\u0E32\u0E23\u0E35", "WATER", 2, 99, 69, 79, 79, 82, 66, 90),
  mon("MON_022", "\u0E01\u0E27\u0E32\u0E07\u0E1E\u0E24\u0E01\u0E29\u0E32", "GRASS", 2, 93, 63, 76, 79, 89, 69, 90),
  mon("MON_023", "\u0E40\u0E2A\u0E37\u0E2D\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32", "ELECTRIC", 2, 83, 79, 63, 82, 63, 101, 90),
  mon("MON_024", "\u0E2B\u0E21\u0E32\u0E1B\u0E48\u0E32\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07", "ICE", 2, 89, 66, 72, 82, 82, 76, 90),
  mon("MON_025", "\u0E41\u0E23\u0E14\u0E28\u0E34\u0E25\u0E32", "ROCK", 2, 109, 72, 98, 59, 89, 50, 90),
  mon("MON_026", "\u0E15\u0E31\u0E27\u0E15\u0E38\u0E48\u0E19\u0E1B\u0E10\u0E1E\u0E35", "GROUND", 2, 102, 85, 85, 63, 72, 59, 90),
  mon("MON_027", "\u0E40\u0E2B\u0E22\u0E35\u0E48\u0E22\u0E27\u0E27\u0E32\u0E22\u0E38", "FLYING", 2, 83, 76, 63, 76, 63, 101, 90),
  mon("MON_028", "\u0E07\u0E39\u0E1E\u0E34\u0E29", "POISON", 2, 89, 66, 69, 85, 76, 79, 90),
  mon("MON_029", "\u0E40\u0E2A\u0E37\u0E2D\u0E14\u0E33\u0E40\u0E07\u0E32", "DARK", 2, 80, 92, 59, 79, 63, 101, 100, true),
  mon("MON_030", "\u0E01\u0E27\u0E32\u0E07\u0E28\u0E31\u0E01\u0E14\u0E34\u0E4C\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C", "FAIRY", 2, 96, 59, 72, 85, 95, 66, 100, true),
  mon("MON_031", "\u0E41\u0E21\u0E27\u0E08\u0E34\u0E15", "PSYCHIC", 2, 89, 66, 72, 82, 82, 76, 90),
  mon("MON_032", "\u0E14\u0E49\u0E27\u0E07\u0E40\u0E01\u0E23\u0E32\u0E30", "BUG", 2, 93, 72, 85, 72, 82, 63, 90),
  mon("MON_033", "\u0E21\u0E31\u0E07\u0E01\u0E23\u0E19\u0E49\u0E2D\u0E22", "DRAGON", 2, 93, 79, 72, 89, 72, 69, 100, true),
  mon("MON_034", "\u0E25\u0E34\u0E07\u0E19\u0E31\u0E01\u0E2A\u0E39\u0E49", "FIGHTING", 2, 93, 92, 72, 59, 66, 85, 90),
  mon("MON_035", "\u0E2B\u0E21\u0E32\u0E1B\u0E48\u0E32\u0E40\u0E2B\u0E25\u0E47\u0E01", "STEEL", 2, 109, 72, 98, 59, 89, 50, 90),
  mon("MON_036", "\u0E08\u0E34\u0E49\u0E07\u0E08\u0E2D\u0E01\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13", "GHOST", 2, 86, 69, 66, 89, 76, 89, 100, true)
];
const ZONES = [
  {
    id: "z1",
    name: "\u0E02\u0E2D\u0E1A\u0E42\u0E04\u0E25\u0E19",
    note: "\u0E42\u0E04\u0E25\u0E19\u0E15\u0E37\u0E49\u0E19 \u0E23\u0E48\u0E32\u0E07\u0E41\u0E23\u0E01\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E25\u0E2D\u0E01\u0E04\u0E23\u0E32\u0E1A",
    min: 1,
    max: 15,
    stage: 1,
    need: 1,
    rank: "normal",
    roster: ["MON_001", "MON_002", "MON_003", "MON_004", "MON_007"]
  },
  {
    id: "z2",
    name: "\u0E17\u0E38\u0E48\u0E07\u0E23\u0E48\u0E32\u0E07\u0E2A\u0E2D\u0E07",
    note: "\u0E2A\u0E31\u0E15\u0E27\u0E4C\u0E17\u0E35\u0E48\u0E25\u0E2D\u0E01\u0E04\u0E23\u0E32\u0E1A\u0E41\u0E25\u0E49\u0E27 \u0E40\u0E14\u0E34\u0E19\u0E17\u0E38\u0E48\u0E07\u0E40\u0E1B\u0E34\u0E14",
    min: 16,
    max: 30,
    stage: 2,
    need: 16,
    rank: "normal",
    roster: ["MON_019", "MON_020", "MON_021", "MON_022", "MON_028"]
  },
  {
    id: "z3",
    name: "\u0E2A\u0E31\u0E19\u0E40\u0E02\u0E32",
    note: "\u0E25\u0E21\u0E41\u0E23\u0E07 \u0E23\u0E48\u0E32\u0E07\u0E2A\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E40\u0E23\u0E47\u0E27\u0E41\u0E25\u0E30\u0E41\u0E02\u0E47\u0E07\u0E01\u0E27\u0E48\u0E32\u0E17\u0E38\u0E48\u0E07",
    min: 31,
    max: 45,
    stage: 2,
    need: 31,
    rank: "normal",
    roster: ["MON_023", "MON_024", "MON_025", "MON_027", "MON_034"]
  },
  {
    id: "z4",
    name: "\u0E1B\u0E32\u0E01\u0E16\u0E49\u0E33",
    note: "\u0E0A\u0E31\u0E49\u0E19\u0E2A\u0E39\u0E07\u0E17\u0E31\u0E49\u0E07\u0E1D\u0E39\u0E07 \u0E1C\u0E39\u0E49\u0E1E\u0E34\u0E17\u0E31\u0E01\u0E29\u0E4C\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E25\u0E40\u0E27\u0E25 46",
    min: 46,
    max: 60,
    stage: 2,
    need: 46,
    rank: "elite",
    roster: ["MON_026", "MON_029", "MON_030", "MON_035", "MON_036"]
  }
];
const ELEMENT_LABEL = {
  NORMAL: "\u0E18\u0E23\u0E23\u0E21\u0E14\u0E32",
  FIRE: "\u0E44\u0E1F",
  WATER: "\u0E19\u0E49\u0E33",
  GRASS: "\u0E1E\u0E37\u0E0A",
  ELECTRIC: "\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32",
  ICE: "\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07",
  ROCK: "\u0E2B\u0E34\u0E19",
  GROUND: "\u0E14\u0E34\u0E19",
  FLYING: "\u0E25\u0E21",
  POISON: "\u0E1E\u0E34\u0E29",
  DARK: "\u0E21\u0E37\u0E14",
  FAIRY: "\u0E41\u0E2A\u0E07",
  PSYCHIC: "\u0E08\u0E34\u0E15",
  BUG: "\u0E41\u0E21\u0E25\u0E07",
  DRAGON: "\u0E21\u0E31\u0E07\u0E01\u0E23",
  FIGHTING: "\u0E2A\u0E39\u0E49",
  STEEL: "\u0E40\u0E2B\u0E25\u0E47\u0E01",
  GHOST: "\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13"
};
function routeHint(level, clears, form) {
  const mark = (count) => `${Math.min(count, 5)}/5`;
  if (form === "apprentice") return `\u0E17\u0E32\u0E07: \u0E02\u0E2D\u0E1A\u0E42\u0E04\u0E25\u0E19 ${mark(clears.z1)} \u2192 \u0E40\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E10\u0E32\u0E19\u0E17\u0E35\u0E48\u0E40\u0E25\u0E40\u0E27\u0E25 15`;
  if (level < 16) return "\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E10\u0E32\u0E19\u0E41\u0E25\u0E49\u0E27 \xB7 \u0E16\u0E31\u0E14\u0E44\u0E1B\u0E17\u0E38\u0E48\u0E07\u0E23\u0E48\u0E32\u0E07\u0E2A\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E40\u0E25\u0E40\u0E27\u0E25 16";
  if (level < 31) return `\u0E17\u0E32\u0E07: \u0E17\u0E38\u0E48\u0E07\u0E23\u0E48\u0E32\u0E07\u0E2A\u0E2D\u0E07 ${mark(clears.z2)} \u2192 \u0E2A\u0E31\u0E19\u0E40\u0E02\u0E32\u0E17\u0E35\u0E48\u0E40\u0E25\u0E40\u0E27\u0E25 31`;
  if (level < 46) return `\u0E17\u0E32\u0E07: \u0E2A\u0E31\u0E19\u0E40\u0E02\u0E32 ${mark(clears.z3)} \u2192 \u0E1B\u0E32\u0E01\u0E16\u0E49\u0E33\u0E17\u0E35\u0E48\u0E40\u0E25\u0E40\u0E27\u0E25 46`;
  return `\u0E17\u0E32\u0E07: \u0E1B\u0E32\u0E01\u0E16\u0E49\u0E33 ${mark(clears.z4)} \u0E0A\u0E31\u0E49\u0E19\u0E2A\u0E39\u0E07 \xB7 \u0E1C\u0E39\u0E49\u0E1E\u0E34\u0E17\u0E31\u0E01\u0E29\u0E4C\u0E04\u0E23\u0E31\u0E49\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27\u0E15\u0E48\u0E2D\u0E01\u0E32\u0E23\u0E40\u0E02\u0E49\u0E32`;
}
function elementName(element) {
  return element ? ELEMENT_LABEL[element] : "\u0E44\u0E23\u0E49\u0E18\u0E32\u0E15\u0E38";
}
function encountersOf(zone) {
  const band = ZONES.find((item) => item.id === zone);
  if (!band) return [];
  return band.roster.map((id) => monsterById(id));
}
const CHART = {
  "FIRE>GRASS": 2,
  "FIRE>ICE": 2,
  "FIRE>BUG": 2,
  "FIRE>STEEL": 2,
  "WATER>FIRE": 2,
  "WATER>GROUND": 2,
  "WATER>ROCK": 2,
  "GRASS>WATER": 2,
  "GRASS>GROUND": 2,
  "GRASS>ROCK": 2,
  "ELECTRIC>WATER": 2,
  "ELECTRIC>FLYING": 2,
  "ELECTRIC>GROUND": 0,
  "ICE>GRASS": 2,
  "ICE>GROUND": 2,
  "ICE>FLYING": 2,
  "ICE>DRAGON": 2,
  "ROCK>FIRE": 2,
  "ROCK>ICE": 2,
  "ROCK>FLYING": 2,
  "ROCK>BUG": 2,
  "GROUND>FIRE": 2,
  "GROUND>ELECTRIC": 2,
  "GROUND>POISON": 2,
  "GROUND>ROCK": 2,
  "GROUND>STEEL": 2,
  "GROUND>FLYING": 0,
  "FLYING>GRASS": 2,
  "FLYING>FIGHTING": 2,
  "FLYING>BUG": 2,
  "POISON>GRASS": 2,
  "POISON>FAIRY": 2,
  "DARK>PSYCHIC": 2,
  "DARK>GHOST": 2,
  "FAIRY>FIGHTING": 2,
  "FAIRY>DRAGON": 2,
  "FAIRY>DARK": 2,
  "PSYCHIC>FIGHTING": 2,
  "PSYCHIC>POISON": 2,
  "BUG>GRASS": 2,
  "BUG>PSYCHIC": 2,
  "BUG>DARK": 2,
  "DRAGON>DRAGON": 2,
  "FIGHTING>NORMAL": 2,
  "FIGHTING>ROCK": 2,
  "FIGHTING>STEEL": 2,
  "FIGHTING>ICE": 2,
  "FIGHTING>DARK": 2,
  "FIGHTING>GHOST": 0,
  "STEEL>ICE": 2,
  "STEEL>ROCK": 2,
  "STEEL>FAIRY": 2,
  "GHOST>PSYCHIC": 2,
  "GHOST>GHOST": 2,
  "GHOST>NORMAL": 0,
  "NORMAL>GHOST": 0
};
function typeMultiplier(attack, defend) {
  if (!attack || !defend) return 1;
  const listed = CHART[`${attack}>${defend}`];
  if (listed !== void 0) return listed;
  const reverse = CHART[`${defend}>${attack}`];
  return reverse === 2 ? 0.5 : 1;
}
function stabOf(attack, attacker) {
  return attack && attacker && attack === attacker ? 1.5 : 1;
}
const STAT_LABEL = {
  hp: "\u0E1E\u0E25\u0E31\u0E07",
  atk: "\u0E42\u0E08\u0E21\u0E15\u0E35",
  def: "\u0E40\u0E01\u0E23\u0E32\u0E30",
  spAtk: "\u0E40\u0E27\u0E17",
  spDef: "\u0E15\u0E49\u0E32\u0E19\u0E40\u0E27\u0E17",
  spd: "\u0E40\u0E23\u0E47\u0E27"
};
function monsterById(id) {
  const found = MONSTERS.find((monster) => monster.id === id);
  if (!found) throw new Error("unknown_monster");
  return found;
}
export {
  ELEMENT_LABEL,
  JOBS,
  MONSTERS,
  SKILLS,
  STAT_LABEL,
  ZONES,
  elementName,
  encountersOf,
  monsterById,
  routeHint,
  stabOf,
  typeMultiplier
};
