/**
 * SECTOR 17 — Decision Option Generator
 * Contextually synthesizes aerospace response options grounded in available evidence,
 * spacecraft architectural capabilities, and current engineering state.
 *
 * CANDIDATE CATEGORIES (Expedition-V):
 * 1. CONTINUE_INVESTIGATION: Collect additional REASON radar or MASPEX measurements.
 * 2. PRIORITIZE_ANOMALY: Reconfigure scientific priority towards confirmed anomaly.
 * 3. PRESERVE_SPACECRAFT: Load-shed non-essential systems to protect safety margins.
 * 4. TRANSMIT_FINDINGS: Queue confirmed science telemetry for Earth downlink.
 * 5. DEPLOY_LANDER: Initiate surface lander sequence only when architecture and reconnaissance permit.
 * 6. ABORT_OR_SUSPEND: Controlled operational suspension or transition to safe mode.
 */

import type { DecisionEvidenceManager } from './decisionEvidence';
import type { RiskAssessmentEngine } from './riskAssessment';
import type { DecisionOption, DecisionResourceRequirements } from './types';

export class DecisionOptionGenerator {
  private riskEngine: RiskAssessmentEngine;

  constructor(riskEngine: RiskAssessmentEngine) {
    this.riskEngine = riskEngine;
  }

  /**
   * Evaluates evidence and spacecraft state to generate contextual candidate options.
   */
  public generateOptions(
    evidenceManager: DecisionEvidenceManager,
    currentMET: number
  ): DecisionOption[] {
    const options: DecisionOption[] = [];
    const snapshot = evidenceManager.getEngineeringSnapshot();

    const scienceProducts = evidenceManager.getEvidenceByType('SCIENCE_PRODUCT');
    const anomalyReports = evidenceManager.getEvidenceByType('ANOMALY_REPORT');
    const hasLanderSubsystem = snapshot?.subsystemStatuses['LANDER_ROVER'] !== undefined;

    // Pre-launch campaign stages: in-flight science surveys and surface lander descents are strictly suppressed.
    const isPrelaunch =
      snapshot?.campaignStageId === 'LAUNCH_AUTHORIZATION' ||
      snapshot?.campaignStageId === 'MISSION_READINESS' ||
      snapshot?.campaignStageId === 'SPACECRAFT_DESIGN';

    // 1. CONTINUE_INVESTIGATION
    // Supported if science subsystem is not faulted AND not in pre-launch stage
    const scienceStatus = snapshot?.subsystemStatuses['SCIENCE'];
    if (scienceStatus !== 'FAULT' && !isPrelaunch) {
      const req: DecisionResourceRequirements = {
        estimatedPowerWatts: 150.0,
        estimatedDurationSeconds: 1200.0,
        estimatedStorageBytes: 65536,
        requiredSubsystems: ['SCIENCE', 'EPS'],
        requiresActiveCommWindow: false,
      };

      const evidenceRefs = scienceProducts.map((p) => p.id);
      const risk = this.riskEngine.evaluateRisk(req, snapshot, currentMET, evidenceRefs);

      options.push({
        id: `opt-continue-survey-${currentMET}`,
        category: 'CONTINUE_INVESTIGATION',
        title: 'Continue Systematic Science Survey (REASON & MASPEX)',
        description:
          'Acquire additional radar sounding profiles and plume atmospheric mass spectra along the current Europa flyby track.',
        evidenceReferences: evidenceRefs,
        prerequisites: [],
        resourceRequirements: req,
        riskAssessment: risk,
        commandTypeToDispatch: 'START_SCIENCE_SURVEY',
        commandPayload: { mode: 'SURVEY', durationSeconds: 1200 },
      });
    }

    // 2. PRIORITIZE_ANOMALY
    // Generated only when confirmed anomaly reports exist in evidence
    if (anomalyReports.length > 0) {
      for (const anomalyEvi of anomalyReports) {
        const req: DecisionResourceRequirements = {
          estimatedPowerWatts: 220.0,
          estimatedDurationSeconds: 1800.0,
          estimatedStorageBytes: 131072,
          requiredSubsystems: ['SCIENCE', 'EPS', 'GNC'],
          requiresActiveCommWindow: false,
        };

        const evidenceRefs = [anomalyEvi.id, ...anomalyEvi.payload ? (anomalyEvi.payload as any).sourceProductIds ?? [] : []];
        const risk = this.riskEngine.evaluateRisk(req, snapshot, currentMET, evidenceRefs);

        options.push({
          id: `opt-prioritize-anomaly-${anomalyEvi.sourceId}-${currentMET}`,
          category: 'PRIORITIZE_ANOMALY',
          title: `Prioritize In-Situ Investigation of Anomaly '${anomalyEvi.sourceId}'`,
          description: `Reconfigure radar pulse bandwidth and mass spectrometer integration to focus on detected anomaly '${anomalyEvi.summary}'.`,
          evidenceReferences: evidenceRefs,
          prerequisites: [],
          resourceRequirements: req,
          riskAssessment: risk,
          commandTypeToDispatch: 'RECONFIGURE_SCIENCE_PAYLOAD',
          commandPayload: {
            targetAnomalyId: anomalyEvi.sourceId,
            mode: 'HIGH_RESOLUTION',
            durationSeconds: 1800,
          },
        });
      }
    }

    // 3. PRESERVE_SPACECRAFT
    // Available during in-flight operations to protect safety margins (suppressed pre-launch)
    if (!isPrelaunch) {
      const req: DecisionResourceRequirements = {
        estimatedPowerWatts: -80.0, // Load shedding
        estimatedDurationSeconds: 600.0,
        requiredSubsystems: ['EPS'],
        requiresActiveCommWindow: false,
      };

      const risk = this.riskEngine.evaluateRisk(req, snapshot, currentMET);

      options.push({
        id: `opt-preserve-spacecraft-${currentMET}`,
        category: 'PRESERVE_SPACECRAFT',
        title: 'Preserve Spacecraft Health (Conserve Power & Thermal Buffers)',
        description:
          'Stand by high-draw science instruments, throttle payload bus heaters, and enter energy-conservation mode.',
        evidenceReferences: [],
        prerequisites: [],
        resourceRequirements: req,
        riskAssessment: risk,
        commandTypeToDispatch: 'SET_SUBSYSTEM_POWER_STATE',
        commandPayload: { mode: 'CONSERVATION' },
      });
    }

    // 4. TRANSMIT_FINDINGS
    // Generated if science products or anomalies exist to downlink AND not prelaunch
    if ((scienceProducts.length > 0 || anomalyReports.length > 0) && !isPrelaunch) {
      const req: DecisionResourceRequirements = {
        estimatedPowerWatts: 120.0,
        estimatedDurationSeconds: 900.0,
        requiredSubsystems: ['COMMUNICATIONS', 'EPS'],
        requiresActiveCommWindow: true,
      };

      const evidenceRefs = [
        ...scienceProducts.map((p) => p.id),
        ...anomalyReports.map((a) => a.id),
      ];
      const risk = this.riskEngine.evaluateRisk(req, snapshot, currentMET, evidenceRefs);

      options.push({
        id: `opt-transmit-findings-${currentMET}`,
        category: 'TRANSMIT_FINDINGS',
        title: 'Queue Telemetry Downlink for Confirmed Science Observations',
        description:
          'Transmit verified Level 2 science products and anomaly reports to Earth Deep Space Network ground stations.',
        evidenceReferences: evidenceRefs,
        prerequisites: [],
        resourceRequirements: req,
        riskAssessment: risk,
        commandTypeToDispatch: 'INITIATE_DOWNLINK_TRANSMISSION',
        commandPayload: { packetIds: evidenceRefs },
      });
    }

    // 5. DEPLOY_LANDER
    // Only generated if LANDER_ROVER subsystem is architecturally present AND
    // mission has reached Europa reconnaissance or surface operations
    const isLanderStage =
      snapshot?.campaignStageId === 'EUROPA_RECONNAISSANCE' ||
      snapshot?.campaignStageId === 'SURFACE_MISSION_PREPARATION' ||
      snapshot?.campaignStageId === 'LANDER_DEPLOYMENT';
    const isLanderPhase =
      snapshot?.navigationPhase === 'EUROPA_RECONNAISSANCE' ||
      snapshot?.navigationPhase === 'SURFACE_OPERATIONS';
    const isLanderStageOrPhase = snapshot?.campaignStageId
      ? isLanderStage
      : snapshot?.navigationPhase
      ? isLanderPhase
      : snapshot?.flightState === 'ACTIVE';

    if (hasLanderSubsystem && isLanderStageOrPhase) {
      const req: DecisionResourceRequirements = {
        estimatedPowerWatts: 300.0,
        estimatedPropellantKg: 25.0,
        estimatedDurationSeconds: 3600.0,
        requiredSubsystems: ['LANDER_ROVER', 'GNC', 'PROPULSION', 'EPS'],
        requiresActiveCommWindow: false,
      };

      const evidenceRefs = scienceProducts.map((p) => p.id);
      const risk = this.riskEngine.evaluateRisk(req, snapshot, currentMET, evidenceRefs);

      options.push({
        id: `opt-deploy-lander-${currentMET}`,
        category: 'DEPLOY_LANDER',
        title: 'Initiate Surface Lander Descent to Characterized Site',
        description:
          'Authorize terminal separation, GNC attitude alignment, and deorbit burn for the Europa Surface Lander.',
        evidenceReferences: evidenceRefs,
        prerequisites: ['EXP-V-OBJ-01'], // Requires radar characterization
        resourceRequirements: req,
        riskAssessment: risk,
        commandTypeToDispatch: 'DEPLOY_SURFACE_LANDER',
        commandPayload: { siteTarget: 'EUROPA-CONAMARA-CHAOS' },
      });

      // Parking orbit assumption authorization option (Stage 10 / Surface prerequisite)
      // Authoritative fail-closed stage/phase hierarchy (Finding-663-01)
      const isEligibleStage =
        snapshot?.campaignStageId === 'EUROPA_RECONNAISSANCE' ||
        snapshot?.campaignStageId === 'SURFACE_MISSION_PREPARATION' ||
        snapshot?.campaignStageId === 'LANDER_DEPLOYMENT';

      const isEligiblePhase =
        snapshot?.navigationPhase === 'EUROPA_RECONNAISSANCE' ||
        snapshot?.navigationPhase === 'SURFACE_OPERATIONS';

      const isEligiblePhaseOrStage = snapshot?.campaignStageId
        ? isEligibleStage
        : snapshot?.navigationPhase
          ? isEligiblePhase
          : false;

      const isAlreadyAuthorized = snapshot?.parkingOrbitPrerequisiteMet === true;

      if (isEligiblePhaseOrStage && !isAlreadyAuthorized) {
        const authReq: DecisionResourceRequirements = {
          requiredSubsystems: ['GNC'],
          requiresActiveCommWindow: false,
        };
        const authRisk = this.riskEngine.evaluateRisk(authReq, snapshot, currentMET);

        options.push({
          id: `opt-authorize-parking-orbit-${currentMET}`,
          category: 'DEPLOY_LANDER',
          title: 'Authorize Europa Parking-Orbit Assumption (100 km Circular)',
          description:
            'Formally acknowledge the 100 km circular Europa parking-orbit operational staging prerequisite to clear lander deployment and descent.',
          evidenceReferences: [],
          prerequisites: ['EXP-V-OBJ-01'], // Requires completion of Europa Reconnaissance (Stage 9)
          resourceRequirements: authReq,
          riskAssessment: authRisk,
          commandTypeToDispatch: 'AUTHORIZE_EUROPA_PARKING_ORBIT',
          commandPayload: { altitudeMetres: 100_000 },
        });
      }
    }

    // 6. LAUNCH_AUTHORIZATION
    // Generated when campaign is in Stage 5 (LAUNCH_AUTHORIZATION) or readiness has been certified
    const isLaunchAuthEligible =
      snapshot?.campaignStageId === 'LAUNCH_AUTHORIZATION' ||
      (snapshot?.readinessCertified === true &&
        (snapshot?.flightState === 'STANDBY' || snapshot?.flightState === 'INITIALIZED'));

    if (isLaunchAuthEligible) {
      const launchReq: DecisionResourceRequirements = {
        requiredSubsystems: ['EPS', 'COMMUNICATIONS', 'PROPULSION'],
        requiresActiveCommWindow: false,
      };

      const launchRisk = this.riskEngine.evaluateRisk(launchReq, snapshot, currentMET);

      options.push({
        id: `opt-launch-authorization-${currentMET}`,
        category: 'LAUNCH_AUTHORIZATION',
        title: 'Flight Director Go/No-Go Poll: Authorize Launch Sequence',
        description:
          'Conduct formal operational poll across GNC, Propulsion, EPS, Thermal, Communications, and Ground Station consoles. Authorize Expedition-V AETHON planetary escape launch countdown.',
        evidenceReferences: [],
        prerequisites: [],
        resourceRequirements: launchReq,
        riskAssessment: launchRisk,
        expirationMET: currentMET + 1800, // 30-minute operational window
        commandTypeToDispatch: 'AUTHORIZE_LAUNCH',
        commandPayload: { confirmed: true, destination: 'Europa' },
      });
    }

    // 7. ABORT_OR_SUSPEND
    // Safety action available at all times
    {
      const req: DecisionResourceRequirements = {
        requiredSubsystems: [],
        requiresActiveCommWindow: false,
      };

      const risk = this.riskEngine.evaluateRisk(req, snapshot, currentMET);

      options.push({
        id: `opt-abort-or-suspend-${currentMET}`,
        category: 'ABORT_OR_SUSPEND',
        title: 'Suspend Mission Operations (Transition to SAFE_MODE)',
        description:
          'Autonomously disengage science instruments, lock solar pointing attitude, and hold mission execution.',
        evidenceReferences: [],
        prerequisites: [],
        resourceRequirements: req,
        riskAssessment: risk,
        commandTypeToDispatch: 'TRANSITION_FLIGHT_STATE',
        commandPayload: { targetState: 'SAFE_MODE', reason: 'Operator requested mission suspension' },
      });
    }

    return options;
  }
}
