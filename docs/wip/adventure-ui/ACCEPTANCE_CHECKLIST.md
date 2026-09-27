# Adventure UI Prototype Acceptance Checklist

## Scope / branch

- [ ] Branch is `feature/adventure-ui-prototype`.
- [ ] Every changed path is under `docs/wip/adventure-ui/**`.
- [ ] No change to `index.html`.
- [ ] No change to `src/**`.
- [ ] No engine/app/boot/save/gameplay change.
- [ ] No production CSS change.
- [ ] PR is Draft.

## Data authority

- [ ] Prototype reads only `fixtures/adventure-ui-fixture.json`.
- [ ] Fixture is explicitly marked non-canonical/read-only.
- [ ] No production module imports.
- [ ] No external API calls.
- [ ] No localStorage/sessionStorage writes.
- [ ] No world-state writes.
- [ ] No simulation execution.
- [ ] No combat calculation.
- [ ] No loot/inventory grant.
- [ ] No equipment/upgrade mutation.
- [ ] No zone unlock/discovery mutation.

## Adventurer Inspector

- [ ] Profession visible.
- [ ] Specialization visible.
- [ ] Level visible.
- [ ] EXP visible.
- [ ] HP visible.
- [ ] ATK / DEF visible.
- [ ] SPATK / SPDEF visible.
- [ ] SPD visible.
- [ ] Known zones visible.
- [ ] Current expedition visible.

## Adventure HUD

- [ ] HP visible.
- [ ] Level visible.
- [ ] EXP visible.
- [ ] Attack button present.
- [ ] Skill 1 present.
- [ ] Skill 2 present.
- [ ] Skill 3 present.
- [ ] Dodge / Guard present.
- [ ] Retreat present.
- [ ] Prototype actions are clearly no-op intents.

## Encounter

- [ ] Clone and monster are shown together.
- [ ] Monster name visible.
- [ ] Monster type visible.
- [ ] Monster level visible.
- [ ] Damage feedback visible.
- [ ] Status feedback visible.

## Loot

- [ ] Item drops visible.
- [ ] Quantity visible.
- [ ] Rarity visible.
- [ ] Return action present.
- [ ] Continue action present.

## Equipment

- [ ] Weapon slot visible.
- [ ] Armor slot visible.
- [ ] Accessory slot visible.
- [ ] Before/after stat comparison visible.
- [ ] Upgrade preview visible.
- [ ] Preview is explicitly non-authoritative.

## Region viewer

- [ ] z1 shown with Lv.1–15 recommendation.
- [ ] z2 shown with Lv.16–30 recommendation.
- [ ] z3 shown with Lv.31–45 recommendation.
- [ ] z4 shown with Lv.46–60 recommendation.
- [ ] Known regions are distinguishable.
- [ ] Unknown regions are distinguishable.
- [ ] Unknown names/content remain masked.
- [ ] No fake unlock controls or inferred unlock state.

## Responsive UX

- [ ] Mobile portrait keeps world as primary surface.
- [ ] Desktop uses compact bottom HUD + side sheet.
- [ ] Landscape compresses controls without permanent large dashboard.
- [ ] Sheets can be dismissed to return visual focus to world.

## Agent H handoff

- [ ] `FIXTURE_SCHEMA.md` defines minimum read-model fields.
- [ ] Read snapshot → render boundary is explicit.
- [ ] User intent → runtime command boundary is explicit.
- [ ] Writer/authority responsibilities remain outside UI.
