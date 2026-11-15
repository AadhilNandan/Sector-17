/**
 * SECTOR 17 — Simulation Runtime Types
 * Dedicated integration contracts connecting the authoritative simulation core
 * with the React application layer.
 */

import type {
  MissionExecutionState,
  SubsystemType,
  SubsystemStatus,
  SpacecraftPositionState,
  FlightComputerStepReport,
  Fault,
  StateTransitionRecord,
} from '../simulation/flightSoftware/types';
import type {
  PowerBudgetResult,
  PowerBudgetInput,
  ThermalModelResult,
  ThermalModelInput,
  EventExecutionResult,
  MissionEvent,
} from '../simulation/types';
import type {
  DecisionOption,
  DecisionRecord,
  DecisionExecutionResult,
  DecisionEvidenceItem,
  ObjectivePriority,
  ObjectiveState,
} from '../simulation/missionDecision/types';
import type {
  ScienceAnomalyReport,
  ReasonLevel2Product,
  MaspexLevel2Product,
  Level0Product,
  Level1Product,
  ScienceProductLevel2,
} from '../simulation/science/types';
import type {
  StoragePacket,
  CommandPacket,
  TelemetryPacket,
} from '../simulation/communications/types';
import type { CampaignSnapshot, CampaignStageId, CampaignStageStatus } from '../campaign/campaignTypes';
import type { CampaignManager } from '../campaign/campaignManager';
import type {
  NavigationSnapshot,
  NavigationSerializedState,
  ManeuverExecutionResult,
  ManeuverValidationReport,
} from '../simulation/navigation/types';
import type { NavigationManager } from '../simulation/navigation/navigationManager';
import type {
  SurfaceMissionSnapshot,
  SurfaceSerializedState,
  SurfaceInstrumentId,
  RoverOperatingMode,
  TraverseExecutionResult,
  ScienceAcquisitionResult,
  SurfaceMissionManager,
} from '../simulation/surface';
import type {
  ComponentCategory,
  SpacecraftPart,
  LaunchVehicle,
  SpacecraftConfig,
  Mission,
} from '../types/game';
import type { SpacecraftValidationReport } from '../simulation/types';
import type { SpacecraftMetrics } from '../simulation/engineering/spacecraftConfiguration';

/**
 * Runtime lifecycle states governing the simulation execution orchestrator.
 * Clearly distinct from the FlightComputer's own flight state machine (MissionExecutionState).
 */
export type RuntimeLifecycleState =
  | 'INITIALIZING'
  | 'READY'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED';

/**
 * Storage metrics summary for the UI.
 */
export interface StorageSnapshot {
  readonly usedBytes: number;
  readonly capacityBytes: number;
  readonly utilizationPercent: number;
}

/**
 * Communication metrics summary for the UI.
 */
export interface CommunicationsSnapshot {
  readonly isWindowActive: boolean;
  readonly activeStationIds: readonly string[];
  readonly uplinkQueueLength: number;
  readonly downlinkQueueLength: number;
  readonly totalTransmittedBytes: number;
  readonly oneWayLightTimeSeconds: number;
}

/**
 * Fault metrics summary for the UI.
 */
export interface FaultsSnapshot {
  readonly activeCount: number;
  readonly criticalCount: number;
  readonly activeFaults: readonly Fault[];
}

/**
 * Science metrics summary for the UI.
 */
export interface ScienceProductsSnapshot {
  readonly reasonCount: number;
  readonly maspexCount: number;
  readonly totalCount: number;
}

/**
 * Enriched objective snapshot for the mission control dashboard.
 */
export interface MissionObjectiveSnapshot {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly priority: ObjectivePriority;
  readonly state: ObjectiveState;
  readonly progressPercent: number;
  readonly satisfiesPrerequisites: boolean;
  readonly unsatisfiedPrerequisites: readonly string[];
  readonly deadlineMET?: number;
  readonly isCompleted: boolean;
  readonly isFailed: boolean;
  readonly failureReason?: string;
  readonly missingEvidenceDescriptions: readonly string[];
}

/**
 * Immutable simulation snapshot exposed to React components.
 * Referentially stable when underlying simulation state has not mutated.
 */
export interface SimulationSnapshot {
  readonly campaignId: string;
  readonly lifecycle: RuntimeLifecycleState;
  readonly metSeconds: number;
  readonly formattedMET: string;
  readonly flightState: MissionExecutionState;
  readonly subsystems: Readonly<Record<SubsystemType, SubsystemStatus>>;
  readonly powerBudget?: Readonly<PowerBudgetResult>;
  readonly thermalModel?: Readonly<ThermalModelResult>;
  readonly propellantRemainingKg: number;
  readonly propellantCapacityKg: number;
  readonly storage: StorageSnapshot;
  readonly communications: CommunicationsSnapshot;
  readonly faults: FaultsSnapshot;
  readonly objectives: readonly MissionObjectiveSnapshot[];
  readonly availableDecisions: readonly DecisionOption[];
  readonly decisionHistory: readonly DecisionRecord[];
  readonly evidenceItems: readonly DecisionEvidenceItem[];
  readonly activeAnomalies: readonly ScienceAnomalyReport[];
  readonly scienceProducts: ScienceProductsSnapshot;
  readonly recentEvents: readonly EventExecutionResult[];
  readonly campaign?: Readonly<CampaignSnapshot>;
  readonly navigation?: Readonly<NavigationSnapshot>;
  readonly surface?: Readonly<SurfaceMissionSnapshot>;
  readonly spacecraftConfig?: Readonly<SpacecraftConfig>;
  readonly spacecraftMetrics?: Readonly<SpacecraftMetrics>;
  readonly validationReport?: Readonly<SpacecraftValidationReport>;
  readonly isReadinessCertified?: boolean;
  readonly isLaunchAuthorized?: boolean;
  readonly briefingAcknowledged?: boolean;
  readonly selectedMissionId?: string;
  readonly selectedMission?: Readonly<Mission>;
  readonly missionEvaluation?: Readonly<MissionEvaluationReport>;
  readonly error?: string;
}

/**
 * Authoritative Mission Evaluation generated at mission conclusion.
 */
export interface MissionEvaluationReport {
  readonly outcome: 'FULL_SUCCESS' | 'PARTIAL_SUCCESS' | 'MISSION_FAILURE';
  readonly finalScore: number;
  readonly maxScore: number;
  readonly objectiveCompletionPercent: number;
  readonly resourceEfficiencyPercent: number;
  readonly riskHandlingPercent: number;
  readonly scientificValuePercent: number;
  readonly discoveries: readonly string[];
  readonly decisionSummary: string;
  readonly scienceBytesReturnedToEarth: number;
  readonly totalScienceBytesAcquired: number;
  readonly evaluatedAtMET: number;
  readonly completedObjectiveCount: number;
  readonly totalObjectiveCount: number;
  readonly propellantRemainingKg: number;
  readonly propellantCapacityKg: number;
  readonly radiationDoseRads: number;
  readonly activeFaultCount: number;
  readonly anomalyInvestigated: boolean;
  readonly anomalyDecision?: 'analyze' | 'sample' | 'withdraw';
}

/**
 * Configuration options for initializing a SimulationRuntime instance.
 */
export interface SimulationRuntimeConfig {
  campaignId?: string;
  epochTimestampSeconds?: number;
  initialState?: MissionExecutionState;
  initialPosition?: SpacecraftPositionState;
  initialPropellantKg?: number;
  propellantCapacityKg?: number;
  storageCapacityBytes?: number;
  autoExecuteCommands?: boolean;
  autoGenerateGroundAcks?: boolean;
  powerConfig?: Partial<PowerBudgetInput>;
  thermalConfig?: Partial<ThermalModelInput>;
  autoPersistCampaign?: boolean;
}

/**
 * Options for continuous simulation progression.
 */
export interface RuntimeStartOptions {
  tickIntervalMs?: number;
  stepSizeSeconds?: number;
}

/**
 * Report generated when evaluating a candidate decision option.
 */
export interface DecisionEvaluationReport {
  readonly option: DecisionOption;
  readonly isFeasible: boolean;
  readonly validationReasons: readonly string[];
  readonly missingResources: readonly string[];
  readonly compositeRiskScore: number;
  readonly highestRiskSeverity: string;
}

/**
 * Complete serialized state of the authoritative simulation runtime,
 * capturing the clock, flight computer, subsystems, communications,
 * science data products, decisions, and event scheduler state.
 */
export interface AuthoritativeRuntimeSnapshot {
  readonly schemaVersion: number;
  readonly campaignId: string;
  readonly metSeconds: number;
  readonly clock: {
    readonly metSeconds: number;
    readonly isRunning: boolean;
    readonly epochTimestampSeconds?: number;
  };
  readonly flightComputer: {
    readonly flightState: MissionExecutionState;
    readonly stateHistory: StateTransitionRecord[];
    readonly subsystemStatuses: Record<SubsystemType, SubsystemStatus>;
    readonly propellantRemainingKg: number;
    readonly propellantCapacityKg: number;
    readonly activeFaults: Fault[];
    readonly faultHistory: Fault[];
  };
  readonly communications: {
    readonly storagePackets: StoragePacket[];
    readonly commandQueue: CommandPacket[];
    readonly telemetryQueue: TelemetryPacket[];
  };
  readonly science: {
    readonly level0Products: Level0Product[];
    readonly level1Products: Level1Product[];
    readonly level2Products: ScienceProductLevel2[];
    readonly anomalies: ScienceAnomalyReport[];
  };
  readonly decisions: {
    readonly decisionHistory: readonly DecisionRecord[];
    readonly authorizedRecords: readonly DecisionRecord[];
    readonly evidenceItems: readonly DecisionEvidenceItem[];
  };
  readonly events: {
    readonly scheduledEvents: readonly MissionEvent[];
    readonly sequenceCounter: number;
    readonly executionHistory: readonly EventExecutionResult[];
  };
  readonly navigation?: NavigationSerializedState;
  readonly surface?: SurfaceSerializedState;
  readonly prelaunch?: {
    readonly selectedMissionId: string;
    readonly briefingAcknowledged: boolean;
    readonly spacecraftConfig: SpacecraftConfig;
    readonly validationReport?: SpacecraftValidationReport;
    readonly isReadinessCertified: boolean;
    readonly readinessCertifiedAtMET?: number;
    readonly isLaunchAuthorized: boolean;
    readonly launchAuthorizedAtMET?: number;
    readonly acknowledgedWarnings?: readonly string[];
  };
  readonly campaign?: {
    readonly currentStageId: CampaignStageId;
    readonly currentStageStatus: CampaignStageStatus;
    readonly completedStageIds: readonly CampaignStageId[];
    readonly stageHistory: readonly any[];
    readonly processedEventIds: readonly string[];
    readonly processedEventTypes: readonly string[];
  };
  readonly missionEvaluation?: MissionEvaluationReport;
}

/**
 * Public command interface exposed by the SimulationRuntime to React.
 */
export interface RuntimeCommandInterface {
  getSnapshot(): Readonly<SimulationSnapshot>;
  start(options?: RuntimeStartOptions): void;
  pause(): void;
  resume(): void;
  advanceTime(seconds: number): Promise<FlightComputerStepReport>;
  clearError(): void;
  dispose(): void;
  getSelectedMission(): Mission;
  selectMission(missionId: string): { success: boolean; mission: Mission };
  acknowledgeBriefing(): { success: boolean };
  getSpacecraftConfig(): SpacecraftConfig;
  setSpacecraftPart(category: ComponentCategory, part: SpacecraftPart): void;
  setLaunchVehicle(vehicle: LaunchVehicle): void;
  getSpacecraftMetrics(): SpacecraftMetrics;
  getValidationReport(): SpacecraftValidationReport | undefined;
  validateSpacecraftArchitecture(): SpacecraftValidationReport;
  certifyMissionReadiness(options?: { acknowledgeWarnings?: boolean }): {
    success: boolean;
    reasons?: string[];
    requiresWarningAcknowledgment?: boolean;
    warnings?: string[];
  };
  authorizeLaunch(atMET?: number): { success: boolean; message: string };
  executeLaunchSequence(): Promise<{ success: boolean; flightState: string; propellantConsumedKg: number; message: string }>;
  abortLaunch(reason: string): { success: boolean; message: string };
  getAvailableDecisions(): readonly DecisionOption[];
  evaluateDecision(optionId: string): DecisionEvaluationReport;
  proposeDecision(optionId: string): DecisionRecord;
  authorizeDecision(decisionId: string, approved: boolean, reason?: string): DecisionRecord;
  executeDecision(decisionId: string): Promise<DecisionExecutionResult>;
  getScienceProducts(): {
    reason: readonly ReasonLevel2Product[];
    maspex: readonly MaspexLevel2Product[];
    total: number;
  };
  getMissionEvents(limit?: number): readonly EventExecutionResult[];
  getCampaignManager(): CampaignManager;
  getNavigationManager(): NavigationManager;
  getSurfaceMissionManager(): SurfaceMissionManager;
  validateNavigationManeuver(maneuverId: string): ManeuverValidationReport;
  executeNavigationManeuver(maneuverId: string): Promise<ManeuverExecutionResult>;
  executeJupiterApproach(): Promise<ManeuverExecutionResult>;
  triggerReconnaissanceScan(): { success: boolean; bytesGenerated: number; reason?: string };
  completeEuropaReconnaissance(): { success: boolean; message: string };
  selectLandingSite(siteName?: string): { success: boolean; landingSite: string };
  authorizeParkingOrbitAssumption(): { success: boolean; message: string };
  authorizeParkingOrbitMissionFlowBypass(): { success: boolean; message: string };
  isParkingOrbitBypassActive(): boolean;
  executeLanderDeployment(): Promise<ManeuverExecutionResult>;
  executeLanderPoweredDescent(): Promise<ManeuverExecutionResult>;
  deploySurfaceRover(): { success: boolean; message: string };
  executeRoverTraverse(targetX: number, targetY: number): TraverseExecutionResult;
  executeSurfaceScience(instrumentId: SurfaceInstrumentId): ScienceAcquisitionResult;
  transmitSurfaceDataToRelay(): { success: boolean; bytesUploaded: number; message: string };
  setRoverOperatingMode(mode: RoverOperatingMode): void;
  queueAllStoredScienceForDownlink(): { queuedCount: number; totalBytes: number };
  executeDsnDownlinkStep(durationSeconds?: number): { success: boolean; bytesTransferred: number; newlyReceivedCount: number };
  executeAnomalyDecision(decision: 'analyze' | 'sample' | 'withdraw'): { success: boolean; decision: string };
  evaluateMissionOutcome(): { success: boolean; report: MissionEvaluationReport };
  archiveMissionDebrief(): { success: boolean; message: string };
  exportSaveSnapshot(): AuthoritativeRuntimeSnapshot;
  restoreSaveSnapshot(snapshot: AuthoritativeRuntimeSnapshot): void;
}
