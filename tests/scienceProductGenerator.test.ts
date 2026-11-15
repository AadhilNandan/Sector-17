import { describe, it, expect } from 'vitest';
import { ScienceDataRegistry } from '../src/simulation/science/scienceDataRegistry';
import { InstrumentRegistry } from '../src/simulation/science/instrumentRegistry';
import { Level0IngestionEngine } from '../src/simulation/science/level0/level0Ingestion';
import { CalibrationEngine } from '../src/simulation/science/level1/calibrationEngine';
import { ScienceProductGenerator } from '../src/simulation/science/level2/scienceProductGenerator';
import { MissionEventEngine } from '../src/simulation/operations/missionEventEngine';
import { SCIENCE_EVENT_TYPES } from '../src/simulation/science/constants';
import type { ReasonRawPayload, MaspexRawPayload } from '../src/simulation/science/types';

describe('Science Processing — Level 2 Product Generator & Provenance', () => {
  it('generates Level 2 products and verifies complete provenance back to Level 0 packet', () => {
    const registry = new ScienceDataRegistry();
    const instRegistry = new InstrumentRegistry();
    const eventEngine = new MissionEventEngine(0, true);

    const ingestion = new Level0IngestionEngine(registry, eventEngine);
    const calEngine = new CalibrationEngine(registry, instRegistry, eventEngine);
    const generator = new ScienceProductGenerator(registry, eventEngine);

    const events: string[] = [];
    eventEngine.registerHandler(SCIENCE_EVENT_TYPES.SCIENCE_PRODUCT_GENERATED, (evt) => {
      events.push((evt.payload as any).level2Id);
    });

    // 1. Ingest Level 0
    const rawPayload: ReasonRawPayload = {
      centerFrequencyHz: 9e6,
      samplingIntervalSeconds: 1e-6,
      pulseBandwidthHz: 1e6,
      transmitPowerWatts: 10.0,
      echoSamples: [0.01, 0.85, 0.02, 0.40, 0.01],
      transmitTimeMET: 50,
      receiveTimeMET: 50.001,
      sampleCount: 5,
    };

    const l0 = ingestion.ingestPacket(
      {
        packetId: 'pkt-radar-provenance',
        instrument: 'REASON',
        acquisitionMET: 50,
        rawPayload,
      },
      52
    );

    // 2. Calibrate Level 1
    const l1 = calEngine.calibrateLevel0(l0.id, 55);

    // 3. Generate Level 2
    const l2 = generator.generateLevel2Product(l1.id, 60);

    expect(l2.level1Id).toBe(l1.id);
    expect(l2.level0PacketId).toBe('pkt-radar-provenance');

    // 4. Verify end-to-end provenance in registry
    const prov = registry.verifyProvenance(l2.id);
    expect(prov.isValid).toBe(true);
    expect(prov.level2?.id).toBe(l2.id);
    expect(prov.level1?.id).toBe(l1.id);
    expect(prov.level0?.id).toBe(l0.id);

    eventEngine.advanceAndProcess(70);
    expect(events).toContain(l2.id);
  });

  it('strictly rejects Level 2 generation when source Level 1 product does not exist', () => {
    const registry = new ScienceDataRegistry();
    const generator = new ScienceProductGenerator(registry);

    expect(() => {
      generator.generateLevel2Product('nonexistent-l1-id', 100);
    }).toThrow(/not found/);
  });

  it('freezes Level 2 products in the registry to prevent mutation', () => {
    const registry = new ScienceDataRegistry();
    const instRegistry = new InstrumentRegistry();
    const ingestion = new Level0IngestionEngine(registry);
    const calEngine = new CalibrationEngine(registry, instRegistry);
    const generator = new ScienceProductGenerator(registry);

    const rawPayload: MaspexRawPayload = {
      ionizationMode: 'ELECTRON_IMPACT',
      massRangeU: [1, 500],
      integrationTimeSeconds: 1.0,
      detectorGain: 1000,
      mzSamples: [{ mz: 18.01, intensity: 2000 }],
      sampleCount: 1,
      acquisitionMET: 10,
    };

    const l0 = ingestion.ingestPacket({ packetId: 'pkt-freeze-test', instrument: 'MASPEX', acquisitionMET: 10, rawPayload }, 11);
    const l1 = calEngine.calibrateLevel0(l0.id, 12);
    const l2 = generator.generateLevel2Product(l1.id, 15);

    const storedL2 = registry.getLevel2(l2.id);
    expect(Object.isFrozen(storedL2)).toBe(true);
  });
});

