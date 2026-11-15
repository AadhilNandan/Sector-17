/**
 * SECTOR 17 — Flight Software Core Types
 * Strict typing for mission execution states, subsystem lifecycle, command execution,
 * fault management, coordinate transformations, and storage retention.
 */

import type { DataCategory, SpacecraftPointingTarget } from '../communications/types';
import type { MissionEventEngine } from '../operations/missionEventEngine';

/* -------------------------------------------------------------------------- */
/* Mission Execution State Machine Types                                      */
/* -------------------------------------------------------------------------- */

export type MissionExecutionState =
  | 'INITIALIZED'
  | 'STANDBY'
  | 'PRELAUNCH_HOLD'
  | 'ACTIVE'
  | 'SAFE_MODE'
  | 'RECOVERY'
  | 'COMPLETED'
  | 'ABORTED';

export interface StateTransitionRecord {
  fromState: MissionExecutionState;
  toState: MissionExecutionState;
  metSeconds: number;
  reason: string;
}

export interface MissionObjective {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  isCompleted: boolean;
  completedAtMET?: number;
}

/* -------------------------------------------------------------------------- */
/* Subsystem Lifecycle & Operational Status Types                             */
/* -------------------------------------------------------------------------- */

export type SubsystemType =
  | 'EPS'
  | 'PROPULSION'
  | 'TCS'
  | 'GNC'
  | 'COMMUNICATIONS'
  | 'SCIENCE'
  | 'STORAGE'
  | 'LANDER_ROVER';

export type SubsystemStatus =
  | 'OFF'
  | 'INITIALIZING'
  | 'NOMINAL'
  | 'DEGRADED'
  | 'FAULT'
  | 'SAFE';

export type SubsystemImplementationStatus =
  | 'VERIFIED'
  | 'SIMPLIFIED'
  | 'FICTIONAL'
  | 'NOT_IMPLEMENTED';

export interface ISubsystem {
  readonly id: string;
  readonly name: string;
  readonly type: SubsystemType;
  readonly implementationStatus: SubsystemImplementationStatus;
  getStatus(): SubsystemStatus;
  setStatus(status: SubsystemStatus, reason?: string, currentMETSeconds?: number): void;
  toSafeMode(currentMETSeconds?: number): void;
  recover(currentMETSeconds?: number, validator?: () => boolean): boolean;
  step?(deltaSeconds: number, currentMETSeconds: number): void;
}

export type SubsystemRecoveryValidator = (subsystemType: SubsystemType) => boolean;

/* -------------------------------------------------------------------------- */
/* Fault Management Types                                                     */
/* -------------------------------------------------------------------------- */

export type FaultSeverity = 'INFO' | 'WARNING' | 'DEGRADED' | 'CRITICAL';

export interface Fault {
  id: string;
  code: string;
  subsystemType: SubsystemType;
  severity: FaultSeverity;
  description: string;
  detectedAtMETSeconds: number;
  resolvedAtMETSeconds?: number;
  resolutionReason?: string;
  autoSafeMode?: boolean;
}

export type FaultResponseHandler = (fault: Fault, currentMETSeconds: number) => void;

/* -------------------------------------------------------------------------- */
/* Coordinate-Frame Contract Types                                            */
/* -------------------------------------------------------------------------- */

export type CoordinateFrame = 'ECI' | 'ECEF';

export interface SpacecraftPositionState {
  /** Geocentric or sub-spacecraft latitude in degrees [-90, +90] */
  latitudeDeg: number;
  /**
   * Celestial right ascension (if frame is ECI) or
   * Earth-fixed Greenwich longitude (if frame is ECEF) in degrees [-180, +180] or [0, 360)
   */
  longitudeDeg: number;
  /** Radial distance from Earth center in metres */
  distanceMetres: number;
  /** Explicit reference frame */
  frame: CoordinateFrame;
}

/* -------------------------------------------------------------------------- */
/* Storage Retention Lifecycle Types                                          */
/* -------------------------------------------------------------------------- */

export type ExtendedPacketState =
  | 'STORED'
  | 'QUEUED'
  | 'TRANSMITTING'
  | 'TRANSMITTED'
  | 'RECEIVED_EARTH'
  | 'EARTH_ACK_GENERATED'
  | 'ACK_RECEIVED_AETHON'
  | 'ELIGIBLE_FOR_PURGE'
  | 'DELETED';

export interface StorageRetentionPolicy {
  /**
   * Whether acknowledgement from Earth must be confirmed received on AETHON
   * before a packet becomes eligible for purging (default: true).
   */
  requireAethonAckToPurge?: boolean;
  /**
   * Additional time in seconds a packet must remain in storage after becoming eligible
   * before deletion can occur (default: 0).
   */
  retentionGracePeriodSeconds?: number;
  /**
   * Critical category packets are protected from purging unless explicitly forced (default: true).
   */
  protectCriticalData?: boolean;
}

export interface PacketRetentionRecord {
  packetId: string;
  category: DataCategory;
  sizeBytes: number;
  state: ExtendedPacketState;
  createdAtMET: number;
  transmittedAtMET?: number;
  receivedEarthAtMET?: number;
  earthAckGeneratedAtMET?: number;
  aethonAckReceivedAtMET?: number;
  eligibleForPurgeAtMET?: number;
  deletedAtMET?: number;
  deletionReason?: string;
}

/* -------------------------------------------------------------------------- */
/* Command Execution & Acknowledgement Types                                 */
/* -------------------------------------------------------------------------- */

export type CommandAcknowledgementPolicy = 'ALWAYS' | 'ON_SUCCESS' | 'ON_FAILURE' | 'NONE';

export interface CommandAcknowledgementPayload {
  commandId: string;
  commandType: string;
  success: boolean;
  executionMETSeconds: number;
  result?: unknown;
  errorMessage?: string;
}

export interface CommandExecutionContext {
  currentMETSeconds: number;
  missionState: MissionExecutionState;
  subsystems: Map<SubsystemType, ISubsystem>;
  eventEngine?: MissionEventEngine;
}

export type CommandHandler<T = unknown, R = unknown> = (
  payload: T,
  context: CommandExecutionContext
) => R | Promise<R>;

export interface CommandRegistrationOptions {
  /** Subsystem associated with command execution */
  targetSubsystem?: SubsystemType;
  /** If false, command is rejected when mission is in SAFE_MODE (default: false, disallowed in safe mode) */
  allowInSafeMode?: boolean;
}

export interface CommandExecutionResult<R = unknown> {
  commandId: string;
  success: boolean;
  executedAtMETSeconds: number;
  result?: R;
  error?: string;
  ackPacketId?: string;
}

/* -------------------------------------------------------------------------- */
/* Flight Computer Configuration & Step Report                                */
/* -------------------------------------------------------------------------- */

export interface FlightComputerConfig {
  epochTimestampSeconds?: number;
  acknowledgementPolicy?: CommandAcknowledgementPolicy;
  retentionPolicy?: StorageRetentionPolicy;
  initialState?: MissionExecutionState;
  initialPosition?: SpacecraftPositionState;
}

export interface StoragePurgeReport {
  eligibleCount: number;
  purgedCount: number;
  freedBytes: number;
  purgedPacketIds: string[];
}

export interface FlightComputerStepReport {
  metSeconds: number;
  missionState: MissionExecutionState;
  commandsProcessed: number;
  commandsSucceeded: number;
  commandsFailed: number;
  activeFaultCount: number;
  criticalFaultCount: number;
  subsystemStatuses: Record<SubsystemType, SubsystemStatus>;
  resolvedECEFPosition: SpacecraftPointingTarget;
  storageReport?: StoragePurgeReport;
}
