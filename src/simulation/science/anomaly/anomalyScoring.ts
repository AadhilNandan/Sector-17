/**
 * SECTOR 17 — Science Anomaly Scoring Rules
 * Deterministic, explainable threshold rules evaluating derived Level 2 science products.
 *
 * SCIENTIFIC CLASSIFICATION:
 * - Differentiates verified physical anomalies (e.g. brine lenses, shallow reflectors)
 *   from fictional mission scenario anomalies (e.g. Relic-Omega traces).
 * - Generates quantitative metrics (observed vs threshold) with zero random number generation.
 */

import type {
  ReasonLevel2Product,
  MaspexLevel2Product,
  AnomalyTriggerMetric,
  AnomalySeverity,
} from '../types';

export interface AnomalyEvaluation {
  hasAnomaly: boolean;
  title: string;
  severity: AnomalySeverity;
  confidenceScore: number;
  triggeredMetrics: AnomalyTriggerMetric[];
  explanation: string;
  isFictionalScenarioAnomaly: boolean;
}

/**
 * Evaluates a REASON radar Level 2 product for physical structural anomalies.
 */
export function evaluateReasonAnomalies(product: ReasonLevel2Product): AnomalyEvaluation | null {
  const reflectors = product.detectedReflectors;
  if (!reflectors || reflectors.length <= 1) {
    return null; // Only surface echo or no echoes
  }

  // 1. Check for Shallow Perched Brine Lens Candidate
  // High reflection coefficient (> 0.30) at shallow depths (< 5000 m)
  for (const ref of reflectors) {
    if (ref.reflectorTypeCandidate !== 'SURFACE' && ref.estimatedDepthMetres < 5000 && ref.reflectionCoefficientEstimate >= 0.30) {
      return {
        hasAnomaly: true,
        title: 'Shallow Conductive Dielectric Anomaly (Candidate Perched Brine Lens)',
        severity: 'HIGH',
        confidenceScore: Number(Math.min(0.95, 0.5 + ref.reflectionCoefficientEstimate * 0.5).toFixed(2)),
        triggeredMetrics: [
          {
            metricName: 'Subsurface Reflection Coefficient |R|^2',
            observedValue: ref.reflectionCoefficientEstimate,
            thresholdValue: 0.30,
            differenceRatio: Number((ref.reflectionCoefficientEstimate / 0.30).toFixed(2)),
            description: 'Unusually high dielectric contrast at shallow depth inconsistent with homogeneous cold ice.',
          },
          {
            metricName: 'Estimated Reflector Depth (m)',
            observedValue: ref.estimatedDepthMetres,
            thresholdValue: '< 5000 m',
            description: 'Reflector localized within the brittle upper ice shell.',
          },
        ],
        explanation: `REASON radar detected an unusually strong subsurface reflection (|R|^2 = ${ref.reflectionCoefficientEstimate}) at depth ${ref.estimatedDepthMetres} m. In terrestrial analogs, such high reflection coefficients indicate liquid water or hypersaline brine pockets perched within the ice shell.`,
        isFictionalScenarioAnomaly: false,
      };
    }
  }

  // 2. Check for Candidate Basal Interface at Expected Ice Shell Boundary
  const basalCandidate = reflectors.find((r) => r.reflectorTypeCandidate === 'BASAL_INTERFACE_CANDIDATE');
  if (basalCandidate && basalCandidate.reflectionCoefficientEstimate >= 0.20) {
    return {
      hasAnomaly: true,
      title: 'Deep Basal Dielectric Transition (Candidate Ice-Ocean Boundary)',
      severity: 'MEDIUM',
      confidenceScore: 0.82,
      triggeredMetrics: [
        {
          metricName: 'Basal Reflector Depth (m)',
          observedValue: basalCandidate.estimatedDepthMetres,
          thresholdValue: '> 15000 m',
          description: 'Deep boundary consistent with predicted ice shell convective base.',
        },
        {
          metricName: 'Basal Reflection Coefficient',
          observedValue: basalCandidate.reflectionCoefficientEstimate,
          thresholdValue: 0.20,
          description: 'Pronounced dielectric transition indicative of water or slush.',
        },
      ],
      explanation: `REASON sounding detected a coherent basal reflector at estimated depth of ${basalCandidate.estimatedDepthMetres} m. This reflection is consistent with the candidate transition from warm convective ice to a liquid ocean interface under simplified dielectric assumptions.`,
      isFictionalScenarioAnomaly: false,
    };
  }

  return null;
}

/**
 * Evaluates a MASPEX mass spectrometry Level 2 product for chemical composition anomalies.
 */
export function evaluateMaspexAnomalies(product: MaspexLevel2Product): AnomalyEvaluation | null {
  // 1. Check for Fictional Mission Scenario Exotic Signatures (e.g. Relic-Omega traces)
  const fictionalCandidate = product.candidateSpecies.find(
    (c) => c.species.provenance === 'FICTIONAL' && c.confidenceScore >= 0.60
  );

  if (fictionalCandidate) {
    return {
      hasAnomaly: true,
      title: `Exotic Synthetic Molecular Signature: ${fictionalCandidate.species.name}`,
      severity: 'CRITICAL',
      confidenceScore: fictionalCandidate.confidenceScore,
      triggeredMetrics: [
        {
          metricName: 'Observed Mass-to-Charge (m/z)',
          observedValue: fictionalCandidate.observedMz,
          thresholdValue: fictionalCandidate.exactMassU,
          differenceRatio: Number(fictionalCandidate.massErrorU.toFixed(5)),
          description: `Exact mass match within ${fictionalCandidate.massErrorPpm} ppm.`,
        },
        {
          metricName: 'Relative Signal Abundance (%)',
          observedValue: fictionalCandidate.relativeAbundancePercent,
          thresholdValue: '> 0.5%',
          description: 'Detectable abundance of unnatural complex molecule.',
        },
      ],
      explanation: `MASPEX detected an anomalous high-mass spectral signature at m/z ${fictionalCandidate.observedMz} matching fictional scenario marker '${fictionalCandidate.species.id}'. This signature features unnatural mass defects inconsistent with prebiotic abiotic Jovian volatiles.`,
      isFictionalScenarioAnomaly: true,
    };
  }

  // 2. Check for Elevated Organic Volatiles Anomaly
  let organicTicFraction = 0;
  for (const c of product.candidateSpecies) {
    if (c.species.category === 'ORGANIC') {
      organicTicFraction += c.ticFraction;
    }
  }

  if (organicTicFraction >= 0.20) {
    return {
      hasAnomaly: true,
      title: 'Elevated Organic Volatile Concentration in Exosphere/Plume',
      severity: 'HIGH',
      confidenceScore: 0.88,
      triggeredMetrics: [
        {
          metricName: 'Organic TIC Fraction',
          observedValue: Number((organicTicFraction * 100).toFixed(1)) + '%',
          thresholdValue: '20.0%',
          differenceRatio: Number((organicTicFraction / 0.20).toFixed(2)),
          description: 'Fraction of total ion current contributed by organic molecules.',
        },
      ],
      explanation: `MASPEX analysis reveals that ${Number((organicTicFraction * 100).toFixed(1))}% of detected volatiles correspond to organic carbon species. This significant enrichment exceeds typical interplanetary background, suggesting endogenous organic synthesis or hydrothermal venting.`,
      isFictionalScenarioAnomaly: false,
    };
  }

  return null;
}

