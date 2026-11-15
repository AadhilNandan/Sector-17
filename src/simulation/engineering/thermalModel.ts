/**
 * SECTOR 17 — Single-Node Spacecraft Thermal Equilibrium Model
 * Computes solar flux absorption, internal heat dissipation, Stefan-Boltzmann radiation,
 * and iterative equilibrium surface temperature.
 *
 * MODEL ASSUMPTIONS & LIMITATIONS:
 * 1. Single Lumped-Node Approximation: Assumes the entire spacecraft is an isothermal body
 *    with uniform surface temperature. Real spacecraft thermal control requires detailed
 *    multi-node finite element / finite difference networks (e.g. Thermal Desktop, SINDA/FLUINT)
 *    accounting for multi-layer insulation (MLI), thermal louvers, loop heat pipes, and
 *    internal conductive/radiative conduction between electronic boxes.
 * 2. Internal Dissipation: Assumes electrical power consumed by electronic avionics and
 *    payload is converted into thermal waste heat inside the single lumped node.
 * 3. Solar Irradiance: Scaled by inverse-square law S(r) = S_0 * (1/r)^2, where S_0 = 1361 W/m².
 * 4. Deep-Space Sink: Radiates to cosmic background temperature T_space (2.7255 K) or configured sink.
 *
 * All functions operate in standard SI units (Kelvin, Watts, metres, W/m²).
 */

import {
  STEFAN_BOLTZMANN_CONSTANT,
  SOLAR_CONSTANT_1AU,
  DEEP_SPACE_TEMPERATURE_KELVIN,
  CELSIUS_KELVIN_OFFSET,
  DEFAULT_MIN_OPERATING_TEMP_KELVIN,
  DEFAULT_MAX_OPERATING_TEMP_KELVIN,
} from '../constants';
import type {
  ThermalModelInput,
  ThermalModelResult,
  ThermalStatus,
} from '../types';


/**
 * Calculates solar irradiance (flux) at a given heliocentric distance in AU:
 * S(r) = S_0 * (1 / r)^2
 *
 * @param distanceAu Heliocentric distance in AU (r > 0)
 * @returns Solar irradiance in W/m²
 */
export function calculateSolarFlux(distanceAu: number): number {
  if (typeof distanceAu !== 'number' || !Number.isFinite(distanceAu) || distanceAu <= 0) {
    throw new RangeError(
      `calculateSolarFlux: Heliocentric distance must be a positive finite number. Received: ${distanceAu} AU`
    );
  }
  return SOLAR_CONSTANT_1AU / (distanceAu * distanceAu);
}

/**
 * Calculates Stefan-Boltzmann thermal radiation power into deep space:
 * P_rad = epsilon * sigma * A * (T^4 - T_space^4)
 *
 * @param surfaceEmissivity Infrared emissivity epsilon (0 < epsilon <= 1)
 * @param radiatingAreaM2 Effective radiating area in m² (A > 0)
 * @param temperatureKelvin Surface temperature in Kelvin (T > 0)
 * @param spaceTemperatureKelvin Deep-space background sink in Kelvin (T_space >= 0)
 * @returns Radiated thermal power in Watts (W)
 */
export function calculateRadiatedPower(
  surfaceEmissivity: number,
  radiatingAreaM2: number,
  temperatureKelvin: number,
  spaceTemperatureKelvin: number = DEEP_SPACE_TEMPERATURE_KELVIN
): number {
  if (
    !Number.isFinite(surfaceEmissivity) ||
    surfaceEmissivity <= 0 ||
    surfaceEmissivity > 1.0
  ) {
    throw new RangeError(
      `calculateRadiatedPower: Emissivity must be in the range (0.0, 1.0]. Received: ${surfaceEmissivity}`
    );
  }
  if (!Number.isFinite(radiatingAreaM2) || radiatingAreaM2 <= 0) {
    throw new RangeError(
      `calculateRadiatedPower: Radiating area must be positive. Received: ${radiatingAreaM2} m²`
    );
  }
  if (!Number.isFinite(temperatureKelvin) || temperatureKelvin <= 0) {
    throw new RangeError(
      `calculateRadiatedPower: Temperature must be positive Kelvin. Received: ${temperatureKelvin} K`
    );
  }
  if (!Number.isFinite(spaceTemperatureKelvin) || spaceTemperatureKelvin < 0) {
    throw new RangeError(
      `calculateRadiatedPower: Space background temperature cannot be negative. Received: ${spaceTemperatureKelvin} K`
    );
  }

  const t4 = Math.pow(temperatureKelvin, 4);
  const tSpace4 = Math.pow(spaceTemperatureKelvin, 4);

  return surfaceEmissivity * STEFAN_BOLTZMANN_CONSTANT * radiatingAreaM2 * (t4 - tSpace4);
}

/**
 * Solves for the equilibrium temperature of a single-node spacecraft
 * using the Newton-Raphson iterative method with analytical verification.
 *
 * Objective Function:
 * f(T) = epsilon * sigma * A_rad * (T^4 - T_space^4) - (P_solar + Q_internal) = 0
 * Derivative:
 * f'(T) = 4 * epsilon * sigma * A_rad * T^3
 *
 * @param input ThermalModelInput
 * @returns ThermalModelResult
 */
export function calculateThermalEquilibrium(input: ThermalModelInput): ThermalModelResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Input Validation
  const {
    solarAbsorptivity,
    projectedAreaM2,
    surfaceEmissivity,
    radiatingAreaM2,
    distanceAu,
    internalHeatDissipationWatts = 0,
    spaceTemperatureKelvin = DEEP_SPACE_TEMPERATURE_KELVIN,
    minOperatingTempKelvin = DEFAULT_MIN_OPERATING_TEMP_KELVIN,
    maxOperatingTempKelvin = DEFAULT_MAX_OPERATING_TEMP_KELVIN,
    solverOptions = {},
  } = input;

  if (
    !Number.isFinite(solarAbsorptivity) ||
    solarAbsorptivity <= 0 ||
    solarAbsorptivity > 1.0
  ) {
    throw new RangeError(
      `calculateThermalEquilibrium: Solar absorptivity must be in range (0.0, 1.0]. Received: ${solarAbsorptivity}`
    );
  }
  if (!Number.isFinite(projectedAreaM2) || projectedAreaM2 <= 0) {
    throw new RangeError(
      `calculateThermalEquilibrium: Projected area must be positive. Received: ${projectedAreaM2} m²`
    );
  }
  if (
    !Number.isFinite(surfaceEmissivity) ||
    surfaceEmissivity <= 0 ||
    surfaceEmissivity > 1.0
  ) {
    throw new RangeError(
      `calculateThermalEquilibrium: Surface emissivity must be in range (0.0, 1.0]. Received: ${surfaceEmissivity}`
    );
  }
  if (!Number.isFinite(radiatingAreaM2) || radiatingAreaM2 <= 0) {
    throw new RangeError(
      `calculateThermalEquilibrium: Radiating area must be positive. Received: ${radiatingAreaM2} m²`
    );
  }
  if (!Number.isFinite(distanceAu) || distanceAu <= 0) {
    throw new RangeError(
      `calculateThermalEquilibrium: Distance must be a positive number in AU. Received: ${distanceAu}`
    );
  }
  if (!Number.isFinite(internalHeatDissipationWatts) || internalHeatDissipationWatts < 0) {
    throw new RangeError(
      `calculateThermalEquilibrium: Internal heat dissipation cannot be negative. Received: ${internalHeatDissipationWatts} W`
    );
  }
  if (!Number.isFinite(spaceTemperatureKelvin) || spaceTemperatureKelvin < 0) {
    throw new RangeError(
      `calculateThermalEquilibrium: Space temperature cannot be negative. Received: ${spaceTemperatureKelvin} K`
    );
  }

  // 2. Solar Absorption & Heat Inputs
  const solarFluxWattsPerM2 = calculateSolarFlux(distanceAu);
  const solarAbsorbedPowerWatts = solarAbsorptivity * projectedAreaM2 * solarFluxWattsPerM2;
  const totalThermalInWatts = solarAbsorbedPowerWatts + internalHeatDissipationWatts;

  // 3. Newton-Raphson Iterative Solver
  const initialGuess = solverOptions.initialGuessKelvin ?? 300.0;
  const tolerance = solverOptions.toleranceKelvin ?? 1e-5;
  const maxIterations = solverOptions.maxIterations ?? 100;

  if (initialGuess <= 0) {
    throw new RangeError(
      `calculateThermalEquilibrium: Initial temperature guess must be positive. Received: ${initialGuess} K`
    );
  }

  const coeff = surfaceEmissivity * STEFAN_BOLTZMANN_CONSTANT * radiatingAreaM2;
  const tSpace4 = Math.pow(spaceTemperatureKelvin, 4);

  let tCurrent = initialGuess;
  let iterations = 0;
  let converged = false;

  while (iterations < maxIterations) {
    iterations++;
    const t4 = Math.pow(tCurrent, 4);
    const fVal = coeff * (t4 - tSpace4) - totalThermalInWatts;
    const fPrime = 4 * coeff * Math.pow(tCurrent, 3);

    if (fPrime === 0) {
      break;
    }

    const tNext = tCurrent - fVal / fPrime;
    if (Math.abs(tNext - tCurrent) < tolerance) {
      tCurrent = tNext;
      converged = true;
      break;
    }
    tCurrent = tNext;
  }

  // Fallback to analytical solution if solver somehow failed or exceeded iterations
  // Analytical exact equation: T = (T_space^4 + P_in / (epsilon * sigma * A))^(1/4)
  const analyticalT = Math.pow(tSpace4 + totalThermalInWatts / coeff, 0.25);

  if (!converged) {
    errors.push(
      `Numerical Newton-Raphson solver failed to converge within ${maxIterations} iterations (tolerance: ${tolerance} K). Using analytical solution.`
    );
    tCurrent = analyticalT;
  }

  const equilibriumTemperatureKelvin = tCurrent;
  const equilibriumTemperatureCelsius = equilibriumTemperatureKelvin - CELSIUS_KELVIN_OFFSET;
  const radiatedPowerWatts = calculateRadiatedPower(
    surfaceEmissivity,
    radiatingAreaM2,
    equilibriumTemperatureKelvin,
    spaceTemperatureKelvin
  );

  // 4. Operating Limits Check
  let status: ThermalStatus = 'NOMINAL';
  const isWithinOperatingLimits =
    equilibriumTemperatureKelvin >= minOperatingTempKelvin &&
    equilibriumTemperatureKelvin <= maxOperatingTempKelvin;

  if (!converged) {
    status = 'NON_CONVERGENT';
  } else if (equilibriumTemperatureKelvin > maxOperatingTempKelvin) {
    status = 'OVERHEATING';
    errors.push(
      `Spacecraft equilibrium temperature (${equilibriumTemperatureCelsius.toFixed(1)}°C / ${equilibriumTemperatureKelvin.toFixed(1)} K) exceeds maximum operating limit (${(maxOperatingTempKelvin - CELSIUS_KELVIN_OFFSET).toFixed(1)}°C / ${maxOperatingTempKelvin.toFixed(1)} K). Active thermal dissipation required.`
    );
  } else if (equilibriumTemperatureKelvin < minOperatingTempKelvin) {
    status = 'UNDERCOOLING';
    errors.push(
      `Spacecraft equilibrium temperature (${equilibriumTemperatureCelsius.toFixed(1)}°C / ${equilibriumTemperatureKelvin.toFixed(1)} K) falls below minimum operating limit (${(minOperatingTempKelvin - CELSIUS_KELVIN_OFFSET).toFixed(1)}°C / ${minOperatingTempKelvin.toFixed(1)} K). Supplemental survival heating required.`
    );
  } else {
    status = 'NOMINAL';
  }

  return {
    solarFluxWattsPerM2,
    solarAbsorbedPowerWatts,
    internalHeatWatts: internalHeatDissipationWatts,
    totalThermalInWatts,
    radiatedPowerWatts,
    equilibriumTemperatureKelvin,
    equilibriumTemperatureCelsius,
    iterations,
    converged,
    status,
    isWithinOperatingLimits,
    minOperatingTempKelvin,
    maxOperatingTempKelvin,
    warnings,
    errors,
  };
}
