/**
 * SECTOR 17 — Deep-Space Communication Manager
 * Central coordinator integrating ground stations, visibility evaluation,
 * RF link budgets, onboard solid-state storage, uplink command queue,
 * telemetry downlink queue, and MissionEventEngine event scheduling.
 */

import { DEFAULT_ILLUSTRATIVE_STATIONS } from './groundStations';
import { OnboardStorage } from './onboardStorage';
import { CommandQueue } from './commandQueue';
import { TelemetryQueue } from './telemetryQueue';
import { findVisibleGroundStations } from './communicationWindows';
import { calculateLinkBudget } from './linkBudget';
import { calculateOneWayLightTime } from './signalPropagation';
import { calculateTransmissionDuration } from './dataTransmission';
import { FREQUENCY_X_BAND_DOWNLINK_HZ, COMM_EVENT_TYPES } from './constants';
import type { MissionEventEngine } from '../operations/missionEventEngine';
import type {
  GroundStation,
  SpacecraftPointingTarget,
  LinkBudgetResult,
  CommunicationManagerConfig,
  CommStepReport,
  GroundReceiptAckFrame,
} from './types';

export interface SpacecraftCommConfig {
  transmitPowerWatts: number;
  antennaGainDbi?: number;
  antennaDiameterMetres?: number;
  systemNoiseTempKelvin?: number;
}

export class CommunicationManager {
  private groundStations: Map<string, GroundStation> = new Map();
  private storage: OnboardStorage;
  private commandQueue: CommandQueue;
  private telemetryQueue: TelemetryQueue;
  private eventEngine?: MissionEventEngine;
  private activeStationId?: string;
  private autoExecuteCommands: boolean;
  private autoGenerateGroundAcks: boolean;
  private groundAckFrames: Map<string, GroundReceiptAckFrame> = new Map();

  constructor(config: CommunicationManagerConfig = {}) {
    const stations = config.groundStations || DEFAULT_ILLUSTRATIVE_STATIONS;
    for (const station of stations) {
      this.groundStations.set(station.id, station);
    }

    this.storage = new OnboardStorage(config.storageCapacityBytes);
    this.commandQueue = new CommandQueue();
    this.telemetryQueue = new TelemetryQueue();
    this.autoExecuteCommands = config.autoExecuteCommands !== false;
    this.autoGenerateGroundAcks = config.autoGenerateGroundAcks !== false;
  }

  public getStorage(): OnboardStorage {
    return this.storage;
  }

  public getCommandQueue(): CommandQueue {
    return this.commandQueue;
  }

  public getTelemetryQueue(): TelemetryQueue {
    return this.telemetryQueue;
  }

  /**
   * Enqueues a typed Ground Receipt Acknowledgement frame to uplink back to AETHON.
   */
  public enqueueGroundReceiptAck(
    packetId: string,
    currentMETSeconds: number,
    distanceMetres: number,
    stationId: string = 'DSN-EARTH',
    uplinkDataRateBps: number = 2000
  ): GroundReceiptAckFrame {
    const id = `gack-${packetId}`;
    const existing = this.groundAckFrames.get(id);
    if (existing) {
      return { ...existing };
    }

    const sizeBytes = 32; // Compact telecommand acknowledgement frame
    const txDurationSeconds = calculateTransmissionDuration(sizeBytes, uplinkDataRateBps);
    const oneWayLightTimeSeconds = calculateOneWayLightTime(distanceMetres);
    const arrivalMETSeconds = currentMETSeconds + txDurationSeconds + oneWayLightTimeSeconds;

    const frame: GroundReceiptAckFrame = {
      id,
      packetId,
      groundStationId: stationId,
      generatedAtMET: currentMETSeconds,
      scheduledTxTimeMET: currentMETSeconds,
      txDurationSeconds,
      oneWayLightTimeSeconds,
      arrivalMETSeconds,
      status: 'QUEUED',
    };

    this.groundAckFrames.set(id, frame);
    return { ...frame };
  }

  /**
   * Updates state of in-transit ground receipt ACK frames and returns newly arrived frames.
   */
  public updateGroundAcks(currentMETSeconds: number): GroundReceiptAckFrame[] {
    const newlyArrived: GroundReceiptAckFrame[] = [];

    for (const frame of this.groundAckFrames.values()) {
      if (frame.status === 'ARRIVED') {
        continue;
      }

      const txEndTime = frame.scheduledTxTimeMET + frame.txDurationSeconds;

      if (currentMETSeconds < frame.scheduledTxTimeMET) {
        frame.status = 'QUEUED';
      } else if (currentMETSeconds < txEndTime) {
        frame.status = 'TRANSMITTING';
      } else if (currentMETSeconds < frame.arrivalMETSeconds) {
        frame.status = 'IN_TRANSIT';
      } else {
        frame.status = 'ARRIVED';
        newlyArrived.push({ ...frame });
      }
    }

    return newlyArrived;
  }

  public getArrivedGroundAcks(currentMETSeconds: number): GroundReceiptAckFrame[] {
    this.updateGroundAcks(currentMETSeconds);
    return Array.from(this.groundAckFrames.values())
      .filter((f) => f.status === 'ARRIVED')
      .map((f) => ({ ...f }));
  }

  public getGroundAckFrame(id: string): GroundReceiptAckFrame | undefined {
    const f = this.groundAckFrames.get(id);
    return f ? { ...f } : undefined;
  }

  public getAllGroundAckFrames(): GroundReceiptAckFrame[] {
    return Array.from(this.groundAckFrames.values()).map((f) => ({ ...f }));
  }

  public getGroundStations(): GroundStation[] {
    return Array.from(this.groundStations.values()).map((s) => ({ ...s }));
  }

  public getGroundStation(id: string): GroundStation | undefined {
    const s = this.groundStations.get(id);
    return s ? { ...s } : undefined;
  }

  public registerGroundStation(station: GroundStation): void {
    this.groundStations.set(station.id, station);
  }

  /**
   * Attaches a MissionEventEngine instance to automatically schedule and receive
   * communication milestone events.
   */
  public attachEventEngine(engine: MissionEventEngine): void {
    this.eventEngine = engine;
  }

  /**
   * Evaluates active ground station visibility to the spacecraft pointing target.
   */
  public evaluateVisibility(target: SpacecraftPointingTarget, currentMETSeconds: number) {
    const stations = Array.from(this.groundStations.values());
    return findVisibleGroundStations(stations, target, currentMETSeconds);
  }

  /**
   * Computes an RF link budget for a specific ground station and spacecraft transceiver.
   */
  public calculateDownlinkBudget(
    stationId: string,
    spacecraft: SpacecraftCommConfig,
    distanceMetres: number,
    carrierFrequencyHz: number = FREQUENCY_X_BAND_DOWNLINK_HZ,
    dataRateBps?: number
  ): LinkBudgetResult {
    const station = this.groundStations.get(stationId);
    if (!station) {
      throw new Error(`CommunicationManager.calculateDownlinkBudget: Unknown station ID '${stationId}'.`);
    }

    return calculateLinkBudget({
      transmitPowerWatts: spacecraft.transmitPowerWatts,
      transmitAntennaGainDbi: spacecraft.antennaGainDbi,
      transmitAntennaDiameterMetres: spacecraft.antennaDiameterMetres,
      receiveAntennaDiameterMetres: station.antennaDiameterMetres,
      carrierFrequencyHz,
      distanceMetres,
      systemNoiseTempKelvin: station.systemNoiseTempKelvin,
      dataRateBps,
    });
  }

  /**
   * Advances communications during a simulation time step:
   * 1. Evaluates ground station visibility.
   * 2. Emits COMM_WINDOW_OPEN / COMM_WINDOW_CLOSE events when visibility changes.
   * 3. Updates command queue status and executes arrived commands.
   * 4. Downlinks queued telemetry over active link if window and link budget permit.
   * 5. Checks Earth arrivals of previously transmitted telemetry and purges acknowledged storage.
   */
  public processStep(
    durationSeconds: number,
    currentMETSeconds: number,
    target: SpacecraftPointingTarget,
    spacecraft: SpacecraftCommConfig,
    carrierFrequencyHz: number = FREQUENCY_X_BAND_DOWNLINK_HZ
  ): CommStepReport {
    const visibleStations = this.evaluateVisibility(target, currentMETSeconds);
    const activeStationIds = visibleStations.map((v) => v.stationId);
    const bestStationId = activeStationIds.length > 0 ? activeStationIds[0] : undefined;

    // Window Transition Events
    if (bestStationId !== this.activeStationId) {
      if (this.activeStationId) {
        // Previous station window closed
        if (this.eventEngine) {
          this.eventEngine.scheduleEvent({
            id: `evt-comm-close-${this.activeStationId}-${currentMETSeconds}`,
            type: COMM_EVENT_TYPES.WINDOW_CLOSE,
            scheduledTimeSeconds: currentMETSeconds,
            payload: { previousStationId: this.activeStationId },
          });
        }
      }
      if (bestStationId) {
        // New station window opened
        if (this.eventEngine) {
          this.eventEngine.scheduleEvent({
            id: `evt-comm-open-${bestStationId}-${currentMETSeconds}`,
            type: COMM_EVENT_TYPES.WINDOW_OPEN,
            scheduledTimeSeconds: currentMETSeconds,
            payload: { stationId: bestStationId, visibleStations: activeStationIds },
          });
        }
      }
      this.activeStationId = bestStationId;
    }

    // 1. Process Uplink Commands
    this.commandQueue.updateStatus(currentMETSeconds);
    const arrivedCommands = this.commandQueue.getArrivedCommands(currentMETSeconds);

    let commandsExecuted = 0;
    for (const cmd of arrivedCommands) {
      if (this.eventEngine) {
        this.eventEngine.scheduleEvent({
          id: `evt-cmd-arr-${cmd.id}`,
          type: COMM_EVENT_TYPES.UPLINK_ARRIVED,
          scheduledTimeSeconds: currentMETSeconds,
          payload: { commandId: cmd.id, type: cmd.type, payload: cmd.payload },
        });
      }
      if (this.autoExecuteCommands) {
        this.commandQueue.markExecuted(cmd.id, { executedAtMET: currentMETSeconds });
        commandsExecuted++;
      }
    }

    // 2. Process Downlink Telemetry
    let telemetryBytesTransferred = 0;
    let activeDownlinkPacketId: string | undefined;
    let isDownlinkActive = false;

    if (bestStationId && durationSeconds > 0) {
      // Calculate available downlink data rate
      const link = this.calculateDownlinkBudget(
        bestStationId,
        spacecraft,
        target.distanceMetres,
        carrierFrequencyHz
      );

      if (link.isFeasible && link.maxAchievableDataRateBps > 0) {
        const effectiveDataRateBps = Math.min(link.maxAchievableDataRateBps, 100_000); // capped at transponder mode
        let timeRemainingSeconds = durationSeconds;

        while (timeRemainingSeconds > 0) {
          const nextPacket = this.telemetryQueue.getNextPacket();
          if (!nextPacket) {
            break;
          }

          activeDownlinkPacketId = nextPacket.id;
          isDownlinkActive = true;

          const stepRes = this.telemetryQueue.transmitStep(
            nextPacket.id,
            timeRemainingSeconds,
            effectiveDataRateBps,
            target.distanceMetres,
            currentMETSeconds
          );

          telemetryBytesTransferred += stepRes.bytesTransferred;
          timeRemainingSeconds -= stepRes.durationUsedSeconds;

          if (stepRes.isComplete) {
            this.storage.setPacketState(nextPacket.id, 'TRANSMITTED');
            if (this.eventEngine) {
              this.eventEngine.scheduleEvent({
                id: `evt-downlink-started-${nextPacket.id}`,
                type: COMM_EVENT_TYPES.DOWNLINK_STARTED,
                scheduledTimeSeconds: currentMETSeconds,
                payload: { packetId: nextPacket.id, bytes: nextPacket.sizeBytes },
              });
            }
          } else {
            // Interrupted / partially transmitted
            break;
          }
        }
      }
    }

    // 3. Process Earth Arrivals of Downlink Data
    const newlyReceivedPackets = this.telemetryQueue.updateArrivals(currentMETSeconds);
    for (const p of newlyReceivedPackets) {
      this.telemetryQueue.acknowledgePacket(p.id);
      this.storage.setPacketState(p.id, 'ACKNOWLEDGED');

      if (this.eventEngine) {
        this.eventEngine.scheduleEvent({
          id: `evt-downlink-rx-${p.id}`,
          type: COMM_EVENT_TYPES.DOWNLINK_DATA_RECEIVED,
          scheduledTimeSeconds: currentMETSeconds,
          payload: { packetId: p.id, category: p.category, sizeBytes: p.sizeBytes },
        });
      }

      if (this.autoGenerateGroundAcks) {
        this.enqueueGroundReceiptAck(
          p.id,
          currentMETSeconds,
          target.distanceMetres,
          bestStationId || 'DSN-EARTH'
        );
      }
    }

    // 4. Update status of return ground ACK frames in transit
    this.updateGroundAcks(currentMETSeconds);

    return {
      metSeconds: currentMETSeconds,
      activeStationIds,
      commandsTransmitted: 0,
      commandsArrived: arrivedCommands.length,
      commandsExecuted,
      telemetryBytesTransferred,
      activeDownlinkPacketId,
      isDownlinkActive,
    };
  }
}
