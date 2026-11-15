/**
 * SECTOR 17 — Tsiolkovsky Rocket Equation Engine
 * Pure mathematical functions for rocket propulsion, mass budgets,
 * propellant requirements, and Delta-V calculations.
 *
 * All functions operate in standard SI units (kg, m/s, seconds).
 */

import { G0 } from '../constants';
import type { RocketPerformanceResult } from '../types';

/* ========================================================================== */
/* 1. CORE TSIOLKOVSKY EQUATION FUNCTIONS                                     */
/* ========================================================================== */

/**
 * Calculates effective exhaust velocity from specific impulse:
 * c = Isp * g0
 *
 * @param ispSeconds Specific impulse in seconds (Isp > 0)
 * @returns Effective exhaust velocity in metres per second (m/s)
 * @throws RangeError if Isp <= 0 or not finite
 */
export function calculateEffectiveExhaustVelocity(ispSeconds: number): number {
  if (!Number.isFinite(ispSeconds) || ispSeconds <= 0) {
    throw new RangeError(
      `calculateEffectiveExhaustVelocity: Specific impulse must be positive. Received: ${ispSeconds}`
    );
  }
  return ispSeconds * G0;
}

/**
 * Calculates mass ratio (initial mass / final mass) required to achieve a given Delta-V:
 * R = m0 / mf = exp(DeltaV / (Isp * g0))
 *
 * @param deltaVMps Required velocity change in metres per second (Delta-V >= 0)
 * @param ispSeconds Engine specific impulse in seconds (Isp > 0)
 * @returns Structural mass ratio (m0 / mf >= 1.0)
 * @throws RangeError if deltaV < 0 or ispSeconds <= 0
 */
export function calculateMassRatio(deltaVMps: number, ispSeconds: number): number {
  if (!Number.isFinite(deltaVMps) || deltaVMps < 0) {
    throw new RangeError(
      `calculateMassRatio: Delta-V must be non-negative. Received: ${deltaVMps}`
    );
  }
  if (!Number.isFinite(ispSeconds) || ispSeconds <= 0) {
    throw new RangeError(
      `calculateMassRatio: Specific impulse must be positive. Received: ${ispSeconds}`
    );
  }

  if (deltaVMps === 0) {
    return 1.0;
  }

  const ve = calculateEffectiveExhaustVelocity(ispSeconds);
  return Math.exp(deltaVMps / ve);
}

/**
 * Calculates required propellant mass from dry mass, target Delta-V, and specific impulse:
 * m_prop = m_dry * (exp(DeltaV / (Isp * g0)) - 1)
 *
 * @param dryMassKg Spacecraft dry mass (structure, avionics, payload) in kilograms (dryMassKg > 0)
 * @param deltaVMps Target Delta-V in metres per second (deltaVMps >= 0)
 * @param ispSeconds Engine specific impulse in seconds (ispSeconds > 0)
 * @returns Required usable propellant mass in kilograms
 * @throws RangeError if dryMassKg <= 0, deltaVMps < 0, or ispSeconds <= 0
 */
export function calculatePropellantMass(
  dryMassKg: number,
  deltaVMps: number,
  ispSeconds: number
): number {
  if (!Number.isFinite(dryMassKg) || dryMassKg <= 0) {
    throw new RangeError(
      `calculatePropellantMass: Dry mass must be positive. Received: ${dryMassKg}`
    );
  }

  if (deltaVMps === 0) {
    return 0.0;
  }

  const massRatio = calculateMassRatio(deltaVMps, ispSeconds);
  return dryMassKg * (massRatio - 1);
}

/**
 * Calculates final burnout mass from initial wet mass and consumed propellant mass:
 * mf = m0 - m_prop
 *
 * @param initialMassKg Initial wet mass in kilograms (initialMassKg > 0)
 * @param propellantMassKg Propellant mass in kilograms (0 <= propellantMassKg < initialMassKg)
 * @returns Final dry mass in kilograms
 * @throws RangeError if masses are invalid or final mass <= 0
 */
export function calculateFinalMass(
  initialMassKg: number,
  propellantMassKg: number
): number {
  if (!Number.isFinite(initialMassKg) || initialMassKg <= 0) {
    throw new RangeError(
      `calculateFinalMass: Initial mass must be positive. Received: ${initialMassKg}`
    );
  }
  if (!Number.isFinite(propellantMassKg) || propellantMassKg < 0) {
    throw new RangeError(
      `calculateFinalMass: Propellant mass cannot be negative. Received: ${propellantMassKg}`
    );
  }
  if (propellantMassKg >= initialMassKg) {
    throw new RangeError(
      `calculateFinalMass: Propellant mass (${propellantMassKg} kg) cannot equal or exceed initial mass (${initialMassKg} kg). A spacecraft must retain non-zero structural dry mass.`
    );
  }

  return initialMassKg - propellantMassKg;
}

/**
 * Calculates achievable ideal Delta-V from initial and final mass using the Tsiolkovsky equation:
 * DeltaV = Isp * g0 * ln(m0 / mf)
 *
 * @param initialMassKg Initial wet mass in kilograms (initialMassKg > 0)
 * @param finalMassKg Final burnout mass in kilograms (0 < finalMassKg <= initialMassKg)
 * @param ispSeconds Specific impulse in seconds (ispSeconds > 0)
 * @returns Achieved Delta-V in metres per second (m/s)
 * @throws RangeError if mass parameters are physically invalid
 */
export function calculateDeltaV(
  initialMassKg: number,
  finalMassKg: number,
  ispSeconds: number
): number {
  if (!Number.isFinite(initialMassKg) || initialMassKg <= 0) {
    throw new RangeError(
      `calculateDeltaV: Initial mass must be positive. Received: ${initialMassKg}`
    );
  }
  if (!Number.isFinite(finalMassKg) || finalMassKg <= 0) {
    throw new RangeError(
      `calculateDeltaV: Final mass must be positive. Received: ${finalMassKg}`
    );
  }
  if (finalMassKg > initialMassKg) {
    throw new RangeError(
      `calculateDeltaV: Final burnout mass (${finalMassKg} kg) cannot exceed initial wet mass (${initialMassKg} kg).`
    );
  }
  if (!Number.isFinite(ispSeconds) || ispSeconds <= 0) {
    throw new RangeError(
      `calculateDeltaV: Specific impulse must be positive. Received: ${ispSeconds}`
    );
  }

  if (initialMassKg === finalMassKg) {
    return 0.0;
  }

  const ve = calculateEffectiveExhaustVelocity(ispSeconds);
  return ve * Math.log(initialMassKg / finalMassKg);
}

/**
 * Calculates propellant mass fraction:
 * zeta = m_prop / m0
 *
 * @param propellantMassKg Propellant mass in kilograms
 * @param initialMassKg Total wet mass in kilograms
 * @returns Propellant mass fraction (dimensionless, 0.0 <= zeta < 1.0)
 * @throws RangeError if propellantMassKg < 0 or initialMassKg <= propellantMassKg
 */
export function calculatePropellantFraction(
  propellantMassKg: number,
  initialMassKg: number
): number {
  if (!Number.isFinite(initialMassKg) || initialMassKg <= 0) {
    throw new RangeError(
      `calculatePropellantFraction: Initial mass must be positive. Received: ${initialMassKg}`
    );
  }
  if (!Number.isFinite(propellantMassKg) || propellantMassKg < 0) {
    throw new RangeError(
      `calculatePropellantFraction: Propellant mass cannot be negative. Received: ${propellantMassKg}`
    );
  }
  if (propellantMassKg >= initialMassKg) {
    throw new RangeError(
      `calculatePropellantFraction: Propellant mass (${propellantMassKg} kg) cannot equal or exceed initial mass (${initialMassKg} kg).`
    );
  }

  return propellantMassKg / initialMassKg;
}

/* ========================================================================== */
/* 2. COMPREHENSIVE PERFORMANCE CALCULATOR                                    */
/* ========================================================================== */

/**
 * Computes complete spacecraft rocketry performance breakdown given dry mass,
 * target Delta-V, and specific impulse.
 *
 * ASSUMPTIONS & LIMITATIONS:
 * 1. Single-stage propulsion. Does not model staging or multi-tank drop-offs.
 * 2. Vacuum impulsive maneuver: Assumes instantaneous thrust without gravity losses (Delta-V_grav = 0).
 * 3. Does not model atmospheric drag losses (Delta-V_drag = 0).
 * 4. Constant specific impulse across burn duration.
 * 5. 100% propellant utilization: Does not model unburnable residual ullage or trapped propellant.
 *
 * @param dryMassKg Spacecraft dry mass in kg
 * @param deltaVMps Desired velocity increment in m/s
 * @param ispSeconds Engine specific impulse in seconds
 * @returns Complete RocketPerformanceResult object
 */
export function calculateRocketPerformance(
  dryMassKg: number,
  deltaVMps: number,
  ispSeconds: number
): RocketPerformanceResult {
  const propellantMassKg = calculatePropellantMass(dryMassKg, deltaVMps, ispSeconds);
  const initialMassKg = dryMassKg + propellantMassKg;
  const massRatio = calculateMassRatio(deltaVMps, ispSeconds);
  const propellantFraction = calculatePropellantFraction(propellantMassKg, initialMassKg);
  const effectiveExhaustVelocityMps = calculateEffectiveExhaustVelocity(ispSeconds);

  return {
    initialMassKg,
    dryMassKg,
    propellantMassKg,
    massRatio,
    propellantFraction,
    deltaVMps,
    effectiveExhaustVelocityMps,
  };
}
