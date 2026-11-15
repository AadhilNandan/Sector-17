/**
 * SECTOR 17 — Communication Windows & Station Visibility Module
 * Deterministically evaluates Earth ground station visibility, horizon mask elevation angles,
 * and communication opportunity windows from explicit geometric inputs.
 *
 * MATHEMATICAL MODEL & ASSUMPTIONS:
 * 1. Earth is modeled as a spherical central body with volumetric mean radius R_E = 6,371,000 m.
 * 2. Elevation angle E from a ground station (lat_s, lon_s) to a target celestial/subpoint direction (lat_t, lon_t)
 *    is calculated via spherical trigonometry:
 *       cos(theta) = sin(lat_s)*sin(lat_t) + cos(lat_s)*cos(lat_t)*cos(lon_t - lon_s)
 *       tan(E) = (cos(theta) - R_E / r) / sin(theta)
 *    For deep-space distances (r >> R_E), R_E / r -> 0 and E -> 90° - theta.
 * 3. Visibility requires both:
 *    a) Geometric elevation angle E >= station.minElevationDeg (typically >= 10° horizon mask).
 *    b) Station is operational (not in a planned maintenance blackout at current MET).
 */

import { isStationAvailableAtMET } from './groundStations';
import type {
  GroundStation,
  SpacecraftPointingTarget,
  VisibilityResult,
  CommunicationWindow,
} from './types';

export const EARTH_MEAN_RADIUS_METRES = 6_371_000;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Calculates geometric topocentric elevation angle (in degrees) of a spacecraft
 * viewed from a ground station location.
 *
 * @param stationLatitudeDeg Ground station latitude in degrees [-90, +90]
 * @param stationLongitudeDeg Ground station longitude in degrees [-180, +180]
 * @param targetLatitudeDeg Target celestial / sub-spacecraft latitude in degrees [-90, +90]
 * @param targetLongitudeDeg Target celestial / sub-spacecraft longitude in degrees [-180, +180]
 * @param distanceMetres Geocentric distance to spacecraft in metres (defaults to interplanetary infinity)
 * @returns Elevation angle in degrees [-90, +90]
 */
export function calculateStationElevation(
  stationLatitudeDeg: number,
  stationLongitudeDeg: number,
  targetLatitudeDeg: number,
  targetLongitudeDeg: number,
  distanceMetres: number = 1e12
): number {
  if (typeof stationLatitudeDeg !== 'number' || !Number.isFinite(stationLatitudeDeg) || stationLatitudeDeg < -90 || stationLatitudeDeg > 90) {
    throw new RangeError(`calculateStationElevation: stationLatitudeDeg must be in [-90, +90]. Received: ${stationLatitudeDeg}`);
  }
  if (typeof stationLongitudeDeg !== 'number' || !Number.isFinite(stationLongitudeDeg) || stationLongitudeDeg < -180 || stationLongitudeDeg > 180) {
    throw new RangeError(`calculateStationElevation: stationLongitudeDeg must be in [-180, +180]. Received: ${stationLongitudeDeg}`);
  }
  if (typeof targetLatitudeDeg !== 'number' || !Number.isFinite(targetLatitudeDeg) || targetLatitudeDeg < -90 || targetLatitudeDeg > 90) {
    throw new RangeError(`calculateStationElevation: targetLatitudeDeg must be in [-90, +90]. Received: ${targetLatitudeDeg}`);
  }
  if (typeof targetLongitudeDeg !== 'number' || !Number.isFinite(targetLongitudeDeg) || targetLongitudeDeg < -180 || targetLongitudeDeg > 180) {
    throw new RangeError(`calculateStationElevation: targetLongitudeDeg must be in [-180, +180]. Received: ${targetLongitudeDeg}`);
  }
  if (typeof distanceMetres !== 'number' || !Number.isFinite(distanceMetres) || distanceMetres < EARTH_MEAN_RADIUS_METRES) {
    throw new RangeError(`calculateStationElevation: distanceMetres must be >= Earth radius (${EARTH_MEAN_RADIUS_METRES} m). Received: ${distanceMetres}`);
  }

  const phiS = degToRad(stationLatitudeDeg);
  const phiT = degToRad(targetLatitudeDeg);
  const deltaLambda = degToRad(targetLongitudeDeg - stationLongitudeDeg);

  // Central angle theta between station and target
  const cosTheta = Math.sin(phiS) * Math.sin(phiT) + Math.cos(phiS) * Math.cos(phiT) * Math.cos(deltaLambda);
  const clampedCosTheta = Math.max(-1, Math.min(1, cosTheta));
  const theta = Math.acos(clampedCosTheta);

  if (theta === 0) {
    return 90.0; // Directly overhead at zenith
  }
  if (theta >= Math.PI) {
    return -90.0; // Directly at nadir (opposite side of Earth)
  }

  const sinTheta = Math.sin(theta);
  const ratio = EARTH_MEAN_RADIUS_METRES / distanceMetres;
  const tanElevation = (clampedCosTheta - ratio) / sinTheta;

  return radToDeg(Math.atan(tanElevation));
}

/**
 * Evaluates whether a specific ground station has an active, usable communication link
 * opportunity to the target spacecraft at the given simulation MET.
 */
export function evaluateStationVisibility(
  station: GroundStation,
  target: SpacecraftPointingTarget,
  currentMETSeconds: number
): VisibilityResult {
  if (!station || typeof station !== 'object') {
    throw new TypeError('evaluateStationVisibility: station must be an object.');
  }
  if (!target || typeof target !== 'object') {
    throw new TypeError('evaluateStationVisibility: target must be an object.');
  }

  const elevationDeg = calculateStationElevation(
    station.latitudeDeg,
    station.longitudeDeg,
    target.subSpacecraftLatitudeDeg,
    target.subSpacecraftLongitudeDeg,
    target.distanceMetres
  );

  // Check 1: Horizon elevation angle constraint
  if (elevationDeg < station.minElevationDeg) {
    return {
      stationId: station.id,
      isVisible: false,
      elevationDeg,
      reason: `Elevation angle ${elevationDeg.toFixed(2)}° is below station horizon mask limit (${station.minElevationDeg}°).`,
    };
  }

  // Check 2: Operational availability (blackout check)
  if (!isStationAvailableAtMET(station, currentMETSeconds)) {
    return {
      stationId: station.id,
      isVisible: false,
      elevationDeg,
      reason: `Station ${station.id} is offline for scheduled maintenance or outage at MET ${currentMETSeconds} s.`,
    };
  }

  return {
    stationId: station.id,
    isVisible: true,
    elevationDeg,
  };
}

/**
 * Filters a list of ground stations and returns all currently visible stations,
 * sorted by elevation angle descending (highest elevation = best link).
 */
export function findVisibleGroundStations(
  stations: GroundStation[],
  target: SpacecraftPointingTarget,
  currentMETSeconds: number
): VisibilityResult[] {
  if (!Array.isArray(stations)) {
    throw new TypeError('findVisibleGroundStations: stations must be an array.');
  }

  const results: VisibilityResult[] = [];
  for (const station of stations) {
    const res = evaluateStationVisibility(station, target, currentMETSeconds);
    if (res.isVisible) {
      results.push(res);
    }
  }

  return results.sort((a, b) => b.elevationDeg - a.elevationDeg);
}

/**
 * Scans a time interval in discrete steps to find continuous communication windows
 * for each station.
 */
export function generateCommunicationWindows(
  stations: GroundStation[],
  targetEvaluator: (metSeconds: number) => SpacecraftPointingTarget,
  startMETSeconds: number,
  endMETSeconds: number,
  stepSeconds: number = 300 // 5-minute sampling steps
): CommunicationWindow[] {
  if (typeof startMETSeconds !== 'number' || typeof endMETSeconds !== 'number' || startMETSeconds > endMETSeconds) {
    throw new RangeError('generateCommunicationWindows: Invalid time interval bounds.');
  }
  if (stepSeconds <= 0) {
    throw new RangeError('generateCommunicationWindows: stepSeconds must be positive.');
  }

  const windows: CommunicationWindow[] = [];

  for (const station of stations) {
    let inWindow = false;
    let windowStart = 0;
    let maxElevation = 0;
    let distanceSum = 0;
    let samples = 0;

    for (let t = startMETSeconds; t <= endMETSeconds; t += stepSeconds) {
      const target = targetEvaluator(t);
      const res = evaluateStationVisibility(station, target, t);

      if (res.isVisible) {
        if (!inWindow) {
          inWindow = true;
          windowStart = t;
          maxElevation = res.elevationDeg;
          distanceSum = target.distanceMetres;
          samples = 1;
        } else {
          if (res.elevationDeg > maxElevation) {
            maxElevation = res.elevationDeg;
          }
          distanceSum += target.distanceMetres;
          samples++;
        }
      } else {
        if (inWindow) {
          inWindow = false;
          const windowEnd = t - stepSeconds;
          windows.push({
            id: `win-${station.id}-${windowStart}`,
            stationId: station.id,
            startMETSeconds: windowStart,
            endMETSeconds: windowEnd,
            durationSeconds: windowEnd - windowStart,
            maxElevationDeg: maxElevation,
            averageDistanceMetres: distanceSum / samples,
          });
        }
      }
    }

    if (inWindow) {
      windows.push({
        id: `win-${station.id}-${windowStart}`,
        stationId: station.id,
        startMETSeconds: windowStart,
        endMETSeconds: endMETSeconds,
        durationSeconds: endMETSeconds - windowStart,
        maxElevationDeg: maxElevation,
        averageDistanceMetres: distanceSum / samples,
      });
    }
  }

  return windows.sort((a, b) => a.startMETSeconds - b.startMETSeconds);
}
