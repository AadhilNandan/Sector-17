/**
 * SECTOR 17 — Orbital Mechanics & Physics Calculations
 * Pure SI astrodynamic equations for Keplerian two-body motion, energy, vis-viva,
 * Tsiolkovsky rocketry, relative distance geometry, and strict physical validation.
 *
 * All inputs are rigorously validated; no impossible values are silently clamped.
 */

import { G0 } from './constants';
import type { OrbitalElements, CentralBody, ValidationStatus, ManeuverValidationReport } from './types';

/* -------------------------------------------------------------------------- */
/* 1. Numerical & Physical Parameter Validation Helpers                       */
/* -------------------------------------------------------------------------- */

export function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number. Received: ${value}`);
  }
}

export function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number. Received: ${value}`);
  }
}

/* -------------------------------------------------------------------------- */
/* 2. Vis-Viva & Orbital Velocity                                             */
/* -------------------------------------------------------------------------- */

/**
 * Computes orbital speed at radius r using the Vis-Viva equation:
 * v = sqrt(mu * (2/r - 1/a))
 *
 * @param r Current orbital radius from center of mass (m)
 * @param a Semi-major axis of the orbit (m). Positive for elliptic, negative for hyperbolic.
 * @param mu Standard gravitational parameter of central body (m³/s²)
 * @returns Orbital speed in m/s
 */
export function calculateVisVivaSpeed(r: number, a: number, mu: number): number {
  assertFinitePositive(r, 'Orbital radius r');
  assertFinitePositive(mu, 'Gravitational parameter mu');

  if (!Number.isFinite(a) || a === 0) {
    throw new RangeError(`Semi-major axis a must be non-zero and finite. Received: ${a}`);
  }

  const term = 2 / r - 1 / a;
  if (term < 0) {
    throw new RangeError(
      `calculateVisVivaSpeed: Physically impossible state (r=${r}m exceeds apoapsis for a=${a}m, 2/r - 1/a = ${term})`
    );
  }

  return Math.sqrt(mu * term);
}

/**
 * Computes circular orbital speed at radius r:
 * v_circ = sqrt(mu / r)
 */
export function calculateCircularVelocity(r: number, mu: number): number {
  assertFinitePositive(r, 'Orbital radius r');
  assertFinitePositive(mu, 'Gravitational parameter mu');
  return Math.sqrt(mu / r);
}

/**
 * Computes escape velocity at radius r:
 * v_esc = sqrt(2 * mu / r)
 */
export function calculateEscapeVelocity(r: number, mu: number): number {
  assertFinitePositive(r, 'Orbital radius r');
  assertFinitePositive(mu, 'Gravitational parameter mu');
  return Math.sqrt((2 * mu) / r);
}

/* -------------------------------------------------------------------------- */
/* 3. Orbital Energy, Period & Geometry                                       */
/* -------------------------------------------------------------------------- */

/**
 * Computes specific orbital energy (epsilon) in J/kg (m²/s²):
 * epsilon = -mu / (2*a)
 */
export function calculateSpecificOrbitalEnergy(a: number, mu: number): number {
  assertFinitePositive(mu, 'Gravitational parameter mu');
  if (!Number.isFinite(a) || a === 0) {
    throw new RangeError(`Semi-major axis a must be non-zero finite. Received: ${a}`);
  }
  return -mu / (2 * a);
}

/**
 * Computes Keplerian orbital period in seconds:
 * T = 2 * pi * sqrt(a³ / mu)
 * Only valid for closed bound orbits (a > 0).
 */
export function calculateOrbitalPeriod(a: number, mu: number): number {
  assertFinitePositive(a, 'Semi-major axis a');
  assertFinitePositive(mu, 'Gravitational parameter mu');
  return 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu);
}

/**
 * Constructs complete OrbitalElements record for a two-body orbit.
 */
export function createOrbitalElements(
  centralBody: CentralBody,
  periapsisRadiusMetres: number,
  apoapsisRadiusMetres: number,
  mu: number,
  inclinationRad: number = 0,
  trueAnomalyRad: number = 0
): OrbitalElements {
  assertFinitePositive(periapsisRadiusMetres, 'Periapsis radius');
  assertFinitePositive(apoapsisRadiusMetres, 'Apoapsis radius');
  assertFinitePositive(mu, 'Gravitational parameter mu');

  if (periapsisRadiusMetres > apoapsisRadiusMetres) {
    throw new RangeError(
      `Periapsis radius (${periapsisRadiusMetres} m) cannot exceed apoapsis radius (${apoapsisRadiusMetres} m)`
    );
  }

  const semiMajorAxisMetres = (periapsisRadiusMetres + apoapsisRadiusMetres) / 2;
  const eccentricity = (apoapsisRadiusMetres - periapsisRadiusMetres) / (apoapsisRadiusMetres + periapsisRadiusMetres);
  const orbitalPeriodSeconds = calculateOrbitalPeriod(semiMajorAxisMetres, mu);
  const specificOrbitalEnergyJPerKg = calculateSpecificOrbitalEnergy(semiMajorAxisMetres, mu);
  const currentVelocityMps = calculateVisVivaSpeed(semiMajorAxisMetres, semiMajorAxisMetres, mu);

  return {
    centralBody,
    semiMajorAxisMetres,
    eccentricity,
    periapsisRadiusMetres,
    apoapsisRadiusMetres,
    orbitalPeriodSeconds,
    specificOrbitalEnergyJPerKg,
    inclinationRad,
    trueAnomalyRad,
    currentVelocityMps,
  };
}

/* -------------------------------------------------------------------------- */
/* 4. Tsiolkovsky Rocket Propulsion Calculations                              */
/* -------------------------------------------------------------------------- */

/**
 * Calculates propellant mass consumed for a given Delta-V using the rocket equation:
 * Delta_m = m0 * (1 - exp(-DeltaV / (Isp * g0)))
 */
export function calculatePropellantConsumed(
  initialWetMassKg: number,
  deltaVMps: number,
  ispSeconds: number
): number {
  assertFinitePositive(initialWetMassKg, 'Initial wet mass');
  assertFiniteNonNegative(deltaVMps, 'Delta-V');
  assertFinitePositive(ispSeconds, 'Specific impulse');

  if (deltaVMps === 0) return 0;

  const effectiveExhaustVelocity = ispSeconds * G0;
  const massRatio = Math.exp(deltaVMps / effectiveExhaustVelocity);
  const finalMassKg = initialWetMassKg / massRatio;
  return initialWetMassKg - finalMassKg;
}

/**
 * Calculates burn duration in seconds assuming constant thrust:
 * t_burn = (m_prop * Isp * g0) / Thrust
 */
export function calculateBurnDurationSeconds(
  propellantBurnedKg: number,
  ispSeconds: number,
  thrustNewtons: number
): number {
  assertFiniteNonNegative(propellantBurnedKg, 'Propellant mass');
  assertFinitePositive(ispSeconds, 'Specific impulse');
  assertFinitePositive(thrustNewtons, 'Engine thrust');

  if (propellantBurnedKg === 0) return 0;
  const effectiveExhaustVelocity = ispSeconds * G0;
  return (propellantBurnedKg * effectiveExhaustVelocity) / thrustNewtons;
}

/**
 * Calculates maximum ideal Delta-V achievable with current propellant:
 * DeltaV = Isp * g0 * ln(m0 / mf)
 */
export function calculateMaxAchievableDeltaV(
  dryMassKg: number,
  propellantRemainingKg: number,
  ispSeconds: number
): number {
  assertFinitePositive(dryMassKg, 'Dry mass');
  assertFiniteNonNegative(propellantRemainingKg, 'Propellant mass');
  assertFinitePositive(ispSeconds, 'Specific impulse');

  if (propellantRemainingKg === 0) return 0;

  const wetMassKg = dryMassKg + propellantRemainingKg;
  const effectiveExhaustVelocity = ispSeconds * G0;
  return effectiveExhaustVelocity * Math.log(wetMassKg / dryMassKg);
}

/* -------------------------------------------------------------------------- */
/* 5. Maneuver Feasibility & Propulsion Resource Validation                   */
/* -------------------------------------------------------------------------- */

export function validateManeuverFeasibility(
  deltaVMps: number,
  dryMassKg: number,
  availablePropellantKg: number,
  ispSeconds: number,
  thrustNewtons: number,
  options?: {
    areValvesIsolated?: boolean;
    isEngineNominal?: boolean;
    requiredMinMarginKg?: number;
  }
): ManeuverValidationReport {
  const reasons: string[] = [];
  let status: ValidationStatus = 'PASS';

  if (!Number.isFinite(deltaVMps) || deltaVMps < 0) {
    return {
      status: 'FAIL',
      isFeasible: false,
      reasons: [`Invalid Delta-V value: ${deltaVMps}`],
      requiredDeltaVMps: deltaVMps,
      requiredPropellantKg: 0,
      availablePropellantKg,
      propellantMarginKg: -1,
      burnDurationSeconds: 0,
      initialMassKg: dryMassKg + availablePropellantKg,
      finalMassKg: dryMassKg + availablePropellantKg,
    };
  }

  const initialMassKg = dryMassKg + availablePropellantKg;
  const requiredPropellantKg = calculatePropellantConsumed(initialMassKg, deltaVMps, ispSeconds);
  const finalMassKg = initialMassKg - requiredPropellantKg;
  const propellantMarginKg = availablePropellantKg - requiredPropellantKg;
  const burnDurationSeconds = calculateBurnDurationSeconds(requiredPropellantKg, ispSeconds, thrustNewtons);

  // 1. Valve & Subsystem Operational State Checks
  if (options?.areValvesIsolated) {
    status = 'FAIL';
    reasons.push('Propellant isolation valves are closed (SAFE mode active). Maneuver inhibited.');
  }

  if (options?.isEngineNominal === false) {
    status = 'FAIL';
    reasons.push('Main engine status is non-nominal (FAULT/OFF). Ignition disallowed.');
  }

  // 2. Propellant Depletion Checks
  if (requiredPropellantKg > availablePropellantKg) {
    status = 'FAIL';
    reasons.push(
      `Insufficient propellant: required ${requiredPropellantKg.toFixed(1)} kg, but only ${availablePropellantKg.toFixed(1)} kg available (deficit: ${(requiredPropellantKg - availablePropellantKg).toFixed(1)} kg).`
    );
  } else {
    // 3. Margin Verification
    const minMargin = options?.requiredMinMarginKg ?? 0;
    if (propellantMarginKg < minMargin) {
      status = 'WARNING';
      reasons.push(
        `Propellant reserve after maneuver (${propellantMarginKg.toFixed(1)} kg) falls below flight safety reserve (${minMargin.toFixed(1)} kg).`
      );
    }
  }

  const isFeasible = status === 'PASS' || status === 'WARNING';
  if (isFeasible && reasons.length === 0) {
    reasons.push(`Maneuver validated: burns ${requiredPropellantKg.toFixed(1)} kg propellant in ${burnDurationSeconds.toFixed(1)} s.`);
  }

  return {
    status,
    isFeasible,
    reasons,
    requiredDeltaVMps: deltaVMps,
    requiredPropellantKg,
    availablePropellantKg,
    propellantMarginKg,
    burnDurationSeconds,
    initialMassKg,
    finalMassKg,
  };
}

/* -------------------------------------------------------------------------- */
/* 6. Relative Geometry & Closest Approach                                    */
/* -------------------------------------------------------------------------- */

/**
 * Calculates Euclidean relative distance between two 2D/3D vectors:
 * d = sqrt((x1 - x2)² + (y1 - y2)² + (z1 - z2)²)
 */
export function calculateRelativeDistance(
  pos1: readonly [number, number, number?],
  pos2: readonly [number, number, number?]
): number {
  const dx = pos1[0] - pos2[0];
  const dy = pos1[1] - pos2[1];
  const dz = (pos1[2] ?? 0) - (pos2[2] ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
