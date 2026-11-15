import { describe, it, expect } from 'vitest';
import { CommandQueue } from '../src/simulation/communications/commandQueue';
import { TelemetryQueue } from '../src/simulation/communications/telemetryQueue';
import { SPEED_OF_LIGHT, ASTRONOMICAL_UNIT_METRES } from '../src/simulation/constants';

describe('Command Uplink & Telemetry Downlink Queues', () => {
  describe('Command Uplink Queue & Arrival Gating', () => {
    it('schedules commands and strictly enforces arrival timing gate before execution', () => {
      const queue = new CommandQueue();

      // Slant distance: 1 AU (~499 s OWLT)
      const distance = ASTRONOMICAL_UNIT_METRES;
      const expectedOwlt = distance / SPEED_OF_LIGHT; // 499.005 s

      // Command: 100 bytes at 1000 bps -> 0.8 s transmission duration
      // Scheduled to transmit at Earth MET = 1000 s
      const cmd = queue.enqueueCommand({
        id: 'cmd-tcm-1',
        type: 'COURSE_CORRECTION_BURN',
        payload: { deltaV: 14.2 },
        priority: 200,
        sizeBytes: 100,
        scheduledTxTimeMET: 1000,
        uplinkDataRateBps: 1000,
        distanceMetres: distance,
      });

      expect(cmd.txDurationSeconds).toBeCloseTo(0.8, 4);
      expect(cmd.oneWayLightTimeSeconds).toBeCloseTo(expectedOwlt, 3);

      const expectedArrival = 1000 + 0.8 + expectedOwlt;
      expect(cmd.arrivalMETSeconds).toBeCloseTo(expectedArrival, 3);

      // 1. Before transmission starts (t = 500 s): status is QUEUED, not arrived
      queue.updateStatus(500);
      expect(queue.getCommand('cmd-tcm-1')?.status).toBe('QUEUED');
      expect(queue.getArrivedCommands(500)).toHaveLength(0);

      // 2. During Earth transmission (t = 1000.4 s): status is TRANSMITTING
      queue.updateStatus(1000.4);
      expect(queue.getCommand('cmd-tcm-1')?.status).toBe('TRANSMITTING');
      expect(queue.getArrivedCommands(1000.4)).toHaveLength(0);

      // 3. After transmission ends, in transit across interplanetary space (t = 1200 s): status is IN_TRANSIT
      queue.updateStatus(1200);
      expect(queue.getCommand('cmd-tcm-1')?.status).toBe('IN_TRANSIT');
      expect(queue.getArrivedCommands(1200)).toHaveLength(0);

      // 4. Just before arrival (t = expectedArrival - 1 s): still IN_TRANSIT, CANNOT execute
      queue.updateStatus(expectedArrival - 1);
      expect(queue.getCommand('cmd-tcm-1')?.status).toBe('IN_TRANSIT');
      expect(queue.getArrivedCommands(expectedArrival - 1)).toHaveLength(0);

      // 5. At or after arrival timestamp (t = expectedArrival + 10 s): status is ARRIVED!
      const arrivedList = queue.getArrivedCommands(expectedArrival + 10);
      expect(arrivedList).toHaveLength(1);
      expect(arrivedList[0].id).toBe('cmd-tcm-1');
      expect(arrivedList[0].status).toBe('ARRIVED');

      // 6. Execute command on AETHON
      expect(queue.markExecuted('cmd-tcm-1', { engineBurnCompleted: true })).toBe(true);
      expect(queue.getCommand('cmd-tcm-1')?.status).toBe('EXECUTED');

      // Executed commands no longer appear in getArrivedCommands
      expect(queue.getArrivedCommands(expectedArrival + 100)).toHaveLength(0);
    });

    it('orders arrived commands by priority descending', () => {
      const queue = new CommandQueue();

      queue.enqueueCommand({
        id: 'low-prio',
        type: 'ROUTINE_LOG',
        payload: null,
        priority: 50,
        scheduledTxTimeMET: 0,
        uplinkDataRateBps: 10_000,
        distanceMetres: 1000,
      });

      queue.enqueueCommand({
        id: 'crit-prio',
        type: 'EMERGENCY_SAFE_MODE',
        payload: null,
        priority: 500,
        scheduledTxTimeMET: 0,
        uplinkDataRateBps: 10_000,
        distanceMetres: 1000,
      });

      queue.enqueueCommand({
        id: 'med-prio',
        type: 'SCIENCE_CALIBRATION',
        payload: null,
        priority: 150,
        scheduledTxTimeMET: 0,
        uplinkDataRateBps: 10_000,
        distanceMetres: 1000,
      });

      const arrived = queue.getArrivedCommands(100);
      expect(arrived).toHaveLength(3);
      expect(arrived[0].id).toBe('crit-prio');
      expect(arrived[1].id).toBe('med-prio');
      expect(arrived[2].id).toBe('low-prio');
    });

    it('rejects duplicate command IDs', () => {
      const queue = new CommandQueue();
      queue.enqueueCommand({
        id: 'unique-cmd',
        type: 'TEST',
        payload: null,
        scheduledTxTimeMET: 0,
        uplinkDataRateBps: 1000,
        distanceMetres: 1000,
      });

      expect(() =>
        queue.enqueueCommand({
          id: 'unique-cmd',
          type: 'TEST',
          payload: null,
          scheduledTxTimeMET: 0,
          uplinkDataRateBps: 1000,
          distanceMetres: 1000,
        })
      ).toThrow(/Duplicate command ID/);
    });
  });

  describe('Telemetry Downlink Queue & Partial Transmission', () => {
    it('dispatches packets by priority descending with FIFO sequence tie-breaking', () => {
      const queue = new TelemetryQueue();

      queue.enqueue({ id: 'eng-1', category: 'engineering', payload: null, sizeBytes: 1000, priority: 50 });
      queue.enqueue({ id: 'crit-1', category: 'critical', payload: null, sizeBytes: 500, priority: 200 });
      queue.enqueue({ id: 'sci-1', category: 'science', payload: null, sizeBytes: 5000, priority: 100 });
      queue.enqueue({ id: 'sci-2', category: 'science', payload: null, sizeBytes: 2000, priority: 100 }); // Same priority as sci-1

      // 1. Critical first (priority 200)
      const next1 = queue.getNextPacket();
      expect(next1?.id).toBe('crit-1');
    });

    it('handles partial transmission, interruption across windows, and resumption', () => {
      const queue = new TelemetryQueue();

      // 10,000 bytes at 10,000 bps takes 8.0 s
      queue.enqueue({
        id: 'large-science-frame',
        category: 'science',
        payload: { image: 'europa_surface.raw' },
        sizeBytes: 10_000,
        priority: 100,
      });

      // Pass 1: Active window lasts only 4.0 seconds -> transfers 5,000 bytes (half)
      const step1 = queue.transmitStep('large-science-frame', 4.0, 10_000, 1e9, 1000);
      expect(step1.bytesTransferred).toBe(5000);
      expect(step1.remainingBytes).toBe(5000);
      expect(step1.isComplete).toBe(false);
      expect(step1.wasInterrupted).toBe(true);

      const packetAfterStep1 = queue.getPacket('large-science-frame');
      expect(packetAfterStep1?.transmittedBytes).toBe(5000);
      expect(packetAfterStep1?.status).toBe('INTERRUPTED');

      // Interrupted packet is still eligible for next transmission pass
      expect(queue.getNextPacket()?.id).toBe('large-science-frame');

      // Pass 2: Next window opens -> transfers remaining 5,000 bytes in 4.0 seconds
      const step2 = queue.transmitStep('large-science-frame', 10.0, 10_000, 1e9, 2000);
      expect(step2.bytesTransferred).toBe(5000);
      expect(step2.remainingBytes).toBe(0);
      expect(step2.isComplete).toBe(true);

      const packetAfterStep2 = queue.getPacket('large-science-frame');
      expect(packetAfterStep2?.transmittedBytes).toBe(10_000);
      expect(packetAfterStep2?.status).toBe('IN_TRANSIT');
      expect(packetAfterStep2?.earthReceiptTimeMET).toBeDefined();
    });

    it('tracks Earth reception and acknowledgment lifecycle', () => {
      const queue = new TelemetryQueue();

      // Transmit 100 bytes at 10,000 bps at t = 1000 s over 300,000 km (~1.00069 s OWLT)
      queue.enqueue({ id: 'packet-ack-test', category: 'engineering', payload: null, sizeBytes: 100 });

      queue.transmitStep('packet-ack-test', 10.0, 10_000, 300_000_000, 1000);
      const packet = queue.getPacket('packet-ack-test')!;
      expect(packet.status).toBe('IN_TRANSIT');

      const receiptMET = packet.earthReceiptTimeMET!;
      expect(receiptMET).toBeGreaterThan(1000);

      // Before arrival at Earth
      const earlyArrivals = queue.updateArrivals(receiptMET - 0.5);
      expect(earlyArrivals).toHaveLength(0);

      // At Earth receipt timestamp
      const confirmedArrivals = queue.updateArrivals(receiptMET + 0.1);
      expect(confirmedArrivals).toHaveLength(1);
      expect(confirmedArrivals[0].id).toBe('packet-ack-test');
      expect(queue.getPacket('packet-ack-test')?.status).toBe('RECEIVED_EARTH');

      // Ground station sends acknowledgement
      expect(queue.acknowledgePacket('packet-ack-test')).toBe(true);
      expect(queue.getPacket('packet-ack-test')?.status).toBe('ACKNOWLEDGED');
    });
  });
});
