/**
 * SECTOR 17 — Heliocentric Interplanetary Trajectory Engine
 * Models Earth-to-Jupiter interplanetary transfer mechanics.
 *
 * Clearly distinguishes between:
 * 1. The theoretical minimum-energy Hohmann transfer baseline (~997 days, zero inclination).
 * 2. The realistic operational high-energy direct AETHON trajectory (~1,180 days, C3 = 41.7 km²/s²).
 *
 * All functions operate in standard SI units internally.
 */

import {
  MU_SUN,
  SECONDS_PER_DAY,
} from '../constants';
import {
  EARTH_ORBIT_RADIUS_METRES,
  JUPITER_ORBIT_RADIUS_METRES,
  REALISTIC_AETHON_TRANSFER_DURATION_DAYS,
  REALISTIC_AETHON_DEPARTURE_C3_KM2PS2,
} from './constants';
import { calculateVisVivaSpeed, calculateCircularVelocity } from './orbitalCalculations';
import type { HeliocentricTrajectoryModel, TransferType } from './types';

/**
 * Computes the theoretical Hohmann transfer baseline from 1.0 AU to 5.2044 AU.
 * Theoretical minimum-energy benchmark; not the actual operational flight plan.
 */
export function calculateHohmannBaselineModel(): HeliocentricTrajectoryModel {
  const r1 = EARTH_ORBIT_RADIUS_METRES;
  const r2 = JUPITER_ORBIT_RADIUS_METRES;

  const semiMajorAxisMetres = (r1 + r2) / 2;
  const transferTimeSeconds = Math.PI * Math.sqrt(Math.pow(semiMajorAxisMetres, 3) / MU_SUN);
  const transferTimeDays = transferTimeSeconds / SECONDS_PER_DAY;

  const vCircEarth = calculateCircularVelocity(r1, MU_SUN);
  const vCircJupiter = calculateCircularVelocity(r2, MU_SUN);

  const vTransEarth = calculateVisVivaSpeed(r1, semiMajorAxisMetres, MU_SUN);
  const vTransJupiter = calculateVisVivaSpeed(r2, semiMajorAxisMetres, MU_SUN);

  const departureDeltaVMps = Math.abs(vTransEarth - vCircEarth);
  const arrivalDeltaVMps = Math.abs(vCircJupiter - vTransJupiter);
  const totalDeltaVMps = departureDeltaVMps + arrivalDeltaVMps;

  // Theoretical excess velocity squared
  const vInfDeparture = departureDeltaVMps;
  const c3LaunchEnergyKm2ps2 = Math.pow(vInfDeparture / 1000, 2);

  return {
    transferType: 'HOHMANN_BASELINE',
    departureBody: 'EARTH',
    arrivalBody: 'JUPITER',
    departureRadiusMetres: r1,
    arrivalRadiusMetres: r2,
    semiMajorAxisMetres,
    transferTimeSeconds,
    transferTimeDays,
    departureDeltaVMps,
    arrivalDeltaVMps,
    totalDeltaVMps,
    c3LaunchEnergyKm2ps2,
    departureVelocityVectorMps: [0, vTransEarth, 0],
    arrivalVelocityVectorMps: [0, vTransJupiter, 0],
    isTheoreticalBaseline: true,
    description:
      'Theoretical two-body Hohmann transfer. Minimum-energy baseline assuming circular, coplanar orbits. Not the operational AETHON flight trajectory.',
  };
}

/**
 * Computes the realistic operational flight trajectory for Spacecraft AETHON.
 * Models a high-energy direct insertion with launch vehicle injection stage.
 */
export function calculateRealisticAethonTrajectory(): HeliocentricTrajectoryModel {
  const r1 = EARTH_ORBIT_RADIUS_METRES;
  const r2 = JUPITER_ORBIT_RADIUS_METRES;

  // Realistic operational flight time: ~1,180 days (~3.2 years)
  const transferTimeDays = REALISTIC_AETHON_TRANSFER_DURATION_DAYS;
  const transferTimeSeconds = transferTimeDays * SECONDS_PER_DAY;

  // Operational semi-major axis slightly adjusted for non-coplanar Jovian rendezvous
  const semiMajorAxisMetres = 3.25 * EARTH_ORBIT_RADIUS_METRES;

  const vTransEarth = calculateVisVivaSpeed(r1, semiMajorAxisMetres, MU_SUN);
  const vCircEarth = calculateCircularVelocity(r1, MU_SUN);
  const departureDeltaVMps = Math.abs(vTransEarth - vCircEarth);

  const vCircJupiter = calculateCircularVelocity(r2, MU_SUN);
  const vTransJupiter = calculateVisVivaSpeed(r2, semiMajorAxisMetres, MU_SUN);
  const arrivalDeltaVMps = Math.abs(vCircJupiter - vTransJupiter);

  const totalDeltaVMps = departureDeltaVMps + arrivalDeltaVMps;
  const c3LaunchEnergyKm2ps2 = REALISTIC_AETHON_DEPARTURE_C3_KM2PS2;

  return {
    transferType: 'REALISTIC_DIRECT',
    departureBody: 'EARTH',
    arrivalBody: 'JUPITER',
    departureRadiusMetres: r1,
    arrivalRadiusMetres: r2,
    semiMajorAxisMetres,
    transferTimeSeconds,
    transferTimeDays,
    departureDeltaVMps,
    arrivalDeltaVMps,
    totalDeltaVMps,
    c3LaunchEnergyKm2ps2,
    departureVelocityVectorMps: [1_200, vTransEarth, 350],
    arrivalVelocityVectorMps: [800, vTransJupiter, -220],
    isTheoreticalBaseline: false,
    description:
      'AETHON Operational High-Energy Direct Transfer. Falcon Heavy class upper stage launch injection (C3 = 41.7 km²/s²), targeted for Jovian system polar approach.',
  };
}

/**
 * Factory helper to get trajectory model by desired type.
 */
export function getTrajectoryModel(type: TransferType = 'REALISTIC_DIRECT'): HeliocentricTrajectoryModel {
  return type === 'HOHMANN_BASELINE'
    ? calculateHohmannBaselineModel()
    : calculateRealisticAethonTrajectory();
}
