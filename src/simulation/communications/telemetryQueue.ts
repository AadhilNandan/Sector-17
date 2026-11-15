/**
 * SECTOR 17 — Telemetry & Science Downlink Queue
 * Manages spacecraft-to-Earth telemetry and scientific observation queues,
 * priority sorting, packet serialization, partial window transfers, and Earth reception timing.
 */

import { calculateOneWayLightTime } from './signalPropagation';
import { simulateTransmissionStep } from './dataTransmission';
import type { TelemetryPacket, DataCategory, TransmissionStepResult } from './types';

export interface TelemetryEnqueueInput<T = unknown> {
  id: string;
  category: DataCategory;
  payload: T;
  sizeBytes: number;
  priority?: number;
}

export class TelemetryQueue {
  private queue: Map<string, TelemetryPacket> = new Map();
  private sequenceCounter: number = 0;
  private sequenceMap: Map<string, number> = new Map();

  /**
   * Enqueues a telemetry or science data packet for Earth downlink.
   */
  public enqueue<T = unknown>(input: TelemetryEnqueueInput<T>): TelemetryPacket<T> {
    if (!input || typeof input !== 'object') {
      throw new TypeError('TelemetryQueue.enqueue: Input must be an object.');
    }
    if (!input.id || typeof input.id !== 'string' || input.id.trim().length === 0) {
      throw new TypeError('TelemetryQueue.enqueue: Packet ID must be a non-empty string.');
    }
    const id = input.id.trim();
    if (this.queue.has(id)) {
      throw new Error(`TelemetryQueue.enqueue: Duplicate packet ID '${id}'.`);
    }

    const validCategories: DataCategory[] = ['engineering', 'science', 'critical'];
    if (!validCategories.includes(input.category)) {
      throw new TypeError(`TelemetryQueue.enqueue: Invalid category '${input.category}'.`);
    }

    if (typeof input.sizeBytes !== 'number' || !Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
      throw new RangeError(`TelemetryQueue.enqueue: sizeBytes must be a positive finite number. Received: ${input.sizeBytes}`);
    }

    const priority = input.priority !== undefined ? input.priority : 100;

    this.sequenceCounter++;
    this.sequenceMap.set(id, this.sequenceCounter);

    const packet: TelemetryPacket<T> = {
      id,
      category: input.category,
      payload: input.payload,
      priority,
      sizeBytes: input.sizeBytes,
      transmittedBytes: 0,
      status: 'QUEUED',
    };

    this.queue.set(id, packet as TelemetryPacket);
    return { ...packet };
  }

  /**
   * Returns the next queued or partially transmitted packet to send,
   * sorted by priority descending, then FIFO insertion sequence.
   */
  public getNextPacket(): TelemetryPacket | undefined {
    const eligible: Array<{ packet: TelemetryPacket; seq: number }> = [];

    for (const [id, packet] of this.queue.entries()) {
      if (packet.status === 'QUEUED' || packet.status === 'INTERRUPTED') {
        eligible.push({ packet, seq: this.sequenceMap.get(id) || 0 });
      }
    }

    if (eligible.length === 0) {
      return undefined;
    }

    eligible.sort((a, b) => {
      if (a.packet.priority !== b.packet.priority) {
        return b.packet.priority - a.packet.priority; // Higher priority first
      }
      return a.seq - b.seq; // FIFO sequence tie-breaker
    });

    return { ...eligible[0].packet };
  }

  /**
   * Simulates transferring bytes of a packet across an active communication window.
   */
  public transmitStep(
    packetId: string,
    availableDurationSeconds: number,
    effectiveDataRateBps: number,
    distanceMetres: number,
    currentMETSeconds: number
  ): TransmissionStepResult {
    const packet = this.queue.get(packetId);
    if (!packet) {
      throw new Error(`TelemetryQueue.transmitStep: Packet '${packetId}' not found.`);
    }

    const remainingBytes = packet.sizeBytes - packet.transmittedBytes;
    const stepResult = simulateTransmissionStep(remainingBytes, availableDurationSeconds, effectiveDataRateBps);

    packet.transmittedBytes += stepResult.bytesTransferred;

    if (packet.scheduledTxTimeMET === undefined) {
      packet.scheduledTxTimeMET = currentMETSeconds;
    }

    if (stepResult.isComplete) {
      packet.txDurationSeconds = (packet.sizeBytes * 8) / effectiveDataRateBps;
      const owlt = calculateOneWayLightTime(distanceMetres);
      // Earth receipt timestamp is when the final bit reaches Earth
      packet.earthReceiptTimeMET = currentMETSeconds + stepResult.durationUsedSeconds + owlt;
      packet.status = 'IN_TRANSIT';
    } else {
      packet.status = 'INTERRUPTED';
    }

    return stepResult;
  }

  /**
   * Updates Earth arrival state: transitions IN_TRANSIT packets to RECEIVED_EARTH
   * once currentMETSeconds >= earthReceiptTimeMET.
   */
  public updateArrivals(currentMETSeconds: number): TelemetryPacket[] {
    const newlyReceived: TelemetryPacket[] = [];

    for (const packet of this.queue.values()) {
      if (packet.status === 'IN_TRANSIT') {
        if (packet.earthReceiptTimeMET !== undefined && currentMETSeconds >= packet.earthReceiptTimeMET) {
          packet.status = 'RECEIVED_EARTH';
          newlyReceived.push({ ...packet });
        }
      }
    }

    return newlyReceived;
  }

  /**
   * Acknowledges packet receipt by Earth ground station.
   */
  public acknowledgePacket(packetId: string): boolean {
    const packet = this.queue.get(packetId);
    if (!packet) return false;
    if (packet.status !== 'RECEIVED_EARTH') return false;
    packet.status = 'ACKNOWLEDGED';
    return true;
  }

  public hasPacket(packetId: string): boolean {
    return this.queue.has(packetId);
  }

  public getPacket(packetId: string): TelemetryPacket | undefined {
    const p = this.queue.get(packetId);
    return p ? { ...p } : undefined;
  }

  public getAllPackets(): TelemetryPacket[] {
    return Array.from(this.queue.values()).map((p) => ({ ...p }));
  }

  public clear(): void {
    this.queue.clear();
    this.sequenceMap.clear();
    this.sequenceCounter = 0;
  }

  public restorePackets(packets: TelemetryPacket[]): void {
    this.clear();
    for (const p of packets) {
      this.queue.set(p.id, { ...p });
    }
  }
}
