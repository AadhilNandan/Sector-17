import { describe, it, expect, vi } from 'vitest';
import { CommunicationManager } from '../src/simulation/communications/communicationManager';
import { MissionEventEngine } from '../src/simulation/operations/missionEventEngine';
import { COMM_EVENT_TYPES } from '../src/simulation/communications/constants';
import type { SpacecraftPointingTarget } from '../src/simulation/communications/types';

describe('Communication System Integration with MissionEventEngine', () => {
  it('schedules and executes typed communication events deterministically through MissionEventEngine', () => {
    const engine = new MissionEventEngine(0, true);
    const commManager = new CommunicationManager();
    commManager.attachEventEngine(engine);

    const receivedEvents: string[] = [];

    // Register handlers for typed communication events
    engine.registerHandler(COMM_EVENT_TYPES.WINDOW_OPEN, (event) => {
      receivedEvents.push(`WINDOW_OPEN: ${(event.payload as any).stationId}`);
    });

    engine.registerHandler(COMM_EVENT_TYPES.WINDOW_CLOSE, (event) => {
      receivedEvents.push(`WINDOW_CLOSE: ${(event.payload as any).previousStationId}`);
    });

    engine.registerHandler(COMM_EVENT_TYPES.UPLINK_ARRIVED, (event) => {
      receivedEvents.push(`COMMAND_ARRIVED: ${(event.payload as any).commandId}`);
    });

    engine.registerHandler(COMM_EVENT_TYPES.DOWNLINK_STARTED, (event) => {
      receivedEvents.push(`DOWNLINK_STARTED: ${(event.payload as any).packetId}`);
    });

    engine.registerHandler(COMM_EVENT_TYPES.DOWNLINK_DATA_RECEIVED, (event) => {
      receivedEvents.push(`DOWNLINK_RECEIVED: ${(event.payload as any).packetId}`);
    });

    // Spacecraft: 20 W transmitter, 3m dish (46.5 dBi)
    const spacecraft = {
      transmitPowerWatts: 20.0,
      antennaGainDbi: 46.5,
    };

    // Store a science observation in onboard storage and queue for downlink
    const storage = commManager.getStorage();
    storage.storeData({
      id: 'science-scan-01',
      category: 'science',
      sizeBytes: 10_000,
      priority: 100,
    });

    commManager.getTelemetryQueue().enqueue({
      id: 'science-scan-01',
      category: 'science',
      payload: { feature: 'Conamara Chaos' },
      sizeBytes: 10_000,
      priority: 100,
    });

    // Subpoint near Goldstone (visible)
    const targetInView: SpacecraftPointingTarget = {
      subSpacecraftLatitudeDeg: 35.4,
      subSpacecraftLongitudeDeg: -116.9,
      distanceMetres: 1e9, // 1,000,000 km (~3.33 s OWLT)
    };

    // Subpoint out of view of all stations
    const targetOutOfView: SpacecraftPointingTarget = {
      subSpacecraftLatitudeDeg: -80.0,
      subSpacecraftLongitudeDeg: 0.0,
      distanceMetres: 1e9,
    };

    // Step 1: Advance simulation from 0 to 100s while in view -> Window opens, telemetry starts beaming
    commManager.processStep(100, 100, targetInView, spacecraft);
    engine.advanceAndProcess(100);

    expect(receivedEvents).toContain('WINDOW_OPEN: DSN-GOLDSTONE-70M');
    expect(receivedEvents).toContain('DOWNLINK_STARTED: science-scan-01');

    // Step 2: Advance to 200s while out of view -> Window closes
    commManager.processStep(100, 200, targetOutOfView, spacecraft);
    engine.advanceAndProcess(100);

    expect(receivedEvents).toContain('WINDOW_CLOSE: DSN-GOLDSTONE-70M');

    // Step 3: Advance further -> Downlink data arrived at Earth
    commManager.processStep(100, 300, targetOutOfView, spacecraft);
    engine.advanceAndProcess(100);

    expect(receivedEvents).toContain('DOWNLINK_RECEIVED: science-scan-01');
    expect(storage.getPacket('science-scan-01')?.state).toBe('ACKNOWLEDGED');
  });

  it('contains communication event handler errors without corrupting the event engine', () => {
    const engine = new MissionEventEngine(0, true);
    const commManager = new CommunicationManager();
    commManager.attachEventEngine(engine);

    // Failing handler
    engine.registerHandler(COMM_EVENT_TYPES.WINDOW_OPEN, () => {
      throw new Error('Ground terminal telemetry interface socket dropped!');
    });

    const target: SpacecraftPointingTarget = {
      subSpacecraftLatitudeDeg: 35.4,
      subSpacecraftLongitudeDeg: -116.9,
      distanceMetres: 1e9,
    };

    commManager.processStep(100, 100, target, { transmitPowerWatts: 20, antennaGainDbi: 46.5 });
    const report = engine.advanceAndProcess(100);

    expect(report.failedEvents).toHaveLength(1);
    expect(report.failedEvents[0].error).toContain('Ground terminal telemetry interface socket dropped!');
    expect(engine.isAdvanceLocked()).toBe(false);
  });

  it('preserves re-entrancy protection when communication handlers attempt recursive time steps', () => {
    const engine = new MissionEventEngine(0, true);
    let errorCaught: Error | null = null;

    engine.registerHandler(COMM_EVENT_TYPES.WINDOW_OPEN, () => {
      try {
        engine.advanceAndProcess(100);
      } catch (err) {
        errorCaught = err as Error;
        throw err;
      }
    });

    engine.scheduleEvent({
      id: 'comm-evt',
      type: COMM_EVENT_TYPES.WINDOW_OPEN,
      scheduledTimeSeconds: 50,
      payload: { stationId: 'DSN-GOLDSTONE-70M' },
    });

    const report = engine.advanceAndProcess(100);

    expect(errorCaught).not.toBeNull();
    expect(errorCaught?.message).toContain('Re-entrant time advancement call detected');
    expect(report.failedEvents).toHaveLength(1);
    expect(engine.isAdvanceLocked()).toBe(false);
  });
});
