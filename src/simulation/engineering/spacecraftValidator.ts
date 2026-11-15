/**
 * SECTOR 17 — Spacecraft Engineering Validation Engine
 * Synthesizes mass budget, electrical power budget, thermal equilibrium,
 * and component data completeness into an integrated mission feasibility verdict.
 *
 * Enforces strict aerospace design gates:
 * - PASS: All engineering constraints satisfied, margins nominal, all data complete.
 * - WARNING: Technically feasible but operational concern or low safety margin.
 * - FAIL: Hard physical or configured constraint violated (mass exceeded, power deficit, thermal breach).
 * - INCOMPLETE: Critical engineering data missing. NEVER promoted to PASS.
 *
 * Pure mathematical TypeScript module independent of React/DOM.
 */

import { calculateMassBudget } from './massBudget';
import { calculatePowerBudget } from './powerBudget';
import { calculateThermalEquilibrium } from './thermalModel';
import type {
  EngineeringValidationStatus,
  SubsystemValidationResult,
  SpacecraftValidationInput,
  SpacecraftValidationReport,
  MassBudgetResult,
  PowerBudgetResult,
  ThermalModelResult,
  MassBudgetInput,
  PowerBudgetInput,
  ThermalModelInput,
} from '../types';

/**
 * Type guard to check if an object is already a resolved MassBudgetResult
 */
function isMassBudgetResult(obj: MassBudgetResult | MassBudgetInput): obj is MassBudgetResult {
  return 'totalDryMassKg' in obj && 'categoryBreakdownKg' in obj;
}

/**
 * Type guard to check if an object is already a resolved PowerBudgetResult
 */
function isPowerBudgetResult(obj: PowerBudgetResult | PowerBudgetInput): obj is PowerBudgetResult {
  return 'totalGenerationWatts' in obj && 'loadBreakdownWatts' in obj;
}

/**
 * Type guard to check if an object is already a resolved ThermalModelResult
 */
function isThermalModelResult(obj: ThermalModelResult | ThermalModelInput): obj is ThermalModelResult {
  return 'equilibriumTemperatureKelvin' in obj && 'solarFluxWattsPerM2' in obj;
}

/**
 * Validates a spacecraft configuration by evaluating mass, power, thermal, and completeness.
 *
 * @param input SpacecraftValidationInput containing resolved results or raw engine inputs
 * @returns Comprehensive SpacecraftValidationReport
 */
export function validateSpacecraft(input: SpacecraftValidationInput): SpacecraftValidationReport {
  const allFailures: string[] = [];
  const allWarnings: string[] = [];
  const allMissingData: string[] = [];

  // 1. Evaluate Mass Budget
  const massResult: MassBudgetResult = isMassBudgetResult(input.massBudget)
    ? input.massBudget
    : calculateMassBudget(input.massBudget);

  const massFailures = [...massResult.errors];
  const massWarnings = [...massResult.warnings];
  const massMissing: string[] = [];

  let massStatus: EngineeringValidationStatus = 'PASS';
  if (massResult.status === 'EXCEEDED') {
    massStatus = 'FAIL';
  } else if (massResult.status === 'UNKNOWN') {
    massStatus = 'INCOMPLETE';
    massMissing.push('Launch vehicle mass capacity limit was not provided.');
  } else if (massResult.status === 'WARNING') {
    massStatus = 'WARNING';
  }

  const massSubsystem: SubsystemValidationResult = {
    status: massStatus,
    passed: massStatus === 'PASS' || massStatus === 'WARNING',
    failures: massFailures,
    warnings: massWarnings,
    missingData: massMissing,
  };

  allFailures.push(...massFailures);
  allWarnings.push(...massWarnings);
  allMissingData.push(...massMissing);

  // 2. Evaluate Electrical Power Budget
  const powerResult: PowerBudgetResult = isPowerBudgetResult(input.powerBudget)
    ? input.powerBudget
    : calculatePowerBudget(input.powerBudget);

  const powerFailures = [...powerResult.errors];
  const powerWarnings = [...powerResult.warnings];
  const powerMissing = [...powerResult.missingData];

  let powerStatus: EngineeringValidationStatus = 'PASS';
  if (powerResult.status === 'DEFICIT') {
    powerStatus = 'FAIL';
  } else if (powerResult.status === 'INCOMPLETE') {
    powerStatus = 'INCOMPLETE';
  } else if (powerResult.status === 'WARNING') {
    powerStatus = 'WARNING';
  }

  const powerSubsystem: SubsystemValidationResult = {
    status: powerStatus,
    passed: powerStatus === 'PASS' || powerStatus === 'WARNING',
    failures: powerFailures,
    warnings: powerWarnings,
    missingData: powerMissing,
  };

  allFailures.push(...powerFailures);
  allWarnings.push(...powerWarnings);
  allMissingData.push(...powerMissing);

  // 3. Evaluate Thermal Model (optional or provided)
  let thermalSubsystem: SubsystemValidationResult;
  let resolvedThermal: ThermalModelResult | undefined = undefined;

  if (input.thermalModel) {
    resolvedThermal = isThermalModelResult(input.thermalModel)
      ? input.thermalModel
      : calculateThermalEquilibrium(input.thermalModel);

    const thermalFailures = [...resolvedThermal.errors];
    const thermalWarnings = [...resolvedThermal.warnings];
    const thermalMissing: string[] = [];

    let thermalStatus: EngineeringValidationStatus = 'PASS';
    if (!resolvedThermal.isWithinOperatingLimits || !resolvedThermal.converged) {
      thermalStatus = 'FAIL';
    }

    thermalSubsystem = {
      status: thermalStatus,
      passed: thermalStatus === 'PASS',
      failures: thermalFailures,
      warnings: thermalWarnings,
      missingData: thermalMissing,
    };

    allFailures.push(...thermalFailures);
    allWarnings.push(...thermalWarnings);
  } else {
    // Thermal model not configured
    thermalSubsystem = {
      status: 'INCOMPLETE',
      passed: false,
      failures: [],
      warnings: [],
      missingData: ['Spacecraft thermal model inputs were not provided.'],
    };
    allMissingData.push('Spacecraft thermal model inputs were not provided.');
  }

  // 4. Evaluate Component Data Completeness
  const completenessFailures: string[] = [];
  const completenessWarnings: string[] = [];
  const completenessMissing: string[] = [];

  if (input.componentCompleteness) {
    if (input.componentCompleteness.missingComponentSpecs) {
      for (const spec of input.componentCompleteness.missingComponentSpecs) {
        completenessMissing.push(`Missing component specification: ${spec}`);
      }
    }
    if (input.componentCompleteness.unverifiedComponents) {
      for (const comp of input.componentCompleteness.unverifiedComponents) {
        completenessMissing.push(`Unverified component data: ${comp}`);
      }
    }
  }

  let completenessStatus: EngineeringValidationStatus = 'PASS';
  if (completenessMissing.length > 0) {
    completenessStatus = 'INCOMPLETE';
  }

  const completenessSubsystem: SubsystemValidationResult = {
    status: completenessStatus,
    passed: completenessStatus === 'PASS',
    failures: completenessFailures,
    warnings: completenessWarnings,
    missingData: completenessMissing,
  };

  allMissingData.push(...completenessMissing);

  // 5. Synthesize Overall Verdict
  // Strict hierarchy:
  // 1. FAIL if any subsystem fails
  // 2. INCOMPLETE if any subsystem is incomplete (missing data never becomes PASS)
  // 3. WARNING if any subsystem has warnings
  // 4. PASS only if all subsystems are PASS
  const subsystemStatuses = [
    massSubsystem.status,
    powerSubsystem.status,
    thermalSubsystem.status,
    completenessSubsystem.status,
  ];

  let overallStatus: EngineeringValidationStatus = 'PASS';
  if (subsystemStatuses.includes('FAIL')) {
    overallStatus = 'FAIL';
  } else if (subsystemStatuses.includes('INCOMPLETE')) {
    overallStatus = 'INCOMPLETE';
  } else if (subsystemStatuses.includes('WARNING')) {
    overallStatus = 'WARNING';
  }

  return {
    overallStatus,
    subsystems: {
      mass: massSubsystem,
      power: powerSubsystem,
      thermal: thermalSubsystem,
      completeness: completenessSubsystem,
    },
    failures: allFailures,
    warnings: allWarnings,
    missingData: allMissingData,
    metrics: {
      totalDryMassKg: massResult.totalDryMassKg,
      totalWetMassKg: massResult.totalWetMassKg,
      launchMassLimitKg: massResult.launchMassLimitKg,
      massMarginKg: massResult.massMarginKg,
      massMarginPercent: massResult.massMarginPercent,
      totalPowerGenerationWatts: powerResult.totalGenerationWatts,
      totalPowerConsumptionWatts: powerResult.totalConsumptionWatts,
      netPowerWatts: powerResult.netPowerWatts,
      powerReservePercent: powerResult.powerReservePercent,
      equilibriumTemperatureKelvin: resolvedThermal?.equilibriumTemperatureKelvin,
      equilibriumTemperatureCelsius: resolvedThermal?.equilibriumTemperatureCelsius,
    },
  };
}
