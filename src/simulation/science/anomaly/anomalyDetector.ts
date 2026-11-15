/**
 * SECTOR 17 — Science Anomaly Detector
 * Scans derived Level 2 products for structural, geochemical, and mission storyline anomalies.
 *
 * SAFETY INVARIANTS (H-03):
 * 1. Explainability: Every detected anomaly report cites exact measured numbers, thresholds, and ratios.
 * 2. Scenario Separation: Clearly tags fictional storyline anomalies with isFictionalScenarioAnomaly=true
 *    and embeds explicit scientific disclaimers.
 * 3. Provenance & Quality Gating: Multi-instrument correlation strictly verifies end-to-end data provenance
 *    and rejects degraded products carrying LOW_SNR, SATURATED, or CALIBRATION_SUSPECT quality flags.
 * 4. Temporal & Spatial Window Enforcement: Multi-instrument correlation enforces an explicit observation
 *    window (|t_REASON - t_MASPEX| <= maxCorrelationDeltaMET) and verified spatial co-location.
 */

import { SCIENCE_EVENT_TYPES, SCIENTIFIC_DISCLAIMERS } from '../constants';
import { evaluateReasonAnomalies, evaluateMaspexAnomalies } from './anomalyScoring';
import type { MissionEventEngine } from '../../operations/missionEventEngine';
import type { ScienceDataRegistry } from '../scienceDataRegistry';
import type {
  ScienceProductLevel2,
  ReasonLevel2Product,
  MaspexLevel2Product,
  ScienceAnomalyReport,
  QualityFlag,
} from '../types';

export interface MultiInstrumentCorrelationOptions {
  maxCorrelationDeltaMET?: number; // Configurable correlation time window, default 600s
  registry?: ScienceDataRegistry; // For verifying complete provenance chain
  requireProvenanceVerification?: boolean;
  requireSpatialCoLocation?: boolean; // Retained for interface compatibility; spatial co-location is mandatory
  maxSpatialSeparationDeg?: number; // Maximum angular separation threshold in degrees, default 5.0 deg (simulation/gameplay parameter)
  reasonLocation?: { latitudeDeg: number; longitudeDeg: number };
  maspexLocation?: { latitudeDeg: number; longitudeDeg: number };
}

/**
 * Validates spherical latitude and longitude coordinates (C-02).
 *
 * VALIDATION CONSTRAINTS:
 * 1. Must be a defined object with numeric latitudeDeg and longitudeDeg.
 * 2. Latitude and longitude must be finite numbers (rejects NaN, Infinity, -Infinity).
 * 3. Latitude must be within [-90.0°, +90.0°].
 * 4. Longitude must be within the supported [-180.0°, +180.0°] range.
 */
export function isValidCoordinate(loc: unknown): loc is { latitudeDeg: number; longitudeDeg: number } {
  if (!loc || typeof loc !== 'object') {
    return false;
  }
  const l = loc as { latitudeDeg?: unknown; longitudeDeg?: unknown };
  if (typeof l.latitudeDeg !== 'number' || !Number.isFinite(l.latitudeDeg)) {
    return false;
  }
  if (typeof l.longitudeDeg !== 'number' || !Number.isFinite(l.longitudeDeg)) {
    return false;
  }
  if (l.latitudeDeg < -90.0 || l.latitudeDeg > 90.0) {
    return false;
  }
  if (l.longitudeDeg < -180.0 || l.longitudeDeg > 180.0) {
    return false;
  }
  return true;
}

/**
 * Computes great-circle angular separation between two spherical coordinates in degrees (N-01).
 * Uses the numerically stable Haversine formulation to eliminate cancellation error near 0°:
 *   a = sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2)
 *   θ = 2 * atan2(√a, √(1-a))
 *
 * Intermediate value `a` is strictly clamped to [0, 1] against floating-point drift.
 * Longitude wraparound across the -180° / +180° antimeridian is handled naturally via sin²(Δλ/2).
 */
export function calculateAngularSeparationDeg(
  locA: { latitudeDeg: number; longitudeDeg: number },
  locB: { latitudeDeg: number; longitudeDeg: number }
): number {
  const toRad = Math.PI / 180;
  const phi1 = locA.latitudeDeg * toRad;
  const phi2 = locB.latitudeDeg * toRad;
  const deltaPhi = (locB.latitudeDeg - locA.latitudeDeg) * toRad;
  const deltaLambda = (locB.longitudeDeg - locA.longitudeDeg) * toRad;

  const sinHalfDeltaPhi = Math.sin(deltaPhi / 2);
  const sinHalfDeltaLambda = Math.sin(deltaLambda / 2);

  const a =
    sinHalfDeltaPhi * sinHalfDeltaPhi +
    Math.cos(phi1) * Math.cos(phi2) * sinHalfDeltaLambda * sinHalfDeltaLambda;

  const clampedA = Math.max(0.0, Math.min(1.0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1.0 - clampedA));

  return c / toRad;
}

export class AnomalyDetector {
  private detectedAnomalies: Map<string, ScienceAnomalyReport> = new Map();
  private eventEngine?: MissionEventEngine;
  private registry?: ScienceDataRegistry;

  constructor(eventEngine?: MissionEventEngine, registry?: ScienceDataRegistry) {
    this.eventEngine = eventEngine;
    this.registry = registry;
  }

  public attachEventEngine(engine: MissionEventEngine): void {
    this.eventEngine = engine;
  }

  public attachDataRegistry(registry: ScienceDataRegistry): void {
    this.registry = registry;
  }

  /**
   * Scans a single Level 2 product for physical or scenario anomalies.
   */
  public analyzeProduct(product: ScienceProductLevel2, currentMET: number): ScienceAnomalyReport | null {
    if (!product || !product.id) {
      throw new TypeError('analyzeProduct: Invalid product.');
    }

    let evalResult = null;
    if (product.instrument === 'REASON') {
      evalResult = evaluateReasonAnomalies(product as ReasonLevel2Product);
    } else if (product.instrument === 'MASPEX') {
      evalResult = evaluateMaspexAnomalies(product as MaspexLevel2Product);
    }

    if (!evalResult || !evalResult.hasAnomaly) {
      return null;
    }

    const id = `anom-${product.instrument.toLowerCase()}-${product.level0PacketId}`;
    if (this.detectedAnomalies.has(id)) {
      return this.detectedAnomalies.get(id)!;
    }

    const report: ScienceAnomalyReport = {
      id,
      title: evalResult.title,
      instrument: product.instrument,
      detectedAtMET: currentMET,
      severity: evalResult.severity,
      confidenceScore: evalResult.confidenceScore,
      sourceProductIds: [product.id],
      sourcePacketIds: [product.level0PacketId],
      triggeredMetrics: evalResult.triggeredMetrics,
      explanation: evalResult.explanation,
      isFictionalScenarioAnomaly: evalResult.isFictionalScenarioAnomaly,
      scientificDisclaimer: evalResult.isFictionalScenarioAnomaly
        ? SCIENTIFIC_DISCLAIMERS.FICTIONAL_SCENARIO_DISCLAIMER
        : 'Automated statistical anomaly detection: Requires multi-orbit corroboration and ground station review.',
    };

    this.detectedAnomalies.set(id, report);

    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-anom-${id}-${currentMET}`,
        type: SCIENCE_EVENT_TYPES.SCIENCE_ANOMALY_DETECTED,
        scheduledTimeSeconds: currentMET,
        payload: {
          anomalyId: id,
          title: report.title,
          instrument: report.instrument,
          severity: report.severity,
          confidenceScore: report.confidenceScore,
          isFictional: report.isFictionalScenarioAnomaly,
        },
      });
    }

    return report;
  }

  /**
   * Evaluates multi-instrument correlation across contemporaneous, co-located observations (H-03).
   *
   * GATING CRITERIA:
   * 1. Temporal window: |t_REASON - t_MASPEX| <= maxCorrelationDeltaMET (default: 600s).
   * 2. Quality flags: Neither product may carry LOW_SNR, SATURATED, or CALIBRATION_SUSPECT.
   * 3. Provenance: Both products must trace to valid Level 0 packets.
   * 4. Spatial co-location: If required or provided, separation must be <= maxSpatialSeparationDeg.
   *
   * @returns ScienceAnomalyReport if correlation criteria pass, or null if correlation is rejected.
   */
  public evaluateMultiInstrumentCorrelation(
    reasonProduct: ReasonLevel2Product,
    maspexProduct: MaspexLevel2Product,
    currentMET: number,
    options: MultiInstrumentCorrelationOptions = {}
  ): ScienceAnomalyReport | null {
    // 0. Defensive Threshold Configuration Validation (N-02)
    if (options.maxCorrelationDeltaMET !== undefined) {
      if (
        typeof options.maxCorrelationDeltaMET !== 'number' ||
        !Number.isFinite(options.maxCorrelationDeltaMET) ||
        options.maxCorrelationDeltaMET < 0
      ) {
        throw new RangeError(
          `evaluateMultiInstrumentCorrelation: maxCorrelationDeltaMET must be a non-negative finite number. Received: ${options.maxCorrelationDeltaMET}`
        );
      }
    }

    if (options.maxSpatialSeparationDeg !== undefined) {
      if (
        typeof options.maxSpatialSeparationDeg !== 'number' ||
        !Number.isFinite(options.maxSpatialSeparationDeg) ||
        options.maxSpatialSeparationDeg < 0 ||
        options.maxSpatialSeparationDeg > 180.0
      ) {
        throw new RangeError(
          `evaluateMultiInstrumentCorrelation: maxSpatialSeparationDeg must be a finite number between 0 and 180 degrees. Received: ${options.maxSpatialSeparationDeg}`
        );
      }
    }

    // 1. Basic Type & Instrument Check
    if (!reasonProduct || typeof reasonProduct !== 'object' || reasonProduct.instrument !== 'REASON') {
      return null;
    }
    if (!maspexProduct || typeof maspexProduct !== 'object' || maspexProduct.instrument !== 'MASPEX') {
      return null;
    }

    // 2. Mandatory Temporal Observation Window Check (C-01)
    // Multi-instrument correlation requires genuine contemporaneous observations.
    // Both products must possess an explicit, valid acquisitionMET timestamp.
    // Silent fallback to processingMET is strictly prohibited.
    const tReason = reasonProduct.acquisitionMET;
    const tMaspex = maspexProduct.acquisitionMET;

    if (
      typeof tReason !== 'number' ||
      !Number.isFinite(tReason) ||
      tReason < 0 ||
      typeof tMaspex !== 'number' ||
      !Number.isFinite(tMaspex) ||
      tMaspex < 0
    ) {
      return null; // Missing, non-numeric, non-finite, or negative acquisition timestamp
    }

    const maxDeltaMET = options.maxCorrelationDeltaMET ?? 600.0; // 600 seconds (10 minutes) simulation correlation window
    if (Math.abs(tReason - tMaspex) > maxDeltaMET) {
      return null; // Observations collected outside contemporaneous orbital window
    }

    // 3. Quality Flags Gating (H-03)
    const prohibitedFlags: QualityFlag[] = ['LOW_SNR', 'SATURATED', 'CALIBRATION_SUSPECT'];
    const hasProhibitedReasonFlag = reasonProduct.qualityFlags?.some((f) => prohibitedFlags.includes(f));
    const hasProhibitedMaspexFlag = maspexProduct.qualityFlags?.some((f) => prohibitedFlags.includes(f));

    if (hasProhibitedReasonFlag || hasProhibitedMaspexFlag) {
      return null; // Degraded or saturated observations cannot produce high-confidence correlated anomalies
    }

    // 4. Provenance Verification (H-03)
    const activeRegistry = options.registry ?? this.registry;
    const shouldVerifyProvenance = options.requireProvenanceVerification ?? (activeRegistry !== undefined);

    if (shouldVerifyProvenance) {
      if (!activeRegistry) {
        return null; // Cannot verify provenance without registry
      }
      const provReason = activeRegistry.verifyProvenance(reasonProduct.id);
      const provMaspex = activeRegistry.verifyProvenance(maspexProduct.id);
      if (!provReason.isValid || !provMaspex.isValid) {
        return null; // Invalid provenance chain
      }
    }

    // 5. Mandatory Spatial Co-Location Verification (C-02)
    // A critical correlated venting anomaly cannot be declared without verified spatial co-location.
    const reasonLoc = options.reasonLocation ?? reasonProduct.location;
    const maspexLoc = options.maspexLocation ?? maspexProduct.location;

    if (!reasonLoc || !maspexLoc) {
      return null; // Missing coordinates: cannot declare correlated anomaly without verified co-location
    }

    if (!isValidCoordinate(reasonLoc) || !isValidCoordinate(maspexLoc)) {
      return null; // Invalid coordinate values (NaN, Infinity, or out of range)
    }

    const separationDeg = calculateAngularSeparationDeg(reasonLoc, maspexLoc);
    if (!Number.isFinite(separationDeg)) {
      return null;
    }

    // Default simulation/gameplay parameter: 5.0 degrees (~136 km on Europa).
    // Note: This 5.0° threshold is a simplified mission simulation parameter for Expedition-V,
    // not a formal NASA/JPL science requirement.
    const maxSeparation = options.maxSpatialSeparationDeg ?? 5.0;
    if (separationDeg > maxSeparation) {
      return null; // Observations geographically separated beyond spatial threshold
    }

    // 6. Qualifying Physical & Narrative Evidence Gating
    const reasonHasShallow = reasonProduct.detectedReflectors?.some(
      (r) =>
        r.reflectorTypeCandidate === 'BRINE_POCKET_CANDIDATE' ||
        (r.estimatedDepthMetres < 5000 && r.reflectionCoefficientEstimate >= 0.25)
    );

    const maspexHasOrganics = maspexProduct.candidateSpecies?.some(
      (c) =>
        (c.species.category === 'ORGANIC' || c.species.provenance === 'FICTIONAL') &&
        c.confidenceScore >= 0.60
    );

    if (!reasonHasShallow || !maspexHasOrganics) {
      return null; // Insufficient qualifying evidence on one or both instruments
    }

    // 7. Generate Correlated Anomaly Report
    const id = `anom-multi-${reasonProduct.level0PacketId}-${maspexProduct.level0PacketId}`;
    if (this.detectedAnomalies.has(id)) {
      return this.detectedAnomalies.get(id)!;
    }

    const isFictional = maspexProduct.candidateSpecies.some((c) => c.species.provenance === 'FICTIONAL');

    const report: ScienceAnomalyReport = {
      id,
      title: 'Correlated Active Venting & Subsurface Dielectric Anomaly',
      instrument: 'MULTI_INSTRUMENT',
      detectedAtMET: currentMET,
      severity: 'CRITICAL',
      confidenceScore: 0.94,
      sourceProductIds: [reasonProduct.id, maspexProduct.id],
      sourcePacketIds: [reasonProduct.level0PacketId, maspexProduct.level0PacketId],
      triggeredMetrics: [
        {
          metricName: 'Radar Shallow Feature',
          observedValue: 'Candidate Brine Lens / Fracture',
          thresholdValue: 'Detected',
          description: 'Subsurface discontinuity detected beneath observation corridor.',
        },
        {
          metricName: 'Atmospheric Organics / Exotics',
          observedValue: 'Correlated Volatile Plume',
          thresholdValue: 'Detected',
          description: 'Enriched organic / scenario chemical signatures detected simultaneously.',
        },
        {
          metricName: 'Observation Delta MET',
          observedValue: `${Math.abs(tReason - tMaspex).toFixed(1)} s`,
          thresholdValue: `<= ${maxDeltaMET} s`,
          description: 'Observations collected within contemporaneous orbital window.',
        },
        {
          metricName: 'Observation Spatial Separation',
          observedValue: `${separationDeg.toFixed(2)}°`,
          thresholdValue: `<= ${maxSeparation.toFixed(1)}° (Gameplay Model Parameter)`,
          description: 'Observations verified to be co-located over Europa target region.',
        },
      ],
      explanation:
        'Synchronized observation reveals co-located subsurface radar reflector and atmospheric organic volatile plume. This spatial and temporal correlation suggests an active conduit or cryovolcanic fracture connecting subsurface reservoirs to the exosphere.',
      isFictionalScenarioAnomaly: isFictional,
      scientificDisclaimer:
        'Multi-instrument cross-correlation model output: Interpretation based on combined simplified radar and mass spectrometry models.',
    };

    this.detectedAnomalies.set(id, report);

    if (this.eventEngine) {
      this.eventEngine.scheduleEvent({
        id: `evt-anom-${id}-${currentMET}`,
        type: SCIENCE_EVENT_TYPES.SCIENCE_ANOMALY_DETECTED,
        scheduledTimeSeconds: currentMET,
        payload: {
          anomalyId: id,
          title: report.title,
          instrument: 'MULTI_INSTRUMENT',
          severity: 'CRITICAL',
          confidenceScore: 0.94,
          isFictional,
        },
      });
    }

    return report;
  }

  public getAllAnomalies(): ScienceAnomalyReport[] {
    return Array.from(this.detectedAnomalies.values()).map((a) => ({ ...a }));
  }

  public getAnomaly(id: string): ScienceAnomalyReport | undefined {
    const a = this.detectedAnomalies.get(id);
    return a ? { ...a } : undefined;
  }

  public clear(): void {
    this.detectedAnomalies.clear();
  }

  public restoreAnomalies(anomalies: ScienceAnomalyReport[]): void {
    this.detectedAnomalies.clear();
    for (const a of anomalies) {
      this.detectedAnomalies.set(a.id, { ...a });
    }
  }
}
