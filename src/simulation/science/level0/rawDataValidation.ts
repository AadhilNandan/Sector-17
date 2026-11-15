/**
 * SECTOR 17 — Raw Data Validation (Level 0)
 * Validates structural integrity, sample sanity, timestamps, and checksums
 * for incoming science instrument telemetry packets.
 */

import type {
  InstrumentType,
  ReasonRawPayload,
  MaspexRawPayload,
} from '../types';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  checksumValid: boolean;
}

/**
 * Calculates a deterministic Fletcher-16 modular block checksum over an array of numbers.
 * Note: Fletcher-16 is an additive modular checksum, not a polynomial cyclic redundancy check (CRC).
 */
export function calculateSampleChecksum(numbers: number[]): number {
  let sum1 = 0;
  let sum2 = 0;
  for (const n of numbers) {
    const intVal = Math.floor(Math.abs(n * 1000)) % 255;
    sum1 = (sum1 + intVal) % 255;
    sum2 = (sum2 + sum1) % 255;
  }
  return (sum2 << 8) | sum1;
}

/**
 * Validates a REASON radar raw telemetry payload.
 */
export function validateReasonRawPayload(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { isValid: false, error: 'validateReasonRawPayload: Payload must be an object.', checksumValid: false };
  }

  const p = payload as Partial<ReasonRawPayload>;

  if (typeof p.centerFrequencyHz !== 'number' || !Number.isFinite(p.centerFrequencyHz) || p.centerFrequencyHz <= 0) {
    return { isValid: false, error: 'Invalid centerFrequencyHz: Must be a positive finite number.', checksumValid: false };
  }

  if (typeof p.samplingIntervalSeconds !== 'number' || !Number.isFinite(p.samplingIntervalSeconds) || p.samplingIntervalSeconds <= 0) {
    return { isValid: false, error: 'Invalid samplingIntervalSeconds: Must be a positive finite number.', checksumValid: false };
  }

  if (typeof p.transmitPowerWatts !== 'number' || !Number.isFinite(p.transmitPowerWatts) || p.transmitPowerWatts < 0) {
    return { isValid: false, error: 'Invalid transmitPowerWatts: Must be non-negative.', checksumValid: false };
  }

  if (!Array.isArray(p.echoSamples) || p.echoSamples.length === 0) {
    return { isValid: false, error: 'Invalid echoSamples: Must be a non-empty array of amplitude numbers.', checksumValid: false };
  }

  for (let i = 0; i < p.echoSamples.length; i++) {
    const s = p.echoSamples[i];
    if (typeof s !== 'number' || !Number.isFinite(s) || s < 0) {
      return { isValid: false, error: `Invalid sample at index ${i}: Must be a non-negative finite amplitude.`, checksumValid: false };
    }
  }

  if (typeof p.sampleCount === 'number' && p.sampleCount !== p.echoSamples.length) {
    return {
      isValid: false,
      error: `Sample count mismatch: metadata specifies ${p.sampleCount} but array has ${p.echoSamples.length}.`,
      checksumValid: false,
    };
  }

  if (typeof p.transmitTimeMET !== 'number' || p.transmitTimeMET < 0) {
    return { isValid: false, error: 'Invalid transmitTimeMET: Must be non-negative number.', checksumValid: false };
  }

  let checksumValid = true;
  if (p.checksum !== undefined) {
    const expected = calculateSampleChecksum(p.echoSamples);
    if (p.checksum !== expected) {
      return {
        isValid: false,
        error: `Checksum verification failed: expected 0x${expected.toString(16)}, got 0x${p.checksum.toString(16)}.`,
        checksumValid: false,
      };
    }
  }

  return { isValid: true, checksumValid };
}

/**
 * Validates a MASPEX mass spectrometer raw telemetry payload.
 */
export function validateMaspexRawPayload(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { isValid: false, error: 'validateMaspexRawPayload: Payload must be an object.', checksumValid: false };
  }

  const p = payload as Partial<MaspexRawPayload>;

  if (p.ionizationMode !== 'ELECTRON_IMPACT' && p.ionizationMode !== 'ION_EXTRACTION') {
    return { isValid: false, error: `Invalid ionizationMode '${p.ionizationMode}'.`, checksumValid: false };
  }

  if (!Array.isArray(p.massRangeU) || p.massRangeU.length !== 2 || p.massRangeU[0] >= p.massRangeU[1]) {
    return { isValid: false, error: 'Invalid massRangeU: Must be a tuple [minU, maxU] where minU < maxU.', checksumValid: false };
  }

  if (typeof p.integrationTimeSeconds !== 'number' || p.integrationTimeSeconds <= 0) {
    return { isValid: false, error: 'Invalid integrationTimeSeconds: Must be positive number.', checksumValid: false };
  }

  if (typeof p.detectorGain !== 'number' || p.detectorGain <= 0) {
    return { isValid: false, error: 'Invalid detectorGain: Must be positive number.', checksumValid: false };
  }

  if (!Array.isArray(p.mzSamples) || p.mzSamples.length === 0) {
    return { isValid: false, error: 'Invalid mzSamples: Must be a non-empty array.', checksumValid: false };
  }

  for (let i = 0; i < p.mzSamples.length; i++) {
    const item = p.mzSamples[i];
    if (!item || typeof item.mz !== 'number' || !Number.isFinite(item.mz) || item.mz <= 0) {
      return { isValid: false, error: `Invalid mz at sample ${i}: Must be positive finite number.`, checksumValid: false };
    }
    if (typeof item.intensity !== 'number' || !Number.isFinite(item.intensity) || item.intensity < 0) {
      return { isValid: false, error: `Invalid intensity at sample ${i}: Must be non-negative finite number.`, checksumValid: false };
    }
  }

  if (typeof p.sampleCount === 'number' && p.sampleCount !== p.mzSamples.length) {
    return {
      isValid: false,
      error: `Sample count mismatch: metadata specifies ${p.sampleCount} but array has ${p.mzSamples.length}.`,
      checksumValid: false,
    };
  }

  let checksumValid = true;
  if (p.checksum !== undefined) {
    const sampleNumbers = p.mzSamples.map((s) => s.mz * 100 + s.intensity);
    const expected = calculateSampleChecksum(sampleNumbers);
    if (p.checksum !== expected) {
      return {
        isValid: false,
        error: `Checksum verification failed: expected 0x${expected.toString(16)}, got 0x${p.checksum.toString(16)}.`,
        checksumValid: false,
      };
    }
  }

  return { isValid: true, checksumValid };
}

/**
 * Validates any raw instrument payload based on instrument type.
 */
export function validateRawPayload(instrument: InstrumentType, payload: unknown): ValidationResult {
  switch (instrument) {
    case 'REASON':
      return validateReasonRawPayload(payload);
    case 'MASPEX':
      return validateMaspexRawPayload(payload);
    default:
      return {
        isValid: false,
        error: `Unknown instrument '${instrument}'.`,
        checksumValid: false,
      };
  }
}

