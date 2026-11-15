import { describe, it, expect } from 'vitest';
import { ScienceDataRegistry } from '../src/simulation/science/scienceDataRegistry';
import { Level0IngestionEngine } from '../src/simulation/science/level0/level0Ingestion';
import {
  validateReasonRawPayload,
  validateMaspexRawPayload,
  calculateSampleChecksum,
} from '../src/simulation/science/level0/rawDataValidation';
import { MissionEventEngine } from '../src/simulation/operations/missionEventEngine';
import { SCIENCE_EVENT_TYPES } from '../src/simulation/science/constants';
import type { ReasonRawPayload, MaspexRawPayload } from '../src/simulation/science/types';

describe('Science Processing — Level 0 Ingestion & Validation', () => {
  it('validates and ingests nominal REASON raw radar observation packet', () => {
    const registry = new ScienceDataRegistry();
    const engine = new MissionEventEngine(0, true);
    const ingestion = new Level0IngestionEngine(registry, engine);

    const events: string[] = [];
    engine.registerHandler(SCIENCE_EVENT_TYPES.LEVEL0_VALIDATION_COMPLETED, (evt) => {
      events.push((evt.payload as any).packetId);
    });

    const echoSamples = [0.01, 0.02, 0.85, 0.12, 0.03, 0.45, 0.02];
    const checksum = calculateSampleChecksum(echoSamples);

    const rawPayload: ReasonRawPayload = {
      centerFrequencyHz: 9e6,
      samplingIntervalSeconds: 1e-8,
      pulseBandwidthHz: 1e6,
      transmitPowerWatts: 10.0,
      echoSamples,
      transmitTimeMET: 100,
      receiveTimeMET: 100.001,
      sampleCount: echoSamples.length,
      checksum,
    };

    const l0 = ingestion.ingestPacket(
      {
        packetId: 'pkt-radar-001',
        instrument: 'REASON',
        acquisitionMET: 100,
        rawPayload,
      },
      105
    );

    expect(l0.status).toBe('VALIDATED');
    expect(l0.instrument).toBe('REASON');
    expect(l0.packetId).toBe('pkt-radar-001');
    expect(l0.checksumValid).toBe(true);
    expect(l0.rawPayload.sampleCount).toBe(7);

    engine.advanceAndProcess(110);
    expect(events).toContain('pkt-radar-001');
  });

  it('validates and ingests nominal MASPEX mass spectrometry packet', () => {
    const registry = new ScienceDataRegistry();
    const ingestion = new Level0IngestionEngine(registry);

    const mzSamples = [
      { mz: 16.031, intensity: 150 },
      { mz: 18.010, intensity: 8500 },
      { mz: 31.990, intensity: 420 },
      { mz: 43.990, intensity: 980 },
    ];

    const rawPayload: MaspexRawPayload = {
      ionizationMode: 'ELECTRON_IMPACT',
      massRangeU: [1, 500],
      integrationTimeSeconds: 2.0,
      detectorGain: 1000,
      mzSamples,
      sampleCount: mzSamples.length,
      acquisitionMET: 200,
    };

    const l0 = ingestion.ingestPacket(
      {
        packetId: 'pkt-maspex-001',
        instrument: 'MASPEX',
        acquisitionMET: 200,
        rawPayload,
      },
      202
    );

    expect(l0.status).toBe('VALIDATED');
    expect(l0.instrument).toBe('MASPEX');
    expect(l0.rawPayload.mzSamples).toHaveLength(4);
  });

  it('strictly rejects duplicate packet ID ingestion', () => {
    const registry = new ScienceDataRegistry();
    const ingestion = new Level0IngestionEngine(registry);

    const rawPayload: ReasonRawPayload = {
      centerFrequencyHz: 9e6,
      samplingIntervalSeconds: 1e-8,
      pulseBandwidthHz: 1e6,
      transmitPowerWatts: 10.0,
      echoSamples: [0.1, 0.5, 0.1],
      transmitTimeMET: 10,
      receiveTimeMET: 10.001,
      sampleCount: 3,
    };

    ingestion.ingestPacket(
      {
        packetId: 'pkt-dup-test',
        instrument: 'REASON',
        acquisitionMET: 10,
        rawPayload,
      },
      12
    );

    expect(() => {
      ingestion.ingestPacket(
        {
          packetId: 'pkt-dup-test',
          instrument: 'REASON',
          acquisitionMET: 15,
          rawPayload,
        },
        16
      );
    }).toThrow(/Duplicate ingestion/);
  });

  it('rejects malformed raw payloads with explicit validation errors without crashing', () => {
    const registry = new ScienceDataRegistry();
    const ingestion = new Level0IngestionEngine(registry);

    // Negative sampling interval
    const invalidPayload: any = {
      centerFrequencyHz: 9e6,
      samplingIntervalSeconds: -1e-8, // Invalid!
      pulseBandwidthHz: 1e6,
      transmitPowerWatts: 10.0,
      echoSamples: [0.1, 0.2],
      transmitTimeMET: 10,
      receiveTimeMET: 10.001,
      sampleCount: 2,
    };

    const l0 = ingestion.ingestPacket(
      {
        packetId: 'pkt-bad-radar',
        instrument: 'REASON',
        acquisitionMET: 10,
        rawPayload: invalidPayload,
      },
      11
    );

    expect(l0.status).toBe('REJECTED');
    expect(l0.validationError).toBeDefined();
    expect(l0.validationError).toContain('samplingIntervalSeconds');
  });

  it('detects corrupted sample checksum and enters REJECTED status', () => {
    const registry = new ScienceDataRegistry();
    const ingestion = new Level0IngestionEngine(registry);

    const echoSamples = [0.1, 0.8, 0.2];
    const corruptedChecksum = 0x9999; // intentionally wrong

    const rawPayload: ReasonRawPayload = {
      centerFrequencyHz: 9e6,
      samplingIntervalSeconds: 1e-8,
      pulseBandwidthHz: 1e6,
      transmitPowerWatts: 10.0,
      echoSamples,
      transmitTimeMET: 50,
      receiveTimeMET: 50.001,
      sampleCount: 3,
      checksum: corruptedChecksum,
    };

    const l0 = ingestion.ingestPacket(
      {
        packetId: 'pkt-corrupted-checksum',
        instrument: 'REASON',
        acquisitionMET: 50,
        rawPayload,
      },
      52
    );

    expect(l0.status).toBe('REJECTED');
    expect(l0.checksumValid).toBe(false);
    expect(l0.validationError).toContain('Checksum verification failed');
  });

  it('preserves raw input data immutably (no in-place mutation)', () => {
    const registry = new ScienceDataRegistry();
    const ingestion = new Level0IngestionEngine(registry);

    const originalSamples = [0.05, 0.95, 0.15];
    const rawPayload: ReasonRawPayload = {
      centerFrequencyHz: 9e6,
      samplingIntervalSeconds: 1e-8,
      pulseBandwidthHz: 1e6,
      transmitPowerWatts: 10.0,
      echoSamples: originalSamples,
      transmitTimeMET: 100,
      receiveTimeMET: 100.001,
      sampleCount: 3,
    };

    const l0 = ingestion.ingestPacket(
      {
        packetId: 'pkt-immutable-test',
        instrument: 'REASON',
        acquisitionMET: 100,
        rawPayload,
      },
      101
    );

    // Mutate caller's original array
    originalSamples[1] = 0.0;

    // Stored Level 0 payload remains untouched
    expect(l0.rawPayload.echoSamples[1]).toBe(0.95);
  });
});

