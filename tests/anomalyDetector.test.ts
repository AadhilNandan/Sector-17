import { describe, it, expect } from 'vitest';
import { AnomalyDetector, calculateAngularSeparationDeg } from '../src/simulation/science/anomaly/anomalyDetector';
import { ScienceDataRegistry } from '../src/simulation/science/scienceDataRegistry';
import { STANDARD_DIELECTRIC_MODELS, SCIENTIFIC_DISCLAIMERS } from '../src/simulation/science/constants';
import type { ReasonLevel2Product, MaspexLevel2Product, Level0Product, Level1Product } from '../src/simulation/science/types';

describe('Science Processing — Anomaly Detector & Explainable Scoring', () => {
  it('detects shallow perched brine pocket anomaly from REASON radar product', () => {
    const detector = new AnomalyDetector();

    const reasonProduct: ReasonLevel2Product = {
      id: 'l2-reason-anom-01',
      level1Id: 'l1-reason-anom-01',
      level0PacketId: 'pkt-radar-anom-01',
      instrument: 'REASON',
      processingMET: 100,
      algorithmVersion: 'reason-proc-v1.0',
      calibrationProfileVersion: 'reason-cal-v1.0',
      sizeBytes: 8192,
      surfaceEchoTimeSeconds: 0.0001,
      dielectricModelUsed: STANDARD_DIELECTRIC_MODELS.COLD_PURE_ICE,
      detectedReflectors: [
        {
          id: 'ref-0-surface',
          peakIndex: 10,
          travelTimeSeconds: 0,
          echoAmplitude: 0.90,
          estimatedDepthMetres: 0.0,
          depthUncertaintyMetres: 1.0,
          reflectionCoefficientEstimate: 1.0,
          reflectorTypeCandidate: 'SURFACE',
        },
        {
          id: 'ref-1-brine',
          peakIndex: 25,
          travelTimeSeconds: 0.00005,
          echoAmplitude: 0.60,
          estimatedDepthMetres: 4230.0, // < 5000 m
          depthUncertaintyMetres: 45.0,
          reflectionCoefficientEstimate: 0.44, // >= 0.30
          reflectorTypeCandidate: 'BRINE_POCKET_CANDIDATE',
        },
      ],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.REASON_DEPTH_DISCLAIMER,
    };

    const report = detector.analyzeProduct(reasonProduct, 105);

    expect(report).not.toBeNull();
    expect(report?.instrument).toBe('REASON');
    expect(report?.severity).toBe('HIGH');
    expect(report?.title).toContain('Shallow Conductive Dielectric Anomaly');
    expect(report?.triggeredMetrics).toHaveLength(2);
    expect(report?.triggeredMetrics[0].observedValue).toBe(0.44);
    expect(report?.isFictionalScenarioAnomaly).toBe(false);
  });

  it('detects fictional scenario anomaly from MASPEX mass spec with explicit disclaimer', () => {
    const detector = new AnomalyDetector();

    const maspexProduct: MaspexLevel2Product = {
      id: 'l2-maspex-anom-01',
      level1Id: 'l1-maspex-anom-01',
      level0PacketId: 'pkt-maspex-anom-01',
      instrument: 'MASPEX',
      processingMET: 200,
      algorithmVersion: 'maspex-proc-v1.0',
      calibrationProfileVersion: 'maspex-cal-v1.0',
      sizeBytes: 12288,
      totalIonCurrent: 5000,
      basePeakMz: 18.01,
      basePeakIntensity: 4500,
      candidateSpecies: [
        {
          species: {
            id: 'FICT_RELIC_ORGANOMETALLIC',
            formula: 'C12-H18-Fe-Si-X',
            name: 'Candidate Anomalous Organometallic Complex',
            exactMassU: 314.1852,
            category: 'EXOTIC',
            provenance: 'FICTIONAL',
            description: 'Fictional relic trace',
          },
          observedMz: 314.185,
          exactMassU: 314.1852,
          massErrorU: 0.0002,
          massErrorPpm: 0.6,
          confidenceScore: 0.98,
          relativeAbundancePercent: 5.2,
          ticFraction: 0.047,
        },
      ],
      unidentifiedPeaks: [],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.MASPEX_SPECIES_DISCLAIMER,
    };

    const report = detector.analyzeProduct(maspexProduct, 205);

    expect(report).not.toBeNull();
    expect(report?.severity).toBe('CRITICAL');
    expect(report?.isFictionalScenarioAnomaly).toBe(true);
    expect(report?.title).toContain('Exotic Synthetic Molecular Signature');
    expect(report?.scientificDisclaimer).toContain('NOTICE: Any anomalous precursor or relic signatures are explicit fictional narrative elements');
  });

  it('produces NO anomaly for nominal, expected observation data within thresholds', () => {
    const detector = new AnomalyDetector();

    const nominalReason: ReasonLevel2Product = {
      id: 'l2-reason-nominal',
      level1Id: 'l1-reason-nominal',
      level0PacketId: 'pkt-radar-nominal',
      instrument: 'REASON',
      processingMET: 300,
      algorithmVersion: 'reason-proc-v1.0',
      calibrationProfileVersion: 'reason-cal-v1.0',
      sizeBytes: 8192,
      surfaceEchoTimeSeconds: 0.0001,
      dielectricModelUsed: STANDARD_DIELECTRIC_MODELS.COLD_PURE_ICE,
      detectedReflectors: [
        {
          id: 'ref-0-surface',
          peakIndex: 10,
          travelTimeSeconds: 0,
          echoAmplitude: 0.90,
          estimatedDepthMetres: 0.0,
          depthUncertaintyMetres: 1.0,
          reflectionCoefficientEstimate: 1.0,
          reflectorTypeCandidate: 'SURFACE',
        },
        {
          id: 'ref-1-horizon',
          peakIndex: 20,
          travelTimeSeconds: 0.00003,
          echoAmplitude: 0.15,
          estimatedDepthMetres: 2500.0,
          depthUncertaintyMetres: 20.0,
          reflectionCoefficientEstimate: 0.027, // well below 0.30 threshold
          reflectorTypeCandidate: 'INTERNAL_HORIZON',
        },
      ],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.REASON_DEPTH_DISCLAIMER,
    };

    const report = detector.analyzeProduct(nominalReason, 305);
    expect(report).toBeNull();
  });

  it('evaluates multi-instrument correlation when co-located subsurface and plume features exist (H-03)', () => {
    const detector = new AnomalyDetector();

    const reason: ReasonLevel2Product = {
      id: 'l2-reason-vent',
      level1Id: 'l1-reason-vent',
      level0PacketId: 'pkt-radar-vent',
      instrument: 'REASON',
      processingMET: 500,
      acquisitionMET: 495,
      location: { latitudeDeg: 12.5, longitudeDeg: -45.0 },
      algorithmVersion: 'reason-proc-v1.1',
      calibrationProfileVersion: 'reason-cal-v1.0',
      sizeBytes: 8192,
      surfaceEchoTimeSeconds: 0.0001,
      dielectricModelUsed: STANDARD_DIELECTRIC_MODELS.COLD_PURE_ICE,
      detectedReflectors: [
        {
          id: 'ref-vent-shallow',
          peakIndex: 15,
          travelTimeSeconds: 0.00004,
          echoAmplitude: 0.65,
          estimatedDepthMetres: 3400.0,
          depthUncertaintyMetres: 30.0,
          reflectionCoefficientEstimate: 0.52,
          reflectorTypeCandidate: 'BRINE_POCKET_CANDIDATE',
        },
      ],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.REASON_DEPTH_DISCLAIMER,
    };

    const maspex: MaspexLevel2Product = {
      id: 'l2-maspex-vent',
      level1Id: 'l1-maspex-vent',
      level0PacketId: 'pkt-maspex-vent',
      instrument: 'MASPEX',
      processingMET: 510,
      acquisitionMET: 505, // delta = 10s <= 600s
      location: { latitudeDeg: 12.6, longitudeDeg: -45.1 }, // separation < 1 deg
      algorithmVersion: 'maspex-proc-v1.1',
      calibrationProfileVersion: 'maspex-cal-v1.0',
      sizeBytes: 12288,
      totalIonCurrent: 8000,
      basePeakMz: 18.01,
      basePeakIntensity: 6000,
      candidateSpecies: [
        {
          species: {
            id: 'CH4',
            formula: 'CH4',
            name: 'Methane',
            exactMassU: 16.0313,
            category: 'ORGANIC',
            provenance: 'VERIFIED',
            description: 'Organic methane volatile',
          },
          observedMz: 16.031,
          exactMassU: 16.0313,
          massErrorU: 0.0003,
          massErrorPpm: 18.7,
          confidenceScore: 0.95,
          relativeAbundancePercent: 25.0,
          ticFraction: 0.22,
        },
      ],
      unidentifiedPeaks: [],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.MASPEX_SPECIES_DISCLAIMER,
    };

    const correlatedReport = detector.evaluateMultiInstrumentCorrelation(reason, maspex, 515, {
      maxCorrelationDeltaMET: 600,
      requireSpatialCoLocation: true,
      maxSpatialSeparationDeg: 5.0,
    });

    expect(correlatedReport).not.toBeNull();
    expect(correlatedReport?.instrument).toBe('MULTI_INSTRUMENT');
    expect(correlatedReport?.severity).toBe('CRITICAL');
    expect(correlatedReport?.confidenceScore).toBe(0.94);
    expect(correlatedReport?.sourceProductIds).toEqual(['l2-reason-vent', 'l2-maspex-vent']);
    expect(correlatedReport?.explanation).toContain('cryovolcanic fracture');
  });

  it('strictly rejects multi-instrument correlation outside observation time window or at boundary (H-03)', () => {
    const detector = new AnomalyDetector();

    const reason: ReasonLevel2Product = {
      id: 'l2-r-time',
      level1Id: 'l1-r-time',
      level0PacketId: 'pkt-r-time',
      instrument: 'REASON',
      processingMET: 1000,
      acquisitionMET: 1000,
      location: { latitudeDeg: 12.5, longitudeDeg: -45.0 },
      algorithmVersion: 'reason-proc-v1.1',
      calibrationProfileVersion: 'reason-cal-v1.0',
      sizeBytes: 8192,
      surfaceEchoTimeSeconds: 0.0001,
      dielectricModelUsed: STANDARD_DIELECTRIC_MODELS.COLD_PURE_ICE,
      detectedReflectors: [
        {
          id: 'ref-surf',
          peakIndex: 5,
          travelTimeSeconds: 0.00001,
          echoAmplitude: 0.95,
          estimatedDepthMetres: 0.0,
          depthUncertaintyMetres: 1.0,
          reflectionCoefficientEstimate: 0.85,
          reflectorTypeCandidate: 'SURFACE',
        },
        {
          id: 'ref-1',
          peakIndex: 15,
          travelTimeSeconds: 0.00004,
          echoAmplitude: 0.65,
          estimatedDepthMetres: 3400.0,
          depthUncertaintyMetres: 30.0,
          reflectionCoefficientEstimate: 0.52,
          reflectorTypeCandidate: 'BRINE_POCKET_CANDIDATE',
        },
      ],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.REASON_DEPTH_DISCLAIMER,
    };

    const maspex: MaspexLevel2Product = {
      id: 'l2-m-time',
      level1Id: 'l1-m-time',
      level0PacketId: 'pkt-m-time',
      instrument: 'MASPEX',
      processingMET: 2000,
      acquisitionMET: 2000, // delta = 1000s > 600s window!
      location: { latitudeDeg: 12.5, longitudeDeg: -45.0 },
      algorithmVersion: 'maspex-proc-v1.1',
      calibrationProfileVersion: 'maspex-cal-v1.0',
      sizeBytes: 12288,
      totalIonCurrent: 8000,
      basePeakMz: 18.01,
      basePeakIntensity: 6000,
      candidateSpecies: [
        {
          species: {
            id: 'CH4',
            formula: 'CH4',
            name: 'Methane',
            exactMassU: 16.0313,
            category: 'ORGANIC',
            provenance: 'VERIFIED',
            description: 'Methane',
          },
          observedMz: 16.031,
          exactMassU: 16.0313,
          massErrorU: 0.0003,
          massErrorPpm: 18.7,
          confidenceScore: 0.95,
          relativeAbundancePercent: 25.0,
          ticFraction: 0.22,
        },
      ],
      unidentifiedPeaks: [],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.MASPEX_SPECIES_DISCLAIMER,
    };

    // Outside window (delta = 1000s > 600s): rejected!
    const outsideReport = detector.evaluateMultiInstrumentCorrelation(reason, maspex, 2010, {
      maxCorrelationDeltaMET: 600,
    });
    expect(outsideReport).toBeNull();

    // Exactly at boundary (delta = 600s == 600s): accepted!
    maspex.acquisitionMET = 1600;
    const boundaryReport = detector.evaluateMultiInstrumentCorrelation(reason, maspex, 1610, {
      maxCorrelationDeltaMET: 600,
    });
    expect(boundaryReport).not.toBeNull();

    // Independent single-instrument anomaly detection still functions!
    const reasonReport = detector.analyzeProduct(reason, 1610);
    expect(reasonReport).not.toBeNull();
    expect(reasonReport?.instrument).toBe('REASON');
  });

  it('strictly rejects correlation when either product carries degraded quality flags (H-03)', () => {
    const detector = new AnomalyDetector();

    const reason: ReasonLevel2Product = {
      id: 'l2-r-qual',
      level1Id: 'l1-r-qual',
      level0PacketId: 'pkt-r-qual',
      instrument: 'REASON',
      processingMET: 500,
      acquisitionMET: 500,
      location: { latitudeDeg: 12.5, longitudeDeg: -45.0 },
      algorithmVersion: 'reason-proc-v1.1',
      calibrationProfileVersion: 'reason-cal-v1.0',
      sizeBytes: 8192,
      surfaceEchoTimeSeconds: 0.0001,
      dielectricModelUsed: STANDARD_DIELECTRIC_MODELS.COLD_PURE_ICE,
      detectedReflectors: [
        {
          id: 'ref-surf',
          peakIndex: 5,
          travelTimeSeconds: 0.00001,
          echoAmplitude: 0.95,
          estimatedDepthMetres: 0.0,
          depthUncertaintyMetres: 1.0,
          reflectionCoefficientEstimate: 0.85,
          reflectorTypeCandidate: 'SURFACE',
        },
        {
          id: 'ref-1',
          peakIndex: 15,
          travelTimeSeconds: 0.00004,
          echoAmplitude: 0.65,
          estimatedDepthMetres: 3400.0,
          depthUncertaintyMetres: 30.0,
          reflectionCoefficientEstimate: 0.52,
          reflectorTypeCandidate: 'BRINE_POCKET_CANDIDATE',
        },
      ],
      qualityFlags: ['LOW_SNR'], // Degraded radar signal!
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.REASON_DEPTH_DISCLAIMER,
    };

    const maspex: MaspexLevel2Product = {
      id: 'l2-m-qual',
      level1Id: 'l1-m-qual',
      level0PacketId: 'pkt-m-qual',
      instrument: 'MASPEX',
      processingMET: 505,
      acquisitionMET: 505,
      location: { latitudeDeg: 12.5, longitudeDeg: -45.0 },
      algorithmVersion: 'maspex-proc-v1.1',
      calibrationProfileVersion: 'maspex-cal-v1.0',
      sizeBytes: 12288,
      totalIonCurrent: 8000,
      basePeakMz: 18.01,
      basePeakIntensity: 6000,
      candidateSpecies: [
        {
          species: {
            id: 'CH4',
            formula: 'CH4',
            name: 'Methane',
            exactMassU: 16.0313,
            category: 'ORGANIC',
            provenance: 'VERIFIED',
            description: 'Methane',
          },
          observedMz: 16.031,
          exactMassU: 16.0313,
          massErrorU: 0.0003,
          massErrorPpm: 18.7,
          confidenceScore: 0.95,
          relativeAbundancePercent: 25.0,
          ticFraction: 0.22,
        },
      ],
      unidentifiedPeaks: [],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.MASPEX_SPECIES_DISCLAIMER,
    };

    // Low SNR on REASON rejects correlation
    expect(detector.evaluateMultiInstrumentCorrelation(reason, maspex, 510)).toBeNull();

    // Restoring REASON but marking MASPEX as SATURATED rejects correlation
    reason.qualityFlags = ['NOMINAL'];
    maspex.qualityFlags = ['SATURATED'];
    expect(detector.evaluateMultiInstrumentCorrelation(reason, maspex, 510)).toBeNull();

    // Marking MASPEX as CALIBRATION_SUSPECT rejects correlation
    maspex.qualityFlags = ['CALIBRATION_SUSPECT'];
    expect(detector.evaluateMultiInstrumentCorrelation(reason, maspex, 510)).toBeNull();
  });

  it('rejects correlation when provenance verification fails or observations are spatially separated (H-03)', () => {
    const registry = new ScienceDataRegistry();
    const detector = new AnomalyDetector(undefined, registry);

    const reason: ReasonLevel2Product = {
      id: 'l2-r-spat',
      level1Id: 'l1-r-spat',
      level0PacketId: 'pkt-r-spat',
      instrument: 'REASON',
      processingMET: 100,
      acquisitionMET: 100,
      location: { latitudeDeg: 10.0, longitudeDeg: 20.0 },
      algorithmVersion: 'reason-proc-v1.1',
      calibrationProfileVersion: 'reason-cal-v1.0',
      sizeBytes: 8192,
      surfaceEchoTimeSeconds: 0.0001,
      dielectricModelUsed: STANDARD_DIELECTRIC_MODELS.COLD_PURE_ICE,
      detectedReflectors: [
        {
          id: 'ref-surf',
          peakIndex: 5,
          travelTimeSeconds: 0.00001,
          echoAmplitude: 0.95,
          estimatedDepthMetres: 0.0,
          depthUncertaintyMetres: 1.0,
          reflectionCoefficientEstimate: 0.85,
          reflectorTypeCandidate: 'SURFACE',
        },
        {
          id: 'ref-1',
          peakIndex: 15,
          travelTimeSeconds: 0.00004,
          echoAmplitude: 0.65,
          estimatedDepthMetres: 3400.0,
          depthUncertaintyMetres: 30.0,
          reflectionCoefficientEstimate: 0.52,
          reflectorTypeCandidate: 'BRINE_POCKET_CANDIDATE',
        },
      ],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.REASON_DEPTH_DISCLAIMER,
    };

    const maspex: MaspexLevel2Product = {
      id: 'l2-m-spat',
      level1Id: 'l1-m-spat',
      level0PacketId: 'pkt-m-spat',
      instrument: 'MASPEX',
      processingMET: 110,
      acquisitionMET: 110,
      location: { latitudeDeg: 45.0, longitudeDeg: 80.0 }, // > 50 degrees away!
      algorithmVersion: 'maspex-proc-v1.1',
      calibrationProfileVersion: 'maspex-cal-v1.0',
      sizeBytes: 12288,
      totalIonCurrent: 8000,
      basePeakMz: 18.01,
      basePeakIntensity: 6000,
      candidateSpecies: [
        {
          species: {
            id: 'CH4',
            formula: 'CH4',
            name: 'Methane',
            exactMassU: 16.0313,
            category: 'ORGANIC',
            provenance: 'VERIFIED',
            description: 'Methane',
          },
          observedMz: 16.031,
          exactMassU: 16.0313,
          massErrorU: 0.0003,
          massErrorPpm: 18.7,
          confidenceScore: 0.95,
          relativeAbundancePercent: 25.0,
          ticFraction: 0.22,
        },
      ],
      unidentifiedPeaks: [],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.MASPEX_SPECIES_DISCLAIMER,
    };

    // 1. Provenance missing in registry: rejected!
    expect(
      detector.evaluateMultiInstrumentCorrelation(reason, maspex, 115, {
        registry,
        requireProvenanceVerification: true,
      })
    ).toBeNull();

    // 2. Spatial separation > 5.0 deg: rejected!
    expect(
      detector.evaluateMultiInstrumentCorrelation(reason, maspex, 115, {
        maxSpatialSeparationDeg: 5.0,
      })
    ).toBeNull();

    // 3. Location missing: mandatory check strictly rejects!
    const reasonNoLoc = { ...reason, location: undefined };
    expect(detector.evaluateMultiInstrumentCorrelation(reasonNoLoc, maspex, 115)).toBeNull();
  });

  it('enforces mandatory acquisitionMET and rejects missing, non-finite, negative or batch processing timestamps (C-01)', () => {
    const detector = new AnomalyDetector();

    const baseReason: ReasonLevel2Product = {
      id: 'l2-r-c01',
      level1Id: 'l1-r-c01',
      level0PacketId: 'pkt-r-c01',
      instrument: 'REASON',
      processingMET: 85000,
      acquisitionMET: 10000,
      location: { latitudeDeg: 12.0, longitudeDeg: 30.0 },
      algorithmVersion: 'reason-proc-v1.1',
      calibrationProfileVersion: 'reason-cal-v1.0',
      sizeBytes: 8192,
      surfaceEchoTimeSeconds: 0.0001,
      dielectricModelUsed: STANDARD_DIELECTRIC_MODELS.COLD_PURE_ICE,
      detectedReflectors: [
        {
          id: 'ref-surf',
          peakIndex: 5,
          travelTimeSeconds: 0.00001,
          echoAmplitude: 0.95,
          estimatedDepthMetres: 0.0,
          depthUncertaintyMetres: 1.0,
          reflectionCoefficientEstimate: 0.85,
          reflectorTypeCandidate: 'SURFACE',
        },
        {
          id: 'ref-1',
          peakIndex: 15,
          travelTimeSeconds: 0.00004,
          echoAmplitude: 0.65,
          estimatedDepthMetres: 3400.0,
          depthUncertaintyMetres: 30.0,
          reflectionCoefficientEstimate: 0.52,
          reflectorTypeCandidate: 'BRINE_POCKET_CANDIDATE',
        },
      ],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.REASON_DEPTH_DISCLAIMER,
    };

    const baseMaspex: MaspexLevel2Product = {
      id: 'l2-m-c01',
      level1Id: 'l1-m-c01',
      level0PacketId: 'pkt-m-c01',
      instrument: 'MASPEX',
      processingMET: 85000,
      acquisitionMET: 10100, // Contemporaneous (delta = 100s <= 600s)
      location: { latitudeDeg: 12.1, longitudeDeg: 30.1 },
      algorithmVersion: 'maspex-proc-v1.1',
      calibrationProfileVersion: 'maspex-cal-v1.0',
      sizeBytes: 12288,
      totalIonCurrent: 8000,
      basePeakMz: 18.01,
      basePeakIntensity: 6000,
      candidateSpecies: [
        {
          species: {
            id: 'CH4',
            formula: 'CH4',
            name: 'Methane',
            exactMassU: 16.0313,
            category: 'ORGANIC',
            provenance: 'VERIFIED',
            description: 'Methane',
          },
          observedMz: 16.031,
          exactMassU: 16.0313,
          massErrorU: 0.0003,
          massErrorPpm: 18.7,
          confidenceScore: 0.95,
          relativeAbundancePercent: 25.0,
          ticFraction: 0.22,
        },
      ],
      unidentifiedPeaks: [],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.MASPEX_SPECIES_DISCLAIMER,
    };

    // 1. Nominal contemporaneous observation: valid acquisitionMET on both -> accepted!
    const validReport = detector.evaluateMultiInstrumentCorrelation(baseReason, baseMaspex, 85000);
    expect(validReport).not.toBeNull();
    expect(validReport?.instrument).toBe('MULTI_INSTRUMENT');

    // 2. Missing REASON acquisitionMET -> strictly rejected (no fallback to processingMET!)
    const reasonMissingAcq = { ...baseReason, acquisitionMET: undefined };
    expect(detector.evaluateMultiInstrumentCorrelation(reasonMissingAcq, baseMaspex, 85000)).toBeNull();

    // 3. Missing MASPEX acquisitionMET -> strictly rejected
    const maspexMissingAcq = { ...baseMaspex, acquisitionMET: undefined };
    expect(detector.evaluateMultiInstrumentCorrelation(baseReason, maspexMissingAcq, 85000)).toBeNull();

    // 4. Both acquisitionMET missing -> strictly rejected
    expect(detector.evaluateMultiInstrumentCorrelation(reasonMissingAcq, maspexMissingAcq, 85000)).toBeNull();

    // 5. Batch processing scenario: Equal processingMET (85000s), but widely separated acquisitionMET (10000s vs 80000s) -> rejected!
    const maspexBatchOrbit2 = { ...baseMaspex, acquisitionMET: 80000, processingMET: 85000 };
    expect(detector.evaluateMultiInstrumentCorrelation(baseReason, maspexBatchOrbit2, 85000)).toBeNull();

    // 6. Invalid negative acquisitionMET -> strictly rejected
    const reasonNegativeAcq = { ...baseReason, acquisitionMET: -100 };
    expect(detector.evaluateMultiInstrumentCorrelation(reasonNegativeAcq, baseMaspex, 85000)).toBeNull();

    // 7. NaN and Infinity acquisitionMET -> strictly rejected
    const reasonNaNAcq = { ...baseReason, acquisitionMET: NaN };
    expect(detector.evaluateMultiInstrumentCorrelation(reasonNaNAcq, baseMaspex, 85000)).toBeNull();

    const maspexInfAcq = { ...baseMaspex, acquisitionMET: Infinity };
    expect(detector.evaluateMultiInstrumentCorrelation(baseReason, maspexInfAcq, 85000)).toBeNull();

    // 8. Exactly 600s boundary (delta = 600.0s == 600.0s) -> accepted!
    const maspexBoundary = { ...baseMaspex, acquisitionMET: 10600 };
    expect(detector.evaluateMultiInstrumentCorrelation(baseReason, maspexBoundary, 85000)).not.toBeNull();

    // 9. Beyond boundary (delta = 600.1s > 600.0s) -> rejected!
    const maspexBeyond = { ...baseMaspex, acquisitionMET: 10600.1 };
    expect(detector.evaluateMultiInstrumentCorrelation(baseReason, maspexBeyond, 85000)).toBeNull();

    // 10. Independent single-instrument detection continues to function when correlation is rejected
    const singleReasonReport = detector.analyzeProduct(reasonMissingAcq, 85000);
    expect(singleReasonReport).not.toBeNull();
    expect(singleReasonReport?.instrument).toBe('REASON');
  });

  it('enforces mandatory spatial co-location and validates coordinates defensively (C-02)', () => {
    const detector = new AnomalyDetector();

    const baseReason: ReasonLevel2Product = {
      id: 'l2-r-c02',
      level1Id: 'l1-r-c02',
      level0PacketId: 'pkt-r-c02',
      instrument: 'REASON',
      processingMET: 500,
      acquisitionMET: 500,
      location: { latitudeDeg: 0.0, longitudeDeg: 0.0 },
      algorithmVersion: 'reason-proc-v1.1',
      calibrationProfileVersion: 'reason-cal-v1.0',
      sizeBytes: 8192,
      surfaceEchoTimeSeconds: 0.0001,
      dielectricModelUsed: STANDARD_DIELECTRIC_MODELS.COLD_PURE_ICE,
      detectedReflectors: [
        {
          id: 'ref-surf',
          peakIndex: 5,
          travelTimeSeconds: 0.00001,
          echoAmplitude: 0.95,
          estimatedDepthMetres: 0.0,
          depthUncertaintyMetres: 1.0,
          reflectionCoefficientEstimate: 0.85,
          reflectorTypeCandidate: 'SURFACE',
        },
        {
          id: 'ref-1',
          peakIndex: 15,
          travelTimeSeconds: 0.00004,
          echoAmplitude: 0.65,
          estimatedDepthMetres: 3400.0,
          depthUncertaintyMetres: 30.0,
          reflectionCoefficientEstimate: 0.52,
          reflectorTypeCandidate: 'BRINE_POCKET_CANDIDATE',
        },
      ],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.REASON_DEPTH_DISCLAIMER,
    };

    const baseMaspex: MaspexLevel2Product = {
      id: 'l2-m-c02',
      level1Id: 'l1-m-c02',
      level0PacketId: 'pkt-m-c02',
      instrument: 'MASPEX',
      processingMET: 505,
      acquisitionMET: 505,
      location: { latitudeDeg: 0.0, longitudeDeg: 1.0 }, // separation = 1.0 deg <= 5.0 deg
      algorithmVersion: 'maspex-proc-v1.1',
      calibrationProfileVersion: 'maspex-cal-v1.0',
      sizeBytes: 12288,
      totalIonCurrent: 8000,
      basePeakMz: 18.01,
      basePeakIntensity: 6000,
      candidateSpecies: [
        {
          species: {
            id: 'CH4',
            formula: 'CH4',
            name: 'Methane',
            exactMassU: 16.0313,
            category: 'ORGANIC',
            provenance: 'VERIFIED',
            description: 'Methane',
          },
          observedMz: 16.031,
          exactMassU: 16.0313,
          massErrorU: 0.0003,
          massErrorPpm: 18.7,
          confidenceScore: 0.95,
          relativeAbundancePercent: 25.0,
          ticFraction: 0.22,
        },
      ],
      unidentifiedPeaks: [],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.MASPEX_SPECIES_DISCLAIMER,
    };

    // 1. Valid co-located observations (1.0 deg <= 5.0 deg) -> accepted!
    const validReport = detector.evaluateMultiInstrumentCorrelation(baseReason, baseMaspex, 510);
    expect(validReport).not.toBeNull();

    // 2. Observations exactly at boundary (5.0 deg == 5.0 deg) -> accepted!
    const maspexBoundary = { ...baseMaspex, location: { latitudeDeg: 0.0, longitudeDeg: 5.0 } };
    const boundaryReport = detector.evaluateMultiInstrumentCorrelation(baseReason, maspexBoundary, 510, {
      maxSpatialSeparationDeg: 5.0,
    });
    expect(boundaryReport).not.toBeNull();

    // 3. Observations beyond boundary (5.01 deg > 5.0 deg) -> rejected!
    const maspexBeyond = { ...baseMaspex, location: { latitudeDeg: 0.0, longitudeDeg: 5.01 } };
    expect(
      detector.evaluateMultiInstrumentCorrelation(baseReason, maspexBeyond, 510, {
        maxSpatialSeparationDeg: 5.0,
      })
    ).toBeNull();

    // 4. Opposite hemispheres (Lat 0, Lon 0 vs Lat 0, Lon 180 -> separation 180 deg) -> rejected!
    const maspexOpposite = { ...baseMaspex, location: { latitudeDeg: 0.0, longitudeDeg: 180.0 } };
    expect(detector.evaluateMultiInstrumentCorrelation(baseReason, maspexOpposite, 510)).toBeNull();

    // 5. Antimeridian longitude crossing (-179 deg and +179 deg -> separation = 2.0 deg <= 5.0 deg) -> accepted!
    const reasonAntimeridian = { ...baseReason, location: { latitudeDeg: 0.0, longitudeDeg: 179.0 } };
    const maspexAntimeridian = { ...baseMaspex, location: { latitudeDeg: 0.0, longitudeDeg: -179.0 } };
    const antimeridianReport = detector.evaluateMultiInstrumentCorrelation(reasonAntimeridian, maspexAntimeridian, 510);
    expect(antimeridianReport).not.toBeNull();

    // 6. Missing REASON location -> rejected!
    const reasonNoLoc = { ...baseReason, location: undefined };
    expect(detector.evaluateMultiInstrumentCorrelation(reasonNoLoc, baseMaspex, 510)).toBeNull();

    // 7. Missing MASPEX location -> rejected!
    const maspexNoLoc = { ...baseMaspex, location: undefined };
    expect(detector.evaluateMultiInstrumentCorrelation(baseReason, maspexNoLoc, 510)).toBeNull();

    // 8. NaN latitude -> rejected!
    const reasonNaNLat = { ...baseReason, location: { latitudeDeg: NaN, longitudeDeg: 0.0 } };
    expect(detector.evaluateMultiInstrumentCorrelation(reasonNaNLat, baseMaspex, 510)).toBeNull();

    // 9. NaN longitude -> rejected!
    const maspexNaNLon = { ...baseMaspex, location: { latitudeDeg: 0.0, longitudeDeg: NaN } };
    expect(detector.evaluateMultiInstrumentCorrelation(baseReason, maspexNaNLon, 510)).toBeNull();

    // 10. Infinity coordinate -> rejected!
    const reasonInf = { ...baseReason, location: { latitudeDeg: Infinity, longitudeDeg: 0.0 } };
    expect(detector.evaluateMultiInstrumentCorrelation(reasonInf, baseMaspex, 510)).toBeNull();

    // 11. Out-of-range latitude (> +90 deg or < -90 deg) -> rejected!
    const reasonOverLat = { ...baseReason, location: { latitudeDeg: 95.0, longitudeDeg: 0.0 } };
    expect(detector.evaluateMultiInstrumentCorrelation(reasonOverLat, baseMaspex, 510)).toBeNull();

    const maspexUnderLat = { ...baseMaspex, location: { latitudeDeg: -95.0, longitudeDeg: 0.0 } };
    expect(detector.evaluateMultiInstrumentCorrelation(baseReason, maspexUnderLat, 510)).toBeNull();

    // 12. Out-of-range longitude (> +180 deg or < -180 deg) -> rejected!
    const reasonOverLon = { ...baseReason, location: { latitudeDeg: 0.0, longitudeDeg: 200.0 } };
    expect(detector.evaluateMultiInstrumentCorrelation(reasonOverLon, baseMaspex, 510)).toBeNull();

    const maspexUnderLon = { ...baseMaspex, location: { latitudeDeg: 0.0, longitudeDeg: -190.0 } };
    expect(detector.evaluateMultiInstrumentCorrelation(baseReason, maspexUnderLon, 510)).toBeNull();

    // 13. Independent single-instrument detection still works when correlation is rejected due to spatial separation
    const singleReport = detector.analyzeProduct(baseReason, 510);
    expect(singleReport).not.toBeNull();
    expect(singleReport?.instrument).toBe('REASON');
  });

  it('evaluates Haversine angular separation with complete numerical stability and symmetry (N-01)', () => {
    // 1. Identical coordinates -> exact 0.0 (eliminating law-of-cosines 8.5e-7 drift!)
    const p1 = { latitudeDeg: 10.0, longitudeDeg: 20.0 };
    expect(calculateAngularSeparationDeg(p1, p1)).toBe(0);

    // 2. Very small separation (0.000001 deg) -> exact within float64 precision
    const pTiny = { latitudeDeg: 10.000001, longitudeDeg: 20.0 };
    expect(calculateAngularSeparationDeg(p1, pTiny)).toBeCloseTo(0.000001, 8);

    // 3. Ordinary short separation
    const pShort = { latitudeDeg: 10.3, longitudeDeg: 20.4 };
    const distShort = calculateAngularSeparationDeg(p1, pShort);
    expect(distShort).toBeGreaterThan(0.4);
    expect(distShort).toBeLessThan(0.6);

    // 4. Antimeridian crossing (-180 / +180 boundary)
    const pAntiEast = { latitudeDeg: 0.0, longitudeDeg: 179.0 };
    const pAntiWest = { latitudeDeg: 0.0, longitudeDeg: -179.0 };
    expect(calculateAngularSeparationDeg(pAntiEast, pAntiWest)).toBeCloseTo(2.0, 8);

    // 5. Near-polar coordinates
    const pPoleA = { latitudeDeg: 89.9, longitudeDeg: 0.0 };
    const pPoleB = { latitudeDeg: 89.9, longitudeDeg: 180.0 };
    expect(calculateAngularSeparationDeg(pPoleA, pPoleB)).toBeCloseTo(0.2, 8);

    // 6. Near-antipodal coordinates
    const pAntiPodal = { latitudeDeg: -10.0, longitudeDeg: -160.0 };
    expect(calculateAngularSeparationDeg(p1, pAntiPodal)).toBeCloseTo(180.0, 4);

    // 7. Strict symmetry: separation(A, B) == separation(B, A)
    const locA = { latitudeDeg: 12.345, longitudeDeg: -45.678 };
    const locB = { latitudeDeg: -67.89, longitudeDeg: 123.456 };
    expect(calculateAngularSeparationDeg(locA, locB)).toBe(calculateAngularSeparationDeg(locB, locA));
  });

  it('validates correlation thresholds and rejects invalid explicit values with RangeError (N-02)', () => {
    const detector = new AnomalyDetector();

    const reason: ReasonLevel2Product = {
      id: 'l2-r-n02',
      level1Id: 'l1-r-n02',
      level0PacketId: 'pkt-r-n02',
      instrument: 'REASON',
      processingMET: 500,
      acquisitionMET: 500,
      location: { latitudeDeg: 0.0, longitudeDeg: 0.0 },
      algorithmVersion: 'reason-proc-v1.1',
      calibrationProfileVersion: 'reason-cal-v1.0',
      sizeBytes: 8192,
      surfaceEchoTimeSeconds: 0.0001,
      dielectricModelUsed: STANDARD_DIELECTRIC_MODELS.COLD_PURE_ICE,
      detectedReflectors: [
        {
          id: 'ref-surf',
          peakIndex: 5,
          travelTimeSeconds: 0.00001,
          echoAmplitude: 0.95,
          estimatedDepthMetres: 0.0,
          depthUncertaintyMetres: 1.0,
          reflectionCoefficientEstimate: 0.85,
          reflectorTypeCandidate: 'SURFACE',
        },
        {
          id: 'ref-1',
          peakIndex: 15,
          travelTimeSeconds: 0.00004,
          echoAmplitude: 0.65,
          estimatedDepthMetres: 3400.0,
          depthUncertaintyMetres: 30.0,
          reflectionCoefficientEstimate: 0.52,
          reflectorTypeCandidate: 'BRINE_POCKET_CANDIDATE',
        },
      ],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.REASON_DEPTH_DISCLAIMER,
    };

    const maspex: MaspexLevel2Product = {
      id: 'l2-m-n02',
      level1Id: 'l1-m-n02',
      level0PacketId: 'pkt-m-n02',
      instrument: 'MASPEX',
      processingMET: 500,
      acquisitionMET: 500,
      location: { latitudeDeg: 0.0, longitudeDeg: 0.0 },
      algorithmVersion: 'maspex-proc-v1.1',
      calibrationProfileVersion: 'maspex-cal-v1.0',
      sizeBytes: 12288,
      totalIonCurrent: 8000,
      basePeakMz: 18.01,
      basePeakIntensity: 6000,
      candidateSpecies: [
        {
          species: {
            id: 'CH4',
            formula: 'CH4',
            name: 'Methane',
            exactMassU: 16.0313,
            category: 'ORGANIC',
            provenance: 'VERIFIED',
            description: 'Methane',
          },
          observedMz: 16.031,
          exactMassU: 16.0313,
          massErrorU: 0.0003,
          massErrorPpm: 18.7,
          confidenceScore: 0.95,
          relativeAbundancePercent: 25.0,
          ticFraction: 0.22,
        },
      ],
      unidentifiedPeaks: [],
      qualityFlags: ['NOMINAL'],
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.MASPEX_SPECIES_DISCLAIMER,
    };

    // 1. maxCorrelationDeltaMET validation
    // NaN
    expect(() => {
      detector.evaluateMultiInstrumentCorrelation(reason, maspex, 500, {
        maxCorrelationDeltaMET: NaN,
      });
    }).toThrow(RangeError);

    // Infinity and -Infinity
    expect(() => {
      detector.evaluateMultiInstrumentCorrelation(reason, maspex, 500, {
        maxCorrelationDeltaMET: Infinity,
      });
    }).toThrow(RangeError);

    expect(() => {
      detector.evaluateMultiInstrumentCorrelation(reason, maspex, 500, {
        maxCorrelationDeltaMET: -Infinity,
      });
    }).toThrow(RangeError);

    // Negative threshold (< 0)
    expect(() => {
      detector.evaluateMultiInstrumentCorrelation(reason, maspex, 500, {
        maxCorrelationDeltaMET: -10,
      });
    }).toThrow(RangeError);

    // Zero threshold is VALID and requires exact timestamp equality
    expect(
      detector.evaluateMultiInstrumentCorrelation(reason, maspex, 500, {
        maxCorrelationDeltaMET: 0,
      })
    ).not.toBeNull();

    // With zero threshold, non-zero delta is rejected
    const maspexOffsetTime = { ...maspex, acquisitionMET: 501 };
    expect(
      detector.evaluateMultiInstrumentCorrelation(reason, maspexOffsetTime, 500, {
        maxCorrelationDeltaMET: 0,
      })
    ).toBeNull();

    // 2. maxSpatialSeparationDeg validation
    // NaN
    expect(() => {
      detector.evaluateMultiInstrumentCorrelation(reason, maspex, 500, {
        maxSpatialSeparationDeg: NaN,
      });
    }).toThrow(RangeError);

    // Infinity and -Infinity
    expect(() => {
      detector.evaluateMultiInstrumentCorrelation(reason, maspex, 500, {
        maxSpatialSeparationDeg: Infinity,
      });
    }).toThrow(RangeError);

    expect(() => {
      detector.evaluateMultiInstrumentCorrelation(reason, maspex, 500, {
        maxSpatialSeparationDeg: -Infinity,
      });
    }).toThrow(RangeError);

    // Negative threshold (< 0)
    expect(() => {
      detector.evaluateMultiInstrumentCorrelation(reason, maspex, 500, {
        maxSpatialSeparationDeg: -1,
      });
    }).toThrow(RangeError);

    // Above 180 degrees (> 180)
    expect(() => {
      detector.evaluateMultiInstrumentCorrelation(reason, maspex, 500, {
        maxSpatialSeparationDeg: 180.1,
      });
    }).toThrow(RangeError);

    expect(() => {
      detector.evaluateMultiInstrumentCorrelation(reason, maspex, 500, {
        maxSpatialSeparationDeg: 200,
      });
    }).toThrow(RangeError);

    // Zero spatial threshold is VALID and requires exact coordinate equality
    expect(
      detector.evaluateMultiInstrumentCorrelation(reason, maspex, 500, {
        maxSpatialSeparationDeg: 0,
      })
    ).not.toBeNull();

    // With zero spatial threshold, separated observation is rejected
    const maspexSeparated = { ...maspex, location: { latitudeDeg: 0.0, longitudeDeg: 0.1 } };
    expect(
      detector.evaluateMultiInstrumentCorrelation(reason, maspexSeparated, 500, {
        maxSpatialSeparationDeg: 0,
      })
    ).toBeNull();

    // Boundary 180 degrees is VALID
    expect(
      detector.evaluateMultiInstrumentCorrelation(reason, maspex, 500, {
        maxSpatialSeparationDeg: 180,
      })
    ).not.toBeNull();

    // 3. Omitted options use existing nominal defaults (600s, 5.0 deg)
    expect(detector.evaluateMultiInstrumentCorrelation(reason, maspex, 500)).not.toBeNull();
  });
});
