/**
 * SECTOR 17 — Independent Surface Lander & Near-Vacuum Powered Descent Engine
 * Models deployment from carrier spacecraft AETHON, deorbit burn, and near-vacuum
 * rocket powered descent to Europa's icy crust.
 *
 * CRITICAL SCIENTIFIC CONSTRAINTS:
 * 1. Europa has no dense atmosphere (surface pressure ~10⁻¹² bar).
 *    Aerodynamic drag is ZERO. Parachutes and heat shields are physically inoperable.
 * 2. 100% of orbital velocity cancellation (~1.4 km/s) and gravity-loss compensation
 *    must be accomplished via rocket propulsion.
 * 3. Touchdown requires validated velocity vectors and terrain clearance.
 *
 * All functions operate in standard SI units internally.
 */

import {
  LANDER_DRY_MASS_KG,
  LANDER_PROPELLANT_CAPACITY_KG,
  LANDER_INITIAL_WET_MASS_KG,
  LANDER_ENGINE_ISP_SECONDS,
  LANDER_ENGINE_MAX_THRUST_NEWTONS,
} from './constants';
import {
  calculatePropellantConsumed,
  calculateBurnDurationSeconds,
  calculateMaxAchievableDeltaV,
} from './orbitalCalculations';
import type { LanderState } from './types';

export interface LanderDeploymentParams {
  deploymentMET: number;
  targetLandingSite?: string;
  terrainHazardFactor?: number;
}

export interface LanderDescentProfile {
  deorbitDeltaVMps: number;
  poweredDescentDeltaVMps: number;
  totalRequiredDeltaVMps: number;
  totalPropellantBurnedKg: number;
  burnDurationSeconds: number;
  touchdownVerticalVelocityMps: number;
  touchdownHorizontalVelocityMps: number;
  isTouchdownSafe: boolean;
  reasons: string[];
}

/**
 * Creates the initial stowed state of the Europa lander aboard AETHON.
 */
export function createStowedLanderState(): LanderState {
  const maxDeltaV = calculateMaxAchievableDeltaV(
    LANDER_DRY_MASS_KG,
    LANDER_PROPELLANT_CAPACITY_KG,
    LANDER_ENGINE_ISP_SECONDS
  );

  return {
    flightState: 'STOWED',
    dryMassKg: LANDER_DRY_MASS_KG,
    propellantRemainingKg: LANDER_PROPELLANT_CAPACITY_KG,
    propellantCapacityKg: LANDER_PROPELLANT_CAPACITY_KG,
    totalMassKg: LANDER_INITIAL_WET_MASS_KG,
    altitudeMetres: 100_000, // Stowed in AETHON flyby transit (100 km)
    verticalVelocityMps: 0,
    horizontalVelocityMps: 0,
    targetLandingSite: 'Pelagon Chaos Smooth Plains',
    terrainHazardFactor: 0.22, // Low-hazard smooth cryo-plain
    descentDeltaVExpendedMps: 0,
    remainingDeltaVCapacityMps: maxDeltaV,
    parkingOrbitPrerequisiteMet: false,
    parkingOrbitAssumptionNotice:
      'MISSION PREREQUISITE (SIMPLIFIED): Powered descent begins from an assumed 100 km circular Europa parking orbit. Direct atmospheric capture is physically impossible in Europa near-vacuum, and AETHON hyperbolic flyby excess velocity (~4.4 km/s) requires external staging or dedicated insertion.',
  };
}

/**
 * Deploys the independent lander asset from carrier AETHON.
 */
export function deployLanderAsset(
  currentState: LanderState,
  params: LanderDeploymentParams
): LanderState {
  if (currentState.flightState !== 'STOWED') {
    throw new Error(`Cannot deploy lander: current flight state is ${currentState.flightState}, expected STOWED.`);
  }

  const maxDeltaV = calculateMaxAchievableDeltaV(
    currentState.dryMassKg,
    currentState.propellantRemainingKg,
    LANDER_ENGINE_ISP_SECONDS
  );

  return {
    ...currentState,
    flightState: 'DEPLOYED',
    deployedAtMET: params.deploymentMET,
    targetLandingSite: params.targetLandingSite ?? currentState.targetLandingSite,
    terrainHazardFactor: params.terrainHazardFactor ?? currentState.terrainHazardFactor,
    remainingDeltaVCapacityMps: maxDeltaV,
  };
}

/**
 * Simulates near-vacuum rocket powered descent and touchdown mechanics.
 *
 * Physics & Equations:
 * - Orbital velocity at 100 km: v_circ = sqrt(mu_E / (R_E + 100km)) ~ 1,388.7 m/s
 * - Deorbit impulse DeltaV_deorbit: ~45 m/s (lowers periapsis to 15 km)
 * - Powered Braking DeltaV_brake: v_circ + gravity loss (g_E * t_burn) ~ 1,820 m/s
 * - Total Delta-V: ~1,865 m/s
 * - Propellant burned: calculated via Tsiolkovsky equation
 */
export function simulatePoweredDescent(
  landerState: LanderState,
  descentMET: number,
  overrideThrustPercent: number = 1.0
): {
  updatedState: LanderState;
  profile: LanderDescentProfile;
} {
  if (landerState.flightState !== 'DEPLOYED' && landerState.flightState !== 'DEORBITING') {
    throw new Error(`Cannot initiate powered descent: lander is in state ${landerState.flightState}`);
  }

  if (landerState.parkingOrbitPrerequisiteMet !== true) {
    throw new Error(
      'Cannot initiate powered descent: 100 km Europa parking-orbit prerequisite not authorized. AETHON carrier flyby velocity (~4.4 km/s) requires circular parking orbit staging.'
    );
  }

  const reasons: string[] = [];

  // Required near-vacuum descent Delta-V
  const deorbitDeltaVMps = 48.0;
  // Powered braking + gravity losses (1.315 m/s² * ~320s burn)
  const poweredDescentDeltaVMps = 1_825.0;
  const totalRequiredDeltaVMps = deorbitDeltaVMps + poweredDescentDeltaVMps;

  // Propellant required via rocket equation
  const requiredPropellantKg = calculatePropellantConsumed(
    landerState.totalMassKg,
    totalRequiredDeltaVMps,
    LANDER_ENGINE_ISP_SECONDS
  );

  const availablePropellant = landerState.propellantRemainingKg;
  const burnDurationSeconds = calculateBurnDurationSeconds(
    Math.min(requiredPropellantKg, availablePropellant),
    LANDER_ENGINE_ISP_SECONDS,
    LANDER_ENGINE_MAX_THRUST_NEWTONS * overrideThrustPercent
  );

  // Check propellant margin
  if (requiredPropellantKg > availablePropellant) {
    reasons.push(
      `Propellant exhaustion during descent: needed ${requiredPropellantKg.toFixed(1)} kg, but only ${availablePropellant.toFixed(1)} kg onboard.`
    );
    const crashedState: LanderState = {
      ...landerState,
      flightState: 'CRASHED',
      propellantRemainingKg: 0,
      totalMassKg: landerState.dryMassKg,
      altitudeMetres: 0,
      verticalVelocityMps: -45.0, // High-speed impact
      horizontalVelocityMps: 18.0,
      descentDeltaVExpendedMps: calculateMaxAchievableDeltaV(
        landerState.dryMassKg,
        availablePropellant,
        LANDER_ENGINE_ISP_SECONDS
      ),
      remainingDeltaVCapacityMps: 0,
      failureReason: 'Terminal propellant depletion prior to vertical velocity cancellation.',
    };

    return {
      updatedState: crashedState,
      profile: {
        deorbitDeltaVMps,
        poweredDescentDeltaVMps,
        totalRequiredDeltaVMps,
        totalPropellantBurnedKg: availablePropellant,
        burnDurationSeconds,
        touchdownVerticalVelocityMps: -45.0,
        touchdownHorizontalVelocityMps: 18.0,
        isTouchdownSafe: false,
        reasons,
      },
    };
  }

  // Check terrain hazard
  if (landerState.terrainHazardFactor > 0.65) {
    reasons.push(
      `High terrain roughness at landing zone (${landerState.terrainHazardFactor.toFixed(2)}): landing gear overturned on ice crevasse.`
    );
    const tippedState: LanderState = {
      ...landerState,
      flightState: 'CRASHED',
      propellantRemainingKg: availablePropellant - requiredPropellantKg,
      totalMassKg: landerState.totalMassKg - requiredPropellantKg,
      altitudeMetres: 0,
      verticalVelocityMps: -2.8,
      horizontalVelocityMps: 1.2,
      descentDeltaVExpendedMps: totalRequiredDeltaVMps,
      remainingDeltaVCapacityMps: calculateMaxAchievableDeltaV(
        landerState.dryMassKg,
        availablePropellant - requiredPropellantKg,
        LANDER_ENGINE_ISP_SECONDS
      ),
      touchdownAtMET: descentMET + burnDurationSeconds,
      failureReason: 'Structural landing gear collapse due to severe surface topography hazard.',
    };

    return {
      updatedState: tippedState,
      profile: {
        deorbitDeltaVMps,
        poweredDescentDeltaVMps,
        totalRequiredDeltaVMps,
        totalPropellantBurnedKg: requiredPropellantKg,
        burnDurationSeconds,
        touchdownVerticalVelocityMps: -2.8,
        touchdownHorizontalVelocityMps: 1.2,
        isTouchdownSafe: false,
        reasons,
      },
    };
  }

  // Nominal Safe Touchdown
  const touchdownVerticalVelocityMps = -1.4; // Well within 2.5 m/s limit
  const touchdownHorizontalVelocityMps = 0.15; // Within 0.5 m/s limit
  const remainingPropellantKg = availablePropellant - requiredPropellantKg;
  const touchdownMET = descentMET + burnDurationSeconds;

  reasons.push(
    `Nominal near-vacuum touchdown confirmed at ${landerState.targetLandingSite}. Descent Delta-V: ${totalRequiredDeltaVMps.toFixed(1)} m/s, residual propellant: ${remainingPropellantKg.toFixed(1)} kg.`
  );

  const landedState: LanderState = {
    ...landerState,
    flightState: 'TOUCHDOWN',
    propellantRemainingKg: remainingPropellantKg,
    totalMassKg: landerState.dryMassKg + remainingPropellantKg,
    altitudeMetres: 0,
    verticalVelocityMps: 0,
    horizontalVelocityMps: 0,
    descentDeltaVExpendedMps: totalRequiredDeltaVMps,
    remainingDeltaVCapacityMps: calculateMaxAchievableDeltaV(
      landerState.dryMassKg,
      remainingPropellantKg,
      LANDER_ENGINE_ISP_SECONDS
    ),
    touchdownAtMET: touchdownMET,
    touchdownVerticalVelocityMps,
    touchdownHorizontalVelocityMps,
  };

  return {
    updatedState: landedState,
    profile: {
      deorbitDeltaVMps,
      poweredDescentDeltaVMps,
      totalRequiredDeltaVMps,
      totalPropellantBurnedKg: requiredPropellantKg,
      burnDurationSeconds,
      touchdownVerticalVelocityMps,
      touchdownHorizontalVelocityMps,
      isTouchdownSafe: true,
      reasons,
    },
  };
}
