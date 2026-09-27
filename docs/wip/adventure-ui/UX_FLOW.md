# Adventure UX Flow

## Product intent

A Clone can enter an Adventure/MMORPG interaction mode without replacing Simclone's world view with a separate permanent dashboard.

The world remains visible and conceptually primary. Adventure UI appears only when needed.

## Surface hierarchy

1. World surface — always the base layer.
2. Compact Adventure HUD — persistent only while the Clone is in Adventure context.
3. Context sheets — Inspector, Regions, Equipment.
4. Encounter focus — temporary combat-focused sheet over the world.
5. Loot result — short result sheet after a verified encounter outcome.
6. Return to world — closes the temporary layer; it does not mutate simulation state.

## Flow

World
→ tap Clone identity
→ Adventurer Inspector
→ close
→ World

World
→ tap Map
→ Region Viewer
→ inspect z1–z4 read-only states
→ close
→ World

World
→ tap Gear
→ Equipment
→ compare current vs candidate stats
→ inspect upgrade preview
→ close
→ World

World
→ encounter marker / runtime-owned trigger in future implementation
→ Encounter
→ runtime later owns combat actions/outcomes
→ Loot Result
→ Return or Continue intent
→ World / next runtime-owned encounter

## Adventurer Inspector

The sheet must show:

- Profession
- Specialization
- Level
- EXP
- HP
- ATK / DEF / SPATK / SPDEF / SPD
- Known zones
- Current expedition

It is a read model. No profession, stat, expedition, or zone changes originate from this surface.

## Adventure HUD

The HUD is compact and thumb-reachable on mobile:

- HP
- Level is visible in the identity chip
- EXP
- Attack
- Skill 1
- Skill 2
- Skill 3
- Dodge / Guard
- Retreat

Prototype buttons are no-op intents. Agent H must wire them only to approved runtime commands later.

## Encounter

Encounter temporarily increases visual focus while keeping the world behind it.

Required information:

- Clone identity / level / HP
- Monster name
- Monster type
- Monster level
- Monster HP snapshot
- damage feedback
- status feedback

The UI never calculates damage.

## Loot result

The result shows a verified reward snapshot:

- item drop
- quantity
- rarity
- Return
- Continue

The prototype does not create inventory items.

## Equipment

Three explicit slots:

- Weapon
- Armor
- Accessory

Comparison is before/after only. Upgrade is preview only. No resource spend, RNG, crafting, equipment writer, or save mutation occurs in this layer.

## Region viewer

Baseline rows:

- z1 · Lv.1–15
- z2 · Lv.16–30
- z3 · Lv.31–45
- z4 · Lv.46–60

Known state comes from the input snapshot.

For unknown zones:

- show zone id
- show level recommendation
- show Unknown
- mask name/content
- do not infer roster, discovery, unlock requirement, or unlock state

## Responsive behavior

### Mobile portrait

- identity top-left
- map/gear top-right
- compact bottom HUD
- context surfaces use a bottom sheet

### Desktop

- HUD remains compact at bottom-center
- sheets become a right-side floating panel
- world occupies most of the viewport

### Landscape mobile

- HUD becomes a shallow horizontal action bar
- sheet becomes a right-side panel
- action buttons remain reachable without covering the central world view

## Authority rule for implementation

UI input = immutable snapshot/read model.

UI output = user intent only.

UI must not become a writer for world, combat, loot, equipment, progression, unlocks, inventory, save, or expedition state.
