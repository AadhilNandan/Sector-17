/**
 * SECTOR 17 — Peak Detection Utilities (Level 2)
 * Deterministic peak identification for radar echoes and mass spectrometry spectra.
 */

export interface DetectedWaveformPeak {
  index: number;
  timeSeconds: number;
  amplitude: number;
  prominence: number;
}

/**
 * Detects local maxima in a 1D waveform exceeding an absolute minimum amplitude
 * and a prominence threshold above local baseline.
 */
export function detectWaveformPeaks(
  amplitudes: number[],
  timeBins: number[],
  minAmplitude: number = 0.05,
  minProminence: number = 0.02
): DetectedWaveformPeak[] {
  const peaks: DetectedWaveformPeak[] = [];

  for (let i = 1; i < amplitudes.length - 1; i++) {
    const prev = amplitudes[i - 1];
    const curr = amplitudes[i];
    const next = amplitudes[i + 1];

    if (curr >= minAmplitude && curr > prev && curr >= next) {
      // Find local minima to the left and right within a search radius (up to 15 bins)
      const window = 15;
      let leftMin = curr;
      for (let j = Math.max(0, i - window); j < i; j++) {
        if (amplitudes[j] < leftMin) leftMin = amplitudes[j];
      }
      let rightMin = curr;
      for (let j = i + 1; j <= Math.min(amplitudes.length - 1, i + window); j++) {
        if (amplitudes[j] < rightMin) rightMin = amplitudes[j];
      }

      const prominence = curr - Math.max(leftMin, rightMin);
      if (prominence >= minProminence) {
        peaks.push({
          index: i,
          timeSeconds: timeBins[i] ?? i,
          amplitude: curr,
          prominence,
        });
      }
    }
  }

  return peaks;
}

