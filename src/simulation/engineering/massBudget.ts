/**
 * SECTOR 17 — Spacecraft Mass Budget Engine
 * Computes dry mass, propellant mass, wet mass, payload fraction,
 * and launch vehicle mass margin with zero double-counting.
 *
 * Integrates with Phase 1 Rocket Equation engine for propellant fraction and delta-v.
 * Pure mathematical TypeScript module independent of React/DOM.
 */

import { DEFAULT_MASS_MARGIN_PERCENT } from '../constants';
import { calculatePropellantFraction, calculateDeltaV } from '../physics/rocketEquation';
import type {
  MassCategory,
  MassBudgetInput,
  MassBudgetResult,
  MassBudgetStatus,
} from '../types';


/** Valid category list for runtime assertions */
export const MASS_CATEGORIES: readonly MassCategory[] = [
  'bus',
  'propulsionDry',
  'propellant',
  'instruments',
  'communication',
  'power',
  'thermal',
  'lander',
  'rover',
  'other',
] as const;

/**
 * Creates an empty zero-initialized category breakdown record
 */
export function createEmptyMassBreakdown(): Record<MassCategory, number> {
  return {
    bus: 0,
    propulsionDry: 0,
    propellant: 0,
    instruments: 0,
    communication: 0,
    power: 0,
    thermal: 0,
    lander: 0,
    rover: 0,
    other: 0,
  };
}

/**
 * Validates that an individual mass number is a finite, non-negative number.
 * @throws TypeError if mass is not a finite number
 * @throws RangeError if mass is strictly negative
 */
export function validateMassValue(massKg: number, label: string): number {
  if (typeof massKg !== 'number' || !Number.isFinite(massKg)) {
    throw new TypeError(`validateMassValue: ${label} must be a finite number. Received: ${massKg}`);
  }
  if (massKg < 0) {
    throw new RangeError(`validateMassValue: ${label} cannot be negative. Received: ${massKg} kg`);
  }
  return massKg;
}

/**
 * Computes complete spacecraft mass budget, payload fractions, and launch margins.
 *
 * Physics & Accounting:
 * - Dry Mass = Bus + PropulsionDry + Instruments + Comm + Power + Thermal + Lander + Rover + Other
 * - Propellant Mass = Propellant
 * - Total Wet Mass = Dry Mass + Propellant Mass
 * - Payload Mass = Instruments + Lander + Rover
 * - Available Mass Margin = LaunchMassLimit - WetMass
 *
 * @param input MassBudgetInput containing either itemized components or category breakdown
 * @returns MassBudgetResult structured validation and budget object
 *
 * @throws TypeError / RangeError on negative or non-finite inputs
 * @throws Error if both itemized list and aggregate category breakdown are supplied (double-counting prevention)
 */
export function calculateMassBudget(input: MassBudgetInput): MassBudgetResult {
  const breakdown = createEmptyMassBreakdown();
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Guard against double-counting: reject simultaneous itemized list and category dictionary
  const hasItems = Array.isArray(input.items) && input.items.length > 0;
  const hasCategories =
    input.categories !== undefined &&
    Object.keys(input.categories).some(
      (k) => input.categories![k as MassCategory] !== undefined && input.categories![k as MassCategory]! > 0
    );

  if (hasItems && hasCategories) {
    throw new Error(
      'calculateMassBudget: Both itemized items and aggregate categories were supplied. Provide only one to prevent double-counting component masses.'
    );
  }

  // 2. Aggregate masses into category breakdown
  if (hasItems) {
    const seenIds = new Set<string>();
    for (const item of input.items!) {
      if (!MASS_CATEGORIES.includes(item.category)) {
        throw new TypeError(
          `calculateMassBudget: Unknown component mass category: '${item.category}'`
        );
      }
      if (item.id) {
        if (seenIds.has(item.id)) {
          throw new Error(
            `calculateMassBudget: Duplicate component ID '${item.id}' detected in itemized list. Each component must be listed at most once.`
          );
        }
        seenIds.add(item.id);
      }
      const validatedMass = validateMassValue(item.massKg, `Component '${item.name || item.id || item.category}'`);
      breakdown[item.category] += validatedMass;
    }
  } else if (input.categories) {
    for (const cat of MASS_CATEGORIES) {
      const val = input.categories[cat];
      if (val !== undefined) {
        breakdown[cat] = validateMassValue(val, `Category '${cat}'`);
      }
    }
  }

  // 3. Compute structural totals
  const totalDryMassKg =
    breakdown.bus +
    breakdown.propulsionDry +
    breakdown.instruments +
    breakdown.communication +
    breakdown.power +
    breakdown.thermal +
    breakdown.lander +
    breakdown.rover +
    breakdown.other;

  if (totalDryMassKg <= 0) {
    throw new RangeError(
      `calculateMassBudget: Spacecraft dry mass must be strictly positive. Computed dry mass: ${totalDryMassKg} kg.`
    );
  }

  const totalPropellantMassKg = breakdown.propellant;
  const totalWetMassKg = totalDryMassKg + totalPropellantMassKg;

  // 4. Compute science payload mass and fractions
  // In planetary mission design, science payload comprises instruments, lander, and rover
  const payloadMassKg = breakdown.instruments + breakdown.lander + breakdown.rover;
  const payloadFractionWet = totalWetMassKg > 0 ? payloadMassKg / totalWetMassKg : 0;
  const payloadFractionDry = totalDryMassKg > 0 ? payloadMassKg / totalDryMassKg : 0;

  // Use Phase 1 rocket equation utility for propellant mass fraction
  const propellantFraction =
    totalPropellantMassKg > 0
      ? calculatePropellantFraction(totalPropellantMassKg, totalWetMassKg)
      : 0;

  // 5. Margin against Launch Vehicle Limit
  const marginThresholdPercent = input.marginThresholdPercent ?? DEFAULT_MASS_MARGIN_PERCENT;
  let massMarginKg: number | undefined = undefined;
  let massMarginPercent: number | undefined = undefined;
  let isWithinLaunchCapacity: boolean | null = null;
  let status: MassBudgetStatus = 'UNKNOWN';

  if (input.launchMassLimitKg !== undefined) {
    const launchLimit = validateMassValue(input.launchMassLimitKg, 'launchMassLimitKg');
    if (launchLimit <= 0) {
      throw new RangeError(
        `calculateMassBudget: Launch vehicle mass limit must be positive. Received: ${launchLimit} kg`
      );
    }

    massMarginKg = launchLimit - totalWetMassKg;
    massMarginPercent = (massMarginKg / launchLimit) * 100;
    isWithinLaunchCapacity = totalWetMassKg <= launchLimit;

    if (totalWetMassKg > launchLimit) {
      status = 'EXCEEDED';
      errors.push(
        `Spacecraft wet mass (${totalWetMassKg.toFixed(1)} kg) exceeds launch vehicle capacity (${launchLimit.toFixed(1)} kg) by ${Math.abs(massMarginKg).toFixed(1)} kg.`
      );
    } else if (massMarginPercent < marginThresholdPercent) {
      status = 'WARNING';
      warnings.push(
        `Available mass margin (${massMarginPercent.toFixed(1)}%, ${massMarginKg.toFixed(1)} kg) is below recommended threshold of ${marginThresholdPercent}%.`
      );
    } else {
      status = 'NOMINAL';
    }
  } else {
    // Treat an absent launch mass limit as unknown, not unlimited
    warnings.push(
      'Launch vehicle mass capacity limit was not provided. Mass budget feasibility relative to launch vehicle cannot be confirmed.'
    );
  }

  // 6. Optional Rocket Equation Integration
  let achievedDeltaVMps: number | undefined = undefined;
  if (input.ispSeconds !== undefined && input.ispSeconds > 0) {
    if (totalPropellantMassKg > 0) {
      achievedDeltaVMps = calculateDeltaV(totalWetMassKg, totalDryMassKg, input.ispSeconds);
      if (input.targetDeltaVMps !== undefined && input.targetDeltaVMps > 0) {
        if (achievedDeltaVMps < input.targetDeltaVMps) {
          warnings.push(
            `Propellant mass provides ${achievedDeltaVMps.toFixed(1)} m/s delta-v, which is below the target delta-v of ${input.targetDeltaVMps.toFixed(1)} m/s.`
          );
        }
      }
    } else {
      achievedDeltaVMps = 0;
      if (input.targetDeltaVMps !== undefined && input.targetDeltaVMps > 0) {
        warnings.push('Zero propellant mass configured. Achieved delta-v is 0 m/s.');
      }
    }
  }

  return {
    categoryBreakdownKg: breakdown,
    totalDryMassKg,
    totalPropellantMassKg,
    totalWetMassKg,
    payloadMassKg,
    payloadFractionWet,
    payloadFractionDry,
    propellantFraction,
    launchMassLimitKg: input.launchMassLimitKg,
    massMarginKg,
    massMarginPercent,
    marginThresholdPercent,
    status,
    isWithinLaunchCapacity,
    warnings,
    errors,
    achievedDeltaVMps,
  };
}
