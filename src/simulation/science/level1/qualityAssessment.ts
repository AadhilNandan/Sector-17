/**
 * SECTOR 17 — Science Quality Assessment (Level 1)
 * Evaluates calibrated data against instrument physical criteria to assign
 * standardized QualityFlags.
 */

import type { QualityFlag, CalibrationProfile } from '../types';

export interface QualityAssessmentInput {
  instrument: 'REASON' | 'MASPEX';
  peakValue: number;
  snrDb: number;
  baselineOffsetRemoved: number;
  saturationThreshold?: number;
  lowSnrThresholdDb?: number;
  calibrationProfile?: CalibrationProfile;
}

export function assessDataQuality(input: QualityAssessmentInput): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const lowSnrLimit = input.lowSnrThresholdDb ?? 10.0;
  const saturationLimit =
    input.saturationThreshold ??
    (input.instrument === 'REASON' ? 0.98 : 65000.0);

  // Check saturation
  if (input.peakValue >= saturationLimit) {
    flags.push('SATURATED');
  }

  // Check SNR
  if (input.snrDb < lowSnrLimit) {
    flags.push('LOW_SNR');
  }

  // Check baseline drift
  if (input.instrument === 'REASON' && input.baselineOffsetRemoved > 0.2) {
    flags.push('BASELINE_DRIFT');
  } else if (input.instrument === 'MASPEX' && input.baselineOffsetRemoved > 20.0) {
    flags.push('BASELINE_DRIFT');
  }

  // Check calibration profile plausibility
  if (input.calibrationProfile) {
    if (input.calibrationProfile.gainMultiplier <= 0 || input.calibrationProfile.gainMultiplier > 10.0) {
      flags.push('CALIBRATION_SUSPECT');
    }
    if (input.calibrationProfile.noiseThreshold < 0) {
      flags.push('CALIBRATION_SUSPECT');
    }
  } else {
    flags.push('CALIBRATION_SUSPECT');
  }

  if (flags.length === 0) {
    flags.push('NOMINAL');
  }

  return flags;
}

