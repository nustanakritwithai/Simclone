import {
  ADVENTURE_GEAR_STAT_BOUNDS,
  boundCombatModifiers,
  normalizeGearDefinition,
} from './adventure-gear.mjs?v=0.5.0';

export const ADVENTURE_MAX_UPGRADE_LEVEL = 10;
export const ADVENTURE_UPGRADE_STEP_PERCENT = 10;
export const ADVENTURE_UPGRADE_MATERIAL_CAP = 6;

function invariant(condition, message) {
  if (!condition) throw new TypeError(message);
}

function scaleInteger(base, level) {
  const numerator = base * (100 + level * ADVENTURE_UPGRADE_STEP_PERCENT);
  return Math.floor((numerator + 50) / 100);
}

export function calculateUpgradeModifiers(baseModifiers, upgradeLevel) {
  invariant(Number.isInteger(upgradeLevel), 'upgradeLevel must be an integer');
  invariant(upgradeLevel >= 0 && upgradeLevel <= ADVENTURE_MAX_UPGRADE_LEVEL, `upgradeLevel must be within +0..+${ADVENTURE_MAX_UPGRADE_LEVEL}`);
  const boundedBase = boundCombatModifiers(baseModifiers);
  const scaled = {};

  for (const [stat, value] of Object.entries(boundedBase)) {
    scaled[stat] = Math.min(scaleInteger(value, upgradeLevel), ADVENTURE_GEAR_STAT_BOUNDS[stat]);
  }

  return boundCombatModifiers(scaled);
}

export function calculateUpgradeCost(gear, fromLevel) {
  const normalizedGear = normalizeGearDefinition(gear);
  invariant(Number.isInteger(fromLevel), 'fromLevel must be an integer');
  invariant(fromLevel >= 0 && fromLevel < ADVENTURE_MAX_UPGRADE_LEVEL, `fromLevel must be within +0..+${ADVENTURE_MAX_UPGRADE_LEVEL - 1}`);
  const quantity = Math.min(1 + Math.floor(fromLevel / 2), ADVENTURE_UPGRADE_MATERIAL_CAP);
  return Object.freeze([
    Object.freeze({ itemKind: normalizedGear.upgradeMaterialKind, quantity }),
  ]);
}

/**
 * Calculation-only upgrade proposal. It does not consume material, mutate gear,
 * write inventory, or decide persistence.
 */
export function proposeGearUpgrade({ gear, fromLevel }) {
  const normalizedGear = normalizeGearDefinition(gear);
  invariant(Number.isInteger(fromLevel), 'fromLevel must be an integer');
  invariant(fromLevel >= 0 && fromLevel < ADVENTURE_MAX_UPGRADE_LEVEL, `fromLevel must be within +0..+${ADVENTURE_MAX_UPGRADE_LEVEL - 1}`);
  const toLevel = fromLevel + 1;

  return Object.freeze({
    gearId: normalizedGear.gearId,
    slot: normalizedGear.slot,
    fromLevel,
    toLevel,
    modifiersBefore: calculateUpgradeModifiers(normalizedGear.baseModifiers, fromLevel),
    modifiersAfter: calculateUpgradeModifiers(normalizedGear.baseModifiers, toLevel),
    materialProposal: calculateUpgradeCost(normalizedGear, fromLevel),
  });
}
