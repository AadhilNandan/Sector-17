/**
 * SECTOR 17 — Decision Evidence Management
 * Ingests, validates, classifies, and indexes multi-source spacecraft evidence:
 * science products, anomaly detections, subsystem health, engineering margins,
 * telemetry status, and communications availability.
 *
 * SAFETY INVARIANTS:
 * 1. Strict provenance preservation: distinguishes VERIFIED, SIMPLIFIED, FICTIONAL, and UNVERIFIED.
 * 2. Missing evidence is NEVER interpreted as a confirmed discovery or successful validation.
 * 3. Fictional narrative constructs (e.g., Relic-Omega) are strictly flagged and prevented
 *    from masquerading as verified physical/scientific discoveries.
 */

import type {
  DecisionEvidenceItem,
  EvidenceProvenance,
  EvidenceSourceType,
  SpacecraftEngineeringSnapshot,
} from './types';
import type { ScienceProductLevel2, ScienceAnomalyReport, ReasonLevel2Product, MaspexLevel2Product } from '../science/types';
import type { SubsystemType, SubsystemStatus } from '../flightSoftware/types';

export class DecisionEvidenceManager {
  private evidenceStore: Map<string, DecisionEvidenceItem> = new Map();
  private engineeringSnapshot?: SpacecraftEngineeringSnapshot;

  /**
   * Directly stores a validated evidence item into the store.
   */
  public addEvidence<T = unknown>(item: DecisionEvidenceItem<T>): void {
    if (!item || typeof item !== 'object') {
      throw new TypeError('DecisionEvidenceManager.addEvidence: item must be an object.');
    }
    if (!item.id || typeof item.id !== 'string' || item.id.trim().length === 0) {
      throw new TypeError('DecisionEvidenceManager.addEvidence: item.id must be a non-empty string.');
    }
    if (typeof item.confidenceScore !== 'number' || !Number.isFinite(item.confidenceScore)) {
      throw new TypeError('DecisionEvidenceManager.addEvidence: confidenceScore must be a finite number.');
    }
    if (item.confidenceScore < 0.0 || item.confidenceScore > 1.0) {
      throw new RangeError(
        `DecisionEvidenceManager.addEvidence: confidenceScore must be within [0.0, 1.0]. Received: ${item.confidenceScore}`
      );
    }
    this.evidenceStore.set(item.id.trim(), item);
  }

  /**
   * Ingests a Level 2 scientific data product (REASON or MASPEX) and creates typed evidence.
   */
  public ingestScienceProduct(product: ScienceProductLevel2, currentMET: number): DecisionEvidenceItem {
    if (!product || typeof product !== 'object') {
      throw new TypeError('ingestScienceProduct: product must be an object.');
    }
    if (typeof currentMET !== 'number' || !Number.isFinite(currentMET) || currentMET < 0) {
      throw new TypeError(`ingestScienceProduct: currentMET must be a non-negative finite number. Received: ${currentMET}`);
    }

    const acquisitionMET = product.acquisitionMET;
    if (
      typeof acquisitionMET !== 'number' ||
      !Number.isFinite(acquisitionMET) ||
      acquisitionMET < 0
    ) {
      throw new TypeError(
        `ingestScienceProduct: Product '${product.id}' lacks a valid non-negative finite acquisitionMET. Received: ${acquisitionMET}`
      );
    }

    const isReason = product.instrument === 'REASON';
    let summary: string;
    let confidence = 0.85;
    let isFictional = false;
    let provenance: EvidenceProvenance = 'VERIFIED';

    if (isReason) {
      const reasonProd = product as ReasonLevel2Product;
      const deepReflector = reasonProd.detectedReflectors.find(
        (r) => r.estimatedDepthMetres && r.estimatedDepthMetres > 500
      );
      if (deepReflector) {
        summary = `REASON radar sounding detected deep reflector candidate at ${deepReflector.estimatedDepthMetres.toFixed(
          0
        )}m depth (Candidate: ${deepReflector.reflectorTypeCandidate}).`;
        confidence = Math.min(1.0, deepReflector.echoAmplitude);
      } else {
        summary = `REASON radar sounding detected surface and shallow reflectors (${reasonProd.detectedReflectors.length} detected).`;
      }
      if (reasonProd.qualityFlags.includes('DEGRADED') || reasonProd.qualityFlags.includes('LOW_SNR')) {
        provenance = 'SIMPLIFIED';
        confidence *= 0.7;
      }
    } else {
      const maspexProd = product as MaspexLevel2Product;
      const candidates = maspexProd.candidateSpecies;
      const hasExotic = candidates.some((c) => c.species.category === 'EXOTIC' || c.species.provenance === 'FICTIONAL');
      if (hasExotic) {
        isFictional = true;
        provenance = 'FICTIONAL';
      }

      if (candidates.length > 0) {
        const top = candidates[0];
        summary = `MASPEX mass spectrometry identified ${top.species.name} (${top.species.formula}, m/z ~ ${top.observedMz.toFixed(
          3
        )}) with confidence ${(top.confidenceScore * 100).toFixed(1)}%.`;
        confidence = top.confidenceScore;
      } else {
        summary = `MASPEX spectrum acquired with ${maspexProd.unidentifiedPeaks.length} unidentified peaks.`;
        confidence = 0.4;
      }
    }

    const evidenceItem: DecisionEvidenceItem<ScienceProductLevel2> = {
      id: `evi-science-${product.instrument.toLowerCase()}-${product.id}`,
      sourceType: 'SCIENCE_PRODUCT',
      sourceId: product.id,
      provenance,
      confidenceScore: confidence,
      timestampMET: acquisitionMET,
      ingestionMET: currentMET,
      summary,
      isFictionalConstruct: isFictional,
      payload: product,
    };

    this.addEvidence(evidenceItem);
    return evidenceItem;
  }

  /**
   * Ingests a confirmed scientific anomaly report.
   * Strictly flags fictional scenario constructs (e.g. Relic-Omega).
   */
  public ingestAnomalyReport(anomaly: ScienceAnomalyReport, currentMET: number): DecisionEvidenceItem {
    if (!anomaly || typeof anomaly !== 'object') {
      throw new TypeError('ingestAnomalyReport: anomaly must be an object.');
    }
    if (typeof currentMET !== 'number' || !Number.isFinite(currentMET) || currentMET < 0) {
      throw new TypeError(`ingestAnomalyReport: currentMET must be a non-negative finite number. Received: ${currentMET}`);
    }

    const isFictional = anomaly.isFictionalScenarioAnomaly === true;
    const provenance: EvidenceProvenance = isFictional ? 'FICTIONAL' : 'VERIFIED';
    const detectionMET = typeof anomaly.detectedAtMET === 'number' && Number.isFinite(anomaly.detectedAtMET) && anomaly.detectedAtMET >= 0
      ? anomaly.detectedAtMET
      : currentMET;

    const evidenceItem: DecisionEvidenceItem<ScienceAnomalyReport> = {
      id: `evi-anomaly-${anomaly.id}`,
      sourceType: 'ANOMALY_REPORT',
      sourceId: anomaly.id,
      provenance,
      confidenceScore: anomaly.confidenceScore,
      timestampMET: detectionMET,
      ingestionMET: currentMET,
      summary: `Anomaly '${anomaly.title}' (${anomaly.severity}) confirmed across ${anomaly.sourceProductIds.length} science products: ${anomaly.explanation}`,
      isFictionalConstruct: isFictional,
      payload: anomaly,
    };

    this.addEvidence(evidenceItem);
    return evidenceItem;
  }

  /**
   * Ingests a subsystem operational status update.
   */
  public ingestSubsystemStatus(
    subsystem: SubsystemType,
    status: SubsystemStatus,
    currentMET: number,
    details?: string
  ): DecisionEvidenceItem {
    const isNominal = status === 'NOMINAL';
    const confidence = status === 'FAULT' ? 0.95 : isNominal ? 0.9 : 0.7;

    const evidenceItem: DecisionEvidenceItem<{ subsystem: SubsystemType; status: SubsystemStatus }> = {
      id: `evi-subsys-${subsystem.toLowerCase()}-${currentMET}`,
      sourceType: 'SUBSYSTEM_STATUS',
      sourceId: `subsys-${subsystem}`,
      provenance: 'VERIFIED',
      confidenceScore: confidence,
      timestampMET: currentMET,
      summary: `Subsystem '${subsystem}' reported state '${status}'${details ? `: ${details}` : '.'}`,
      isFictionalConstruct: false,
      payload: { subsystem, status },
    };

    this.addEvidence(evidenceItem);
    return evidenceItem;
  }

  /**
   * Ingests the current integrated spacecraft engineering snapshot.
   */
  public ingestEngineeringSnapshot(snapshot: SpacecraftEngineeringSnapshot): void {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new TypeError('ingestEngineeringSnapshot: snapshot must be an object.');
    }
    this.engineeringSnapshot = { ...snapshot };
  }

  public getEngineeringSnapshot(): SpacecraftEngineeringSnapshot | undefined {
    return this.engineeringSnapshot ? { ...this.engineeringSnapshot } : undefined;
  }

  /* -------------------------------------------------------------------------- */
  /* Query Methods                                                              */
  /* -------------------------------------------------------------------------- */

  public getEvidence(id: string): DecisionEvidenceItem | undefined {
    return this.evidenceStore.get(id.trim());
  }

  public hasEvidence(id: string): boolean {
    return this.evidenceStore.has(id.trim());
  }

  public getAllEvidence(): ReadonlyArray<DecisionEvidenceItem> {
    return Array.from(this.evidenceStore.values());
  }

  public getEvidenceByType(sourceType: EvidenceSourceType): DecisionEvidenceItem[] {
    return Array.from(this.evidenceStore.values()).filter((e) => e.sourceType === sourceType);
  }

  public getEvidenceBySourceId(sourceId: string): DecisionEvidenceItem[] {
    return Array.from(this.evidenceStore.values()).filter((e) => e.sourceId === sourceId);
  }

  public getVerifiedEvidence(rejectFictional: boolean = true): DecisionEvidenceItem[] {
    return Array.from(this.evidenceStore.values()).filter((e) => {
      if (rejectFictional && e.isFictionalConstruct) return false;
      return e.provenance === 'VERIFIED';
    });
  }

  public clear(): void {
    this.evidenceStore.clear();
    this.engineeringSnapshot = undefined;
  }

  public restoreEvidence(items: readonly DecisionEvidenceItem[], snapshot?: SpacecraftEngineeringSnapshot): void {
    this.evidenceStore.clear();
    for (const item of items) {
      this.evidenceStore.set(item.id.trim(), item);
    }
    this.engineeringSnapshot = snapshot ? { ...snapshot } : undefined;
  }
}

