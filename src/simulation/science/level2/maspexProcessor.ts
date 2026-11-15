/**
 * SECTOR 17 — MASPEX Mass Spectrometer Level 2 Processor
 * Identifies chemical species candidates from calibrated mass spectra by matching
 * detected peaks against a versioned reference library, and computes relative abundances.
 *
 * SCIENTIFIC CONSTRAINTS & INVARIANTS (H-02):
 * 1. Candidate Identification: Chemical assignments are strictly candidate matches within
 *    mass resolution tolerance; never presented as definitive chemical proof.
 * 2. Explicit Tolerance Semantics: Supports absolute tolerance (u), relative tolerance (ppm),
 *    or a combined policy requiring both to be satisfied simultaneously.
 * 3. Confidence Consistency: Confidence scores are calibrated against the effective matching
 *    tolerance policy and criteria.
 * 4. Explicit Provenance: Every candidate species retains provenance tags (VERIFIED, SIMPLIFIED,
 *    or FICTIONAL).
 */

import { MASPEX_REFERENCE_LIBRARY, SCIENTIFIC_DISCLAIMERS } from '../constants';
import type {
  Level1Product,
  MaspexCalibratedData,
  MaspexLevel2Product,
  ReferenceChemicalSpecies,
  CandidateSpeciesMatch,
  MaspexToleranceMode,
} from '../types';

export class InvalidMaspexProcessingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMaspexProcessingInputError';
  }
}

export interface MaspexProcessingOptions {
  referenceLibrary?: ReferenceChemicalSpecies[];
  toleranceU?: number; // Absolute mass tolerance in u (e.g. 0.02 u)
  maxTolerancePpm?: number; // Relative mass tolerance in ppm (e.g. 50 ppm)
  tolerancePolicy?: MaspexToleranceMode;
}

export class MaspexProcessor {
  /**
   * Processes a calibrated Level 1 MASPEX mass spectrometry product into a Level 2 derived product.
   */
  public processLevel2(
    level1Product: Level1Product<MaspexCalibratedData>,
    currentMET: number,
    options: MaspexProcessingOptions = {}
  ): MaspexLevel2Product {
    // 1. Defensive Input Validation
    if (!level1Product || typeof level1Product !== 'object') {
      throw new InvalidMaspexProcessingInputError('processLevel2: level1Product must be an object.');
    }
    if (level1Product.instrument !== 'MASPEX') {
      throw new InvalidMaspexProcessingInputError(
        `processLevel2: Product instrument must be 'MASPEX', received '${level1Product.instrument}'.`
      );
    }

    const calData = level1Product.calibratedData;
    if (!calData || typeof calData !== 'object') {
      throw new InvalidMaspexProcessingInputError('processLevel2: Calibrated data must be present on Level 1 product.');
    }

    // Validate options parameters (H-02)
    if (options.toleranceU !== undefined) {
      if (typeof options.toleranceU !== 'number' || !Number.isFinite(options.toleranceU) || options.toleranceU <= 0) {
        throw new RangeError(`processLevel2: toleranceU must be a positive finite number. Received: ${options.toleranceU}`);
      }
    }

    if (options.maxTolerancePpm !== undefined) {
      if (typeof options.maxTolerancePpm !== 'number' || !Number.isFinite(options.maxTolerancePpm) || options.maxTolerancePpm <= 0) {
        throw new RangeError(`processLevel2: maxTolerancePpm must be a positive finite number. Received: ${options.maxTolerancePpm}`);
      }
    }

    // Determine effective tolerance policy (C-03)
    // Default configuration:
    // - tolerancePolicy: 'COMBINED'
    // - toleranceU: 0.02 u
    // - maxTolerancePpm: 50.0 ppm
    let policy: MaspexToleranceMode;
    if (options.tolerancePolicy !== undefined) {
      policy = options.tolerancePolicy;
    } else if (options.toleranceU !== undefined && options.maxTolerancePpm === undefined) {
      policy = 'ABSOLUTE_ONLY';
    } else if (options.maxTolerancePpm !== undefined && options.toleranceU === undefined) {
      policy = 'PPM_ONLY';
    } else {
      // Default when options are empty, undefined, or specify both tolerances
      policy = 'COMBINED';
    }

    const library = options.referenceLibrary ?? MASPEX_REFERENCE_LIBRARY;
    if (!Array.isArray(library) || library.length === 0) {
      throw new InvalidMaspexProcessingInputError('processLevel2: Reference library must be a non-empty array.');
    }

    // Validate library reference masses
    for (const ref of library) {
      if (!ref || typeof ref.exactMassU !== 'number' || !Number.isFinite(ref.exactMassU) || ref.exactMassU <= 0) {
        throw new InvalidMaspexProcessingInputError(
          `processLevel2: Invalid reference mass for species '${ref?.id}': Must be a positive finite number.`
        );
      }
    }

    const detectedPeaks = calData.detectedPeaks ?? [];

    // 2. Calculate Total Ion Current (TIC) and Base Peak
    let totalIonCurrent = 0;
    let basePeakIntensity = 0;
    let basePeakMz = 0;

    for (const p of detectedPeaks) {
      if (typeof p.intensity !== 'number' || !Number.isFinite(p.intensity) || p.intensity < 0) {
        throw new InvalidMaspexProcessingInputError('processLevel2: Peak intensity must be a non-negative finite number.');
      }
      if (typeof p.mz !== 'number' || !Number.isFinite(p.mz) || p.mz <= 0) {
        throw new InvalidMaspexProcessingInputError('processLevel2: Peak mz must be a positive finite number.');
      }
      totalIonCurrent += p.intensity;
      if (p.intensity > basePeakIntensity) {
        basePeakIntensity = p.intensity;
        basePeakMz = p.mz;
      }
    }

    // Fallback if no peaks detected
    if (detectedPeaks.length === 0 || totalIonCurrent === 0) {
      return {
        id: `l2-maspex-${level1Product.packetId}`,
        level1Id: level1Product.id,
        level0PacketId: level1Product.packetId,
        instrument: 'MASPEX',
        processingMET: currentMET,
        algorithmVersion: 'maspex-proc-v1.1',
        calibrationProfileVersion: level1Product.calibrationProfileVersion,
        sizeBytes: Math.floor(level1Product.sizeBytes * 0.75),
        totalIonCurrent: 0,
        basePeakMz: 0,
        basePeakIntensity: 0,
        candidateSpecies: [],
        unidentifiedPeaks: [],
        qualityFlags: [...level1Product.qualityFlags, 'LOW_SNR'],
        limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.MASPEX_SPECIES_DISCLAIMER,
      };
    }

    // 3. Match peaks against reference library using explicit policy (H-02)
    const candidateSpecies: CandidateSpeciesMatch[] = [];
    const unidentifiedPeaks: Array<{ mz: number; intensity: number; snr: number }> = [];

    const defaultTolU = options.toleranceU ?? 0.02;
    const defaultPpm = options.maxTolerancePpm ?? 50.0;

    for (const peak of detectedPeaks) {
      let bestMatch: ReferenceChemicalSpecies | undefined;
      let minNormalizedScore = Infinity;
      let bestAbsDiff = Infinity;
      let bestPpmDiff = Infinity;

      for (const ref of library) {
        const absDiff = Math.abs(peak.mz - ref.exactMassU);
        const ppmDiff = (absDiff / ref.exactMassU) * 1e6;

        const limitU = ref.toleranceU ?? defaultTolU;
        const limitPpm = defaultPpm;

        let passes = false;
        let normalizedScore = 0;

        switch (policy) {
          case 'ABSOLUTE_ONLY':
            passes = absDiff <= limitU;
            normalizedScore = absDiff / limitU;
            break;
          case 'PPM_ONLY':
            passes = ppmDiff <= limitPpm;
            normalizedScore = ppmDiff / limitPpm;
            break;
          case 'COMBINED':
            // Candidate must satisfy both absolute and relative tolerances.
            // Reference-specific override (ref.toleranceU) modifies limitU, but does NOT bypass limitPpm.
            passes = absDiff <= limitU && ppmDiff <= limitPpm;
            normalizedScore = Math.max(absDiff / limitU, ppmDiff / limitPpm);
            break;
        }

        if (passes && normalizedScore < minNormalizedScore) {
          minNormalizedScore = normalizedScore;
          bestMatch = ref;
          bestAbsDiff = absDiff;
          bestPpmDiff = ppmDiff;
        }
      }

      if (bestMatch) {
        const massErrorU = Number(bestAbsDiff.toFixed(5));
        const massErrorPpm = Number(bestPpmDiff.toFixed(1));
        const confidenceScore = Number(Math.max(0.1, 1.0 - minNormalizedScore).toFixed(3));
        const relativeAbundancePercent = Number(((peak.intensity / basePeakIntensity) * 100).toFixed(2));
        const ticFraction = Number((peak.intensity / totalIonCurrent).toFixed(4));

        candidateSpecies.push({
          species: { ...bestMatch },
          observedMz: peak.mz,
          exactMassU: bestMatch.exactMassU,
          massErrorU,
          massErrorPpm,
          confidenceScore,
          relativeAbundancePercent,
          ticFraction,
        });
      } else {
        unidentifiedPeaks.push({
          mz: peak.mz,
          intensity: peak.intensity,
          snr: peak.snr,
        });
      }
    }

    const qualityFlags = [...level1Product.qualityFlags];
    if (unidentifiedPeaks.length > candidateSpecies.length) {
      qualityFlags.push('UNRESOLVED_PEAKS');
    }

    return {
      id: `l2-maspex-${level1Product.packetId}`,
      level1Id: level1Product.id,
      level0PacketId: level1Product.packetId,
      instrument: 'MASPEX',
      processingMET: currentMET,
      algorithmVersion: 'maspex-proc-v1.1',
      calibrationProfileVersion: level1Product.calibrationProfileVersion,
      sizeBytes: Math.floor(level1Product.sizeBytes * 0.8),
      totalIonCurrent: Number(totalIonCurrent.toFixed(1)),
      basePeakMz,
      basePeakIntensity: Number(basePeakIntensity.toFixed(1)),
      candidateSpecies,
      unidentifiedPeaks,
      qualityFlags,
      limitationsDisclaimer: SCIENTIFIC_DISCLAIMERS.MASPEX_SPECIES_DISCLAIMER,
    };
  }
}
