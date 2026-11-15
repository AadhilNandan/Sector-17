/**
 * SECTOR 17 — Flight Software Storage Retention Manager
 * Manages the explicit end-to-end retention lifecycle of onboard data packets.
 *
 * LIFECYCLE PHASES:
 * 1. STORED                 — Generated and recorded in onboard solid-state mass memory.
 * 2. QUEUED                 — Placed in priority telemetry downlink queue.
 * 3. TRANSMITTING           — Currently beaming down over an active DSN ground station pass.
 * 4. TRANSMITTED            — All packet bits downlinked from spacecraft antenna.
 * 5. RECEIVED_EARTH         — Signal reaches Earth station antenna (OWLT passed).
 * 6. EARTH_ACK_GENERATED    — Ground station creates acknowledgement telemetry/uplink frame.
 * 7. ACK_RECEIVED_AETHON    — Ground acknowledgement frame arrives back at AETHON (RTLT passed).
 * 8. ELIGIBLE_FOR_PURGE     — Satisfies retention policy criteria; safe to free memory.
 * 9. DELETED                — Explicitly erased from memory, freeing onboard storage capacity.
 *
 * SAFETY INVARIANT: Packets are NEVER silently or automatically deleted upon transmission completion
 * or Earth receipt. Erasure requires explicit retention policy fulfillment and intentional invocation.
 */

import type { OnboardStorage } from '../communications/onboardStorage';
import type { DataCategory } from '../communications/types';
import type {
  ExtendedPacketState,
  PacketRetentionRecord,
  StorageRetentionPolicy,
  StoragePurgeReport,
} from './types';

const STATE_PRECEDENCE: Record<ExtendedPacketState, number> = {
  STORED: 1,
  QUEUED: 2,
  TRANSMITTING: 3,
  TRANSMITTED: 4,
  RECEIVED_EARTH: 5,
  EARTH_ACK_GENERATED: 6,
  ACK_RECEIVED_AETHON: 7,
  ELIGIBLE_FOR_PURGE: 8,
  DELETED: 9,
};

export class StorageRetentionManager {
  private records: Map<string, PacketRetentionRecord> = new Map();
  private policy: Required<StorageRetentionPolicy>;

  constructor(policy: StorageRetentionPolicy = {}) {
    this.policy = {
      requireAethonAckToPurge: policy.requireAethonAckToPurge ?? true,
      retentionGracePeriodSeconds: policy.retentionGracePeriodSeconds ?? 0,
      protectCriticalData: policy.protectCriticalData ?? true,
    };
  }

  public getPolicy(): Readonly<Required<StorageRetentionPolicy>> {
    return { ...this.policy };
  }

  public setPolicy(policyUpdate: Partial<StorageRetentionPolicy>): void {
    if (policyUpdate.requireAethonAckToPurge !== undefined) {
      this.policy.requireAethonAckToPurge = policyUpdate.requireAethonAckToPurge;
    }
    if (policyUpdate.retentionGracePeriodSeconds !== undefined) {
      if (typeof policyUpdate.retentionGracePeriodSeconds !== 'number' || policyUpdate.retentionGracePeriodSeconds < 0) {
        throw new RangeError('retentionGracePeriodSeconds must be a non-negative number.');
      }
      this.policy.retentionGracePeriodSeconds = policyUpdate.retentionGracePeriodSeconds;
    }
    if (policyUpdate.protectCriticalData !== undefined) {
      this.policy.protectCriticalData = policyUpdate.protectCriticalData;
    }
  }

  /**
   * Begins tracking retention lifecycle for a stored packet.
   */
  public trackPacket(
    packetId: string,
    category: DataCategory,
    sizeBytes: number,
    createdAtMET: number
  ): PacketRetentionRecord {
    if (!packetId || typeof packetId !== 'string') {
      throw new TypeError('trackPacket: packetId must be a non-empty string.');
    }
    const id = packetId.trim();
    if (this.records.has(id)) {
      throw new Error(`trackPacket: Packet '${id}' is already being tracked.`);
    }

    const record: PacketRetentionRecord = {
      packetId: id,
      category,
      sizeBytes,
      state: 'STORED',
      createdAtMET,
    };

    this.records.set(id, record);
    return { ...record };
  }

  public recordQueued(packetId: string): void {
    const rec = this.records.get(packetId);
    if (!rec || STATE_PRECEDENCE[rec.state] >= STATE_PRECEDENCE['QUEUED']) return;
    rec.state = 'QUEUED';
  }

  public recordTransmitting(packetId: string): void {
    const rec = this.records.get(packetId);
    if (!rec || STATE_PRECEDENCE[rec.state] >= STATE_PRECEDENCE['TRANSMITTING']) return;
    rec.state = 'TRANSMITTING';
  }

  public recordTransmissionCompleted(packetId: string, metSeconds: number): void {
    const rec = this.records.get(packetId);
    if (!rec || STATE_PRECEDENCE[rec.state] >= STATE_PRECEDENCE['TRANSMITTED']) return;
    rec.state = 'TRANSMITTED';
    rec.transmittedAtMET = metSeconds;
  }

  public recordEarthReceipt(packetId: string, metSeconds: number): void {
    const rec = this.records.get(packetId);
    if (!rec || STATE_PRECEDENCE[rec.state] >= STATE_PRECEDENCE['RECEIVED_EARTH']) return;
    rec.state = 'RECEIVED_EARTH';
    rec.receivedEarthAtMET = metSeconds;
  }

  public recordEarthAckGenerated(packetId: string, metSeconds: number): void {
    const rec = this.records.get(packetId);
    if (!rec || STATE_PRECEDENCE[rec.state] >= STATE_PRECEDENCE['EARTH_ACK_GENERATED']) return;
    rec.state = 'EARTH_ACK_GENERATED';
    rec.earthAckGeneratedAtMET = metSeconds;
  }

  public recordAethonAckReceived(packetId: string, metSeconds: number): void {
    const rec = this.records.get(packetId);
    if (!rec || STATE_PRECEDENCE[rec.state] >= STATE_PRECEDENCE['ACK_RECEIVED_AETHON']) return;
    rec.state = 'ACK_RECEIVED_AETHON';
    rec.aethonAckReceivedAtMET = metSeconds;
  }

  /**
   * Manually marks a packet eligible for purge with an explicit justification.
   */
  public markEligibleForPurge(packetId: string, currentMETSeconds: number, reason?: string): boolean {
    const rec = this.records.get(packetId);
    if (!rec || rec.state === 'DELETED') return false;
    rec.state = 'ELIGIBLE_FOR_PURGE';
    rec.eligibleForPurgeAtMET = currentMETSeconds;
    rec.deletionReason = reason || 'Explicitly marked eligible for purge';
    return true;
  }

  /**
   * Evaluates all tracked packets against current retention policy rules,
   * transitioning qualified packets to ELIGIBLE_FOR_PURGE.
   */
  public evaluatePurgeEligibility(currentMETSeconds: number): PacketRetentionRecord[] {
    const newlyEligible: PacketRetentionRecord[] = [];

    for (const rec of this.records.values()) {
      if (rec.state === 'DELETED' || rec.state === 'ELIGIBLE_FOR_PURGE') {
        continue;
      }

      // Check critical data protection
      if (this.policy.protectCriticalData && rec.category === 'critical') {
        continue;
      }

      // Determine readiness based on acknowledgement policy requirement
      let conditionMet = false;
      let eventTime = 0;

      if (this.policy.requireAethonAckToPurge) {
        if (rec.state === 'ACK_RECEIVED_AETHON' && rec.aethonAckReceivedAtMET !== undefined) {
          conditionMet = true;
          eventTime = rec.aethonAckReceivedAtMET;
        }
      } else {
        // Only requires Earth receipt
        if (
          (rec.state === 'RECEIVED_EARTH' ||
            rec.state === 'EARTH_ACK_GENERATED' ||
            rec.state === 'ACK_RECEIVED_AETHON') &&
          rec.receivedEarthAtMET !== undefined
        ) {
          conditionMet = true;
          eventTime = rec.receivedEarthAtMET;
        }
      }

      // Check grace period
      if (conditionMet && currentMETSeconds >= eventTime + this.policy.retentionGracePeriodSeconds) {
        rec.state = 'ELIGIBLE_FOR_PURGE';
        rec.eligibleForPurgeAtMET = currentMETSeconds;
        newlyEligible.push({ ...rec });
      }
    }

    return newlyEligible;
  }

  /**
   * Explicitly purges all packets currently in ELIGIBLE_FOR_PURGE state from OnboardStorage.
   */
  public purgeEligiblePackets(storage: OnboardStorage, currentMETSeconds: number): StoragePurgeReport {
    if (!storage) {
      throw new TypeError('purgeEligiblePackets: storage must be provided.');
    }

    let purgedCount = 0;
    let freedBytes = 0;
    const purgedPacketIds: string[] = [];

    for (const rec of this.records.values()) {
      if (rec.state === 'ELIGIBLE_FOR_PURGE') {
        const deleted = storage.deletePacket(rec.packetId);
        if (deleted) {
          freedBytes += rec.sizeBytes;
        }
        rec.state = 'DELETED';
        rec.deletedAtMET = currentMETSeconds;
        purgedPacketIds.push(rec.packetId);
        purgedCount++;
      }
    }

    return {
      eligibleCount: purgedCount,
      purgedCount,
      freedBytes,
      purgedPacketIds,
    };
  }

  /**
   * Explicitly deletes a specific packet regardless of batch eligibility,
   * provided it exists and is not already deleted.
   */
  public deletePacket(
    packetId: string,
    storage: OnboardStorage,
    currentMETSeconds: number,
    reason: string = 'Manual command deletion'
  ): boolean {
    const rec = this.records.get(packetId);
    if (!rec || rec.state === 'DELETED') {
      return false;
    }

    storage.deletePacket(packetId);
    rec.state = 'DELETED';
    rec.deletedAtMET = currentMETSeconds;
    rec.deletionReason = reason;
    return true;
  }

  public getRecord(packetId: string): PacketRetentionRecord | undefined {
    const rec = this.records.get(packetId);
    return rec ? { ...rec } : undefined;
  }

  public getAllRecords(): PacketRetentionRecord[] {
    return Array.from(this.records.values()).map((r) => ({ ...r }));
  }

  public getPacketsInState(state: ExtendedPacketState): PacketRetentionRecord[] {
    return Array.from(this.records.values())
      .filter((r) => r.state === state)
      .map((r) => ({ ...r }));
  }

  public clear(): void {
    this.records.clear();
  }
}
