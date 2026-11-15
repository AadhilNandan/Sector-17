/**
 * SECTOR 17 — Command Uplink Queue
 * Manages Earth-to-Spacecraft command transmission queues, uplink duration calculations,
 * one-way light time propagation delays, arrival sequencing, and execution gating.
 *
 * INVARIANT: A command cannot execute on AETHON before its arrival timestamp:
 * arrivalMETSeconds = scheduledTxTimeMET + txDurationSeconds + oneWayLightTimeSeconds
 */

import { calculateOneWayLightTime } from './signalPropagation';
import { calculateTransmissionDuration } from './dataTransmission';
import type { CommandPacket } from './types';

export interface CommandScheduleInput<T = unknown> {
  id: string;
  type: string;
  payload: T;
  priority?: number;
  sizeBytes?: number;
  scheduledTxTimeMET: number;
  uplinkDataRateBps: number;
  distanceMetres: number;
}

export class CommandQueue {
  private commands: Map<string, CommandPacket> = new Map();

  /**
   * Schedules a command for uplink transmission from Earth.
   */
  public enqueueCommand<T = unknown>(input: CommandScheduleInput<T>): CommandPacket<T> {
    if (!input || typeof input !== 'object') {
      throw new TypeError('CommandQueue.enqueueCommand: Input must be an object.');
    }
    if (!input.id || typeof input.id !== 'string' || input.id.trim().length === 0) {
      throw new TypeError('CommandQueue.enqueueCommand: Command ID must be a non-empty string.');
    }
    const id = input.id.trim();
    if (this.commands.has(id)) {
      throw new Error(`CommandQueue.enqueueCommand: Duplicate command ID '${id}'.`);
    }

    if (!input.type || typeof input.type !== 'string' || input.type.trim().length === 0) {
      throw new TypeError('CommandQueue.enqueueCommand: Command type must be a non-empty string.');
    }
    if (typeof input.scheduledTxTimeMET !== 'number' || !Number.isFinite(input.scheduledTxTimeMET) || input.scheduledTxTimeMET < 0) {
      throw new TypeError(`CommandQueue.enqueueCommand: scheduledTxTimeMET must be a non-negative finite number. Received: ${input.scheduledTxTimeMET}`);
    }

    const sizeBytes = input.sizeBytes !== undefined ? input.sizeBytes : 64; // Default command frame 64 bytes
    const priority = input.priority !== undefined ? input.priority : 100;

    const txDurationSeconds = calculateTransmissionDuration(sizeBytes, input.uplinkDataRateBps);
    const oneWayLightTimeSeconds = calculateOneWayLightTime(input.distanceMetres);
    const arrivalMETSeconds = input.scheduledTxTimeMET + txDurationSeconds + oneWayLightTimeSeconds;

    const cmd: CommandPacket<T> = {
      id,
      type: input.type.trim(),
      payload: input.payload,
      priority,
      sizeBytes,
      scheduledTxTimeMET: input.scheduledTxTimeMET,
      txDurationSeconds,
      oneWayLightTimeSeconds,
      arrivalMETSeconds,
      status: 'QUEUED',
    };

    this.commands.set(id, cmd as CommandPacket);
    return { ...cmd };
  }

  /**
   * Updates state of all queued commands based on current MET.
   *
   * State Progression:
   * - t < scheduledTxTimeMET: QUEUED
   * - scheduledTxTimeMET <= t < scheduledTxTimeMET + txDurationSeconds: TRANSMITTING
   * - scheduledTxTimeMET + txDurationSeconds <= t < arrivalMETSeconds: IN_TRANSIT
   * - arrivalMETSeconds <= t: ARRIVED (ready for spacecraft execution)
   */
  public updateStatus(currentMETSeconds: number): void {
    if (typeof currentMETSeconds !== 'number' || !Number.isFinite(currentMETSeconds)) {
      throw new TypeError(`CommandQueue.updateStatus: currentMETSeconds must be a finite number. Received: ${currentMETSeconds}`);
    }

    for (const cmd of this.commands.values()) {
      if (cmd.status === 'EXECUTED' || cmd.status === 'FAILED') {
        continue;
      }

      const txEndTime = cmd.scheduledTxTimeMET + cmd.txDurationSeconds;

      if (currentMETSeconds < cmd.scheduledTxTimeMET) {
        cmd.status = 'QUEUED';
      } else if (currentMETSeconds < txEndTime) {
        cmd.status = 'TRANSMITTING';
      } else if (currentMETSeconds < cmd.arrivalMETSeconds) {
        cmd.status = 'IN_TRANSIT';
      } else {
        cmd.status = 'ARRIVED';
      }
    }
  }

  /**
   * Retrieves all commands that have arrived at the spacecraft and are waiting for execution,
   * sorted by priority descending (highest priority first).
   */
  public getArrivedCommands(currentMETSeconds: number): CommandPacket[] {
    this.updateStatus(currentMETSeconds);

    const arrived: CommandPacket[] = [];
    for (const cmd of this.commands.values()) {
      if (cmd.status === 'ARRIVED') {
        arrived.push({ ...cmd });
      }
    }

    return arrived.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Marks a command as executed by the spacecraft.
   */
  public markExecuted(commandId: string, result?: unknown): boolean {
    const cmd = this.commands.get(commandId);
    if (!cmd) return false;
    cmd.status = 'EXECUTED';
    cmd.result = result;
    return true;
  }

  /**
   * Marks a command as failed.
   */
  public markFailed(commandId: string, error: string): boolean {
    const cmd = this.commands.get(commandId);
    if (!cmd) return false;
    cmd.status = 'FAILED';
    cmd.executionError = error;
    return true;
  }

  public getCommand(commandId: string): CommandPacket | undefined {
    const cmd = this.commands.get(commandId);
    return cmd ? { ...cmd } : undefined;
  }

  public getAllCommands(): CommandPacket[] {
    return Array.from(this.commands.values()).map((c) => ({ ...c }));
  }

  public clear(): void {
    this.commands.clear();
  }

  public restoreCommands(commands: CommandPacket[]): void {
    this.commands.clear();
    for (const c of commands) {
      this.commands.set(c.id, { ...c });
    }
  }
}
