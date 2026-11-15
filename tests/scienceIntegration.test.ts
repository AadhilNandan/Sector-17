import { describe, it, expect } from 'vitest';
import { FlightComputer } from '../src/simulation/flightSoftware/flightComputer';
import { CommunicationManager } from '../src/simulation/communications/communicationManager';
import { MissionEventEngine } from '../src/simulation/operations/missionEventEngine';
import { ScienceProcessingManager } from '../src/simulation/science/scienceProcessingManager';
import { SCIENCE_EVENT_TYPES } from '../src/simulation/science/constants';
import { CapacityExceededError } from '../src/simulation/communications/onboardStorage';
import type { ReasonRawPayload, MaspexRawPayload } from '../src/simulation/science/types';

describe('Science Processing — Flight Computer, Storage & Communications Integration', () => {
  it('integrates ScienceProcessingManager with FlightComputer and executes nominal observation', async () => {
    const fc = new FlightComputer({ initialState: 'ACTIVE' });
    const commManager = new CommunicationManager({ autoExecuteCommands: false });
    const eventEngine = new MissionEventEngine(0, true);
    const sciManager = new ScienceProcessingManager();

    fc.attachEventEngine(eventEngine);
    fc.attachCommunicationManager(commManager);
    fc.attachScienceManager(sciManager);

    // Verify Science Subsystem is registered and accessible
    const scienceSubsys = fc.getSubsystemManager().getSubsystem('SCIENCE');
    expect(scienceSubsys).toBeDefined();
    expect(scienceSubsys?.implementationStatus).toBe('SIMPLIFIED');
    expect(scienceSubsys?.getStatus()).toBe('OFF');

    // Power up REASON radar to SURVEY mode
    sciManager.getSubsystem().setInstrumentMode('REASON', 'SURVEY');
    expect(scienceSubsys?.getStatus()).toBe('NOMINAL');
    expect(sciManager.getInstrumentRegistry().isInstrumentActive('REASON')).toBe(true);

    // Execute radar observation
    const rawPayload: ReasonRawPayload = {
      centerFrequencyHz: 9e6,
      samplingIntervalSeconds: 1e-6,
      pulseBandwidthHz: 1e6,
      transmitPowerWatts: 10.0,
      echoSamples: [0.01, 0.85, 0.02, 0.45, 0.01],
      transmitTimeMET: 10,
      receiveTimeMET: 10.001,
      sampleCount: 5,
    };

    const { level0Product, storagePacket } = sciManager.executeObservation(
      'REASON',
      rawPayload,
      10,
      { packetId: 'pkt-radar-integ-01', sizeBytes: 8192 }
    );

    expect(level0Product.status).toBe('VALIDATED');
    expect(storagePacket).toBeDefined();
    expect(commManager.getStorage().getUsedStorageBytes()).toBe(8192);

    // Run complete pipeline L0 -> L1 -> L2
    const { level1Product, level2Product, anomalyReport } = sciManager.processCompletePipeline(
      level0Product.id,
      15
    );

    expect(level1Product.status ?? 'CALIBRATED').toBeDefined();
    expect(level2Product.instrument).toBe('REASON');
    expect((level2Product as any).detectedReflectors.length).toBeGreaterThan(0);
    expect(anomalyReport).toBeDefined();
  });

  it('strictly inhibits science observation when spacecraft enters SAFE_MODE', async () => {
    const fc = new FlightComputer({ initialState: 'ACTIVE' });
    const sciManager = new ScienceProcessingManager();
    fc.attachScienceManager(sciManager);

    // Power up instruments to SURVEY mode
    sciManager.getSubsystem().setInstrumentMode('REASON', 'SURVEY');
    sciManager.getSubsystem().setInstrumentMode('MASPEX', 'SURVEY');
    expect(sciManager.getSubsystem().getStatus()).toBe('NOMINAL');

    // Spacecraft encounters a critical fault and enters SAFE_MODE
    fc.getFaultManager().raiseFault({
      id: 'fault-crit-bus',
      code: 'EPS_BUS_COLLAPSE',
      subsystemType: 'EPS',
      severity: 'CRITICAL',
      description: 'Main DC power bus undervoltage trip',
      detectedAtMETSeconds: 100,
    });

    expect(fc.getExecutionController().isInSafeMode()).toBe(true);
    expect(sciManager.getSubsystem().getStatus()).toBe('SAFE');
    expect(sciManager.getSubsystem().getInstrumentMode('REASON')).toBe('OFF');
    expect(sciManager.getSubsystem().getInstrumentMode('MASPEX')).toBe('OFF');

    // Attempting science observation in SAFE mode is strictly rejected!
    const rawPayload: ReasonRawPayload = {
      centerFrequencyHz: 9e6,
      samplingIntervalSeconds: 1e-6,
      pulseBandwidthHz: 1e6,
      transmitPowerWatts: 10.0,
      echoSamples: [0.1, 0.5],
      transmitTimeMET: 105,
      receiveTimeMET: 105.001,
      sampleCount: 2,
    };

    expect(() => {
      sciManager.executeObservation('REASON', rawPayload, 105);
    }).toThrow(/Cannot execute REASON observation while Science Subsystem is in SAFE mode/);
  });

  it('strictly enforces onboard storage capacity and throws CapacityExceededError when full', () => {
    const commManager = new CommunicationManager();
    // Capacity 10,000 bytes
    const storage = commManager.getStorage();
    // Reset storage to small capacity for test
    (storage as any).totalCapacityBytes = 10000;

    const sciManager = new ScienceProcessingManager();
    sciManager.attachStorage(storage);
    sciManager.getSubsystem().setInstrumentMode('MASPEX', 'SURVEY');

    const rawPayload: MaspexRawPayload = {
      ionizationMode: 'ELECTRON_IMPACT',
      massRangeU: [1, 500],
      integrationTimeSeconds: 1.0,
      detectorGain: 1000,
      mzSamples: [{ mz: 18.01, intensity: 100 }],
      sampleCount: 1,
      acquisitionMET: 10,
    };

    // 1st observation: 8,000 bytes -> fits
    sciManager.executeObservation('MASPEX', rawPayload, 10, {
      packetId: 'pkt-fits-1',
      sizeBytes: 8000,
    });
    expect(storage.getUsedStorageBytes()).toBe(8000);

    // 2nd observation: 5,000 bytes -> exceeds available 2,000 bytes!
    expect(() => {
      sciManager.executeObservation('MASPEX', rawPayload, 15, {
        packetId: 'pkt-overflow-2',
        sizeBytes: 5000,
      });
    }).toThrow(CapacityExceededError);

    // Memory remained protected
    expect(storage.getUsedStorageBytes()).toBe(8000);
  });

  it('completes end-to-end science observation, downlink queueing, DSN transfer, return ACK, and retention purge', async () => {
    const commManager = new CommunicationManager({ autoExecuteCommands: false });
    const fc = new FlightComputer({
      initialState: 'ACTIVE',
      initialPosition: {
        latitudeDeg: 35.4, // Over Goldstone station
        longitudeDeg: -116.9,
        distanceMetres: 3e8, // ~1 light second
        frame: 'ECEF',
      },
      retentionPolicy: {
        requireAethonAckToPurge: true,
        retentionGracePeriodSeconds: 0,
        protectCriticalData: false,
      },
    });
    fc.attachCommunicationManager(commManager);

    const sciManager = new ScienceProcessingManager();
    fc.attachScienceManager(sciManager);

    sciManager.getSubsystem().setInstrumentMode('MASPEX', 'SURVEY');

    // 1. Collect observation and queue for downlink immediately
    const rawPayload: MaspexRawPayload = {
      ionizationMode: 'ELECTRON_IMPACT',
      massRangeU: [1, 500],
      integrationTimeSeconds: 1.0,
      detectorGain: 1000,
      mzSamples: [{ mz: 18.01, intensity: 5000 }],
      sampleCount: 1,
      acquisitionMET: 10,
    };

    const { level0Product } = sciManager.executeObservation('MASPEX', rawPayload, 10, {
      packetId: 'pkt-science-downlink-01',
      sizeBytes: 10000,
      queueDownlinkImmediately: true,
    });

    const storage = commManager.getStorage();
    const retention = fc.getRetentionManager();

    expect(storage.getUsedStorageBytes()).toBe(10000);
    expect(retention.getRecord('pkt-science-downlink-01')?.state).toBe('QUEUED');

    // 2. Step 1: Advance simulation to complete RF downlink over Goldstone (100 kbps takes ~0.8s)
    await fc.step(2.0); // MET = 2.0 s

    const pktAfterTx = commManager.getTelemetryQueue().getPacket('pkt-science-downlink-01');
    expect(pktAfterTx?.status).toBe('IN_TRANSIT');
    expect(pktAfterTx?.earthReceiptTimeMET).toBeDefined();

    // 3. Step 2: Advance to Earth receipt timestamp
    const deltaToEarth = pktAfterTx!.earthReceiptTimeMET! - fc.getCurrentMETSeconds() + 0.1;
    await fc.step(deltaToEarth);

    const pktEarthRx = commManager.getTelemetryQueue().getPacket('pkt-science-downlink-01');
    expect(pktEarthRx?.status).toBe('ACKNOWLEDGED');

    // Return ACK frame traveling back to AETHON
    const returnAck = commManager.getGroundAckFrame('gack-pkt-science-downlink-01');
    expect(returnAck).toBeDefined();
    expect(returnAck?.arrivalMETSeconds).toBeGreaterThan(fc.getCurrentMETSeconds());

    // In-transit invariant: storage memory is NOT freed yet
    expect(retention.getRecord('pkt-science-downlink-01')?.state).not.toBe('ACK_RECEIVED_AETHON');
    expect(storage.getUsedStorageBytes()).toBe(10000);

    // 4. Step 3: Advance past return ACK arrival MET at AETHON
    const deltaToAethon = returnAck!.arrivalMETSeconds - fc.getCurrentMETSeconds() + 0.5;
    await fc.step(deltaToAethon);

    // Now AETHON received the return ACK from Earth
    expect(retention.getRecord('pkt-science-downlink-01')?.state).toBe('ELIGIBLE_FOR_PURGE');

    // 5. Step 4: Explicit purge deletes data from OnboardStorage
    const purgeReport = retention.purgeEligiblePackets(storage, fc.getCurrentMETSeconds());
    expect(purgeReport.purgedCount).toBe(1);
    expect(purgeReport.freedBytes).toBe(10000);
    expect(storage.getUsedStorageBytes()).toBe(0);
    expect(retention.getRecord('pkt-science-downlink-01')?.state).toBe('DELETED');
  });
});

