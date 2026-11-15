import { describe, it, expect } from 'vitest';
import {
  transformSpacecraftPosition,
  normalizeLongitudeDeg,
} from '../src/simulation/flightSoftware/coordinateTransform';
import { EARTH_ROTATION_RATE_RAD_PER_SEC } from '../src/simulation/communications/constants';

describe('Flight Software — Coordinate Frame Contract & Transformations', () => {
  it('normalizes longitudes strictly into [-180, +180] degrees', () => {
    expect(normalizeLongitudeDeg(0)).toBe(0);
    expect(normalizeLongitudeDeg(180)).toBe(180);
    expect(normalizeLongitudeDeg(-180)).toBe(-180);
    expect(normalizeLongitudeDeg(270)).toBe(-90);
    expect(normalizeLongitudeDeg(-270)).toBe(90);
    expect(normalizeLongitudeDeg(360)).toBe(0);
    expect(normalizeLongitudeDeg(540)).toBe(180);
  });

  it('preserves coordinates without rotation when frame is ECEF', () => {
    // ECEF position should NOT have Earth sidereal rotation applied, regardless of MET!
    const ecefPos = {
      latitudeDeg: 35.0,
      longitudeDeg: -115.0,
      distanceMetres: 1e9,
      frame: 'ECEF' as const,
    };

    const targetAt0 = transformSpacecraftPosition(ecefPos, 0);
    expect(targetAt0.subSpacecraftLatitudeDeg).toBe(35.0);
    expect(targetAt0.subSpacecraftLongitudeDeg).toBe(-115.0);
    expect(targetAt0.distanceMetres).toBe(1e9);

    // After 12 hours (43200 s), an ECEF position must remain exactly the same!
    const targetAt12h = transformSpacecraftPosition(ecefPos, 43200);
    expect(targetAt12h.subSpacecraftLatitudeDeg).toBe(35.0);
    expect(targetAt12h.subSpacecraftLongitudeDeg).toBe(-115.0);

    // After 24 hours, still unchanged
    const targetAt24h = transformSpacecraftPosition(ecefPos, 86400);
    expect(targetAt24h.subSpacecraftLongitudeDeg).toBe(-115.0);
  });

  it('accurately rotates inertial ECI positions using Earth sidereal rotation rate', () => {
    const eciPos = {
      latitudeDeg: 15.0, // Declination
      longitudeDeg: 0.0, // Right ascension
      distanceMetres: 1e9,
      frame: 'ECI' as const,
    };

    // At MET = 0, ECI right ascension 0° aligns with Greenwich 0°
    const targetAt0 = transformSpacecraftPosition(eciPos, 0, 0);
    expect(targetAt0.subSpacecraftLatitudeDeg).toBe(15.0);
    expect(targetAt0.subSpacecraftLongitudeDeg).toBeCloseTo(0.0, 5);

    // Full sidereal day T = 2*pi / omega_E
    const siderealDaySeconds = (2 * Math.PI) / EARTH_ROTATION_RATE_RAD_PER_SEC; // ~86164.09 s
    const targetAt1SiderealDay = transformSpacecraftPosition(eciPos, siderealDaySeconds, 0);
    expect(targetAt1SiderealDay.subSpacecraftLongitudeDeg).toBeCloseTo(0.0, 4);

    // Half sidereal day: Earth rotates 180°, sub-spacecraft point shifts westward by 180° (-180° or +180°)
    const targetAtHalfDay = transformSpacecraftPosition(eciPos, siderealDaySeconds / 2, 0);
    expect(Math.abs(targetAtHalfDay.subSpacecraftLongitudeDeg)).toBeCloseTo(180, 4);

    // Quarter sidereal day: Earth rotates 90° eastward, sub-spacecraft point is at -90° (West)
    const targetAtQuarterDay = transformSpacecraftPosition(eciPos, siderealDaySeconds / 4, 0);
    expect(targetAtQuarterDay.subSpacecraftLongitudeDeg).toBeCloseTo(-90.0, 4);
  });

  it('rejects invalid position specifications with explicit errors', () => {
    expect(() => {
      transformSpacecraftPosition(null as any, 0);
    }).toThrow(TypeError);

    expect(() => {
      transformSpacecraftPosition(
        {
          latitudeDeg: 120, // Invalid latitude > 90
          longitudeDeg: 0,
          distanceMetres: 1e9,
          frame: 'ECI',
        },
        0
      );
    }).toThrow(RangeError);

    expect(() => {
      transformSpacecraftPosition(
        {
          latitudeDeg: 0,
          longitudeDeg: 0,
          distanceMetres: 1000, // Distance inside Earth radius
          frame: 'ECI',
        },
        0
      );
    }).toThrow(RangeError);

    expect(() => {
      transformSpacecraftPosition(
        {
          latitudeDeg: 0,
          longitudeDeg: 0,
          distanceMetres: 1e9,
          frame: 'INVALID_FRAME' as any,
        },
        0
      );
    }).toThrow(TypeError);
  });
});

