/**
 * SECTOR 17 — Flight Software Event Definitions
 * Typed event signatures and factory helpers for MissionEventEngine.
 */

import { FSW_EVENT_TYPES } from './constants';
import type { EventScheduleInput } from '../types';
import type {
  MissionExecutionState,
  SubsystemType,
  SubsystemStatus,
  FaultSeverity,
} from './types';

export interface MissionStateChangedEventPayload {
  fromState: MissionExecutionState;
  toState: MissionExecutionState;
  reason: string;
}

export interface SubsystemStatusChangedEventPayload {
  subsystemType: SubsystemType;
  oldStatus: SubsystemStatus;
  newStatus: SubsystemStatus;
  reason?: string;
}

export interface CommandExecutionStartedPayload {
  commandId: string;
  type: string;
}

export interface CommandExecutionCompletedPayload {
  commandId: string;
  type: string;
  result?: unknown;
}

export interface CommandExecutionRejectedPayload {
  commandId: string;
  type: string;
  error: string;
}

export interface FaultDetectedPayload {
  faultId: string;
  code: string;
  subsystemType: SubsystemType;
  severity: FaultSeverity;
  description: string;
}

export interface FaultResolvedPayload {
  faultId: string;
  code: string;
  subsystemType: SubsystemType;
  resolvedAtMETSeconds: number;
  resolutionReason: string;
}

export interface SafeModeEventPayload {
  reason: string;
}

export interface PrelaunchHoldEventPayload {
  reason: string;
}

/**
 * Creates a typed MissionEvent for flight software state transitions.
 */
export function createMissionStateChangedEvent(
  fromState: MissionExecutionState,
  toState: MissionExecutionState,
  scheduledTimeSeconds: number,
  reason: string
): EventScheduleInput<MissionStateChangedEventPayload> {
  return {
    id: `evt-fsw-state-${scheduledTimeSeconds}-${toState}`,
    type: FSW_EVENT_TYPES.MISSION_STATE_CHANGED,
    scheduledTimeSeconds,
    payload: {
      fromState,
      toState,
      reason,
    },
  };
}
