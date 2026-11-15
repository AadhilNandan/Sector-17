/**
 * SECTOR 17 — Orbital Mechanics Engine
 * Pure mathematical functions for two-body astrodynamics,
 * Hohmann transfers, vis-viva velocity calculations, and C3 energy conversions.
 *
 * All functions operate in standard SI units (metres, seconds, kg).
 */

import {
  ASTRONOMICAL_UNIT_METRES,
  MU_SUN,
  SECONDS_PER_DAY,
  DAYS_PER_JULIAN_YEAR,
  SECONDS_PER_JULIAN_YEAR,
} from '../constants';
import type { HohmannTransferParams, HohmannTransferResult } from '../types';

/* ========================================================================== */
/* 1. ORBITAL UNIT CONVERSION UTILITIES                                       */
/* ========================================================================== */

/**
 * Converts Astronomical Units (AU) to metres.
 * @param au Distance in Astronomical Units (1 AU = 149,597,870,700 m)
 */
export function auToMetres(au: number): number {
  if (!Number.isFinite(au)) {
    throw new TypeError(`auToMetres: Input must be a finite number. Received: ${au}`);
  }
  return au * ASTRONOMICAL_UNIT_METRES;
}

/**
 * Converts metres to Astronomical Units (AU).
 * @param metres Distance in metres
 */
export function metresToAu(metres: number): number {
  if (!Number.isFinite(metres)) {
    throw new TypeError(`metresToAu: Input must be a finite number. Received: ${metres}`);
  }
  return metres / ASTRONOMICAL_UNIT_METRES;
}

/**
 * Converts seconds to Earth standard days (86,400 seconds).
 * @param seconds Time in seconds
 */
export function secondsToDays(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    throw new TypeError(`secondsToDays: Input must be a finite number. Received: ${seconds}`);
  }
  return seconds / SECONDS_PER_DAY;
}

/**
 * Converts Earth standard days to Julian years (365.25 days).
 * @param days Time in days
 */
export function daysToYears(days: number): number {
  if (!Number.isFinite(days)) {
    throw new TypeError(`daysToYears: Input must be a finite number. Received: ${days}`);
  }
  return days / DAYS_PER_JULIAN_YEAR;
}

/**
 * Converts kilometres per second (km/s) to metres per second (m/s).
 * @param kmPerSec Velocity in km/s
 */
export function kmPerSecToMetersPerSec(kmPerSec: number): number {
  if (!Number.isFinite(kmPerSec)) {
    throw new TypeError(
      `kmPerSecToMetersPerSec: Input must be a finite number. Received: ${kmPerSec}`
    );
  }
  return kmPerSec * 1000;
}

/**
 * Converts metres per second (m/s) to kilometres per second (km/s).
 * @param metersPerSec Velocity in m/s
 */
export function metersPerSecToKmPerSec(metersPerSec: number): number {
  if (!Number.isFinite(metersPerSec)) {
    throw new TypeError(
      `metersPerSecToKmPerSec: Input must be a finite number. Received: ${metersPerSec}`
    );
  }
  return metersPerSec / 1000;
}

/* ========================================================================== */
/* 2. VIS-VIVA EQUATION                                                       */
/* ========================================================================== */

/**
 * Computes orbital velocity at distance r using the vis-viva equation:
 * v = sqrt(mu * (2/r - 1/a))
 *
 * @param r Current orbital radius from central body center of mass in metres (r > 0)
 * @param a Semi-major axis of the orbit in metres (a > 0 for elliptic, a < 0 for hyperbolic)
 * @param mu Standard gravitational parameter (GM) of central body in m³/s² (defaults to Sun)
 * @returns Orbital speed in metres per second (m/s)
 *
 * @throws RangeError if r <= 0, mu <= 0, or if (2/r - 1/a) is negative for an elliptic orbit.
 */
export function calculateVisVivaVelocity(
  r: number,
  a: number,
  mu: number = MU_SUN
): number {
  if (!Number.isFinite(r) || r <= 0) {
    throw new RangeError(`calculateVisVivaVelocity: Orbital radius r must be positive. Received: ${r}`);
  }
  if (!Number.isFinite(a) || a === 0) {
    throw new RangeError(
      `calculateVisVivaVelocity: Semi-major axis a must be a non-zero finite number. Received: ${a}`
    );
  }
  if (!Number.isFinite(mu) || mu <= 0) {
    throw new RangeError(
      `calculateVisVivaVelocity: Gravitational parameter mu must be positive. Received: ${mu}`
    );
  }

  const term = 2 / r - 1 / a;
  if (term < 0) {
    throw new RangeError(
      `calculateVisVivaVelocity: Physically impossible orbital state. At distance r=${r}m, radius exceeds apoapsis for semi-major axis a=${a}m (2/r - 1/a = ${term}).`
    );
  }

  return Math.sqrt(mu * term);
}

/* ========================================================================== */
/* 3. HYPERBOLIC EXCESS VELOCITY AND C3                                       */
/* ========================================================================== */

/**
 * Calculates characteristic launch energy (C3) from hyperbolic excess velocity:
 * C3 = vInfinity²
 *
 * @param vInfinityMps Hyperbolic excess velocity in metres per second (m/s)
 * @returns Characteristic energy C3 in m²/s²
 * @throws RangeError if vInfinity is negative
 */
export function calculateC3FromVInfinity(vInfinityMps: number): number {
  if (!Number.isFinite(vInfinityMps) || vInfinityMps < 0) {
    throw new RangeError(
      `calculateC3FromVInfinity: Hyperbolic excess velocity must be non-negative. Received: ${vInfinityMps}`
    );
  }
  return vInfinityMps * vInfinityMps;
}

/**
 * Calculates hyperbolic excess velocity from characteristic launch energy (C3):
 * vInfinity = sqrt(C3)
 *
 * @param c3M2ps2 Characteristic launch energy in m²/s²
 * @returns Hyperbolic excess velocity in metres per second (m/s)
 * @throws RangeError if C3 is negative
 */
export function calculateVInfinityFromC3(c3M2ps2: number): number {
  if (!Number.isFinite(c3M2ps2) || c3M2ps2 < 0) {
    throw new RangeError(
      `calculateVInfinityFromC3: Characteristic energy C3 must be non-negative. Received: ${c3M2ps2}`
    );
  }
  return Math.sqrt(c3M2ps2);
}

/**
 * Convenience helper to convert standard aerospace C3 in km²/s² to SI m²/s².
 * E.g. Falcon Heavy Europa Clipper C3 of 41.7 km²/s² = 41.7e6 m²/s².
 */
export function km2ps2ToM2ps2(c3Km2ps2: number): number {
  if (!Number.isFinite(c3Km2ps2) || c3Km2ps2 < 0) {
    throw new RangeError(`km2ps2ToM2ps2: C3 must be non-negative. Received: ${c3Km2ps2}`);
  }
  return c3Km2ps2 * 1_000_000;
}

/**
 * Convenience helper to convert SI C3 in m²/s² to standard aerospace km²/s².
 */
export function m2ps2ToKm2ps2(c3M2ps2: number): number {
  if (!Number.isFinite(c3M2ps2) || c3M2ps2 < 0) {
    throw new RangeError(`m2ps2ToKm2ps2: C3 must be non-negative. Received: ${c3M2ps2}`);
  }
  return c3M2ps2 / 1_000_000;
}

/* ========================================================================== */
/* 4. HOHMANN TRANSFER ENGINE                                                 */
/* ========================================================================== */

/**
 * Computes an idealized two-body Hohmann transfer between two coplanar, circular orbits.
 *
 * Physics & Equations:
 * - Transfer semi-major axis: a_trans = (r1 + r2) / 2
 * - Transfer orbital period: P = 2 * pi * sqrt(a_trans³ / mu)
 * - One-way transfer duration: T = P / 2 = pi * sqrt(a_trans³ / mu)
 * - Circular velocities: v_c1 = sqrt(mu / r1), v_c2 = sqrt(mu / r2)
 * - Transfer velocities via vis-viva:
 *     v_t1 = sqrt(mu * (2/r1 - 1/a_trans))
 *     v_t2 = sqrt(mu * (2/r2 - 1/a_trans))
 * - Impulses:
 *     DeltaV1 = |v_t1 - v_c1|
 *     DeltaV2 = |v_c2 - v_t2|
 *     DeltaV_total = DeltaV1 + DeltaV2
 *
 * ASSUMPTIONS & LIMITATIONS:
 * 1. Two-body point mass gravity only. Planetary perturbations, 3-body Lagrange points,
 *    and non-spherical gravitational harmonics (J2) are not included.
 * 2. Assumes initial and target orbits are coplanar and circular (zero orbital inclination and eccentricity).
 * 3. Does not model planetary departure escape burns from low parking orbits, gravity assists
 *    (e.g., Mars-Earth gravity assists used by Europa Clipper), or operational Jovian tour flybys.
 * 4. This is an astrodynamic theoretical minimum energy benchmark, NOT an operational flight plan.
 *
 * @param params HohmannTransferParams defining r1, r2, and optional central gravitational parameter mu.
 * @returns HohmannTransferResult containing transfer geometry, durations in multiple units, velocities, and Delta-V impulses.
 */
export function calculateHohmannTransfer(
  params: HohmannTransferParams
): HohmannTransferResult {
  const { r1, r2, mu = MU_SUN } = params;

  if (!Number.isFinite(r1) || r1 <= 0) {
    throw new RangeError(`calculateHohmannTransfer: Initial radius r1 must be positive. Received: ${r1}`);
  }
  if (!Number.isFinite(r2) || r2 <= 0) {
    throw new RangeError(`calculateHohmannTransfer: Final radius r2 must be positive. Received: ${r2}`);
  }
  if (!Number.isFinite(mu) || mu <= 0) {
    throw new RangeError(
      `calculateHohmannTransfer: Gravitational parameter mu must be positive. Received: ${mu}`
    );
  }

  // Semi-major axis of transfer ellipse
  const semiMajorAxisMetres = (r1 + r2) / 2;

  // One-way transfer time: half of full Keplerian orbital period
  // T = pi * sqrt(a^3 / mu)
  const transferTimeSeconds = Math.PI * Math.sqrt(Math.pow(semiMajorAxisMetres, 3) / mu);
  const transferTimeDays = transferTimeSeconds / SECONDS_PER_DAY;
  const transferTimeYears = transferTimeSeconds / SECONDS_PER_JULIAN_YEAR;

  // Circular orbital velocities
  const initialCircularVelocityMps = Math.sqrt(mu / r1);
  const finalCircularVelocityMps = Math.sqrt(mu / r2);

  // Transfer orbit velocities at periapsis and apoapsis
  const initialTransferVelocityMps = calculateVisVivaVelocity(r1, semiMajorAxisMetres, mu);
  const finalTransferVelocityMps = calculateVisVivaVelocity(r2, semiMajorAxisMetres, mu);

  // Delta-V burns
  const departureDeltaVMps = Math.abs(initialTransferVelocityMps - initialCircularVelocityMps);
  const arrivalDeltaVMps = Math.abs(finalCircularVelocityMps - finalTransferVelocityMps);
  const totalDeltaVMps = departureDeltaVMps + arrivalDeltaVMps;

  return {
    semiMajorAxisMetres,
    transferTimeSeconds,
    transferTimeDays,
    transferTimeYears,
    initialTransferVelocityMps,
    finalTransferVelocityMps,
    initialCircularVelocityMps,
    finalCircularVelocityMps,
    departureDeltaVMps,
    arrivalDeltaVMps,
    totalDeltaVMps,
  };
}
