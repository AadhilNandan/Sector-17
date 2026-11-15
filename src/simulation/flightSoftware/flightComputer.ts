/**
 * SECTOR 17 — Flight Computer (Central Avionics Core)
 * The central orchestrator integrating mission timeline, subsystems, command execution,
 * fault management, coordinate transformations, and communications.
 *
 * SAFETY INVARIANTS:
 * 1. Fully deterministic time progression driven exclusively by SI Mission Elapsed Time (MET).
 * 2. Strict coordinate frame enforcement: never applies Earth rotation to ECEF positions;
 *    accurately rotates ECI inertial positions into ECEF.
 * 3. Autonomous SAFE_MODE triggering upon critical fault identification.
 * 4. Gated recovery ensuring all critical faults are resolved prior to resuming nominal operations.
 * 5. Retention policy enforcement preventing silent or premature onboard data erasure.
 */

import { TimeController } from '../operations/timeController';
import { MissionEventEngine } from '../operations/missionEventEngine';
import { CommunicationManager } from '../communications/communicationManager';
import { SubsystemManager } from './subsystemManager';
import { MissionExecutionController } from './missionExecutionController';
import { FaultManager } from './faultManager';
import { CommandExecutor } from './commandExecutor';
import { StorageRetentionManager } from './storageRetention';
import { transformSpacecraftPosition } from './coordinateTransform';
import type { ScienceProcessingManager } from '../science/scienceProcessingManager';
import type { MissionDecisionManager } from '../missionDecision/missionDecisionManager';
import type { SpacecraftPointingTarget } from '../communications/types';
import type {
  FlightComputerConfig,
  FlightComputerStepReport,
  SpacecraftPositionState,
  MissionExecutionState,
  SubsystemType,
  SubsystemStatus,
} from './types';

export class FlightComputer {
  private timeController: TimeController;
  private executionController: MissionExecutionController;
  private subsystemManager: SubsystemManager;
  private faultManager: FaultManager;
  private commandExecutor: CommandExecutor;
  private retentionManager: StorageRetentionManager;
  private commManager?: CommunicationManager;
  private eventEngine?: MissionEventEngine;
  private scienceManager?: ScienceProcessingManager;
  private decisionManager?: MissionDecisionManager;

  private currentPosition: SpacecraftPositionState;

  constructor(config: FlightComputerConfig = {}) {
    this.timeController = new TimeController(config.epochTimestampSeconds, true);
    this.subsystemManager = new SubsystemManager(true);
    this.executionController = new MissionExecutionController(config.initialState ?? 'INITIALIZED');
    this.faultManager = new FaultManager(this.subsystemManager);
    this.retentionManager = new StorageRetentionManager(config.retentionPolicy);
    this.commandExecutor = new CommandExecutor(
      config.acknowledgementPolicy ?? 'ALWAYS',
      this.subsystemManager,
      this.executionController
    );

    // Default reference position: Jupiter distance (~5.2 AU), equator
    this.currentPosition = config.initialPosition ?? {
      latitudeDeg: 0.0,
      longitudeDeg: 0.0,
      distanceMetres: 778.5e9, // Interplanetary cruise
      frame: 'ECI',
    };

    this.wireAutomatedSafety();
    this.registerBuiltInCommandHandlers();
  }

  /**
   * Wires fault manager, state machine, and subsystems together for autonomous safety responses.
   */
  private wireAutomatedSafety(): void {
    // 1. Critical faults trigger autonomous safety responses:
    //    - Prelaunch (INITIALIZED, STANDBY): transitions to PRELAUNCH_HOLD
    //    - In-flight (ACTIVE, RECOVERY): transitions to SAFE_MODE
    this.faultManager.onSafeModeTrigger((reason, currentMET) => {
      const currentState = this.executionController.getState();
      if (
        this.executionController.isTerminal() ||
        currentState === 'SAFE_MODE' ||
        currentState === 'PRELAUNCH_HOLD'
      ) {
        return; // Already in safe/hold or terminal; no duplicate transition
      }

      if (currentState === 'INITIALIZED' || currentState === 'STANDBY') {
        this.executionController.transitionTo('PRELAUNCH_HOLD', currentMET, reason);
      } else if (currentState === 'ACTIVE' || currentState === 'RECOVERY') {
        this.executionController.transitionTo('SAFE_MODE', currentMET, reason);
      }
      this.subsystemManager.transitionAllToSafe(currentMET);
    });

    // 2. Recovery gate: RECOVERY -> ACTIVE and PRELAUNCH_HOLD -> STANDBY require no active critical faults
    this.executionController.setRecoveryValidator(() => {
      return this.faultManager.canRecover();
    });

    // 3. Subsystem recovery guard: Subsystems cannot recover while active critical faults exist
    this.subsystemManager.setRecoveryValidator((_subsystemType) => {
      return this.faultManager.canRecover();
    });
  }

  /**
   * Registers default flight computer command handlers for operational commanding (C-05).
   */
  private registerBuiltInCommandHandlers(): void {
    // 1. START_SCIENCE_SURVEY
    this.commandExecutor.registerHandler(
      'START_SCIENCE_SURVEY',
      async (payload: any, context) => {
        const sciSub = this.subsystemManager.getSubsystem('SCIENCE');
        if (!sciSub) {
          throw new Error("Cannot start science survey: 'SCIENCE' subsystem is not present on spacecraft.");
        }
        const mode = payload?.mode ?? 'SURVEY';
        if (this.scienceManager) {
          this.scienceManager.getSubsystem().setInstrumentMode('REASON', mode);
          this.scienceManager.getSubsystem().setInstrumentMode('MASPEX', mode);
        }
        return {
          status: 'SURVEY_STARTED',
          mode,
          currentMET: context.currentMETSeconds,
        };
      },
      { allowInSafeMode: false, targetSubsystem: 'SCIENCE' }
    );

    // 2. RECONFIGURE_SCIENCE_PAYLOAD
    this.commandExecutor.registerHandler(
      'RECONFIGURE_SCIENCE_PAYLOAD',
      async (payload: any, context) => {
        const sciSub = this.subsystemManager.getSubsystem('SCIENCE');
        if (!sciSub) {
          throw new Error("Cannot reconfigure science payload: 'SCIENCE' subsystem is not present on spacecraft.");
        }
        const mode = payload?.mode ?? 'HIGH_RESOLUTION';
        const targetAnomalyId = payload?.targetAnomalyId;
        if (this.scienceManager) {
          this.scienceManager.getSubsystem().setInstrumentMode('REASON', mode);
          this.scienceManager.getSubsystem().setInstrumentMode('MASPEX', mode);
        }
        return {
          status: 'RECONFIGURED',
          mode,
          targetAnomalyId,
          currentMET: context.currentMETSeconds,
        };
      },
      { allowInSafeMode: false, targetSubsystem: 'SCIENCE' }
    );

    // 3. SET_SUBSYSTEM_POWER_STATE
    this.commandExecutor.registerHandler(
      'SET_SUBSYSTEM_POWER_STATE',
      async (payload: any, context) => {
        const targetSub = payload?.subsystem as SubsystemType | undefined;
        const targetState = payload?.state as SubsystemStatus | undefined;
        const mode = payload?.mode as string | undefined;

        if (targetSub) {
          const sub = this.subsystemManager.getSubsystem(targetSub);
          if (!sub) {
            throw new Error(`Cannot set power state: Subsystem '${targetSub}' not found.`);
          }
          if (targetState) {
            sub.setStatus(targetState);
          }
        } else if (mode === 'CONSERVATION') {
          const sciSub = this.subsystemManager.getSubsystem('SCIENCE');
          if (sciSub && sciSub.getStatus() === 'NOMINAL') {
            sciSub.setStatus('OFF');
          }
        }
        return {
          status: 'POWER_STATE_UPDATED',
          subsystem: targetSub,
          targetState,
          mode,
          currentMET: context.currentMETSeconds,
        };
      },
      { allowInSafeMode: true }
    );

    // 4. INITIATE_DOWNLINK_TRANSMISSION
    this.commandExecutor.registerHandler(
      'INITIATE_DOWNLINK_TRANSMISSION',
      async (payload: any, context) => {
        const commSub = this.subsystemManager.getSubsystem('COMMUNICATIONS');
        if (!commSub) {
          throw new Error("Cannot initiate downlink: 'COMMUNICATIONS' subsystem is not present on spacecraft.");
        }
        let windowActive = false;
        if (this.commManager) {
          const pointing = this.getResolvedECEFPosition(context.currentMETSeconds);
          const windows = this.commManager.evaluateVisibility(pointing, context.currentMETSeconds);
          windowActive = windows.length > 0;
        }
        const packetIds = payload?.packetIds;
        return {
          status: 'DOWNLINK_INITIATED',
          windowActive,
          packetIds: Array.isArray(packetIds) ? packetIds : [],
          currentMET: context.currentMETSeconds,
        };
      },
      { allowInSafeMode: false, targetSubsystem: 'COMMUNICATIONS' }
    );

    // 5. DEPLOY_SURFACE_LANDER
    this.commandExecutor.registerHandler(
      'DEPLOY_SURFACE_LANDER',
      async (payload: any, context) => {
        const landerSub = this.subsystemManager.getSubsystem('LANDER_ROVER');
        if (!landerSub) {
          throw new Error("Cannot deploy surface lander: 'LANDER_ROVER' subsystem is not present on spacecraft.");
        }
        if (landerSub.getStatus() === 'FAULT') {
          throw new Error("Cannot deploy surface lander: LANDER_ROVER subsystem is in 'FAULT' state.");
        }
        landerSub.setStatus('NOMINAL');
        return {
          status: 'LANDER_DEPLOYED',
          siteTarget: payload?.siteTarget ?? 'EUROPA-CONAMARA-CHAOS',
          currentMET: context.currentMETSeconds,
        };
      },
      { allowInSafeMode: false }
    );

    // 5b. AUTHORIZE_EUROPA_PARKING_ORBIT
    this.commandExecutor.registerHandler(
      'AUTHORIZE_EUROPA_PARKING_ORBIT',
      async (payload: any, context) => {
        return {
          status: 'PARKING_ORBIT_AUTHORIZED',
          altitudeMetres: payload?.altitudeMetres ?? 100_000,
          currentMET: context.currentMETSeconds,
        };
      },
      { allowInSafeMode: false, targetSubsystem: 'GNC' }
    );

    // 6. TRANSITION_FLIGHT_STATE
    this.commandExecutor.registerHandler(
      'TRANSITION_FLIGHT_STATE',
      async (payload: any, context) => {
        const targetState = payload?.targetState;
        const reason = payload?.reason ?? 'Ground commanded flight state transition';
        if (!targetState) {
          throw new Error("TRANSITION_FLIGHT_STATE: 'targetState' must be specified in command payload.");
        }
        this.transitionState(targetState, reason);
        return {
          status: 'TRANSITION_COMPLETE',
          previousState: this.executionController.getState(),
          targetState,
          currentMET: context.currentMETSeconds,
        };
      },
      { allowInSafeMode: true }
    );

    // 7. AUTHORIZE_LAUNCH
    this.commandExecutor.registerHandler(
      'AUTHORIZE_LAUNCH',
      async (payload: any, context) => {
        if (this.executionController.getState() === 'INITIALIZED') {
          this.executionController.transitionTo(
            'STANDBY',
            context.currentMETSeconds,
            'Launch authorization command executed: countdown standby.'
          );
        }
        return {
          status: 'LAUNCH_AUTHORIZED',
          destination: payload?.destination ?? 'Europa',
          currentMET: context.currentMETSeconds,
        };
      },
      { allowInSafeMode: false }
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Component Accessors                                                        */
  /* -------------------------------------------------------------------------- */

  public getTimeController(): TimeController {
    return this.timeController;
  }

  public getExecutionController(): MissionExecutionController {
    return this.executionController;
  }

  public getSubsystemManager(): SubsystemManager {
    return this.subsystemManager;
  }

  public getFaultManager(): FaultManager {
    return this.faultManager;
  }

  public getCommandExecutor(): CommandExecutor {
    return this.commandExecutor;
  }

  public getRetentionManager(): StorageRetentionManager {
    return this.retentionManager;
  }

  public getCommunicationManager(): CommunicationManager | undefined {
    return this.commManager;
  }

  public getScienceManager(): ScienceProcessingManager | undefined {
    return this.scienceManager;
  }

  public getDecisionManager(): MissionDecisionManager | undefined {
    return this.decisionManager;
  }

  public getEventEngine(): MissionEventEngine | undefined {
    return this.eventEngine;
  }

  public getCurrentMETSeconds(): number {
    if (this.eventEngine) {
      return this.eventEngine.getMETSeconds();
    }
    return this.timeController.getMETSeconds();
  }

  /* -------------------------------------------------------------------------- */
  /* Communications and Event Engine Integration                               */
  /* -------------------------------------------------------------------------- */

  public attachEventEngine(engine: MissionEventEngine): void {
    this.eventEngine = engine;
    this.timeController = engine.getTimeController();

    this.executionController.attachEventEngine(engine);
    this.subsystemManager.attachEventEngine(engine);
    this.faultManager.attachEventEngine(engine);

    if (this.commManager) {
      this.commManager.attachEventEngine(engine);
    }

    if (this.scienceManager) {
      this.scienceManager.attachEventEngine(engine);
    }

    if (this.decisionManager) {
      this.decisionManager.attachEventEngine(engine);
    }

    this.commandExecutor.attachDependencies({
      eventEngine: engine,
    });
  }

  public attachCommunicationManager(commManager: CommunicationManager): void {
    this.commManager = commManager;

    if (this.eventEngine) {
      commManager.attachEventEngine(this.eventEngine);
    }

    if (this.scienceManager) {
      this.scienceManager.attachStorage(commManager.getStorage());
      this.scienceManager.attachTelemetryQueue(commManager.getTelemetryQueue());
    }

    this.commandExecutor.attachDependencies({
      commandQueue: commManager.getCommandQueue(),
      telemetryQueue: commManager.getTelemetryQueue(),
      storage: commManager.getStorage(),
      retentionManager: this.retentionManager,
      subsystemManager: this.subsystemManager,
      executionController: this.executionController,
      eventEngine: this.eventEngine,
    });
  }

  public attachScienceManager(scienceManager: ScienceProcessingManager): void {
    this.scienceManager = scienceManager;
    this.subsystemManager.registerSubsystem(scienceManager.getSubsystem());

    if (this.eventEngine) {
      scienceManager.attachEventEngine(this.eventEngine);
    }

    if (this.commManager) {
      scienceManager.attachStorage(this.commManager.getStorage());
      scienceManager.attachTelemetryQueue(this.commManager.getTelemetryQueue());
    }

    scienceManager.attachRetentionManager(this.retentionManager);
  }

  public attachDecisionManager(decisionManager: MissionDecisionManager): void {
    this.decisionManager = decisionManager;
    decisionManager.attachFlightComputer(this);

    if (this.eventEngine) {
      decisionManager.attachEventEngine(this.eventEngine);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Spacecraft Position & Coordinate Frame Contract                            */
  /* -------------------------------------------------------------------------- */

  public setPosition(position: SpacecraftPositionState): void {
    if (!position || typeof position !== 'object') {
      throw new TypeError('setPosition: position must be an object.');
    }
    this.currentPosition = { ...position };
  }

  public getPosition(): SpacecraftPositionState {
    return { ...this.currentPosition };
  }

  /**
   * Resolves current spacecraft position to an Earth-fixed (ECEF) sub-spacecraft target.
   * If frame is 'ECEF', no rotation is applied.
   * If frame is 'ECI', Earth sidereal rotation is subtracted from right ascension.
   */
  public getResolvedECEFPosition(metSeconds?: number): SpacecraftPointingTarget {
    const met = metSeconds !== undefined ? metSeconds : this.getCurrentMETSeconds();
    return transformSpacecraftPosition(this.currentPosition, met);
  }

  /* -------------------------------------------------------------------------- */
  /* Operational Time Step Execution                                            */
  /* -------------------------------------------------------------------------- */

  /**
   * Advances the simulation by durationSeconds, orchestrating:
   * 1. Deterministic time advancement and event execution.
   * 2. Coordinate transformation into Earth-fixed frame.
   * 3. Communication passes, link budgets, and telemetry downlinks.
   * 4. Validation and execution of arrived uplink ground commands.
   * 5. Data storage retention eligibility evaluation.
   * 6. Subsystem updates.
   *
   * @param durationSeconds Delta simulation time in SI seconds (>= 0)
   */
  public async step(durationSeconds: number): Promise<FlightComputerStepReport> {
    if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds < 0) {
      throw new TypeError(`step: durationSeconds must be a non-negative finite number. Received: ${durationSeconds}`);
    }

    // 1. Advance time
    if (this.eventEngine) {
      this.eventEngine.advanceAndProcess(durationSeconds);
    } else {
      this.timeController.advance(durationSeconds);
    }

    const currentMET = this.getCurrentMETSeconds();

    // 2. Resolve coordinate position
    const ecefTarget = this.getResolvedECEFPosition(currentMET);

    // 3. Process Communications
    if (this.commManager) {
      // Spacecraft RF front-end parameters (20W X-band, 3m parabolic reflector)
      const spacecraftRfConfig = {
        transmitPowerWatts: 20.0,
        antennaDiameterMetres: 3.0,
      };

      this.commManager.processStep(durationSeconds, currentMET, ecefTarget, spacecraftRfConfig);
    }

    // 4. Process Arrived Commands
    let commandsProcessed = 0;
    let commandsSucceeded = 0;
    let commandsFailed = 0;

    if (this.commManager) {
      const commandQueue = this.commManager.getCommandQueue();
      const arrivedCommands = commandQueue.getArrivedCommands(currentMET);

      for (const cmd of arrivedCommands) {
        commandsProcessed++;
        const res = await this.commandExecutor.executeCommand(cmd, currentMET);
        if (res.success) {
          commandsSucceeded++;
        } else {
          commandsFailed++;
        }
      }
    }

    // 5. Synchronize Communications & Storage Retention
    if (this.commManager) {
      // a) Synchronize downlinked telemetry packet status with retention manager
      for (const p of this.commManager.getTelemetryQueue().getAllPackets()) {
        if (!this.retentionManager.getRecord(p.id)) {
          this.retentionManager.trackPacket(p.id, p.category, p.sizeBytes, currentMET);
        }
        if (p.status === 'IN_TRANSIT' || p.status === 'RECEIVED_EARTH' || p.status === 'ACKNOWLEDGED') {
          this.retentionManager.recordTransmissionCompleted(p.id, currentMET);
        }
        if (p.status === 'RECEIVED_EARTH' || p.status === 'ACKNOWLEDGED') {
          this.retentionManager.recordEarthReceipt(p.id, currentMET);
          this.retentionManager.recordEarthAckGenerated(p.id, currentMET);
        }
      }

      // b) Process physically arrived ground receipt ACK frames returning from Earth
      const arrivedGroundAcks = this.commManager.getArrivedGroundAcks(currentMET);
      for (const ack of arrivedGroundAcks) {
        this.retentionManager.recordAethonAckReceived(ack.packetId, currentMET);
      }
    }

    // Evaluate storage purge eligibility
    this.retentionManager.evaluatePurgeEligibility(currentMET);

    // 6. Step Subsystems
    this.subsystemManager.step(durationSeconds, currentMET);

    // 7. Step Mission Decision Engine (if attached)
    if (this.decisionManager) {
      this.decisionManager.step(durationSeconds, currentMET);
    }

    const activeFaults = this.faultManager.getActiveFaults();
    const criticalFaults = this.faultManager.getFaultsBySeverity('CRITICAL');

    return {
      metSeconds: currentMET,
      missionState: this.executionController.getState(),
      commandsProcessed,
      commandsSucceeded,
      commandsFailed,
      activeFaultCount: activeFaults.length,
      criticalFaultCount: criticalFaults.length,
      subsystemStatuses: this.subsystemManager.getStatuses(),
      resolvedECEFPosition: ecefTarget,
    };
  }

  /**
   * Convenience transition helper.
   */
  public transitionState(nextState: MissionExecutionState, reason: string): void {
    const met = this.getCurrentMETSeconds();
    this.executionController.transitionTo(nextState, met, reason);
    if (nextState === 'SAFE_MODE' || nextState === 'PRELAUNCH_HOLD') {
      this.subsystemManager.transitionAllToSafe(met);
    }
  }
}
