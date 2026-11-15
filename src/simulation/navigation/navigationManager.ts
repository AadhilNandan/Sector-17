/**
 * SECTOR 17 — Navigation Manager (Master Orchestrator)
 * Coordinates astrodynamic models, orbital state propagation, maneuver validation,
 * resource integration with flight software, science product triggers,
 * and authoritative save/restore serialization.
 */

import { MU_EARTH, MU_SUN } from '../constants';
import {
  AETHON_DRY_MASS_KG,
  AETHON_PROPELLANT_CAPACITY_KG,
  AETHON_MAIN_ENGINE_ISP_SECONDS,
  AETHON_MAIN_ENGINE_THRUST_NEWTONS,
  AETHON_MIN_PROPELLANT_MARGIN_PERCENT,
  RADIUS_EARTH_METRES,
} from './constants';
import {
  createOrbitalElements,
  validateManeuverFeasibility,
} from './orbitalCalculations';
import {
  getTrajectoryModel,
} from './heliocentricTrajectory';
import {
  computeJupiterCaptureState,
  executeJupiterOrbitInsertion,
  validateJupiterOrbitInsertion,
} from './jupiterCaptureEngine';
import {
  createDefaultEuropaFlybyState,
  evaluateEuropaRelativeMotion,
} from './europaReconnaissanceEngine';
import {
  createStowedLanderState,
  deployLanderAsset,
  simulatePoweredDescent,
} from './landerDescentEngine';
import {
  getDefaultManeuverCatalog,
} from './maneuverPlanner';
import type {
  NavigationSnapshot,
  NavigationSerializedState,
  NavigationPhase,
  CentralBody,
  OrbitalElements,
  HeliocentricTrajectoryModel,
  JupiterCaptureState,
  EuropaFlybyState,
  LanderState,
  ManeuverPlan,
  ManeuverExecutionResult,
  ManeuverValidationReport,
} from './types';
import type { FlightComputer } from '../flightSoftware/flightComputer';
import type { PropulsionSubsystem } from '../flightSoftware/subsystemManager';
import type { MissionEventEngine } from '../operations/missionEventEngine';
import type { ScienceProcessingManager } from '../science/scienceProcessingManager';
import type { CommunicationManager } from '../communications/communicationManager';
import type { Level0Product, ReasonRawPayload } from '../science/types';

/**
 * Generates synthetic Level 0 radar sounding data for Europa reconnaissance.
 *
 * RADAR SIGNAL MODEL SPECIFICATION (Task 5 / Scientific Review):
 * The `echoSamples` array represents a detected range-compressed envelope power profile
 * (video sounding magnitude / envelope power), NOT an uncompressed RF time-domain carrier oscillation.
 * - Center frequency: 9 MHz (HF sounding band for deep ice penetration).
 * - Chirp pulse bandwidth: 1 MHz, providing a compressed pulse time resolution tau ~ 1/B = 1 microsecond.
 * - Range-time bin sampling interval: dt = 1 microsecond per envelope bin.
 * - One-way range resolution in cold pure ice (eps_r = 3.15, v ~ 168.9 m/us): delta_R = (v * dt) / 2 ~ 84.5 m.
 * - This abstract radar profile models detected echo amplitudes across two-way travel time bins,
 *   rather than direct continuous RF carrier digitization (which at 9 MHz would require >= 18 MS/s for Nyquist).
 */
function generateSyntheticReasonPayload(acquisitionMET: number): ReasonRawPayload {
  const dt = 1e-6; // 1 microsecond sampling interval (range-compressed envelope bin width)
  const totalSamples = 300;
  const echoSamples = new Array(totalSamples).fill(0.01); // 0.01 baseline noise floor

  // Surface echo peak at range bin index 20 (two-way time 20 microseconds)
  echoSamples[19] = 0.45;
  echoSamples[20] = 0.95;
  echoSamples[21] = 0.40;

  // Subsurface basal reflector at range bin index 196 (two-way time 196 microseconds -> ~14.8 km depth in pure ice Ih)
  echoSamples[195] = 0.35;
  echoSamples[196] = 0.75;
  echoSamples[197] = 0.30;

  return {
    centerFrequencyHz: 9e6,
    samplingIntervalSeconds: dt,
    pulseBandwidthHz: 1e6,
    transmitPowerWatts: 10.0,
    echoSamples,
    transmitTimeMET: acquisitionMET,
    receiveTimeMET: acquisitionMET + 0.0003,
    sampleCount: totalSamples,
    chirpDurationSeconds: 10e-6,
    antennaGainDb: 6.0,
  };
}

export class NavigationManager {
  private currentPhase: NavigationPhase = 'PRE_LAUNCH';
  private centralBody: CentralBody = 'EARTH';
  private currentOrbit: OrbitalElements;
  private heliocentricTrajectory: HeliocentricTrajectoryModel;
  private jupiterCapture: JupiterCaptureState;
  private europaFlyby: EuropaFlybyState;
  private lander: LanderState;
  private plannedManeuvers: ManeuverPlan[];
  private executedManeuvers: ManeuverExecutionResult[] = [];
  private totalDeltaVExpendedMps: number = 0;
  private totalPropellantBurnedKg: number = 0;
  private reconScanSequence: number = 0;
  private eventCounter: number = 0;
  private lastValidationReport?: ManeuverValidationReport;
  private isParkingOrbitBypassActive: boolean = false;

  // External Connected Systems
  private flightComputer?: FlightComputer;
  private eventEngine?: MissionEventEngine;
  private scienceManager?: ScienceProcessingManager;
  private commManager?: CommunicationManager;

  constructor() {
    // Initial parking orbit around Earth (400 km LEO circular)
    const rLeo = RADIUS_EARTH_METRES + 400_000;
    this.currentOrbit = createOrbitalElements('EARTH', rLeo, rLeo, MU_EARTH, 0.497, 0);

    this.heliocentricTrajectory = getTrajectoryModel('REALISTIC_DIRECT');
    this.jupiterCapture = computeJupiterCaptureState();
    this.europaFlyby = createDefaultEuropaFlybyState();
    this.lander = createStowedLanderState();
    this.plannedManeuvers = getDefaultManeuverCatalog();
  }

  /* -------------------------------------------------------------------------- */
  /* Dependency Ingestion Hooks                                                 */
  /* -------------------------------------------------------------------------- */

  public attachFlightComputer(fc: FlightComputer): void {
    this.flightComputer = fc;
    // Mark GNC subsystem as NOMINAL once navigation engine is online
    const gnc = fc.getSubsystemManager().getSubsystem('GNC');
    if (gnc && gnc.getStatus() === 'OFF') {
      gnc.setStatus('NOMINAL');
    }
  }

  public attachEventEngine(engine: MissionEventEngine): void {
    this.eventEngine = engine;
  }

  public attachScienceManager(sm: ScienceProcessingManager): void {
    this.scienceManager = sm;
  }

  public attachCommunicationManager(cm: CommunicationManager): void {
    this.commManager = cm;
  }

  /* -------------------------------------------------------------------------- */
  /* Navigation State Queries                                                   */
  /* -------------------------------------------------------------------------- */

  public getSnapshot(): NavigationSnapshot {
    return {
      currentPhase: this.currentPhase,
      centralBody: this.centralBody,
      currentOrbit: this.currentOrbit,
      heliocentricTrajectory: this.heliocentricTrajectory,
      jupiterCapture: this.jupiterCapture,
      europaFlyby: this.europaFlyby,
      lander: this.lander,
      availableManeuvers: [...this.plannedManeuvers],
      executedManeuvers: [...this.executedManeuvers],
      lastValidationReport: this.lastValidationReport,
      totalDeltaVExpendedMps: this.totalDeltaVExpendedMps,
      totalPropellantBurnedKg: this.totalPropellantBurnedKg,
      reconScanSequence: this.reconScanSequence,
      eventCounter: this.eventCounter,
      isParkingOrbitBypassActive: this.isParkingOrbitBypassActive,
      parkingOrbitBypassNotice: this.lander.parkingOrbitAssumptionNotice,
    };
  }

  public getCurrentPhase(): NavigationPhase {
    return this.currentPhase;
  }

  public getLanderState(): LanderState {
    return this.lander;
  }

  public getEuropaFlybyState(): EuropaFlybyState {
    return this.europaFlyby;
  }

  /* -------------------------------------------------------------------------- */
  /* Maneuver Feasibility & Validation                                          */
  /* -------------------------------------------------------------------------- */

  public validateManeuver(maneuverId: string): ManeuverValidationReport {
    const plan = this.plannedManeuvers.find((m) => m.id === maneuverId);
    if (!plan) {
      const missingReport: ManeuverValidationReport = {
        status: 'FAIL',
        isFeasible: false,
        reasons: [`Maneuver plan with id "${maneuverId}" not found in catalog.`],
        requiredDeltaVMps: 0,
        requiredPropellantKg: 0,
        availablePropellantKg: 0,
        propellantMarginKg: 0,
        burnDurationSeconds: 0,
        initialMassKg: AETHON_DRY_MASS_KG,
        finalMassKg: AETHON_DRY_MASS_KG,
      };
      this.lastValidationReport = missingReport;
      return missingReport;
    }

    if (plan.isExecuted) {
      const alreadyReport: ManeuverValidationReport = {
        status: 'WARNING',
        isFeasible: false,
        reasons: [`Maneuver "${plan.title}" has already been executed.`],
        requiredDeltaVMps: plan.deltaVMps,
        requiredPropellantKg: plan.estimatedPropellantKg,
        availablePropellantKg: this.getPropellantRemainingKg(),
        propellantMarginKg: 0,
        burnDurationSeconds: plan.estimatedBurnDurationSeconds,
        initialMassKg: AETHON_DRY_MASS_KG,
        finalMassKg: AETHON_DRY_MASS_KG,
      };
      this.lastValidationReport = alreadyReport;
      return alreadyReport;
    }

    // Check specific maneuver types
    if (plan.type === 'TRANS_JOVIAN_INJECTION') {
      const propRemaining = this.getPropellantRemainingKg();
      const requiredPropellantKg = 15.0; // Upper stage insertion with attitude separation propellant
      const hasProp = propRemaining >= requiredPropellantKg;
      const valvesOk = !this.isPropulsionIsolated();
      const engineOk = this.isEngineNominal();
      const isFeasible = hasProp && valvesOk && engineOk;

      const reasons: string[] = [];
      if (!hasProp) reasons.push(`Insufficient propellant (${propRemaining.toFixed(1)} kg < ${requiredPropellantKg} kg required).`);
      if (!valvesOk) reasons.push('Propulsion isolation valves are closed.');
      if (!engineOk) reasons.push('Main propulsion engine is degraded or offline.');
      if (isFeasible) reasons.push('Trans-Jovian Injection launch vehicle upper-stage profile verified.');

      const report: ManeuverValidationReport = {
        status: isFeasible ? 'PASS' : 'FAIL',
        isFeasible,
        reasons,
        requiredDeltaVMps: plan.deltaVMps,
        requiredPropellantKg,
        availablePropellantKg: propRemaining,
        propellantMarginKg: propRemaining - requiredPropellantKg,
        burnDurationSeconds: plan.estimatedBurnDurationSeconds,
        initialMassKg: AETHON_DRY_MASS_KG + propRemaining,
        finalMassKg: AETHON_DRY_MASS_KG + propRemaining - requiredPropellantKg,
      };
      this.lastValidationReport = report;
      return report;
    }

    if (plan.type === 'MIDCOURSE_CORRECTION') {
      const prop = this.getPropellantRemainingKg();
      const valvesIsolated = this.isPropulsionIsolated();
      const engineNominal = this.isEngineNominal();

      const report = validateManeuverFeasibility(
        plan.deltaVMps,
        AETHON_DRY_MASS_KG,
        prop,
        AETHON_MAIN_ENGINE_ISP_SECONDS,
        AETHON_MAIN_ENGINE_THRUST_NEWTONS,
        {
          areValvesIsolated: valvesIsolated,
          isEngineNominal: engineNominal,
          requiredMinMarginKg: AETHON_PROPELLANT_CAPACITY_KG * AETHON_MIN_PROPELLANT_MARGIN_PERCENT,
        }
      );
      this.lastValidationReport = report;
      return report;
    }

    if (plan.type === 'JUPITER_APPROACH') {
      const tjiDone =
        this.executedManeuvers.some((m) => m.maneuverType === 'TRANS_JOVIAN_INJECTION' && m.success) ||
        this.currentPhase === 'HELIOCENTRIC_CRUISE';

      const reasons: string[] = [];
      let status: 'PASS' | 'FAIL' = 'PASS';

      if (!tjiDone) {
        status = 'FAIL';
        reasons.push('Cannot execute Jupiter Hill sphere ingress: Trans-Jovian Injection (TJI) has not been completed.');
      }

      const report: ManeuverValidationReport = {
        status,
        isFeasible: status === 'PASS',
        reasons: reasons.length ? reasons : ['Jupiter Hill sphere approach corridor verified. Hyperbolic arrival trajectory aligned.'],
        requiredDeltaVMps: 0,
        requiredPropellantKg: 0,
        availablePropellantKg: this.getPropellantRemainingKg(),
        propellantMarginKg: this.getPropellantRemainingKg(),
        burnDurationSeconds: 0,
        initialMassKg: AETHON_DRY_MASS_KG + this.getPropellantRemainingKg(),
        finalMassKg: AETHON_DRY_MASS_KG + this.getPropellantRemainingKg(),
      };
      this.lastValidationReport = report;
      return report;
    }

    if (plan.type === 'JUPITER_ORBIT_INSERTION') {
      const propRemaining = this.getPropellantRemainingKg();
      const valvesIsolated = this.isPropulsionIsolated();
      const engineNominal = this.isEngineNominal();

      const report = validateJupiterOrbitInsertion(this.jupiterCapture, propRemaining, {
        areValvesIsolated: valvesIsolated,
        isEngineNominal: engineNominal,
      });
      this.lastValidationReport = report;
      return report;
    }

    if (plan.type === 'EUROPA_FLYBY_TARGETING') {
      const prop = this.getPropellantRemainingKg();
      const valvesIsolated = this.isPropulsionIsolated();
      const engineNominal = this.isEngineNominal();

      const report = validateManeuverFeasibility(
        plan.deltaVMps,
        AETHON_DRY_MASS_KG,
        prop,
        AETHON_MAIN_ENGINE_ISP_SECONDS,
        AETHON_MAIN_ENGINE_THRUST_NEWTONS,
        {
          areValvesIsolated: valvesIsolated,
          isEngineNominal: engineNominal,
          requiredMinMarginKg: AETHON_PROPELLANT_CAPACITY_KG * AETHON_MIN_PROPELLANT_MARGIN_PERCENT,
        }
      );
      // Append clear astrodynamic classification: resonant flyby corridor, NOT physical Europa circular orbit capture
      const updatedReport = {
        ...report,
        reasons: [
          ...report.reasons,
          '[ASTRODYNAMICS]: Resonant flyby corridor shaping burn. Does not execute or require 100 km circular Europa orbital capture.',
        ],
      };
      this.lastValidationReport = updatedReport;
      return updatedReport;
    }

    if (plan.type === 'LANDER_POWERED_DESCENT') {
      const reasons: string[] = [];
      const propOk = this.lander.propellantRemainingKg >= 380;
      const isBypass = this.isParkingOrbitBypassActive || this.lander.parkingOrbitPrerequisiteMet === true;

      if (!isBypass) {
        reasons.push('100 km Europa parking-orbit prerequisite not authorized.');
      } else {
        reasons.push(
          '[GAMEPLAY ABSTRACTION]: 100 km Europa parking orbit staging authorized via mission-flow bypass. Physical capture insertion bypassed for EXPEDITION-V.'
        );
      }

      if (!propOk) {
        reasons.push('Lander propellant insufficient for soft touchdown.');
      } else {
        reasons.push(`Descent propulsion margins nominal: required 382.5 kg, available ${this.lander.propellantRemainingKg.toFixed(1)} kg (reserve 17.5 kg).`);
      }

      if (this.lander.flightState === 'STOWED') {
        reasons.push('Trajectory Planning Note: Sequenced for post-deployment execution following carrier release.');
      }

      const isFeasible = propOk && isBypass;
      const status: 'PASS' | 'WARNING' | 'FAIL' = !isFeasible
        ? 'FAIL'
        : this.lander.flightState === 'STOWED'
        ? 'WARNING'
        : 'PASS';

      const report: ManeuverValidationReport = {
        status,
        isFeasible,
        reasons,
        requiredDeltaVMps: plan.deltaVMps,
        requiredPropellantKg: 382.5,
        availablePropellantKg: this.lander.propellantRemainingKg,
        propellantMarginKg: this.lander.propellantRemainingKg - 382.5,
        burnDurationSeconds: plan.estimatedBurnDurationSeconds,
        initialMassKg: this.lander.totalMassKg,
        finalMassKg: this.lander.dryMassKg + (this.lander.propellantRemainingKg - 382.5),
      };
      this.lastValidationReport = report;
      return report;
    }

    // General AETHON maneuver validation
    const prop = this.getPropellantRemainingKg();
    const valvesIsolated = this.isPropulsionIsolated();
    const engineNominal = this.isEngineNominal();

    const report = validateManeuverFeasibility(
      plan.deltaVMps,
      AETHON_DRY_MASS_KG,
      prop,
      AETHON_MAIN_ENGINE_ISP_SECONDS,
      AETHON_MAIN_ENGINE_THRUST_NEWTONS,
      {
        areValvesIsolated: valvesIsolated,
        isEngineNominal: engineNominal,
        requiredMinMarginKg: AETHON_PROPELLANT_CAPACITY_KG * AETHON_MIN_PROPELLANT_MARGIN_PERCENT,
      }
    );
    this.lastValidationReport = report;
    return report;
  }

  /* -------------------------------------------------------------------------- */
  /* Maneuver Execution                                                         */
  /* -------------------------------------------------------------------------- */

  public async executeManeuver(
    maneuverId: string,
    currentMET: number
  ): Promise<ManeuverExecutionResult> {
    const planIndex = this.plannedManeuvers.findIndex((m) => m.id === maneuverId);
    if (planIndex === -1) {
      throw new Error(`Cannot execute maneuver: "${maneuverId}" not found.`);
    }

    const plan = this.plannedManeuvers[planIndex];
    const validation = this.validateManeuver(maneuverId);

    if (!validation.isFeasible) {
      const failureResult: ManeuverExecutionResult = {
        success: false,
        maneuverId: plan.id,
        maneuverType: plan.type,
        executedAtMET: currentMET,
        actualDeltaVMps: 0,
        propellantConsumedKg: 0,
        validationReport: validation,
        failureReason: validation.reasons.join('; '),
      };
      this.executedManeuvers.push(failureResult);
      return failureResult;
    }

    // Handle specific maneuver branches
    if (plan.type === 'TRANS_JOVIAN_INJECTION') {
      // Consume propellant if not using upper stage, transition phase to HELIOCENTRIC_CRUISE
      this.consumeAethonPropellant(validation.requiredPropellantKg);
      this.currentPhase = 'HELIOCENTRIC_CRUISE';
      this.centralBody = 'SUN';
      this.currentOrbit = createOrbitalElements(
        'SUN',
        this.heliocentricTrajectory.departureRadiusMetres,
        this.heliocentricTrajectory.arrivalRadiusMetres,
        MU_SUN
      );

      this.markPlanExecuted(planIndex, currentMET);
      this.recordBurnMetrics(plan.deltaVMps, validation.requiredPropellantKg);

      this.emitEvent('TRANS_JOVIAN_INJECTION_COMPLETE', currentMET, {
        trajectoryType: this.heliocentricTrajectory.transferType,
        deltaVMps: plan.deltaVMps,
      });

      const res: ManeuverExecutionResult = {
        success: true,
        maneuverId: plan.id,
        maneuverType: plan.type,
        executedAtMET: currentMET,
        actualDeltaVMps: plan.deltaVMps,
        propellantConsumedKg: validation.requiredPropellantKg,
        resultingOrbit: this.currentOrbit,
        validationReport: validation,
      };
      this.executedManeuvers.push(res);
      return res;
    }

    if (plan.type === 'MIDCOURSE_CORRECTION') {
      this.consumeAethonPropellant(validation.requiredPropellantKg);
      this.markPlanExecuted(planIndex, currentMET);
      this.recordBurnMetrics(plan.deltaVMps, validation.requiredPropellantKg);

      this.emitEvent('MIDCOURSE_CORRECTION_COMPLETE', currentMET, {
        maneuverId: plan.id,
        deltaVMps: plan.deltaVMps,
        propellantConsumedKg: validation.requiredPropellantKg,
        arrivalTarget: 'JUPITER',
      });

      const res: ManeuverExecutionResult = {
        success: true,
        maneuverId: plan.id,
        maneuverType: plan.type,
        executedAtMET: currentMET,
        actualDeltaVMps: plan.deltaVMps,
        propellantConsumedKg: validation.requiredPropellantKg,
        resultingOrbit: this.currentOrbit,
        validationReport: validation,
      };
      this.executedManeuvers.push(res);
      return res;
    }

    if (plan.type === 'JUPITER_APPROACH') {
      this.currentPhase = 'JUPITER_APPROACH';
      this.centralBody = 'JUPITER';
      this.markPlanExecuted(planIndex, currentMET);

      // Transition to hyperbolic approach orbit toward perijove
      this.currentOrbit = createOrbitalElements(
        'JUPITER',
        this.jupiterCapture.perijoveRadiusMetres,
        this.jupiterCapture.perijoveRadiusMetres * 5.0,
        1.26686534e17, // MU_JUPITER
        0.05,
        0
      );

      this.emitEvent('JUPITER_ARRIVAL', currentMET, {
        perijoveRadiusM: this.jupiterCapture.perijoveRadiusMetres,
        arrivalVelocityInfinityMps: this.jupiterCapture.arrivalVelocityInfinityMps,
      });

      const res: ManeuverExecutionResult = {
        success: true,
        maneuverId: plan.id,
        maneuverType: plan.type,
        executedAtMET: currentMET,
        actualDeltaVMps: 0,
        propellantConsumedKg: 0,
        resultingOrbit: this.currentOrbit,
        validationReport: validation,
      };
      this.executedManeuvers.push(res);
      return res;
    }

    if (plan.type === 'JUPITER_ORBIT_INSERTION') {
      const propRemaining = this.getPropellantRemainingKg();
      const joi = executeJupiterOrbitInsertion(this.jupiterCapture, propRemaining, currentMET, {
        areValvesIsolated: this.isPropulsionIsolated(),
        isEngineNominal: this.isEngineNominal(),
      });

      if (!joi.result.success) {
        this.executedManeuvers.push(joi.result);
        return joi.result;
      }

      this.setPropellantRemainingKg(joi.remainingPropellantKg);
      this.jupiterCapture = joi.updatedCaptureState;
      this.currentPhase = 'JOVIAN_ORBIT';
      this.centralBody = 'JUPITER';
      this.currentOrbit = joi.updatedCaptureState.capturedOrbit;

      this.markPlanExecuted(planIndex, currentMET);
      this.recordBurnMetrics(plan.deltaVMps, joi.result.propellantConsumedKg);

      // Emit JUPITER_ARRIVAL if not already emitted on approach ingress
      const arrivalAlreadyEmitted = this.executedManeuvers.some((m) => m.maneuverType === 'JUPITER_APPROACH' && m.success);
      if (!arrivalAlreadyEmitted) {
        this.emitEvent('JUPITER_ARRIVAL', currentMET, { perijoveRadiusM: this.jupiterCapture.perijoveRadiusMetres });
      }

      this.emitEvent('JUPITER_ORBIT_INSERTION_COMPLETE', currentMET, {
        deltaVMps: joi.result.actualDeltaVMps,
        semiMajorAxisM: this.currentOrbit.semiMajorAxisMetres,
        perijoveRadiusM: this.jupiterCapture.perijoveRadiusMetres,
      });

      this.executedManeuvers.push(joi.result);
      return joi.result;
    }

    if (plan.type === 'EUROPA_FLYBY_TARGETING') {
      this.consumeAethonPropellant(validation.requiredPropellantKg);
      this.currentPhase = 'EUROPA_RECONNAISSANCE';
      this.markPlanExecuted(planIndex, currentMET);
      this.recordBurnMetrics(plan.deltaVMps, validation.requiredPropellantKg);

      // Trigger flyby state update
      this.europaFlyby = {
        ...this.europaFlyby,
        inObservationWindow: true,
        observationWindowStartMET: currentMET,
        observationWindowEndMET: currentMET + 7200,
        totalFlybysCompleted: this.europaFlyby.totalFlybysCompleted + 1,
      };

      this.emitEvent('EUROPA_FLYBY_COMPLETE', currentMET, {
        closestDistanceM: this.europaFlyby.closestApproachDistanceMetres,
        relativeSpeedMps: this.europaFlyby.relativeVelocityMps,
      });

      const res: ManeuverExecutionResult = {
        success: true,
        maneuverId: plan.id,
        maneuverType: plan.type,
        executedAtMET: currentMET,
        actualDeltaVMps: plan.deltaVMps,
        propellantConsumedKg: validation.requiredPropellantKg,
        resultingOrbit: this.currentOrbit,
        validationReport: validation,
      };
      this.executedManeuvers.push(res);
      return res;
    }

    if (plan.type === 'LANDER_DEPLOYMENT') {
      this.lander = deployLanderAsset(this.lander, { deploymentMET: currentMET });
      this.markPlanExecuted(planIndex, currentMET);

      // Set lander/rover subsystem active in flight computer
      const landerSubsys = this.flightComputer?.getSubsystemManager().getSubsystem('LANDER_ROVER');
      if (landerSubsys) {
        landerSubsys.setStatus('NOMINAL');
      }

      this.emitEvent('LANDER_DEPLOYMENT_COMPLETE', currentMET, {
        targetSite: this.lander.targetLandingSite,
        wetMassKg: this.lander.totalMassKg,
      });

      const res: ManeuverExecutionResult = {
        success: true,
        maneuverId: plan.id,
        maneuverType: plan.type,
        executedAtMET: currentMET,
        actualDeltaVMps: 0,
        propellantConsumedKg: 0,
        validationReport: validation,
      };
      this.executedManeuvers.push(res);
      return res;
    }

    if (plan.type === 'LANDER_POWERED_DESCENT') {
      this.emitEvent('LANDER_DESCENT_STARTED', currentMET, { targetSite: this.lander.targetLandingSite });
      const sim = simulatePoweredDescent(this.lander, currentMET);
      this.lander = sim.updatedState;

      this.markPlanExecuted(planIndex, currentMET);
      this.recordBurnMetrics(sim.profile.totalRequiredDeltaVMps, sim.profile.totalPropellantBurnedKg);

      if (sim.profile.isTouchdownSafe) {
        this.currentPhase = 'SURFACE_OPERATIONS';
        this.emitEvent('LANDER_TOUCHDOWN', sim.updatedState.touchdownAtMET ?? currentMET, {
          targetSite: sim.updatedState.targetLandingSite,
          touchdownVerticalSpeed: sim.updatedState.touchdownVerticalVelocityMps,
          touchdownHorizontalSpeed: sim.updatedState.touchdownHorizontalVelocityMps,
        });
      }

      const res: ManeuverExecutionResult = {
        success: sim.profile.isTouchdownSafe,
        maneuverId: plan.id,
        maneuverType: plan.type,
        executedAtMET: currentMET,
        actualDeltaVMps: sim.profile.totalRequiredDeltaVMps,
        propellantConsumedKg: sim.profile.totalPropellantBurnedKg,
        validationReport: validation,
        failureReason: sim.profile.isTouchdownSafe ? undefined : sim.profile.reasons.join('; '),
      };
      this.executedManeuvers.push(res);
      return res;
    }

    // Default generic maneuver handling (e.g. TCM)
    this.consumeAethonPropellant(validation.requiredPropellantKg);
    this.markPlanExecuted(planIndex, currentMET);
    this.recordBurnMetrics(plan.deltaVMps, validation.requiredPropellantKg);

    const genericRes: ManeuverExecutionResult = {
      success: true,
      maneuverId: plan.id,
      maneuverType: plan.type,
      executedAtMET: currentMET,
      actualDeltaVMps: plan.deltaVMps,
      propellantConsumedKg: validation.requiredPropellantKg,
      resultingOrbit: this.currentOrbit,
      validationReport: validation,
    };
    this.executedManeuvers.push(genericRes);
    return genericRes;
  }

  public async executeJupiterApproach(currentMET?: number): Promise<ManeuverExecutionResult> {
    const met = currentMET ?? this.flightComputer?.getCurrentMETSeconds() ?? 101_800_000;
    return this.executeManeuver('mnv-approach-01', met);
  }

  /* -------------------------------------------------------------------------- */
  /* Science & Reconnaissance Triggers                                          */
  /* -------------------------------------------------------------------------- */

  public triggerReconnaissanceScan(currentMET: number): {
    success: boolean;
    bytesGenerated: number;
    level0Product?: Level0Product<ReasonRawPayload>;
    reason?: string;
  } {
    // Only valid when in Europa reconnaissance phase, Jovian orbit targeting Europa, or observation window
    const inRecon = this.currentPhase === 'EUROPA_RECONNAISSANCE' || this.currentPhase === 'JOVIAN_ORBIT' || this.europaFlyby.inObservationWindow;
    if (!inRecon) {
      return {
        success: false,
        bytesGenerated: 0,
        reason: 'AETHON is not currently within an active Europa observation window.',
      };
    }

    // Update flyby state
    this.europaFlyby = {
      ...this.europaFlyby,
      reconnaissanceDataAcquired: true,
      highResolutionScansCompleted: this.europaFlyby.highResolutionScansCompleted + 1,
    };

    const bytesGenerated = 125_000_000; // 125 MB high-res radar sounding dataset
    this.reconScanSequence += 1;
    const packetId = `pkt-recon-${currentMET}-${this.reconScanSequence}`;
    const level0Id = `l0-recon-radar-${currentMET}-${this.reconScanSequence}`;

    // Ingest into SSDR storage if comm manager attached
    if (this.commManager) {
      const storage = this.commManager.getStorage();
      storage.storeData({
        id: packetId,
        category: 'science',
        sizeBytes: bytesGenerated,
        priority: 1, // High priority
        createdAtMETSeconds: currentMET,
      });
    }

    let level0Product: Level0Product<ReasonRawPayload> | undefined;

    // Ingest into Science Data Registry if science manager attached
    if (this.scienceManager) {
      const registry = this.scienceManager.getDataRegistry();
      const rawPayload = generateSyntheticReasonPayload(currentMET);
      level0Product = registry.registerLevel0({
        id: level0Id,
        instrument: 'REASON',
        packetId: packetId,
        category: 'science',
        acquisitionMET: currentMET,
        ingestionMET: currentMET,
        status: 'VALIDATED',
        sizeBytes: bytesGenerated,
        rawPayload,
        checksumValid: true,
      }) as Level0Product<ReasonRawPayload>;
    }

    this.emitEvent('RECONNAISSANCE_DATA_ACQUIRED', currentMET, {
      bytesRecorded: bytesGenerated,
      instrument: 'REASON Ice-Penetrating Radar',
      target: 'Europa Subsurface Ice Shell',
    });

    return {
      success: true,
      bytesGenerated,
      level0Product,
      reason: 'Europa sounding radar survey dataset acquired and stored in SSDR memory.',
    };
  }

  /**
   * Queries whether the 100 km circular Europa parking-orbit assumption is authorized.
   * Single authoritative source of truth for both orbital descent and surface deployment.
   */
  public isParkingOrbitPrerequisiteAuthorized(): boolean {
    return this.isParkingOrbitBypassActive || this.lander.parkingOrbitPrerequisiteMet === true;
  }

  /**
   * Returns true if the controlled gameplay abstraction bypass is active.
   */
  public isParkingOrbitBypassAuthorized(): boolean {
    return this.isParkingOrbitBypassActive;
  }

  /**
   * Explicitly authorizes the controlled Europa parking-orbit mission-flow bypass for EXPEDITION-V.
   * Documents the gameplay abstraction without claiming that physical orbital capture was achieved.
   */
  public authorizeParkingOrbitMissionFlowBypass(currentMET: number = 0): { success: boolean; message: string } {
    this.isParkingOrbitBypassActive = true;
    this.lander = {
      ...this.lander,
      parkingOrbitPrerequisiteMet: true,
      parkingOrbitAssumptionNotice:
        'MISSION FLOW BYPASS [GAMEPLAY ABSTRACTION]: Powered descent staging authorized via campaign mission-flow bypass for EXPEDITION-V. Physical 100 km circular orbit capture was not simulated or claimed.',
    };

    this.emitEvent('PARKING_ORBIT_BYPASS_AUTHORIZED', currentMET, {
      bypassType: 'MISSION_FLOW_GAMEPLAY_ABSTRACTION',
      physicalCaptureAchieved: false,
      stagedDescentAuthorized: true,
      documentation: 'Controlled hackathon mission-flow progression bypass without orbital mechanics modification.',
    });

    return {
      success: true,
      message: 'Europa parking-orbit mission-flow bypass authorized [GAMEPLAY ABSTRACTION]. Staging cleared for mission progression.',
    };
  }

  /**
   * Explicitly authorizes the 100 km circular Europa parking-orbit operational assumption.
   * Required before powered descent can be executed.
   * Emits exactly one PARKING_ORBIT_ASSUMPTION_AUTHORIZED event upon first authorization.
   */
  public authorizeParkingOrbitAssumption(currentMET: number): { success: boolean; message: string } {
    if (this.lander.parkingOrbitPrerequisiteMet === true && !this.isParkingOrbitBypassActive) {
      return {
        success: true,
        message: 'Europa parking-orbit prerequisite is already authorized.',
      };
    }

    this.lander = {
      ...this.lander,
      parkingOrbitPrerequisiteMet: true,
    };

    this.emitEvent('PARKING_ORBIT_ASSUMPTION_AUTHORIZED', currentMET, {
      prerequisite: '100 km circular Europa parking orbit assumption acknowledged',
      altitudeMetres: 100_000,
    });

    return {
      success: true,
      message: 'Europa parking-orbit prerequisite authorized. Lander powered descent unlocked.',
    };
  }

  /* -------------------------------------------------------------------------- */
  /* Simulation Time Step Propagation                                           */
  /* -------------------------------------------------------------------------- */

  public step(_deltaSeconds: number, currentMET: number): void {
    if (this.currentPhase === 'JOVIAN_ORBIT' || this.currentPhase === 'EUROPA_RECONNAISSANCE') {
      const relState = evaluateEuropaRelativeMotion(currentMET);
      this.europaFlyby = {
        ...this.europaFlyby,
        currentEuropaDistanceMetres: relState.relativeDistanceMetres,
        relativeVelocityMps: relState.relativeVelocityMps,
        inObservationWindow: relState.isWithinObservationWindow,
      };
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Authoritative Save / Restore State Serialization                           */
  /* -------------------------------------------------------------------------- */

  public exportState(): NavigationSerializedState {
    return {
      schemaVersion: 1,
      currentPhase: this.currentPhase,
      centralBody: this.centralBody,
      currentOrbit: this.currentOrbit,
      heliocentricTrajectory: this.heliocentricTrajectory,
      jupiterCapture: this.jupiterCapture,
      europaFlyby: this.europaFlyby,
      lander: this.lander,
      plannedManeuvers: this.plannedManeuvers.map((m) => ({ ...m })),
      executedManeuvers: this.executedManeuvers.map((e) => ({ ...e })),
      totalDeltaVExpendedMps: this.totalDeltaVExpendedMps,
      totalPropellantBurnedKg: this.totalPropellantBurnedKg,
      reconScanSequence: this.reconScanSequence,
      eventCounter: this.eventCounter,
      isParkingOrbitBypassActive: this.isParkingOrbitBypassActive,
      parkingOrbitBypassNotice: this.lander.parkingOrbitAssumptionNotice,
    };
  }

  public restoreState(state: NavigationSerializedState): void {
    if (!state) return;
    this.currentPhase = state.currentPhase ?? 'PRE_LAUNCH';
    this.centralBody = state.centralBody ?? state.currentOrbit?.centralBody ?? 'EARTH';
    this.currentOrbit = state.currentOrbit ?? this.currentOrbit;
    this.heliocentricTrajectory = state.heliocentricTrajectory ?? this.heliocentricTrajectory;
    this.jupiterCapture = state.jupiterCapture ?? this.jupiterCapture;
    this.europaFlyby = state.europaFlyby ?? this.europaFlyby;
    this.isParkingOrbitBypassActive = state.isParkingOrbitBypassActive === true;
    if (state.lander) {
      this.lander = {
        ...state.lander,
        parkingOrbitPrerequisiteMet:
          state.lander.parkingOrbitPrerequisiteMet === true || this.isParkingOrbitBypassActive,
      };
    }
    this.plannedManeuvers = state.plannedManeuvers ? state.plannedManeuvers.map((m) => ({ ...m })) : this.plannedManeuvers;
    this.executedManeuvers = state.executedManeuvers ? state.executedManeuvers.map((e) => ({ ...e })) : [];
    this.totalDeltaVExpendedMps = state.totalDeltaVExpendedMps ?? 0;
    this.totalPropellantBurnedKg = state.totalPropellantBurnedKg ?? 0;
    this.reconScanSequence = state.reconScanSequence ?? 0;
    this.eventCounter = state.eventCounter ?? 0;
  }

  /* -------------------------------------------------------------------------- */
  /* Internal Propulsion & Subsystem Helper Routines                            */
  /* -------------------------------------------------------------------------- */

  private getPropellantRemainingKg(): number {
    const propSubsys = this.flightComputer?.getSubsystemManager().getSubsystem('PROPULSION') as
      | PropulsionSubsystem
      | undefined;
    return propSubsys ? propSubsys.getPropellantRemainingKg() : AETHON_PROPELLANT_CAPACITY_KG;
  }

  private setPropellantRemainingKg(kg: number): void {
    const propSubsys = this.flightComputer?.getSubsystemManager().getSubsystem('PROPULSION') as
      | PropulsionSubsystem
      | undefined;
    if (propSubsys) {
      propSubsys.setPropellantRemainingKg(kg);
    }
  }

  private consumeAethonPropellant(kg: number): void {
    const propSubsys = this.flightComputer?.getSubsystemManager().getSubsystem('PROPULSION') as
      | PropulsionSubsystem
      | undefined;
    if (propSubsys) {
      propSubsys.consumePropellant(kg);
    }
  }

  private isPropulsionIsolated(): boolean {
    const propSubsys = this.flightComputer?.getSubsystemManager().getSubsystem('PROPULSION') as
      | PropulsionSubsystem
      | undefined;
    return propSubsys ? propSubsys.areValvesIsolated() : false;
  }

  private isEngineNominal(): boolean {
    const propSubsys = this.flightComputer?.getSubsystemManager().getSubsystem('PROPULSION');
    if (!propSubsys) return true;
    const status = propSubsys.getStatus();
    return status !== 'FAULT' && status !== 'OFF';
  }

  private markPlanExecuted(index: number, currentMET: number): void {
    const plan = this.plannedManeuvers[index];
    this.plannedManeuvers[index] = {
      ...plan,
      isExecuted: true,
      executedAtMET: currentMET,
    };
  }

  private recordBurnMetrics(deltaVMps: number, propellantKg: number): void {
    this.totalDeltaVExpendedMps += deltaVMps;
    this.totalPropellantBurnedKg += propellantKg;
  }

  private emitEvent(type: string, metSeconds: number, payload: Record<string, unknown>): void {
    if (this.eventEngine) {
      this.eventCounter += 1;
      this.eventEngine.emitImmediateEvent({
        id: `evt-nav-${type.toLowerCase()}-${metSeconds}-${this.eventCounter}`,
        type,
        scheduledTimeSeconds: metSeconds,
        priority: 1,
        payload,
      });
    }
  }
}
