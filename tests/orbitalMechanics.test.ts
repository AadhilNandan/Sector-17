import { describe, it, expect } from 'vitest';
import {
  auToMetres,
  metresToAu,
  secondsToDays,
  daysToYears,
  kmPerSecToMetersPerSec,
  metersPerSecToKmPerSec,
  calculateVisVivaVelocity,
  calculateC3FromVInfinity,
  calculateVInfinityFromC3,
  km2ps2ToM2ps2,
  m2ps2ToKm2ps2,
  calculateHohmannTransfer,
} from '../src/simulation/physics/orbitalMechanics';
import {
  ASTRONOMICAL_UNIT_METRES,
  MU_SUN,
  EARTH_ORBITAL_RADIUS_M,
  JUPITER_ORBITAL_RADIUS_M,
} from '../src/simulation/constants';

describe('Orbital Mechanics Unit Conversions', () => {
  it('converts Astronomical Units (AU) to metres and back', () => {
    const oneAuMetres = auToMetres(1.0);
    expect(oneAuMetres).toBe(ASTRONOMICAL_UNIT_METRES);
    expect(oneAuMetres).toBe(149_597_870_700);
    expect(metresToAu(oneAuMetres)).toBe(1.0);

    const fivePointTwoAu = auToMetres(5.2);
    expect(metresToAu(fivePointTwoAu)).toBeCloseTo(5.2, 10);
  });

  it('converts seconds to days and days to years', () => {
    expect(secondsToDays(86_400)).toBe(1.0);
    expect(secondsToDays(172_800)).toBe(2.0);
    expect(daysToYears(365.25)).toBe(1.0);
    expect(daysToYears(730.5)).toBe(2.0);
  });

  it('converts velocities between km/s and m/s', () => {
    expect(kmPerSecToMetersPerSec(28.4)).toBe(28_400);
    expect(metersPerSecToKmPerSec(28_400)).toBe(28.4);
    expect(kmPerSecToMetersPerSec(3.9)).toBe(3_900);
    expect(metersPerSecToKmPerSec(3_900)).toBe(3.9);
  });

  it('rejects non-finite inputs in unit conversions', () => {
    expect(() => auToMetres(NaN)).toThrow(TypeError);
    expect(() => metresToAu(Infinity)).toThrow(TypeError);
    expect(() => secondsToDays(-Infinity)).toThrow(TypeError);
    expect(() => daysToYears(NaN)).toThrow(TypeError);
    expect(() => kmPerSecToMetersPerSec(NaN)).toThrow(TypeError);
    expect(() => metersPerSecToKmPerSec(NaN)).toThrow(TypeError);
  });
});

describe('Vis-Viva Equation', () => {
  it('calculates Earth mean circular orbital speed at 1 AU', () => {
    // For a circular orbit, r = a = 1 AU
    // v = sqrt(mu_sun / r) = sqrt(1.32712440018e20 / 149597870700) ~ 29,784.7 m/s (29.78 km/s)
    const vEarth = calculateVisVivaVelocity(EARTH_ORBITAL_RADIUS_M, EARTH_ORBITAL_RADIUS_M, MU_SUN);
    expect(vEarth).toBeCloseTo(29_784.7, 0);
  });

  it('calculates Jupiter circular orbital speed at 5.2 AU', () => {
    // v = sqrt(mu_sun / r) = sqrt(1.32712440018e20 / 777908927640) ~ 13,061.45 m/s (13.06 km/s)
    const vJupiter = calculateVisVivaVelocity(
      JUPITER_ORBITAL_RADIUS_M,
      JUPITER_ORBITAL_RADIUS_M,
      MU_SUN
    );
    expect(vJupiter).toBeCloseTo(13_061.5, 0);
  });

  it('rejects physically invalid orbital parameters', () => {
    // Negative radius
    expect(() => calculateVisVivaVelocity(-100, 1000)).toThrow(RangeError);
    expect(() => calculateVisVivaVelocity(0, 1000)).toThrow(RangeError);

    // Negative mu
    expect(() => calculateVisVivaVelocity(1000, 1000, -MU_SUN)).toThrow(RangeError);
    expect(() => calculateVisVivaVelocity(1000, 1000, 0)).toThrow(RangeError);

    // Impossible elliptical state: r > 2a
    // If a = 100 m, maximum possible apoapsis distance is 2a = 200 m
    expect(() => calculateVisVivaVelocity(300, 100, MU_SUN)).toThrow(RangeError);
  });
});

describe('Hyperbolic Excess Velocity and C3 Conversions', () => {
  it('computes C3 from vInfinity and back accurately', () => {
    // Europa Clipper launch excess velocity vInfinity ~ 6.457 km/s (6457 m/s)
    // C3 = (6457 m/s)^2 = 41.69e6 m²/s² = 41.69 km²/s²
    const vInfMps = 6_457.55;
    const c3M2ps2 = calculateC3FromVInfinity(vInfMps);
    expect(c3M2ps2).toBeCloseTo(41.7e6, -3);

    const backToVInf = calculateVInfinityFromC3(c3M2ps2);
    expect(backToVInf).toBeCloseTo(vInfMps, 2);

    expect(m2ps2ToKm2ps2(c3M2ps2)).toBeCloseTo(41.7, 1);
    expect(km2ps2ToM2ps2(41.7)).toBe(41.7e6);
  });

  it('handles boundary condition vInfinity = 0', () => {
    expect(calculateC3FromVInfinity(0)).toBe(0);
    expect(calculateVInfinityFromC3(0)).toBe(0);
  });

  it('rejects negative values for C3 and vInfinity', () => {
    expect(() => calculateC3FromVInfinity(-10)).toThrow(RangeError);
    expect(() => calculateVInfinityFromC3(-50)).toThrow(RangeError);
    expect(() => km2ps2ToM2ps2(-5)).toThrow(RangeError);
    expect(() => m2ps2ToKm2ps2(-5)).toThrow(RangeError);
  });
});

describe('Earth-to-Jupiter Hohmann Transfer Reference Case', () => {
  it('mathematically derives the Earth-to-Jupiter transfer duration of ~996.8 days', () => {
    const result = calculateHohmannTransfer({
      r1: EARTH_ORBITAL_RADIUS_M, // 1.0 AU
      r2: JUPITER_ORBITAL_RADIUS_M, // 5.2 AU
      mu: MU_SUN,
    });

    // 1. Semi-major axis: a = (1.0 + 5.2) / 2 = 3.1 AU
    expect(result.semiMajorAxisMetres).toBeCloseTo(3.1 * ASTRONOMICAL_UNIT_METRES, -2);

    // 2. Transfer duration: T = pi * sqrt(a^3 / mu)
    // 3.1 AU transfer duration in days must agree with ~996.8 days within 0.1%
    const expectedDays = 996.81;
    expect(result.transferTimeDays).toBeCloseTo(expectedDays, 1);
    expect(Math.abs(result.transferTimeDays - expectedDays) / expectedDays).toBeLessThan(0.001);

    // In Julian years: ~2.729 years
    expect(result.transferTimeYears).toBeCloseTo(2.729, 2);

    // 3. Velocity check:
    // Earth circular speed: 29.78 km/s
    expect(result.initialCircularVelocityMps).toBeCloseTo(29_784.7, 0);

    // Jupiter circular speed: 13.061 km/s (13,061.5 m/s)
    expect(result.finalCircularVelocityMps).toBeCloseTo(13_061.5, 0);

    // Perihelion transfer velocity: v_t1 = sqrt(mu * (2/r1 - 1/a)) ~ 38,575.7 m/s (38.58 km/s)
    expect(result.initialTransferVelocityMps).toBeCloseTo(38_575.7, 0);

    // Aphelion transfer velocity: v_t2 = sqrt(mu * (2/r2 - 1/a)) ~ 7,418.4 m/s (7.42 km/s)
    expect(result.finalTransferVelocityMps).toBeCloseTo(7_418.4, 0);

    // Delta-V1 (departure impulse from 1 AU heliocentric orbit): |38.58 - 29.78| ~ 8.79 km/s
    expect(result.departureDeltaVMps).toBeCloseTo(8_791.0, 0);

    // Delta-V2 (arrival impulse to circularize at 5.2 AU): |13.06 - 7.42| ~ 5.64 km/s
    expect(result.arrivalDeltaVMps).toBeCloseTo(5_643.0, 0);

    // Total heliocentric transfer Delta-V: ~14.43 km/s
    expect(result.totalDeltaVMps).toBeCloseTo(14_434.1, 0);
  });

  it('rejects invalid inputs in Hohmann transfer', () => {
    expect(() => calculateHohmannTransfer({ r1: -1, r2: 5 })).toThrow(RangeError);
    expect(() => calculateHohmannTransfer({ r1: 1, r2: 0 })).toThrow(RangeError);
    expect(() => calculateHohmannTransfer({ r1: 1, r2: 5, mu: -MU_SUN })).toThrow(RangeError);
  });
});
