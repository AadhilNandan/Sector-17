import { describe, it, expect } from 'vitest';
import { MaspexProcessor, InvalidMaspexProcessingInputError } from '../src/simulation/science/level2/maspexProcessor';
import { MASPEX_REFERENCE_LIBRARY, SCIENTIFIC_DISCLAIMERS } from '../src/simulation/science/constants';
import type { Level1Product, MaspexCalibratedData } from '../src/simulation/science/types';

describe('Science Processing — MASPEX Level 2 Mass Spectrometer Processor', () => {
  function createSyntheticMaspexL1(
    detectedPeaks: Array<{ mz: number; intensity: number; fwhm?: number }>
  ): Level1Product<MaspexCalibratedData> {
    return {
      id: 'l1-maspex-test-01',
      level0Id: 'l0-maspex-test-01',
      packetId: 'pkt-maspex-synthetic',
      instrument: 'MASPEX',
      calibrationProfileVersion: 'maspex-cal-v1.0',
      processingMET: 200,
      sizeBytes: 12288,
      calibratedData: {
        calibratedSpectra: [],
        detectedPeaks: detectedPeaks.map((p) => ({
          mz: p.mz,
          intensity: p.intensity,
          fwhm: p.fwhm ?? 0.01,
          snr: p.intensity / 5.0,
          resolution: p.mz / (p.fwhm ?? 0.01),
        })),
        baselineNoiseFloor: 5.0,
        peakCount: detectedPeaks.length,
        saturationDetected: false,
        resolutionEstimate: 20000,
      },
      qualityFlags: ['NOMINAL'],
      snrDb: 40.0,
      baselineOffsetRemoved: 5.0,
      gainApplied: 1.0,
    };
  }

  it('identifies verified chemical species from Europa exosphere / plume analog', () => {
    const processor = new MaspexProcessor();

    // Synthetic plume spectrum: predominantly H2O (18.011), with CO2 (43.990) and CH4 (16.031)
    const l1 = createSyntheticMaspexL1([
      { mz: 16.031, intensity: 500 }, // Methane
      { mz: 18.011, intensity: 10000 }, // Water (Base peak)
      { mz: 43.990, intensity: 1200 }, // Carbon Dioxide
    ]);

    // Explicitly requests ABSOLUTE_ONLY policy for backward-compatible absolute confidence evaluation (C-03)
    const l2 = processor.processLevel2(l1, 205, { tolerancePolicy: 'ABSOLUTE_ONLY' });

    expect(l2.candidateSpecies).toHaveLength(3);
    expect(l2.totalIonCurrent).toBe(11700);
    expect(l2.basePeakMz).toBe(18.011);
    expect(l2.basePeakIntensity).toBe(10000);

    const water = l2.candidateSpecies.find((c) => c.species.id === 'H2O');
    expect(water).toBeDefined();
    expect(water?.species.provenance).toBe('VERIFIED');
    expect(water?.relativeAbundancePercent).toBe(100.0);
    expect(water?.ticFraction).toBeCloseTo(10000 / 11700, 3);
    expect(water?.confidenceScore).toBeGreaterThan(0.9);

    const co2 = l2.candidateSpecies.find((c) => c.species.id === 'CO2');
    expect(co2).toBeDefined();
    expect(co2?.species.formula).toBe('CO2');
    expect(co2?.relativeAbundancePercent).toBeCloseTo(12.0, 1);
  });

  it('preserves provenance tags differentiating VERIFIED, SIMPLIFIED, and FICTIONAL species', () => {
    const processor = new MaspexProcessor();

    const l1 = createSyntheticMaspexL1([
      { mz: 18.010, intensity: 5000 }, // H2O (VERIFIED)
      { mz: 27.011, intensity: 300 }, // HCN (SIMPLIFIED)
      { mz: 314.185, intensity: 150 }, // Candidate Relic Organometallic (FICTIONAL)
    ]);

    const l2 = processor.processLevel2(l1, 210);

    const water = l2.candidateSpecies.find((c) => c.species.id === 'H2O');
    expect(water?.species.provenance).toBe('VERIFIED');

    const hcn = l2.candidateSpecies.find((c) => c.species.id === 'HCN');
    expect(hcn?.species.provenance).toBe('SIMPLIFIED');

    const fictional = l2.candidateSpecies.find((c) => c.species.id === 'FICT_RELIC_ORGANOMETALLIC');
    expect(fictional).toBeDefined();
    expect(fictional?.species.provenance).toBe('FICTIONAL');
    expect(fictional?.species.category).toBe('EXOTIC');
  });

  it('enforces COMBINED tolerance policy: rejects low m/z candidate exceeding ppm limit (H-02)', () => {
    const processor = new MaspexProcessor();

    // H2O exact mass is 18.010565 u.
    // Observed peak is at 18.025 u:
    // delta = 0.014435 u (which is <= 0.02 u absolute tolerance)
    // but ppmDiff = (0.014435 / 18.010565) * 1e6 = 801.5 ppm (which exceeds 50 ppm)!
    const l1 = createSyntheticMaspexL1([{ mz: 18.025, intensity: 2000 }]);

    // In COMBINED mode with toleranceU = 0.02 and maxTolerancePpm = 50.0:
    const l2Combined = processor.processLevel2(l1, 210, {
      toleranceU: 0.02,
      maxTolerancePpm: 50.0,
      tolerancePolicy: 'COMBINED',
    });

    // Peak is rejected because it exceeds 50 ppm despite passing 0.02 u absolute!
    expect(l2Combined.candidateSpecies).toHaveLength(0);
    expect(l2Combined.unidentifiedPeaks).toHaveLength(1);

    // In ABSOLUTE_ONLY mode with toleranceU = 0.02:
    const l2Absolute = processor.processLevel2(l1, 210, {
      toleranceU: 0.02,
      tolerancePolicy: 'ABSOLUTE_ONLY',
    });

    // Peak is accepted because absolute tolerance does not filter on ppm
    expect(l2Absolute.candidateSpecies).toHaveLength(1);
    expect(l2Absolute.candidateSpecies[0].species.id).toBe('H2O');
  });

  it('accepts high m/z candidate in COMBINED mode when both absolute and ppm conditions pass (H-02)', () => {
    const processor = new MaspexProcessor();

    // FICT_PRECURSOR_POLYMER has exact mass 442.2285 u.
    // Peak observed at 442.240 u:
    // delta = 0.0115 u <= 0.02 u (passes absolute)
    // ppmDiff = (0.0115 / 442.2285) * 1e6 = 26.0 ppm <= 50 ppm (passes ppm)
    const l1 = createSyntheticMaspexL1([{ mz: 442.240, intensity: 1500 }]);

    const l2 = processor.processLevel2(l1, 215, {
      toleranceU: 0.02,
      maxTolerancePpm: 50.0,
      tolerancePolicy: 'COMBINED',
    });

    expect(l2.candidateSpecies).toHaveLength(1);
    expect(l2.candidateSpecies[0].species.id).toBe('FICT_PRECURSOR_POLYMER');
    expect(l2.candidateSpecies[0].massErrorPpm).toBeCloseTo(26.0, 1);
  });

  it('selects COMBINED policy by default when options are empty or undefined (C-03)', () => {
    const processor = new MaspexProcessor();

    // H2O exact mass 18.010565 u.
    // Peak at 18.025 u: delta = 0.0144 u <= 0.02 u, but ppm = 801.5 ppm > 50 ppm.
    const l1ExceedingPpm = createSyntheticMaspexL1([{ mz: 18.025, intensity: 2000 }]);

    // 1. Empty options object {} -> must select COMBINED by default (rejecting the peak)
    const l2Empty = processor.processLevel2(l1ExceedingPpm, 210, {});
    expect(l2Empty.candidateSpecies).toHaveLength(0);
    expect(l2Empty.unidentifiedPeaks).toHaveLength(1);

    // 2. Undefined options -> must select COMBINED by default (rejecting the peak)
    const l2Undefined = processor.processLevel2(l1ExceedingPpm, 210);
    expect(l2Undefined.candidateSpecies).toHaveLength(0);
    expect(l2Undefined.unidentifiedPeaks).toHaveLength(1);

    // 3. Peak passing both default 0.02 u and default 50 ppm -> accepted under default options
    // H2O peak at 18.011 u: delta = 0.000435 u <= 0.02 u, ppm = 24.15 ppm <= 50 ppm
    const l1Passing = createSyntheticMaspexL1([{ mz: 18.011, intensity: 2000 }]);
    const l2Passing = processor.processLevel2(l1Passing, 210, {});
    expect(l2Passing.candidateSpecies).toHaveLength(1);
    expect(l2Passing.candidateSpecies[0].species.id).toBe('H2O');
  });

  it('ensures reference library tolerance override does not bypass ppm constraint in COMBINED mode (C-03)', () => {
    const processor = new MaspexProcessor();

    // Create a custom reference species with a wide toleranceU of 0.1 u
    const customLibrary = [
      {
        id: 'CUSTOM_LIGHT',
        formula: 'X18',
        name: 'Custom Light Molecule',
        exactMassU: 18.000,
        category: 'VOLATILE' as const,
        provenance: 'SIMPLIFIED' as const,
        description: 'Test molecule with generous absolute tolerance override',
        toleranceU: 0.10, // 0.1 u absolute override
      },
    ];

    // Peak at 18.050 u: delta = 0.050 u <= 0.10 u (passes absolute), but ppm = (0.05 / 18) * 1e6 = 2777 ppm > 50 ppm!
    const l1 = createSyntheticMaspexL1([{ mz: 18.050, intensity: 1500 }]);

    // Under COMBINED mode, toleranceU override widens absolute limit, but ppm limit (50 ppm) is STILL enforced!
    const l2 = processor.processLevel2(l1, 215, {
      referenceLibrary: customLibrary,
      tolerancePolicy: 'COMBINED',
    });

    expect(l2.candidateSpecies).toHaveLength(0);
    expect(l2.unidentifiedPeaks).toHaveLength(1);

    // Under explicit ABSOLUTE_ONLY mode, the 0.1 u tolerance override allows it to match
    const l2Absolute = processor.processLevel2(l1, 215, {
      referenceLibrary: customLibrary,
      tolerancePolicy: 'ABSOLUTE_ONLY',
    });
    expect(l2Absolute.candidateSpecies).toHaveLength(1);
    expect(l2Absolute.candidateSpecies[0].species.id).toBe('CUSTOM_LIGHT');
  });

  it('supports PPM_ONLY mode and tests boundary equality (H-02)', () => {
    const processor = new MaspexProcessor();

    // H2O exact mass 18.010565 u.
    // At 50 ppm limit, allowed delta is (50 * 18.010565 / 1e6) = 0.0009005 u.
    // Peak at 18.011465 u has delta exactly ~ 0.000900 u (~ 49.97 ppm <= 50 ppm)
    const l1 = createSyntheticMaspexL1([{ mz: 18.01146, intensity: 3000 }]);

    const l2 = processor.processLevel2(l1, 220, {
      maxTolerancePpm: 50.0,
      tolerancePolicy: 'PPM_ONLY',
    });

    expect(l2.candidateSpecies).toHaveLength(1);
    expect(l2.candidateSpecies[0].species.id).toBe('H2O');
  });

  it('strictly validates tolerance inputs and reference library species (H-02)', () => {
    const processor = new MaspexProcessor();
    const l1 = createSyntheticMaspexL1([{ mz: 18.011, intensity: 1000 }]);

    // Zero or negative absolute tolerance
    expect(() => {
      processor.processLevel2(l1, 225, { toleranceU: -0.01 });
    }).toThrow(RangeError);

    expect(() => {
      processor.processLevel2(l1, 225, { toleranceU: 0 });
    }).toThrow(RangeError);

    // Zero or negative ppm tolerance
    expect(() => {
      processor.processLevel2(l1, 225, { maxTolerancePpm: -50 });
    }).toThrow(RangeError);

    // Invalid reference mass
    expect(() => {
      processor.processLevel2(l1, 225, {
        referenceLibrary: [
          {
            id: 'BAD_SPECIES',
            formula: 'X',
            name: 'Bad Mass',
            exactMassU: -18.0, // invalid!
            category: 'VOLATILE',
            provenance: 'SIMPLIFIED',
            description: 'Invalid',
          },
        ],
      });
    }).toThrow(InvalidMaspexProcessingInputError);
  });

  it('isolates unidentified peaks when mass does not match reference library', () => {
    const processor = new MaspexProcessor();

    const l1 = createSyntheticMaspexL1([
      { mz: 18.011, intensity: 8000 }, // Matches H2O
      { mz: 197.432, intensity: 450 }, // Unknown peak in Jovian background
    ]);

    const l2 = processor.processLevel2(l1, 215);

    expect(l2.candidateSpecies).toHaveLength(1);
    expect(l2.unidentifiedPeaks).toHaveLength(1);
    expect(l2.unidentifiedPeaks[0].mz).toBe(197.432);
    expect(l2.unidentifiedPeaks[0].intensity).toBe(450);
  });

  it('embeds scientific limitations disclaimer without false definitive confirmation', () => {
    const processor = new MaspexProcessor();
    const l1 = createSyntheticMaspexL1([{ mz: 18.011, intensity: 1000 }]);
    const l2 = processor.processLevel2(l1, 220);

    expect(l2.limitationsDisclaimer).toBe(SCIENTIFIC_DISCLAIMERS.MASPEX_SPECIES_DISCLAIMER);
    expect(l2.limitationsDisclaimer).toContain('CANDIDATE SPECIES IDENTIFICATION');
    expect(l2.limitationsDisclaimer).toContain('does not constitute definitive molecular confirmation');
  });
});
