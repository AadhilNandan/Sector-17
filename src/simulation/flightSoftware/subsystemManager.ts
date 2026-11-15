/**
 * SECTOR 17 — Flight Software Subsystem Manager
 * Coordinates lifecycle states, operational modes, and safe-mode transitions
 * across all spacecraft physical and simulated subsystems.
 *
 * SUBSYSTEM LIFECYCLE:
 * - OFF: Subsystem unpowered or isolated.
 * - INITIALIZING: Powering up, booting firmware, running self-tests.
 * - NOMINAL: Standard operational flight state.
 * - DEGRADED: Functioning with impaired redundancy or reduced capability.
 * - FAULT: System experienced an anomaly; action required.
 * - SAFE: Configured into lowest-power, fail-safe survival state.
 *
 * IMPLEMENTATION STATUS CLASSIFICATION:
 * Integrates functional simulation models where they exist, and exposes
 * clean NOT_IMPLEMENTED interfaces for future mission phases.
 */

import { FSW_EVENT_TYPES } from './constants';
import type { MissionEventEngine } from '../operations/missionEventEngine';
import type {
  ISubsystem,
  SubsystemType,
  SubsystemStatus,
  SubsystemImplementationStatus,
  SubsystemRecoveryValidator,
} from './types';

/**
 * Base generic subsystem implementation providing standard lifecycle hooks.
 */
export class BaseSubsystem implements ISubsystem {
  public readonly id: string;
  public readonly name: string;
  public readonly type: SubsystemType;
  public readonly implementationStatus: SubsystemImplementationStatus;
  protected status: SubsystemStatus;

  constructor(
    id: string,
    name: string,
    type: SubsystemType,
    implementationStatus: SubsystemImplementationStatus,
    initialStatus: SubsystemStatus = 'NOMINAL'
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.implementationStatus = implementationStatus;
    this.status = initialStatus;
  }

  public getStatus(): SubsystemStatus {
    return this.status;
  }

  public setStatus(status: SubsystemStatus): void {
    this.status = status;
  }

  public toSafeMode(): void {
    this.status = 'SAFE';
  }

  public recover(_currentMETSeconds?: number, validator?: () => boolean): boolean {
    if (validator && !validator()) {
      return false;
    }
    if (this.status === 'SAFE' || this.status === 'FAULT' || this.status === 'DEGRADED') {
      this.status = 'NOMINAL';
      return true;
    }
    return false;
  }

  public step?(_deltaSeconds: number, _currentMETSeconds: number): void {
    // Default no-op for basic subsystems
  }
}

/* -------------------------------------------------------------------------- */
/* Concrete Subsystem Adapters                                                */
/* -------------------------------------------------------------------------- */

export class EpsSubsystem extends BaseSubsystem {
  private batteryStateOfCharge: number = 1.0; // 100%

  constructor() {
    super('subsys-eps', 'Electrical Power System', 'EPS', 'SIMPLIFIED');
  }

  public override toSafeMode(): void {
    // Safe mode shed non-essential loads
    this.status = 'SAFE';
  }

  public getBatterySoC(): number {
    return this.batteryStateOfCharge;
  }

  public setBatterySoC(soc: number): void {
    this.batteryStateOfCharge = Math.max(0, Math.min(1, soc));
  }
}

export class PropulsionSubsystem extends BaseSubsystem {
  private propellantRemainingKg: number = 2450.0;
  private isValvesIsolated: boolean = false;

  constructor(initialPropellantKg: number = 2450.0) {
    super('subsys-prop', 'Main Propulsion System', 'PROPULSION', 'SIMPLIFIED');
    this.propellantRemainingKg = initialPropellantKg;
  }

  public override toSafeMode(): void {
    // In safe mode, isolate bipropellant valves to inhibit uncommanded burns
    this.isValvesIsolated = true;
    this.status = 'SAFE';
  }

  public override recover(currentMETSeconds?: number, validator?: () => boolean): boolean {
    if (validator && !validator()) {
      return false;
    }
    this.isValvesIsolated = false;
    return super.recover(currentMETSeconds, validator);
  }

  public getPropellantRemainingKg(): number {
    return this.propellantRemainingKg;
  }

  public setPropellantRemainingKg(kg: number): void {
    if (typeof kg !== 'number' || !Number.isFinite(kg) || kg < 0) {
      throw new RangeError(`PropulsionSubsystem.setPropellantRemainingKg: Must be non-negative finite number. Received: ${kg}`);
    }
    this.propellantRemainingKg = kg;
  }

  public consumePropellant(kg: number): void {
    if (this.isValvesIsolated) {
      throw new Error('PropulsionSubsystem: Cannot consume propellant while thruster valves are isolated in SAFE mode.');
    }
    this.propellantRemainingKg = Math.max(0, this.propellantRemainingKg - kg);
  }

  public areValvesIsolated(): boolean {
    return this.isValvesIsolated;
  }
}

export class TcsSubsystem extends BaseSubsystem {
  private survivalHeatersActive: boolean = false;

  constructor() {
    super('subsys-tcs', 'Thermal Control System', 'TCS', 'SIMPLIFIED');
  }

  public override toSafeMode(): void {
    // Enable autonomous survival heaters to maintain avionics in temperature bounds
    this.survivalHeatersActive = true;
    this.status = 'SAFE';
  }

  public areSurvivalHeatersActive(): boolean {
    return this.survivalHeatersActive;
  }
}

export class CommunicationsSubsystem extends BaseSubsystem {
  private isHighGainAntennaActive: boolean = true;

  constructor() {
    super('subsys-comms', 'Deep-Space Communications System', 'COMMUNICATIONS', 'SIMPLIFIED');
  }

  public override toSafeMode(): void {
    // Switch to omni / low-gain antenna for robust attitude-independent contact
    this.isHighGainAntennaActive = false;
    this.status = 'SAFE';
  }

  public isHGAActive(): boolean {
    return this.isHighGainAntennaActive;
  }
}

export class StorageSubsystem extends BaseSubsystem {
  constructor() {
    super('subsys-storage', 'Onboard Solid-State Mass Memory', 'STORAGE', 'SIMPLIFIED');
  }
}

export class GncSubsystem extends BaseSubsystem {
  constructor() {
    super('subsys-gnc', 'Guidance, Navigation and Control', 'GNC', 'NOT_IMPLEMENTED', 'NOMINAL');
  }
}

export class ScienceSubsystem extends BaseSubsystem {
  constructor() {
    super('subsys-science', 'Scientific Payload Suite', 'SCIENCE', 'NOT_IMPLEMENTED', 'OFF');
  }
}

export class LanderRoverSubsystem extends BaseSubsystem {
  constructor() {
    super('subsys-lander-rover', 'Surface Exploration Package', 'LANDER_ROVER', 'NOT_IMPLEMENTED', 'OFF');
  }
}

/* -------------------------------------------------------------------------- */
/* Subsystem Manager                                                          */
/* -------------------------------------------------------------------------- */

export class SubsystemManager {
  private subsystems: Map<SubsystemType, ISubsystem> = new Map();
  private eventEngine?: MissionEventEngine;
  private recoveryValidator?: SubsystemRecoveryValidator;

  constructor(autoRegisterDefaults: boolean = true) {
    if (autoRegisterDefaults) {
      this.registerSubsystem(new EpsSubsystem());
      this.registerSubsystem(new PropulsionSubsystem());
      this.registerSubsystem(new TcsSubsystem());
      this.registerSubsystem(new CommunicationsSubsystem());
      this.registerSubsystem(new StorageSubsystem());
      this.registerSubsystem(new GncSubsystem());
      this.registerSubsystem(new ScienceSubsystem());
      this.registerSubsystem(new LanderRoverSubsystem());
    }
  }

  public attachEventEngine(engine: MissionEventEngine): void {
    this.eventEngine = engine;
  }

  public setRecoveryValidator(validator: SubsystemRecoveryValidator): void {
    this.recoveryValidator = validator;
  }

  public registerSubsystem(subsystem: ISubsystem): void {
    if (!subsystem || !subsystem.type) {
      throw new TypeError('registerSubsystem: Invalid subsystem.');
    }
    this.subsystems.set(subsystem.type, subsystem);
  }

  public unregisterSubsystem(type: SubsystemType): boolean {
    return this.subsystems.delete(type);
  }

  public getSubsystem(type: SubsystemType): ISubsystem | undefined {
    return this.subsystems.get(type);
  }

  public getAllSubsystems(): ISubsystem[] {
    return Array.from(this.subsystems.values());
  }

  public getSubsystemMap(): Map<SubsystemType, ISubsystem> {
    return new Map(this.subsystems);
  }

  public setSubsystemStatus(
    type: SubsystemType,
    newStatus: SubsystemStatus,
    reason?: string,
    currentMETSeconds: number = 0
  ): boolean {
    const sub = this.subsystems.get(type);
    if (!sub) return false;

    const oldStatus = sub.getStatus();
    if (oldStatus === newStatus) return true;

    // Guard: restoring from FAULT or SAFE to NOMINAL requires recovery validator approval
    if ((oldStatus === 'FAULT' || oldStatus === 'SAFE') && newStatus === 'NOMINAL') {
      if (this.recoveryValidator && !this.recoveryValidator(type)) {
        return false;
      }
    }

    sub.setStatus(newStatus, reason, currentMETSeconds);

    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-subsys-status-${type}-${currentMETSeconds}`,
        type: FSW_EVENT_TYPES.SUBSYSTEM_STATUS_CHANGED,
        scheduledTimeSeconds: currentMETSeconds,
        payload: {
          subsystemType: type,
          oldStatus,
          newStatus,
          reason,
        },
      });
    }

    return true;
  }

  /**
   * Puts all registered subsystems into safe mode.
   */
  public transitionAllToSafe(currentMETSeconds: number = 0): void {
    for (const [type, sub] of this.subsystems.entries()) {
      const oldStatus = sub.getStatus();
      sub.toSafeMode(currentMETSeconds);
      const newStatus = sub.getStatus();

      if (oldStatus !== newStatus && this.eventEngine) {
        this.eventEngine.scheduleEvent({
          id: `evt-subsys-safe-${type}-${currentMETSeconds}`,
          type: FSW_EVENT_TYPES.SUBSYSTEM_STATUS_CHANGED,
          scheduledTimeSeconds: currentMETSeconds,
          payload: {
            subsystemType: type,
            oldStatus,
            newStatus,
            reason: 'Mission SAFE_MODE transition',
          },
        });
      }
    }
  }

  /**
   * Attempts recovery for all degraded, faulted, or safe subsystems.
   */
  public recoverAll(currentMETSeconds: number = 0): boolean {
    let allSucceeded = true;
    for (const [type, sub] of this.subsystems.entries()) {
      const oldStatus = sub.getStatus();

      // Guard: check validator before recovering this subsystem
      if (this.recoveryValidator && !this.recoveryValidator(type)) {
        if (oldStatus !== 'NOMINAL' && oldStatus !== 'OFF') {
          allSucceeded = false;
        }
        continue;
      }

      const recovered = sub.recover(currentMETSeconds, () => !this.recoveryValidator || this.recoveryValidator(type));
      if (!recovered && oldStatus !== 'NOMINAL' && oldStatus !== 'OFF') {
        allSucceeded = false;
      }
      const newStatus = sub.getStatus();

      if (oldStatus !== newStatus && this.eventEngine) {
        this.eventEngine.scheduleEvent({
          id: `evt-subsys-recover-${type}-${currentMETSeconds}`,
          type: FSW_EVENT_TYPES.SUBSYSTEM_STATUS_CHANGED,
          scheduledTimeSeconds: currentMETSeconds,
          payload: {
            subsystemType: type,
            oldStatus,
            newStatus,
            reason: 'Subsystem recovery procedure',
          },
        });
      }
    }
    return allSucceeded;
  }

  public step(deltaSeconds: number, currentMETSeconds: number): void {
    for (const sub of this.subsystems.values()) {
      if (typeof sub.step === 'function') {
        sub.step(deltaSeconds, currentMETSeconds);
      }
    }
  }

  public getStatuses(): Record<SubsystemType, SubsystemStatus> {
    const statuses: Partial<Record<SubsystemType, SubsystemStatus>> = {};
    for (const [type, sub] of this.subsystems.entries()) {
      statuses[type] = sub.getStatus();
    }
    return statuses as Record<SubsystemType, SubsystemStatus>;
  }

  public restoreStatuses(statuses: Partial<Record<SubsystemType, SubsystemStatus>>): void {
    for (const [type, status] of Object.entries(statuses)) {
      const sub = this.subsystems.get(type as SubsystemType);
      if (sub && status) {
        sub.setStatus(status, 'Restored from checkpoint');
      }
    }
  }
}
