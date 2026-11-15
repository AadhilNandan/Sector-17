/**
 * SECTOR 17 — Flight Software Fault Manager
 * Detects, categorizes, and coordinates responses to spacecraft anomalies.
 *
 * FAULT SEVERITY CLASSIFICATION:
 * - INFO: Telemetry advisory or non-critical state change.
 * - WARNING: Parameter out of nominal yellow limits; self-correcting or monitored.
 * - DEGRADED: Loss of subsystem redundancy or minor capability reduction.
 * - CRITICAL: Immediate threat to spacecraft health or mission objectives;
 *             triggers autonomous transition to SAFE_MODE.
 *
 * RECOVERY EVALUATION:
 * Recovery from SAFE_MODE requires that all active CRITICAL faults are cleared and resolved.
 */

import { FSW_EVENT_TYPES } from './constants';
import type { MissionEventEngine } from '../operations/missionEventEngine';
import type { SubsystemManager } from './subsystemManager';
import type { Fault, FaultSeverity, FaultResponseHandler } from './types';

export class FaultManager {
  private activeFaults: Map<string, Fault> = new Map();
  private faultHistory: Fault[] = [];
  private faultHandlers: Map<string, FaultResponseHandler> = new Map();
  private safeModeTriggerCallback?: (reason: string, currentMET: number) => void;
  private subsystemManager?: SubsystemManager;
  private eventEngine?: MissionEventEngine;

  constructor(subsystemManager?: SubsystemManager) {
    this.subsystemManager = subsystemManager;
  }

  public attachEventEngine(engine: MissionEventEngine): void {
    this.eventEngine = engine;
  }

  public setSubsystemManager(manager: SubsystemManager): void {
    this.subsystemManager = manager;
  }

  public onSafeModeTrigger(callback: (reason: string, currentMET: number) => void): void {
    this.safeModeTriggerCallback = callback;
  }

  public registerFaultHandler(code: string, handler: FaultResponseHandler): void {
    this.faultHandlers.set(code, handler);
  }

  /**
   * Raises a new fault condition on AETHON.
   *
   * @throws TypeError if fault specification is invalid
   * @throws Error if fault ID is already active
   */
  public raiseFault(faultInput: Omit<Fault, 'resolvedAtMETSeconds' | 'resolutionReason'>): Fault {
    if (!faultInput || typeof faultInput !== 'object') {
      throw new TypeError('raiseFault: faultInput must be an object.');
    }
    if (!faultInput.id || typeof faultInput.id !== 'string') {
      throw new TypeError('raiseFault: id must be a non-empty string.');
    }
    const id = faultInput.id.trim();
    if (this.activeFaults.has(id)) {
      throw new Error(`raiseFault: Fault with ID '${id}' is already active.`);
    }
    if (!faultInput.code || typeof faultInput.code !== 'string') {
      throw new TypeError('raiseFault: code must be a non-empty string.');
    }
    if (!faultInput.subsystemType) {
      throw new TypeError('raiseFault: subsystemType must be specified.');
    }

    const validSeverities: FaultSeverity[] = ['INFO', 'WARNING', 'DEGRADED', 'CRITICAL'];
    if (!validSeverities.includes(faultInput.severity)) {
      throw new TypeError(`raiseFault: Invalid severity '${faultInput.severity}'.`);
    }

    const isCritical = faultInput.severity === 'CRITICAL';
    const autoSafeMode = faultInput.autoSafeMode ?? isCritical;

    const fault: Fault = {
      ...faultInput,
      id,
      autoSafeMode,
    };

    this.activeFaults.set(id, fault);
    this.faultHistory.push({ ...fault });

    // Update subsystem status if subsystem manager is connected
    if (this.subsystemManager) {
      if (fault.severity === 'CRITICAL') {
        this.subsystemManager.setSubsystemStatus(fault.subsystemType, 'FAULT', fault.description, fault.detectedAtMETSeconds);
      } else if (fault.severity === 'DEGRADED') {
        this.subsystemManager.setSubsystemStatus(fault.subsystemType, 'DEGRADED', fault.description, fault.detectedAtMETSeconds);
      }
    }

    // Schedule typed event
    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-fault-${id}`,
        type: FSW_EVENT_TYPES.FAULT_DETECTED,
        scheduledTimeSeconds: fault.detectedAtMETSeconds,
        payload: {
          faultId: id,
          code: fault.code,
          subsystemType: fault.subsystemType,
          severity: fault.severity,
          description: fault.description,
        },
      });
    }

    // Run custom registered fault handler if present
    const handler = this.faultHandlers.get(fault.code);
    if (handler) {
      try {
        handler(fault, fault.detectedAtMETSeconds);
      } catch (err) {
        console.error(`FaultManager: Error in handler for fault code '${fault.code}':`, err);
      }
    }

    // Trigger SAFE_MODE if critical or autoSafeMode is enabled
    if (autoSafeMode && this.safeModeTriggerCallback) {
      this.safeModeTriggerCallback(
        `Critical fault ${fault.code}: ${fault.description}`,
        fault.detectedAtMETSeconds
      );
    }

    return { ...fault };
  }

  /**
   * Resolves an active fault.
   *
   * @param faultId ID of the fault to resolve
   * @param currentMET Current mission elapsed time
   * @param reason Resolution explanation
   */
  public resolveFault(faultId: string, currentMET: number, reason: string): boolean {
    const fault = this.activeFaults.get(faultId);
    if (!fault) return false;

    fault.resolvedAtMETSeconds = currentMET;
    fault.resolutionReason = reason;

    // Update history record
    const hist = this.faultHistory.find((f) => f.id === faultId);
    if (hist) {
      hist.resolvedAtMETSeconds = currentMET;
      hist.resolutionReason = reason;
    }

    this.activeFaults.delete(faultId);

    // Schedule typed event
    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-fault-resolved-${faultId}-${currentMET}`,
        type: FSW_EVENT_TYPES.FAULT_RESOLVED,
        scheduledTimeSeconds: currentMET,
        payload: {
          faultId,
          code: fault.code,
          subsystemType: fault.subsystemType,
          resolvedAtMETSeconds: currentMET,
          resolutionReason: reason,
        },
      });
    }

    return true;
  }

  public getActiveFaults(): Fault[] {
    return Array.from(this.activeFaults.values()).map((f) => ({ ...f }));
  }

  public getFaultsBySeverity(severity: FaultSeverity): Fault[] {
    return Array.from(this.activeFaults.values())
      .filter((f) => f.severity === severity)
      .map((f) => ({ ...f }));
  }

  public hasActiveCriticalFaults(): boolean {
    for (const f of this.activeFaults.values()) {
      if (f.severity === 'CRITICAL') {
        return true;
      }
    }
    return false;
  }

  public canRecover(): boolean {
    return !this.hasActiveCriticalFaults();
  }

  public getFaultHistory(): Fault[] {
    return this.faultHistory.map((f) => ({ ...f }));
  }

  public clear(): void {
    this.activeFaults.clear();
    this.faultHistory = [];
  }

  public restoreFaults(active: Fault[], history?: Fault[]): void {
    this.activeFaults.clear();
    for (const f of active) {
      this.activeFaults.set(f.id, { ...f });
    }
    this.faultHistory = history ? history.map((f) => ({ ...f })) : active.map((f) => ({ ...f }));
  }
}

