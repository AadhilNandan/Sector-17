/**
 * SECTOR 17 — Navigation & Astrodynamics Unit Tests (Phase 6.5)
 * Strict testing of orbital mechanics, rocket propulsion, interplanetary trajectories,
 * Jovian capture, Europa flyby reconnaissance, and near-vacuum lander powered descent.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateVisVivaSpeed,
  calculateCircularVelocity,
  calculateEscapeVelocity,
  calculateSpecificOrbitalEnergy,
  calculateOrbitalPeriod,
  calculatePropellantConsumed,
  calculateBurnDurationSeconds,
  calculateMaxAchievableDeltaV,
  validateManeuverFeasibility,
  calculateRelativeDistance,
  createOrbitalElements,
} from '../src/simulation/navigation/orbitalCalculations';
import {
  calculateHohmannBaselineModel,
  calculateRealisticAethonTrajectory,
} from '../src/simulation/navigation/heliocentricTrajectory';
import {
  computeJupiterCaptureState,
  validateJupiterOrbitInsertion,
  executeJupiterOrbitInsertion,
} from '../src/simulation/navigation/jupiterCaptureEngine';
import {
  computeEuropaEphemeris,
  computeAethonJovianTourState,
  evaluateEuropaRelativeMotion,
} from '../src/simulation/navigation/europaReconnaissanceEngine';
import {
  createStowedLanderState,
  deployLanderAsset,
  simulatePoweredDescent,
} from '../src/simulation/navigation/landerDescentEngine';
import {
  MU_SUN,
  MU_EARTH,
  MU_JUPITER,
  MU_EUROPA,
  RADIUS_EARTH_METRES,
  RADIUS_JUPITER_EQUATORIAL_METRES,
  RADIUS_EUROPA_METRES,
  AETHON_DRY_MASS_KG,
  AETHON_PROPELLANT_CAPACITY_KG,
  AETHON_MAIN_ENGINE_ISP_SECONDS,
  AETHON_MAIN_ENGINE_THRUST_NEWTONS,
  LANDER_DRY_MASS_KG,
  LANDER_PROPELLANT_CAPACITY_KG,
  LANDER_ENGINE_ISP_SECONDS,
} from '../src/simulation/navigation/constants';

describe('Navigation Astrodynamics & Physics Engine', () => {
  /* ------------------------------------------------------------------------ */
  /* 1. Vis-Viva & Orbital Mechanics Calculations                             */
  /* ------------------------------------------------------------------------ */
  describe('Vis-Viva and Orbital Dynamics', () => {
    it('accurately computes circular orbital velocity around Earth at 400 km altitude', () => {
      const rLeo = RADIUS_EARTH_METRES + 400_000;
      const vCirc = calculateCircularVelocity(rLeo, MU_EARTH);
      // Expected circular speed ~7.67 km/s (7668 m/s)
      expect(vCirc).toBeGreaterThan(7600);
      expect(vCirc).toBeLessThan(7750);
    });

    it('accurately computes escape velocity at Earth surface', () => {
      const vEsc = calculateEscapeVelocity(RADIUS_EARTH_METRES, MU_EARTH);
      // Expected Earth escape velocity ~11.18 km/s
      expect(vEsc).toBeGreaterThan(11_100);
      expect(vEsc).toBeLessThan(11_250);
    });

    it('computes vis-viva speed at periapsis and apoapsis for an elliptical orbit', () => {
      const rp = RADIUS_EARTH_METRES + 400_000; // 6,771 km
      const ra = RADIUS_EARTH_METRES + 35_786_000; // GTO apoapsis ~42,157 km
      const a = (rp + ra) / 2;

      const vp = calculateVisVivaSpeed(rp, a, MU_EARTH);
      const va = calculateVisVivaSpeed(ra, a, MU_EARTH);

      expect(vp).toBeGreaterThan(va);
      // GTO periapsis speed ~10.2 km/s, apoapsis speed ~1.6 km/s
      expect(vp).toBeGreaterThan(10_000);
      expect(va).toBeLessThan(2_000);
    });

    it('rejects invalid, negative, or impossible vis-viva states', () => {
      expect(() => calculateVisVivaSpeed(-1000, 10000, MU_EARTH)).toThrow(RangeError);
      expect(() => calculateVisVivaSpeed(10000, 10000, -100)).toThrow(RangeError);
      // Radius exceeding apoapsis: r > 2a for elliptic orbit
      expect(() => calculateVisVivaSpeed(30_000, 10_000, MU_EARTH)).toThrow(RangeError);
    });

    it('computes Keplerian orbital period and specific orbital energy', () => {
      const rGeo = 42_164_000; // Geostationary radius
      const period = calculateOrbitalPeriod(rGeo, MU_EARTH);
      // Geostationary period ~86,164 seconds (one sidereal day)
      expect(period).toBeGreaterThan(86_000);
      expect(period).toBeLessThan(86_400);

      const energy = calculateSpecificOrbitalEnergy(rGeo, MU_EARTH);
      expect(energy).toBeLessThan(0); // Bound orbit is negative
      expect(energy).toBeCloseTo(-MU_EARTH / (2 * rGeo), 4);
    });

    it('creates well-formed OrbitalElements structure', () => {
      const rp = RADIUS_EARTH_METRES + 500_000;
      const ra = RADIUS_EARTH_METRES + 1_500_000;
      const orbit = createOrbitalElements('EARTH', rp, ra, MU_EARTH);

      expect(orbit.centralBody).toBe('EARTH');
      expect(orbit.periapsisRadiusMetres).toBe(rp);
      expect(orbit.apoapsisRadiusMetres).toBe(ra);
      expect(orbit.semiMajorAxisMetres).toBe((rp + ra) / 2);
      expect(orbit.eccentricity).toBeCloseTo((ra - rp) / (ra + rp), 6);
      expect(orbit.orbitalPeriodSeconds).toBeGreaterThan(5000);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 2. Tsiolkovsky Rocket Equation & Feasibility Validation                  */
  /* ------------------------------------------------------------------------ */
  describe('Rocket Equation & Feasibility Validation', () => {
    it('computes propellant consumed accurately using the rocket equation', () => {
      const m0 = 4_790; // 2340 dry + 2450 prop
      const deltaV = 885.0; // JOI burn
      const isp = 325.0;

      const propConsumed = calculatePropellantConsumed(m0, deltaV, isp);
      // Analytical check: m_prop = m0 * (1 - exp(-dv / (isp*g0)))
      const expected = m0 * (1 - Math.exp(-deltaV / (isp * 9.80665)));
      expect(propConsumed).toBeCloseTo(expected, 4);
      expect(propConsumed).toBeGreaterThan(1100);
      expect(propConsumed).toBeLessThan(1200);
    });

    it('computes burn duration from thrust and mass flow rate', () => {
      const propBurned = 1150.0;
      const isp = 325.0;
      const thrust = 450.0;
      const duration = calculateBurnDurationSeconds(propBurned, isp, thrust);

      // t = m_prop * isp * g0 / thrust
      const expected = (propBurned * isp * 9.80665) / thrust;
      expect(duration).toBeCloseTo(expected, 4);
      expect(duration).toBeGreaterThan(8000);
    });

    it('validates feasible maneuver with sufficient propellant reserve', () => {
      const report = validateManeuverFeasibility(
        500.0,
        AETHON_DRY_MASS_KG,
        1500.0,
        AETHON_MAIN_ENGINE_ISP_SECONDS,
        AETHON_MAIN_ENGINE_THRUST_NEWTONS,
        { requiredMinMarginKg: 200 }
      );

      expect(report.status).toBe('PASS');
      expect(report.isFeasible).toBe(true);
      expect(report.propellantMarginKg).toBeGreaterThan(200);
      expect(report.reasons.length).toBeGreaterThan(0);
    });

    it('reports WARNING when propellant margin falls below flight safety reserve', () => {
      const report = validateManeuverFeasibility(
        1200.0,
        AETHON_DRY_MASS_KG,
        1400.0,
        AETHON_MAIN_ENGINE_ISP_SECONDS,
        AETHON_MAIN_ENGINE_THRUST_NEWTONS,
        { requiredMinMarginKg: 500 }
      );

      expect(report.status).toBe('WARNING');
      expect(report.isFeasible).toBe(true);
      expect(report.reasons.some((r) => r.includes('reserve'))).toBe(true);
    });

    it('rejects maneuver with FAIL on propellant exhaustion', () => {
      const report = validateManeuverFeasibility(
        3500.0, // High Delta-V impossible with 500 kg propellant
        AETHON_DRY_MASS_KG,
        500.0,
        AETHON_MAIN_ENGINE_ISP_SECONDS,
        AETHON_MAIN_ENGINE_THRUST_NEWTONS
      );

      expect(report.status).toBe('FAIL');
      expect(report.isFeasible).toBe(false);
      expect(report.reasons.some((r) => r.includes('Insufficient propellant'))).toBe(true);
    });

    it('rejects maneuver with FAIL when thruster isolation valves are closed (SAFE mode)', () => {
      const report = validateManeuverFeasibility(
        100.0,
        AETHON_DRY_MASS_KG,
        2000.0,
        AETHON_MAIN_ENGINE_ISP_SECONDS,
        AETHON_MAIN_ENGINE_THRUST_NEWTONS,
        { areValvesIsolated: true }
      );

      expect(report.status).toBe('FAIL');
      expect(report.isFeasible).toBe(false);
      expect(report.reasons.some((r) => r.includes('valves are closed'))).toBe(true);
    });

    it('rejects maneuver with FAIL when main engine is in FAULT status', () => {
      const report = validateManeuverFeasibility(
        100.0,
        AETHON_DRY_MASS_KG,
        2000.0,
        AETHON_MAIN_ENGINE_ISP_SECONDS,
        AETHON_MAIN_ENGINE_THRUST_NEWTONS,
        { isEngineNominal: false }
      );

      expect(report.status).toBe('FAIL');
      expect(report.isFeasible).toBe(false);
      expect(report.reasons.some((r) => r.includes('engine status is non-nominal'))).toBe(true);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 3. Heliocentric Trajectory: Hohmann vs Realistic Direct                  */
  /* ------------------------------------------------------------------------ */
  describe('Heliocentric Interplanetary Trajectory', () => {
    it('computes the theoretical Hohmann transfer and clearly identifies it as a baseline', () => {
      const hohmann = calculateHohmannBaselineModel();
      expect(hohmann.transferType).toBe('HOHMANN_BASELINE');
      expect(hohmann.isTheoreticalBaseline).toBe(true);
      expect(hohmann.transferTimeDays).toBeGreaterThan(995.0);
      expect(hohmann.transferTimeDays).toBeLessThan(1000.0);
      expect(hohmann.totalDeltaVMps).toBeGreaterThan(14_000);
      expect(hohmann.description).toContain('Theoretical two-body Hohmann transfer');
    });

    it('computes the operational high-energy AETHON direct trajectory', () => {
      const aethon = calculateRealisticAethonTrajectory();
      expect(aethon.transferType).toBe('REALISTIC_DIRECT');
      expect(aethon.isTheoreticalBaseline).toBe(false);
      expect(aethon.transferTimeDays).toBe(1180.0);
      expect(aethon.c3LaunchEnergyKm2ps2).toBeCloseTo(41.7, 1);
      expect(aethon.description).toContain('AETHON Operational High-Energy Direct Transfer');
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 4. Jupiter Arrival and Capture (JOI)                                     */
  /* ------------------------------------------------------------------------ */
  describe('Jupiter Arrival & Jovian Orbit Insertion', () => {
    it('computes hyperbolic approach and Oberth deceleration burn at perijove', () => {
      const capture = computeJupiterCaptureState({
        arrivalVelocityInfinityMps: 5643,
        perijoveRadiusMetres: 800_000_000,
        targetApojoveRadiusMetres: 14_000_000_000,
      });

      expect(capture.isCaptured).toBe(false);
      expect(capture.perijoveVelocityMps).toBeGreaterThan(18_000);
      expect(capture.captureDeltaVMps).toBeGreaterThan(800);
      expect(capture.captureDeltaVMps).toBeLessThan(1500);
      expect(capture.capturedOrbit.centralBody).toBe('JUPITER');
      expect(capture.capturedOrbit.periapsisRadiusMetres).toBe(800_000_000);
    });

    it('rejects physically impossible perijove radius inside Jupiter equatorial radius', () => {
      expect(() =>
        computeJupiterCaptureState({ perijoveRadiusMetres: RADIUS_JUPITER_EQUATORIAL_METRES - 1000 })
      ).toThrow(RangeError);
    });

    it('executes JOI burn, updates capture state, and consumes propellant', () => {
      const capture = computeJupiterCaptureState();
      const initialPropellant = 2450.0;
      const { result, updatedCaptureState, remainingPropellantKg } = executeJupiterOrbitInsertion(
        capture,
        initialPropellant,
        100_000_000
      );

      expect(result.success).toBe(true);
      expect(result.maneuverType).toBe('JUPITER_ORBIT_INSERTION');
      expect(updatedCaptureState.isCaptured).toBe(true);
      expect(remainingPropellantKg).toBeLessThan(initialPropellant);
      expect(result.propellantConsumedKg).toBeGreaterThan(1000);
    });

    it('rejects JOI execution if propellant is exhausted', () => {
      const capture = computeJupiterCaptureState();
      const initialPropellant = 200.0; // Far too low for JOI
      const { result, updatedCaptureState, remainingPropellantKg } = executeJupiterOrbitInsertion(
        capture,
        initialPropellant,
        100_000_000
      );

      expect(result.success).toBe(false);
      expect(updatedCaptureState.isCaptured).toBe(false);
      expect(remainingPropellantKg).toBe(initialPropellant); // No propellant wasted on failed ignition
      expect(result.failureReason).toContain('Insufficient propellant');
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 5. Europa Ephemeris & Reconnaissance Flyby                               */
  /* ------------------------------------------------------------------------ */
  describe('Europa Ephemeris & Reconnaissance Flyby', () => {
    it('propagates Europa Keplerian orbit around Jupiter periodically', () => {
      const ephemeris0 = computeEuropaEphemeris(0);
      const ephemeris1Period = computeEuropaEphemeris(3.551181 * 86_400); // 1 period

      expect(ephemeris0.radiusMetres).toBeCloseTo(ephemeris1Period.radiusMetres, 2);
      expect(ephemeris0.phaseAngleRad).toBeCloseTo(ephemeris1Period.phaseAngleRad, 4);
    });

    it('detects when AETHON is inside observation window during Europa close approach', () => {
      // Encounter MET where orbits align
      const relState = evaluateEuropaRelativeMotion(0, 0.5236);
      expect(relState.relativeDistanceMetres).toBeLessThan(5_000_000); // < 5,000 km
      expect(relState.isWithinObservationWindow).toBe(true);
      expect(relState.observationQualityPercent).toBeGreaterThan(0);
    });

    it('detects when AETHON is outside observation window during apojove transit', () => {
      // 7 days later (~half of resonant orbit), AETHON is far out in Jupiter orbit
      const relState = evaluateEuropaRelativeMotion(7 * 86_400, 0.5236);
      expect(relState.relativeDistanceMetres).toBeGreaterThan(5_000_000);
      expect(relState.isWithinObservationWindow).toBe(false);
      expect(relState.observationQualityPercent).toBe(0);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 6. Independent Surface Lander & Near-Vacuum Powered Descent              */
  /* ------------------------------------------------------------------------ */
  describe('Independent Lander Asset & Near-Vacuum Powered Descent', () => {
    it('initializes separate lander in STOWED status with independent mass budget', () => {
      const lander = createStowedLanderState();
      expect(lander.flightState).toBe('STOWED');
      expect(lander.dryMassKg).toBe(LANDER_DRY_MASS_KG);
      expect(lander.propellantRemainingKg).toBe(LANDER_PROPELLANT_CAPACITY_KG);
      expect(lander.totalMassKg).toBe(LANDER_DRY_MASS_KG + LANDER_PROPELLANT_CAPACITY_KG);
      expect(lander.remainingDeltaVCapacityMps).toBeGreaterThan(1900); // ~1,964 m/s
    });

    it('deploys the lander asset into DEPLOYED status', () => {
      const stowed = createStowedLanderState();
      const deployed = deployLanderAsset(stowed, {
        deploymentMET: 105_000_000,
        targetLandingSite: 'Pelagon Chaos Plains',
      });

      expect(deployed.flightState).toBe('DEPLOYED');
      expect(deployed.deployedAtMET).toBe(105_000_000);
      expect(deployed.targetLandingSite).toBe('Pelagon Chaos Plains');
    });

    it('rejects double-deployment from an already deployed lander', () => {
      const stowed = createStowedLanderState();
      const deployed = deployLanderAsset(stowed, { deploymentMET: 105_000_000 });
      expect(() => deployLanderAsset(deployed, { deploymentMET: 106_000_000 })).toThrow();
    });

    it('simulates nominal near-vacuum powered descent to soft touchdown', () => {
      const stowed = createStowedLanderState();
      const deployed = deployLanderAsset(stowed, {
        deploymentMET: 105_000_000,
        terrainHazardFactor: 0.18, // Smooth plain
      });

      // Strict enforcement of parking orbit prerequisite (CRIT-01)
      expect(() => simulatePoweredDescent(deployed, 105_003_600)).toThrow(
        /parking-orbit prerequisite not authorized/
      );

      // Explicitly authorize prerequisite
      const authorizedDeployed = {
        ...deployed,
        parkingOrbitPrerequisiteMet: true,
      };

      const { updatedState, profile } = simulatePoweredDescent(authorizedDeployed, 105_003_600);

      expect(updatedState.flightState).toBe('TOUCHDOWN');
      expect(profile.isTouchdownSafe).toBe(true);
      expect(profile.touchdownVerticalVelocityMps).toBeGreaterThan(-2.5); // Safe vertical speed
      expect(profile.touchdownHorizontalVelocityMps).toBeLessThan(0.5); // Safe horizontal drift
      expect(updatedState.propellantRemainingKg).toBeGreaterThan(0); // Non-zero fuel margin
      expect(updatedState.touchdownAtMET).toBeGreaterThan(105_003_600);
    });

    it('fails near-vacuum descent with CRASHED on propellant exhaustion', () => {
      const stowed = createStowedLanderState();
      // Artificially starve propellant onboard lander
      const starvedLander = {
        ...stowed,
        propellantRemainingKg: 150.0, // Needs ~380 kg
        totalMassKg: LANDER_DRY_MASS_KG + 150.0,
        parkingOrbitPrerequisiteMet: true,
      };
      const deployed = deployLanderAsset(starvedLander, { deploymentMET: 105_000_000 });

      const { updatedState, profile } = simulatePoweredDescent(deployed, 105_003_600);

      expect(updatedState.flightState).toBe('CRASHED');
      expect(profile.isTouchdownSafe).toBe(false);
      expect(updatedState.propellantRemainingKg).toBe(0);
      expect(updatedState.failureReason).toContain('propellant depletion');
    });

    it('fails near-vacuum descent with CRASHED on severe terrain hazard', () => {
      const stowed = createStowedLanderState();
      const hazardousDeployed = {
        ...deployLanderAsset(stowed, {
          deploymentMET: 105_000_000,
          terrainHazardFactor: 0.85, // Highly fractured chaos terrain
        }),
        parkingOrbitPrerequisiteMet: true,
      };

      const { updatedState, profile } = simulatePoweredDescent(hazardousDeployed, 105_003_600);

      expect(updatedState.flightState).toBe('CRASHED');
      expect(profile.isTouchdownSafe).toBe(false);
      expect(updatedState.failureReason).toContain('topography hazard');
    });
  });
});
