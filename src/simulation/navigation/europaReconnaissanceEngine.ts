/**
 * SECTOR 17 — Europa Ephemeris & Reconnaissance Flyby Engine
 * Simplified Keplerian ephemeris model of Europa orbiting Jupiter,
 * coupled with AETHON tour flyby dynamics, closest-approach detection,
 * observation window evaluation, and scientific reconnaissance data triggers.
 *
 * PROVENANCE:
 * - Europa orbital parameters: NASA JPL Galileo & Europa Clipper baselines (VERIFIED)
 * - Ephemeris propagation: Analytical circular 2-body Keplerian model (SIMPLIFIED)
 * - Spacecraft relative trajectory: Two-body Jovian resonant tour approximation (SIMPLIFIED)
 *
 * All functions operate in standard SI units internally.
 */

import {
  EUROPA_ORBIT_RADIUS_METRES,
  EUROPA_ORBIT_PERIOD_SECONDS,
  EUROPA_MAX_RECON_DISTANCE_METRES,
  EUROPA_NOMINAL_FLYBY_ALTITUDE_METRES,
  RADIUS_EUROPA_METRES,
  MU_JUPITER,
} from './constants';
import { calculateRelativeDistance, calculateVisVivaSpeed } from './orbitalCalculations';
import type { EuropaRelativeState, EuropaFlybyState } from './types';

/**
 * Computes Europa's orbital position around Jupiter at given mission time t (seconds).
 * Simplified coplanar circular ephemeris:
 * theta_E(t) = omega_E * t + theta_0
 */
export function computeEuropaEphemeris(
  metSeconds: number,
  initialPhaseRad: number = 0.5236 // 30 degrees initial offset
): {
  radiusMetres: number;
  phaseAngleRad: number;
  positionM: readonly [number, number, number];
  velocityMps: readonly [number, number, number];
} {
  const omega = (2 * Math.PI) / EUROPA_ORBIT_PERIOD_SECONDS;
  const phaseAngleRad = (initialPhaseRad + omega * metSeconds) % (2 * Math.PI);

  const x = EUROPA_ORBIT_RADIUS_METRES * Math.cos(phaseAngleRad);
  const y = EUROPA_ORBIT_RADIUS_METRES * Math.sin(phaseAngleRad);
  const z = 0;

  const speed = Math.sqrt(MU_JUPITER / EUROPA_ORBIT_RADIUS_METRES);
  const vx = -speed * Math.sin(phaseAngleRad);
  const vy = speed * Math.cos(phaseAngleRad);
  const vz = 0;

  return {
    radiusMetres: EUROPA_ORBIT_RADIUS_METRES,
    phaseAngleRad,
    positionM: [x, y, z],
    velocityMps: [vx, vy, vz],
  };
}

/**
 * Computes AETHON's position and velocity in its Jovian tour orbit at given time t.
 * Models a resonant elliptical orbit with perijove near Europa orbital radius.
 */
export function computeAethonJovianTourState(
  metSeconds: number,
  periapsisRadiusM: number = 670_000_000,
  apoapsisRadiusM: number = 14_000_000_000,
  periapsisAngleRad: number = 0.5236
): {
  positionM: readonly [number, number, number];
  velocityMps: readonly [number, number, number];
  orbitalDistanceMetres: number;
} {
  const a = (periapsisRadiusM + apoapsisRadiusM) / 2;
  const T = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / MU_JUPITER);
  const meanMotion = (2 * Math.PI) / T;

  // True anomaly progresses from periapsis (nu = 0 at metSeconds = 0)
  const trueAnomaly = (meanMotion * metSeconds) % (2 * Math.PI);
  const e = (apoapsisRadiusM - periapsisRadiusM) / (apoapsisRadiusM + periapsisRadiusM);

  // Orbital radius via polar ellipse equation: r = a*(1 - e²) / (1 + e*cos(nu))
  const p = a * (1 - e * e);
  const r = p / (1 + e * Math.cos(trueAnomaly));

  // True polar position angle in space
  const polarAngle = (periapsisAngleRad + trueAnomaly) % (2 * Math.PI);

  const x = r * Math.cos(polarAngle);
  const y = r * Math.sin(polarAngle);
  const z = 0;

  const speed = calculateVisVivaSpeed(r, a, MU_JUPITER);
  const vx = -speed * Math.sin(polarAngle);
  const vy = speed * Math.cos(polarAngle);
  const vz = 0;

  return {
    positionM: [x, y, z],
    velocityMps: [vx, vy, vz],
    orbitalDistanceMetres: r,
  };
}

/**
 * Evaluates relative motion between AETHON and Europa.
 * Identifies observation windows and scientific data gathering quality.
 */
export function evaluateEuropaRelativeMotion(
  metSeconds: number,
  aethonOffsetPhaseRad: number = 0.5236 // Aligned at nominal encounter
): EuropaRelativeState {
  const europa = computeEuropaEphemeris(metSeconds);
  const aethon = computeAethonJovianTourState(metSeconds, 670_000_000, 14_000_000_000, aethonOffsetPhaseRad);

  const relativeDistanceMetres = calculateRelativeDistance(aethon.positionM, europa.positionM);

  // Relative velocity vector: v_rel = v_A - v_E
  const dvx = aethon.velocityMps[0] - europa.velocityMps[0];
  const dvy = aethon.velocityMps[1] - europa.velocityMps[1];
  const dvz = aethon.velocityMps[2] - europa.velocityMps[2];
  const relativeVelocityMps = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);

  const isWithinObservationWindow = relativeDistanceMetres <= EUROPA_MAX_RECON_DISTANCE_METRES;

  // Quality scales inversely with distance: 100% at nominal flyby altitude, down to 0% at boundary
  const nominalClosestM = RADIUS_EUROPA_METRES + EUROPA_NOMINAL_FLYBY_ALTITUDE_METRES;
  const quality = isWithinObservationWindow
    ? Math.max(
        10,
        Math.min(
          100,
          Math.round(
            100 *
              (1 -
                (relativeDistanceMetres - nominalClosestM) /
                  (EUROPA_MAX_RECON_DISTANCE_METRES - nominalClosestM))
          )
        )
      )
    : 0;

  return {
    europaOrbitalRadiusMetres: europa.radiusMetres,
    europaPhaseAngleRad: europa.phaseAngleRad,
    aethonDistanceToJupiterMetres: aethon.orbitalDistanceMetres,
    aethonPhaseAngleRad: Math.atan2(aethon.positionM[1], aethon.positionM[0]),
    relativeDistanceMetres,
    relativeVelocityMps,
    isWithinObservationWindow,
    observationQualityPercent: quality,
  };
}

/**
 * Creates the initial default Europa flyby state record.
 */
export function createDefaultEuropaFlybyState(): EuropaFlybyState {
  return {
    currentEuropaDistanceMetres: 12_500_000_000, // Ingress approach distance
    closestApproachDistanceMetres: RADIUS_EUROPA_METRES + EUROPA_NOMINAL_FLYBY_ALTITUDE_METRES,
    relativeVelocityMps: 4_420, // ~4.42 km/s flyby speed
    inObservationWindow: false,
    totalFlybysCompleted: 0,
    reconnaissanceDataAcquired: false,
    highResolutionScansCompleted: 0,
  };
}
