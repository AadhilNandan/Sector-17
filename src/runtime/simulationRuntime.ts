/**
 * SECTOR 17 — Authoritative Simulation Runtime
 * Central orchestrator connecting FlightComputer, CommunicationManager,
 * ScienceProcessingManager, MissionDecisionManager, and MissionEventEngine
 * to the React presentation tier.
 */

import { FlightComputer } from '../simulation/flightSoftware/flightComputer';
import { CommunicationManager } from '../simulation/communications/communicationManager';
import { ScienceProcessingManager } from '../simulation/science/scienceProcessingManager';
import { MissionDecisionManager } from '../simulation/missionDecision/missionDecisionManager';
import { MissionEventEngine } from '../simulation/operations/missionEventEngine';
import { calculatePowerBudget } from '../simulation/engineering/powerBudget';
import { calculateThermalEquilibrium } from '../simulation/engineering/thermalModel';
import { calculateOneWayLightTime } from '../simulation/communications/signalPropagation';
import type { SpacecraftPointingTarget } from '../simulation/communications/types';
import type { SpacecraftCommConfig } from '../simulation/communications/communicationManager';
import { ASTRONOMICAL_UNIT_METRES } from '../simulation/constants';
import { CampaignManager } from '../campaign/campaignManager';
import { NavigationManager } from '../simulation/navigation/navigationManager';
import { SurfaceMissionManager } from '../simulation/surface/surfaceMissionManager';
import type {
  ManeuverExecutionResult,
  ManeuverValidationReport,
} from '../simulation/navigation/types';
import type {
  SurfaceInstrumentId,
  RoverOperatingMode,
  TraverseExecutionResult,
  ScienceAcquisitionResult,
} from '../simulation/surface';
import type { PropulsionSubsystem } from '../simulation/flightSoftware/subsystemManager';
import type { FlightComputerStepReport } from '../simulation/flightSoftware/types';
import {
  getDefaultSpacecraftConfig,
  calculateSpacecraftMetrics,
  evaluateSpacecraftConfiguration,
  getPropulsionSpecs,
  validatePartNumericalValues,
  type SpacecraftMetrics,
} from '../simulation/engineering/spacecraftConfiguration';
import { AVAILABLE_MISSIONS } from '../data/missionsAndComponents';
import { CAMPAIGN_STAGES_SEQUENCE } from '../campaign/campaignStages';
import type {
  Mission,
  SpacecraftPart,
  LaunchVehicle,
  ComponentCategory,
  SpacecraftConfig,
} from '../types/game';
import type {
  PowerBudgetInput,
  PowerBudgetResult,
  ThermalModelInput,
  ThermalModelResult,
  EventExecutionResult,
  SpacecraftValidationReport,
  MissionEvent,
} from '../simulation/types';
import type {
  DecisionOption,
  DecisionRecord,
  DecisionExecutionResult,
} from '../simulation/missionDecision/types';
import type {
  ReasonLevel2Product,
  MaspexLevel2Product,
  ScienceProductLevel2,
  ScienceAnomalyReport,
} from '../simulation/science/types';
import type {
  RuntimeLifecycleState,
  SimulationSnapshot,
  SimulationRuntimeConfig,
  RuntimeStartOptions,
  DecisionEvaluationReport,
  RuntimeCommandInterface,
  AuthoritativeRuntimeSnapshot,
  MissionEvaluationReport,
} from './types';

export class SimulationRuntime implements RuntimeCommandInterface {
  private static activeInstances: Map<string, SimulationRuntime> = new Map();

  private readonly campaignId: string;
  private lifecycle: RuntimeLifecycleState = 'INITIALIZING';
  private flightComputer: FlightComputer;
  private commManager: CommunicationManager;
  private scienceManager: ScienceProcessingManager;
  private decisionManager: MissionDecisionManager;
  private eventEngine: MissionEventEngine;
  private campaignManager!: CampaignManager;
  private navManager: NavigationManager;
  private surfaceManager: SurfaceMissionManager;

  private propellantCapacityKg: number;
  private powerConfig: PowerBudgetInput;
  private thermalConfig: ThermalModelInput;

  private selectedMissionId: string = 'europa-survey';
  private briefingAcknowledged: boolean = false;
  private spacecraftConfig: SpacecraftConfig = getDefaultSpacecraftConfig();
  private validationReport?: SpacecraftValidationReport;
  private isReadinessCertified: boolean = false;
  private readinessCertifiedAtMET?: number;
  private acknowledgedWarnings: string[] = [];
  private isLaunchAuthorized: boolean = false;
  private launchAuthorizedAtMET?: number;
  private isExecutingLaunch: boolean = false;
  private missionEvaluation?: MissionEvaluationReport;
  private anomalyDecisionChosen?: 'analyze' | 'sample' | 'withdraw';
  private autoPersistCampaign: boolean = false;

  private currentSnapshot: SimulationSnapshot;
  private listeners: Set<() => void> = new Set();
  private tickerInterval?: any;
  private isStepping: boolean = false;
  private lastError?: string;
  private lastStartOptions?: RuntimeStartOptions;

  constructor(campaignId: string = 'default-campaign', config: SimulationRuntimeConfig = {}) {
    if (!campaignId || typeof campaignId !== 'string' || campaignId.trim().length === 0) {
      throw new TypeError('SimulationRuntime: campaignId must be a non-empty string.');
    }
    this.campaignId = campaignId.trim();

    // Single-instance protection per campaign
    const existing = SimulationRuntime.activeInstances.get(this.campaignId);
    if (existing && existing.lifecycle !== 'COMPLETED' && existing.lifecycle !== 'FAILED') {
      throw new Error(
        `SimulationRuntime: An active simulation instance already exists for campaign '${this.campaignId}'. Dispose it before creating a new instance.`
      );
    }

    // Default configuration budgets
    this.propellantCapacityKg = config.propellantCapacityKg ?? 2450.0;
    const initialPropellantKg = config.initialPropellantKg ?? this.propellantCapacityKg;

    // 1. Initialize core simulation engines
    this.eventEngine = new MissionEventEngine(config.epochTimestampSeconds, true);
    this.commManager = new CommunicationManager({
      autoExecuteCommands: config.autoExecuteCommands ?? false,
      autoGenerateGroundAcks: config.autoGenerateGroundAcks ?? true,
      storageCapacityBytes: config.storageCapacityBytes,
    });
    this.commManager.attachEventEngine(this.eventEngine);
    this.scienceManager = new ScienceProcessingManager();
    this.decisionManager = new MissionDecisionManager();

    this.flightComputer = new FlightComputer({
      initialState: config.initialState ?? 'INITIALIZED',
      initialPosition: config.initialPosition,
      epochTimestampSeconds: config.epochTimestampSeconds,
    });

    // 2. Wire subsystems and manager integrations
    this.flightComputer.attachEventEngine(this.eventEngine);
    this.flightComputer.attachCommunicationManager(this.commManager);
    this.flightComputer.attachScienceManager(this.scienceManager);
    this.flightComputer.attachDecisionManager(this.decisionManager);

    // Seed propulsion subsystem propellant state
    const propSub = this.flightComputer.getSubsystemManager().getSubsystem('PROPULSION') as PropulsionSubsystem;
    if (propSub && initialPropellantKg !== 2450.0) {
      const delta = 2450.0 - initialPropellantKg;
      if (delta > 0) {
        propSub.consumePropellant(delta);
      }
    }

    // Configure power & thermal budget defaults (Jupiter arrival distance ~5.2 AU)
    this.powerConfig = {
      distanceAu: 5.2,
      sources: [
        {
          type: 'solar',
          ratedPower1AuWatts: 3800,
        },
        {
          type: 'radioisotope',
          ratedPowerWatts: 250,
        },
      ],
      loads: [
        { id: 'load-bus', category: 'bus', powerWatts: 80 },
        { id: 'load-comm', category: 'communication', powerWatts: 60 },
        { id: 'load-inst', category: 'instruments', powerWatts: 100 },
        { id: 'load-thermal', category: 'thermal', powerWatts: 50 },
        { id: 'load-cdh', category: 'dataHandling', powerWatts: 30 },
      ],
      reserveThresholdPercent: 20,
      ...(config.powerConfig as any),
    };

    this.thermalConfig = {
      solarAbsorptivity: 0.20,
      projectedAreaM2: 8.0,
      surfaceEmissivity: 0.85,
      radiatingAreaM2: 1.5,
      distanceAu: 5.2,
      internalHeatDissipationWatts: 320,
      ...(config.thermalConfig as any),
    };

    this.autoPersistCampaign = config.autoPersistCampaign ?? false;

    // Initialize Campaign Progression Manager
    this.campaignManager = new CampaignManager({
      campaignId: this.campaignId,
      autoPersist: this.autoPersistCampaign,
      initialStageId: 'CAMPAIGN_INTRO',
    });
    this.campaignManager.attachRuntime(this);
    this.decisionManager.attachCampaignManager(this.campaignManager);
    this.decisionManager.attachRuntime(this);

    // Attach browser beforeunload save guard if auto-persist is enabled
    if (this.autoPersistCampaign && typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('beforeunload', () => {
        try {
          this.campaignManager?.saveSync();
        } catch {
          // Ignore
        }
      });
    }

    // Initial prelaunch flags based on flight state (only if not restored from persistence)
    if (config.initialState === 'ACTIVE') {
      // Testing/simulation override: explicitly starting in ACTIVE flight state pre-authorizes flight operations.
      this.isReadinessCertified = true;
      this.isLaunchAuthorized = true;
      this.briefingAcknowledged = true;
    } else if (!this.isReadinessCertified && !this.isLaunchAuthorized) {
      // Secure default: all other initializations (INITIALIZED, STANDBY, or omitted) require formal authorization.
      this.isReadinessCertified = false;
      this.isLaunchAuthorized = false;
    }

    // Initialize Navigation & Astrodynamics Manager
    this.navManager = new NavigationManager();
    this.navManager.attachFlightComputer(this.flightComputer);
    this.navManager.attachEventEngine(this.eventEngine);
    this.navManager.attachScienceManager(this.scienceManager);
    this.navManager.attachCommunicationManager(this.commManager);
    this.decisionManager.attachNavigationManager(this.navManager);

    // Initialize Surface Mission & Rover Manager
    this.surfaceManager = new SurfaceMissionManager();
    this.surfaceManager.attachFlightComputer(this.flightComputer);
    this.surfaceManager.attachEventEngine(this.eventEngine);
    this.surfaceManager.attachScienceManager(this.scienceManager);
    this.surfaceManager.attachCommunicationManager(this.commManager);
    this.surfaceManager.attachNavigationManager(this.navManager);

    // 3. Initial snapshot generation and registration (Fix C-02)
    try {
      this.lifecycle = 'READY';
      this.currentSnapshot = this.computeSnapshot();
      SimulationRuntime.activeInstances.set(this.campaignId, this);
    } catch (err) {
      SimulationRuntime.activeInstances.delete(this.campaignId);
      this.lifecycle = 'FAILED';
      throw err;
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Static Registry & Factory Methods                                          */
  /* -------------------------------------------------------------------------- */

  public static getOrCreate(
    campaignId: string = 'default-campaign',
    config?: SimulationRuntimeConfig
  ): SimulationRuntime {
    const existing = SimulationRuntime.activeInstances.get(campaignId);
    if (existing && existing.lifecycle !== 'COMPLETED' && existing.lifecycle !== 'FAILED') {
      return existing;
    }
    return new SimulationRuntime(campaignId, config);
  }

  public static getInstance(campaignId: string = 'default-campaign'): SimulationRuntime | undefined {
    return SimulationRuntime.activeInstances.get(campaignId);
  }

  public static resetAll(): void {
    for (const runtime of Array.from(SimulationRuntime.activeInstances.values())) {
      runtime.dispose();
    }
    SimulationRuntime.activeInstances.clear();
  }

  /* -------------------------------------------------------------------------- */
  /* Lifecycle & Simulation Time Control                                        */
  /* -------------------------------------------------------------------------- */

  public getLifecycle(): RuntimeLifecycleState {
    return this.lifecycle;
  }

  public getCampaignId(): string {
    return this.campaignId;
  }

  public getSnapshot(): Readonly<SimulationSnapshot> {
    return this.currentSnapshot;
  }

  public start(options?: RuntimeStartOptions): void {
    if (this.lifecycle === 'COMPLETED' || this.lifecycle === 'FAILED') {
      throw new Error(`Cannot start runtime in '${this.lifecycle}' state.`);
    }

    this.lastStartOptions = options ?? this.lastStartOptions;
    this.lifecycle = 'RUNNING';
    this.eventEngine.resume();

    // Prevent duplicate active stepping loops
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = undefined;
    }

    if (options?.tickIntervalMs && options.tickIntervalMs > 0) {
      const stepSize = options.stepSizeSeconds && options.stepSizeSeconds > 0 ? options.stepSizeSeconds : 1.0;
      this.tickerInterval = setInterval(() => {
        if (this.lifecycle === 'RUNNING' && !this.isStepping) {
          this.advanceTime(stepSize).catch((err) => {
            this.lastError = err?.message ?? String(err);
            this.updateSnapshot();
          });
        }
      }, options.tickIntervalMs);
    }

    this.updateSnapshot();
  }

  public pause(): void {
    if (this.lifecycle === 'COMPLETED' || this.lifecycle === 'FAILED' || this.lifecycle === 'PAUSED') {
      return;
    }

    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = undefined;
    }

    this.lifecycle = 'PAUSED';
    this.eventEngine.pause();
    this.updateSnapshot();
  }

  public resume(): void {
    if (this.lifecycle !== 'PAUSED') {
      return;
    }

    this.lifecycle = 'RUNNING';
    this.eventEngine.resume();

    if (this.lastStartOptions?.tickIntervalMs && this.lastStartOptions.tickIntervalMs > 0) {
      const stepSize =
        this.lastStartOptions.stepSizeSeconds && this.lastStartOptions.stepSizeSeconds > 0
          ? this.lastStartOptions.stepSizeSeconds
          : 1.0;
      this.tickerInterval = setInterval(() => {
        if (this.lifecycle === 'RUNNING' && !this.isStepping) {
          this.advanceTime(stepSize).catch((err) => {
            this.lastError = err?.message ?? String(err);
            this.updateSnapshot();
          });
        }
      }, this.lastStartOptions.tickIntervalMs);
    }

    this.updateSnapshot();
  }

  /**
   * Advances simulation time deterministically by durationSeconds.
   * Enforces:
   * - No advancement while paused.
   * - Re-entrancy protection.
   * - SI MET seconds exclusively.
   * - Execution of all queued flight computer, comms, science, and decision operations.
   */
  public async advanceTime(durationSeconds: number): Promise<FlightComputerStepReport> {
    if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new TypeError(
        `advanceTime: durationSeconds must be a positive finite number. Received: ${durationSeconds}`
      );
    }

    if (this.lifecycle === 'PAUSED') {
      throw new Error('SimulationRuntime: Cannot advance simulation time while runtime is PAUSED. Call resume() first.');
    }

    if (this.lifecycle === 'COMPLETED' || this.lifecycle === 'FAILED') {
      throw new Error(`SimulationRuntime: Cannot advance simulation time in '${this.lifecycle}' state.`);
    }

    if (this.isStepping) {
      throw new Error('SimulationRuntime: Concurrent step advancement detected. A step is already in progress.');
    }

    this.isStepping = true;

    try {
      // 1. Advance avionics and flight computer
      const stepReport = await this.flightComputer.step(durationSeconds);
      const currentMET = this.flightComputer.getCurrentMETSeconds();

      // 2. Advance decision engine step (objective deadlines, candidate option expirations)
      this.decisionManager.step(durationSeconds, currentMET);

      // 3. Advance navigation and relative trajectory engine
      this.navManager.step(durationSeconds, currentMET);

      // 4. Advance surface mission and rover dynamics
      this.surfaceManager.step(durationSeconds, currentMET);

      // 5. Advance deep-space communication link & DSN propagation
      const position = this.flightComputer.getPosition();
      const ecef = this.flightComputer.getResolvedECEFPosition(currentMET);
      const target: SpacecraftPointingTarget = {
        subSpacecraftLatitudeDeg: ecef.subSpacecraftLatitudeDeg,
        subSpacecraftLongitudeDeg: ecef.subSpacecraftLongitudeDeg,
        distanceMetres: position.distanceMetres,
      };
      const spacecraftComm: SpacecraftCommConfig = {
        transmitPowerWatts: this.spacecraftConfig?.parts?.communication?.powerKw ? this.spacecraftConfig.parts.communication.powerKw * 1000 : 20.0,
        antennaGainDbi: 46.5,
      };
      this.commManager.processStep(durationSeconds, currentMET, target, spacecraftComm);

      // 6. Check for arrived downlink telemetry packets at Earth
      const arrivedPackets = this.commManager.getTelemetryQueue().updateArrivals(currentMET);
      if (arrivedPackets.length > 0) {
        for (const pkt of arrivedPackets) {
          this.decisionManager.getEvidenceManager().addEvidence({
            id: `ev-dsn-${pkt.id}`,
            sourceType: 'COMMUNICATION_STATUS',
            sourceId: pkt.id,
            summary: `Confirmed downlink transmission of science telemetry packet ${pkt.id} to Deep Space Network.`,
            timestampMET: currentMET,
            confidenceScore: 0.95,
            provenance: 'VERIFIED',
            isFictionalConstruct: false,
            payload: { packetId: pkt.id, sizeBytes: pkt.sizeBytes, category: pkt.category },
          });
        }
        const allTelemetry = this.commManager.getTelemetryQueue().getAllPackets();
        const scienceTelemetry = allTelemetry.filter((p) => p.category === 'science');
        if (scienceTelemetry.length > 0 && scienceTelemetry.every((p) => p.status === 'RECEIVED_EARTH')) {
          this.emitCampaignEvent('DATA_TRANSMISSION_COMPLETE', {
            packetsReturned: scienceTelemetry.length,
            totalBytes: scienceTelemetry.reduce((acc, p) => acc + p.sizeBytes, 0),
          });
        }
      }

      // 7. Clear any previous non-fatal step errors
      this.lastError = undefined;

      // 8. Update snapshot and notify React subscribers
      this.updateSnapshot();

      return stepReport;
    } catch (err: any) {
      this.lastError = err?.message ?? String(err);
      this.updateSnapshot();
      throw err;
    } finally {
      this.isStepping = false;
    }
  }

  /**
   * Clears any active error from the runtime and snapshot.
   */
  public clearError(): void {
    this.lastError = undefined;
    this.updateSnapshot();
  }

  public dispose(): void {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = undefined;
    }

    this.lifecycle = 'COMPLETED';
    this.campaignManager?.detachRuntime();
    SimulationRuntime.activeInstances.delete(this.campaignId);

    this.updateSnapshot();
    this.listeners.clear();
  }

  /* -------------------------------------------------------------------------- */
  /* React Subscriptions (useSyncExternalStore contract)                         */
  /* -------------------------------------------------------------------------- */

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notifySubscribers(): void {
    for (const listener of Array.from(this.listeners)) {
      try {
        listener();
      } catch (err) {
        console.error('SimulationRuntime: subscriber threw unhandled error:', err);
      }
    }
  }

  private updateSnapshot(): void {
    this.currentSnapshot = this.computeSnapshot();
    this.notifySubscribers();
  }

  /* -------------------------------------------------------------------------- */
  /* Snapshot Construction (Pure Simulation Data Ingestion)                     */
  /* -------------------------------------------------------------------------- */

  private computeSnapshot(): SimulationSnapshot {
    const metSeconds = this.flightComputer.getCurrentMETSeconds();
    const formattedMET = this.eventEngine.getFormattedMET();
    const flightState = this.flightComputer.getExecutionController().getState();
    const subsystems = this.flightComputer.getSubsystemManager().getStatuses();

    // 1. Dynamic Power Budget computation
    const position = this.flightComputer.getPosition();
    const distanceAu = Math.max(0.1, position.distanceMetres / ASTRONOMICAL_UNIT_METRES);

    // Adjust electrical loads based on subsystem operational status
    const dynamicLoads = this.powerConfig.loads.map((load) => {
      if (load.category === 'instruments' && (subsystems.SCIENCE === 'OFF' || subsystems.SCIENCE === 'FAULT')) {
        return { ...load, powerWatts: 0 };
      }
      if (load.category === 'communication' && (subsystems.COMMUNICATIONS === 'OFF' || subsystems.COMMUNICATIONS === 'FAULT')) {
        return { ...load, powerWatts: 0 };
      }
      return load;
    });

    let powerBudget: PowerBudgetResult | undefined;
    try {
      powerBudget = calculatePowerBudget({
        ...this.powerConfig,
        distanceAu,
        loads: dynamicLoads,
      });
    } catch {
      // Retain undefined if power calculation encounters edge domain
    }

    // 2. Dynamic Thermal Equilibrium computation
    let thermalModel: ThermalModelResult | undefined;
    try {
      const dissipationWatts = powerBudget ? powerBudget.totalConsumptionWatts : 300;
      thermalModel = calculateThermalEquilibrium({
        ...this.thermalConfig,
        distanceAu,
        internalHeatDissipationWatts: dissipationWatts,
      });
    } catch {
      // Retain undefined if thermal calculation encounters edge domain
    }

    // 3. Propellant remaining
    const propSub = this.flightComputer.getSubsystemManager().getSubsystem('PROPULSION') as PropulsionSubsystem;
    const propellantRemainingKg = propSub?.getPropellantRemainingKg() ?? 0;

    // 4. Solid-state Onboard Storage
    const storageState = this.commManager.getStorage().getStorageState();
    const storageUtilization =
      storageState.totalCapacityBytes > 0
        ? (storageState.usedStorageBytes / storageState.totalCapacityBytes) * 100
        : 0;

    // 5. RF Communications & Pass Windows
    const ecefPointing = this.flightComputer.getResolvedECEFPosition(metSeconds);
    const visibleStations = this.commManager.evaluateVisibility(ecefPointing, metSeconds);
    const oneWayLightTimeSeconds = calculateOneWayLightTime(position.distanceMetres);

    // 6. Active Avionics Faults
    const faultManager = this.flightComputer.getFaultManager();
    const activeFaults = faultManager.getActiveFaults();
    const criticalFaults = faultManager.getFaultsBySeverity('CRITICAL');

    // 7. Synchronize Live Evidence Snapshot with Mission Decision Engine
    this.decisionManager.getEvidenceManager().ingestEngineeringSnapshot({
      currentMET: metSeconds,
      flightState,
      subsystemStatuses: subsystems,
      activeFaultCount: activeFaults.length,
      criticalFaultCount: criticalFaults.length,
      powerBudget,
      thermalModel,
      availablePropellantKg: propellantRemainingKg,
      storageCapacityBytes: storageState.totalCapacityBytes,
      storageUsedBytes: storageState.usedStorageBytes,
      isCommWindowActive: visibleStations.length > 0,
      currentRoundTripLightTimeSeconds: oneWayLightTimeSeconds * 2,
      parkingOrbitPrerequisiteMet: this.navManager?.isParkingOrbitPrerequisiteAuthorized?.() ?? false,
      navigationPhase: this.navManager?.getCurrentPhase?.(),
      campaignStageId: this.campaignManager?.getCurrentStageId?.(),
      readinessCertified: this.isReadinessCertified,
      engineeringValidationStatus: this.validationReport?.overallStatus,
    });

    // 8. Mission Objectives & Decisions
    const evalReports = this.decisionManager.evaluateObjectives(metSeconds);
    const evalMap = new Map(evalReports.map((r) => [r.objectiveId, r]));
    const allObjectives = this.decisionManager.getObjectiveEvaluator().getAllObjectives();

    const objectives = allObjectives.map((obj) => {
      const evalReport = evalMap.get(obj.id);
      return {
        id: obj.id,
        title: obj.title,
        description: obj.description,
        priority: obj.priority,
        state: evalReport?.newState ?? obj.state,
        progressPercent: evalReport?.progressPercent ?? obj.progressPercent,
        satisfiesPrerequisites: evalReport?.satisfiesPrerequisites ?? true,
        unsatisfiedPrerequisites: evalReport?.unsatisfiedPrerequisites ?? [],
        deadlineMET: obj.deadlineMET,
        isCompleted: evalReport?.isCompleted ?? obj.state === 'COMPLETED',
        isFailed: evalReport?.isFailed ?? obj.state === 'FAILED',
        failureReason: evalReport?.failureReason ?? obj.failureReason,
        missingEvidenceDescriptions: evalReport?.missingEvidenceDescriptions ?? [],
      };
    });

    const availableDecisions = this.decisionManager.generateAndValidateOptions(metSeconds);
    const decisionHistory = this.decisionManager.getHistoryTracker().getAllRecords();
    const evidenceItems = this.decisionManager.getEvidenceManager().getAllEvidence();

    // 9. Science Registry Products & Anomalies
    const allL2 = this.scienceManager.getDataRegistry().getAllLevel2();
    const reasonProducts = allL2.filter((p): p is ReasonLevel2Product => p.instrument === 'REASON');
    const maspexProducts = allL2.filter((p): p is MaspexLevel2Product => p.instrument === 'MASPEX');
    const activeAnomalies = this.scienceManager.getAnomalyDetector().getAllAnomalies();

    // 10. Operational Mission Events
    const recentEvents = this.eventEngine.getExecutionHistory();

    return {
      campaignId: this.campaignId,
      lifecycle: this.lifecycle,
      metSeconds,
      formattedMET,
      flightState,
      subsystems: { ...subsystems },
      powerBudget,
      thermalModel,
      propellantRemainingKg,
      propellantCapacityKg: this.propellantCapacityKg,
      storage: {
        usedBytes: storageState.usedStorageBytes,
        capacityBytes: storageState.totalCapacityBytes,
        utilizationPercent: storageUtilization,
      },
      communications: {
        isWindowActive: visibleStations.length > 0,
        activeStationIds: visibleStations.map((s) => s.stationId),
        uplinkQueueLength: this.commManager
          .getCommandQueue()
          .getAllCommands()
          .filter((c) => c.status === 'QUEUED' || c.status === 'TRANSMITTING' || c.status === 'IN_TRANSIT').length,
        downlinkQueueLength: this.commManager
          .getTelemetryQueue()
          .getAllPackets()
          .filter((p) => p.status === 'QUEUED' || p.status === 'TRANSMITTING' || p.status === 'IN_TRANSIT').length,
        totalTransmittedBytes: 0,
        oneWayLightTimeSeconds,
      },
      faults: {
        activeCount: activeFaults.length,
        criticalCount: criticalFaults.length,
        activeFaults: [...activeFaults],
      },
      objectives,
      availableDecisions,
      decisionHistory,
      evidenceItems,
      activeAnomalies,
      scienceProducts: {
        reasonCount: reasonProducts.length,
        maspexCount: maspexProducts.length,
        totalCount: reasonProducts.length + maspexProducts.length,
      },
      recentEvents,
      campaign: this.campaignManager?.getSnapshot(),
      navigation: this.navManager?.getSnapshot(),
      surface: this.surfaceManager?.getSnapshot(),
      spacecraftConfig: this.getSpacecraftConfig(),
      spacecraftMetrics: this.getSpacecraftMetrics(),
      validationReport: this.validationReport,
      isReadinessCertified: this.isReadinessCertified,
      isLaunchAuthorized: this.isLaunchAuthorized,
      briefingAcknowledged: this.briefingAcknowledged,
      selectedMissionId: this.selectedMissionId,
      selectedMission: this.getSelectedMission(),
      missionEvaluation: this.missionEvaluation,
      error: this.lastError,
    };
  }

  /* -------------------------------------------------------------------------- */
  /* Safe React Command Interface                                               */
  /* -------------------------------------------------------------------------- */

  private emitCampaignEvent(type: string, payload: unknown = {}): void {
    if (!this.campaignManager) return;
    const bridge = this.campaignManager.getEventBridge();
    if (!bridge) return;
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    const event: MissionEvent = {
      id: `evt-${type.toLowerCase().replace(/_/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      scheduledTimeSeconds: currentMET,
      payload,
      priority: 10,
      sequenceNumber: 1,
      status: 'EXECUTED',
      createdAtSeconds: currentMET,
    };
    bridge.processEvent(event, currentMET);
  }

  public getSelectedMission(): Mission {
    return AVAILABLE_MISSIONS.find((m) => m.id === this.selectedMissionId) || AVAILABLE_MISSIONS[0];
  }

  public selectMission(missionId: string): { success: boolean; mission: Mission } {
    const mission = AVAILABLE_MISSIONS.find((m) => m.id === missionId && !m.locked);
    if (!mission) {
      throw new Error(`selectMission: Mission '${missionId}' not found or is locked.`);
    }
    this.selectedMissionId = mission.id;

    this.emitCampaignEvent('MISSION_SELECTED', { missionId: mission.id });

    this.updateSnapshot();
    return { success: true, mission };
  }

  public acknowledgeBriefing(): { success: boolean } {
    this.briefingAcknowledged = true;

    this.emitCampaignEvent('EVT_BRIEFING_ACKNOWLEDGED');

    this.updateSnapshot();
    if (this.autoPersistCampaign) {
      try {
        this.campaignManager?.saveSync();
      } catch {
        // Fallback
      }
    }
    return { success: true };
  }

  public getSpacecraftConfig(): SpacecraftConfig {
    return {
      name: this.spacecraftConfig.name,
      parts: { ...this.spacecraftConfig.parts },
      launchVehicle: { ...this.spacecraftConfig.launchVehicle },
    };
  }

  public setSpacecraftPart(category: ComponentCategory, part: SpacecraftPart): void {
    if (!part || !part.id) {
      throw new TypeError('setSpacecraftPart: part must be a valid SpacecraftPart.');
    }
    validatePartNumericalValues(part);

    this.spacecraftConfig.parts[category] = part;

    // Reset readiness and launch authorization upon design changes
    this.isReadinessCertified = false;
    this.readinessCertifiedAtMET = undefined;
    this.acknowledgedWarnings = [];
    this.isLaunchAuthorized = false;
    this.launchAuthorizedAtMET = undefined;
    this.validationReport = undefined;

    // If propulsion changed, update propellant capacity and live subsystem
    if (category === 'propulsion') {
      const { propellantCapacityKg } = getPropulsionSpecs(part);
      this.propellantCapacityKg = propellantCapacityKg;
      const propSub = this.flightComputer.getSubsystemManager().getSubsystem('PROPULSION') as PropulsionSubsystem;
      if (propSub) {
        propSub.setPropellantRemainingKg(propellantCapacityKg);
      }
    }

    // If campaign has progressed beyond SPACECRAFT_DESIGN before LAUNCH, roll back to re-validate
    if (this.campaignManager) {
      const currentStage = this.campaignManager.getCurrentStageId();
      const currentIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf(currentStage);
      const designIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf('SPACECRAFT_DESIGN');
      const launchIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf('LAUNCH');
      if (currentIdx > designIdx && currentIdx < launchIdx) {
        this.campaignManager.getStateMachine().transitionTo(
          'SPACECRAFT_DESIGN',
          this.flightComputer.getCurrentMETSeconds(),
          { note: `Spacecraft architecture modified (${category}: ${part.name}); resetting validation and readiness.` }
        );
        this.campaignManager.evaluateCurrentStage();
      }
    }

    this.updateSnapshot();
    if (this.autoPersistCampaign) {
      try {
        this.campaignManager?.saveSync();
      } catch {
        // Fallback
      }
    }
  }

  public setLaunchVehicle(vehicle: LaunchVehicle): void {
    if (!vehicle || !vehicle.id) {
      throw new TypeError('setLaunchVehicle: vehicle must be a valid LaunchVehicle.');
    }
    this.spacecraftConfig.launchVehicle = vehicle;

    // Invalidate readiness and authorization
    this.isReadinessCertified = false;
    this.readinessCertifiedAtMET = undefined;
    this.acknowledgedWarnings = [];
    this.isLaunchAuthorized = false;
    this.launchAuthorizedAtMET = undefined;
    this.validationReport = undefined;

    if (this.campaignManager) {
      const currentStage = this.campaignManager.getCurrentStageId();
      const currentIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf(currentStage);
      const designIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf('SPACECRAFT_DESIGN');
      const launchIdx = CAMPAIGN_STAGES_SEQUENCE.indexOf('LAUNCH');
      if (currentIdx > designIdx && currentIdx < launchIdx) {
        this.campaignManager.getStateMachine().transitionTo(
          'SPACECRAFT_DESIGN',
          this.flightComputer.getCurrentMETSeconds(),
          { note: `Launch vehicle modified to ${vehicle.name}; resetting validation and readiness.` }
        );
        this.campaignManager.evaluateCurrentStage();
      }
    }

    this.updateSnapshot();
    if (this.autoPersistCampaign) {
      try {
        this.campaignManager?.saveSync();
      } catch {
        // Fallback
      }
    }
  }

  public getSpacecraftMetrics(): SpacecraftMetrics {
    return calculateSpacecraftMetrics(this.spacecraftConfig);
  }

  public getValidationReport(): SpacecraftValidationReport | undefined {
    return this.validationReport;
  }

  public validateSpacecraftArchitecture(): SpacecraftValidationReport {
    const report = evaluateSpacecraftConfiguration(this.spacecraftConfig);
    this.validationReport = report;

    if (report.overallStatus === 'PASS' || report.overallStatus === 'WARNING') {
      this.emitCampaignEvent('SPACECRAFT_CONFIGURED');
      this.emitCampaignEvent('VALIDATION_COMPLETED', { status: report.overallStatus });
    } else {
      this.emitCampaignEvent('VALIDATION_FAILED', {
        status: report.overallStatus,
        failures: report.failures,
        missingData: report.missingData,
      });
    }

    this.updateSnapshot();
    if (this.autoPersistCampaign) {
      try {
        this.campaignManager?.saveSync();
      } catch {
        // Fallback
      }
    }
    return report;
  }

  public certifyMissionReadiness(options?: { acknowledgeWarnings?: boolean }): {
    success: boolean;
    reasons?: string[];
    requiresWarningAcknowledgment?: boolean;
    warnings?: string[];
  } {
    if (!this.validationReport) {
      this.validationReport = evaluateSpacecraftConfiguration(this.spacecraftConfig);
    }

    const reasons: string[] = [];

    if (this.validationReport.overallStatus === 'FAIL') {
      reasons.push('Spacecraft engineering validation status is FAIL.');
    }
    if (this.validationReport.overallStatus === 'INCOMPLETE') {
      reasons.push('Spacecraft engineering validation is INCOMPLETE. Required subsystems missing.');
    }

    const metrics = calculateSpacecraftMetrics(this.spacecraftConfig);
    if (!metrics.isWithinBudget) {
      reasons.push(`Budget exceeded (${metrics.budgetUsedPercent.toFixed(1)}% / 100%).`);
    }
    if (!metrics.isWithinPayloadCapacity) {
      reasons.push(`Payload capacity exceeded (${metrics.totalWetMassKg.toFixed(0)} kg > ${metrics.launchVehicleMaxPayloadKg} kg).`);
    }
    if (metrics.incompatibilities.length > 0) {
      reasons.push(...metrics.incompatibilities);
    }

    const criticalFaults = this.flightComputer.getFaultManager().getFaultsBySeverity('CRITICAL');
    if (criticalFaults.length > 0) {
      reasons.push(`Unresolved critical faults present (${criticalFaults.length}).`);
    }

    if (reasons.length > 0) {
      this.isReadinessCertified = false;
      this.readinessCertifiedAtMET = undefined;
      this.updateSnapshot();
      return { success: false, reasons };
    }

    // Explicit warning acknowledgment gate
    if (this.validationReport.overallStatus === 'WARNING') {
      if (!options?.acknowledgeWarnings && this.acknowledgedWarnings.length === 0) {
        return {
          success: false,
          requiresWarningAcknowledgment: true,
          warnings: this.validationReport.warnings,
          reasons: [
            'Engineering validation contains unresolved warnings requiring explicit Flight Director acknowledgment: ' +
              this.validationReport.warnings.join('; '),
          ],
        };
      }
      if (options?.acknowledgeWarnings) {
        this.acknowledgedWarnings = [...this.validationReport.warnings];
      }
    }

    const currentMET = this.flightComputer.getCurrentMETSeconds();
    this.isReadinessCertified = true;
    this.readinessCertifiedAtMET = currentMET;

    this.emitCampaignEvent('READINESS_CERTIFIED');

    this.updateSnapshot();
    if (this.autoPersistCampaign) {
      try {
        this.campaignManager?.saveSync();
      } catch {
        // Fallback
      }
    }
    return { success: true };
  }

  public authorizeLaunch(atMET?: number): { success: boolean; message: string } {
    if (!this.isReadinessCertified) {
      return {
        success: false,
        message: 'Launch authorization rejected: Mission readiness review has not been certified.',
      };
    }

    if (this.validationReport?.overallStatus === 'FAIL' || this.validationReport?.overallStatus === 'INCOMPLETE') {
      return {
        success: false,
        message: 'Launch authorization rejected: Spacecraft architecture failed engineering validation.',
      };
    }

    const currentState = this.flightComputer.getExecutionController().getState();
    if (currentState === 'PRELAUNCH_HOLD') {
      return {
        success: false,
        message: 'Launch authorization rejected: Launch vehicle is currently in PRELAUNCH_HOLD.',
      };
    }

    const currentMET = atMET ?? this.flightComputer.getCurrentMETSeconds();
    this.isLaunchAuthorized = true;
    this.launchAuthorizedAtMET = currentMET;

    if (currentState === 'INITIALIZED') {
      this.flightComputer.getExecutionController().transitionTo(
        'STANDBY',
        currentMET,
        'Launch authorization granted by Flight Director; systems in countdown standby.'
      );
    }

    this.emitCampaignEvent('LAUNCH_AUTHORIZED');

    this.updateSnapshot();
    if (this.autoPersistCampaign) {
      try {
        this.campaignManager?.saveSync();
      } catch {
        // Fallback
      }
    }
    return {
      success: true,
      message: 'Launch authorization granted by Flight Operations Director.',
    };
  }

  public async executeLaunchSequence(): Promise<{ success: boolean; flightState: string; propellantConsumedKg: number; message: string }> {
    const currentState = this.flightComputer.getExecutionController().getState();
    if (currentState === 'ACTIVE') {
      throw new Error('executeLaunchSequence: Spacecraft is already active in flight. Cannot re-execute launch sequence.');
    }
    if (currentState === 'PRELAUNCH_HOLD') {
      throw new Error('executeLaunchSequence: Cannot launch while in PRELAUNCH_HOLD.');
    }
    if (this.isExecutingLaunch) {
      throw new Error('executeLaunchSequence: Launch sequence is already in progress.');
    }
    if (!this.isLaunchAuthorized) {
      throw new Error('executeLaunchSequence: Launch authorization has not been granted. Cannot initiate launch sequence.');
    }

    this.isExecutingLaunch = true;
    try {
      const currentMET = this.flightComputer.getCurrentMETSeconds();

      this.emitCampaignEvent('LAUNCH_INITIATED');

      const propSub = this.flightComputer.getSubsystemManager().getSubsystem('PROPULSION') as PropulsionSubsystem;
      const burnMassKg = Math.min(25.0, propSub?.getPropellantRemainingKg() ?? 25.0);
      if (propSub && burnMassKg > 0) {
        propSub.consumePropellant(burnMassKg);
      }

      if (currentState === 'STANDBY' || currentState === 'INITIALIZED') {
        if (currentState === 'INITIALIZED') {
          this.flightComputer.getExecutionController().transitionTo(
            'STANDBY',
            currentMET,
            'Terminal countdown auto-transition to STANDBY.'
          );
        }
        this.flightComputer.getExecutionController().transitionTo(
          'ACTIVE',
          currentMET,
          'Liftoff and stage separation confirmed. Spacecraft active in flight.'
        );
      }

      if (!this.eventEngine.getTimeController().isRunning()) {
        this.eventEngine.getTimeController().resume();
      }

      this.updateSnapshot();

      this.emitCampaignEvent('LAUNCH_COMPLETE');
      // CRIT-01 FIX: TJI is a separate navigation maneuver, NOT emitted here.

      // CRIT-02 FIX: Invalidate launch authorization after liftoff
      this.isLaunchAuthorized = false;
      this.launchAuthorizedAtMET = undefined;

      this.updateSnapshot();
      return {
        success: true,
        flightState: this.flightComputer.getExecutionController().getState(),
        propellantConsumedKg: burnMassKg,
        message: 'Liftoff and ascent confirmed. Spacecraft active in initial parking orbit.',
      };
    } finally {
      this.isExecutingLaunch = false;
    }
  }

  public abortLaunch(reason: string): { success: boolean; message: string } {
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    this.isLaunchAuthorized = false;
    this.launchAuthorizedAtMET = undefined;
    this.isReadinessCertified = false;
    this.readinessCertifiedAtMET = undefined;
    this.acknowledgedWarnings = [];

    const fsw = this.flightComputer.getExecutionController();
    const state = fsw.getState();
    if (state === 'STANDBY' || state === 'INITIALIZED') {
      fsw.transitionTo('PRELAUNCH_HOLD', currentMET, `Launch countdown aborted: ${reason}`);
    } else if (state === 'ACTIVE') {
      fsw.transitionTo('SAFE_MODE', currentMET, `Launch sequence aborted: ${reason}`);
    }

    this.campaignManager?.getStateMachine().fail(`Launch aborted: ${reason}`, currentMET);
    this.campaignManager?.evaluateCurrentStage(currentMET);

    this.updateSnapshot();
    return {
      success: true,
      message: `Launch aborted: ${reason}`,
    };
  }

  public getAvailableDecisions(): readonly DecisionOption[] {
    const met = this.flightComputer.getCurrentMETSeconds();
    return this.decisionManager.generateAndValidateOptions(met);
  }

  public evaluateDecision(optionId: string): DecisionEvaluationReport {
    const options = this.getAvailableDecisions();
    let opt = options.find((o) => o.id === optionId);
    if (!opt) {
      const activeRecord = this.decisionManager.getAuthorizationEngine().getRecord(optionId);
      if (activeRecord) {
        opt = activeRecord.option;
        const met = this.flightComputer.getCurrentMETSeconds();
        this.decisionManager.syncEngineeringSnapshot(met);
        const snap = this.decisionManager.getEvidenceManager().getEngineeringSnapshot();
        opt.validationResult = this.decisionManager.getValidator().validate(
          opt,
          snap,
          this.decisionManager.getObjectiveEvaluator(),
          met
        );
        activeRecord.option.validationResult = opt.validationResult;
      }
    }
    if (!opt) {
      throw new Error(`SimulationRuntime: Decision option '${optionId}' not found.`);
    }

    return {
      option: opt,
      isFeasible: opt.validationResult?.status === 'FEASIBLE',
      validationReasons: opt.validationResult?.reasons ?? [],
      missingResources: opt.validationResult?.missingResourceMetrics ?? [],
      compositeRiskScore: opt.riskAssessment.compositeRiskScore,
      highestRiskSeverity: opt.riskAssessment.highestSeverity,
    };
  }

  public proposeDecision(optionId: string): DecisionRecord {
    const met = this.flightComputer.getCurrentMETSeconds();
    const options = this.decisionManager.generateAndValidateOptions(met);
    const opt = options.find((o) => o.id === optionId);
    if (!opt) {
      throw new Error(`SimulationRuntime: Decision option '${optionId}' not found for proposal.`);
    }

    const record = this.decisionManager.proposeDecision(opt, met);
    this.updateSnapshot();
    return record;
  }

  public authorizeDecision(decisionId: string, approved: boolean, reason?: string): DecisionRecord {
    const met = this.flightComputer.getCurrentMETSeconds();
    const authReason = reason ?? (approved ? 'Authorized by Flight Director' : 'Rejected by Flight Director');
    const record = this.decisionManager.authorizeDecision(decisionId, approved, authReason, met);
    this.updateSnapshot();
    return record;
  }

  public async executeDecision(decisionId: string): Promise<DecisionExecutionResult> {
    const met = this.flightComputer.getCurrentMETSeconds();
    try {
      const result = await this.decisionManager.executeDecision(decisionId, met);
      this.updateSnapshot();
      return result;
    } catch (err: any) {
      this.lastError = err?.message ?? String(err);
      this.updateSnapshot();
      return {
        decisionId,
        success: false,
        executedAtMET: met,
        consequences: [],
        errorMessage: err?.message ?? String(err),
      };
    }
  }

  public getScienceProducts(): {
    reason: readonly ReasonLevel2Product[];
    maspex: readonly MaspexLevel2Product[];
    total: number;
  } {
    const allL2 = this.scienceManager.getDataRegistry().getAllLevel2();
    const reason = allL2.filter((p): p is ReasonLevel2Product => p.instrument === 'REASON');
    const maspex = allL2.filter((p): p is MaspexLevel2Product => p.instrument === 'MASPEX');
    return {
      reason,
      maspex,
      total: reason.length + maspex.length,
    };
  }

  public getMissionEvents(limit?: number): readonly EventExecutionResult[] {
    const history = this.eventEngine.getExecutionHistory();
    if (limit && limit > 0) {
      return history.slice(-limit);
    }
    return history;
  }

  public ingestScienceProduct(product: ScienceProductLevel2): void {
    const met = this.flightComputer.getCurrentMETSeconds();
    try {
      this.scienceManager.getDataRegistry().registerLevel2(product);
    } catch {
      // In standalone ingestion, registry might not contain parent L1 product
    }
    this.decisionManager.ingestScienceProduct(product, met);
    this.updateSnapshot();
  }

  public ingestAnomalyReport(anomaly: ScienceAnomalyReport): void {
    const met = this.flightComputer.getCurrentMETSeconds();
    this.decisionManager.ingestAnomalyReport(anomaly, met);
    this.updateSnapshot();
  }

  /* -------------------------------------------------------------------------- */
  /* Underlying Component Accessors (Engineering Auditing)                      */
  /* -------------------------------------------------------------------------- */

  public getFlightComputer(): FlightComputer {
    return this.flightComputer;
  }

  public getCommunicationManager(): CommunicationManager {
    return this.commManager;
  }

  public getScienceManager(): ScienceProcessingManager {
    return this.scienceManager;
  }

  public getDecisionManager(): MissionDecisionManager {
    return this.decisionManager;
  }

  public getEventEngine(): MissionEventEngine {
    return this.eventEngine;
  }

  public getCampaignManager(): CampaignManager {
    return this.campaignManager;
  }

  /* -------------------------------------------------------------------------- */
  /* Authoritative State Export & Restoration (CRIT-01)                         */
  /* -------------------------------------------------------------------------- */

  public exportSaveSnapshot(): AuthoritativeRuntimeSnapshot {
    const met = this.flightComputer.getCurrentMETSeconds();
    const clockState = this.eventEngine.getTimeController().getClockState();

    const fswController = this.flightComputer.getExecutionController();
    const propSub = this.flightComputer.getSubsystemManager().getSubsystem('PROPULSION') as PropulsionSubsystem;
    const faultManager = this.flightComputer.getFaultManager();

    const commStorage = this.commManager.getStorage();
    const commandQueue = this.commManager.getCommandQueue();
    const telemetryQueue = this.commManager.getTelemetryQueue();

    const scienceRegistry = this.scienceManager.getDataRegistry();
    const anomalyDetector = this.scienceManager.getAnomalyDetector();

    const authEngine = this.decisionManager.getAuthorizationEngine();
    const historyTracker = this.decisionManager.getHistoryTracker();
    const evidenceManager = this.decisionManager.getEvidenceManager();

    const scheduler = this.eventEngine.getScheduler();

    return {
      schemaVersion: 1,
      campaignId: this.campaignId,
      metSeconds: met,
      clock: {
        metSeconds: clockState.metSeconds,
        isRunning: clockState.isRunning,
        epochTimestampSeconds: clockState.epochTimestampSeconds,
      },
      flightComputer: {
        flightState: fswController.getState(),
        stateHistory: fswController.getTransitionHistory(),
        subsystemStatuses: this.flightComputer.getSubsystemManager().getStatuses(),
        propellantRemainingKg: propSub?.getPropellantRemainingKg() ?? 0,
        propellantCapacityKg: this.propellantCapacityKg,
        activeFaults: faultManager.getActiveFaults(),
        faultHistory: faultManager.getFaultHistory(),
      },
      communications: {
        storagePackets: commStorage.getAllPackets(),
        commandQueue: commandQueue.getAllCommands(),
        telemetryQueue: telemetryQueue.getAllPackets(),
      },
      science: {
        level0Products: scienceRegistry.getAllLevel0(),
        level1Products: scienceRegistry.getAllLevel1(),
        level2Products: scienceRegistry.getAllLevel2(),
        anomalies: anomalyDetector.getAllAnomalies(),
      },
      decisions: {
        decisionHistory: historyTracker.getAllRecords(),
        authorizedRecords: authEngine.getAllRecords(),
        evidenceItems: [...evidenceManager.getAllEvidence()],
      },
      events: {
        scheduledEvents: scheduler.getAllEvents(),
        sequenceCounter: scheduler.getSequenceCounter(),
        executionHistory: this.eventEngine.getExecutionHistory(),
      },
      navigation: this.navManager.exportState(),
      surface: this.surfaceManager.exportState(),
      prelaunch: {
        selectedMissionId: this.selectedMissionId,
        briefingAcknowledged: this.briefingAcknowledged,
        spacecraftConfig: this.getSpacecraftConfig(),
        validationReport: this.validationReport,
        isReadinessCertified: this.isReadinessCertified,
        readinessCertifiedAtMET: this.readinessCertifiedAtMET,
        isLaunchAuthorized: this.isLaunchAuthorized,
        launchAuthorizedAtMET: this.launchAuthorizedAtMET,
        acknowledgedWarnings: [...this.acknowledgedWarnings],
      },
      campaign: {
        currentStageId: this.campaignManager.getCurrentStageId(),
        currentStageStatus: this.campaignManager.getStatus(),
        completedStageIds: this.campaignManager.getCompletedStages(),
        stageHistory: this.campaignManager.getHistory(),
        processedEventIds: Array.from(this.campaignManager.getEventBridge().getProcessedEventIds()),
        processedEventTypes: Array.from(this.campaignManager.getEventBridge().getProcessedEventTypes()),
      },
      missionEvaluation: this.missionEvaluation,
    };
  }

  public restoreSaveSnapshot(snapshot: AuthoritativeRuntimeSnapshot): void {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new TypeError('restoreSaveSnapshot: snapshot must be an object.');
    }
    if (snapshot.schemaVersion !== 1) {
      throw new Error(`restoreSaveSnapshot: Unsupported snapshot schemaVersion '${snapshot.schemaVersion}'.`);
    }

    // 1. Restore Mission Clock and TimeController
    this.eventEngine.getTimeController().restoreState({
      metSeconds: snapshot.clock.metSeconds,
      isRunning: snapshot.clock.isRunning,
      epochTimestampSeconds: snapshot.clock.epochTimestampSeconds,
    });

    // 2. Restore Flight Computer & Subsystems
    this.flightComputer.getExecutionController().restoreState(
      snapshot.flightComputer.flightState,
      snapshot.flightComputer.stateHistory
    );
    this.flightComputer.getSubsystemManager().restoreStatuses(snapshot.flightComputer.subsystemStatuses);
    const propSub = this.flightComputer.getSubsystemManager().getSubsystem('PROPULSION') as PropulsionSubsystem;
    if (propSub && typeof snapshot.flightComputer.propellantRemainingKg === 'number') {
      propSub.setPropellantRemainingKg(snapshot.flightComputer.propellantRemainingKg);
    }
    this.flightComputer.getFaultManager().restoreFaults(
      snapshot.flightComputer.activeFaults,
      snapshot.flightComputer.faultHistory
    );

    // 3. Restore Communications
    this.commManager.getStorage().restorePackets(snapshot.communications.storagePackets);
    this.commManager.getCommandQueue().restoreCommands(snapshot.communications.commandQueue);
    this.commManager.getTelemetryQueue().restorePackets(snapshot.communications.telemetryQueue);

    // 4. Restore Science
    this.scienceManager.getDataRegistry().restoreProducts(
      snapshot.science.level0Products,
      snapshot.science.level1Products,
      snapshot.science.level2Products
    );
    this.scienceManager.getAnomalyDetector().restoreAnomalies(snapshot.science.anomalies);

    // 5. Restore Decisions & Evidence
    this.decisionManager.getHistoryTracker().restoreHistory(snapshot.decisions.decisionHistory);
    this.decisionManager.getAuthorizationEngine().clear();
    this.decisionManager.getAuthorizationEngine().restoreRecords(snapshot.decisions.authorizedRecords);
    this.decisionManager.getEvidenceManager().restoreEvidence(snapshot.decisions.evidenceItems);

    // 6. Restore Event Engine & Scheduler
    this.eventEngine.getScheduler().restoreEvents(
      snapshot.events.scheduledEvents,
      snapshot.events.sequenceCounter
    );
    this.eventEngine.restoreExecutionHistory(snapshot.events.executionHistory);

    // 7. Restore Navigation State (backward-compatible)
    if (snapshot.navigation) {
      this.navManager.restoreState(snapshot.navigation);
    }

    // 8. Restore Surface Mission State (backward-compatible)
    if (snapshot.surface) {
      this.surfaceManager.restoreState(snapshot.surface);
    }

    // 9. Restore Prelaunch State (backward-compatible)
    if (snapshot.prelaunch) {
      this.selectedMissionId = snapshot.prelaunch.selectedMissionId ?? 'europa-survey';
      this.briefingAcknowledged = snapshot.prelaunch.briefingAcknowledged ?? false;
      if (snapshot.prelaunch.spacecraftConfig) {
        this.spacecraftConfig = {
          name: snapshot.prelaunch.spacecraftConfig.name,
          parts: { ...snapshot.prelaunch.spacecraftConfig.parts },
          launchVehicle: { ...snapshot.prelaunch.spacecraftConfig.launchVehicle },
        };
      }
      this.validationReport = snapshot.prelaunch.validationReport;
      this.isReadinessCertified = snapshot.prelaunch.isReadinessCertified ?? false;
      this.readinessCertifiedAtMET = snapshot.prelaunch.readinessCertifiedAtMET;
      this.isLaunchAuthorized = snapshot.prelaunch.isLaunchAuthorized ?? false;
      this.launchAuthorizedAtMET = snapshot.prelaunch.launchAuthorizedAtMET;
      this.acknowledgedWarnings = snapshot.prelaunch.acknowledgedWarnings ? [...snapshot.prelaunch.acknowledgedWarnings] : [];
    }

    // 10. Restore Mission Evaluation (backward-compatible)
    if (snapshot.missionEvaluation) {
      this.missionEvaluation = snapshot.missionEvaluation;
      this.anomalyDecisionChosen = snapshot.missionEvaluation.anomalyDecision;
    }

    // 11. Restore Campaign State
    if (snapshot.campaign) {
      this.campaignManager.restoreState(
        snapshot.campaign.currentStageId,
        snapshot.campaign.currentStageStatus,
        [...snapshot.campaign.completedStageIds],
        [...snapshot.campaign.stageHistory],
        snapshot.campaign.processedEventIds,
        snapshot.campaign.processedEventTypes
      );
    }

    // 12. Refresh current snapshot and notify listeners
    this.updateSnapshot();
  }

  /* -------------------------------------------------------------------------- */
  /* Navigation & Astrodynamics Command Delegation                              */
  /* -------------------------------------------------------------------------- */

  public getNavigationManager(): NavigationManager {
    return this.navManager;
  }

  public validateNavigationManeuver(maneuverId: string): ManeuverValidationReport {
    return this.navManager.validateManeuver(maneuverId);
  }

  public async executeNavigationManeuver(maneuverId: string): Promise<ManeuverExecutionResult> {
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    const result = await this.navManager.executeManeuver(maneuverId, currentMET);
    this.updateSnapshot();
    return result;
  }

  public async executeJupiterApproach(): Promise<ManeuverExecutionResult> {
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    const result = await this.navManager.executeJupiterApproach(currentMET);
    this.updateSnapshot();
    return result;
  }

  public triggerReconnaissanceScan(): { success: boolean; bytesGenerated: number; reason?: string } {
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    const result = this.navManager.triggerReconnaissanceScan(currentMET);
    if (result.success && result.level0Product) {
      const pipelineRes = this.scienceManager.processCompletePipeline(result.level0Product.id, currentMET);
      if (pipelineRes.level2Product) {
        this.decisionManager.ingestScienceProduct(pipelineRes.level2Product, currentMET);
      }
      if (pipelineRes.anomalyReport) {
        this.decisionManager.ingestAnomalyReport(pipelineRes.anomalyReport, currentMET);
      }
    }
    this.updateSnapshot();
    return {
      success: result.success,
      bytesGenerated: result.bytesGenerated,
      reason: result.reason,
    };
  }

  /* -------------------------------------------------------------------------- */
  /* Surface Mission & Micro-Rover Command Delegation                           */
  /* -------------------------------------------------------------------------- */

  public getSurfaceMissionManager(): SurfaceMissionManager {
    return this.surfaceManager;
  }

  public deploySurfaceRover(): { success: boolean; message: string } {
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    const result = this.surfaceManager.deploySurfaceRover(currentMET);
    this.updateSnapshot();
    return result;
  }

  public executeRoverTraverse(targetX: number, targetY: number): TraverseExecutionResult {
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    const result = this.surfaceManager.executeTraverse(targetX, targetY, currentMET);
    this.updateSnapshot();
    return result;
  }

  public executeSurfaceScience(instrumentId: SurfaceInstrumentId): ScienceAcquisitionResult {
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    const result = this.surfaceManager.executeScience(instrumentId, currentMET);
    this.updateSnapshot();
    return result;
  }

  public completeEuropaReconnaissance(): { success: boolean; message: string } {
    const flyby = this.navManager.getEuropaFlybyState();
    if (!flyby.reconnaissanceDataAcquired && this.scienceManager.getDataRegistry().getAllLevel2().length === 0) {
      return { success: false, message: 'Reconnaissance sounding data has not been acquired.' };
    }
    this.emitCampaignEvent('EUROPA_FLYBY_COMPLETE', {
      reconnaissanceCompleted: true,
      scansCount: flyby.highResolutionScansCompleted,
    });
    this.updateSnapshot();
    return { success: true, message: 'Europa reconnaissance survey complete. Surface landing preparation authorized.' };
  }

  public selectLandingSite(siteName: string = 'Pelagon Chaos'): { success: boolean; landingSite: string } {
    this.emitCampaignEvent('LANDING_SITE_SELECTED', {
      landingSite: siteName,
      coordinates: '30.2°N, 215.4°W',
      terrainClassification: 'Pelagon Chaos / Ridged Plains',
    });
    this.updateSnapshot();
    return { success: true, landingSite: siteName };
  }

  public authorizeParkingOrbitAssumption(): { success: boolean; message: string } {
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    const navRes = this.navManager.authorizeParkingOrbitAssumption(currentMET);
    this.surfaceManager.authorizeParkingOrbitPrerequisite(currentMET);
    this.emitCampaignEvent('PARKING_ORBIT_ASSUMPTION_AUTHORIZED', {
      assumption: '100 km circular Europa parking orbit assumption acknowledged [SIMPLIFIED_OPERATIONAL_MODEL]',
    });
    this.updateSnapshot();
    return { success: true, message: navRes.message };
  }

  /**
   * Authorizes the controlled Europa parking-orbit mission-flow bypass for EXPEDITION-V.
   * Documents the gameplay abstraction without claiming physical orbital capture.
   */
  public authorizeParkingOrbitMissionFlowBypass(): { success: boolean; message: string } {
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    const navRes = this.navManager.authorizeParkingOrbitMissionFlowBypass(currentMET);
    this.surfaceManager.authorizeParkingOrbitPrerequisite(currentMET);
    this.emitCampaignEvent('PARKING_ORBIT_BYPASS_AUTHORIZED', {
      bypassType: 'MISSION_FLOW_GAMEPLAY_ABSTRACTION',
      physicalCaptureAchieved: false,
      stagedDescentAuthorized: true,
      authorizedAtMET: currentMET,
      documentation: 'Controlled hackathon mission-flow progression bypass without orbital mechanics modification.',
    });
    this.updateSnapshot();
    return { success: true, message: navRes.message };
  }

  public isParkingOrbitBypassActive(): boolean {
    return this.navManager.isParkingOrbitBypassAuthorized();
  }

  public async executeLanderDeployment(): Promise<ManeuverExecutionResult> {
    const stage = this.campaignManager.getCurrentStageId();
    if (stage !== 'SURFACE_MISSION_PREPARATION' && stage !== 'LANDER_DEPLOYMENT') {
      return {
        success: false,
        maneuverId: 'mnv-lander-deploy',
        maneuverType: 'LANDER_DEPLOYMENT',
        executedAtMET: this.flightComputer.getCurrentMETSeconds(),
        actualDeltaVMps: 0,
        propellantConsumedKg: 0,
        failureReason: 'Lander deployment requires completed Europa reconnaissance and surface mission preparation stage.',
        validationReport: {
          status: 'FAIL',
          isFeasible: false,
          reasons: ['Lander deployment requires completed Europa reconnaissance and surface mission preparation stage.'],
          requiredDeltaVMps: 0,
          requiredPropellantKg: 0,
          availablePropellantKg: 0,
          propellantMarginKg: 0,
          burnDurationSeconds: 0,
          initialMassKg: 0,
          finalMassKg: 0,
        },
      };
    }
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    const result = await this.navManager.executeManeuver('mnv-lander-deploy', currentMET);
    if (result.success) {
      this.emitCampaignEvent('LANDER_DEPLOYMENT_COMPLETE', {
        targetSite: 'Pelagon Chaos',
      });
    }
    this.updateSnapshot();
    return result;
  }

  public async executeLanderPoweredDescent(): Promise<ManeuverExecutionResult> {
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    const result = await this.navManager.executeManeuver('mnv-lander-descent', currentMET);
    if (result.success) {
      this.emitCampaignEvent('LANDER_TOUCHDOWN', {
        targetSite: 'Pelagon Chaos',
        terminalVelocityMps: 0.8,
      });
    }
    this.updateSnapshot();
    return result;
  }

  public transmitSurfaceDataToRelay(): { success: boolean; bytesUploaded: number; message: string } {
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    const result = this.surfaceManager.transmitDataToRelay(currentMET);
    if (result.success) {
      this.emitCampaignEvent('SURFACE_SAMPLING_COMPLETE', {
        bytesUploaded: result.bytesUploaded,
      });
    }
    this.updateSnapshot();
    return result;
  }

  public setRoverOperatingMode(mode: RoverOperatingMode): void {
    this.surfaceManager.setOperatingMode(mode);
    this.updateSnapshot();
  }

  public queueAllStoredScienceForDownlink(): { queuedCount: number; totalBytes: number } {
    const storagePackets = this.commManager.getStorage().getAllPackets();
    const telemetryQueue = this.commManager.getTelemetryQueue();
    let queuedCount = 0;
    let totalBytes = 0;

    for (const pkt of storagePackets) {
      if (pkt.category === 'science' && !telemetryQueue.hasPacket(pkt.id)) {
        try {
          telemetryQueue.enqueue({
            id: pkt.id,
            category: 'science',
            payload: { source: 'SSDR_SCIENCE_ARCHIVE', packetId: pkt.id },
            sizeBytes: pkt.sizeBytes,
            priority: pkt.priority ?? 100,
          });
          queuedCount++;
          totalBytes += pkt.sizeBytes;
        } catch {
          // Packet already in queue
        }
      }
    }
    this.updateSnapshot();
    return { queuedCount, totalBytes };
  }

  public executeDsnDownlinkStep(durationSeconds?: number): {
    success: boolean;
    bytesTransferred: number;
    newlyReceivedCount: number;
  } {
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    const position = this.flightComputer.getPosition();
    const ecef = this.flightComputer.getResolvedECEFPosition(currentMET);
    const target: SpacecraftPointingTarget = {
      subSpacecraftLatitudeDeg: ecef.subSpacecraftLatitudeDeg,
      subSpacecraftLongitudeDeg: ecef.subSpacecraftLongitudeDeg,
      distanceMetres: position.distanceMetres,
    };
    const spacecraftComm: SpacecraftCommConfig = {
      transmitPowerWatts: this.spacecraftConfig?.parts?.communication?.powerKw ? this.spacecraftConfig.parts.communication.powerKw * 1000 : 20.0,
      antennaGainDbi: 46.5,
    };

    // Calculate required pass duration to transfer queued science packets at achievable rate
    const pendingPackets = this.commManager.getTelemetryQueue().getAllPackets()
      .filter((p) => p.status === 'QUEUED' || p.status === 'INTERRUPTED');
    const pendingBytes = pendingPackets.reduce((acc, p) => acc + (p.sizeBytes - p.transmittedBytes), 0);
    const rateBps = 100_000;
    const requiredPassSeconds = rateBps > 0 && pendingBytes > 0 ? Math.ceil((pendingBytes * 8) / rateBps) : 3600;
    const effectiveDuration = Math.max(durationSeconds ?? 0, requiredPassSeconds, 3600);

    const commStep = this.commManager.processStep(effectiveDuration, currentMET, target, spacecraftComm);
    const owlt = Math.ceil(position.distanceMetres / 299_792_458);
    const arrived = this.commManager.getTelemetryQueue().updateArrivals(currentMET + effectiveDuration + owlt);

    for (const pkt of arrived) {
      this.decisionManager.getEvidenceManager().addEvidence({
        id: `ev-dsn-${pkt.id}`,
        sourceType: 'COMMUNICATION_STATUS',
        sourceId: pkt.id,
        summary: `Confirmed downlink transmission of science telemetry packet ${pkt.id} to Deep Space Network.`,
        timestampMET: currentMET + effectiveDuration + owlt,
        confidenceScore: 0.95,
        provenance: 'VERIFIED',
        isFictionalConstruct: false,
        payload: { packetId: pkt.id, sizeBytes: pkt.sizeBytes, category: pkt.category },
      });
    }

    const allTelemetry = this.commManager.getTelemetryQueue().getAllPackets();
    const scienceTelemetry = allTelemetry.filter((p) => p.category === 'science');
    if (scienceTelemetry.length > 0 && scienceTelemetry.every((p) => p.status === 'RECEIVED_EARTH')) {
      this.emitCampaignEvent('DATA_TRANSMISSION_COMPLETE', {
        packetsReturned: scienceTelemetry.length,
        totalBytes: scienceTelemetry.reduce((acc, p) => acc + p.sizeBytes, 0),
      });
    }

    this.updateSnapshot();
    return {
      success: commStep.isDownlinkActive || arrived.length > 0 || scienceTelemetry.length > 0,
      bytesTransferred: commStep.telemetryBytesTransferred,
      newlyReceivedCount: arrived.length,
    };
  }

  public executeAnomalyDecision(decision: 'analyze' | 'sample' | 'withdraw'): { success: boolean; decision: string } {
    if (this.campaignManager.getCurrentStageId() !== 'ANOMALY_INVESTIGATION') {
      throw new Error(`Cannot execute anomaly decision: current stage is ${this.campaignManager.getCurrentStageId()}, expected ANOMALY_INVESTIGATION.`);
    }
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    this.anomalyDecisionChosen = decision;

    this.decisionManager.getHistoryTracker().archiveRecord({
      decisionId: `dec-anomaly-${decision}-${currentMET}`,
      option: {
        id: `opt-anomaly-${decision}`,
        title: `Anomaly Response: ${decision.toUpperCase()}`,
        description: `Executive choice to ${decision} the Relic-Omega precursor anomaly.`,
        category: 'PRIORITIZE_ANOMALY',
        evidenceReferences: [],
        prerequisites: [],
        resourceRequirements: {
          estimatedPowerWatts: 0,
          estimatedPropellantKg: 0,
          estimatedStorageBytes: 0,
          estimatedDurationSeconds: 0,
        },
        riskAssessment: {
          compositeRiskScore: decision === 'analyze' ? 40 : decision === 'sample' ? 25 : 10,
          highestSeverity: 'LOW',
          hasHardConstraintViolation: false,
          risks: [],
          isAcceptableForExecution: true,
          evaluationMET: currentMET,
        },
      },
      status: 'EXECUTED',
      proposedAtMET: currentMET,
      authorizedAtMET: currentMET,
      authorizationReason: `Mission Director authorized anomaly protocol: ${decision}`,
      executedAtMET: currentMET,
      consequences: [
        {
          type: 'OBJECTIVE_PROGRESS',
          description: `Anomaly protocol executed: ${decision}`,
          affectedTarget: 'Relic-Omega',
          deltaOrValue: true,
          appliedAtMET: currentMET,
        },
      ],
    });

    this.emitCampaignEvent('ANOMALY_INVESTIGATED', {
      decision,
      target: 'Relic-Omega Torus Singularity [FICTIONAL_CONSTRUCT]',
      timestampMET: currentMET,
    });

    this.updateSnapshot();
    return { success: true, decision };
  }

  public evaluateMissionOutcome(): { success: boolean; report: MissionEvaluationReport } {
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    const snap = this.getSnapshot();

    const totalObjectives = snap.objectives.length;
    const completedObjs = snap.objectives.filter((o) => o.isCompleted);
    const completedCount = completedObjs.length;
    const objPercent = totalObjectives > 0 ? Math.round((completedCount / totalObjectives) * 100) : 0;

    const allTelemetry = this.commManager.getTelemetryQueue().getAllPackets();
    const receivedPackets = allTelemetry.filter((p) => p.status === 'RECEIVED_EARTH');
    const returnedBytes = receivedPackets.reduce((acc, p) => acc + p.sizeBytes, 0);
    const storagePackets = this.commManager.getStorage().getAllPackets();
    const totalAcquiredBytes = storagePackets.reduce((acc, p) => acc + p.sizeBytes, 0);

    const sciValPercent = totalAcquiredBytes > 0
      ? Math.min(100, Math.round((returnedBytes / totalAcquiredBytes) * 100))
      : 80;

    const propRemain = snap.propellantRemainingKg;
    const propCap = snap.propellantCapacityKg;
    const resEffPercent = propCap > 0 ? Math.max(10, Math.min(100, Math.round((propRemain / propCap) * 100 + 40))) : 80;

    const activeFaults = snap.faults.activeCount;
    const roverDose = snap.surface?.rover.cumulativeRadiationRads ?? 0;
    let riskPercent = Math.max(20, Math.min(100, 100 - activeFaults * 15 - Math.round(roverDose / 50)));
    if (this.anomalyDecisionChosen === 'withdraw') riskPercent = Math.min(100, riskPercent + 15);
    if (this.anomalyDecisionChosen === 'analyze') riskPercent = Math.max(10, riskPercent - 10);

    let score = Math.round((objPercent * 40 + sciValPercent * 30 + resEffPercent * 15 + riskPercent * 15) * 10);
    if (this.anomalyDecisionChosen === 'analyze') score += 400;
    if (this.anomalyDecisionChosen === 'sample') score += 200;

    let outcome: 'FULL_SUCCESS' | 'PARTIAL_SUCCESS' | 'MISSION_FAILURE' = 'FULL_SUCCESS';
    if (completedCount >= 3 && returnedBytes > 0) {
      outcome = 'FULL_SUCCESS';
    } else if (completedCount >= 1 || totalAcquiredBytes > 0) {
      outcome = 'PARTIAL_SUCCESS';
    } else {
      outcome = 'MISSION_FAILURE';
    }

    const discoveries = [
      'Subsurface ocean dielectric reflectors confirmed at >15 km depth',
      'Plume volatile signature & organic detection verified',
      'Pelagon Chaos pristine cryogenic ice geochemical composition logged',
    ];
    if (this.anomalyDecisionChosen === 'analyze') {
      discoveries.push('Toroidal aperture energy frequency resonance patterns mapped [FICTIONAL]');
    } else if (this.anomalyDecisionChosen === 'sample') {
      discoveries.push('Precursor alloy isotopic matrix crystalline lattice retrieved [FICTIONAL]');
    } else if (this.anomalyDecisionChosen === 'withdraw') {
      discoveries.push('Standoff gravitational gradient and safety perimeter established [FICTIONAL]');
    }

    let decisionSummary = 'Expedition-V completed nominal exploration directives across the Jovian system.';
    if (this.anomalyDecisionChosen === 'analyze') {
      decisionSummary = 'Aggressive energetic radar and harmonic scan pierced outer mantle, detecting active non-natural resonance patterns.';
    } else if (this.anomalyDecisionChosen === 'sample') {
      decisionSummary = 'Crystalline core samples extracted from the gate perimeter ring; extraterrestrial alloy verified.';
    } else if (this.anomalyDecisionChosen === 'withdraw') {
      decisionSummary = 'Vessel maintained safe standoff vector to guarantee crew and telemetry safety; verified telemetry successfully returned to Sol Command.';
    }

    const report: MissionEvaluationReport = {
      outcome,
      finalScore: score,
      maxScore: 10000,
      objectiveCompletionPercent: objPercent,
      resourceEfficiencyPercent: resEffPercent,
      riskHandlingPercent: riskPercent,
      scientificValuePercent: sciValPercent,
      discoveries,
      decisionSummary,
      scienceBytesReturnedToEarth: returnedBytes,
      totalScienceBytesAcquired: totalAcquiredBytes,
      evaluatedAtMET: currentMET,
      completedObjectiveCount: completedCount,
      totalObjectiveCount: totalObjectives,
      propellantRemainingKg: propRemain,
      propellantCapacityKg: propCap,
      radiationDoseRads: roverDose,
      activeFaultCount: activeFaults,
      anomalyInvestigated: this.anomalyDecisionChosen !== undefined,
      anomalyDecision: this.anomalyDecisionChosen,
    };

    this.missionEvaluation = report;

    this.emitCampaignEvent('MISSION_OBJECTIVES_EVALUATED', {
      outcome,
      finalScore: score,
      completedCount,
      totalObjectives,
    });

    this.updateSnapshot();
    return { success: true, report };
  }

  public archiveMissionDebrief(): { success: boolean; message: string } {
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    this.emitCampaignEvent('MISSION_DEBRIEF_ARCHIVED', {
      archivedAtMET: currentMET,
      campaignCompleted: true,
    });
    this.updateSnapshot();
    if (this.autoPersistCampaign) {
      try {
        this.campaignManager?.saveSync();
      } catch {
        // Fallback
      }
    }
    return { success: true, message: 'Expedition-V telemetry permanently archived. Campaign complete.' };
  }

  public emitOperationalEvent(type: string, payload: Record<string, unknown> = {}): void {
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    this.eventEngine.emitImmediateEvent({
      id: `evt-${type.toLowerCase().replace(/_/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      scheduledTimeSeconds: currentMET,
      payload,
    });
    this.updateSnapshot();
  }

  public processScientificObservationBatch(): { success: boolean } {
    const currentMET = this.flightComputer.getCurrentMETSeconds();
    this.emitOperationalEvent('SCIENCE_OBSERVATION_PROCESSED', {
      description: 'Observation batch processed. High-resolution radar sounding and mass spectra archived to SSDR.',
      processedAtMET: currentMET,
    });
    return { success: true };
  }
}
