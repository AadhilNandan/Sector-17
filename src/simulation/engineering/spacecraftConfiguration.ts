/**
 * SECTOR 17 — Spacecraft Configuration & Engineering Validation Bridge
 * Authoritative integration connecting workshop component loadouts,
 * launch vehicle margins, mass/power/thermal models, and component compatibility.
 *
 * ENGINEERING ASSUMPTIONS & MODEL LABELS:
 * - [VERIFIED]: Standard physics equations (Tsiolkovsky rocket equation, inverse-square solar irradiance).
 * - [SIMPLIFIED]: Static nominal heliocentric distance (5.204 AU at Jupiter/Europa, 1.0 AU at Earth),
 *   static thermal balance approximations, and lumped thermal radiator areas.
 * - [GAMEPLAY_ABSTRACTION]: 25.0 kg fixed terminal countdown propellant expenditure before active staging.
 */

import type {
  ComponentCategory,
  SpacecraftPart,
  LaunchVehicle,
  SpacecraftConfig,
} from '../../types/game';
import {
  COMPONENT_CATALOG,
  LAUNCH_VEHICLES,
} from '../../data/missionsAndComponents';
import { validateSpacecraft } from './spacecraftValidator';
import { calculatePowerBudget } from './powerBudget';
import { calculateDeltaV } from '../physics/rocketEquation';
import type {
  SpacecraftValidationInput,
  SpacecraftValidationReport,
  MassItem,
  PowerSourceInput,
  PowerLoadItem,
} from '../types';

/** [SIMPLIFIED] Nominal orbital distance of Europa / Jupiter system from the Sun (~5.204 AU) */
export const NOMINAL_EUROPA_DISTANCE_AU = 5.204;

/** [VERIFIED] Mean orbital distance of Earth from the Sun (1.0 AU) */
export const EARTH_ORBIT_DISTANCE_AU = 1.0;

/** [GAMEPLAY_ABSTRACTION] Fixed pre-launch checkout and terminal ascent propellant consumption (kg) */
export const LAUNCH_ASCENT_PROP_EXPENDITURE_KG = 25.0;

export const REQUIRED_COMPONENT_CATEGORIES: readonly ComponentCategory[] = [
  'structure',
  'propulsion',
  'power',
  'instruments',
  'communication',
  'thermal',
] as const;

export interface SpacecraftMetrics {
  totalDryMassKg: number;
  propellantCapacityKg: number;
  totalWetMassKg: number;
  launchVehicleMaxPayloadKg: number;
  massMarginKg: number;
  massMarginPercent: number;
  totalPowerGenerationWatts: number;
  totalPowerConsumptionWatts: number;
  netPowerWatts: number;
  powerReservePercent: number;
  powerReserveThresholdPercent?: number;
  powerReserveShortfallWatts?: number;
  budgetUsedPercent: number;
  isWithinBudget: boolean;
  isWithinPayloadCapacity: boolean;
  deltaVMps: number;
  equilibriumTempCelsius?: number;
  incompatibilities: string[];
}

/**
 * Returns default AETHON spacecraft configuration matching Expedition-V specifications.
 */
export function getDefaultSpacecraftConfig(): SpacecraftConfig {
  return {
    name: 'EXPEDITION-V AETHON',
    parts: {
      structure: COMPONENT_CATALOG.structure[0], // Carbon Hex Truss (680 kg, 12%)
      propulsion: COMPONENT_CATALOG.propulsion[0], // NEXT-C Xenon Ion (420 kg, 15%)
      power: COMPONENT_CATALOG.power[0], // Triple-Junction Solar (380 kg, 11%)
      instruments: COMPONENT_CATALOG.instruments[0], // REASON Radar (310 kg, 14%)
      communication: COMPONENT_CATALOG.communication[0], // Ka Dish (290 kg, 10%)
      thermal: COMPONENT_CATALOG.thermal[0], // Heat Pipes (260 kg, 6%)
    },
    launchVehicle: LAUNCH_VEHICLES[0], // Atlas V 551 (3,800 kg max, 28%)
  };
}

/**
 * Derives propellant capacity and exhaust velocity from selected propulsion part.
 */
export function getPropulsionSpecs(propPart?: SpacecraftPart): {
  propellantCapacityKg: number;
  effectiveExhaustVelocityMps: number;
  ispSeconds: number;
  propellantType: string;
} {
  if (!propPart) {
    return { propellantCapacityKg: 0, effectiveExhaustVelocityMps: 0, ispSeconds: 0, propellantType: 'NONE' };
  }

  switch (propPart.id) {
    case 'prop-ion-gridded': // NEXT-C Xenon Ion (Isp 4,190 s)
      return {
        propellantCapacityKg: 450.0,
        effectiveExhaustVelocityMps: 4190.0 * 9.80665, // ~41,090 m/s
        ispSeconds: 4190.0,
        propellantType: 'Xenon Gas',
      };
    case 'prop-biprop-chem': // Hypergolic Bi-Propellant (Isp 325 s)
      return {
        propellantCapacityKg: 2450.0,
        effectiveExhaustVelocityMps: 325.0 * 9.80665, // ~3,187 m/s
        ispSeconds: 325.0,
        propellantType: 'N2O4 / MMH',
      };
    case 'prop-nuclear-thermal': // Micro-NTP Fission (Isp 910 s)
      return {
        propellantCapacityKg: 1800.0,
        effectiveExhaustVelocityMps: 910.0 * 9.80665, // ~8,924 m/s
        ispSeconds: 910.0,
        propellantType: 'LH2 Cryo',
      };
    default: {
      // Fallback parser from specs if available
      const ispStr = String(propPart.specs?.['Isp'] ?? '300 s').replace(/[^0-9.]/g, '');
      const isp = parseFloat(ispStr) || 300.0;
      return {
        propellantCapacityKg: 1000.0,
        effectiveExhaustVelocityMps: isp * 9.80665,
        ispSeconds: isp,
        propellantType: String(propPart.specs?.['Propellant'] ?? 'Propellant'),
      };
    }
  }
}

/**
 * Validates that component numbers are strictly positive, non-negative, and within physical bounds.
 */
export function validatePartNumericalValues(part: SpacecraftPart): void {
  if (typeof part.massKg !== 'number' || !Number.isFinite(part.massKg) || part.massKg <= 0) {
    throw new RangeError(
      `validatePartNumericalValues: Part '${part.name}' (${part.id}) has invalid mass: ${part.massKg} kg. Must be a finite positive number.`
    );
  }
  if (typeof part.powerKw !== 'number' || !Number.isFinite(part.powerKw)) {
    throw new TypeError(
      `validatePartNumericalValues: Part '${part.name}' (${part.id}) has non-finite power value: ${part.powerKw} kW.`
    );
  }
  if (typeof part.costBudgetPercent !== 'number' || !Number.isFinite(part.costBudgetPercent) || part.costBudgetPercent < 0) {
    throw new RangeError(
      `validatePartNumericalValues: Part '${part.name}' (${part.id}) has invalid budget percent: ${part.costBudgetPercent}%.`
    );
  }
}

/**
 * Checks for hardware incompatibilities, over-budget scenarios, and payload limits.
 */
export function checkComponentIncompatibilities(
  parts: Record<ComponentCategory, SpacecraftPart>,
  launchVehicle: LaunchVehicle
): string[] {
  const issues: string[] = [];

  // 1. Missing mandatory categories
  for (const cat of REQUIRED_COMPONENT_CATEGORIES) {
    if (!parts[cat]) {
      issues.push(`Missing mandatory subsystem component: ${cat.toUpperCase()}`);
    }
  }

  // 2. Budget violation
  const totalCost =
    Object.values(parts).reduce((sum, p) => sum + (p?.costBudgetPercent ?? 0), 0) +
    launchVehicle.costPercent;
  if (totalCost > 100) {
    issues.push(`Total mission budget exceeded: ${totalCost.toFixed(1)}% / 100.0% max budget.`);
  }

  // 3. Payload mass limit
  const dryMass = Object.values(parts).reduce((sum, p) => sum + (p?.massKg ?? 0), 0);
  const { propellantCapacityKg } = getPropulsionSpecs(parts.propulsion);
  const wetMass = dryMass + propellantCapacityKg;

  if (wetMass > launchVehicle.maxPayloadKg) {
    issues.push(
      `Total spacecraft wet mass (${wetMass.toFixed(0)} kg) exceeds ${launchVehicle.name} payload capacity to TJI (${launchVehicle.maxPayloadKg} kg).`
    );
  }

  return issues;
}

/**
 * Constructs SpacecraftValidationInput for the authoritative engineering validator.
 */
export function buildSpacecraftValidationInput(
  parts: Record<ComponentCategory, SpacecraftPart>,
  launchVehicle: LaunchVehicle,
  distanceAu: number = NOMINAL_EUROPA_DISTANCE_AU
): SpacecraftValidationInput {
  // Validate individual parts
  for (const cat of REQUIRED_COMPONENT_CATEGORIES) {
    if (parts[cat]) {
      validatePartNumericalValues(parts[cat]);
    }
  }

  const { propellantCapacityKg } = getPropulsionSpecs(parts.propulsion);

  // 1. Mass Budget Input
  const massItems: MassItem[] = [
    {
      id: parts.structure?.id ?? 'struct-missing',
      name: parts.structure?.name ?? 'Structure',
      category: 'bus',
      massKg: parts.structure?.massKg ?? 0,
    },
    {
      id: parts.propulsion?.id ?? 'prop-missing',
      name: parts.propulsion?.name ?? 'Propulsion Dry',
      category: 'propulsionDry',
      massKg: parts.propulsion?.massKg ?? 0,
    },
    {
      id: parts.power?.id ?? 'power-missing',
      name: parts.power?.name ?? 'Power',
      category: 'power',
      massKg: parts.power?.massKg ?? 0,
    },
    {
      id: parts.instruments?.id ?? 'inst-missing',
      name: parts.instruments?.name ?? 'Instruments',
      category: 'instruments',
      massKg: parts.instruments?.massKg ?? 0,
    },
    {
      id: parts.communication?.id ?? 'comm-missing',
      name: parts.communication?.name ?? 'Communication',
      category: 'communication',
      massKg: parts.communication?.massKg ?? 0,
    },
    {
      id: parts.thermal?.id ?? 'thermal-missing',
      name: parts.thermal?.name ?? 'Thermal',
      category: 'thermal',
      massKg: parts.thermal?.massKg ?? 0,
    },
  ];

  if (propellantCapacityKg > 0) {
    massItems.push({
      id: 'propellant-mass',
      name: 'Propellant Mass',
      category: 'propellant',
      massKg: propellantCapacityKg,
    });
  }

  // 2. Power Budget Input
  const powerSources: PowerSourceInput[] = [];
  const powerPart = parts.power;
  if (powerPart) {
    if (powerPart.id === 'power-solar-wings') {
      // Dual deployable ultra-flex wings rated at 3.8 kW at 5 AU yield 95 kW at 1 AU under inverse-square law
      const ratedPower1AuWatts = Math.abs(powerPart.powerKw) * 1000.0 * 25.0; // 95,000 W
      powerSources.push({
        type: 'solar',
        ratedPower1AuWatts,
        distanceAu,
      });
    } else if (powerPart.id === 'power-rtg-plutonium') {
      powerSources.push({
        type: 'radioisotope',
        ratedPowerWatts: Math.abs(powerPart.powerKw) * 1000.0, // 2,600 W (distance-independent)
      });
    } else {
      const ratedPower1AuWatts = Math.abs(powerPart.powerKw || 1.0) * 1000.0 * 25.0;
      powerSources.push({
        type: 'solar',
        ratedPower1AuWatts,
        distanceAu,
      });
    }
  }

  const powerLoads: PowerLoadItem[] = [
    {
      id: 'load-bus',
      name: 'Avionics & Bus',
      category: 'bus',
      powerWatts: Math.max(50, (parts.structure?.powerKw ?? 0.1) * 1000.0),
    },
    {
      id: 'load-prop',
      name: 'Propulsion Thruster',
      category: 'propulsion',
      powerWatts: Math.max(50, (parts.propulsion?.powerKw ?? 0.4) * 1000.0),
    },
    {
      id: 'load-inst',
      name: 'Science Instruments',
      category: 'instruments',
      powerWatts: Math.max(50, (parts.instruments?.powerKw ?? 0.8) * 1000.0),
    },
    {
      id: 'load-comm',
      name: 'Communication Transmitter',
      category: 'communication',
      powerWatts: Math.max(50, (parts.communication?.powerKw ?? 0.5) * 1000.0),
    },
    {
      id: 'load-thermal',
      name: 'Thermal Heaters & Pumps',
      category: 'thermal',
      powerWatts: Math.max(50, (parts.thermal?.powerKw ?? 0.2) * 1000.0),
    },
  ];

  // 3. Thermal Model Input
  const totalDissipationWatts = powerLoads.reduce((sum, l) => sum + (l.powerWatts ?? 0), 0);
  const isRadiator = parts.thermal?.id === 'thermal-heat-pipes';
  const radiatingAreaM2 = isRadiator ? 10.5 : 5.5;

  // 4. Missing specifications check
  const missingSpecs: string[] = [];
  for (const cat of REQUIRED_COMPONENT_CATEGORIES) {
    if (!parts[cat]) {
      missingSpecs.push(`Subsystem [${cat.toUpperCase()}] is unassigned.`);
    }
  }

  return {
    massBudget: {
      items: massItems,
      launchMassLimitKg: launchVehicle.maxPayloadKg,
    },
    powerBudget: {
      sources: powerSources,
      loads: powerLoads,
      distanceAu,
      reserveThresholdPercent: 15,
    },
    thermalModel: {
      solarAbsorptivity: 0.20,
      surfaceEmissivity: 0.85,
      radiatingAreaM2,
      projectedAreaM2: 6.0,
      internalHeatDissipationWatts: totalDissipationWatts,
      distanceAu,
      minOperatingTempKelvin: 233.15, // -40°C
      maxOperatingTempKelvin: 333.15, // +60°C
    },
    componentCompleteness: {
      missingComponentSpecs: missingSpecs,
    },
  };
}

/**
 * Runs the authoritative engineering validator against a spacecraft configuration.
 * Uses nominal mission operating distance (default: 5.204 AU for Europa / Jupiter).
 */
export function evaluateSpacecraftConfiguration(
  configOrParts: SpacecraftConfig | Record<ComponentCategory, SpacecraftPart>,
  maybeVehicle?: LaunchVehicle,
  distanceAu: number = NOMINAL_EUROPA_DISTANCE_AU
): SpacecraftValidationReport {
  let parts: Record<ComponentCategory, SpacecraftPart>;
  let launchVehicle: LaunchVehicle;

  if ('parts' in configOrParts && 'launchVehicle' in configOrParts) {
    parts = (configOrParts as SpacecraftConfig).parts;
    launchVehicle = (configOrParts as SpacecraftConfig).launchVehicle;
  } else {
    parts = configOrParts as Record<ComponentCategory, SpacecraftPart>;
    launchVehicle = maybeVehicle!;
  }

  const input = buildSpacecraftValidationInput(parts, launchVehicle, distanceAu);
  const report = validateSpacecraft(input);

  // Cross-check financial and launch constraints
  const budgetSum =
    Object.values(parts).reduce((acc, p) => acc + (p?.costBudgetPercent ?? 0), 0) +
    (launchVehicle?.costPercent ?? 0);

  if (budgetSum > 100) {
    const budgetError = `Mission cost budget exceeded: ${budgetSum.toFixed(1)}% of 100.0% allocated funding.`;
    return {
      ...report,
      overallStatus: 'FAIL',
      failures: [...report.failures, budgetError],
      warnings: report.warnings,
      missingData: report.missingData,
    };
  }

  return report;
}

/**
 * Calculates integrated spacecraft metrics for telemetry display.
 * [SIMPLIFIED]: Incorporates inverse-square solar irradiance at target heliocentric distance.
 */
export function calculateSpacecraftMetrics(
  configOrParts: SpacecraftConfig | Record<ComponentCategory, SpacecraftPart>,
  maybeVehicle?: LaunchVehicle,
  distanceAu: number = NOMINAL_EUROPA_DISTANCE_AU
): SpacecraftMetrics {
  let parts: Record<ComponentCategory, SpacecraftPart>;
  let launchVehicle: LaunchVehicle;

  if ('parts' in configOrParts && 'launchVehicle' in configOrParts) {
    parts = (configOrParts as SpacecraftConfig).parts;
    launchVehicle = (configOrParts as SpacecraftConfig).launchVehicle;
  } else {
    parts = configOrParts as Record<ComponentCategory, SpacecraftPart>;
    launchVehicle = maybeVehicle!;
  }

  const dryMass = Object.values(parts).reduce((sum, p) => sum + (p?.massKg ?? 0), 0);
  const { propellantCapacityKg, ispSeconds } = getPropulsionSpecs(parts.propulsion);
  const wetMass = dryMass + propellantCapacityKg;

  const launchLimit = launchVehicle?.maxPayloadKg ?? 0;
  const massMarginKg = launchLimit - wetMass;
  const massMarginPercent = launchLimit > 0 ? (massMarginKg / launchLimit) * 100.0 : 0;

  // Authoritative Power Calculation via calculatePowerBudget
  const validationInput = buildSpacecraftValidationInput(parts, launchVehicle, distanceAu);
  const powerBudgetResult = 'totalGenerationWatts' in validationInput.powerBudget
    ? validationInput.powerBudget
    : calculatePowerBudget(validationInput.powerBudget);

  const generationWatts = powerBudgetResult.totalGenerationWatts;
  const consumptionWatts = powerBudgetResult.totalConsumptionWatts;
  const netPower = powerBudgetResult.netPowerWatts;
  const reservePercent = powerBudgetResult.powerReservePercent;
  const reserveThresholdPercent = powerBudgetResult.reserveThresholdPercent;
  const requiredReserveWatts = consumptionWatts * (reserveThresholdPercent / 100.0);
  const reserveShortfallWatts = Math.max(0, requiredReserveWatts - netPower);

  // Budget
  const budgetPercent =
    Object.values(parts).reduce((sum, p) => sum + (p?.costBudgetPercent ?? 0), 0) +
    launchVehicle.costPercent;

  // Delta-V from Rocket Equation [VERIFIED: Tsiolkovsky rocket equation]
  const deltaVMps = dryMass > 0 && wetMass > 0 && ispSeconds > 0
    ? calculateDeltaV(wetMass, dryMass, ispSeconds)
    : 0;

  // Equilibrium temp approximation [SIMPLIFIED: passive thermal radiator model]
  const isRadiator = parts.thermal?.id === 'thermal-heat-pipes';
  const equilibriumTempCelsius = isRadiator ? 18.5 : -12.0;

  const incompatibilities = checkComponentIncompatibilities(parts, launchVehicle);

  return {
    totalDryMassKg: dryMass,
    propellantCapacityKg,
    totalWetMassKg: wetMass,
    launchVehicleMaxPayloadKg: launchLimit,
    massMarginKg,
    massMarginPercent,
    totalPowerGenerationWatts: generationWatts,
    totalPowerConsumptionWatts: consumptionWatts,
    netPowerWatts: netPower,
    powerReservePercent: reservePercent,
    powerReserveThresholdPercent: reserveThresholdPercent,
    powerReserveShortfallWatts: reserveShortfallWatts,
    budgetUsedPercent: budgetPercent,
    isWithinBudget: budgetPercent <= 100,
    isWithinPayloadCapacity: wetMass <= launchLimit,
    deltaVMps,
    equilibriumTempCelsius,
    incompatibilities,
  };
}
