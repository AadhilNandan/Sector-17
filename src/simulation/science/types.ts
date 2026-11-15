/**
 * SECTOR 17 — Science Data Processing Types
 * Defines comprehensive interfaces and type contracts for:
 * - Science Instruments (REASON, MASPEX)
 * - Level 0: Raw Ingestion and Packet Validation
 * - Level 1: Calibration, Filtering, and Quality Assessment
 * - Level 2: Derived Scientific Products (Radar Echo Depth Profiles, Mass Spectra Species)
 * - Scientific Anomalies, Provenance Tracking, and Processing Events
 */

import type { DataCategory } from '../communications/types';

export type InstrumentType = 'REASON' | 'MASPEX';

export type ScienceDataLevel = 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2';

export type IngestionStatus =
  | 'RECEIVED'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'REJECTED';

export type QualityFlag =
  | 'NOMINAL'
  | 'DEGRADED'
  | 'LOW_SNR'
  | 'SATURATED'
  | 'BASELINE_DRIFT'
  | 'CALIBRATION_SUSPECT'
  | 'UNRESOLVED_PEAKS'
  | 'LIMITED_BANDWIDTH';

export type ScientificProvenanceTag = 'VERIFIED' | 'SIMPLIFIED' | 'FICTIONAL';

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/* -------------------------------------------------------------------------- */
/* Level 0 — Raw Instrument Data                                              */
/* -------------------------------------------------------------------------- */

export interface ReasonRawPayload {
  centerFrequencyHz: number;
  samplingIntervalSeconds: number;
  pulseBandwidthHz: number;
  transmitPowerWatts: number;
  echoSamples: number[];
  transmitTimeMET: number;
  receiveTimeMET: number;
  sampleCount: number;
  chirpDurationSeconds?: number;
  antennaGainDb?: number;
  checksum?: number;
}

export interface MaspexRawSample {
  mz: number;
  intensity: number;
}

export interface MaspexRawPayload {
  ionizationMode: 'ELECTRON_IMPACT' | 'ION_EXTRACTION';
  massRangeU: [number, number];
  integrationTimeSeconds: number;
  detectorGain: number;
  mzSamples: MaspexRawSample[];
  sampleCount: number;
  acquisitionMET: number;
  calibrantGasReferenceMz?: number;
  checksum?: number;
}

export interface Level0Product<T = ReasonRawPayload | MaspexRawPayload | Record<string, unknown>> {
  id: string;
  instrument: InstrumentType | string;
  packetId: string;
  category: DataCategory;
  acquisitionMET: number;
  ingestionMET: number;
  status: IngestionStatus;
  sizeBytes: number;
  rawPayload: Readonly<T>;
  checksumValid: boolean;
  validationError?: string;
  sourceStorageId?: string;
}

/* -------------------------------------------------------------------------- */
/* Level 1 — Calibrated Instrument Data                                       */
/* -------------------------------------------------------------------------- */

export interface CalibrationProfile {
  version: string;
  instrument: InstrumentType;
  baselineOffset: number;
  gainMultiplier: number;
  noiseThreshold: number;
  axisCalibrationPolynomial?: number[]; // e.g. [a0, a1] for linear correction: y = a1*x + a0
  validFromMET?: number;
  validToMET?: number;
  description: string;
  provenance: ScientificProvenanceTag;
}

export interface ReasonCalibratedData {
  calibratedEchoes: number[];
  timeBinsSeconds: number[];
  samplingIntervalSeconds: number;
  baselineNoiseFloor: number;
  peakSnrDb: number;
  saturationDetected: boolean;
}

export interface MaspexDetectedPeak {
  mz: number;
  intensity: number;
  fwhm: number;
  snr: number;
  resolution: number; // m / delta_m
}

export interface MaspexCalibratedData {
  calibratedSpectra: Array<{ mz: number; intensity: number; snr: number }>;
  detectedPeaks: MaspexDetectedPeak[];
  baselineNoiseFloor: number;
  peakCount: number;
  saturationDetected: boolean;
  resolutionEstimate: number;
}

export interface Level1Product<T = ReasonCalibratedData | MaspexCalibratedData> {
  id: string;
  level0Id: string;
  packetId: string;
  instrument: InstrumentType;
  calibrationProfileVersion: string;
  processingMET: number;
  sizeBytes: number;
  calibratedData: T;
  qualityFlags: QualityFlag[];
  snrDb: number;
  baselineOffsetRemoved: number;
  gainApplied: number;
}

/* -------------------------------------------------------------------------- */
/* Level 2 — Derived Science Products                                         */
/* -------------------------------------------------------------------------- */

export interface DielectricModel {
  name: string;
  relativePermittivity: number; // \epsilon_r
  permittivityUncertainty: number; // \pm \Delta \epsilon_r
  lossTangent?: number;
  description: string;
  provenance: ScientificProvenanceTag;
}

export type RadarReflectorCandidateType =
  | 'SURFACE'
  | 'SHALLOW_ICE_FEATURE'
  | 'BRINE_POCKET_CANDIDATE'
  | 'INTERNAL_HORIZON'
  | 'BASAL_INTERFACE_CANDIDATE'
  | 'UNKNOWN_STRUCTURAL_ANOMALY';

export interface RadarReflector {
  id: string;
  peakIndex: number;
  travelTimeSeconds: number; // \Delta\tau from surface echo
  echoAmplitude: number;
  estimatedDepthMetres: number;
  depthUncertaintyMetres: number; // 1-sigma RSS propagated uncertainty [m]
  worstCaseDepthUncertaintyMetres?: number; // Conservative linear upper bound [m]
  reflectionCoefficientEstimate: number; // |R|^2
  reflectorTypeCandidate: RadarReflectorCandidateType;
}

export interface ReasonLevel2Product {
  id: string;
  level1Id: string;
  level0PacketId: string;
  instrument: 'REASON';
  processingMET: number;
  acquisitionMET?: number;
  location?: { latitudeDeg: number; longitudeDeg: number };
  algorithmVersion: string;
  calibrationProfileVersion: string;
  sizeBytes: number;
  surfaceEchoTimeSeconds: number;
  dielectricModelUsed: DielectricModel;
  detectedReflectors: RadarReflector[];
  estimatedIceThicknessCandidateMetres?: number;
  qualityFlags: QualityFlag[];
  limitationsDisclaimer: string;
}

export interface ReferenceChemicalSpecies {
  id: string;
  formula: string;
  name: string;
  exactMassU: number; // Unified atomic mass units (Da)
  category: 'VOLATILE' | 'ORGANIC' | 'SALINE' | 'MINERAL' | 'EXOTIC';
  provenance: ScientificProvenanceTag;
  description: string;
  toleranceU?: number;
}

/**
 * Tolerance policy mode for MASPEX mass spectrometry candidate matching (C-03):
 * - 'COMBINED' (default): Requires candidate species to satisfy both absolute tolerance
 *   (|m_obs - m_ref| <= toleranceU, default 0.02 u) AND relative tolerance
 *   ((|m_obs - m_ref| / m_ref) * 1e6 <= maxTolerancePpm, default 50.0 ppm).
 * - 'ABSOLUTE_ONLY': Evaluates purely against absolute atomic mass tolerance.
 * - 'PPM_ONLY': Evaluates purely against relative parts-per-million tolerance.
 */
export type MaspexToleranceMode = 'ABSOLUTE_ONLY' | 'PPM_ONLY' | 'COMBINED';

export interface CandidateSpeciesMatch {
  species: ReferenceChemicalSpecies;
  observedMz: number;
  exactMassU: number;
  massErrorU: number;
  massErrorPpm: number;
  confidenceScore: number; // 0.0 - 1.0
  relativeAbundancePercent: number; // % of base peak
  ticFraction: number; // Fraction of Total Ion Current
}

export interface MaspexLevel2Product {
  id: string;
  level1Id: string;
  level0PacketId: string;
  instrument: 'MASPEX';
  processingMET: number;
  acquisitionMET?: number;
  location?: { latitudeDeg: number; longitudeDeg: number };
  algorithmVersion: string;
  calibrationProfileVersion: string;
  sizeBytes: number;
  totalIonCurrent: number;
  basePeakMz: number;
  basePeakIntensity: number;
  candidateSpecies: CandidateSpeciesMatch[];
  unidentifiedPeaks: Array<{ mz: number; intensity: number; snr: number }>;
  qualityFlags: QualityFlag[];
  limitationsDisclaimer: string;
}

export type ScienceProductLevel2 = ReasonLevel2Product | MaspexLevel2Product;

/* -------------------------------------------------------------------------- */
/* Scientific Anomalies                                                       */
/* -------------------------------------------------------------------------- */

export interface AnomalyTriggerMetric {
  metricName: string;
  observedValue: number | string;
  thresholdValue: number | string;
  differenceRatio?: number;
  description: string;
}

export interface ScienceAnomalyReport {
  id: string;
  title: string;
  instrument: InstrumentType | 'MULTI_INSTRUMENT';
  detectedAtMET: number;
  severity: AnomalySeverity;
  confidenceScore: number; // 0.0 - 1.0
  sourceProductIds: string[];
  sourcePacketIds: string[];
  triggeredMetrics: AnomalyTriggerMetric[];
  explanation: string;
  isFictionalScenarioAnomaly: boolean;
  scientificDisclaimer: string;
}

/* -------------------------------------------------------------------------- */
/* Pipeline Configuration & Status                                            */
/* -------------------------------------------------------------------------- */

export interface ScienceProcessingConfig {
  autoProcessLevel1?: boolean;
  autoProcessLevel2?: boolean;
  autoDetectAnomalies?: boolean;
  defaultPermittivityModel?: string;
  processingDurationSeconds?: number;
  maspexTolerancePpm?: number;
}

export interface ScienceProcessingStatus {
  totalLevel0PacketsIngested: number;
  totalLevel1Calibrated: number;
  totalLevel2ProductsGenerated: number;
  totalAnomaliesDetected: number;
  activeProcessingTasks: number;
  instrumentStatus: Record<InstrumentType, 'STANDBY' | 'ACQUIRING' | 'PROCESSING' | 'OFF' | 'FAULT'>;
}

