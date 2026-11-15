/**
 * SECTOR 17 — Mission Decision & Response Engine Constants
 * Event type identifiers, deterministic risk rating weights, safety margins,
 * and standard Expedition-V mission objective blueprints.
 */

import type { MissionDecisionObjective, RiskSeverity } from './types';

/**
 * Event type names for integration with MissionEventEngine
 */
export const DECISION_EVENT_TYPES = {
  MISSION_OBJECTIVE_UPDATED: 'MISSION_OBJECTIVE_UPDATED',
  DECISION_PROPOSED: 'DECISION_PROPOSED',
  DECISION_APPROVED: 'DECISION_APPROVED',
  DECISION_REJECTED: 'DECISION_REJECTED',
  DECISION_EXPIRED: 'DECISION_EXPIRED',
  DECISION_EXECUTION_STARTED: 'DECISION_EXECUTION_STARTED',
  DECISION_EXECUTION_COMPLETED: 'DECISION_EXECUTION_COMPLETED',
  DECISION_EXECUTION_FAILED: 'DECISION_EXECUTION_FAILED',
  MISSION_RISK_UPDATED: 'MISSION_RISK_UPDATED',
} as const;

/**
 * Deterministic engineering risk score weight mapping.
 * NOTE: These are deterministic operational heuristic scores in [0.0, 100.0],
 * NOT physical or Bayesian probabilities.
 */
export const RISK_SEVERITY_SCORES: Record<RiskSeverity, number> = {
  NEGLIGIBLE: 5.0,
  LOW: 20.0,
  MODERATE: 45.0,
  HIGH: 75.0,
  CRITICAL: 100.0,
} as const;

/**
 * Operational threshold margins for aerospace safety gating
 */
export const AEROSPACE_SAFETY_THRESHOLDS = {
  /** Power margin percentage below which a POWER warning is triggered */
  MIN_NOMINAL_POWER_MARGIN_PERCENT: 10.0,
  /** Power margin percentage below which a CRITICAL constraint is breached */
  MIN_CRITICAL_POWER_MARGIN_PERCENT: 0.0,
  /** Minimum thermal buffer in Kelvin away from operating limits */
  MIN_THERMAL_BUFFER_KELVIN: 5.0,
  /** Minimum remaining storage headroom before storage saturation risk (10 MB) */
  MIN_STORAGE_HEADROOM_BYTES: 10 * 1024 * 1024,
  /** Maximum acceptable composite risk score for autonomous execution */
  MAX_ACCEPTABLE_EXECUTION_RISK_SCORE: 70.0,
} as const;

/**
 * Default Expedition-V Mission Objectives Configuration
 */
export const EXPEDITION_V_DEFAULT_OBJECTIVES: readonly MissionDecisionObjective[] = [
  {
    id: 'EXP-V-OBJ-01',
    title: 'Subsurface Ocean Acoustic/Radar Characterization',
    description:
      'Detect and verify subsurface dielectric interfaces and basal ice reflectors using REASON ice-penetrating radar sounding.',
    priority: 'PRIMARY',
    prerequisites: [],
    evidenceRequirements: [
      {
        requiredSourceType: 'SCIENCE_PRODUCT',
        minConfidenceScore: 0.7,
        allowedProvenances: ['VERIFIED', 'SIMPLIFIED'],
        description: 'Validated REASON Level 2 radar depth profile showing deep reflector (> 1000m)',
        rejectFictional: true,
      },
    ],
    state: 'NOT_STARTED',
    progressPercent: 0,
    supportingEvidenceIds: [],
  },
  {
    id: 'EXP-V-OBJ-02',
    title: 'Plume Volatile & Organic Signature Detection',
    description:
      'Confirm vapor plume atmospheric composition and organic volatile presence using MASPEX mass spectrometry.',
    priority: 'PRIMARY',
    prerequisites: [],
    evidenceRequirements: [
      {
        requiredSourceType: 'SCIENCE_PRODUCT',
        minConfidenceScore: 0.8,
        allowedProvenances: ['VERIFIED', 'SIMPLIFIED'],
        description: 'Validated MASPEX Level 2 product identifying verified volatile or organic species',
        rejectFictional: true,
      },
    ],
    state: 'NOT_STARTED',
    progressPercent: 0,
    supportingEvidenceIds: [],
  },
  {
    id: 'EXP-V-OBJ-03',
    title: 'Co-located Hydrothermal Ocean Anomaly Verification',
    description:
      'Correlate contemporaneous radar reflectors and mass spectrometer plume emissions to confirm hydrothermal activity.',
    priority: 'CRITICAL',
    prerequisites: ['EXP-V-OBJ-01', 'EXP-V-OBJ-02'],
    evidenceRequirements: [
      {
        requiredSourceType: 'ANOMALY_REPORT',
        minConfidenceScore: 0.75,
        allowedProvenances: ['VERIFIED', 'SIMPLIFIED'],
        description: 'Multi-instrument correlated anomaly report confirming co-located subsurface and plume features',
        rejectFictional: true,
      },
    ],
    state: 'NOT_STARTED',
    progressPercent: 0,
    supportingEvidenceIds: [],
  },
  {
    id: 'EXP-V-OBJ-04',
    title: 'Deep Space Network Telemetry Downlink',
    description:
      'Downlink confirmed science products and anomaly telemetry to Earth ground stations over Deep Space Network passes.',
    priority: 'PRIMARY',
    prerequisites: [],
    evidenceRequirements: [
      {
        requiredSourceType: 'COMMUNICATION_STATUS',
        minConfidenceScore: 0.9,
        allowedProvenances: ['VERIFIED', 'SIMPLIFIED'],
        description: 'Confirmed downlink transmission of science telemetry packet',
        rejectFictional: false,
      },
    ],
    state: 'NOT_STARTED',
    progressPercent: 0,
    supportingEvidenceIds: [],
  },
  {
    id: 'EXP-V-OBJ-05',
    title: 'Europa Surface Lander Deployment Readiness',
    description:
      'Verify target site topographical clearance, GNC stability, thermal margins, and lander deployment readiness.',
    priority: 'SECONDARY',
    prerequisites: ['EXP-V-OBJ-01'],
    evidenceRequirements: [
      {
        requiredSourceType: 'SUBSYSTEM_STATUS',
        minConfidenceScore: 0.85,
        allowedProvenances: ['VERIFIED', 'SIMPLIFIED'],
        description: 'Confirmed LANDER_ROVER subsystem operational readiness and nominal GNC telemetry',
        rejectFictional: true,
      },
    ],
    state: 'NOT_STARTED',
    progressPercent: 0,
    supportingEvidenceIds: [],
  },
] as const;
