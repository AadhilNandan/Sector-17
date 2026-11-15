/**
 * SECTOR 17 — Coordinate Frame Transformation Module
 * Establishes and strictly enforces the coordinate-frame contract between
 * Earth-Centered Inertial (ECI) celestial coordinates and Earth-Centered,
 * Earth-Fixed (ECEF) geographic coordinates.
 *
 * COORDINATE-FRAME CONTRACT:
 * 1. Ground stations are geographically fixed in ECEF (latitude, longitude).
 * 2. If spacecraft position is provided in 'ECEF':
 *    - The coordinates are ALREADY Earth-fixed.
 *    - Earth sidereal rotation MUST NOT be reapplied.
 * 3. If spacecraft position is provided in 'ECI':
 *    - The coordinates are celestial inertial coordinates (declination delta, right ascension alpha).
 *    - ECEF sub-spacecraft longitude lambda_ECEF is computed by subtracting Earth sidereal rotation:
 *        theta_E(t) = (omega_E * t * 180 / pi + theta_0) mod 360°
 *        lambda_ECEF = (alpha - theta_E(t)) mod 360°, normalized to [-180°, +180°].
 *    - Declination translates directly to geocentric sub-spacecraft latitude for a spherical Earth:
 *        phi_ECEF = delta.
 * 4. This prevents the critical flaw of treating an ECEF position as inertial, or double-rotating an ECEF vector.
 */

import { EARTH_ROTATION_RATE_RAD_PER_SEC } from '../communications/constants';
import { EARTH_MEAN_RADIUS_METRES } from '../communications/communicationWindows';
import type { SpacecraftPointingTarget } from '../communications/types';
import type { SpacecraftPositionState } from './types';

/**
 * Normalizes an angle in degrees into standard geographic longitude range [-180, +180].
 */
export function normalizeLongitudeDeg(lonDeg: number): number {
  if (typeof lonDeg !== 'number' || !Number.isFinite(lonDeg)) {
    throw new TypeError(`normalizeLongitudeDeg: Longitude must be a finite number. Received: ${lonDeg}`);
  }
  let normalized = lonDeg % 360;
  if (normalized > 180) {
    normalized -= 360;
  } else if (normalized < -180) {
    normalized += 360;
  }
  return normalized;
}

/**
 * Transforms a spacecraft position state into an ECEF SpacecraftPointingTarget
 * suitable for ground station visibility and link budget evaluations.
 *
 * @param position Spacecraft position specification (ECI or ECEF)
 * @param currentMETSeconds Mission elapsed time in SI seconds
 * @param initialGreenwichSiderealDeg Greenwich Sidereal Angle at MET = 0 (degrees, default 0)
 * @returns SpacecraftPointingTarget in ECEF frame
 */
export function transformSpacecraftPosition(
  position: SpacecraftPositionState,
  currentMETSeconds: number,
  initialGreenwichSiderealDeg: number = 0
): SpacecraftPointingTarget {
  if (!position || typeof position !== 'object') {
    throw new TypeError('transformSpacecraftPosition: position must be an object.');
  }

  if (typeof position.latitudeDeg !== 'number' || !Number.isFinite(position.latitudeDeg) || position.latitudeDeg < -90 || position.latitudeDeg > 90) {
    throw new RangeError(`transformSpacecraftPosition: latitudeDeg must be in [-90, +90]. Received: ${position.latitudeDeg}`);
  }

  if (typeof position.longitudeDeg !== 'number' || !Number.isFinite(position.longitudeDeg)) {
    throw new TypeError(`transformSpacecraftPosition: longitudeDeg must be a finite number. Received: ${position.longitudeDeg}`);
  }

  if (typeof position.distanceMetres !== 'number' || !Number.isFinite(position.distanceMetres) || position.distanceMetres < EARTH_MEAN_RADIUS_METRES) {
    throw new RangeError(
      `transformSpacecraftPosition: distanceMetres must be >= Earth radius (${EARTH_MEAN_RADIUS_METRES} m). Received: ${position.distanceMetres}`
    );
  }

  if (typeof currentMETSeconds !== 'number' || !Number.isFinite(currentMETSeconds) || currentMETSeconds < 0) {
    throw new TypeError(`transformSpacecraftPosition: currentMETSeconds must be a non-negative finite number. Received: ${currentMETSeconds}`);
  }

  if (position.frame === 'ECEF') {
    // Coordinate is ALREADY in Earth-Fixed frame. DO NOT rotate!
    return {
      subSpacecraftLatitudeDeg: position.latitudeDeg,
      subSpacecraftLongitudeDeg: normalizeLongitudeDeg(position.longitudeDeg),
      distanceMetres: position.distanceMetres,
    };
  }

  if (position.frame === 'ECI') {
    // Coordinate is in Inertial frame. Rotate Earth under the spacecraft:
    // omega_E in deg/s = omega_rad * 180 / pi
    const rotationRateDegPerSec = (EARTH_ROTATION_RATE_RAD_PER_SEC * 180) / Math.PI;
    const earthRotationDeg = (rotationRateDegPerSec * currentMETSeconds + initialGreenwichSiderealDeg) % 360;

    // Sub-spacecraft longitude moves westward relative to Earth surface as Earth rotates eastward:
    const ecefLongitude = normalizeLongitudeDeg(position.longitudeDeg - earthRotationDeg);

    return {
      subSpacecraftLatitudeDeg: position.latitudeDeg,
      subSpacecraftLongitudeDeg: ecefLongitude,
      distanceMetres: position.distanceMetres,
    };
  }

  throw new TypeError(`transformSpacecraftPosition: Unsupported coordinate frame '${(position as any).frame}'. Must be 'ECI' or 'ECEF'.`);
}

