/**
 * SECTOR 17 — Mission Decision & Response Engine Types
 * Strict type contracts for decision evidence, mission objectives, risk assessment,
 * decision option generation, validation, authorization, execution, consequences,
 * and immutable decision audit history.
 */

import type { SubsystemType, SubsystemStatus } from '../flightSoftware/types';
import type { PowerBudgetResult, ThermalModelResult, MassBudgetResult } from '../types';

/* -------------------------------------------------------------------------- */
/* Decision Evidence Types                                                    */
/* -------------------------------------------------------------------------- */

export type EvidenceProvenance = 'VERIFIED' | 'SIMPLIFIED' | 'FICTIONAL' | 'UNVERIFIED';

export type EvidenceSourceType =
  | 'SCIENCE_PRODUCT'
  | 'ANOMALY_REPORT'
  | 'SUBSYSTEM_STATUS'
  | 'ENGINEERING_BUDGET'
  | 'STORAGE_STATUS'
  | 'COMMUNICATION_STATUS'
  | 'MISSION_OBJECTIVE'
  | 'EXTERNAL_TELEMETRY';

export interface DecisionEvidenceItem<T = unknown> {
  /** Unique evidence identifier (e.g. 'evi-reason-ocean-001') */
  readonly id: string;
  /** High-level evidence category */
  readonly sourceType: EvidenceSourceType;
  /** Explicit reference identifier of the underlying source record */
  readonly sourceId: string;
  /** Scientific and operational provenance */
  readonly provenance: EvidenceProvenance;
  /** Confidence score in [0.0, 1.0] */
  readonly confidenceScore: number;
  /** Acquisition timestamp in Mission Elapsed Time (seconds) */
  readonly timestampMET: number;
  /** Ingestion timestamp in Mission Elapsed Time (seconds) when evidence was indexed */
  readonly ingestionMET?: number;
  /** Descriptive explanation of what this evidence establishes */
  readonly summary: string;
  /** Flag denoting whether this evidence stems from a fictional scenario construct (e.g. Relic-Omega) */
  readonly isFictionalConstruct: boolean;
  /** Optional structured evidence payload */
  readonly payload?: T;
}

export interface SpacecraftEngineeringSnapshot {
  readonly currentMET: number;
  readonly flightState: string;
  readonly subsystemStatuses: Record<SubsystemType, SubsystemStatus>;
  readonly activeFaultCount: number;
  readonly criticalFaultCount: number;
  readonly powerBudget?: PowerBudgetResult;
  readonly thermalModel?: ThermalModelResult;
  readonly massBudget?: MassBudgetResult;
  readonly availablePropellantKg?: number;
  readonly storageUsedBytes?: number;
  readonly storageCapacityBytes?: number;
  readonly isCommWindowActive?: boolean;
  readonly currentRoundTripLightTimeSeconds?: number;
  readonly parkingOrbitPrerequisiteMet?: boolean;
  readonly navigationPhase?: string;
  readonly campaignStageId?: string;
  readonly readinessCertified?: boolean;
  readonly engineeringValidationStatus?: string;
}

/* -------------------------------------------------------------------------- */
/* Mission Objective Types                                                    */
/* -------------------------------------------------------------------------- */

export type ObjectiveState =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'FAILED';

export type ObjectivePriority = 'CRITICAL' | 'PRIMARY' | 'SECONDARY' | 'OPPORTUNISTIC';

export interface ObjectiveEvidenceRequirement {
  readonly requiredSourceType: EvidenceSourceType;
  readonly minConfidenceScore: number;
  readonly allowedProvenances: EvidenceProvenance[];
  readonly description: string;
  /** If true, strictly rejects fictional constructs (e.g., Relic-Omega) */
  readonly rejectFictional: boolean;
}

export interface MissionDecisionObjective {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly priority: ObjectivePriority;
  readonly prerequisites: readonly string[];
  readonly evidenceRequirements: readonly ObjectiveEvidenceRequirement[];
  readonly deadlineMET?: number;
  state: ObjectiveState;
  progressPercent: number; // 0.0 to 100.0
  completedAtMET?: number;
  failedAtMET?: number;
  failureReason?: string;
  supportingEvidenceIds: string[];
}

export interface ObjectiveEvaluationReport {
  readonly objectiveId: string;
  readonly previousState: ObjectiveState;
  readonly newState: ObjectiveState;
  readonly progressPercent: number;
  readonly satisfiesPrerequisites: boolean;
  readonly unsatisfiedPrerequisites: string[];
  readonly missingEvidenceDescriptions: string[];
  readonly isCompleted: boolean;
  readonly isFailed: boolean;
  readonly failureReason?: string;
}

/* -------------------------------------------------------------------------- */
/* Risk Assessment Types                                                      */
/* -------------------------------------------------------------------------- */

export type RiskCategory =
  | 'SAFETY'
  | 'SUBSYSTEM'
  | 'POWER'
  | 'THERMAL'
  | 'PROPELLANT'
  | 'STORAGE'
  | 'COMMUNICATIONS'
  | 'TIMELINE'
  | 'SCIENTIFIC_RETURN';

export type RiskSeverity =
  | 'NEGLIGIBLE'
  | 'LOW'
  | 'MODERATE'
  | 'HIGH'
  | 'CRITICAL';

export interface RiskItem {
  readonly id: string;
  readonly category: RiskCategory;
  readonly severity: RiskSeverity;
  /** Deterministic heuristic risk score in [0.0, 100.0] */
  readonly deterministicRiskScore: number;
  readonly supportingEvidenceIds: readonly string[];
  readonly explanation: string;
  readonly mitigation: string;
  /** If true, this risk represents a hard aerospace constraint that cannot be overridden */
  readonly isHardConstraint: boolean;
}

export interface RiskAssessmentReport {
  /** Composite deterministic risk score in [0.0, 100.0] */
  readonly compositeRiskScore: number;
  readonly highestSeverity: RiskSeverity;
  readonly hasHardConstraintViolation: boolean;
  readonly risks: readonly RiskItem[];
  readonly isAcceptableForExecution: boolean;
  readonly evaluationMET: number;
}

/* -------------------------------------------------------------------------- */
/* Decision Options & Validation Types                                        */
/* -------------------------------------------------------------------------- */

export type DecisionCategory =
  | 'CONTINUE_INVESTIGATION'
  | 'PRIORITIZE_ANOMALY'
  | 'PRESERVE_SPACECRAFT'
  | 'TRANSMIT_FINDINGS'
  | 'DEPLOY_LANDER'
  | 'ABORT_OR_SUSPEND'
  | 'LAUNCH_AUTHORIZATION';

export type DecisionValidationStatus =
  | 'FEASIBLE'
  | 'INFEASIBLE'
  | 'INCOMPLETE'
  | 'EXPIRED';

export interface DecisionResourceRequirements {
  readonly estimatedPowerWatts?: number;
  readonly estimatedPropellantKg?: number;
  readonly estimatedStorageBytes?: number;
  readonly estimatedDurationSeconds?: number;
  readonly requiredSubsystems?: readonly SubsystemType[];
  readonly requiresActiveCommWindow?: boolean;
}

export interface DecisionValidationResult {
  readonly status: DecisionValidationStatus;
  readonly reasons: readonly string[];
  readonly missingResourceMetrics: readonly string[];
  readonly constraintViolations: readonly string[];
  readonly validatedAtMET: number;
}

export interface DecisionOption {
  readonly id: string;
  readonly category: DecisionCategory;
  readonly title: string;
  readonly description: string;
  readonly evidenceReferences: readonly string[];
  readonly prerequisites: readonly string[];
  readonly resourceRequirements: DecisionResourceRequirements;
  readonly riskAssessment: RiskAssessmentReport;
  readonly expirationMET?: number;
  readonly commandTypeToDispatch?: string;
  readonly commandPayload?: unknown;
  validationResult?: DecisionValidationResult;
}

/* -------------------------------------------------------------------------- */
/* Decision Authorization & Lifecycle Types                                   */
/* -------------------------------------------------------------------------- */

export type DecisionAuthorizationStatus =
  | 'PROPOSED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'FAILED'
  | 'EXPIRED';

/* -------------------------------------------------------------------------- */
/* Consequence & Execution Types                                              */
/* -------------------------------------------------------------------------- */

export type ConsequenceType =
  | 'OBJECTIVE_PROGRESS'
  | 'RESOURCE_EXPENDITURE'
  | 'SUBSYSTEM_STATE_CHANGE'
  | 'TELEMETRY_QUEUED'
  | 'COMMAND_DISPATCHED'
  | 'RISK_STATE_CHANGE'
  | 'TIMELINE_EVENT_SCHEDULED';

export interface MissionConsequence {
  readonly type: ConsequenceType;
  readonly description: string;
  readonly affectedTarget: string;
  readonly deltaOrValue: string | number | boolean;
  readonly appliedAtMET: number;
}

export interface DecisionExecutionResult {
  readonly decisionId: string;
  readonly success: boolean;
  readonly executedAtMET: number;
  readonly dispatchedCommandId?: string;
  readonly downlinkedPacketId?: string;
  readonly consequences: readonly MissionConsequence[];
  readonly errorMessage?: string;
}

/* -------------------------------------------------------------------------- */
/* Immutable Decision Record (Audit History)                                 */
/* -------------------------------------------------------------------------- */

export interface DecisionRecord {
  readonly decisionId: string;
  readonly option: DecisionOption;
  status: DecisionAuthorizationStatus;
  readonly proposedAtMET: number;
  authorizedAtMET?: number;
  authorizationReason?: string;
  executedAtMET?: number;
  executionResult?: DecisionExecutionResult;
  consequences: readonly MissionConsequence[];
  failureReason?: string;
}
