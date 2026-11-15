/**
 * SECTOR 17 — Jupiter Arrival & Orbit Insertion (JOI) Engine
 * Models hyperbolic approach to Jupiter, Oberth-effect deceleration burn at perijove,
 * resulting captured orbital elements, and propellant consumption validation.
 *
 * All functions operate in standard SI units internally.
 */

import { MU_JUPITER } from '../constants';
import {
  RADIUS_JUPITER_EQUATORIAL_METRES,
  AETHON_DRY_MASS_KG,
  AETHON_MAIN_ENGINE_ISP_SECONDS,
  AETHON_MAIN_ENGINE_THRUST_NEWTONS,
  AETHON_MIN_PROPELLANT_MARGIN_PERCENT,
  AETHON_PROPELLANT_CAPACITY_KG,
} from './constants';
import {
  createOrbitalElements,
  validateManeuverFeasibility,
  calculateVisVivaSpeed,
  assertFinitePositive,
} from './orbitalCalculations';
import type {
  JupiterCaptureState,
  OrbitalElements,
  ManeuverValidationReport,
  ManeuverExecutionResult,
} from './types';

export interface JupiterArrivalParams {
  arrivalVelocityInfinityMps?: number;
  perijoveRadiusMetres?: number;
  targetApojoveRadiusMetres?: number;
}

/**
 * Computes the theoretical hyperbolic arrival and insertion burn required for Jupiter capture.
 *
 * Physics & Equations:
 * - Hyperbolic perijove velocity: v_hyp = sqrt(v_inf² + 2*mu_J / r_p)  [Energy conservation]
 * - Elliptic captured perijove velocity: v_ell = sqrt(mu_J * (2/r_p - 1/a)) [Vis-viva]
 * - Deceleration Delta-V: DeltaV_JOI = v_hyp - v_ell  [Oberth-effect capture burn]
 */
export function computeJupiterCaptureState(params?: JupiterArrivalParams): JupiterCaptureState {
  // Nominal Galileo / Europa Clipper style Jovian approach
  const vInf = params?.arrivalVelocityInfinityMps ?? 5_643; // m/s (~5.64 km/s)
  // Perijove set at ~800,000 km (~11.2 Jupiter radii), safe from interior radiation belt peak
  const rp = params?.perijoveRadiusMetres ?? 800_000_000;
  // Apojove set to resonant Jovian tour ellipse (~14,000,000 km)
  const ra = params?.targetApojoveRadiusMetres ?? 14_000_000_000;

  assertFinitePositive(vInf, 'Hyperbolic arrival velocity vInf');
  assertFinitePositive(rp, 'Perijove radius rp');
  assertFinitePositive(ra, 'Apojove radius ra');

  if (rp <= RADIUS_JUPITER_EQUATORIAL_METRES) {
    throw new RangeError(
      `Perijove radius (${rp} m) must be above Jupiter's equatorial surface (${RADIUS_JUPITER_EQUATORIAL_METRES} m).`
    );
  }

  // Hyperbolic approach speed at perijove
  const perijoveVelocityHyperbola = Math.sqrt(vInf * vInf + (2 * MU_JUPITER) / rp);

  // Target captured ellipse semi-major axis
  const semiMajorAxisMetres = (rp + ra) / 2;

  // Elliptic speed at perijove
  const perijoveVelocityEllipse = calculateVisVivaSpeed(rp, semiMajorAxisMetres, MU_JUPITER);

  // Required deceleration burn Delta-V
  const captureDeltaVMps = perijoveVelocityHyperbola - perijoveVelocityEllipse;

  const capturedOrbit: OrbitalElements = createOrbitalElements(
    'JUPITER',
    rp,
    ra,
    MU_JUPITER,
    0.087, // ~5 degrees inclination
    0.0
  );

  return {
    arrivalVelocityInfinityMps: vInf,
    perijoveRadiusMetres: rp,
    perijoveAltitudeMetres: rp - RADIUS_JUPITER_EQUATORIAL_METRES,
    perijoveVelocityMps: perijoveVelocityHyperbola,
    captureDeltaVMps,
    capturedOrbit,
    isCaptured: false,
  };
}

/**
 * Validates whether AETHON has the propulsion capability to execute the JOI burn.
 */
export function validateJupiterOrbitInsertion(
  captureState: JupiterCaptureState,
  propellantRemainingKg: number,
  options?: {
    areValvesIsolated?: boolean;
    isEngineNominal?: boolean;
    dryMassKg?: number;
    ispSeconds?: number;
    thrustNewtons?: number;
  }
): ManeuverValidationReport {
  const dryMass = options?.dryMassKg ?? AETHON_DRY_MASS_KG;
  const isp = options?.ispSeconds ?? AETHON_MAIN_ENGINE_ISP_SECONDS;
  const thrust = options?.thrustNewtons ?? AETHON_MAIN_ENGINE_THRUST_NEWTONS;
  const minReserveMargin = (options?.dryMassKg ? options.dryMassKg : AETHON_PROPELLANT_CAPACITY_KG) * AETHON_MIN_PROPELLANT_MARGIN_PERCENT;

  return validateManeuverFeasibility(
    captureState.captureDeltaVMps,
    dryMass,
    propellantRemainingKg,
    isp,
    thrust,
    {
      areValvesIsolated: options?.areValvesIsolated,
      isEngineNominal: options?.isEngineNominal,
      requiredMinMarginKg: minReserveMargin,
    }
  );
}

/**
 * Executes the JOI maneuver if physically feasible.
 * Returns ManeuverExecutionResult with resulting captured orbit and propellant consumed.
 */
export function executeJupiterOrbitInsertion(
  captureState: JupiterCaptureState,
  currentPropellantKg: number,
  currentMETSeconds: number,
  options?: {
    areValvesIsolated?: boolean;
    isEngineNominal?: boolean;
    dryMassKg?: number;
    ispSeconds?: number;
    thrustNewtons?: number;
  }
): {
  result: ManeuverExecutionResult;
  updatedCaptureState: JupiterCaptureState;
  remainingPropellantKg: number;
} {
  const validation = validateJupiterOrbitInsertion(captureState, currentPropellantKg, options);

  if (!validation.isFeasible) {
    const failedResult: ManeuverExecutionResult = {
      success: false,
      maneuverId: 'mnv-joi-01',
      maneuverType: 'JUPITER_ORBIT_INSERTION',
      executedAtMET: currentMETSeconds,
      actualDeltaVMps: 0,
      propellantConsumedKg: 0,
      validationReport: validation,
      failureReason: validation.reasons.join('; '),
    };

    return {
      result: failedResult,
      updatedCaptureState: captureState,
      remainingPropellantKg: currentPropellantKg,
    };
  }

  const updatedCaptureState: JupiterCaptureState = {
    ...captureState,
    isCaptured: true,
    captureBurnExecutedAtMET: currentMETSeconds,
  };

  const remainingPropellantKg = Math.max(0, currentPropellantKg - validation.requiredPropellantKg);

  const successResult: ManeuverExecutionResult = {
    success: true,
    maneuverId: 'mnv-joi-01',
    maneuverType: 'JUPITER_ORBIT_INSERTION',
    executedAtMET: currentMETSeconds,
    actualDeltaVMps: captureState.captureDeltaVMps,
    propellantConsumedKg: validation.requiredPropellantKg,
    resultingOrbit: captureState.capturedOrbit,
    validationReport: validation,
  };

  return {
    result: successResult,
    updatedCaptureState,
    remainingPropellantKg,
  };
}
