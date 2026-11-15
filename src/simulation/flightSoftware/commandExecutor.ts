/**
 * SECTOR 17 — Flight Software Command Executor
 * Validates and executes uplinked ground commands that have physically arrived at AETHON.
 * Generates configurable telemetry acknowledgement packets downlinked through the standard
 * RF telemetry queue.
 *
 * SAFETY INVARIANTS:
 * 1. Commands cannot execute before their physical arrival MET (uplink duration + OWLT).
 * 2. Duplicate execution of previously executed or failed commands is strictly prevented.
 * 3. Commands disallowed in SAFE_MODE are rejected when the spacecraft is safe-moded.
 * 4. Commands targeting disabled or faulted subsystems are rejected.
 * 5. Telemetry acknowledgements must propagate through downlink RF passes and OWLT to Earth;
 *    execution on AETHON does not instantaneously acknowledge the command on Earth.
 */

import { FSW_EVENT_TYPES, DEFAULT_COMMAND_ACK_SIZE_BYTES, DEFAULT_COMMAND_ACK_PRIORITY } from './constants';
import type { CommandPacket, TelemetryPacket } from '../communications/types';
import type { CommandQueue } from '../communications/commandQueue';
import type { TelemetryQueue } from '../communications/telemetryQueue';
import type { OnboardStorage } from '../communications/onboardStorage';
import type { MissionEventEngine } from '../operations/missionEventEngine';
import type { StorageRetentionManager } from './storageRetention';
import type { SubsystemManager } from './subsystemManager';
import type { MissionExecutionController } from './missionExecutionController';
import type {
  CommandAcknowledgementPolicy,
  CommandAcknowledgementPayload,
  CommandHandler,
  CommandRegistrationOptions,
  CommandExecutionResult,
} from './types';

export class CommandExecutor {
  private handlers: Map<string, { handler: CommandHandler<any, any>; options: CommandRegistrationOptions }> = new Map();
  private acknowledgementPolicy: CommandAcknowledgementPolicy;
  private subsystemManager?: SubsystemManager;
  private executionController?: MissionExecutionController;
  private commandQueue?: CommandQueue;
  private telemetryQueue?: TelemetryQueue;
  private storage?: OnboardStorage;
  private retentionManager?: StorageRetentionManager;
  private eventEngine?: MissionEventEngine;

  constructor(
    acknowledgementPolicy: CommandAcknowledgementPolicy = 'ALWAYS',
    subsystemManager?: SubsystemManager,
    executionController?: MissionExecutionController
  ) {
    this.acknowledgementPolicy = acknowledgementPolicy;
    this.subsystemManager = subsystemManager;
    this.executionController = executionController;
  }

  public setAcknowledgementPolicy(policy: CommandAcknowledgementPolicy): void {
    this.acknowledgementPolicy = policy;
  }

  public getAcknowledgementPolicy(): CommandAcknowledgementPolicy {
    return this.acknowledgementPolicy;
  }

  public attachDependencies(deps: {
    commandQueue?: CommandQueue;
    telemetryQueue?: TelemetryQueue;
    storage?: OnboardStorage;
    retentionManager?: StorageRetentionManager;
    eventEngine?: MissionEventEngine;
    subsystemManager?: SubsystemManager;
    executionController?: MissionExecutionController;
  }): void {
    if (deps.commandQueue) this.commandQueue = deps.commandQueue;
    if (deps.telemetryQueue) this.telemetryQueue = deps.telemetryQueue;
    if (deps.storage) this.storage = deps.storage;
    if (deps.retentionManager) this.retentionManager = deps.retentionManager;
    if (deps.eventEngine) this.eventEngine = deps.eventEngine;
    if (deps.subsystemManager) this.subsystemManager = deps.subsystemManager;
    if (deps.executionController) this.executionController = deps.executionController;
  }

  /**
   * Registers a handler for a specific command type with operational constraints.
   */
  public registerHandler<T = unknown, R = unknown>(
    commandType: string,
    handler: CommandHandler<T, R>,
    options: CommandRegistrationOptions = {}
  ): void {
    if (!commandType || typeof commandType !== 'string') {
      throw new TypeError('registerHandler: commandType must be a non-empty string.');
    }
    if (typeof handler !== 'function') {
      throw new TypeError('registerHandler: handler must be a function.');
    }
    this.handlers.set(commandType.trim(), {
      handler,
      options: {
        allowInSafeMode: options.allowInSafeMode ?? false,
        targetSubsystem: options.targetSubsystem,
      },
    });
  }

  /**
   * Evaluates and executes an arrived command packet on AETHON.
   */
  public async executeCommand<T = unknown, R = unknown>(
    cmd: CommandPacket<T>,
    currentMETSeconds: number
  ): Promise<CommandExecutionResult<R>> {
    if (!cmd || typeof cmd !== 'object') {
      throw new TypeError('executeCommand: cmd must be an object.');
    }

    // Guard 1: Physical arrival gate
    if (currentMETSeconds < cmd.arrivalMETSeconds) {
      const err = `Command '${cmd.id}' has not arrived at spacecraft. Current MET: ${currentMETSeconds} s, Arrival MET: ${cmd.arrivalMETSeconds} s.`;
      return this.rejectCommand(cmd, err, currentMETSeconds);
    }

    // Guard 2: Duplicate execution prevention
    if (cmd.status === 'EXECUTED' || cmd.status === 'FAILED') {
      const err = `Command '${cmd.id}' cannot be executed; already in terminal status '${cmd.status}'.`;
      return this.rejectCommand(cmd, err, currentMETSeconds);
    }

    // Guard 3: Handler registration
    const registration = this.handlers.get(cmd.type);
    if (!registration) {
      const err = `No flight software handler registered for command type '${cmd.type}'.`;
      return this.rejectCommand(cmd, err, currentMETSeconds);
    }

    const { handler, options } = registration;

    // Guard 4: Spacecraft operational state (SAFE_MODE or PRELAUNCH_HOLD)
    const isRestrictedState =
      (this.executionController?.isInSafeMode() || this.executionController?.isPrelaunchHold()) ?? false;
    if (isRestrictedState && !options.allowInSafeMode) {
      const stateName = this.executionController?.getState() ?? 'RESTRICTED';
      const err = `Command '${cmd.id}' of type '${cmd.type}' is disallowed while spacecraft is in ${stateName}.`;
      return this.rejectCommand(cmd, err, currentMETSeconds);
    }

    // Guard 5: Subsystem availability
    if (options.targetSubsystem && this.subsystemManager) {
      const sub = this.subsystemManager.getSubsystem(options.targetSubsystem);
      if (sub) {
        const subStatus = sub.getStatus();
        if (subStatus === 'FAULT' || subStatus === 'OFF') {
          const err = `Target subsystem '${options.targetSubsystem}' is in '${subStatus}' state; command '${cmd.id}' cannot execute.`;
          return this.rejectCommand(cmd, err, currentMETSeconds);
        }
      }
    }

    // Execute command handler
    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-cmd-exec-start-${cmd.id}`,
        type: FSW_EVENT_TYPES.COMMAND_EXECUTION_STARTED,
        scheduledTimeSeconds: currentMETSeconds,
        payload: { commandId: cmd.id, type: cmd.type },
      });
    }

    try {
      const context = {
        currentMETSeconds,
        missionState: this.executionController?.getState() ?? 'ACTIVE',
        subsystems: this.subsystemManager?.getSubsystemMap() ?? new Map(),
        eventEngine: this.eventEngine,
      };

      const result = await Promise.resolve(handler(cmd.payload, context));

      // Mark command executed in queue
      if (this.commandQueue) {
        this.commandQueue.markExecuted(cmd.id, result);
      }

      // Schedule success event
      if (this.eventEngine) {
        this.eventEngine.scheduleEvent({
          id: `evt-cmd-exec-done-${cmd.id}`,
          type: FSW_EVENT_TYPES.COMMAND_EXECUTION_COMPLETED,
          scheduledTimeSeconds: currentMETSeconds,
          payload: { commandId: cmd.id, type: cmd.type, result },
        });
      }

      // Generate acknowledgement telemetry packet
      const ackPacketId = this.generateAcknowledgement(cmd, true, currentMETSeconds, result);

      return {
        commandId: cmd.id,
        success: true,
        executedAtMETSeconds: currentMETSeconds,
        result: result as R,
        ackPacketId,
      };
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      return this.rejectCommand(cmd, errorMsg, currentMETSeconds);
    }
  }

  private rejectCommand<R = unknown>(
    cmd: CommandPacket,
    errorMessage: string,
    currentMETSeconds: number
  ): CommandExecutionResult<R> {
    if (this.commandQueue) {
      this.commandQueue.markFailed(cmd.id, errorMessage);
    }

    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-cmd-exec-rej-${cmd.id}-${currentMETSeconds}`,
        type: FSW_EVENT_TYPES.COMMAND_EXECUTION_REJECTED,
        scheduledTimeSeconds: currentMETSeconds,
        payload: { commandId: cmd.id, type: cmd.type, error: errorMessage },
      });
    }

    const ackPacketId = this.generateAcknowledgement(
      cmd,
      false,
      currentMETSeconds,
      undefined,
      errorMessage
    );

    return {
      commandId: cmd.id,
      success: false,
      executedAtMETSeconds: currentMETSeconds,
      error: errorMessage,
      ackPacketId,
    };
  }

  /**
   * Generates a unique command acknowledgement telemetry packet for downlink to Earth.
   */
  private generateAcknowledgement(
    cmd: CommandPacket,
    success: boolean,
    currentMETSeconds: number,
    result?: unknown,
    errorMessage?: string
  ): string | undefined {
    let shouldAck = false;
    if (this.acknowledgementPolicy === 'ALWAYS') {
      shouldAck = true;
    } else if (this.acknowledgementPolicy === 'ON_SUCCESS' && success) {
      shouldAck = true;
    } else if (this.acknowledgementPolicy === 'ON_FAILURE' && !success) {
      shouldAck = true;
    }

    if (!shouldAck || !this.telemetryQueue) {
      return undefined;
    }

    const ackPacketId = `ack-${cmd.id}-${currentMETSeconds}`;
    const payload: CommandAcknowledgementPayload = {
      commandId: cmd.id,
      commandType: cmd.type,
      success,
      executionMETSeconds: currentMETSeconds,
      result,
      errorMessage,
    };

    // Store in onboard storage if available
    if (this.storage) {
      try {
        this.storage.storeData({
          id: ackPacketId,
          category: 'critical',
          sizeBytes: DEFAULT_COMMAND_ACK_SIZE_BYTES,
          priority: DEFAULT_COMMAND_ACK_PRIORITY,
          createdAtMETSeconds: currentMETSeconds,
          payload,
        });

        // Track in retention manager
        if (this.retentionManager) {
          this.retentionManager.trackPacket(
            ackPacketId,
            'critical',
            DEFAULT_COMMAND_ACK_SIZE_BYTES,
            currentMETSeconds
          );
          this.retentionManager.recordQueued(ackPacketId);
        }
      } catch (err) {
        console.warn(`CommandExecutor: Unable to store ACK packet in storage:`, err);
      }
    }

    // Enqueue into telemetry queue for downlink transmission
    const queuedPacket: TelemetryPacket<CommandAcknowledgementPayload> = this.telemetryQueue.enqueue({
      id: ackPacketId,
      category: 'critical',
      payload,
      sizeBytes: DEFAULT_COMMAND_ACK_SIZE_BYTES,
      priority: DEFAULT_COMMAND_ACK_PRIORITY,
    });

    return queuedPacket.id;
  }
}
