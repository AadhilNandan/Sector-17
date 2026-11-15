/**
 * SECTOR 17 — Flight Software Core Constants
 * Standard operational constants, event types, default packet sizes, and state transition graphs.
 */

import type { MissionExecutionState } from './types';

/**
 * Valid Mission Execution State Machine Transitions
 * Defines the strict, deterministic lifecycle graph for AETHON.
 */
export const VALID_MISSION_STATE_TRANSITIONS: Readonly<
  Record<MissionExecutionState, readonly MissionExecutionState[]>
> = {
  INITIALIZED: ['STANDBY', 'PRELAUNCH_HOLD', 'ABORTED'],
  STANDBY: ['ACTIVE', 'PRELAUNCH_HOLD', 'ABORTED'],
  PRELAUNCH_HOLD: ['STANDBY', 'ABORTED'],
  ACTIVE: ['SAFE_MODE', 'COMPLETED', 'ABORTED'],
  SAFE_MODE: ['RECOVERY', 'ABORTED'],
  RECOVERY: ['ACTIVE', 'SAFE_MODE', 'ABORTED'],
  COMPLETED: [], // Terminal state
  ABORTED: [], // Terminal state
};

/**
 * Typed Flight Software Event Names for MissionEventEngine Integration
 */
export const FSW_EVENT_TYPES = {
  MISSION_STATE_CHANGED: 'FSW_MISSION_STATE_CHANGED',
  SUBSYSTEM_STATUS_CHANGED: 'FSW_SUBSYSTEM_STATUS_CHANGED',
  COMMAND_EXECUTION_STARTED: 'FSW_COMMAND_EXECUTION_STARTED',
  COMMAND_EXECUTION_COMPLETED: 'FSW_COMMAND_EXECUTION_COMPLETED',
  COMMAND_EXECUTION_REJECTED: 'FSW_COMMAND_EXECUTION_REJECTED',
  FAULT_DETECTED: 'FSW_FAULT_DETECTED',
  FAULT_RESOLVED: 'FSW_FAULT_RESOLVED',
  SAFE_MODE_ENTERED: 'FSW_SAFE_MODE_ENTERED',
  SAFE_MODE_EXITED: 'FSW_SAFE_MODE_EXITED',
  PRELAUNCH_HOLD_ENTERED: 'FSW_PRELAUNCH_HOLD_ENTERED',
  PRELAUNCH_HOLD_EXITED: 'FSW_PRELAUNCH_HOLD_EXITED',
  FLIGHT_SOFTWARE_ERROR: 'FSW_ERROR',
  STORAGE_PURGE_ELIGIBLE: 'FSW_STORAGE_PURGE_ELIGIBLE',
  STORAGE_PACKET_PURGED: 'FSW_STORAGE_PACKET_PURGED',
} as const;

/**
 * Default size of generated telemetry acknowledgement packets in bytes
 */
export const DEFAULT_COMMAND_ACK_SIZE_BYTES = 64;

/**
 * Default priority for generated critical command acknowledgement telemetry packets
 * (Higher priority than standard science data, ensuring rapid downlink scheduling)
 */
export const DEFAULT_COMMAND_ACK_PRIORITY = 250;
