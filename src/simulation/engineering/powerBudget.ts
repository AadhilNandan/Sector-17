/**
 * SECTOR 17 — Spacecraft Electrical Power Budget Engine
 * Computes solar array generation across heliocentric distances (inverse-square law),
 * radioisotope thermoelectric generation, electrical subsystem loads, power margins,
 * and electric propulsion feasibility checks.
 *
 * Pure mathematical TypeScript module independent of React/DOM.
 */

import { DEFAULT_POWER_RESERVE_PERCENT } from '../constants';
import type {
  PowerLoadCategory,
  SolarArrayConfig,
  RadioisotopeSourceConfig,
  PowerBudgetInput,
  PowerBudgetResult,
  PowerBudgetStatus,
} from '../types';


export const POWER_LOAD_CATEGORIES: readonly PowerLoadCategory[] = [
  'bus',
  'communication',
  'instruments',
  'thermal',
  'dataHandling',
  'propulsion',
  'lander',
  'rover',
  'other',
] as const;

/**
 * Validates an efficiency or degradation factor in the unit interval [0, 1].
 * @throws RangeError if factor is outside [0, 1] or not finite.
 */
export function validateEfficiencyFactor(factor: number, label: string): number {
  if (typeof factor !== 'number' || !Number.isFinite(factor)) {
    throw new TypeError(`validateEfficiencyFactor: ${label} must be a finite number. Received: ${factor}`);
  }
  if (factor < 0 || factor > 1) {
    throw new RangeError(
      `validateEfficiencyFactor: ${label} must be within the physically valid range [0.0, 1.0]. Received: ${factor}`
    );
  }
  return factor;
}

/**
 * Calculates solar array electrical power generation using inverse-square distance scaling:
 * P(r) = P(1 AU) * (1 / r)^2 * eta_degradation * eta_pointing * eta_operational
 *
 * @param config SolarArrayConfig defining 1 AU output, distance in AU, and efficiency factors.
 * @returns Generated electrical power in Watts (W)
 */
export function calculateSolarArrayGeneration(config: SolarArrayConfig): number {
  if (config.ratedPower1AuWatts === undefined || !Number.isFinite(config.ratedPower1AuWatts)) {
    throw new TypeError(
      'calculateSolarArrayGeneration: Solar array rated electrical output at 1 AU (Watts) is undefined or non-finite.'
    );
  }
  if (config.ratedPower1AuWatts < 0) {
    throw new RangeError(
      `calculateSolarArrayGeneration: Solar array rated output cannot be negative. Received: ${config.ratedPower1AuWatts} W`
    );
  }

  const distanceAu = config.distanceAu ?? 1.0;
  if (!Number.isFinite(distanceAu) || distanceAu <= 0) {
    throw new RangeError(
      `calculateSolarArrayGeneration: Heliocentric distance r must be positive. Received: ${distanceAu} AU`
    );
  }

  const degradation = validateEfficiencyFactor(config.degradationFactor ?? 1.0, 'Solar Degradation Factor');
  const pointing = validateEfficiencyFactor(config.pointingEfficiency ?? 1.0, 'Solar Pointing Efficiency');
  const operational = validateEfficiencyFactor(config.operationalEfficiency ?? 1.0, 'Solar Operational Efficiency');

  // Inverse square irradiance scaling: (1 AU / r)^2
  const distanceFactor = Math.pow(1.0 / distanceAu, 2);

  return config.ratedPower1AuWatts * distanceFactor * degradation * pointing * operational;
}

/**
 * Calculates radioisotope power source electrical output:
 * P = P_rated * eta_degradation
 *
 * @param config RadioisotopeSourceConfig
 * @returns Generated electrical power in Watts (W)
 */
export function calculateRadioisotopeGeneration(config: RadioisotopeSourceConfig): number {
  if (config.ratedPowerWatts === undefined || !Number.isFinite(config.ratedPowerWatts)) {
    throw new TypeError(
      'calculateRadioisotopeGeneration: Radioisotope power source rated output (Watts) is undefined or non-finite.'
    );
  }
  if (config.ratedPowerWatts < 0) {
    throw new RangeError(
      `calculateRadioisotopeGeneration: Radioisotope rated power cannot be negative. Received: ${config.ratedPowerWatts} W`
    );
  }

  const degradation = validateEfficiencyFactor(config.degradationFactor ?? 1.0, 'Radioisotope Degradation Factor');
  return config.ratedPowerWatts * degradation;
}

/**
 * Creates an empty zero-initialized power load record
 */
export function createEmptyLoadBreakdown(): Record<PowerLoadCategory, number> {
  return {
    bus: 0,
    communication: 0,
    instruments: 0,
    thermal: 0,
    dataHandling: 0,
    propulsion: 0,
    lander: 0,
    rover: 0,
    other: 0,
  };
}

/**
 * Computes the complete spacecraft electrical power budget.
 *
 * Accounting:
 * - Net Power = Total Generation - Total Consumption
 * - Power Margin = Net Power (W)
 * - Power Reserve % = (Net Power / Total Consumption) * 100
 * - Power Deficit = max(0, Total Consumption - Total Generation)
 *
 * @param input PowerBudgetInput
 * @returns PowerBudgetResult
 */
export function calculatePowerBudget(input: PowerBudgetInput): PowerBudgetResult {
  const missingData: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const loadBreakdown = createEmptyLoadBreakdown();

  let totalGenerationWatts = 0;
  let isGenerationKnown = true;
  let isConsumptionKnown = true;
  let isPropulsionFeasible = true;

  // 1. Process Power Sources
  if (!input.sources || input.sources.length === 0) {
    isGenerationKnown = false;
    missingData.push('No power generation sources are configured for the spacecraft.');
  } else {
    for (const source of input.sources) {
      if (source.type === 'solar') {
        const solar = source as SolarArrayConfig;
        if (solar.ratedPower1AuWatts === undefined || !Number.isFinite(solar.ratedPower1AuWatts)) {
          isGenerationKnown = false;
          missingData.push(`Solar array '${solar.name || 'Solar Array'}' lacks verified 1 AU power rating.`);
          continue;
        }
        try {
          const distanceAu = solar.distanceAu ?? input.distanceAu ?? 1.0;
          const power = calculateSolarArrayGeneration({ ...solar, distanceAu });
          totalGenerationWatts += power;
        } catch (err) {
          isGenerationKnown = false;
          errors.push(err instanceof Error ? err.message : String(err));
        }
      } else if (source.type === 'radioisotope') {
        const rtg = source as RadioisotopeSourceConfig;
        if (rtg.ratedPowerWatts === undefined || !Number.isFinite(rtg.ratedPowerWatts)) {
          isGenerationKnown = false;
          missingData.push(
            `Radioisotope source '${rtg.name || 'RTG'}' lacks verified electrical output rating. Output must be explicitly specified.`
          );
          continue;
        }
        try {
          const power = calculateRadioisotopeGeneration(rtg);
          totalGenerationWatts += power;
        } catch (err) {
          isGenerationKnown = false;
          errors.push(err instanceof Error ? err.message : String(err));
        }
      } else if (source.type === 'other') {
        if (source.ratedPowerWatts === undefined || !Number.isFinite(source.ratedPowerWatts)) {
          isGenerationKnown = false;
          missingData.push(`Power source '${source.name || 'Other'}' lacks verified electrical output rating.`);
          continue;
        }
        if (source.ratedPowerWatts < 0) {
          throw new RangeError(
            `calculatePowerBudget: Power source output cannot be negative. Received: ${source.ratedPowerWatts} W`
          );
        }
        totalGenerationWatts += source.ratedPowerWatts;
      }
    }
  }

  // 2. Process Electrical Loads
  let totalConsumptionWatts = 0;
  if (!input.loads || input.loads.length === 0) {
    warnings.push('No electrical loads are defined; total consumption is 0 W.');
  } else {
    for (const load of input.loads) {
      if (!POWER_LOAD_CATEGORIES.includes(load.category)) {
        throw new TypeError(`calculatePowerBudget: Unknown load category '${load.category}'`);
      }
      if (load.isSpecified === false || load.powerWatts === undefined || !Number.isFinite(load.powerWatts)) {
        isConsumptionKnown = false;
        missingData.push(`Electrical load for '${load.name || load.category}' is unspecified or unverified.`);
        continue;
      }
      if (load.powerWatts < 0) {
        throw new RangeError(
          `calculatePowerBudget: Electrical consumption for '${load.name || load.category}' cannot be negative. Received: ${load.powerWatts} W`
        );
      }
      loadBreakdown[load.category] += load.powerWatts;
      totalConsumptionWatts += load.powerWatts;
    }
  }

  // 3. Electric Propulsion Feasibility
  if (input.isElectricPropulsion) {
    const propPower = input.propulsionElectricalInputPowerWatts;
    if (propPower === undefined || !Number.isFinite(propPower) || propPower <= 0) {
      isPropulsionFeasible = false;
      missingData.push(
        'Electric propulsion thruster is configured, but verified electrical input power (Watts) is missing. Electric thrusters cannot be evaluated from specific impulse (Isp) alone.'
      );
    } else {
      // If electric propulsion load is not already in loads, ensure it is tracked or checked
      if (loadBreakdown.propulsion === 0) {
        loadBreakdown.propulsion = propPower;
        totalConsumptionWatts += propPower;
      }
    }
  }

  // 4. Compute Margins and Deficits
  const netPowerWatts = totalGenerationWatts - totalConsumptionWatts;
  const powerMarginWatts = netPowerWatts;
  const powerDeficitWatts = Math.max(0, totalConsumptionWatts - totalGenerationWatts);

  // Power reserve percentage relative to total demand
  const powerReservePercent =
    totalConsumptionWatts > 0 ? (netPowerWatts / totalConsumptionWatts) * 100 : totalGenerationWatts > 0 ? 100.0 : 0.0;

  const reserveThresholdPercent = input.reserveThresholdPercent ?? DEFAULT_POWER_RESERVE_PERCENT;

  // 5. Determine Subsystem Status
  let status: PowerBudgetStatus = 'NOMINAL';

  if (!isGenerationKnown || !isConsumptionKnown || !isPropulsionFeasible) {
    status = 'INCOMPLETE';
  } else if (netPowerWatts < 0) {
    status = 'DEFICIT';
    errors.push(
      `Electrical power deficit: Spacecraft consumption (${totalConsumptionWatts.toFixed(1)} W) exceeds generation (${totalGenerationWatts.toFixed(1)} W) by ${powerDeficitWatts.toFixed(1)} W.`
    );
  } else if (powerReservePercent < reserveThresholdPercent) {
    status = 'WARNING';
    warnings.push(
      `Power reserve (${powerReservePercent.toFixed(1)}%, ${powerMarginWatts.toFixed(1)} W) is below the configured margin threshold of ${reserveThresholdPercent}%. (Note: Configured game margin threshold; not an official NASA standard).`
    );
  }

  return {
    totalGenerationWatts,
    totalConsumptionWatts,
    netPowerWatts,
    powerMarginWatts,
    powerReservePercent,
    powerDeficitWatts,
    reserveThresholdPercent,
    loadBreakdownWatts: loadBreakdown,
    status,
    isGenerationKnown,
    isConsumptionKnown,
    isPropulsionFeasible,
    missingData,
    warnings,
    errors,
  };
}
