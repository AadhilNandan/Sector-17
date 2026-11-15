/**
 * SECTOR 17 — Maneuver Planning & Flight Operations Engine
 * Generates, validates, and dispatches astrodynamic maneuver plans across
 * the Expedition-V mission phases.
 */

import {
  AETHON_DRY_MASS_KG,
  AETHON_PROPELLANT_CAPACITY_KG,
  AETHON_MAIN_ENGINE_ISP_SECONDS,
  AETHON_MAIN_ENGINE_THRUST_NEWTONS,
  LANDER_ENGINE_ISP_SECONDS,
  LANDER_ENGINE_MAX_THRUST_NEWTONS,
} from './constants';
import {
  calculatePropellantConsumed,
  calculateBurnDurationSeconds,
} from './orbitalCalculations';
import type {
  ManeuverPlan,
  ManeuverType,
  CentralBody,
} from './types';

export function createManeuverPlan(
  id: string,
  type: ManeuverType,
  title: string,
  description: string,
  targetBody: CentralBody,
  deltaVMps: number,
  plannedMETSeconds: number,
  dryMassKg: number = AETHON_DRY_MASS_KG,
  propellantKg: number = AETHON_PROPELLANT_CAPACITY_KG,
  ispSeconds: number = AETHON_MAIN_ENGINE_ISP_SECONDS,
  thrustNewtons: number = AETHON_MAIN_ENGINE_THRUST_NEWTONS
): ManeuverPlan {
  const initialMass = dryMassKg + propellantKg;
  const estimatedPropellantKg = calculatePropellantConsumed(initialMass, deltaVMps, ispSeconds);
  const estimatedBurnDurationSeconds = calculateBurnDurationSeconds(
    estimatedPropellantKg,
    ispSeconds,
    thrustNewtons
  );

  return {
    id,
    type,
    title,
    description,
    targetBody,
    deltaVMps,
    plannedMETSeconds,
    estimatedPropellantKg,
    estimatedBurnDurationSeconds,
    isExecuted: false,
  };
}

/**
 * Returns standard initial planned maneuvers for the Europa Survey.
 */
export function getDefaultManeuverCatalog(): ManeuverPlan[] {
  return [
    createManeuverPlan(
      'mnv-tji-01',
      'TRANS_JOVIAN_INJECTION',
      'Trans-Jovian Injection (TJI)',
      'Upper-stage high-energy translunar/interplanetary injection burn toward Jupiter.',
      'SUN',
      3_950,
      3_600, // MET = 1 hour
      AETHON_DRY_MASS_KG,
      AETHON_PROPELLANT_CAPACITY_KG,
      AETHON_MAIN_ENGINE_ISP_SECONDS,
      AETHON_MAIN_ENGINE_THRUST_NEWTONS
    ),
    createManeuverPlan(
      'mnv-tcm-01',
      'MIDCOURSE_CORRECTION',
      'Midcourse Correction (TCM-1)',
      'Heliocentric trajectory trim burn to target Jovian polar approach corridor.',
      'SUN',
      24.5,
      2_592_000, // MET = 30 days
      AETHON_DRY_MASS_KG,
      2_450,
      AETHON_MAIN_ENGINE_ISP_SECONDS,
      AETHON_MAIN_ENGINE_THRUST_NEWTONS
    ),
    createManeuverPlan(
      'mnv-approach-01',
      'JUPITER_APPROACH',
      'Jupiter Hill Sphere Ingress & Hyperbolic Approach',
      'Enter Jupiter gravitational sphere of influence, transition to Jovian coordinate frame, and establish perijove hyperbolic approach trajectory.',
      'JUPITER',
      0.0,
      101_800_000, // MET = ~1,178 days
      AETHON_DRY_MASS_KG,
      2_425,
      AETHON_MAIN_ENGINE_ISP_SECONDS,
      AETHON_MAIN_ENGINE_THRUST_NEWTONS
    ),
    createManeuverPlan(
      'mnv-joi-01',
      'JUPITER_ORBIT_INSERTION',
      'Jovian Orbit Insertion (JOI)',
      'Main bipropellant retrograde burn at perijove for capture into Jovian tour orbit.',
      'JUPITER',
      885.0,
      101_952_000, // MET = ~1,180 days
      AETHON_DRY_MASS_KG,
      2_425,
      AETHON_MAIN_ENGINE_ISP_SECONDS,
      AETHON_MAIN_ENGINE_THRUST_NEWTONS
    ),
    createManeuverPlan(
      'mnv-flyby-01',
      'EUROPA_FLYBY_TARGETING',
      'Europa Reconnaissance Targeting (PRM-1)',
      'Orbital shaping maneuver aligning AETHON perijove with Europa orbital crossing.',
      'JUPITER',
      115.0,
      105_408_000, // MET = ~1,220 days
      AETHON_DRY_MASS_KG,
      1_480,
      AETHON_MAIN_ENGINE_ISP_SECONDS,
      AETHON_MAIN_ENGINE_THRUST_NEWTONS
    ),
    createManeuverPlan(
      'mnv-lander-deploy',
      'LANDER_DEPLOYMENT',
      'Lander Separation & Interface Release',
      'Pyrotechnic release and spring ejection of the separate Europa surface lander.',
      'EUROPA',
      0.0,
      108_000_000,
      450.0,
      400.0,
      LANDER_ENGINE_ISP_SECONDS,
      LANDER_ENGINE_MAX_THRUST_NEWTONS
    ),
    createManeuverPlan(
      'mnv-lander-descent',
      'LANDER_POWERED_DESCENT',
      'Lander Near-Vacuum Powered Descent',
      'Autonomous rocket braking burn canceling orbital speed for soft surface touchdown.',
      'EUROPA',
      1_873.0,
      108_003_600,
      450.0,
      400.0,
      LANDER_ENGINE_ISP_SECONDS,
      LANDER_ENGINE_MAX_THRUST_NEWTONS
    ),
  ];
}
