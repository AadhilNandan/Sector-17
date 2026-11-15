/**
 * SECTOR 17 — REASON Radar Level 2 Processor
 * Derives subsurface depth profiles, two-way travel time, and candidate
 * reflector structural classifications from calibrated ice-penetrating radar echoes.
 *
 * SCIENTIFIC EQUATIONS & UNCERTAINTY PROPAGATION (H-01 / H-05):
 * 1. Two-way travel time:
 *    \Delta\tau_k = t_k - t_surface
 *
 * 2. Medium propagation speed:
 *    v = c / \sqrt{\epsilon_r}
 *
 * 3. Reflector depth:
 *    d(\Delta\tau, \epsilon_r) = (c * \Delta\tau) / (2 * \sqrt{\epsilon_r})
 *
 * 4. Sensitivity coefficients (partial derivatives):
 *    \partial d / \partial \tau = c / (2 * \sqrt{\epsilon_r})
 *    |\partial d / \partial \epsilon_r| = (c * \Delta\tau) / (4 * \epsilon_r^{3/2}) = d / (2 * \epsilon_r)
 *
 * 5. Uncertainty components:
 *    - Timing uncertainty (\sigma_\tau): Discretization uncertainty is half a sampling bin:
 *      \sigma_\tau = \Delta t_sample / 2
 *      termTime = (\partial d / \partial \tau) * \sigma_\tau = (c * \Delta t_sample) / (4 * \sqrt{\epsilon_r})
 *    - Permittivity uncertainty (\sigma_\epsilon):
 *      termEps = |\partial d / \partial \epsilon_r| * \sigma_\epsilon = d * (\sigma_\epsilon / (2 * \epsilon_r))
 *
 * 6. Uncertainty synthesis:
 *    - 1-\sigma Standard Uncertainty via RSS (Root-Sum-Square for independent uncorrelated errors):
 *      \sigma_d = \sqrt{ termTime^2 + termEps^2 }
 *    - Conservative worst-case linear upper bound (triangle inequality):
 *      \delta d_worst = termTime + termEps
 *
 * MODEL LIMITATIONS & INVARIANTS:
 * - Depth calculations depend on configurable dielectric models (no single constant assumed).
 * - Depth outputs are strictly labelled as simplified model outputs, not authoritative ocean confirmation.
 */

import { SPEED_OF_LIGHT_M_PER_S, STANDARD_DIELECTRIC_MODELS, SCIENTIFIC_DISCLAIMERS } from '../constants';
import { detectWaveformPeaks } from './peakDetection';
import type {
  Level1Product,
  ReasonCalibratedData,
  ReasonLevel2Product,
  DielectricModel,
  RadarReflector,
  RadarReflectorCandidateType,
} from '../types';

export class InvalidRadarProcessingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRadarProcessingInputError';
  }
}

export class ReasonProcessor {
  /**
   * Processes a calibrated Level 1 REASON radar product into a Level 2 derived product.
   *
   * @throws InvalidRadarProcessingInputError if inputs fail defensive validation (H-05).
   */
  public processLevel2(
    level1Product: Level1Product<ReasonCalibratedData>,
    currentMET: number,
    dielectricModelOverride?: DielectricModel
  ): ReasonLevel2Product {
    // 1. Defensive Level 2 Boundary Validation (H-05)
    if (!level1Product || typeof level1Product !== 'object') {
      throw new InvalidRadarProcessingInputError('processLevel2: level1Product must be an object.');
    }
    if (level1Product.instrument !== 'REASON') {
      throw new InvalidRadarProcessingInputError(
        `processLevel2: Product instrument must be 'REASON', received '${level1Product.instrument}'.`
      );
    }

    const calData = level1Product.calibratedData;
    if (!calData || typeof calData !== 'object') {
      throw new InvalidRadarProcessingInputError('processLevel2: Calibrated data must be present on Level 1 product.');
    }

    const dt = calData.samplingIntervalSeconds;
    if (typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) {
      throw new InvalidRadarProcessingInputError(
        `processLevel2: samplingIntervalSeconds must be a positive finite number. Received: ${dt}`
      );
    }

    const echoes = calData.calibratedEchoes;
    if (!Array.isArray(echoes) || echoes.length === 0) {
      throw new InvalidRadarProcessingInputError('processLevel2: calibratedEchoes must be a non-empty array of numbers.');
    }

    const timeBins = calData.timeBinsSeconds;
    if (!Array.isArray(timeBins) || timeBins.length !== echoes.length) {
      throw new InvalidRadarProcessingInputError(
        `processLevel2: timeBinsSeconds must be an array matching calibratedEchoes length (${echoes.length}).`
      );
    }

    for (let i = 0; i < echoes.length; i++) {
      if (typeof echoes[i] !== 'number' || !Number.isFinite(echoes[i])) {
        throw new InvalidRadarProcessingInputError(
          `processLevel2: calibratedEchoes[${i}] must be a finite number. Received: ${echoes[i]}`
        );
      }
      if (typeof timeBins[i] !== 'number' || !Number.isFinite(timeBins[i]) || timeBins[i] < 0) {
        throw new InvalidRadarProcessingInputError(
          `processLevel2: timeBinsSeconds[${i}] must be a non-negative finite number. Received: ${timeBins[i]}`
        );
      }
    }

    const model = dielectricModelOverride ?? STANDARD_DIELECTRIC_MODELS.COLD_PURE_ICE;
    if (!model || typeof model !== 'object') {
      throw new InvalidRadarProcessingInputError('processLevel2: Dielectric model must be an object.');
    }
    if (typeof model.relativePermittivity !== 'number' || !Number.isFinite(model.relativePermittivity) || model.relativePermittivity <= 0) {
      throw new InvalidRadarProcessingInputError(
        `processLevel2: relativePermittivity must be a positive finite number. Received: ${model.relativePermittivity}`
      );
    }
    if (typeof model.permittivityUncertainty !== 'number' || !Number.isFinite(model.permittivityUncertainty) || model.permittivityUncertainty < 0) {
      throw new InvalidRadarProcessingInputError(
        `processLevel2: permittivityUncertainty must be a non-negative finite number. Received: ${model.permittivityUncertainty}`
      );
    }

    // 2. Detect echo peaks
    const detectedPeaks = detectWaveformPeaks(echoes, timeBins, 0.05, 0.02);

    if (detectedPeaks.length === 0) {
      // No detectable peaks above noise floor
      return {
        id: `l2-reason-${level1Product.packetId}`,
        level1Id: level1Product.id,
        level0PacketId: level1Product.packetId,
        instrument: 'REASON',
        processingMET: currentMET,
        algorithmVersion: 'reason-proc-v1.1',
        calibrationProfileVersion: level1Product.calibrationProfileVersion,
        sizeBytes: Math.floor(level1Product.sizeBytes * 0.8),
        surfaceEchoTimeSeconds: 0,
        dielectricModelUsed: model,
        detectedReflectors: [],
        qualityFlags: [...level1Product.qualityFlags, 'LOW_SNR'],
        limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.REASON_DEPTH_DISCLAIMER,
      };
    }

    // 3. Identify primary surface echo peak (first prominent peak)
    const surfacePeak = detectedPeaks[0];
    const surfaceTime = surfacePeak.timeSeconds;
    const surfaceAmp = Math.max(1e-4, surfacePeak.amplitude);

    // 4. Process reflectors with mathematically rigorous uncertainty propagation (H-01)
    const reflectors: RadarReflector[] = [];
    let basalCandidateDepth: number | undefined;

    // Timing uncertainty term from ADC half-sampling-bin discretization: \sigma_\tau = dt / 2
    const termDt = (SPEED_OF_LIGHT_M_PER_S * dt) / (4 * Math.sqrt(model.relativePermittivity));

    // Surface reflector (depth = 0 m; permittivity uncertainty contribution is 0)
    reflectors.push({
      id: `ref-0-surface`,
      peakIndex: surfacePeak.index,
      travelTimeSeconds: 0,
      echoAmplitude: surfacePeak.amplitude,
      estimatedDepthMetres: 0.0,
      depthUncertaintyMetres: Number(termDt.toFixed(2)),
      worstCaseDepthUncertaintyMetres: Number(termDt.toFixed(2)),
      reflectionCoefficientEstimate: 1.0,
      reflectorTypeCandidate: 'SURFACE',
    });

    // Subsurface reflectors
    for (let k = 1; k < detectedPeaks.length; k++) {
      const peak = detectedPeaks[k];
      const deltaTau = peak.timeSeconds - surfaceTime;

      if (deltaTau <= 0) continue;

      // Medium propagation depth: d = (c * \Delta\tau) / (2 * \sqrt{\epsilon_r})
      const depth = (SPEED_OF_LIGHT_M_PER_S * deltaTau) / (2 * Math.sqrt(model.relativePermittivity));

      // Sensitivity component for permittivity: termEps = d * (\sigma_\epsilon / (2 * \epsilon_r))
      const termEps = depth * (model.permittivityUncertainty / (2 * model.relativePermittivity));

      // 1-sigma RSS Standard Uncertainty (H-01)
      const rssUncertainty = Math.sqrt(termDt * termDt + termEps * termEps);

      // Conservative worst-case linear upper bound
      const worstCaseUncertainty = termDt + termEps;

      // Ensure finite non-negative values
      const depthUncertaintyMetres = Number.isFinite(rssUncertainty) ? Number(rssUncertainty.toFixed(1)) : 0;
      const worstCaseDepthUncertaintyMetres = Number.isFinite(worstCaseUncertainty) ? Number(worstCaseUncertainty.toFixed(1)) : 0;

      // Reflection coefficient relative to surface echo: |R|^2 ~ (A_sub / A_surf)^2
      const reflectionCoeff = Math.min(1.0, Math.pow(peak.amplitude / surfaceAmp, 2));

      // Candidate classification
      let candidateType: RadarReflectorCandidateType = 'INTERNAL_HORIZON';
      if (depth < 3000) {
        candidateType = 'SHALLOW_ICE_FEATURE';
      } else if (reflectionCoeff > 0.25 && depth > 2000) {
        candidateType = 'BRINE_POCKET_CANDIDATE';
      } else if (depth >= 15000) {
        candidateType = 'BASAL_INTERFACE_CANDIDATE';
        basalCandidateDepth = depth;
      }

      reflectors.push({
        id: `ref-${k}-${candidateType.toLowerCase()}`,
        peakIndex: peak.index,
        travelTimeSeconds: Number(deltaTau.toExponential(4)),
        echoAmplitude: Number(peak.amplitude.toFixed(4)),
        estimatedDepthMetres: Number(depth.toFixed(1)),
        depthUncertaintyMetres,
        worstCaseDepthUncertaintyMetres,
        reflectionCoefficientEstimate: Number(reflectionCoeff.toFixed(4)),
        reflectorTypeCandidate: candidateType,
      });
    }

    const qualityFlags = [...level1Product.qualityFlags];
    if (reflectors.length <= 1) {
      qualityFlags.push('UNRESOLVED_PEAKS');
    }

    return {
      id: `l2-reason-${level1Product.packetId}`,
      level1Id: level1Product.id,
      level0PacketId: level1Product.packetId,
      instrument: 'REASON',
      processingMET: currentMET,
      algorithmVersion: 'reason-proc-v1.1',
      calibrationProfileVersion: level1Product.calibrationProfileVersion,
      sizeBytes: Math.floor(level1Product.sizeBytes * 0.85),
      surfaceEchoTimeSeconds: surfaceTime,
      dielectricModelUsed: model,
      detectedReflectors: reflectors,
      estimatedIceThicknessCandidateMetres: basalCandidateDepth ? Number(basalCandidateDepth.toFixed(1)) : undefined,
      qualityFlags,
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.REASON_DEPTH_DISCLAIMER,
    };
  }
}
