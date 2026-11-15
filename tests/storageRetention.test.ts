import { describe, it, expect } from 'vitest';
import { StorageRetentionManager } from '../src/simulation/flightSoftware/storageRetention';
import { OnboardStorage } from '../src/simulation/communications/onboardStorage';

describe('Flight Software — Storage Retention Lifecycle Manager', () => {
  it('tracks packets through the complete 9-phase retention lifecycle', () => {
    const manager = new StorageRetentionManager();

    // 1. STORED
    const rec = manager.trackPacket('packet-science-01', 'science', 10_000, 100);
    expect(rec.state).toBe('STORED');
    expect(rec.createdAtMET).toBe(100);

    // 2. QUEUED
    manager.recordQueued('packet-science-01');
    expect(manager.getRecord('packet-science-01')?.state).toBe('QUEUED');

    // 3. TRANSMITTING
    manager.recordTransmitting('packet-science-01');
    expect(manager.getRecord('packet-science-01')?.state).toBe('TRANSMITTING');

    // 4. TRANSMITTED
    manager.recordTransmissionCompleted('packet-science-01', 250);
    expect(manager.getRecord('packet-science-01')?.state).toBe('TRANSMITTED');
    expect(manager.getRecord('packet-science-01')?.transmittedAtMET).toBe(250);

    // 5. RECEIVED_EARTH
    manager.recordEarthReceipt('packet-science-01', 750);
    expect(manager.getRecord('packet-science-01')?.state).toBe('RECEIVED_EARTH');

    // 6. EARTH_ACK_GENERATED
    manager.recordEarthAckGenerated('packet-science-01', 760);
    expect(manager.getRecord('packet-science-01')?.state).toBe('EARTH_ACK_GENERATED');

    // 7. ACK_RECEIVED_AETHON
    manager.recordAethonAckReceived('packet-science-01', 1260);
    expect(manager.getRecord('packet-science-01')?.state).toBe('ACK_RECEIVED_AETHON');

    // 8. ELIGIBLE_FOR_PURGE
    const newlyEligible = manager.evaluatePurgeEligibility(1260);
    expect(newlyEligible).toHaveLength(1);
    expect(newlyEligible[0].packetId).toBe('packet-science-01');
    expect(manager.getRecord('packet-science-01')?.state).toBe('ELIGIBLE_FOR_PURGE');
  });

  it('never marks packets eligible for purge without AETHON acknowledgement when requireAethonAckToPurge is true', () => {
    const manager = new StorageRetentionManager({
      requireAethonAckToPurge: true,
    });

    manager.trackPacket('pkt-1', 'science', 5000, 0);
    manager.recordTransmissionCompleted('pkt-1', 10);
    manager.recordEarthReceipt('pkt-1', 500); // Earth got it, but AETHON does not know yet!

    // At MET = 600, packet is still waiting for ACK confirmation on AETHON
    const eligibleAt600 = manager.evaluatePurgeEligibility(600);
    expect(eligibleAt600).toHaveLength(0);
    expect(manager.getRecord('pkt-1')?.state).toBe('RECEIVED_EARTH');

    // Now AETHON confirms reception of ground ACK frame
    manager.recordAethonAckReceived('pkt-1', 1000);

    const eligibleAt1000 = manager.evaluatePurgeEligibility(1000);
    expect(eligibleAt1000).toHaveLength(1);
    expect(eligibleAt1000[0].packetId).toBe('pkt-1');
  });

  it('protects critical category packets from autonomous purging', () => {
    const manager = new StorageRetentionManager({
      protectCriticalData: true,
      requireAethonAckToPurge: false,
    });

    manager.trackPacket('crit-ack-pkt', 'critical', 64, 0);
    manager.recordEarthReceipt('crit-ack-pkt', 100);

    // Critical packets are never made eligible automatically
    const eligible = manager.evaluatePurgeEligibility(500);
    expect(eligible).toHaveLength(0);
    expect(manager.getRecord('crit-ack-pkt')?.state).toBe('RECEIVED_EARTH');

    // Can only be made eligible explicitly
    manager.markEligibleForPurge('crit-ack-pkt', 600, 'Ground command authorized critical memory wipe');
    expect(manager.getRecord('crit-ack-pkt')?.state).toBe('ELIGIBLE_FOR_PURGE');
  });

  it('purges eligible packets from OnboardStorage and accurately reports freed memory', () => {
    const storage = new OnboardStorage(1_000_000);
    const retention = new StorageRetentionManager({ requireAethonAckToPurge: false });

    storage.storeData({ id: 'p1', category: 'science', sizeBytes: 200_000, priority: 100 });
    storage.storeData({ id: 'p2', category: 'science', sizeBytes: 300_000, priority: 100 });

    retention.trackPacket('p1', 'science', 200_000, 0);
    retention.trackPacket('p2', 'science', 300_000, 0);

    expect(storage.getUsedStorageBytes()).toBe(500_000);

    // p1 received at Earth, p2 still transmitting
    retention.recordEarthReceipt('p1', 50);

    retention.evaluatePurgeEligibility(50);
    expect(retention.getRecord('p1')?.state).toBe('ELIGIBLE_FOR_PURGE');
    expect(retention.getRecord('p2')?.state).toBe('STORED');

    // Execute purge
    const report = retention.purgeEligiblePackets(storage, 100);
    expect(report.purgedCount).toBe(1);
    expect(report.freedBytes).toBe(200_000);
    expect(report.purgedPacketIds).toContain('p1');

    // Storage memory reflects purge
    expect(storage.getUsedStorageBytes()).toBe(300_000);
    expect(storage.getPacket('p1')).toBeUndefined();
    expect(storage.getPacket('p2')).toBeDefined();

    // Retention record marked DELETED
    expect(retention.getRecord('p1')?.state).toBe('DELETED');
    expect(retention.getRecord('p1')?.deletedAtMET).toBe(100);
  });
});

