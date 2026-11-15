import { describe, it, expect } from 'vitest';
import {
  calculateTransmissionDuration,
  simulateTransmissionStep,
} from '../src/simulation/communications/dataTransmission';
import {
  OnboardStorage,
  CapacityExceededError,
} from '../src/simulation/communications/onboardStorage';

describe('Data Transmission & Onboard Storage Models', () => {
  describe('Transmission Duration & Time-Stepped Transfer', () => {
    it('calculates transmission duration in seconds from bytes and bit rate', () => {
      // 10,000 bytes = 80,000 bits
      // At 10,000 bps -> 8.0 seconds
      expect(calculateTransmissionDuration(10_000, 10_000)).toBe(8.0);

      // At 1,000 bps -> 80.0 seconds
      expect(calculateTransmissionDuration(10_000, 1_000)).toBe(80.0);

      // 0 bytes -> 0 seconds
      expect(calculateTransmissionDuration(0, 50_000)).toBe(0);
    });

    it('rejects invalid transmission duration arguments', () => {
      expect(() => calculateTransmissionDuration(-10, 1000)).toThrow(RangeError);
      expect(() => calculateTransmissionDuration(100, 0)).toThrow(RangeError);
      expect(() => calculateTransmissionDuration(100, -500)).toThrow(RangeError);
    });

    it('simulates complete transfer within available window duration', () => {
      // 5000 bytes (40,000 bits) at 10,000 bps takes 4.0 seconds.
      // Available window: 10.0 seconds
      const res = simulateTransmissionStep(5000, 10.0, 10_000);

      expect(res.bytesTransferred).toBe(5000);
      expect(res.remainingBytes).toBe(0);
      expect(res.isComplete).toBe(true);
      expect(res.wasInterrupted).toBe(false);
      expect(res.durationUsedSeconds).toBe(4.0);
    });

    it('simulates partial transfer and flags interruption when window duration is insufficient', () => {
      // 10,000 bytes (80,000 bits) at 10,000 bps needs 8.0 seconds.
      // Available window: only 3.0 seconds -> capacity = (3.0 * 10,000) / 8 = 3,750 bytes
      const res = simulateTransmissionStep(10_000, 3.0, 10_000);

      expect(res.bytesTransferred).toBe(3750);
      expect(res.remainingBytes).toBe(6250);
      expect(res.isComplete).toBe(false);
      expect(res.wasInterrupted).toBe(true);
      expect(res.durationUsedSeconds).toBe(3.0);
    });
  });

  describe('Onboard Solid-State Mass Storage (SSMR)', () => {
    it('initializes with specified capacity and empty memory partitions', () => {
      const storage = new OnboardStorage(1_000_000); // 1 MB

      expect(storage.getTotalCapacityBytes()).toBe(1_000_000);
      expect(storage.getUsedStorageBytes()).toBe(0);
      expect(storage.getAvailableStorageBytes()).toBe(1_000_000);

      const state = storage.getStorageState();
      expect(state.packetCount).toBe(0);
      expect(state.categoryBreakdownBytes.engineering).toBe(0);
      expect(state.categoryBreakdownBytes.science).toBe(0);
      expect(state.categoryBreakdownBytes.critical).toBe(0);
    });

    it('stores packets across categories and tracks memory usage accurately', () => {
      const storage = new OnboardStorage(100_000); // 100 kB

      storage.storeData({
        id: 'telemetry-bus-1',
        category: 'engineering',
        sizeBytes: 15_000,
        priority: 50,
      });

      storage.storeData({
        id: 'science-spectrometer-1',
        category: 'science',
        sizeBytes: 40_000,
        priority: 150,
      });

      storage.storeData({
        id: 'critical-fault-log',
        category: 'critical',
        sizeBytes: 5_000,
        priority: 300,
      });

      expect(storage.getUsedStorageBytes()).toBe(60_000);
      expect(storage.getAvailableStorageBytes()).toBe(40_000);

      const state = storage.getStorageState();
      expect(state.packetCount).toBe(3);
      expect(state.categoryBreakdownBytes.engineering).toBe(15_000);
      expect(state.categoryBreakdownBytes.science).toBe(40_000);
      expect(state.categoryBreakdownBytes.critical).toBe(5_000);
    });

    it('strictly prevents storage overflow and throws CapacityExceededError without silently dropping data', () => {
      const storage = new OnboardStorage(50_000); // 50 kB total

      storage.storeData({
        id: 'packet-1',
        category: 'science',
        sizeBytes: 30_000,
      });

      // Attempting to write 25 kB when only 20 kB remains
      expect(() =>
        storage.storeData({
          id: 'packet-2-overflow',
          category: 'science',
          sizeBytes: 25_000,
        })
      ).toThrow(CapacityExceededError);

      // Verify packet-1 was NOT corrupted or dropped
      expect(storage.getUsedStorageBytes()).toBe(30_000);
      expect(storage.getPacket('packet-1')).toBeDefined();
      expect(storage.getPacket('packet-2-overflow')).toBeUndefined();
    });

    it('rejects duplicate packet IDs to prevent double counting', () => {
      const storage = new OnboardStorage(100_000);

      storage.storeData({
        id: 'duplicate-id',
        category: 'engineering',
        sizeBytes: 10_000,
      });

      expect(() =>
        storage.storeData({
          id: 'duplicate-id',
          category: 'engineering',
          sizeBytes: 10_000,
        })
      ).toThrow(/Duplicate packet ID/);
    });

    it('supports packet state updates and safe deletion', () => {
      const storage = new OnboardStorage(100_000);

      storage.storeData({
        id: 'p1',
        category: 'science',
        sizeBytes: 20_000,
      });

      expect(storage.getPacket('p1')?.state).toBe('STORED');

      expect(storage.setPacketState('p1', 'TRANSMITTING')).toBe(true);
      expect(storage.getPacket('p1')?.state).toBe('TRANSMITTING');

      expect(storage.setPacketState('p1', 'ACKNOWLEDGED')).toBe(true);
      expect(storage.getPacket('p1')?.state).toBe('ACKNOWLEDGED');

      // Deleting packet frees storage
      expect(storage.deletePacket('p1')).toBe(true);
      expect(storage.getUsedStorageBytes()).toBe(0);
      expect(storage.getAvailableStorageBytes()).toBe(100_000);
    });
  });
});
