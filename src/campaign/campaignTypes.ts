/**
 * SECTOR 17 — Campaign Progression & Mission Orchestration Types
 * Formal type definitions for the persistent 18-stage campaign state machine,
 * requirement evaluators, event bridge, and local persistence.
 */

import type { SimulationSnapshot, AuthoritativeRuntimeSnapshot } from '../runtime/types';
import type { FlightComputer } from '../simulation/flightSoftware/flightComputer';
import type { MissionDecisionManager } from '../simulation/missionDecision/missionDecisionManager';
import type { ScienceProcessingManager } from '../simulation/science/scienceProcessingManager';
import type { CommunicationManager } from '../simulation/communications/communicationManager';
import type { MissionEventEngine } from '../simulation/operations/missionEventEngine';

/**
 * The 18 canonical stages of the Expedition-V Europa Survey campaign.
 */
export type CampaignStageId =
  | 'CAMPAIGN_INTRO'
  | 'MISSION_SELECTION'
  | 'SPACECRAFT_DESIGN'
  | 'ENGINEERING_VALIDATION'
  | 'MISSION_READINESS'
  | 'LAUNCH_AUTHORIZATION'
  | 'LAUNCH'
  | 'INTERPLANETARY_CRUISE'
  | 'JUPITER_ARRIVAL'
  | 'EUROPA_RECONNAISSANCE'
  | 'SURFACE_MISSION_PREPARATION'
  | 'LANDER_DEPLOYMENT'
  | 'SURFACE_OPERATIONS'
  | 'ANOMALY_INVESTIGATION'
  | 'FINAL_DATA_TRANSMISSION'
  | 'MISSION_EVALUATION'
  | 'MISSION_DEBRIEF'
  | 'CAMPAIGN_COMPLETED';

/**
 * Discrete lifecycle status of a campaign stage.
 */
export type CampaignStageStatus =
  | 'LOCKED'     // Stage prerequisites not yet satisfied
  | 'ACTIVE'     // Current operational stage
  | 'COMPLETED'  // Stage successfully fulfilled
  | 'BLOCKED'    // Stage active but obstructed by unmet prerequisites or critical warnings
  | 'FAILED';    // Mission failure occurred within this stage

/**
 * Types of requirements evaluated for stage entry or completion.
 */
export type RequirementType =
  | 'OBJECTIVE'
  | 'FLIGHT_STATE'
  | 'MET_THRESHOLD'
  | 'SUBSYSTEM_STATE'
  | 'PROPELLANT'
  | 'SCIENCE_PRODUCTS'
  | 'COMM_WINDOW'
  | 'DECISION_EXECUTED'
  | 'EVENT_PROCESSED'
  | 'CUSTOM';

/**
 * Context provided to stage requirement evaluators.
 */
export interface CampaignEvaluationContext {
  campaignId: string;
  currentMET: number;
  flightComputer?: FlightComputer;
  decisionManager?: MissionDecisionManager;
  scienceManager?: ScienceProcessingManager;
  commManager?: CommunicationManager;
  eventEngine?: MissionEventEngine;
  snapshot?: SimulationSnapshot;
  processedEventIds: ReadonlySet<string>;
  processedEventTypes: ReadonlySet<string>;
}

/**
 * Individual requirement gate for entering or completing a stage.
 */
export interface StageRequirement {
  id: string;
  title: string;
  description: string;
  type: RequirementType;
  isMandatory: boolean;
  evaluator: (ctx: CampaignEvaluationContext) => { satisfied: boolean; reason?: string };
}

/**
 * Explicit failure condition definition.
 */
export interface StageFailureCondition {
  id: string;
  description: string;
  evaluator: (ctx: CampaignEvaluationContext) => { triggered: boolean; failureReason?: string };
}

/**
 * Metadata configuration for a single campaign stage.
 */
export interface CampaignStageConfig {
  stageId: CampaignStageId;
  order: number;
  title: string;
  subtitle: string;
  description: string;
  associatedRoute: string;
  entryRequirements: StageRequirement[];
  completionRequirements: StageRequirement[];
  requiredObjectiveIds: string[];
  relevantEventTypes: string[];
  failureConditions?: StageFailureCondition[];
}

/**
 * Immutable historical record of a stage entered/passed.
 */
export interface StageHistoryRecord {
  stageId: CampaignStageId;
  status: CampaignStageStatus;
  enteredAtMET: number;
  completedAtMET?: number;
  failedAtMET?: number;
  failureReason?: string;
  notes: string[];
}

/**
 * Full campaign state snapshot for presentation and synchronization.
 */
export interface CampaignSnapshot {
  campaignId: string;
  currentStageId: CampaignStageId;
  currentStageStatus: CampaignStageStatus;
  completedStageIds: readonly CampaignStageId[];
  stageHistory: readonly StageHistoryRecord[];
  missionElapsedTime: number;
  lastEventId?: string;
  lastEventMET?: number;
  activeBlockers: readonly string[];
  overallProgressPercent: number;
  isCampaignCompleted: boolean;
  isCampaignFailed: boolean;
  failureMET?: number;
  failureReason?: string;
  currentStageConfig: CampaignStageConfig;
  schemaVersion: number;
}

/**
 * Result returned upon an attempted stage transition.
 */
export interface CampaignTransitionResult {
  success: boolean;
  fromStage: CampaignStageId;
  toStage: CampaignStageId;
  transitionedAtMET: number;
  blockers?: string[];
  failureReason?: string;
}

/**
 * Local persistence data schema (Versioned).
 */
export interface CampaignSaveData {
  schemaVersion: number;
  campaignId: string;
  savedAtTimestamp: number;
  savedAtMET: number;
  currentStageId: CampaignStageId;
  currentStageStatus: CampaignStageStatus;
  completedStageIds: CampaignStageId[];
  stageHistory: StageHistoryRecord[];
  processedEventIds: string[];
  processedEventTypes?: string[];
  activeBlockers: string[];
  isCampaignCompleted: boolean;
  isCampaignFailed: boolean;
  failureMET?: number;
  failureReason?: string;
  simulationStateCheckpoint?: {
    flightState: string;
    availablePropellantKg: number;
    storageUsedBytes: number;
    subsystemStatuses: Record<string, string>;
  };
  runtimeSnapshot?: AuthoritativeRuntimeSnapshot;
}
