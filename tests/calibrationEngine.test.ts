import { describe, it, expect } from 'vitest';
import { ScienceDataRegistry } from '../src/simulation/science/scienceDataRegistry';
import { InstrumentRegistry } from '../src/simulation/science/instrumentRegistry';
import { Level0IngestionEngine } from '../src/simulation/science/level0/level0Ingestion';
import {
  CalibrationEngine,
  MissingCalibrationProfileError,
} from '../src/simulation/science/level1/calibrationEngine';
import type { ReasonRawPayload, MaspexRawPayload, CalibrationProfile } from '../src/simulation/science/types';

describe('Science Processing — Level 1 Calibration Engine', () => {
  it('applies baseline subtraction, gain calibration, and SNR estimation for REASON', () => {
    const registry = new ScienceDataRegistry();
    const instRegistry = new InstrumentRegistry();
    const ingestion = new Level0IngestionEngine(registry);
    const calEngine = new CalibrationEngine(registry, instRegistry);

    // Register custom profile with baseline offset 0.05 and gain 2.0
    const profile: CalibrationProfile = {
      version: 'reason-custom-cal-v2',
      instrument: 'REASON',
      baselineOffset: 0.05,
      gainMultiplier: 2.0,
      noiseThreshold: 0.02,
      description: 'Test high-gain calibration',
      provenance: 'SIMPLIFIED',
    };
    instRegistry.registerCalibrationProfile(profile);

    const rawPayload: ReasonRawPayload = {
      centerFrequencyHz: 9e6,
      samplingIntervalSeconds: 1e-8,
      pulseBandwidthHz: 1e6,
      transmitPowerWatts: 10.0,
      echoSamples: [0.06, 0.55, 0.05, 0.25], // after -0.05: [0.01, 0.50, 0.0, 0.20], after *2.0: [0.02, 1.0, 0.0, 0.40]
      transmitTimeMET: 100,
      receiveTimeMET: 100.001,
      sampleCount: 4,
    };

    const l0 = ingestion.ingestPacket(
      {
        packetId: 'pkt-radar-cal-01',
        instrument: 'REASON',
        acquisitionMET: 100,
        rawPayload,
      },
      101
    );

    const l1 = calEngine.calibrateLevel0(l0.id, 102, 'reason-custom-cal-v2');

    expect(l1.instrument).toBe('REASON');
    expect(l1.calibrationProfileVersion).toBe('reason-custom-cal-v2');
    expect(l1.baselineOffsetRemoved).toBe(0.05);
    expect(l1.gainApplied).toBe(2.0);

    const echoes = (l1.calibratedData as any).calibratedEchoes;
    expect(echoes[1]).toBeCloseTo(1.0, 3);
    expect(echoes[2]).toBeCloseTo(0.0, 3);
    expect(echoes[3]).toBeCloseTo(0.4, 3);
    expect(l1.snrDb).toBeGreaterThan(10);
  });

  it('strictly rejects calibration when specified profile is missing', () => {
    const registry = new ScienceDataRegistry();
    const instRegistry = new InstrumentRegistry();
    const ingestion = new Level0IngestionEngine(registry);
    const calEngine = new CalibrationEngine(registry, instRegistry);

    const rawPayload: ReasonRawPayload = {
      centerFrequencyHz: 9e6,
      samplingIntervalSeconds: 1e-8,
      pulseBandwidthHz: 1e6,
      transmitPowerWatts: 10.0,
      echoSamples: [0.1, 0.5],
      transmitTimeMET: 10,
      receiveTimeMET: 10.001,
      sampleCount: 2,
    };

    const l0 = ingestion.ingestPacket(
      {
        packetId: 'pkt-no-profile',
        instrument: 'REASON',
        acquisitionMET: 10,
        rawPayload,
      },
      11
    );

    expect(() => {
      calEngine.calibrateLevel0(l0.id, 12, 'nonexistent-profile-v999');
    }).toThrow(MissingCalibrationProfileError);
  });

  it('calibrates MASPEX mass spectrometry and detects spectral peaks', () => {
    const registry = new ScienceDataRegistry();
    const instRegistry = new InstrumentRegistry();
    const ingestion = new Level0IngestionEngine(registry);
    const calEngine = new CalibrationEngine(registry, instRegistry);

    const mzSamples = [
      { mz: 17.5, intensity: 10 },
      { mz: 18.01, intensity: 5000 }, // Water peak
      { mz: 18.5, intensity: 12 },
      { mz: 43.5, intensity: 8 },
      { mz: 43.99, intensity: 1200 }, // CO2 peak
      { mz: 44.5, intensity: 10 },
    ];

    const rawPayload: MaspexRawPayload = {
      ionizationMode: 'ELECTRON_IMPACT',
      massRangeU: [1, 500],
      integrationTimeSeconds: 1.0,
      detectorGain: 1000,
      mzSamples,
      sampleCount: mzSamples.length,
      acquisitionMET: 300,
    };

    const l0 = ingestion.ingestPacket(
      {
        packetId: 'pkt-maspex-cal-01',
        instrument: 'MASPEX',
        acquisitionMET: 300,
        rawPayload,
      },
      301
    );

    const l1 = calEngine.calibrateLevel0(l0.id, 302);
    expect(l1.instrument).toBe('MASPEX');

    const calData = l1.calibratedData as any;
    expect(calData.detectedPeaks.length).toBeGreaterThanOrEqual(2);

    const peakMzs = calData.detectedPeaks.map((p: any) => p.mz);
    expect(peakMzs).toContain(18.01);
    expect(peakMzs).toContain(43.99);
  });

  it('generates SATURATED and LOW_SNR quality flags correctly', () => {
    const registry = new ScienceDataRegistry();
    const instRegistry = new InstrumentRegistry();
    const ingestion = new Level0IngestionEngine(registry);
    const calEngine = new CalibrationEngine(registry, instRegistry);

    // 1. Saturated sample (>= 0.98)
    const saturatedPayload: ReasonRawPayload = {
      centerFrequencyHz: 9e6,
      samplingIntervalSeconds: 1e-8,
      pulseBandwidthHz: 1e6,
      transmitPowerWatts: 10.0,
      echoSamples: [0.01, 0.99, 0.02],
      transmitTimeMET: 10,
      receiveTimeMET: 10.001,
      sampleCount: 3,
    };

    const l0Sat = ingestion.ingestPacket(
      {
        packetId: 'pkt-sat',
        instrument: 'REASON',
        acquisitionMET: 10,
        rawPayload: saturatedPayload,
      },
      11
    );

    const l1Sat = calEngine.calibrateLevel0(l0Sat.id, 12);
    expect(l1Sat.qualityFlags).toContain('SATURATED');

    // 2. Low SNR sample
    const lowSnrPayload: ReasonRawPayload = {
      centerFrequencyHz: 9e6,
      samplingIntervalSeconds: 1e-8,
      pulseBandwidthHz: 1e6,
      transmitPowerWatts: 10.0,
      echoSamples: [0.010, 0.012, 0.011], // flat noise floor
      transmitTimeMET: 20,
      receiveTimeMET: 20.001,
      sampleCount: 3,
    };

    const l0Low = ingestion.ingestPacket(
      {
        packetId: 'pkt-low-snr',
        instrument: 'REASON',
        acquisitionMET: 20,
        rawPayload: lowSnrPayload,
      },
      21
    );

    const l1Low = calEngine.calibrateLevel0(l0Low.id, 22);
    expect(l1Low.qualityFlags).toContain('LOW_SNR');
  });

  it('produces deterministic output given identical input across multiple runs', () => {
    const registry = new ScienceDataRegistry();
    const instRegistry = new InstrumentRegistry();
    const ingestion = new Level0IngestionEngine(registry);
    const calEngine = new CalibrationEngine(registry, instRegistry);

    const rawPayload: ReasonRawPayload = {
      centerFrequencyHz: 9e6,
      samplingIntervalSeconds: 1e-8,
      pulseBandwidthHz: 1e6,
      transmitPowerWatts: 10.0,
      echoSamples: [0.02, 0.70, 0.05, 0.35],
      transmitTimeMET: 10,
      receiveTimeMET: 10.001,
      sampleCount: 4,
    };

    const l0A = ingestion.ingestPacket({ packetId: 'pkt-det-A', instrument: 'REASON', acquisitionMET: 10, rawPayload }, 11);
    const l0B = ingestion.ingestPacket({ packetId: 'pkt-det-B', instrument: 'REASON', acquisitionMET: 10, rawPayload }, 11);

    const l1A = calEngine.calibrateLevel0(l0A.id, 12);
    const l1B = calEngine.calibrateLevel0(l0B.id, 12);

    expect(l1A.snrDb).toBe(l1B.snrDb);
    expect(l1A.calibratedData.calibratedEchoes).toEqual(l1B.calibratedData.calibratedEchoes);
  });
});

