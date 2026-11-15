import { describe, it, expect } from 'vitest';
import { ReasonProcessor, InvalidRadarProcessingInputError } from '../src/simulation/science/level2/reasonProcessor';
import { SPEED_OF_LIGHT_M_PER_S, STANDARD_DIELECTRIC_MODELS, SCIENTIFIC_DISCLAIMERS } from '../src/simulation/science/constants';
import type { Level1Product, ReasonCalibratedData, DielectricModel } from '../src/simulation/science/types';

describe('Science Processing — REASON Level 2 Radar Sounding Processor', () => {
  function createSyntheticCalibratedRadar(
    surfaceBin: number,
    subsurfaceBins: Array<{ bin: number; amp: number }>,
    dt: number = 1e-6
  ): Level1Product<ReasonCalibratedData> {
    const totalBins = 500;
    const echoes = new Array(totalBins).fill(0.01);
    const timeBins = new Array(totalBins).fill(0).map((_, i) => i * dt);

    // Surface echo
    echoes[surfaceBin] = 0.90;

    // Subsurface echoes
    for (const sub of subsurfaceBins) {
      echoes[sub.bin] = sub.amp;
    }

    return {
      id: 'l1-test-radar-01',
      level0Id: 'l0-test-radar-01',
      packetId: 'pkt-radar-synthetic',
      instrument: 'REASON',
      calibrationProfileVersion: 'reason-cal-v1.0',
      processingMET: 100,
      sizeBytes: 8192,
      calibratedData: {
        calibratedEchoes: echoes,
        timeBinsSeconds: timeBins,
        samplingIntervalSeconds: dt,
        baselineNoiseFloor: 0.01,
        peakSnrDb: 35.0,
        saturationDetected: false,
      },
      qualityFlags: ['NOMINAL'],
      snrDb: 35.0,
      baselineOffsetRemoved: 0.0,
      gainApplied: 1.0,
    };
  }

  it('detects surface echo and computes two-way travel time to subsurface reflector', () => {
    const processor = new ReasonProcessor();
    const dt = 1e-5; // 10 microseconds per bin
    const surfaceBin = 10;
    const subsurfaceBin = 30; // 20 bins later = 20 * 1e-5 = 2e-4 s travel time

    const l1 = createSyntheticCalibratedRadar(surfaceBin, [{ bin: subsurfaceBin, amp: 0.45 }], dt);
    const l2 = processor.processLevel2(l1, 105, STANDARD_DIELECTRIC_MODELS.COLD_PURE_ICE);

    expect(l2.detectedReflectors).toHaveLength(2);

    // Reflector 0 is surface
    expect(l2.detectedReflectors[0].reflectorTypeCandidate).toBe('SURFACE');
    expect(l2.detectedReflectors[0].estimatedDepthMetres).toBe(0.0);

    // Reflector 1 is subsurface
    const subRef = l2.detectedReflectors[1];
    expect(subRef.travelTimeSeconds).toBeCloseTo(2e-4, 6);

    // Theoretical depth in cold pure ice (eps_r = 3.15):
    // depth = (c * deltaTau) / (2 * sqrt(3.15))
    const expectedDepth = (SPEED_OF_LIGHT_M_PER_S * 2e-4) / (2 * Math.sqrt(3.15));
    expect(subRef.estimatedDepthMetres).toBeCloseTo(expectedDepth, 0);
  });

  it('demonstrates sensitivity to relative permittivity model assumptions', () => {
    const processor = new ReasonProcessor();
    const dt = 1e-5;
    const l1 = createSyntheticCalibratedRadar(10, [{ bin: 40, amp: 0.50 }], dt);
    const deltaTau = 30 * dt; // 3e-4 s

    // Case 1: Porous firn (eps_r = 2.20) -> speed is faster -> greater derived depth
    const l2Porous = processor.processLevel2(l1, 105, STANDARD_DIELECTRIC_MODELS.POROUS_ICE_FIRN);
    // Case 2: Cold pure ice (eps_r = 3.15)
    const l2Cold = processor.processLevel2(l1, 105, STANDARD_DIELECTRIC_MODELS.COLD_PURE_ICE);
    // Case 3: Warm convecting ice (eps_r = 3.35)
    const l2Warm = processor.processLevel2(l1, 105, STANDARD_DIELECTRIC_MODELS.WARM_CONVECTING_ICE);
    // Case 4: Saline ice (eps_r = 4.50) -> speed is slower -> smaller derived depth
    const l2Saline = processor.processLevel2(l1, 105, STANDARD_DIELECTRIC_MODELS.SALINE_ICE);

    const dPorous = l2Porous.detectedReflectors[1].estimatedDepthMetres;
    const dCold = l2Cold.detectedReflectors[1].estimatedDepthMetres;
    const dWarm = l2Warm.detectedReflectors[1].estimatedDepthMetres;
    const dSaline = l2Saline.detectedReflectors[1].estimatedDepthMetres;

    // Strict physical monotonicity: higher dielectric constant implies shallower calculated depth
    expect(dPorous).toBeGreaterThan(dCold);
    expect(dCold).toBeGreaterThan(dWarm);
    expect(dWarm).toBeGreaterThan(dSaline);

    expect(dPorous).toBeCloseTo((SPEED_OF_LIGHT_M_PER_S * deltaTau) / (2 * Math.sqrt(2.20)), 0);
    expect(dSaline).toBeCloseTo((SPEED_OF_LIGHT_M_PER_S * deltaTau) / (2 * Math.sqrt(4.50)), 0);
  });

  it('calculates RSS standard uncertainty and separate worst-case linear bound (H-01)', () => {
    const processor = new ReasonProcessor();
    const dt = 1e-5; // sampling interval
    const l1 = createSyntheticCalibratedRadar(10, [{ bin: 50, amp: 0.40 }], dt);
    const model = STANDARD_DIELECTRIC_MODELS.COLD_PURE_ICE; // eps = 3.15, dEps = 0.05

    const l2 = processor.processLevel2(l1, 105, model);
    const subRef = l2.detectedReflectors[1];

    const depth = subRef.estimatedDepthMetres;
    const termTime = (SPEED_OF_LIGHT_M_PER_S * dt) / (4 * Math.sqrt(model.relativePermittivity));
    const termEps = depth * (model.permittivityUncertainty / (2 * model.relativePermittivity));

    const expectedRss = Math.sqrt(termTime * termTime + termEps * termEps);
    const expectedWorstCase = termTime + termEps;

    // 1-sigma standard uncertainty via RSS
    expect(subRef.depthUncertaintyMetres).toBeCloseTo(expectedRss, 1);

    // Worst-case linear bound
    expect(subRef.worstCaseDepthUncertaintyMetres).toBeCloseTo(expectedWorstCase, 1);

    // RSS is strictly bounded above by the linear worst-case bound
    expect(subRef.depthUncertaintyMetres).toBeLessThanOrEqual(subRef.worstCaseDepthUncertaintyMetres!);
  });

  it('isolates timing uncertainty only and permittivity uncertainty only (H-01)', () => {
    const processor = new ReasonProcessor();
    const dt = 1e-5;
    const l1 = createSyntheticCalibratedRadar(10, [{ bin: 50, amp: 0.40 }], dt);

    // 1. Permittivity uncertainty = 0 -> only timing uncertainty contributes
    const modelZeroEps: DielectricModel = {
      name: 'Zero Permittivity Uncertainty Model',
      relativePermittivity: 3.15,
      permittivityUncertainty: 0.0,
      description: 'Test model with perfect permittivity knowledge',
      provenance: 'SIMPLIFIED',
    };

    const l2TimingOnly = processor.processLevel2(l1, 105, modelZeroEps);
    const subRefTiming = l2TimingOnly.detectedReflectors[1];
    const expectedTimeOnly = (SPEED_OF_LIGHT_M_PER_S * dt) / (4 * Math.sqrt(3.15));

    expect(subRefTiming.depthUncertaintyMetres).toBeCloseTo(expectedTimeOnly, 1);
    expect(subRefTiming.worstCaseDepthUncertaintyMetres).toBeCloseTo(expectedTimeOnly, 1);

    // 2. Surface reflector (depth = 0) has termEps = 0
    const surfRef = l2TimingOnly.detectedReflectors[0];
    expect(surfRef.depthUncertaintyMetres).toBeCloseTo(expectedTimeOnly, 1);
  });

  it('strictly rejects invalid sampling interval or invalid permittivity with typed error (H-05)', () => {
    const processor = new ReasonProcessor();
    const l1 = createSyntheticCalibratedRadar(10, [{ bin: 30, amp: 0.35 }], 1e-5);

    // 1. Invalid non-positive sampling interval
    const invalidDtL1 = JSON.parse(JSON.stringify(l1));
    invalidDtL1.calibratedData.samplingIntervalSeconds = -1e-5;

    expect(() => {
      processor.processLevel2(invalidDtL1, 105);
    }).toThrow(InvalidRadarProcessingInputError);

    // 2. Invalid non-positive permittivity
    const invalidModel: DielectricModel = {
      name: 'Negative Permittivity Model',
      relativePermittivity: -3.15,
      permittivityUncertainty: 0.1,
      description: 'Unphysical permittivity',
      provenance: 'SIMPLIFIED',
    };

    expect(() => {
      processor.processLevel2(l1, 105, invalidModel);
    }).toThrow(InvalidRadarProcessingInputError);

    // 3. Invalid negative permittivity uncertainty
    const invalidUncertaintyModel: DielectricModel = {
      name: 'Negative Uncertainty Model',
      relativePermittivity: 3.15,
      permittivityUncertainty: -0.1,
      description: 'Negative uncertainty',
      provenance: 'SIMPLIFIED',
    };

    expect(() => {
      processor.processLevel2(l1, 105, invalidUncertaintyModel);
    }).toThrow(InvalidRadarProcessingInputError);
  });

  it('embeds scientific limitations disclaimer without false ocean certainty', () => {
    const processor = new ReasonProcessor();
    const l1 = createSyntheticCalibratedRadar(10, [{ bin: 30, amp: 0.35 }], 1e-5);
    const l2 = processor.processLevel2(l1, 105);

    expect(l2.limitationsDisclaimer).toBe(SCIENTIFIC_DISCLAIMERS.REASON_DEPTH_DISCLAIMER);
    expect(l2.limitationsDisclaimer).toContain('SIMPLIFIED RADAR MODEL OUTPUT');
    expect(l2.limitationsDisclaimer).toContain('Does NOT constitute verified determination of Europa actual ice shell thickness or ocean depth');
  });
});
