/**
 * SECTOR 17 — Noise Reduction & SNR Computation (Level 1)
 * Computes baseline noise floor, applies noise thresholds, and evaluates
 * Signal-to-Noise Ratio (SNR) in decibels (dB).
 */

export interface NoiseAssessmentResult {
  baselineNoiseFloor: number;
  peakSignal: number;
  snrDb: number;
  cleanedSamples: number[];
}

/**
 * Evaluates noise floor and SNR for a 1D sequence of amplitude samples (e.g. radar echoes).
 */
export function processRadarNoiseReduction(
  samples: number[],
  noiseThresholdFraction: number = 0.05
): NoiseAssessmentResult {
  if (!samples || samples.length === 0) {
    return {
      baselineNoiseFloor: 0,
      peakSignal: 0,
      snrDb: 0,
      cleanedSamples: [],
    };
  }

  // Estimate noise floor using lowest quartile (25th percentile) of amplitudes
  const sorted = [...samples].sort((a, b) => a - b);
  const q25Index = Math.floor(sorted.length * 0.25);
  const baselineNoiseFloor = Math.max(1e-6, sorted[q25Index]);

  let peakSignal = 0;
  for (const s of samples) {
    if (s > peakSignal) peakSignal = s;
  }

  // Linear SNR
  const snrLinear = peakSignal / baselineNoiseFloor;
  const snrDb = snrLinear > 0 ? 20 * Math.log10(Math.max(1.0, snrLinear)) : 0;

  // Threshold cutoff
  const cutoff = peakSignal * noiseThresholdFraction;
  const cleanedSamples = samples.map((s) => (s < cutoff ? 0 : s));

  return {
    baselineNoiseFloor,
    peakSignal,
    snrDb,
    cleanedSamples,
  };
}

/**
 * Evaluates noise floor and SNR for mass spectrometry intensity samples.
 */
export function processMaspexNoiseReduction(
  intensities: number[],
  absoluteNoiseCutoff: number = 5.0
): { baselineNoiseFloor: number; peakIntensity: number; snrDb: number; cleanedIntensities: number[] } {
  if (!intensities || intensities.length === 0) {
    return { baselineNoiseFloor: 0, peakIntensity: 0, snrDb: 0, cleanedIntensities: [] };
  }

  const sorted = [...intensities].sort((a, b) => a - b);
  const medianIndex = Math.floor(sorted.length * 0.5);
  const baselineNoiseFloor = Math.max(1.0, sorted[medianIndex]);

  let peakIntensity = 0;
  for (const val of intensities) {
    if (val > peakIntensity) peakIntensity = val;
  }

  const snrLinear = peakIntensity / baselineNoiseFloor;
  const snrDb = snrLinear > 0 ? 10 * Math.log10(Math.max(1.0, snrLinear)) : 0;

  const cleanedIntensities = intensities.map((val) => (val < absoluteNoiseCutoff ? 0 : val));

  return {
    baselineNoiseFloor,
    peakIntensity,
    snrDb,
    cleanedIntensities,
  };
}

